import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express, { type Request } from 'express';
import { errorHandler } from '../apps/api/src/http/middleware/error-handler.js';
import type { AuthContext } from '../apps/api/src/http/middleware/auth.js';
import type { WhistleStore } from '../apps/api/src/modules/whistle/application/whistle-store.js';
import { WhistleService } from '../apps/api/src/modules/whistle/application/whistle.service.js';
import { whistleRouter } from '../apps/api/src/modules/whistle/http/whistle.controller.js';

const store: WhistleStore = {
  async send(input) {
    return {
      kind: 'accepted',
      item: {
        id: '1000-0',
        body: input.body,
        author: input.author,
        createdAt: '2026-08-23T21:00:00.000Z',
      },
      quota: { used: 1, remaining: 10 },
    };
  },
  async list() {
    return { kind: 'ok', items: [] };
  },
  async quota() {
    return { kind: 'ok', quota: { used: 0, remaining: 11 } };
  },
};

const service = new WhistleService(
  store,
  {
    async requireMembership() {
      return { status: 'ACTIVE' };
    },
  },
  {
    async getMe() {
      return { effectiveDisplayName: 'HTTP Tester', effectivePhotoUrl: null };
    },
  },
);

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const auth: AuthContext = {
      user: {
        id: 'http-user',
        telegramUserId: null,
        username: 'http_tester',
        firstName: 'HTTP',
        lastName: 'Tester',
        photoUrl: null,
        languageCode: null,
        isPremium: false,
      },
    };
    (req as Request & { auth: AuthContext }).auth = auth;
    next();
  });
  app.use('/api/v1/whistles', whistleRouter(service));
  app.use(errorHandler);

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address() as AddressInfo;

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test('Whistle HTTP POST returns 201 and canonical daily metadata', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/whistles/communities/community-1`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'Press high' }),
    });
    assert.equal(response.status, 201);
    const body = (await response.json()) as {
      dailyLimit: number;
      remaining: number;
      item: { body: string; author: { displayName: string } };
    };
    assert.equal(body.dailyLimit, 11);
    assert.equal(body.remaining, 10);
    assert.equal(body.item.body, 'Press high');
    assert.equal(body.item.author.displayName, 'HTTP Tester');
  });
});

test('Whistle HTTP POST rejects 34 graphemes with the standard validation envelope', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/whistles/communities/community-1`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'a'.repeat(34) }),
    });
    assert.equal(response.status, 400);
    const body = (await response.json()) as { error: { code: string } };
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });
});
