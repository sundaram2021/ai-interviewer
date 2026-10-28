'use client';

import { Loader2, Mic, MicOff } from 'lucide-react';

interface InterviewControlsProps {
  isRecording: boolean;
  isPlaying: boolean;
  loading: boolean;
  isTranscribing: boolean;
  interviewerCaption: string;
  userCaption: string;
  onToggleMic: () => void;
}

const meterBars = [0, 1, 2, 3];

export function InterviewControls({
  isRecording,
  isPlaying,
  loading,
  isTranscribing,
  interviewerCaption,
  userCaption,
  onToggleMic,
}: InterviewControlsProps) {
  return (
    <div className="grid w-full flex-1 place-items-center gap-10 sm:grid-cols-2 sm:gap-16">
      <div className="flex flex-col items-center">
        <button
          type="button"
          disabled
          className="relative flex h-40 w-40 cursor-default items-center justify-center rounded-full border border-zinc-800 bg-zinc-950/60"
          aria-label="Interviewer microphone"
        >
          {isPlaying && (
            <span className="absolute inset-0 animate-ping rounded-full bg-cyan-400/20" />
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
        <p
          aria-live="polite"
          className={`mt-2 line-clamp-3 min-h-10 max-w-56 text-center text-xs leading-relaxed ${
            isPlaying ? 'text-cyan-200' : 'text-zinc-400'
          }`}
        >
          {interviewerCaption ||
            (loading ? 'Preparing the next question...' : '')}
        </p>
        <div className="mt-1 flex h-5 items-center gap-1.5">
          {meterBars.map((item) => (
            <span
              key={item}
              className={`h-1.5 w-6 rounded-full ${
                isPlaying || loading
                  ? 'animate-pulse bg-cyan-300'
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
          onClick={onToggleMic}
          disabled={loading || isPlaying || isTranscribing}
          className="relative flex h-40 w-40 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950/60 transition-all hover:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 disabled:cursor-not-allowed disabled:opacity-70"
          aria-label={
            isRecording
              ? 'Stop candidate microphone'
              : 'Start candidate microphone'
          }
        >
          {isRecording && (
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/20" />
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
        <p
          aria-live="polite"
          className={`mt-2 line-clamp-3 min-h-10 max-w-56 text-center text-xs leading-relaxed ${
            isRecording || isTranscribing ? 'text-emerald-200' : 'text-zinc-400'
          }`}
        >
          {userCaption ||
            (isRecording
              ? 'Listening...'
              : isTranscribing
                ? 'Transcribing...'
                : '')}
        </p>
        <div className="mt-1 flex h-5 items-center gap-1.5">
          {meterBars.map((item) => (
            <span
              key={item}
              className={`h-1.5 w-6 rounded-full ${
                isRecording ? 'animate-pulse bg-emerald-400' : 'bg-zinc-800'
              }`}
              style={{ animationDelay: `${item * 110}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
