import {
  gamerArenaQuerySchema,
  gamerCardCreateSchema,
  gamerCardUpdateSchema,
  gamerChallengeCreateSchema,
  gamerGameListQuerySchema,
} from '@hooma/contracts';
import { Router } from 'express';
import { asyncHandler } from '../../../http/middleware/async-handler.js';
import { getAuth } from '../../../http/middleware/auth.js';
import { parseBody } from '../../../http/middleware/parse.js';
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
    '/discovery',
    asyncHandler(async (_req, res) => {
      res.json({ items: await service.listDiscoverableGamers() });
    }),
  );

  router.get(
    '/arena',
    asyncHandler(async (req, res) => {
      const query = gamerArenaQuerySchema.parse(req.query);
      res.json(await service.listArenaMatches(query.cursor));
    }),
  );

  router.get(
    '/games/:gameId/challengers',
    asyncHandler(async (req, res) => {
      res.json({ items: await service.listChallengers(String(req.params.gameId)) });
    }),
  );

  router.post(
    '/games/:gameId/challenges',
    asyncHandler(async (req, res) => {
      const input = parseBody(gamerChallengeCreateSchema, req);
      res
        .status(201)
        .json(
          await service.createChallenge(
            getAuth(req).user.id,
            String(req.params.gameId),
            input.challengedProfileId,
          ),
        );
    }),
  );

  router.get(
    '/games/:gameId/challenges',
    asyncHandler(async (req, res) => {
      res.json({
        items: await service.listMyChallenges(getAuth(req).user.id, String(req.params.gameId)),
      });
    }),
  );

  router.post(
    '/games/:gameId/challenges/:challengeId/accept',
    asyncHandler(async (req, res) => {
      res.json(
        await service.acceptChallenge(
          getAuth(req).user.id,
          String(req.params.gameId),
          String(req.params.challengeId),
        ),
      );
    }),
  );

  router.post(
    '/games/:gameId/challenges/:challengeId/decline',
    asyncHandler(async (req, res) => {
      res.json(
        await service.declineChallenge(
          getAuth(req).user.id,
          String(req.params.gameId),
          String(req.params.challengeId),
        ),
      );
    }),
  );

  router.post(
    '/games/:gameId/challenges/:challengeId/cancel',
    asyncHandler(async (req, res) => {
      res.json(
        await service.cancelChallenge(
          getAuth(req).user.id,
          String(req.params.gameId),
          String(req.params.challengeId),
        ),
      );
    }),
  );

  router.get(
    '/games/:gameId',
    asyncHandler(async (req, res) => {
      res.json(await service.getGame(String(req.params.gameId)));
    }),
  );

  router.get(
    '/profiles/mine',
    asyncHandler(async (req, res) => res.json(await service.listMyProfiles(getAuth(req).user.id))),
  );

  router.post(
    '/profiles',
    asyncHandler(async (req, res) =>
      res
        .status(201)
        .json(
          await service.createProfile(getAuth(req).user.id, parseBody(gamerCardCreateSchema, req)),
        ),
    ),
  );

  router.get(
    '/profiles/mine/:profileId',
    asyncHandler(async (req, res) =>
      res.json(await service.getMyProfile(getAuth(req).user.id, String(req.params.profileId))),
    ),
  );

  router.patch(
    '/profiles/:profileId',
    asyncHandler(async (req, res) =>
      res.json(
        await service.updateProfile(
          getAuth(req).user.id,
          String(req.params.profileId),
          parseBody(gamerCardUpdateSchema, req),
        ),
      ),
    ),
  );

  router.get(
    '/profiles/:profileId',
    asyncHandler(async (req, res) =>
      res.json(await service.getPublicProfile(String(req.params.profileId))),
    ),
  );

  return router;
}
