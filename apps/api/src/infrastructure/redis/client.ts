import { createClient } from 'redis';

type HoomaRedisClient = ReturnType<typeof createClient>;

export class RedisUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'RedisUnavailableError';
  }
}

export class RedisRuntime {
  private readonly client: HoomaRedisClient | null;
  private connectPromise: Promise<HoomaRedisClient> | null = null;

  constructor(url: string | undefined) {
    if (!url) {
      this.client = null;
      return;
    }

    const client = createClient({
      url,
      socket: {
        family: 0,
      },
    });
    client.on('error', (error) => {
      console.error('HOOMA Redis client error', error);
    });
    this.client = client;
  }

  async getClient(): Promise<HoomaRedisClient> {
    const client = this.client;
    if (!client) {
      throw new RedisUnavailableError('Redis is not configured for this HOOMA API instance.');
    }
    if (client.isReady) return client;

    if (!this.connectPromise) {
      this.connectPromise = client
        .connect()
        .then(() => client)
        .catch((error: unknown) => {
          throw new RedisUnavailableError('Redis is unavailable.', { cause: error });
        })
        .finally(() => {
          this.connectPromise = null;
        });
    }

    return this.connectPromise;
  }

  async close() {
    if (!this.client?.isOpen) return;
    await this.client.quit();
  }
}
