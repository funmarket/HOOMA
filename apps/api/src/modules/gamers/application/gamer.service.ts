import type {
  GamerCardCreateInput,
  GamerCardUpdateInput,
  GamerGameCreateInput,
  GamerGameListQuery,
  GamerGameUpdateInput,
} from '@hooma/contracts';
import { AppError } from '../../../http/errors/app-error.js';
import { normalizeGamerGameName, slugifyGamerGameName } from '../domain/game-catalog-identity.js';
import type { GamerChallengeRepository } from './gamer-challenge.repository.js';
import type { GamerEligibilityRepository } from './gamer-eligibility.repository.js';
import type { GamerGameRepository } from './gamer-game.repository.js';
import type { GamerParticipationRepository } from './gamer-participation.repository.js';
import type { GamerProfileRecord, GamerProfileRepository } from './gamer-profile.repository.js';

const GLOBAL_ARENA_PAGE_SIZE = 24;

function publicProfile(profile: GamerProfileRecord) {
  if (profile.visibility !== 'PUBLIC') return null;
  return {
    ...profile,
    platformIdentities: profile.platformIdentities.filter((item) => item.visibility === 'PUBLIC'),
    socialLinks: profile.socialLinks.filter((item) => item.visibility === 'PUBLIC'),
  };
}

export class GamerService {
  constructor(
    private readonly games: GamerGameRepository & GamerProfileRepository,
    private readonly participation?: GamerParticipationRepository,
    private readonly challenges?: GamerChallengeRepository,
    private readonly eligibility?: GamerEligibilityRepository,
  ) {}

  listGames(input: GamerGameListQuery) {
    return this.games.listPublic(input);
  }

  listDiscoverableGamers() {
    return this.requireParticipationDependencies().participation.listDiscoverable();
  }

  listArenaMatches(cursor?: string) {
    return this.requireParticipationDependencies().challenges.listAcceptedAcrossActiveGames({
      ...(cursor ? { cursor } : {}),
      limit: GLOBAL_ARENA_PAGE_SIZE,
    });
  }

  async getGame(identifier: string) {
    const game = await this.games.getPublic(identifier);
    if (!game) throw new AppError(404, 'GAMER_GAME_NOT_FOUND', 'Game not found.');
    return game;
  }

  async createGame(input: GamerGameCreateInput) {
    const slug = this.requireSlug(input.name);
    const result = await this.games.create({
      ...input,
      slug,
      normalizedName: normalizeGamerGameName(input.name),
    });
    if (result.kind === 'conflict') {
      throw new AppError(
        409,
        'GAMER_GAME_CONFLICT',
        'A game with this name or slug already exists.',
      );
    }
    return result.game;
  }

  async updateGame(id: string, input: GamerGameUpdateInput) {
    const identity =
      input.name === undefined
        ? {}
        : {
            slug: this.requireSlug(input.name),
            normalizedName: normalizeGamerGameName(input.name),
          };
    const result = await this.games.update(id, { ...input, ...identity });
    if (result.kind === 'not_found') {
      throw new AppError(404, 'GAMER_GAME_NOT_FOUND', 'Game not found.');
    }
    if (result.kind === 'conflict') {
      throw new AppError(
        409,
        'GAMER_GAME_CONFLICT',
        'A game with this name or slug already exists.',
      );
    }
    return result.game;
  }

  async listChallengers(gameId: string) {
    await this.requireActiveGame(gameId);
    return this.requireParticipationDependencies().participation.listOpenByGame(gameId);
  }

  async createProfile(userId: string, input: GamerCardCreateInput) {
    const result = await this.games.createProfile(userId, input);
    if (result.kind === 'game_not_found') {
      throw new AppError(404, 'GAMER_GAME_NOT_FOUND', 'Active game not found.');
    }
    if (result.kind === 'conflict') {
      throw new AppError(
        409,
        'GAMER_PROFILE_EXISTS',
        'You already have a Gamer Card for this game.',
      );
    }
    return result.profile;
  }

  async updateProfile(userId: string, profileId: string, input: GamerCardUpdateInput) {
    const result = await this.games.updateProfile(userId, profileId, input);
    if (result.kind === 'not_found') {
      throw new AppError(404, 'GAMER_PROFILE_NOT_FOUND', 'Gamer Card not found.');
    }
    return result.profile;
  }

