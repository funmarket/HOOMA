import type { ProfileUpdateInput } from '@hooma/contracts';
import { AppError } from '../../../http/errors/app-error.js';
import type { TelegramIdentityInput } from '../domain/types.js';
import type { IdentityRepository } from './identity-repository.js';

export class IdentityService {
  constructor(private readonly repo: IdentityRepository) {}
  upsertTelegramUser(input: TelegramIdentityInput) {
    return this.repo.upsertTelegramUser(input);
  }
  getMe(userId: string) {
    return this.repo.getMe(userId);
  }
  async getPublicProfile(userId: string) {
    const profile = await this.repo.getPublicProfile(userId);
    if (!profile) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Player profile not found.');
    return profile;
  }
  updateProfile(userId: string, input: ProfileUpdateInput) {
    return this.repo.updateProfile(userId, input);
  }
}
