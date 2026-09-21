// Disposable localhost-only PostgreSQL release evidence. Never targets production.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { Client } from 'pg';

const root = process.cwd();
const dir = path.join(root, 'docs/release/evidence/postgres');
const endpoint = process.env.RC1_POSTGRES_URL || 'postgres://postgres@127.0.0.1:55439/postgres';
const parsed = new URL(endpoint);
if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || parsed.port !== '55439') throw Error('Refusing non-RC1 disposable cluster');
const packages = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const gates = process.argv.slice(2).length ? process.argv.slice(2) : [
  'pgquery', 'pgcheck', 'phase2:definitions:postgres', 'phase2:lots:postgres',
  'test:coordination:postgres', 'test:world-kernel:postgres', 'test:family-operations:postgres',
  'test:world-projections:postgres', 'test:core-progression:postgres', 'test:player-commands:postgres',
  'test:director:postgres', 'test:stockcatalogv2:postgres', 'test:rwahealth:postgres',
  'test:rwaregistrylifecycle:postgres', 'test:audit:mint-dev:postgres', 'test:audit:deed-reimport:postgres',
  'concurrency', 'loadtest',
];
const admin = new Client({ connectionString: endpoint });
await admin.connect();
console.log(JSON.stringify({ server: (await admin.query('SELECT version() AS version')).rows[0].version, node: process.version, platform: process.platform }));
const results = [];
for (const gate of gates) {
  const name = gate.replaceAll(':', '-');
  const pinnedDatabases = { 'test:audit:mint-dev:postgres': 'omerta_audit_mint_dev',
    'test:audit:deed-reimport:postgres': 'omerta_audit_deed_recovery' };
  const dbName = pinnedDatabases[gate] || ('omerta_rc1_' + name.replaceAll('-', '_').slice(0, 42) + '_' + Date.now().toString(36));
  await admin.query(`CREATE DATABASE "${dbName}"`);
  const url = new URL(endpoint); url.pathname = '/' + dbName;
  const env = { ...process.env, DATABASE_URL: url.toString(), TEST_DATABASE_URL: url.toString(),
    COORDINATION_TEST_DATABASE_URL: url.toString(), WORLD_KERNEL_TEST_DATABASE_URL: url.toString(),
    RWA_HEALTH_TEST_DATABASE_URL: url.toString(), RWA_REGISTRY_LIFECYCLE_TEST_DATABASE_URL: url.toString(),
    JWT_SECRET: 'rc1-local-jwt-evidence-only-value', MOD_KEY: 'rc1-local-mod-evidence-only-value',
    MARKET_SEED: 'rc1LocalMarketSeed7Qx2mVb9PwLn4RtY6', SOCIAL_VERIFY_MODE: 'off',
    POPULATION_OFF: 'on', LOAD_PLAYERS: '8', PATH: 'C:/Program Files/PostgreSQL/18/bin;' + process.env.PATH };
  const log = fs.createWriteStream(path.join(dir, name + '.log'));
  const started = new Date().toISOString();
  log.write(JSON.stringify({ gate, command: `npm run ${gate}`, script: packages.scripts[gate], dbName, started }) + '\n');
  let status = 0;
  for (const command of packages.scripts[gate].split(' && ')) {
    const args = command.split(' ');
    if (args.shift() !== 'node') throw Error('Only direct Node gate commands supported');
    status = await new Promise((resolve) => {
      const child = spawn(process.execPath, args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
      child.on('error', (e) => { log.write(String(e)); resolve(127); });
      child.on('close', (code, signal) => resolve(code ?? signal ?? 1));
    });
    if (status !== 0) break;
  }
  const result = { gate, command: `npm run ${gate}`, dbName, started, finished: new Date().toISOString(), status };
  results.push(result); log.end('\n' + JSON.stringify(result) + '\n');
  fs.writeFileSync(path.join(dir, 'results-' + gates[0].replaceAll(':', '-') + '.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(result));
}
await admin.end();
process.exitCode = results.some((r) => r.status !== 0) ? 1 : 0;
