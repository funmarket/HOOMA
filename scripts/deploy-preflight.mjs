import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

if (!fs.existsSync(path.join(root, 'package-lock.json'))) {
  fail('package-lock.json is missing. Run npm install in a networked environment and commit it.');
}

const railwayApiConfigPath = path.join(root, 'railway.api.json');
try {
  const railwayApiConfig = JSON.parse(fs.readFileSync(railwayApiConfigPath, 'utf8'));
  if (railwayApiConfig.deploy?.numReplicas !== 1) {
    fail(
      'railway.api.json must pin deploy.numReplicas to 1 while RATE_LIMIT_STORE=memory is the only supported store.',
    );
  }
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  fail(`railway.api.json could not be validated: ${detail}`);
}

const migrationRoot = path.join(root, 'packages/database/prisma/migrations');
const hasMigration =
  fs.existsSync(migrationRoot) &&
  fs
    .readdirSync(migrationRoot, { withFileTypes: true })
    .some(
      (entry) =>
        entry.isDirectory() && fs.existsSync(path.join(migrationRoot, entry.name, 'migration.sql')),
    );

if (!hasMigration) {
  fail(
    'No generated Prisma migration exists. Run npm run db:migrate -- --name init against PostgreSQL and commit it.',
  );
}

if (process.env.NODE_ENV === 'production') {
  if (!process.env.DATABASE_URL) fail('DATABASE_URL is required in production.');
  if (!process.env.DIRECT_DATABASE_URL) fail('DIRECT_DATABASE_URL is required in production.');
  if (!process.env.REDIS_URL) fail('REDIS_URL is required in production for Whistle.');
  if (!process.env.TELEGRAM_BOT_TOKEN) fail('TELEGRAM_BOT_TOKEN is required in production.');
  if (!process.env.TELEGRAM_WEBHOOK_SECRET)
    fail('TELEGRAM_WEBHOOK_SECRET is required in production.');
  if (!process.env.RATE_LIMIT_STORE) fail('RATE_LIMIT_STORE must be explicitly set in production.');
  if (process.env.RATE_LIMIT_STORE && process.env.RATE_LIMIT_STORE !== 'memory') {
    fail('Only RATE_LIMIT_STORE=memory is implemented in this release.');
  }
}

if (failures.length) {
  console.error(`Deployment preflight failed with ${failures.length} blocker(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Deployment preflight passed.');
