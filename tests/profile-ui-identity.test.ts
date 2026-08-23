import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const profilePage = readFileSync('apps/miniapp/src/pages/ProfilePage.tsx', 'utf8');
const morePage = readFileSync('apps/miniapp/src/pages/MorePage.tsx', 'utf8');
const profileApi = readFileSync('apps/miniapp/src/features/profile/api.ts', 'utf8');
const profileTypes = readFileSync('apps/miniapp/src/features/profile/types.ts', 'utf8');
const identityRepository = readFileSync(
  'apps/api/src/modules/identity/infrastructure/prisma-identity.repository.ts',
  'utf8',
);
const profilePresentation = readFileSync(
  'apps/api/src/modules/identity/domain/profile-presentation.ts',
  'utf8',
);
const presentationSchema = readFileSync(
  'packages/database/prisma/profile-presentation.prisma',
  'utf8',
);

test('Profile UI exposes only self-selectable Player, Fan, and Gamer identities', () => {
  assert.match(profilePage, /value: 'PLAYER'/);
  assert.match(profilePage, /value: 'FAN'/);
  assert.match(profilePage, /value: 'GAMER'/);
  assert.doesNotMatch(profilePage, /value: 'ULTRAFAN'/);
  assert.doesNotMatch(profilePage, /value: 'GHOST_RIDER'/);
  assert.doesNotMatch(profilePage, /AUDIENCE_OPTIONS/);
  assert.doesNotMatch(profilePage, /profileAudience/);
});

test('Profile writes canonical selected identities instead of legacy audience', () => {
  assert.match(profilePage, /selectedIdentities,/);
  assert.match(profileApi, /profileUpdateSchema\.parse\(input\)/);
});

test('Player presentation and editing are conditional on Player identity', () => {
  assert.match(profilePage, /selectedIdentities\.includes\('PLAYER'\)/);
  assert.match(profilePage, /\{isPlayer \?/);
  assert.match(profilePage, /Player details/);
  assert.match(profilePage, /OVR/);
});

test('UltraFan and Ghost Rider remain effective identities, not user-selected identities', () => {
  assert.match(profileTypes, /\| 'ULTRAFAN'/);
  assert.match(profileTypes, /\| 'GHOST_RIDER'/);
  assert.match(profilePage, /current\.includes\('ULTRAFAN'\)/);
  assert.match(profilePage, /\['GHOST_RIDER'\]/);
  assert.match(profilePage, /cannot be selected manually/);
});

test('More exposes the multi-identity HOOMA profile instead of a player-only profile entry', () => {
  assert.match(morePage, /title="My HOOMA profile"/);
  assert.match(morePage, /Create or edit your HOOMA identity/);
  assert.doesNotMatch(morePage, /My player profile/);
  assert.match(morePage, /navigate\('\/profile'\)/);
});

test('Display Name and profile photo remain editable presentation fields', () => {
  assert.match(profilePage, /HOOMA display name/);
  assert.match(profilePage, /HOOMA profile photo URL/);
  assert.match(profilePage, /me\.presentation\?\.displayName/);
  assert.match(profilePage, /me\.presentation\?\.photoUrl/);
  assert.match(presentationSchema, /model UserProfilePresentation/);
  assert.match(identityRepository, /tx\.userProfilePresentation\.upsert/);
  assert.doesNotMatch(identityRepository, /data: \{ photoUrl \}/);
});

test('username is canonical account identity, never a Profile override', () => {
  assert.match(profilePage, /Username/);
  assert.match(profilePage, /me\.effectiveUsername \? `@\$\{me\.effectiveUsername\}` : 'Not set'/);
  assert.match(profilePage, /const visibleUsername = me\.effectiveUsername \?\? ''/);
  assert.doesNotMatch(profilePage, /HOOMA username/);
  assert.doesNotMatch(profilePage, /setUsername/);
  assert.doesNotMatch(profilePage, /username: username\.trim/);
  assert.match(identityRepository, /resolveUserPresentation\(/);
  assert.match(
    profilePresentation,
    /const effectiveUsername =[\s\S]*?nonBlank\(user\.displayAuthUsername\) \?\?[\s\S]*?nonBlank\(user\.authUsername\) \?\?[\s\S]*?nonBlank\(user\.username\)/,
  );
});

test('explicit presentation overrides stay separate from effective fallback values', () => {
  assert.match(profileTypes, /effectiveDisplayName: string/);
  assert.match(profileTypes, /effectiveUsername\?: string \| null/);
  assert.match(profileTypes, /effectivePhotoUrl\?: string \| null/);
  assert.match(profilePage, /useState\(me\.presentation\?\.displayName \|\| ''\)/);
  assert.match(profilePage, /useState\(me\.presentation\?\.photoUrl \|\| ''\)/);
  assert.match(profilePage, /displayName\.trim\(\) \|\| me\.effectiveDisplayName/);
  assert.match(profilePage, /photoUrl\.trim\(\) \|\| me\.effectivePhotoUrl \|\| ''/);
  assert.match(profilePage, /placeholder=\{me\.effectiveDisplayName\}/);
  assert.match(profilePage, /placeholder=\{me\.effectivePhotoUrl \|\|/);
});

test('Telegram username remains metadata without overwriting web credentials', () => {
  assert.match(profileTypes, /telegramUsername\?: string \| null/);
  assert.match(identityRepository, /telegramUsername,/);
  assert.match(profilePage, /Connected Telegram:/);
  assert.match(profilePage, /Telegram stays connected without overwriting web credentials/);
});

test('presentation username columns remain dormant rather than destructively removed', () => {
  assert.match(presentationSchema, /username\s+String\?/);
  assert.match(presentationSchema, /displayUsername\s+String\?/);
  assert.doesNotMatch(identityRepository, /displayUsername: presentation\.displayUsername/);
  assert.doesNotMatch(identityRepository, /username: username === null/);
});
