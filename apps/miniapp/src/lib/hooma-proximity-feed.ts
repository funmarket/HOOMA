import type { HoomaNowCommunity, HoomaNowEvent } from '../types/hooma-now';

export function hoomaSourceLabel(
  community: HoomaNowCommunity | undefined,
  activeCommunityId: string | null,
) {
  if (!community) return null;
  if (community.id === activeCommunityId) return 'YOUR HOOMA';
  if (community.distanceKm !== null) {
    return `${community.name} · ${Math.round(community.distanceKm)} km`;
  }
  return community.city ? `${community.name} · ${community.city}` : community.name;
}

export function proximityRankedEvents(
  events: HoomaNowEvent[],
  communities: HoomaNowCommunity[],
  type?: 'PLAY' | 'WATCH',
) {
  const rankByCommunityId = new Map(
    communities.map((community) => [community.id, community.rank] as const),
  );

  return events
    .filter((event) => (type ? event.type === type : true))
    .sort((left, right) => {
      const rankDelta =
        (rankByCommunityId.get(left.communityId) ?? Number.MAX_SAFE_INTEGER) -
        (rankByCommunityId.get(right.communityId) ?? Number.MAX_SAFE_INTEGER);
      if (rankDelta !== 0) return rankDelta;
      const timeDelta = new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime();
      return timeDelta !== 0 ? timeDelta : left.id.localeCompare(right.id);
    });
}
