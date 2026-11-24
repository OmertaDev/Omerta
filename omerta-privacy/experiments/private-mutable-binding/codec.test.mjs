import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {keccak_256} from '@noble/hashes/sha3';
import {CONTEXT_BYTES, CONTEXT_FIELDS, FAMILY, FIELD, VERSION, decodeContext, encodeContext} from './codec.mjs';

// HOST-only controls, not native golden vectors or proof/authority qualification.
const U64_MAX = (1n << 64n) - 1n, U128_MAX = (1n << 128n) - 1n;
const fields = [
  'family', 'version', 'domain', 'noteRoot', 'spentNullifier', 'outputLeaf',
  'currentOldRoot', 'currentOldCount', 'currentNewRoot', 'currentNewCount',
  'currentDigestHi128', 'currentDigestLo128', 'fullEnvelopeDigestHi128', 'fullEnvelopeDigestLo128',
  'ownerHeaderSuiteC', 'ownerHeaderPacketDigestFr', 'validFromSeconds', 'validUntilSeconds',
  'privacyClassHi128', 'privacyClassLo128'
];
const input = () => ({
  family: 2120000n, version: 1n, domain: 3n, noteRoot: 4n, spentNullifier: 5n, outputLeaf: 6n,
  currentOldRoot: 7n, currentOldCount: 8n, currentNewRoot: 9n, currentNewCount: 9n,
  currentDigestHi128: 11n, currentDigestLo128: 12n,
  fullEnvelopeDigestHi128: 13n, fullEnvelopeDigestLo128: 14n,
  ownerHeaderSuiteC: 15n, ownerHeaderPacketDigestFr: 16n,
  validFromSeconds: 17n, validUntilSeconds: 18n, privacyClassHi128: 19n, privacyClassLo128: 20n
});
const hex = bytes => '0x' + Buffer.from(bytes).toString('hex');
const abiWords = value => Uint8Array.from(Buffer.from(fields.map(key => value[key].toString(16).padStart(64, '0')).join(''), 'hex'));
function replacedWord(bytes, index, value) {
  const copy = new Uint8Array(bytes);
  copy.set(Uint8Array.from(Buffer.from(value.toString(16).padStart(64, '0'), 'hex')), index * 32);
  return copy;
}
const refusesBoth = value => {
  assert.throws(() => encodeContext(value), TypeError);
  assert.throws(() => decodeContext(abiWords(value)), TypeError);
};

test('encodes all20 allocated words in the exact independent ABI word order', () => {
  const value = input(), encoded = encodeContext(value);
  assert.deepEqual(CONTEXT_FIELDS, fields);
  assert.equal(CONTEXT_BYTES, 640);
  assert.equal(FAMILY, 2120000n);
  assert.equal(VERSION, 1n);
  assert.deepEqual(encoded, abiWords(value));
  assert.deepEqual(decodeContext(encoded).context, value);
  const orderedDifferently = Object.fromEntries(Object.entries(value).reverse());
  assert.deepEqual(encodeContext(orderedDifferently), encoded);
});

test('hashes exactly640 raw bytes with EthereumKeccak and lossless public digest limbs', () => {
  const encoded = encodeContext(input()), decoded = decodeContext(encoded);
  assert.equal(decoded.digest.hex, hex(keccak_256(abiWords(input()))));
  assert.equal(decoded.digest.kind, 'opaque-keccak256-bytes32');
  assert.equal((decoded.digest.hi128 << 128n) | decoded.digest.lo128, BigInt(decoded.digest.hex));
  assert.deepEqual(decoded.proofPublicInputs, [input().domain, decoded.digest.hi128, decoded.digest.lo128]);
  // Find a deterministic above-Fr digest; moduloFr would lose its high bits.
  let above;
  for (let n = 1n; n <= 64n; n++) {
    const result = decodeContext(encodeContext({...input(), domain: n}));
    if (BigInt(result.digest.hex) >= FIELD) { above = result; break; }
  }
  assert.ok(above);
  assert.equal((above.proofPublicInputs[1] << 128n) | above.proofPublicInputs[2], BigInt(above.digest.hex));
  assert.notEqual(BigInt(above.digest.hex), BigInt(above.digest.hex) % FIELD);
});

test('binds all20 word positions to the digest and refuses changed constants', () => {
  const encoded = encodeContext(input()), expected = decodeContext(encoded).digest.hex;
  for (let index = 0; index < fields.length; index++) {
    const value = input();
    value[fields[index]] += 1n;
    if (index < 2 || fields[index] === 'currentOldCount' || fields[index] === 'currentNewCount'
      || fields[index] === 'validFromSeconds') {
      assert.throws(() => decodeContext(abiWords(value)), TypeError);
    } else {
      assert.notEqual(decodeContext(abiWords(value)).digest.hex, expected, fields[index]);
    }
    assert.notEqual(hex(keccak_256(replacedWord(encoded, index, value[fields[index]]))), expected);
  }
});

