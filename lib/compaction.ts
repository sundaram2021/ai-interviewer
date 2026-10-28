import type { ModelMessage } from 'ai';
import { getCompactMode, planCompaction } from './context-budget';
import { runManualCompaction } from './compaction-manual';
import { runNativeCompaction } from './compaction-native';
import {
  buildCachedSystem,
  buildCompactionInstructions,
  buildSummaryPair,
} from './prompts';
import type { InterviewContext } from './types';

function markCacheBreakpoint(message: ModelMessage): ModelMessage {
  return {
    ...message,
    providerOptions: {
      ...message.providerOptions,
      anthropic: {
        ...message.providerOptions?.anthropic,
        cacheControl: { type: 'ephemeral' },
      },
    },
  } as ModelMessage;
}

export function buildModelMessages(context: InterviewContext): ModelMessage[] {
  const prior: ModelMessage[] = context.nativeBlock
    ? [context.nativeBlock as ModelMessage]
    : context.summary
      ? (buildSummaryPair(context.summary) as ModelMessage[])
      : [];
  const messages = [...prior, ...context.messages];

  const lastUser = messages.map((message) => message.role).lastIndexOf('user');
  const breakpoint = lastUser - 1;
  if (breakpoint >= 0 && messages[breakpoint].role === 'assistant') {
    messages[breakpoint] = markCacheBreakpoint(messages[breakpoint]);
  }

  return messages;
}

function withAttempt(
  context: InterviewContext,
  attemptCount: number
): InterviewContext {
  return { ...context, lastCompactAttemptCount: attemptCount };
}

export interface CompactionOutcome {
  context: InterviewContext;
  compacted: boolean;
  method: 'native' | 'manual' | null;
}

export async function compactContext(input: {
  context: InterviewContext;
  profile: string;
  targetRole: string;
  candidateName?: string;
  projectedTokens: number;
}): Promise<CompactionOutcome> {
  const plan = planCompaction(input.context.messages, input.projectedTokens);
  if (plan.older.length === 0) {
    return { context: input.context, compacted: false, method: null };
  }

  const system = buildCachedSystem(
    input.profile,
    input.targetRole,
    input.candidateName
  );
  const prior: ModelMessage[] = input.context.nativeBlock
    ? [input.context.nativeBlock as ModelMessage]
    : input.context.summary
      ? (buildSummaryPair(input.context.summary) as ModelMessage[])
      : [];
  const mode = getCompactMode();

  if (mode !== 'manual') {
    try {
      const native = await runNativeCompaction({
        system,
        messages: [...prior, ...plan.older],
        summaryTokens: plan.summaryTokens,
        instructions: buildCompactionInstructions(
          plan.summaryTokens,
          input.targetRole
        ),
      });

      if (native) {
        return {
          context: withAttempt(
            {
              ...input.context,
              summary: native.text,
              nativeBlock: native.block,
              messages: plan.recent,
              baseline: null,
            },
            plan.recent.length
          ),
          compacted: true,
          method: 'native',
        };
      }
    } catch (error) {
      console.error('Native compaction failed, using manual summary:', error);
    }
  }

  try {
    const summary = await runManualCompaction({
      older: plan.older,
      priorSummary: input.context.summary,
      summaryTokens: plan.summaryTokens,
      targetRole: input.targetRole,
    });

    if (summary) {
      return {
        context: withAttempt(
          {
            ...input.context,
            summary,
            nativeBlock: null,
            messages: plan.recent,
            baseline: null,
          },
          plan.recent.length
        ),
        compacted: true,
        method: 'manual',
      };
    }
  } catch (error) {
    console.error('Manual compaction failed:', error);
  }

  return {
    context: withAttempt(input.context, input.context.messages.length),
    compacted: false,
    method: null,
  };
}
