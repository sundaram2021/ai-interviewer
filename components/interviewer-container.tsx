'use client';

import { useState } from 'react';
import { ProfileModal } from './profile-modal';
import { InterviewScreen } from './interview-screen';

export function InterviewerContainer() {
  const [userId, setUserId] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-center justify-center flex-1 w-full max-w-4xl px-4 py-8">
      {!userId ? (
        <ProfileModal onComplete={(id) => setUserId(id)} />
      ) : (
        <InterviewScreen userId={userId} onReset={() => setUserId(null)} />
      )}
    </div>
  );
}
