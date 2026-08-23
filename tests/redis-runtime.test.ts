import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RedisRuntime,
  RedisUnavailableError,
} from '../apps/api/src/infrastructure/redis/client.js';

test('Redis runtime fails closed when no URL is configured', async () => {
  const runtime = new RedisRuntime(undefined);

  await assert.rejects(
    () => runtime.getClient(),
    (error: unknown) => error instanceof RedisUnavailableError,
  );
  await runtime.close();
});

test(
  'Redis runtime connects once and reaches the configured Redis service',
  { skip: !process.env.REDIS_URL },
  async () => {
    const runtime = new RedisRuntime(process.env.REDIS_URL);
    try {
      const [first, second] = await Promise.all([runtime.getClient(), runtime.getClient()]);
      assert.equal(first, second);
      assert.equal(await first.ping(), 'PONG');
    } finally {
      await runtime.close();
    }
  },
);
