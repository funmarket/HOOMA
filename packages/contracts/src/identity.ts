import { z } from 'zod';

export const profileIdentityTypeSchema = z.enum(['PLAYER', 'FAN', 'GAMER']);
export const effectiveProfileIdentityTypeSchema = z.enum([
  'PLAYER',
  'FAN',
  'ULTRAFAN',
  'GAMER',
  'GHOST_RIDER',
]);

export const selectedProfileIdentitiesSchema = z
  .array(profileIdentityTypeSchema)
  .max(3)
  .refine((values) => new Set(values).size === values.length, 'Profile identities must be unique.');

export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(2).max(120).nullable().optional(),
  photoUrl: z.string().trim().url().max(1000).nullable().optional(),
  skillLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'MIXED']).optional(),
  skillRating: z.number().int().min(1).max(100).optional(),
  preferredPositions: z
    .array(z.enum(['GK', 'CB', 'FB', 'WB', 'DM', 'CM', 'AM', 'W', 'ST', 'ANY']))
    .max(5)
    .optional(),
  favoriteClubId: z.string().nullable().optional(),
  profileAudience: z.enum(['SPECTATOR', 'FAN']).optional(),
  selectedIdentities: selectedProfileIdentitiesSchema.optional(),
  bio: z.string().trim().max(280).nullable().optional(),
  themeOverride: z
    .enum(['TELEGRAM', 'LIGHT', 'DARK', 'MATCHDAY_NEON', 'FUTURE_PITCH'])
    .optional(),
});

const classicUsernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(30)
  .regex(/^[A-Za-z0-9_.]+$/, 'Username may only contain letters, numbers, underscores, and dots.');

const classicPasswordSchema = z.string().min(8).max(128);

export const webRegisterSchema = z.object({
  username: classicUsernameSchema,
  password: classicPasswordSchema,
  displayName: z.string().trim().min(2).max(120).optional(),
  email: z
    .string()
    .trim()
    .email()
    .max(320)
    .transform((value) => value.toLowerCase())
    .optional(),
});

export const webLoginSchema = z.object({
  username: classicUsernameSchema,
  password: classicPasswordSchema,
});

export const telegramLinkSchema = z.object({
  initData: z.string().trim().min(1).max(8192),
});

export const webCredentialsLinkSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(320)
    .transform((value) => value.toLowerCase()),
  username: classicUsernameSchema,
  password: classicPasswordSchema,
});

export type ProfileIdentityType = z.infer<typeof profileIdentityTypeSchema>;
export type EffectiveProfileIdentityType = z.infer<typeof effectiveProfileIdentityTypeSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type WebRegisterInput = z.infer<typeof webRegisterSchema>;
export type WebLoginInput = z.infer<typeof webLoginSchema>;
export type TelegramLinkInput = z.infer<typeof telegramLinkSchema>;
export type WebCredentialsLinkInput = z.infer<typeof webCredentialsLinkSchema>;
