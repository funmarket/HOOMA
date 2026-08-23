export type HoomaNowCommunityCandidate = {
  id: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type RankedHoomaNowCommunity = HoomaNowCommunityCandidate & {
  rank: number;
  distanceKm: number | null;
};

function normalizedCity(value: string | null) {
  return value?.trim().toLocaleLowerCase() || null;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceKm(
  from: Pick<HoomaNowCommunityCandidate, 'latitude' | 'longitude'>,
  to: Pick<HoomaNowCommunityCandidate, 'latitude' | 'longitude'>,
) {
  if (
    from.latitude === null ||
    from.longitude === null ||
    to.latitude === null ||
    to.longitude === null
  ) {
    return null;
  }

  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function rankHoomaNowCommunities(
  activeCommunityId: string | null,
  candidates: HoomaNowCommunityCandidate[],
): RankedHoomaNowCommunity[] {
  const active = activeCommunityId
    ? candidates.find((candidate) => candidate.id === activeCommunityId) ?? null
    : null;
  const activeCity = normalizedCity(active?.city ?? null);

  return candidates
    .map((candidate) => {
      const distance = active ? distanceKm(active, candidate) : null;
      const sameCity =
        activeCity !== null && normalizedCity(candidate.city) !== null
          ? activeCity === normalizedCity(candidate.city)
          : false;
      const bucket =
        candidate.id === activeCommunityId
          ? 0
          : distance !== null
            ? 1
            : sameCity
              ? 2
              : 3;

      return { candidate, distance, bucket };
    })
    .sort((left, right) => {
      if (left.bucket !== right.bucket) return left.bucket - right.bucket;
      if (left.distance !== null && right.distance !== null && left.distance !== right.distance) {
        return left.distance - right.distance;
      }
      const cityCompare = (left.candidate.city ?? '').localeCompare(right.candidate.city ?? '');
      if (cityCompare !== 0) return cityCompare;
      return left.candidate.id.localeCompare(right.candidate.id);
    })
    .map(({ candidate, distance }, rank) => ({
      ...candidate,
      rank,
      distanceKm: distance,
    }));
}
