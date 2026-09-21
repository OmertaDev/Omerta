// Repaired game data -> native dump/restore -> exact frozen application rollback.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { campaignNetworkFixture } from '../../../../test/lib/campaign-network-support.js';
import { createLivingWorldDirector } from '../../../../src/director/runtime.js';
import { createCampaignNetworkDefinitions } from '../../../../src/director/campaign-network.js';

assert(process.argv.includes('--postgres'));
const adminUrl = 'postgres://postgres@127.0.0.1:55439/postgres';
const admin = new pg.Client({ connectionString: adminUrl }); await admin.connect();
const suffix = Date.now().toString(36);
const sourceDb = `omerta_rc1_rollback_source_${suffix}`, targetDb = `omerta_rc1_rollback_target_${suffix}`;
await admin.query(`CREATE DATABASE ${sourceDb}`); await admin.query(`CREATE DATABASE ${targetDb}`);
const sourceUrl = new URL(adminUrl); sourceUrl.pathname = '/' + sourceDb;
const targetUrl = new URL(adminUrl); targetUrl.pathname = '/' + targetDb;
process.env.COORDINATION_TEST_DATABASE_URL = sourceUrl.toString();
const f = await campaignNetworkFixture('rc1_rollback');
let restored;
const quote = (v) => '"' + v.replaceAll('"', '""') + '"';
async function census(pool) {
  const tables = (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname=current_schema() AND tablename <> 'schema_meta' ORDER BY tablename")).rows;
  const rows = {};
  for (const { tablename } of tables) {
    const values = (await pool.query(`SELECT row_to_json(t) AS value FROM ${quote(tablename)} t`)).rows
      .map((r) => JSON.stringify(r.value)).sort();
    rows[tablename] = { count: values.length, sha256: crypto.createHash('sha256').update(values.join('\n')).digest('hex') };
  }
  return rows;
}
const frozen = 'C:/Users/Jorge/.codex/worktrees/omerta-rc1-pristine';
const frozenSha = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: frozen, encoding: 'utf8' }).stdout.trim();
assert.equal(frozenSha, '626e61b9ab2b14a9dc45566983b70cdc65692839');
const childCode = `import assert from 'node:assert/strict'; import {buildServer} from './src/server.js';
  const app=await buildServer(); try { const health=await app.inject({method:'GET',url:'/health'});
    assert.equal(health.statusCode,200); console.log('ROLLBACK_BOOT_HEALTH 200');
  } finally { await app.close(); }`;
function boot(cwd, url) {
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', childCode], { cwd, encoding: 'utf8', timeout: 90000,
    env: { ...process.env, DATABASE_URL: url.toString(), JWT_SECRET: 'rc1-rollback-local-jwt-only-value',
      MOD_KEY: 'rc1-rollback-local-mod-only-value', MARKET_SEED: 'rc1RollbackMarketSeed7Qx2mVb9PwLn4RtY6', SOCIAL_VERIFY_MODE: 'off', POPULATION_OFF: 'on' } });
  process.stdout.write(child.stdout || ''); process.stderr.write(child.stderr || '');
  assert.equal(child.status, 0, child.error?.message || 'Application boot failed');
}
try {
  await f.networkEstablish();
  const director = createLivingWorldDirector({ pool: f.pool, content: f.content,
    definitions: createCampaignNetworkDefinitions(f.content), mode: 'LIVE', clock: f.clock });
  await director.tick();
  const operation = await f.networkPrepare('destroy_shipment');
  await operation.command('organizer', 'execute'); await director.tick();
  const namespace = (await f.pool.query('SELECT current_schema() AS name')).rows[0].name;
  sourceUrl.searchParams.set('options', `-c search_path=${namespace}`);
  targetUrl.searchParams.set('options', `-c search_path=${namespace}`);
  boot(process.cwd(), sourceUrl);
  const before = await census(f.pool);
  for (const table of ['characters', 'coordination_instances', 'world_kernel_objects', 'world_operations', 'item_instances', 'director_campaigns']) {
    assert(before[table]?.count > 0, `Non-vacuous rollback data for ${table}`);
  }
  const dump = path.join(os.tmpdir(), `omerta-rc1-rollback-${suffix}.dump`);
  const plainSource = new URL(sourceUrl); plainSource.search = '';
  const plainTarget = new URL(targetUrl); plainTarget.search = '';
  const binary = 'C:/Program Files/PostgreSQL/18/bin';
  for (const [exe, args] of [
    ['pg_dump.exe', ['--format=custom', '--file', dump, plainSource.toString()]],
    ['pg_restore.exe', ['--no-owner', '--dbname', plainTarget.toString(), dump]],
  ]) {
    console.log(exe + ' ' + args.join(' '));
    const child = spawnSync(path.join(binary, exe), args, { encoding: 'utf8', timeout: 90000 });
    assert.equal(child.status, 0, child.stderr || child.error?.message);
  }
  restored = new pg.Pool({ connectionString: targetUrl.toString() });
  assert.deepEqual(await census(restored), before, 'Native restore retains every application row byte-for-byte');
  console.log(`RESTORE: exact row hashes preserved across ${Object.keys(before).length} tables`);
  boot(frozen, targetUrl);
  const after = await census(restored);
  assert.deepEqual(after, before, 'Prior frozen application boot does not alter any canonical restored rows');
  const result = { source: 'frozen SHA plus documented RC gate repairs', rollbackSha: frozenSha, sourceDb, targetDb, namespace,
    tables: Object.keys(before).length, nonemptyTables: Object.values(before).filter((r) => r.count > 0).length,
    dump, dumpSha256: crypto.createHash('sha256').update(fs.readFileSync(dump)).digest('hex'), census: before };
  fs.writeFileSync('docs/release/evidence/postgres/rollback-proof.json', JSON.stringify(result, null, 2) + '\n');
  console.log(`ROLLBACK PASS: exact ${frozenSha} app boots restored campaign/operation/item/knowledge state; every table hash retained`);
} finally {
  await restored?.end(); await f.cleanup(); await admin.end();
}
