const SESSION_KEY = 'hooma.webSession';

export interface WebSession {
  token: string;
  expiresAt: string;
}

function isValidSession(value: unknown): value is WebSession {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<WebSession>;
  return (
    typeof candidate.token === 'string' &&
    candidate.token.length > 0 &&
    typeof candidate.expiresAt === 'string' &&
    Number.isFinite(Date.parse(candidate.expiresAt))
  );
}

export function getWebSession(): WebSession | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidSession(parsed) || Date.parse(parsed.expiresAt) <= Date.now()) {
      clearWebSession();
      return null;
    }
    return parsed;
  } catch {
    clearWebSession();
    return null;
  }
}

export function setWebSession(session: WebSession) {
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearWebSession() {
  window.sessionStorage.removeItem(SESSION_KEY);
}
