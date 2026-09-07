import crypto from 'node:crypto';

export const HASH_DOMAINS = Object.freeze({
  definition: 'omerta:definition:v1',
  source: 'omerta:source:v1',
  secretOverlay: 'omerta:secret-overlay:v1',
  dependencyLock: 'omerta:dependency-lock:v1',
  ir: 'omerta:compiled-ir:v1',
  bundle: 'omerta:bundle:v1',
  publicManifest: 'omerta:public-manifest:v1',
});

const DOMAIN_SET = new Set(Object.values(HASH_DOMAINS));
const FRAME_MAGIC = Buffer.from('OMERTA\0', 'ascii');
const FIELD_NAME = /^[A-Za-z][A-Za-z0-9._-]{0,127}$/;

function assertWellFormedString(value, path = '$') {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        index += 1;
      } else {
        throw new TypeError(`canonical value ${path} contains an unpaired UTF-16 surrogate`);
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new TypeError(`canonical value ${path} contains an unpaired UTF-16 surrogate`);
    }
  }
}

function compareUtf8(left, right) {
  assertWellFormedString(left, '$.key');
  assertWellFormedString(right, '$.key');
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function canonicalError(path, message) {
  throw new TypeError(`canonical value ${path} ${message}`);
}

function validateArrayShape(value, path) {
  const ownKeys = Reflect.ownKeys(value);
  for (const key of ownKeys) {
    if (key === 'length') continue;
    if (typeof key !== 'string' || !/^(?:0|[1-9][0-9]*)$/.test(key)
        || Number(key) >= value.length) {
      canonicalError(path, 'must not have non-index or symbol properties');
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) {
      canonicalError(`${path}[${key}]`, 'must be an enumerable data property');
    }
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) canonicalError(`${path}[${index}]`, 'must not be sparse');
  }
}

function objectEntries(value, path) {
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    canonicalError(path, 'must have an ordinary or null prototype');
  }
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== 'string')) {
    canonicalError(path, 'must not have symbol properties');
  }
  keys.sort(compareUtf8);
  return keys.map((key) => {
    assertWellFormedString(key, `${path}.<key>`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) {
      canonicalError(`${path}.${key}`, 'must be an enumerable data property');
    }
    return [key, descriptor.value];
  });
}

/**
 * Encode the sealed-artifact data model as deterministic UTF-8 JSON bytes.
 * This encoder deliberately has no schema, filesystem, clock, or profile knowledge.
 */
export function canonicalBytes(value) {
  const chunks = [];
  const active = new WeakSet();
  const stack = [{ operation: 'value', value, path: '$' }];
  while (stack.length > 0) {
    const task = stack.pop();
    if (task.operation === 'text') {
      chunks.push(task.value);
      continue;
    }
    if (task.operation === 'leave') {
      active.delete(task.value);
      continue;
    }

    const current = task.value;
    if (current === null) {
      chunks.push('null');
    } else if (typeof current === 'boolean') {
      chunks.push(current ? 'true' : 'false');
    } else if (typeof current === 'string') {
      assertWellFormedString(current, task.path);
      chunks.push(JSON.stringify(current));
    } else if (typeof current === 'number') {
      if (!Number.isSafeInteger(current) || Object.is(current, -0)) {
        canonicalError(task.path, 'must be a safe integer other than negative zero');
      }
      chunks.push(String(current));
    } else if (Array.isArray(current)) {
      if (active.has(current)) canonicalError(task.path, 'is cyclic');
      validateArrayShape(current, task.path);
      active.add(current);
      chunks.push('[');
      stack.push({ operation: 'leave', value: current });
      stack.push({ operation: 'text', value: ']' });
      for (let index = current.length - 1; index >= 0; index -= 1) {
        stack.push({ operation: 'value', value: current[index], path: `${task.path}[${index}]` });
        if (index > 0) stack.push({ operation: 'text', value: ',' });
      }
    } else if (current && typeof current === 'object') {
      if (active.has(current)) canonicalError(task.path, 'is cyclic');
      const entries = objectEntries(current, task.path);
      active.add(current);
      chunks.push('{');
      stack.push({ operation: 'leave', value: current });
      stack.push({ operation: 'text', value: '}' });
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        const [key, member] = entries[index];
        stack.push({ operation: 'value', value: member, path: `${task.path}.${key}` });
        stack.push({ operation: 'text', value: ':' });
        stack.push({ operation: 'text', value: JSON.stringify(key) });
        if (index > 0) stack.push({ operation: 'text', value: ',' });
      }
    } else {
      canonicalError(task.path, `has unsupported type ${typeof current}`);
    }
  }
  return Buffer.from(chunks.join(''), 'utf8');
}

function uint32(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new RangeError('frame length exceeds uint32');
  }
  const bytes = Buffer.allocUnsafe(4);
  bytes.writeUInt32BE(value);
  return bytes;
}

function uint64(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('frame length is invalid');
  const bytes = Buffer.allocUnsafe(8);
  bytes.writeBigUInt64BE(BigInt(value));
  return bytes;
}

function framedValue(value) {
  if (value === null) return [0, Buffer.alloc(0)];
  if (typeof value === 'boolean') return [1, Buffer.from(value ? '1' : '0', 'ascii')];
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      throw new TypeError('frame integer must be a safe integer other than negative zero');
    }
    return [2, Buffer.from(String(value), 'ascii')];
  }
  if (typeof value === 'string') {
    assertWellFormedString(value, '$.frame');
    return [4, Buffer.from(value, 'utf8')];
  }
  if (value instanceof Uint8Array) {
    return [5, Buffer.from(value.buffer, value.byteOffset, value.byteLength)];
  }
  if (Array.isArray(value)) return [6, canonicalBytes(value)];
  if (value && typeof value === 'object') return [7, canonicalBytes(value)];
  throw new TypeError(`unsupported frame value type ${typeof value}`);
}

/**
 * Encode an ordered array of unique [fieldName, value] pairs. Both field order and
 * field names are part of the frame. Domain selection is closed to the reviewed seven.
 */
export function frame(domainTag, fields) {
  if (!DOMAIN_SET.has(domainTag)) throw new TypeError(`unknown canonical hash domain ${domainTag}`);
  if (!Array.isArray(fields)) throw new TypeError('frame fields must be an ordered array');
  const domainBytes = Buffer.from(domainTag, 'ascii');
  const parts = [FRAME_MAGIC, uint32(domainBytes.byteLength), domainBytes, uint32(fields.length)];
  const seen = new Set();
  for (const entry of fields) {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string'
        || !FIELD_NAME.test(entry[0])) {
      throw new TypeError('frame field must be [safeName, value]');
    }
    const [name, value] = entry;
    if (seen.has(name)) throw new TypeError(`duplicate frame field ${name}`);
    seen.add(name);
    const nameBytes = Buffer.from(name, 'ascii');
    const [type, payload] = framedValue(value);
    parts.push(uint32(nameBytes.byteLength), nameBytes, Buffer.from([type]), uint64(payload.byteLength), payload);
  }
  return Buffer.concat(parts);
}

export function hashFrame(domainTag, fields) {
  return crypto.createHash('sha256').update(frame(domainTag, fields)).digest('hex');
}

export function compareCanonicalText(left, right) {
  return compareUtf8(String(left), String(right));
}
