export interface TeamMemberReadRepository {
  listMine(userId: string): Promise<unknown>;
}
