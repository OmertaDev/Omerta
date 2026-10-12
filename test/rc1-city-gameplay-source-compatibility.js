import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { CITY_GAMEPLAY_SOURCE_PARENT_REVISIONS, CITY_GAMEPLAY_SOURCE_CURRENT_PINS,
  CITY_GAMEPLAY_SOURCE_PARENT_PINS, CITY_GAMEPLAY_SOURCE_CURRENT_BLOBS, CITY_GAMEPLAY_SOURCE_PARENT_BLOBS,
  CITY_GAMEPLAY_SOURCE_TRANSFER, qualifyCityGameplaySource, cityGameplaySourceBaseline } from '../tools/rc1-city-gameplay-source-compatibility.js';
import { CITY_HOMES_LEAGUE_SERVER_PIN, CITY_HOMES_SOURCE_INVERSES,
  cityHomesLeagueSourceBaseline, assertCityHomesLeagueServerTransfer } from '../tools/rc1-deed-source-compatibility.js';
import { COMPANY_OPERATOR_SOURCE_CURRENT_PINS, companyOperatorSourceBaseline } from '../tools/rc1-company-operator-source-compatibility.js';

const normalize = text => text.replaceAll('\r\n', '\n');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const files = ['package-lock.json','package.json','schema.sql','src/agentgateway.js','src/chain.js','src/content/phase1-policy.js',
  'src/content/phase1.js','src/crafting.js','src/db.js','src/deeds.js','src/invariants.js','src/items.js','src/mysteries.js',
  'src/server.js','src/social/estate.js','src/worldgraph-ui.js','src/worldgraph-validate.js'];
assert.deepEqual(Object.keys(CITY_GAMEPLAY_SOURCE_CURRENT_PINS), files);
for (const pins of [CITY_GAMEPLAY_SOURCE_PARENT_PINS, CITY_GAMEPLAY_SOURCE_CURRENT_BLOBS, CITY_GAMEPLAY_SOURCE_PARENT_BLOBS]) assert.deepEqual(Object.keys(pins), files);
assert.deepEqual(CITY_GAMEPLAY_SOURCE_PARENT_REVISIONS, ['101cdaaec2d5f235102e3de839043ba1fef21f81','8dbe85846035dc0fcdba76992834e411632c6f1b']);
assert.match(CITY_GAMEPLAY_SOURCE_TRANSFER.scope, /ALL new gameplay\/RPG\/Home\/NPC\/PvE\/token authority, current PostgreSQL, worker, migration, activation and deployment qualification remain outside/);
let negatives = 0;
for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8'), current = normalize(raw), parent = git('cat-file', 'blob', CITY_GAMEPLAY_SOURCE_PARENT_BLOBS[file]);
  assert.equal(hash(current), CITY_GAMEPLAY_SOURCE_CURRENT_PINS[file], 'Exact current source: ' + file);
  assert.equal(blob(current), CITY_GAMEPLAY_SOURCE_CURRENT_BLOBS[file]);
  assert.equal(hash(parent), CITY_GAMEPLAY_SOURCE_PARENT_PINS[file]); assert.equal(blob(parent), CITY_GAMEPLAY_SOURCE_PARENT_BLOBS[file]);
  for (const revision of CITY_GAMEPLAY_SOURCE_PARENT_REVISIONS) assert.equal(git('show', revision + ':' + file), parent, 'Complete reviewed predecessor: ' + file);
  const proof = qualifyCityGameplaySource(file, current);
  assert.equal(proof.baselineText, parent); assert.equal(proof.actualSha256, CITY_GAMEPLAY_SOURCE_CURRENT_PINS[file]);
  assert.equal(proof.baselineSha256, CITY_GAMEPLAY_SOURCE_PARENT_PINS[file]); assert.equal(proof.wholeBlobInverses, 1); assert.equal(proof.sourceOnly, true);
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
  const diff = normalize(git('diff', '--no-ext-diff', '--unified=3', CITY_GAMEPLAY_SOURCE_PARENT_REVISIONS[0], '--', file));
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
const server = normalize(fs.readFileSync('src/server.js', 'utf8')), parentServer = cityGameplaySourceBaseline('src/server.js', server);
assert.equal(hash(parentServer), COMPANY_OPERATOR_SOURCE_CURRENT_PINS['src/server.js'], 'The complete gameplay parent retains the operator envelope.');
const homeServer = companyOperatorSourceBaseline('src/server.js', parentServer);
assert.equal(hash(homeServer), CITY_HOMES_LEAGUE_SERVER_PIN);
assert.equal(cityHomesLeagueSourceBaseline('src/server.js', server), assertCityHomesLeagueServerTransfer(homeServer).baselineText,
  'Exactly one gameplay layer preserves the exact operator envelope before unchanged Homes and older layers.');
for (const chunk of CITY_HOMES_SOURCE_INVERSES) {
  for (const changed of [server.replace(chunk, ''), server.replace(chunk, chunk + chunk), server.replace(chunk, chunk.replace('registerCityHomes','registerUnreviewedHomes'))]) {
    assert.notEqual(changed, server); assert.equal(cityHomesLeagueSourceBaseline('src/server.js', changed), changed);
    assert.throws(() => assertCityHomesLeagueServerTransfer(cityGameplaySourceBaseline('src/server.js', changed)), /source changed/); negatives++;
  }
}
for (const file of ['src/city-encounters.js','src/city-home-interiors.js','src/city-world-opportunities.js','src/city-home-migration.js']) {
  const text = fs.readFileSync(file, 'utf8'); assert.equal(cityGameplaySourceBaseline(file, text), text, 'New modules have no predecessor alias.');
  assert.throws(() => qualifyCityGameplaySource(file, text), /Unknown gameplay source/); negatives++;
}
for (const file of ['toString','constructor','./src/server.js']) {
  assert.equal(cityGameplaySourceBaseline(file, server), server); assert.throws(() => qualifyCityGameplaySource(file, server), /Unknown gameplay source/); negatives++;
}
console.log('rc1-city-gameplay-source-compatibility PASS:', files.length, 'exact full current/operator-parent files, identical101/8dbe predecessors, preserved operator envelope, CRLF controls,', negatives,
  'tamper/unknown/no-new-module negatives; historical source-only transfer excludes all new authority/native/worker/migration/activation/deployment');
