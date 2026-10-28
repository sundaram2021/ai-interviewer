import { useCallback, useRef, useState } from 'react';

type ProgressHandler = (partial: string) => void;

function wordsAt(text: string, ratio: number) {
  const words = text.trim().split(/\s+/);
  if (words.length === 0) return '';
  const count =
    ratio >= 1 ? words.length : Math.max(1, Math.ceil(ratio * words.length));
  return words.slice(0, count).join(' ');
}

export function useSpeechSynthesis() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackIdRef = useRef(0);
  const progressTimerRef = useRef<number | null>(null);

  const clearProgressTimer = useCallback(() => {
    if (progressTimerRef.current !== null) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    playbackIdRef.current += 1;
    clearProgressTimer();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = '';
      audioRef.current = null;
    }
    window.speechSynthesis?.cancel();
    setIsPlaying(false);
  }, [clearProgressTimer]);

  const speakWithBrowserVoice = useCallback(
    (text: string, onProgress?: ProgressHandler) => {
      return new Promise<void>((resolve) => {
        if (!('speechSynthesis' in window)) {
          onProgress?.(text);
          resolve();
          return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-IN';
        utterance.rate = 0.96;
        utterance.pitch = 1;
        utterance.onboundary = (event) => {
          const charLength =
            (event as SpeechSynthesisEvent & { charLength?: number })
              .charLength ?? 0;
          const end = Math.min(text.length, event.charIndex + charLength);
          if (end > 0) onProgress?.(text.slice(0, end).trim());
        };
        utterance.onend = () => {
          onProgress?.(text);
          setIsPlaying(false);
          resolve();
        };
        utterance.onerror = () => {
          onProgress?.(text);
          setIsPlaying(false);
          resolve();
        };

        setIsPlaying(true);
        window.speechSynthesis.speak(utterance);
      });
    },
    []
  );

  const speak = useCallback(
    async (text: string, onProgress?: ProgressHandler): Promise<void> => {
      stop();
      const playbackId = playbackIdRef.current;
      setError(null);

      try {
        const response = await fetch('/api/speech?mode=tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error || 'TTS request failed');
        }
        const data = await response.json();
        if (playbackIdRef.current !== playbackId) return;

        if (!data.audio) throw new Error('No audio content returned');

        const audioPayload = data.audio.startsWith('data:')
          ? data.audio
          : `data:audio/wav;base64,${data.audio}`;
        const audio = new Audio(audioPayload);
        audioRef.current = audio;

        setIsPlaying(true);

        const startedAt = Date.now();
        const estimatedMs = Math.max(
          2500,
          text.trim().split(/\s+/).length * 330
        );
        clearProgressTimer();
        progressTimerRef.current = window.setInterval(() => {
          if (playbackIdRef.current !== playbackId) return;
          const ratio =
            Number.isFinite(audio.duration) && audio.duration > 0
              ? audio.currentTime / audio.duration
              : (Date.now() - startedAt) / estimatedMs;
          onProgress?.(wordsAt(text, Math.min(ratio, 0.99)));
        }, 120);

        return new Promise((resolve) => {
          const finish = (complete: boolean) => {
            if (playbackIdRef.current !== playbackId) {
              resolve();
              return;
            }
            clearProgressTimer();
            if (complete) onProgress?.(text);
            setIsPlaying(false);
            resolve();
          };

          audio.onended = () => finish(true);
          audio.onerror = () => finish(false);
          audio.play().catch((err) => {
            console.error('Audio playback error:', err);
            finish(false);
          });
        });
      } catch (error) {
        if (playbackIdRef.current !== playbackId) return;
        console.error('Speech synthesis error:', error);
        setError(
          error instanceof Error ? error.message : 'Speech synthesis failed'
        );
        setIsPlaying(false);
        await speakWithBrowserVoice(text, onProgress);
      }
    },
    [clearProgressTimer, speakWithBrowserVoice, stop]
  );

  return {
    isPlaying,
    error,
    speak,
    stop,
  };
}
