import type { ChatMessage, InterviewContext, TokenBaseline } from './types';

const MAX_MESSAGES = 500;
const MAX_CONTENT_CHARS = 8_000;
const MAX_SUMMARY_CHARS = 20_000;

export const STARTER_MESSAGE: ChatMessage = {
  role: 'user',
  content: 'Hi, I am ready to start my interview.',
};

export function emptyContext(): InterviewContext {
  return {
    summary: null,
    nativeBlock: null,
    messages: [],
    baseline: null,
    lastCompactAttemptCount: null,
  };
}

export function normalizeMessage(value: unknown): ChatMessage | null {
  if (!value || typeof value !== 'object') return null;
  const message = value as { role?: unknown; content?: unknown };
  if (message.role !== 'user' && message.role !== 'assistant') return null;
  if (typeof message.content !== 'string') return null;

  const content = message.content.trim().slice(0, MAX_CONTENT_CHARS);
  if (!content) return null;
  return { role: message.role, content };
}

function normalizeBaseline(value: unknown): TokenBaseline | null {
  if (!value || typeof value !== 'object') return null;
  const baseline = value as { inputTokens?: unknown; messageCount?: unknown };
  if (
    typeof baseline.inputTokens !== 'number' ||
    !Number.isFinite(baseline.inputTokens) ||
    typeof baseline.messageCount !== 'number' ||
    !Number.isFinite(baseline.messageCount)
  ) {
    return null;
  }

  return {
    inputTokens: Math.max(0, Math.floor(baseline.inputTokens)),
    messageCount: Math.max(0, Math.floor(baseline.messageCount)),
  };
}

export function normalizeContext(value: unknown): InterviewContext {
  if (!value || typeof value !== 'object') return emptyContext();
  const context = value as Record<string, unknown>;

  const rawMessages = Array.isArray(context.messages) ? context.messages : [];
  const messages = rawMessages
    .map(normalizeMessage)
    .filter((message): message is ChatMessage => message !== null)
    .slice(-MAX_MESSAGES);

  return {
    summary:
      typeof context.summary === 'string'
        ? context.summary.slice(0, MAX_SUMMARY_CHARS)
        : null,
    nativeBlock:
      context.nativeBlock && typeof context.nativeBlock === 'object'
        ? context.nativeBlock
        : null,
    messages,
    baseline: normalizeBaseline(context.baseline),
    lastCompactAttemptCount:
      typeof context.lastCompactAttemptCount === 'number'
        ? Math.max(0, Math.floor(context.lastCompactAttemptCount))
        : null,
  };
}
