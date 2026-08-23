import type { UnitOfWork } from '../../../application/unit-of-work.js';
import { AppError } from '../../../http/errors/app-error.js';
import type { CommunityService } from '../../communities/application/community.service.js';
import type { PaymentRepository } from '../../payments/application/payment-repository.js';
import type {
  RideOfferCreateInput,
  RideRepository,
  RideRequestCreateInput,
} from './ride-repository.js';

export class RideService {
  constructor(
    private readonly repo: RideRepository,
    private readonly communities: CommunityService,
    private readonly payments: PaymentRepository,
    private readonly uow: UnitOfWork,
  ) {}

  async list(
    userId: string,
    input: { communityId?: string; offerCursor?: string; requestCursor?: string; limit?: number },
  ) {
    if (input.communityId) await this.communities.requireMembership(userId, input.communityId);
    return this.repo.list(userId, {
      ...(input.communityId !== undefined ? { communityId: input.communityId } : {}),
      ...(input.offerCursor !== undefined ? { offerCursor: input.offerCursor } : {}),
      ...(input.requestCursor !== undefined ? { requestCursor: input.requestCursor } : {}),
      limit: Math.min(input.limit ?? 30, 100),
    });
  }

  discover(userId: string, limit?: number) {
    return this.repo.discover(userId, Math.min(limit ?? 100, 100));
  }

  async getOffer(userId: string, offerId: string) {
    const offer = await this.repo.getVisibleOffer(userId, offerId);
    if (!offer) throw new AppError(404, 'RIDE_NOT_FOUND', 'Ride offer not found.');
    return offer;
  }

  async createOffer(userId: string, input: RideOfferCreateInput) {
    await this.communities.requireMembership(userId, input.communityId);
    return this.repo.createOffer(userId, input);
  }

  async createRequest(userId: string, input: RideRequestCreateInput) {
    await this.communities.requireMembership(userId, input.communityId);
    return this.repo.createRequest(userId, input);
  }

  requestSeats(userId: string, offerId: string, input: { rideRequestId?: string; seats: number }) {
    return this.repo.requestSeats(userId, offerId, input);
  }

  setMatchStatus(
    userId: string,
    offerId: string,
    matchId: string,
    status: 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'COMPLETED',
  ) {
    return this.uow.run(async (tx) => {
      const change = await this.repo.setMatchStatus(userId, offerId, matchId, status, tx);
      if (change.cancelPaymentIntentId) {
        await this.payments.cancelPendingIntent(change.cancelPaymentIntentId, tx);
      }
      if (change.createCashPayment) {
        const payment = await this.payments.createCashIntent(
          {
            userId: change.createCashPayment.userId,
            communityId: change.createCashPayment.communityId,
            purpose: 'RIDE_SHARE',
            amountMinor: change.createCashPayment.amountMinor,
            currency: change.createCashPayment.currency,
          },
          tx,
        );
        return this.repo.attachPayment(change.createCashPayment.matchId, payment.id, tx);
      }
      return change.match;
    });
  }

  setOfferStatus(
    userId: string,
    offerId: string,
    status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED',
  ) {
    return this.uow.run(async (tx) => {
      const change = await this.repo.setOfferStatus(userId, offerId, status, tx);
      for (const paymentIntentId of change.cancelPaymentIntentIds) {
        await this.payments.cancelPendingIntent(paymentIntentId, tx);
      }
      return change.offer;
    });
  }

  addLocation(
    userId: string,
    offerId: string,
    input: {
      latitude: number;
      longitude: number;
      accuracyMeters?: number;
      heading?: number;
      speedMetersPerSecond?: number;
    },
  ) {
    return this.repo.addLocation(userId, offerId, input);
  }

  addRating(
    userId: string,
    offerId: string,
    input: { rateeUserId: string; score: number; comment?: string },
  ) {
    return this.repo.addRating(userId, offerId, input);
  }
}
