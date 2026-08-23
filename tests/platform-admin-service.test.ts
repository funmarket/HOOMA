import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express, { type NextFunction, type Request, type Response } from 'express';
import type {
  PlatformAdminBootstrapResult,
  PlatformAdminRepository,
  PlatformRole,
} from '../apps/api/src/modules/platform-admin/application/platform-admin.repository.js';
import { PlatformAdminService } from '../apps/api/src/modules/platform-admin/application/platform-admin.service.js';
import { platformAdminRouter } from '../apps/api/src/modules/platform-admin/http/platform-admin.controller.js';
import type { AuthContext, AuthenticatedRequest } from '../apps/api/src/http/middleware/auth.js';
import { errorHandler } from '../apps/api/src/http/middleware/error-handler.js';

class FakePlatformAdminRepository implements PlatformAdminRepository {
  readonly bootstrapCalls: Array<{ userId: string; normalizedAuthUsername: string }> = [];

  constructor(private readonly activeRolesByUserId: ReadonlyMap<string, readonly PlatformRole[]>) {}

  getActiveRoles(userId: string): Promise<PlatformRole[]> {
    return Promise.resolve([...(this.activeRolesByUserId.get(userId) ?? [])]);
  }

  bootstrapPlatformAdmin(
    userId: string,
    normalizedAuthUsername: string,
  ): Promise<PlatformAdminBootstrapResult> {
    this.bootstrapCalls.push({ userId, normalizedAuthUsername });
    return Promise.resolve('identity-mismatch');
  }
}

function serviceWithActiveAdmin() {
  return new PlatformAdminService(
    new FakePlatformAdminRepository(
      new Map<string, readonly PlatformRole[]>([['platform-admin', ['PLATFORM_ADMIN']]]),
    ),
  );
}

function authContext(userId: string): AuthContext {
  return {
    user: {
      id: userId,
      telegramUserId: null,
      username: null,
      firstName: null,
      lastName: null,
      photoUrl: null,
      languageCode: null,
      isPremium: false,
    },
  };
}

async function withPlatformAdminServer(
  userId: string,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const app = express();
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as AuthenticatedRequest).auth = authContext(userId);
    next();
  });
  app.use('/api/v1/app-admin', platformAdminRouter(serviceWithActiveAdmin()));
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

test('Platform Admin authority accepts an active PLATFORM_ADMIN assignment', async () => {
  const service = serviceWithActiveAdmin();

  assert.deepEqual(await service.getActiveRoles('platform-admin'), ['PLATFORM_ADMIN']);
  assert.equal(await service.isPlatformAdmin('platform-admin'), true);
  await assert.doesNotReject(() => service.requirePlatformAdmin('platform-admin'));
});

test('Platform Admin authority rejects a user without an active platform role', async () => {
  const service = serviceWithActiveAdmin();

  assert.equal(await service.isPlatformAdmin('normal-user'), false);
  await assert.rejects(
    () => service.requirePlatformAdmin('normal-user'),
    (error: unknown) =>
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      error.status === 403 &&
      'code' in error &&
      error.code === 'PLATFORM_ADMIN_REQUIRED',
  );
});

test('Community owner authority alone does not grant Platform Admin authority', async () => {
  const service = serviceWithActiveAdmin();

  assert.equal(await service.isPlatformAdmin('community-owner'), false);
  await assert.rejects(
    () => service.requirePlatformAdmin('community-owner'),
    (error: unknown) =>
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'PLATFORM_ADMIN_REQUIRED',
  );
});

test('Community admin authority alone does not grant Platform Admin authority', async () => {
  const service = serviceWithActiveAdmin();

  assert.equal(await service.isPlatformAdmin('community-admin'), false);
  await assert.rejects(
    () => service.requirePlatformAdmin('community-admin'),
    (error: unknown) =>
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'PLATFORM_ADMIN_REQUIRED',
  );
});

test('Revoked Platform Admin authority is treated as absent by the active-role boundary', async () => {
  const service = new PlatformAdminService(
    new FakePlatformAdminRepository(
      new Map<string, readonly PlatformRole[]>([
        ['active-admin', ['PLATFORM_ADMIN']],
        ['revoked-admin', []],
      ]),
    ),
  );

  assert.equal(await service.isPlatformAdmin('active-admin'), true);
  assert.equal(await service.isPlatformAdmin('revoked-admin'), false);
  await assert.rejects(
    () => service.requirePlatformAdmin('revoked-admin'),
    (error: unknown) =>
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'PLATFORM_ADMIN_REQUIRED',
  );
});

test('configured creator bootstrap is delegated to the canonical Platform Admin repository', async () => {
  const repository = new FakePlatformAdminRepository(new Map());
  const service = new PlatformAdminService(repository);

  await service.bootstrapConfiguredCreator('creator-user-id', 'creator.login');

  assert.deepEqual(repository.bootstrapCalls, [
    { userId: 'creator-user-id', normalizedAuthUsername: 'creator.login' },
  ]);
});

test('app-admin access endpoint reports only canonical Platform Admin authority', async () => {
  await withPlatformAdminServer('platform-admin', async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/app-admin/me`);
    const body = (await response.json()) as {
      isPlatformAdmin: boolean;
      roles: PlatformRole[];
    };

    assert.equal(response.status, 200);
    assert.equal(body.isPlatformAdmin, true);
    assert.deepEqual(body.roles, ['PLATFORM_ADMIN']);
  });

  await withPlatformAdminServer('community-admin', async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/app-admin/me`);
    const body = (await response.json()) as { isPlatformAdmin: boolean; roles: PlatformRole[] };

    assert.equal(response.status, 200);
    assert.equal(body.isPlatformAdmin, false);
    assert.deepEqual(body.roles, []);
  });
});