  listMyProfiles(userId: string) {
    return this.games.listMine(userId);
  }

  async getMyProfile(userId: string, profileId: string) {
    const profile = await this.games.getMine(userId, profileId);
    if (!profile) throw new AppError(404, 'GAMER_PROFILE_NOT_FOUND', 'Gamer Card not found.');
    return profile;
  }

  async getPublicProfile(profileId: string) {
    const profile = await this.games.getPublicProfile(profileId);
    const visible = profile ? publicProfile(profile) : null;
    if (!visible) throw new AppError(404, 'GAMER_PROFILE_NOT_FOUND', 'Gamer Card not found.');
    return visible;
  }

  async resolveDirectWhistleContext(userId: string, otherProfileId: string): Promise<string> {
    const { participation, eligibility } = this.requireParticipationDependencies();
    await this.requireGamerIdentity(userId);

    const otherProfile = await participation.getById(otherProfileId);
    if (!otherProfile) {
      throw new AppError(404, 'GAMER_PROFILE_NOT_FOUND', 'Gamer profile not found.');
    }
    await this.requireActiveGame(otherProfile.gameId);

    const ownProfile = await participation.getByUserAndGame(userId, otherProfile.gameId);
    if (!ownProfile) {
      throw new AppError(
        409,
        'GAMER_PROFILE_REQUIRED',
        'Create your profile for this game before sending a Gamer Whistle.',
      );
    }
    if (ownProfile.id === otherProfile.id) {
      throw new AppError(400, 'GAMER_WHISTLE_SELF_FORBIDDEN', 'You cannot Whistle yourself.');
    }
    if (!(await eligibility.hasGamerIdentity(otherProfile.userId))) {
      throw new AppError(
        409,
        'GAMER_WHISTLE_TARGET_INELIGIBLE',
        'This gamer is not currently participating in Gamers.',
      );
    }
    if (!ownProfile.openToChallenge || !otherProfile.openToChallenge) {
      throw new AppError(
        409,
        'GAMER_WHISTLE_PAIR_CLOSED',
        'Direct Gamer Whistle is available between players open to challenge.',
      );
    }

    const pairKey = [ownProfile.id, otherProfile.id].sort().join(':');
    return `${otherProfile.gameId}:${pairKey}`;
  }

  async createChallenge(userId: string, gameId: string, challengedProfileId: string) {
    const { participation, challenges, eligibility } =\n      this.requireParticipationDependencies();
    await this.requireActiveGame(gameId);
    await this.requireGamerIdentity(userId);

    const challenger = await participation.getByUserAndGame(userId, gameId);
    if (!challenger) {
      throw new AppError(
        409,
        'GAMER_PROFILE_REQUIRED',
        'Create your gamer profile before challenging.',
      );
    }

    const challenged = await participation.getById(challengedProfileId);
    if (!challenged || challenged.gameId !== gameId) {
      throw new AppError(404, 'GAMER_PROFILE_NOT_FOUND', 'Gamer profile not found.');
    }
    if (challenger.id === challenged.id) {
      throw new AppError(
        400,
        'GAMER_CHALLENGE_SELF_FORBIDDEN',
        'You cannot challenge yourself.',
      );
    }
    if (!(await eligibility.hasGamerIdentity(challenged.userId))) {
      throw new AppError(
        409,
        'GAMER_CHALLENGE_TARGET_INELIGIBLE',
        'This gamer is not currently participating in Gamers.',
      );
    }
    if (!challenged.openToChallenge) {
      throw new AppError(
        409,
        'GAMER_CHALLENGE_TARGET_CLOSED',
        'This gamer is not open to challenges.',
      );
    }

    const pairKey = [challenger.id, challenged.id].sort().join(':');
    const challenge = await challenges.createPending({
      gameId,
      challengerProfileId: challenger.id,
      challengedProfileId: challenged.id,
      pairKey,
    });
    if (!challenge) {
      throw new AppError(
        409,
        'GAMER_CHALLENGE_ALREADY_PENDING',
        'A pending challenge already exists between these gamers.',
      );
    }
    return challenge;
  }

