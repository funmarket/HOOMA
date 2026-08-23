import type {
  GamerCardCreateInput,
  GamerCardUpdateInput,
  GamerPlatformIdentityProvider,
  GamerPlayStyle,
  GamerSocialProvider,
  GamerVisibility,
} from '@hooma/contracts';

export type GamerPlatformIdentityRecord = {
  id: string;
  provider: GamerPlatformIdentityProvider;
  label: string | null;
  handle: string;
  visibility: GamerVisibility;
};

export type GamerSocialLinkRecord = {
  id: string;
  provider: GamerSocialProvider;
  label: string | null;
  url: string;
  visibility: GamerVisibility;
};

export type GamerProfileGameRecord = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  coverUrl: string | null;
};

export type GamerProfileOwnerRecord = {
  id: string;
  username: string | null;
  displayName: string | null;
  photoUrl: string | null;
};

export type GamerProfileRecord = {
  id: string;
  userId: string;
  gameId: string;
  gamerTag: string;
  bio: string | null;
  playStyle: GamerPlayStyle;
  openToChallenge: boolean;
  region: string | null;
  language: string | null;
  preferredTimes: string | null;
  visibility: GamerVisibility;
  createdAt: Date;
  updatedAt: Date;
  game: GamerProfileGameRecord;
  owner: GamerProfileOwnerRecord;
  platformIdentities: GamerPlatformIdentityRecord[];
  socialLinks: GamerSocialLinkRecord[];
};

export type GamerProfileCreateResult =
  | { kind: 'created'; profile: GamerProfileRecord }
  | { kind: 'game_not_found' }
  | { kind: 'conflict' };

export type GamerProfileUpdateResult =
  { kind: 'updated'; profile: GamerProfileRecord } | { kind: 'not_found' };

export interface GamerProfileRepository {
  createProfile(userId: string, input: GamerCardCreateInput): Promise<GamerProfileCreateResult>;
  updateProfile(
    userId: string,
    profileId: string,
    input: GamerCardUpdateInput,
  ): Promise<GamerProfileUpdateResult>;
  listMine(userId: string): Promise<GamerProfileRecord[]>;
  getMine(userId: string, profileId: string): Promise<GamerProfileRecord | null>;
  getPublicProfile(profileId: string): Promise<GamerProfileRecord | null>;
}
