// THE NAMED PERSIST — the guard for the column lists that replaced the 67-param positional
// persistCharacter and the 19-param persistAccount (src/game.js).
//
// A positional UPDATE is checked by nothing: a column added to the SET clause without its value (or
// the reverse) shifts every parameter after it by one and the statement still PARSES — $47 lands on
// the wrong column and pg-mem/real Postgres both accept it as long as the types coerce. The lists make
// the column and its value one entry, and this file proves the properties that made the switch worth
// making: every listed column EXISTS on the live schema (a typo is a failed SELECT here, never a
// runtime 500 on a live box), no column is listed twice (a duplicate silently takes the LAST value),
// the headless estate persists write EXACTLY the fields runEstate mutates (the list is scanned
// against runEstate's source, with an anti-vacuity floor — a scan that matches nothing reads like a
// pass), and no hand-rolled copy of that UPDATE has crept back into the tree.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
process.env.MOD_KEY = 'test-mod-key';
const { buildServer } = await import('../src/server.js');
const G = await import('../src/game.js');
const app = await buildServer();
const pool = app.pool;
const ROOT = fileURLToPath(new URL('../', import.meta.url));

const { ACCOUNT_PERSIST_COLUMNS: AC, CHARACTER_PERSIST_COLUMNS: CC, ESTATE_ACCOUNT_FIELDS: EF } = G;
const names = (cols) => cols.map(([c]) => c);

// (1) shape: entries are [col] or [col, default], defaults never undefined, no duplicates
for (const [label, cols] of [['ACCOUNT', AC], ['CHARACTER', CC]]) {
  assert.ok(Array.isArray(cols) && cols.length > 0, `${label}_PERSIST_COLUMNS is a non-empty list`);
  for (const e of cols) {
    assert.ok(Array.isArray(e) && (e.length === 1 || e.length === 2) && typeof e[0] === 'string', `${label}: entry ${JSON.stringify(e)} is [col] or [col, default]`);
    if (e.length === 2) assert.notEqual(e[1], undefined, `${label}: ${e[0]} default must not be undefined`);
  }
  const n = names(cols);
  assert.equal(new Set(n).size, n.length, `${label}: no column listed twice — ${n.filter((c, i) => n.indexOf(c) !== i)}`);
}
// The counts are pinned so a column cannot be DROPPED from a list without a deliberate edit here —
// a dropped column is not an error anywhere else, it is a field that silently stops persisting.
assert.equal(CC.length, 66, 'CHARACTER_PERSIST_COLUMNS holds the 66 columns the positional statement carried');
assert.equal(AC.length, 18, 'ACCOUNT_PERSIST_COLUMNS holds the 18 columns the positional statement carried');

// (2) every listed column exists on the live schema (SELECT … LIMIT 0 is a parse + resolve, no rows)
for (const [table, cols] of [['characters', CC], ['account_persistent', AC]]) {
  try { await pool.query(`SELECT ${names(cols).join(', ')} FROM ${table} LIMIT 0`); }
  catch (e) { assert.fail(`a ${table} persist column does not exist on the schema — a positional UPDATE would have shipped this as a runtime 500: ${e.message}`); }
}
console.log(`  ✓ ${CC.length} character + ${AC.length} account persist columns exist on the schema, none duplicated`);

// (3) the estate subset ⊂ the account list, and it covers every field runEstate assigns
for (const f of EF) assert.ok(names(AC).includes(f), `ESTATE_ACCOUNT_FIELDS: ${f} is an account persist column`);
const est = fs.readFileSync(ROOT + 'src/social/estate.js', 'utf8');
const start = est.indexOf('export async function runEstate(');
assert.ok(start > 0, 'runEstate found in estate.js');
// paren-match the PARAMETER LIST first — `opts = {}` is a default parameter, and the first `{` after
// the name is that one, not the body (the gate matrix's own recorded trap) — then brace-match the body
// so the scan reads runEstate and nothing after it.
let pd = 0, j = est.indexOf('(', start);
for (; j < est.length; j++) { if (est[j] === '(') pd++; else if (est[j] === ')' && --pd === 0) break; }
let depth = 0, i = est.indexOf('{', j), end = -1;
for (; i < est.length; i++) { if (est[i] === '{') depth++; else if (est[i] === '}' && --depth === 0) { end = i; break; } }
const body = est.slice(start, end).replace(/\/\/.*$/gm, '');
const assigned = new Set([...body.matchAll(/\bacct\.(\w+)\s*(?:[-+*/]|\?\?)?=(?!=)/g)].map((m) => m[1]));
assert.ok(assigned.size >= 3, `anti-vacuity: the scan found ${assigned.size} acct.X assignments in runEstate (expected ≥ 3)`);
for (const f of assigned) assert.ok(EF.includes(f), `runEstate assigns acct.${f} but ESTATE_ACCOUNT_FIELDS lacks it — a headless death (mod-kill, the bounty hunter) would drop that write`);
console.log(`  ✓ ESTATE_ACCOUNT_FIELDS covers every field runEstate assigns (${[...assigned].join(', ')})`);

// (4) behavioural: persistAccountFields writes exactly the named fields, refuses an unknown one
const acct = (await pool.query(`INSERT INTO accounts (id, auth_provider, auth_subject) VALUES ('persist-acct', 'guest', 'persist-acct') RETURNING id`)).rows[0].id;
await pool.query('INSERT INTO account_persistent (account_id) VALUES ($1)', [acct]);
const before = (await pool.query('SELECT * FROM account_persistent WHERE account_id=$1', [acct])).rows[0];
const client = await pool.connect();
try {
  await G.persistAccountFields(client, acct, { prestige: 7, deaths: 2, omr: 12.5, unbonding: 3, recruits: 99 }, EF);
} finally { client.release(); }
const after = (await pool.query('SELECT * FROM account_persistent WHERE account_id=$1', [acct])).rows[0];
assert.equal(Number(after.prestige), 7); assert.equal(Number(after.deaths), 2);
assert.equal(Number(after.omr), 12.5); assert.equal(Number(after.unbonding), 3);
assert.equal(Number(after.recruits), Number(before.recruits), 'a field outside the subset is NOT written');
await assert.rejects(() => G.persistAccountFields(pool, acct, { nope: 1 }, ['nope']), /not an account persist column/, 'an unknown field throws rather than silently writing nothing');
// a default applies when the row lacks the field (unbonding is [col, 0])
const c2 = await pool.connect();
try { await G.persistAccountFields(c2, acct, { prestige: 8, deaths: 3, omr: 1 }, EF); } finally { c2.release(); }
assert.equal(Number((await pool.query('SELECT unbonding FROM account_persistent WHERE account_id=$1', [acct])).rows[0].unbonding), 0, 'a missing two-element field takes its default');
console.log('  ✓ persistAccountFields writes the named subset, applies defaults, refuses an unknown field');

// (5) no hand-rolled copy of the estate persist survives outside game.js
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(d + e.name + '/') : [d + e.name]);
const offenders = walk(ROOT + 'src/').filter((f) => f.endsWith('.js') && !f.endsWith('src/game.js'))
  .filter((f) => /UPDATE account_persistent SET prestige=\$2/.test(fs.readFileSync(f, 'utf8')));
assert.deepEqual(offenders, [], 'the headless estate persist goes through persistAccountFields(ESTATE_ACCOUNT_FIELDS), never a hand-rolled UPDATE');
console.log('  ✓ no hand-rolled estate persist outside game.js');

await app.close();
console.log('persist: PASS');
