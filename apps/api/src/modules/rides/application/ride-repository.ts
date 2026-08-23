import type { z } from 'zod';
import type { rideOfferCreateSchema, rideRequestCreateSchema } from '@hooma/contracts';
import type { TransactionHandle } from '../../../application/unit-of-work.js';

export type RideOfferCreateInput = z.infer<typeof rideOfferCreateSchema>;
export type RideRequestCreateInput = z.infer<typeof rideRequestCreateSchema>;

export interface RideStatusChangeResult {
  match: unknown;
  createCashPayment?: {
    matchId: string;
    userId: string;
    communityId: string;
    amountMinor: bigint;
    currency: string;
  };
  cancelPaymentIntentId?: string;
}

export interface RideOfferStatusChangeResult {
  offer: unknown;
  cancelPaymentIntentIds: string[];
}

export interface RideRepository {
  list(
    userId: string,
    input: {
      communityId?: string;
      offerCursor?: string;
      requestCursor?: string;
      limit: number;
    },
  ): Promise<unknown>;
  discover(userId: string, limit: number): Promise<unknown>;
  getVisibleOffer(userId: string, offerId: string): Promise<unknown | null>;
  createOffer(userId: string, input: RideOfferCreateInput): Promise<unknown>;
  createRequest(userId: string, input: RideRequestCreateInput): Promise<unknown>;
  requestSeats(
    userId: string,
    offerId: string,
    input: { rideRequestId?: string; seats: number },
  ): Promise<unknown>;
  setMatchStatus(
    actorUserId: string,
    offerId: string,
    matchId: string,
    status: 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'COMPLETED',
    tx: TransactionHandle,
  ): Promise<RideStatusChangeResult>;
  setOfferStatus(
    actorUserId: string,
    offerId: string,
    status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED',
    tx: TransactionHandle,
  ): Promise<RideOfferStatusChangeResult>;
  attachPayment(matchId: string, paymentIntentId: string, tx: TransactionHandle): Promise<unknown>;
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
  ): Promise<unknown>;
  addRating(
    userId: string,
    offerId: string,
    input: { rateeUserId: string; score: number; comment?: string },
  ): Promise<unknown>;
  markPaymentSettled(matchId: string, tx: TransactionHandle): Promise<void>;
  markPaymentRefunded(matchId: string, tx: TransactionHandle): Promise<void>;
  markPaymentCancelled(matchId: string, tx: TransactionHandle): Promise<void>;
}
