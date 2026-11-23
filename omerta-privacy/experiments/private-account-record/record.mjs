// Canonical state-preserving account envelope. No game/accrual/value authority.
import { keccak256, toHex } from 'viem';
import { FIELD, H, fold, field, scalar, uint, point } from '../verifiable-note-encryption/encryption.mjs';
export { FIELD, H, fold };
export const VERSION = 1n;
export const U64 = (1n << 64n) - 1n;
export const U32 = (1n << 32n) - 1n;
export const MAX_SOURCE_TIME = 8640000000000000n;
export const RESOURCE_MASK = (1n << 63n) - 1n;
export const PACKED_LIMIT = 1n << 252n;
export const TAG = Object.freeze({ domain: 4004001n, record: 4004002n, leaf: 4004003n, nullifier: 4004004n,
  preserved: 4004005n, message: 4004006n, deltaKdf: 4004007n, deltaPacket: 4004008n,
  snapshotKdf: 4004009n, snapshotPacket: 4004010n, approval: 4004011n, program: 4004012n });
export const ROOT_FIELDS = Object.freeze(['lifeStateRoot', 'accountBooksRoot', 'lifeBooksRoot', 'accountInventoryRoot',
  'lifeInventoryRoot', 'progressionRoot', 'lawCooldownRoot', 'accrualContextRoot', 'worldRefsRoot', 'ownerObservationsRoot']);
export const RESOURCE_FIELDS = Object.freeze(['energy', 'nerve', 'health', 'heat']);
export const HEADER_FIELDS = Object.freeze(['version', 'accountScope', 'lifeScope', 'lifeGeneration',
  'authPkX', 'authPkY', 'authEpoch', 'viewPkX', 'viewPkY', 'viewEpoch', 'noteSeq', 'packedResources',
  'sharedLastAccruedAtMs', 'pendingMarker', ...ROOT_FIELDS, 'noteSeed', 'noteBlind']);
export const DELTA_FIELDS = Object.freeze(['version', 'oldRecordCommit', 'nextNoteSequence', 'packedResources',
  'sharedLastAccruedAtMs', 'newNoteSeed', 'newNoteBlind', 'preservedEnvelopeDigest']);
const SPEC = Object.freeze({ version: 1, transition: 'identity-preserving rewrap only', headerFields: HEADER_FIELDS,
  deltaFields: DELTA_FIELDS, resourceOrder: RESOURCE_FIELDS, resourceEncoding: 'four nonnegative finite binary64 bit patterns,63bits each,packed252bits',
  bounds: { sharedClock: 'integer milliseconds0..8640000000000000 (valid JS Date)', lifeGeneration: 'uint64 independently from noteSeq',
    keyEpochs: 'uint32', enrolledLifeOnly: true },
  clock: 'shared source clock preserved byte-for-byte; complete22-member source timed closure is an activation gate',
  ownerAuthorization: 'upstream Schnorr0.4.0; owner signing secret and view decryption secret absent from proof witness',
  encryption: 'pinned Aztec5.3 Grumpkin ECDH/Poseidon2 internal KDF/AES128-CBC-PKCS7; standardPoseidonH2 note/packet commitments',
  preserved: 'all scopes,keys,key epochs,life generation,resources,shared clock,pending=0,and all typed state roots', tags: Object.fromEntries(Object.entries(TAG).map(([key, value]) => [key, String(value)])) });
