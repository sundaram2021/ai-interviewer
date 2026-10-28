import type { ChatMessage, InterviewContext } from './types';
import {
  estimateMessagesTokens,
  estimateTokens,
  estimateUnknownTokens,
} from './tokens';

export type CompactMode = 'auto' | 'native' | 'manual';

export interface ContextBudgets {
  windowTokens: number;
  triggerTokens: number;
  hardCeilingTokens: number;
  targetTokens: number;
  minRecentMessages: number;
  minRecentTokens: number;
  summaryMinTokens: number;
  summaryMaxTokens: number;
  retryGapMessages: number;
}

function envNumber(name: string, fallback: number, min: number, max: number) {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

export function getBudgets(): ContextBudgets {
  const windowTokens = Math.floor(
    envNumber('CONTEXT_WINDOW_TOKENS', 1_000_000, 10_000, 10_000_000)
  );
  const triggerRatio = envNumber('COMPACT_TRIGGER_RATIO', 0.85, 0.05, 0.98);
  const targetRatio = envNumber('COMPACT_TARGET_RATIO', 0.45, 0.05, 0.9);
  const triggerTokens = Math.floor(windowTokens * triggerRatio);
  const targetTokens = Math.min(
    Math.floor(windowTokens * targetRatio),
    triggerTokens - 1
  );

  return {
    windowTokens,
    triggerTokens,
    hardCeilingTokens: Math.floor(windowTokens * 0.95),
    targetTokens,
    minRecentMessages: Math.floor(
      envNumber('COMPACT_MIN_RECENT_MESSAGES', 4, 2, 40)
    ),
    minRecentTokens: 4_000,
    summaryMinTokens: 600,
    summaryMaxTokens: 8_000,
    retryGapMessages: Math.floor(envNumber('COMPACT_RETRY_GAP', 4, 2, 100)),
  };
}

export function getCompactMode(): CompactMode {
  const value = (process.env.COMPACT_MODE || 'auto').toLowerCase();
  if (value === 'native' || value === 'manual') return value;
  return 'auto';
}

export function projectTokens(context: InterviewContext, profile: string) {
  if (context.baseline) {
    const delta = context.messages.slice(context.baseline.messageCount);
    return context.baseline.inputTokens + estimateMessagesTokens(delta);
  }

  return (
    estimateMessagesTokens(context.messages) +
    estimateTokens(profile) +
    estimateUnknownTokens(context.nativeBlock) +
    500
  );
}

export function shouldCompact(
  projectedTokens: number,
  context: InterviewContext,
  gap: number
) {
  const budgets = getBudgets();
  const isOverHardCeiling = projectedTokens >= budgets.hardCeilingTokens;
  const isOverTrigger = projectedTokens >= budgets.triggerTokens;
  if (!isOverTrigger && !isOverHardCeiling) return false;
  if (isOverHardCeiling) return true;

  const lastAttempt = context.lastCompactAttemptCount;
  if (lastAttempt === null || lastAttempt === undefined) return true;
  return context.messages.length - lastAttempt >= gap;
}

export interface CompactionPlan {
  older: ChatMessage[];
  recent: ChatMessage[];
  summaryTokens: number;
  targetTokens: number;
  tokensToFree: number;
}

export function planCompaction(
  messages: ChatMessage[],
  projectedTokens: number
): CompactionPlan {
  const budgets = getBudgets();
  const targetTokens = budgets.targetTokens;
  const tokensToFree = Math.max(projectedTokens - targetTokens, 0);
  const summaryTokens = Math.min(
    Math.max(Math.round(tokensToFree * 0.01), budgets.summaryMinTokens),
    budgets.summaryMaxTokens
  );
  const recentBudget = Math.max(targetTokens - summaryTokens, 1_000);

  let start = messages.length;
  let keptTokens = 0;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const cost = estimateTokens(messages[index].content) + 6;
    const withinMinimum = messages.length - index <= budgets.minRecentMessages;
    if (!withinMinimum && keptTokens + cost > recentBudget) break;
    keptTokens += cost;
    start = index;
  }

  while (start < messages.length && messages[start].role !== 'user') {
    start += 1;
  }
  if (start >= messages.length) {
    const lastUser = messages
      .map((message) => message.role)
      .lastIndexOf('user');
    start = lastUser >= 0 ? lastUser : Math.max(messages.length - 1, 0);
  }

  return {
    older: messages.slice(0, start),
    recent: messages.slice(start),
    summaryTokens,
    targetTokens,
    tokensToFree,
  };
}
