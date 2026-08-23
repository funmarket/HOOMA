import type { CommunityService } from '../../communities/application/community.service.js';
import type { RequestCreateInput, RequestRepository } from './request-repository.js';

export class RequestService {
  constructor(
    private readonly repo: RequestRepository,
    private readonly communities: CommunityService,
  ) {}

  async list(userId: string, input: { communityId?: string; cursor?: string; limit?: number }) {
    if (input.communityId) await this.communities.requireMembership(userId, input.communityId);
    return this.repo.list(userId, {
      ...(input.communityId !== undefined ? { communityId: input.communityId } : {}),
      ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
      limit: Math.min(input.limit ?? 30, 100),
    });
  }

  discover(userId: string) {
    return this.repo.discover(userId);
  }

  async create(userId: string, input: RequestCreateInput) {
    await this.communities.requireMembership(userId, input.communityId);
    return this.repo.create(userId, input);
  }

  claim(userId: string, requestId: string, quantity: number) {
    return this.repo.claim(userId, requestId, quantity);
  }

  unclaim(userId: string, requestId: string) {
    return this.repo.unclaim(userId, requestId);
  }
}
