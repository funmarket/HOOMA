import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express, { type NextFunction, type Request, type Response } from 'express';
import { buildApp } from '../apps/api/src/bootstrap/app.js';
import { buildContainer } from '../apps/api/src/bootstrap/container.js';
import { errorHandler } from '../apps/api/src/http/middleware/error-handler.js';
import {
  type AuthContext,
  type AuthenticatedRequest,
  sessionAuth,
  telegramAuth,
} from '../apps/api/src/http/middleware/auth.js';
import type { AuthService } from '../apps/api/src/modules/auth/application/auth.service.js';
import type { IdentityService } from '../apps/api/src/modules/identity/application/identity.service.js';
import type { TeamService } from '../apps/api/src/modules/teams/application/team.service.js';
import { teamRouter } from '../apps/api/src/modules/teams/http/team.controller.js';

const fakeIdentity = {
  upsertTelegramUser() {
    throw new Error('Telegram identity should not be resolved for an anonymous request');
  },
} as unknown as IdentityService;

const webIdentity = {
  id: 'web-user-1',
  telegramUserId: null,
  username: null,
  firstName: null,
  lastName: null,
  photoUrl: null,
  languageCode: null,
  isPremium: false,
};

const fakeAuth = {
  resolveSession(token: string) {
    return Promise.resolve(token === 'valid-web-session' ? webIdentity : null);
  },
} as unknown as AuthService;

const fakeTeams = {
  listPublic() {
    return Promise.resolve({
      items: [{ id: 'public-team', name: 'Public Team' }],
      nextCursor: null,
    });
  },
  managedTeams(userId: string) {
    return Promise.resolve({ items: [{ id: 'managed-team', managerUserId: userId }] });
  },
} as unknown as TeamService;

const authenticatedContext: AuthContext = {
  user: {
    id: 'user-1',
    telegramUserId: '123456',
    username: 'hooma-user',
    firstName: 'Hooma',
    lastName: 'User',
    photoUrl: null,
    languageCode: 'en',
    isPremium: false,
  },
  telegramUser: { id: '123456', username: 'hooma-user' },
};

function requestId(_req: Request, res: Response, next: NextFunction) {
  res.locals.requestId = 'test-request';
  next();
}

function buildBoundaryApp(authenticated = false) {
  const app = express();
  app.use(express.json());
  app.use(requestId);

  if (authenticated) {
    app.use((req, _res, next) => {
      (req as AuthenticatedRequest).auth = authenticatedContext;
      next();
    });
  }

  app.use(sessionAuth(fakeAuth));
  app.use(telegramAuth(fakeIdentity, { optional: true }));
  app.use('/api/v1/teams', teamRouter(fakeTeams));
  app.use(errorHandler);
  return app;
}

async function withServer(
  app: ReturnType<typeof buildBoundaryApp>,
  run: (baseUrl: string) => Promise<void>,
) {
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

async function withRealApp(run: (baseUrl: string) => Promise<void>) {
  const container = buildContainer();
  const app = buildApp(container);
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
    await container.db.$disconnect();
  }
}

test('anonymous public Team read succeeds without Telegram credentials', async () => {
  await withServer(buildBoundaryApp(), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/teams`);
    const body = (await response.json()) as { items: Array<{ id: string }> };

    assert.equal(response.status, 200);
    assert.equal(body.items[0]?.id, 'public-team');
  });
});

test('anonymous protected Team management route returns AUTH_REQUIRED', async () => {
  await withServer(buildBoundaryApp(), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/teams/managed`);
    const body = (await response.json()) as { error: { code: string } };

    assert.equal(response.status, 401);
    assert.equal(body.error.code, 'AUTH_REQUIRED');
  });
});

test('authenticated Telegram Team management request preserves existing behavior', async () => {
  await withServer(buildBoundaryApp(true), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/teams/managed`);
    const body = (await response.json()) as {
      items: Array<{ id: string; managerUserId: string }>;
    };

    assert.equal(response.status, 200);
    assert.deepEqual(body.items[0], { id: 'managed-team', managerUserId: 'user-1' });
  });
});

test('valid bearer session authenticates a web-only canonical user without Telegram', async () => {
  await withServer(buildBoundaryApp(), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/teams/managed`, {
      headers: { authorization: 'Bearer valid-web-session' },
    });
    const body = (await response.json()) as {
      items: Array<{ id: string; managerUserId: string }>;
    };

    assert.equal(response.status, 200);
    assert.deepEqual(body.items[0], { id: 'managed-team', managerUserId: 'web-user-1' });
  });
});

