import type { EventCreateInput, EventUpdateInput } from '@hooma/contracts';
import type { TransactionHandle } from '../../../application/unit-of-work.js';

export interface EventRepository {
  listForUser(
    userId: string,
    input: {
      communityId?: string;
      type?: 'PLAY' | 'WATCH';
      from: Date;
      limit: number;
      cursor?: string;
    },
  ): Promise<unknown>;
  discover(
    userId: string,
    input: { type?: 'PLAY' | 'WATCH'; from: Date },
  ): Promise<unknown>;
  create(userId: string, input: EventCreateInput): Promise<unknown>;
  update(
    eventId: string,
    actorUserId: string,
    input: EventUpdateInput,
    requestId: string,
  ): Promise<unknown>;
  get(eventId: string, userId: string): Promise<unknown | null>;
  communityIdForEvent(eventId: string): Promise<string | null>;
  cancel(
    eventId: string,
    actorUserId: string,
    requestId: string,
    tx: TransactionHandle,
  ): Promise<{ event: unknown; pendingPaymentIntentIds: string[] }>;
}

export interface PaymentRequiredRsvp {
  kind: 'PAYMENT_REQUIRED';
  rsvpId: string;
  userId: string;
  communityId: string;
  amountMinor: bigint;
  currency: string;
  rsvpStatus: 'PENDING_PAYMENT' | 'CONFIRMED';
}

export interface CompletedRsvp {
  kind: 'COMPLETE';
  result: unknown;
}

export type RsvpJoinPreparation = PaymentRequiredRsvp | CompletedRsvp;

export interface WaitlistPromotionPayment {
  rsvpId: string;
  userId: string;
  communityId: string;
  amountMinor: bigint;
  currency: string;
  rsvpStatus: 'PENDING_PAYMENT' | 'CONFIRMED';
}

export interface RsvpCancellationPreparation {
  cancelled: true;
  cancelledPaymentIntentId: string | null;
  promotedRsvpId: string | null;
  promotedPayment: WaitlistPromotionPayment | null;
}

export interface RsvpRepository {
  prepareJoin(
    eventId: string,
    userId: string,
    paymentMethod: 'CASH' | undefined,
    tx: TransactionHandle,
  ): Promise<RsvpJoinPreparation>;
  attachPayment(rsvpId: string, paymentIntentId: string, tx: TransactionHandle): Promise<unknown>;
  cancelAndPreparePromotion(
    eventId: string,
    userId: string,
    tx: TransactionHandle,
  ): Promise<RsvpCancellationPreparation>;
  markPaymentSettled(rsvpId: string, tx: TransactionHandle): Promise<void>;
  markPaymentRefunded(rsvpId: string, tx: TransactionHandle): Promise<void>;
  markPaymentCancelled(rsvpId: string, tx: TransactionHandle): Promise<void>;
}
