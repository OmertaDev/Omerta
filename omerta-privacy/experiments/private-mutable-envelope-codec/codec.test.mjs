import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {decodeEnvelope, digestFromLimbs, digestLimbs, encodeEnvelope, FIELD, HEADER_BYTES, OWNER_OFFSET} from './codec.mjs';

// Frozen synthetic vectors independently exercised by the native framing tests.
// Ciphertext bytes are fixtures, not evidence of encryption or recipient authority.
const {vectors} = JSON.parse(readFileSync(new URL('./fixtures/DIFFERENTIAL-VECTORS.json', import.meta.url)));
const fromHex = value => Uint8Array.from(Buffer.from(value.slice(2), 'hex'));
const toHex = value => '0x' + Buffer.from(value).toString('hex');
const normalized = value => JSON.parse(JSON.stringify(value, (_, item) => typeof item === 'bigint' ? String(item) : item));
const first = vectors[0];
const envelope = () => fromHex(first.envelopeHex);
const input = () => ({
  policy: {...first.policy},
  header: {...first.header},
  headerPacket: fromHex(first.expected.headerPacketHex),
  ownerCipher: fromHex(first.expected.ownerCipherHex),
  controllerCipher: fromHex(first.expected.controllerCipherHex)
});
const word = (bytes, at, value) => {
  for (let i = 31; i >= 0; i--, value >>= 8n) bytes[at + i] = Number(value & 255n);
};

for (const vector of vectors) {
  test(`matches frozen envelope and digest vector: ${vector.id}`, () => {
    const decoded = decodeEnvelope({policy: vector.policy, envelope: fromHex(vector.envelopeHex)});
    assert.deepEqual(normalized(decoded), vector.expected);
    assert.equal(toHex(encodeEnvelope({
      policy: vector.policy,
      header: vector.header,
      headerPacket: fromHex(vector.expected.headerPacketHex),
      ownerCipher: fromHex(vector.expected.ownerCipherHex),
      controllerCipher: fromHex(vector.expected.controllerCipherHex)
    })), vector.envelopeHex);
  });
}

test('preserves opaque 256-bit digests losslessly, including values above Fr', () => {
  const digest = '0x' + 'ff'.repeat(32);
  assert.ok(BigInt(digest) > FIELD);
  const {hi128, lo128} = digestLimbs(digest);
  assert.equal(hi128, (1n << 128n) - 1n);
  assert.equal(lo128, (1n << 128n) - 1n);
  assert.equal(digestFromLimbs(hi128, lo128), digest);
  for (const invalid of [-1n, 1n << 128n, '01', '-0', 0.5]) {
    assert.throws(() => digestFromLimbs(invalid, 0n), TypeError);
    assert.throws(() => digestFromLimbs(0n, invalid), TypeError);
  }
  assert.throws(() => digestLimbs('0x' + 'FF'.repeat(32)), TypeError);
});

test('accepts zero Fr data without granting NOTE or action authority', () => {
  const value = input();
  value.header.outputLeaf = 0n;
  value.header.suiteC = 0n;
  value.header.headerDigestFr = 0n;
  const decoded = decodeEnvelope({policy: value.policy, envelope: encodeEnvelope(value)});
  assert.equal(decoded.header.outputLeaf, 0n);
  assert.equal(decoded.header.suiteC, 0n);
  assert.equal(decoded.header.headerDigestFr, 0n);
  assert.deepEqual(normalized(decoded.assurance), first.expected.assurance);
  for (const field of ['domain', 'spentNF']) {
    const invalid = input();
    invalid.header[field] = 0n;
    assert.throws(() => encodeEnvelope(invalid), /NONZERO_DOMAIN_NF/);
  }
  for (const field of Object.keys(value.header)) {
    const invalid = input();
    invalid.header[field] = FIELD;
    assert.throws(() => encodeEnvelope(invalid), TypeError);
  }
});

