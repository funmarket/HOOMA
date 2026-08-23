import { retrieveRawInitData } from '@tma.js/sdk-react';
import { getWebSession } from '../../features/auth/session';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const DEFAULT_TIMEOUT_MS = 12_000;

function authHeaders() {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (import.meta.env.VITE_DEV_AUTH_BYPASS === 'true') {
    headers['x-dev-telegram-user-id'] = import.meta.env.VITE_DEV_TELEGRAM_USER_ID || '100000001';
    return headers;
  }
  try {
    const raw = retrieveRawInitData();
    if (raw) {
      headers.authorization = `tma ${raw}`;
      return headers;
    }
  } catch {
    // Normal web entry has no Telegram launch data and falls through to web session auth.
  }

  const session = getWebSession();
  if (session) headers.authorization = `Bearer ${session.token}`;
  return headers;
}

function errorMessage(body: unknown, status: number): string {
  if (typeof body === 'object' && body && 'error' in body) {
    const error = (body as { error: unknown }).error;
    if (typeof error === 'string') return error;
    if (typeof error === 'object' && error && 'message' in error) {
      return String((error as { message: unknown }).message);
    }
  }
  return `Request failed (${status})`;
}

export interface HttpOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
}

export async function http<T>(path: string, options: HttpOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, retries = 0, ...requestOptions } = options;
  const method = String(requestOptions.method || 'GET').toUpperCase();
  const safeToRetry = method === 'GET' || method === 'HEAD';
  const attempts = safeToRetry ? Math.min(retries + 1, 3) : 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        ...requestOptions,
        signal: requestOptions.signal || controller.signal,
        headers: {
          ...authHeaders(),
          'x-request-id': crypto.randomUUID(),
          ...(requestOptions.headers || {}),
        },
      });
      if (response.ok && response.status === 204) return undefined as T;

      const contentType = response.headers.get('content-type') || '';
      const expectsJson = path.startsWith('/api/');
      if (response.ok && expectsJson && !contentType.includes('application/json')) {
        throw new Error('API returned a non-JSON response');
      }
      const body = contentType.includes('application/json')
        ? await response.json()
        : await response.text();
      if (!response.ok) throw new Error(errorMessage(body, response.status));
      return body as T;
    } catch (error) {
      lastError = error;
      if (attempt + 1 >= attempts) throw error;
      await new Promise((resolve) => window.setTimeout(resolve, 250 * (attempt + 1)));
    } finally {
      window.clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Request failed');
}

export const get = <T>(path: string) => http<T>(path, { retries: 1 });
export const post = <T>(path: string, body?: unknown) =>
  http<T>(path, {
    method: 'POST',
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
export const postIdempotent = <T>(path: string, body: unknown, idempotencyKey: string) =>
  http<T>(path, {
    method: 'POST',
    headers: { 'idempotency-key': idempotencyKey },
    body: JSON.stringify(body),
  });
export const patch = <T>(path: string, body: unknown) =>
  http<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
export const put = <T>(path: string, body: unknown) =>
  http<T>(path, { method: 'PUT', body: JSON.stringify(body) });
export const del = <T>(path: string) => http<T>(path, { method: 'DELETE' });
