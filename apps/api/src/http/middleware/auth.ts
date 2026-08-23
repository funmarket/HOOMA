import { deepSnakeToCamelObjKeys, parse, validate } from '@tma.js/init-data-node';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env.js';
import { AppError } from '../errors/app-error.js';
import type { AuthService } from '../../modules/auth/application/auth.service.js';
import type { IdentityService } from '../../modules/identity/application/identity.service.js';
import type { IdentityUser, TelegramIdentityInput } from '../../modules/identity/domain/types.js';

export interface AuthContext {
  user: IdentityUser;
  sessionToken?: string;
  rawInitData?: string;
  telegramUser?: {
    id: string;
    username?: string;
    firstName?: string;
    lastName?: string;
  };
}

export interface AuthenticatedRequest extends Request {
  auth: AuthContext;
}

export interface TelegramAuthOptions {
  optional?: boolean;
}

export function getAuth(req: Request): AuthContext {
  const auth = (req as Request & { auth?: AuthContext }).auth;
  if (!auth) {
    throw new AppError(401, 'AUTH_REQUIRED', 'Authentication required');
  }
  return auth;
}

interface TelegramIdentityFields {
  username?: string | undefined;
  firstName?: string | undefined;
  lastName?: string | undefined;
  photoUrl?: string | undefined;
  languageCode?: string | undefined;
  isPremium?: boolean | undefined;
}

function telegramIdentityInput(
  telegramUserId: string,
  user: TelegramIdentityFields,
): TelegramIdentityInput {
  return {
    telegramUserId,
    ...(user.username !== undefined ? { username: user.username } : {}),
    ...(user.firstName !== undefined ? { firstName: user.firstName } : {}),
    ...(user.lastName !== undefined ? { lastName: user.lastName } : {}),
    ...(user.photoUrl !== undefined ? { photoUrl: user.photoUrl } : {}),
    ...(user.languageCode !== undefined ? { languageCode: user.languageCode } : {}),
    ...(user.isPremium !== undefined ? { isPremium: user.isPremium } : {}),
  };
}

function telegramUserContext(
  telegramUserId: string,
  user: Pick<TelegramIdentityFields, 'username' | 'firstName' | 'lastName'>,
): NonNullable<AuthContext['telegramUser']> {
  return {
    id: telegramUserId,
    ...(user.username !== undefined ? { username: user.username } : {}),
    ...(user.firstName !== undefined ? { firstName: user.firstName } : {}),
    ...(user.lastName !== undefined ? { lastName: user.lastName } : {}),
  };
}

function authError(res: Response, code: 'AUTH_REQUIRED' | 'AUTH_INVALID', message: string) {
  return res.status(401).json({
    error: {
      code,
      message,
      requestId: String(res.locals.requestId || 'unknown'),
    },
  });
}

export function sessionAuth(auth: AuthService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const existing = (req as Request & { auth?: AuthContext }).auth;
    if (existing) return next();

    const authorization = req.header('authorization') || '';
    if (!authorization) return next();
    const [scheme = '', token = ''] = authorization.split(' ', 2);
    if (scheme.toLowerCase() !== 'bearer') return next();
    if (!token) return authError(res, 'AUTH_INVALID', 'Invalid authentication credentials');

    try {
      const user = await auth.resolveSession(token);
      if (!user) return authError(res, 'AUTH_INVALID', 'Invalid or expired session');
      (req as AuthenticatedRequest).auth = { user, sessionToken: token };
      return next();
    } catch {
      return authError(res, 'AUTH_INVALID', 'Invalid or expired session');
    }
  };
}

export function telegramAuth(identity: IdentityService, options: TelegramAuthOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const existing = (req as Request & { auth?: AuthContext }).auth;
    if (existing) return next();

    try {
      if (env.NODE_ENV !== 'production' && env.DEV_AUTH_BYPASS) {
        const telegramUserId = String(
          req.header('x-dev-telegram-user-id') || env.DEV_TELEGRAM_USER_ID,
        );
        const user = await identity.upsertTelegramUser({
          telegramUserId,
          username: `dev_${telegramUserId}`,
          firstName: 'Dev',
          lastName: 'HOOMA',
        });
        (req as AuthenticatedRequest).auth = {
          user,
          telegramUser: { id: telegramUserId, firstName: 'Dev', lastName: 'HOOMA' },
        };
        return next();
      }

      const authorization = req.header('authorization') || '';
      if (!authorization) {
        if (options.optional) return next();
        return authError(res, 'AUTH_REQUIRED', 'Missing Telegram initData');
      }

      const [scheme = '', rawInitData = ''] = authorization.split(' ', 2);
      if (scheme.toLowerCase() !== 'tma' || !rawInitData) {
        return authError(res, 'AUTH_INVALID', 'Invalid authentication credentials');
      }

      validate(rawInitData, env.TELEGRAM_BOT_TOKEN, {
        expiresIn: env.INIT_DATA_MAX_AGE_SECONDS,
      });
      const initData = deepSnakeToCamelObjKeys(parse(rawInitData));
      const tgUser = initData.user;
      if (!tgUser) {
        return authError(res, 'AUTH_INVALID', 'Telegram user missing from initData');
      }

      const telegramUserId = String(tgUser.id);
      const user = await identity.upsertTelegramUser(telegramIdentityInput(telegramUserId, tgUser));
      (req as AuthenticatedRequest).auth = {
        user,
        rawInitData,
        telegramUser: telegramUserContext(telegramUserId, tgUser),
      };
      return next();
    } catch {
      return authError(res, 'AUTH_INVALID', 'Invalid or expired Telegram initData');
    }
  };
}
