import { AppError } from '../../../http/errors/app-error.js';
import { haversineMeters } from '../../../infrastructure/geo/distance.js';
import type { CommunityService } from '../../communities/application/community.service.js';
import type {
  CheckInInput,
  FanHubCreateInput,
  VenueDealCreateInput,
  WatchRepository,
} from './watch-repository.js';

export class WatchService {
  constructor(
    private readonly repo: WatchRepository,
    private readonly communities: CommunityService,
  ) {}

  listClubs(input: { countryCode?: string; query?: string; limit?: number }) {
    return this.repo.listClubs({
      ...(input.countryCode !== undefined ? { countryCode: input.countryCode } : {}),
      ...(input.query !== undefined ? { query: input.query } : {}),
      limit: Math.min(input.limit ?? 100, 100),
    });
  }

  async listHubs(userId: string, input: { communityId?: string; clubId?: string; limit?: number }) {
    if (input.communityId) await this.communities.requireMembership(userId, input.communityId);
    return this.repo.listHubs(userId, {
      ...(input.communityId !== undefined ? { communityId: input.communityId } : {}),
      ...(input.clubId !== undefined ? { clubId: input.clubId } : {}),
      limit: Math.min(input.limit ?? 50, 100),
    });
  }

  async createHub(userId: string, input: FanHubCreateInput) {
    if (input.communityId) await this.communities.requireManager(userId, input.communityId);
    return this.repo.createHub(userId, input);
  }

  async checkIn(userId: string, eventId: string, input: CheckInInput) {
    const event = await this.repo.getEventForCheckIn(eventId, userId);
    if (!event) throw new AppError(404, 'WATCH_EVENT_NOT_FOUND', 'Watch event not found.');

    const target = input.fanHubId ? await this.repo.getFanHub(input.fanHubId) : event;
    if (!target || target.latitude == null || target.longitude == null) {
      throw new AppError(
        409,
        'CHECKIN_LOCATION_UNAVAILABLE',
        'This event has no check-in location.',
      );
    }
    if (
      input.fanHubId &&
      'communityId' in target &&
      target.communityId !== null &&
      target.communityId !== event.communityId
    ) {
      throw new AppError(
        409,
        'FAN_HUB_COMMUNITY_MISMATCH',
        'The selected Fan Hub is not available to this event community.',
      );
    }

    const distance = haversineMeters(
      { latitude: input.latitude, longitude: input.longitude },
      { latitude: target.latitude, longitude: target.longitude },
    );
    if (distance > 250) {
      throw new AppError(
        409,
        'CHECKIN_TOO_FAR',
        'You must be within 250 meters of the venue to check in.',
      );
    }

    const checkIn = await this.repo.upsertCheckIn(userId, eventId, input);
    return {
      checkIn,
      distanceMeters: Math.round(distance),
      unlockedDeals: await this.repo.unlockedDeals(userId, eventId),
    };
  }

  async createDeal(userId: string, input: VenueDealCreateInput) {
    await this.communities.requireManager(userId, input.communityId);
    return this.repo.createDeal(userId, input);
  }

  listDeals(userId: string, eventId: string) {
    return this.repo.listDeals(userId, eventId);
  }
}
