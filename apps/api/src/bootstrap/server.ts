import { env } from '../config/env.js';
import { buildContainer } from './container.js';
import { buildApp } from './app.js';

const container = buildContainer();
const app = buildApp(container);
const server = app.listen(env.PORT, () => {
  console.log(`HOOMA API listening on :${env.PORT}`);

  if (env.APP_BASE_URL) {
    const telegramWebAppUrl = `${env.APP_BASE_URL.replace(/\/$/, '')}/telegram`;
    void container.telegram
      .setChatMenuButton(telegramWebAppUrl)
      .then(() => console.log(`Telegram Web App menu configured for ${telegramWebAppUrl}`))
      .catch((error) => {
        console.error('Telegram Web App menu configuration failed', error);
      });
  }
});

async function shutdown(signal: string) {
  console.log(`HOOMA API received ${signal}; shutting down.`);
  server.close(async () => {
    await Promise.allSettled([container.redis.close(), container.db.$disconnect()]);
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
