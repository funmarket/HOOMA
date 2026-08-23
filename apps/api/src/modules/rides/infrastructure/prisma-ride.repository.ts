import { Prisma } from '@hooma/database';
import type { TransactionHandle } from '../../../application/unit-of-work.js';
import type { DatabaseClient } from '../../../infrastructure/database/prisma.js';
import { transactionClient } from '../../../infrastructure/database/unit-of-work.js';
import { decodeTimeIdCursor, encodeTimeIdCursor } from '../../../infrastructure/database/cursor.js';
import { AppError } from '../../../http/errors/app-error.js';
import type {
  RideOfferCreateInput,
  RideOfferStatusChangeResult,
  RideRepository,
  RideRequestCreateInput,
  RideStatusChangeResult,
} from '../application/ride-repository.js';
import { loadRideDiscovery } from './ride-discovery-read-model.js';

export class PrismaRideRepository implements RideRepository {
  constructor(private readonly db: DatabaseClient) {}

  async list(
    userId: string,
    input: {
      communityId?: string;
      offerCursor?: string;
      requestCursor?: string;
      limit: number;
    },
  ) {
    const whereCommunity = input.communityId
      ? { communityId: input.communityId }
      : { community: { memberships: { some: { userId, status: 'ACTIVE' as const } } } };
    const offerCursor = input.offerCursor
      ? decodeTimeIdCursor(input.offerCursor, 'Ride offer')
      : null;
    const requestCursor = input.requestCursor
      ? decodeTimeIdCursor(input.requestCursor, 'Ride request')
      : null;

    const [offerRows, requestRows] = await Promise.all([
      this.db.rideOffer.findMany({
        where: {
          ...whereCommunity,
          deletedAt: null,
          status: { in: ['OPEN', 'FULL', 'IN_PROGRESS'] },
          ...(offerCursor
            ? {
                OR: [
                  { departureAt: { gt: offerCursor.at } },
                  { departureAt: offerCursor.at, id: { gt: offerCursor.id } },
                ],
              }
            : {}),
        },
        include: {
          driver: {
            select: { id: true, username: true, firstName: true, lastName: true, photoUrl: true },
          },
          matches: {
            where: { status: { in: ['REQUESTED', 'ACCEPTED'] } },
            include: {
              rider: { select: { id: true, username: true, firstName: true, lastName: true } },
              paymentIntent: {
                select: {
                  id: true,
                  status: true,
                  selectedMethod: true,
                  amountMinor: true,
                  currency: true,
                },
              },
            },
          },
          paymentMethods: { where: { enabled: true }, orderBy: { sortOrder: 'asc' } },
        },
        orderBy: [{ departureAt: 'asc' }, { id: 'asc' }],
        take: input.limit + 1,
      }),
      this.db.rideRequest.findMany({
        where: {
          ...whereCommunity,
          deletedAt: null,
          status: { in: ['OPEN', 'MATCHED'] },
          ...(requestCursor
            ? {
                OR: [
                  { desiredDepartureAt: { gt: requestCursor.at } },
                  { desiredDepartureAt: requestCursor.at, id: { gt: requestCursor.id } },
                ],
              }
            : {}),
        },
        include: {
          requester: {
            select: { id: true, username: true, firstName: true, lastName: true, photoUrl: true },
          },
          matches: { where: { status: { in: ['REQUESTED', 'ACCEPTED'] } } },
        },
        orderBy: [{ desiredDepartureAt: 'asc' }, { id: 'asc' }],
        take: input.limit + 1,
      }),
    ]);

    const hasMoreOffers = offerRows.length > input.limit;
    const hasMoreRequests = requestRows.length > input.limit;
    const offers = hasMoreOffers ? offerRows.slice(0, input.limit) : offerRows;
    const requests = hasMoreRequests ? requestRows.slice(0, input.limit) : requestRows;

    return {
      offers,
      requests,
      nextOfferCursor:
        hasMoreOffers && offers.at(-1)
          ? encodeTimeIdCursor(offers.at(-1)!.departureAt, offers.at(-1)!.id)
          : null,
      nextRequestCursor:
        hasMoreRequests && requests.at(-1)
          ? encodeTimeIdCursor(requests.at(-1)!.desiredDepartureAt, requests.at(-1)!.id)
          : null,
    };
  }

