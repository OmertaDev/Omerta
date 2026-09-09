// Private launch export/import. Generation never contacts a database or writes under the repository.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateInviteCode } from '../src/invites.js';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function makeInviteBatch(count = 5000) {
  if (!Number.isInteger(count) || count < 1 || count > 5000) throw new Error('Count must be an integer from 1 to 5000.');
  const codes = new Set();
  while (codes.size < count) codes.add(generateInviteCode());
  return { batchId: crypto.randomUUID(), generatedAt: new Date().toISOString(), uses: 1, count, codes: [...codes] };
}
export function validateBatch(batch) {
  if (!batch || !/^[a-f0-9-]{36}$/.test(batch.batchId) || batch.uses !== 1
    || !Number.isInteger(batch.count) || batch.count < 1 || batch.count > 5000
    || !Array.isArray(batch.codes) || batch.codes.length !== batch.count
    || new Set(batch.codes).size !== batch.count
    || !batch.codes.every((code) => typeof code === 'string' && /^OMR-(?:[A-HJ-NP-Z2-9]{5}-){3}[A-HJ-NP-Z2-9]{5}$/.test(code)))
    throw new Error('Invalid invite batch; no database writes made.');
  return batch;
}
export function exportBatch(batch, outputDir) {
  validateBatch(batch);
  if (!outputDir) throw new Error('An explicit --output-dir outside the repository is required.');
  const dir = path.resolve(outputDir), relative = path.relative(repo, dir);
  if (!relative || (!relative.startsWith('..' + path.sep) && !path.isAbsolute(relative)))
    throw new Error('Invite batches must be stored outside the repository.');
  if (fs.existsSync(dir)) throw new Error('Output directory already exists; refusing to overwrite an invite batch.');
  fs.mkdirSync(path.dirname(dir), { recursive: true, mode: 0o700 });
  fs.mkdirSync(dir, { mode: 0o700 });
  const write = (name, contents) => fs.writeFileSync(path.join(dir, name), contents, { flag: 'wx', mode: 0o600 });
  write('invites.json', JSON.stringify(batch, null, 2) + '\n');
  write('invites.csv', 'number,code,uses,invite_url\n' + batch.codes.map((code, i) => `${i + 1},${code},1,https://www.omerta.fun/#invite=${code}`).join('\n') + '\n');
  write('invites.txt', batch.codes.join('\n') + '\n');
  write('import.sql', '-- Replaying this import NEVER replenishes a used code.\nBEGIN;\nINSERT INTO invite_codes (code, uses_left, created_by) VALUES\n'
    + batch.codes.map((code) => `('${code}',1,'launch:${batch.batchId}')`).join(',\n') + '\nON CONFLICT (code) DO NOTHING;\nCOMMIT;\n');
  const csvSha256 = crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, 'invites.csv'))).digest('hex');
  write('README.txt', `OMERTA LAUNCH INVITES\n${batch.count} unique single-use codes.\nBatch: ${batch.batchId}\nGenerated: ${batch.generatedAt}\nCSV SHA-256: ${csvSha256}\n\nSTATUS: Generated locally. Import into the target database before distribution.\nKeep all files private and outside public hosting and Git.\n\nWith the intended DATABASE_URL set, from the repository:\nnode tools/invites.js import --output-dir "${dir}"\n\nRe-import never restores spent codes. Existing accounts retain access.\nPlayer-issued Crew codes have a separate three-code lifetime allowance.\n`);
  return { count: batch.count, batchId: batch.batchId, outputDir: dir, csvSha256, activated: false };
}
export async function importBatch(pool, input) {
  const batch = validateBatch(input), creator = `launch:${batch.batchId}`, client = await pool.connect();
  let inserted = 0;
  try {
    await client.query('BEGIN');
    for (let start = 0; start < batch.codes.length; start += 200) {
      const codes = batch.codes.slice(start, start + 200);
      const lookup = `SELECT code, created_by FROM invite_codes WHERE code IN (${codes.map((_c, i) => '$' + (i + 1)).join(',')})`;
      const before = (await client.query(lookup, codes)).rows;
      if (before.some((row) => row.created_by !== creator)) throw new Error('A code belongs to another batch; import rolled back.');
      const known = new Set(before.map((row) => row.code));
      const missing = codes.filter((code) => !known.has(code));
      if (missing.length) {
        const tuples = missing.map((_code, i) => `($${i * 2 + 1},1,$${i * 2 + 2})`).join(',');
        const result = await client.query(`INSERT INTO invite_codes (code, uses_left, created_by) VALUES ${tuples} ON CONFLICT (code) DO NOTHING RETURNING code`, missing.flatMap((code) => [code, creator]));
        inserted += result.rows.length;
      }
      const existing = (await client.query(lookup, codes)).rows;
      if (existing.length !== codes.length || existing.some((row) => row.created_by !== creator))
        throw new Error('A code belongs to another batch; import rolled back without changing its uses.');
    }
    await client.query('COMMIT');
    return { count: batch.count, inserted, alreadyPresent: batch.count - inserted, batchId: batch.batchId };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
async function main() {
  const [command, ...args] = process.argv.slice(2), options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!['--count', '--output-dir'].includes(args[i]) || !args[i + 1] || options[args[i]] !== undefined)
      throw new Error('Usage: node tools/invites.js generate|import --output-dir <private-directory> [--count 5000]');
    options[args[i]] = args[i + 1];
  }
  if (command === 'generate') console.log(JSON.stringify(exportBatch(makeInviteBatch(options['--count'] === undefined ? 5000 : Number(options['--count'])), options['--output-dir']), null, 2));
  else if (command === 'import') {
    if (!options['--output-dir'] || options['--count']) throw new Error('Import requires --output-dir and uses the exact saved batch.');
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for import; refusing an ephemeral database.');
    const batch = validateBatch(JSON.parse(fs.readFileSync(path.join(path.resolve(options['--output-dir']), 'invites.json'), 'utf8')));
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    try { console.log(JSON.stringify(await importBatch(pool, batch), null, 2)); }
    finally { await pool.end(); }
  } else throw new Error('Choose generate or import. Generation is offline; import writes the saved batch to DATABASE_URL.');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
