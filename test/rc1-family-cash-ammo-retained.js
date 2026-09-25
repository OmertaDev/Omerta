// Independent read-only reclassification of historical inputs; never a current-source native pass.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { sourceIdentity, assertSourceUnchanged, verifyArtifactIndex, sha256 } from '../tools/rc1-native-proof.js';
import { normalizeFamilyCustodySnapshot, reconcileFamilyCashAmmo } from '../tools/rc1-family-cash-ammo-journal.js';

const root = process.env.RC1_RETAINED_ROOT, output = process.env.RC1_FAMILY_REUSE_OUTPUT;
assert(root && output, 'Explicit retained private root and fresh audit output required');
const source = await sourceIdentity(); await fs.mkdir(output);
const artifacts = [], cases = [];
const read = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));
async function put(file, value) {
  const bytes = JSON.stringify(value, null, 2) + '\n'; await fs.writeFile(path.join(output, file), bytes, { flag: 'wx' });
  artifacts.push({ file, sha256: sha256(Buffer.from(bytes)) });
}
const boundedPath = async (directory, name) => {
  assert(/^[a-z0-9-]+\.(json|jsonl|ndjson|dump)$/.test(name));
  const resolved = await fs.realpath(path.join(directory, name)); assert.equal(path.dirname(resolved), await fs.realpath(directory)); return resolved;
};
async function examine(label, directory, before, after, operations, context, options = {}) {
  const journal = reconcileFamilyCashAmmo(before, after, { operations, ...options }); assert.equal(journal.status, 'PASS_SCOPED');
  const bad = normalizeFamilyCustodySnapshot(after), priorIds = new Set(normalizeFamilyCustodySnapshot(before).transactions.map((r) => r.id));
  const transfer = bad.transactions.find((r) => !priorIds.has(r.id) && r.currency === 'cash' && r.reason === 'gang:tribute'
    && (!options.familyIds || options.familyIds.includes(r.counterparty)));
  assert(transfer, 'Historical proof must contain a nonzero cash tribute'); transfer.counterparty = 'corrupted-foreign-family';
  let rejection = null;
  try { reconcileFamilyCashAmmo(before, bad, { operations, ...options }); } catch (error) { rejection = error.message; }
  assert(rejection, 'Corrupted retained recipient must be rejected');
  await put(label + '-inputs.json', { before, after, operations, options });
  await put(label + '-journal.json', { journal, corruptedRecipientRejected: true, rejection });
  cases.push({ label, directory, ...context, familyIds: journal.familyIds, flows: journal.flows.length,
    familyChecks: journal.checks.length, personalEndpointParityChecks: journal.personalChecks.length, corruptedRecipientRejected: true,
    scope: 'Aggregate between retained complete initial/final snapshots; not per-intermediate-commit reconstruction or current-source native execution.' });
}
let status = 'SCOPED_HISTORICAL_JOURNAL_PASS', failure = null;
try {
  const directory = path.join(root, 'family-7df52b3f', 'resource-family-7df52b3f35c5-57afbc1852');
  const manifest = await read(path.join(directory, 'result.json'));
  assert.equal(manifest.source.commit, '7df52b3f35c516215427a8b88040628446837175');
  assert.equal(manifest.source.immutableDuringRun, true); assert.equal(manifest.configuration.terminalFixtures, false);
  assert.equal(manifest.outcome, 'SCOPED_PASS');
  assert.equal(new Set(manifest.artifacts.map((a) => a.file)).size, manifest.artifacts.length);
  for (const artifact of manifest.artifacts) assert.equal(sha256(await fs.readFile(await boundedPath(directory, artifact.file))), artifact.sha256);
  const before = await read(path.join(directory, 'initial-state.json')), after = await read(path.join(directory, 'final-state.json'));
  const requests = await read(path.join(directory, 'requests.json'));
  const operations = requests.map((r) => {
    assert(/^[a-e]$/.test(r.role), 'Unknown retained role');
    const characterId = 'family-proof-' + r.role + '-character', actor = before.characters.find((c) => c.id === characterId);
    assert(actor, 'Retained role has no authoritative actor');
    return { accountId: actor.account_id, characterId, method: 'POST', path: r.url, idempotencyKey: r.key,
      result: { status: r.status, replayed: r.replayed, body: r.body } };
  });
  await examine('original-lifetime-family-d', directory, before, after, operations, {
    inputSource: manifest.source.commit, manifestSha256: sha256(await fs.readFile(path.join(directory, 'result.json'))),
    verifiedInputArtifacts: manifest.artifacts, originalProductionLifetimes: true, requestPayloadAvailability: 'not-retained: legacy writer overwrote body with response body',
    retainedOrdering: 'Invocation and response-completion indices only; no PostgreSQL total commit order inferred',
    excluded: ['Families A/B/C war and turf', 'OMR/reserve', 'original initialization fixture drift', 'full current invariants'] }, { familyIds: ['family-proof-d'] });
  for (const scenario of ['monopoly', 'fragmented']) {
    const directory = path.join(root, 'family-' + scenario + '-5227fe19-native'), manifest = await read(path.join(directory, 'run.json'));
    assert.equal(manifest.source.revision, '5227fe1902315e177ea9fe3b7ceb9ae9f1ae1712'); assert.equal(manifest.status, 'PASS_SCOPED');
    await verifyArtifactIndex(directory, manifest);
    const before = await read(path.join(directory, 'initial.json')), after = await read(path.join(directory, 'final.json'));
    const history = (await fs.readFile(path.join(directory, 'history.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
    const start = history.find((e) => e.kind === 'measured-initialization'); assert(start);
    const completions = new Map(history.filter((e) => e.kind === 'completion').map((e) => [e.invocation, e]));
    const actors = normalizeFamilyCustodySnapshot(before).characters;
    const operations = history.filter((e) => e.kind === 'invocation' && e.sequence > start.sequence && e.identity.method === 'POST').map((e) => {
      const r = e.identity, completion = completions.get(e.invocation), actor = actors.find((a) => a.account_id === r.accountId);
      assert(actor && completion?.result, 'Missing actor or terminal completion');
      return { accountId: r.accountId, characterId: actor.id, method: r.method, path: r.path, idempotencyKey: r.key,
        ...(r.body === undefined ? {} : { body: r.body }), result: completion.result };
    });
    await examine('social-' + scenario, directory, before, after, operations, {
      inputSource: manifest.source.revision, manifestSha256: sha256(await fs.readFile(path.join(directory, 'run.json'))),
      verifiedInputArtifactCount: manifest.artifacts.length, configurationSha256: manifest.configurationSha256,
      requestPayloadAvailability: 'retained in invocation history', excluded: ['prebaseline initialization', 'OMR/reserve', 'full resource taxonomy'] });
  }
  await assertSourceUnchanged(source);
} catch (error) { status = 'FAIL'; failure = { message: error.message, stack: error.stack }; process.exitCode = 1; }
await put('historical-audit.json', { status, observerSource: source, cases, failure, artifacts: [...artifacts],
  evidenceKind: 'independent-historical-input-reclassification', currentSourceNativePass: false, qualifyingFullResourcePass: false,
  inputEvidenceUnmodified: true, noDatabaseMutations: true });
console.log(JSON.stringify({ status, cases: cases.map((c) => ({ label: c.label, familyChecks: c.familyChecks, flows: c.flows })), failure }));
