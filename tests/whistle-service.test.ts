import assert from 'node:assert/strict';
import test from 'node:test';
import { WHISTLE_DAILY_LIMIT } from '@hooma/contracts';
import { AppError } from '../apps/api/src/http/errors/app-error.js';
import type {
  WhistleSendInput,
  WhistleStore,
} from '../apps/api/src/modules/whistle/application/whistle-store.js';
import { WhistleStoreUnavailableError } from '../apps/api/src/modules/whistle/application/whistle-store.js';
import { WhistleService } from '../apps/api/src/modules/whistle/application/whistle.service.js';

function baseStore(overrides: Partial<WhistleStore> = {}): WhistleStore {
  return {
    async send() {
      throw new Error('Unexpected send');
    },
    async list() {
      return { kind: 'ok', items: [] };
    },
    async quota() {
      return { kind: 'ok', quota: { used: 0, remaining: WHISTLE_DAILY_LIMIT } };
    },
    ...overrides,
  };
}

const identity = {
  async getMe() {
    return { displayName: 'HOOMA Tester', photoUrl: 'https://example.com/avatar.png' };
  },
};

const membership = {
  async requireMembership() {
    return { status: 'ACTIVE' };
  },
};

test('Whistle service requires active community membership before reading Redis', async () => {
  let readCalled = false;
  const service = new WhistleService(
    baseStore({
      async list() {
        readCalled = true;
        return { kind: 'ok', items: [] };
      },
    }),
    {
      async requireMembership() {
        throw new AppError(403, 'COMMUNITY_ACCESS_DENIED', 'Not an active member');
      },
    },
    identity,
  );

  await assert.rejects(
    () => service.listCommunity('user-1', 'community-1'),
    (error: unknown) => error instanceof AppError && error.code === 'COMMUNITY_ACCESS_DENIED',
  );
  assert.equal(readCalled, false);
});

test('Whistle list retries one stale UTC window and returns quota metadata', async () => {
  let listCalls = 0;
  let quotaCalls = 0;
  const service = new WhistleService(
    baseStore({
      async list() {
        listCalls += 1;
        if (listCalls === 1) return { kind: 'stale_window' };
        return {
          kind: 'ok',
          items: [
            {
              id: '1-0',
              body: 'North stand now',
              author: { userId: 'author-1', displayName: 'North End', photoUrl: null },
              createdAt: new Date().toISOString(),
            },
          ],
        };
      },
      async quota() {
        quotaCalls += 1;
        if (quotaCalls === 1) return { kind: 'stale_window' };
        return { kind: 'ok', quota: { used: 3, remaining: 8 } };
      },
    }),
    membership,
    identity,
  );

  const response = await service.listCommunity('user-1', 'community-1');
  assert.equal(listCalls, 2);
  assert.equal(quotaCalls, 2);
  assert.equal(response.dailyLimit, 11);
  assert.equal(response.remaining, 8);
  assert.equal(response.items.length, 1);
  assert.match(response.day, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Date.parse(response.resetAt) > Date.now());
});

test('Whistle send uses canonical identity presentation and community scope', async () => {
  let captured: WhistleSendInput | null = null;
  const service = new WhistleService(
    baseStore({
      async send(input) {
        captured = input;
        return {
          kind: 'accepted',
          item: {
            id: '2-0',
            body: input.body,
            author: input.author,
            createdAt: new Date().toISOString(),
          },
          quota: { used: 1, remaining: 10 },
        };
      },
    }),
    membership,
    identity,
  );

  const response = await service.postCommunity('user-2', 'community-9', 'Press high');
  assert.equal(response.remaining, 10);
  assert.equal(captured?.scope.kind, 'community');
  assert.equal(captured?.scope.id, 'community-9');
  assert.equal(captured?.author.displayName, 'HOOMA Tester');
  assert.equal(captured?.author.photoUrl, 'https://example.com/avatar.png');
});

test('Whistle daily limit becomes stable 429 with reset metadata', async () => {
  const service = new WhistleService(
    baseStore({
      async send() {
        return {
          kind: 'limit_reached',
          quota: { used: WHISTLE_DAILY_LIMIT, remaining: 0 },
        };
      },
    }),
    membership,
    identity,
  );

  await assert.rejects(
    () => service.postCommunity('user-3', 'community-1', 'One more'),
    (error: unknown) => {
      if (!(error instanceof AppError)) return false;
      assert.equal(error.status, 429);
      assert.equal(error.code, 'WHISTLE_DAILY_LIMIT_REACHED');
      assert.equal((error.details as { remaining: number }).remaining, 0);
      assert.ok(Date.parse((error.details as { resetAt: string }).resetAt) > Date.now());
      return true;
    },
  );
});

test('Whistle Redis outage is mapped to retryable 503 without quota bypass', async () => {
  const service = new WhistleService(
    baseStore({
      async send() {
        throw new WhistleStoreUnavailableError();
      },
    }),
    membership,
    identity,
  );

  await assert.rejects(
    () => service.postCommunity('user-4', 'community-1', 'Unavailable'),
    (error: unknown) =>
      error instanceof AppError && error.status === 503 && error.code === 'WHISTLE_UNAVAILABLE',
  );
});
