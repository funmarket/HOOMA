import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Railway injects environment variables directly. For local development only,
// load the repository-root .env without introducing a runtime dotenv dependency.
try {
  loadEnvFile(fileURLToPath(new URL('../../../../.env', import.meta.url)));
} catch (error) {
  const code = (error as NodeJS.ErrnoException).code;
  if (code !== 'ENOENT') throw error;
}

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_BASE_URL: z.string().url().optional(),
  AUTH_BASE_URL: z.string().url().optional(),
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  DATABASE_URL: z.string().min(1),
  DIRECT_DATABASE_URL: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(8),
  PLATFORM_ADMIN_BOOTSTRAP_AUTH_USERNAME: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(/^[A-Za-z0-9_.]+$/)
    .transform((value) => value.toLowerCase())
    .optional(),
  INIT_DATA_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(86_400),
  DEV_AUTH_BYPASS: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  DEV_TELEGRAM_USER_ID: z.string().default('100000001'),
  RATE_LIMIT_STORE: z.enum(['memory']).default('memory'),
});

export const env = schema.parse(process.env);

if (env.NODE_ENV === 'production' && env.DEV_AUTH_BYPASS) {
  throw new Error('DEV_AUTH_BYPASS must be disabled in production');
}

if (env.NODE_ENV === 'production' && !process.env.RATE_LIMIT_STORE) {
  throw new Error('RATE_LIMIT_STORE must be set explicitly in production');
}
