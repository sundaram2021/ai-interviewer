import { emptyContext, normalizeContext } from './context';
import type { SavedSession } from './types';

const SESSION_PREFIX = 'ai-interviewer:v1:';
const LAST_SESSION_KEY = `${SESSION_PREFIX}last`;
const MAX_SESSION_BYTES = 3_000_000;

export { emptyContext };

function canStore() {
  return typeof window !== 'undefined' && Boolean(window.sessionStorage);
}

function readJson(key: string): unknown {
  if (!canStore()) return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (!canStore()) return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Failed to persist interview session:', error);
  }
}

export function loadSession(userId: string): SavedSession | null {
  const value = readJson(`${SESSION_PREFIX}${userId}`);
  if (!value || typeof value !== 'object') return null;
  const saved = value as Partial<SavedSession>;
  if (saved.version !== 1 || saved.userId !== userId) return null;
  if (typeof saved.profile !== 'string') return null;

  return {
    version: 1,
    userId,
    profile: saved.profile,
    candidateName:
      typeof saved.candidateName === 'string'
        ? saved.candidateName.slice(0, 80)
        : '',
    targetRole:
      typeof saved.targetRole === 'string'
        ? saved.targetRole.slice(0, 120)
        : '',
    context: normalizeContext(saved.context),
    updatedAt:
      typeof saved.updatedAt === 'number' ? saved.updatedAt : Date.now(),
  };
}

export function loadLastSession(): SavedSession | null {
  const userId = readJson(LAST_SESSION_KEY);
  if (typeof userId !== 'string' || !userId) return null;
  return loadSession(userId);
}

export function saveSession(session: SavedSession) {
  if (!canStore()) return;
  const payload: SavedSession = {
    ...session,
    candidateName: session.candidateName?.slice(0, 80) || '',
    targetRole: session.targetRole?.slice(0, 120) || '',
    context: normalizeContext(session.context),
    updatedAt: Date.now(),
  };

  const serialized = JSON.stringify(payload);
  if (serialized.length > MAX_SESSION_BYTES) {
    console.warn('Interview session is too large to persist.');
    return;
  }

  writeJson(`${SESSION_PREFIX}${session.userId}`, payload);
  writeJson(LAST_SESSION_KEY, session.userId);
}

export function clearSession(userId: string) {
  if (!canStore()) return;
  try {
    window.sessionStorage.removeItem(`${SESSION_PREFIX}${userId}`);
    const last = window.sessionStorage.getItem(LAST_SESSION_KEY);
    if (!last || last === JSON.stringify(userId) || last === userId) {
      window.sessionStorage.removeItem(LAST_SESSION_KEY);
    }
  } catch (error) {
    console.error('Failed to clear interview session:', error);
  }
}
