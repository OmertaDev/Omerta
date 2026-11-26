import { H, ROOT_FIELDS, VERSION, canonicalRecord, packResources, resourceBits, rolloverStatement, recordCommitment, recordLeaf } from './record.mjs';
import { freshScalar } from '../verifiable-note-encryption/encryption.mjs';
export function syntheticRecord(domain, owner, overrides = {}) {
  const auth = owner.authorizationPublicKey, view = owner.viewingPublicKey;
  return canonicalRecord({ version: VERSION, accountScope: freshScalar(), lifeScope: freshScalar(), lifeGeneration: 0n,
    authPkX: auth.x, authPkY: auth.y, authEpoch: 2n, viewPkX: view.x, viewPkY: view.y, viewEpoch: 3n, noteSeq: 0n,
    packedResources: packResources({ energy: resourceBits(50.125), nerve: resourceBits(10.5), health: resourceBits(99.75), heat: resourceBits(37.625) }),
    sharedLastAccruedAtMs: 1763200000123n, pendingMarker: 0n,
    ...Object.fromEntries(ROOT_FIELDS.map((name, i) => [name, H(domain, 9100n + BigInt(i))])),
    noteSeed: freshScalar(), noteBlind: freshScalar(), ...overrides });
}
export async function signedFixture(domain, record, owner, encryption, expiry = 1800000000n) {
  const commitment = recordCommitment(domain, record), root = recordLeaf(domain, commitment);
  const request = { domain, oldRoot: root, oldRecord: record, expiry, newSeed: freshScalar(), newBlind: freshScalar() };
  const statement = rolloverStatement(request), signature = await owner.sign(statement.message);
  const encrypted = await encryption.encryptFields({ domain, purpose: 'delta', recipientKey: owner.viewingPublicKey, fields: statement.plaintext });
  return { request, statement, signature, encrypted, membership: { root, index: 0, siblings: [] } };
}