test('rejects malformed framing, policy and noncanonical Fr words', () => {
  for (const at of [0, 9, 10, 308, 319, 12, 44, 236, 268, 303, 307]) {
    const bytes = envelope();
    bytes[at] ^= 1;
    assert.throws(() => decodeEnvelope({policy: first.policy, envelope: bytes}), TypeError);
  }
  for (const at of [76, 108]) {
    const bytes = envelope();
    word(bytes, at, 0n);
    assert.throws(() => decodeEnvelope({policy: first.policy, envelope: bytes}), /NONZERO_DOMAIN_NF/);
  }
  for (const at of [76, 108, 140, 172, 204]) {
    const bytes = envelope();
    word(bytes, at, FIELD);
    assert.throws(() => decodeEnvelope({policy: first.policy, envelope: bytes}), TypeError);
  }
  assert.throws(() => decodeEnvelope({policy: first.policy, envelope: envelope().subarray(1)}), TypeError);
  assert.throws(() => decodeEnvelope({policy: first.policy, envelope: new Uint8Array(envelope().length + 1)}), TypeError);
});

test('requires exact own-data records without executing getters', () => {
  let reads = 0;
  const bad = {envelope: envelope(), get policy() { reads++; throw new Error('getter ran'); }};
  assert.throws(() => decodeEnvelope(bad), /OWN_DATA/);
  assert.equal(reads, 0);
  assert.throws(() => decodeEnvelope({policy: first.policy, envelope: envelope(), extra: true}), TypeError);
  assert.throws(() => decodeEnvelope(Object.assign(Object.create({inherited: true}), {
    policy: first.policy, envelope: envelope()
  })), TypeError);
  for (const value of ['01', '-0', '+1', ' 1', -0, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    const invalid = input();
    invalid.header.domain = value;
    assert.throws(() => encodeEnvelope(invalid), TypeError);
  }
});

test('owns byte windows and ignores poisoned public typed-array accessors', () => {
  let reads = 0;
  const bytes = envelope();
  const poison = () => { reads++; throw new Error('public accessor ran'); };
  Object.defineProperties(bytes, {
    length: {get: poison},
    buffer: {get: poison},
    [Symbol.iterator]: {get: poison}
  });
  const decoded = decodeEnvelope({policy: first.policy, envelope: bytes});
  assert.equal(reads, 0);
  bytes.fill(0);
  assert.equal(decoded.fullEnvelopeDigest.hex, first.expected.fullEnvelopeDigest.hex);
  assert.equal(decoded.ownerCipherHex, first.expected.ownerCipherHex);
  const value = input();
  const encoded = encodeEnvelope(value);
  value.headerPacket.fill(0);
  value.ownerCipher.fill(0);
  value.controllerCipher.fill(0);
  assert.equal(toHex(encoded), first.envelopeHex);
  assert.throws(() => decodeEnvelope({policy: first.policy, envelope: Array.from(envelope())}), TypeError);
  if (typeof SharedArrayBuffer !== 'undefined') {
    const shared = new Uint8Array(new SharedArrayBuffer(envelope().length));
    shared.set(envelope());
    assert.throws(() => decodeEnvelope({policy: first.policy, envelope: shared}), TypeError);
  }
});

test('keeps header packets and ciphertext opaque rather than authenticating them', () => {
  const bytes = envelope();
  bytes[HEADER_BYTES + 17] ^= 1;
  bytes[OWNER_OFFSET] ^= 1;
  const decoded = decodeEnvelope({policy: first.policy, envelope: bytes});
  assert.notEqual(decoded.fullEnvelopeDigest.hex, first.expected.fullEnvelopeDigest.hex);
  assert.notEqual(decoded.ownerSectionDigest.hex, first.expected.ownerSectionDigest.hex);
  assert.equal(decoded.assurance.framingOnly, true);
  for (const [name, accepted] of Object.entries(decoded.assurance)) {
    if (name !== 'framingOnly') assert.equal(accepted, false, name);
  }
});

test('rejects invalid or unavailable policy-sized byte windows before allocation', () => {
  for (const ownerCipherBytes of [64, 81, 0x100000000, -1, '01']) {
    assert.throws(() => decodeEnvelope({
      policy: {...first.policy, ownerCipherBytes}, envelope: envelope()
    }), TypeError);
  }
  assert.throws(() => decodeEnvelope({
    policy: {...first.policy, ownerCipherBytes: 0xfffffff0, controllerCipherBytes: 0xfffffff0},
    envelope: envelope()
  }), TypeError);
  for (const field of ['headerPacket', 'ownerCipher', 'controllerCipher']) {
    const value = input();
    value[field] = value[field].subarray(1);
    assert.throws(() => encodeEnvelope(value), TypeError);
  }
});