test('accepts exact count boundaries including a new count of2^32', () => {
  for (const [oldCount, newCount] of [[1n, 2n], [(1n << 32n) - 1n, 1n << 32n]]) {
    const value = {...input(), currentOldCount: oldCount, currentNewCount: newCount};
    assert.deepEqual(decodeContext(encodeContext(value)).context, value);
  }
  for (const [oldCount, newCount] of [[0n, 1n], [1n, 1n], [1n, 3n], [1n << 32n, (1n << 32n) + 1n],
    [(1n << 32n) - 1n, 0n], [(1n << 32n) - 1n, (1n << 32n) + 1n]]) {
    refusesBoth({...input(), currentOldCount: oldCount, currentNewCount: newCount});
  }
});

test('enforces ordered u64 windows without inventing acceptedAt or duration policy', () => {
  for (const [from, until] of [[0n, 1n], [U64_MAX - 1n, U64_MAX], [0n, U64_MAX]]) {
    const value = {...input(), validFromSeconds: from, validUntilSeconds: until};
    assert.deepEqual(decodeContext(encodeContext(value)).context, value);
  }
  for (const [from, until] of [[0n, 0n], [9n, 8n], [U64_MAX, U64_MAX], [0n, U64_MAX + 1n],
    [U64_MAX + 1n, U64_MAX + 2n]]) refusesBoth({...input(), validFromSeconds: from, validUntilSeconds: until});
  assert.throws(() => encodeContext({...input(), acceptedAtSeconds: 17n}), TypeError);
});

test('enforces each Fr bound and each allocated nonzero field independently', () => {
  const nonzero = ['domain', 'noteRoot', 'spentNullifier', 'outputLeaf', 'currentOldRoot', 'currentNewRoot', 'ownerHeaderSuiteC'];
  for (const key of [...nonzero, 'ownerHeaderPacketDigestFr']) {
    const value = {...input(), [key]: FIELD - 1n};
    assert.deepEqual(decodeContext(encodeContext(value)).context, value);
    refusesBoth({...input(), [key]: FIELD});
    refusesBoth({...input(), [key]: (1n << 256n) - 1n});
  }
  for (const key of nonzero) refusesBoth({...input(), [key]: 0n});
  const value = {...input(), ownerHeaderPacketDigestFr: 0n};
  assert.equal(decodeContext(encodeContext(value)).context.ownerHeaderPacketDigestFr, 0n);
});

test('accepts zero and maximal u128 limbs and refuses every limb overflow', () => {
  for (const key of ['currentDigestHi128', 'currentDigestLo128', 'fullEnvelopeDigestHi128',
    'fullEnvelopeDigestLo128', 'privacyClassHi128', 'privacyClassLo128']) {
    for (const n of [0n, U128_MAX]) {
      const value = {...input(), [key]: n};
      assert.deepEqual(decodeContext(encodeContext(value)).context, value);
    }
    refusesBoth({...input(), [key]: U128_MAX + 1n});
    assert.throws(() => encodeContext({...input(), [key]: -1n}), TypeError);
  }
});

test('refuses malformed lengths, trailing bytes and unsupported byte containers', () => {
  const encoded = encodeContext(input());
  for (const size of [0, 32, 639, 641, 672]) assert.throws(() => decodeContext(new Uint8Array(size)), TypeError);
  for (const value of [hex(encoded), [...encoded], new DataView(encoded.buffer), new Uint16Array(320),
    Object.create(Uint8Array.prototype)]) assert.throws(() => decodeContext(value), TypeError);
  assert.throws(() => decodeContext(new Uint8Array(new SharedArrayBuffer(640))), TypeError);
  class Bytes extends Uint8Array {}
  assert.throws(() => decodeContext(new Bytes(encoded)), TypeError);
});

test('refuses noncanonical primitive inputs without coercing caller objects', () => {
  let calls = 0;
  const coercible = {valueOf() { calls++; return 3n; }, toString() { calls++; return '3'; }};
  for (const value of [coercible, new Number(3), null, undefined, true, 3.5, Number.MAX_SAFE_INTEGER + 1,
    -0, -1n, '03', '0x03', '+3', '-0', '3 ', '', '9'.repeat(79)]) {
    assert.throws(() => encodeContext({...input(), domain: value}), TypeError);
  }
  assert.equal(calls, 0);
  assert.deepEqual(decodeContext(encodeContext(Object.fromEntries(Object.entries(input()).map(([k, v]) => [k, String(v)])))).context, input());
  assert.deepEqual(decodeContext(encodeContext(Object.fromEntries(Object.entries(input()).map(([k, v]) => [k, Number(v)])))).context, input());
});

