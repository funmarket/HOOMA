import type { PlaceCreateInput } from '@hooma/contracts';

export interface PlaceRepository {
  list(
    userId: string,
    input: { communityId?: string; query?: string; limit: number },
  ): Promise<unknown>;
  discover(userId: string, input: { query?: string; limit: number }): Promise<unknown>;
  get(userId: string, placeId: string): Promise<unknown | null>;
  listUpcomingEvents(userId: string, placeId: string, input: { limit: number }): Promise<unknown>;
  create(userId: string, input: PlaceCreateInput): Promise<unknown>;
}
