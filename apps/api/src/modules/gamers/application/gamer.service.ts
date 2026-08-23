import type {
  GamerGameCreateInput,
  GamerGameListQuery,
  GamerGameUpdateInput,
} from '@hooma/contracts';
import { AppError } from '../../../http/errors/app-error.js';
import { normalizeGamerGameName, slugifyGamerGameName } from '../domain/game-catalog-identity.js';
import type { GamerGameRepository } from './gamer-game.repository.js';

export class GamerService {
  constructor(private readonly games: GamerGameRepository) {}

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
      throw new AppError(409, 'GAMER_GAME_CONFLICT', 'A game with this name or slug already exists.');
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
      throw new AppError(409, 'GAMER_GAME_CONFLICT', 'A game with this name or slug already exists.');
    }
    return result.game;
  }

  private requireSlug(name: string) {
    const slug = slugifyGamerGameName(name);
    if (!slug) {
      throw new AppError(400, 'GAMER_GAME_NAME_INVALID', 'Game name must contain letters or numbers.');
    }
    return slug;
  }
}
