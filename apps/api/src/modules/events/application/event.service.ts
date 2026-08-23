import type { EventCreateInput, EventUpdateInput } from '@hooma/contracts';
import type { CommunityService } from '../../communities/application/community.service.js';
import type { EventRepository } from './event-repository.js';
import type { RsvpService } from './rsvp.service.js';
import { AppError } from '../../../http/errors/app-error.js';
import type { PaymentRepository } from '../../payments/application/payment-repository.js';
import type { UnitOfWork } from '../../../application/unit-of-work.js';

export class EventService {
  constructor(
    private readonly repo: EventRepository,
    private readonly rsvps: RsvpService,
    private readonly communities: CommunityService,
    private readonly payments: PaymentRepository,
    private readonly uow: UnitOfWork,
  ) {}

  async list(
    userId: string,
    input: {
      communityId?: string;
      type?: 'PLAY' | 'WATCH';
      from?: Date;
      cursor?: string;
      limit?: number;
    },
  ) {
    if (input.communityId) await this.communities.requireMembership(userId, input.communityId);
    return this.repo.listForUser(userId, {
      ...(input.communityId !== undefined ? { communityId: input.communityId } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      from: input.from ?? new Date(Date.now() - 6 * 60 * 60_000),
      ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
      limit: Math.min(input.limit ?? 50, 100),
    });
  }

  discover(userId: string, input: { type?: 'PLAY' | 'WATCH'; from?: Date }) {
    return this.repo.discover(userId, {
      ...(input.type !== undefined ? { type: input.type } : {}),
      from: input.from ?? new Date(Date.now() - 6 * 60 * 60_000),
    });
  }

  async create(userId: string, input: EventCreateInput) {
    await this.communities.requireAdmin(userId, input.communityId);
    return this.repo.create(userId, input);
  }

  async get(userId: string, eventId: string) {
    const event = await this.repo.get(eventId, userId);
    if (!event) throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    return event;
  }

  async update(userId: string, eventId: string, input: EventUpdateInput, requestId: string) {
    const communityId = await this.repo.communityIdForEvent(eventId);
    if (!communityId) throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    await this.communities.requireAdmin(userId, communityId);
    return this.repo.update(eventId, userId, input, requestId);
  }

  join(userId: string, eventId: string, paymentMethod?: 'CASH') {
    return this.rsvps.join(eventId, userId, paymentMethod);
  }

  cancelRsvp(userId: string, eventId: string) {
    return this.rsvps.cancel(eventId, userId);
  }

  async cancelEvent(userId: string, eventId: string, requestId: string) {
    const communityId = await this.repo.communityIdForEvent(eventId);
    if (!communityId) throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    await this.communities.requireAdmin(userId, communityId);
    return this.uow.run(async (tx) => {
      const cancelled = await this.repo.cancel(eventId, userId, requestId, tx);
      for (const paymentIntentId of cancelled.pendingPaymentIntentIds) {
        await this.payments.cancelPendingIntent(paymentIntentId, tx);
      }
      return cancelled.event;
    });
  }
}
