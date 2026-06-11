import { useCallback, useRef, useState } from 'react';

export function useSpeechSynthesis() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackIdRef = useRef(0);

  const stop = useCallback(() => {
    playbackIdRef.current += 1;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = '';
      audioRef.current = null;
    }
    window.speechSynthesis?.cancel();
    setIsPlaying(false);
  }, []);

  const speakWithBrowserVoice = useCallback((text: string) => {
    return new Promise<void>((resolve) => {
      if (!('speechSynthesis' in window)) {
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-IN';
      utterance.rate = 0.96;
      utterance.pitch = 1;
      utterance.onend = () => {
        setIsPlaying(false);
        resolve();
      };
      utterance.onerror = () => {
        setIsPlaying(false);
        resolve();
      };

      setIsPlaying(true);
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const speak = useCallback(
    async (text: string): Promise<void> => {
      stop(); // stop any active playback
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

        if (!data.audio) throw new Error('No audio content returned');

        const audioPayload = data.audio.startsWith('data:')
          ? data.audio
          : `data:audio/wav;base64,${data.audio}`;
        const audioUrl = audioPayload;
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        setIsPlaying(true);

        return new Promise((resolve) => {
          audio.onended = () => {
            if (playbackIdRef.current === playbackId) setIsPlaying(false);
            resolve();
          };
          audio.onerror = () => {
            if (playbackIdRef.current === playbackId) setIsPlaying(false);
            resolve();
          };
          audio.play().catch((err) => {
            console.error('Audio playback error:', err);
            if (playbackIdRef.current === playbackId) setIsPlaying(false);
            resolve();
          });
        });
      } catch (error) {
        console.error('Speech synthesis error:', error);
        setError(
          error instanceof Error ? error.message : 'Speech synthesis failed'
        );
        setIsPlaying(false);
        await speakWithBrowserVoice(text);
      }
    },
    [speakWithBrowserVoice, stop]
  );

  return {
    isPlaying,
    error,
    speak,
    stop,
  };
}
