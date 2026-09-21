import fs from 'node:fs';
import { spawn } from 'node:child_process';
import pg from 'pg';
const admin = new pg.Client({ connectionString: 'postgres://postgres@127.0.0.1:55439/postgres' });
await admin.connect();
const groups = [
  ['omerta_keeper_transport_test', ['keepertransactions', 'liquiditykeeper']],
  ['omerta_liquidity_test', ['liquidityaccounting']],
  ['omerta_liquidity_indexer_test', ['liquidityindexer', 'liquidityqueue']],
  ['omerta_liquidity_policy_test', ['liquiditypolicy']],
];
const results = [];
for (const [database, names] of groups) {
  await admin.query(`CREATE DATABASE ${database}`);
  for (const name of names) {
    const command = `node test/${name}.js`;
    const log = fs.createWriteStream(`docs/release/evidence/postgres/${name}.log`);
    const started = new Date().toISOString();
    log.write(JSON.stringify({ command, database, started }) + '\n');
    const status = await new Promise((resolve) => {
      const child = spawn(process.execPath, [`test/${name}.js`], { env: { ...process.env,
        DATABASE_URL: `postgres://postgres@127.0.0.1:55439/${database}` }, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
      child.on('close', (code, signal) => resolve(code ?? signal ?? 1));
    });
    const result = { command, database, started, finished: new Date().toISOString(), status };
    results.push(result); log.end(JSON.stringify(result) + '\n'); console.log(JSON.stringify(result));
    fs.writeFileSync('docs/release/evidence/postgres/liquidity-results.json', JSON.stringify(results, null, 2) + '\n');
  }
}
await admin.end();
process.exitCode = results.some((r) => r.status !== 0) ? 1 : 0;
