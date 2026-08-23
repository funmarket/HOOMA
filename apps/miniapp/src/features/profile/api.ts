import { profileUpdateSchema } from '@hooma/contracts';
import { get, patch } from '../../shared/api/http-client';
import type { Club } from '../../types/domain';
import type { ProfileMe, PublicPlayerProfile } from './types';

export const profileQueryKeys = {
  me: () => ['me'] as const,
  public: (userId: string) => ['profiles', 'public', userId] as const,
  favoriteClubOptions: () => ['clubs'] as const,
};

export function getCurrentProfile() {
  return get<ProfileMe>('/api/v1/me');
}

export function getPublicPlayerProfile(userId: string) {
  return get<PublicPlayerProfile>(`/api/v1/profiles/${userId}`);
}

export function updateCurrentProfile(input: unknown) {
  return patch<ProfileMe>('/api/v1/me/profile', profileUpdateSchema.parse(input));
}

export function listFavoriteClubOptions() {
  return get<Club[]>('/api/v1/watch/clubs');
}
