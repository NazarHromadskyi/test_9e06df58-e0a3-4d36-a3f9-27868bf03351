import { RedisCommandError, RedisProtocolError } from './errors';

export type RedisReply = string | number | null | RedisReply[];

export function encodeResp(args: string[]): Buffer {
  const parts: Buffer[] = [];
  parts.push(Buffer.from(`*${args.length}\r\n`, 'utf8'));

  for (const arg of args) {
    const bytes = Buffer.from(arg, 'utf8');
    parts.push(Buffer.from(`$${bytes.length}\r\n`, 'utf8'));
    parts.push(bytes);
    parts.push(Buffer.from('\r\n', 'utf8'));
  }

  return Buffer.concat(parts);
}

function readLine(
  buf: Buffer,
  offset: number,
): { line: string; next: number } | null {
  const end = buf.indexOf('\r\n', offset, 'utf8');

  if (end === -1) {
    return null;
  }

  return { line: buf.toString('utf8', offset, end), next: end + 2 };
}

export function parseResp(
  buf: Buffer,
  offset: number,
): { value: RedisReply | RedisCommandError; next: number } | null {
  if (offset >= buf.length) {
    return null;
  }

  const type = String.fromCharCode(buf[offset]);
  const head = readLine(buf, offset + 1);

  if (!head) {
    return null;
  }

  switch (type) {
    case '+': {
      return { value: head.line, next: head.next };
    }

    case '-': {
      return { value: new RedisCommandError(head.line), next: head.next };
    }

    case ':': {
      const num = Number.parseInt(head.line, 10);

      if (!Number.isFinite(num)) {
        throw new RedisProtocolError(`Invalid integer reply: ${head.line}`);
      }

      return { value: num, next: head.next };
    }

    case '$': {
      const len = Number.parseInt(head.line, 10);

      if (!Number.isFinite(len)) {
        throw new RedisProtocolError(`Invalid bulk length: ${head.line}`);
      }

      if (len === -1) {
        return { value: null, next: head.next };
      }

      const start = head.next;
      const end = start + len;

      if (end + 2 > buf.length) {
        return null;
      }

      const tail = buf.toString('utf8', start, end);

      if (buf.toString('utf8', end, end + 2) !== '\r\n') {
        throw new RedisProtocolError('Invalid bulk string terminator');
      }

      return { value: tail, next: end + 2 };
    }

    case '*': {
      const count = Number.parseInt(head.line, 10);

      if (!Number.isFinite(count)) {
        throw new RedisProtocolError(`Invalid array length: ${head.line}`);
      }

      if (count === -1) {
        return { value: null, next: head.next };
      }

      let next = head.next;
      const items: RedisReply[] = [];
      for (let i = 0; i < count; i += 1) {
        const parsed = parseResp(buf, next);

        if (!parsed) {
          return null;
        }

        if (parsed.value instanceof RedisCommandError) {
          return { value: parsed.value, next: parsed.next };
        }

        items.push(parsed.value);
        next = parsed.next;
      }
      return { value: items, next };
    }

    default: {
      throw new RedisProtocolError(`Unknown RESP type byte: ${type}`);
    }
  }
}
