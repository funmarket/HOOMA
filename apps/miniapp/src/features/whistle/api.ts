import type { WhistleFeedResponse, WhistleSendResponse } from '@hooma/contracts';
import { get, post } from '../../shared/api/http-client';

export const whistleQueryKey = (communityId: string) =>
  ['whistles', 'community', communityId] as const;

export function getCommunityWhistles(communityId: string) {
  return get<WhistleFeedResponse>(`/api/v1/whistles/communities/${communityId}`);
}

export function sendCommunityWhistle(communityId: string, body: string) {
  return post<WhistleSendResponse>(`/api/v1/whistles/communities/${communityId}`, { body });
}
