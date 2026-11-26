// Prospective owner-side APIs. Frozen historical helpers remain unchanged.
import { createRecordEncryptionRuntime, parseRecordPacket, recordPacketDigest } from '../private-account-record/encryption.mjs';
import { recoverPublishedRecords } from '../private-account-record/recovery.mjs';
import { canonicalRecord, recordCommitment, FIELD, HEADER_FIELDS } from '../private-account-record/record.mjs';

const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const bufferGetter = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'buffer').get;
const lengthGetter = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'length').get;
const sharedLengthGetter = typeof SharedArrayBuffer === 'undefined' ? null
  : Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype, 'byteLength').get;
function fail(message) { throw new TypeError(message); }
function boundedField(value) {
  if (typeof value === 'string') {
    if (value.length < 1 || value.length > 77 || !/^(0|[1-9][0-9]*)$/.test(value)) fail('Canonical bounded field integer required');
    value = BigInt(value);
  } else if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) fail('Canonical bounded field integer required');
    value = BigInt(value);
  } else if (typeof value !== 'bigint') fail('Canonical bounded field integer required');
  // Bound caller BigInts before frozen helpers can stringify them.
  if (value < 0n || value >= FIELD) fail('Noncanonical/out-of-range integer');
  return value;
}
function scalar(value) {
  const field = boundedField(value);
  if (field === 0n) fail('Nonzero canonical Fr scalar required');
  return field;
}
function dataObject(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Exact data options required');
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) fail('Plain data options required');
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
  if (keys.length !== expected.length || !expected.every(key => Object.hasOwn(descriptors, key))) fail('Exact data options required');
  const copy = Object.create(null);
  for (const key of expected) {
    const descriptor = descriptors[key];
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail('Data properties required');
    copy[key] = descriptor.value;
  }
  return copy;
}
function purpose(value) {
  if (value !== 'snapshot' && value !== 'delta') fail('Exact encryption purpose required');
  return value;
}
function ownPacket(kind, packet) {
  purpose(kind);
  if (!ArrayBuffer.isView(packet) || !(packet instanceof Uint8Array)) fail('Uint8Array packet required');
  if (lengthGetter.call(packet) !== (kind === 'snapshot' ? 912 : 336)) fail('Exact typed packet length required');
  const backing = bufferGetter.call(packet);
  let shared = false;
  if (sharedLengthGetter) {
    try { sharedLengthGetter.call(backing); shared = true; }
    catch (error) { if (!(error instanceof TypeError)) throw error; }
  }
  if (shared) fail('Shared packet memory is not supported');
  // Explicit constructor removes Buffer.slice aliasing and owns the entire byte window.
  const owned = new Uint8Array(packet);
  parseRecordPacket(kind, owned);
  return owned;
}
function capturedOptions(mode, options) {
  const keys = ['domain', 'packet', 'recipientSecret', 'expectedDigest'];
  if (mode === 'fields') keys.push('purpose'); else keys.push('expectedCommitment');
  if (mode === 'delta') keys.push('oldRecord');
  const p = dataObject(options, keys);
  const domain = scalar(p.domain), recipientSecret = scalar(p.recipientSecret), expectedDigest = scalar(p.expectedDigest);
  const kind = mode === 'fields' ? purpose(p.purpose) : mode;
  const packet = ownPacket(kind, p.packet);
  if (recordPacketDigest(domain, kind, packet) !== expectedDigest) fail('Packet differs from confirmed digest');
  const result = { domain, packet, recipientSecret, expectedDigest };
  if (mode === 'fields') result.purpose = kind;
  else result.expectedCommitment = scalar(p.expectedCommitment);
  if (mode === 'delta') {
    const old = dataObject(p.oldRecord, HEADER_FIELDS);
    const bounded = Object.fromEntries(HEADER_FIELDS.map(key => [key, boundedField(old[key])]));
    result.oldRecord = Object.freeze(canonicalRecord(bounded));
  }
  return result;
}
async function withRuntime(action) {
  const runtime = await createRecordEncryptionRuntime();
  try { return await action(runtime); } finally { await runtime.destroy(); }
}

export function parseOwnedRecordPacket(kind, packet) {
  const parsed = parseRecordPacket(purpose(kind), ownPacket(kind, packet));
  return Object.freeze({ ephemeral: Object.freeze({ ...parsed.ephemeral }), ciphertext: new Uint8Array(parsed.ciphertext) });
}

export async function decryptOwnedRecordFields(options) {
  const captured = capturedOptions('fields', options); // before runtime initialization/first await
  const fields = await withRuntime(runtime => runtime.decryptFields(captured));
  return Object.freeze([...fields]);
}

export async function decryptOwnedRecordSnapshot(options) {
  const captured = capturedOptions('snapshot', options);
  const record = await withRuntime(runtime => runtime.decryptSnapshot(captured));
  return Object.freeze(canonicalRecord(record));
}

export async function decryptOwnedRecordDelta(options) {
  const captured = capturedOptions('delta', options);
  const record = await withRuntime(runtime => runtime.decryptDelta(captured));
  return Object.freeze(canonicalRecord(record));
}

function capturedRecovery(options) {
  const p = dataObject(options, ['domain', 'recipientSecret', 'publications', 'expectedFinalCommitment']);
  const domain = scalar(p.domain), recipientSecret = scalar(p.recipientSecret), expectedFinalCommitment = scalar(p.expectedFinalCommitment);
  if (!Array.isArray(p.publications) || p.publications.length < 1) fail('Complete publication sequence required');
  const publications = [];
  for (let index = 0; index < p.publications.length; ++index) {
    const descriptor = Object.getOwnPropertyDescriptor(p.publications, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('Dense data publication sequence required');
    const entry = dataObject(descriptor.value, ['kind', 'packet', 'digest', 'commitment']);
    const kind = index === 0 ? 0 : 1;
    if (entry.kind !== kind) fail('Snapshot followed by ordered deltas required');
    const packet = ownPacket(kind === 0 ? 'snapshot' : 'delta', entry.packet);
    const digest = scalar(entry.digest), commitment = scalar(entry.commitment);
    if (recordPacketDigest(domain, kind === 0 ? 'snapshot' : 'delta', packet) !== digest) fail('Packet differs from confirmed digest');
    publications.push(Object.freeze({ kind, packet, digest, commitment }));
  }
  if (publications[publications.length - 1].commitment !== expectedFinalCommitment) fail('Recovery tail differs from expected final commitment');
  return { domain, recipientSecret, publications: Object.freeze(publications), expectedFinalCommitment };
}

/// Caller must obtain expectedFinalCommitment independently from an authenticated
/// canonical source. Equality here is not proof of chain publication/latest head,
/// finality,unspent status or the contents behind the ten opaque state roots.
export async function recoverOwnedPublishedRecords(options) {
  const captured = capturedRecovery(options); // whole sequence/metadata/bytes before raw initialization
  const result = await recoverPublishedRecords({ domain: captured.domain, recipientSecret: captured.recipientSecret,
    publications: captured.publications });
  const record = Object.freeze(canonicalRecord(result.record));
  if (result.commitment !== captured.expectedFinalCommitment || recordCommitment(captured.domain, record) !== captured.expectedFinalCommitment)
    fail('Recovered record differs from expected final commitment');
  return Object.freeze({ record, commitment: captured.expectedFinalCommitment });
}
