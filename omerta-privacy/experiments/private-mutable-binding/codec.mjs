// Experimental internal framing only; this verifies no proof or action authority.
// Allocation SHA256: fc51e2255b2e9079cddd2c3bfa1eae5840e0d95f53c1de22893ee93ff718bacc.
// Native implementation and differential-vector qualification remain separate.
import {keccak_256} from '@noble/hashes/sha3';
import {types} from 'node:util';
import {ownBytes} from '../private-mutable-envelope-codec/bytes.mjs';

export const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const FAMILY = 2120000n, VERSION = 1n, CONTEXT_BYTES = 640;
const U64_MAX = (1n << 64n) - 1n, U128_MAX = (1n << 128n) - 1n;
const COUNT_LIMIT = 1n << 32n;
export const CONTEXT_FIELDS = Object.freeze([
  'family', 'version', 'domain', 'noteRoot', 'spentNullifier', 'outputLeaf',
  'currentOldRoot', 'currentOldCount', 'currentNewRoot', 'currentNewCount',
  'currentDigestHi128', 'currentDigestLo128',
  'fullEnvelopeDigestHi128', 'fullEnvelopeDigestLo128',
  'ownerHeaderSuiteC', 'ownerHeaderPacketDigestFr',
  'validFromSeconds', 'validUntilSeconds', 'privacyClassHi128', 'privacyClassLo128'
]);
const NONZERO_FR = Object.freeze([
  'domain', 'noteRoot', 'spentNullifier', 'outputLeaf',
  'currentOldRoot', 'currentNewRoot', 'ownerHeaderSuiteC'
]);
const LIMBS = Object.freeze([
  'currentDigestHi128', 'currentDigestLo128',
  'fullEnvelopeDigestHi128', 'fullEnvelopeDigestLo128',
  'privacyClassHi128', 'privacyClassLo128'
]);
const fail = code => { throw new TypeError(code); };

function data(input) {
  if (types.isProxy(input)) fail('OWN_DATA');
  if (!input || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) fail('OWN_DATA');
  const descriptors = Object.getOwnPropertyDescriptors(input), keys = Reflect.ownKeys(descriptors);
  if (keys.length !== CONTEXT_FIELDS.length || CONTEXT_FIELDS.some(key => !keys.includes(key))) fail('EXACT_FIELDS');
  const copy = {};
  for (const key of CONTEXT_FIELDS) {
    const descriptor = descriptors[key];
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail('OWN_DATA');
    copy[key] = descriptor.value;
  }
  return copy;
}

function uint(value, max) {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) fail('UINT');
    value = String(value);
  }
  if (typeof value === 'string') {
    if (value.length > 78 || !/^(0|[1-9][0-9]*)$/.test(value)) fail('UINT');
    value = BigInt(value);
  }
  if (typeof value !== 'bigint' || value < 0n || value > max) fail('UINT');
  return value;
}

function context(input) {
  const value = data(input);
  value.family = uint(value.family, (1n << 256n) - 1n);
  value.version = uint(value.version, (1n << 256n) - 1n);
  if (value.family !== FAMILY) fail('FAMILY');
  if (value.version !== VERSION) fail('VERSION');
  for (const key of NONZERO_FR) {
    value[key] = uint(value[key], FIELD - 1n);
    if (value[key] === 0n) fail('NONZERO_FR');
  }
  value.ownerHeaderPacketDigestFr = uint(value.ownerHeaderPacketDigestFr, FIELD - 1n);
  for (const key of LIMBS) value[key] = uint(value[key], U128_MAX);
  value.currentOldCount = uint(value.currentOldCount, COUNT_LIMIT - 1n);
  value.currentNewCount = uint(value.currentNewCount, COUNT_LIMIT);
  if (value.currentOldCount < 1n || value.currentNewCount < 2n
    || value.currentNewCount !== value.currentOldCount + 1n) fail('COUNTS');
  value.validFromSeconds = uint(value.validFromSeconds, U64_MAX);
  value.validUntilSeconds = uint(value.validUntilSeconds, U64_MAX);
  if (value.validFromSeconds >= value.validUntilSeconds) fail('WINDOW');
  return Object.freeze(value);
}

function putWord(bytes, offset, value) {
  for (let i = 31; i >= 0; i--, value >>= 8n) bytes[offset + i] = Number(value & 255n);
}
function word(bytes, offset) {
  let value = 0n;
  for (let i = 0; i < 32; i++) value = (value << 8n) | BigInt(bytes[offset + i]);
  return value;
}

export function encodeContext(input) {
  const value = context(input), bytes = new Uint8Array(CONTEXT_BYTES);
  CONTEXT_FIELDS.forEach((key, index) => putWord(bytes, index * 32, value[key]));
  return bytes;
}

export function decodeContext(input) {
  if (types.isProxy(input)) fail('OWN_DATA');
  const bytes = ownBytes(input, CONTEXT_BYTES);
  const value = context(Object.fromEntries(CONTEXT_FIELDS.map((key, index) => [key, word(bytes, index * 32)])));
  const hex = '0x' + Array.from(keccak_256(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
  const digestValue = BigInt(hex), hi128 = digestValue >> 128n, lo128 = digestValue & U128_MAX;
  return Object.freeze({
    context: value,
    digest: Object.freeze({kind: 'opaque-keccak256-bytes32', hex, hi128, lo128}),
    proofPublicInputs: Object.freeze([value.domain, hi128, lo128]),
    currentPublicInputs: Object.freeze([
      value.domain, value.currentOldRoot, value.currentOldCount,
      value.currentNewRoot, value.currentNewCount, value.currentDigestHi128, value.currentDigestLo128
    ]),
    assurance: Object.freeze({
      framingOnly: true, proofVerified: false, ownerSignatureVerified: false,
      currentStateVerified: false, timeValidityVerified: false, sourcePolicyVerified: false,
      backingVerified: false, encryptionVerified: false, archiveComplete: false,
      actionAccepted: false, production: false
    })
  });
}
