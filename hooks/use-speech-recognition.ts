'use client';

import { useCallback, useEffect, useRef } from 'react';

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}

interface RecognitionEvent {
  results: ArrayLike<RecognitionResult>;
}

interface RecognitionErrorEvent {
  error?: string;
}

interface RecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionCtor = new () => RecognitionInstance;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return scope.SpeechRecognition || scope.webkitSpeechRecognition || null;
}

export function useSpeechRecognition(
  onPartial: (text: string) => void,
  onActivity?: () => void
) {
  const recognitionRef = useRef<RecognitionInstance | null>(null);
  const finalRef = useRef('');
  const committedRef = useRef('');
  const partialRef = useRef('');
  const restartRef = useRef(false);

  useEffect(() => {
    return () => {
      restartRef.current = false;
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      try {
        recognition?.abort();
      } catch {
        // Recognition may already be stopped.
      }
    };
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    const previous = recognitionRef.current;
    recognitionRef.current = null;
    try {
      previous?.abort();
    } catch {
      // Ignore a recognition session that already ended.
    }

    finalRef.current = '';
    committedRef.current = '';
    partialRef.current = '';
    let recognition: RecognitionInstance;
    try {
      recognition = new Ctor();
    } catch {
      return;
    }
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';
    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition) return;
      let finalText = committedRef.current;
      let interimText = '';
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) finalText += text;
        else interimText += text;
      }
      finalRef.current = finalText.trim();
      partialRef.current = interimText.trim();
      if (interimText) onActivity?.();
      onPartial(`${finalText} ${interimText}`.trim());
    };
    recognition.onerror = (event) => {
      if (
        event.error === 'not-allowed' ||
        event.error === 'service-not-allowed'
      ) {
        restartRef.current = false;
      }
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      committedRef.current = finalRef.current;
      if (!restartRef.current) return;
      try {
        recognition.start();
      } catch {
        restartRef.current = false;
      }
    };

    recognitionRef.current = recognition;
    restartRef.current = true;
    try {
      recognition.start();
    } catch {
      restartRef.current = false;
    }
  }, [onActivity, onPartial]);

  const stop = useCallback(() => {
    restartRef.current = false;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        try {
          recognition.abort();
        } catch {
          // Ignore a recognition session that already ended.
        }
      }
    }
    return `${finalRef.current} ${partialRef.current}`.trim();
  }, []);

  return { start, stop };
}
