import type {
  GamerGameCreateInput,
  GamerGameListQuery,
  GamerGamePlatform,
  GamerGameStatus,
  GamerGameUpdateInput,
} from '@hooma/contracts';

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

export type GamerGameCreateData = GamerGameCreateInput & {
  slug: string;
  normalizedName: string;
};

export type GamerGameUpdateData = GamerGameUpdateInput & {
  slug?: string;
  normalizedName?: string;
};

export type GamerGameCreateResult =
  | { kind: 'created'; game: GamerGameRecord }
  | { kind: 'conflict' };

export type GamerGameUpdateResult =
  | { kind: 'updated'; game: GamerGameRecord }
  | { kind: 'not_found' }
  | { kind: 'conflict' };

export interface GamerGameRepository {
  listPublic(input: GamerGameListQuery): Promise<{
    items: GamerGameRecord[];
    nextCursor: string | null;
  }>;
  getPublic(identifier: string): Promise<GamerGameRecord | null>;
  create(input: GamerGameCreateData): Promise<GamerGameCreateResult>;
  update(id: string, input: GamerGameUpdateData): Promise<GamerGameUpdateResult>;
}
