'use client';

import { PhoneOff } from 'lucide-react';

interface EndInterviewProps {
  onEnd: () => void;
}

export function EndInterview({ onEnd }: EndInterviewProps) {
  return (
    <div className="flex w-full justify-center border-t border-zinc-900 pt-7">
      <button
        onClick={onEnd}
        className="flex items-center gap-2.5 rounded-full border border-red-900/50 bg-red-950/45 px-8 py-3.5 text-sm font-medium text-red-300 shadow-lg shadow-red-950/20 transition-all hover:bg-red-900/40"
      >
        <PhoneOff className="h-4 w-4" />
        End interview
      </button>
    </div>
  );
}
