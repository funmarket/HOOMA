import { Router } from 'express';
import {
  teamAssistantDelegationSchema,
  teamChallengeCreateSchema,
  teamChallengeMessageCreateSchema,
  teamCreateSchema,
  teamLineupCreateSchema,
  teamListQuerySchema,
  teamPlayerCreateSchema,
  teamUpdateSchema,
} from '@hooma/contracts';
import type { TeamService } from '../application/team.service.js';
import { asyncHandler } from '../../../http/middleware/async-handler.js';
import { getAuth } from '../../../http/middleware/auth.js';
import { parseBody } from '../../../http/middleware/parse.js';

function limitFromQuery(value: unknown) {
  return typeof value === 'string' ? Number(value) : undefined;
}

export function teamRouter(service: TeamService) {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const query = teamListQuerySchema.parse(req.query);
      res.json(
        await service.listPublic({
          limit: query.limit,
          ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
          ...(query.search !== undefined ? { search: query.search } : {}),
          ...(query.city !== undefined ? { city: query.city } : {}),
          ...(query.houma !== undefined ? { houma: query.houma } : {}),
        }),
      );
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) =>
      res
        .status(201)
        .json(await service.create(getAuth(req).user.id, parseBody(teamCreateSchema, req))),
    ),
  );

  router.get(
    '/managed',
    asyncHandler(async (req, res) => res.json(await service.managedTeams(getAuth(req).user.id))),
  );

  router.get(
    '/games',
    asyncHandler(async (req, res) =>
      res.json(await service.games(getAuth(req).user.id, limitFromQuery(req.query.limit))),
    ),
  );

  router.get(
    '/games/:gameId',
    asyncHandler(async (req, res) =>
      res.json(await service.getGame(getAuth(req).user.id, String(req.params.gameId))),
    ),
  );

  router.get(
    '/challenges/incoming',
    asyncHandler(async (req, res) =>
      res.json(
        await service.incomingChallenges(getAuth(req).user.id, limitFromQuery(req.query.limit)),
      ),
    ),
  );

  router.get(
    '/challenges/outgoing',
    asyncHandler(async (req, res) =>
      res.json(
        await service.outgoingChallenges(getAuth(req).user.id, limitFromQuery(req.query.limit)),
      ),
    ),
  );

  router.post(
    '/challenges',
    asyncHandler(async (req, res) =>
      res
        .status(201)
        .json(
          await service.createChallenge(
            getAuth(req).user.id,
            parseBody(teamChallengeCreateSchema, req),
          ),
        ),
    ),
  );

  router.get(
    '/challenges/:challengeId',
    asyncHandler(async (req, res) =>
      res.json(await service.getChallenge(getAuth(req).user.id, String(req.params.challengeId))),
    ),
  );

  router.post(
    '/challenges/:challengeId/accept',
    asyncHandler(async (req, res) =>
      res.json(await service.acceptChallenge(getAuth(req).user.id, String(req.params.challengeId))),
    ),
  );

  router.post(
    '/challenges/:challengeId/decline',
    asyncHandler(async (req, res) =>
      res.json(
        await service.declineChallenge(getAuth(req).user.id, String(req.params.challengeId)),
      ),
    ),
  );

  router.post(
    '/challenges/:challengeId/cancel',
    asyncHandler(async (req, res) =>
      res.json(await service.cancelChallenge(getAuth(req).user.id, String(req.params.challengeId))),
    ),
  );

  router.get(
    '/challenges/:challengeId/messages',
    asyncHandler(async (req, res) =>
      res.json(await service.messages(getAuth(req).user.id, String(req.params.challengeId))),
    ),
  );

  router.post(
    '/challenges/:challengeId/messages',
    asyncHandler(async (req, res) =>
      res
        .status(201)
        .json(
          await service.createMessage(
            getAuth(req).user.id,
            String(req.params.challengeId),
            parseBody(teamChallengeMessageCreateSchema, req),
          ),
        ),
    ),
  );

  router.get(
    '/:teamId',
    asyncHandler(async (req, res) => res.json(await service.getPublic(String(req.params.teamId)))),
  );

  router.get(
    '/:teamId/public-players',
    asyncHandler(async (req, res) => res.json(await service.publicRoster(String(req.params.teamId)))),
  );

  router.patch(
    '/:teamId',
    asyncHandler(async (req, res) =>
      res.json(
        await service.update(
          getAuth(req).user.id,
          String(req.params.teamId),
          parseBody(teamUpdateSchema, req),
        ),
      ),
    ),
  );

  router.get(
    '/:teamId/players',
    asyncHandler(async (req, res) =>
      res.json(await service.roster(getAuth(req).user.id, String(req.params.teamId))),
    ),
  );

  router.get(
    '/:teamId/player-candidates',
    asyncHandler(async (req, res) =>
      res.json(await service.rosterCandidates(getAuth(req).user.id, String(req.params.teamId))),
    ),
  );

  router.post(
    '/:teamId/players',
    asyncHandler(async (req, res) =>
      res
        .status(201)
        .json(
          await service.addPlayer(
            getAuth(req).user.id,
            String(req.params.teamId),
            parseBody(teamPlayerCreateSchema, req),
            String(res.locals.requestId),
          ),
        ),
    ),
  );

  router.delete(
    '/:teamId/players/:teamPlayerId',
    asyncHandler(async (req, res) =>
      res.json(
        await service.removePlayer(
          getAuth(req).user.id,
          String(req.params.teamId),
          String(req.params.teamPlayerId),
          String(res.locals.requestId),
        ),
      ),
    ),
  );

  router.get(
    '/:teamId/assistants',
    asyncHandler(async (req, res) =>
      res.json(await service.listAssistants(getAuth(req).user.id, String(req.params.teamId))),
    ),
  );

  router.post(
    '/:teamId/assistants',
    asyncHandler(async (req, res) =>
      res.json(
        await service.appointAssistant(
          getAuth(req).user.id,
          String(req.params.teamId),
          parseBody(teamAssistantDelegationSchema, req),
          String(res.locals.requestId),
        ),
      ),
    ),
  );

  router.delete(
    '/:teamId/assistants/:responsibilityId',
    asyncHandler(async (req, res) =>
      res.json(
        await service.revokeAssistant(
          getAuth(req).user.id,
          String(req.params.teamId),
          String(req.params.responsibilityId),
          String(res.locals.requestId),
        ),
      ),
    ),
  );

  router.post(
    '/:teamId/lineups',
    asyncHandler(async (req, res) =>
      res
        .status(201)
        .json(
          await service.createLineup(
            getAuth(req).user.id,
            String(req.params.teamId),
            parseBody(teamLineupCreateSchema, req),
          ),
        ),
    ),
  );

  return router;
}
