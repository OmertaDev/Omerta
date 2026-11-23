// Isolated unaudited conformance adapter, not an application encryption suite.
// Official bb.js does ECC and Poseidon2; native WebCrypto does AES-CBC/PKCS7.
// Standard Poseidon arity2 remains a distinct note/tree/packet commitment.
import { Barretenberg, BackendType, GRUMPKIN_G1_GENERATOR } from '@aztec/bb.js';
import { poseidon2 as poseidonArityTwo } from 'poseidon-lite';

export const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const MAX_U64 = (1n << 64n) - 1n;
export const PACKET_BYTES = 336;
export const PAYLOAD_FIELDS = Object.freeze(['owner_key_hash', 'identity_commitment', 'generation', 'resource_micros',
  'muscle', 'next_seed', 'next_blind', 'extra_state']);
const requireValue = (value, message) => { if (!value) throw new TypeError(message); };
export function uint(value, maximum) {
  requireValue(typeof value === 'bigint' || typeof value === 'string' || Number.isSafeInteger(value), 'Exact integer required');
  requireValue(/^(0|[1-9][0-9]*)$/.test(String(value)), 'Canonical integer required');
  const n = BigInt(value); requireValue(n <= maximum, 'Noncanonical/out-of-range integer'); return n;
}
export const field = value => uint(value, FIELD - 1n);
export const scalar = value => { const n = field(value); requireValue(n !== 0n, 'Nonzero canonical Fr scalar required'); return n; };
export function toBytes32(value) {
  let n = field(value); const out = new Uint8Array(32);
  for (let i = 31; i >= 0; --i) { out[i] = Number(n & 255n); n >>= 8n; } return out;
}
export function fromBytes(bytes) {
  requireValue(bytes instanceof Uint8Array, 'Uint8Array required');
  let value = 0n; for (const byte of bytes) value = value * 256n + BigInt(byte); return value;
}
export function point(value) {
  requireValue(value && typeof value === 'object', 'Point required');
  const x = field(value.x), y = field(value.y);
  requireValue((x !== 0n || y !== 0n) && (y * y - x * x * x + 17n) % FIELD === 0n, 'Invalid/infinity Grumpkin point');
  return { x, y };
}
function schema(object, keys) {
  requireValue(object && typeof object === 'object' && !Array.isArray(object), 'Typed object required');
  requireValue(Object.keys(object).sort().join(',') === [...keys].sort().join(','), 'Exact typed schema required');
}
export function payload(value) {
  schema(value, PAYLOAD_FIELDS); const out = {};
  for (const key of PAYLOAD_FIELDS) out[key] = key === 'generation' || key === 'resource_micros' ? uint(value[key], MAX_U64)
    : key === 'muscle' ? uint(value[key], 2147483647n) : field(value[key]);
  requireValue(out.owner_key_hash !== 0n && out.next_seed !== 0n && out.next_blind !== 0n, 'Nonzero note credential/seed/blind required');
  return out;
}
export const H = (a, b) => field(poseidonArityTwo([field(a), field(b)]));
export function fold(tag, domain, values) { let acc = H(tag, domain); for (const value of values) acc = H(acc, value); return acc; }
export function inputNote(value) {
  schema(value, ['owner_key_hash', 'identity_commitment', 'generation', 'encryption_key', 'blind']);
  const out = { owner_key_hash: scalar(value.owner_key_hash), identity_commitment: field(value.identity_commitment),
    generation: uint(value.generation, MAX_U64 - 1n), encryption_key: point(value.encryption_key), blind: scalar(value.blind) };
  return out;
}
export function inputNoteCommitment(domain, value) {
  const n = inputNote(value); return fold(2002001n, domain, [n.owner_key_hash, n.identity_commitment, n.generation,
    n.encryption_key.x, n.encryption_key.y, n.blind]);
}
export const inputNoteLeaf = (domain, note) => H(2002002n, H(domain, inputNoteCommitment(domain, note)));
function encodePayload(value) {
  const p = payload(value), bytes = new Uint8Array(256);
  PAYLOAD_FIELDS.forEach((key, i) => bytes.set(toBytes32(p[key]), i * 32)); return bytes;
}
function decodePayload(bytes) {
  requireValue(bytes instanceof Uint8Array && bytes.length === 256, 'Exact plaintext size required');
  return payload(Object.fromEntries(PAYLOAD_FIELDS.map((key, i) => [key, fromBytes(bytes.slice(i * 32, (i + 1) * 32))])));
}
export function parsePacket(bytes) {
  requireValue(bytes instanceof Uint8Array && bytes.length === PACKET_BYTES, 'Exact fixed packet bytes required');
  return { ephemeral: point({ x: fromBytes(bytes.slice(0, 32)), y: fromBytes(bytes.slice(32, 64)) }), ciphertext: bytes.slice(64) };
}
export function packetDigest(domain, bytes) {
  const packet = parsePacket(bytes); let digest = fold(2002010n, domain, [1n, BigInt(PACKET_BYTES), packet.ephemeral.x, packet.ephemeral.y]);
  for (let i = 0; i < 17; i++) digest = H(digest, fromBytes(packet.ciphertext.slice(i * 16, (i + 1) * 16)));
  return digest;
}
export function outputNoteCommitment(domain, value, recipientKey, digest) {
  const p = payload(value), key = point(recipientKey);
  return H(fold(2002003n, domain, [...PAYLOAD_FIELDS.map(name => p[name]), key.x, key.y]), digest);
}
export function freshScalar() {
  // Uniform rejection sampling, independent of Poseidon2 and the note commitment.
  for (;;) { const bytes = crypto.getRandomValues(new Uint8Array(32)), n = fromBytes(bytes); if (n > 0n && n < FIELD) return n; }
}

