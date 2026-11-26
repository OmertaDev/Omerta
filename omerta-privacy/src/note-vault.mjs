// Encrypted local persistence only. Circuit/witness validity and chain reconciliation are external.
// Recovery keys and plaintext exist in memory; this module never logs, networks, or uses localStorage.
const FORMAT = 'omerta.private-note-vault';
const VERSION = 1;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
export const VAULT_LIMITS = Object.freeze({ notes: 256, noteBytes: 65532, noteFrameBytes: 65536, stringLength: 16384,
  nodes: 4096, depth: 32, backupBytes: 24 * 1024 * 1024, backupFileChars: 35 * 1024 * 1024 });

export class NoteVaultError extends Error {
  constructor(code, message) { super(message); this.name = 'NoteVaultError'; this.code = code; }
}
const fail = (code, message) => { throw new NoteVaultError(code, message); };
function fields(value, names) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('vault_format', 'Expected a plain data object.');
  const keys = Reflect.ownKeys(value);
  if (keys.length !== names.length || keys.some(key => !names.includes(key))) fail('vault_format', 'Unsupported or missing fields.');
  for (const key of keys) {
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (!d.enumerable || !Object.hasOwn(d, 'value')) fail('vault_format', 'Accessors are not supported.');
  }
  return value;
}
function cryptoOf(value = globalThis.crypto) {
  if (!value?.subtle || typeof value.getRandomValues !== 'function') fail('vault_crypto', 'WebCrypto is required.');
  return value;
}
function random(crypto, length) { return crypto.getRandomValues(new Uint8Array(length)); }
function keyBytes(key) {
  if (!(key instanceof Uint8Array) || key.byteLength !== 32) fail('vault_key', 'A generated 256-bit recovery key is required.');
  return new Uint8Array(key);
}
function base64(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
function unbase64(value, { bytes, maxBytes = bytes, minBytes = bytes } = {}) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)
    || value.length > Math.ceil(maxBytes * 4 / 3)) fail('vault_format', 'Invalid encoded bytes.');
  let decoded;
  try { decoded = Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4)), x => x.charCodeAt(0)); }
  catch { fail('vault_format', 'Invalid encoded bytes.'); }
  if (decoded.length < minBytes || decoded.length > maxBytes || base64(decoded) !== value) fail('vault_format', 'Noncanonical encoded bytes.');
  return decoded;
}

export function generateRecoveryKey() { return random(cryptoOf(), 32); }
// Explicit caller-only recovery transport. These functions never store or log key material.
export function encodeRecoveryKey(key) { const copy = keyBytes(key); try { return base64(copy); } finally { copy.fill(0); } }
export function decodeRecoveryKey(encoded) { return unbase64(encoded, { bytes: 32 }); }

export function noteVaultDomain(value) {
  const d = fields(value, ['version', 'chainId', 'gameAddress', 'programId']);
  if (d.version !== VERSION) fail('vault_version', 'Unsupported vault domain version.');
  if (typeof d.chainId !== 'string' || !/^[1-9][0-9]{0,77}$/.test(d.chainId)
    || BigInt(d.chainId) >= 1n << 256n || !/^0x[0-9a-f]{40}$/.test(d.gameAddress || '')
    || /^0x0{40}$/.test(d.gameAddress) || !/^0x[0-9a-f]{64}$/.test(d.programId || '')
    || /^0x0{64}$/.test(d.programId)) fail('vault_domain', 'A canonical chain, game address and program hash are required.');
  return Object.freeze({ version: VERSION, chainId: d.chainId, gameAddress: d.gameAddress, programId: d.programId });
}

