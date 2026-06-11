import { InterviewerContainer } from '@/components/interviewer-container';

export const metadata = {
  title: 'AI Voice Interviewer | Supermemory & Sarvam AI',
  description:
    'A sleek, latency-optimized voice technical interviewer powered by DeepSeek, Supermemory, and Sarvam AI.',
};

export default function Page() {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100 font-sans selection:bg-zinc-800">
      <main className="flex flex-col flex-1 items-center justify-center py-12 px-6">
        <div className="text-center mb-8 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-zinc-400 tracking-wide uppercase">
              Voice Agent Active
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
            AI Voice Interviewer
          </h1>
          <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
            Upload your credentials and start an automated voice interview.
            Powered by DeepSeek for reasoning, Supermemory for candidate
            context, and Sarvam AI for voice processing.
          </p>
        </div>

        <InterviewerContainer />
      </main>
    </div>
  );
}
