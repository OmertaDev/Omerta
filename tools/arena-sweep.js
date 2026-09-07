#!/usr/bin/env node
// THE ARENA SWEEP — N runs per arm, read as a DISTRIBUTION.
//
// `tools/arena.js` prints one month. This runs several, per arm, and reports the spread — because a
// single run is one sample of a wide distribution and the recorded lesson from the step-two/step-three
// write-ups is exactly that: read repeated runs PER ARM, never a pair. Seeding the server (arena's own
// ARENA_SEED_SERVER) makes each half of a pair re-runnable, which is a debugging and mutation-verification
// aid; it does NOT make one run a property. This file is the instrument that can support a claim.
//
// THE VERDICT IS DELIBERATELY CONSERVATIVE. With N in the low single digits no statistical test is
// honest, so the only separation this reports is DISJOINT RANGES: if the arms' [min,max] overlap at all
// it says so and refuses to call it a difference. That is the whole point — the arena has already
// produced one confident arm conclusion that a re-run of the SAME arm at the SAME seed falsified.
//
// AND THIS FILE'S OWN FIRST VERDICT WAS FALSE, which is why --reps exists. Its first run — one replicate
// per (arm, seed) — printed ✔ SEPARATED on kills, estatePct AND gini between two arms that are the same
// economy with the server seeded or not; the same two arms at --reps 2 collapsed to overlap on every
// metric. A single draw per cell is a sample of an unsampled distribution, and a disjointness test over
// single draws is a coin flip wearing a verdict. Run with --reps 2 or more before reading any ✔ here.
//
//   node tools/arena-sweep.js --seeds 1,2,3 --arm control:ARENA_HUNT_SEATS=off --arm hunt:
//
// Each replicate gets its OWN fresh database, because a reused one carries the previous run's rows and
// a dirty database reads exactly like a code defect. Provisioning is a shell template so this is not
// welded to one environment; the default is what this repo's real-Postgres gates already use.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const argv = process.argv.slice(2);
const flag = (name, dflt) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt; };
const arms = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] !== '--arm') continue;
  const spec = argv[i + 1] || '';
  const c = spec.indexOf(':');
  if (c < 0) { console.error(`--arm wants name:ENV=v,ENV=v (got ${JSON.stringify(spec)})`); process.exit(2); }
  const env = {};
  for (const kv of spec.slice(c + 1).split(',').filter(Boolean)) {
    const e = kv.indexOf('=');
    if (e < 0) { console.error(`--arm env wants ENV=value (got ${JSON.stringify(kv)})`); process.exit(2); }
    env[kv.slice(0, e)] = kv.slice(e + 1);
  }
  arms.push({ name: spec.slice(0, c), env });
}
if (!arms.length) arms.push({ name: 'default', env: {} });

const seeds = flag('seeds', '1,2,3').split(',').map((x) => Number(x.trim())).filter((x) => Number.isFinite(x));
if (!seeds.length) { console.error('--seeds wants a comma list of numbers'); process.exit(2); }
const DB_TEMPLATE = flag('dburl', process.env.ARENA_SWEEP_DBURL || 'postgres://postgres@/{db}?host=/tmp&port=5433');
const PROVISION = flag('provision', process.env.ARENA_SWEEP_PROVISION
  || 'su postgres -c "/usr/lib/postgresql/16/bin/dropdb -p 5433 -h /tmp --if-exists {db}" >/dev/null 2>&1; su postgres -c "/usr/lib/postgresql/16/bin/createdb -p 5433 -h /tmp {db}"');
const KEEP = argv.includes('--keep-logs');
// REPLICATES PER CELL. One run per (arm, seed) leaves WITHIN-cell variance entirely unmeasured — and that
// variance is the whole reason this file exists. Measured on this repo: eight runs of ONE arm at ONE seed
// spanned 5..9 kills, so two single draws from two arms can land disjoint on noise alone and the verdict
// below would print a confident ✔. Replicates pool into the arm's range, so the disjointness test has to
// clear the noise it is being asked to see past.
const REPS = Math.max(1, Number(flag('reps', '1')) || 1);

// The metrics a claim about an arm is ever actually made on. Kept short on purpose: a table of twenty
// columns invites reading whichever one happens to separate, which is the shape of a manufactured result.
const METRICS = [
  ['kills', (r) => r.kills, (v) => String(v)],
  ['estatePct', (r) => r.estatePct, (v) => `${(100 * v).toFixed(0)}%`],
  ['gini', (r) => r.gini, (v) => v.toFixed(3)],
  ['huntersDied', (r) => r.huntersDied, (v) => String(v)],
];
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-sweep-'));
const results = new Map(arms.map((a) => [a.name, []]));
let ran = 0, failed = 0;

