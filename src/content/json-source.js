const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const DIAGNOSTIC_CONTROLS = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/gu;
const LIMIT_KEYS = new Set([
  'maxBytes',
  'maxDepth',
  'maxStringBytes',
  'maxObjectMembers',
  'maxArrayItems',
]);

export const DEFAULT_AUTHORED_JSON_LIMITS = Object.freeze({
  maxBytes: 1024 * 1024,
  maxDepth: 64,
  maxStringBytes: 64 * 1024,
  maxObjectMembers: 100_000,
  maxArrayItems: 100_000,
});

export class AuthoredJsonError extends SyntaxError {
  constructor(code, message) {
    super(`malformed authored JSON: ${message}`);
    this.name = 'AuthoredJsonError';
    this.code = code;
  }
}

function normalizedLimits(overrides) {
  if (overrides === undefined) return DEFAULT_AUTHORED_JSON_LIMITS;
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    throw new TypeError('authored JSON limits must be an object');
  }
  for (const key of Object.keys(overrides)) {
    if (!LIMIT_KEYS.has(key)) throw new TypeError(`unknown authored JSON limit ${key}`);
  }
  const limits = { ...DEFAULT_AUTHORED_JSON_LIMITS, ...overrides };
  for (const [key, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new TypeError(`authored JSON limit ${key} must be a non-negative safe integer`);
    }
  }
  return limits;
}

function sourceBytes(input, maximumBytes) {
  if (typeof input === 'string') {
    let byteLength = 0;
    const enforceByteLimit = () => {
      if (byteLength > maximumBytes) {
        throw new AuthoredJsonError(
          'json_byte_limit',
          `byte limit ${maximumBytes} exceeded after scanning ${byteLength} UTF-8 bytes`,
        );
      }
    };
    for (let index = 0; index < input.length; index += 1) {
      const code = input.charCodeAt(index);
      if (code >= 0xd800 && code <= 0xdbff) {
        const next = input.charCodeAt(index + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          index += 1;
          byteLength += 4;
          enforceByteLimit();
          continue;
        }
        throw new AuthoredJsonError('json_utf16', 'string source contains unpaired UTF-16');
      }
      if (code >= 0xdc00 && code <= 0xdfff) {
        throw new AuthoredJsonError('json_utf16', 'string source contains unpaired UTF-16');
      }
      if (code <= 0x7f) byteLength += 1;
      else if (code <= 0x7ff) byteLength += 2;
      else byteLength += 3;
      enforceByteLimit();
    }
    return Buffer.from(input, 'utf8');
  }
  if (input instanceof Uint8Array) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  throw new TypeError('authored JSON source must be a string or Uint8Array');
}

