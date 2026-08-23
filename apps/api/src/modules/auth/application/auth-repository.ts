import type { IdentityUser } from '../../identity/domain/types.js';

export interface RegisterCredentialInput {
  username: string;
  normalizedUsername: string;
  passwordHash: string;
  displayName?: string;
  email?: string;
}

export interface AuthSessionMetadata {
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthRepository {
  registerCredential(
    input: RegisterCredentialInput,
  ): Promise<
    | { status: 'created'; user: IdentityUser }
    | { status: 'username-taken' }
    | { status: 'email-taken' }
  >;
  findCredentialByUsername(
    normalizedUsername: string,
  ): Promise<{ user: IdentityUser; passwordHash: string } | null>;
  createSession(
    userId: string,
    token: string,
    expiresAt: Date,
    metadata: AuthSessionMetadata,
  ): Promise<void>;
  resolveSession(token: string, now: Date): Promise<IdentityUser | null>;
  deleteSession(token: string): Promise<void>;
}
