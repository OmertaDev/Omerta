// Opt-in diagnostic fault for the separately declared 12h quiet world.
// No gameplay/RNG/eligibility rewrite and no general worker-error exemption.
import assert from 'node:assert/strict';
import { canonicalJson, sha256 } from './rc1-native-proof.js';
import { NPC_BOAT_INSERT } from './rc1-npc-boat-journal.js';

export const NPC_BOAT_FAULT_MESSAGE = 'RC1_BOAT_LATE_ABORT after original birth, cash receipt and boat write';
export const NPC_BOAT_FAULT_SQL = Object.freeze([
  'CREATE SEQUENCE rc1_boat_fault_seq',
  `CREATE FUNCTION rc1_boat_abort() RETURNS trigger LANGUAGE plpgsql AS $fault$ BEGIN
    IF nextval('rc1_boat_fault_seq')=1 THEN
      IF NEW.kind <> 'dinghy' OR NOT EXISTS(SELECT 1 FROM characters c JOIN account_persistent p ON p.account_id=c.account_id
        WHERE c.id=NEW.character_id AND c.is_npc AND p.npc_flag AND c.npc_seed=c.cash AND c.cash+c.bank=500+COALESCE((SELECT SUM(amount) FROM transactions WHERE character_id=c.id AND currency='cash'),0))
      THEN RAISE EXCEPTION 'Boat birth predecessors missing' USING ERRCODE='RNB02'; END IF;
      RAISE EXCEPTION '${NPC_BOAT_FAULT_MESSAGE}' USING ERRCODE='RNB01'; END IF; RETURN NEW; END $fault$`,
  'CREATE TRIGGER rc1_boat_abort AFTER INSERT ON boats FOR EACH ROW EXECUTE FUNCTION rc1_boat_abort()',
]);
export const NPC_BOAT_FAULT_CONTRACT = Object.freeze({ format: 1, hours: 12, population: 25, seed: 'rc1-alpha', policy: 'quiet_world',
  sqlSha256: sha256(canonicalJson(NPC_BOAT_FAULT_SQL)), failedInsertSha256: sha256(NPC_BOAT_INSERT),
  required: 'One actual RNB01 native INSERT attempt; exact resource rollback; two distinct canonical grants strictly later than its logical hourly deadline',
  scope: 'Original quiet-player names/setup/policy, serial original callbacks. Later grants are subsequent canonical birth attempts, not a retry of the aborted UUID or an idempotency receipt.',
  sequence: 'Prebaseline diagnostic sequence is nontransactional, remains installed and is retained in full snapshots. It is not a resource or reward.',
  exclusions: ['Full database rollback equivalence is not inferred from the resource projection', 'Unrelated errors are not accepted', 'Boat sale, death, NFT and compound branches remain unsupported'] });

