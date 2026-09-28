export interface GamerEligibilityRepository {
  hasGamerIdentity(userId: string): Promise<boolean>;
}
