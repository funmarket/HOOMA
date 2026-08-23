import type { DatabaseClient } from '../../../infrastructure/database/prisma.js';
import { rankHoomaNowCommunities } from '../application/hooma-now-ranking.js';

type CoordinateAccumulator = {
  latitude: number;
  longitude: number;
  count: number;
};

export type CommunityProximityPoint = {
  communityId: string;
  latitude: unknown;
  longitude: unknown;
};

export type CommunityProximityContext = {
  activeCommunityId: string | null;
  communities: Array<{
    id: string;
    name: string;
    city: string | null;
    visibility: 'PUBLIC' | 'PRIVATE';
  }>;
  placePoints: CommunityProximityPoint[];
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

export async function loadCommunityProximityContext(
  db: DatabaseClient,
  userId: string,
): Promise<CommunityProximityContext> {
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
  const places = communityIds.length
    ? await db.place.findMany({
        where: { communityId: { in: communityIds }, deletedAt: null },
        select: { communityId: true, latitude: true, longitude: true },
      })
    : [];

  return {
    activeCommunityId,
    communities,
    placePoints: places.flatMap((place) =>
      place.communityId
        ? [
            {
              communityId: place.communityId,
              latitude: place.latitude,
              longitude: place.longitude,
            },
          ]
        : [],
    ),
  };
}

export function rankCommunityProximity(
  context: CommunityProximityContext,
  supplementalPoints: CommunityProximityPoint[] = [],
) {
  const anchors = new Map<string, CoordinateAccumulator>();
  for (const point of [...context.placePoints, ...supplementalPoints]) {
    addCoordinate(anchors, point.communityId, point.latitude, point.longitude);
  }

  const ranked = rankHoomaNowCommunities(
    context.activeCommunityId,
    context.communities.map((community) => {
      const anchor = anchors.get(community.id);
      return {
        id: community.id,
        city: community.city,
        latitude: anchor ? anchor.latitude / anchor.count : null,
        longitude: anchor ? anchor.longitude / anchor.count : null,
      };
    }),
  );
  const byId = new Map(ranked.map((community) => [community.id, community] as const));

  return context.communities
    .map((community) => ({
      ...community,
      rank: byId.get(community.id)?.rank ?? Number.MAX_SAFE_INTEGER,
      distanceKm: byId.get(community.id)?.distanceKm ?? null,
    }))
    .sort((left, right) => left.rank - right.rank);
}
