import { useCallback, useRef, useState } from 'react';

type StartRecordingOptions = {
  autoStopOnSilence?: boolean;
};

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

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const maxRecordingTimerRef = useRef<number | null>(null);
  const stopPromiseRef = useRef<Promise<string> | null>(null);
  const resolveStopRef = useRef<((transcript: string) => void) | null>(null);

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
        const elapsed = Date.now() - startedAt;
        const isVoice = volume > 0.025;

        if (isVoice) {
          startedSpeaking = true;
          quietSince = 0;
          return;
        }

        if (!startedSpeaking || elapsed < 1200) return;

        quietSince = quietSince || Date.now();
        if (Date.now() - quietSince > 1300) {
          void stopRecording();
        }
      }, 160);
    },
    [stopRecording]
  );

  const startRecording = useCallback(
    async (options: StartRecordingOptions = {}) => {
      try {
        if (mediaRecorderRef.current?.state === 'recording') {
          return stopPromiseRef.current || Promise.resolve('');
        }

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
            const formData = new FormData();
            formData.append('file', audioBlob, `audio.${extension}`);

            const res = await fetch('/api/speech?mode=stt', {
              method: 'POST',
              body: formData,
            });

            if (!res.ok) throw new Error('STT Request failed');
            const data = await res.json();
            resolveStopRef.current?.(data.transcript || '');
          } catch (error) {
            console.error('Transcription failed:', error);
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
          startSilenceDetection(stream);
          maxRecordingTimerRef.current = window.setTimeout(() => {
            void stopRecording();
          }, 45000);
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
    cancelRecording,
    startRecording,
    stopRecording,
  };
}
