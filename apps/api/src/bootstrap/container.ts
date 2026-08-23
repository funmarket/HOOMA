import { buildDatabase } from '../infrastructure/database/prisma.js';
import { PrismaUnitOfWork } from '../infrastructure/database/unit-of-work.js';
import { InMemoryRateLimitStore } from '../infrastructure/rate-limit/rate-limit-store.js';
import { HttpTelegramBotApi } from '../infrastructure/telegram/bot-api.js';

import { PrismaIdentityRepository } from '../modules/identity/infrastructure/prisma-identity.repository.js';
import { IdentityService } from '../modules/identity/application/identity.service.js';
import { PrismaAuthRepository } from '../modules/auth/infrastructure/prisma-auth.repository.js';
import { AuthService } from '../modules/auth/application/auth.service.js';
import { PrismaCommunityRepository } from '../modules/communities/infrastructure/prisma-community.repository.js';
import { PrismaMembershipAccessRepository } from '../modules/communities/infrastructure/prisma-membership-access.repository.js';
import { CommunityService } from '../modules/communities/application/community.service.js';
import {
  PrismaEventRepository,
  PrismaRsvpRepository,
} from '../modules/events/infrastructure/prisma-event.repository.js';
import { EventService } from '../modules/events/application/event.service.js';
import { RsvpService } from '../modules/events/application/rsvp.service.js';
import { PrismaPaymentRepository } from '../modules/payments/infrastructure/prisma-payment.repository.js';
import { PaymentService } from '../modules/payments/application/payment.service.js';
import { PrismaRequestRepository } from '../modules/requests/infrastructure/prisma-request.repository.js';
import { RequestService } from '../modules/requests/application/request.service.js';
import { PrismaRideRepository } from '../modules/rides/infrastructure/prisma-ride.repository.js';
import { RideService } from '../modules/rides/application/ride.service.js';
import { PrismaFundraiserRepository } from '../modules/fundraising/infrastructure/prisma-fundraiser.repository.js';
import { FundraiserService } from '../modules/fundraising/application/fundraiser.service.js';
import { PrismaWatchRepository } from '../modules/watch/infrastructure/prisma-watch.repository.js';
import { WatchService } from '../modules/watch/application/watch.service.js';
import { PrismaPlaceRepository } from '../modules/places/infrastructure/prisma-place.repository.js';
import { PlaceService } from '../modules/places/application/place.service.js';
import { PrismaPitchRepository } from '../modules/pitch/infrastructure/prisma-pitch.repository.js';
import { PitchService } from '../modules/pitch/application/pitch.service.js';
import { PrismaPlayRepository } from '../modules/play/infrastructure/prisma-play.repository.js';
import { PlayService } from '../modules/play/application/play.service.js';
import { PrismaChatRepository } from '../modules/chat/infrastructure/prisma-chat.repository.js';
import { ChatService } from '../modules/chat/application/chat.service.js';
import { PrismaAdminReadRepository } from '../modules/admin/infrastructure/prisma-admin-read.repository.js';
import { AdminService } from '../modules/admin/application/admin.service.js';
import { PrismaPlatformAdminRepository } from '../modules/platform-admin/infrastructure/prisma-platform-admin.repository.js';
import { PlatformAdminService } from '../modules/platform-admin/application/platform-admin.service.js';
import { PrismaTeamRepository } from '../modules/teams/infrastructure/prisma-team.repository.js';
import { PrismaTeamAuthorityRepository } from '../modules/teams/infrastructure/prisma-team-authority.repository.js';
import { PrismaTeamMemberReadRepository } from '../modules/teams/infrastructure/prisma-team-member-read.repository.js';
import { PrismaTeamRosterRepository } from '../modules/teams/infrastructure/prisma-team-roster.repository.js';
import { TeamService } from '../modules/teams/application/team.service.js';