test('requires exact own-data fields and never reads input accessors', () => {
  let reads = 0;
  const accessor = input();
  Object.defineProperty(accessor, 'domain', {get() { reads++; return 3n; }, enumerable: true});
  assert.throws(() => encodeContext(accessor), TypeError);
  assert.equal(reads, 0);
  const missing = input(); delete missing.noteRoot;
  const hidden = input(); Object.defineProperty(hidden, 'domain', {value: 3n, enumerable: false});
  for (const value of [missing, hidden, {...input(), extra: 1}, {...input(), [Symbol('extra')]: 1},
    Object.create(input()), {...input(), family: 0n}, {...input(), version: 2n}]) {
    assert.throws(() => encodeContext(value), TypeError);
  }
  assert.deepEqual(decodeContext(encodeContext(Object.assign(Object.create(null), input()))).context, input());
});

test('owns exact byte windows and returns frozen scalar results without aliases', () => {
  const encoded = encodeContext(input()), backing = Buffer.alloc(642, 255), window = backing.subarray(1, 641);
  window.set(encoded);
  Object.defineProperty(window, 'length', {get() { throw Error('public length accessor'); }});
  Object.defineProperty(window, 'buffer', {get() { throw Error('public buffer accessor'); }});
  const decoded = decodeContext(window);
  backing.fill(0);
  assert.deepEqual(decoded.context, input());
  for (const value of [decoded, decoded.context, decoded.digest, decoded.proofPublicInputs, decoded.currentPublicInputs, decoded.assurance]) assert.ok(Object.isFrozen(value));
  assert.deepEqual(encodeContext(input()), encoded);
});

test('keeps every authority claim false despite valid experimental framing', () => {
  const decoded = decodeContext(encodeContext(input()));
  assert.equal(decoded.assurance.framingOnly, true);
  for (const [key, value] of Object.entries(decoded.assurance)) if (key !== 'framingOnly') assert.equal(value, false, key);
  assert.equal(Object.hasOwn(decoded, 'acceptedAtSeconds'), false);
  assert.equal(Object.hasOwn(decoded, 'sourceRulesHash'), false);
});


test('rejects Node Proxy inputs before caller-controlled traps', () => {
  let calls = 0;
  const traps = {getPrototypeOf() { calls++; throw Error('prototype trap'); },
    ownKeys() { calls++; throw Error('keys trap'); },
    getOwnPropertyDescriptor() { calls++; throw Error('descriptor trap'); },
    get() { calls++; throw Error('get trap'); }};
  assert.throws(() => encodeContext(new Proxy(input(), traps)), TypeError);
  assert.throws(() => decodeContext(new Proxy(encodeContext(input()), traps)), TypeError);
  const revocable = Proxy.revocable(input(), traps); revocable.revoke();
  assert.throws(() => encodeContext(revocable.proxy), TypeError);
  assert.equal(calls, 0);
});

// Frozen native-owned framing data; no native proof or action qualification.
const nativeFixtureBytes = readFileSync(new URL('./fixtures/CONTEXT-VECTORS.json', import.meta.url));
assert.equal(createHash('sha256').update(nativeFixtureBytes).digest('hex'),
  '002390294b938aa885846318cf04b2b0ae9dcdce82786814de1e00469cf3d37d');
const {vectors: nativeGoldens} = JSON.parse(nativeFixtureBytes);
for (const vector of nativeGoldens) {
  test(`matches frozen native-owned framing golden: ${vector.name}`, () => {
    const value = Object.fromEntries(Object.entries({family: vector.words[0], version: vector.words[1], ...vector.context}).map(([key, n]) => [key, BigInt(n)]));
    const encoded = encodeContext(value);
    assert.equal(hex(encoded), vector.encodedHex);
    const decoded = decodeContext(Uint8Array.from(Buffer.from(vector.encodedHex.slice(2), 'hex')));
    assert.deepEqual(decoded.context, value);
    assert.equal(decoded.digest.hex, vector.keccak256);
    assert.deepEqual(decoded.proofPublicInputs, vector.publicInputs.map(BigInt));
    assert.deepEqual(decoded.currentPublicInputs, vector.currentPublicInputs.map(BigInt));
    assert.equal((decoded.digest.hi128 << 128n) | decoded.digest.lo128, BigInt(vector.keccak256));
    assert.equal(decoded.assurance.actionAccepted, false);
  });
}
