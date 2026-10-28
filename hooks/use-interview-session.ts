'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeContext } from '@/lib/context';
import { saveSession } from '@/lib/interview-session';
import type {
  ChatMessage,
  InterviewContext,
  InterviewResponseBody,
} from '@/lib/types';

interface Options {
  userId: string;
  profile: string;
  candidateName: string;
  targetRole: string;
  initialContext: InterviewContext;
}

export function useInterviewSession({
  userId,
  profile,
  candidateName,
  targetRole,
  initialContext,
}: Options) {
  const [context, setContextState] = useState<InterviewContext>(() =>
    normalizeContext(initialContext)
  );
  const contextRef = useRef(context);
  const [compacted, setCompacted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const setContext = useCallback(
    (next: InterviewContext) => {
      contextRef.current = next;
      if (!mountedRef.current) return;
      setContextState(next);
      saveSession({
        version: 1,
        userId,
        profile,
        candidateName,
        targetRole,
        context: next,
        updatedAt: Date.now(),
      });
    },
    [userId, profile, candidateName, targetRole]
  );

  const send = useCallback(
    async (messages: ChatMessage[]) => {
      setError('');
      try {
        const response = await fetch('/api/interview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            profile,
            candidateName,
            targetRole,
            context: { ...contextRef.current, messages },
          }),
        });
        const data =
          (await response.json()) as Partial<InterviewResponseBody> & {
            error?: string;
          };
        if (!response.ok) {
          throw new Error(data.error || 'Failed to get interview response');
        }

        const next = normalizeContext(data.context);
        setContext(next);
        setCompacted(Boolean(data.compacted));
        return {
          content: typeof data.content === 'string' ? data.content : '',
          compacted: Boolean(data.compacted),
        };
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : 'Failed to get interview response';
        setError(message);
        return null;
      }
    },
    [userId, profile, candidateName, targetRole, setContext]
  );

  const append = useCallback(
    (messages: ChatMessage[]) => {
      setContext({
        ...contextRef.current,
        messages: [...contextRef.current.messages, ...messages],
      });
    },
    [setContext]
  );

  const ask = useCallback(
    async (messages: ChatMessage[]) => {
      setLoading(true);
      try {
        return await send(messages);
      } finally {
        setLoading(false);
      }
    },
    [send]
  );

  return { context, contextRef, ask, append, compacted, loading, error };
}
