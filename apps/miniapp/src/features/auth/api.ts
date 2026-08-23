import { post } from '../../shared/api/http-client';

interface AuthUser {
  id: string;
  telegramUserId: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  languageCode: string | null;
  isPremium: boolean;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
  expiresAt: string;
}

export interface RegisterInput {
  username: string;
  password: string;
  displayName?: string;
  email?: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export const register = (input: RegisterInput) =>
  post<AuthResponse>('/api/v1/auth/register', input);
export const login = (input: LoginInput) => post<AuthResponse>('/api/v1/auth/login', input);
export const logout = () => post<void>('/api/v1/auth/logout');
