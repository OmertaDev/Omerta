import { cityHomesLeagueSourceBaseline, assertCityHomesLeagueServerTransfer, CITY_HOMES_SOURCE_INVERSES, CITY_HOMES_LEAGUE_SERVER_BLOB, CITY_HOMES_LEAGUE_PREDECESSOR_SERVER_BLOB } from '../tools/rc1-deed-source-compatibility.js';
import { cityGameplaySourceBaseline } from '../tools/rc1-city-gameplay-source-compatibility.js';
import { marketFeedSourceBaseline, MARKET_FEED_SOURCE_CURRENT_PINS } from '../tools/rc1-market-feed-source-compatibility.js';
import { qualifyCompanySuccessionSource, COMPANY_SUCCESSION_SOURCE_BASELINE_BLOBS } from '../tools/rc1-company-succession-source-compatibility.js';
import { strategySourceBaseline } from '../tools/rc1-strategy-source-compatibility.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { STRATEGY_LEAGUE_SOURCE_CURRENT_PINS, STRATEGY_LEAGUE_SOURCE_BASELINE_PINS, STRATEGY_LEAGUE_SOURCE_CURRENT_BLOBS, STRATEGY_LEAGUE_SOURCE_BASELINE_BLOBS,
  STRATEGY_LEAGUE_SOURCE_REVIEWED_REVISION, STRATEGY_LEAGUE_SOURCE_PREDECESSOR_REVISION, STRATEGY_LEAGUE_SOURCE_INVERSES, STRATEGY_LEAGUE_SOURCE_TRANSFER,
  assertStrategyLeagueSourceTransfer, qualifyStrategyLeagueSource, strategyLeagueSourceBaseline } from '../tools/rc1-strategy-league-source-compatibility.js';
