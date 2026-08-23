import { Router, type Request } from 'express';
import { webLoginSchema, webRegisterSchema } from '@hooma/contracts';
import type { AuthService } from '../application/auth.service.js';
import { asyncHandler } from '../../../http/middleware/async-handler.js';
import { parseBody } from '../../../http/middleware/parse.js';
import { getAuth } from '../../../http/middleware/auth.js';

function sessionMetadata(req: Request) {
  const userAgent = req.header('user-agent');
  return {
    ...(req.ip ? { ipAddress: req.ip } : {}),
    ...(userAgent ? { userAgent } : {}),
  };
}

export function authRouter(service: AuthService) {
  const router = Router();

  router.post(
    '/register',
    asyncHandler(async (req, res) => {
      const result = await service.register(
        parseBody(webRegisterSchema, req),
        sessionMetadata(req),
      );
      if (result.status === 'username-taken') {
        return res.status(409).json({
          error: { code: 'USERNAME_TAKEN', message: 'That username is already in use.' },
        });
      }
      if (result.status === 'email-taken') {
        return res.status(409).json({
          error: { code: 'EMAIL_TAKEN', message: 'That email is already in use.' },
        });
      }
      return res
        .status(201)
        .json({ user: result.user, token: result.token, expiresAt: result.expiresAt });
    }),
  );

  router.post(
    '/login',
    asyncHandler(async (req, res) => {
      const result = await service.login(parseBody(webLoginSchema, req), sessionMetadata(req));
      if (result.status === 'invalid-credentials') {
        return res.status(401).json({
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' },
        });
      }
      return res.json({ user: result.user, token: result.token, expiresAt: result.expiresAt });
    }),
  );

  router.post(
    '/logout',
    asyncHandler(async (req, res) => {
      const { sessionToken } = getAuth(req);
      if (sessionToken) await service.logout(sessionToken);
      return res.status(204).end();
    }),
  );

  return router;
}
