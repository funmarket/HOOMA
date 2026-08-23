import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getWhistleUtcDayWindow,
  whistleUtcDayWindowIsCurrent,
} from '../apps/api/src/modules/whistle/domain/utc-day.js';

test('Whistle UTC day starts and resets exactly at midnight UTC', () => {
  const now = new Date('2026-08-23T21:56:00.000Z');
  const window = getWhistleUtcDayWindow(now);

  assert.equal(window.day, '2026-08-23');
  assert.equal(window.startsAt.toISOString(), '2026-08-23T00:00:00.000Z');
  assert.equal(window.resetsAt.toISOString(), '2026-08-24T00:00:00.000Z');
});

test('Whistle created just before midnight belongs only to the ending UTC day', () => {
  const beforeMidnight = new Date('2026-08-23T23:59:59.999Z');
  const window = getWhistleUtcDayWindow(beforeMidnight);

  assert.equal(window.day, '2026-08-23');
  assert.equal(window.resetsAt.toISOString(), '2026-08-24T00:00:00.000Z');
  assert.equal(whistleUtcDayWindowIsCurrent(window, beforeMidnight), true);
  assert.equal(whistleUtcDayWindowIsCurrent(window, window.resetsAt), false);
});

test('Whistle at midnight belongs to a fresh UTC day', () => {
  const midnight = new Date('2026-08-24T00:00:00.000Z');
  const window = getWhistleUtcDayWindow(midnight);

  assert.equal(window.day, '2026-08-24');
  assert.equal(window.startsAt.toISOString(), midnight.toISOString());
  assert.equal(window.resetsAt.toISOString(), '2026-08-25T00:00:00.000Z');
});

test('Whistle UTC day helper handles month and year rollover', () => {
  const window = getWhistleUtcDayWindow(new Date('2026-12-31T23:59:59.000Z'));

  assert.equal(window.day, '2026-12-31');
  assert.equal(window.resetsAt.toISOString(), '2027-01-01T00:00:00.000Z');
});