const normalize = text => text.replaceAll('\r\n', '\n');
const gitText = spec => normalize(execFileSync('git', ['show', spec], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const homeRaw=cityGameplaySourceBaseline('src/server.js',normalize(fs.readFileSync('src/server.js','utf8')));
const homeProof=assertCityHomesLeagueServerTransfer(homeRaw);
assert.equal(homeRaw,gitText(CITY_HOMES_LEAGUE_SERVER_BLOB));
assert.equal(homeProof.baselineText,gitText(CITY_HOMES_LEAGUE_PREDECESSOR_SERVER_BLOB));
assert.equal(homeProof.baselineText,gitText('e018820492ce00eeae766455164067ff5ecfcc10:src/server.js'));
assert.deepEqual(assertCityHomesLeagueServerTransfer(homeRaw.replaceAll('\n','\r\n')),homeProof);
for(const chunk of CITY_HOMES_SOURCE_INVERSES) {
 for(const altered of [homeRaw.replace(chunk,''),homeRaw.replace(chunk,chunk+chunk),homeRaw.replace(chunk,chunk.replace('registerCityHomes','registerOtherHomes'))]) {
  assert.equal(cityHomesLeagueSourceBaseline('src/server.js',altered),altered);
  assert.throws(()=>assertCityHomesLeagueServerTransfer(altered),/source changed/);
 }
}
for(const altered of [homeRaw+'\n// unknown Home suffix\n',homeRaw.replace('registerStrategyLeagues(app','registerOtherLeagues(app')]) {
 assert.notEqual(altered,homeRaw);
 assert.equal(cityHomesLeagueSourceBaseline('src/server.js',altered),altered);
 assert.throws(()=>assertCityHomesLeagueServerTransfer(altered),/source changed/);
}
let chunks = 0, negatives = 0;
for (const file of Object.keys(STRATEGY_LEAGUE_SOURCE_CURRENT_PINS)) {
  const current = normalize(cityHomesLeagueSourceBaseline(file, fs.readFileSync(file, 'utf8'))), baseline = gitText(STRATEGY_LEAGUE_SOURCE_BASELINE_BLOBS[file]);
  assert.equal(strategyLeagueSourceBaseline(file, current), baseline);
  assert.equal(strategyLeagueSourceBaseline(file, baseline), baseline);
  const unknown = current + '\n// unknown source suffix\n';
  assert.equal(strategyLeagueSourceBaseline(file, unknown), unknown, 'composition must not manufacture historical bytes for unreviewed source');
  assert.throws(() => qualifyStrategyLeagueSource(file, strategyLeagueSourceBaseline(file, unknown)), /source changed/);
  assert.equal(current, gitText(STRATEGY_LEAGUE_SOURCE_CURRENT_BLOBS[file]), 'Complete runtime bytes match frozen current Git blob: ' + file);
  assert.equal(current, gitText(STRATEGY_LEAGUE_SOURCE_REVIEWED_REVISION + ':' + file));
  assert.equal(baseline, gitText(STRATEGY_LEAGUE_SOURCE_PREDECESSOR_REVISION + ':' + file));
  assert.equal(hash(current), STRATEGY_LEAGUE_SOURCE_CURRENT_PINS[file]);
  assert.equal(hash(baseline), STRATEGY_LEAGUE_SOURCE_BASELINE_PINS[file]);
  const diff = normalize(execFileSync('git', ['diff', '--no-ext-diff', '--unified=3',
    STRATEGY_LEAGUE_SOURCE_PREDECESSOR_REVISION, STRATEGY_LEAGUE_SOURCE_REVIEWED_REVISION, '--', file], { encoding: 'utf8' }));
  const gitChunks = []; let hunk;
  for (const line of diff.split('\n')) {
    if (line.startsWith('@@ ')) { hunk = { current: '', baseline: '' }; gitChunks.push(hunk); continue; }
    if (!hunk) continue;
    if (line.startsWith(' ')) { hunk.current += line.slice(1) + '\n'; hunk.baseline += line.slice(1) + '\n'; }
    else if (line.startsWith('+')) hunk.current += line.slice(1) + '\n';
    else if (line.startsWith('-')) hunk.baseline += line.slice(1) + '\n';
  }
  assert.deepEqual(STRATEGY_LEAGUE_SOURCE_INVERSES[file], gitChunks, 'Only actual complete Git diff hunks qualify: ' + file);
  const proof = assertStrategyLeagueSourceTransfer(file, current);
  assert.equal(proof.baselineText, baseline, 'All exact inverses reconstruct the entire predecessor file: ' + file);
  assert.equal(proof.sourceBlob, STRATEGY_LEAGUE_SOURCE_CURRENT_BLOBS[file]);
  assert.equal(proof.predecessorBlob, STRATEGY_LEAGUE_SOURCE_BASELINE_BLOBS[file]);
  assert.equal(proof.actualSha256, STRATEGY_LEAGUE_SOURCE_CURRENT_PINS[file]);
  assert.equal(proof.baselineSha256, STRATEGY_LEAGUE_SOURCE_BASELINE_PINS[file]);
  assert.equal(proof.inverseChunks, STRATEGY_LEAGUE_SOURCE_TRANSFER.inverseChunks[file]);
  assert.equal(qualifyStrategyLeagueSource(file, current).baselineText, baseline);
  const beforeCompany = marketFeedSourceBaseline(file, strategyLeagueSourceBaseline(file, current));
  assert.equal(qualifyCompanySuccessionSource(file, beforeCompany).baselineText, gitText(COMPANY_SUCCESSION_SOURCE_BASELINE_BLOBS[file]), 'Complete feed and company inverses preserve their whole predecessor and immutable pins');
  if(Object.hasOwn(MARKET_FEED_SOURCE_CURRENT_PINS,file))assert.equal(hash(baseline),MARKET_FEED_SOURCE_CURRENT_PINS[file]);
  const unchanged = qualifyStrategyLeagueSource(file, baseline);
  assert.equal(unchanged.baselineText, baseline); assert.equal(unchanged.inverseChunks, 0);
  assert.equal(unchanged.sourceBlob, STRATEGY_LEAGUE_SOURCE_BASELINE_BLOBS[file]);
  assert.equal(assertStrategyLeagueSourceTransfer(file, current.replaceAll('\n', '\r\n')).baselineText, baseline);
  assert.equal(qualifyStrategyLeagueSource(file, baseline.replaceAll('\n', '\r\n')).baselineText, baseline);
  for (const chunk of STRATEGY_LEAGUE_SOURCE_INVERSES[file]) {
    const lines = chunk.current.split('\n');
    const context = lines.find(line => line.trim() && chunk.baseline.includes(line + '\n'));
    const addition = lines.find(line => line.trim() && !chunk.baseline.includes(line + '\n'));
    assert(context && addition, 'Every frozen hunk has actual added logic and protected context');
    for (const target of [context, addition]) {
      const alteredChunk = chunk.current.replace(target, target + ' /* unsupported hunk change */');
      const alteredSource = current.replace(chunk.current, alteredChunk);
      assert.notEqual(alteredSource, current);
      assert.throws(() => qualifyStrategyLeagueSource(file, alteredSource), /source changed/); negatives++;
    }
    chunks++; assert.equal(current.split(chunk.current).length, 2, 'Every exact addition appears once: ' + file);
    for (const changed of [current.replace(chunk.current, ''), current.replace(chunk.current, chunk.current + chunk.current)]) {
      assert.notEqual(changed, current); assert.notEqual(changed, baseline, 'Partial deletion is not the complete predecessor');
      assert.throws(() => assertStrategyLeagueSourceTransfer(file, changed), /source changed/);
      assert.throws(() => qualifyStrategyLeagueSource(file, changed), /source changed/); negatives++;
    }
  }
  for (const text of [current, baseline]) {
    const changed = text + '\n// unsupported source suffix\n';
    assert.throws(() => qualifyStrategyLeagueSource(file, changed), /source changed/); negatives++;
  }
  const altered = current.replace(/^import /m, 'import/* changed */ ');
  assert.notEqual(altered, current); assert.throws(() => qualifyStrategyLeagueSource(file, altered), /source changed/); negatives++;
  const protectedLine = current.split('\n').find(line => line.trim() && !STRATEGY_LEAGUE_SOURCE_INVERSES[file].some(chunk => chunk.current.includes(line + '\n')));
  assert(protectedLine, 'Protected predecessor logic exists outside inverse chunks: ' + file);
  assert.throws(() => qualifyStrategyLeagueSource(file, current.replace(protectedLine, protectedLine + ' /* altered protected logic */')), /source changed/); negatives++;
  assert.throws(() => assertStrategyLeagueSourceTransfer(file, baseline), /source changed/, 'Current transfer never treats historical bytes as the new integration');
}
assert.throws(() => qualifyStrategyLeagueSource('src/worker.js', ''), /Unknown Strategy League source/);
assert.throws(() => qualifyStrategyLeagueSource('src/game.js', ''), /Unknown Strategy League source/);
assert.throws(() => qualifyStrategyLeagueSource('toString', ''), /Unknown Strategy League source/);
assert.match(STRATEGY_LEAGUE_SOURCE_TRANSFER.scope, /separate current-source native proof/);
assert.match(STRATEGY_LEAGUE_SOURCE_TRANSFER.scope, /no historical runtime, native, deployment or financial qualification/);
console.log(JSON.stringify({ status: 'PASS', sourceRevision: STRATEGY_LEAGUE_SOURCE_REVIEWED_REVISION, predecessorRevision: STRATEGY_LEAGUE_SOURCE_PREDECESSOR_REVISION, files: 2, chunks, negatives,
  scope: 'Complete frozen current/prior blobs, exact unique Git diff hunk inverses and regression controls only; no new native or financial qualification' }));
