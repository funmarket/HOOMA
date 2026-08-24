import type { CommunityService } from '../../communities/application/community.service.js';
import { AppError } from '../../../http/errors/app-error.js';
import { balanceTeams } from '../domain/team-balance.js';
import type { FormationSaveInput, PlayRepository } from './play-repository.js';
export class PlayService {
  constructor(
    private readonly repo: PlayRepository,
    private readonly communities: CommunityService,
  ) {}
  private async access(userId: string, eventId: string, write = false) {
    const access = await this.repo.getAccess(eventId);
    if (!access) throw new AppError(404, 'PLAY_EVENT_NOT_FOUND', 'Play event not found.');
    if (write && access.createdByUserId !== userId)
      await this.communities.requireManager(userId, access.communityId);
    else await this.communities.requireMembership(userId, access.communityId);
    return access;
  }
  async randomize(userId: string, eventId: string) {
    await this.access(userId, eventId);
    return { teams: balanceTeams(await this.repo.confirmedPlayers(eventId), 2) };
  }
  async listFormations(userId: string, eventId: string) {
    await this.access(userId, eventId);
    return this.repo.listFormations(eventId);
  }
  async createFormation(userId: string, eventId: string, input: FormationSaveInput) {
    await this.access(userId, eventId, true);
    return this.repo.createFormation(userId, eventId, input);
  }
  async updateFormation(
    userId: string,
    eventId: string,
    formationId: string,
    input: FormationSaveInput,
  ) {
    await this.access(userId, eventId, true);
    return this.repo.updateFormation(formationId, input);
  }
  async publishFormation(userId: string, eventId: string, formationId: string) {
    await this.access(userId, eventId, true);
    return this.repo.publishFormation(formationId);
  }
}
