import { firstBatchSourceBaseline } from '../tools/rc1-first-batch-source-compatibility.js';
import { PLAYER_INTEL_SOURCE_TRANSFER, assertPlayerIntelSourceTransfer } from '../tools/player-intel-source-compatibility.js';
import { companyBankSourceBaseline } from '../tools/rc1-company-bank-source-compatibility.js';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { CITY_GAMEPLAY_SOURCE_PARENT_REVISIONS, CITY_GAMEPLAY_SOURCE_CURRENT_PINS,
  CITY_GAMEPLAY_SOURCE_PARENT_PINS, CITY_GAMEPLAY_SOURCE_CURRENT_BLOBS, CITY_GAMEPLAY_SOURCE_PARENT_BLOBS,
  CITY_GAMEPLAY_SOURCE_MAIN_PARENT_REVISIONS, CITY_GAMEPLAY_SOURCE_MAIN_PARENT_PINS, CITY_GAMEPLAY_SOURCE_MAIN_PARENT_BLOBS,
  CITY_GAMEPLAY_SOURCE_LATEST_MAIN_PARENT_REVISIONS, CITY_GAMEPLAY_SOURCE_LATEST_MAIN_PARENT_PINS, CITY_GAMEPLAY_SOURCE_LATEST_MAIN_PARENT_BLOBS,
  CITY_GAMEPLAY_SOURCE_TRANSFER, qualifyCityGameplaySource, cityGameplaySourceBaseline } from '../tools/rc1-city-gameplay-source-compatibility.js';
import { CITY_HOMES_LEAGUE_SERVER_PIN, CITY_HOMES_SOURCE_INVERSES,
  cityHomesLeagueSourceBaseline, assertCityHomesLeagueServerTransfer } from '../tools/rc1-deed-source-compatibility.js';
import { COMPANY_OPERATOR_SOURCE_CURRENT_PINS, companyOperatorSourceBaseline } from '../tools/rc1-company-operator-source-compatibility.js';
import { GAME_EMPLOYMENT_SOURCE_CURRENT_PINS, GAME_EMPLOYMENT_SOURCE_BASELINE_PINS, GAME_EMPLOYMENT_SOURCE_INVERSES,
  assertGameEmploymentSourceTransfer, gameEmploymentSourceBaseline } from '../tools/rc1-game-employment-source-compatibility.js';
import { COMPANY_WORKFLOW_SOURCE_CURRENT_PINS, COMPANY_WORKFLOW_SOURCE_INVERSES,
  assertCompanyWorkflowSourceTransfer, companyWorkflowSourceBaseline } from '../tools/rc1-company-workflow-source-compatibility.js';
import { COMMERCIAL_PREMISES_SOURCE_CURRENT_PINS, COMMERCIAL_PREMISES_SOURCE_INVERSES,
  assertCommercialPremisesSourceTransfer, commercialPremisesSourceBaseline } from '../tools/rc1-commercial-premises-source-compatibility.js';

const normalize = text => text.replaceAll('\r\n', '\n');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const files = ['package-lock.json','package.json','schema.sql','src/agentgateway.js','src/chain.js','src/content/phase1-policy.js',
  'src/content/phase1.js','src/crafting.js','src/db.js','src/deeds.js','src/invariants.js','src/items.js','src/mysteries.js',
  'src/server.js','src/social/estate.js','src/worldgraph-ui.js','src/worldgraph-validate.js'];
