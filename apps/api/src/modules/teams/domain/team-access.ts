export type LegacyTeamRole = 'OWNER' | 'ADMIN';
export type TeamResponsibilityRole = 'COACH' | 'MANAGER' | 'ASSISTANT';

export type TeamCapability =
  | 'CREATE_TEAM'
  | 'EDIT_TEAM'
  | 'MANAGE_ROSTER'
  | 'MANAGE_LINEUP'
  | 'CREATE_CHALLENGE'
  | 'RESPOND_CHALLENGE'
  | 'MESSAGE_CHALLENGE';

export type TeamDelegatedPermission = Exclude<TeamCapability, 'CREATE_TEAM'>;

export type TeamAuthority = {
  teamId: string;
  communityId: string;
  role: TeamResponsibilityRole;
  permissions: readonly TeamDelegatedPermission[];
  source: 'RESPONSIBILITY' | 'LEGACY';
};

const LEGACY_TEAM_CAPABILITIES: Record<LegacyTeamRole, ReadonlySet<TeamCapability>> = {
  OWNER: new Set<TeamCapability>([
    'CREATE_TEAM',
    'EDIT_TEAM',
    'MANAGE_ROSTER',
    'MANAGE_LINEUP',
    'CREATE_CHALLENGE',
    'RESPOND_CHALLENGE',
    'MESSAGE_CHALLENGE',
  ]),
  ADMIN: new Set<TeamCapability>([
    'CREATE_TEAM',
    'EDIT_TEAM',
    'MANAGE_ROSTER',
    'MANAGE_LINEUP',
    'CREATE_CHALLENGE',
    'RESPOND_CHALLENGE',
    'MESSAGE_CHALLENGE',
  ]),
};

const FULL_TEAM_MANAGEMENT_CAPABILITIES = new Set<TeamCapability>([
  'EDIT_TEAM',
  'MANAGE_ROSTER',
  'MANAGE_LINEUP',
  'CREATE_CHALLENGE',
  'RESPOND_CHALLENGE',
  'MESSAGE_CHALLENGE',
]);

export function legacyTeamRoleHasCapability(
  role: LegacyTeamRole,
  capability: TeamCapability,
): boolean {
  return LEGACY_TEAM_CAPABILITIES[role].has(capability);
}

export function legacyRoleToTeamResponsibility(role: LegacyTeamRole): TeamResponsibilityRole {
  return role === 'OWNER' ? 'COACH' : 'MANAGER';
}

export function teamAuthorityHasCapability(
  authority: TeamAuthority,
  capability: TeamCapability,
): boolean {
  if (capability === 'CREATE_TEAM') return false;
  if (authority.role === 'COACH' || authority.role === 'MANAGER') {
    return FULL_TEAM_MANAGEMENT_CAPABILITIES.has(capability);
  }
  return authority.permissions.includes(capability);
}
