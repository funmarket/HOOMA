import type { RequestItem } from './domain';

export type RankedRequestCommunity = {
  id: string;
  name: string;
  city: string | null;
  visibility: 'PUBLIC' | 'PRIVATE';
  rank: number;
  distanceKm: number | null;
};

export type RequestDiscoveryResponse = {
  activeCommunityId: string | null;
  communities: RankedRequestCommunity[];
  items: RequestItem[];
};
