import { AppError } from '../../../http/errors/app-error.js';
import type { PlatformAdminRepository, PlatformRole } from './platform-admin.repository.js';

export class PlatformAdminService {
  constructor(private readonly repo: PlatformAdminRepository) {}

  getActiveRoles(userId: string): Promise<PlatformRole[]> {
    return this.repo.getActiveRoles(userId);
  }

  async bootstrapConfiguredCreator(userId: string, normalizedAuthUsername: string): Promise<void> {
    await this.repo.bootstrapPlatformAdmin(userId, normalizedAuthUsername);
  }

  async isPlatformAdmin(userId: string): Promise<boolean> {
    const roles = await this.getActiveRoles(userId);
    return roles.includes('PLATFORM_ADMIN');
  }

  async requirePlatformAdmin(userId: string): Promise<void> {
    if (!(await this.isPlatformAdmin(userId))) {
      throw new AppError(403, 'PLATFORM_ADMIN_REQUIRED', 'Platform admin access required');
    }
  }
}
