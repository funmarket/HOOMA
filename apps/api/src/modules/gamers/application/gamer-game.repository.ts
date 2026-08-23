import type { GamerGameListQuery, GamerGamePlatform, GamerGameStatus } from '@hooma/contracts';

export type GamerGameRecord = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  publisher: string | null;
  platforms: GamerGamePlatform[];
  status: GamerGameStatus;
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export interface GamerGameRepository {
  listPublic(
    input: GamerGameListQuery,
  ): Promise<{ items: GamerGameRecord[]; nextCursor: string | null }>;
  getPublic(identifier: string): Promise<GamerGameRecord | null>;
}
