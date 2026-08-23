import { Router } from 'express';
import type { PlatformAdminService } from '../application/platform-admin.service.js';
import { asyncHandler } from '../../../http/middleware/async-handler.js';
import { getAuth } from '../../../http/middleware/auth.js';

export function platformAdminRouter(service: PlatformAdminService) {
  const router = Router();

  router.get(
    '/me',
    asyncHandler(async (req, res) => {
      const userId = getAuth(req).user.id;
      const roles = await service.getActiveRoles(userId);
      res.json({
        isPlatformAdmin: roles.includes('PLATFORM_ADMIN'),
        roles,
      });
    }),
  );

  return router;
}
