import { Router } from 'express';
import {
  communityCreateSchema,
  communityInviteCreateSchema,
  communityInviteJoinSchema,
  communityJoinSchema,
  communityPaymentDefaultsSchema,
  membershipRoleSchema,
  ownershipTransferSchema,
} from '@hooma/contracts';
import type { CommunityService } from '../application/community.service.js';
import { asyncHandler } from '../../../http/middleware/async-handler.js';
import { parseBody } from '../../../http/middleware/parse.js';
import { getAuth } from '../../../http/middleware/auth.js';

export function communityRouter(service: CommunityService) {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => res.json(await service.list(getAuth(req).user.id))),
  );

  router.get(
    '/now',
    asyncHandler(async (req, res) => res.json(await service.now(getAuth(req).user.id))),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) =>
      res
        .status(201)
        .json(await service.create(getAuth(req).user.id, parseBody(communityCreateSchema, req))),
    ),
  );

  router.post(
    '/join',
    asyncHandler(async (req, res) => {
      const input = parseBody(communityJoinSchema, req);
      res.status(201).json(await service.join(getAuth(req).user.id, input.slug));
    }),
  );

  router.post(
    '/join/invite',
    asyncHandler(async (req, res) => {
      const input = parseBody(communityInviteJoinSchema, req);
      res.status(201).json(await service.joinWithInvite(getAuth(req).user.id, input.code));
    }),
  );

  router.post(
    '/:communityId/switch',
    asyncHandler(async (req, res) =>
      res.json(await service.switchActive(getAuth(req).user.id, String(req.params.communityId))),
    ),
  );

  router.get(
    '/:communityId',
    asyncHandler(async (req, res) =>
      res.json(await service.get(getAuth(req).user.id, String(req.params.communityId))),
    ),
  );

  router.get(
    '/:communityId/payment-defaults',
    asyncHandler(async (req, res) =>
      res.json(await service.paymentDefaults(getAuth(req).user.id, String(req.params.communityId))),
    ),
  );

  router.patch(
    '/:communityId/payment-defaults',
    asyncHandler(async (req, res) => {
      const input = parseBody(communityPaymentDefaultsSchema, req);
      res.json(
        await service.setCashDefault(
          getAuth(req).user.id,
          String(req.params.communityId),
          input.cashEnabled,
        ),
      );
    }),
  );

  router.post(
    '/:communityId/ownership/transfer',
    asyncHandler(async (req, res) => {
      const input = parseBody(ownershipTransferSchema, req);
      res.json(
        await service.transferOwnership(
          getAuth(req).user.id,
          String(req.params.communityId),
          input.membershipId,
          String(res.locals.requestId),
        ),
      );
    }),
  );

  router.get(
    '/:communityId/members',
    asyncHandler(async (req, res) =>
      res.json(await service.members(getAuth(req).user.id, String(req.params.communityId))),
    ),
  );

  router.patch(
    '/:communityId/members/:membershipId',
    asyncHandler(async (req, res) => {
      const input = parseBody(membershipRoleSchema, req);
      res.json(
        await service.setRole(
          getAuth(req).user.id,
          String(req.params.communityId),
          String(req.params.membershipId),
          input.role,
          String(res.locals.requestId),
        ),
      );
    }),
  );

  router.get(
    '/:communityId/invites',
    asyncHandler(async (req, res) =>
      res.json(await service.invites(getAuth(req).user.id, String(req.params.communityId))),
    ),
  );

  router.post(
    '/:communityId/invites',
    asyncHandler(async (req, res) => {
      const input = parseBody(communityInviteCreateSchema, req);
      res
        .status(201)
        .json(
          await service.createInvite(
            getAuth(req).user.id,
            String(req.params.communityId),
            input,
            String(res.locals.requestId),
          ),
        );
    }),
  );

  router.delete(
    '/:communityId/invites/:inviteId',
    asyncHandler(async (req, res) =>
      res.json(
        await service.revokeInvite(
          getAuth(req).user.id,
          String(req.params.communityId),
          String(req.params.inviteId),
          String(res.locals.requestId),
        ),
      ),
    ),
  );

  return router;
}
