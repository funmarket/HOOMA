import type { DatabaseClient } from '../../../infrastructure/database/prisma.js';
import {
  loadCommunityProximityContext,
  rankCommunityProximity,
  type CommunityProximityPoint,
} from './community-proximity.js';

export async function loadHoomaNow(db: DatabaseClient, userId: string) {
  const now = new Date();
  const eventFrom = new Date(now.getTime() - 6 * 60 * 60_000);
  const context = await loadCommunityProximityContext(db, userId);
  const communityIds = context.communities.map((community) => community.id);

  if (!communityIds.length) {
    return {
      activeCommunityId: context.activeCommunityId,
      communities: [],
      events: [],
      requests: [],
      rideOffers: [],
      rideRequests: [],
      funds: [],
    };
  }

  const [events, requests, rideOffers, rideRequests, funds] = await Promise.all([
    db.event.findMany({
      where: {
        communityId: { in: communityIds },
        deletedAt: null,
        status: 'PUBLISHED',
        startsAt: { gte: eventFrom },
      },
      include: {
        community: { select: { id: true, name: true, city: true } },
        playDetails: true,
        watchDetails: {
          include: {
            homeClub: true,
            awayClub: true,
            fanHub: { include: { place: true } },
          },
        },
        _count: {
          select: { rsvps: { where: { status: { in: ['CONFIRMED', 'PENDING_PAYMENT'] } } } },
        },
      },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    }),
    db.request.findMany({
      where: {
        communityId: { in: communityIds },
        deletedAt: null,
        status: { in: ['OPEN', 'PARTIAL'] },
        expiresAt: { gte: now },
      },
      include: {
        community: { select: { id: true, name: true, city: true } },
        event: { select: { id: true, title: true, latitude: true, longitude: true } },
        claims: { select: { quantity: true, status: true } },
      },
      orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
    }),
    db.rideOffer.findMany({
      where: {
        communityId: { in: communityIds },
        deletedAt: null,
        status: { in: ['OPEN', 'FULL'] },
        departureAt: { gte: now },
      },
      include: {
        community: { select: { id: true, name: true, city: true } },
        matches: { select: { seats: true, status: true } },
      },
      orderBy: [{ departureAt: 'asc' }, { id: 'asc' }],
    }),
    db.rideRequest.findMany({
      where: {
        communityId: { in: communityIds },
        deletedAt: null,
        status: 'OPEN',
        desiredDepartureAt: { gte: now },
      },
      include: { community: { select: { id: true, name: true, city: true } } },
      orderBy: [{ desiredDepartureAt: 'asc' }, { id: 'asc' }],
    }),
    db.fundraiser.findMany({
      where: {
        communityId: { in: communityIds },
        deletedAt: null,
        status: { in: ['OPEN', 'FUNDED'] },
        OR: [{ deadline: null }, { deadline: { gte: now } }],
      },
      include: {
        community: { select: { id: true, name: true, city: true } },
        event: { select: { id: true, title: true, latitude: true, longitude: true } },
        contributions: { where: { status: 'PAID' }, select: { amountMinor: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    }),
  ]);

  const points: CommunityProximityPoint[] = [];
  for (const event of events) {
    points.push({
      communityId: event.communityId,
      latitude: event.latitude,
      longitude: event.longitude,
    });
  }
  for (const request of requests) {
    if (request.event) {
      points.push({
        communityId: request.communityId,
        latitude: request.event.latitude,
        longitude: request.event.longitude,
      });
    }
  }
  for (const ride of rideOffers) {
    points.push({
      communityId: ride.communityId,
      latitude: ride.originLatitude,
      longitude: ride.originLongitude,
    });
  }
  for (const ride of rideRequests) {
    points.push({
      communityId: ride.communityId,
      latitude: ride.pickupLatitude,
      longitude: ride.pickupLongitude,
    });
  }
  for (const fund of funds) {
    if (fund.event) {
      points.push({
        communityId: fund.communityId,
        latitude: fund.event.latitude,
        longitude: fund.event.longitude,
      });
    }
  }

  return {
    activeCommunityId: context.activeCommunityId,
    communities: rankCommunityProximity(context, points),
    events,
    requests,
    rideOffers,
    rideRequests,
    funds: funds.map((fund) => ({
      ...fund,
      collectedMinor: fund.contributions.reduce(
        (total, contribution) => total + contribution.amountMinor,
        0n,
      ),
      contributions: undefined,
    })),
  };
}
