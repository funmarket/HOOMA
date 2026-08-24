import { WHISTLE_DAILY_LIMIT } from '@hooma/contracts';
import type { RedisRuntime } from '../../../infrastructure/redis/client.js';
import type {
  WhistleListResult,
  WhistleMessage,
  WhistleQuotaResult,
  WhistleScope,
  WhistleSendInput,
  WhistleSendResult,
  WhistleStore,
} from '../application/whistle-store.js';
import {
  WhistleStoreCorruptError,
  WhistleStoreUnavailableError,
} from '../application/whistle-store.js';
import type { WhistleUtcDayWindow } from '../domain/utc-day.js';

const SEND_SCRIPT = `
local now = redis.call('TIME')
local nowMs = tonumber(now[1]) * 1000 + math.floor(tonumber(now[2]) / 1000)
local startsAtMs = tonumber(ARGV[1])
local resetsAtMs = tonumber(ARGV[2])
local dailyLimit = tonumber(ARGV[3])

if nowMs < startsAtMs or nowMs >= resetsAtMs then
  return {'STALE'}
end

local quotaType = redis.call('TYPE', KEYS[1]).ok
if quotaType ~= 'none' and quotaType ~= 'string' then
  return {'CORRUPT', 'quota_type'}
end
local feedType = redis.call('TYPE', KEYS[2]).ok
if feedType ~= 'none' and feedType ~= 'stream' then
  return {'CORRUPT', 'feed_type'}
end

local usedRaw = redis.call('GET', KEYS[1])
local used = usedRaw and tonumber(usedRaw) or 0
if used == nil or used < 0 or used > dailyLimit then
  return {'CORRUPT', 'quota_value'}
end
if used >= dailyLimit then
  return {'LIMIT', tostring(used)}
end

local nextUsed = used + 1
local streamId = redis.call(
  'XADD', KEYS[2], '*',
  'body', ARGV[4],
  'authorUserId', ARGV[5],
  'authorDisplayName', ARGV[6],
  'authorPhotoUrl', ARGV[7]
)
redis.call('SET', KEYS[1], tostring(nextUsed))
redis.call('PEXPIREAT', KEYS[1], resetsAtMs)
redis.call('PEXPIREAT', KEYS[2], resetsAtMs)
return {'OK', streamId, tostring(nextUsed)}
`;

function quotaKey(window: WhistleUtcDayWindow, userId: string) {
  return `whistle:v1:quota:${window.day}:${userId}`;
}

function feedKey(window: WhistleUtcDayWindow, scope: WhistleScope) {
  return `whistle:v1:feed:${window.day}:${scope.kind}:${scope.id}`;
}

function createdAtFromStreamId(id: string) {
  const separator = id.indexOf('-');
  const milliseconds = separator === -1 ? Number.NaN : Number(id.slice(0, separator));
  if (!Number.isFinite(milliseconds)) {
    throw new WhistleStoreCorruptError('Whistle stream ID is invalid.');
  }
  return new Date(milliseconds).toISOString();
}

function quotaSnapshot(used: number) {
  return {
    used,
    remaining: Math.max(0, WHISTLE_DAILY_LIMIT - used),
  };
}

function parseUsed(value: string | null) {
  if (value === null) return 0;
  const used = Number(value);
  if (!Number.isInteger(used) || used < 0 || used > WHISTLE_DAILY_LIMIT) {
    throw new WhistleStoreCorruptError('Whistle quota value is invalid.');
  }
  return used;
}

function parseStreamMessage(id: string, message: Record<string, string>): WhistleMessage {
  const body = message.body;
  const userId = message.authorUserId;
  const displayName = message.authorDisplayName;
  const photoUrl = message.authorPhotoUrl;
  if (
    body === undefined ||
    userId === undefined ||
    displayName === undefined ||
    photoUrl === undefined
  ) {
    throw new WhistleStoreCorruptError('Whistle stream entry is incomplete.');
  }
  return {
    id,
    body,
    author: {
      userId,
      displayName,
      photoUrl: photoUrl.length ? photoUrl : null,
    },
    createdAt: createdAtFromStreamId(id),
  };
}

function redisTimeMilliseconds(value: readonly string[]) {
  const seconds = value[0];
  const microseconds = value[1];
  if (seconds === undefined || microseconds === undefined) {
    throw new WhistleStoreCorruptError('Redis TIME reply is incomplete.');
  }
  const milliseconds = Number(seconds) * 1000 + Math.floor(Number(microseconds) / 1000);
  if (!Number.isFinite(milliseconds)) {
    throw new WhistleStoreCorruptError('Redis TIME reply is invalid.');
  }
  return milliseconds;
}

