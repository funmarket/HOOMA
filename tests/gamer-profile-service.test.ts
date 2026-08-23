import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  GamerCardCreateInput,
  GamerCardUpdateInput,
  GamerGameListQuery,
} from '@hooma/contracts';
import { GamerService } from '../apps/api/src/modules/gamers/application/gamer.service.js';
import type {
  GamerGameCreateData,
  GamerGameCreateResult,
  GamerGameRecord,
  GamerGameRepository,
  GamerGameUpdateData,
  GamerGameUpdateResult,
} from '../apps/api/src/modules/gamers/application/gamer-game.repository.js';
import type {
  GamerProfileCreateResult,
  GamerProfileRecord,
  GamerProfileRepository,
  GamerProfileUpdateResult,
} from '../apps/api/src/modules/gamers/application/gamer-profile.repository.js';

const now = new Date('2026-08-23T22:00:00.000Z');

const game: GamerGameRecord = {
  id: 'game-1',
  slug: 'fc-26',
  name: 'FC 26',
  description: null,
  logoUrl: null,
  coverUrl: null,
  publisher: 'EA',
  platforms: ['EA', 'PLAYSTATION'],
  status: 'ACTIVE',
  featured: true,
  createdAt: now,
  updatedAt: now,
};

function profile(overrides: Partial<GamerProfileRecord> = {}): GamerProfileRecord {
  return {
    id: 'profile-1',
    userId: 'user-1',
    gameId: game.id,
    gamerTag: 'HOOMA10',
    bio: 'Ready to play',
    playStyle: 'COMPETITIVE',
    openToChallenge: true,
    region: 'Tunis',
    language: 'fr',
    preferredTimes: 'Evenings',
    visibility: 'PUBLIC',
    createdAt: now,
    updatedAt: now,
    game: {
      id: game.id,
      slug: game.slug,
      name: game.name,
      logoUrl: game.logoUrl,
      coverUrl: game.coverUrl,
    },
    owner: {
      id: 'user-1',
      username: 'hooma-user',
      displayName: 'HOOMA User',
      photoUrl: null,
    },
    platformIdentities: [
      {
        id: 'platform-public',
        provider: 'PSN',
        label: null,
        handle: 'public-id',
        visibility: 'PUBLIC',
      },
      {
        id: 'platform-matched',
        provider: 'EA_ID',
        label: null,
        handle: 'matched-id',
        visibility: 'MATCHED_ONLY',
      },
      {
        id: 'platform-private',
        provider: 'STEAM',
        label: null,
        handle: 'private-id',
        visibility: 'PRIVATE',
      },
    ],
    socialLinks: [
      {
        id: 'social-public',
        provider: 'YOUTUBE',
        label: null,
        url: 'https://youtube.com/@hooma',
        visibility: 'PUBLIC',
      },
      {
        id: 'social-private',
        provider: 'DISCORD',
        label: null,
        url: 'https://discord.com/users/example',
        visibility: 'PRIVATE',
      },
    ],
    ...overrides,
  };
}

class FakeGamerRepository implements GamerGameRepository, GamerProfileRepository {
  createProfileCalls: Array<{ userId: string; input: GamerCardCreateInput }> = [];
  createProfileResult: GamerProfileCreateResult = { kind: 'created', profile: profile() };
  publicProfile: GamerProfileRecord | null = profile();

  listPublic(input: GamerGameListQuery) {
    void input;
    return Promise.resolve({ items: [game], nextCursor: null });
  }

  getPublic(identifier: string) {
    void identifier;
    return Promise.resolve(game);
  }

  create(input: GamerGameCreateData): Promise<GamerGameCreateResult> {
    void input;
    return Promise.resolve({ kind: 'created', game });
  }

  update(id: string, input: GamerGameUpdateData): Promise<GamerGameUpdateResult> {
    void id;
    void input;
    return Promise.resolve({ kind: 'updated', game });
  }

  createProfile(userId: string, input: GamerCardCreateInput) {
    this.createProfileCalls.push({ userId, input });
    return Promise.resolve(this.createProfileResult);
  }

  updateProfile(
    userId: string,
    profileId: string,
    input: GamerCardUpdateInput,
  ): Promise<GamerProfileUpdateResult> {
    void userId;
    void profileId;
    void input;
    return Promise.resolve({ kind: 'updated', profile: profile() });
  }

  listMine(userId: string) {
    void userId;
    return Promise.resolve([profile()]);
  }

  getMine(userId: string, profileId: string) {
    void userId;
    void profileId;
    return Promise.resolve(profile());
  }

  getPublicProfile(profileId: string) {
    void profileId;
    return Promise.resolve(this.publicProfile);
  }
}

const createInput: GamerCardCreateInput = {
  gameId: 'game-1',
  gamerTag: 'HOOMA10',
  bio: null,
  playStyle: 'CASUAL',
  openToChallenge: true,
  region: null,
  language: null,
  preferredTimes: null,
  visibility: 'PUBLIC',
  platformIdentities: [],
  socialLinks: [],
};

test('Gamer Card creation is authorized by canonical authentication context, not a GAMER role', async () => {
  const repository = new FakeGamerRepository();
  const service = new GamerService(repository);

  const created = await service.createProfile('ordinary-authenticated-user', createInput);

  assert.equal(created.id, 'profile-1');
  assert.equal(repository.createProfileCalls.length, 1);
  assert.equal(repository.createProfileCalls[0]?.userId, 'ordinary-authenticated-user');
});

test('duplicate Gamer Card for the same user and game returns stable conflict', async () => {
  const repository = new FakeGamerRepository();
  repository.createProfileResult = { kind: 'conflict' };
  const service = new GamerService(repository);

  await assert.rejects(
    () => service.createProfile('user-1', createInput),
    (error: unknown) =>
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      error.status === 409 &&
      'code' in error &&
      error.code === 'GAMER_PROFILE_EXISTS',
  );
});

test('Gamer Card creation rejects a missing or inactive canonical game', async () => {
  const repository = new FakeGamerRepository();
  repository.createProfileResult = { kind: 'game_not_found' };
  const service = new GamerService(repository);

  await assert.rejects(
    () => service.createProfile('user-1', createInput),
    (error: unknown) =>
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      error.status === 404 &&
      'code' in error &&
      error.code === 'GAMER_GAME_NOT_FOUND',
  );
});

test('public Gamer Card response exposes only PUBLIC gameplay identities and social links', async () => {
  const repository = new FakeGamerRepository();
  const service = new GamerService(repository);

  const visible = await service.getPublicProfile('profile-1');

  assert.deepEqual(
    visible.platformIdentities.map((item) => item.handle),
    ['public-id'],
  );
  assert.deepEqual(
    visible.socialLinks.map((item) => item.url),
    ['https://youtube.com/@hooma'],
  );
});

test('MATCHED_ONLY and PRIVATE Gamer Cards are not exposed through the public endpoint', async () => {
  for (const visibility of ['MATCHED_ONLY', 'PRIVATE'] as const) {
    const repository = new FakeGamerRepository();
    repository.publicProfile = profile({ visibility });
    const service = new GamerService(repository);

    await assert.rejects(
      () => service.getPublicProfile('profile-1'),
      (error: unknown) =>
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        error.status === 404 &&
        'code' in error &&
        error.code === 'GAMER_PROFILE_NOT_FOUND',
    );
  }
});
