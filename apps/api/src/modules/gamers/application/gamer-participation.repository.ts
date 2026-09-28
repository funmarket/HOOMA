import type { GamerPublicPresentation } from '@hooma/contracts';

export type GamerParticipationProfile = {
  id: string;
  userId: string;
  gameId: string;
  gamerTag: string;
  openToChallenge: boolean;
};

export type GamerChallengerSummary = {
  id: string;
  handle: string;
  presentation: GamerPublicPresentation;
};

export type GamerDiscoverySummary = {
  id: string;
  handle: string;
  openToChallenge: boolean;
  game: {
    id: string;
    slug: string;
    name: string;
  };
  presentation: GamerPublicPresentation;
};

export interface GamerParticipationRepository {
  getByUserAndGame(userId: string, gameId: string): Promise<GamerParticipationProfile | null>;
  getById(profileId: string): Promise<GamerParticipationProfile | null>;
  listOpenByGame(gameId: string): Promise<GamerChallengerSummary[]>;
  listDiscoverable(): Promise<GamerDiscoverySummary[]>;
}