function memberLabel(value) {
  const label = JSON.stringify(value).replace(DIAGNOSTIC_CONTROLS, (character) => (
    `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
  ));
  return label.length <= 256 ? label : `${label.slice(0, 253)}...`;
}

class AuthoredJsonParser {
  constructor(source, limits) {
    this.source = source;
    this.limits = limits;
    this.index = 0;
    this.stack = [];
    this.root = undefined;
    this.hasRoot = false;
  }

  fail(code, message) {
    throw new AuthoredJsonError(code, `${message} at source offset ${this.index}`);
  }

  skipWhitespace() {
    while (this.index < this.source.length) {
      const code = this.source.charCodeAt(this.index);
      if (code !== 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) return;
      this.index += 1;
    }
  }

  readString() {
    const start = this.index;
    this.index += 1;
    let escaped = false;
    while (this.index < this.source.length) {
      const code = this.source.charCodeAt(this.index);
      const character = this.source[this.index];
      this.index += 1;
      if (!escaped && character === '"') {
        let decoded;
        try {
          decoded = JSON.parse(this.source.slice(start, this.index));
        } catch {
          this.fail('json_string', 'invalid string');
        }
        const byteLength = Buffer.byteLength(decoded, 'utf8');
        if (byteLength > this.limits.maxStringBytes) {
          this.fail(
            'json_string_limit',
            `string byte limit ${this.limits.maxStringBytes} exceeded`,
          );
        }
        return decoded;
      }
      if (!escaped && code < 0x20) this.fail('json_string', 'invalid control character');
      if (!escaped && character === '\\') escaped = true;
      else escaped = false;
    }
    this.fail('json_string', 'unterminated string');
  }

  readNumber() {
    const match = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+\-]?[0-9]+)?/.exec(
      this.source.slice(this.index),
    );
    if (!match) this.fail('json_value', 'expected a JSON value');
    this.index += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value)) this.fail('json_number', 'number is outside the finite range');
    return value;
  }

  attach(value) {
    const parent = this.stack.at(-1);
    if (!parent) {
      if (this.hasRoot) this.fail('json_trailing', 'trailing content');
      this.root = value;
      this.hasRoot = true;
      return;
    }
    if (parent.type === 'array') {
      parent.items.push(value);
      parent.state = 'commaOrEnd';
      return;
    }
    parent.entries.push([parent.pendingKey, value]);
    parent.pendingKey = null;
    parent.state = 'commaOrEnd';
  }

  startValue() {
    this.skipWhitespace();
    const character = this.source[this.index];
    if (character === '{' || character === '[') {
      const depth = this.stack.length + 1;
      if (depth > this.limits.maxDepth) {
        this.fail('json_depth_limit', `depth limit ${this.limits.maxDepth} exceeded`);
      }
      this.index += 1;
      this.stack.push(character === '{'
        ? {
          type: 'object', state: 'firstKeyOrEnd', entries: [], seen: new Set(), pendingKey: null,
        }
        : { type: 'array', state: 'firstValueOrEnd', items: [] });
      return;
    }
    if (character === '"') {
      this.attach(this.readString());
      return;
    }
    for (const [literal, value] of [['true', true], ['false', false], ['null', null]]) {
      if (this.source.startsWith(literal, this.index)) {
        this.index += literal.length;
        this.attach(value);
        return;
      }
    }
    this.attach(this.readNumber());
  }

  readObjectKey(frame) {
    this.skipWhitespace();
    if (this.source[this.index] !== '"') this.fail('json_object_key', 'expected an object key');
    if (frame.entries.length >= this.limits.maxObjectMembers) {
      this.fail(
        'json_object_limit',
        `object member limit ${this.limits.maxObjectMembers} exceeded`,
      );
    }
    const key = this.readString();
    if (DANGEROUS_KEYS.has(key)) {
      this.fail('json_dangerous_key', `dangerous object member ${memberLabel(key)}`);
    }
    if (frame.seen.has(key)) {
      this.fail('json_duplicate_key', `duplicate object member ${memberLabel(key)}`);
    }
    frame.seen.add(key);
    frame.pendingKey = key;
    frame.state = 'colon';
  }

  closeObject(frame) {
    this.stack.pop();
    const value = {};
    for (const [key, member] of frame.entries) value[key] = member;
    this.attach(value);
  }

  closeArray(frame) {
    this.stack.pop();
    this.attach(frame.items);
  }

  stepObject(frame) {
    if (frame.state === 'firstKeyOrEnd') {
      this.skipWhitespace();
      if (this.source[this.index] === '}') {
        this.index += 1;
        this.closeObject(frame);
      } else {
        this.readObjectKey(frame);
      }
      return;
    }
    if (frame.state === 'key') {
      this.readObjectKey(frame);
      return;
    }
    if (frame.state === 'colon') {
      this.skipWhitespace();
      if (this.source[this.index] !== ':') this.fail('json_object_colon', 'expected a colon');
      this.index += 1;
      frame.state = 'value';
      return;
    }
    if (frame.state === 'value') {
      this.startValue();
      return;
    }
    this.skipWhitespace();
    const delimiter = this.source[this.index];
    if (delimiter === '}') {
      this.index += 1;
      this.closeObject(frame);
      return;
    }
    if (delimiter !== ',') this.fail('json_object_delimiter', 'expected a comma or closing brace');
    this.index += 1;
    frame.state = 'key';
  }

  stepArray(frame) {
    if (frame.state === 'firstValueOrEnd') {
      this.skipWhitespace();
      if (this.source[this.index] === ']') {
        this.index += 1;
        this.closeArray(frame);
        return;
      }
      frame.state = 'value';
    }
    if (frame.state === 'value') {
      if (frame.items.length >= this.limits.maxArrayItems) {
        this.fail('json_array_limit', `array item limit ${this.limits.maxArrayItems} exceeded`);
      }
      this.startValue();
      return;
    }
    this.skipWhitespace();
    const delimiter = this.source[this.index];
    if (delimiter === ']') {
      this.index += 1;
      this.closeArray(frame);
      return;
    }
    if (delimiter !== ',') this.fail('json_array_delimiter', 'expected a comma or closing bracket');
    this.index += 1;
    frame.state = 'value';
  }

  parse() {
    while (true) {
      const frame = this.stack.at(-1);
      if (!frame) {
        if (!this.hasRoot) {
          this.startValue();
          continue;
        }
        this.skipWhitespace();
        if (this.index !== this.source.length) this.fail('json_trailing', 'trailing content');
        return this.root;
      }
      if (frame.type === 'object') this.stepObject(frame);
      else this.stepArray(frame);
    }
  }
}

export function parseAuthoredJson(input, limitOverrides) {
  const limits = normalizedLimits(limitOverrides);
  const bytes = sourceBytes(input, limits.maxBytes);
  if (bytes.byteLength > limits.maxBytes) {
    throw new AuthoredJsonError(
      'json_byte_limit',
      `byte limit ${limits.maxBytes} exceeded by ${bytes.byteLength}-byte source`,
    );
  }
  let source;
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new AuthoredJsonError('json_utf8', 'invalid UTF-8');
  }
  return new AuthoredJsonParser(source, limits).parse();
}