assert.deepEqual(Object.keys(CITY_GAMEPLAY_SOURCE_CURRENT_PINS), files);
for (const pins of [CITY_GAMEPLAY_SOURCE_PARENT_PINS, CITY_GAMEPLAY_SOURCE_CURRENT_BLOBS, CITY_GAMEPLAY_SOURCE_PARENT_BLOBS, CITY_GAMEPLAY_SOURCE_MAIN_PARENT_PINS, CITY_GAMEPLAY_SOURCE_MAIN_PARENT_BLOBS, CITY_GAMEPLAY_SOURCE_LATEST_MAIN_PARENT_PINS, CITY_GAMEPLAY_SOURCE_LATEST_MAIN_PARENT_BLOBS]) assert.deepEqual(Object.keys(pins), files);
assert.deepEqual(CITY_GAMEPLAY_SOURCE_PARENT_REVISIONS, ['425de0010a3ee3500870a04e796029d671f464ef']);
assert.deepEqual(CITY_GAMEPLAY_SOURCE_MAIN_PARENT_REVISIONS, ['fb695d002198a67c68ff49df48469e033684e99c']);
assert.deepEqual(CITY_GAMEPLAY_SOURCE_TRANSFER.mainPredecessorPins, CITY_GAMEPLAY_SOURCE_MAIN_PARENT_PINS);
assert.deepEqual(CITY_GAMEPLAY_SOURCE_TRANSFER.mainPredecessorBlobs, CITY_GAMEPLAY_SOURCE_MAIN_PARENT_BLOBS);
assert.deepEqual(CITY_GAMEPLAY_SOURCE_LATEST_MAIN_PARENT_REVISIONS, ['30f61aeb3dbb6deac89591b0fcd57d3f6b51574c']);
assert.deepEqual(CITY_GAMEPLAY_SOURCE_TRANSFER.latestMainPredecessorPins, CITY_GAMEPLAY_SOURCE_LATEST_MAIN_PARENT_PINS);
assert.deepEqual(CITY_GAMEPLAY_SOURCE_TRANSFER.latestMainPredecessorBlobs, CITY_GAMEPLAY_SOURCE_LATEST_MAIN_PARENT_BLOBS);
assert.match(CITY_GAMEPLAY_SOURCE_TRANSFER.scope, /ALL new gameplay\/RPG\/Home\/NPC\/PvE\/token authority, current PostgreSQL, worker, migration, activation and deployment qualification remain outside/);
let negatives = 0;
for (const file of files) {
  const raw = firstBatchSourceBaseline(file,fs.readFileSync(file, 'utf8')), current = normalize(raw), parent = git('cat-file', 'blob', CITY_GAMEPLAY_SOURCE_LATEST_MAIN_PARENT_BLOBS[file]);
  assert.equal(hash(current), CITY_GAMEPLAY_SOURCE_CURRENT_PINS[file], 'Exact current source: ' + file);
  assert.equal(blob(current), CITY_GAMEPLAY_SOURCE_CURRENT_BLOBS[file]);
  assert.equal(hash(parent), CITY_GAMEPLAY_SOURCE_LATEST_MAIN_PARENT_PINS[file]); assert.equal(blob(parent), CITY_GAMEPLAY_SOURCE_LATEST_MAIN_PARENT_BLOBS[file]);
  for (const revision of CITY_GAMEPLAY_SOURCE_LATEST_MAIN_PARENT_REVISIONS) assert.equal(git('show', revision + ':' + file), parent, 'Complete reviewed predecessor: ' + file);
  const proof = qualifyCityGameplaySource(file, current);
  assert.equal(proof.baselineText, parent); assert.equal(proof.actualSha256, CITY_GAMEPLAY_SOURCE_CURRENT_PINS[file]);
  assert.equal(proof.baselineSha256, CITY_GAMEPLAY_SOURCE_LATEST_MAIN_PARENT_PINS[file]); assert.equal(proof.wholeBlobInverses, 1); assert.equal(proof.sourceOnly, true);
  assert.deepEqual(qualifyCityGameplaySource(file, current.replaceAll('\n', '\r\n')), proof);
  assert.equal(cityGameplaySourceBaseline(file, raw), parent);
  assert.equal(cityGameplaySourceBaseline(file, parent), parent);
  assert.equal(qualifyCityGameplaySource(file, parent).wholeBlobInverses, 0);
  assert.equal(cityGameplaySourceBaseline(file, parent.replaceAll('\n', '\r\n')), parent);
  for (const unknown of [current + '\n// unreviewed gameplay source suffix\n', parent + '\n// unreviewed predecessor source suffix\n',
    current.replace('\n', '\n// changed protected source\n'), current.replaceAll('\n', '\r\n') + '// unknown CRLF suffix\r\n']) {
    assert.equal(cityGameplaySourceBaseline(file, unknown), unknown, 'No unknown bytes may be replaced by a historical blob.');
    assert.throws(() => qualifyCityGameplaySource(file, unknown), /source changed/); negatives++;
  }
  // Mutate each actual complete gameplay diff hunk. Full-file admission must reject removed, duplicated and altered hunks alike.
  for (const revision of [CITY_GAMEPLAY_SOURCE_LATEST_MAIN_PARENT_REVISIONS[0], CITY_GAMEPLAY_SOURCE_MAIN_PARENT_REVISIONS[0], CITY_GAMEPLAY_SOURCE_PARENT_REVISIONS[0]]) {
    const diff = normalize(git('diff', '--no-ext-diff', '--unified=3', revision + ':' + file, CITY_GAMEPLAY_SOURCE_CURRENT_BLOBS[file]));
    const hunks = []; let hunk;
    for (const line of diff.split('\n')) {
      if (line.startsWith('@@ ')) { hunk = ''; hunks.push({ current: '' }); continue; }
      if (hunk === undefined || line.startsWith('\\')) continue;
      if (line.startsWith(' ') || line.startsWith('+')) hunks.at(-1).current += line.slice(1) + '\n';
    }
    assert(hunks.length);
    for (const { current: chunk } of hunks) {
      assert(chunk && current.includes(chunk), 'A negative must target an actual current diff hunk: ' + file);
      for (const changed of [current.replace(chunk, ''), current.replace(chunk, chunk + chunk), current.replace(chunk, chunk + '// altered actual gameplay hunk\n')]) {
        assert.notEqual(changed, current); assert.equal(cityGameplaySourceBaseline(file, changed), changed);
        assert.throws(() => qualifyCityGameplaySource(file, changed), /source changed/); negatives++;
      }
    }
  }
}
for (const [pins, blobs, revisions] of [
  [CITY_GAMEPLAY_SOURCE_MAIN_PARENT_PINS, CITY_GAMEPLAY_SOURCE_MAIN_PARENT_BLOBS, CITY_GAMEPLAY_SOURCE_MAIN_PARENT_REVISIONS],
  [CITY_GAMEPLAY_SOURCE_PARENT_PINS, CITY_GAMEPLAY_SOURCE_PARENT_BLOBS, CITY_GAMEPLAY_SOURCE_PARENT_REVISIONS],
]) {
  for (const file of files) {
    const parent = git('cat-file', 'blob', blobs[file]);
    assert.equal(hash(parent), pins[file]);
    assert.equal(blob(parent), blobs[file]);
    for (const revision of revisions) assert.equal(git('show', revision + ':' + file), parent, 'Complete original reviewed predecessor: ' + file);
    assert.equal(cityGameplaySourceBaseline(file, parent), parent);
    assert.equal(cityGameplaySourceBaseline(file, parent.replaceAll('\n', '\r\n')), parent);
    assert.equal(qualifyCityGameplaySource(file, parent).baselineText, parent);
    assert.equal(qualifyCityGameplaySource(file, parent).wholeBlobInverses, 0);
    for (const unknown of [parent + '\n// unreviewed predecessor source suffix\n', parent.replaceAll('\n', '\r\n') + '// unknown CRLF suffix\r\n']) {
      assert.equal(cityGameplaySourceBaseline(file, unknown), unknown);
      assert.throws(() => qualifyCityGameplaySource(file, unknown), /source changed/); negatives++;
    }
  }
}
for (const file of Object.keys(GAME_EMPLOYMENT_SOURCE_CURRENT_PINS)) {
  const current = normalize(firstBatchSourceBaseline(file,fs.readFileSync(file, 'utf8'))), combinedParent = companyBankSourceBaseline(file, cityGameplaySourceBaseline(file, current));
  assert.equal(hash(combinedParent), COMMERCIAL_PREMISES_SOURCE_CURRENT_PINS[file], 'Gameplay preserves the complete premises parent: ' + file);
  const workflow = commercialPremisesSourceBaseline(file, combinedParent);
  assert.equal(hash(workflow), COMPANY_WORKFLOW_SOURCE_CURRENT_PINS[file]);
  assert.equal(workflow, assertCommercialPremisesSourceTransfer(file, combinedParent).baselineText);
  const parent = companyWorkflowSourceBaseline(file, combinedParent);
  assert.equal(hash(parent), GAME_EMPLOYMENT_SOURCE_CURRENT_PINS[file], 'The unchanged premises/workflow adapters preserve the complete payroll parent: ' + file);
  assert.equal(parent, assertCompanyWorkflowSourceTransfer(file, workflow).baselineText);
  const operator = gameEmploymentSourceBaseline(file, parent);
  assert.equal(hash(operator), GAME_EMPLOYMENT_SOURCE_BASELINE_PINS[file]);
  assert.equal(operator, assertGameEmploymentSourceTransfer(file, parent).baselineText);
  for (const revision of ['101cdaaec2d5f235102e3de839043ba1fef21f81','8dbe85846035dc0fcdba76992834e411632c6f1b']) {
    assert.equal(operator, git('show', revision + ':' + file), 'The unchanged payroll adapter retains its complete operator predecessor: ' + file);
  }
  for (const chunk of GAME_EMPLOYMENT_SOURCE_INVERSES[file]) {
    assert.equal(parent.split(chunk.current).length, 2, 'Each payroll predecessor hunk is exact and unique: ' + file);
    for (const changed of [parent.replace(chunk.current, ''), parent.replace(chunk.current, chunk.current + chunk.current),
      parent.replace(chunk.current, chunk.current + '// altered payroll predecessor hunk\n')]) {
      assert.equal(cityGameplaySourceBaseline(file, changed), changed);
      assert.equal(gameEmploymentSourceBaseline(file, changed), changed);
      assert.throws(() => qualifyCityGameplaySource(file, changed), /source changed/);
      assert.throws(() => assertGameEmploymentSourceTransfer(file, changed), /source changed/); negatives++;
    }
    const anchor = chunk.current.split('\n').find(line => line.trim() && !chunk.baseline.split('\n').includes(line)
      && current.split(line + '\n').length === 2);
    assert(anchor, 'The combined current file retains an exact added payroll line: ' + file);
    for (const changed of [current.replace(anchor + '\n', ''), current.replace(anchor + '\n', anchor + '\n' + anchor + '\n'),
      current.replace(anchor + '\n', anchor + ' // altered combined payroll authority\n')]) {
      assert.equal(cityGameplaySourceBaseline(file, changed), changed);
      assert.equal(gameEmploymentSourceBaseline(file, changed), changed);
      assert.equal(companyOperatorSourceBaseline(file, changed), changed);
      assert.throws(() => qualifyCityGameplaySource(file, changed), /source changed/);
      assert.throws(() => assertGameEmploymentSourceTransfer(file, changed), /source changed/); negatives++;
    }
  }
}
for (const layer of [
  { pins: COMMERCIAL_PREMISES_SOURCE_CURRENT_PINS, inverses: COMMERCIAL_PREMISES_SOURCE_INVERSES,
    baseline: input => input, assertTransfer: assertCommercialPremisesSourceTransfer },
  { pins: COMPANY_WORKFLOW_SOURCE_CURRENT_PINS, inverses: COMPANY_WORKFLOW_SOURCE_INVERSES,
    baseline: (input,file) => commercialPremisesSourceBaseline(file,input), assertTransfer: assertCompanyWorkflowSourceTransfer },
]) {
  for (const file of Object.keys(GAME_EMPLOYMENT_SOURCE_CURRENT_PINS)) {
    const current = normalize(firstBatchSourceBaseline(file,fs.readFileSync(file,'utf8'))), parent = layer.baseline(companyBankSourceBaseline(file,cityGameplaySourceBaseline(file,current)),file);
    assert.equal(hash(parent),layer.pins[file]);
    for (const chunk of layer.inverses[file]) {
      assert.equal(parent.split(chunk.current).length,2,'Each premises/workflow predecessor hunk is exact and unique: ' + file);
      for (const changed of [parent.replace(chunk.current,''),parent.replace(chunk.current,chunk.current + chunk.current),
        parent.replace(chunk.current,chunk.current + '// altered premises/workflow predecessor hunk\n')]) {
        assert.equal(cityGameplaySourceBaseline(file,changed),changed);
        assert.equal(companyOperatorSourceBaseline(file,changed),changed);
        assert.throws(() => qualifyCityGameplaySource(file,changed),/source changed/);
        assert.throws(() => layer.assertTransfer(file,changed),/source changed/); negatives++;
      }
      const anchor = chunk.current.split('\n').find(line => line.trim() && !chunk.baseline.split('\n').includes(line)
        && current.split(line + '\n').length === 2);
      assert(anchor,'The combined current file retains an exact added premises/workflow line: ' + file);
      for (const changed of [current.replace(anchor + '\n',''),current.replace(anchor + '\n',anchor + '\n' + anchor + '\n'),
        current.replace(anchor + '\n',anchor + ' // altered combined premises/workflow authority\n')]) {
        assert.equal(cityGameplaySourceBaseline(file,changed),changed);
        assert.equal(companyOperatorSourceBaseline(file,changed),changed);
        assert.throws(() => qualifyCityGameplaySource(file,changed),/source changed/);
        assert.throws(() => layer.assertTransfer(file,changed),/source changed/); negatives++;
      }
    }
  }
}
const server = normalize(firstBatchSourceBaseline('src/server.js',fs.readFileSync('src/server.js', 'utf8'))), latestParentServer = cityGameplaySourceBaseline('src/server.js', server);
const intel = assertPlayerIntelSourceTransfer('src/server.js', latestParentServer);
assert.equal(intel.baselineText, git('show', CITY_GAMEPLAY_SOURCE_MAIN_PARENT_REVISIONS[0] + ':src/server.js'));
assert.equal(intel.baselinePins['src/server.js'], PLAYER_INTEL_SOURCE_TRANSFER.baselinePins['src/server.js']);
assert.equal(intel.phase, 'exact source transfer only');
const parentServer = companyBankSourceBaseline('src/server.js', latestParentServer);
assert.equal(hash(parentServer), COMMERCIAL_PREMISES_SOURCE_CURRENT_PINS['src/server.js'], 'The complete gameplay parent retains the premises envelope.');
assert.equal(hash(commercialPremisesSourceBaseline('src/server.js',parentServer)), COMPANY_WORKFLOW_SOURCE_CURRENT_PINS['src/server.js'],
  'The unchanged premises adapter retains the complete workflow envelope.');