export function createNpcBoatFault({ enabled = false, proof, stateHash } = {}) {
  const schedule = []; let installed = false, attempt = null, rollback = null, expectedLog = null;
  const grants = [];
  const append = (kind, value) => { const item = { ordinal: schedule.length + 1, kind, ...structuredClone(value) }; schedule.push(item); return item; };
  const diagnostic = () => ({ enabled, installed, contract: enabled ? NPC_BOAT_FAULT_CONTRACT : null,
    attempt, rollback, expectedLog, grants, schedule });
  return {
    diagnostic,
    async installBeforeBaseline(pool) {
      if (!enabled) return;
      assert(!installed); for (const sql of NPC_BOAT_FAULT_SQL) await pool.query(sql);
      installed = true;
      await proof.artifact('npc-boat-fault-initialization.json', { contract: NPC_BOAT_FAULT_CONTRACT, sql: NPC_BOAT_FAULT_SQL,
        declaredBeforeBaseline: true, postBaselineDiagnosticDdl: false, gameplayWrites: false });
    },
    async onAttempt(event) {
      if (!enabled || event.outcome !== 'THREW' || event.code !== 'RNB01') return;
      assert(installed); assert.equal(attempt, null, 'Repeated one-shot boat error');
      assert.equal(event.sqlSha256, sha256(NPC_BOAT_INSERT), 'Fault did not originate from canonical boat INSERT');
      assert.equal(event.context?.authority, 'original-worker');
      assert(Number.isSafeInteger(event.transactionId) && event.transactionId > 0);
      assert(Number.isSafeInteger(event.context.logicalAt) && event.context.logicalAt % 3600000 === 0);
      attempt = structuredClone(event);
      await proof.record(append('npc-boat-fault-attempt', { event }));
    },
    async boundary(event, before, after, provenance) {
      if (!enabled || !attempt || rollback || event.transactionId !== attempt.transactionId || event.clientId !== attempt.clientId) return;
      assert.equal(event.outcome, 'ROLLED_BACK'); assert.equal(event.context?.authority, 'original-worker');
      assert.equal(event.context.logicalAt, attempt.context.logicalAt); assert(event.sequence > attempt.sequence);
      assert.equal(stateHash(before), stateHash(after), 'Injected boat abort changed authoritative resource projection');
      assert.equal(provenance, null, 'Aborted SQL must not acquire committed car provenance');
      const artifact = 'restricted-npc-boat-fault-rollback.json';
      await proof.artifact(artifact, { attempt, event, before, after, committedProvenance: null,
        resourceProjectionOnly: true, beforeSha256: stateHash(before), afterSha256: stateHash(after) });
      rollback = { event: structuredClone(event), artifact, beforeSha256: stateHash(before), afterSha256: stateHash(after),
        authority: 'Actual native RNB01 INSERT error and matched native ROLLBACK; committed-only collector intentionally has no aborted witness' };
      await proof.record(append('npc-boat-fault-rollback', rollback));
    },
    acceptConsole(level, args, logicalAt) {
      if (!enabled || level !== 'error' || args.length !== 2 || args[0] !== '[population] spawn failed' || args[1] !== NPC_BOAT_FAULT_MESSAGE) return false;
      // A copied message without the actual native failure and completed rollback is never accepted.
      if (!attempt || !rollback || expectedLog || logicalAt !== attempt.context.logicalAt) return false;
      expectedLog = append('npc-boat-fault-expected-console', { level, args, logicalAt, nativeAttemptSequence: attempt.sequence,
        nativeRollbackSequence: rollback.event.sequence });
      return true;
    },
    async classified(event, journal) {
      if (!enabled) return;
      for (const movement of journal.boats.movements) {
        assert.equal(movement.kind, 'exact-npc-spawn-boat-source');
        assert.equal(event.outcome, 'COMMITTED'); assert.equal(event.context?.authority, 'original-worker');
        assert(Number.isSafeInteger(event.context.logicalAt) && event.context.logicalAt % 3600000 === 0);
        assert(!grants.some(row => row.movement.boatId === movement.boatId), 'Duplicate boat grant');
        const value = { event: structuredClone(event), movement: structuredClone(movement),
          strictlyLater: !!attempt && event.context.logicalAt > attempt.context.logicalAt,
          candidate: structuredClone(journal.npcBoatWitness) };
        assert(value.candidate?.artifact && value.candidate.sha256, 'Missing full candidate retention');
        grants.push(value); await proof.record(append('npc-boat-fault-canonical-grant', value));
      }
    },
    async finish(pool) {
      if (!enabled) return null;
      const sequence = (await pool.query('SELECT last_value::text,is_called FROM rc1_boat_fault_seq')).rows;
      const value = { ...diagnostic(), sequence };
      await proof.artifact('npc-boat-fault-final.json', value);
      assert(installed && attempt && rollback && expectedLog, 'Missing actual fault, rollback or exact original error');
      assert(grants.filter(row => row.strictlyLater).length >= 2, 'Two strictly later canonical boat grants not reached within declared 12h horizon');
      assert.deepEqual(sequence, [{ last_value: String(grants.length + 1), is_called: true }], 'Missing or unexpected native boat INSERT attempt');
      return { attempts: 1, rollback: 1, expectedConsoleErrors: 1, grants: grants.length,
        strictlyLaterGrants: grants.filter(row => row.strictlyLater).length, failedLogicalAt: attempt.context.logicalAt,
        grantLogicalTimes: grants.map(row => row.event.context.logicalAt), scheduleSha256: sha256(canonicalJson(schedule)),
        sequence, fullResourceQualification: false, sameAssetIdempotentRetry: false };
    },
  };
}
