import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  normalizeSelectedProfileIdentities,
  resolveEffectiveProfileIdentities,
} from '../apps/api/src/modules/identity/domain/profile-identities.ts';

test('selected identities have one stable canonical order', () => {
  assert.deepEqual(normalizeSelectedProfileIdentities(['GAMER', 'PLAYER', 'FAN']), [
    'PLAYER',
    'FAN',
    'GAMER',
  ]);
});

test('Ghost Rider is returned only when no specific identity is active', () => {
  assert.deepEqual(resolveEffectiveProfileIdentities([]), ['GHOST_RIDER']);
  assert.deepEqual(resolveEffectiveProfileIdentities(['FAN']), ['FAN']);
});

test('UltraFan is derived and keeps the canonical effective identity order', () => {
  assert.deepEqual(
    resolveEffectiveProfileIdentities(['GAMER', 'PLAYER', 'FAN'], {
      hasActiveUltrasMembership: true,
    }),
    ['PLAYER', 'FAN', 'ULTRAFAN', 'GAMER'],
  );
  assert.deepEqual(resolveEffectiveProfileIdentities([], { hasActiveUltrasMembership: true }), [
    'ULTRAFAN',
  ]);
});

test('me read and profile update responses use the same identity and presentation projector', () => {
  const repository = readFileSync(
    'apps/api/src/modules/identity/infrastructure/prisma-identity.repository.ts',
    'utf8',
  );

  assert.match(repository, /profileIdentities: \{ select: \{ type: true \} \}/);
  assert.match(repository, /const presentationSelect = \{/);
  assert.match(
    repository,
    /async getMe\(userId: string\)[\s\S]*?return toMeView\(user, presentation\);/,
  );
  assert.match(
    repository,
    /async updateProfile\(userId: string,[\s\S]*?select: meSelect,[\s\S]*?select: presentationSelect,[\s\S]*?return toMeView\(user, presentation\);/,
  );
});

test('me read model exposes one effective username while preserving Telegram metadata', () => {
  const repository = readFileSync(
    'apps/api/src/modules/identity/infrastructure/prisma-identity.repository.ts',
    'utf8',
  );

  assert.match(repository, /authUsername: true/);
  assert.match(repository, /displayAuthUsername: true/);
  assert.match(repository, /username: telegramUsername/);
  assert.match(
    repository,
    /const effectiveUsername =[\s\S]*?nonBlank\(displayAuthUsername\) \?\? nonBlank\(authUsername\) \?\? nonBlank\(telegramUsername\)/,
  );
  assert.match(repository, /effectiveUsername,/);
  assert.match(repository, /telegramUsername,/);
  assert.doesNotMatch(repository, /const username = displayAuthUsername/);
});

test('me read model centralizes effective display name and photo fallbacks', () => {
  const repository = readFileSync(
    'apps/api/src/modules/identity/infrastructure/prisma-identity.repository.ts',
    'utf8',
  );

  assert.match(repository, /authName: true/);
  assert.match(repository, /nonBlank\(presentation\?\.displayName\)/);
  assert.match(repository, /nonBlank\(authName\)/);
  assert.match(repository, /telegramDisplayName/);
  assert.match(repository, /effectiveUsername/);
  assert.match(repository, /'HOOMA member'/);
  assert.match(repository, /nonBlank\(presentation\?\.photoUrl\) \?\? nonBlank\(base\.photoUrl\)/);
  assert.match(repository, /effectiveDisplayName,/);
  assert.match(repository, /effectivePhotoUrl,/);
});
