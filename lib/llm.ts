import {
  anthropic,
  type AnthropicLanguageModelOptions,
} from '@ai-sdk/anthropic';

export const MODEL_ID = (
  process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5'
).replace(/['"]/g, '');

export const anthropicModel = anthropic(MODEL_ID);

export const replyProviderOptions = {
  anthropic: {
    thinking: { type: 'disabled' },
    effort: 'low',
  } satisfies AnthropicLanguageModelOptions,
};

export const analysisProviderOptions = {
  anthropic: {
    thinking: { type: 'disabled' },
    effort: 'low',
  } satisfies AnthropicLanguageModelOptions,
};
