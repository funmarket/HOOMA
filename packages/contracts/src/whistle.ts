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

export type WhistleCreateInput = z.infer<typeof whistleCreateSchema>;
