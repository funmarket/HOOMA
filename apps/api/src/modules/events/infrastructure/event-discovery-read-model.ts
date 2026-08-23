import type { DatabaseClient } from '../../../infrastructure/database/prisma.js';
import {
  loadCommunityProximityContext,
  rankCommunityProximity,
  type CommunityProximityPoint,
} from '../../communities/infrastructure/community-proximity.js';

export async function loadEventDiscovery(
  db: DatabaseClient,
  userId: string,
  input: { type?: 'PLAY' | 'WATCH'; from: Date },
) {
  const context = await loadCommunityProximityContext(db, userId);
  const communityIds = context.communities.map((community) => community.id);
  if (!communityIds.length) {
    return { activeCommunityId: context.activeCommunityId, communities: [], items: [] };
  }

  const rows = await db.event.findMany({
    where: {
      communityId: { in: communityIds },
      deletedAt: null,
      status: 'PUBLISHED',
      startsAt: { gte: input.from },
      ...(input.type ? { type: input.type } : {}),
    },
    include: {
      community: { select: { id: true, name: true, avatarUrl: true } },
      playDetails: true,
      watchDetails: {
        include: {
          homeClub: true,
          awayClub: true,
          fanHub: {
            include: {
              place: {
                include: {
                  menuItems: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
                },
              },
            },
          },
        },
      },
      paymentMethods: { where: { enabled: true }, orderBy: { sortOrder: 'asc' } },
      rsvps: {
        where: { userId },
        select: {
          id: true,
          status: true,
          seatHoldExpiresAt: true,
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
      _count: {
        select: { rsvps: { where: { status: { in: ['CONFIRMED', 'PENDING_PAYMENT'] } } } },
      },
    },
    orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
  });

  const points: CommunityProximityPoint[] = rows.map((event) => ({
    communityId: event.communityId,
    latitude: event.latitude,
    longitude: event.longitude,
  }));
  const communities = rankCommunityProximity(context, points);
  const rankByCommunityId = new Map(
    communities.map((community) => [community.id, community.rank] as const),
  );

  return {
    activeCommunityId: context.activeCommunityId,
    communities,
    items: rows.sort((left, right) => {
      const rankDelta =
        (rankByCommunityId.get(left.communityId) ?? Number.MAX_SAFE_INTEGER) -
        (rankByCommunityId.get(right.communityId) ?? Number.MAX_SAFE_INTEGER);
      if (rankDelta !== 0) return rankDelta;
      const timeDelta = left.startsAt.getTime() - right.startsAt.getTime();
      return timeDelta !== 0 ? timeDelta : left.id.localeCompare(right.id);
    }),
  };
}
