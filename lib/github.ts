export interface GithubUser {
  login: string;
  name: string | null;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  publicRepos: number;
  followers: number;
  joined: string | null;
}

const GITHUB_USERNAME = /^[a-z\d](?:[a-z\d-]{0,38})$/i;

export function parseGithubUsername(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return '';
  const bare = trimmed.replace(/^@/, '');
  if (GITHUB_USERNAME.test(bare)) return bare;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (host !== 'github.com') return '';
    const [username] = parsed.pathname.split('/').filter(Boolean);
    return username && GITHUB_USERNAME.test(username) ? username : '';
  } catch {
    return '';
  }
}

function asText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export type GithubLookupStatus = 'found' | 'not_found' | 'unavailable';

export interface GithubLookup {
  status: GithubLookupStatus;
  user: GithubUser | null;
}

export async function lookupGithubUser(
  username: string
): Promise<GithubLookup> {
  if (!username) return { status: 'not_found', user: null };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);

  try {
    const res = await fetch(
      `https://api.github.com/users/${encodeURIComponent(username)}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'ai-interviewer',
        },
        signal: controller.signal,
        cache: 'no-store',
      }
    );
    if (res.status === 404) return { status: 'not_found', user: null };
    if (!res.ok) return { status: 'unavailable', user: null };

    const data = (await res.json()) as Record<string, unknown>;
    return {
      status: 'found',
      user: {
        login: asText(data.login) || username,
        name: asText(data.name),
        bio: asText(data.bio),
        company: asText(data.company),
        location: asText(data.location),
        blog: asText(data.blog),
        publicRepos:
          typeof data.public_repos === 'number' ? data.public_repos : 0,
        followers: typeof data.followers === 'number' ? data.followers : 0,
        joined: asText(data.created_at),
      },
    };
  } catch (error) {
    console.error('GitHub user lookup failed:', error);
    return { status: 'unavailable', user: null };
  } finally {
    clearTimeout(timeout);
  }
}

export function getGithubDisplayName(
  user: GithubUser | null,
  username: string,
  modelName: string
) {
  const displayName = user?.name?.trim();
  const plausibleModelName = modelName.trim();
  const hasModelName =
    Boolean(plausibleModelName) &&
    plausibleModelName.toLowerCase() !== 'candidate';

  if (displayName) {
    const styledName = displayName.replace(/\b[a-z]/g, (c) => c.toUpperCase());
    if (
      hasModelName &&
      plausibleModelName.length > styledName.length &&
      plausibleModelName.toLowerCase().includes(styledName.toLowerCase())
    ) {
      return plausibleModelName;
    }
    return styledName;
  }

  if (hasModelName) {
    return plausibleModelName;
  }

  const login = user?.login?.trim() || username;
  return login ? login.replace(/\b[a-z]/g, (c) => c.toUpperCase()) : '';
}
