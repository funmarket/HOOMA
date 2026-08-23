import { timingSafeEqual } from 'node:crypto';
import { AppError } from '../../../http/errors/app-error.js';
import type { PlatformAdminRepository, PlatformRole } from './platform-admin.repository.js';

export class PlatformAdminService {
  constructor(private readonly repo: PlatformAdminRepository) {}

  getActiveRoles(userId: string): Promise<PlatformRole[]> {
    return this.repo.getActiveRoles(userId);
  }

  async bootstrapFirstPlatformAdmin(
    userId: string,
    suppliedToken: string,
    configuredToken: string,
  ): Promise<void> {
    const supplied = Buffer.from(suppliedToken);
    const configured = Buffer.from(configuredToken);
    if (supplied.length !== configured.length || !timingSafeEqual(supplied, configured)) {
      throw new AppError(403, 'PLATFORM_ADMIN_BOOTSTRAP_INVALID', 'Invalid bootstrap credentials');
    }

    const result = await this.repo.bootstrapFirstPlatformAdmin(userId);
    if (result !== 'granted') {
      throw new AppError(
        409,
        'PLATFORM_ADMIN_BOOTSTRAP_CLOSED',
        'Platform admin bootstrap has already been initialized',
      );
    }
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
