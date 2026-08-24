import type { PlaceCreateInput } from '@hooma/contracts';
import { AppError } from '../../../http/errors/app-error.js';
import type { CommunityService } from '../../communities/application/community.service.js';
import type { PlaceRepository } from './place-repository.js';

export class PlaceService {
  constructor(
    private readonly repo: PlaceRepository,
    private readonly communities: CommunityService,
  ) {}

  async list(userId: string, input: { communityId?: string; query?: string; limit?: number }) {
    if (input.communityId) await this.communities.requireMembership(userId, input.communityId);
    return this.repo.list(userId, {
      ...(input.communityId !== undefined ? { communityId: input.communityId } : {}),
      ...(input.query !== undefined ? { query: input.query } : {}),
      limit: Math.min(input.limit ?? 50, 100),
    });
  }

  discover(userId: string, input: { query?: string; limit?: number }) {
    return this.repo.discover(userId, {
      ...(input.query !== undefined ? { query: input.query } : {}),
      limit: Math.min(input.limit ?? 100, 200),
    });
  }

  async get(userId: string, placeId: string) {
    const place = await this.repo.get(userId, placeId);
    if (!place) throw new AppError(404, 'PLACE_NOT_FOUND', 'Place not found.');
    return place;
  }

  async listUpcomingEvents(userId: string, placeId: string, input: { limit?: number }) {
    await this.get(userId, placeId);
    return this.repo.listUpcomingEvents(userId, placeId, {
      limit: Math.min(input.limit ?? 10, 50),
    });
  }

  async create(userId: string, input: PlaceCreateInput) {
    if (input.communityId) await this.communities.requireMembership(userId, input.communityId);
    return this.repo.create(userId, input);
  }
}