async function ensureCurrentWindow(
  redis: Awaited<ReturnType<RedisRuntime['getClient']>>,
  window: WhistleUtcDayWindow,
) {
  const nowMs = redisTimeMilliseconds(await redis.time());
  return nowMs >= window.startsAt.getTime() && nowMs < window.resetsAt.getTime();
}

export class RedisWhistleStore implements WhistleStore {
  constructor(private readonly runtime: RedisRuntime) {}

  async send(input: WhistleSendInput): Promise<WhistleSendResult> {
    try {
      const redis = await this.runtime.getClient();
      const reply = await redis.eval(SEND_SCRIPT, {
        keys: [quotaKey(input.window, input.author.userId), feedKey(input.window, input.scope)],
        arguments: [
          String(input.window.startsAt.getTime()),
          String(input.window.resetsAt.getTime()),
          String(WHISTLE_DAILY_LIMIT),
          input.body,
          input.author.userId,
          input.author.displayName,
          input.author.photoUrl ?? '',
        ],
      });
      if (!Array.isArray(reply) || typeof reply[0] !== 'string') {
        throw new WhistleStoreCorruptError('Whistle send result is invalid.');
      }
      if (reply[0] === 'STALE') return { kind: 'stale_window' };
      if (reply[0] === 'CORRUPT') {
        throw new WhistleStoreCorruptError(`Whistle Redis key is invalid: ${String(reply[1])}`);
      }
      if (reply[0] === 'LIMIT') {
        const used = parseUsed(String(reply[1]));
        return { kind: 'limit_reached', quota: quotaSnapshot(used) };
      }
      if (reply[0] !== 'OK' || typeof reply[1] !== 'string') {
        throw new WhistleStoreCorruptError('Whistle send result is unknown.');
      }
      const used = parseUsed(String(reply[2]));
      return {
        kind: 'accepted',
        item: {
          id: reply[1],
          body: input.body,
          author: input.author,
          createdAt: createdAtFromStreamId(reply[1]),
        },
        quota: quotaSnapshot(used),
      };
    } catch (error) {
      if (error instanceof WhistleStoreCorruptError) throw error;
      throw new WhistleStoreUnavailableError('Whistle send could not reach Redis.', {
        cause: error,
      });
    }
  }

  async list(scope: WhistleScope, window: WhistleUtcDayWindow): Promise<WhistleListResult> {
    try {
      const redis = await this.runtime.getClient();
      if (!(await ensureCurrentWindow(redis, window))) return { kind: 'stale_window' };
      const type = await redis.type(feedKey(window, scope));
      if (type !== 'none' && type !== 'stream') {
        throw new WhistleStoreCorruptError('Whistle feed key has an invalid Redis type.');
      }
      if (type === 'none') return { kind: 'ok', items: [] };
      const entries = await redis.xRange(feedKey(window, scope), '-', '+');
      if (!(await ensureCurrentWindow(redis, window))) return { kind: 'stale_window' };
      return {
        kind: 'ok',
        items: entries.map((entry) => parseStreamMessage(entry.id, entry.message)),
      };
    } catch (error) {
      if (error instanceof WhistleStoreCorruptError) throw error;
      throw new WhistleStoreUnavailableError('Whistle feed could not reach Redis.', {
        cause: error,
      });
    }
  }

  async quota(userId: string, window: WhistleUtcDayWindow): Promise<WhistleQuotaResult> {
    try {
      const redis = await this.runtime.getClient();
      if (!(await ensureCurrentWindow(redis, window))) return { kind: 'stale_window' };
      const key = quotaKey(window, userId);
      const type = await redis.type(key);
      if (type !== 'none' && type !== 'string') {
        throw new WhistleStoreCorruptError('Whistle quota key has an invalid Redis type.');
      }
      const used = type === 'none' ? 0 : parseUsed(await redis.get(key));
      if (!(await ensureCurrentWindow(redis, window))) return { kind: 'stale_window' };
      return { kind: 'ok', quota: quotaSnapshot(used) };
    } catch (error) {
      if (error instanceof WhistleStoreCorruptError) throw error;
      throw new WhistleStoreUnavailableError('Whistle quota could not reach Redis.', {
        cause: error,
      });
    }
  }
}
