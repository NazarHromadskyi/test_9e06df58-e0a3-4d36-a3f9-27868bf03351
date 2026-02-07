import * as net from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { RedisCommandError, RedisProtocolError } from './errors';
import { encodeResp, parseResp, type RedisReply } from './resp';

export type RedisConnectionOptions = {
  host: string;
  port: number;
  password?: string;
  db?: number;
  connectTimeoutMs?: number;
  reconnect?: {
    retries: number;
    delayMs: number;
  };
};

export class RedisRespClient {
  private socket: net.Socket | null = null;
  private readonly pending: Array<{
    resolve: (value: RedisReply) => void;
    reject: (error: Error) => void;
  }> = [];
  private inbound: Buffer = Buffer.alloc(0);
  private connecting: Promise<void> | null = null;

  constructor(private readonly options: RedisConnectionOptions) {}

  async disconnect(): Promise<void> {
    const socket = this.socket;
    this.socket = null;
    this.inbound = Buffer.alloc(0);
    this.connecting = null;

    if (socket && !socket.destroyed) {
      socket.destroy();
    }
  }

  async command(args: string[]): Promise<RedisReply> {
    await this.ensureConnected();
    return this.send(args);
  }

  private async ensureConnected(): Promise<void> {
    if (this.socket && !this.socket.destroyed) {
      return;
    }

    if (this.connecting) {
      return this.connecting;
    }

    this.connecting = this.connectWithRetries().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  private async connectWithRetries(): Promise<void> {
    const { retries, delayMs } = this.options.reconnect ?? {
      retries: 10,
      delayMs: 500,
    };

    let lastError: unknown;
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        await this.connectOnce();
        return;
      } catch (error) {
        lastError = error;
        await delay(delayMs * attempt);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('Failed to connect to Redis');
  }

  private async connectOnce(): Promise<void> {
    await this.disconnect();

    const socket = new net.Socket();
    this.socket = socket;

    socket.setNoDelay(true);

    socket.on('data', (chunk: Buffer) => {
      this.inbound = Buffer.concat([this.inbound, chunk]);
      this.drainReplies();
    });

    socket.on('error', (err: Error) => {
      this.failAllPending(err);
      this.disconnect().catch(() => undefined);
    });

    socket.on('close', () => {
      this.failAllPending(new Error('Redis connection closed'));
      this.disconnect().catch(() => undefined);
    });

    const connectTimeoutMs = this.options.connectTimeoutMs ?? 5000;

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error(`Redis connect timeout after ${connectTimeoutMs}ms`));
      }, connectTimeoutMs);

      socket.connect(this.options.port, this.options.host, () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    if (this.options.password) {
      const reply = await this.send(['AUTH', this.options.password]);
      if (typeof reply !== 'string') {
        throw new RedisProtocolError('Unexpected AUTH reply');
      }
    }

    if (typeof this.options.db === 'number' && this.options.db > 0) {
      const reply = await this.send(['SELECT', String(this.options.db)]);
      if (typeof reply !== 'string') {
        throw new RedisProtocolError('Unexpected SELECT reply');
      }
    }

    await this.send(['PING']);
  }

  private send(args: string[]): Promise<RedisReply> {
    const socket = this.socket;
    if (!socket || socket.destroyed) {
      return Promise.reject(new Error('Redis socket is not connected'));
    }

    return new Promise<RedisReply>((resolve, reject) => {
      this.pending.push({ resolve, reject });
      socket.write(encodeResp(args));
    });
  }

  private drainReplies(): void {
    while (this.pending.length > 0) {
      const parsed = parseResp(this.inbound, 0);
      if (!parsed) {
        return;
      }

      this.inbound = this.inbound.subarray(parsed.next);
      const pending = this.pending.shift();
      if (!pending) {
        continue;
      }

      if (parsed.value instanceof RedisCommandError) {
        pending.reject(parsed.value);
      } else {
        pending.resolve(parsed.value);
      }
    }
  }

  private failAllPending(error: Error): void {
    while (this.pending.length > 0) {
      const pending = this.pending.shift();
      pending?.reject(error);
    }
  }
}
