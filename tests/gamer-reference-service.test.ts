import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  GamerChallengeRepository,
  GamerChallengeRecord,
} from '../apps/api/src/modules/gamers/application/gamer-challenge.repository.js';
import type { GamerEligibilityRepository } from '../apps/api/src/modules/gamers/application/gamer-eligibility.repository.js';
import type {
  GamerParticipationProfile,
  GamerParticipationRepository,
} from '../apps/api/src/modules/gamers/application/gamer-participation.repository.js';
import { GamerService } from '../apps/api/src/modules/gamers/application/gamer.service.js';
import type {
  GamerGameRepository,
  GamerGameRecord,
} from '../apps/api/src/modules/gamers/application/gamer-game.repository.js';
import type { GamerProfileRepository } from '../apps/api/src/modules/gamers/application/gamer-profile.repository.js';

const now = new Date('2026-09-28T22:00:00.000Z');

const game: GamerGameRecord = {
  id: 'game-fc',
  slug: 'ea-sports-fc-mobile',
  name: 'EA SPORTS FC Mobile',
  description: null,
  logoUrl: null,
  coverUrl: null,
  publisher: 'EA',
  platforms: ['EA', 'MOBILE'],
  status: 'ACTIVE',
  featured: true,
  createdAt: now,
  updatedAt: now,
};

const alice: GamerParticipationProfile = {
  id: 'profile-alice',
  userId: 'user-alice',
  gameId: game.id,
  gamerTag: 'Alice FC',
  openToChallenge: true,
};

const bob: GamerParticipationProfile = {
  id: 'profile-bob',
  userId: 'user-bob',
  gameId: game.id,
  gamerTag: 'Bob FC',
  openToChallenge: true,
};

class FakeParticipationRepository implements GamerParticipationRepository {
  profiles = [alice, bob];

  getByUserAndGame(userId: string, gameId: string) {
    return Promise.resolve(
      this.profiles.find((profile) => profile.userId === userId && profile.gameId === gameId) ??
        null,
    );
  }

  getById(profileId: string) {
    return Promise.resolve(this.profiles.find((profile) => profile.id === profileId) ?? null);
  }

  listOpenByGame() {
    return Promise.resolve([]);
  }

  listDiscoverable() {
    return Promise.resolve([]);
  }
}

class FakeEligibilityRepository implements GamerEligibilityRepository {
  constructor(private readonly eligible = new Set(['user-alice', 'user-bob'])) {}

  hasGamerIdentity(userId: string) {
    return Promise.resolve(this.eligible.has(userId));
  }
}

class FakeChallengeRepository implements GamerChallengeRepository {
  createCalls: Array<{
    gameId: string;
    challengerProfileId: string;
    challengedProfileId: string;
    pairKey: string;
  }> = [];
  allowCreate = true;

  createPending(input: {
    gameId: string;
    challengerProfileId: string;
    challengedProfileId: string;
    pairKey: string;
  }): Promise<GamerChallengeRecord | null> {
    this.createCalls.push(input);
    if (!this.allowCreate) return Promise.resolve(null);
    return Promise.resolve({
      id: 'challenge-1',
      gameId: input.gameId,
      status: 'PENDING',
      createdAt: now,
      respondedAt: null,
      cancelledAt: null,
      challenger: {
        id: alice.id,
        handle: alice.gamerTag,
        presentation: { username: 'alice', displayName: 'Alice', photoUrl: null },
      },
      challenged: {
        id: bob.id,
        handle: bob.gamerTag,
        presentation: { username: 'bob', displayName: 'Bob', photoUrl: null },
      },
    });
  }

  getAccessRecord() {
    return Promise.resolve(null);
  }

  listForUserAndGame() {
    return Promise.resolve([]);
  }

  listAcceptedAcrossActiveGames() {
    return Promise.resolve({ items: [], nextCursor: null });
  }

  acceptForChallengedUser() {
    return Promise.resolve(null);
  }

  declineForChallengedUser() {
    return Promise.resolve(null);
  }

  cancelForChallengerUser() {
    return Promise.resolve(null);
  }
}

function baseRepository() {
  return {
    getPublic(identifier: string) {
      return Promise.resolve(identifier === game.id || identifier === game.slug ? game : null);
    },
  } as unknown as GamerGameRepository & GamerProfileRepository;
}

test('reference Gamer challenge uses canonical GAMER identity and deterministic unordered pair key', async () => {
  const participation = new FakeParticipationRepository();
  const challenges = new FakeChallengeRepository();
  const eligibility = new FakeEligibilityRepository();
  const service = new GamerService(baseRepository(), participation, challenges, eligibility);

  const challenge = await service.createChallenge('user-alice', game.id, bob.id);

  assert.equal(challenge.status, 'PENDING');
  assert.deepEqual(challenges.createCalls, [
    {
      gameId: game.id,
      challengerProfileId: alice.id,
      challengedProfileId: bob.id,
      pairKey: 'profile-alice:profile-bob',
    },
  ]);
});

test('reference Gamer direct Whistle context is symmetric for the same eligible open pair', async () => {
  const participation = new FakeParticipationRepository();
  const challenges = new FakeChallengeRepository();
  const eligibility = new FakeEligibilityRepository();
  const service = new GamerService(baseRepository(), participation, challenges, eligibility);

  const aliceToBob = await service.resolveDirectWhistleContext('user-alice', bob.id);
  const bobToAlice = await service.resolveDirectWhistleContext('user-bob', alice.id);

  assert.equal(aliceToBob, 'game-fc:profile-alice:profile-bob');
  assert.equal(bobToAlice, aliceToBob);
});

test('reference Gamer challenge rejects a duplicate unresolved pair with a stable conflict', async () => {
  const participation = new FakeParticipationRepository();
  const challenges = new FakeChallengeRepository();
  challenges.allowCreate = false;
  const eligibility = new FakeEligibilityRepository();
  const service = new GamerService(baseRepository(), participation, challenges, eligibility);

  await assert.rejects(
    () => service.createChallenge('user-alice', game.id, bob.id),
    (error: unknown) =>
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      error.status === 409 &&
      'code' in error &&
      error.code === 'GAMER_CHALLENGE_ALREADY_PENDING',
  );
});

test('reference Gamer challenge rejects self-target and closed targets before persistence', async () => {
  const participation = new FakeParticipationRepository();
  const challenges = new FakeChallengeRepository();
  const eligibility = new FakeEligibilityRepository();
  const service = new GamerService(baseRepository(), participation, challenges, eligibility);

  await assert.rejects(
    () => service.createChallenge('user-alice', game.id, alice.id),
    (error: unknown) =>
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      error.status === 400 &&
      'code' in error &&
      error.code === 'GAMER_CHALLENGE_SELF_FORBIDDEN',
  );

  participation.profiles = [{ ...alice }, { ...bob, openToChallenge: false }];
  await assert.rejects(
    () => service.createChallenge('user-alice', game.id, bob.id),
    (error: unknown) =>
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      error.status === 409 &&
      'code' in error &&
      error.code === 'GAMER_CHALLENGE_TARGET_CLOSED',
  );
  assert.equal(challenges.createCalls.length, 0);
});
