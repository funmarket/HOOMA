import { z } from 'zod';
import { cursorSchema, idSchema } from './common.js';

export const teamStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);
export const teamChallengeStatusSchema = z.enum([
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'CANCELLED',
  'EXPIRED',
]);
export const teamGameStatusSchema = z.enum(['SCHEDULING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']);
export const teamMatchFormatSchema = z.enum([
  'FIVE_V_FIVE',
  'SIX_V_SIX',
  'SEVEN_V_SEVEN',
  'EIGHT_V_EIGHT',
  'NINE_V_NINE',
  'ELEVEN_V_ELEVEN',
]);
export const teamFormationSchema = z.enum(['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '5-3-2']);
export const teamPlayerPositionSchema = z.enum([
  'GK',
  'CB',
  'FB',
  'WB',
  'DM',
  'CM',
  'AM',
  'W',
  'ST',
  'ANY',
]);
export const teamResponsibilityRoleSchema = z.enum(['COACH', 'MANAGER', 'ASSISTANT']);
export const teamDelegatedPermissionSchema = z.enum([
  'EDIT_TEAM',
  'MANAGE_ROSTER',
  'MANAGE_LINEUP',
  'CREATE_CHALLENGE',
  'RESPOND_CHALLENGE',
  'MESSAGE_CHALLENGE',
]);

export const teamListQuerySchema = cursorSchema.extend({
  search: z.string().trim().min(1).max(80).optional(),
  city: z.string().trim().min(1).max(100).optional(),
  houma: z.string().trim().min(1).max(100).optional(),
});

export const teamCreateSchema = z.object({
  communityId: idSchema,
  name: z.string().trim().min(2).max(120),
  city: z.string().trim().max(100).optional(),
  houma: z.string().trim().max(100).optional(),
  badgeUrl: z.string().trim().url().max(1000).optional(),
  isPublic: z.boolean().default(true),
  acceptingChallenges: z.boolean().default(true),
});

export const teamUpdateSchema = teamCreateSchema
  .omit({ communityId: true, badgeUrl: true })
  .partial()
  .extend({
    badgeUrl: z.union([z.string().trim().url().max(1000), z.literal('')]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one team field is required.');

export const teamPlayerCreateSchema = z.object({
  userId: idSchema.optional(),
  displayName: z.string().trim().min(1).max(120),
  shirtNumber: z.number().int().min(0).max(99).optional(),
  position: teamPlayerPositionSchema.optional(),
  photoUrl: z.string().trim().url().max(1000).optional(),
});

export const teamAssistantDelegationSchema = z
  .object({
    teamPlayerId: idSchema,
    permissions: z.array(teamDelegatedPermissionSchema).min(1).max(6),
  })
  .superRefine((value, ctx) => {
    if (new Set(value.permissions).size !== value.permissions.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['permissions'],
        message: 'Assistant permissions must be unique.',
      });
    }
  });

export const teamLineupSlotSchema = z.object({
  playerId: idSchema.nullable().optional(),
  role: teamPlayerPositionSchema,
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  isStarter: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(99).default(0),
});

export const teamLineupCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  formation: teamFormationSchema,
  matchFormat: teamMatchFormatSchema.default('ELEVEN_V_ELEVEN'),
  isCurrent: z.boolean().default(true),
  isPublished: z.boolean().default(false),
  slots: z.array(teamLineupSlotSchema).max(30).default([]),
});

export const teamChallengeCreateSchema = z.object({
  challengerTeamId: idSchema,
  challengedTeamId: idSchema,
  proposedStartsAt: z.coerce.date().optional(),
  proposedVenue: z.string().trim().max(160).optional(),
  proposedFormat: teamMatchFormatSchema.optional(),
  message: z.string().trim().max(500).optional(),
});

export const teamChallengeMessageCreateSchema = z.object({
  body: z.string().trim().min(1).max(500),
});

export type TeamCreateInput = z.infer<typeof teamCreateSchema>;
export type TeamUpdateInput = z.infer<typeof teamUpdateSchema>;
export type TeamPlayerCreateInput = z.infer<typeof teamPlayerCreateSchema>;
export type TeamAssistantDelegationInput = z.infer<typeof teamAssistantDelegationSchema>;
export type TeamLineupCreateInput = z.infer<typeof teamLineupCreateSchema>;
export type TeamChallengeCreateInput = z.infer<typeof teamChallengeCreateSchema>;
export type TeamChallengeMessageCreateInput = z.infer<typeof teamChallengeMessageCreateSchema>;
