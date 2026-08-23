import { randomBytes } from 'node:crypto';
import type { WebLoginInput, WebRegisterInput } from '@hooma/contracts';
import type { AuthRepository, AuthSessionMetadata } from './auth-repository.js';
import { hashPassword, verifyPassword } from './password-hasher.js';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class AuthService {
  constructor(private readonly repo: AuthRepository) {}

  async register(input: WebRegisterInput, metadata: AuthSessionMetadata) {
    const passwordHash = await hashPassword(input.password);
    const result = await this.repo.registerCredential({
      username: input.username,
      normalizedUsername: input.username.toLowerCase(),
      passwordHash,
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.email !== undefined ? { email: input.email.toLowerCase() } : {}),
    });
    if (result.status !== 'created') return result;
    const session = await this.createSession(result.user.id, metadata);
    return { status: 'created' as const, user: result.user, ...session };
  }

  async login(input: WebLoginInput, metadata: AuthSessionMetadata) {
    const credential = await this.repo.findCredentialByUsername(input.username.toLowerCase());
    if (!credential) return { status: 'invalid-credentials' as const };
    if (!(await verifyPassword(input.password, credential.passwordHash))) {
      return { status: 'invalid-credentials' as const };
    }
    const session = await this.createSession(credential.user.id, metadata);
    return { status: 'authenticated' as const, user: credential.user, ...session };
  }

  resolveSession(token: string) {
    return this.repo.resolveSession(token, new Date());
  }

  logout(token: string) {
    return this.repo.deleteSession(token);
  }

  private async createSession(userId: string, metadata: AuthSessionMetadata) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await this.repo.createSession(userId, token, expiresAt, metadata);
    return { token, expiresAt };
  }
}