  discover(userId: string, limit: number) {
    return loadRideDiscovery(this.db, userId, limit);
  }

  getVisibleOffer(userId: string, offerId: string) {
    return this.db.rideOffer.findFirst({
      where: {
        id: offerId,
        deletedAt: null,
        OR: [
          { community: { visibility: 'PUBLIC', deletedAt: null } },
          {
            community: {
              deletedAt: null,
              memberships: { some: { userId, status: 'ACTIVE' } },
            },
          },
        ],
      },
      include: {
        community: { select: { id: true, name: true, city: true, visibility: true } },
        driver: {
          select: { id: true, username: true, firstName: true, lastName: true, photoUrl: true },
        },
        matches: {
          where: { status: { in: ['REQUESTED', 'ACCEPTED', 'COMPLETED'] } },
          include: {
            rider: { select: { id: true, username: true, firstName: true, lastName: true } },
            paymentIntent: {
              select: {
                id: true,
                status: true,
                selectedMethod: true,
                amountMinor: true,
                currency: true,
              },
            },
          },
        },
        paymentMethods: { where: { enabled: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  async createOffer(userId: string, input: RideOfferCreateInput) {
    return this.db.$transaction(async (tx) => {
      if (input.eventId) {
        const event = await tx.event.findFirst({
          where: { id: input.eventId, communityId: input.communityId, deletedAt: null },
          select: { id: true },
        });
        if (!event) {
          throw new AppError(
            400,
            'RIDE_EVENT_COMMUNITY_MISMATCH',
            'The attached event must belong to the same community.',
          );
        }
      }

      const offer = await tx.rideOffer.create({
        data: {
          communityId: input.communityId,
          eventId: input.eventId || null,
          driverUserId: userId,
          title: input.title,
          originLabel: input.originLabel,
          originLatitude: input.originLatitude,
          originLongitude: input.originLongitude,
          destinationLabel: input.destinationLabel,
          destinationLatitude: input.destinationLatitude,
          destinationLongitude: input.destinationLongitude,
          departureAt: input.departureAt,
          seatsTotal: input.seatsTotal,
          costSplitMode: input.costSplitMode,
          seatPriceMinor: input.seatPriceMinor,
          currency: input.currency,
          liveTrackingEnabled: input.liveTrackingEnabled,
          note: input.note || null,
        },
      });
      for (const [sortOrder, method] of input.acceptedPaymentMethods.entries()) {
        await tx.rideOfferPaymentMethod.create({
          data: { rideOfferId: offer.id, method, enabled: true, sortOrder },
        });
      }
      return tx.rideOffer.findUniqueOrThrow({
        where: { id: offer.id },
        include: { paymentMethods: true },
      });
    });
  }

  async createRequest(userId: string, input: RideRequestCreateInput) {
    return this.db.$transaction(async (tx) => {
      if (input.eventId) {
        const event = await tx.event.findFirst({
          where: { id: input.eventId, communityId: input.communityId, deletedAt: null },
          select: { id: true },
        });
        if (!event) {
          throw new AppError(
            400,
            'RIDE_EVENT_COMMUNITY_MISMATCH',
            'The attached event must belong to the same community.',
          );
        }
      }
      return tx.rideRequest.create({
        data: {
          communityId: input.communityId,
          eventId: input.eventId || null,
          requesterUserId: userId,
          title: input.title,
          pickupLabel: input.pickupLabel,
          pickupLatitude: input.pickupLatitude,
          pickupLongitude: input.pickupLongitude,
          seatsNeeded: input.seatsNeeded,
          desiredDepartureAt: input.desiredDepartureAt,
          note: input.note || null,
        },
      });
    });
  }

  async requestSeats(
    userId: string,
    offerId: string,
    input: { rideRequestId?: string; seats: number },
  ) {
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "RideOffer" WHERE id = ${offerId} FOR UPDATE`;
        const offer = await tx.rideOffer.findFirst({
          where: { id: offerId, deletedAt: null },
          include: { community: { select: { visibility: true, deletedAt: true } } },
        });
        if (!offer || !['OPEN', 'FULL'].includes(offer.status)) {
          throw new AppError(409, 'RIDE_NOT_OPEN', 'Ride offer is not open.');
        }
        if (offer.community.deletedAt) {
          throw new AppError(404, 'RIDE_NOT_FOUND', 'Ride offer not found.');
        }
        if (offer.driverUserId === userId) {
          throw new AppError(
            409,
            'RIDE_DRIVER_CANNOT_JOIN',
            'The driver cannot request their own seats.',
          );
        }
        const membership = await tx.membership.findUnique({
          where: { communityId_userId: { communityId: offer.communityId, userId } },
        });
        if (membership?.status === 'BANNED') {
          throw new AppError(403, 'COMMUNITY_ACCESS_DENIED', 'Access to this community is denied.');
        }
        if (offer.community.visibility !== 'PUBLIC' && membership?.status !== 'ACTIVE') {
          throw new AppError(
            403,
            'COMMUNITY_ACCESS_DENIED',
            'Private community rides require active membership.',
          );
        }

        const existing = await tx.rideMatch.findUnique({
          where: { rideOfferId_riderUserId: { rideOfferId: offerId, riderUserId: userId } },
        });
        const aggregate = await tx.rideMatch.aggregate({
          where: {
            rideOfferId: offerId,
            status: { in: ['REQUESTED', 'ACCEPTED'] },
            ...(existing ? { id: { not: existing.id } } : {}),
          },
          _sum: { seats: true },
        });
        const usedByOthers = aggregate._sum.seats ?? 0;
        if (usedByOthers + input.seats > offer.seatsTotal) {
          throw new AppError(409, 'RIDE_FULL', 'Not enough seats remain.');
        }

        if (input.rideRequestId) {
          const request = await tx.rideRequest.findFirst({
            where: {
              id: input.rideRequestId,
              requesterUserId: userId,
              communityId: offer.communityId,
              deletedAt: null,
            },
          });
          if (!request)
            throw new AppError(404, 'RIDE_REQUEST_NOT_FOUND', 'Ride request not found.');
        }

        const quotedShareMinor =
          offer.costSplitMode === 'FIXED' ? offer.seatPriceMinor * BigInt(input.seats) : 0n;
        const match = await tx.rideMatch.upsert({
          where: { rideOfferId_riderUserId: { rideOfferId: offerId, riderUserId: userId } },
          create: {
            rideOfferId: offerId,
            rideRequestId: input.rideRequestId || null,
            riderUserId: userId,
            seats: input.seats,
            status: 'REQUESTED',
            quotedShareMinor,
          },
          update: {
            rideRequestId: input.rideRequestId || null,
            seats: input.seats,
            status: 'REQUESTED',
            quotedShareMinor,
          },
        });
        if (usedByOthers + input.seats >= offer.seatsTotal) {
          await tx.rideOffer.update({ where: { id: offerId }, data: { status: 'FULL' } });
        } else if (offer.status === 'FULL') {
          await tx.rideOffer.update({ where: { id: offerId }, data: { status: 'OPEN' } });
        }
        return match;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async setMatchStatus(
    actorUserId: string,
    offerId: string,
    matchId: string,
    status: 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'COMPLETED',
    handle: TransactionHandle,
  ): Promise<RideStatusChangeResult> {
    const tx = transactionClient(handle);
    await tx.$queryRaw`SELECT id FROM "RideOffer" WHERE id = ${offerId} FOR UPDATE`;
    const offer = await tx.rideOffer.findFirst({
      where: { id: offerId, deletedAt: null },
      include: { paymentMethods: { where: { enabled: true } } },
    });
    if (!offer) throw new AppError(404, 'RIDE_NOT_FOUND', 'Ride offer not found.');
    const match = await tx.rideMatch.findFirst({
      where: { id: matchId, rideOfferId: offerId },
      include: { paymentIntent: true },
    });
    if (!match) throw new AppError(404, 'RIDE_MATCH_NOT_FOUND', 'Ride match not found.');

    const driverAction = offer.driverUserId === actorUserId;
    const riderAction = match.riderUserId === actorUserId;
    if (['ACCEPTED', 'DECLINED', 'COMPLETED'].includes(status) && !driverAction) {
      throw new AppError(403, 'RIDE_DRIVER_REQUIRED', 'Only the driver can perform this action.');
    }
    if (status === 'CANCELLED' && !driverAction && !riderAction) {
      throw new AppError(403, 'RIDE_MATCH_FORBIDDEN', 'Not allowed to cancel this match.');
    }
    if (['DECLINED', 'CANCELLED'].includes(status) && match.paymentIntent?.status === 'PAID') {
      throw new AppError(
        409,
        'RIDE_PAYMENT_REFUND_REQUIRED',
        'Refund or void the paid ride share before cancelling this match.',
      );
    }

    const updated = await tx.rideMatch.update({ where: { id: matchId }, data: { status } });
    if (match.rideRequestId && status === 'ACCEPTED') {
      await tx.rideRequest.update({
        where: { id: match.rideRequestId },
        data: { status: 'MATCHED' },
      });
    }
    if (match.rideRequestId && ['DECLINED', 'CANCELLED'].includes(status)) {
      await tx.rideRequest.updateMany({
        where: { id: match.rideRequestId, status: 'MATCHED' },
        data: { status: 'OPEN' },
      });
    }

    if (['DECLINED', 'CANCELLED'].includes(status)) {
      const aggregate = await tx.rideMatch.aggregate({
        where: { rideOfferId: offerId, status: { in: ['REQUESTED', 'ACCEPTED'] } },
        _sum: { seats: true },
      });
      if ((aggregate._sum.seats ?? 0) < offer.seatsTotal && offer.status === 'FULL') {
        await tx.rideOffer.update({ where: { id: offerId }, data: { status: 'OPEN' } });
      }
      return {
        match: updated,
        ...(match.paymentIntent &&
        ['CREATED', 'AWAITING_PAYMENT', 'AWAITING_CASH'].includes(match.paymentIntent.status)
          ? { cancelPaymentIntentId: match.paymentIntent.id }
          : {}),
      };
    }

    if (
      status === 'ACCEPTED' &&
      offer.costSplitMode === 'FIXED' &&
      match.quotedShareMinor > 0n &&
      !match.paymentIntentId
    ) {
      const cashAccepted = offer.paymentMethods.some((method) => method.method === 'CASH');
      if (!cashAccepted) {
        throw new AppError(
          409,
          'RIDE_PAYMENT_METHOD_UNAVAILABLE',
          'This paid ride has no enabled payment method.',
        );
      }
      return {
        match: updated,
        createCashPayment: {
          matchId: match.id,
          userId: match.riderUserId,
          communityId: offer.communityId,
          amountMinor: match.quotedShareMinor,
          currency: offer.currency,
        },
      };
    }

    return { match: updated };
  }

  async setOfferStatus(
    actorUserId: string,
    offerId: string,
    status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED',
    handle: TransactionHandle,
  ): Promise<RideOfferStatusChangeResult> {
    const tx = transactionClient(handle);
    await tx.$queryRaw`SELECT id FROM "RideOffer" WHERE id = ${offerId} FOR UPDATE`;
    const offer = await tx.rideOffer.findFirst({
      where: { id: offerId, deletedAt: null },
      include: {
        matches: {
          include: { paymentIntent: true },
        },
      },
    });
    if (!offer) throw new AppError(404, 'RIDE_NOT_FOUND', 'Ride offer not found.');
    if (offer.driverUserId !== actorUserId) {
      throw new AppError(
        403,
        'RIDE_DRIVER_REQUIRED',
        'Only the driver can change the ride status.',
      );
    }

    if (status === 'IN_PROGRESS') {
      if (!['OPEN', 'FULL'].includes(offer.status)) {
        throw new AppError(409, 'RIDE_STATUS_INVALID', 'Only an open ride can be started.');
      }
      const accepted = offer.matches.filter((match) => match.status === 'ACCEPTED');
      if (accepted.length === 0) {
        throw new AppError(
          409,
          'RIDE_HAS_NO_ACCEPTED_RIDERS',
          'Accept at least one rider before starting the ride.',
        );
      }
      const updated = await tx.rideOffer.update({
        where: { id: offerId },
        data: { status: 'IN_PROGRESS' },
      });
      return { offer: updated, cancelPaymentIntentIds: [] };
    }

    if (status === 'COMPLETED') {
      if (offer.status !== 'IN_PROGRESS') {
        throw new AppError(
          409,
          'RIDE_STATUS_INVALID',
          'Only an in-progress ride can be completed.',
        );
      }

      const acceptedRequestIds = offer.matches
        .filter((match) => match.status === 'ACCEPTED' && match.rideRequestId)
        .map((match) => match.rideRequestId as string);
      const requestedRequestIds = offer.matches
        .filter((match) => match.status === 'REQUESTED' && match.rideRequestId)
        .map((match) => match.rideRequestId as string);

      await tx.rideMatch.updateMany({
        where: { rideOfferId: offerId, status: 'ACCEPTED' },
        data: { status: 'COMPLETED' },
      });
      await tx.rideMatch.updateMany({
        where: { rideOfferId: offerId, status: 'REQUESTED' },
        data: { status: 'DECLINED' },
      });
      if (acceptedRequestIds.length) {
        await tx.rideRequest.updateMany({
          where: { id: { in: acceptedRequestIds } },
          data: { status: 'COMPLETED' },
        });
      }
      if (requestedRequestIds.length) {
        await tx.rideRequest.updateMany({
          where: { id: { in: requestedRequestIds }, status: 'MATCHED' },
          data: { status: 'OPEN' },
        });
      }
      const updated = await tx.rideOffer.update({
        where: { id: offerId },
        data: { status: 'COMPLETED' },
      });
      return { offer: updated, cancelPaymentIntentIds: [] };
    }

    if (!['OPEN', 'FULL', 'IN_PROGRESS'].includes(offer.status)) {
      throw new AppError(409, 'RIDE_STATUS_INVALID', 'This ride can no longer be cancelled.');
    }
    const paid = offer.matches.find((match) => match.paymentIntent?.status === 'PAID');
    if (paid) {
      throw new AppError(
        409,
        'RIDE_PAYMENT_REFUND_REQUIRED',
        'Refund or void paid ride shares before cancelling the ride.',
      );
    }

    const cancelPaymentIntentIds = offer.matches
      .map((match) => match.paymentIntent)
      .filter(
        (intent): intent is NonNullable<typeof intent> =>
          intent !== null &&
          ['CREATED', 'AWAITING_PAYMENT', 'AWAITING_CASH'].includes(intent.status),
      )
      .map((intent) => intent.id);
    const requestIds = offer.matches
      .map((match) => match.rideRequestId)
      .filter((id): id is string => Boolean(id));

    await tx.rideMatch.updateMany({
      where: { rideOfferId: offerId, status: { in: ['REQUESTED', 'ACCEPTED'] } },
      data: { status: 'CANCELLED' },
    });
    if (requestIds.length) {
      await tx.rideRequest.updateMany({
        where: { id: { in: requestIds }, status: 'MATCHED' },
        data: { status: 'OPEN' },
      });
    }
    const updated = await tx.rideOffer.update({
      where: { id: offerId },
      data: { status: 'CANCELLED' },
    });
    return { offer: updated, cancelPaymentIntentIds };
  }

  attachPayment(matchId: string, paymentIntentId: string, handle: TransactionHandle) {
    return transactionClient(handle).rideMatch.update({
      where: { id: matchId },
      data: { paymentIntentId },
      include: { paymentIntent: true },
    });
  }

  async addLocation(
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
    const offer = await this.db.rideOffer.findFirst({
      where: { id: offerId, deletedAt: null },
      include: { matches: { where: { riderUserId: userId, status: 'ACCEPTED' } } },
    });
    if (!offer || !offer.liveTrackingEnabled) {
      throw new AppError(409, 'LIVE_TRACKING_DISABLED', 'Live tracking is not enabled.');
    }
    if (offer.driverUserId !== userId && offer.matches.length === 0) {
      throw new AppError(
        403,
        'RIDE_LOCATION_FORBIDDEN',
        'Only the driver or accepted riders may share location.',
      );
    }
    return this.db.rideLocationPing.create({
      data: {
        rideOfferId: offerId,
        userId,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracyMeters: input.accuracyMeters ?? null,
        heading: input.heading ?? null,
        speedMetersPerSecond: input.speedMetersPerSecond ?? null,
        expiresAt: new Date(Date.now() + 6 * 60 * 60_000),
      },
    });
  }

  async addRating(
    userId: string,
    offerId: string,
    input: { rateeUserId: string; score: number; comment?: string },
  ) {
    const offer = await this.db.rideOffer.findFirst({
      where: { id: offerId, deletedAt: null },
      include: { matches: { where: { status: { in: ['ACCEPTED', 'COMPLETED'] } } } },
    });
    if (!offer || offer.status !== 'COMPLETED') {
      throw new AppError(
        409,
        'RIDE_NOT_COMPLETED',
        'Ratings are available after the ride is completed.',
      );
    }
    const participants = new Set([
      offer.driverUserId,
      ...offer.matches.map((match) => match.riderUserId),
    ]);
    if (
      !participants.has(userId) ||
      !participants.has(input.rateeUserId) ||
      userId === input.rateeUserId
    ) {
      throw new AppError(
        403,
        'RIDE_RATING_FORBIDDEN',
        'Both users must have participated in the ride.',
      );
    }
    return this.db.rideRating.upsert({
      where: {
        rideOfferId_raterUserId_rateeUserId: {
          rideOfferId: offerId,
          raterUserId: userId,
          rateeUserId: input.rateeUserId,
        },
      },
      create: {
        rideOfferId: offerId,
        raterUserId: userId,
        rateeUserId: input.rateeUserId,
        score: input.score,
        comment: input.comment || null,
      },
      update: { score: input.score, comment: input.comment || null },
    });
  }

  async markPaymentSettled(matchId: string, handle: TransactionHandle): Promise<void> {
    await transactionClient(handle).rideMatch.findUniqueOrThrow({
      where: { id: matchId },
      select: { id: true },
    });
  }

  async markPaymentRefunded(matchId: string, handle: TransactionHandle): Promise<void> {
    await transactionClient(handle).rideMatch.findUniqueOrThrow({
      where: { id: matchId },
      select: { id: true },
    });
  }

  async markPaymentCancelled(matchId: string, handle: TransactionHandle): Promise<void> {
    await transactionClient(handle).rideMatch.findUniqueOrThrow({
      where: { id: matchId },
      select: { id: true },
    });
  }
}
