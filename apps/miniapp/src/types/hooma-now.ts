import type {
  EventItem,
  FundItem,
  RequestItem,
  RideOfferItem,
  RideRequestItem,
} from './domain';

export type HoomaNowCommunity = {
  id: string;
  name: string;
  city: string | null;
  visibility: 'PUBLIC' | 'PRIVATE';
  rank: number;
  distanceKm: number | null;
};

type HoomaNowSourceCommunity = Pick<HoomaNowCommunity, 'id' | 'name' | 'city'>;

export type HoomaNowEvent = EventItem & {
  community?: HoomaNowSourceCommunity;
};

export type HoomaNowRequest = RequestItem & {
  community?: HoomaNowSourceCommunity;
};

export type HoomaNowRideOffer = RideOfferItem & {
  community?: HoomaNowSourceCommunity;
};

export type HoomaNowRideRequest = RideRequestItem & {
  community?: HoomaNowSourceCommunity;
};

export type HoomaNowFund = FundItem & {
  community?: HoomaNowSourceCommunity;
};

export type HoomaNowResponse = {
  activeCommunityId: string | null;
  communities: HoomaNowCommunity[];
  events: HoomaNowEvent[];
  requests: HoomaNowRequest[];
  rideOffers: HoomaNowRideOffer[];
  rideRequests: HoomaNowRideRequest[];
  funds: HoomaNowFund[];
};