  async listMyChallenges(userId: string, gameId: string) {
    const { participation, challenges } = this.requireParticipationDependencies();
    await this.requireActiveGame(gameId);
    const profile = await participation.getByUserAndGame(userId, gameId);
    if (!profile) return [];
    return challenges.listForUserAndGame(userId, gameId);
  }

  async acceptChallenge(userId: string, gameId: string, challengeId: string) {
    await this.requireGamerIdentity(userId);
    return this.transitionChallenge(userId, gameId, challengeId, 'ACCEPTED');
  }

  declineChallenge(userId: string, gameId: string, challengeId: string) {
    return this.transitionChallenge(userId, gameId, challengeId, 'DECLINED');
  }

  async cancelChallenge(userId: string, gameId: string, challengeId: string) {
    const { challenges } = this.requireParticipationDependencies();
    await this.requireActiveGame(gameId);
    const access = await this.requireChallenge(gameId, challengeId);
    if (access.challengerUserId !== userId) {
      throw new AppError(
        403,
        'GAMER_CHALLENGE_FORBIDDEN',
        'Only the challenger can cancel this challenge.',
      );
    }
    if (access.record.status === 'CANCELLED') return access.record;
    if (access.record.status !== 'PENDING') {
      throw new AppError(
        409,
        'GAMER_CHALLENGE_NOT_PENDING',
        'Only a pending challenge can be cancelled.',
      );
    }
    const updated = await challenges.cancelForChallengerUser(challengeId, userId);
    if (!updated) {
      throw new AppError(
        409,
        'GAMER_CHALLENGE_STATE_CHANGED',
        'Challenge state changed; refresh and try again.',
      );
    }
    return updated;
  }

  private async transitionChallenge(
    userId: string,
    gameId: string,
    challengeId: string,
    nextStatus: 'ACCEPTED' | 'DECLINED',
  ) {
    const { challenges } = this.requireParticipationDependencies();
    await this.requireActiveGame(gameId);
    const access = await this.requireChallenge(gameId, challengeId);
    if (access.challengedUserId !== userId) {
      throw new AppError(
        403,
        'GAMER_CHALLENGE_FORBIDDEN',
        'Only the challenged gamer can respond.',
      );
    }
    if (access.record.status === nextStatus) return access.record;
    if (access.record.status !== 'PENDING') {
      throw new AppError(
        409,
        'GAMER_CHALLENGE_NOT_PENDING',
        'Only a pending challenge can be answered.',
      );
    }

    const updated =
      nextStatus === 'ACCEPTED'
        ? await challenges.acceptForChallengedUser(challengeId, userId)
        : await challenges.declineForChallengedUser(challengeId, userId);
    if (!updated) {
      throw new AppError(
        409,
        'GAMER_CHALLENGE_STATE_CHANGED',
        'Challenge state changed; refresh and try again.',
      );
    }
    return updated;
  }

  private async requireChallenge(gameId: string, challengeId: string) {
    const { challenges } = this.requireParticipationDependencies();
    const access = await challenges.getAccessRecord(challengeId);
    if (!access || access.record.gameId !== gameId) {
      throw new AppError(404, 'GAMER_CHALLENGE_NOT_FOUND', 'Challenge not found.');
    }
    return access;
  }

  private async requireGamerIdentity(userId: string) {
    const { eligibility } = this.requireParticipationDependencies();
    if (!(await eligibility.hasGamerIdentity(userId))) {
      throw new AppError(
        409,
        'GAMER_IDENTITY_REQUIRED',
        'Join Gamers with your canonical HOOMA profile before using Gamer participation actions.',
      );
    }
  }

  private async requireActiveGame(gameId: string) {
    const game = await this.games.getPublic(gameId);
    if (!game) throw new AppError(404, 'GAMER_GAME_NOT_FOUND', 'Game not found.');
    return game;
  }

  private requireParticipationDependencies() {
    if (!this.participation || !this.challenges || !this.eligibility) {
      throw new Error('Gamer participation dependencies are not configured.');
    }
    return {
      participation: this.participation,
      challenges: this.challenges,
      eligibility: this.eligibility,
    };
  }

  private requireSlug(name: string) {
    const slug = slugifyGamerGameName(name);
    if (!slug) {
      throw new AppError(
        400,
        'GAMER_GAME_NAME_INVALID',
        'Game name must contain letters or numbers.',
      );
    }
    return slug;
  }
}
