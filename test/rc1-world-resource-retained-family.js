// Historical delta applicability only: do not fabricate missing complete states.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { sourceIdentity, assertSourceUnchanged, verifyArtifactIndex, sha256 } from '../tools/rc1-native-proof.js';
import { reconcileWorkerTransitions } from '../tools/rc1-world-worker-transitions.js';
import { WORLD_RESOURCE_TABLES } from '../tools/rc1-world-resource-observer.js';
const root = process.env.RC1_RETAINED_FAMILY, output = process.env.RC1_RETAINED_FAMILY_OUTPUT;
assert(root && output, 'Explicit original native input and new restricted output required');
const source = await sourceIdentity(); await fs.mkdir(output);
const bytes = await fs.readFile(path.join(root, 'run.json'));
const manifest = JSON.parse(bytes); assert.equal(manifest.status, 'PASS_SCOPED');
const expected = {
  '4a13792c4dcea02c829fba5efcb107219e7d32bd7d4f12de48a837010bce09c0': { revision: '91b1e9ba', joins: 19, cooldowns: 1 },
  '34b7fb2fb1fc1eefcb2ac6d61d8ad5a7954124d5b75c381c4ea40fc789529697': { revision: 'a0177910c11c4502fb101c4ac506788a53d7ef88', joins: 0, cooldowns: 2 },
}[sha256(bytes)];
assert(expected, 'Native Family input manifest is not pinned'); assert(manifest.source.revision.startsWith(expected.revision));
await verifyArtifactIndex(root, manifest);
const entrants = new Map();
for (let index = 0; index < 25; index++) {
  // Entry records include temporary native credentials. Only immutable actor IDs
  // enter this output; no credential is printed, copied or used to authenticate.
  const { accountId, characterId } = JSON.parse(await fs.readFile(path.join(root, `family-entry-${index}.json`), 'utf8'));
  assert(!entrants.has(accountId)); entrants.set(accountId, characterId);
}
const cases = [];
for (const artifact of manifest.artifacts.filter(row => /^restricted-resource-change-\d+\.json$/.test(row.path))) {
  const retained = JSON.parse(await fs.readFile(path.join(root, artifact.path), 'utf8'));
  const { event, restrictedChanges } = retained, context = event.context;
  assert.equal(event.outcome, 'COMMITTED'); assert.equal(event.command, 'COMMIT');
  const route = context.path?.match(/^\/v1\/gangs\/([^/]+)\/join$/);
  if (route) {
    assert.equal(context.authority, 'ordinary-http'); assert.equal(context.method, 'POST');
    assert.equal(restrictedChanges.tables.length, 1, 'Join has resource changes beyond membership');
    const [change] = restrictedChanges.tables; assert.equal(change.table, 'gang_members');
    assert.equal(change.beforeRows.length, 0); assert.equal(change.afterRows.length, 1);
    assert.equal(change.afterCount, change.beforeCount + 1); assert.equal(change.unchangedCount, change.beforeCount);
    const [member] = change.afterRows;
    assert.deepEqual(Object.keys(member).sort(), ['character_id','gang_id','joined_at','post','post_at','role']);
    assert.equal(member.character_id, entrants.get(context.accountId)); assert.equal(member.gang_id, route[1]);
    assert.equal(member.role, 'soldier'); assert.equal(member.post, null); assert.equal(member.post_at, null);
    assert.equal(Date.parse(member.joined_at), context.logicalAt);
    cases.push({ file: artifact.path, sha256: artifact.sha256, kind: 'family-join-delta-applicability', familyId: member.gang_id,
      characterId: member.character_id, economicTableChanges: 0, helperClass: 'membership/family-join', fullObserverReplayed: false,
      limitation: 'Exact member delta and native actor binding verified; unchanged full Family/character snapshots are not reconstructed.' });
  } else {
    assert.equal(context.authority, 'original-worker');
    const before = { format: 1, tables: Object.fromEntries(WORLD_RESOURCE_TABLES.map(table => [table, []])) }, after = structuredClone(before);
    for (const change of restrictedChanges.tables) { before.tables[change.table] = change.beforeRows; after.tables[change.table] = change.afterRows; }
    const result = reconcileWorkerTransitions(before, after, { identity: event });
    assert.equal(result.movements.length, 1); assert.equal(result.movements[0].kind, 'family-npc-hostility-cooldown');
    const bad = structuredClone(after); bad.tables.gangs[0].npc_aggro_until = new Date(context.logicalAt + 1).toISOString();
    assert.throws(() => reconcileWorkerTransitions(before, bad, { identity: event }));
    cases.push({ file: artifact.path, sha256: artifact.sha256, kind: 'family-hostility-metadata-reclassification', movement: result.movements[0],
      shortenedCooldownRejected: true, fullObserverReplayed: false, evidenceKind: 'historical-exact-changed-rows' });
  }
}
assert.equal(cases.filter(row => row.kind === 'family-join-delta-applicability').length, expected.joins);
assert.equal(cases.filter(row => row.kind === 'family-hostility-metadata-reclassification').length, expected.cooldowns);
await assertSourceUnchanged(source);
const report = { status: 'PASS_HISTORICAL_FAMILY_CLASS_APPLICABILITY', observerSource: source, nativeSource: manifest.source,
  inputManifest: { path: path.join(root, 'run.json'), sha256: sha256(bytes) }, verifiedArtifactCount: manifest.artifacts.length, cases,
  noDatabaseMutations: true, inputEvidenceUnmodified: true, currentSourceNativePass: false, qualifyingFullResourcePass: false };
await fs.writeFile(path.join(output, 'family-class-applicability.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: report.status, verifiedNativeArtifacts: manifest.artifacts.length, joinDeltaCases: expected.joins, hostilityMetadataCases: expected.cooldowns }));
