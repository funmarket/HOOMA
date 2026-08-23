import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WHISTLE_DAILY_LIMIT,
  WHISTLE_MAX_GRAPHEMES,
  countWhistleGraphemes,
  whistleCreateSchema,
} from '../packages/contracts/src/whistle.js';

test('Whistle constants preserve the canonical daily and grapheme limits', () => {
  assert.equal(WHISTLE_DAILY_LIMIT, 11);
  assert.equal(WHISTLE_MAX_GRAPHEMES, 33);
});

test('Whistle counts extended emoji sequences as one grapheme', () => {
  assert.equal(countWhistleGraphemes('👨‍👩‍👧‍👦'), 1);
  assert.equal(countWhistleGraphemes('🇹🇳'), 1);
  assert.equal(countWhistleGraphemes('👍🏽'), 1);
});

test('Whistle accepts exactly 33 graphemes after trimming', () => {
  const body = '⚽'.repeat(33);
  const parsed = whistleCreateSchema.parse({ body: `  ${body}  ` });
  assert.equal(parsed.body, body);
  assert.equal(countWhistleGraphemes(parsed.body), 33);
});

test('Whistle rejects 34 graphemes', () => {
  assert.throws(() => whistleCreateSchema.parse({ body: 'a'.repeat(34) }));
});

test('Whistle rejects an empty or whitespace-only body', () => {
  assert.throws(() => whistleCreateSchema.parse({ body: '   ' }));
});
