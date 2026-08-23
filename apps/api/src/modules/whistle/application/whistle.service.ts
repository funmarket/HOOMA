import { WHISTLE_DAILY_LIMIT } from '@hooma/contracts';
import { AppError } from '../../../http/errors/app-error.js';
import type {
  WhistleListResult,
  WhistleQuotaResult,
  WhistleSendResult,
  WhistleStore,
} from './whistle-store.js';
import {
  WhistleStoreCorruptError,
  WhistleStoreUnavailableError,
} from './whistle-store.js';
import { getWhistleUtcDayWindow, type WhistleUtcDayWindow } from '../domain/utc-day.js';

interface CommunityMembershipGate {
  requireMembership(userId: string, communityId: string): Promise<unknown>;
}

interface IdentityPresentationReader {
  getMe(userId: string): Promise<{ displayName: string; photoUrl: string | null } | null>;
}

function unavailable(cause?: unknown) {
  return new AppError(503, 'WHISTLE_UNAVAILABLE', 'Whistle is temporarily unavailable.', {
    retryable: true,
    ...(cause instanceof Error ? { cause: cause.name } : {}),
  });
}

function feedResponse(
  window: WhistleUtcDayWindow,
  feed: Extract<WhistleListResult, { kind: 'ok' }>,
  quota: Extract<WhistleQuotaResult, { kind: 'ok' }>,
) {
  return {
    day: window.day,
    dailyLimit: WHISTLE_DAILY_LIMIT,
    remaining: quota.quota.remaining,
    resetAt: window.resetsAt.toISOString(),
    items: feed.items,
  } as const;
}

function sendResponse(
  window: WhistleUtcDayWindow,
  result: Extract<WhistleSendResult, { kind: 'accepted' }>,
) {
  return {
    day: window.day,
    dailyLimit: WHISTLE_DAILY_LIMIT,
    remaining: result.quota.remaining,
    resetAt: window.resetsAt.toISOString(),
    item: result.item,
  } as const;
}

export class WhistleService {
  constructor(
    private readonly store: WhistleStore,
    private readonly communities: CommunityMembershipGate,
    private readonly identity: IdentityPresentationReader,
  ) {}

  async listCommunity(userId: string, communityId: string) {
    await this.communities.requireMembership(userId, communityId);

    try {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const window = getWhistleUtcDayWindow();
        const [feed, quota] = await Promise.all([
          this.store.list({ kind: 'community', id: communityId }, window),
          this.store.quota(userId, window),
        ]);
        if (feed.kind === 'stale_window' || quota.kind === 'stale_window') continue;
        return feedResponse(window, feed, quota);
      }
    } catch (error) {
      if (
        error instanceof WhistleStoreUnavailableError ||
        error instanceof WhistleStoreCorruptError
      ) {
        throw unavailable(error);
      }
      throw error;
    }

    throw unavailable();
  }

  async postCommunity(userId: string, communityId: string, body: string) {
    await this.communities.requireMembership(userId, communityId);
    const presentation = await this.identity.getMe(userId);
    if (!presentation) throw unavailable();

    try {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const window = getWhistleUtcDayWindow();
        const result = await this.store.send({
          window,
          scope: { kind: 'community', id: communityId },
          author: {
            userId,
            displayName: presentation.displayName,
            photoUrl: presentation.photoUrl,
          },
          body,
        });
        if (result.kind === 'stale_window') continue;
        if (result.kind === 'limit_reached') {
          throw new AppError(429, 'WHISTLE_DAILY_LIMIT_REACHED', 'Daily Whistle limit reached.', {
            dailyLimit: WHISTLE_DAILY_LIMIT,
            remaining: result.quota.remaining,
            resetAt: window.resetsAt.toISOString(),
          });
        }
        return sendResponse(window, result);
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (
        error instanceof WhistleStoreUnavailableError ||
        error instanceof WhistleStoreCorruptError
      ) {
        throw unavailable(error);
      }
      throw error;
    }

    throw unavailable();
  }
}