export function buildContainer() {
  const db = buildDatabase();
  const uow = new PrismaUnitOfWork(db);
  const rateLimitStore = new InMemoryRateLimitStore();
  const telegram = new HttpTelegramBotApi();

  const identityRepository = new PrismaIdentityRepository(db);
  const identity = new IdentityService(identityRepository);
  const authRepository = new PrismaAuthRepository(db);
  const auth = new AuthService(authRepository);

  const communityRepository = new PrismaCommunityRepository(db);
  const membershipAccessRepository = new PrismaMembershipAccessRepository(db);
  const communities = new CommunityService(communityRepository, membershipAccessRepository);

  const paymentRepository = new PrismaPaymentRepository(db);

  const eventRepository = new PrismaEventRepository(db);
  const rsvpRepository = new PrismaRsvpRepository();
  const rsvps = new RsvpService(rsvpRepository, paymentRepository, uow);
  const events = new EventService(eventRepository, rsvps, communities, paymentRepository, uow);

  const requestRepository = new PrismaRequestRepository(db);
  const requests = new RequestService(requestRepository, communities);

  const rideRepository = new PrismaRideRepository(db);
  const rides = new RideService(rideRepository, communities, paymentRepository, uow);

  const fundraiserRepository = new PrismaFundraiserRepository(db);
  const fundraising = new FundraiserService(
    fundraiserRepository,
    communities,
    paymentRepository,
    uow,
  );

  const payments = new PaymentService(
    paymentRepository,
    communities,
    telegram,
    uow,
    rsvpRepository,
    rideRepository,
    fundraiserRepository,
  );

  const watchRepository = new PrismaWatchRepository(db);
  const watch = new WatchService(watchRepository, communities);
  const placeRepository = new PrismaPlaceRepository(db);
  const places = new PlaceService(placeRepository, communities);
  const pitchRepository = new PrismaPitchRepository(db);
  const pitch = new PitchService(pitchRepository);

  const playRepository = new PrismaPlayRepository(db);
  const play = new PlayService(playRepository, communities);

  const chatRepository = new PrismaChatRepository(db);
  const chat = new ChatService(chatRepository, communities);

  const adminReadRepository = new PrismaAdminReadRepository(db);
  const admin = new AdminService(adminReadRepository, communities, events);

  const platformAdminRepository = new PrismaPlatformAdminRepository(db);
  const platformAdmin = new PlatformAdminService(platformAdminRepository);

  const teamRepository = new PrismaTeamRepository(db);
  const teamAuthorityRepository = new PrismaTeamAuthorityRepository(db);
  const teamMemberReadRepository = new PrismaTeamMemberReadRepository(db);
  const teamRosterRepository = new PrismaTeamRosterRepository(db);
  const teams = new TeamService(
    teamRepository,
    teamAuthorityRepository,
    teamRosterRepository,
    teamMemberReadRepository,
  );

  return {
    db,
    uow,
    rateLimitStore,
    telegram,
    repositories: {
      identity: identityRepository,
      auth: authRepository,
      communities: communityRepository,
      membershipAccess: membershipAccessRepository,
      events: eventRepository,
      rsvps: rsvpRepository,
      payments: paymentRepository,
      requests: requestRepository,
      rides: rideRepository,
      fundraising: fundraiserRepository,
      watch: watchRepository,
      places: placeRepository,
      pitch: pitchRepository,
      play: playRepository,
      chat: chatRepository,
      adminRead: adminReadRepository,
      platformAdmin: platformAdminRepository,
      teams: teamRepository,
      teamAuthority: teamAuthorityRepository,
      teamMemberRead: teamMemberReadRepository,
      teamRoster: teamRosterRepository,
    },
    services: {
      identity,
      auth,
      communities,
      events,
      rsvps,
      payments,
      requests,
      rides,
      fundraising,
      watch,
      places,
      pitch,
      play,
      chat,
      admin,
      platformAdmin,
      teams,
    },
  };
}

export type AppContainer = ReturnType<typeof buildContainer>;
