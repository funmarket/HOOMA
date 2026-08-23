import { Router } from 'express';
import { eventCreateSchema, eventUpdateSchema, rsvpCreateSchema } from '@hooma/contracts';
import type { EventService } from '../application/event.service.js';
import { asyncHandler } from '../../../http/middleware/async-handler.js';
import { parseBody } from '../../../http/middleware/parse.js';
import { getAuth } from '../../../http/middleware/auth.js';

export function eventRouter(service: EventService) {
  const router = Router();

  router.get(
    '/discover',
    asyncHandler(async (req, res) => {
      const type =
        req.query.type === 'PLAY' || req.query.type === 'WATCH' ? req.query.type : undefined;
      const from = typeof req.query.from === 'string' ? new Date(req.query.from) : undefined;
      res.json(
        await service.discover(getAuth(req).user.id, {
          ...(type !== undefined ? { type } : {}),
          ...(from !== undefined ? { from } : {}),
        }),
      );
    }),
  );

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const type =
        req.query.type === 'PLAY' || req.query.type === 'WATCH' ? req.query.type : undefined;
      const communityId =
        typeof req.query.communityId === 'string' ? req.query.communityId : undefined;
      const from = typeof req.query.from === 'string' ? new Date(req.query.from) : undefined;
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
      const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
      res.json(
        await service.list(getAuth(req).user.id, {
          ...(communityId !== undefined ? { communityId } : {}),
          ...(type !== undefined ? { type } : {}),
          ...(from !== undefined ? { from } : {}),
          ...(cursor !== undefined ? { cursor } : {}),
          ...(limit !== undefined ? { limit } : {}),
        }),
      );
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const input = parseBody(eventCreateSchema, req);
      res.status(201).json(await service.create(getAuth(req).user.id, input));
    }),
  );

  router.get(
    '/:eventId',
    asyncHandler(async (req, res) => {
      res.json(await service.get(getAuth(req).user.id, String(req.params.eventId)));
    }),
  );

  router.patch(
    '/:eventId',
    asyncHandler(async (req, res) => {
      res.json(
        await service.update(
          getAuth(req).user.id,
          String(req.params.eventId),
          parseBody(eventUpdateSchema, req),
          String(res.locals.requestId),
        ),
      );
    }),
  );

  router.post(
    '/:eventId/cancel',
    asyncHandler(async (req, res) => {
      res.json(
        await service.cancelEvent(
          getAuth(req).user.id,
          String(req.params.eventId),
          String(res.locals.requestId),
        ),
      );
    }),
  );

  router.post(
    '/:eventId/rsvp',
    asyncHandler(async (req, res) => {
      const input = parseBody(rsvpCreateSchema, req);
      res
        .status(201)
        .json(
          await service.join(getAuth(req).user.id, String(req.params.eventId), input.paymentMethod),
        );
    }),
  );

  router.delete(
    '/:eventId/rsvp',
    asyncHandler(async (req, res) => {
      res.json(await service.cancelRsvp(getAuth(req).user.id, String(req.params.eventId)));
    }),
  );

  return router;
}
