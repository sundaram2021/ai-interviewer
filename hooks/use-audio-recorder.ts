import { useCallback, useRef, useState, type MutableRefObject } from 'react';

type StartRecordingOptions = {
  autoStopOnSilence?: boolean;
};

interface AudioRecorderOptions {
  lastSpeechAtRef?: MutableRefObject<number>;
}

const SILENCE_TIMEOUT_MS = 4000;
const MIN_RECORDING_MS = 1200;

type WindowWithWebkitAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};

function getSupportedAudioMimeType() {
  const types = ['audio/webm', 'audio/mp4', 'audio/wav'];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

function normalizeMimeType(mimeType: string) {
  return mimeType.split(';')[0] || 'audio/webm';
}

function extensionForMimeType(mimeType: string) {
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('ogg')) return 'ogg';
  return 'webm';
}

export function useAudioRecorder({
  lastSpeechAtRef,
}: AudioRecorderOptions = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const maxRecordingTimerRef = useRef<number | null>(null);
  const stopPromiseRef = useRef<Promise<string> | null>(null);
  const resolveStopRef = useRef<((transcript: string) => void) | null>(null);
  const hitMaxRef = useRef(false);
  const hadSpeechRef = useRef(false);

  const stopStreamTracks = useCallback(() => {
    if (mediaRecorderRef.current?.stream) {
      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track) => track.stop());
    }
  }, []);

  const clearRecordingTimers = useCallback(() => {
    if (silenceTimerRef.current) {
      window.clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (maxRecordingTimerRef.current) {
      window.clearTimeout(maxRecordingTimerRef.current);
      maxRecordingTimerRef.current = null;
    }
  }, []);

  const closeAudioContext = useCallback(() => {
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  const stopRecording = useCallback((): Promise<string> => {
    if (!mediaRecorderRef.current) {
      return Promise.resolve('');
    }

    if (mediaRecorderRef.current.state === 'inactive') {
      return stopPromiseRef.current || Promise.resolve('');
    }

    const promise =
      stopPromiseRef.current ||
      new Promise<string>((resolve) => {
        resolveStopRef.current = resolve;
      });
    stopPromiseRef.current = promise;
    mediaRecorderRef.current.stop();
    return promise;
  }, []);

  const startSilenceDetection = useCallback(
    (stream: MediaStream) => {
      const AudioContextClass =
        window.AudioContext ||
        (window as WindowWithWebkitAudio).webkitAudioContext;
      if (!AudioContextClass) return;

      const audioContext = new AudioContextClass();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      const samples = new Uint8Array(analyser.fftSize);
      let startedSpeaking = false;
      let quietSince = 0;
      const startedAt = Date.now();

      source.connect(analyser);
      audioContextRef.current = audioContext;

      silenceTimerRef.current = window.setInterval(() => {
        analyser.getByteTimeDomainData(samples);
        let total = 0;
        for (const sample of samples) {
          const value = (sample - 128) / 128;
          total += value * value;
        }

        const volume = Math.sqrt(total / samples.length);
        const now = Date.now();
        const elapsed = now - startedAt;
        const externalSpeechAt = lastSpeechAtRef?.current ?? 0;
        const externalValid = externalSpeechAt >= startedAt;
        const externalRecentlyActive =
          externalValid && now - externalSpeechAt < 1500;
        const isVoice = volume > 0.025;

        if (isVoice || externalRecentlyActive) {
          hadSpeechRef.current = true;
        }

        if (isVoice) {
          startedSpeaking = true;
          quietSince = 0;
          return;
        }

        if (externalRecentlyActive) {
          startedSpeaking = true;
        }

        if (!startedSpeaking || elapsed < MIN_RECORDING_MS) return;

        quietSince = quietSince || now;
        const lastActivity = Math.max(
          quietSince,
          externalValid ? externalSpeechAt : 0
        );
        if (now - lastActivity > SILENCE_TIMEOUT_MS) {
          void stopRecording();
        }
      }, 160);
    },
    [lastSpeechAtRef, stopRecording]
  );

  const startRecording = useCallback(
    async (options: StartRecordingOptions = {}) => {
      try {
        setError(null);
        if (mediaRecorderRef.current?.state === 'recording') {
          return stopPromiseRef.current || Promise.resolve('');
        }

        hitMaxRef.current = false;
        hadSpeechRef.current = false;
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        const mimeType = getSupportedAudioMimeType();
        const mediaRecorder = new MediaRecorder(
          stream,
          mimeType ? { mimeType } : undefined
        );
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];
        stopPromiseRef.current = new Promise<string>((resolve) => {
          resolveStopRef.current = resolve;
        });

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        mediaRecorderRef.current.onstop = async () => {
          const mimeType = normalizeMimeType(
            mediaRecorderRef.current?.mimeType || 'audio/webm'
          );
          const extension = extensionForMimeType(mimeType);
          const audioBlob = new Blob(chunksRef.current, { type: mimeType });
          setIsRecording(false);
          setIsTranscribing(true);

          clearRecordingTimers();
          closeAudioContext();
          stopStreamTracks();

          try {
            if (audioBlob.size === 0) {
              throw new Error('No audio was captured. Please try again.');
            }

            const formData = new FormData();
            formData.append('file', audioBlob, `audio.${extension}`);

            const res = await fetch('/api/speech?mode=stt', {
              method: 'POST',
              body: formData,
            });

            if (!res.ok) {
              const data = (await res.json().catch(() => null)) as {
                error?: string;
              } | null;
              throw new Error(data?.error || 'Speech-to-text request failed.');
            }
            const data = await res.json();
            setError(null);
            resolveStopRef.current?.(data.transcript || '');
          } catch (error) {
            console.error('Transcription failed:', error);
            setError(
              error instanceof Error
                ? error.message
                : 'Speech-to-text request failed.'
            );
            resolveStopRef.current?.('');
          } finally {
            setIsTranscribing(false);
            stopPromiseRef.current = null;
            resolveStopRef.current = null;
          }
        };

        mediaRecorder.start();
        setIsRecording(true);

        if (options.autoStopOnSilence) {
          hitMaxRef.current = false;
          startSilenceDetection(stream);
          maxRecordingTimerRef.current = window.setTimeout(() => {
            hitMaxRef.current = true;
            void stopRecording();
          }, 28000);
        }

        return stopPromiseRef.current;
      } catch (err) {
        console.error('Error accessing microphone:', err);
        alert('Could not access microphone. Please check permissions.');
        return '';
      }
    },
    [
      clearRecordingTimers,
      closeAudioContext,
      startSilenceDetection,
      stopRecording,
      stopStreamTracks,
    ]
  );

  const cancelRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    clearRecordingTimers();
    closeAudioContext();
    stopStreamTracks();
    chunksRef.current = [];
    setIsRecording(false);
    setIsTranscribing(false);
    resolveStopRef.current?.('');
    resolveStopRef.current = null;
    stopPromiseRef.current = null;
  }, [clearRecordingTimers, closeAudioContext, stopStreamTracks]);

  return {
    isRecording,
    isTranscribing,
    error,
    hadSpeechRef,
    hitMaxRef,
    cancelRecording,
    startRecording,
    stopRecording,
  };
}
