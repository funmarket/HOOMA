import type { DatabaseClient } from '../../../infrastructure/database/prisma.js';
import {
  loadCommunityProximityContext,
  rankCommunityProximity,
  type CommunityProximityPoint,
} from '../../communities/infrastructure/community-proximity.js';

export async function loadRideDiscovery(db: DatabaseClient, userId: string, limit: number) {
  const context = await loadCommunityProximityContext(db, userId);
  const communityIds = context.communities.map((community) => community.id);
  if (!communityIds.length) {
    return {
      activeCommunityId: context.activeCommunityId,
      communities: [],
      offers: [],
      requests: [],
    };
  }

  const now = new Date();
  const [offers, requests] = await Promise.all([
    db.rideOffer.findMany({
      where: {
        communityId: { in: communityIds },
        deletedAt: null,
        status: { in: ['OPEN', 'FULL'] },
        departureAt: { gte: now },
      },
      include: {
        community: { select: { id: true, name: true, city: true } },
        driver: {
          select: { id: true, username: true, firstName: true, lastName: true, photoUrl: true },
        },
        matches: {
          where: { status: { in: ['REQUESTED', 'ACCEPTED'] } },
          select: { id: true, seats: true, status: true },
        },
        paymentMethods: { where: { enabled: true }, orderBy: { sortOrder: 'asc' } },
      },
      orderBy: [{ departureAt: 'asc' }, { id: 'asc' }],
      take: limit,
    }),
    db.rideRequest.findMany({
      where: {
        communityId: { in: communityIds },
        deletedAt: null,
        status: 'OPEN',
        desiredDepartureAt: { gte: now },
      },
      include: {
        community: { select: { id: true, name: true, city: true } },
        requester: {
          select: { id: true, username: true, firstName: true, lastName: true, photoUrl: true },
        },
        matches: {
          where: { status: { in: ['REQUESTED', 'ACCEPTED'] } },
          select: { id: true, seats: true, status: true },
        },
      },
      orderBy: [{ desiredDepartureAt: 'asc' }, { id: 'asc' }],
      take: limit,
    }),
  ]);

  const points: CommunityProximityPoint[] = [
    ...offers.map((offer) => ({
      communityId: offer.communityId,
      latitude: offer.originLatitude,
      longitude: offer.originLongitude,
    })),
    ...requests.map((request) => ({
      communityId: request.communityId,
      latitude: request.pickupLatitude,
      longitude: request.pickupLongitude,
    })),
  ];
  const communities = rankCommunityProximity(context, points);
  const rankByCommunity = new Map(communities.map((community) => [community.id, community.rank]));

  offers.sort((left, right) => {
    const rank =
      (rankByCommunity.get(left.communityId) ?? Number.MAX_SAFE_INTEGER) -
      (rankByCommunity.get(right.communityId) ?? Number.MAX_SAFE_INTEGER);
    if (rank !== 0) return rank;
    const time = left.departureAt.getTime() - right.departureAt.getTime();
    return time !== 0 ? time : left.id.localeCompare(right.id);
  });
  requests.sort((left, right) => {
    const rank =
      (rankByCommunity.get(left.communityId) ?? Number.MAX_SAFE_INTEGER) -
      (rankByCommunity.get(right.communityId) ?? Number.MAX_SAFE_INTEGER);
    if (rank !== 0) return rank;
    const time = left.desiredDepartureAt.getTime() - right.desiredDepartureAt.getTime();
    return time !== 0 ? time : left.id.localeCompare(right.id);
  });

  return {
    activeCommunityId: context.activeCommunityId,
    communities,
    offers,
    requests,
  };
}
