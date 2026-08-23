import { Prisma } from '@hooma/database';
import type { DatabaseClient } from '../../../infrastructure/database/prisma.js';
import { decodeTimeIdCursor, encodeTimeIdCursor } from '../../../infrastructure/database/cursor.js';
import { AppError } from '../../../http/errors/app-error.js';
import type { RequestCreateInput, RequestRepository } from '../application/request-repository.js';
import { loadRequestDiscovery } from './request-discovery-read-model.js';

export class PrismaRequestRepository implements RequestRepository {
  constructor(private readonly db: DatabaseClient) {}

  async list(userId: string, input: { communityId?: string; cursor?: string; limit: number }) {
    const cursor = input.cursor ? decodeTimeIdCursor(input.cursor, 'Request') : null;
    const rows = await this.db.request.findMany({
      where: {
        deletedAt: null,
        expiresAt: { gt: new Date() },
        status: { in: ['OPEN', 'PARTIAL'] },
        ...(input.communityId
          ? { communityId: input.communityId }
          : { community: { memberships: { some: { userId, status: 'ACTIVE' } } } }),
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.at } },
                { createdAt: cursor.at, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      include: {
        event: { select: { id: true, title: true } },
        createdBy: {
          select: { id: true, username: true, firstName: true, lastName: true, photoUrl: true },
        },
        claims: {
          where: { status: 'ACTIVE' },
          include: {
            user: { select: { id: true, username: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
    });

    const hasMore = rows.length > input.limit;
    const items = hasMore ? rows.slice(0, input.limit) : rows;
    const last = items.at(-1);
    return {
      items,
      nextCursor: hasMore && last ? encodeTimeIdCursor(last.createdAt, last.id) : null,
    };
  }

  discover(userId: string) {
    return loadRequestDiscovery(this.db, userId);
  }

  async create(userId: string, input: RequestCreateInput) {
    return this.db.$transaction(async (tx) => {
      if (input.eventId) {
        const event = await tx.event.findFirst({
          where: {
            id: input.eventId,
            communityId: input.communityId,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!event) {
          throw new AppError(
            400,
            'REQUEST_EVENT_COMMUNITY_MISMATCH',
            'The attached event must belong to the same community.',
          );
        }
      }

      return tx.request.create({
        data: {
          communityId: input.communityId,
          eventId: input.eventId || null,
          createdByUserId: userId,
          kind: input.kind,
          title: input.title,
          details: input.details || null,
          position: input.position ?? null,
          quantity: input.quantity,
          status: 'OPEN',
          expiresAt: input.expiresAt,
        },
      });
    });
  }

  async claim(userId: string, requestId: string, quantity: number) {
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Request" WHERE id = ${requestId} FOR UPDATE`;
        const request = await tx.request.findFirst({
          where: { id: requestId, deletedAt: null },
          include: { community: { select: { visibility: true, deletedAt: true } } },
        });
        if (!request || request.community.deletedAt) {
          throw new AppError(404, 'REQUEST_NOT_FOUND', 'Request not found.');
        }
        if (
          request.expiresAt <= new Date() ||
          !['OPEN', 'PARTIAL', 'CLAIMED'].includes(request.status)
        ) {
          throw new AppError(409, 'REQUEST_CLOSED', 'This request is no longer open.');
        }

        const membership = await tx.membership.findUnique({
          where: { communityId_userId: { communityId: request.communityId, userId } },
        });
        if (membership?.status === 'BANNED') {
          throw new AppError(403, 'COMMUNITY_ACCESS_DENIED', 'Access to this community is denied.');
        }
        if (request.community.visibility === 'PRIVATE' && membership?.status !== 'ACTIVE') {
          throw new AppError(
            403,
            'COMMUNITY_ACCESS_DENIED',
            'Private community requests are available only to active members.',
          );
        }

        const existing = await tx.requestClaim.findUnique({
          where: { requestId_userId: { requestId, userId } },
        });
        const claimedByOthers = await tx.requestClaim.aggregate({
          where: {
            requestId,
            status: 'ACTIVE',
            ...(existing ? { id: { not: existing.id } } : {}),
          },
          _sum: { quantity: true },
        });
        const otherQuantity = claimedByOthers._sum.quantity ?? 0;
        const remainingForUser = request.quantity - otherQuantity;
        if (quantity > remainingForUser) {
          throw new AppError(409, 'REQUEST_OVERCLAIM', 'Requested quantity exceeds what remains.');
        }

        const claim = await tx.requestClaim.upsert({
          where: { requestId_userId: { requestId, userId } },
          create: { requestId, userId, quantity, status: 'ACTIVE' },
          update: { quantity, status: 'ACTIVE' },
        });
        const claimedAfter = otherQuantity + quantity;
        await tx.request.update({
          where: { id: requestId },
          data: { status: claimedAfter >= request.quantity ? 'CLAIMED' : 'PARTIAL' },
        });
        return claim;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async unclaim(userId: string, requestId: string) {
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Request" WHERE id = ${requestId} FOR UPDATE`;
        const claim = await tx.requestClaim.findUnique({
          where: { requestId_userId: { requestId, userId } },
        });
        if (!claim || claim.status !== 'ACTIVE') {
          throw new AppError(404, 'REQUEST_CLAIM_NOT_FOUND', 'Active claim not found.');
        }

        await tx.requestClaim.update({
          where: { id: claim.id },
          data: { status: 'WITHDRAWN' },
        });
        const request = await tx.request.findUniqueOrThrow({ where: { id: requestId } });
        const active = await tx.requestClaim.aggregate({
          where: { requestId, status: 'ACTIVE' },
          _sum: { quantity: true },
        });
        const claimed = active._sum.quantity ?? 0;
        await tx.request.update({
          where: { id: requestId },
          data: {
            status: claimed === 0 ? 'OPEN' : claimed >= request.quantity ? 'CLAIMED' : 'PARTIAL',
          },
        });
        return { withdrawn: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
