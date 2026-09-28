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

export const gamerPublicPresentationSchema = z.object({
  username: z.string().min(1),
  displayName: z.string().min(1),
  photoUrl: z.string().url().nullable(),
});

export const gamerChallengerSchema = z.object({
  id: z.string().min(1),
  handle: z.string().min(1),
  presentation: gamerPublicPresentationSchema,
});

export const gamerDiscoveryItemSchema = z.object({
  id: z.string().min(1),
  handle: z.string().min(1),
  openToChallenge: z.boolean(),
  game: z.object({
    id: z.string().min(1),
    slug: z.string().min(1),
    name: z.string().min(1),
  }),
  presentation: gamerPublicPresentationSchema,
});

export const gamerDiscoveryListSchema = z.object({
  items: z.array(gamerDiscoveryItemSchema),
});

export const gamerChallengeStatusSchema = z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED']);

export const gamerChallengeCreateSchema = z.object({
  challengedProfileId: z.string().min(1),
});

export const gamerChallengeParticipantSchema = gamerChallengerSchema;

export const gamerChallengeSchema = z.object({
  id: z.string().min(1),
  gameId: z.string().min(1),
  status: gamerChallengeStatusSchema,
  createdAt: z.string().datetime(),
  respondedAt: z.string().datetime().nullable(),
  cancelledAt: z.string().datetime().nullable(),
  challenger: gamerChallengeParticipantSchema,
  challenged: gamerChallengeParticipantSchema,
});

export const gamerChallengeListSchema = z.object({
  items: z.array(gamerChallengeSchema),
});

export const gamerArenaQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
});

export const gamerArenaMatchSchema = z.object({
  id: z.string().min(1),
  status: z.literal('ACCEPTED'),
  game: z.object({
    id: z.string().min(1),
    slug: z.string().min(1),
    name: z.string().min(1),
  }),
  challenger: gamerChallengeParticipantSchema,
  challenged: gamerChallengeParticipantSchema,
});

export const gamerArenaMatchListSchema = z.object({
  items: z.array(gamerArenaMatchSchema),
  nextCursor: z.string().min(1).nullable(),
});

export const gamerMatchSessionStatusSchema = z.enum([
  'WAITING_FOR_CODE',
  'IN_PROGRESS',
  'PENDING_VERIFICATION',
  'VERIFIED',
  'DISPUTED',
  'VOIDED',
]);

export const gamerMatchSideSchema = z.enum(['CHALLENGER', 'CHALLENGED']);

export const gamerMatchResolutionSchema = z.enum([
  'MATCHED_SUBMISSIONS',
  'SINGLE_SUBMISSION_TIMEOUT',
  'PLATFORM_ADMIN',
  'PLATFORM_ADMIN_VOID',
]);

export const eaFcRoomCodeInputSchema = z.object({
  roomCode: z.string().regex(/^\d{6}$/, 'EA FC Quick Match code must be exactly 6 digits'),
});

export const gamerMatchResultHeadersSchema = z.object({
  yourScore: z.coerce.number().int().min(0).max(99),
  opponentScore: z.coerce.number().int().min(0).max(99),
});

export const gamerMatchSubmissionSchema = z.object({
  id: z.string().min(1),
  side: gamerMatchSideSchema,
  challengerScore: z.number().int().min(0),
  challengedScore: z.number().int().min(0),
  submittedAt: z.string().datetime(),
});

export const gamerMatchSessionSchema = z.object({
  id: z.string().min(1),
  challengeId: z.string().min(1),
  status: gamerMatchSessionStatusSchema,
  roomCode: z
    .string()
    .regex(/^\d{6}$/)
    .nullable(),
  submissionDeadline: z.string().datetime().nullable(),
  finalChallengerScore: z.number().int().min(0).nullable(),
  finalChallengedScore: z.number().int().min(0).nullable(),
  winnerSide: gamerMatchSideSchema.nullable(),
  resolution: gamerMatchResolutionSchema.nullable(),
  resolvedAt: z.string().datetime().nullable(),
  submissions: z.array(gamerMatchSubmissionSchema),
});

export const gamerDisputeSchema = gamerMatchSessionSchema.extend({
  game: z.object({
    id: z.string().min(1),
    slug: z.string().min(1),
    name: z.string().min(1),
  }),
  challenger: gamerChallengeParticipantSchema,
  challenged: gamerChallengeParticipantSchema,
});

export const gamerDisputeListSchema = z.object({
  items: z.array(gamerDisputeSchema),
});

export const gamerDisputeResolutionInputSchema = z.discriminatedUnion('decision', [
  z.object({
    decision: z.literal('SCORE'),
    challengerScore: z.number().int().min(0).max(99),
    challengedScore: z.number().int().min(0).max(99),
    moderatorNotes: z.string().trim().min(1).max(2000),
  }),
  z.object({
    decision: z.literal('VOID'),
    moderatorNotes: z.string().trim().min(1).max(2000),
  }),
]);

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
export type GamerPublicPresentation = z.infer<typeof gamerPublicPresentationSchema>;
export type GamerChallenger = z.infer<typeof gamerChallengerSchema>;
export type GamerDiscoveryItem = z.infer<typeof gamerDiscoveryItemSchema>;
export type GamerChallengeStatus = z.infer<typeof gamerChallengeStatusSchema>;
export type GamerChallengeCreateInput = z.infer<typeof gamerChallengeCreateSchema>;
export type GamerChallengeParticipant = z.infer<typeof gamerChallengeParticipantSchema>;
export type GamerChallenge = z.infer<typeof gamerChallengeSchema>;
export type GamerArenaQuery = z.infer<typeof gamerArenaQuerySchema>;
export type GamerArenaMatch = z.infer<typeof gamerArenaMatchSchema>;
export type GamerMatchSessionStatus = z.infer<typeof gamerMatchSessionStatusSchema>;
export type GamerMatchSide = z.infer<typeof gamerMatchSideSchema>;
export type GamerMatchResolution = z.infer<typeof gamerMatchResolutionSchema>;
export type EaFcRoomCodeInput = z.infer<typeof eaFcRoomCodeInputSchema>;
export type GamerMatchResultHeaders = z.infer<typeof gamerMatchResultHeadersSchema>;
export type GamerMatchSubmission = z.infer<typeof gamerMatchSubmissionSchema>;
export type GamerMatchSession = z.infer<typeof gamerMatchSessionSchema>;
export type GamerDispute = z.infer<typeof gamerDisputeSchema>;
export type GamerDisputeResolutionInput = z.infer<typeof gamerDisputeResolutionInputSchema>;
