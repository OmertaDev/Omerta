import { constants as fsConstants } from 'node:fs';
import { copyFile, lstat, open, unlink } from 'node:fs/promises';
import {
  constants, createCipheriv, createDecipheriv, createHash, createPrivateKey,
  createPublicKey, KeyObject, privateDecrypt, publicEncrypt, randomBytes, randomUUID,
} from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const MAX_PAYLOAD_BYTES = 32 * 1024 ** 3;
export const MAX_HEADER_BYTES = 4096;
export const MAGIC = 'OMRC1E01';
const TAG_BYTES = 16;
const PREFIX_BYTES = 12;
const CHUNK_BYTES = 1024 * 1024;
const FORMAT = 'omerta-ci-envelope-v1';
const CIPHER = 'aes-256-gcm';
const WRAP = 'rsa-3072-oaep-sha256';
const decoder = new TextDecoder('utf-8', { fatal: true });

export class EnvelopeError extends Error {
  constructor(code, partialPath) {
    super(code);
    this.name = 'EnvelopeError';
    this.code = code;
    if (partialPath) this.partialPath = partialPath;
  }
}

function requireValue(ok, code) {
  if (!ok) throw new EnvelopeError(code);
}

// This format accepts only these JSON value types; no lossy JSON coercions.
export function canonicalJson(value) {
  if (typeof value === 'string') return JSON.stringify(value);
  if (Number.isSafeInteger(value) && value >= 0) return String(value);
  requireValue(value !== null && typeof value === 'object'
    && Object.getPrototypeOf(value) === Object.prototype, 'INVALID_JSON_VALUE');
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function exactKeys(value, keys, code) {
  requireValue(value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join(',') === keys.sort().join(','), code);
}

export function validateContext(context) {
  exactKeys(context, ['sourceRevision', 'runId', 'jobId', ...(Object.hasOwn(context ?? {}, 'attemptId') ? ['attemptId'] : [])], 'INVALID_CONTEXT');
  requireValue(typeof context.sourceRevision === 'string' && /^[a-f0-9]{40}$/.test(context.sourceRevision), 'INVALID_CONTEXT');
  for (const field of ['runId', 'jobId', ...(Object.hasOwn(context, 'attemptId') ? ['attemptId'] : [])]) {
    requireValue(typeof context[field] === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(context[field]), 'INVALID_CONTEXT');
  }
  return JSON.parse(canonicalJson(context));
}

function payloadLimit(limit = MAX_PAYLOAD_BYTES) {
  requireValue(Number.isSafeInteger(limit) && limit >= 0 && limit <= MAX_PAYLOAD_BYTES, 'INVALID_LIMIT');
  return limit;
}

function keyObject(key, type) {
  let result;
  try {
    result = key instanceof KeyObject ? key : type === 'private' ? createPrivateKey(key) : createPublicKey(key);
  } catch { throw new EnvelopeError('INVALID_KEY'); }
  requireValue(result.type === type && result.asymmetricKeyType === 'rsa'
    && result.asymmetricKeyDetails?.modulusLength === 3072, 'INVALID_KEY');
  return result;
}

export function publicKeyFingerprint(key) {
  const publicKey = key instanceof KeyObject && key.type === 'private' ? createPublicKey(key) : keyObject(key, 'public');
  return createHash('sha256').update(publicKey.export({ format: 'der', type: 'spki' })).digest('hex');
}

function identity(stat) {
  return [stat.dev, stat.ino, stat.size, stat.mtimeMs, stat.ctimeMs].join(':');
}

async function openRegular(path, maxBytes) {
  const before = await lstat(path);
  requireValue(before.isFile() && !before.isSymbolicLink(), 'INPUT_NOT_REGULAR');
  requireValue(before.size <= maxBytes, 'INPUT_LIMIT');
  const handle = await open(path, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0) | (fsConstants.O_NONBLOCK ?? 0));
  try {
    const actual = await handle.stat();
    const after = await lstat(path);
    requireValue(actual.isFile() && after.isFile() && !after.isSymbolicLink()
      && identity(before) === identity(actual) && identity(after) === identity(actual), 'INPUT_CHANGED');
    return { handle, initial: actual, path };
  } catch (error) { await handle.close(); throw error; }
}

async function unchanged(input) {
  const actual = await input.handle.stat();
  const named = await lstat(input.path);
  requireValue(named.isFile() && !named.isSymbolicLink()
    && identity(input.initial) === identity(actual) && identity(actual) === identity(named), 'INPUT_CHANGED');
}

async function exactRead(handle, length, position) {
  const result = Buffer.alloc(length);
  let offset = 0;
  while (offset < length) {
    const { bytesRead } = await handle.read(result, offset, length - offset, position + offset);
    requireValue(bytesRead > 0, 'TRUNCATED');
    offset += bytesRead;
  }
  return result;
}

async function* fileChunks(handle, start, length) {
  let offset = 0;
  while (offset < length) {
    const size = Math.min(CHUNK_BYTES, length - offset);
    yield await exactRead(handle, size, start + offset);
    offset += size;
  }
}

