import { InterviewerContainer } from '@/components/interviewer-container';

export const metadata = {
  title: 'AI Voice Interviewer | Claude & Sarvam AI',
  description:
    'A sleek, latency-optimized voice technical interviewer powered by Claude Haiku 5.5 and Sarvam AI.',
};

export default function Page() {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100 font-sans selection:bg-zinc-800">
      <main className="flex flex-1 flex-col items-center justify-center py-10 px-6">
        <InterviewerContainer />
      </main>
    </div>
  );
}
