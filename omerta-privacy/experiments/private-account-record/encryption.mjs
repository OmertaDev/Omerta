// New record codec; pinned ECDH/KDF/AES construction, distinct purpose domains.
// Owner view secret appears only in decrypt; delegated encryption uses public key.
import { Barretenberg, BackendType, GRUMPKIN_G1_GENERATOR } from '@aztec/bb.js';
import { point, scalar, field, freshScalar, toBytes32, fromBytes } from '../verifiable-note-encryption/encryption.mjs';
import { H, fold, TAG, recordFields, recordFromFields, recordCommitment, recoverDelta } from './record.mjs';
export const DELTA_PACKET_BYTES = 336, SNAPSHOT_PACKET_BYTES = 912;
const requireValue = (condition, message) => { if (!condition) throw new TypeError(message); };
function kind(value) {
  requireValue(value === 'snapshot' || value === 'delta', 'Exact encryption purpose required');
  return value === 'snapshot' ? { fields: 26, bytes: SNAPSHOT_PACKET_BYTES, kdf: TAG.snapshotKdf, digest: TAG.snapshotPacket }
    : { fields: 8, bytes: DELTA_PACKET_BYTES, kdf: TAG.deltaKdf, digest: TAG.deltaPacket };
}
export function parseRecordPacket(purpose, bytes) {
  const spec = kind(purpose); requireValue(bytes instanceof Uint8Array && bytes.length === spec.bytes, 'Exact typed packet length required');
  return { ephemeral: point({ x: fromBytes(bytes.slice(0, 32)), y: fromBytes(bytes.slice(32, 64)) }), ciphertext: bytes.slice(64) };
}
export function recordPacketDigest(domain, purpose, bytes) {
  const spec = kind(purpose), packet = parseRecordPacket(purpose, bytes);
  let digest = fold(spec.digest, scalar(domain), [1n, BigInt(spec.bytes), packet.ephemeral.x, packet.ephemeral.y]);
  for (let i = 0; i < packet.ciphertext.length; i += 16) digest = H(digest, fromBytes(packet.ciphertext.slice(i, i + 16)));
  return scalar(digest);
}
export async function createRecordEncryptionRuntime() {
  // Explicit in-process WASM matches the frozen browser conformance. Worker
  // asset packaging is a separate frontend concern, never a CLI/native fallback.
  const api = await Barretenberg.new({ backend: BackendType.Wasm, threads: 1, skipSrsInit: true });
  const generator = { x: fromBytes(GRUMPKIN_G1_GENERATOR.x), y: fromBytes(GRUMPKIN_G1_GENERATOR.y) };
  async function mul(value, secret) {
    const p = point(value); const { point: result } = await api.grumpkinMul({ point: { x: toBytes32(p.x), y: toBytes32(p.y) }, scalar: toBytes32(scalar(secret)) });
    return point({ x: fromBytes(result.x), y: fromBytes(result.y) });
  }
  const publicKey = secret => mul(generator, secret);
  async function derive(shared, purpose, domain) {
    const spec = kind(purpose), applicationDomain = H(spec.kdf, scalar(domain));
    const hash = async values => fromBytes((await api.poseidon2Hash({ inputs: values.map(toBytes32) })).hash);
    const app = await hash([1707851664n, shared.x, shared.y, applicationDomain]);
    const a = toBytes32(await hash([4277646631n, app])), b = toBytes32(await hash([4277646632n, app]));
    return { key: Uint8Array.from({ length: 16 }, (_, i) => a[31 - i]), iv: Uint8Array.from({ length: 16 }, (_, i) => b[31 - i]) };
  }
  async function encryptFields({ domain, purpose, recipientKey, fields, ephemeralScalar = freshScalar() }) {
    const spec = kind(purpose); requireValue(Array.isArray(fields) && fields.length === spec.fields, 'Exact typed plaintext fields required');
    const values = fields.map(field), secret = scalar(ephemeralScalar), recipient = point(recipientKey);
    const ephemeral = await publicKey(secret), shared = await mul(recipient, secret), derived = await derive(shared, purpose, domain);
    const plaintext = new Uint8Array(32 * values.length); values.forEach((value, i) => plaintext.set(toBytes32(value), i * 32));
    const key = await crypto.subtle.importKey('raw', derived.key, 'AES-CBC', false, ['encrypt']);
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv: derived.iv }, key, plaintext));
    const packet = new Uint8Array(spec.bytes); requireValue(ciphertext.length + 64 === packet.length, 'Full PKCS7 block required');
    packet.set(toBytes32(ephemeral.x)); packet.set(toBytes32(ephemeral.y), 32); packet.set(ciphertext, 64);
    return { packet, digest: recordPacketDigest(domain, purpose, packet), ephemeral, ciphertext, ephemeralScalar: secret, plaintextFields: values };
  }
  async function decryptFields({ domain, purpose, packet, recipientSecret, expectedDigest }) {
    const spec = kind(purpose), parsed = parseRecordPacket(purpose, packet);
    requireValue(recordPacketDigest(domain, purpose, packet) === scalar(expectedDigest), 'Packet differs from confirmed digest');
    const secret = scalar(recipientSecret), shared = await mul(parsed.ephemeral, secret), derived = await derive(shared, purpose, domain);
    const key = await crypto.subtle.importKey('raw', derived.key, 'AES-CBC', false, ['decrypt']);
    const plaintext = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CBC', iv: derived.iv }, key, parsed.ciphertext));
    requireValue(plaintext.length === spec.fields * 32, 'Wrong plaintext/padding length');
    return Array.from({ length: spec.fields }, (_, i) => field(fromBytes(plaintext.slice(32 * i, 32 * i + 32))));
  }
  async function encryptSnapshot(domain, record) {
    const fields = recordFields(record); return encryptFields({ domain, purpose: 'snapshot', recipientKey: { x: record.viewPkX, y: record.viewPkY }, fields });
  }
  async function decryptSnapshot({ domain, packet, recipientSecret, expectedDigest, expectedCommitment }) {
    const fields = await decryptFields({ domain, purpose: 'snapshot', packet, recipientSecret, expectedDigest });
    const record = recordFromFields(fields), key = await publicKey(recipientSecret);
    requireValue(record.viewPkX === key.x && record.viewPkY === key.y, 'Snapshot embeds another recipient key');
    requireValue(recordCommitment(domain, record) === scalar(expectedCommitment), 'Snapshot differs from approved record'); return record;
  }
  async function decryptDelta({ domain, oldRecord, packet, recipientSecret, expectedDigest, expectedCommitment }) {
    const key = await publicKey(recipientSecret);
    requireValue(BigInt(oldRecord.viewPkX) === key.x && BigInt(oldRecord.viewPkY) === key.y, 'Wrong old-record viewing key');
    return recoverDelta(domain, oldRecord, await decryptFields({ domain, purpose: 'delta', packet, recipientSecret, expectedDigest }), expectedCommitment);
  }
  return Object.freeze({ publicKey, encryptFields, decryptFields, encryptSnapshot, decryptSnapshot, decryptDelta, destroy: () => api.destroy() });
}
