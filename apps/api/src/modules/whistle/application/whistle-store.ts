import type { WhistleUtcDayWindow } from '../domain/utc-day.js';

export type WhistleScopeKind = 'community' | 'team' | 'ultras';

export interface WhistleScope {
  kind: WhistleScopeKind;
  id: string;
}

export interface WhistleAuthorSnapshot {
  userId: string;
  displayName: string;
  photoUrl: string | null;
}

export interface WhistleMessage {
  id: string;
  body: string;
  author: WhistleAuthorSnapshot;
  createdAt: string;
}

export interface WhistleQuotaSnapshot {
  used: number;
  remaining: number;
}

export interface WhistleSendInput {
  window: WhistleUtcDayWindow;
  scope: WhistleScope;
  author: WhistleAuthorSnapshot;
  body: string;
}

export type WhistleSendResult =
  | {
      kind: 'accepted';
      item: WhistleMessage;
      quota: WhistleQuotaSnapshot;
    }
  | {
      kind: 'limit_reached';
      quota: WhistleQuotaSnapshot;
    }
  | { kind: 'stale_window' };

export type WhistleListResult = { kind: 'ok'; items: WhistleMessage[] } | { kind: 'stale_window' };

export type WhistleQuotaResult =
  { kind: 'ok'; quota: WhistleQuotaSnapshot } | { kind: 'stale_window' };

export interface WhistleStore {
  send(input: WhistleSendInput): Promise<WhistleSendResult>;
  list(scope: WhistleScope, window: WhistleUtcDayWindow): Promise<WhistleListResult>;
  quota(userId: string, window: WhistleUtcDayWindow): Promise<WhistleQuotaResult>;
}

export class WhistleStoreUnavailableError extends Error {
  constructor(message = 'Whistle storage is unavailable.', options?: ErrorOptions) {
    super(message, options);
    this.name = 'WhistleStoreUnavailableError';
  }
}

export class WhistleStoreCorruptError extends Error {
  constructor(message = 'Whistle storage is inconsistent.', options?: ErrorOptions) {
    super(message, options);
    this.name = 'WhistleStoreCorruptError';
  }
}
