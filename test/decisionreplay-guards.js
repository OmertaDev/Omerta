import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
assert(!process.env.DATABASE_URL,'No ambient endpoint');
const good='postgresql://pilot_runner@127.0.0.1:35439/economic_intelligence_test_decision_replay_0123456789ab';
const invalid=[good.replace('127.0.0.1','example.com'),good.replace('pilot_runner','postgres'),good.replace('35439','5433'),good.replace('pilot_runner@','pilot_runner:secret@'),good.replace('0123456789ab','short'),good.replace('economic_intelligence_test_decision_replay_','unowned_'),good+'?sslmode=disable',good+'#fragment',good.replace('postgresql:','https:')];
for(const endpoint of invalid){
 const env={...process.env,DECISION_REPLAY_TEST_DATABASE_URL:endpoint};delete env.DATABASE_URL;
 const result=spawnSync(process.execPath,['--input-type=module','--eval',"await (await import('./test/decisionreplay-fixture.js')).decisionReplayFixture()",'--','--postgres'],{env,encoding:'utf8'});
 assert.notEqual(result.status,0);assert.match(result.stderr,/AssertionError/);assert(!result.stdout.includes('Postgres ready'));
}
console.log('Decision replay fixture endpoint guard PASS: nine explicit bad endpoint/role/namespace/credential refusals before database boot; no connections.');