export async function createEncryptionRuntime({ wasmPath } = {}) {
  const api = await Barretenberg.new({ backend: BackendType.Wasm, threads: 1, skipSrsInit: true, wasmPath });
  async function mul(p, sk) {
    const key = point(p); const { point: out } = await api.grumpkinMul({ point: { x: toBytes32(key.x), y: toBytes32(key.y) }, scalar: toBytes32(scalar(sk)) });
    return point({ x: fromBytes(out.x), y: fromBytes(out.y) });
  }
  const generator = { x: fromBytes(GRUMPKIN_G1_GENERATOR.x), y: fromBytes(GRUMPKIN_G1_GENERATOR.y) };
  const publicKey = sk => mul(generator, sk);
  async function derive(shared, domain) {
    // Byte-exact pinned upstream app/subkey Poseidon2 inputs and reverse-low-half extraction.
    const hash = async values => fromBytes((await api.poseidon2Hash({ inputs: values.map(toBytes32) })).hash);
    const app = await hash([1707851664n, shared.x, shared.y, field(domain)]);
    const one = toBytes32(await hash([4277646631n, app])), two = toBytes32(await hash([4277646632n, app]));
    return { key: Uint8Array.from({ length: 16 }, (_, i) => one[31 - i]), iv: Uint8Array.from({ length: 16 }, (_, i) => two[31 - i]) };
  }
  async function encrypt({ domain, note, output, ephemeralScalar = freshScalar() }) {
    const d = scalar(domain), n = inputNote(note), p = payload(output), esk = scalar(ephemeralScalar);
    requireValue(p.owner_key_hash === n.owner_key_hash && p.identity_commitment === n.identity_commitment
      && p.generation === n.generation + 1n, 'Output credential/identity/generation mismatch');
    const ephemeral = await publicKey(esk), shared = await mul(n.encryption_key, esk), derived = await derive(shared, d);
    const key = await crypto.subtle.importKey('raw', derived.key, { name: 'AES-CBC' }, false, ['encrypt']);
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv: derived.iv }, key, encodePayload(p)));
    requireValue(ciphertext.length === 272, 'Native AES-CBC must include the full PKCS7 block');
    const packet = new Uint8Array(PACKET_BYTES); packet.set(toBytes32(ephemeral.x)); packet.set(toBytes32(ephemeral.y), 32); packet.set(ciphertext, 64);
    const digest = packetDigest(d, packet), commitment = outputNoteCommitment(d, p, n.encryption_key, digest);
    return { packet, digest, commitment, ephemeral, ciphertext, ephemeralScalar: esk, output: p };
  }
  async function decrypt({ domain, packet, recipientSecret, expectedDigest, expectedCommitment }) {
    const d = scalar(domain), sk = scalar(recipientSecret), parsed = parsePacket(packet);
    const digest = packetDigest(d, packet); requireValue(digest === field(expectedDigest), 'Packet differs from the verified public digest');
    const keyPoint = await publicKey(sk), shared = await mul(parsed.ephemeral, sk), derived = await derive(shared, d);
    const key = await crypto.subtle.importKey('raw', derived.key, { name: 'AES-CBC' }, false, ['decrypt']);
    const plaintext = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CBC', iv: derived.iv }, key, parsed.ciphertext));
    const result = decodePayload(plaintext);
    requireValue(outputNoteCommitment(d, result, keyPoint, digest) === field(expectedCommitment), 'Decrypted note does not match the verified output commitment');
    return result;
  }
  return Object.freeze({ publicKey, encrypt, decrypt, destroy: () => api.destroy() });
}