function plainBody(value, frameBytes = VAULT_LIMITS.noteFrameBytes) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('vault_payload', 'A bounded plain JSON body is required.');
  let nodes = 0;
  const seen = new Set();
  function copy(v, depth) {
    if (++nodes > VAULT_LIMITS.nodes || depth > VAULT_LIMITS.depth) fail('vault_payload', 'The JSON body exceeds its bounds.');
    if (v === null || typeof v === 'boolean') return v;
    if (typeof v === 'number') { if (!Number.isSafeInteger(v)) fail('vault_payload', 'Numbers must be safe integers; encode larger values as strings.'); return Object.is(v, -0) ? 0 : v; }
    if (typeof v === 'string') { if (v.length > VAULT_LIMITS.stringLength) fail('vault_payload', 'A JSON string exceeds its bound.'); return v; }
    if (!v || typeof v !== 'object' || seen.has(v) || (!Array.isArray(v)
      && ![Object.prototype, null].includes(Object.getPrototypeOf(v)))) fail('vault_payload', 'Only acyclic plain JSON is supported.');
    seen.add(v);
    const result = Array.isArray(v) ? [] : Object.create(null);
    const keys = Reflect.ownKeys(v);
    if (Array.isArray(v)) {
      if (v.length > VAULT_LIMITS.nodes || keys.length !== v.length + 1) fail('vault_payload', 'Sparse or decorated arrays are unsupported.');
      for (let i = 0; i < v.length; i++) {
        const d = Object.getOwnPropertyDescriptor(v, String(i));
        if (!d?.enumerable || !Object.hasOwn(d, 'value')) fail('vault_payload', 'Array accessors are unsupported.');
        result.push(copy(d.value, depth + 1));
      }
    } else {
      if (keys.length > 256 || keys.some(key => typeof key !== 'string' || key.length > 256)) fail('vault_payload', 'JSON object keys exceed their bounds.');
      for (const key of keys.sort()) {
        const d = Object.getOwnPropertyDescriptor(v, key);
        if (!d.enumerable || !Object.hasOwn(d, 'value')) fail('vault_payload', 'JSON accessors are unsupported.');
        result[key] = copy(d.value, depth + 1);
      }
    }
    seen.delete(v); return result;
  }
  const body = copy(value, 0), text = JSON.stringify(body);
  if (encoder.encode(text).length > frameBytes - 4) fail('vault_payload', 'The JSON body exceeds its byte bound.');
  return { body, text };
}
const idOf = id => { unbase64(id, { bytes: 32 }); return id; };
const revisionOf = envelope => JSON.stringify(envelope);
function headerOf(envelope) {
  return { format: FORMAT, version: VERSION, purpose: envelope.purpose, frameBytes: envelope.frameBytes, domain: envelope.domain,
    id: envelope.id, salt: envelope.salt, iv: envelope.iv };
}
function envelopeOf(value, purpose, domain, frameBytes) {
  const e = fields(value, ['format', 'version', 'purpose', 'frameBytes', 'domain', 'id', 'salt', 'iv', 'ciphertext']);
  if (e.version !== VERSION) fail('vault_version', 'Unsupported encrypted record version.');
  if (e.format !== FORMAT || e.purpose !== purpose) fail('vault_format', 'Unexpected encrypted record purpose.');
  if (e.frameBytes !== frameBytes) fail('vault_domain', 'Encrypted data belongs to another frame domain.');
  const actualDomain = noteVaultDomain(e.domain);
  if (JSON.stringify(actualDomain) !== JSON.stringify(domain)) fail('vault_domain', 'Encrypted data belongs to another domain.');
  idOf(e.id); unbase64(e.salt, { bytes: 32 }); unbase64(e.iv, { bytes: 12 });
  unbase64(e.ciphertext, { minBytes: ['note','packet'].includes(purpose) ? frameBytes + 16 : 16,
    maxBytes: (purpose === 'backup' ? VAULT_LIMITS.backupBytes : frameBytes) + 16 });
  return { ...headerOf({ ...e, domain: actualDomain }), ciphertext: e.ciphertext };
}
function safeError(error) {
  return error instanceof NoteVaultError ? error : new NoteVaultError('vault_storage', 'Encrypted storage could not complete the operation.');
}

