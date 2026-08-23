import type { z } from 'zod';
import type { requestCreateSchema } from '@hooma/contracts';

export type RequestCreateInput = z.infer<typeof requestCreateSchema>;

export interface RequestRepository {
  list(
    userId: string,
    input: { communityId?: string; cursor?: string; limit: number },
  ): Promise<unknown>;
  discover(userId: string): Promise<unknown>;
  create(userId: string, input: RequestCreateInput): Promise<unknown>;
  claim(userId: string, requestId: string, quantity: number): Promise<unknown>;
  unclaim(userId: string, requestId: string): Promise<unknown>;
}