assert.equal(hash(companyWorkflowSourceBaseline('src/server.js',parentServer)), GAME_EMPLOYMENT_SOURCE_CURRENT_PINS['src/server.js'],
  'The unchanged workflow adapter retains the complete payroll envelope.');
assert.equal(hash(gameEmploymentSourceBaseline('src/server.js', parentServer)), COMPANY_OPERATOR_SOURCE_CURRENT_PINS['src/server.js'],
  'The unchanged payroll adapter retains the complete operator envelope.');
const homeServer = companyOperatorSourceBaseline('src/server.js', parentServer);
assert.equal(hash(homeServer), CITY_HOMES_LEAGUE_SERVER_PIN);
assert.equal(cityHomesLeagueSourceBaseline('src/server.js', server), assertCityHomesLeagueServerTransfer(homeServer).baselineText,
  'Exactly one gameplay layer preserves the exact premises, workflow, payroll and operator envelopes before unchanged Homes and older layers.');
for (const chunk of CITY_HOMES_SOURCE_INVERSES) {
  for (const changed of [server.replace(chunk, ''), server.replace(chunk, chunk + chunk), server.replace(chunk, chunk.replace('registerCityHomes','registerUnreviewedHomes'))]) {
    assert.notEqual(changed, server); assert.equal(cityHomesLeagueSourceBaseline('src/server.js', changed), changed);
    assert.throws(() => assertCityHomesLeagueServerTransfer(cityGameplaySourceBaseline('src/server.js', changed)), /source changed/); negatives++;
  }
}
for (const file of ['src/city-encounters.js','src/city-home-interiors.js','src/city-world-opportunities.js','src/city-home-migration.js',
  'src/gameemployment.js','src/gameemploymentinvariants.js','src/routes/gameemployment.js','src/commercialpremises.js',
  'src/commercialpremisesinvariants.js','src/routes/commercialpremises.js','src/companyworkflows.js','src/companyworkflowrunner.js',
  'src/companyworkflowinvariants.js','src/routes/companyworkflows.js','src/worker.js']) {
  const text = firstBatchSourceBaseline(file,fs.readFileSync(file, 'utf8')); assert.equal(cityGameplaySourceBaseline(file, text), text, 'Files outside the closed17 map have no gameplay predecessor alias.');
  assert.throws(() => qualifyCityGameplaySource(file, text), /Unknown gameplay source/); negatives++;
}
for (const file of ['toString','constructor','./src/server.js']) {
  assert.equal(cityGameplaySourceBaseline(file, server), server); assert.throws(() => qualifyCityGameplaySource(file, server), /Unknown gameplay source/); negatives++;
}
console.log('rc1-city-gameplay-source-compatibility PASS:', files.length, 'exact full merged-current/30f-latest/fb-main/original425-parent files, exact Player Intel and all six incoming business envelopes, exact premises/workflow/employment-to-operator101/8dbe predecessors, preserved premises/workflow/payroll/operator envelopes, CRLF controls,', negatives,
  'tamper/unknown/no-new-module negatives; historical source-only transfer excludes all new authority/native/worker/migration/activation/deployment');