async function writeAll(handle, bytes) {
  let offset = 0;
  while (offset < bytes.length) {
    const { bytesWritten } = await handle.write(bytes, offset, bytes.length - offset);
    requireValue(bytesWritten > 0, 'WRITE_FAILED');
    offset += bytesWritten;
  }
}

// Each sink promise is awaited before requesting another input chunk. No whole-file buffering.
// Decryption writes only to private staging; cipher.final() is the authentication boundary.
export async function transformPayload({ chunks, cipher, write, expectedBytes, maxPayloadBytes }) {
  const limit = payloadLimit(maxPayloadBytes);
  requireValue(Number.isSafeInteger(expectedBytes) && expectedBytes >= 0 && expectedBytes <= limit, 'PAYLOAD_LIMIT');
  let bytes = 0;
  for await (const chunk of chunks) {
    requireValue(Buffer.isBuffer(chunk), 'INVALID_CHUNK');
    bytes += chunk.length;
    requireValue(bytes <= limit && bytes <= expectedBytes, 'PAYLOAD_LIMIT');
    await write(cipher.update(chunk));
  }
  requireValue(bytes === expectedBytes, 'TRUNCATED');
  await write(cipher.final());
  return bytes;
}

async function absent(path) {
  try { await lstat(path); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  throw new EnvelopeError('OUTPUT_EXISTS');
}

function safeError(error, partialPath) {
  const result = error instanceof EnvelopeError ? error : new EnvelopeError(error?.code === 'EEXIST' ? 'OUTPUT_EXISTS' : 'ENVELOPE_FAILED');
  if (partialPath) result.partialPath = partialPath;
  return result;
}

async function staging(output) {
  const path = `${resolve(output)}.${randomUUID()}.unverified`;
  return { path, handle: await open(path, 'wx', 0o600) };
}

async function publish(temp, output) {
  // rename can overwrite. EXCL is required even after the initial absent() check.
  await copyFile(temp.path, output, fsConstants.COPYFILE_EXCL);
  await unlink(temp.path);
}

export async function encryptEnvelope({ input, output, context, publicKey, maxPayloadBytes }) {
  const limit = payloadLimit(maxPayloadBytes);
  const domain = validateContext(context);
  const recipient = keyObject(publicKey, 'public');
  let source, temp, secret;
  try {
    await absent(output);
    source = await openRegular(input, limit);
    secret = randomBytes(32);
    const nonce = randomBytes(12);
    const header = {
      format: FORMAT, cipher: CIPHER, wrap: WRAP, context: domain,
      keyFingerprint: publicKeyFingerprint(recipient), plaintextBytes: source.initial.size,
      nonce: nonce.toString('base64'),
      wrappedKey: publicEncrypt({ key: recipient, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, secret).toString('base64'),
    };
    const encoded = Buffer.from(canonicalJson(header));
    requireValue(encoded.length <= MAX_HEADER_BYTES, 'HEADER_LIMIT');
    const prefix = Buffer.alloc(PREFIX_BYTES);
    prefix.write(MAGIC, 0, 'ascii');
    prefix.writeUInt32BE(encoded.length, 8);
    const aad = Buffer.concat([prefix, encoded]);
    const cipher = createCipheriv(CIPHER, secret, nonce, { authTagLength: TAG_BYTES });
    cipher.setAAD(aad);
    temp = await staging(output);
    await writeAll(temp.handle, aad);
    await transformPayload({ chunks: fileChunks(source.handle, 0, source.initial.size), cipher,
      write: bytes => writeAll(temp.handle, bytes), expectedBytes: source.initial.size, maxPayloadBytes: limit });
    await writeAll(temp.handle, cipher.getAuthTag());
    await unchanged(source);
    await temp.handle.close();
    temp.handle = null;
    await publish(temp, output);
    return { status: 'ENCRYPTED', plaintextBytes: header.plaintextBytes, keyFingerprint: header.keyFingerprint, context: domain };
  } catch (error) { throw safeError(error, temp?.path); }
  finally { secret?.fill(0); await temp?.handle?.close(); await source?.handle.close(); }
}

function base64(value, length) {
  requireValue(typeof value === 'string', 'INVALID_HEADER');
  const bytes = Buffer.from(value, 'base64');
  requireValue(bytes.length === length && bytes.toString('base64') === value, 'INVALID_HEADER');
  return bytes;
}

async function readHeader(source, limit) {
  const prefix = await exactRead(source.handle, PREFIX_BYTES, 0);
  requireValue(prefix.subarray(0, 8).toString('ascii') === MAGIC, 'INVALID_FORMAT');
  const length = prefix.readUInt32BE(8);
  requireValue(length > 0 && length <= MAX_HEADER_BYTES, 'HEADER_LIMIT');
  const encoded = await exactRead(source.handle, length, PREFIX_BYTES);
  let header;
  try { header = JSON.parse(decoder.decode(encoded)); } catch { throw new EnvelopeError('INVALID_HEADER'); }
  exactKeys(header, ['format', 'cipher', 'wrap', 'context', 'keyFingerprint', 'plaintextBytes', 'nonce', 'wrappedKey'], 'INVALID_HEADER');
  requireValue(Buffer.from(canonicalJson(header)).equals(encoded), 'NONCANONICAL_HEADER');
  requireValue(header.format === FORMAT && header.cipher === CIPHER && header.wrap === WRAP, 'INVALID_FORMAT');
  validateContext(header.context);
  requireValue(typeof header.keyFingerprint === 'string' && /^[a-f0-9]{64}$/.test(header.keyFingerprint), 'INVALID_HEADER');
  requireValue(Number.isSafeInteger(header.plaintextBytes) && header.plaintextBytes >= 0 && header.plaintextBytes <= limit, 'PAYLOAD_LIMIT');
  requireValue(source.initial.size === PREFIX_BYTES + length + header.plaintextBytes + TAG_BYTES, 'ENVELOPE_LENGTH');
  return { header, nonce: base64(header.nonce, 12), wrappedKey: base64(header.wrappedKey, 384),
    aad: Buffer.concat([prefix, encoded]), offset: PREFIX_BYTES + length };
}

export async function decryptEnvelope({ input, output, context, privateKey, maxPayloadBytes }) {
  const limit = payloadLimit(maxPayloadBytes);
  const expected = validateContext(context);
  const recipient = keyObject(privateKey, 'private');
  let source, temp, secret;
  try {
    await absent(output);
    source = await openRegular(input, limit + PREFIX_BYTES + MAX_HEADER_BYTES + TAG_BYTES);
    const { header, nonce, wrappedKey, aad, offset } = await readHeader(source, limit);
    requireValue(header.keyFingerprint === publicKeyFingerprint(recipient), 'RECIPIENT_MISMATCH');
    // Cheap early rejection is not authentication; repeat after final() before publication.
    requireValue(canonicalJson(header.context) === canonicalJson(expected), 'CONTEXT_MISMATCH');
    try { secret = privateDecrypt({ key: recipient, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, wrappedKey); }
    catch { throw new EnvelopeError('AUTHENTICATION_FAILED'); }
    requireValue(secret.length === 32, 'INVALID_WRAPPED_KEY');
    const cipher = createDecipheriv(CIPHER, secret, nonce, { authTagLength: TAG_BYTES });
    cipher.setAAD(aad);
    cipher.setAuthTag(await exactRead(source.handle, TAG_BYTES, offset + header.plaintextBytes));
    temp = await staging(output);
    try {
      await transformPayload({ chunks: fileChunks(source.handle, offset, header.plaintextBytes), cipher,
        write: bytes => writeAll(temp.handle, bytes), expectedBytes: header.plaintextBytes, maxPayloadBytes: limit });
    } catch (error) {
      if (error instanceof EnvelopeError || error?.code) throw error;
      throw new EnvelopeError('AUTHENTICATION_FAILED');
    }
    await unchanged(source);
    requireValue(canonicalJson(header.context) === canonicalJson(expected), 'CONTEXT_MISMATCH');
    await temp.handle.close();
    temp.handle = null;
    await publish(temp, output);
    return { status: 'VERIFIED', plaintextBytes: header.plaintextBytes, keyFingerprint: header.keyFingerprint, context: expected };
  } catch (error) { throw safeError(error, temp?.path); }
  finally { secret?.fill(0); await temp?.handle?.close(); await source?.handle.close(); }
}

async function boundedFile(path, limit) {
  const source = await openRegular(path, limit);
  try { const bytes = await exactRead(source.handle, source.initial.size, 0); await unchanged(source); return bytes; }
  finally { await source.handle.close(); }
}

export async function runCli(argv) {
  const [mode, ...args] = argv;
  requireValue(mode === 'encrypt' || mode === 'decrypt', 'CLI_USAGE');
  const keyFlag = mode === 'encrypt' ? 'public-key' : 'private-key';
  const flags = {};
  for (const arg of args) {
    const match = /^--([a-z-]+)=(.+)$/.exec(arg);
    requireValue(match && ['input', 'output', 'context', keyFlag].includes(match[1]) && !Object.hasOwn(flags, match[1]), 'CLI_USAGE');
    flags[match[1]] = match[2];
  }
  requireValue(Object.keys(flags).length === 4, 'CLI_USAGE');
  let context;
  try { context = JSON.parse(decoder.decode(await boundedFile(flags.context, MAX_HEADER_BYTES))); }
  catch { throw new EnvelopeError('INVALID_CONTEXT_FILE'); }
  const pem = await boundedFile(flags[keyFlag], 16 * 1024);
  try {
    const options = { input: flags.input, output: flags.output, context };
    return mode === 'encrypt' ? await encryptEnvelope({ ...options, publicKey: pem })
      : await decryptEnvelope({ ...options, privateKey: pem });
  } finally { pem.fill(0); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runCli(process.argv.slice(2)).then(result => console.log(JSON.stringify(result))).catch(error => {
    const safe = safeError(error);
    console.error(JSON.stringify({ status: 'FAILED', code: safe.code, ...(safe.partialPath ? { unverifiedPartialPath: safe.partialPath } : {}) }));
    process.exitCode = 1;
  });
}
