import { Router } from 'express';
import { profileUpdateSchema } from '@hooma/contracts';
import type { IdentityService } from '../application/identity.service.js';
import { asyncHandler } from '../../../http/middleware/async-handler.js';
import { getAuth } from '../../../http/middleware/auth.js';
import { parseBody } from '../../../http/middleware/parse.js';

export function identityRouter(service: IdentityService) {
  const router = Router();
  router.get(
    '/profiles/:userId',
    asyncHandler(async (req, res) =>
      res.json(await service.getPublicProfile(String(req.params.userId))),
    ),
  );
  router.get(
    '/me',
    asyncHandler(async (req, res) => res.json(await service.getMe(getAuth(req).user.id))),
  );
  router.patch(
    '/me/profile',
    asyncHandler(async (req, res) =>
      res.json(
        await service.updateProfile(getAuth(req).user.id, parseBody(profileUpdateSchema, req)),
      ),
    ),
  );
  return router;
}
