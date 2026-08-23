import {
  rideLocationSchema,
  rideMatchSchema,
  rideOfferCreateSchema,
  rideOfferStatusSchema,
  rideRatingSchema,
  rideRequestCreateSchema,
} from '@hooma/contracts';
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../../http/middleware/async-handler.js';
import { getAuth } from '../../../http/middleware/auth.js';
import { parseBody } from '../../../http/middleware/parse.js';
import type { RideService } from '../application/ride.service.js';

const matchStatusSchema = z.object({
  status: z.enum(['ACCEPTED', 'DECLINED', 'CANCELLED', 'COMPLETED']),
});

export function rideRouter(service: RideService) {
  const router = Router();

  router.get(
    '/discover',
    asyncHandler(async (req, res) => {
      const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
      res.json(await service.discover(getAuth(req).user.id, limit));
    }),
  );

  router.get(
    '/offers/:offerId',
    asyncHandler(async (req, res) =>
      res.json(await service.getOffer(getAuth(req).user.id, String(req.params.offerId))),
    ),
  );

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const communityId =
        typeof req.query.communityId === 'string' ? req.query.communityId : undefined;
      const offerCursor =
        typeof req.query.offerCursor === 'string' ? req.query.offerCursor : undefined;
      const requestCursor =
        typeof req.query.requestCursor === 'string' ? req.query.requestCursor : undefined;
      const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
      res.json(
        await service.list(getAuth(req).user.id, {
          ...(communityId !== undefined ? { communityId } : {}),
          ...(offerCursor !== undefined ? { offerCursor } : {}),
          ...(requestCursor !== undefined ? { requestCursor } : {}),
          ...(limit !== undefined ? { limit } : {}),
        }),
      );
    }),
  );

  router.post(
    '/offers',
    asyncHandler(async (req, res) =>
      res
        .status(201)
        .json(
          await service.createOffer(getAuth(req).user.id, parseBody(rideOfferCreateSchema, req)),
        ),
    ),
  );

  router.post(
    '/requests',
    asyncHandler(async (req, res) =>
      res
        .status(201)
        .json(
          await service.createRequest(
            getAuth(req).user.id,
            parseBody(rideRequestCreateSchema, req),
          ),
        ),
    ),
  );

  router.post(
    '/offers/:offerId/matches',
    asyncHandler(async (req, res) => {
      const input = parseBody(rideMatchSchema, req);
      res.status(201).json(
        await service.requestSeats(getAuth(req).user.id, String(req.params.offerId), {
          seats: input.seats,
          ...(input.rideRequestId !== undefined ? { rideRequestId: input.rideRequestId } : {}),
        }),
      );
    }),
  );

  router.patch(
    '/offers/:offerId/status',
    asyncHandler(async (req, res) => {
      const input = parseBody(rideOfferStatusSchema, req);
      res.json(
        await service.setOfferStatus(
          getAuth(req).user.id,
          String(req.params.offerId),
          input.status,
        ),
      );
    }),
  );

  router.patch(
    '/offers/:offerId/matches/:matchId',
    asyncHandler(async (req, res) => {
      const input = parseBody(matchStatusSchema, req);
      res.json(
        await service.setMatchStatus(
          getAuth(req).user.id,
          String(req.params.offerId),
          String(req.params.matchId),
          input.status,
        ),
      );
    }),
  );

  router.post(
    '/offers/:offerId/location',
    asyncHandler(async (req, res) => {
      const input = parseBody(rideLocationSchema, req);
      res.status(201).json(
        await service.addLocation(getAuth(req).user.id, String(req.params.offerId), {
          latitude: input.latitude,
          longitude: input.longitude,
          ...(input.accuracyMeters !== undefined ? { accuracyMeters: input.accuracyMeters } : {}),
          ...(input.heading !== undefined ? { heading: input.heading } : {}),
          ...(input.speedMetersPerSecond !== undefined
            ? { speedMetersPerSecond: input.speedMetersPerSecond }
            : {}),
        }),
      );
    }),
  );

  router.post(
    '/offers/:offerId/ratings',
    asyncHandler(async (req, res) => {
      const input = parseBody(rideRatingSchema, req);
      res.status(201).json(
        await service.addRating(getAuth(req).user.id, String(req.params.offerId), {
          rateeUserId: input.rateeUserId,
          score: input.score,
          ...(input.comment !== undefined ? { comment: input.comment } : {}),
        }),
      );
    }),
  );

  return router;
}
