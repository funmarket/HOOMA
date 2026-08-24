import type { CommunityService } from '../../communities/application/community.service.js';
import type { EventService } from '../../events/application/event.service.js';
import type { AdminPaymentStatus, AdminReadRepository } from './admin-read.repository.js';

export class AdminService {
  constructor(
    private readonly reads: AdminReadRepository,
    private readonly communities: CommunityService,
    private readonly events: EventService,
  ) {}

  listManaged(userId: string) {
    return this.reads.listManagedCommunities(userId);
  }

  async dashboard(userId: string, communityId: string) {
    await this.communities.requireManager(userId, communityId);
    return this.reads.dashboard(communityId);
  }

  async payments(
    userId: string,
    communityId: string,
    input: {
      method?: 'CASH' | 'TELEGRAM_STARS';
      status?: AdminPaymentStatus;
      cursor?: string;
      limit?: number;
    },
  ) {
    await this.communities.requireManager(userId, communityId);
    return this.reads.payments(communityId, {
      ...(input.method !== undefined ? { method: input.method } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
      limit: Math.min(input.limit ?? 50, 100),
    });
  }

  async audit(userId: string, communityId: string, input: { cursor?: string; limit?: number }) {
    await this.communities.requireManager(userId, communityId);
    return this.reads.audit(communityId, {
      ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
      limit: Math.min(input.limit ?? 50, 100),
    });
  }

  ban(userId: string, communityId: string, membershipId: string, requestId: string) {
    return this.communities.ban(userId, communityId, membershipId, requestId);
  }

  cancelEvent(userId: string, eventId: string, requestId: string) {
    return this.events.cancelEvent(userId, eventId, requestId);
  }
}
