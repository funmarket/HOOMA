import type { DatabaseClient } from '../../../infrastructure/database/prisma.js';
import { distanceKm } from '../../communities/application/hooma-now-ranking.js';
import {
  loadCommunityProximityContext,
  rankCommunityProximity,
} from '../../communities/infrastructure/community-proximity.js';

function finiteCoordinate(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizedCity(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase() || null;
}

export async function loadPlaceDiscovery(
  db: DatabaseClient,
  userId: string,
  input: { query?: string; limit: number },
) {
  const context = await loadCommunityProximityContext(db, userId);
  const communityIds = context.communities.map((community) => community.id);
  const activeCommunity = context.communities.find(
    (community) => community.id === context.activeCommunityId,
  );
  const activePoints = context.placePoints.filter(
    (point) => point.communityId === context.activeCommunityId,
  );
  const activeCoordinates = activePoints.length
    ? {
        latitude:
          activePoints.reduce((sum, point) => sum + (finiteCoordinate(point.latitude) ?? 0), 0) /
          activePoints.length,
        longitude:
          activePoints.reduce((sum, point) => sum + (finiteCoordinate(point.longitude) ?? 0), 0) /
          activePoints.length,
      }
    : null;
  const activeCity = normalizedCity(activeCommunity?.city);

  const rows = await db.place.findMany({
    where: {
      deletedAt: null,
      OR: [
        { communityId: null },
        ...(communityIds.length ? [{ communityId: { in: communityIds } }] : []),
      ],
      ...(input.query
        ? {
            AND: [
              {
                OR: [
                  { name: { contains: input.query, mode: 'insensitive' } },
                  { category: { contains: input.query, mode: 'insensitive' } },
                  { city: { contains: input.query, mode: 'insensitive' } },
                  { houma: { contains: input.query, mode: 'insensitive' } },
                  { address: { contains: input.query, mode: 'insensitive' } },
                ],
              },
            ],
          }
        : {}),
    },
    include: {
      fanHubs: {
        where: { deletedAt: null },
        include: { clubs: { include: { club: true } } },
        take: 1,
      },
      menuItems: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
      claims: {
        where: { userId },
        select: { id: true, status: true },
        take: 1,
      },
    },
    take: input.limit,
  });

  const rankedCommunities = rankCommunityProximity(context);
  const rankedItems = rows
    .map((place) => {
      const latitude = finiteCoordinate(place.latitude);
      const longitude = finiteCoordinate(place.longitude);
      const distance =
        activeCoordinates && latitude !== null && longitude !== null
          ? distanceKm(activeCoordinates, { latitude, longitude })
          : null;
      const sameCity =
        activeCity !== null && normalizedCity(place.city) !== null
          ? activeCity === normalizedCity(place.city)
          : false;
      const bucket =
        place.communityId === context.activeCommunityId ? 0 : distance !== null ? 1 : sameCity ? 2 : 3;
      return { place, distance, bucket };
    })
    .sort((left, right) => {
      if (left.bucket !== right.bucket) return left.bucket - right.bucket;
      if (left.distance !== null && right.distance !== null && left.distance !== right.distance) {
        return left.distance - right.distance;
      }
      const nameCompare = left.place.name.localeCompare(right.place.name);
      return nameCompare !== 0 ? nameCompare : left.place.id.localeCompare(right.place.id);
    })
    .map(({ place, distance }) => ({ ...place, distanceKm: distance }));

  return {
    activeCommunityId: context.activeCommunityId,
    communities: rankedCommunities,
    items: rankedItems,
  };
}
