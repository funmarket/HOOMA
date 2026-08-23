import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  normalizeSelectedProfileIdentities,
  resolveEffectiveProfileIdentities,
} from '../apps/api/src/modules/identity/domain/profile-identities.ts';
import { resolveUserPresentation } from '../apps/api/src/modules/identity/domain/profile-presentation.ts';

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

test('shared presentation resolver preserves the canonical username, display name, and photo fallbacks', () => {
  assert.deepEqual(
    resolveUserPresentation(
      {
        username: 'telegram_name',
        authName: 'Web Name',
        authUsername: 'web_name',
        displayAuthUsername: 'Web_Name',
        firstName: 'Telegram',
        lastName: 'Member',
        photoUrl: 'https://example.com/provider.jpg',
      },
      {
        displayName: 'Passport Name',
        photoUrl: 'https://example.com/passport.jpg',
      },
    ),
    {
      effectiveDisplayName: 'Passport Name',
      effectiveUsername: 'Web_Name',
      effectivePhotoUrl: 'https://example.com/passport.jpg',
    },
  );
});

test('me and public profile reads share one presentation resolver', () => {
  const repository = readFileSync(
    'apps/api/src/modules/identity/infrastructure/prisma-identity.repository.ts',
    'utf8',
  );

  assert.match(repository, /import \{ resolveUserPresentation \}/);
  assert.match(repository, /function toMeView[\s\S]*?resolveUserPresentation\(/);
  assert.match(repository, /function toPublicProfileView[\s\S]*?resolveUserPresentation\(/);
});
