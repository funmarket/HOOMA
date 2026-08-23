import { z } from 'zod';
import { cursorSchema } from './common.js';

export const gamerGameStatuses = ['ACTIVE', 'INACTIVE'] as const;
export const gamerGamePlatforms = [
  'EA',
  'PLAYSTATION',
  'XBOX',
  'NINTENDO',
  'PC',
  'MOBILE',
  'OTHER',
] as const;
export const gamerPlayStyles = ['CASUAL', 'COMPETITIVE', 'RANKED'] as const;
export const gamerVisibilities = ['PUBLIC', 'MATCHED_ONLY', 'PRIVATE'] as const;
export const gamerPlatformIdentityProviders = [
  'EA_ID',
  'PSN',
  'XBOX',
  'NINTENDO',
  'STEAM',
  'EPIC',
  'GAME_USERNAME',
  'OTHER',
] as const;
export const gamerSocialProviders = [
  'DISCORD',
  'KIK',
  'YOUTUBE',
  'TWITCH',
  'TIKTOK',
  'OTHER',
] as const;

export const gamerGameStatusSchema = z.enum(gamerGameStatuses);
export const gamerGamePlatformSchema = z.enum(gamerGamePlatforms);
export const gamerPlayStyleSchema = z.enum(gamerPlayStyles);
export const gamerVisibilitySchema = z.enum(gamerVisibilities);
export const gamerPlatformIdentityProviderSchema = z.enum(gamerPlatformIdentityProviders);
export const gamerSocialProviderSchema = z.enum(gamerSocialProviders);

const httpsUrlSchema = z
  .string()
  .trim()
  .url()
  .max(1000)
  .refine((value) => new URL(value).protocol === 'https:', 'Only HTTPS media URLs are allowed.');

const nullableHttpsUrlSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  httpsUrlSchema.nullable().optional(),
);

const nullableTrimmedString = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.string().trim().max(max).nullable().optional(),
  );

const baseGameFields = {
  name: z.string().trim().min(2).max(120),
  description: nullableTrimmedString(1200),
  logoUrl: nullableHttpsUrlSchema,
  coverUrl: nullableHttpsUrlSchema,
  publisher: nullableTrimmedString(120),
  platforms: z.array(gamerGamePlatformSchema).max(gamerGamePlatforms.length).default([]),
  status: gamerGameStatusSchema.default('ACTIVE'),
  featured: z.boolean().default(false),
};

export const gamerGameCreateSchema = z.object(baseGameFields);

export const gamerGameUpdateSchema = z
  .object({
    name: baseGameFields.name.optional(),
    description: nullableTrimmedString(1200),
    logoUrl: nullableHttpsUrlSchema,
    coverUrl: nullableHttpsUrlSchema,
    publisher: nullableTrimmedString(120),
    platforms: z.array(gamerGamePlatformSchema).max(gamerGamePlatforms.length).optional(),
    status: gamerGameStatusSchema.optional(),
    featured: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one Gamer game field is required.');

export const gamerGameListQuerySchema = cursorSchema.extend({
  q: z.string().trim().min(1).max(100).optional(),
  platform: gamerGamePlatformSchema.optional(),
  featured: z.coerce.boolean().optional(),
});

export const gamerPlatformIdentityInputSchema = z.object({
  provider: gamerPlatformIdentityProviderSchema,
  label: nullableTrimmedString(80),
  handle: z.string().trim().min(1).max(120),
  visibility: gamerVisibilitySchema.default('PUBLIC'),
});

export const gamerSocialLinkInputSchema = z.object({
  provider: gamerSocialProviderSchema,
  label: nullableTrimmedString(80),
  url: httpsUrlSchema,
  visibility: gamerVisibilitySchema.default('PUBLIC'),
});

const gamerCardFields = {
  gamerTag: z.string().trim().min(2).max(80),
  bio: nullableTrimmedString(280),
  playStyle: gamerPlayStyleSchema.default('CASUAL'),
  openToChallenge: z.boolean().default(true),
  region: nullableTrimmedString(80),
  language: nullableTrimmedString(40),
  preferredTimes: nullableTrimmedString(160),
  visibility: gamerVisibilitySchema.default('PUBLIC'),
  platformIdentities: z.array(gamerPlatformIdentityInputSchema).max(12).default([]),
  socialLinks: z.array(gamerSocialLinkInputSchema).max(12).default([]),
};

export const gamerCardCreateSchema = z.object({
  gameId: z.string().trim().min(1).max(120),
  ...gamerCardFields,
});

export const gamerCardUpdateSchema = z
  .object({
    gamerTag: gamerCardFields.gamerTag.optional(),
    bio: gamerCardFields.bio,
    playStyle: gamerPlayStyleSchema.optional(),
    openToChallenge: z.boolean().optional(),
    region: gamerCardFields.region,
    language: gamerCardFields.language,
    preferredTimes: gamerCardFields.preferredTimes,
    visibility: gamerVisibilitySchema.optional(),
    platformIdentities: z.array(gamerPlatformIdentityInputSchema).max(12).optional(),
    socialLinks: z.array(gamerSocialLinkInputSchema).max(12).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one Gamer Card field is required.');

export type GamerGameStatus = z.infer<typeof gamerGameStatusSchema>;
export type GamerGamePlatform = z.infer<typeof gamerGamePlatformSchema>;
export type GamerGameCreateInput = z.infer<typeof gamerGameCreateSchema>;
export type GamerGameCreateRequest = z.input<typeof gamerGameCreateSchema>;
export type GamerGameUpdateInput = z.infer<typeof gamerGameUpdateSchema>;
export type GamerGameUpdateRequest = z.input<typeof gamerGameUpdateSchema>;
export type GamerGameListQuery = z.infer<typeof gamerGameListQuerySchema>;
export type GamerPlayStyle = z.infer<typeof gamerPlayStyleSchema>;
export type GamerVisibility = z.infer<typeof gamerVisibilitySchema>;
export type GamerPlatformIdentityProvider = z.infer<typeof gamerPlatformIdentityProviderSchema>;
export type GamerSocialProvider = z.infer<typeof gamerSocialProviderSchema>;
export type GamerPlatformIdentityInput = z.infer<typeof gamerPlatformIdentityInputSchema>;
export type GamerSocialLinkInput = z.infer<typeof gamerSocialLinkInputSchema>;
export type GamerCardCreateInput = z.infer<typeof gamerCardCreateSchema>;
export type GamerCardCreateRequest = z.input<typeof gamerCardCreateSchema>;
export type GamerCardUpdateInput = z.infer<typeof gamerCardUpdateSchema>;
export type GamerCardUpdateRequest = z.input<typeof gamerCardUpdateSchema>;
