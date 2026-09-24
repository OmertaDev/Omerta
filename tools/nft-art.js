#!/usr/bin/env node
// Offline commissioning only. Rendering an NFT never calls a paid API.
// node tools/nft-art.js --list
// FAL_KEY=... node tools/nft-art.js --generate
// FAL_KEY=... node tools/nft-art.js --portrait <character-id>
// FAL_KEY=... node tools/nft-art.js --deed <street-name> --district docks
// node tools/nft-art.js --import-results <json-array-of-id-url-objects>
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { NFT_ART_JOBS, NFT_MODEL, NFT_PORTRAIT_MODEL, nftArtCost, DEED_SUBJECTS, portraitPrompt, deedPrompt } from './nft-art-prompts.js';
import { hasPaidPortraitFee } from '../src/portrait-access.js';

const out = new URL('../public/art/nft/', import.meta.url);
const ledgerFile = new URL('manifest.json', out);
const args = process.argv.slice(2);
const value = (flag) => args.includes(flag) ? args[args.indexOf(flag) + 1] : null;
const sha = (s) => createHash('sha256').update(s).digest('hex');
const canonical = (s) => String(s).normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
const dollars = (amount) => Math.round(amount * 1000) / 1000;
const dimensions = (id) => ({ width: 1024, height: id.startsWith('deed-') ? 768 : 1024 });
const ledger = fs.existsSync(ledgerFile) ? JSON.parse(fs.readFileSync(ledgerFile, 'utf8'))
  : { version: 1, collection: 'OMERTA / The City Keeps Its Own', estimatedSpendUsd: 0, jobs: {} };
