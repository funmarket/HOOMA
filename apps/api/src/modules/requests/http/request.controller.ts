import { Router } from 'express';
import { requestClaimSchema, requestCreateSchema } from '@hooma/contracts';
import type { RequestService } from '../application/request.service.js';
import { asyncHandler } from '../../../http/middleware/async-handler.js';
import { getAuth } from '../../../http/middleware/auth.js';
import { parseBody } from '../../../http/middleware/parse.js';

export function requestRouter(service: RequestService) {
  const router = Router();

  router.get(
    '/discover',
    asyncHandler(async (req, res) => res.json(await service.discover(getAuth(req).user.id))),
  );

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const communityId =
        typeof req.query.communityId === 'string' ? req.query.communityId : undefined;
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
      const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
      res.json(
        await service.list(getAuth(req).user.id, {
          ...(communityId !== undefined ? { communityId } : {}),
          ...(cursor !== undefined ? { cursor } : {}),
          ...(limit !== undefined ? { limit } : {}),
        }),
      );
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) =>
      res
        .status(201)
        .json(await service.create(getAuth(req).user.id, parseBody(requestCreateSchema, req))),
    ),
  );

  router.post(
    '/:requestId/claim',
    asyncHandler(async (req, res) => {
      const input = parseBody(requestClaimSchema, req);
      res
        .status(201)
        .json(
          await service.claim(getAuth(req).user.id, String(req.params.requestId), input.quantity),
        );
    }),
  );

  router.delete(
    '/:requestId/claim',
    asyncHandler(async (req, res) =>
      res.json(await service.unclaim(getAuth(req).user.id, String(req.params.requestId))),
    ),
  );

  return router;
}