function configOf(value, required) {
  return fields(value, [...required, ...(value && typeof value === 'object' && Object.hasOwn(value,'frameBytes') ? ['frameBytes'] : [])]);
}
async function cryptoContext({ domain: inputDomain, recoveryKey, frameBytes = VAULT_LIMITS.noteFrameBytes }) {
  const domain = noteVaultDomain(inputDomain), crypto = cryptoOf();
  if (![8192,65536].includes(frameBytes)) fail('vault_frame', 'Only fixed 8192-byte or 65536-byte frames are supported.');
  const temporary = keyBytes(recoveryKey);
  let master, closed = false;
  try { master = await crypto.subtle.importKey('raw', temporary, 'HKDF', false, ['deriveKey']); }
  finally { temporary.fill(0); }
  const active = () => { if (closed || !master) fail('vault_closed', 'The vault is closed.'); };
  async function aes(purpose, salt, id) {
    active();
    return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt,
      info: encoder.encode(JSON.stringify({ application: FORMAT, version: VERSION, purpose, frameBytes, domain, id })) },
    master, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function seal(text, purpose, id = base64(random(crypto, 32))) {
    active();
    const salt = random(crypto, 32), iv = random(crypto, 12);
    const header = { format: FORMAT, version: VERSION, purpose, frameBytes, domain, id, salt: base64(salt), iv: base64(iv) };
    const key = await aes(purpose, salt, id); active();
    let plaintext = encoder.encode(text);
    if (['note','packet'].includes(purpose)) {
      if (plaintext.length > frameBytes - 4) fail('vault_payload', 'The JSON body exceeds its byte bound.');
      const frame = new Uint8Array(frameBytes);
      new DataView(frame.buffer).setUint32(0, plaintext.length, false);
      frame.set(plaintext, 4); plaintext.fill(0); plaintext = frame;
    }
    try {
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(JSON.stringify(header)), tagLength: 128 },
        key, plaintext); active();
      return { ...header, ciphertext: base64(new Uint8Array(encrypted)) };
    } finally { plaintext.fill(0); }
  }
  async function open(value, purpose) {
    active(); const envelope = envelopeOf(value, purpose, domain, frameBytes);
    let bytes;
    try {
      const key = await aes(purpose, unbase64(envelope.salt, { bytes: 32 }), envelope.id); active();
      bytes = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unbase64(envelope.iv, { bytes: 12 }),
        additionalData: encoder.encode(JSON.stringify(headerOf(envelope))), tagLength: 128 }, key,
      unbase64(envelope.ciphertext, { minBytes: ['note','packet'].includes(purpose) ? frameBytes + 16 : 16,
        maxBytes: (purpose === 'backup' ? VAULT_LIMITS.backupBytes : frameBytes) + 16 })));
      active();
    } catch (e) { if (e instanceof NoteVaultError) throw e; fail('vault_authentication', 'Encrypted data could not be authenticated.'); }
    try {
      let content = bytes;
      if (['note','packet'].includes(purpose)) {
        if (bytes.length !== frameBytes) fail('vault_payload', 'Invalid authenticated note frame.');
        const length = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, false);
        if (length > frameBytes - 4 || bytes.subarray(4 + length).some(byte => byte !== 0)) fail('vault_payload', 'Invalid authenticated note padding.');
        content = bytes.subarray(4, 4 + length);
      }
      const text = decoder.decode(content);
      return { envelope, value: JSON.parse(text), text };
    }
    catch { fail('vault_payload', 'Authenticated data has an invalid JSON encoding.'); }
    finally { bytes?.fill(0); }
  }
  return { domain, frameBytes, active, seal, open, close() { closed = true; master = undefined; } };
}

// Standalone packet codec: no storage/publication and a separate cryptographic purpose from local notes.
// Use an independent generated key for operator packets; never share the owner's recovery master.
export async function createEncryptedNoteCodec(options) {
  const context = await cryptoContext(configOf(options,['domain','recoveryKey']));
  return Object.freeze({ frameBytes: context.frameBytes,
    async encrypt(body) { const canonical = plainBody(body,context.frameBytes); return context.seal(canonical.text,'packet'); },
    async decrypt(envelope) {
      const decoded = await context.open(envelope,'packet'), canonical = plainBody(decoded.value,context.frameBytes);
      if (decoded.text !== canonical.text) fail('vault_payload','Authenticated JSON is not canonical.');
      return canonical.body;
    },
    close: context.close,
  });
}

