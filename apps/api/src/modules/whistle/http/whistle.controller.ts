import { whistleCreateSchema } from '@hooma/contracts';
import { Router } from 'express';
import { asyncHandler } from '../../../http/middleware/async-handler.js';
import { getAuth } from '../../../http/middleware/auth.js';
import { parseBody } from '../../../http/middleware/parse.js';
import type { WhistleService } from '../application/whistle.service.js';

export function whistleRouter(service: WhistleService) {
  const router = Router();

  router.get(
    '/communities/:communityId',
    asyncHandler(async (req, res) => {
      res.json(
        await service.listCommunity(getAuth(req).user.id, String(req.params.communityId)),
      );
    }),
  );

  router.post(
    '/communities/:communityId',
    asyncHandler(async (req, res) => {
      const input = parseBody(whistleCreateSchema, req);
      res
        .status(201)
        .json(
          await service.postCommunity(
            getAuth(req).user.id,
            String(req.params.communityId),
            input.body,
          ),
        );
    }),
  );

  return router;
}