test('optional authentication does not downgrade supplied invalid bearer credentials to Guest', async () => {
  await withServer(buildBoundaryApp(), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/teams`, {
      headers: { authorization: 'Bearer not-a-hooma-session' },
    });
    const body = (await response.json()) as { error: { code: string } };

    assert.equal(response.status, 401);
    assert.equal(body.error.code, 'AUTH_INVALID');
  });
});

test('real web auth lifecycle works through Express, Prisma, and disposable Postgres', async () => {
  const username = `ci_web_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const otherUsername = `ci_alt_${Date.now().toString(36)}`;
  const password = 'correct-horse-battery-staple';
  const email = `${username}@example.com`;

  await withRealApp(async (baseUrl) => {
    const registerResponse = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password, displayName: 'CI Web User', email }),
    });
    const registered = (await registerResponse.json()) as {
      user: {
        id: string;
        telegramUserId: string | null;
        username?: string | null;
        password?: string;
      };
      token: string;
      expiresAt: string;
    };

    assert.equal(registerResponse.status, 201);
    assert.equal(registered.user.telegramUserId, null);
    assert.equal(registered.user.username, username);
    assert.equal('password' in registered.user, false);
    assert.equal(JSON.stringify(registered).includes(password), false);
    assert.ok(registered.user.id);
    assert.ok(registered.token);
    assert.ok(registered.expiresAt);

    const duplicateResponse = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const duplicate = (await duplicateResponse.json()) as { error: { code: string } };
    assert.equal(duplicateResponse.status, 409);
    assert.equal(duplicate.error.code, 'USERNAME_TAKEN');

    const duplicateEmailResponse = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: otherUsername,
        password,
        email: email.toUpperCase(),
      }),
    });
    const duplicateEmail = (await duplicateEmailResponse.json()) as { error: { code: string } };
    assert.equal(duplicateEmailResponse.status, 409);
    assert.equal(duplicateEmail.error.code, 'EMAIL_TAKEN');

    const meFromRegistrationResponse = await fetch(`${baseUrl}/api/v1/me`, {
      headers: { authorization: `Bearer ${registered.token}` },
    });
    const meFromRegistration = (await meFromRegistrationResponse.json()) as {
      id: string;
      telegramUserId: string | null;
      telegramUsername?: string | null;
      effectiveUsername?: string | null;
      effectiveDisplayName: string;
      effectivePhotoUrl?: string | null;
      presentation?: { displayName?: string | null; photoUrl?: string | null } | null;
    };
    assert.equal(meFromRegistrationResponse.status, 200);
    assert.equal(meFromRegistration.id, registered.user.id);
    assert.equal(meFromRegistration.telegramUserId, null);
    assert.equal(meFromRegistration.telegramUsername, null);
    assert.equal(meFromRegistration.effectiveUsername, username);
    assert.equal(meFromRegistration.effectiveDisplayName, 'CI Web User');
    assert.equal(meFromRegistration.effectivePhotoUrl, null);
    assert.equal(meFromRegistration.presentation?.displayName, 'CI Web User');

    const profileOverrideResponse = await fetch(`${baseUrl}/api/v1/me/profile`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${registered.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        displayName: 'CI Profile Override',
        photoUrl: 'https://example.com/ci-profile.jpg',
      }),
    });
    const profileOverride = (await profileOverrideResponse.json()) as {
      effectiveDisplayName: string;
      effectivePhotoUrl?: string | null;
      presentation?: { displayName?: string | null; photoUrl?: string | null } | null;
    };
    assert.equal(profileOverrideResponse.status, 200);
    assert.equal(profileOverride.effectiveDisplayName, 'CI Profile Override');
    assert.equal(profileOverride.effectivePhotoUrl, 'https://example.com/ci-profile.jpg');
    assert.equal(profileOverride.presentation?.displayName, 'CI Profile Override');
    assert.equal(profileOverride.presentation?.photoUrl, 'https://example.com/ci-profile.jpg');

    const profileClearResponse = await fetch(`${baseUrl}/api/v1/me/profile`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${registered.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ displayName: null, photoUrl: null }),
    });
    const profileClear = (await profileClearResponse.json()) as {
      effectiveDisplayName: string;
      effectiveUsername?: string | null;
      effectivePhotoUrl?: string | null;
      presentation?: { displayName?: string | null; photoUrl?: string | null } | null;
    };
    assert.equal(profileClearResponse.status, 200);
    assert.equal(profileClear.effectiveDisplayName, 'CI Web User');
    assert.equal(profileClear.effectiveUsername, username);
    assert.equal(profileClear.effectivePhotoUrl, null);
    assert.equal(profileClear.presentation?.displayName, null);
    assert.equal(profileClear.presentation?.photoUrl, null);

    const loginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const loggedIn = (await loginResponse.json()) as {
      user: { id: string; telegramUserId: string | null; password?: string };
      token: string;
      expiresAt: string;
    };

    assert.equal(loginResponse.status, 200);
    assert.equal(loggedIn.user.id, registered.user.id);
    assert.equal(loggedIn.user.telegramUserId, null);
    assert.equal('password' in loggedIn.user, false);
    assert.ok(loggedIn.token);

    const logoutResponse = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { authorization: `Bearer ${loggedIn.token}` },
    });
    assert.equal(logoutResponse.status, 204);

    const afterLogoutResponse = await fetch(`${baseUrl}/api/v1/me`, {
      headers: { authorization: `Bearer ${loggedIn.token}` },
    });
    const afterLogout = (await afterLogoutResponse.json()) as { error: { code: string } };
    assert.equal(afterLogoutResponse.status, 401);
    assert.equal(afterLogout.error.code, 'AUTH_INVALID');
  });
});
