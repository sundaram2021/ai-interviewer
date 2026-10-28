'use client';

import { useEffect } from 'react';
import type { ChatMessage } from '@/lib/types';

interface Options {
  hasHistory: boolean;
  activeRef: { current: boolean };
  runIdRef: { current: number };
  listeningRef: { current: boolean };
  ask: (messages: ChatMessage[]) => Promise<{ content: string } | null>;
  append: (messages: ChatMessage[]) => void;
  speak: (text: string, onProgress: (text: string) => void) => Promise<void>;
  scheduleListening: () => void;
  stopLiveTranscript: () => void;
  stopSpeech: () => void;
  cancelRecording: () => void;
  setUserCaption: (value: string) => void;
  setInterviewerCaption: (value: string) => void;
}

export function useInterviewStart({
  hasHistory,
  activeRef,
  runIdRef,
  listeningRef,
  ask,
  append,
  speak,
  scheduleListening,
  stopLiveTranscript,
  stopSpeech,
  cancelRecording,
  setUserCaption,
  setInterviewerCaption,
}: Options) {
  useEffect(() => {
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    activeRef.current = true;

    const startInterview = async () => {
      if (hasHistory) return;

      const reply = await ask([]);
      if (!activeRef.current || runIdRef.current !== runId || !reply?.content)
        return;

      append([{ role: 'assistant', content: reply.content }]);
      setUserCaption('');
      setInterviewerCaption('');
      await speak(reply.content, setInterviewerCaption);
      setInterviewerCaption(reply.content);

      if (activeRef.current && runIdRef.current === runId) {
        scheduleListening();
      }
    };

    void startInterview();

    return () => {
      activeRef.current = false;
      runIdRef.current += 1;
      listeningRef.current = false;
      stopLiveTranscript();
      stopSpeech();
      cancelRecording();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
