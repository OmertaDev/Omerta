import { NoteVaultError, VAULT_LIMITS } from '../src/note-vault.mjs';
const copy = value => structuredClone(value);
const fail = code => { throw new NoteVaultError(code, 'Synthetic encrypted storage rejected the operation.'); };
// Test-only atomic adapter. Actual IndexedDB behavior is tested in a real Chrome process separately.
export class MemoryNoteStorage {
  header = null;
  records = new Map();
  check(header) { if (!this.header || JSON.stringify(this.header) !== header) fail('vault_conflict'); }
  async initialize(candidate) { this.header ||= copy(candidate); return copy(this.header); }
  async read(id, header) { this.check(header); return copy(this.records.get(id) ?? null); }
  async list(header) { this.check(header); return [...this.records.values()].map(copy); }
  async put(envelope, expected, header) {
    this.check(header);
    const existing = this.records.get(envelope.id);
    if ((existing ? JSON.stringify(existing) : null) !== expected) fail('vault_conflict');
    if (!existing && this.records.size >= VAULT_LIMITS.notes) fail('vault_limit');
    this.records.set(envelope.id, copy(envelope));
  }
  async remove(id, expected, header) {
    this.check(header);
    if (!this.records.has(id) || JSON.stringify(this.records.get(id)) !== expected) fail('vault_conflict');
    this.records.delete(id);
  }
  async restoreEmpty(records, header) {
    this.check(header); if (this.records.size) fail('vault_not_empty');
    if (records.length > VAULT_LIMITS.notes) fail('vault_limit');
    const next = new Map();
    for (const record of records) { if (next.has(record.id)) fail('vault_format'); next.set(record.id, copy(record)); }
    this.records = next;
  }
  close() {}
}

export const DOMAIN = Object.freeze({ version: 1, chainId: '4663',
  gameAddress: `0x${'12'.repeat(20)}`, programId: `0x${'34'.repeat(32)}` });
export function syntheticNote(sequence = 1) {
  return { witness: { syntheticOnly: true, privateState: ['7', '9', '11'], sequence },
    nullifierSecret: 'synthetic-not-a-user-secret', leafIndex: '9007199254740993' };
}
