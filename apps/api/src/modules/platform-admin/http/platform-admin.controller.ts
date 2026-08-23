import { gamerGameCreateSchema, gamerGameUpdateSchema } from '@hooma/contracts';
import { z } from 'zod';
import { Router } from 'express';
import { env } from '../../../config/env.js';
import type { GamerService } from '../../gamers/application/gamer.service.js';
import type { PlatformAdminService } from '../application/platform-admin.service.js';
import { asyncHandler } from '../../../http/middleware/async-handler.js';
import { getAuth } from '../../../http/middleware/auth.js';
import { parseBody } from '../../../http/middleware/parse.js';

const bootstrapSchema = z.object({
  token: z.string().min(32).max(256),
});

export function platformAdminRouter(service: PlatformAdminService, gamers: GamerService) {
  const router = Router();

  router.get(
    '/me',
    asyncHandler(async (req, res) => {
      const userId = getAuth(req).user.id;
      const roles = await service.getActiveRoles(userId);
      res.json({
        isPlatformAdmin: roles.includes('PLATFORM_ADMIN'),
        roles,
        bootstrapAvailable: Boolean(env.PLATFORM_ADMIN_BOOTSTRAP_TOKEN),
      });
    }),
  );

  router.post(
    '/bootstrap',
    asyncHandler(async (req, res) => {
      const configuredToken = env.PLATFORM_ADMIN_BOOTSTRAP_TOKEN;
      if (!configuredToken) {
        return res.status(404).json({
          error: {
            code: 'PLATFORM_ADMIN_BOOTSTRAP_UNAVAILABLE',
            message: 'Platform admin bootstrap is not available',
            requestId: String(res.locals.requestId || 'unknown'),
          },
        });
      }

      const userId = getAuth(req).user.id;
      const { token } = parseBody(bootstrapSchema, req);
      await service.bootstrapFirstPlatformAdmin(userId, token, configuredToken);
      const roles = await service.getActiveRoles(userId);
      return res.status(201).json({
        isPlatformAdmin: roles.includes('PLATFORM_ADMIN'),
        roles,
      });
    }),
  );

  router.post(
    '/gamers/games',
    asyncHandler(async (req, res) => {
      const userId = getAuth(req).user.id;
      await service.requirePlatformAdmin(userId);
      const game = await gamers.createGame(parseBody(gamerGameCreateSchema, req));
      res.status(201).json(game);
    }),
  );

  router.patch(
    '/gamers/games/:gameId',
    asyncHandler(async (req, res) => {
      const userId = getAuth(req).user.id;
      await service.requirePlatformAdmin(userId);
      const game = await gamers.updateGame(
        String(req.params.gameId),
        parseBody(gamerGameUpdateSchema, req),
      );
      res.json(game);
    }),
  );

  return router;
}
