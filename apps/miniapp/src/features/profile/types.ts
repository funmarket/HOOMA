import type { Club, Me } from '../../types/domain';

export type SelectedProfileIdentity = 'PLAYER' | 'FAN' | 'GAMER';
export type EffectiveProfileIdentity = SelectedProfileIdentity | 'ULTRAFAN' | 'GHOST_RIDER';

export type ProfileMe = Omit<Me, 'profile' | 'telegramUserId'> & {
  telegramUserId: string | null;
  telegramUsername?: string | null;
  effectiveDisplayName: string;
  effectiveUsername?: string | null;
  effectivePhotoUrl?: string | null;
  presentation?: {
    displayName?: string | null;
    photoUrl?: string | null;
  } | null;
  profile?:
    | (NonNullable<Me['profile']> & {
        selectedIdentities: SelectedProfileIdentity[];
        effectiveIdentities: EffectiveProfileIdentity[];
      })
    | null;
};

export type PublicPlayerProfile = {
  id: string;
  effectiveDisplayName: string;
  effectiveUsername?: string | null;
  effectivePhotoUrl?: string | null;
  profile?: {
    skillLevel: string;
    skillRating: number;
    preferredPositions: string[];
    bio?: string | null;
    favoriteClub?: Club | null;
    selectedIdentities: SelectedProfileIdentity[];
    effectiveIdentities: EffectiveProfileIdentity[];
  } | null;
};
