import type { DatabaseClient } from '../../../infrastructure/database/prisma.js';
import { rankHoomaNowCommunities } from '../application/hooma-now-ranking.js';

type CoordinateAccumulator = {
  latitude: number;
  longitude: number;
  count: number;
};

function finiteCoordinate(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function addCoordinate(
  anchors: Map<string, CoordinateAccumulator>,
  communityId: string,
  latitudeValue: unknown,
  longitudeValue: unknown,
) {
  const latitude = finiteCoordinate(latitudeValue);
  const longitude = finiteCoordinate(longitudeValue);
  if (latitude === null || longitude === null) return;

  const current = anchors.get(communityId) ?? { latitude: 0, longitude: 0, count: 0 };
  current.latitude += latitude;
  current.longitude += longitude;
  current.count += 1;
  anchors.set(communityId, current);
}

export async function loadHoomaNow(db: DatabaseClient, userId: string) {
  const now = new Date();
  const eventFrom = new Date(now.getTime() - 6 * 60 * 60_000);
  const [preference, memberships] = await Promise.all([
    db.userPreference.findUnique({ where: { userId }, select: { activeCommunityId: true } }),
    db.membership.findMany({
      where: { userId, status: 'ACTIVE', community: { deletedAt: null } },
      select: { communityId: true, joinedAt: true },
      orderBy: { joinedAt: 'asc' },
    }),
  ]);
  const membershipIds = memberships.map((membership) => membership.communityId);
  const activeCommunityId =
    preference?.activeCommunityId && membershipIds.includes(preference.activeCommunityId)
      ? preference.activeCommunityId
      : (membershipIds[0] ?? null);

  const communities = await db.community.findMany({
    where: {
      deletedAt: null,
      OR: [
        { visibility: 'PUBLIC' },
        ...(membershipIds.length ? [{ id: { in: membershipIds } }] : []),
      ],
    },
    select: { id: true, name: true, city: true, visibility: true },
  });
  const communityIds = communities.map((community) => community.id);

  if (!communityIds.length) {
    return {
      activeCommunityId,
      communities: [],
      events: [],
      requests: [],
      rideOffers: [],
      rideRequests: [],
      funds: [],
    };
  }

  const [events, requests, rideOffers, rideRequests, funds, places] = await Promise.all([
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
    db.place.findMany({
      where: { communityId: { in: communityIds }, deletedAt: null },
      select: { communityId: true, latitude: true, longitude: true },
    }),
  ]);

  const anchors = new Map<string, CoordinateAccumulator>();
  for (const place of places) {
    if (place.communityId) {
      addCoordinate(anchors, place.communityId, place.latitude, place.longitude);
    }
  }
  for (const event of events) {
    addCoordinate(anchors, event.communityId, event.latitude, event.longitude);
  }
  for (const request of requests) {
    if (request.event) {
      addCoordinate(anchors, request.communityId, request.event.latitude, request.event.longitude);
    }
  }
  for (const ride of rideOffers) {
    addCoordinate(anchors, ride.communityId, ride.originLatitude, ride.originLongitude);
  }
  for (const ride of rideRequests) {
    addCoordinate(anchors, ride.communityId, ride.pickupLatitude, ride.pickupLongitude);
  }
  for (const fund of funds) {
    if (fund.event) {
      addCoordinate(anchors, fund.communityId, fund.event.latitude, fund.event.longitude);
    }
  }

  const rankedCommunities = rankHoomaNowCommunities(
    activeCommunityId,
    communities.map((community) => {
      const anchor = anchors.get(community.id);
      return {
        id: community.id,
        city: community.city,
        latitude: anchor ? anchor.latitude / anchor.count : null,
        longitude: anchor ? anchor.longitude / anchor.count : null,
      };
    }),
  );
  const rankByCommunityId = new Map(
    rankedCommunities.map((community) => [community.id, community] as const),
  );

  return {
    activeCommunityId,
    communities: communities
      .map((community) => ({
        ...community,
        rank: rankByCommunityId.get(community.id)?.rank ?? Number.MAX_SAFE_INTEGER,
        distanceKm: rankByCommunityId.get(community.id)?.distanceKm ?? null,
      }))
      .sort((left, right) => left.rank - right.rank),
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
