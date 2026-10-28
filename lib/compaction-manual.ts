import { generateText } from 'ai';
import { anthropicModel, replyProviderOptions } from './llm';
import { buildManualCompactionPrompt } from './prompts';
import type { ChatMessage } from './types';

export async function runManualCompaction(input: {
  older: ChatMessage[];
  priorSummary: string | null;
  summaryTokens: number;
  targetRole: string;
}): Promise<string | null> {
  const prompt = buildManualCompactionPrompt(
    input.priorSummary,
    input.older,
    input.summaryTokens,
    input.targetRole
  );

  const result = await generateText({
    model: anthropicModel,
    prompt,
    maxOutputTokens: input.summaryTokens + 512,
    providerOptions: replyProviderOptions,
  });

  const summary = result.text.trim();
  return summary || null;
}
