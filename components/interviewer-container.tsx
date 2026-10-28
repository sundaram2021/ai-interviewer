'use client';

import { useEffect, useState } from 'react';
import { ProfileModal } from './profile-modal';
import { InterviewScreen } from './interview-screen';
import {
  clearSession,
  emptyContext,
  loadLastSession,
  saveSession,
} from '@/lib/interview-session';
import type { SavedSession } from '@/lib/types';

function hasIdentity(session: SavedSession) {
  const name = session.candidateName?.trim() || '';
  return (
    Boolean(name) &&
    name.toLowerCase() !== 'candidate' &&
    Boolean(session.targetRole?.trim())
  );
}

export function InterviewerContainer() {
  const [session, setSession] = useState<SavedSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const restored = loadLastSession();
      if (restored && !hasIdentity(restored)) {
        clearSession(restored.userId);
        setSession(null);
      } else {
        setSession(restored);
      }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleComplete = (profile: {
    userId: string;
    profile: string;
    candidateName: string;
    targetRole: string;
  }) => {
    const next: SavedSession = {
      version: 1,
      userId: profile.userId,
      profile: profile.profile,
      candidateName: profile.candidateName,
      targetRole: profile.targetRole,
      context: emptyContext(),
      updatedAt: Date.now(),
    };
    saveSession(next);
    setSession(next);
  };

  const handleReset = () => {
    if (session) clearSession(session.userId);
    setSession(null);
  };

  return (
    <div className="flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-4 py-8">
      {!ready ? null : !session ? (
        <ProfileModal onComplete={handleComplete} />
      ) : (
        <>
          <header className="mb-2 flex flex-col items-center text-center">
            <h1 className="text-xl font-semibold text-zinc-100">
              {session.candidateName || 'Interview'}
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Interviewing for {session.targetRole || 'Software Engineer'}
            </p>
          </header>
          <InterviewScreen
            userId={session.userId}
            profile={session.profile}
            candidateName={session.candidateName || 'Interview'}
            targetRole={session.targetRole || 'Software Engineer'}
            initialContext={session.context}
            onReset={handleReset}
          />
        </>
      )}
    </div>
  );
}
