// Exact historical-byte inventory and local changed-row reclassification. This
// does not reconstruct missing whole snapshots or claim a new native run.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { sourceIdentity, assertSourceUnchanged, sha256 } from '../tools/rc1-native-proof.js';
import { reconcileOrderExpiry, reconcileLifecycleCash } from '../tools/rc1-world-lifecycle-resources.js';
import { reconcileOrderResources, reconcileTurfFunding } from '../tools/rc1-world-order-resources.js';
import { sha256 as resourceHash } from '../tools/rc1-resource-journal.js';
import { WORLD_RESOURCE_TABLES } from '../tools/rc1-world-resource-observer.js';

const root = process.env.RC1_RETAINED_COMPONENTS, expiryRoot = process.env.RC1_RETAINED_EXPIRY, output = process.env.RC1_RETAINED_CLASS_OUTPUT;
assert(root && expiryRoot && output, 'Explicit historical roots and fresh restricted output are required');
const source = await sourceIdentity(); await fs.mkdir(output);
const admissionFile = path.join(root, 'command-admission.json'), admissionBytes = await fs.readFile(admissionFile);
assert.equal(sha256(admissionBytes), 'bbd578409c9d1314bde2a01d8b078085c46e4e9eea89fe9c771f4ab8c95c34f8');
const admission = JSON.parse(admissionBytes), inventory = [], inputs = [], componentCases = [];
function changedInputs(changes) {
  const before = { format: 1, tables: {} }, after = { format: 1, tables: {} };
  for (const table of WORLD_RESOURCE_TABLES) {
    const change = changes.tables.find(row => row.table === table);
    before.tables[table] = change?.beforeRows || []; after.tables[table] = change?.afterRows || [];
  }
  return { before, after };
}
for (const gate of ['rc1-turf-contention', 'rc1-turf-terminal', 'rc1-family-custody', 'rc1-family-monopoly', 'rc1-family-fragmented', 'rc1-law-policy', 'rc1-aggression-lifecycle', 'rc1-heir']) {
  const entry = admission.gates[gate].native[0], directory = path.dirname(entry.path), bytes = await fs.readFile(entry.path);
  assert.equal(sha256(bytes), entry.sha256); const manifest = JSON.parse(bytes); assert.equal(manifest.source.revision, admission.source);
  const summaryPath = path.join(directory, 'resource-summary.json'), summaryBytes = await fs.readFile(summaryPath);
  const listed = manifest.artifacts.find(row => row.path === 'resource-summary.json'); assert(listed); assert.equal(sha256(summaryBytes), listed.sha256);
  const summary = JSON.parse(summaryBytes), classes = new Map();
  for (const entry of summary.unsupported || summary.unknown) {
    const key = [entry.kind, entry.table, entry.currency, entry.reason].filter(Boolean).join(':');
    const row = classes.get(key) || { class: key, count: 0, boundaries: [] }; row.count++;
    if (!row.boundaries.includes(entry.boundary)) row.boundaries.push(entry.boundary); classes.set(key, row);
  }
  inventory.push({ gate, source: admission.source, classes: [...classes.values()], familyJournalEntries: summary.familyUnknown || [], retainedUnknownCount: (summary.unsupported || summary.unknown).length });
  inputs.push({ file: entry.path, sha256: entry.sha256 }, { file: summaryPath, sha256: listed.sha256 });
  const selected = new Set((summary.unsupported || summary.unknown).filter(row => row.reason && /^(law:plea|jump:steal|turf:|market:list|market:loot)/.test(row.reason)).map(row => row.boundary));
  for (const boundary of selected) {
    const file = boundary + (gate.startsWith('rc1-turf') ? '-resource.json' : '.json'), artifact = manifest.artifacts.find(row => row.path === file); assert(artifact);
    const filePath = path.join(directory, file), bytes = await fs.readFile(filePath); assert.equal(sha256(bytes), artifact.sha256);
    const retained = JSON.parse(bytes); assert(retained.restrictedChanges);
    assert.equal(resourceHash(retained.restrictedChanges), retained.restrictedChangesSha256);
    const { before, after } = changedInputs(retained.restrictedChanges), options = { identity: retained.identity, receipts: retained.receipts };
    const cash = reconcileLifecycleCash(before, after, options), order = reconcileOrderResources(before, after, options), turf = reconcileTurfFunding(before, after, options);
    const movements = [...cash.movements, ...order.movements, ...turf.movements]; assert(movements.length, 'Selected historical class remained unclassified: ' + gate + '/' + boundary);
    const used = new Set([...cash.usedReceipts, ...order.usedReceipts, ...turf.usedReceipts]);
    const closed = retained.unsupported.filter(row => row.kind === 'receipt-reason' ? used.has(row.receiptId)
      : row.kind === 'family-lineage' ? row.familyIds.every(id => turf.familyFields.has(id))
        : row.table === 'market_listings' ? order.listingIds.size > 0
          : row.table === 'districts' ? turf.districtFields.size > 0 : row.table === 'district_bids' && turf.bidDistricts.size > 0);
    componentCases.push({ gate, boundary, movements, closedRetainedEntries: closed, remainingRetainedEntries: retained.unsupported.filter(row => !closed.includes(row)),
      evidenceKind: 'historical-exact-changed-rows', reconstructedFullSnapshot: false, currentSourceNativePass: false });
    inputs.push({ file: filePath, sha256: artifact.sha256 });
  }
}
const manifestPath = path.join(expiryRoot, 'run.json'), manifestBytes = await fs.readFile(manifestPath), manifest = JSON.parse(manifestBytes);
assert.equal(manifest.source.revision, '85ed40b5c89446be13d0dfd52eddba6d375b30eb');
inputs.push({ file: manifestPath, sha256: sha256(manifestBytes) });
const expiryCases = [];
for (const file of ['restricted-resource-change-0003986.json', 'restricted-resource-change-0003987.json']) {
  const bytes = await fs.readFile(path.join(expiryRoot, file));
  const indexed = manifest.artifacts.find(row => row.path === file); assert(indexed); assert.equal(sha256(bytes), indexed.sha256);
  const input = JSON.parse(bytes), { before, after } = changedInputs(input.restrictedChanges);
  // All observed changed rows are retained. Unchanged rows are not reconstructed;
  // the expiry helper only reads its changed owner/order and verifies other deltas.
  const options = { identity: input.event, receipts: after.tables.transactions };
  const journal = reconcileOrderExpiry(before, after, options); assert.equal(journal.movements.length, 1);
  const corrupt = structuredClone(after); corrupt.tables.transactions[0].character_id = 'wrong-owner';
  assert.throws(() => reconcileOrderExpiry(before, corrupt, { ...options, receipts: corrupt.tables.transactions }));
  inputs.push({ file: path.join(expiryRoot, file), sha256: indexed.sha256 });
  expiryCases.push({ file, source: manifest.source.revision, journal: { movements: journal.movements, checks: journal.checks }, wrongOwnerRejected: true,
    evidenceKind: 'historical-exact-changed-rows', reconstructedFullSnapshot: false, currentSourceNativePass: false });
}
await assertSourceUnchanged(source);
const report = { status: 'PASS_HISTORICAL_CLASS_INVENTORY', observerSource: source, inputs, inventory, componentCases, expiryCases,
  inputEvidenceUnmodified: true, noDatabaseMutations: true, qualifyingFullResourcePass: false };
await fs.writeFile(path.join(output, 'class-inventory.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: report.status, observerSource: source.revision, components: inventory.length,
  retainedSharedUnknowns: inventory.reduce((sum, row) => sum + row.retainedUnknownCount, 0), historicalComponentBoundaries: componentCases.length,
  closedHistoricalComponentEntries: componentCases.reduce((sum, row) => sum + row.closedRetainedEntries.length, 0), historicalExpiryCases: expiryCases.length }));