export const RULES_COMMITMENT = keccak256(toHex(JSON.stringify(SPEC)));
export const RULES_HI = BigInt(RULES_COMMITMENT) >> 128n;
export const RULES_LO = BigInt(RULES_COMMITMENT) & ((1n << 128n) - 1n);
export const PROGRAM_ID = H(TAG.program, VERSION);
const requireValue = (condition, message = 'Invalid private account record') => { if (!condition) throw new TypeError(message); };
export function shape(value, keys) {
  requireValue(value && Object.getPrototypeOf(value) === Object.prototype, 'Plain typed record required');
  const actual = Reflect.ownKeys(value); requireValue(actual.length === keys.length && keys.every(key => Object.hasOwn(value, key)), 'Exact record fields required');
  for (const key of actual) { const descriptor = Object.getOwnPropertyDescriptor(value, key);
    requireValue(typeof key === 'string' && keys.includes(key) && descriptor.enumerable && Object.hasOwn(descriptor, 'value'), 'Data fields only'); }
}
export function finiteResourceBits(value) {
  const bits = uint(value, RESOURCE_MASK); requireValue(((bits >> 52n) & 2047n) !== 2047n, 'Nonnegative finite binary64 required'); return bits;
}
export function resourceBits(value) {
  requireValue(typeof value === 'number' && Number.isFinite(value) && value >= 0 && !Object.is(value, -0), 'Nonnegative finite Number required');
  const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, value, false); return finiteResourceBits(view.getBigUint64(0, false));
}
export function packResources(values) {
  shape(values, RESOURCE_FIELDS); let packed = 0n;
  RESOURCE_FIELDS.forEach((key, index) => { packed |= finiteResourceBits(values[key]) << (63n * BigInt(index)); });
  requireValue(packed < PACKED_LIMIT && PACKED_LIMIT < FIELD); return packed;
}
export function unpackResources(value) {
  let packed = uint(value, PACKED_LIMIT - 1n); const resources = {};
  for (const key of RESOURCE_FIELDS) { resources[key] = finiteResourceBits(packed & RESOURCE_MASK); packed >>= 63n; }
  requireValue(packed === 0n); return resources;
}
export function canonicalRecord(value) {
  shape(value, HEADER_FIELDS); const out = {};
  for (const key of HEADER_FIELDS) out[key] = field(value[key]);
  requireValue(out.version === VERSION, 'Unsupported account record version');
  out.accountScope = scalar(out.accountScope); out.lifeScope = scalar(out.lifeScope);
  out.lifeGeneration = uint(out.lifeGeneration, U64);
  const auth = point({ x: out.authPkX, y: out.authPkY }), view = point({ x: out.viewPkX, y: out.viewPkY });
  requireValue(auth.x !== view.x || auth.y !== view.y, 'Authorization and viewing keys must differ');
  out.authEpoch = uint(out.authEpoch, U32); out.viewEpoch = uint(out.viewEpoch, U32); out.noteSeq = uint(out.noteSeq, U64);
  unpackResources(out.packedResources); out.sharedLastAccruedAtMs = uint(out.sharedLastAccruedAtMs, MAX_SOURCE_TIME);
  requireValue(out.pendingMarker === 0n, 'Pending or locked records cannot rewrap');
  for (const key of ROOT_FIELDS) out[key] = scalar(out[key]);
  out.noteSeed = scalar(out.noteSeed); out.noteBlind = scalar(out.noteBlind);
  requireValue(out.noteSeed !== out.noteBlind, 'Purpose-separated note secrets required'); return out;
}
export function recordFields(value) { const record = canonicalRecord(value); return HEADER_FIELDS.map(name => record[name]); }
export function recordFromFields(values) {
  requireValue(Array.isArray(values) && values.length === HEADER_FIELDS.length, 'Exact26-field snapshot required');
  return canonicalRecord(Object.fromEntries(HEADER_FIELDS.map((name, index) => [name, values[index]])));
}
export function recordCommitment(domain, value) { return scalar(fold(TAG.record, scalar(domain), recordFields(value))); }
export const recordLeaf = (domain, commitment) => H(TAG.leaf, H(scalar(domain), scalar(commitment)));
export function preservedEnvelopeDigest(domain, value) {
  const record = canonicalRecord(value);
  const preserved = HEADER_FIELDS.filter(name => !['noteSeq', 'packedResources', 'sharedLastAccruedAtMs', 'noteSeed', 'noteBlind'].includes(name));
  return scalar(fold(TAG.preserved, scalar(domain), preserved.map(name => record[name])));
}
export function deploymentDomain(chainId, address, manifestHash) {
  const chain = scalar(chainId); requireValue(typeof address === 'string' && /^0x[0-9a-f]{40}$/.test(address) && BigInt(address) !== 0n);
  requireValue(typeof manifestHash === 'string' && /^0x[0-9a-f]{64}$/.test(manifestHash) && BigInt(manifestHash) !== 0n);
  const manifest = BigInt(manifestHash); return scalar(H(TAG.domain, H(H(chain, BigInt(address)), H(manifest >> 128n, manifest & ((1n << 128n) - 1n)))));
}
export function rolloverStatement(request) {
  shape(request, ['domain', 'oldRoot', 'oldRecord', 'expiry', 'newSeed', 'newBlind']);
  const { domain, oldRoot, oldRecord, expiry, newSeed, newBlind } = request;
  const record = canonicalRecord(oldRecord), d = scalar(domain), root = scalar(oldRoot), deadline = uint(expiry, U64);
  requireValue(deadline > 0n && record.noteSeq < U64, 'Expiry/sequence exhausted');
  const seed = scalar(newSeed), blind = scalar(newBlind);
  requireValue(seed !== blind && seed !== record.noteSeed && blind !== record.noteBlind, 'Fresh distinct output note secrets required');
  const oldCommitment = recordCommitment(d, record), nf = scalar(H(TAG.nullifier, H(d, H(record.noteSeed, oldCommitment))));
  const next = canonicalRecord({ ...record, noteSeq: record.noteSeq + 1n, noteSeed: seed, noteBlind: blind });
  const output = recordCommitment(d, next), preserved = preservedEnvelopeDigest(d, record);
  const plaintext = [VERSION, oldCommitment, next.noteSeq, record.packedResources, record.sharedLastAccruedAtMs, seed, blind, preserved];
  const message = scalar(fold(TAG.message, d, [oldCommitment, root, nf, next.noteSeq, seed, blind, PROGRAM_ID, RULES_HI, RULES_LO, deadline]));
  return { domain: d, root, old: record, next, oldCommitment, nullifier: nf, outputCommitment: output, expiry: deadline,
    plaintext, preservedEnvelopeDigest: preserved, message };
}
export function recoverDelta(domain, oldRecord, fields, expectedOutput) {
  requireValue(Array.isArray(fields) && fields.length === 8, 'Exact8-field resource delta required');
  const values = fields.map(field), record = canonicalRecord(oldRecord);
  requireValue(values[0] === VERSION && values[1] === recordCommitment(domain, record), 'Wrong delta version/old record');
  requireValue(values[2] === record.noteSeq + 1n && values[2] <= U64, 'Wrong delta sequence');
  requireValue(values[3] === record.packedResources && values[4] === record.sharedLastAccruedAtMs, 'Rewrap changes resources/shared clock');
  requireValue(values[7] === preservedEnvelopeDigest(domain, record), 'Rewrap changes preserved envelope');
  requireValue(values[5] !== record.noteSeed && values[6] !== record.noteBlind, 'Output note secrets were reused');
  const next = canonicalRecord({ ...record, noteSeq: values[2], noteSeed: values[5], noteBlind: values[6] });
  requireValue(recordCommitment(domain, next) === scalar(expectedOutput), 'Recovered record differs from verified output'); return next;
}
export const initialApprovalLeaf = (domain, sourceImportId, recordC, snapshotDigest) => scalar(fold(TAG.approval,
  scalar(domain), [scalar(sourceImportId), scalar(recordC), scalar(snapshotDigest)]));
