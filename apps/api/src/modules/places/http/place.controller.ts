import { placeCreateSchema } from '@hooma/contracts';
import { Router } from 'express';
import { asyncHandler } from '../../../http/middleware/async-handler.js';
import { getAuth } from '../../../http/middleware/auth.js';
import { parseBody } from '../../../http/middleware/parse.js';
import type { PlaceService } from '../application/place.service.js';

export function placeRouter(service: PlaceService) {
  const router = Router();

  router.get(
    '/discover',
    asyncHandler(async (req, res) => {
      const query = typeof req.query.q === 'string' ? req.query.q : undefined;
      const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
      res.json(
        await service.discover(getAuth(req).user.id, {
          ...(query !== undefined ? { query } : {}),
          ...(limit !== undefined ? { limit } : {}),
        }),
      );
    }),
  );

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const communityId =
        typeof req.query.communityId === 'string' ? req.query.communityId : undefined;
      const query = typeof req.query.q === 'string' ? req.query.q : undefined;
      const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
      res.json(
        await service.list(getAuth(req).user.id, {
          ...(communityId !== undefined ? { communityId } : {}),
          ...(query !== undefined ? { query } : {}),
          ...(limit !== undefined ? { limit } : {}),
        }),
      );
    }),
  );

  router.get(
    '/:placeId/events',
    asyncHandler(async (req, res) => {
      const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
      res.json(
        await service.listUpcomingEvents(getAuth(req).user.id, String(req.params.placeId), {
          ...(limit !== undefined ? { limit } : {}),
        }),
      );
    }),
  );

  router.get(
    '/:placeId',
    asyncHandler(async (req, res) => {
      res.json(await service.get(getAuth(req).user.id, String(req.params.placeId)));
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) =>
      res
        .status(201)
        .json(await service.create(getAuth(req).user.id, parseBody(placeCreateSchema, req))),
    ),
  );

  return router;
}
