export type PlatformRole = 'PLATFORM_ADMIN';

export type PlatformAdminBootstrapResult =
  | 'granted'
  | 'already-assigned'
  | 'identity-mismatch';

export interface PlatformAdminRepository {
  getActiveRoles(userId: string): Promise<PlatformRole[]>;
  bootstrapPlatformAdmin(
    userId: string,
    normalizedAuthUsername: string,
  ): Promise<PlatformAdminBootstrapResult>;
}