for (const arm of arms) {
  for (const seed of seeds) {
   for (let rep = 1; rep <= REPS; rep++) {
    const tag = `${arm.name}_${seed}${REPS > 1 ? `_r${rep}` : ''}`.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
    const db = `arena_sweep_${tag}`;
    const jsonPath = path.join(dir, `${tag}.json`);
    const logPath = path.join(dir, `${tag}.log`);
    process.stdout.write(`  ${arm.name} seed ${seed}${REPS > 1 ? ` rep ${rep}` : ''} … `);
    const prov = spawnSync('bash', ['-c', PROVISION.replaceAll('{db}', db)], { encoding: 'utf8' });
    if (prov.status !== 0) { console.log(`PROVISION FAILED (${(prov.stderr || '').trim().split('\n').pop()})`); failed++; continue; }
    const env = { ...process.env, ...arm.env, DATABASE_URL: DB_TEMPLATE.replaceAll('{db}', db), ARENA_SEED: String(seed), ARENA_JSON: jsonPath };
    const t0 = Date.now();
    const run = spawnSync(process.execPath, ['tools/arena.js'], { env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    fs.writeFileSync(logPath, `${run.stdout || ''}\n${run.stderr || ''}`);
    ran++;
    if (run.status !== 0 || !fs.existsSync(jsonPath)) {
      const why = (run.stderr || run.stdout || '').split('\n').filter((l) => /Error|assert/i.test(l)).pop() || `exit ${run.status}`;
      console.log(`FAILED — ${why.slice(0, 120)}  [${logPath}]`);
      failed++;
      continue;
    }
    const r = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    r._log = logPath;
    results.get(arm.name).push(r);
    console.log(`${r.kills} kills · estate ${(100 * r.estatePct).toFixed(0)}% · gini ${r.gini.toFixed(3)}  (${Math.round((Date.now() - t0) / 1000)}s)`);
   }
  }
}

console.log(`\n  ${ran} runs, ${failed} failed. Logs: ${dir}`);
// A sweep that quietly drops a failed replicate reports a distribution over the runs that happened to
// work, which is not the distribution it claims to be measuring.
if (failed) console.log(`  ⚠ ${failed} replicate(s) did not produce a result — every figure below is over the ${ran - failed} that did.`);

console.log('\n  PER ARM (median · [min…max] over every replicate):');
for (const [name, rs] of results) {
  if (!rs.length) { console.log(`    ${name.padEnd(12)} — no successful run`); continue; }
  const cells = METRICS.map(([label, get, fmt]) => {
    const xs = rs.map(get).filter((x) => x != null);
    return `${label} ${fmt(med(xs))} [${fmt(Math.min(...xs))}…${fmt(Math.max(...xs))}]`;
  });
  console.log(`    ${name.padEnd(12)} n=${rs.length}  ${cells.join(' · ')}`);
}

if (arms.length >= 2) {
  console.log('\n  SEPARATION — disjoint ranges only. Overlap is NOT a difference at this N:');
  for (let i = 0; i < arms.length; i++) {
    for (let j = i + 1; j < arms.length; j++) {
      const a = results.get(arms[i].name), b = results.get(arms[j].name);
      if (!a.length || !b.length) continue;
      for (const [label, get, fmt] of METRICS) {
        const xa = a.map(get).filter((x) => x != null), xb = b.map(get).filter((x) => x != null);
        if (!xa.length || !xb.length) continue;
        const [loA, hiA] = [Math.min(...xa), Math.max(...xa)];
        const [loB, hiB] = [Math.min(...xb), Math.max(...xb)];
        const disjoint = hiA < loB || hiB < loA;
        const line = `${arms[i].name} [${fmt(loA)}…${fmt(hiA)}] vs ${arms[j].name} [${fmt(loB)}…${fmt(hiB)}]`;
        console.log(`    ${disjoint ? '✔ SEPARATED' : '· overlap   '} ${label.padEnd(12)} ${line}`);
      }
    }
  }
  if (REPS === 1) {
    console.log('\n  ⚠ ONE REPLICATE PER CELL — a ✔ above cannot distinguish an arm effect from run-to-run');
    console.log('    noise, because within-cell variance was never sampled. Re-run with --reps 2 or more');
    console.log('    before believing any separation here; on this repo a single arm at a single seed has');
    console.log('    spanned 5..9 kills, which is wider than most arm effects worth measuring.');
  }
  console.log('\n  A ✔ is a weak claim, not a proof — it says the arms\' ranges did not overlap over the runs');
  console.log('  that happened. A · says the instrument cannot tell these arms apart, and no median gap rescues it.');
}
if (!KEEP && !failed) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* keep the logs if the cleanup fails */ } }
process.exit(failed && failed === ran ? 1 : 0);
