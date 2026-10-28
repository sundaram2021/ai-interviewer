import { generateText, type ModelMessage, type SystemModelMessage } from 'ai';
import { anthropicModel, replyProviderOptions } from './llm';

export interface NativeCompactionResult {
  block: ModelMessage;
  text: string;
}

function messageText(message: ModelMessage): string {
  if (typeof message.content === 'string') return message.content;
  const parts = message.content as Array<{ type: string; text?: string }>;
  return parts
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n');
}

export async function runNativeCompaction(input: {
  system: SystemModelMessage;
  messages: ModelMessage[];
  summaryTokens: number;
  instructions: string;
}): Promise<NativeCompactionResult | null> {
  const result = await generateText({
    model: anthropicModel,
    system: input.system,
    messages: input.messages,
    maxOutputTokens: input.summaryTokens + 512,
    providerOptions: {
      ...replyProviderOptions,
      anthropic: {
        ...replyProviderOptions.anthropic,
        compaction: { type: 'summarize', instructions: input.instructions },
      },
    },
  });

  if (result.rawFinishReason !== 'compaction') return null;

  const block = result.finalStep.response.messages[0];
  if (!block) return null;

  return { block, text: messageText(block) || result.text.trim() };
}
