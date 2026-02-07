import type { KeyvStoreAdapter, StoredData } from 'keyv';
import { RedisProtocolError } from './errors';
import {
  RedisRespClient,
  type RedisConnectionOptions,
} from './redis-resp.client';

/**
 * Minimal Redis-backed Keyv store adapter.
 *
 * Implements the subset Keyv needs for Nest CacheModule to use Redis without external deps.
 * Values are stored as UTF-8 strings (Keyv serializes/deserializes values).
 */
export class RedisKeyvStore implements KeyvStoreAdapter {
  opts: RedisConnectionOptions;
  namespace?: string | undefined;
  private readonly client: RedisRespClient;

  constructor(options: RedisConnectionOptions) {
    this.opts = options;
    this.client = new RedisRespClient(options);
  }

  on(): this {
    return this;
  }

  async get<Value>(key: string): Promise<StoredData<Value> | undefined> {
    const reply = await this.client.command(['GET', key]);
    if (reply === null) {
      return undefined;
    }
    if (typeof reply !== 'string') {
      throw new RedisProtocolError('Unexpected GET reply type');
    }
    return reply as unknown as StoredData<Value>;
  }

  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    const args = ['SET', key, String(value)];
    if (typeof ttl === 'number' && ttl > 0) {
      args.push('PX', String(ttl));
    }
    const reply = await this.client.command(args);
    return reply === 'OK';
  }

  async delete(key: string): Promise<boolean> {
    const reply = await this.client.command(['DEL', key]);
    if (typeof reply !== 'number') {
      throw new RedisProtocolError('Unexpected DEL reply type');
    }
    return reply > 0;
  }

  async clear(): Promise<void> {
    await this.client.command(['FLUSHDB']);
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }
}
