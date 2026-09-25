// THE GENERATED/HAND-WRITTEN SEAM.
//
// Current tables live in data/rules.js. Regeneration must preserve every declaration, including the
// eligibility predicates embedded in tables, and leave hand-written helpers untouched. The facade
// exposes both files without ambiguous exports.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { TABLES } from '../tools/extract-rules.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const source = read('../data/rules.js');
const gen = read('../src/rules.generated.js');
const tail = read('../src/rules.tail.js');
const facade = read('../src/rules.js');

// ── the generated file holds ONLY the tables ────────────────────────────────────────────────────
// Anything else in here is code that the next `node tools/extract-rules.js` run will delete without
// warning. An allowlist of exported names permits table changes while rejecting hand-added helpers.
const genExports = [...gen.matchAll(/^export\s+(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
assert.deepEqual(genExports.slice().sort(), TABLES.slice().sort(),
  'src/rules.generated.js must export exactly the extractor\'s tables and nothing else — anything\n'
  + 'hand-written here is destroyed by the next regeneration. Put it in src/rules.tail.js.\n'
  + `  found:    ${genExports.join(', ')}\n  expected: ${TABLES.join(', ')}`);

// Every export must be a plain array literal — a table, not logic wearing a table's name.
for (const t of TABLES)
  assert.match(gen, new RegExp(`^export const ${t} = \\[`, 'm'), `${t} must be a plain array literal in the generated file`);

// …and it must depend on NOTHING. An import here would make the machine-owned half reference the
// hand-written half, which is how you get a cycle that only breaks at some later call site.
assert.equal(/^\s*import\s/m.test(gen), false,
  'src/rules.generated.js must not import anything — it is data, and the extractor would drop the import anyway');

// The current source has the same data boundary and must survive regeneration exactly. Comparing
// declarations also covers function-valued eligibility predicates, which JSON would silently omit.
const sourceExports = [...source.matchAll(/^export\s+(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
assert.deepEqual(sourceExports.slice().sort(), TABLES.slice().sort(),
  'data/rules.js must export exactly the current rule tables');
assert.equal(/^\s*import\s/m.test(source), false, 'data/rules.js must not import application logic');
for (const t of TABLES)
  assert.match(source, new RegExp(`^export const ${t} = \\[`, 'm'), `${t} must be a plain array literal in the rule source`);
const declarations = (text) => text.slice(text.indexOf('export const '));
assert.equal(declarations(gen), declarations(source),
  'generated rule declarations must match data/rules.js exactly; run node tools/extract-rules.js');

// ── the hand-written file is never machine-touched ──────────────────────────────────────────────
// Asserted on the paths the extractor ADDRESSES, not on any mention of the name — its own header
// explains this rule and its success message names the file it left alone, and a tripwire that fires
// on its own documentation is a tripwire nobody keeps.
const extractor = read('../tools/extract-rules.js');
const addressed = [...extractor.matchAll(/new URL\('([^']+)'/g)].map((m) => m[1]);
assert.deepEqual(addressed, ['../data/rules.js', '../src/rules.generated.js'],
  'tools/extract-rules.js may address only the current source and generated tables — the hand-written half\n'
  + `is off limits. It addresses: ${addressed.join(', ')}`);
assert.equal((extractor.match(/writeFileSync/g) || []).length, 1, 'the extractor writes exactly one file');
assert.match(extractor, /writeFileSync\(new URL\('\.\.\/src\/rules\.generated\.js'/,
  'the one file the extractor writes must be src/rules.generated.js');
// …and it reads only the source path, defaulting to the checked-in current tables.
assert.match(extractor, /readFileSync\(sourcePath/, 'the extractor reads only the selected rule source');
assert.match(extractor, /process\.argv\[2\] \|\| fileURLToPath\(new URL\('\.\.\/data\/rules\.js'/,
  'the extractor defaults to the checked-in current rule tables');

// ── the facade is unambiguous ───────────────────────────────────────────────────────────────────
// `export *` from two modules that both export the same name does not throw at boot: the name is
// simply excluded, and the failure surfaces as `undefined` at the first call site that reads it.
// So the overlap has to be checked here rather than discovered in production.
const names = (src) => new Set([...src.matchAll(/^export\s+(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]));
const overlap = [...names(gen)].filter((n) => names(tail).has(n));
assert.deepEqual(overlap, [], `the two halves both export: ${overlap.join(', ')} — an ambiguous star `
  + 're-export resolves to undefined at the call site, not an error at boot');
assert.match(facade, /export \* from '\.\/rules\.generated\.js';/, 'the facade re-exports the generated half');
assert.match(facade, /export \* from '\.\/rules\.tail\.js';/, 'the facade re-exports the hand-written half');

// ── and the whole thing still resolves ──────────────────────────────────────────────────────────
const R = await import('../src/rules.js');
for (const t of TABLES) assert(Array.isArray(R[t]) && R[t].length, `${t} reaches callers through the facade`);
// A helper from the tail that reads a table from the generated half — proves the seam is live, not
// just syntactically valid (this is the exact shape that a cycle would break).
assert.equal(typeof R.levelOf(1444), 'number', 'levelOf (tail) reads PACING (tail) and works');
assert.equal(R.recruitRankOf(5), 'The Talent Scout', 'recruitRankOf (tail) reads RECRUIT_MILESTONES (generated)');
assert.equal(R.crimeOf ? typeof R.crimeOf('pick') : 'object', 'object', 'a table lookup helper resolves');

// ── the current onboarding policy survives regeneration ────────────────────────────────────────
assert.equal(R.ONBOARD_TASKS.some((t) => t.id === 'ob_repo'), false,
  'the removed "Star the repo" First-Week task must stay absent from the current rule source');

console.log(`✅ rules seam test passed — the generated half holds exactly the ${TABLES.length} extractor tables `
  + 'and matches the current source, the extractor writes only that file and never opens the hand-written half, the two '
  + 'halves share no export name (so no star re-export silently resolves to undefined), every table reaches '
  + 'callers through the facade, a tail helper reading a generated table proves the seam is live, and the '
  + 'retired "Star the repo" task stays retired across a regeneration.');
