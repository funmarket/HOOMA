import assert from 'node:assert/strict';
import test from 'node:test';
import { WHISTLE_DAILY_LIMIT } from '@hooma/contracts';
import { RedisRuntime } from '../apps/api/src/infrastructure/redis/client.js';
import {
  WhistleStoreCorruptError,
  WhistleStoreUnavailableError,
} from '../apps/api/src/modules/whistle/application/whistle-store.js';
import { getWhistleUtcDayWindow } from '../apps/api/src/modules/whistle/domain/utc-day.js';
import { RedisWhistleStore } from '../apps/api/src/modules/whistle/infrastructure/redis-whistle.store.js';

const scopeA = { kind: 'community' as const, id: 'community-a' };
const scopeB = { kind: 'community' as const, id: 'community-b' };

function author(userId: string) {
  return {
    userId,
    displayName: `User ${userId}`,
    photoUrl: null,
  };
}

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

test('Redis Whistle store fails closed without Redis configuration', async () => {
  const store = new RedisWhistleStore(new RedisRuntime(undefined));
  await assert.rejects(
    () =>
      store.send({
        window: getWhistleUtcDayWindow(),
        scope: scopeA,
        author: author('missing-redis'),
        body: 'hello',
      }),
    (error: unknown) => error instanceof WhistleStoreUnavailableError,
  );
});

test(
  'Redis Whistle store enforces one global 11/day quota atomically across communities',
  { skip: !process.env.REDIS_URL },
  async () => {
    const runtime = new RedisRuntime(process.env.REDIS_URL);
    const store = new RedisWhistleStore(runtime);
    const userId = uniqueId('quota-user');
    const window = getWhistleUtcDayWindow();

    try {
      const results = await Promise.all(
        Array.from({ length: 20 }, (_, index) =>
          store.send({
            window,
            scope: index % 2 === 0 ? scopeA : scopeB,
            author: author(userId),
            body: `whistle ${index}`,
          }),
        ),
      );
      assert.equal(results.filter((result) => result.kind === 'accepted').length, 11);
      assert.equal(results.filter((result) => result.kind === 'limit_reached').length, 9);

      const quota = await store.quota(userId, window);
      assert.equal(quota.kind, 'ok');
      if (quota.kind === 'ok') {
        assert.deepEqual(quota.quota, { used: WHISTLE_DAILY_LIMIT, remaining: 0 });
      }

      const [firstFeed, secondFeed] = await Promise.all([
        store.list(scopeA, window),
        store.list(scopeB, window),
      ]);
      assert.equal(firstFeed.kind, 'ok');
      assert.equal(secondFeed.kind, 'ok');
      if (firstFeed.kind === 'ok' && secondFeed.kind === 'ok') {
        assert.equal(firstFeed.items.length + secondFeed.items.length, WHISTLE_DAILY_LIMIT);
        assert.ok(firstFeed.items.every((item) => item.author.userId === userId));
        assert.ok(secondFeed.items.every((item) => item.author.userId === userId));
      }
    } finally {
      await runtime.close();
    }
  },
);

test(
  'Redis Whistle keys expire at the exact next UTC midnight rather than creation plus 24 hours',
  { skip: !process.env.REDIS_URL },
  async () => {
    const runtime = new RedisRuntime(process.env.REDIS_URL);
    const store = new RedisWhistleStore(runtime);
    const userId = uniqueId('expiry-user');
    const scope = { kind: 'community' as const, id: uniqueId('expiry-scope') };
    const window = getWhistleUtcDayWindow();

    try {
      const sent = await store.send({
        window,
        scope,
        author: author(userId),
        body: 'expires at midnight',
      });
      assert.equal(sent.kind, 'accepted');

      const redis = await runtime.getClient();
      const quotaKey = `whistle:v1:quota:${window.day}:${userId}`;
      const feedKey = `whistle:v1:feed:${window.day}:${scope.kind}:${scope.id}`;
      const [quotaExpiry, feedExpiry] = await Promise.all([
        redis.pExpireTime(quotaKey),
        redis.pExpireTime(feedKey),
      ]);
      assert.equal(quotaExpiry, window.resetsAt.getTime());
      assert.equal(feedExpiry, window.resetsAt.getTime());
    } finally {
      await runtime.close();
    }
  },
);

test(
  'Redis Whistle store rejects stale day windows before any mutation or read is surfaced',
  { skip: !process.env.REDIS_URL },
  async () => {
    const runtime = new RedisRuntime(process.env.REDIS_URL);
    const store = new RedisWhistleStore(runtime);
    const yesterday = getWhistleUtcDayWindow(new Date(Date.now() - 86_400_000));
    const userId = uniqueId('stale-user');

    try {
      const send = await store.send({
        window: yesterday,
        scope: scopeA,
        author: author(userId),
        body: 'stale',
      });
      assert.deepEqual(send, { kind: 'stale_window' });
      assert.deepEqual(await store.quota(userId, yesterday), { kind: 'stale_window' });
      assert.deepEqual(await store.list(scopeA, yesterday), { kind: 'stale_window' });

      const redis = await runtime.getClient();
      assert.equal(await redis.exists(`whistle:v1:quota:${yesterday.day}:${userId}`), 0);
    } finally {
      await runtime.close();
    }
  },
);

test(
  'Redis Whistle store fails closed on corrupted quota key types',
  { skip: !process.env.REDIS_URL },
  async () => {
    const runtime = new RedisRuntime(process.env.REDIS_URL);
    const store = new RedisWhistleStore(runtime);
    const userId = uniqueId('corrupt-user');
    const window = getWhistleUtcDayWindow();

    try {
      const redis = await runtime.getClient();
      const key = `whistle:v1:quota:${window.day}:${userId}`;
      await redis.hSet(key, 'bad', 'type');
      await redis.pExpireAt(key, window.resetsAt.getTime());

      await assert.rejects(
        () =>
          store.send({
            window,
            scope: scopeA,
            author: author(userId),
            body: 'blocked by corrupt key',
          }),
        (error: unknown) => error instanceof WhistleStoreCorruptError,
      );
    } finally {
      await runtime.close();
    }
  },
);
