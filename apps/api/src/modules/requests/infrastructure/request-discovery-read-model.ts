import type { DatabaseClient } from '../../../infrastructure/database/prisma.js';
import {
  loadCommunityProximityContext,
  rankCommunityProximity,
  type CommunityProximityPoint,
} from '../../communities/infrastructure/community-proximity.js';

export async function loadRequestDiscovery(db: DatabaseClient, userId: string) {
  const context = await loadCommunityProximityContext(db, userId);
  const communityIds = context.communities.map((community) => community.id);
  if (!communityIds.length) {
    return { activeCommunityId: context.activeCommunityId, communities: [], items: [] };
  }

  const rows = await db.request.findMany({
    where: {
      communityId: { in: communityIds },
      deletedAt: null,
      expiresAt: { gt: new Date() },
      status: { in: ['OPEN', 'PARTIAL'] },
    },
    include: {
      event: { select: { id: true, title: true, latitude: true, longitude: true } },
      createdBy: {
        select: { id: true, username: true, firstName: true, lastName: true, photoUrl: true },
      },
      claims: { where: { status: 'ACTIVE' }, select: { quantity: true, status: true } },
    },
    orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
  });

  const points: CommunityProximityPoint[] = rows.flatMap((request) =>
    request.event
      ? [
          {
            communityId: request.communityId,
            latitude: request.event.latitude,
            longitude: request.event.longitude,
          },
        ]
      : [],
  );
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
      const expiryDelta = left.expiresAt.getTime() - right.expiresAt.getTime();
      if (expiryDelta !== 0) return expiryDelta;
      return left.id.localeCompare(right.id);
    }),
  };
}
