import { Router } from 'express';
import type { AppContainer } from '../../bootstrap/container.js';
import { authRouter } from '../../modules/auth/http/auth.controller.js';
import { identityRouter } from '../../modules/identity/http/identity.controller.js';
import { communityRouter } from '../../modules/communities/http/community.controller.js';
import { eventRouter } from '../../modules/events/http/event.controller.js';
import { paymentRouter } from '../../modules/payments/http/payment.controller.js';
import { requestRouter } from '../../modules/requests/http/request.controller.js';
import { rideRouter } from '../../modules/rides/http/ride.controller.js';
import { fundraiserRouter } from '../../modules/fundraising/http/fundraiser.controller.js';
import { watchRouter } from '../../modules/watch/http/watch.controller.js';
import { placeRouter } from '../../modules/places/http/place.controller.js';
import { pitchRouter } from '../../modules/pitch/http/pitch.controller.js';
import { playRouter } from '../../modules/play/http/play.controller.js';
import { chatRouter } from '../../modules/chat/http/chat.controller.js';
import { adminRouter } from '../../modules/admin/http/admin.controller.js';
import { platformAdminRouter } from '../../modules/platform-admin/http/platform-admin.controller.js';
import { teamRouter } from '../../modules/teams/http/team.controller.js';
import { rateLimit } from '../middleware/rate-limit.js';

export function v1Router(container: AppContainer) {
  const router = Router();
  router.use(
    '/auth',
    rateLimit(container.rateLimitStore, { scope: 'auth', windowMs: 60_000, max: 30 }),
    authRouter(container.services.auth),
  );
  router.use(identityRouter(container.services.identity));
  router.use('/communities', communityRouter(container.services.communities));
  router.use('/events', eventRouter(container.services.events));
  router.use(
    '/payments',
    rateLimit(container.rateLimitStore, { scope: 'payments', windowMs: 60_000, max: 30 }),
    paymentRouter(container.services.payments),
  );
  router.use('/requests', requestRouter(container.services.requests));
  router.use(
    '/rides',
    rateLimit(container.rateLimitStore, { scope: 'rides', windowMs: 60_000, max: 90 }),
    rideRouter(container.services.rides),
  );
  router.use('/fundraisers', fundraiserRouter(container.services.fundraising));
  router.use('/watch/places', placeRouter(container.services.places));
  router.use('/watch', watchRouter(container.services.watch));
  router.use('/places', placeRouter(container.services.places));
  router.use(
    '/pitch',
    rateLimit(container.rateLimitStore, { scope: 'pitch', windowMs: 60_000, max: 120 }),
    pitchRouter(container.services.pitch),
  );
  router.use('/play', playRouter(container.services.play));
  router.use(
    '/chat',
    rateLimit(container.rateLimitStore, { scope: 'chat', windowMs: 60_000, max: 60 }),
    chatRouter(container.services.chat),
  );
  router.use('/admin', adminRouter(container.services.admin));
  router.use('/app-admin', platformAdminRouter(container.services.platformAdmin));
  router.use(
    '/teams',
    rateLimit(container.rateLimitStore, { scope: 'teams', windowMs: 60_000, max: 120 }),
    teamRouter(container.services.teams),
  );
  return router;
}
