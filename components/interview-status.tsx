'use client';

import { Loader2 } from 'lucide-react';

interface InterviewStatusProps {
  loading: boolean;
  isRecording: boolean;
  isPlaying: boolean;
  isTranscribing: boolean;
  compacted: boolean;
  speechError: string | null;
  transcriptionError: string | null;
  sessionError: string;
}

export function InterviewStatus({
  loading,
  isRecording,
  isPlaying,
  isTranscribing,
  compacted,
  speechError,
  transcriptionError,
  sessionError,
}: InterviewStatusProps) {
  const status = isPlaying
    ? 'Interviewer speaking'
    : isRecording
      ? 'Listening'
      : isTranscribing
        ? 'Transcribing'
        : loading
          ? 'Analyzing'
          : 'Ready';

  return (
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

      {compacted && (
        <p className="text-xs text-cyan-300">
          Earlier conversation summarized to save context.
        </p>
      )}
      {speechError && (
        <p className="max-w-md text-xs text-amber-300">
          Voice service fallback active.
        </p>
      )}
      {transcriptionError && (
        <p className="max-w-md text-xs text-amber-300">{transcriptionError}</p>
      )}
      {sessionError && (
        <p className="max-w-md text-xs text-red-300">{sessionError}</p>
      )}
    </div>
  );
}
