import { thirdBatchMigrationSchema } from '../../tools/rc1-third-batch-source-compatibility.js';
// Test-only, exact equipment predicate projection before the unchanged City oracle.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const EQUIPMENT_ECONOMY_MIGRATION_SOURCE = Object.freeze({
  revision: 'a4c2a63c86431862772beceec214ae22d441b6be', blob: 'cdfd770c051424d6ef6d198cf25aad851fd21337',
  sha256: '0f84bd62550030d065621637241e62e21d8f51820a57bd6cfb1e0bc4182e609a',
  crlfSha256: 'eddb9919ecdbc3810301d06a282ac4f3256bad9ac3c1e49b5b9e758457910685',
});
export const EQUIPMENT_ECONOMY_MIGRATION_PREDECESSOR = Object.freeze({
  revision: '9adc01bea4963b89f12419126bd91bb5e7d57a55', blob: 'dbca5a839e79ee66e5502fe7308270f9c7e28851',
  sha256: '220780ae48a8a6ce9a3a1970110c4d420720c777c80217811c7166cf53e36390',
});
export const EQUIPMENT_ECONOMY_MIGRATION_TABLES = Object.freeze([
  'equipment_rental_requests', 'equipment_rental_offers', 'equipment_rental_leases',
  'equipment_maintenance_offers', 'equipment_maintenance_requests', 'equipment_maintenance_repairs',
  'commercial_negotiations', 'commercial_negotiation_requests',
  'service_subscriptions', 'service_subscription_requests', 'service_subscription_cycles',
  'contract_auctions', 'contract_auction_bids', 'contract_auction_requests',
]);
// Independently compiled from the two complete pinned sources on PostgreSQL18.4.
// Literal whole predicates, not token deletion or a current-schema-derived oracle.
export const EQUIPMENT_EVENT_KIND_CURRENT = "CHECK (event_branch = 'legacy'::text AND (event_kind = ANY (ARRAY['stack_granted'::text, 'stack_consumed'::text, 'created'::text, 'transferred'::text, 'consumed'::text, 'escrowed'::text, 'released'::text, 'stored'::text, 'retrieved'::text, 'escrow_relayed'::text])) OR event_branch = 'lot'::text AND (event_kind = ANY (ARRAY['lot_granted'::text, 'lot_consumed'::text, 'lot_split_debit'::text, 'lot_split_output'::text, 'lot_escrowed'::text, 'lot_released'::text, 'lot_escrow_consumed'::text])) OR event_branch = 'unique'::text AND (event_kind = ANY (ARRAY['unique_granted'::text, 'unique_escrowed'::text, 'unique_released'::text, 'unique_transferred'::text, 'unique_consumed'::text])) OR event_branch = 'observation'::text AND event_kind = 'migration_origin'::text)";
export const EQUIPMENT_EVENT_KIND_PREDECESSOR = "CHECK (event_branch = 'legacy'::text AND (event_kind = ANY (ARRAY['stack_granted'::text, 'stack_consumed'::text, 'created'::text, 'transferred'::text, 'consumed'::text, 'escrowed'::text, 'released'::text, 'stored'::text, 'retrieved'::text])) OR event_branch = 'lot'::text AND (event_kind = ANY (ARRAY['lot_granted'::text, 'lot_consumed'::text, 'lot_split_debit'::text, 'lot_split_output'::text, 'lot_escrowed'::text, 'lot_released'::text, 'lot_escrow_consumed'::text])) OR event_branch = 'unique'::text AND (event_kind = ANY (ARRAY['unique_granted'::text, 'unique_escrowed'::text, 'unique_released'::text, 'unique_transferred'::text, 'unique_consumed'::text])) OR event_branch = 'observation'::text AND event_kind = 'migration_origin'::text)";
const repo = fileURLToPath(new URL('../../', import.meta.url));
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
const target = row => row.table_name === 'item_events' && row.name === 'item_event_kind';
const expectedMetadata = Object.freeze({ table_name: 'item_events', name: 'item_event_kind', type: 'c', validated: true });
let verifiedSources;
export function equipmentEconomyMigrationSources() {
  if (!verifiedSources) {
    const read = pin => {
      const ref = `${pin.revision}:schema.sql`;
      assert.equal(execFileSync('git', ['rev-parse', ref], { cwd: repo, encoding: 'utf8' }).trim(), pin.blob);
      const source = execFileSync('git', ['show', ref], { cwd: repo, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
      assert.equal(sha256(source), pin.sha256, 'Full immutable equipment schema bytes match their source pin');
      return source;
    };
    verifiedSources = Object.freeze({ current: read(EQUIPMENT_ECONOMY_MIGRATION_SOURCE), previous: read(EQUIPMENT_ECONOMY_MIGRATION_PREDECESSOR) });
  }
  return verifiedSources;
}
export function equipmentEconomyMigrationProjection(source, metadata) {
  source = thirdBatchMigrationSchema(source);
  const reviewed = equipmentEconomyMigrationSources();
  assert.equal(typeof source, 'string');
  const windows = reviewed.current.replaceAll('\n', '\r\n');
  assert.equal(sha256(windows), EQUIPMENT_ECONOMY_MIGRATION_SOURCE.crlfSha256);
  assert(source === reviewed.current || source === windows, 'Only the complete declared LF or CRLF equipment schema may enter native projection');
  const verifyMetadata = actual => assert.deepEqual(actual.constraints.filter(target), [expectedMetadata],
    'The exact equipment event-kind constraint is unique, CHECK-typed and validated');
  verifyMetadata(metadata);
  const normalize = rows => {
    const matches = rows.filter(target);
    assert.equal(matches.length, 1, 'Exactly one current equipment event-kind predicate exists');
    assert.equal(matches[0].definition, EQUIPMENT_EVENT_KIND_CURRENT, 'Only the full frozen equipment event-kind predicate may project');
    // Every other row, including all14 new table constraints/NOT NULLs, survives.
    return rows.map(row => target(row) ? { ...row, definition: EQUIPMENT_EVENT_KIND_PREDECESSOR } : row);
  };
  return Object.freeze({ normalize, verifyMetadata, current: EQUIPMENT_ECONOMY_MIGRATION_SOURCE,
    previous: EQUIPMENT_ECONOMY_MIGRATION_PREDECESSOR, tables: EQUIPMENT_ECONOMY_MIGRATION_TABLES });
}
