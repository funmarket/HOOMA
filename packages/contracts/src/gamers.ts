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

export const gamerGameStatusSchema = z.enum(gamerGameStatuses);
export const gamerGamePlatformSchema = z.enum(gamerGamePlatforms);

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

export type GamerGameStatus = z.infer<typeof gamerGameStatusSchema>;
export type GamerGamePlatform = z.infer<typeof gamerGamePlatformSchema>;
export type GamerGameCreateInput = z.infer<typeof gamerGameCreateSchema>;
export type GamerGameCreateRequest = z.input<typeof gamerGameCreateSchema>;
export type GamerGameUpdateInput = z.infer<typeof gamerGameUpdateSchema>;
export type GamerGameUpdateRequest = z.input<typeof gamerGameUpdateSchema>;
export type GamerGameListQuery = z.infer<typeof gamerGameListQuerySchema>;