fs.mkdirSync(out, { recursive: true });
const save = () => {
  const temp = new URL('manifest.json.tmp', out);
  fs.writeFileSync(temp, JSON.stringify(ledger, null, 2) + '\n');
  fs.renameSync(temp, ledgerFile);
};
function mediaUrl(raw) {
  const u = new URL(raw);
  if (u.protocol !== 'https:' || !(u.hostname === 'fal.media' || u.hostname.endsWith('.fal.media')))
    throw new Error('Expected a fal.media HTTPS result.');
  return u.href;
}
async function collect(job) {
  const dest = new URL(job.id + '.jpg', out);
  if (job.status === 'downloaded' && fs.existsSync(dest)) return;
  const r = await fetch(mediaUrl(job.url), { signal: AbortSignal.timeout(60000), redirect: 'error' });
  if (!r.ok) throw new Error(`Media HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > 2 * 1024 * 1024 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff)
    throw new Error('Expected a JPEG no larger than 2 MiB.');
  // Read the JPEG's actual dimensions, including results imported from the playground.
  let size;
  for (let offset = 2; offset + 9 < buf.length;) {
    if (buf[offset++] !== 0xff) throw new Error('Invalid JPEG marker.');
    while (buf[offset] === 0xff) offset++;
    const marker = buf[offset++];
    if (marker === 0xda || marker === 0xd9) break;
    const length = buf.readUInt16BE(offset);
    if (length < 2 || offset + length > buf.length) throw new Error('Invalid JPEG segment.');
    if ([0xc0, 0xc1, 0xc2].includes(marker)) { size = { width: buf.readUInt16BE(offset + 5), height: buf.readUInt16BE(offset + 3) }; break; }
    offset += length;
  }
  if (!size?.width || !size?.height) throw new Error('Missing JPEG dimensions.');
  const estimatedUsd = nftArtCost(job.model, size);
  ledger.estimatedSpendUsd = dollars(ledger.estimatedSpendUsd + estimatedUsd - job.estimatedUsd);
  Object.assign(job, { image_size: size, estimatedUsd });
  if (fs.existsSync(dest) && sha(fs.readFileSync(dest)) !== sha(buf))
    throw new Error(`Refusing to replace published artwork ${job.id}.`);
  fs.writeFileSync(dest, buf);
  Object.assign(job, { status: 'downloaded', sha256: sha(buf), bytes: buf.length });
  save();
  console.log(`${job.id}: saved (${Math.round(buf.length / 1024)} KB)`);
}

if (args.includes('--list')) {
  for (const j of NFT_ART_JOBS) console.log(`${fs.existsSync(new URL(j.id + '.jpg', out)) ? 'ready' : 'missing'} ${j.id}`);
} else if (value('--import-results')) {
  // Import completed browser-playground results without creating another paid request.
  const imported = JSON.parse(fs.readFileSync(value('--import-results'), 'utf8'));
  if (!Array.isArray(imported)) throw new Error('Expected an array of { id, url, seed? } results.');
  for (const result of imported) {
    const recipe = NFT_ART_JOBS.find((j) => j.id === result.id);
    if (!recipe) throw new Error('Unknown library plate ID.');
    const url = mediaUrl(result.url);
    if (ledger.jobs[recipe.id]?.url && ledger.jobs[recipe.id].url !== url)
      throw new Error(`A different result already exists for ${recipe.id}.`);
    if (!ledger.jobs[recipe.id]) {
      // Imported provenance names the actual model, rather than guessing from today's default.
      const model = result.model;
      const cost = nftArtCost(model, dimensions(recipe.id));
      ledger.jobs[recipe.id] = { ...recipe, model, source: 'fal.ai playground',
        image_size: dimensions(recipe.id), seed: result.seed ?? null,
        url, estimatedUsd: cost, status: 'generated', recordedAt: new Date().toISOString() };
      ledger.estimatedSpendUsd = dollars(ledger.estimatedSpendUsd + cost);
      save();
    }
    await collect(ledger.jobs[recipe.id]);
  }
} else if (args.includes('--generate') || value('--portrait') || value('--deed')) {
  const key = process.env.FAL_KEY || (process.env.FAL_KEY_FILE && fs.readFileSync(process.env.FAL_KEY_FILE, 'utf8').trim());
  if (!key) throw new Error('Supply FAL_KEY or FAL_KEY_FILE in the process environment.');
  const cap = Number(process.env.NFT_ART_CAP_USD || 0.75);
  if (!Number.isFinite(cap) || cap <= 0) throw new Error('NFT_ART_CAP_USD must be positive.');
  let jobs = NFT_ART_JOBS;
  if (value('--portrait')) {
    // Commissioning a real character is also payment-gated. Do not migrate or seed the game DB
    // from an art command; this connection only reads the watcher-attributed payment receipt.
    if (!process.env.DATABASE_URL) throw new Error('--portrait requires DATABASE_URL to verify the character-creation payment.');
    const { default: pg } = await import('pg');
    const database = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    try {
      const character = (await database.query('SELECT account_id FROM characters WHERE id=$1', [value('--portrait')])).rows[0];
      if (!character || !await hasPaidPortraitFee(database, character.account_id))
        throw new Error('Portrait is sealed: the character-creation fee has not been confirmed.');
    } finally { await database.end(); }
    const digest = sha(value('--portrait'));
    jobs = [{ id: `portrait-${digest}`, prompt: portraitPrompt(parseInt(digest.slice(0, 8), 16)), model: NFT_PORTRAIT_MODEL }];
  } else if (value('--deed')) {
    const district = value('--district');
    if (!Object.hasOwn(DEED_SUBJECTS, district)) throw new Error('Supply a known --district for the Deed.');
    jobs = [{ id: `deed-${sha(canonical(value('--deed')))}`, prompt: deedPrompt(district), model: NFT_MODEL }];
  }
  // Sequential reservations: ambiguous attempts stay charged against the cap and never auto-repeat.
  for (const recipe of jobs) {
    let job = ledger.jobs[recipe.id];
    if (job?.url) { await collect(job); continue; }
    if (job) throw new Error(`${recipe.id}: reconcile the prior ${job.status} attempt in fal before retrying.`);
    if (fs.existsSync(new URL(recipe.id + '.jpg', out))) throw new Error(`${recipe.id}: existing art needs a provenance record.`);
    const cost = nftArtCost(recipe.model, dimensions(recipe.id));
    if (dollars(ledger.estimatedSpendUsd + cost) > cap) throw new Error(`NFT art cap of $${cap} reached.`);
    const seed = parseInt(sha(recipe.id).slice(0, 8), 16) & 0x7fffffff;
    job = ledger.jobs[recipe.id] = { ...recipe, seed, estimatedUsd: cost,
      image_size: dimensions(recipe.id), status: 'submitting', recordedAt: new Date().toISOString() };
    ledger.estimatedSpendUsd = dollars(ledger.estimatedSpendUsd + cost);
    save();
    const r = await fetch(`https://fal.run/${job.model}`, {
      method: 'POST', headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: job.prompt, seed, image_size: job.image_size, num_images: 1,
        ...(job.model === NFT_PORTRAIT_MODEL ? { num_inference_steps: 4 } : {}),
        output_format: 'jpeg', enable_safety_checker: true }),
      signal: AbortSignal.timeout(180000), redirect: 'error',
    });
    if (!r.ok) { job.status = `http-${r.status}`; save(); throw new Error(`fal HTTP ${r.status}; no retry submitted.`); }
    const result = await r.json();
    job.url = mediaUrl(result.images?.[0]?.url);
    job.seed = result.seed ?? seed;
    job.status = 'generated';
    save();
    await collect(job);
  }
} else {
  console.log('Use --list, --generate, --portrait <id>, --deed <name> --district <district>, or --import-results <file>.');
}
