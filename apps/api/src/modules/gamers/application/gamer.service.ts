import type { GamerGameListQuery } from '@hooma/contracts';
import { AppError } from '../../../http/errors/app-error.js';
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
}
