export class RedisProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RedisProtocolError';
  }
}

export class RedisCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RedisCommandError';
  }
}
