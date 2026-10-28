import { NextRequest, NextResponse } from 'next/server';
import { APICallError, generateText, stepCountIs } from 'ai';
import { anthropicModel, replyProviderOptions } from '@/lib/llm';
import { normalizeContext, STARTER_MESSAGE } from '@/lib/context';
import { getBudgets, projectTokens, shouldCompact } from '@/lib/context-budget';
import { buildModelMessages, compactContext } from '@/lib/compaction';
import { buildCachedSystem } from '@/lib/prompts';
import { searchWebTool } from '@/lib/interview-tools';
import type { InterviewResponseBody } from '@/lib/types';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isRejectedBlockError(error: unknown) {
  return (
    error instanceof APICallError &&
    (error.statusCode === 400 || error.statusCode === 422)
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId =
      typeof body.userId === 'string' ? body.userId.slice(0, 200) : '';
    const profile =
      typeof body.profile === 'string' ? body.profile.slice(0, 24_000) : '';
    const targetRole =
      typeof body.targetRole === 'string'
        ? body.targetRole.replace(/\s+/g, ' ').trim().slice(0, 120)
        : '';
    const candidateName =
      typeof body.candidateName === 'string'
        ? body.candidateName.replace(/\s+/g, ' ').trim().slice(0, 80)
        : '';

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    let context = normalizeContext(body.context);
    if (context.messages.length === 0) {
      context = { ...context, messages: [STARTER_MESSAGE] };
    }

    const budgets = getBudgets();
    const projectedTokens = projectTokens(context, profile);
    let compacted = false;
    let compactionMethod: 'native' | 'manual' | null = null;

    if (shouldCompact(projectedTokens, context, budgets.retryGapMessages)) {
      const outcome = await compactContext({
        context,
        profile,
        targetRole,
        candidateName,
        projectedTokens,
      });
      context = outcome.context;
      compacted = outcome.compacted;
      compactionMethod = outcome.method;
    }

    const system = buildCachedSystem(profile, targetRole, candidateName);
    const generateReply = () =>
      generateText({
        model: anthropicModel,
        system,
        messages: buildModelMessages(context),
        tools: { search_web: searchWebTool },
        stopWhen: stepCountIs(4),
        maxOutputTokens: 300,
        providerOptions: replyProviderOptions,
      });

    let result;
    try {
      result = await generateReply();
    } catch (error) {
      if (!context.nativeBlock || !context.summary) throw error;
      if (!isRejectedBlockError(error)) throw error;
      console.error(
        'Native compaction block could not be replayed; using text summary.',
        error
      );
      context = { ...context, nativeBlock: null };
      result = await generateReply();
    }

    const content = result.text.trim();
    if (!content) throw new Error('Model returned an empty response');

    const usage = {
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
      cacheReadTokens: result.usage.inputTokenDetails.cacheReadTokens ?? 0,
      cacheWriteTokens: result.usage.inputTokenDetails.cacheWriteTokens ?? 0,
    };

    context = {
      ...context,
      baseline: {
        inputTokens: usage.inputTokens || projectTokens(context, profile),
        messageCount: context.messages.length,
      },
    };

    const payload: InterviewResponseBody = {
      role: 'assistant',
      content,
      context,
      compacted,
      compactionMethod,
      usage,
    };

    return NextResponse.json(payload);
  } catch (error: unknown) {
    console.error('Interview route error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed in interview execution') },
      { status: 500 }
    );
  }
}
