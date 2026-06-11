'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Mic, MicOff, PhoneOff } from 'lucide-react';
import { useAudioRecorder } from '@/hooks/use-audio-recorder';
import { useSpeechSynthesis } from '@/hooks/use-speech-synthesis';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function InterviewScreen({
  userId,
  onReset,
}: {
  userId: string;
  onReset: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const {
    isRecording,
    isTranscribing,
    cancelRecording,
    startRecording,
    stopRecording,
  } = useAudioRecorder();
  const { isPlaying, error: speechError, speak, stop } = useSpeechSynthesis();
  const activeRef = useRef(false);
  const listeningRef = useRef(false);
  const listenForAnswerRef = useRef<() => Promise<void>>(async () => {});
  const messagesRef = useRef<Message[]>([]);
  const runIdRef = useRef(0);

  const status = isPlaying
    ? 'Interviewer speaking'
    : isRecording
      ? 'Listening'
      : isTranscribing
        ? 'Transcribing'
        : loading
          ? 'Analyzing'
          : 'Ready';

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const getInterviewResponse = useCallback(
    async (history: Message[]) => {
      setLoading(true);
      try {
        const res = await fetch('/api/interview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, messages: history }),
        });
        const data = await res.json();
        if (!res.ok)
          throw new Error(data.error || 'Failed to get interview response');
        return typeof data.content === 'string' ? data.content.trim() : '';
      } catch (err) {
        console.error('Failed to get interview response:', err);
        return '';
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  const scheduleListening = useCallback(() => {
    window.setTimeout(() => {
      void listenForAnswerRef.current();
    }, 300);
  }, []);

  const listenForAnswer = useCallback(async () => {
    if (!activeRef.current || listeningRef.current) return;

    listeningRef.current = true;
    const transcript = await startRecording({ autoStopOnSilence: true });
    listeningRef.current = false;

    if (!activeRef.current) return;

    const answer = transcript.trim();
    if (!answer) {
      scheduleListening();
      return;
    }

    const history = [
      ...messagesRef.current,
      { role: 'user' as const, content: answer },
    ];
    messagesRef.current = history;
    setMessages(history);

    const reply = await getInterviewResponse(history);
    if (!activeRef.current || !reply) return;

    const nextMessages = [
      ...messagesRef.current,
      { role: 'assistant' as const, content: reply },
    ];
    messagesRef.current = nextMessages;
    setMessages(nextMessages);

    await speak(reply);

    if (activeRef.current) {
      scheduleListening();
    }
  }, [getInterviewResponse, scheduleListening, speak, startRecording]);

  useEffect(() => {
    listenForAnswerRef.current = listenForAnswer;
  }, [listenForAnswer]);

  useEffect(() => {
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    activeRef.current = true;

    const startInterview = async () => {
      const reply = await getInterviewResponse([]);
      if (!activeRef.current || runIdRef.current !== runId || !reply) return;

      const initialMessages = [{ role: 'assistant' as const, content: reply }];
      messagesRef.current = initialMessages;
      setMessages(initialMessages);

      await speak(reply);

      if (activeRef.current && runIdRef.current === runId) {
        scheduleListening();
      }
    };

    startInterview();

    return () => {
      activeRef.current = false;
      runIdRef.current += 1;
      listeningRef.current = false;
      stop();
      cancelRecording();
    };
  }, [cancelRecording, getInterviewResponse, scheduleListening, speak, stop]);

  const handleEndInterview = () => {
    activeRef.current = false;
    stop();
    cancelRecording();
    onReset();
  };

  const handleUserResponse = async () => {
    if (isRecording) {
      await stopRecording();
      return;
    }

    void listenForAnswer();
  };

  return (
    <div className="flex h-[78vh] w-full max-w-4xl flex-col items-center justify-between px-4 py-8">
      <div className="flex min-h-16 flex-col items-center justify-center gap-3 text-center">
        <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-4 py-2">
          {(loading || isTranscribing) && !isPlaying ? (
            <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
          ) : (
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isRecording
                  ? 'bg-emerald-400'
                  : isPlaying
                    ? 'bg-cyan-300'
                    : 'bg-zinc-500'
              }`}
            />
          )}
          <span className="text-sm font-medium text-zinc-200">{status}</span>
        </div>
        {speechError && (
          <p className="max-w-md text-xs text-amber-300">
            Voice service fallback active.
          </p>
        )}
      </div>

      <div className="grid w-full flex-1 place-items-center gap-10 sm:grid-cols-2 sm:gap-16">
        <div className="flex flex-col items-center">
          <button
            type="button"
            disabled
            className="relative flex h-40 w-40 cursor-default items-center justify-center rounded-full border border-zinc-800 bg-zinc-950/60"
            aria-label="Interviewer microphone"
          >
            {isPlaying && (
              <span className="absolute inset-0 rounded-full bg-cyan-400/20 animate-ping" />
            )}
            <span
              className={`flex h-28 w-28 items-center justify-center rounded-full transition-all ${
                isPlaying
                  ? 'bg-cyan-400 text-zinc-950 shadow-[0_0_34px_rgba(34,211,238,0.28)]'
                  : loading
                    ? 'bg-zinc-800 text-cyan-300'
                    : 'bg-zinc-900 text-zinc-500'
              }`}
            >
              {loading && !isPlaying ? (
                <Loader2 className="h-11 w-11 animate-spin" />
              ) : (
                <Mic className="h-12 w-12" />
              )}
            </span>
          </button>
          <p className="mt-4 text-sm font-semibold text-zinc-200">
            Interviewer mic
          </p>
          <div className="mt-3 flex h-5 items-center gap-1.5">
            {[0, 1, 2, 3].map((item) => (
              <span
                key={item}
                className={`h-1.5 w-6 rounded-full ${
                  isPlaying || loading
                    ? 'bg-cyan-300 animate-pulse'
                    : 'bg-zinc-800'
                }`}
                style={{ animationDelay: `${item * 110}ms` }}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={handleUserResponse}
            disabled={loading || isPlaying || isTranscribing}
            className="relative flex h-40 w-40 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950/60 transition-all hover:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 disabled:cursor-not-allowed disabled:opacity-70"
            aria-label={
              isRecording
                ? 'Stop candidate microphone'
                : 'Start candidate microphone'
            }
          >
            {isRecording && (
              <span className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" />
            )}
            <span
              className={`flex h-28 w-28 items-center justify-center rounded-full transition-all ${
                isRecording
                  ? 'bg-emerald-400 text-zinc-950 shadow-[0_0_34px_rgba(52,211,153,0.28)]'
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              {isRecording ? (
                <Mic className="h-12 w-12" />
              ) : (
                <MicOff className="h-12 w-12" />
              )}
            </span>
          </button>
          <p className="mt-4 text-sm font-semibold text-zinc-200">Your mic</p>
          <div className="mt-3 flex h-5 items-center gap-1.5">
            {[0, 1, 2, 3].map((item) => (
              <span
                key={item}
                className={`h-1.5 w-6 rounded-full ${isRecording ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-800'}`}
                style={{ animationDelay: `${item * 110}ms` }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex w-full justify-center border-t border-zinc-900 pt-7">
        <button
          onClick={handleEndInterview}
          className="flex items-center gap-2.5 rounded-full border border-red-900/50 bg-red-950/45 px-8 py-3.5 text-sm font-medium text-red-300 shadow-lg shadow-red-950/20 transition-all hover:bg-red-900/40"
        >
          <PhoneOff className="h-4 w-4" /> End interview
        </button>
      </div>
    </div>
  );
}
