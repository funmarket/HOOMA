import { gamerGameListQuerySchema } from '@hooma/contracts';
import { Router } from 'express';
import { asyncHandler } from '../../../http/middleware/async-handler.js';
import type { GamerService } from '../application/gamer.service.js';

export function gamerRouter(service: GamerService) {
  const router = Router();

  router.get(
    '/games',
    asyncHandler(async (req, res) => {
      res.json(await service.listGames(gamerGameListQuerySchema.parse(req.query)));
    }),
  );

  router.get(
    '/games/:gameId',
    asyncHandler(async (req, res) => {
      res.json(await service.getGame(String(req.params.gameId)));
    }),
  );

  return router;
}
