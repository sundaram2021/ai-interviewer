export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface TokenBaseline {
  inputTokens: number;
  messageCount: number;
}

export interface InterviewContext {
  summary: string | null;
  nativeBlock: unknown | null;
  messages: ChatMessage[];
  baseline: TokenBaseline | null;
  lastCompactAttemptCount?: number | null;
}

export interface CandidateAnalysis {
  profile: string;
  mostUsedLanguage: string;
  activeness: string;
  candidateName: string;
  targetRole: string;
}

export interface InterviewUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface InterviewResponseBody {
  role: 'assistant';
  content: string;
  context: InterviewContext;
  compacted: boolean;
  compactionMethod: 'native' | 'manual' | null;
  usage: InterviewUsage;
}

export interface SavedSession {
  version: 1;
  userId: string;
  profile: string;
  candidateName?: string;
  targetRole?: string;
  context: InterviewContext;
  updatedAt: number;
}
