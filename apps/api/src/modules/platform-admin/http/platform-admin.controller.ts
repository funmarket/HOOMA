import { Router } from 'express';
import { env } from '../../../config/env.js';
import type { PlatformAdminService } from '../application/platform-admin.service.js';
import { asyncHandler } from '../../../http/middleware/async-handler.js';
import { getAuth } from '../../../http/middleware/auth.js';

export function platformAdminRouter(service: PlatformAdminService) {
  const router = Router();

  router.get(
    '/me',
    asyncHandler(async (req, res) => {
      const userId = getAuth(req).user.id;
      if (env.PLATFORM_ADMIN_BOOTSTRAP_AUTH_USERNAME) {
        await service.bootstrapConfiguredCreator(
          userId,
          env.PLATFORM_ADMIN_BOOTSTRAP_AUTH_USERNAME,
        );
      }
      const roles = await service.getActiveRoles(userId);
      res.json({
        isPlatformAdmin: roles.includes('PLATFORM_ADMIN'),
        roles,
      });
    }),
  );

  return router;
}
