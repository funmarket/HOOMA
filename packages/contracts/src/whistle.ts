import { z } from 'zod';

export const WHISTLE_DAILY_LIMIT = 11;
export const WHISTLE_MAX_GRAPHEMES = 33;
export const WHISTLE_RESET_TIMEZONE = 'UTC' as const;

const graphemeSegmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

export function countWhistleGraphemes(value: string) {
  return Array.from(graphemeSegmenter.segment(value)).length;
}

export const whistleBodySchema = z
  .string()
  .trim()
  .min(1, 'Whistle message is required.')
  .superRefine((value, ctx) => {
    if (countWhistleGraphemes(value) > WHISTLE_MAX_GRAPHEMES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Whistle messages are limited to ${WHISTLE_MAX_GRAPHEMES} graphemes.`,
      });
    }
  });

export const whistleCreateSchema = z.object({
  body: whistleBodySchema,
});

export const whistleAuthorSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().min(1),
  photoUrl: z.string().url().nullable(),
});

export const whistleMessageSchema = z.object({
  id: z.string().min(1),
  body: whistleBodySchema,
  author: whistleAuthorSchema,
  createdAt: z.string().datetime(),
});

export const whistleQuotaSchema = z.object({
  used: z.number().int().min(0).max(WHISTLE_DAILY_LIMIT),
  remaining: z.number().int().min(0).max(WHISTLE_DAILY_LIMIT),
});

export const whistleFeedResponseSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dailyLimit: z.literal(WHISTLE_DAILY_LIMIT),
  remaining: z.number().int().min(0).max(WHISTLE_DAILY_LIMIT),
  resetAt: z.string().datetime(),
  items: z.array(whistleMessageSchema),
});

export const whistleSendResponseSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dailyLimit: z.literal(WHISTLE_DAILY_LIMIT),
  remaining: z.number().int().min(0).max(WHISTLE_DAILY_LIMIT),
  resetAt: z.string().datetime(),
  item: whistleMessageSchema,
});

export type WhistleCreateInput = z.infer<typeof whistleCreateSchema>;
export type WhistleAuthor = z.infer<typeof whistleAuthorSchema>;
export type WhistleMessageView = z.infer<typeof whistleMessageSchema>;
export type WhistleFeedResponse = z.infer<typeof whistleFeedResponseSchema>;
export type WhistleSendResponse = z.infer<typeof whistleSendResponseSchema>;
