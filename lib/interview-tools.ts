import { jsonSchema, tool } from 'ai';
import { searchWeb } from './exa-client';

const MAX_QUERY_CHARS = 300;

function formatResults(results: Awaited<ReturnType<typeof searchWeb>>): string {
  if (results.length === 0) return 'No search results found.';
  return results
    .map((result, index) => {
      const text = result.text.replace(/\s+/g, ' ').trim().slice(0, 1_200);
      return `${index + 1}. ${result.title}\n${result.url}\n${text}`;
    })
    .join('\n\n');
}

export const searchWebTool = tool({
  description:
    'Search the public web for current, specific facts that would improve an interview question. Use sparingly and never for general knowledge.',
  inputSchema: jsonSchema<{ query: string }>({
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'A focused search query, at most a few words.',
      },
    },
    required: ['query'],
    additionalProperties: false,
  }),
  async execute({ query }) {
    const clean = query.replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_CHARS);
    if (!clean) return 'No search query provided.';
    try {
      const results = await searchWeb(clean);
      return formatResults(results);
    } catch (error) {
      console.error('Interview web search failed:', error);
      return 'Search is unavailable right now. Ask the question without it.';
    }
  },
});
