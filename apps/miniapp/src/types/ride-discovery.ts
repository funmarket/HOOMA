import type { RideOfferItem, RideRequestItem } from './domain';

export type RideSourceCommunity = {
  id: string;
  name: string;
  city: string | null;
};

export type RankedRideCommunity = RideSourceCommunity & {
  visibility: 'PUBLIC' | 'PRIVATE';
  rank: number;
  distanceKm: number | null;
};

export type DiscoveredRideOffer = RideOfferItem & {
  community: RideSourceCommunity;
};

export type DiscoveredRideRequest = RideRequestItem & {
  community: RideSourceCommunity;
};

export type RideDiscoveryResponse = {
  activeCommunityId: string | null;
  communities: RankedRideCommunity[];
  offers: DiscoveredRideOffer[];
  requests: DiscoveredRideRequest[];
};
