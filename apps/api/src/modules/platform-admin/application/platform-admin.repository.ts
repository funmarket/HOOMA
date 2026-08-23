export type PlatformRole = 'PLATFORM_ADMIN';

export type PlatformAdminBootstrapResult = 'granted' | 'already-initialized';

export interface PlatformAdminRepository {
  getActiveRoles(userId: string): Promise<PlatformRole[]>;
  bootstrapFirstPlatformAdmin(userId: string): Promise<PlatformAdminBootstrapResult>;
}