export async function createNoteVault(options) {
  const config = configOf(options,['domain','recoveryKey','storage']), { storage } = config;
  if (!storage || !['initialize', 'read', 'list', 'put', 'remove', 'restoreEmpty'].every(name => typeof storage[name] === 'function')) {
    fail('vault_storage', 'An atomic encrypted storage adapter is required.');
  }
  const { domain, frameBytes, active, seal, open, close: closeCrypto } = await cryptoContext(config);
  let headerRevision;
  async function saved(id) {
    active(); idOf(id);
    const value = await storage.read(id, headerRevision); active();
    if (!value) return null;
    const decoded = await open(value, 'note');
    if (decoded.envelope.id !== id) fail('vault_format', 'Encrypted record identity mismatch.');
    const canonical = plainBody(decoded.value, frameBytes);
    if (canonical.text !== decoded.text) fail('vault_payload', 'Authenticated JSON is not canonical.');
    return { id, body: canonical.body, revision: revisionOf(decoded.envelope) };
  }
  try {
    const marker = JSON.stringify({ marker: FORMAT, version: VERSION });
    const candidate = await seal(marker, 'header');
    const stored = await storage.initialize(candidate); active();
    const decoded = await open(stored, 'header');
    if (decoded.text !== marker) fail('vault_format', 'Invalid encrypted vault header.');
    headerRevision = revisionOf(decoded.envelope);
  } catch (error) { closeCrypto(); throw safeError(error); }

  async function put(body, options = {}) {
    fields(options, options && typeof options === 'object' && Object.hasOwn(options, 'id') ? ['id', 'revision'] : []);
    const updating = Object.hasOwn(options, 'id'), expectedRevision = updating ? options.revision : null;
    const canonical = plainBody(body, frameBytes), id = updating ? idOf(options.id) : undefined;
    try {
      active();
      if (updating) {
        const previous = await saved(id);
        if (!previous || previous.revision !== expectedRevision) fail('vault_conflict', 'The encrypted record changed.');
      }
      const envelope = await seal(canonical.text, 'note', id); active();
      await storage.put(envelope, expectedRevision, headerRevision); active();
      return { id: envelope.id, revision: revisionOf(envelope) };
    } catch (error) { throw safeError(error); }
  }
  async function get(id) { try { return await saved(id); } catch (error) { throw safeError(error); } }
  async function list() {
    try {
      active(); const values = await storage.list(headerRevision); active();
      if (!Array.isArray(values) || values.length > VAULT_LIMITS.notes) fail('vault_format', 'Encrypted inventory exceeds its bound.');
      const ids = new Set(), result = [];
      for (const value of values) {
        const decoded = await open(value, 'note'), canonical = plainBody(decoded.value, frameBytes);
        if (ids.has(decoded.envelope.id) || canonical.text !== decoded.text) fail('vault_format', 'Invalid encrypted inventory.');
        ids.add(decoded.envelope.id); result.push({ id: decoded.envelope.id, body: canonical.body, revision: revisionOf(decoded.envelope) });
      }
      return result.sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    } catch (error) { throw safeError(error); }
  }
  async function remove(id, options) {
    try {
      const { revision } = fields(options, ['revision']);
      const previous = await saved(id);
      if (!previous || previous.revision !== revision) fail('vault_conflict', 'The encrypted record changed.');
      active(); await storage.remove(id, revision, headerRevision); active();
    } catch (error) { throw safeError(error); }
  }
  async function exportBackup() {
    try {
      active(); const records = await storage.list(headerRevision); active();
      if (!Array.isArray(records) || records.length > VAULT_LIMITS.notes) fail('vault_format', 'Encrypted inventory exceeds its bound.');
      const ids = new Set(), validated = [];
      for (const record of records) {
        const decoded = await open(record, 'note'), canonical = plainBody(decoded.value, frameBytes);
        if (ids.has(decoded.envelope.id) || canonical.text !== decoded.text) fail('vault_format', 'Invalid encrypted record.');
        ids.add(decoded.envelope.id); validated.push(decoded.envelope);
      }
      validated.sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
      const text = JSON.stringify({ records: validated });
      if (encoder.encode(text).length > VAULT_LIMITS.backupBytes) fail('vault_payload', 'The encrypted backup exceeds its bound.');
      return JSON.stringify(await seal(text, 'backup'));
    } catch (error) { throw safeError(error); }
  }
  async function importBackup(serialized) {
    try {
      active();
      if (typeof serialized !== 'string' || serialized.length > VAULT_LIMITS.backupFileChars) fail('vault_format', 'The encrypted backup exceeds its bound.');
      let envelope; try { envelope = JSON.parse(serialized); } catch { fail('vault_format', 'Invalid encrypted backup.'); }
      if (JSON.stringify(envelopeOf(envelope, 'backup', domain, frameBytes)) !== serialized) fail('vault_format', 'Encrypted backup encoding is not canonical.');
      const decoded = await open(envelope, 'backup');
      fields(decoded.value, ['records']);
      if (!Array.isArray(decoded.value.records) || decoded.value.records.length > VAULT_LIMITS.notes) fail('vault_format', 'Invalid encrypted backup collection.');
      const ids = new Set(), records = [];
      for (const record of decoded.value.records) {
        const note = await open(record, 'note'), canonical = plainBody(note.value, frameBytes);
        if (ids.has(note.envelope.id) || canonical.text !== note.text) fail('vault_format', 'Invalid encrypted backup record.');
        ids.add(note.envelope.id); records.push(note.envelope);
      }
      records.sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
      if (decoded.text !== JSON.stringify({ records })) fail('vault_format', 'Authenticated backup collection is not canonical.');
      active(); await storage.restoreEmpty(records, headerRevision); active();
      return records.length;
    } catch (error) { throw safeError(error); }
  }
  return Object.freeze({ put, get, list, remove, exportBackup, importBackup,
    close() { closeCrypto(); storage.close?.(); } });
}
