import { createClient, type RedisClientType } from 'redis';

export class RedisUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'RedisUnavailableError';
  }
}

export class RedisRuntime {
  private readonly client: RedisClientType | null;
  private connectPromise: Promise<RedisClientType> | null = null;

  constructor(url: string | undefined) {
    if (!url) {
      this.client = null;
      return;
    }

    const client = createClient({ url });
    client.on('error', (error) => {
      console.error('HOOMA Redis client error', error);
    });
    this.client = client;
  }

  async getClient(): Promise<RedisClientType> {
    if (!this.client) {
      throw new RedisUnavailableError('Redis is not configured for this HOOMA API instance.');
    }
    if (this.client.isReady) return this.client;

    if (!this.connectPromise) {
      this.connectPromise = this.client
        .connect()
        .then(() => this.client as RedisClientType)
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
