import type { ChatMessage } from './types';

const CHARS_PER_TOKEN = 2.4;
const MESSAGE_OVERHEAD_TOKENS = 6;

export function estimateTokens(text: string): number {
  const value = typeof text === 'string' ? text.trim() : '';
  if (!value) return 0;
  return Math.ceil(value.length / CHARS_PER_TOKEN);
}

export function estimateMessagesTokens(messages: ChatMessage[]): number {
  return messages.reduce(
    (total, message) =>
      total + estimateTokens(message.content) + MESSAGE_OVERHEAD_TOKENS,
    0
  );
}

export function estimateUnknownTokens(value: unknown): number {
  if (!value) return 0;
  try {
    return estimateTokens(JSON.stringify(value));
  } catch {
    return 0;
  }
}
