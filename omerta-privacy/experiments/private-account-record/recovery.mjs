import { createRecordEncryptionRuntime } from './encryption.mjs';
import { recordCommitment } from './record.mjs';
export async function recoverPublishedRecords({ domain, recipientSecret, publications }) {
  if (!Array.isArray(publications) || publications.length < 1 || publications[0].kind !== 0) throw new TypeError('Published full snapshot required before deltas');
  const encryption = await createRecordEncryptionRuntime();
  try {
    let record;
    for (let index = 0; index < publications.length; ++index) {
      const item = publications[index], options = { domain, packet: Uint8Array.from(item.packet), recipientSecret,
        expectedDigest: item.digest, expectedCommitment: item.commitment };
      if (index === 0) record = await encryption.decryptSnapshot(options);
      else {
        if (item.kind !== 1) throw new TypeError('Unexpected later snapshot or publication type');
        record = await encryption.decryptDelta({ ...options, oldRecord: record });
      }
    }
    return { record, commitment: recordCommitment(domain, record) };
  } finally { await encryption.destroy(); }
}
