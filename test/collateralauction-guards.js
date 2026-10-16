import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const leaf = new URL('./collateralauction-fixture.js', import.meta.url).href;
const source = `process.argv=['node','collateral-guard','--postgres']; try { await (await import(${JSON.stringify(leaf)})).collateralAuctionBackend(); throw Error('guard accepted'); } catch(error) { if(!['AssertionError','TypeError'].includes(error.name)) throw error; console.log(error.name+':'+error.code); }`;
const env = { ...process.env }; delete env.DATABASE_URL; delete env.NODE_OPTIONS; delete env.NODE_PATH;
for (const key of Object.keys(env)) if (/^PG[A-Z_]/.test(key)) delete env[key];
const goodShape = 'postgres://pilot_runner@127.0.0.1:35449/collateral_auction_test_012345abcdef';
const controls = [
  { COLLATERAL_AUCTION_TEST_DATABASE_URL: '' },
  ...['https://127.0.0.1:35449/collateral_auction_test_012345abcdef', goodShape.replace('127.0.0.1','localhost'),
    goodShape.replace(':35449',':5433'), goodShape.replace('pilot_runner','postgres'), goodShape.replace('pilot_runner@','pilot_runner:secret@'),
    goodShape.replace('collateral_auction_test_012345abcdef','postgres'), goodShape.replace('012345abcdef','012345abcdeg'),
    goodShape+'?sslmode=disable', goodShape+'#override'].map(url=>({COLLATERAL_AUCTION_TEST_DATABASE_URL:url})),
  { COLLATERAL_AUCTION_TEST_DATABASE_URL: goodShape, DATABASE_URL: goodShape },
  { COLLATERAL_AUCTION_TEST_DATABASE_URL: goodShape, NODE_PATH: '.' },
  { COLLATERAL_AUCTION_TEST_DATABASE_URL: goodShape, PGHOST: '127.0.0.1' },
  { COLLATERAL_AUCTION_TEST_DATABASE_URL: goodShape, PGOPTIONS: '-c search_path=public' }
];
for (const control of controls) {
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', source], { env: { ...env, ...control }, encoding:'utf8' });
  assert.equal(child.status, 0, child.stderr); assert.match(child.stdout, /^(AssertionError:ERR_ASSERTION|TypeError:ERR_INVALID_URL)/);
  assert(!child.stdout.includes('[db]'));
}
for (const file of ['collateralauction-native-prepare.js','collateralauction-native.js']) {
  const child = spawnSync(process.execPath, [new URL(file, import.meta.url).pathname.slice(1)], {env,encoding:'utf8'});
  assert.notEqual(child.status, 0); assert.match(child.stderr, /Positive cash-loan\/custody integration requires the actual native backend/);
  assert(!child.stdout.includes('[db]'));
}
const historical = spawnSync(process.execPath, [new URL('collateralauction-native-finalack.js', import.meta.url).pathname.slice(1)], {env,encoding:'utf8'});
assert.notEqual(historical.status, 0); assert.match(historical.stderr, /--inherited-default/); assert(!historical.stdout.includes('[db]'));
console.log('PASS '+controls.length+' exact preconnect endpoint/ambient refusals, two fresh native-only fixture guards and one exact inherited-history CLI guard; zero accepted endpoints');
