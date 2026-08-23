import type {
  GamerCardCreateInput,
  GamerCardUpdateInput,
  GamerGameCreateInput,
  GamerGameListQuery,
  GamerGameUpdateInput,
} from '@hooma/contracts';
import { AppError } from '../../../http/errors/app-error.js';
import { normalizeGamerGameName, slugifyGamerGameName } from '../domain/game-catalog-identity.js';
import type { GamerGameRepository } from './gamer-game.repository.js';
import type { GamerProfileRecord, GamerProfileRepository } from './gamer-profile.repository.js';

function publicProfile(profile: GamerProfileRecord) {
  if (profile.visibility !== 'PUBLIC') return null;
  return {
    ...profile,
    platformIdentities: profile.platformIdentities.filter((item) => item.visibility === 'PUBLIC'),
    socialLinks: profile.socialLinks.filter((item) => item.visibility === 'PUBLIC'),
  };
}

export class GamerService {
  constructor(private readonly games: GamerGameRepository & GamerProfileRepository) {}

  listGames(input: GamerGameListQuery) {
    return this.games.listPublic(input);
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
