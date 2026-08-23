import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { webRegisterSchema } from '../packages/contracts/src/identity.js';

const schema = readFileSync('packages/database/prisma/schema.prisma', 'utf8');
const migration = readFileSync(
  'packages/database/prisma/migrations/20260820123500_make_telegram_user_id_optional/migration.sql',
  'utf8',
);
const identityTypes = readFileSync('apps/api/src/modules/identity/domain/types.ts', 'utf8');

test('canonical User does not require a Telegram identity', () => {
  assert.match(schema, /telegramUserId\s+String\?\s+@unique\s+@db\.VarChar\(32\)/);
  assert.match(migration, /ALTER TABLE "User" ALTER COLUMN "telegramUserId" DROP NOT NULL;/);
  assert.match(identityTypes, /telegramUserId: string \| null;/);
});

test('Telegram authentication still requires a real Telegram identifier', () => {
  assert.match(
    identityTypes,
    /export interface TelegramIdentityInput \{[\s\S]*?telegramUserId: string;/,
  );
});

test('classic web registration requires username/password but not Telegram or email', () => {
  const result = webRegisterSchema.parse({
    username: 'Hannibal10',
    password: 'a-secure-password',
    displayName: 'Hannibal',
  });

  assert.equal(result.username, 'Hannibal10');
  assert.equal(result.displayName, 'Hannibal');
  assert.equal(result.email, undefined);
  assert.equal('telegramUserId' in result, false);
});
