// THE DOCUMENTATION THAT CAN BE WRONG (the 52nd suite).
//
// Prose does not have a test suite, so it rots silently — and unlike code, wrong prose does not fail
// loudly the first time someone relies on it. It makes the next maintainer confidently do the wrong
// thing. One session found FIVE instances:
//
//   * a comment on `levelOf` instructing the reader to RE-APPLY the pacing divisor by hand after any
//     regeneration — a hazard that did not exist, because the extractor already preserved that line;
//   * SPEC's "lines 1–1,091 are auto-generated" — the real figure was 454, so it described the
//     hand-written half as 70% of the file when it was closer to 90%;
//   * SPEC's backend module count, which counted a FLAT listing of src/ and so under-reported by 27
//     files the moment code moved into subdirectories;
//   * CLAUDE.md describing itself as "~1,000 lines of dense prose" while being over five thousand;
//   * a comment I wrote claiming reads no longer checkpoint accrual, which measurement disproved.
//
// So the load-bearing FACTS are asserted here against the tree. Not the prose — prose is judgement and
// belongs to whoever writes it — but every number a reader might act on, and every claim of the form
// "X must be done by hand" that a test can settle. A figure in SPEC.md is now either true or CI fails.
//
// Adding a number to SPEC's size table without adding it here is fine; the table is checked row by row
// for the rows that exist, so an unchecked row simply is not guarded. Prefer to guard it.
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { walkSrc } from './lib/srcfiles.js';

const read = (p) => fs.readFileSync(p, 'utf8');
// Counted the way `wc -l` counts — newlines, not `split('\n').length`, which adds a phantom line for
// every file that ends in one. The definition matters because the whole point is that a reader can
// check the figure by hand and get the same answer; off-by-one-per-file is 100 lines across src/.
const lines = (p) => { const s = read(p); let n = 0; for (let i = 0; i < s.length; i++) if (s[i] === '\n') n++; return n; };
const countLines = (files) => files.reduce((n, f) => n + lines(f), 0);
const spec = read('SPEC.md');

// Authored content is now a playable API surface, so every reader-facing guide must distinguish the
// shipped runtime slice from the larger graph systems that are still staged. This guard exists because
// the browser wiki continued to call the whole runtime inactive after the API and tests had gone live.
{
  const markdownWiki = read('docs/WIKI.md');
  const browserWiki = read('public/wiki.html');
  const authorGuide = read('content/README.md');
  const agentGuide = read('AGENTS.md');
  const storylets = [
    'The Man Who Missed the Tide',
    'Water in the Cellar',
    'The Last Kiln',
    'House Lights',
    'The Furnace Ledger',
    "A Saint's Account",
  ];
  const donCases = [
    'The Iron Election', 'A House Made of Glass', 'Port of No Return', 'The Empty Seat',
    'Two Funerals', 'The Federal Ledger', 'Don of the City',
  ];
  const pathCases = [
    'The Last Clean Contract', 'Hostile Books', 'The Bad Batch', 'Black Ice',
    'Nobody Saw Him Leave', 'Twelve Rounds',
  ];
  const socialCases = ['The Two-Man Rule'];
  const seasonalCases = ['The Books Open at Midnight'];
  const craftingPacks = ['The Bellini Restoration'];

  for (const [name, guide] of [['markdown wiki', markdownWiki], ['browser wiki', browserWiki]]) {
    const prose = (name === 'browser wiki' ? guide.replace(/<[^>]*>/g, ' ') : guide)
      .replace(/\s+/g, ' ');
    assert(guide.includes('The Sixth Chair') && /playable.{0,30}v2|v2.{0,30}playable/i.test(guide),
      `${name} must identify The Sixth Chair v2 as playable`);
    for (const storylet of storylets) {
      assert(prose.includes(storylet), `${name} must list the district storylet ${storylet}`);
    }
    for (const donCase of donCases) {
      assert(prose.includes(donCase), `${name} must list the Don Case ${donCase}`);
    }
    for (const pathCase of pathCases) {
      assert(prose.includes(pathCase), `${name} must list the Path Case ${pathCase}`);
    }
    for (const socialCase of socialCases) {
      assert(prose.includes(socialCase), `${name} must list the organization case ${socialCase}`);
    }
    for (const seasonalCase of seasonalCases) {
      assert(prose.includes(seasonalCase), `${name} must list the seasonal case ${seasonalCase}`);
    }
    for (const craftingPack of craftingPacks) {
      assert(prose.includes(craftingPack), `${name} must list the authored workshop ${craftingPack}`);
    }
    assert(/personal/i.test(guide) && /district-gated|location-gated/i.test(guide),
      `${name} must explain personal, district-gated authored stories`);
    assert(/value-neutral|gameplay-inert/i.test(guide),
      `${name} must state that the authored rewards are gameplay-inert`);
    assert(/story flag|storyFlag/i.test(guide) && /write-once/i.test(guide),
      `${name} must explain durable, write-once authored memory`);
    assert(/forming.{0,80}(?:expir|deadline)|(?:expir|deadline).{0,80}forming/i.test(prose)
      && /active.{0,80}(?:never|non-expir)|(?:never|non-expir).{0,80}active/i.test(prose),
    `${name} must explain finite forming lobbies and non-expiring active runs`);
    assert(/once_per_season|once-per-season/i.test(guide)
      && /root-only|entry gate/i.test(prose),
    `${name} must explain the closed seasonal authored-content policy`);
    assert(/The Books Open at Midnight.{0,300}personal.{0,80}Opening-phase/i.test(prose)
      && /two normalized-answer puzzles.{0,100}three-way resolution/i.test(prose),
    `${name} must describe the production seasonal case structure and opening-phase gate`);
    assert(/namespace.{0,100}season run key/i.test(prose)
      && /self-claimed once each season/i.test(prose)
      && /additional scopes or content versions cannot mint it again/i.test(prose),
    `${name} must explain seasonal entitlement identity and same-season anti-farming`);
    assert(/The Books Open at Midnight.{0,500}no cash, \$OMR, power, or transaction-ledger value/i.test(prose)
      && /exact compiled bundle hash/i.test(prose),
    `${name} must preserve the seasonal case's inert economy and exact-hash activation boundary`);
    assert(/The Bellini Restoration.{0,500}Old Foundry/i.test(prose)
      && /globally finite daily/i.test(prose)
      && /exact-hash/i.test(prose)
      && /FIFO/i.test(prose),
    `${name} must describe the production authored workshop and its supply authority`);
    assert(/old-version lots.{0,180}(?:cannot|can't).{0,100}(?:new|recipe pool)/i.test(prose)
      && /non-stackable.{0,100}(?:cap|ownership).{0,100}(?:version|versions)/i.test(prose),
    `${name} must explain exact-hash version isolation and cross-version keepsake caps`);
    assert(/server-timed work order/i.test(prose)
      && /exact-hash Bellini Restoration skill/i.test(prose)
      && /one active job/i.test(prose),
    `${name} must explain the production work-order clock and exact-hash skill authority`);
    assert(/inputs?.{0,80}(?:immediately|when.{0,30}start)/i.test(prose)
      && /early collection is refused/i.test(prose)
      && /(?:later activation|old-hash).{0,180}(?:does not strand|remains collectible|pinned immutable)/i.test(prose),
    `${name} must explain work-order consumption, readiness, and pinned-version collection`);
    assert(/v3.{0,120}Press Room/i.test(prose)
      && /location-bound|location facility/i.test(prose)
      && /Restoration Press/i.test(prose),
    `${name} must describe the production authored tool and facility`);
    assert(/exact-hash durability/i.test(prose)
      && /wear.{0,100}(?:job|recipe).{0,100}(?:start|transaction)/i.test(prose)
      && /repair.{0,160}(?:same-hash|compiled).{0,120}material/i.test(prose),
    `${name} must explain exact-hash wear and compiler-owned material repair`);
    assert(/(?:acquisition, use, and repair|acquisition, use, and repairs).{0,80}(?:append-only|audited)/i.test(prose)
      && /(?:archived.{0,100}press|old-version press.{0,100}archived).{0,160}(?:cannot|can't).{0,100}(?:unlock|satisfy|affect)/i.test(prose),
    `${name} must explain durable-tool auditing and version isolation`);
    assert(/v4.{0,120}Material Exchange/i.test(prose)
      && /Ledger Plates?.{0,120}Charred Bindings?/i.test(prose)
      && /same-hash|exact-hash/i.test(prose)
      && /whole-lot|complete (?:barter|offer)/i.test(prose),
    `${name} must describe the production authored material exchange`);
    assert(/escrow.{0,160}(?:ownership|owned|maxOwned|cap)/i.test(prose)
      && /(?:conserve|conserves).{0,100}(?:item totals|both item totals)/i.test(prose)
      && /list(?:ing)?\/fill\/cancel|list, fill, and cancel/i.test(prose),
    `${name} must explain authored barter conservation, cap accounting, and auditing`);
    assert(/no combat|grants no combat|combat.{0,60}(?:authority|cannot)/i.test(prose)
      && /gameplay-power|gameplay power|power outside authored crafting/i.test(prose)
      && /export authority/i.test(prose),
    `${name} must preserve the work-order capability boundary`);
    assert(/no cash, crates, ammo, \$OMR, or transaction-ledger value/i.test(prose),
      `${name} must preserve the authored workshop's value-neutral economy boundary`);
    assert(!/generic mystery runtime[^.]{0,180}(?:not an active game surface|remain(?:s)? staged)/i.test(guide),
      `${name} still describes the shipped mystery runtime as inactive`);
  }

  assert(authorGuide.includes('content:build:storylets') && storylets.every((title) => authorGuide.includes(title)),
    'the content author guide must document the district sampler and its build command');
  assert(authorGuide.includes('content:build:don-cases') && donCases.every((title) => authorGuide.includes(title)),
    'the content author guide must document all Don Cases and their build command');
  assert(authorGuide.includes('content:build:path-cases') && pathCases.every((title) => authorGuide.includes(title)),
    'the content author guide must document all Path Cases and their build command');
  assert(authorGuide.includes('content:build:social-cases') && socialCases.every((title) => authorGuide.includes(title)),
    'the content author guide must document the two-seat organization case and its build command');
  assert(authorGuide.includes('content:build:seasonal-cases')
    && seasonalCases.every((title) => authorGuide.includes(title)),
  'the content author guide must document the production seasonal case and its build command');
  assert(authorGuide.includes('content:build:crafting-packs')
    && craftingPacks.every((title) => authorGuide.includes(title)),
  'the content author guide must document the production authored workshop and its build command');
  assert(authorGuide.includes('content:build:crafting-tools')
    && authorGuide.includes('content/dist/bellini-lockbox-v3.json'),
  'the content author guide must document the durable-tool production build command');
  assert(authorGuide.includes('content:build:crafting-exchange')
    && authorGuide.includes('content/dist/bellini-lockbox-v4.json'),
  'the content author guide must document the material-exchange production build command');
  assert(agentGuide.includes('GET /v1/content') && agentGuide.includes('POST /v1/content/instances/:instanceId/act'),
    'the agent guide must expose content discovery and the direct authored-content action route');
  assert(agentGuide.includes('POST /v1/agent/act') && /does not grant|never grants/i.test(agentGuide),
    'the agent guide must preserve the authored-content /agent/act authority boundary');
  assert(agentGuide.includes('POST /v1/content/:namespace/sources/:sourceId/collect')
    && agentGuide.includes('POST /v1/content/:namespace/recipes/:recipeId/craft')
    && agentGuide.includes('POST /v1/content/:namespace/jobs/:jobId/start')
    && agentGuide.includes('POST /v1/content/:namespace/jobs/:jobId/collect')
    && agentGuide.includes('POST /v1/content/:namespace/tools/:toolId/repair')
    && agentGuide.includes('POST /v1/content/:namespace/exchange/list')
    && agentGuide.includes('stale_content'),
  'the agent guide must expose hash-checked direct supply, tool, and material-exchange routes');
  assert(spec.includes('personal, district-gated storylets') && spec.includes('The Long Count'),
    'SPEC must inventory the playable district sampler and sixth Underworld campaign');
  assert(donCases.every((title) => spec.includes(title)) && /story\s+flags/i.test(spec),
    'SPEC must inventory the late-game spine and its durable narrative memory');
  assert(pathCases.every((title) => spec.includes(title)) && /Path, skill, mastery, regimen, honor/i.test(spec),
    'SPEC must inventory the identity drop and its server-derived character-build gates');
  assert(pathCases.every((title) => agentGuide.includes(title)),
    'the agent guide must list all six directly playable Path Cases');
  assert(socialCases.every((title) => agentGuide.includes(title))
    && /once_per_season|once-per-season/i.test(agentGuide),
  'the agent guide must list the organization case and seasonal runtime policy');
  assert(seasonalCases.every((title) => agentGuide.includes(title) && spec.includes(title))
    && /Opening-phase/i.test(agentGuide) && /Opening-phase/i.test(spec),
  'the agent guide and SPEC must inventory the production seasonal case');
  assert(craftingPacks.every((title) => agentGuide.includes(title) && spec.includes(title))
    && /FIFO/i.test(agentGuide) && /FIFO/i.test(spec),
  'the agent guide and SPEC must inventory the production authored workshop');

  const packageJson = JSON.parse(read('package.json'));
  assert(packageJson.scripts.pretest.includes('node test/content-seasonal-case.js'),
    'pretest must run the production seasonal case test');
  assert(packageJson.scripts['content:check'].includes('content/packs/books-open-at-midnight/pack.json'),
    'content:check must validate the production seasonal source pack');
  assert.equal(packageJson.scripts['content:build:seasonal-cases'],
    'node tools/content.js build content/packs/books-open-at-midnight/pack.json content/dist/books-open-at-midnight-v1.json',
  'the seasonal build command must emit the immutable production artifact');
  assert(packageJson.scripts.pretest.includes('node test/content-crafting.js'),
    'pretest must run the production authored crafting test');
  assert(packageJson.scripts['content:check'].includes('content/packs/bellini-lockbox/pack.json'),
    'content:check must validate the production authored workshop source pack');
  assert.equal(packageJson.scripts['content:build:crafting-packs'],
    'node tools/content.js build content/packs/bellini-lockbox/pack.json content/dist/bellini-lockbox-v1.json',
  'the authored crafting build command must emit the immutable production artifact');
  assert(packageJson.scripts.pretest.includes('node test/content-crafting-jobs.js'),
    'pretest must run the production authored work-order and skill test');
  assert(packageJson.scripts['content:check'].includes('content/packs/bellini-lockbox-v2/pack.json'),
    'content:check must validate the production authored work-order source pack');
  assert.equal(packageJson.scripts['content:build:crafting-jobs'],
    'node tools/content.js build content/packs/bellini-lockbox-v2/pack.json content/dist/bellini-lockbox-v2.json',
  'the authored work-order build command must emit the immutable v2 production artifact');
  assert(packageJson.scripts.pretest.includes('node test/content-crafting-tools.js'),
    'pretest must run the production authored durable-tool and facility test');
  assert(packageJson.scripts['content:check'].includes('content/packs/bellini-lockbox-v3/pack.json'),
    'content:check must validate the production authored durable-tool source pack');
  assert.equal(packageJson.scripts['content:build:crafting-tools'],
    'node tools/content.js build content/packs/bellini-lockbox-v3/pack.json content/dist/bellini-lockbox-v3.json',
  'the authored durable-tool build command must emit the immutable v3 production artifact');
  assert(packageJson.scripts.pretest.includes('node test/content-exchange.js'),
    'pretest must run the production authored material-exchange test');
  assert(packageJson.scripts['content:check'].includes('content/packs/bellini-lockbox-v4/pack.json'),
    'content:check must validate the production authored material-exchange source pack');
  assert.equal(packageJson.scripts['content:build:crafting-exchange'],
    'node tools/content.js build content/packs/bellini-lockbox-v4/pack.json content/dist/bellini-lockbox-v4.json',
  'the authored material-exchange build command must emit the immutable v4 production artifact');
}

// FILE COUNTS are asserted exactly; LINE TOTALS within 2%. That split is deliberate. A file count only
// moves when a module is added or relocated, which is worth restating — and it is the figure that broke
// (a flat listing of src/ under-reported by 27 files the moment code moved into subdirectories). A line
// total moves when anyone edits a comment, and this very file is inside one of the trees it measures, so
// an exact assertion would demand a SPEC edit alongside every test edit. A guard that nags on unrelated
// work gets deleted, and a deleted guard catches nothing. Every error this file was written to catch was
// off by 27%, 140% or 5× — none would survive a 2% band.
const near = (claimed, real, what) => assert(Math.abs(claimed - real) / Math.max(real, 1) < 0.02,
  `SPEC says ${claimed} ${what}; it is ${real} — more than 2% out, so restate it`);

// pull `**N**` out of the row whose label matches, so the assertion names the row that is wrong.
// The label is taken LITERALLY — an earlier cut passed it straight into a RegExp, so a label containing
// `+` silently matched nothing and the row went unchecked. A guard that quietly stops guarding is the
// failure mode this whole file exists to prevent, so it must not be possible here either.
const row = (label) => {
  const lit = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = spec.match(new RegExp(`^\\| ${lit} \\|([^|]*)\\|`, 'm'));
  assert(m, `SPEC.md has no size-table row labelled "${label}" — it was renamed or removed, so the `
    + 'guard below is no longer checking anything. Update this test with the new label.');
  return [...m[1].matchAll(/\*\*([\d,]+)\*\*/g)].map((x) => Number(x[1].replace(/,/g, '')));
};

// ── §1 "Size, measured" — every number, against the tree ────────────────────────────────────────
const srcFiles = walkSrc('src');
const [srcCount, srcLines] = row('Backend modules');
assert.equal(srcCount, srcFiles.length, `SPEC says ${srcCount} backend modules; src/ has ${srcFiles.length}`);
near(srcLines, countLines(srcFiles), 'lines in src/');

const testFiles = walkSrc('test');
const [testCount, testLines] = row('Test suites');
assert.equal(testCount, testFiles.length, `SPEC says ${testCount} test files; test/ has ${testFiles.length}`);
near(testLines, countLines(testFiles), 'lines in test/');

const [clientLines] = row('Client');
near(clientLines, lines('public/index.html'), 'lines in public/index.html');

// The contracts row had drifted to "8 contracts, 107 tests" against a tree holding 9 and 128, and
// nothing caught it because `row()` only reads BOLDED numbers and only one of the three was bold.
// A number nobody checks is a number that will be wrong — so bold all three and check all three.
const solFiles = fs.readdirSync('omerta-contracts/src').filter((f) => f.endsWith('.sol'))
  .map((f) => `omerta-contracts/src/${f}`);
const [solCount, solLines, forgeTests] = row('Smart contracts');
assert.equal(solCount, solFiles.length, `SPEC says ${solCount} contracts; omerta-contracts/src has ${solFiles.length}`);
near(solLines, countLines(solFiles), 'lines of Solidity');
const forge = fs.readdirSync('omerta-contracts/test').filter((f) => f.endsWith('.sol'))
  .reduce((n, f) => n + (read(`omerta-contracts/test/${f}`).match(/function test/g) || []).length, 0);
assert.equal(forgeTests, forge, `SPEC says ${forgeTests} Foundry tests; the suite declares ${forge}`);

const schema = read('schema.sql');
const [tableCount] = row('Database tables');
const tables = (schema.match(/^CREATE TABLE IF NOT EXISTS \w+/gm) || []).length;
assert.equal(tableCount, tables, `SPEC says ${tableCount} tables; schema.sql creates ${tables}`);

// COUNT THE REPOSITORY, NOT THE WORKING TREE. SPEC describes what is committed; a walk of the disk
// describes whatever happens to be sitting there.
//
// The first version walked the tree, and it broke CI for ten commits — in the very commit that added
// this file to keep the docs honest. The sandbox it was written in had vendored OpenZeppelin sources
// (gitignored, fetched for tools/compile-contracts.js) carrying one README.md, so the tree held 127
// markdown files and a fresh clone held 126. It passed locally every single time and failed on every
// push. That is precisely the failure this file exists to catch — a claim that is true in one
// environment and false in another — and I did not notice because I never opened CI.
//
// `git ls-files` is the fix and the lesson: any guard that asserts a number about "the project" has
// to ask git what the project is. Falls back to the walk when git is unavailable (a tarball, a
// vendored copy), which is the only case where the disk is the best answer available.
//
// `--cached --others --exclude-standard`, and that is the SAME lesson in a second costume. Plain
// `git ls-files` lists only TRACKED files, so a brand-new doc does not count until it is `git add`ed
// — which means running this guard before committing and running it after committing give DIFFERENT
// answers, and the pre-commit one is the one a person actually runs. It bit on 2026-07-31: a new
// audit report passed locally at 142 and failed CI at 143, in a file whose whole purpose is catching
// claims that are true in one environment and false in another. The flags add untracked-but-not-
// ignored files, so the count is what the NEXT COMMIT will contain rather than what the last one did.
//
// The DEDUPE is that lesson in a THIRD costume, and it cost a wrong figure on 2026-08-21. During an
// unresolved merge `--cached` lists a CONFLICTED path once per stage (base/ours/theirs), so running
// this guard mid-merge counted four conflicted .md files three times each and reported 218 where the
// repository holds 210 — and the number looked authoritative enough that SPEC was restated to it.
// A set is the fix: a file is one file in every state of the index, merge in progress or not.
let mdFiles;
try {
  mdFiles = [...new Set(execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
    .split('\0').filter((f) => f.endsWith('.md')))];
} catch {
  mdFiles = [];
  (function md(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) md(p); else if (e.name.endsWith('.md')) mdFiles.push(p);
    }
  }('.'));
}
const [mdCount, mdLines] = row('Design + audit docs');
assert.equal(mdCount, mdFiles.length, `SPEC says ${mdCount} markdown files; there are ${mdFiles.length}`);
near(mdLines, countLines(mdFiles), 'markdown lines');

// ── the rules seam, whose figures were the ones most wrong ───────────────────────────────────────
const genLines = lines('src/rules.generated.js');
const tailLines = lines('src/rules.tail.js');
const seam = spec.match(/`rules\.generated\.js` holds[\s\S]{0,400}?extractor never opens it/);
assert(seam, "SPEC.md's architecture section must describe the rules seam — the paragraph naming "
  + '`rules.generated.js` and `rules.tail.js` was renamed or removed, so this guard is checking nothing');
const seamFigures = [...seam[0].matchAll(/\(([\d,]+) lines\)/g)].map((m) => Number(m[1].replace(/,/g, '')));
assert.equal(seamFigures.length, 2, 'the seam paragraph must state both halves\' line counts');
near(seamFigures[0], genLines, 'lines in rules.generated.js');
near(seamFigures[1], tailLines, 'lines in rules.tail.js');
assert(tailLines > genLines * 4,
  'sanity: the hand-written half should dwarf the generated one — if that flipped, the prose needs rewriting');

// ── claims of the form "you must do X by hand" ───────────────────────────────────────────────────
// A false one of these is the worst kind of stale doc: it makes a reader take an action that is not
// needed, on the most dangerous file in the tree. This one is settled by the extractor's own scope —
// asserted in test/rules.js, which checks the paths the extractor actually addresses rather than the
// filenames its prose happens to mention (a first cut here matched the extractor's own comments).
const tail = read('src/rules.tail.js');
assert(tail.includes('PACING.LEVEL_DIVISOR'), 'the pacing override lives in the hand-written half');
assert(!/RE-APPLY THIS LINE/i.test(tail),
  'the "RE-APPLY THIS LINE after any regeneration" warning was FALSE — levelOf lives in the file the '
  + 'extractor never touches. If it is back, either the seam moved (fix the seam) or the warning is '
  + 'wrong again (delete it).');
// …and the same claim in ANY wording, in EVERY file that makes it. The first cut of this check
// matched one exact phrase, and a red-team found the identical false claim alive in two other
// places — including CLAUDE.md, which is loaded into every session, so every future reader was
// being told to perform a manual step that does not exist on the most dangerous file in the tree.
// Matching the CLAIM instead of the phrasing: the seam is settled by where `levelOf` is DEFINED,
// so any text putting it in the generated half is wrong however it is worded. The corrective
// wording ("lives in the HAND-WRITTEN half") is deliberately not caught — it says the opposite.
// Note the shape this forces: prose DESCRIBING the old bug must not use the collocation either,
// so say "the machine-owned half" when recounting it. That is the cost of matching a claim by
// its terms rather than its phrasing, and it is cheaper than the guard that missed it twice.
assert(/export const levelOf/.test(tail), 'levelOf is defined in the hand-written half');
assert(!/export const levelOf/.test(read('src/rules.generated.js')),
  'levelOf moved into the generated half — the seam changed, so every doc describing it must change too');
for (const f of ['src/rules.tail.js', 'CLAUDE.md', 'SPEC.md']) {
  const body = read(f);
  for (const m of body.matchAll(/levelOf/g)) {
    const around = body.slice(Math.max(0, m.index - 220), m.index + 220);
    assert(!/AUTO-GENERATED/i.test(around),
      `${f} still says levelOf lives in the AUTO-GENERATED half. It does not — it is defined in `
      + 'src/rules.tail.js, which the extractor never opens. A reader who believes this goes looking '
      + 'for a line to re-apply after every regeneration, finds none, and either thinks the extract '
      + 'broke or adds one that the NEXT run silently clobbers back to the prototype\'s /4.');
  }
}

// ── a doc must not describe its own size wrongly ─────────────────────────────────────────────────
// CLAUDE.md is loaded into every session, so a reader who believes it is a thousand lines when it is
// five thousand mis-plans every task that touches it.
// Every "CLAUDE.md is N lines" claim in either doc, wherever it appears. A first cut anchored on
// `CLAUDE\.md\s+alone` and so matched NOTHING, because SPEC writes the filename in backticks — the
// check reported clean while the stale figure sat right there. Mutation-tested: breaking either number
// now fails, and the count of claims found is asserted so a regex that stops matching is loud.
const claudeReal = lines('CLAUDE.md');
const sizeClaims = [];
for (const [name, text] of [['CLAUDE.md', read('CLAUDE.md')], ['SPEC.md', spec]])
  for (const m of text.matchAll(/CLAUDE\.md`?\s+(?:alone\s+)?(?:is\s+)?~?([\d,]{3,})\s*lines/gi))
    sizeClaims.push([name, Number(m[1].replace(/,/g, ''))]);
assert(sizeClaims.length >= 1, "no doc states CLAUDE.md's size — SPEC's D7 section did, so if that "
  + 'claim is gone the guard below is inert; either restore the figure or delete this check');
for (const [where, claimed] of sizeClaims)
  assert(Math.abs(claimed - claudeReal) / claudeReal < 0.25,
    `${where} says CLAUDE.md is ~${claimed} lines; it is ${claudeReal}. State the real order of magnitude `
    + '— it is loaded into every session, so a reader who believes it is 1,000 lines mis-plans every task.');

// ── the audit index must cover every audit ───────────────────────────────────────────────────────
// 57 audit reports read as current when they are point-in-time. The index is what says so, and an
// index that misses files is how a reader concludes an unlisted report is authoritative.
const audits = fs.readdirSync('.').filter((f) => /^AUDIT-.*\.md$/.test(f)).sort();
const index = read('docs/AUDITS.md');
const unlisted = audits.filter((f) => !index.includes(f));
assert.deepEqual(unlisted, [], `docs/AUDITS.md does not list: ${unlisted.join(', ')} — every audit must be `
  + 'indexed there, with its date and the note that SPEC.md is what is current');
const phantom = [...index.matchAll(/`(AUDIT-[a-z0-9.-]+\.md)`/g)].map((m) => m[1])
  .filter((f) => !audits.includes(f));
assert.deepEqual([...new Set(phantom)], [], `docs/AUDITS.md lists reports that do not exist: ${phantom.join(', ')}`);

// ── the launch checklist's fee guard — RETIRED 2026-08-12, and this is the tombstone ─────────────
// It checked that every "<n> ETH" the checklist stated as a price was a live fee (a published
// tranche wave, the respawn fee, a Store SKU), because that document's entire value is being
// accurate about the product, and a review run against a wrong fact pattern is worse than no review.
// It earned its place: it was written after a same-day founder reversal left the checklist
// describing one payment rail across every real-money price.
//
// The checklist left the repository when the repo went PUBLIC — it is kept outside, with the founder.
//
// THE DISCIPLINE DID NOT MOVE WITH IT, AND THAT IS THE POINT OF THIS COMMENT. A check that
// silently stops existing is how the thing it guarded goes stale unnoticed — so it is written down
// instead: whenever a fee lever moves (MINT_TRANCHES, RESPAWN_FEE_ETH, a STORE package price), the
// checklist has to be re-read by hand against the new figure before it is next relied on. The live
// prices are always recoverable from `GET /v1/rules` and the levers register; what cannot be
// recovered is somebody remembering to look.

// ── the codices must not quote a price the game does not charge ─────────────────────────────────
// The 2026-08-10 re-denomination moved 145 $OMR constants x6, and BOTH codices were left quoting the
// old prices — 17 of them, and `public/wiki.html` was materially behind `docs/WIKI.md` because the
// existing drift-detector checks only that a system is MENTIONED in both, never that the numbers
// agree. It was found by a hand-run scan, twice, after a spot-check had already reported success.
//
// So the check is: every "<n> $OMR" in either codex must equal SOME live lever. That is deliberately
// LOOSE — it cannot tell the peek price from the sweep price when both are 30 — and it is still the
// right net for the failure that occurs, because a whole-tree re-denomination leaves the stale
// figures at 1/6th of every live value, where they match nothing. It is a regression guard on the
// class, not a claim that each figure is quoted against the correct lever.
{
  const R = await import('../src/rules.js');
  // Only $OMR-DENOMINATED numbers count as live prices. The first cut of this guard swept every
  // number in the rules module, and the mutation SURVIVED — restoring the old "5 $OMR" sweep price
  // passed, because 5 is some unrelated count somewhere in rules.js. A set that broad matches any
  // small integer and asserts nothing.
  // A PRICE, specifically. Two things in rules.js are $OMR-keyed and are not prices, and both were
  // letting a stale figure through: an INVERSE lever (SPEAKEASY.RENOWN.OMR_WEIGHT, game-value per
  // $OMR, correctly divided rather than multiplied by the re-denomination) and RETIRED data
  // (RECRUIT_MILESTONES[].omr, which game.js stopped reading when referrals went to a respect bonus).
  const NOT_A_PRICE = /WEIGHT|RATE|MULT|BPS|DIV|PER_|_PER|MIN_LVL|LEVEL/i;
  const RETIRED = new Set(['RECRUIT_MILESTONES']);
  const live = new Set();
  const seen = new Set();
  const walk = (v, keyed) => {
    if (typeof v === 'number') { if (keyed && Number.isFinite(v) && v > 0) live.add(v); return; }
    if (!v || typeof v !== 'object' || seen.has(v)) return;
    seen.add(v);
    if (Array.isArray(v)) { for (const x of v) walk(x, keyed); return; }
    for (const [k, x] of Object.entries(v)) {
      if (RETIRED.has(k)) continue;
      walk(x, NOT_A_PRICE.test(k) ? false : (/omr/i.test(k) || keyed));
    }
  };
  walk(R, false);
  assert(live.size > 40, `expected many $OMR-denominated levers, saw ${live.size}`);
  const stale = [];
  for (const f of ['docs/WIKI.md', 'public/wiki.html'])
    read(f).split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/([0-9][0-9,]*) \$OMR/g)) {
        const n = Number(m[1].replace(/,/g, ''));
        if (!live.has(n)) stale.push(`${f}:${i + 1} quotes ${n} $OMR`);
      }
    });
  assert.deepEqual(stale, [], 'a codex quotes a $OMR price that matches no live lever — the game '
    + `charges something else and the player finds out at the till:\n  ${stale.join('\n  ')}`);
}

// ── NO PLAYER-FACING SURFACE MAY CLAIM THE TOKEN IS DEFLATIONARY ────────────────────────────────
// Since economy v3 step 2 a $OMR sink does not destroy the token — it RECYCLES to the desk's shelf
// to be sold again, which is the whole revenue model ("revenue ≈ sink volume × price"). The design
// says it plainly: nothing here may be called deflationary. Verified against the code rather than
// taken on trust — `recyclesToDesk` returns true for all 27 sink reasons and false for exactly one,
// `withdraw:omr`, and even THAT is not a supply reduction (the token leaves the in-game ledger to
// exist on-chain in the player's own wallet, backed one-for-one; it changes venue, nothing is
// destroyed). So there is no mechanic left that could justify a scarcity claim about $OMR.
//
// The claim in the OTHER direction is equally false and was live on the most-read surface in the
// project: the landing page said "$OMR is not created in game at all" while `omrMints` enumerates
// four live reasons — the mission ladder pays for play, and three more mint against a real token
// arriving. A player could check that in one query.
//
// THE GUARD IS DELIBERATELY NARROW, and that is the lesson from the price-parity check above: a
// pattern broad enough to catch every use of "burn" or "scarce" catches the game's own DEFINED
// vocabulary (both codices define a burn as "not destroyed — it lands on the desk's shelf"), NFT
// rarity, and the roster's scarce chairs — and an advisory that is mostly wrong is one people learn
// to route around. So this matches only phrases that are false about the TOKEN whenever they appear,
// with a waiver list for any legitimate use (catalog-or-declare, so a new one is a decision on the
// record rather than a silent regression).
{
  const FALSE_OF_THE_TOKEN = [
    [/deflationar/i, 'nothing reduces $OMR supply — every sink recycles to the desk shelf'],
    [/supply (is |will |can )?shrink/i, 'supply does not shrink; a sink is the house\'s cut, not a fire'],
    [/shrink\w*( the)? supply/i, 'same claim, other word order'],
    [/list is shrinking/i, 'the enumerated MINT list is not shrinking — it has four live reasons'],
    [/(increasingly|ever.more|more and more) scarce/i, 'no mechanic makes $OMR scarcer over time'],
    [/not created in game (at all|whatsoever)/i,
      'FALSE THE OTHER WAY — omrMints enumerates live reasons, the mission ladder among them'],
  ];
  // Any legitimate hit goes here WITH the reason it is legitimate. Empty today.
  const WAIVED = new Map([]);
  const SURFACES = ['docs/WIKI.md', 'public/wiki.html', 'public/index.html', 'public/play.html',
    'public/arena.html', 'AGENTS.md', 'omerta-mcp/README.md'];
  // llms.txt is BUILT, not a file — generate it so the guard covers what agents actually fetch.
  const { llmsTxt } = await import('../src/agentgateway.js');
  const surfaceText = (f) => (f === '<llms.txt>' ? llmsTxt() : read(f));
  const ALL_SURFACES = [...SURFACES, '<llms.txt>'];
  const llms = llmsTxt();
  assert(llms.includes('[Arena snapshot (JSON)](https://www.omerta.fun/v1/arena): the public banded board behind this page.'),
    'llms.txt identifies the public Arena JSON snapshot as the public banded board behind this page');
  assert(!llms.includes('/v1/leaderboard/agents'),
    'llms.txt does not direct unauthenticated discovery to the authenticated agent leaderboard');

  // Agent Turn v3 deliberately has two lanes: existing EV-ranked action authority and one
  // read-only Deep City recommendation. These discovery surfaces are the boundary most likely to
  // collapse the two into an unsafe promise ("the agent can execute exploration"), so require each
  // machine-facing guide to state the separation and the exact 40-system scope. The bounded runner
  // is a different boundary again: one owner-operated identity, finite cadence, and no fleet/reset
  // or policy expansion.
  const agentGuide = read('AGENTS.md');
  const mcpGuide = read('omerta-mcp/README.md');
  const publicDiscoverySurfaces = [
    ['GET /agents', agentGuide],
    ['GET /wiki', read('public/wiki.html')],
    ['docs/WIKI.md (Wiki source)', read('docs/WIKI.md')],
    ['GET /arena', read('public/arena.html')],
    ['GET /llms.txt', llms],
  ];
  const discoveryBoundaryFailures = [];
  for (const [name, text] of publicDiscoverySurfaces) {
    const arenaIndex = text.indexOf('/v1/arena');
    const detailedIndex = text.indexOf('/v1/leaderboard/agents');
    if (arenaIndex < 0 || !/\/v1\/arena[\s\S]{0,180}\bpublic\b/i.test(text.slice(arenaIndex))) {
      discoveryBoundaryFailures.push(`${name}: must identify /v1/arena as the public Arena snapshot`);
    }
    if (detailedIndex >= 0) {
      if (arenaIndex < 0 || arenaIndex > detailedIndex) {
        discoveryBoundaryFailures.push(`${name}: must lead discovery with /v1/arena before the detailed leaderboard`);
      }
      const boundary = text.slice(Math.max(0, detailedIndex - 80), detailedIndex + 220);
      if (!/authenticated/i.test(boundary)) {
        discoveryBoundaryFailures.push(`${name}: must label /v1/leaderboard/agents authenticated`);
      }
    }
  }
  assert.deepEqual(discoveryBoundaryFailures, [],
    `every public agent-discovery surface must preserve the public Arena/authenticated leaderboard boundary:\n  ${discoveryBoundaryFailures.join('\n  ')}`);
  const requiredV3Surfaces = [
    ['AGENTS.md', agentGuide],
    ['omerta-mcp/README.md', mcpGuide],
    ['<llms.txt>', llms],
  ];
  for (const [name, text] of requiredV3Surfaces) {
    assert(/Agent Turn v3/i.test(text), `${name} must name the shipped Agent Turn v3 contract`);
    assert(/`exploration`[\s\S]{0,300}(?:coverage object|coverage payload)[\s\S]{0,300}`catalog`[\s\S]{0,100}`progress`[\s\S]{0,100}`next`[\s\S]{0,100}`blocked`/i.test(text),
      `${name} must describe required exploration as the catalog/progress/next/blocked coverage object`);
    assert(/`exploration\.next`[\s\S]{0,400}(?:one|exactly one)[\s\S]{0,120}(?:unvisited|new)[\s\S]{0,120}(?:eligible|actionable)[\s\S]{0,120}(?:40-system|40 system)[\s\S]{0,120}(?:null|none)/i.test(text),
      `${name} must locate the one-of-40-or-null recommendation at literal exploration.next`);
    assert(/exploration[\s\S]{0,500}read-only/i.test(text),
      `${name} must describe exploration as read-only`);
    assert(/exploration[\s\S]{0,500}(?:non-EV|no EV|without EV)/i.test(text),
      `${name} must say exploration is outside EV scoring/ranking`);
    assert(/exploration[\s\S]{0,500}(?:non-executable|not executable|cannot be executed)/i.test(text),
      `${name} must say exploration cannot be executed`);
    assert(/exploration[\s\S]{0,700}(?:outside|separate from)[\s\S]{0,120}(?:authority|actions)/i.test(text),
      `${name} must keep exploration outside Agent Turn action authority`);
    assert(/(?:one|exactly one)[\s\S]{0,120}(?:unvisited|new)[\s\S]{0,120}(?:eligible|actionable)[\s\S]{0,120}(?:40-system|40 system)/i.test(text),
      `${name} must describe one relevant unvisited eligible system from the canonical 40`);
  }

  for (const [name, text] of [['AGENTS.md', agentGuide], ['omerta-mcp/README.md', mcpGuide]]) {
    assert(/Agent Alpha[\s\S]{0,1800}owner-operated/i.test(text),
      `${name} must identify Agent Alpha as owner-operated`);
    assert(/Agent Alpha[\s\S]{0,1800}one durable\s+(?:origin-bound\s+)?identity/i.test(text),
      `${name} must bind Agent Alpha to one durable identity`);
    assert(/Agent Alpha[\s\S]{0,1800}no reset/i.test(text),
      `${name} must say Agent Alpha has no reset path`);
    assert(/Agent Alpha[\s\S]{0,1800}(?:not a fleet|no fleet)/i.test(text),
      `${name} must not present Agent Alpha as a fleet runner`);
    assert(/Agent Alpha[\s\S]{0,1800}(?:1–50|1-50)[\s\S]{0,300}3100 ms/i.test(text),
      `${name} must publish Agent Alpha's finite action and cadence bounds`);
    assert(/Agent Alpha[\s\S]{0,1800}(?:never|no autonomous)[\s\S]{0,100}PvP[\s\S]{0,160}borrowing[\s\S]{0,180}human\s+(?:anti-Sybil\s+)?faucets/i.test(text),
      `${name} must preserve the runner's no-PvP, no-borrowing, no-human-faucet policy`);
  }

  assert(/GET `?\/v1\/arena`?[\s\S]{0,160}public/i.test(agentGuide)
    && /GET `?\/v1\/leaderboard\/agents`?[\s\S]{0,160}authenticated/i.test(agentGuide),
  'AGENTS.md must distinguish the public Arena snapshot from the authenticated detailed leaderboard');
  const oldArenaModule = ['opportunities', '\\.js'].join('');
  const staleArenaOwnershipPattern = `(${oldArenaModule}.{0,120}arenaBoard|arenaBoard.{0,120}${oldArenaModule})`;
  let staleArenaOwnership = '';
  try {
    staleArenaOwnership = execFileSync('git', ['grep', '-n', '-I', '-E', staleArenaOwnershipPattern, '--', '.'], {
      encoding: 'utf8',
    });
  } catch (error) {
    if (error.status !== 1) throw error;
  }
  assert.equal(staleArenaOwnership.trim(), '',
    `Arena ownership references must point to src/arena.js:\n${staleArenaOwnership}`);
  const dormantProduction = /(?:production[\s\S]{0,120}(?:dormant|no chain configured)|dormant[\s\S]{0,40}production)/i;
  assert(dormantProduction.test(agentGuide) && dormantProduction.test(mcpGuide),
  'both agent guides must keep production extraction explicitly dormant');
  const bad = [];
  for (const f of ALL_SURFACES) {
    let text;
    try { text = surfaceText(f); } catch { continue; }        // an optional surface may not exist
    text.split('\n').forEach((line, i) => {
      // A line that FORBIDS the claim is not making it — MARKETING.md's rules and AGENTS.md's
      // "never promise ... token appreciation" are the guard working, not violations of it.
      if (/never (promise|claim|say)|do not (promise|claim|say)|→ rewrite|forbidden/i.test(line)) return;
      for (const [re, why] of FALSE_OF_THE_TOKEN) {
        if (!re.test(line)) continue;
        const key = `${f}:${i + 1}`;
        if (WAIVED.has(key)) return;
        bad.push(`${key} — ${why}\n      ${line.trim().slice(0, 140)}`);
      }
    });
  }
  assert.deepEqual(bad, [], 'a player-facing surface makes a supply claim the mechanics do not '
    + `support. Fix the copy, or waive the line here with the reason it is honest:\n  ${bad.join('\n  ')}`);

  // ── AND THE OTHER PROMISE A LAUNCH CAN BREAK: extraction is BUILT, not OPEN ──────────────────
  // The withdrawal rail is real code and devnet-proven, but production runs with no chain
  // configured, so `POST /v1/withdraw` cannot sign and `/v1/arena` reports totalExtracted 0 for
  // everybody. Found live on the launch-readiness pass: the landing page told agents they "extract
  // real value", and the arena's own unfurl said they "extract real $OMR on-chain. This board is
  // live." Both stated a dormant capability in the present tense, next to real-money framing — the
  // same class as the false supply claims above, in the direction that matters most at launch.
  //
  // The rule is per-FILE and deliberately loose about wording: a surface may describe the rail all
  // it likes, so long as it also says somewhere that the rail is not open. When it DOES open, this
  // guard fails until it is updated — which is the point: going live is a decision on the record,
  // not a silent change of tense.
  // (`behind legal` was an arm here until 2026-08-13; the phrasing it matched is gone from the tree,
  // and a dead alternation in a guard is how the guard quietly stops covering anything.)
  const OPENS_THE_RAIL = /not active|dormant|not yet open|not live yet|until the audit|behind the launch checklist|until the launch/i;
  const DESCRIBES_EXTRACTION = /extract\w* (real |your |earned )?\$?OMR|on-chain (withdrawal|extraction)|POST \/v1\/withdraw/i;
  const unqualified = [];
  for (const f of ALL_SURFACES) {
    let text;
    try { text = surfaceText(f); } catch { continue; }
    if (!DESCRIBES_EXTRACTION.test(text)) continue;            // says nothing about the rail — fine
    if (OPENS_THE_RAIL.test(text)) continue;                   // describes it AND says it is shut
    unqualified.push(f);
  }
  assert.deepEqual(unqualified, [], 'a player- or agent-facing surface describes on-chain extraction '
    + 'without saying anywhere that the rail is not open yet. Nobody can extract today (no chain is '
    + 'configured in production), so stating it in the present tense is a promise the product cannot '
    + `keep:\n  ${unqualified.join('\n  ')}`);

  // ── THE SAME RULE, ON THE DOCS THAT BECOME THE COPY ────────────────────────────────────────────
  // The list above is the LIVE pages. But launch-day copy is drafted in the marketing docs and then
  // pasted verbatim into a post, so those reach further than any page and were covered by nothing —
  // the recorded shape of a class applied where it was discovered and never swept to its edge.
  // Found 2026-08-29 by running the guard's own predicate over them: docs/LAUNCH-TWEETS.md, the
  // launch-day thread, said "Play well enough, cash out on-chain. For real." with no caveat anywhere
  // in the file, while every sibling doc states the rule it was breaking (MARKETING-COPY.md §0:
  // never "cash out today"; HYPE.md: the closer states plainly that extraction opens at launch).
  //
  // NOTE the scope split, deliberately: only the extraction TENSE is checked here. The earnings
  // framing in these files is founder-directed (2026-08-14, recorded in HYPE.md § Copy and
  // tools/hype.js) and is NOT this guard's business — what is checkable is whether a doc describing
  // the rail also says the rail is shut.
  //
  // The predicates are the marketing corpus's OWN, not the live pages' above, and that is the whole
  // reason this check works: copy says "cash out" and "the on-chain exit" where a technical page says
  // "extraction" or names the route, so the page vocabulary run over these files matches almost
  // nothing and the check reads clean over a file carrying the defect. Measured: with the page
  // predicates the reverted LAUNCH-TWEETS line scores DESCRIBES=false, i.e. it would have been waved
  // through by the very guard written for it. Widening the PAGE predicates instead was rejected —
  // that loosens a passing check on seven live surfaces to fix a different corpus.
  const SAYS_EXTRACTION = /cash(ing)? out|cash-out|on-chain (exit|withdrawal|extraction)|extract\w* (real |your |earned )?\$?OMR|withdraw\w* \$?OMR|POST \/v1\/withdraw/i;
  const SAYS_SHUT = new RegExp(`${OPENS_THE_RAIL.source}|not open|opens at launch|audit-gated`, 'i');
  const MARKETING_DOCS = ['MARKETING.md', 'MARKETING-COPY.md', 'MARKETING-POSTS.md', 'HYPE.md',
    'LAUNCH.md', 'LAUNCH-NIGHT.md', 'LAUNCH-READINESS.md', 'docs/LAUNCH-TWEETS.md',
    'docs/OMR-MARKETING-PACK.md', 'docs/OMR-MACHINE-CAMPAIGN.md', 'docs/GAMEPLAY-MARKETING-PACK.md'];
  // catalogue-or-declare: a marketing doc that exists and is not listed is one nobody is checking.
  const onDisk = [...fs.readdirSync('.').filter((f) => /^(MARKETING|HYPE|LAUNCH)[A-Z-]*\.md$/.test(f)),
    ...fs.readdirSync('docs').filter((f) => /MARKETING|CAMPAIGN|TWEETS/.test(f)).map((f) => `docs/${f}`)];
  const unlisted = onDisk.filter((f) => !MARKETING_DOCS.includes(f));
  assert.deepEqual(unlisted, [], 'a marketing doc is not in MARKETING_DOCS, so the extraction-tense '
    + `rule is not being applied to copy that ships publicly:\n  ${unlisted.join('\n  ')}`);
  // …and the floor, because a corpus that has stopped matching reads exactly like a clean sweep.
  const describing = MARKETING_DOCS.filter((f) => SAYS_EXTRACTION.test(read(f)));
  assert(describing.length >= 4, 'the extraction-tense rule now governs only '
    + `${describing.length} marketing doc(s) — the predicate or the corpus has stopped matching, so `
    + 'this is vacuous rather than clean');
  const loose = describing.filter((f) => !SAYS_SHUT.test(read(f)));
  assert.deepEqual(loose, [], 'a marketing doc describes on-chain extraction without saying anywhere '
    + 'that the rail is not open yet. This copy gets pasted into public posts verbatim, so it travels '
    + `further than any page:\n  ${loose.join('\n  ')}`);

  // The caveat must also live next to the decision, not only somewhere at the bottom of a long page.
  // These were the three conversion-copy regressions found in the 2026-08-23 public-surface pass:
  // a live API pitch promising "real value", a gameplay intro saying $OMR "becomes real", and an
  // Arena label presenting dormant extraction as a current livelihood signal.
  const claims = [
    ['src/opportunities.js', /earn real value/i],
    ['public/index.html', /earned \$OMR becomes real/i],
    ['public/arena.html', /earned-a-living signals/i],
  ].filter(([f, re]) => re.test(read(f))).map(([f]) => f);
  assert.deepEqual(claims, [], 'a high-intent surface still turns the dormant rail into a current '
    + `earnings promise:\n  ${claims.join('\n  ')}`);
  assert(/CONNECT AN AI PLAYER/.test(read('public/play.html')),
    'agent setup must lead with the model-agnostic product; Claude is the guided lane, not the product boundary');
  assert(/server-rolled 15-point spread, each at least 3/i.test(read('docs/WIKI.md')),
    'the long-form Codex must describe the live randomized character build, not the retired 5/5/5 start');

  // …and the positive half, so the guard cannot be satisfied by the mechanism quietly changing:
  // if $OMR ever DOES become deflationary, this fails and forces the copy rules to be revisited
  // rather than leaving a stale prohibition standing over a game that outgrew it.
  const { recyclesToDesk, DESK } = await import('../src/rules.js');
  const recycling = DESK.SINK_REASONS.filter((r) => recyclesToDesk(r.replace(/%$/, 'x')));
  assert(recycling.length >= DESK.SINK_REASONS.length - DESK.NOT_RECYCLED.length - 1,
    'essentially every $OMR sink must still recycle to the desk — if that changed, the copy rules '
    + 'above are the thing to revisit, not this assertion');

  // ── AND THE MOST CONSEQUENTIAL PROMISE OF ALL: what death costs ─────────────────────────────────
  // Found by PLAYING, not by reading: both codices listed "cleared bank cash" under "What is safest
  // when you die", and it is false. Two different mechanics were conflated, and each is true on its
  // own — a KILLER's whack:loot reaches pocket + in-transit only, so a cleared balance really is out
  // of their reach; but runEstate then burns `cash + bank` together and the heir stands up on $500.
  // Reproduced with a $60,000 fully-cleared balance: heir bank $0. So the game was advising players
  // to bank for safety on the one screen that explains what dying costs, and they lose all of it.
  //
  // Same per-file, loose-about-wording shape as the extraction guard: a surface may describe what
  // survives death however it likes, so long as it also says the bank does not.
  const LISTS_DEATH_SURVIVORS = /safest when you die/i;
  const CAVEATS_THE_BANK = /bank is not one of them|bank (does not|doesn't|never) survive|not survive (your )?death/i;
  const misleading = [];
  for (const f of ALL_SURFACES) {
    let text;
    try { text = surfaceText(f); } catch { continue; }
    if (!LISTS_DEATH_SURVIVORS.test(text)) continue;
    if (!CAVEATS_THE_BANK.test(text)) misleading.push(f);
  }
  assert.deepEqual(misleading, [], 'a surface lists what survives death without saying the bank does '
    + 'not. Banking stops a KILLER taking a cut; the estate still takes pocket and bank together, so '
    + `"bank it and it is safe" is the most expensive wrong thing the game could tell a player:\n  ${misleading.join('\n  ')}`);

  // …and the positive half, so a stale prohibition cannot outlive the mechanic it describes: if the
  // estate is ever changed to SPARE the bank, this fails and the copy above is what to revisit.
  const estateSrc = read('src/social/estate.js');
  assert(/Number\(victim\.cash\)\s*\+\s*Number\(victim\.bank\)/.test(estateSrc),
    'the estate no longer burns pocket AND bank together — if that is deliberate, the death copy in '
    + 'both codices (and this guard) is what to revisit, not this assertion');

  // ── AND THE PROMISE A RETUNE LEFT BEHIND: the pad against the till ──────────────────────────────
  // Found by PLAYING. The Empire catalog's THE TERMS card told every buyer "stay away past 3 days
  // and you owe more than the place can hand you" — the sentence written for the tester who asked
  // how he could owe more in wages than his laundromat brought in. SIGN-OFF D6=B then moved
  // BUSINESS_UPKEEP_CAP_MS 7d → 2d expressly so "the pad can no longer outrun the till", and the
  // sentence did not move with it. Driven day by day at 3/4/5/7/10 days away, the till held $288,000
  // and the pad wanted $115,200 EVERY time: false at every absence, for every front, permanently.
  //
  // Why nothing caught it, and why the guard belongs HERE rather than in test/economy.js: the
  // numbers in that card are live (the catalog serves upkeepCapHours, upkeepBps, coldHours), so only
  // the CLAIM rotted; and test/economy.js was updated WITH the retune — its 6-days-away assertion
  // carries a comment saying it "is now the OPPOSITE of what it was, because D6=B removed the
  // crossover it used to prove". So the behavioural guard moved and the sentence a player reads did
  // not, which is exactly the gap a lever-vs-lever check cannot see. This crosses the LEVERS against
  // the COPY, which is the thing nothing did.
  const CLAIMS_THE_PAD_OUTRUNS = /owe more than (the place|it|the front|the business) can (hand|give|pay|bring)/i;
  const claiming = [];
  for (const f of ALL_SURFACES) {
    let text;
    try { text = surfaceText(f); } catch { continue; }
    if (CLAIMS_THE_PAD_OUTRUNS.test(text)) claiming.push(f);
  }
  const { CONSTANTS: C, BUSINESSES: BZ } = await import('../src/rules.js');
  // The worst case is a full empire, where the progressive pad is steepest. The front's own income
  // rate cancels from both sides, so this one comparison covers every front in the catalog.
  const padHours = (C.BUSINESS_UPKEEP_CAP_MS / 3600000)
    * ((C.BUSINESS_UPKEEP_BPS + (BZ.length - 1) * C.BUSINESS_UPKEEP_PROG_BPS) / 10000);
  const tillHours = C.BUSINESS_CAP_MS / 3600000;
  if (padHours < tillHours) {
    assert.deepEqual(claiming, [], 'a surface still tells a buyer they will owe more than the front can '
      + `hand back, but the levers say otherwise: a full envelope is ${padHours.toFixed(1)}h of income `
      + `against a till holding ${tillHours}h, so an absent owner is ALWAYS covered on their return `
      + `(SIGN-OFF D6=B). Say what neglect really costs — the place goes COLD:\n  ${claiming.join('\n  ')}`);
  } else {
    // …the positive half. If a retune ever restores the crossover, the copy has to come BACK rather
    // than leaving players told they are always covered when they are not.
    assert(claiming.length, `a full envelope is now ${padHours.toFixed(1)}h of income against a till `
      + `holding ${tillHours}h, so the pad CAN outrun the till again — no surface warns a buyer of it. `
      + 'Restore that sentence in the Empire catalog (public/index.html) or shorten the envelope.');
  }
}

// ── §6 must not send anyone back to finished work ────────────────────────────────────────────────
// SPEC has two places that talk about the same debt items: §4 describes each one's state, and §6 is
// the "do this next" list. They drifted: §6 said "Finish the lock-free read path (D1) — blocked on a
// design choice" for a while AFTER D1 was shipped, wired to all 24 read GETs, verified on real
// Postgres and red-teamed twice. The figures in this file were all correct; the two sections simply
// disagreed, which is the kind of staleness that costs a developer a day re-doing finished work.
//
// The rule is mechanical: if §4's entry for an item announces **Shipped:** / **DONE** / **RESOLVED**
// in its BODY, §6's entry for the same item must be struck through. Keying on the item's HEADING was
// the first attempt and it was pure decoration — D1's heading reads "**(HIGH → PARTLY ADDRESSED)**",
// which no reasonable "is it done" pattern matches, so the guard skipped the one case it was written
// for and passed the mutation test. The body marker is what actually distinguishes shipped work, and
// it fires on D1 exactly (verified by re-staling the entry and watching it fail).
{
  const section = (from, to) => spec.slice(spec.indexOf(from), to ? spec.indexOf(to) : undefined);
  const debt = section('## 4. Technical debt register', '## 5.');
  const next = section('## 6. Recommended sequence');
  const heads = [...debt.matchAll(/^### (D\d+) — (.+)$/gm)];
  let checked = 0;
  for (const [i, m] of heads.entries()) {
    const [, id, headline] = m;
    const body = debt.slice(m.index, i + 1 < heads.length ? heads[i + 1].index : undefined);
    if (!/\*\*(Shipped|DONE|RESOLVED)\b/.test(body)) continue;
    const entry = next.split('\n').find((l) => new RegExp(`\\(${id}\\)`).test(l));
    if (!entry) continue; // §6 has no opinion about this item — nothing to contradict
    checked++;
    assert(entry.includes('~~') || /\*\*DONE\*\*/.test(entry),
      `SPEC §4 says ${id} is shipped ("${headline.trim()}") but §6 still lists it as work to do:\n    ${entry.trim()}\n`
      + '  Strike it through. A "what to do next" list that points at finished work sends the next reader to re-do it.');
  }
  assert(checked >= 3, `only ${checked} debt items were cross-checked between §4 and §6 — the pairing `
    + 'broke (a heading format or an item numbering changed), so this guard is no longer guarding anything.');
}

// ── a harness that stops running protects nothing ────────────────────────────────────────────────
// Every harness here exists because something it checks was once broken, and two of chaos's checks
// are mutation-verified against real regressions (the wage-epoch resume guard; the checked-out-client
// error handler). None of that matters if CI quietly stops invoking them, so the workflow is checked
// for each one by name.
{
  const ci = read('.github/workflows/ci.yml');
  for (const script of ['npm test', 'npm run sim', 'npm run pgcheck', 'npm run chaos', 'npm run loadtest',
    'npm run scale'])
    assert(ci.includes(script), `.github/workflows/ci.yml no longer runs \`${script}\` — a harness that `
      + 'does not run is not a guard, it is a file. Re-add it or delete the harness honestly.');
  // dexbot-e2e lives in the FORGE workflow rather than ci.yml, because it needs what that job
  // already has — a Foundry toolchain (anvil) and the `out/` artifacts forge just built. Same rule.
  const forge = read('.github/workflows/forge.yml');
  assert(forge.includes('npm run dexbot-e2e'),
    '.github/workflows/forge.yml no longer runs `npm run dexbot-e2e` — that harness is the only thing '
    + 'that executes the raw v4 encodings against a real pool; without it they are unverified again.');
  assert(forge.includes("'src/dexbot.js'"),
    ".github/workflows/forge.yml no longer triggers on 'src/dexbot.js' — the encodings it proves live "
    + 'there, so a change to them would ship without the prover ever running.');
  // and its sibling: the stock rail's two on-chain legs (the 6551 address, the vault delivery)
  assert(forge.includes('npm run stock-e2e'),
    '.github/workflows/forge.yml no longer runs `npm run stock-e2e` — that harness is the only thing '
    + 'that executes resolveTbaOnchain against a real ERC-6551 registry. A wrong address there delivers '
    + 'real stock somewhere unrecoverable, with every units-denominated invariant still green.');
  assert(forge.includes("'src/stockdeliver.js'"),
    ".github/workflows/forge.yml no longer triggers on 'src/stockdeliver.js' — the legs it proves live "
    + 'there, so a change to them would ship without the prover ever running.');
  // the vendored 6551 reference implementation is what makes that proof mean anything
  for (const f of ['ERC6551Registry.sol', 'ERC6551Account.sol'])
    assert(fs.existsSync(`omerta-contracts/test/vendor/${f}`),
      `omerta-contracts/test/vendor/${f} is gone — stock-e2e proves the backend's token-bound-account `
      + 'address against the REAL registry; without it the prover would be checking our arithmetic '
      + 'against our own arithmetic.');
}

// ── THE WORKFLOW SCRIPT LEDGER ──────────────────────────────────────────────────
// The block above asserts CI still INVOKES each harness. It cannot see the other half: an invocation
// naming a script package.json does not define. `npm run <missing>` exits non-zero with
// "Missing script", so the step fails for a reason that has nothing to do with the code under test —
// which is exactly how ci.yml came to run `npm run test:stockcatalogv2:postgres` against a
// package.json that had no such key, turning a real-PostgreSQL job red on every branch at once.
// Catalogue rather than spot-check: every `npm run` any workflow issues must resolve.
{
  const scripts = JSON.parse(read('package.json')).scripts ?? {};
  const invocations = [];
  for (const file of fs.readdirSync('.github/workflows').filter((f) => /\.ya?ml$/.test(f))) {
    for (const m of read(`.github/workflows/${file}`).matchAll(/npm run ([a-z0-9:_-]+)/gi))
      invocations.push({ file, script: m[1] });
  }
  // anti-vacuity: an extractor that has stopped reading the workflows passes clean over a tree where
  // every one of these is broken.
  assert(invocations.length >= 10, 'THE WORKFLOW SCRIPT LEDGER read only '
    + `${invocations.length} \`npm run\` invocation(s) across .github/workflows — the workflows or the `
    + 'pattern have moved, so this check is measuring nothing.');
  const missing = invocations.filter((i) => !(i.script in scripts))
    .map((i) => `.github/workflows/${i.file} runs \`npm run ${i.script}\`, which package.json does not define`);
  assert.deepEqual(missing, [], 'a workflow invokes a script that does not exist, so that step fails '
    + `with "Missing script" whatever the code does:\n  ${missing.join('\n  ')}`);
}

// ── and neither does a gate that fails on its own dependency list ────────────────────────────────
// `forge test` is the pre-mainnet gate. Economy v3 step 6 added the v4 hook, added v4-core to
// `run-forge-test.sh`, and did NOT add it to the workflow — so on GitHub `forge build` failed to
// PARSE, and because parsing is all-or-nothing that skipped every step below it: not just the hook's
// tests but the OMR, bond, oracle, VoucherClaim and GearVault suites that had been green for months.
// The job went red and stayed red, which is the worst state for a gate to be in, because a red that
// is always red is read as noise. So the two fetch lists must agree with what the compiler is
// actually told to look for.
{
  const toml = read('omerta-contracts/foundry.toml');
  const local = read('omerta-contracts/run-forge-test.sh');
  const wf = read('.github/workflows/forge.yml');
  // Every remapping points at lib/<dir>/… — take the first segment, since a nested one
  // (solmate/=lib/v4-core/lib/solmate/) is shipped by its parent rather than fetched on its own.
  const needed = new Set([...toml.matchAll(/=lib\/([\w.-]+)\//g)].map((m) => m[1]));
  // forge-std is auto-discovered rather than remapped, but the tests import it, so it is a real
  // dependency and belongs in the same check.
  if (fs.readdirSync('omerta-contracts/test', { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .some((entry) => read(`omerta-contracts/test/${entry.name}`).includes('forge-std/')))
    needed.add('forge-std');
  assert(needed.size >= 3, `expected the contracts to need at least 3 lib deps, found ${[...needed]}`);
  for (const dep of needed) {
    assert(local.includes(`lib/${dep}`),
      `omerta-contracts/run-forge-test.sh never fetches lib/${dep}, which foundry.toml remaps — `
      + 'the local run would fail to compile.');
    assert(wf.includes(`lib/${dep}`),
      `.github/workflows/forge.yml never fetches lib/${dep}, which the contracts need — forge build `
      + 'will fail to PARSE on CI and skip the ENTIRE contract suite, not just whatever needs it. '
      + 'Keep the workflow in lockstep with run-forge-test.sh.');
  }
}

// ── and the COMPILER that consumes all of them was the one thing not held still ──────────────────
// Same class as the fetch list above, one layer down and easier to miss because it reads as
// configured rather than as absent: `foundry-rs/foundry-toolchain@v1` with no `version` resolves
// `stable` AT RUN TIME. So this workflow pinned forge-std (v1.9.6), OpenZeppelin (v5.6.1), v4-core
// (1.0.2) and solc (0.8.26, foundry.toml) by hand — and left the compiler and test runner floating.
// The forgotten sibling. It matters most exactly when the gate is red: a moving compiler means a
// CI failure cannot be reproduced locally, and this gate spent a session in that position with
// three tests passing on the developer's machine and failing on the runner.
//
// The rule is deliberately two-sided, because half of it is not obvious: a `version` key alone is
// not a pin. `stable` and `nightly` are CHANNELS — they satisfy "a version is declared" and still
// resolve at run time, which is the state this guard exists to forbid wearing a version key.
{
  const wf = read('.github/workflows/forge.yml');
  const step = wf.match(/uses:\s*foundry-rs\/foundry-toolchain@[^\n]*\n([\s\S]*?)(?=\n\s*-\s|$)/);
  assert(step, ".github/workflows/forge.yml no longer installs foundry-rs/foundry-toolchain — the "
    + 'extractor found no step to check, which reads exactly like a clean sweep. If the gate now '
    + 'gets its compiler some other way, pin THAT and re-point this guard at it.');
  const version = step[1].match(/^\s*version:\s*(\S+)/m);
  assert(version, '.github/workflows/forge.yml installs foundry-toolchain with NO `version:`, so it '
    + 'resolves `stable` at run time. Every other dependency in this workflow is pinned by hand; the '
    + 'compiler and test runner must be too, or a red gate cannot be reproduced locally.');
  assert(!/^(stable|nightly|latest)$/i.test(version[1]),
    `.github/workflows/forge.yml pins the toolchain to "${version[1]}", which is a CHANNEL rather `
    + 'than a version — it still resolves at run time. Pin the release tag (e.g. v1.7.1), which is '
    + 'the whole point: the log and the local run must be able to name the same binary.');
  assert(/run:\s*forge --version/.test(wf),
    '.github/workflows/forge.yml no longer prints `forge --version`. The pin says which binary SHOULD '
    + 'run; the banner is how the log says which one DID, without anybody having to guess at it.');
}

// ── nor one whose SIZE check can skip the suite ──────────────────────────────────────────────────
// The same class as the dependency gap above, from a different cause. `forge build --sizes` is
// all-or-nothing, so on 2026-08-27 a single test harness 906 bytes over EIP-170 (a typed factory,
// whose RUNTIME code embeds its target's INITCODE) failed the build step and SKIPPED `forge test`
// and both e2e provers with it — 19 hours of a red pre-mainnet gate in which the suite never ran,
// on a path-filtered workflow nobody was watching. The remedy is ordering, not a bigger exception:
// the parse gate builds, the suite and the provers run, and only THEN is the size table checked, so
// a size regression fails on its own step with everything below it already proven.
{
  // COMMENTS STRIPPED FIRST, line positions preserved: the notes on these steps NAME the commands
  // they are about (`forge build --sizes` appears in the parse gate's own comment explaining why it
  // is not there), so a scanner reading prose finds the size gate above the suite and reports the
  // correct ordering as a violation — a mostly-wrong advisory is the kind people route around.
  const wf = read('.github/workflows/forge.yml')
    .split('\n').map((line) => (/^\s*#/.test(line) ? '' : line)).join('\n');
  const at = (needle) => {
    const i = wf.indexOf(needle);
    assert(i > 0, `.github/workflows/forge.yml no longer contains \`${needle}\` — the forge job's `
      + 'step order can no longer be checked, which is the state that let a size regression skip the '
      + 'entire contract suite for 19 hours.');
    return i;
  };
  const sizes = at('forge build --sizes');
  for (const after of ['forge test -vvv', 'npm run dexbot-e2e', 'npm run stock-e2e'])
    assert(at(after) < sizes,
      `.github/workflows/forge.yml runs \`forge build --sizes\` BEFORE \`${after}\`. --sizes is `
      + 'all-or-nothing, so one over-limit contract fails that step and skips every step below it — '
      + 'which is exactly how the pre-mainnet gate went red for 19 hours with the suite not running '
      + 'at all. Keep the size table LAST.');
  // and the parse gate itself must stay free of it, or the split above buys nothing
  assert(/run:\s*forge build\s*$/m.test(wf),
    ".github/workflows/forge.yml has no bare `forge build` step — the parse gate and the size gate "
    + 'must be separate steps, or a size regression skips the suite again.');
}

// ── EVERY SIGNER-BEARING CONTRACT IS IN THE ROTATION RUNBOOK (red-team C1) ──────────────────────
// One backend key (`VOUCHER_SIGNER_PK`) signs for several contracts, and each stores its own
// `signer` that must be rotated separately. There is deliberately no shared registry on-chain, so
// the ONLY containment is the ordered list in CHAIN-DEPLOY §8 — and a partial rotation leaves a door
// open with nothing on-chain to say which. A fifth signer-bearing contract that ships without
// joining that list is therefore a silent hole in the incident response, so this is
// catalog-or-declare: carry a `setSigner`, be named in the runbook.
{
  const dir = 'omerta-contracts/src';
  const bearers = fs.readdirSync(dir).filter((f) => f.endsWith('.sol'))
    .filter((f) => /function setSigner\s*\(/.test(read(`${dir}/${f}`)))
    .map((f) => f.replace(/\.sol$/, ''));
  assert(bearers.length >= 4,
    `expected at least 4 signer-bearing contracts, found ${bearers.join(', ') || 'none'} — if the extractor `
    + 'stopped matching, this check is passing while covering nothing.');
  const runbook = read('CHAIN-DEPLOY.md');
  const rotation = runbook.slice(runbook.indexOf('ROTATING THE VOUCHER SIGNER'));
  assert(rotation, 'CHAIN-DEPLOY.md has no signer-rotation runbook at all');
  // The `setSigner` STEP specifically, not the runbook at large: every one of these is also named in
  // the pause step one line up, so "the name appears in the runbook" passes for the wrong reason —
  // which is exactly what a first cut of this check did, and pausing a contract does not rotate it.
  const step = rotation.split('\n').filter((l) => l.includes('setSigner')).join('\n');
  assert(step, "the rotation runbook never says setSigner — pausing is not rotating");
  for (const c of bearers) {
    assert(step.includes(c),
      `${c}.sol stores its own signer and CHAIN-DEPLOY's rotation runbook never names it — on a leak it `
      + 'would be the contract nobody rotates, and its pre-signed vouchers stay valid, bounded only by '
      + 'its own daily cap. Add it to the ordered list in §8.');
  }
  // THE ENTRANCE (red team #9 F2). A signer-bearing contract exists to mint against a voucher, so a
  // deployed one with nothing SIGNING for it is a contract nobody can use — and it fails silently,
  // because the exit half (a watcher, a metadata route, royalties) can be complete and look complete.
  // DynastyNFT shipped exactly that way while both the runbook and the log called the rail done, so
  // this is catalog-or-declare on the other side of the same key: carry a `setSigner`, have a backend
  // route that signs for you. Matched on the DOMAIN NAME, which is the one string a signing path
  // cannot avoid naming (the type name and the route path are both free choices).
  {
    const backend = fs.readdirSync('src').filter((f) => f.endsWith('.js'))
      .map((f) => read(`src/${f}`)).join('\n');
    for (const c of bearers) {
      const src = read(`${dir}/${c}.sol`);
      const dom = /EIP712\(\s*"([^"]+)"/.exec(src);
      assert(dom, `${c}.sol carries a setSigner but declares no EIP712 domain — it cannot verify a voucher.`);
      assert(backend.includes(`'${dom[1]}'`) || backend.includes(`"${dom[1]}"`),
        `${c}.sol self-mints against a signed voucher in the EIP-712 domain "${dom[1]}" and NOTHING in `
        + 'src/ signs one — the contract is deployable, watchable and unusable. Build the signing route '
        + '(the requestDeedWithdraw shape) or the deploy ships a door with no key.');
    }
  }
  // …and that daily cap is the SUM this key's blast radius is measured in, so every one of them must
  // take it as a CONSTRUCTOR argument (red-team R33). A setter-only cap defaults to 0 = unlimited, which
  // means the wall lives only in a deploy checklist — and two of these four were exactly that, with the
  // runbook calling one of them "optional", so a fresh deploy minted unbounded NFTs per day with nobody
  // doing anything wrong. 0 is still legal; what the constructor buys is that a deploy must STATE it.
  for (const c of bearers) {
    const src = read(`${dir}/${c}.sol`);
    const at = src.indexOf('constructor');
    assert(at > 0, `${c}.sol has no constructor — this check can no longer see its arguments`);
    let depth = 0, end = at;
    for (let i = src.indexOf('(', at); i < src.length; i++) {
      if (src[i] === '(') depth++;
      else if (src[i] === ')' && --depth === 0) { end = i; break; }
    }
    const params = src.slice(at, end);
    assert(/dailyCap|dailyMintCap/i.test(params),
      `${c}.sol takes no daily cap in its constructor, so it deploys UNCAPPED unless somebody remembers a `
      + "setter. It self-mints on the shared voucher signer, whose blast radius is the SUM of these "
      + 'contracts\' caps — make the cap a constructor argument (0 = unlimited is still allowed).');
  }
}

console.log(`✅ docs test passed — every number in SPEC.md's size table checked against the tree `
  + `(${srcFiles.length} src files / ${countLines(srcFiles)} lines, ${testFiles.length} suites, `
  + `${tables} tables, ${mdFiles.length} markdown files), the rules-seam figures are current, the false `
  + `"re-apply by hand" warning cannot come back, no doc misstates its own size by more than 25%, and all `
  + `${audits.length} audit reports are indexed as point-in-time with none phantom.`);

// ── OWNERSHIP IS TWO-STEP EVERYWHERE (red-team #8) ─────────────────────────────────────────────
// Ten of the sixteen contracts inherited `Ownable2Step`; six inherited plain `Ownable`, for no
// stated reason anywhere — an accident of authoring order, which is this project's most productive
// bug shape (N sites, N−1 following a rule). Single-step `transferOwnership` to a typo'd address is
// unrecoverable, and for OMR that means `setMinter` — the ONLY mint, and its emergency stop — could
// never be touched again. The owner is a Safe, so the realistic failure is a wrong address that N
// signers approve, which is exactly what a nominate-then-accept handshake exists to catch.
//
// Renouncing deliberately stays ONE step (Ownable2Step overrides `transferOwnership`, never
// `renounceOwnership`), so OMR's documented "the Safe can renounce to freeze the configuration
// forever" survives the change untouched.
//
// Catalog-or-declare: inherit Ownable2Step, or be waived with a reason that is a property of the
// contract. Scope: it proves the BASE, not that every privileged path is behind `onlyOwner`.
{
  const dir = 'omerta-contracts/src';
  const OWNER_WAIVED = {};    // none — every ownable contract in the tree is two-step
  const single = [];
  let ownable = 0;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sol'))) {
    const src = read(`${dir}/${f}`);
    const decl = /\n(?:abstract )?contract\s+\w+\s+is\s+([^{]+)\{/.exec(src);
    if (!decl || !/\bOwnable\b|\bOwnable2Step\b/.test(decl[1])) continue;
    ownable++;
    const name = f.replace(/\.sol$/, '');
    if (/\bOwnable2Step\b/.test(decl[1]) || OWNER_WAIVED[name]) continue;
    single.push(`${f}  (contract … is ${decl[1].trim()})`);
  }
  assert(ownable >= 12,
    `the ownership scan found only ${ownable} ownable contract(s) — the extractor has stopped seeing `
    + 'them, so this check is vacuous rather than clean');
  assert.equal(single.length, 0,
    'contract(s) inherit single-step `Ownable`. `transferOwnership` to a wrong address is then\n'
    + '      irreversible in one Safe transaction, with no nominee step to catch it — and for the\n'
    + '      token that means the minter can never be rotated or zeroed again:\n'
    + `   - ${single.join('\n   - ')}`);
  const stale = Object.keys(OWNER_WAIVED).filter((k) => !fs.existsSync(`${dir}/${k}.sol`));
  assert.equal(stale.length, 0, `ownership waiver(s) for a contract that no longer exists: ${stale.join(', ')}`);
  console.log(`✓ all ${ownable} ownable contracts hand ownership over in two steps`);
}

// ---------------------------------------------------------------------------------------------
// THE RISK REGISTER TRACKS THE LEVERS (drop 1 of the NetNet recommendations, 2026-08-21).
//
// Both codices now carry a Risk Factors page whose whole value is that its figures are TRUE. A
// risk page whose numbers have rotted is worse than none — it is the pad-copy class on the most
// trust-sensitive surface in the project. So every lever-derived figure the page states is
// crossed here against the LIVE lever: retune the sell tax, the surcharge window, the toll, the
// unbond, the loot rates or the death duty and this fails naming the codex and the phrase, which
// forces the copy to move in the same commit (the F6 discipline).
{
  const R = await import('../src/rules.js');
  const wikiMd  = fs.readFileSync('docs/WIKI.md', 'utf8');
  const wikiWeb = fs.readFileSync('public/wiki.html', 'utf8');

  // slice each codex to its OWN risk section so a matching figure elsewhere can never satisfy us
  const mdStart = wikiMd.indexOf('Risk Factors — the honest register');
  assert(mdStart > 0, 'docs/WIKI.md has lost its Risk Factors section');
  const mdEnd = wikiMd.indexOf('\n## ', mdStart);
  const mdRisk = wikiMd.slice(mdStart, mdEnd > 0 ? mdEnd : undefined);

  const webStart = wikiWeb.indexOf("id: 'risks'");
  assert(webStart > 0, 'public/wiki.html has lost its Risk Factors section');
  const webEnd = wikiWeb.indexOf('{ id:', webStart + 10);
  const webRisk = wikiWeb.slice(webStart, webEnd > 0 ? webEnd : undefined)
    .replace(/<[^>]+>/g, '');  // markup-free, so a <b> split can never hide a phrase

  const phrases = [
    ['the sell tax',        `${R.SELL_TAX.BPS / 100}% comes off the top`],
    ['the surcharge window',`younger than ${R.freshWindowMs() / 3600000} hours`],
    ['the surcharge rate',  `up to an extra ${R.earlySellTaxBps() / 100}% that fades to zero`],
    ['the exit toll',       `a flat ${R.withdrawTaxBps() / 100}% toll`],
    ['the unbond window',   `unbonds for ${R.CONSTANTS.UNSTAKE_CD_MS / 3600000} hours`],
    ['the loot rates',      `up to ${R.M3.OMR_LOOT_IDLE * 100}% of a loose balance and ${R.M3.OMR_LOOT_COMMITTED * 100}% of a staked one`],
    ['the death duty',      `burns ${R.M3.DEATH_DUTY_RATE * 100}% of the liquid`],
  ];
  for (const [what, phrase] of phrases) {
    assert(mdRisk.includes(phrase),
      `docs/WIKI.md risk register: ${what} no longer matches the live lever — expected the phrase "${phrase}"`);
    assert(webRisk.includes(phrase),
      `public/wiki.html risk register: ${what} no longer matches the live lever — expected the phrase "${phrase}"`);
  }
  console.log(`✓ the risk register's ${phrases.length} lever-derived figures match the live levers in both codices`);
}

// ---------------------------------------------------------------------------------------------
// NO LAUNCH-GATING DOC MAY CALL A CONTRACT UNWRITTEN WHILE ITS FILE EXISTS (2026-08-21).
//
// `CHAIN-DEPLOY.md` said, in the paragraph stating what is live TODAY, that `StockVault` was
// unwritten and "there is no claim route to find". It had shipped 2026-08-14 with a delivery
// keeper, a prover and a `delivered ≤ allocated` wall — and the SAME document listed it in the
// audit batch forty lines above, so the document contradicted itself and the stale half made the
// operative claim. It errs in the direction that UNDERSTATES what is live, which is the worst
// direction for a security review: an auditor told a contract does not exist does not attack it.
//
// Scope is deliberately CHAIN-DEPLOY + DEPLOY, the two documents whose only value is being
// accurate about the tree RIGHT NOW. CLAUDE.md is excluded on purpose: it is a chronological log
// where "not built" is a true statement about the day it was written and later entries supersede.
//
// Present tense only, for the same reason: "this paragraph SAID X WAS unwritten" is a correction
// naming its own fix, and a guard that fires on the correction is one people route around.
{
  const dir = 'omerta-contracts/src';
  const contracts = fs.readdirSync(dir).filter((f) => f.endsWith('.sol')).map((f) => f.replace(/\.sol$/, ''));
  const GONE = ['is unwritten', 'is not written', 'is unbuilt', 'is not built',
                'does not exist', "doesn't exist", 'has not been written', 'is still unwritten'];
  const claims = [];
  let mentions = 0;
  for (const doc of ['CHAIN-DEPLOY.md', 'DEPLOY.md']) {
    if (!fs.existsSync(doc)) continue;
    const src = read(doc);
    for (const name of contracts) {
      // word-boundary on both ends: `OMR` must not match inside `OMRStaking`
      const at = new RegExp(`\\b${name}\\b`, 'g');
      for (const m of src.matchAll(at)) {
        mentions++;
        const after = src.slice(m.index, m.index + 90).replace(/[`*\n]/g, ' ');
        const hit = GONE.find((p) => after.includes(p));
        if (hit) claims.push(`${doc}: "${name} … ${hit}" — but ${dir}/${name}.sol exists`);
      }
    }
  }
  assert(mentions >= 20,
    `the unwritten-contract scan matched only ${mentions} contract mention(s) across the launch-gating `
    + 'docs — the extractor has stopped reading them, so this is vacuous rather than clean');
  assert.equal(claims.length, 0,
    'a launch-gating doc says a contract that EXISTS is unwritten. An auditor told a contract does\n'
    + '      not exist will not attack it, and this errs in the understating direction:\n'
    + `   - ${claims.join('\n   - ')}`);

  // and the audit SCOPE must match the tree — "batch, not dribble" means the count is knowable
  const scope = /\*\*In the batch — (\d+) contracts \+ (\d+) interface/.exec(read('CHAIN-DEPLOY.md'));
  assert(scope, 'CHAIN-DEPLOY.md has lost its batch enumeration — the audit scope is no longer stated');
  const ifaces = contracts.filter((c) => /^I[A-Z]/.test(c)).length;
  assert.equal(Number(scope[1]) + Number(scope[2]), contracts.length,
    `CHAIN-DEPLOY.md sends ${scope[1]} contracts + ${scope[2]} interface(s) to audit, but the tree holds `
    + `${contracts.length} .sol files — a batch that does not match the tree is a scope somebody has to `
    + 'discover mid-engagement');
  assert.equal(Number(scope[2]), ifaces,
    `CHAIN-DEPLOY.md counts ${scope[2]} interface(s); the tree holds ${ifaces}`);
  console.log(`✓ no launch-gating doc calls an existing contract unwritten (${mentions} mentions), and the `
    + `batch matches the tree (${scope[1]} contracts + ${scope[2]} interface)`);
}

// CHAIN-AUDIT-PACKET.md is a FROZEN snapshot and says so in its own banner, so it is deliberately NOT
// held to the tree — `CHAIN-DEPLOY.md` is the live inventory authority and is checked against the tree
// above. But a snapshot that disagrees with ITSELF is not a record: a reader cannot tell which half is
// the evidence. It got there the ordinary way — 18738f02 refreshed the §1 table and its test count and
// left the heading, the framing date and the §3 prover row on the pre-refresh figures, so the document
// simultaneously claimed 17 contracts (heading) and enumerated 24 (its own table), and claimed both 387
// tests / 22 suites and 305 / 12, ninety lines apart. Hold every figure to the ones beside it.
{
  const pkt = read('CHAIN-AUDIT-PACKET.md');

  // the §1 table is the ground truth INSIDE this document: it enumerates the batch, one row per file
  const rows = [...pkt.matchAll(/^\| \d+ \| `([A-Za-z0-9]+)` \|(.*)$/gm)];
  assert(rows.length > 10, `the §1 batch table has stopped being readable (${rows.length} rows found) — `
    + 'this check would be vacuous rather than clean');
  const tableIfaces = rows.filter((r) => /interface, not a contract|interface only/.test(r[2])).length;
  const tableContracts = rows.length - tableIfaces;

  const head = /## 1\. HISTORICAL SCOPE — (\d+) contracts \+ (\d+) interfaces?/.exec(pkt);
  assert(head, 'CHAIN-AUDIT-PACKET.md §1 has lost its scope heading');
  assert.equal(`${head[1]}+${head[2]}`, `${tableContracts}+${tableIfaces}`,
    `the packet's §1 heading sends ${head[1]} contracts + ${head[2]} interface(s) to audit while the table `
    + `directly beneath it enumerates ${tableContracts} + ${tableIfaces}. An auditor scopes from the `
    + 'heading and discovers the rest mid-engagement, which is what "batch, not dribble" exists to prevent');

  const body = /(\d+)\s+Solidity files,\s+(\d+)\s+contracts and\s+(\d+)\s+interfaces/.exec(pkt);
  assert(body, 'CHAIN-AUDIT-PACKET.md §1 has lost its file-count sentence');
  assert.equal([body[1], body[2], body[3]].join('/'), [rows.length, tableContracts, tableIfaces].join('/'),
    `the packet says ${body[1]} files / ${body[2]} contracts / ${body[3]} interfaces; its own table `
    + `enumerates ${rows.length} / ${tableContracts} / ${tableIfaces}`);

  // and every restatement of the measurement must agree with the others — a partial refresh is the
  // failure mode, so what matters is not any single figure but that they cannot drift apart
  const pairs = [...pkt.matchAll(/(\d+)\s+(?:Foundry\s+)?tests?\s+(?:across|\/)\s+(\d+)\s+suites/g)]
    .map((m) => `${m[1]}/${m[2]}`);
  assert(pairs.length >= 2, `the packet states its Foundry count in ${pairs.length} place(s); with fewer `
    + 'than two there is nothing to hold it to and this assertion proves nothing');
  assert.equal(new Set(pairs).size, 1,
    `the packet gives its Foundry suite two different answers: ${[...new Set(pairs)].join(' and ')}`);

  // \s+, not a space: the §1 sentence wraps between the count and "512-run", so a literal space here
  // matched ONE site of two and the agreement below was trivially true — vacuous, not clean
  const fuzz = [...pkt.matchAll(/(\w+)\s+512-run fuzz/g)].map((m) => m[1]);
  assert(fuzz.length >= 2, `the packet counts its 512-run fuzz properties in ${fuzz.length} place(s); `
    + 'with fewer than two this agreement check proves nothing');
  assert.equal(new Set(fuzz).size, 1, `the packet counts its 512-run fuzz properties two ways: ${
    [...new Set(fuzz)].join(' and ')}`);

  const dates = [...pkt.matchAll(/measured (?:on )?\*{0,2}(\d{4}-\d\d-\d\d)/g)].map((m) => m[1]);
  assert(dates.length >= 2, `the packet states its measurement date in ${dates.length} place(s)`);
  assert.equal(new Set(dates).size, 1,
    `the packet was measured on two different days at once: ${[...new Set(dates)].join(' and ')}`);

  // A FROZEN test count with no compiler named is not evidence. The count is version-DEPENDENT — a
  // suite holding only `invariant_*` functions counts as ONE test under the older aggregated reporting
  // model and as N under 1.7.1 — and the toolchain was UNPINNED when these figures were taken
  // (`foundry-toolchain@v1`, no `version:`, so `stable` resolved at run time). So a reader re-running
  // the snapshot's own tree cannot tell whether the TREE changed or the COUNTER did, which is exactly
  // the ambiguity that left the forge gate red and unreproducible for 19 hours. The packet must name
  // the toolchain, and the version it names must be the one the workflow actually pins — two sources,
  // one truth, or the note goes stale the first time somebody bumps the pin.
  const pktForge = /forge v(\d+\.\d+\.\d+)/.exec(pkt);
  assert(pktForge, 'CHAIN-AUDIT-PACKET.md freezes a Foundry test count and names no toolchain version. '
    + 'The count is version-dependent (invariant-only suites aggregate differently), so a figure without '
    + 'a compiler beside it cannot be reproduced — name it');
  const wfPin = /foundry-toolchain@v1[\s\S]{0,200}?version:\s*v?(\d+\.\d+\.\d+)/
    .exec(read('.github/workflows/forge.yml'));
  assert(wfPin, 'the forge workflow has lost its pinned toolchain version — the packet cites one, so '
    + 'this cross-check has nothing left to hold it to');
  assert.equal(pktForge[1], wfPin[1],
    `the packet says its rebuilt measurement will use forge v${pktForge[1]} while the workflow pins `
    + `v${wfPin[1]}. A stale toolchain claim beside a frozen figure is worse than none: it tells a `
    + 'reader the count is reproducible under a compiler that is no longer the one that runs');

  console.log(`✓ the audit packet agrees with itself (${tableContracts} contracts + ${tableIfaces} `
    + `interfaces, ${pairs[0]} tests/suites, measured ${dates[0]})`);
}

// The issuer-retirement answer is a value-conservation rule, not optional prose. Keep the player Codex,
// the design authority, and the launch runbook aligned: ordinary multiplier actions preserve raw units;
// terminal actions stop and reconcile actual receipt back to the same pending cohort, never treasury.
{
  const md = read('docs/WIKI.md');
  const web = read('public/wiki.html');
  const design = read('omerta-brokers-design.md');
  const deploy = read('CHAIN-DEPLOY.md');

  assert(md.includes('Robinhood Assets (Jersey)') && web.includes('Robinhood Assets (Jersey)'),
    'both Codex surfaces must identify RHJ—not the underlier—as the Stock Token issuer');
  assert(md.includes('raw token balance') && web.includes('raw units'),
    'both Codex surfaces must preserve raw units across ordinary multiplier actions');
  assert(md.includes('same accounts') && web.includes('same accounts'),
    'both Codex surfaces must keep successor property with the original pending accounts');
  assert(design.includes('C = floor(P × U / B)') && design.includes('largest fractional remainder'),
    'the corporate-action design must retain its bounded pro-rata and deterministic dust calculation');
  assert(deploy.includes('C=floor(P×U/B)') && deploy.includes('end-to-end rehearsal'),
    'the launch runbook must carry the settlement math and forbid an unaudited automatic handler');
  console.log('✓ corporate-action policy stays fail-closed, pro-rata, cohort-bound, and aligned across both Codices plus launch docs');
}

// A closed family ballot binds one exact token. If that token becomes unavailable before execution,
// the approved product behavior is skip-and-carry—not keeper/Safe substitution. Keep the player-facing
// Codices, design authority, historical amendment, and launch runbook aligned on that boundary.
{
  const md = read('docs/WIKI.md');
  const web = read('public/wiki.html');
  const design = read('omerta-brokers-design.md');
  const historical = read('omerta-rwa-stock-machine-design.md');
  const deploy = read('CHAIN-DEPLOY.md');

  for (const [name, src] of [['docs/WIKI.md', md], ['public/wiki.html', web]]) {
    assert(src.includes('skipped') && src.includes('does not enlarge a later daily cap'),
      `${name} must disclose post-close skip, bounded carry-forward, and no cap accumulation`);
  }
  assert(design.includes('The default is resolution-only') && design.includes('never falls through'),
    'the RWA design must forbid post-close default or catalog substitution');
  assert(historical.includes('The keeper cannot substitute another'),
    'the historical Stock Machine amendment must carry the current no-substitution rule');
  assert(deploy.includes('POST-CLOSE INELIGIBILITY') && deploy.includes('public skipped-purchase status'),
    'the launch runbook must require skip-and-carry disclosure and rehearsal before arming');
  console.log('✓ post-close Stock Token ineligibility skips without substitution, preserves bounded ETH, and stays public');
}

// A registry removal during an OPEN ballot invalidates only the removed candidate's votes. Families
// retain the ordinary recast path until the unchanged cutoff; active votes still decide the day.
{
  const md = read('docs/WIKI.md');
  const web = read('public/wiki.html');
  const design = read('omerta-brokers-design.md');
  const historical = read('omerta-rwa-stock-machine-design.md');
  const deploy = read('CHAIN-DEPLOY.md');

  for (const [name, src] of [['docs/WIKI.md', md], ['public/wiki.html', web]]) {
    assert(src.includes('recast') && /does\s+not\s+restart\s+or\s+extend/.test(src),
      `${name} must preserve recasting without restarting or extending the open ballot`);
  }
  assert(design.includes('Founder open-ballot removal posture') && design.includes('do not contribute'),
    'the RWA design must exclude removed-candidate votes from the live lead and closing tally');
  assert(historical.includes('invalidates only that candidate\'s votes'),
    'the historical Stock Machine amendment must carry the current pre-close removal rule');
  assert(deploy.includes('PRE-CLOSE DEACTIVATION') && deploy.includes('active-only counting'),
    'the launch runbook must gate arming on active-only ballot counting and deterministic tests');
  console.log('✓ pre-close Stock Token removal invalidates only affected votes without restarting or extending the ballot');
}

// Skipped-day ETH defaults to one non-expiring acquisition pool. It may serve later exact winners only
// through fresh daily caps and never becomes a ticker entitlement, stacked cap, or catch-up batch. The
// founder-approved mainOperator is the explicit public unilateral ETH-transfer exception.
{
  const md = read('docs/WIKI.md');
  const web = read('public/wiki.html');
  const design = read('omerta-brokers-design.md');
  const historical = read('omerta-rwa-stock-machine-design.md');
  const deploy = read('CHAIN-DEPLOY.md');

  for (const [name, src] of [['docs/WIKI.md', md], ['public/wiki.html', web]]) {
    const plain = src.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ');
    assert(plain.includes('general Stock Token acquisition budget') && plain.includes('catch-up batch')
      && plain.includes('mainOperator') && plain.includes('any address') && plain.includes('any purpose'),
      `${name} must disclose pooled, non-stacking acquisition-budget carry-forward`);
  }
  assert(design.includes('Founder carried-budget posture') && design.includes('not earmarked'),
    'the RWA design must keep skipped ETH pooled rather than owed to the unavailable token');
  assert(historical.includes('non-expiring, general Stock Token acquisition backlog')
    && historical.includes('unilateral authority to move any/all pool ETH'),
    'the historical Stock Machine amendment must carry the pooled backlog rule');
  assert(deploy.includes('CARRIED ACQUISITION BUDGET') && deploy.includes('RwaStockBuyer.sweepEth')
    && deploy.includes('main-operator-only') && deploy.includes('operator_outflow'),
    'the launch runbook must replace the Safe sweep with the explicit main-operator authority');
  console.log('✓ skipped-day ETH remains pooled acquisition capital under fresh daily caps, never catch-up authority');
}

// Catalog recovery is Safe-reviewed and forward-only. Identity versions are immutable and permanent;
// reactivation toggles the same version, while any address/provider change creates a new key and leaves
// the old version enumerable. Only one version per ticker may be active, and ballots/allocations do not move.
{
  const md = read('docs/WIKI.md');
  const web = read('public/wiki.html');
  const design = read('omerta-brokers-design.md');
  const historical = read('omerta-rwa-stock-machine-design.md');
  const deploy = read('CHAIN-DEPLOY.md');

  for (const [name, src] of [['docs/WIKI.md', md], ['public/wiki.html', web]]) {
    const plain = src.replace(/<[^>]+>/g, '').replace(/\*\*/g, '');
    assert(plain.includes('Catalog changes are forward-only')
      && plain.includes('only future open ballots')
      && plain.includes('only one version of a ticker may be active')
      && plain.includes('cannot redirect an existing pending allocation'),
    `${name} must disclose immutable catalog versions, active-ticker uniqueness, and allocation separation`);
  }
  assert(design.includes('Founder forward-only catalog lifecycle')
    && design.includes('StockTokenRegistry.upsertAsset')
    && design.includes('prior version stays')
    && design.includes('ticker-derived key')
    && design.includes('Postgres declares `ticker` unique'),
  'the RWA design must require immutable version keys and record the ticker-key overwrite gap');
  assert(historical.includes('Catalog lifecycle is forward-only')
    && historical.includes('active-ticker uniqueness remains a launch gate'),
  'the historical Stock Machine amendment must carry the current forward-only lifecycle');
  assert(deploy.includes('FORWARD-ONLY CATALOG LIFECYCLE')
    && deploy.includes('old version remains inactive/enumerable')
    && deploy.includes('active-ticker uniqueness')
    && deploy.includes('allocation non-redirection'),
  'the launch runbook must gate activation on immutable versions and rehearse non-redirection');
  console.log('✓ Stock Token identities are immutable/versioned, forward-only, singly active per ticker, and allocation-neutral');
}

// Version keys are content-addressed identities, not opaque Safe aliases. Chain, normalized ticker,
// canonical token, and RHJ provider id determine the key; metadata/status changes do not fork it.
{
  const md = read('docs/WIKI.md');
  const web = read('public/wiki.html');
  const design = read('omerta-brokers-design.md');
  const historical = read('omerta-rwa-stock-machine-design.md');
  const deploy = read('CHAIN-DEPLOY.md');

  for (const [name, src] of [['docs/WIKI.md', md], ['public/wiki.html', web]]) {
    const plain = src.replace(/<[^>]+>/g, '').replace(/\*\*/g, '');
    assert(/version(?:'s asset)? key is deterministic/.test(plain)
      && plain.includes('Robinhood Chain ID')
      && plain.includes('opaque'),
    `${name} must disclose independently recomputable catalog identities and forbid opaque aliases`);
  }
  for (const [name, src] of [['omerta-brokers-design.md', design],
    ['omerta-rwa-stock-machine-design.md', historical], ['CHAIN-DEPLOY.md', deploy]]) {
    assert(src.includes('keccak256(abi.encode(chainId, keccak256(bytes(normalizedTicker)), token,')
      && src.includes('robinhoodAssetIdHash'),
    `${name} must retain the founder-approved deterministic Stock Token version-key formula`);
  }
  assert(design.includes('Ticker, token, provider-id hash, and chain ID are identity fields')
    && design.includes('Human-readable name and active status are not identity fields'),
  'the RWA design must distinguish version-forming identity from mutable metadata/status');
  assert(deploy.includes('DETERMINISTIC VERSION KEY')
    && deploy.includes('wrong-key rejection')
    && deploy.includes('ticker-rename versioning'),
  'the launch runbook must test deterministic keys, mismatch rejection, and rename versioning');
  console.log('✓ Stock Token version keys deterministically bind chain/ticker/token/provider identity, never metadata or status');
}

// Permanent history may repeat individual identity fields, but the active set is one-to-one across
// ticker, token, and provider id. Conflict retirement and activation are one registry-enforced mutation.
{
  const md = read('docs/WIKI.md');
  const web = read('public/wiki.html');
  const design = read('omerta-brokers-design.md');
  const historical = read('omerta-rwa-stock-machine-design.md');
  const deploy = read('CHAIN-DEPLOY.md');

  for (const [name, src] of [['docs/WIKI.md', md], ['public/wiki.html', web]]) {
    const plain = src.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').replace(/\s+/g, ' ');
    assert(plain.includes('Inactive historical versions may repeat')
      || plain.includes('Inactive history may repeat'),
    `${name} must retain reusable identity fields in inactive audit history`);
    assert(plain.includes('Activating a version atomically deactivates every active conflict')
      && (plain.includes('exact same version') || plain.includes('reactivating that exact version')),
    `${name} must disclose atomic conflict retirement and exact-version reactivation`);
  }
  assert(design.includes('Founder active-set uniqueness posture')
    && design.includes('single active owner for each')
    && design.includes('cannot depend on an eventual worker sync'),
  'the RWA design must make three-field active uniqueness an immediate registry invariant');
  assert(historical.includes('the active set may not')
    && historical.includes('registry invariant'),
  'the historical Stock Machine amendment must carry active-set uniqueness');
  assert(deploy.includes('ACTIVE-SET UNIQUENESS')
    && deploy.includes('three separate collision cases')
    && deploy.includes('one successor colliding on multiple fields'),
  'the launch runbook must rehearse every active-index collision shape');
  console.log('✓ Stock Token history may reuse identity fields while the registry atomically preserves active-set uniqueness');
}

// A production registry with zero active versions is a visible hard stop, never authority to restore a
// static/default token. The skipped day is durable, the buyer is silent, and recovery is forward-only.
{
  const md = read('docs/WIKI.md');
  const web = read('public/wiki.html');
  const design = read('omerta-brokers-design.md');
  const historical = read('omerta-rwa-stock-machine-design.md');
  const deploy = read('CHAIN-DEPLOY.md');

  for (const [name, src] of [['docs/WIKI.md', md], ['public/wiki.html', web]]) {
    const plain = src.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').replace(/\s+/g, ' ');
    assert((plain.includes('no candidates') || plain.includes('zero candidates'))
      && (plain.includes('no default') || plain.includes('no active default'))
      && plain.includes('catalog_empty')
      && (plain.includes('not replayed') || plain.includes('never replayed')),
    `${name} must disclose the visible hard-empty catalog and permanent skipped-day history`);
  }
  assert(design.includes('Founder empty-catalog posture')
    && design.includes("{resolved:false, reason:'no_tickers'}")
    && design.includes('durable public skip record/status'),
  'the RWA design must record the current transient empty-catalog implementation gap');
  assert(historical.includes('production catalog has no candidates and no default')
    && historical.includes('SPY/static fallback never returns'),
  'the historical Stock Machine amendment must carry hard-empty production behavior');
  assert(deploy.includes('EMPTY ACTIVE CATALOG')
    && deploy.includes('publisher/buyer silence')
    && deploy.includes('CURRENT SUBMISSION TOOL IS LEGACY-SHAPED'),
  'the launch runbook must rehearse hard-empty behavior and block legacy catalog calldata');
  console.log('✓ an empty production Stock Token catalog stops visibly, preserves pooled ETH, and never replays');
}

// Family nominations create a public review queue, never catalog authority. Only Safe execution and
// registry sync may promote a nomination into the active candidate set.
{
  const md = read('docs/WIKI.md');
  const web = read('public/wiki.html');
  const design = read('omerta-brokers-design.md');
  const historical = read('omerta-rwa-stock-machine-design.md');
  const deploy = read('CHAIN-DEPLOY.md');

  for (const [name, src] of [['docs/WIKI.md', md], ['public/wiki.html', web]]) {
    const plain = src.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').replace(/\s+/g, ' ');
    assert(plain.includes('Seated families may') && plain.includes('nominate')
      && plain.includes('boss or underboss') && /evidence(?:,\s+|—\s*)not approval/.test(plain),
    `${name} must disclose who can nominate and the discovery-evidence boundary`);
    assert((plain.includes('Safe approval') || plain.includes('on-chain approval'))
      && (plain.includes('registry sync') || plain.includes('worker synchronization'))
      && plain.includes('cannot alter closed/skipped ballots or pending allocations'),
    `${name} must keep nominations non-binding and isolated from ballots/allocations`);
  }
  assert(design.includes('Founder family nomination posture')
    && design.includes('No nomination') && design.includes('table, route, or board exists today')
    && design.includes('rate-limited under the cadence below'),
  'the RWA design must record the approved queue and its remaining implementation/policy gaps');
  assert(historical.includes('public, non-binding family nomination queue')
    && historical.includes('Safe execution plus sync remains the sole promotion path'),
  'the historical Stock Machine amendment must carry the nomination authority boundary');
  assert(deploy.includes('PUBLIC FAMILY NOMINATIONS')
    && deploy.includes('No nomination schema')
    && deploy.includes('full non-authoritative boundary'),
  'the launch runbook must gate launch on a durable, non-authoritative nomination queue');
  console.log('✓ seated families may publicly nominate and endorse RWA candidates without bypassing Safe approval');
}

// Nomination throttling is family-keyed and terminal history is append-only. Approval is still only a
// review disposition until the corresponding Safe execution is observed in the active registry mirror.
{
  const md = read('docs/WIKI.md');
  const web = read('public/wiki.html');
  const design = read('omerta-brokers-design.md');
  const historical = read('omerta-rwa-stock-machine-design.md');
  const deploy = read('CHAIN-DEPLOY.md');

  for (const [name, src] of [['docs/WIKI.md', md], ['public/wiki.html', web]]) {
    const plain = src.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').replace(/\s+/g, ' ');
    assert(plain.includes('one nomination per rolling seven days')
      || plain.includes('one new nomination per rolling seven days'),
    `${name} must disclose the family-keyed seven-day nomination cadence`);
    assert(plain.includes('30 days') && plain.includes('one endorsement')
      && plain.includes('change') && plain.includes('withdraw'),
    `${name} must disclose nomination lifetime and reversible single-family endorsements`);
    assert(plain.includes('not_eligible') && plain.includes('Expiry only archives')
      && plain.includes('fresh') && plain.includes('never') && plain.includes('rewrite'),
    `${name} must keep terminal disposition and renomination history append-only`);
  }
  assert(design.includes('Founder nomination cadence')
    && design.includes('rolling 168-hour window')
    && design.includes('pending_until = created_at + 30 days')
    && design.includes('Safe transaction is matched'),
  'the RWA design must pin exact clocks and separate review approval from registry authority');
  assert(historical.includes('Cadence is now fixed')
    && historical.includes('Renomination after cooldown creates a fresh linked record'),
  'the historical Stock Machine amendment must carry cadence and append-only renomination');
  assert(deploy.includes('NOMINATION CLOCKS')
    && deploy.includes('exact deadline races')
    && deploy.includes('delayed Safe execution'),
  'the launch runbook must rehearse clocks, terminal races, and non-authoritative approval');
  console.log('✓ family RWA nominations are weekly, endorsements reversible, and 30-day history append-only');
}

// Nomination review survives political turnover, but live endorsement counts follow the currently seated
// Commission. Historical events are never deleted or silently reactivated after a family regains a seat.
{
  const md = read('docs/WIKI.md');
  const web = read('public/wiki.html');
  const design = read('omerta-brokers-design.md');
  const historical = read('omerta-rwa-stock-machine-design.md');
  const deploy = read('CHAIN-DEPLOY.md');

  for (const [name, src] of [['docs/WIKI.md', md], ['public/wiki.html', web]]) {
    const plain = src.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').replace(/\s+/g, ' ');
    assert(plain.includes('nomination') && plain.includes('loses its Commission seat or dissolves')
      && plain.includes('loses') && plain.includes('write authority'),
    `${name} must preserve valid nominations while revoking departed-family writes`);
    assert(plain.includes('stops counting as current')
      && plain.includes('must endorse again')
      && (plain.includes('current support') || plain.includes('current seated support'))
      && plain.includes('historical'),
    `${name} must separate current seated support from immutable historical endorsements`);
  }
  assert(design.includes('Founder nomination seat-turnover posture')
    && design.includes('current_endorsements')
    && design.includes('seated at read/decision time'),
  'the RWA design must derive live support from current seats without deleting events');
  assert(historical.includes('valid nomination survives seat loss or family dissolution')
    && historical.includes('neither Safe-binding'),
  'the historical Stock Machine amendment must carry the seat-turnover boundary');
  assert(deploy.includes('SEAT TURNOVER DURING REVIEW')
    && deploy.includes('between authorization and commit')
    && deploy.includes('current-count recomputation from immutable history'),
  'the launch runbook must rehearse seat/rank races and history-derived live support');
  console.log('✓ RWA nomination history survives seat turnover while current support follows the live Commission');
}

// Pending nominations deduplicate by exact immutable identity, not ticker. Duplicate attempts preserve
// cooldown and require an explicit endorsement; same-ticker/different-version conflicts remain visible.
{
  const md = read('docs/WIKI.md');
  const web = read('public/wiki.html');
  const design = read('omerta-brokers-design.md');
  const historical = read('omerta-rwa-stock-machine-design.md');
  const deploy = read('CHAIN-DEPLOY.md');

  for (const [name, src] of [['docs/WIKI.md', md], ['public/wiki.html', web]]) {
    const plain = src.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').replace(/\s+/g, ' ');
    assert(plain.includes('one pending nomination') && plain.includes('deterministic version key')
      && plain.includes('existing item'),
    `${name} must deduplicate pending nominations by exact version identity`);
    assert(plain.includes('seven-day nomination allowance') && plain.includes('explicit')
      && plain.includes('endorse') && plain.includes('Different identities')
      && plain.includes('conflict'),
    `${name} must preserve cooldown, require endorsement confirmation, and expose identity conflicts`);
  }
  assert(design.includes('Founder nomination deduplication posture')
    && design.includes('conditional unique constraint')
    && design.includes("does not silently endorse on redirect")
    && design.includes("last_nomination_at"),
  'the RWA design must make duplicate redirect and cooldown preservation transaction-safe');
  assert(historical.includes('one pending item per deterministic version key citywide')
    && historical.includes('survive concurrent submissions'),
  'the historical Stock Machine amendment must carry exact-key deduplication and concurrency');
  assert(deploy.includes('EXACT-IDENTITY DEDUPLICATION')
    && deploy.includes('database constraint')
    && deploy.includes('duplicate redirect without endorsement'),
  'the launch runbook must rehearse exact-key races without implicit endorsement or cooldown loss');
  console.log('✓ pending RWA nominations deduplicate by exact version key without spending cooldown or hiding conflicts');
}

// The submitting family is a single sponsor, never also an endorser. Live support is derived from the
// currently seated five-family chamber, and a reseated sponsor must explicitly renew rather than revive.
{
  const md = read('docs/WIKI.md');
  const web = read('public/wiki.html');
  const design = read('omerta-brokers-design.md');
  const historical = read('omerta-rwa-stock-machine-design.md');
  const deploy = read('CHAIN-DEPLOY.md');

  for (const [name, src] of [['docs/WIKI.md', md], ['public/wiki.html', web]]) {
    const plain = src.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').replace(/\s+/g, ' ');
    assert(plain.includes('submitting family') && plain.includes('sponsor')
      && plain.includes('cannot endorse its own'),
    `${name} must identify one sponsor and prohibit sponsor self-endorsement`);
    assert(plain.includes('at most five') || plain.includes('maximum is five'),
    `${name} must bound current nomination support by the five-seat Commission`);
    assert(plain.includes('Reseating') && plain.includes('explicit')
      && plain.includes('current boss or underboss') && plain.includes('histor'),
    `${name} must require explicit sponsor renewal while preserving history`);
  }
  assert(design.includes('Founder nomination sponsor posture')
    && design.includes('sponsor_family_id')
    && design.includes('sponsor_support_renewed')
    && design.includes('bounded `0..5`'),
  'the RWA design must pin immutable sponsor identity and the no-double-count support formula');
  assert(historical.includes('immutable sole sponsor')
    && historical.includes('live support `0..5`'),
  'the historical Stock Machine amendment must carry sponsor counting');
  assert(deploy.includes('SPONSOR COUNTING')
    && deploy.includes('forbid that family from endorsing its own item')
    && deploy.includes('self-endorsement refusal'),
  'the launch runbook must rehearse sponsor uniqueness and five-seat bounds');
  console.log('✓ each RWA nomination has one sponsor and at most five current supporting families with no double count');
}

// A three-family majority requests review but never exercises Safe authority. Before operator claim the
// signal follows live support; after claim, political churn is disclosure rather than auto-cancellation.
{
  const md = read('docs/WIKI.md');
  const web = read('public/wiki.html');
  const design = read('omerta-brokers-design.md');
  const historical = read('omerta-rwa-stock-machine-design.md');
  const deploy = read('CHAIN-DEPLOY.md');

  for (const [name, src] of [['docs/WIKI.md', md], ['public/wiki.html', web]]) {
    const plain = src.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').replace(/\s+/g, ' ');
    assert((plain.includes('Three current supporting families')
      || plain.includes('three current seated families'))
      && plain.includes('review_requested') && plain.includes('RHJ') && plain.includes('alert'),
    `${name} must disclose the majority review signal and evidence refresh`);
    assert(plain.includes('never creates Safe calldata')
      && plain.includes('below three') && plain.includes('under_review')
      && (plain.includes('below threshold') || plain.includes('lower-support')),
    `${name} must keep review requests non-authoritative and define pre/post-claim support churn`);
    assert(plain.includes('current support') && plain.includes('oldest first'),
    `${name} must disclose support-first, age-second queue ordering`);
  }
  assert(design.includes('Founder nomination review-threshold posture')
    && design.includes('current_support >= 3')
    && design.includes('failed-refresh status visible')
    && design.includes('current_support DESC, created_at ASC, id ASC'),
  'the RWA design must pin threshold state transitions, refresh failure, and deterministic order');
  assert(historical.includes('Three current supporting families mark `review_requested`')
    && historical.includes('support churn stays visible but cannot cancel it'),
  'the historical Stock Machine amendment must carry the review-request boundary');
  assert(deploy.includes('REVIEW-REQUESTED THRESHOLD')
    && deploy.includes('failed/slow evidence refresh')
    && deploy.includes('manual below-threshold claim'),
  'the launch runbook must rehearse review threshold, evidence, and operator-claim races');
  console.log('✓ three current family supporters request RWA review without binding the Safe or cancelling claimed work');
}

// The procedural signal always means three independent seated organizations. Sparse chambers do not
// scale the threshold down; they use the explicit manual-review escape hatch instead.
{
  const md = read('docs/WIKI.md');
  const web = read('public/wiki.html');
  const design = read('omerta-brokers-design.md');
  const historical = read('omerta-rwa-stock-machine-design.md');
  const deploy = read('CHAIN-DEPLOY.md');

  for (const [name, src] of [['docs/WIKI.md', md], ['public/wiki.html', web]]) {
    const plain = src.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').replace(/\s+/g, ' ');
    assert(plain.includes('always three distinct currently seated families')
      || plain.includes('stays fixed at three distinct currently seated families'),
    `${name} must disclose the constant three-family automatic review quorum`);
    assert(plain.includes('majority of') && plain.includes('occupied seats')
      && plain.includes('fewer than three')
      && (plain.includes('manual operator') || plain.includes('authorized operator')),
    `${name} must forbid sparse-chamber scaling while retaining manual review`);
    assert(plain.includes('recompute') && plain.includes('without changing the threshold')
      && plain.includes('under_review'),
    `${name} must preserve the constant through seat churn and claimed review`);
  }
  assert(design.includes('Founder fixed review quorum')
    && design.includes('independent of `occupied_seat_count`')
    && design.includes('rank/seat weight does not') && design.includes('alter the count'),
  'the RWA design must pin an unweighted constant quorum independent of occupancy');
  assert(historical.includes('automatic quorum is a constant three distinct')
    && historical.includes('never rank-weighted'),
  'the historical Stock Machine amendment must carry fixed review quorum');
  assert(deploy.includes('FIXED REVIEW QUORUM')
    && deploy.includes('Rehearse chambers') && deploy.includes('with 0–5 occupied seats')
    && deploy.includes('weighted-rank irrelevance'),
  'the launch runbook must rehearse every occupancy and reject rank weighting');
  console.log('✓ automatic RWA review always requires three distinct seated families, regardless of occupied seats');
}

// The 30-day deadline is immutable across every unresolved state. Operator activity cannot keep a stale
// review alive; terminal disposition and later Safe execution remain distinct public state machines.
{
  const md = read('docs/WIKI.md');
  const web = read('public/wiki.html');
  const design = read('omerta-brokers-design.md');
  const historical = read('omerta-rwa-stock-machine-design.md');
  const deploy = read('CHAIN-DEPLOY.md');

  for (const [name, src] of [['docs/WIKI.md', md], ['public/wiki.html', web]]) {
    const plain = src.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').replace(/\s+/g, ' ');
    assert(plain.includes('original 30-day deadline') && plain.includes('under_review')
      && plain.includes('cannot') && plain.includes('extend'),
    `${name} must disclose the immutable deadline through active review`);
    assert(plain.includes('reviewer') && plain.includes('latest public')
      && plain.includes('fresh linked nomination') && plain.includes('new evidence'),
    `${name} must preserve expiry history and require fresh evidence to continue`);
    assert(plain.includes('Terminal') && plain.includes('do not expire')
      && plain.includes('awaiting Safe execution') && plain.includes('non-voteable'),
    `${name} must separate terminal review disposition from Safe execution state`);
  }
  assert(design.includes('Founder hard nomination deadline')
    && design.includes("now() < pending_until")
    && design.includes('No operator extension field or reopen path exists'),
  'the RWA design must pin database-time boundary semantics and forbid extensions/reopen');
  assert(historical.includes('30-day `pending_until` is immutable')
    && historical.includes('Approved-but-unexecuted work remains separately visible'),
  'the historical Stock Machine amendment must carry hard review expiry');
  assert(deploy.includes('HARD 30-DAY NOMINATION DEADLINE')
    && deploy.includes('exact-boundary races against')
    && deploy.includes('approved-but-delayed execution'),
  'the launch runbook must rehearse hard deadline and terminal/execution separation');
  console.log('✓ unresolved RWA nominations expire at a hard 30-day deadline, including under review');
}

// Review approval is not indefinitely reusable Safe authority. Exact identity/evidence and a seven-day
// deadline are committed in calldata and checked by the registry; stale execution requires fresh review.
{
  const md = read('docs/WIKI.md');
  const web = read('public/wiki.html');
  const design = read('omerta-brokers-design.md');
  const historical = read('omerta-rwa-stock-machine-design.md');
  const deploy = read('CHAIN-DEPLOY.md');

  for (const [name, src] of [['docs/WIKI.md', md], ['public/wiki.html', web]]) {
    const plain = src.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').replace(/\s+/g, ' ');
    assert(plain.includes('seven-day') && plain.includes('version key')
      && plain.includes('evidence hash') && plain.includes('rejects'),
    `${name} must disclose identity/evidence-bound, contract-enforced Safe execution TTL`);
    assert((plain.includes('mined before') || plain.includes('mining before')) && plain.includes('sync')
      && plain.includes('approval_stale') && plain.includes('non-voteable'),
    `${name} must separate on-time execution, delayed sync, and stale approval`);
    assert(plain.includes('fresh linked nomination') && plain.includes('Safe review')
      && (plain.includes('cannot') || plain.includes('unable')),
    `${name} must forbid replacement authority from an expired review`);
  }
  assert(design.includes('Founder Safe execution TTL')
    && design.includes('block.timestamp <= validUntil')
    && design.includes('cannot be requeued, regenerated, or assigned a new deadline'),
  'the RWA design must pin registry time semantics and prohibit TTL renewal');
  assert(historical.includes('expires exactly seven days after `approved_at`')
    && historical.includes('Current registry/tooling lacks this binding'),
  'the historical Stock Machine amendment must carry Safe TTL and implementation gap');
  assert(deploy.includes('SEVEN-DAY SAFE EXECUTION TTL')
    && deploy.includes('old-calldata rejection')
    && deploy.includes('fresh-review recovery'),
  'the launch runbook must rehearse Safe TTL boundaries and stale-calldata rejection');
  console.log('✓ approved RWA Safe calldata binds identity/evidence and expires after seven days without renewal');

  for (const [name, src] of [['docs/WIKI.md', md], ['public/wiki.html', web]]) {
    const plain = src.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').replace(/\s+/g, ' ');
    assert(plain.includes('evidence_drift') && plain.includes('residual executability')
      && plain.includes('no on-chain catalog authority') && plain.includes('Safe-governance failure'),
    `${name} must disclose evidence drift controls and their on-chain authority boundary`);
    assert(plain.includes('atomic Safe-authorized registry transition')
      && plain.includes('deactivate') && plain.includes('All parts revert together')
      && plain.includes('duplicate-active'),
    `${name} must require one reverting-together conflict-resolution and activation transition`);
    assert(plain.includes('executed_pending_finality') && plain.includes('synced_active')
      && plain.includes('Only finalized canonical chain state is voteable')
      && plain.includes('pre-finality reorg'),
    `${name} must gate voteability on canonical finalized and synchronized registry state`);
  }
  assert(design.includes('Founder pre-execution evidence drift rule')
    && design.includes('Founder atomic activation rule')
    && design.includes('Founder finalized-chain voteability rule'),
  'the RWA design must pin all three approved Safe activation-integrity rules');
  assert(historical.includes('residual') && historical.includes('executability stays visible')
    && historical.includes('one reverting-together registry transaction')
    && historical.includes('finalized, canonical, synchronized activation state `synced_active`'),
  'the historical Stock Machine amendment must carry activation-integrity requirements');
  assert(deploy.includes('PRE-EXECUTION EVIDENCE DRIFT')
    && deploy.includes('ATOMIC REGISTRY ACTIVATION')
    && deploy.includes('FINALIZED-CHAIN VOTEABILITY')
    && deploy.includes('ballot creation racing the finality transition'),
  'the launch runbook must rehearse evidence drift, atomic activation, and finality races');
  console.log('✓ RWA activation handles evidence drift, atomic uniqueness, and canonical-chain finality');

  for (const [name, src] of [['docs/WIKI.md', md], ['public/wiki.html', web]]) {
    const plain = src.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').replace(/\s+/g, ' ');
    assert(plain.includes('One authenticated authorized RWA reviewer')
      && (plain.includes('no second reviewer or reviewer co-signature is required')
        || (plain.includes('a second reviewer or reviewer co-signature is not required')))
      && plain.includes('Safe') && plain.includes('separate') && plain.includes('voteability'),
    `${name} must preserve one-person review disposition without collapsing the Safe activation gate`);
    assert(plain.includes('operational_quarantine') && plain.includes('health_unknown')
      && plain.includes('new or changed votes') && plain.includes('automatic delivery')
      && plain.includes('permanent allocation') && plain.includes('remain intact'),
    `${name} must fail closed after activation without confiscating permanent allocations`);
    assert(plain.includes('new family nomination')
      && (plain.includes('needs no new family nomination') || plain.includes('does not need a new family nomination'))
      && plain.includes('one authorized reviewer approval')
      && plain.includes('Safe') && plain.includes('deactivated')
      && (plain.includes('no carried endorsements') || plain.includes('do not carry over'))
      && (plain.includes('reactivated in place') || plain.includes('reactivates the existing version')),
    `${name} must distinguish operational clearance from full deactivated-version reactivation`);
  }
  assert(design.includes('Founder single-reviewer disposition rule')
    && design.includes('Founder post-activation quarantine rule')
    && design.includes('Founder quarantine recovery and reactivation rule'),
  'the RWA design must pin the approved reviewer, quarantine, and recovery authority model');
  assert(historical.includes('reviewer alone may terminally set')
    && historical.includes('unverifiable critical')
    && historical.includes('no support carries over'),
  'the historical Stock Machine amendment must carry reviewer and quarantine recovery rules');
  assert(deploy.includes('SINGLE-REVIEWER TERMINAL DISPOSITION')
    && deploy.includes('POST-ACTIVATION OPERATIONAL QUARANTINE')
    && deploy.includes('QUARANTINE CLEARANCE VERSUS REACTIVATION')
    && deploy.includes('reactivation conflicts'),
  'the launch runbook must rehearse one-person review, quarantine, and both recovery paths');
  console.log('✓ one reviewer disposes nominations; quarantine fails closed and recovers under Safe control');

  for (const [name, src] of [['docs/WIKI.md', md], ['public/wiki.html', web]]) {
    const plain = src.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').replace(/\s+/g, ' ');
    assert((plain.includes('Quarantine may begin automatically or manually')
        || plain.includes('Quarantine can begin automatically or manually'))
      && plain.includes('One authenticated authorized RWA reviewer may also impose either')
      && plain.includes('have no quarantine authority')
      && plain.includes('original quarantine timestamp'),
    `${name} must bind automatic/manual quarantine entry and deny player authority`);
    assert(plain.includes('at least every five minutes') && plain.includes('older than ten minutes')
      && plain.includes('synchronous fresh check') && plain.includes('founder/Safe policy change')
      && plain.includes('last_checked_at') && plain.includes('last_healthy_at'),
    `${name} must disclose quarantine cadence, freshness, action preflight, and public health fields`);
    assert(plain.includes('purchase_at_risk') && plain.includes('best-effort same-nonce')
      && plain.includes('not guaranteed') && plain.includes('no substitute ticker')
      && plain.includes('ordering_uncertain') && plain.includes('canonical assets')
      && (plain.includes('pause delivery') || plain.includes('delivery pauses')),
    `${name} must preserve the canonical result across quarantine/purchase transaction races`);
  }
  assert(design.includes('Founder quarantine-entry authority rule')
    && design.includes('Founder monitoring cadence and freshness rule')
    && design.includes('Founder in-flight purchase race rule'),
  'the RWA design must pin entry authority, health timing, and purchase-race behavior');
  assert(historical.includes('at least every five minutes')
    && historical.includes('best-effort safe same-nonce cancellation')
    && historical.includes('Unprovable chronology is `ordering_uncertain`'),
  'the historical Stock Machine amendment must carry quarantine timing and race semantics');
  assert(deploy.includes('QUARANTINE-ENTRY AUTHORITY')
    && deploy.includes('FIVE-MINUTE MONITOR / TEN-MINUTE FRESHNESS')
    && deploy.includes('IN-FLIGHT PURCHASE/QUARANTINE RACE')
    && deploy.includes('mempool replacement loss/win'),
  'the launch runbook must rehearse quarantine authority, freshness boundaries, and purchase races');
  console.log('✓ quarantine entry, health freshness, and in-flight purchase ordering are deterministic');

  for (const [name, src] of [['docs/WIKI.md', md], ['public/wiki.html', web]]) {
    const plain = src.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ');
    assert(plain.includes('delivery resumes only') && plain.includes('synchronous health check')
      && plain.includes('FIFO by creation time') && plain.includes('stable allocation ID')
      && plain.includes('unbroadcast stage') && plain.includes('without changing delivered')
      && plain.includes('no substitute') && plain.includes('priority bonus'),
    `${name} must resume quarantined delivery deterministically without delay windfalls`);
    assert(plain.includes('delivery_impossible_pending_resolution')
      && plain.includes('never expire') && plain.includes('unrelated')
      && plain.includes('general treasury ETH') && plain.includes('actual')
      && plain.includes('original cohort weights') && plain.includes('public conservation calculation'),
    `${name} must leave undeliverable allocations conserved and resolve only from actual asset recovery`);
    assert(plain.includes('delivery_hold') && plain.includes('exact immutable asset version')
      && plain.includes('original FIFO position') && plain.includes('before staging')
      && (plain.includes('post-broadcast') || plain.includes('once a transfer is broadcast'))
      && plain.includes('cannot reserve batches or starve')
      && (plain.includes('never forfeit') || plain.includes('never causes forfeiture')),
    `${name} must make user delivery holds reversible, non-economic, and race-safe`);
  }
  assert(design.includes('Founder delivery-backlog resumption rule')
    && design.includes('Founder permanently undeliverable resolution rule')
    && design.includes('Founder user delivery-hold rule'),
  'the RWA design must pin backlog, undeliverable-asset, and user-hold policy');
  assert(historical.includes('paused delivery resumes FIFO')
    && historical.includes('delivery_impossible_pending_resolution')
    && historical.includes('global/per-version `delivery_hold`'),
  'the historical Stock Machine amendment must carry delivery resumption and hold rules');
  assert(deploy.includes('QUARANTINE DELIVERY-BACKLOG RESUMPTION')
    && deploy.includes('PERMANENTLY UNDELIVERABLE STOCK TOKEN')
    && deploy.includes('USER DELIVERY HOLD')
    && deploy.includes('zero/partial/multiple recoveries')
    && deploy.includes('global/version') && deploy.includes('precedence, rapid toggles'),
  'the launch runbook must rehearse backlog delivery, asset recovery, and delivery holds');
  console.log('✓ paused deliveries resume FIFO; undeliverable assets conserve value; users may hold delivery');

  for (const [name, src] of [['docs/WIKI.md', md], ['public/wiki.html', web]]) {
    const plain = src.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ');
    assert(plain.includes('awaiting_deed')
      && (plain.includes('exactly one eligible') || plain.includes('Exactly one eligible'))
      && plain.includes('rwa_delivery_deed') && plain.includes('multiple') && plain.includes('deed')
      && plain.includes('all unbound') && plain.includes('whole')
      && plain.includes('bound destination') && plain.includes('immutable'),
    `${name} must define explicit multi-deed selection and immutable whole-allocation binding`);
    assert(plain.includes('pending allocation travels with') && plain.includes('Finalized deed transfer')
      && plain.includes('delivery holds')
      && (plain.includes('not re-scored') || plain.includes('without re-scoring'))
      && plain.includes('former owner') && plain.includes('public deed view')
      && (plain.includes('does not price, guarantee, or intermediate')
        || plain.includes('neither prices, guarantees, nor intermediates')),
    `${name} must make bound rights follow the deed with transfer-time disclosure`);
    assert(plain.includes('redirect a bound allocation') && plain.includes('ordinary Safe action')
      && plain.includes('protocol-wide Street Deed/TBA migration')
      && plain.includes('deterministic') && plain.includes('one-to-') && plain.includes('conservation proof')
      && (plain.includes('individual rescue') || plain.includes('rescue one individual'))
      && (plain.includes('Delivery pauses') || plain.includes('delivery pauses')),
    `${name} must prohibit individual beneficiary rewrites while allowing deterministic protocol migration`);
  }
  assert(design.includes('Founder Street Deed destination-binding rule')
    && design.includes('Founder deed-transfer attached-rights rule')
    && design.includes('Founder bound-beneficiary immutability and migration rule'),
  'the RWA design must pin deed binding, attached transfer rights, and migration-only remapping');
  assert(historical.includes('account-beneficial `awaiting_deed`')
    && historical.includes('Bound pending rights and holds follow finalized deed transfer')
    && historical.includes('individual rescue is forbidden'),
  'the historical Stock Machine amendment must carry deed-bound ownership semantics');
  assert(deploy.includes('STREET DEED DELIVERY-DESTINATION BINDING')
    && deploy.includes('BOUND RIGHTS FOLLOW DEED TRANSFER')
    && deploy.includes('BOUND BENEFICIARY IMMUTABILITY / PROTOCOL MIGRATION ONLY')
    && deploy.includes('mapping collision/omission'),
  'the launch runbook must rehearse deed selection, transfers, and deterministic migration');
  console.log('✓ Stock Token allocations bind whole to a deed, follow its transfer, and resist redirection');

  for (const [name, src] of [['docs/WIKI.md', md], ['public/wiki.html', web]]) {
    const plain = src.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ');
    assert(plain.includes('dedicated, separately accounted RWA delivery-')
      && plain.includes('operations ETH budget')
      && plain.includes('no extra')
      && (plain.includes('deed extraction requirement') || plain.includes('Deed extraction requirement'))
      && plain.includes('pooled') && plain.includes('delivery_gas_unfunded')
      && plain.includes('delivery_gas_above_ceiling')
      && (plain.includes('cannot sell or skim Stock Tokens') || plain.includes('may not sell or skim Stock Tokens'))
      && plain.includes('funding-source category') && plain.includes('mainOperator')
      && plain.includes('operator_outflow'),
    `${name} must fund delivery gas separately without allocation dilution or keeper reimbursement`);
    assert(plain.includes('integer atomic units') && plain.includes('largest fractional remainder')
      && plain.includes('stable immutable account ID ascending')
      && plain.includes('qualified_rounded_zero') && plain.includes('no phantom')
      && (plain.includes('no dollar-value threshold') || plain.includes('without a dollar-value threshold'))
      && plain.includes('row')
      && plain.includes('audit history'),
    `${name} must conserve cohort atomic units by deterministic largest-remainder rounding`);
    assert(plain.includes('Delivery batches isolate items') && plain.includes('full staged amount')
      && plain.includes('recipient-specific') && plain.includes('unrelated successes')
      && plain.includes('only after finality')
      && (plain.includes('token-wide') || plain.includes('Token-wide'))
      && plain.includes('staged plus delivered') && plain.includes('cannot double-') && plain.includes('confirm')
      && plain.includes('cannot alter FIFO'),
    `${name} must isolate recipient delivery failures while halting systemic conservation failures`);
  }
  assert(design.includes('Founder delivery-gas funding rule')
    && design.includes('Founder atomic-unit largest-remainder rule')
    && design.includes('Founder isolated delivery-item batch rule'),
  'the RWA design must pin gas separation, integer rounding, and isolated batch semantics');
  assert(historical.includes('separately accounted RWA operations ETH')
    && historical.includes('public `qualified_rounded_zero`')
    && historical.includes('recipient failure cannot undo unrelated success'),
  'the historical Stock Machine amendment must carry delivery economics and isolation rules');
  assert(deploy.includes('DEDICATED RWA DELIVERY-GAS BUDGET')
    && deploy.includes('INTEGER ATOMIC UNITS / LARGEST REMAINDER')
    && deploy.includes('PER-ITEM ISOLATED DELIVERY BATCHES')
    && deploy.includes('bounded-batch fairness'),
  'the launch runbook must rehearse gas funding, rounding edges, and mixed delivery results');
  console.log('✓ delivery gas is non-dilutive; atomic-unit rounding conserves; recipient failures isolate');

  for (const [name, src] of [['docs/WIKI.md', md], ['public/wiki.html', web]]) {
    const plain = src.replace(/<\/?[A-Za-z][^>]*>/g, '').replace(/&lt;/g, '<').replace(/\*\*/g, '')
      .replace(/`/g, '').replace(/\s+/g, ' ');
    assert(plain.includes('actual custody') && plain.includes('receivedUnits = postPurchaseBalance - prePurchaseBalance')
      && plain.includes('verified positive delta') && plain.includes('acquisition_amount_mismatch')
      && plain.includes('fee-on-transfer') && plain.includes('new immutable version')
      && plain.includes('Safe-approved') && plain.includes('conservation test'),
    `${name} must derive allocatable units from serialized canonical custody balance delta`);
    assert(plain.includes('total') && plain.includes('trade') && plain.includes('input')
      && (plain.includes('network gas is separate') || plain.includes('Network gas is separate'))
      && plain.includes('no protocol skim')
      && plain.includes('unconsumed') && plain.includes('refunded ETH')
      && plain.includes('second ticker') && plain.includes('captures favorable execution')
      && plain.includes('effective') && plain.includes('oracle') && plain.includes('deviation'),
    `${name} must separate trade economics from gas and publish actual execution reconciliation`);
    assert(plain.includes('purchaseUntil = closed_at + 2 hours')
      && plain.includes('block.timestamp <= purchaseUntil') && plain.includes('one logical')
      && plain.includes('only one') && plain.includes('partial fill') && plain.includes('no top-up')
      && plain.includes('purchase_window_missed') && plain.includes('late')
      && plain.includes('revert') && plain.includes('Public history'),
    `${name} must enforce a two-hour one-success purchase window and terminal missed day`);
  }
  assert(design.includes('Founder custody-balance acquisition truth rule')
    && design.includes('Founder acquisition spend/refund/slippage rule')
    && design.includes('Founder hard two-hour purchase window rule'),
  'the RWA design must pin custody truth, spend accounting, and hard execution window');
  assert(historical.includes('exact-token-serialized custody delta')
    && historical.includes('input/consumption/refund/units/prices/deviation/venue/gas')
    && historical.includes('`purchase_window_missed` skips forever'),
  'the historical Stock Machine amendment must carry purchase truth and deadline semantics');
  assert(deploy.includes('ACTUAL CUSTODY BALANCE-DELTA ACQUISITION TRUTH')
    && deploy.includes('ACQUISITION SPEND / REFUND / SLIPPAGE ACCOUNTING')
    && deploy.includes('HARD TWO-HOUR PURCHASE WINDOW / ONE SUCCESS')
    && deploy.includes('Current buyer lacks this deadline binding'),
  'the launch runbook must rehearse acquisition reconciliation, slippage, and deadline races');
  console.log('✓ custody delta controls units; spend/refunds reconcile; each ballot gets one on-time fill');

  for (const [name, src] of [['docs/WIKI.md', md], ['public/wiki.html', web]]) {
    const plain = src.replace(/<\/?[A-Za-z][^>]*>/g, '').replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ');
    assert(plain.includes('cannot') && plain.includes('own independent reference')
      && plain.includes('at least one independently governed valid price')
      && plain.includes('median') && plain.includes('at most five minutes')
      && plain.includes('500 basis points (5%)') && plain.includes('minOut')
      && plain.includes('wrong-asset') && plain.includes('unverified') && plain.includes('fallback'),
    `${name} must require a fresh independent oracle under the hard five-percent ceiling`);
    assert(plain.includes('ballots continue') && plain.includes('calendar')
      && plain.includes('market_unavailable') && plain.includes('buys')
      && plain.includes('pooled') && plain.includes('stale prior close')
      && plain.includes('Monday catch-up') && plain.includes('off-hours')
      && plain.includes('underlying_market_closed') && plain.includes('asset_halted'),
    `${name} must preserve daily votes while evidence—not the clock—controls tradability`);
    assert(plain.includes('exact Safe-approved adapter address and deployed code hash')
      && plain.includes('arbitrary') && plain.includes('delegatecall')
      && (plain.includes('per-attempt deadline') || plain.includes('attempt deadline'))
      && plain.includes('five minutes')
      && plain.includes('cannot redirect') && plain.includes('Private submission')
      && plain.includes('public') && plain.includes('lower input')
      && plain.includes('widen') && plain.includes('fresh Safe approval'),
    `${name} must confine adapter targets, calldata, funds, retries, and upgrade authority`);
  }
  assert(design.includes('Founder independent price-oracle rule')
    && design.includes('Founder calendar-neutral market-availability rule')
    && design.includes('Founder adapter and attempt-confinement rule'),
  'the RWA design must pin independent pricing, evidence-based availability, and adapter confinement');
  assert(historical.includes('Venue/router/pool cannot self-reference price')
    && historical.includes('`market_unavailable` pools ETH')
    && historical.includes('Safe-approved adapter address+code hash'),
  'the historical Stock Machine amendment must carry oracle, market, and adapter walls');
  assert(deploy.includes('INDEPENDENT FIVE-MINUTE PRICE ORACLE / 500-BPS HARD CEILING')
    && deploy.includes('CALENDAR-NEUTRAL MARKET AVAILABILITY')
    && deploy.includes('ADAPTER / ATTEMPT CONFINEMENT')
    && deploy.includes('arbitrary-call/delegatecall attempts'),
  'the launch runbook must rehearse oracle, off-hours, and adapter attack boundaries');
  console.log('✓ independent fresh pricing, evidence-based availability, and exact adapters gate purchases');

  for (const [name, src] of [['docs/WIKI.md', md], ['public/wiki.html', web]]) {
    const plain = src.replace(/<\/?[A-Za-z][^>]*>/g, '').replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ');
    assert(plain.includes('RwaAcquisitionVault') && plain.includes('mainOperator')
      && plain.includes('any amount') && plain.includes('any address') && plain.includes('any purpose')
      && plain.includes('without Safe approval') && plain.includes('without')
      && plain.includes('timelock') && plain.includes('operator_outflow')
      && plain.includes('cannot move Stock Tokens') && plain.includes('explicit'),
    `${name} must disclose unilateral main-operator ETH custody power without overstating vault restriction`);
    assert(plain.includes('per-purchase') && plain.includes('citywide daily')
      && plain.includes('rolling-30-day') && plain.includes('actual')
      && plain.includes('exposure_cap_reached') && plain.includes('no substitute')
      && plain.includes('Main-operator ETH outflows bypass') && plain.includes('withdrawal'),
    `${name} must enforce normal-buy concentration caps while classifying operator outflow separately`);
    assert(plain.includes('state-preserving vault migration') && plain.includes('at least 48 hours')
      && plain.includes('code hash') && plain.includes('full') && plain.includes('reconciliation')
      && plain.includes('mainOperator') && plain.includes('bypass')
      && plain.includes('permanent') && plain.includes('dispose')
      && plain.includes('never') && plain.includes('mislabel'),
    `${name} must separate canonical migration from immediate arbitrary main-operator outflow`);
    assert(plain.includes('exactly one current') && plain.includes('pendingMainOperator')
      && plain.includes('zero address disables') && plain.includes('immediately')
      && plain.includes('at least 48 hours') && plain.includes('nominated address')
      && plain.includes('Safe-driven appointment') && plain.includes('restoration from a zero operator')
      && plain.includes('instant-replacement path'),
    `${name} must expose a single operator with immediate Safe disable, delayed Safe restoration, and instant self-handoff`);
    assert(plain.includes('replaceMainOperator') && plain.includes('nonzero')
      && plain.includes('different successor immediately')
      && plain.includes('without Safe approval') && plain.includes('acceptance delay')
      && plain.includes('timelock') && plain.includes('cannot be relayed')
      && plain.includes('msg.sender == mainOperator') && plain.includes('consents in the same transaction')
      && plain.includes('EIP-712') && plain.includes('current operator')
      && plain.includes('proposed operator') && plain.includes('acceptance deadline')
      && plain.includes('EOA') && plain.includes('ERC-1271 magic value')
      && plain.includes('cancels') && plain.includes('pending Safe nomination')
      && plain.includes('preserves nextOutflowNonce')
      && plain.includes('immediately in canonical ordering')
      && plain.includes('Safe retains immediate zero-disable'),
    `${name} must let the active operator install a consenting successor instantly with atomic authority rotation`);
    assert(plain.includes('acceptance deadline') && plain.includes('issuedAt')
      && plain.includes('block.timestamp') && plain.includes('no longer than one hour')
      && plain.includes('Future-issued') && plain.includes('expired')
      && plain.includes('zero/reversed') && plain.includes('over-hour')
      && plain.includes('consent fails before mutation'),
    `${name} must reject same-address handoffs and bound successor consent to a non-future one-hour window`);
    assert(plain.includes('Zeroing atomically cancels') && plain.includes('increments')
      && plain.includes('invalidates every outstanding signed')
      && plain.includes('Re-enabling even the same address')
      && plain.includes('expires seven days after') && plain.includes('late acceptance')
      && plain.includes('fresh nomination'),
    `${name} must make emergency disable a full generation reset and bound nomination acceptance`);
    assert(plain.includes('direct on-chain call') && plain.includes('EIP-712')
      && plain.includes('chain ID') && plain.includes('verifying vault')
      && plain.includes('operator generation') && plain.includes('reason code')
      && plain.includes('nonzero details hash') && plain.includes('exact current global nonce')
      && plain.includes('issuedAt') && plain.includes('deadline')
      && plain.includes('backend') && plain.includes('never') && plain.includes('authority'),
    `${name} must authorize operator outflow only by the current operator with replay-safe typed data`);
    assert(plain.includes('operations') && plain.includes('security')
      && plain.includes('purchase_recovery') && plain.includes('migration_bypass')
      && plain.includes('retirement') && plain.includes('other') && plain.includes('reconciliation_outflow')
      && plain.includes('detailsHash') && plain.includes('immutable')
      && plain.includes('off-chain') && plain.includes('availability')
      && plain.includes('never gates execution'),
    `${name} must give every operator outflow a durable public reason category and content commitment`);
    assert(plain.includes('nextOutflowNonce') && plain.includes('invalidateOutflowNonces')
      && plain.includes('without moving ETH') && plain.includes('strict increase')
      && plain.includes('old/new nonce') && plain.includes('changes no bucket')
      && plain.includes('Direct and relayed') && plain.includes('global counter'),
    `${name} must serialize direct and relayed outflows and permit public nonce invalidation without value movement`);
    assert(plain.includes('relayed authorization is valid only when')
      && plain.includes('issuedAt') && plain.includes('block.timestamp')
      && plain.includes('Future-issued') && plain.includes('expired')
      && plain.includes('zero/reversed') && plain.includes('signatures fail before')
      && plain.includes('Direct') && plain.includes('signature-lifetime window')
      && plain.includes('same nonce'),
    `${name} must limit every relayed operator authorization to a non-future one-hour validity interval`);
    assert(plain.includes('Every operator outflow requires a nonzero recipient')
      && plain.includes('no operator_burn') && plain.includes('zero-address transfer')
      && plain.includes('intentional ETH-burning action') && plain.includes('product scenario')
      && plain.includes('cannot prove') && plain.includes('recoverable')
      && plain.includes('operator trust'),
    `${name} must reject the zero address and expose no protocol ETH-burning path`);
    assert(plain.includes('mainOperator may directly renounce')
      && plain.includes('cannot be relayed') && plain.includes('msg.sender == mainOperator')
      && plain.includes('sets the role to zero') && plain.includes('pending nomination')
      && plain.includes('increments') && plain.includes('invalidates every')
      && plain.includes('moves no ETH') && plain.includes('changes no nonce')
      && plain.includes('names no successor') && plain.includes('orderly handoff')
      && plain.includes('replaceMainOperator'),
    `${name} must distinguish direct zeroing renunciation from instant successor handoff`);
    assert(plain.includes('EOA') && plain.includes('ERC-1271')
      && plain.includes('msg.sender == mainOperator') && plain.includes('ECDSA recovery')
      && plain.includes('isValidSignature') && plain.includes('magic value')
      && plain.includes('Revert') && plain.includes('out-of-gas')
      && plain.includes('malformed') && plain.includes('fails closed')
      && plain.includes('never falls back'),
    `${name} must support EOA and ERC-1271 operators with strict fail-closed signer-type validation`);
    assert(plain.includes('smart-wallet operator identity follows the mainOperator address')
      && plain.includes('pinned runtime code hash') && plain.includes('proxy implementation')
      && plain.includes('owner set') && plain.includes('module set')
      && plain.includes('signature policy') && plain.includes('do not automatically')
      && plain.includes('rotate') && plain.includes('disable') && plain.includes('increment')
      && plain.includes('Every action still validates') && plain.includes('Public monitoring')
      && plain.includes('owner/module/configuration changes')
      && plain.includes('code appearance') && plain.includes('disappearance')
      && plain.includes('last-check time') && plain.includes('warnings without changing authority')
      && plain.includes('zero-disable immediately') && plain.includes('fails closed')
      && plain.includes('Safe restoration'),
    `${name} must attach smart-wallet authority to its address while monitoring mutable wallet behavior`);
    assert(plain.includes('operator_wallet_changed') && plain.includes('operator_wallet_health_unknown')
      && plain.includes('without changing authority or pausing action')
      && plain.includes('relay proceeds when current EOA/ERC-1271 validation succeeds on-chain')
      && plain.includes('zero-disable immediately'),
    `${name} must keep wallet-change and health-unknown states informational while enforcing current on-chain authority`);
    assert(plain.includes('at least every five minutes') && plain.includes('older than ten minutes')
      && plain.includes('Before the server constructs or relays')
      && plain.includes('synchronously attempts a fresh check')
      && plain.includes('last_checked_at') && plain.includes('last_changed_at')
      && plain.includes('last_healthy_at') && plain.includes('failure reason')
      && plain.includes('does not veto') && plain.includes('authoritative')
      && plain.includes('Direct') && plain.includes('never depend on watcher')
      && plain.includes('server') && plain.includes('API availability'),
    `${name} must monitor operator wallets on a five-minute/ten-minute cadence without turning watcher failure into authority`);
    assert(plain.includes('Every operator-role transition carries a public reason code')
      && plain.includes('nonzero detailsHash') && plain.includes('instant replacement')
      && plain.includes('direct renunciation') && plain.includes('Safe zero-disable')
      && plain.includes('Safe nomination') && plain.includes('nomination cancellation')
      && plain.includes('nominee acceptance') && plain.includes('same closed')
      && plain.includes('EIP-712/ERC-1271') && plain.includes('direct/Safe calldata')
      && plain.includes('immutable event') && plain.includes('actor')
      && plain.includes('old/new/pending operator') && plain.includes('generation')
      && plain.includes('transition type') && plain.includes('Missing off-chain explanation text')
      && plain.includes('never blocks') && plain.includes('cannot rewrite'),
    `${name} must bind and disclose a durable reason commitment for every operator-role transition`);
    assert(plain.includes('approved, identified acquisition inflow')
      && plain.includes('forced ETH') && plain.includes('mistaken transfers')
      && plain.includes('unexplained positive balance surplus') && plain.includes('unattributed')
      && plain.includes('syncUnattributed()') && plain.includes('vault.balance - accountedBuckets')
      && plain.includes('may publicly reclassify a specified')
      && plain.includes('reason code') && plain.includes('details hash')
      && plain.includes('reclassification never revives')
      && plain.includes('mainOperator') && plain.includes('operator_outflow')
      && plain.includes('Negative accounting drift') && plain.includes('invariant failure'),
    `${name} must quarantine unexplained ETH from automated buying while preserving Safe reclassification and operator exit`);
    assert(plain.includes('Every purchase reservation has one immutable attempt deadline')
      && plain.includes('two-hour purchase window') && plain.includes('block.timestamp')
      && plain.includes('transaction mined at or after the deadline fails')
      && plain.includes('anyone may permissionlessly and idempotently call')
      && plain.includes('expireIntent(intentId)') && plain.includes('terminal intent_expired')
      && plain.includes('entire remaining reservation')
      && plain.includes('cannot be extended, revived, re-reserved, or executed')
      && plain.includes('no substitute or catch-up') && plain.includes('later purchases')
      && plain.includes('fresh caps and authority'),
    `${name} must expire reservations permissionlessly at immutable deadlines without revival or catch-up`);
    assert(plain.includes('Each closed ballot and exact Stock Token version may create at most one logical purchase intent')
      && plain.includes('intentId = keccak256(abi.encode(chainId, vault, ballotId, assetVersionKey))')
      && plain.includes('permanent lifecycle record') && plain.includes('terminal state')
      && plain.includes('monotonic attemptNonce') && plain.includes('serialized')
      && plain.includes('at most one registered attempt may be live')
      && plain.includes('replacements or retries') && plain.includes('settle canonically')
      && plain.includes('second or parallel intent') && plain.includes('split a ballot')
      && plain.includes('change its asset version') && plain.includes('more than one success')
      && plain.includes('partial-fill finality') && plain.includes('operator cancellation')
      && plain.includes('permanently prevent recreation or further execution')
      && plain.includes('second creation attempt fails') && plain.includes('reservation')
      && plain.includes('bucket') && plain.includes('clock') && plain.includes('history'),
    `${name} must bind each ballot/version to one permanent deterministic intent with serialized attempts`);
    assert(plain.includes('Only the currently Safe-approved RwaStockBuyer may create the intent and reservation')
      && plain.includes('one atomic transaction') && plain.includes('finalized closed ballot')
      && plain.includes('deterministic intent ID') && plain.includes('exact active and healthy Stock Token version')
      && plain.includes('zero accounting deficit') && plain.includes('sufficient unreserved available ETH')
      && plain.includes('per-buy/daily/rolling/concentration caps')
      && plain.includes('approved adapter and current code identity')
      && plain.includes('fresh independent oracle and deviation wall')
      && plain.includes('still-future immutable deadline')
      && plain.includes('after every check succeeds') && plain.includes('persist the intent')
      && plain.includes('reserve ETH') && plain.includes('initialize attempts')
      && plain.includes('consume the next accountingSequence')
      && plain.includes('failed check or competing creation reverts completely')
      && plain.includes('no intent or tombstone') && plain.includes('reservation')
      && plain.includes('bucket change') && plain.includes('attempt nonce')
      && plain.includes('sequence consumption') && plain.includes('tried again')
      && plain.includes('same unchanged deadline') && plain.includes('buyer approval bypasses none'),
    `${name} must create and consume an intent only after every authority and value wall succeeds atomically`);
    assert(plain.includes('After creation, any address may call executeIntent(intentId) before the deadline')
      && plain.includes('no caller-chosen asset') && plain.includes('recipient')
      && plain.includes('input ceiling') && plain.includes('adapter')
      && plain.includes('oracle/deviation limit') && plain.includes('output destination')
      && plain.includes('stored intent') && plain.includes('current approved registry state')
      && plain.includes('revalidates activity') && plain.includes('health')
      && plain.includes('deficit') && plain.includes('reservation') && plain.includes('caps')
      && plain.includes('adapter/code identity') && plain.includes('fresh oracle/deviation')
      && plain.includes('time at inclusion') && plain.includes('execution timing only inside')
      && plain.includes('pays its own network gas') && plain.includes('receives no fee')
      && plain.includes('rebate') && plain.includes('refund') && plain.includes('Stock Token')
      && plain.includes('approval') && plain.includes('economic benefit')
      && plain.includes('All output goes to StockVault')
      && plain.includes('unused or returned ETH goes to RwaAcquisitionVault')
      && plain.includes('cannot create, edit, cancel, reserve for, or redirect')
      && plain.includes('atomic and reentrancy-protected')
      && plain.includes('first valid canonical execution wins')
      && plain.includes('revert without accounting mutation or sequence consumption'),
    `${name} must make fully bound intent execution permissionless without caller compensation or redirect authority`);
    assert(plain.includes('The Safe or current mainOperator may immediately call')
      && plain.includes('cancelIntent(intentId, reasonCode, detailsHash)')
      && plain.includes('active intent without transferring ETH')
      && plain.includes('existing closed reason taxonomy') && plain.includes('nonzero details hash')
      && plain.includes('terminal intent_cancelled')
      && plain.includes('complete remaining reservation') && plain.includes('available acquisition ETH')
      && plain.includes('consumes the next accountingSequence')
      && plain.includes('immutable record') && plain.includes('actor and authority')
      && plain.includes('reason/details') && plain.includes('released amount')
      && plain.includes('intent/attempt state') && plain.includes('complete pre/post accounting')
      && plain.includes('cannot revive') && plain.includes('substitute') && plain.includes('extend')
      && plain.includes('replay') && plain.includes('split') && plain.includes('re-reserve')
      && plain.includes('allocate') && plain.includes('catch-up')
      && plain.includes('does not rewrite the ballot') && plain.includes('prior attempts')
      && plain.includes('deposit history') && plain.includes('Canonical inclusion order decides')
      && plain.includes('cancellation versus execution') && plain.includes('expiry')
      && plain.includes('refund') && plain.includes('operator outflow')
      && plain.includes('first valid transition wins') && plain.includes('later incompatible calls fail')
      && plain.includes('abort a planned RWA purchase') && plain.includes('no ETH leaves the vault'),
    `${name} must let Safe or current main operator cancel a specific intent publicly without moving ETH`);
    assert(plain.includes('Pre-adapter validation failures revert without consuming attemptNonce')
      && plain.includes('Once execution actually invokes the approved adapter')
      && plain.includes('consumes the next nonce') && plain.includes('immutable public result')
      && plain.includes('revert, false return, or zero Stock Token output')
      && plain.includes('retryable attempt_failed') && plain.includes('canonical pre/post vault and custody balances')
      && plain.includes('zero ETH debit') && plain.includes('zero Stock Token output')
      && plain.includes('intent and reservation') && plain.includes('sequential retry before the same deadline')
      && plain.includes('nonzero or unexplained ETH debit') && plain.includes('refund')
      && plain.includes('token receipt') && plain.includes('custody delta')
      && plain.includes('attempt_reconciliation') && plain.includes('blocks another execution or final settlement')
      && plain.includes('explicit public reconciliation') && plain.includes('consumed nonce and result')
      && plain.includes('never be erased or overwritten'),
    `${name} must permanently record adapter-level outcomes and quarantine unexplained value deltas`);
    assert(plain.includes('Only the Safe may finalize an attempt_reconciliation')
      && plain.includes('classify its value effects') && plain.includes('release quarantined ETH')
      && plain.includes('declare the attempt reconciled') && plain.includes('current mainOperator may append evidence')
      && plain.includes('proposed disposition') && plain.includes('submission is informational')
      && plain.includes('cannot alter buckets') && plain.includes('custody facts')
      && plain.includes('terminal state') && plain.includes('accountingSequence')
      && plain.includes('cannot authorize') && plain.includes('relayer to finalize')
      && plain.includes('exact intent') && plain.includes('consumed attempt nonce')
      && plain.includes('public reason code') && plain.includes('nonzero details-hash commitment'),
    `${name} must reserve attempt-reconciliation finality and value release exclusively to Safe`);
    assert(plain.includes('Safe reconciliation publishes') && plain.includes('actual ETH debit')
      && plain.includes('cumulative verified refund') && plain.includes('Stock Token custody delta')
      && plain.includes('canonical transaction provenance') && plain.includes('resulting disposition')
      && plain.includes('complete pre/post balance') && plain.includes('buckets')
      && plain.includes('deficit') && plain.includes('intent state')
      && plain.includes('consumes the next accountingSequence')
      && plain.includes('positive valid Stock Token custody delta')
      && plain.includes('final fill at the actual received amount')
      && plain.includes('Only those units may be allocated') && plain.includes('no top-up')
      && plain.includes('second fill') && plain.includes('substitute purchase') && plain.includes('catch-up')
      && plain.includes('Zero or invalid custody output cannot be represented as acquired stock')
      && plain.includes('unexplained residual value remains quarantined'),
    `${name} must reconcile exact canonical value facts and treat any valid positive custody delta as final`);
    assert(plain.includes('cancellation or the immutable deadline arrives during reconciliation')
      && plain.includes('intent becomes terminal for execution immediately')
      && plain.includes('Proven unaffected value releases normally')
      && plain.includes('unresolved portion moves from the reservation')
      && plain.includes('nonspendable reconciliation_pending bucket')
      && plain.includes('cannot fund another reservation')
      && plain.includes('Only later Safe reconciliation may release the amount proven unspent')
      && plain.includes('actual debit') && plain.includes('refund') && plain.includes('output')
      && plain.includes('canonical evidence') && plain.includes('may revive the intent')
      && plain.includes('retry it') && plain.includes('replace its purchase')
      && plain.includes('provide a substitute') && plain.includes('catch-up authority'),
    `${name} must terminate execution while quarantining unresolved value until Safe reconciliation`);
    assert(plain.includes('derives or strictly caps every reconcilable ETH debit')
      && plain.includes('verified refund') && plain.includes('Stock Token output')
      && plain.includes('immutable pre-adapter balance snapshots')
      && plain.includes('current canonical RwaAcquisitionVault and StockVault balances')
      && plain.includes('already-recorded canonical refund and provenance records')
      && plain.includes('Safe chooses the disposition') && plain.includes('commits reason, details, and evidence')
      && plain.includes('cannot override those observations') && plain.includes('over-credit output or refund')
      && plain.includes('hide debit') && plain.includes('enter unsupported value')
      && plain.includes('inconsistent reconciliation reverts before')
      && plain.includes('bucket') && plain.includes('intent') && plain.includes('allocation')
      && plain.includes('accountingSequence') && plain.includes('custody-state mutation'),
    `${name} must contract-bound reconciliation values rather than grant Safe arbitrary accounting writes`);
    assert(plain.includes('reconciliation_pending has no timeout') && plain.includes('abandonment path')
      && plain.includes('presumed outcome') && plain.includes('automatic release')
      && plain.includes('Passage of time') && plain.includes('deadline age')
      && plain.includes('Safe inactivity') && plain.includes('unavailable signers')
      && plain.includes('missing off-chain evidence') && plain.includes('never turns uncertainty into available ETH')
      && plain.includes('amount and') && plain.includes('age remain public indefinitely')
      && plain.includes('valid contract-bounded reconciliation')
      && plain.includes('Safe signer recovery and incident escalation provide liveness')
      && plain.includes('accounting never guesses'),
    `${name} must preserve uncertain value indefinitely rather than convert time or signer loss into spend authority`);
    assert(plain.includes('current mainOperator nevertheless retains raw operator_outflow authority')
      && plain.includes('actual ETH accounted in reconciliation_pending')
      && plain.includes('unilateral sweep power') && plain.includes('cannot finalize or classify reconciliation')
      && plain.includes('release value into available ETH') && plain.includes('erase or reduce the unresolved liability')
      && plain.includes('represent missing ETH as reconciled')
      && plain.includes('normal outflow nonce') && plain.includes('accountingSequence')
      && plain.includes('publicly debits backed quarantine') && plain.includes('affected reconciliation records')
      && plain.includes('complete pre/post balance') && plain.includes('quarantine')
      && plain.includes('liability') && plain.includes('deficit')
      && plain.includes('resulting unbacked liability remains an explicit accounting deficit')
      && plain.includes('automation pause and repair rules')
      && plain.includes('canonical evidence and actual funding resolve it'),
    `${name} must preserve operator sweep authority without letting custody movement erase reconciliation liability`);
    assert(plain.includes('Each reconciliation attempt and the vault-wide aggregate separately expose')
      && plain.includes('reconciliationLiability') && plain.includes('backedQuarantineEth')
      && plain.includes('reconciliationShortfall')
      && plain.includes('reconciliationLiability = backedQuarantineEth + reconciliationShortfall')
      && plain.includes('Any positive shortfall joins vault-wide accountingDeficit')
      && plain.includes('globally pauses new intent creation and execution')
      && plain.includes('authorized outflow remain live')
      && plain.includes('hide under-collateralization'),
    `${name} must expose exact reconciliation solvency and join every shortfall to the global deficit pause`);
    assert(plain.includes('greatest backedQuarantineEth first')
      && plain.includes('oldest reconciliationStartedAt') && plain.includes('lowest intent ID')
      && plain.includes('fully debiting records before at most one partial debit')
      && plain.includes('Generic canonical repair funding uses one unified deficit-component queue')
      && plain.includes('firstObservedAt') && plain.includes('shortfallCreatedAt')
      && plain.includes('numeric componentTypeCode') && plain.includes('record ID')
      && plain.includes('fully repairing components before at most one partial repair')
      && plain.includes('exact canonical late refund overrides the generic queue')
      && plain.includes('repairs its own attempt first')
      && plain.includes('Contract-controlled bounded priority indexes')
      && plain.includes('caller-supplied sort proofs') && plain.includes('unbounded historical scans')
      && plain.includes('cannot choose a bucket or record')
      && plain.includes('pre/post liability') && plain.includes('backing')
      && plain.includes('shortfall') && plain.includes('deficit') && plain.includes('sequence'),
    `${name} must deterministically index quarantine debits and one unified generic deficit-repair queue`);
    assert(plain.includes('Safe may finalize') && plain.includes('factual')
      && plain.includes('contract-bounded reconciliation') && plain.includes('ETH proven unspent is absent')
      && plain.includes('durable terminal reconciled_shortfall')
      && plain.includes('no available ETH is fabricated') && plain.includes('no liability is erased')
      && plain.includes('intent closes permanently') && plain.includes('without revival')
      && plain.includes('retry') && plain.includes('replacement') && plain.includes('substitute')
      && plain.includes('catch-up') && plain.includes('append-only')
      && plain.includes('actual funding repairs'),
    `${name} must close factual underfunded reconciliation without fabricating spendable value`);
    assert(plain.includes('real repair ETH reaches a Safe-finalized reconciled_shortfall')
      && plain.includes('immutable disposition proves the ETH was unspent')
      && plain.includes('same atomic entry reduces that record')
      && plain.includes('shortfall and liability')
      && plain.includes('credits exactly the repaired amount to available acquisition ETH')
      && plain.includes('no second Safe action') && plain.includes('never reopens or edits the intent')
      && plain.includes('capped at the exact missing principal')
      && plain.includes('no interest') && plain.includes('penalty')
      && plain.includes('opportunity-cost compensation') && plain.includes('damages')
      && plain.includes('yield') && plain.includes('extra credit')
      && plain.includes('still-unresolved reconciliation restores backing without creating available ETH'),
    `${name} must release only real repaired principal under an already-finalized proven-unspent disposition`);
    assert(plain.includes('canonical refund received after terminal or final reconciliation')
      && plain.includes('first repairs the exact attempt') && plain.includes('reconciliationShortfall')
      && plain.includes('remainder not required for') && plain.includes('terminal-refund classification')
      && plain.includes('value above proven debit is unattributed')
      && plain.includes('never reopens') && plain.includes('edits') && plain.includes('catch-up')
      && plain.includes('Stock Tokens received after terminal or final reconciliation')
      && plain.includes('unattributed_stock quarantine') && plain.includes('exact token address')
      && plain.includes('immutable asset version') && plain.includes('canonical transaction provenance')
      && plain.includes('Safe may only continue holding the exact stock')
      && plain.includes('fixed Safe-approved recovery vault')
      && plain.includes('Safe-approved recovery adapter')
      && plain.includes('cannot choose an arbitrary recipient') && plain.includes('retroactively allocate')
      && plain.includes('substitute an asset') && plain.includes('old intent or allocation')
      && plain.includes('excluded from distributable inventory') && plain.includes('player allocations')
      && plain.includes('fulfilled-acquisition totals') && plain.includes('included in gross custody')
      && plain.includes('concentration-risk reporting') && plain.includes('exact-version exposure cap'),
    `${name} must repair exact late refunds first and confine late stock while counting its custody risk`);
    assert(plain.includes('outflow that debits reconciliation backing must use reconciliation_outflow')
      && plain.includes('generic reason is rejected')
      && plain.includes('dedicated code is rejected when no reconciliation backing is touched')
      && plain.includes('cannot choose the accounting bucket or reconciliation record'),
    `${name} must reserve a dedicated reason for quarantine-touching operator outflow`);
    assert(plain.includes('positive reconciliation shortfall or operator debit of reconciliation backing')
      && plain.includes('immediate critical alert') && plain.includes('persistent red incident state')
      && plain.includes('aggregate and per-record liabilities') && plain.includes('backing')
      && plain.includes('shortfall') && plain.includes('age')
      && plain.includes('affected intent and attempt IDs') && plain.includes('last quarantine outflow')
      && plain.includes('vault deficit') && plain.includes('purchase-pause state')
      && plain.includes('Every zero-to-positive transition creates a new immutable incidentId')
      && plain.includes('alerts, acknowledgments, outflows, repairs, and reconciliation actions append')
      && plain.includes('closes only after finalized canonical zero is synchronized into the mirror')
      && plain.includes('later recurrence creates a new ID')
      && plain.includes('Safe or current mainOperator may submit a signed public acknowledgment')
      && plain.includes('exact incidentId') && plain.includes('current operator generation')
      && plain.includes('Acknowledgment may silence duplicate notifications only')
      && plain.includes('cannot clear') && plain.includes('downgrade') && plain.includes('conceal')
      && plain.includes('resolve') && plain.includes('unpause') && plain.includes('financial state'),
    `${name} must give each reconciliation incident an immutable generation and notification-only acknowledgment`);
    assert(plain.includes('reconciliation shortfall or acquisition accounting deficit pauses new purchase-intent')
      && plain.includes('does not pause delivery of Stock Tokens already acquired and allocated')
      && plain.includes('exact StockVault custody') && plain.includes('every delivery invariant remain healthy')
      && plain.includes('Asset quarantine') && plain.includes('custody mismatch')
      && plain.includes('delivery hold') && plain.includes('insufficient delivery gas')
      && plain.includes('fee ceiling') && plain.includes('stale token health')
      && plain.includes('independent delivery wall')
      && plain.includes('creates no new allocation or purchase'),
    `${name} must isolate the acquisition deficit pause from healthy delivery of already-owed stock`);
    assert(plain.includes('canonical RWA accounting mirror is more than ten minutes stale')
      && plain.includes('cannot prove finalized accountingSequence continuity')
      && plain.includes('operator UI remains red') && plain.includes('incident_state_unknown_stale')
      && plain.includes('never renders green') && plain.includes('disables new risk-creating purchase controls')
      && plain.includes('recovery funding') && plain.includes('reconciliation')
      && plain.includes('cancellation') && plain.includes('expiry')
      && plain.includes('otherwise-authorized operator outflow controls available')
      && plain.includes('neither invents an on-chain incident nor resolves a real one'),
    `${name} must fail the incident UI red when its finalized accounting mirror is stale or discontinuous`);
    assert(plain.includes('Canonical ETH recovered by redeeming or liquidating unattributed_stock')
      && plain.includes('first repairs the exact originating attempt')
      && plain.includes('Any remaining ETH enters the unattributed bucket')
      && plain.includes('does not automatically become available')
      && plain.includes('allocate to the historical cohort') && plain.includes('reopen the old intent')
      && plain.includes('substitute or catch-up') && plain.includes('immutable recovery record')
      && plain.includes('late-stock provenance') && plain.includes('input units')
      && plain.includes('actual ETH output') && plain.includes('exact shortfall repair')
      && plain.includes('remainder classification') && plain.includes('pre/post stock and ETH accounting'),
    `${name} must causally repair the originating shortfall and quarantine excess late-stock recovery proceeds`);
    assert(plain.includes('exactly one active Stock Token recovery-vault version')
      && plain.includes('bound to chain, address, runtime code hash')
      && plain.includes('proxy') && plain.includes('implementation address and code hash')
      && plain.includes('Safe rotation is publicly proposed at least 48 hours before execution')
      && plain.includes('atomically replaces the old version with the new one')
      && plain.includes('Continued quarantine is the emergency fallback')
      && plain.includes('no immediate redirection bypass'),
    `${name} must code-pin one delayed recovery vault without an emergency redirect bypass`);
    assert(plain.includes('Each recovery adapter is Safe-approved by exact address and runtime code hash')
      && plain.includes('one exact input token/version') && plain.includes('canonical ETH output path')
      && plain.includes('fresh independent price') && plain.includes('minEthOut')
      && plain.includes('maximum slippage') && plain.includes('immutable deadline')
      && plain.includes('fixed route') && plain.includes('no arbitrary calldata')
      && plain.includes('caller-selected path') && plain.includes('delegatecall')
      && plain.includes('persistent approval') && plain.includes('residual token authority')
      && plain.includes('Recovery succeeds only when canonical ETH is atomically received by the acquisition vault')
      && plain.includes('intermediate assets remain inside the adapter')
      && plain.includes('Unexpected ERC-20 output receives no recovery credit')
      && plain.includes('exact-token/provenance unattributed_stock quarantine'),
    `${name} must confine exact-stock recovery to fresh-price-bound atomic canonical ETH output`);
    assert(plain.includes('For custody risk, concentration reporting')
      && plain.includes('every applicable exact-version exposure wall')
      && plain.includes('greater of its latest fresh independent-oracle market value')
      && plain.includes('last valid acquisition price')
      && plain.includes('If neither value exists or is usable')
      && plain.includes('new purchases of that exact version remain blocked')
      && plain.includes('valuation becomes available'),
    `${name} must conservatively value quarantined stock and block unpriceable exact-version purchases`);
    assert(plain.includes('unique, immutable, domain-separated recoveryId')
      && plain.includes('active recovery-vault address/version/runtime code hash')
      && plain.includes('proxy implementation') && plain.includes('exact quarantine record and provenance')
      && plain.includes('Stock Token version') && plain.includes('exact input units')
      && plain.includes('adapter/code identity') && plain.includes('canonical acquisition-vault destination')
      && plain.includes('independent-oracle observation') && plain.includes('minEthOut')
      && plain.includes('Safe authorization generation/nonce') && plain.includes('issue time')
      && plain.includes('earlier of one hour after Safe approval and the oracle-validity deadline')
      && plain.includes('new one-use ID') && plain.includes('rechecks every pinned identity')
      && plain.includes('fresh independent price') && plain.includes('stricter')
      && plain.includes('execution-time oracle floor'),
    `${name} must make each recovery authorization fully bound, one-use, code-pinned, and price-fresh for at most one hour`);
    assert(plain.includes('multiple monotonic partial tranches') && plain.includes('separate authorized recoveryId')
      && plain.includes('exact units') && plain.includes('remainingUnits') && plain.includes('resolves only at zero')
      && plain.includes('arbitrary Stock Token sweep') && plain.includes('Direct transfer is preferred')
      && plain.includes('approval') && plain.includes('exact units immediately before use')
      && plain.includes('reset to zero atomically') && plain.includes('executeRecovery(recoveryId)')
      && plain.includes('no payload or discretion') && plain.includes('no reward or refund')
      && plain.includes('separately accounted operations wallet')
      && plain.includes('recovery gas never reduces recovery credit')
      && plain.includes('acquisition backing') && plain.includes('allocations') && plain.includes('player value'),
    `${name} must permit exact partial recovery without a sweep, standing allowance, executor discretion, or value-funded gas`);
    assert(plain.includes('Permissionless execution does not permit permissionless creation or enqueueing')
      && plain.includes('constant-time exact-ID lookup') && plain.includes('positive units')
      && plain.includes('active, unexpired, uncancelled, unconsumed authorization')
      && plain.includes('rechecks vault, token, adapter, oracle') && plain.includes('proxy code identity')
      && plain.includes('exact pre/post Stock Token') && plain.includes('canonical-ETH balance deltas')
      && plain.includes('checked arithmetic') && plain.includes('nonReentrant')
      && plain.includes('checks-effects-interactions') && plain.includes('atomic rollback')
      && plain.includes('no attacker-sized loop or scan') && plain.includes('dynamic route')
      && plain.includes('caller callback') && plain.includes('caller-selected external call')
      && plain.includes('duplicate') && plain.includes('losing-race calls create no canonical event')
      && plain.includes('incident entry') && plain.includes('alert') && plain.includes('storage growth')
      && plain.includes('caller alone pays') && plain.includes('same-ID front-run')
      && plain.includes('identical approved action') && plain.includes('MEV-protected submission is preferred')
      && plain.includes('not a trusted control') && plain.includes('separately code-pinned adapter')
      && plain.includes('adversarial balance-delta tests') && plain.includes('unrelated versions')
      && plain.includes('Safe or current mainOperator may pause recovery immediately')
      && plain.includes('only the Safe may resume') && plain.includes('cannot redirect stock')
      && plain.includes('consume authorization') && plain.includes('credit recovery'),
    `${name} must make blackhat recovery spam self-funded, constant-time, non-reentrant, non-amplifying, and non-discretionary`);
    assert(plain.includes('Successful recovery transitions publish structured canonical IDs')
      && plain.includes('transaction hashes') && plain.includes('blocker changes')
      && plain.includes('code identities') && plain.includes('finality')
      && plain.includes('restricted evidence remains off-chain under an immutable content hash')
      && plain.includes('Provisional and finalized streams are separate')
      && plain.includes('finalized is the default accounting, UI, and export authority')
      && plain.includes('Canonical history is retained permanently')
      && plain.includes('complete cursor-based exports') && plain.includes('checksum-addressed')
      && plain.includes('Anonymous incident and recovery APIs are read-only')
      && plain.includes('strict cursor validation') && plain.includes('fixed maximum page and body size')
      && plain.includes('cheap indexed lookup') && plain.includes('quotas') && plain.includes('caching')
      && plain.includes('content-addressed precomputed exports') && plain.includes('Invalid cursors')
      && plain.includes('rejected executions') && plain.includes('cannot cause unbounded scans')
      && plain.includes('canonical writes') && plain.includes('export regeneration')
      && plain.includes('incident amplification') && plain.includes('retention-bounded separately'),
    `${name} must expose permanent finalized recovery evidence through bounded read-only anti-amplification APIs`);
    assert(plain.includes('Quarantine and indefinite hold are the complete launch behavior')
      && plain.includes('Recovery is optional') && plain.includes('real material quarantined balance')
      && plain.includes('not an ordinary RWA-launch blocker')
      && plain.includes('recovery remains unavailable and every recovery mutation control remains disabled')
      && plain.includes('exact production vault/adapter/oracle/API implementation and deployment manifest')
      && plain.includes('contract unit tests') && plain.includes('stateful fuzz/invariant tests')
      && plain.includes('malicious-token/adapter/oracle/receiver and reentrancy tests')
      && plain.includes('forked-route slippage/MEV/reorg tests')
      && plain.includes('API authorization/idempotency/concurrency/body-limit/cursor/export/load/denial-of-service tests')
      && plain.includes('independent third-party review of the exact source and bytecode')
      && plain.includes('critical or high finding must be fixed')
      && plain.includes('remaining finding publicly dispositioned')
      && plain.includes('chain, addresses, compiler settings, source commit')
      && plain.includes('runtime and implementation code hashes')
      && plain.includes('adapter') && plain.includes('oracle identities')
      && plain.includes('test reports') && plain.includes('audit artifact hashes')
      && plain.includes('material contract, proxy, adapter, oracle, authorization, accounting, or write-route change')
      && plain.includes('resets the applicable gate')
      && plain.includes('No placeholder generic executor or recovery write endpoint may ship'),
    `${name} must default to hold-only quarantine and conditionally gate any later recovery implementation`);
    assert(plain.includes('If recovery is built, the Safe records every authorization on-chain')
      && plain.includes('Proxy vaults and adapters remain permitted')
      && plain.includes('no non-upgradeable requirement')
      && plain.includes('exact proxy and implementation identities stay pinned and rechecked')
      && plain.includes('Safe-set hard caps limit each tranche')
      && plain.includes('each Stock Token version over rolling 24 hours')
      && plain.includes('all recovery over rolling 24 hours')
      && plain.includes('no operator bypass over Stock Token recovery')
      && plain.includes('main operator') && plain.includes('ETH after canonical receipt is unchanged')
      && plain.includes('Two fresh independent price sources')
      && plain.includes('more conservative output floor') && plain.includes('500 basis points fails closed')
      && plain.includes('V1 accepts only conventional balance-delta ERC-20 behavior')
      && plain.includes('zero attributable token or ETH residue and zero allowance')
      && plain.includes('forced unsolicited dust receives no recovery credit')
      && plain.includes('Public APIs return unsigned calldata')
      && plain.includes('never sponsor or relay anonymous gas')
      && plain.includes('Canonical history derives only from finalized events emitted by pinned contracts')
      && plain.includes('Failed, duplicate, or malformed spam')
      && plain.includes('cannot automatically pause recovery')
      && plain.includes('open a financial incident') && plain.includes('write canonical history')
      && plain.includes('vulnerability-disclosure or bounty channel')
      && plain.includes('independently monitors code identity')
      && plain.includes('balances') && plain.includes('allowances') && plain.includes('oracle divergence')
      && plain.includes('recovery rate') && plain.includes('sequence gaps')
      && plain.includes('rehearses pause, cancellation, and rotation')
      && plain.includes('conditional safety constraints')
      && plain.includes('not a reason to build a recovery subsystem before it is needed'),
    `${name} must keep the optional recovery edge path minimal while preserving the final approved security walls`);
    assert(plain.includes('reconciliation incident closes only when finalized canonical state simultaneously proves')
      && plain.includes('reconciliationShortfall == 0') && plain.includes('accountingDeficit == 0')
      && plain.includes('every affected record') && plain.includes('liability/backing invariant')
      && plain.includes('continuous accountingSequence') && plain.includes('synchronized public-mirror state')
      && plain.includes('Acknowledgments do not affect closure'),
    `${name} must close incidents only on finalized record-level, aggregate, sequence, and mirror proof`);
    assert(plain.includes('Purchase blocking uses independent composable reasons')
      && plain.includes('manual Safe/operator pause') && plain.includes('reconciliation deficit')
      && plain.includes('stale accounting mirror') && plain.includes('token quarantine')
      && plain.includes('oracle failure') && plain.includes('exposure cap')
      && plain.includes('Clearing one reason removes only that blocker')
      && plain.includes('Purchases resume only when no applicable blocker remains')
      && plain.includes('automatic deficit clearance never clears a manual or unrelated pause'),
    `${name} must compose purchase blockers without letting one clearance overwrite another`);
    assert(plain.includes('contract-maintained debit or repair priority index disagrees with immutable records')
      && plain.includes('new purchases pause')
      && plain.includes('anyone may rebuild the index deterministically in bounded chunks')
      && plain.includes('completed root must equal the root derived from immutable records')
      && plain.includes('Safe and operator cannot choose order')
      && plain.includes('dependent mutations remain unavailable until the rebuild proves complete'),
    `${name} must provide permissionless deterministic index recovery without privileged reordering`);
    assert(plain.includes('Every operator outflow or generic repair supplies a public positive maxComponents')
      && plain.includes('complete requested transfer or repair')
      && plain.includes('processable within that bound')
      && plain.includes('transaction reverts before any mutation or ETH transfer')
      && plain.includes('split across sequential transactions')
      && plain.includes('preserving the same deterministic order'),
    `${name} must bound multi-record financial mutations without allowing partially accounted transfers`);
    assert(plain.includes('Public incident history uses an immutable cursor ordered by accountingSequence')
      && plain.includes('componentIndex') && plain.includes('stable event ID')
      && plain.includes('Offset pagination') && plain.includes('mutable latest-first authority are forbidden')
      && plain.includes('UI defaults to the active or most recent incident')
      && plain.includes('complete export of every generation')
      && plain.includes('cursor continuity') && plain.includes('canonical reorg/finality status'),
    `${name} must expose stable canonical incident pagination and complete generation export`);
    assert(plain.includes('mainOperator may cancel directly or authorize a relayer through EIP-712/ERC-1271')
      && plain.includes('binds action, chain, vault, operator generation, exact intent ID')
      && plain.includes('reason code') && plain.includes('nonzero details hash')
      && plain.includes('exact nextIntentCancelNonce') && plain.includes('issuedAt') && plain.includes('deadline')
      && plain.includes('lifetime is at most one hour') && plain.includes('future issue time is invalid')
      && plain.includes('direct and relayed operator cancellations consume the same monotonic cancellation nonce')
      && plain.includes('independently of nextOutflowNonce')
      && plain.includes('Safe cancellation consumes neither operator nonce')
      && plain.includes('older-generation cancellation signature'),
    `${name} must isolate direct and relayed intent cancellation behind its own one-hour nonce lane`);
    assert(plain.includes('Safe or current mainOperator may immediately pause new intent creation and execution')
      && plain.includes('closed public reason code') && plain.includes('nonzero details hash')
      && plain.includes('only the Safe may unpause') && plain.includes('Canonical deposits')
      && plain.includes('deficit repair') && plain.includes('matched refunds') && plain.includes('reconciliation')
      && plain.includes('permissionless expiry') && plain.includes('explicit cancellation')
      && plain.includes('otherwise-authorized operator outflows remain available')
      && plain.includes('deadlines continue') && plain.includes('without extension')
      && plain.includes('tolling') && plain.includes('revival') && plain.includes('substitute')
      && plain.includes('catch-up') && plain.includes('normal expiry and cancellation rules')
      && plain.includes('actor, authority, operator generation, reason/details, and inclusion time'),
    `${name} must let Safe/operator stop new purchase risk while reserving resume to Safe and preserving recovery`);
    assert(plain.includes('exact intent') && plain.includes('approved attempt')
      && plain.includes('adapter or sender') && plain.includes('canonical transaction provenance')
      && plain.includes('Cumulative matched refund cannot exceed')
      && plain.includes('actual debited ETH') && plain.includes('intent is active')
      && plain.includes('remaining reserved capacity') && plain.includes('original bound')
      && plain.includes('retry before the unchanged deadline')
      && plain.includes('After cancellation') && plain.includes('intent_expired')
      && plain.includes('successful finalization') && plain.includes('terminal state')
      && plain.includes('available acquisition ETH') && plain.includes('never reopens')
      && plain.includes('Unknown-intent') && plain.includes('unprovable-sender/provenance')
      && plain.includes('above-debit excess refunds') && plain.includes('unattributed')
      && plain.includes('Every receipt publishes') && plain.includes('cumulative debit/refund')
      && plain.includes('pre/post buckets'),
    `${name} must classify active, late-terminal, unmatched, and excess refunds by exact provenance`);
    assert(plain.includes('Only a currently Safe-approved acquisition ingress contract')
      && plain.includes('canonical acquisition ETH') && plain.includes('positive deposit')
      && plain.includes('depositId = keccak256(abi.encode(chainId, sourceContract, externalPaymentReferenceHash))')
      && plain.includes('nonzero external reference') && plain.includes('msg.value')
      && plain.includes('duplicate ID') && plain.includes('reverts') && plain.includes('double-crediting')
      && plain.includes('Success credits available ETH') && plain.includes('approval version')
      && plain.includes('pre/post buckets') && plain.includes('public and forward-only')
      && plain.includes('Direct receipt') && plain.includes('unapproved source')
      && plain.includes('forced ETH') && plain.includes('unattributed')
      && plain.includes('canonical identity') && plain.includes('later sync'),
    `${name} must admit canonical acquisition ETH only through unique Safe-approved source references`);
    assert(plain.includes('Each Safe ingress approval binds')
      && plain.includes('exact chain') && plain.includes('source address')
      && plain.includes('source runtime code hash') && plain.includes('approval version')
      && plain.includes('proxy') && plain.includes('resolved implementation address')
      && plain.includes('implementation runtime code hash')
      && plain.includes('revalidates every') && plain.includes('before consuming a deposit ID')
      && plain.includes('fresh public Safe approval version') && plain.includes('mismatch reverts')
      && plain.includes('Plain or forced ETH') && plain.includes('unattributed')
      && plain.includes('forward-only') && plain.includes('canonical history')
      && plain.includes('deposit IDs') && plain.includes('consumed forever'),
    `${name} must bind canonical ingress approval to exact address and code identity without rewriting history`);
    assert(plain.includes('Each acquisition vault has at most one active canonical ingress approval version')
      && plain.includes('exact version or the disabled/zero state')
      && plain.includes('Safe rotation atomically deactivates the old version and activates the new one')
      && plain.includes('no overlap') && plain.includes('grace period')
      && plain.includes('dual-source window') && plain.includes('active when its transaction is included')
      && plain.includes('Broadcast or mempool time grants no grandfathering')
      && plain.includes('old-version call included after rotation reverts')
      && plain.includes('before accepting ETH') && plain.includes('consuming its deposit ID')
      && plain.includes('changing accounting') && plain.includes('Plain or forced ETH')
      && plain.includes('unattributed') && plain.includes('Canonical chain order')
      && plain.includes('same-block rotation/deposit races') && plain.includes('prior accepted deposits')
      && plain.includes('consumed IDs') && plain.includes('approval history remain unchanged'),
    `${name} must maintain one inclusion-time canonical ingress version without overlap or historical rewrite`);
    assert(plain.includes('During a positive accounting deficit')
      && plain.includes('canonical deposit consumes its deposit ID once')
      && plain.includes('deficitRepairAmount = min(msg.value, deficitBefore)')
      && plain.includes('availableCreditAmount = msg.value - deficitRepairAmount')
      && plain.includes('without crediting a bucket')
      && plain.includes('only the available-credit remainder')
      && plain.includes('immutable deposit record') && plain.includes('total')
      && plain.includes('both portions') && plain.includes('deficit before/after')
      && plain.includes('approval version') && plain.includes('pre/post buckets')
      && plain.includes('repair-only deposit') && plain.includes('canonical provenance')
      && plain.includes('zero spendable ETH') && plain.includes('full msg.value')
      && plain.includes('available'),
    `${name} must consume each canonical deposit once and expose the exact deficit-repair/available split`);
    assert(plain.includes('Safe may immediately call reclassifyUnattributed')
      && plain.includes('positive amount no greater than')
      && plain.includes('only move is unattributed -> available')
      && plain.includes('transfers no ETH') && plain.includes('creates no reservation')
      && plain.includes('targets no ballot') && plain.includes('revives nothing')
      && plain.includes('bypasses no cap') && plain.includes('oracle')
      && plain.includes('adapter') && plain.includes('deadline')
      && plain.includes('never books a purchase') && plain.includes('immutable')
      && plain.includes('non-deletable') && plain.includes('non-reversible')
      && plain.includes('valid purchase') && plain.includes('operator_outflow'),
    `${name} must limit immediate Safe reclassification to an immutable accounting-only unattributed-to-available move`);
    assert(plain.includes('If accounted buckets exceed actual vault balance')
      && plain.includes('accounting_deficit = accountedBuckets - vault.balance')
      && plain.includes('first-observed block/time') && plain.includes('cause')
      && plain.includes('last reconciliation') && plain.includes('pre/post figures')
      && plain.includes('blocks automated buying') && plain.includes('new reservations')
      && plain.includes('Safe reclassification') && plain.includes('canonical migration')
      && plain.includes('expiry') && plain.includes('cancellation')
      && plain.includes('refund reconciliation') && plain.includes('Every incoming wei first repairs')
      && plain.includes('actual balance') && plain.includes('without') && plain.includes('bucket')
      && plain.includes('mainOperator may still withdraw') && plain.includes('actual remaining ETH')
      && plain.includes('available') && plain.includes('unattributed') && plain.includes('reserved')
      && plain.includes('deficit before/after') && plain.includes('balance and')
      && plain.includes('buckets fall together')
      && (plain.includes('zero-deficit reconciliation')
        || (plain.includes('public reconciliation') && plain.includes('proves zero')))
      && plain.includes('No role') && plain.includes('silently haircut or erase')
      && plain.includes('bucket or deficit'),
    `${name} must halt automation on accounting deficit without hiding it or removing operator access to actual ETH`);
    assert(plain.includes('Deficit mode clears only after')
      && plain.includes('canonical-chain reconciliation computes accounting_deficit == 0')
      && plain.includes('configured finality') && plain.includes('finalized result')
      && plain.includes('public mirror') && plain.includes('resume immediately')
      && plain.includes('normal cap') && plain.includes('oracle') && plain.includes('adapter')
      && plain.includes('health') && plain.includes('deadline') && plain.includes('authority wall')
      && plain.includes('no Safe') && plain.includes('operator acknowledgment')
      && plain.includes('additional cooldown')
      && plain.includes('does not revive') && plain.includes('expired or cancelled intent')
      && plain.includes('extend a purchase window') && plain.includes('replay a missed ballot')
      && plain.includes('catch-up authority') && plain.includes('block')
      && plain.includes('transaction') && plain.includes('synchronization time')
      && plain.includes('pre/post deficit') && plain.includes('later deficit')
      && plain.includes('manually declare zero') && plain.includes('bypass finality'),
    `${name} must resume automatically only after finalized synchronized zero-deficit proof without reviving missed work`);
    assert(plain.includes('Every successful atomic vault-accounting entrypoint receives exactly the next monotonic')
      && plain.includes('accountingSequence') && plain.includes('canonical deposits and deficit repair')
      && plain.includes('unattributed synchronization') && plain.includes('Safe reclassification')
      && plain.includes('reservation or intent creation') && plain.includes('purchase debit/finalization')
      && plain.includes('refunds') && plain.includes('expiry/cancellation')
      && plain.includes('operator outflow') && plain.includes('deficit reconciliation')
      && plain.includes('canonical migration') && plain.includes('Component effects')
      && plain.includes('share the sequence') && plain.includes('deterministic componentIndex order')
      && plain.includes('action') && plain.includes('actor') && plain.includes('transaction/block position')
      && plain.includes('complete pre/post vault balance') && plain.includes('available')
      && plain.includes('unattributed') && plain.includes('reserved')
      && plain.includes('accounted-bucket total') && plain.includes('deficit')
      && plain.includes('affected intent/bucket deltas')
      && plain.includes('Reverts and true no-ops consume no sequence')
      && plain.includes('Canonical on-chain inclusion order is authoritative')
      && plain.includes('worker timestamps') && plain.includes('API arrival')
      && plain.includes('database time') && plain.includes('roll back reorged entries')
      && plain.includes('finalized canonical order') && plain.includes('duplicate sequence')
      && plain.includes('unexplained gap') && plain.includes('pre/post discontinuity')
      && plain.includes('public synchronization failure') && plain.includes('never silently healed'),
    `${name} must publish one canonical total order for every successful vault-accounting mutation`);
    assert(plain.includes('empty calldata only') && plain.includes('arbitrary-call')
      && plain.includes('delegatecall') && plain.includes('token approval')
      && plain.includes('token transfer') && plain.includes('payable')
      && plain.includes('reentrancy guard') && plain.includes('Transfer failure')
      && plain.includes('richer interaction') && plain.includes('without')
      && plain.includes('vault authority'),
    `${name} must keep arbitrary ETH destination power while denying generic vault execution authority`);
    assert(plain.includes('available ETH first') && plain.includes('unattributed ETH second')
      && plain.includes('ordinary reserved ETH third') && plain.includes('reconciliation_pending ETH last')
      && plain.includes('caller cannot select a bucket') && plain.includes('minimum number')
      && plain.includes('amount descending') && plain.includes('later execution deadline first')
      && plain.includes('intent ID ascending') && plain.includes('partially funded')
      && plain.includes('greatest backed amount first') && plain.includes('oldest reconciliationStartedAt')
      && plain.includes('fully exhausting records before at most one partial debit')
      && plain.includes('immediately publishes') && plain.includes('pre/post')
      && plain.includes('rolls back'),
    `${name} must debit and cancel deterministically while disclosing every operator outflow atomically`);
  }
  assert(design.includes('Founder acquisition-vault/operator-override rule')
    && design.includes('Founder main-operator appointment/authentication rule')
    && design.includes('Founder outflow reason/nonce rule')
    && design.includes('Founder relayed-authorization time rule')
    && design.includes('Founder zero-recipient/no-burn rule')
    && design.includes('Founder operator self-renunciation rule')
    && design.includes('Founder instant main-operator self-replacement rule')
    && design.includes('Founder address-based smart-wallet operator rule')
    && design.includes('Founder operator-wallet monitoring cadence rule')
    && design.includes('Founder operator-role reason/disclosure rule')
    && design.includes('Founder unattributed-ETH quarantine/reclassification rule')
    && design.includes('Founder immutable reservation-expiry rule')
    && design.includes('Founder deterministic singleton purchase-intent rule')
    && design.includes('Founder atomic post-wall intent-creation rule')
    && design.includes('Founder permissionless bound-intent execution rule')
    && design.includes('Founder Safe/main-operator explicit intent-cancellation rule')
    && design.includes('Founder immutable adapter-attempt result/reconciliation rule')
    && design.includes('Founder Safe-only attempt-reconciliation finality rule')
    && design.includes('Founder exact reconciliation evidence/final-fill rule')
    && design.includes('Founder terminal reconciliation-quarantine rule')
    && design.includes('Founder contract-derived reconciliation-bound rule')
    && design.includes('Founder indefinite reconciliation-quarantine rule')
    && design.includes('Founder quarantine/operator-outflow deficit-preservation rule')
    && design.includes('Founder reconciliation-liability solvency rule')
    && design.includes('Founder deterministic reconciliation debit/repair rule')
    && design.includes('Founder factual underfunded-reconciliation closure rule')
    && design.includes('Founder repaired terminal-shortfall principal-release rule')
    && design.includes('Founder exact late-arrival reconciliation rule')
    && design.includes('Founder late-stock recovery-proceeds rule')
    && design.includes('Founder recovery-vault and adapter confinement rule')
    && design.includes('Founder canonical recovery-output and conservative valuation rule')
    && design.includes('Founder immutable recovery-authorization and expiry rule')
    && design.includes('Founder partial recovery, no-sweep, and permissionless-execution rule')
    && design.includes('Founder blackhat/grief-resistant recovery-execution rule')
    && design.includes('Founder public recovery-evidence, finality, retention, and API-abuse rule')
    && design.includes('Founder recovery implementation/audit activation gate')
    && design.includes('Founder quarantine proportionality and conditional-v1 security rule')
    && design.includes('Founder reconciliation-incident alert/UI rule')
    && design.includes('Founder acquisition-deficit delivery-continuity rule')
    && design.includes('Founder stale reconciliation-mirror fail-closed rule')
    && design.includes('Founder exact incident-closure and composable-blocker rule')
    && design.includes('Founder priority-index rebuild and bounded-mutation rule')
    && design.includes('Founder canonical incident-history cursor rule')
    && design.includes('Founder relayed intent-cancellation authorization rule')
    && design.includes('Founder asymmetric emergency purchase-pause rule')
    && design.includes('Founder matched/late/unmatched refund rule')
    && design.includes('Founder canonical acquisition-deposit identity rule')
    && design.includes('Founder exact ingress-code identity rule')
    && design.includes('Founder single-active-ingress-version rule')
    && design.includes('Founder immutable deficit-repair deposit-split rule')
    && design.includes('Founder immediate accounting-only Safe reclassification rule')
    && design.includes('Founder accounting-deficit/operator-survival rule')
    && design.includes('Founder finalized zero-deficit automatic-resumption rule')
    && design.includes('Founder vault-wide accounting-sequence rule')
    && design.includes('Founder EOA/ERC-1271 operator rule')
    && design.includes('Founder ETH-only operator-call rule')
    && design.includes('Founder operator-outflow debit/disclosure rule')
    && design.includes('Founder spend-based concentration-cap rule')
    && design.includes('Founder vault migration/retirement with operator bypass'),
  'the RWA design must pin the main-operator override, normal caps, and two vault-exit paths');
  assert(historical.includes('explicit sweep trust assumption')
    && historical.includes('pending nominee/48-hour acceptance clock')
    && historical.includes('Nomination expires seven days')
    && historical.includes('relayed EIP-712')
    && historical.includes('closed public reason code')
    && historical.includes('current operator may advance it without moving ETH')
    && historical.includes('with a one-hour') && historical.includes('maximum and no future issue time')
    && historical.includes('recipient must be nonzero and there is no ETH-burn path')
    && historical.includes('directly self-renounce')
    && historical.includes('active operator may directly replace itself immediately')
    && historical.includes('same-transaction EIP-712')
    && historical.includes('maximum one-hour deadline')
    && historical.includes('global outflow nonce persists')
    && historical.includes('Safe may still zero')
    && historical.includes('Smart-wallet authority follows its address')
    && historical.includes('changes/unknown health are public informational warnings only')
    && historical.includes('Watch at least every five minutes, stale after ten')
    && historical.includes('never make watcher failure a veto')
    && historical.includes('Every replacement/')
    && historical.includes('closed public reason code plus')
    && historical.includes('Forced/mistaken/unexplained ETH is')
    && historical.includes('permissionless sync only books surplus')
    && historical.includes('Each reservation has one immutable deadline')
    && historical.includes('permissionless idempotent expiry releases all')
    && historical.includes('Each ballot/exact asset version has one permanent deterministic')
    && historical.includes('attempts are monotonic and')
    && historical.includes('no parallel/split/second-success/terminal recreation exists')
    && historical.includes('Safe-approved `RwaStockBuyer` creates atomically after every')
    && historical.includes('failure consumes no intent/tombstone/reservation/bucket/attempt/sequence')
    && historical.includes('`executeIntent(intentId)` is permissionless but fully bound')
    && historical.includes('routes Stock Tokens/ETH only to their vaults')
    && historical.includes('pays caller nothing')
    && historical.includes('Safe or current main operator may explicitly `cancelIntent`')
    && historical.includes('terminal full reservation release')
    && historical.includes('canonical inclusion order resolves every execution/expiry/refund/outflow race')
    && historical.includes('Pre-adapter validation failures')
    && historical.includes('retryable `attempt_failed` only')
    && historical.includes('`attempt_reconciliation`')
    && historical.includes('Only Safe finalizes reconciliation')
    && historical.includes('cannot mutate buckets/state/sequence')
    && historical.includes('actual ETH debit, cumulative verified refund')
    && historical.includes('positive valid custody delta is the final fill')
    && historical.includes('nonspendable `reconciliation_pending`')
    && historical.includes('later proven-unspent value becomes available without revival/replacement')
    && historical.includes('Contract-derived bounds from immutable')
    && historical.includes('Safe chooses disposition/evidence but cannot override observed value')
    && historical.includes('has no timeout, abandonment, presumed outcome, or')
    && historical.includes('accounting never guesses')
    && historical.includes('raw outflow authority over actual quarantine ETH')
    && historical.includes('but the transfer cannot')
    && historical.includes('finalize/classify/release/erase the unresolved liability')
    && historical.includes('resulting shortfall as explicit accounting deficit')
    && historical.includes('contract-fixed available → unattributed → ordinary')
    && historical.includes('reconciliationLiability = backedQuarantineEth + reconciliationShortfall')
    && historical.includes('greatest backing first, then oldest `reconciliationStartedAt`')
    && historical.includes('Generic canonical repair uses one unified oldest-created deficit queue')
    && historical.includes('Contract-owned') && historical.includes('bounded priority indexes')
    && historical.includes('durable terminal `reconciled_shortfall`')
    && historical.includes('same entry retires') && historical.includes('no second Safe action')
    && historical.includes('interest') && historical.includes('opportunity-cost')
    && historical.includes('A late exact canonical') && historical.includes('refund repairs its own attempt shortfall')
    && historical.includes('`unattributed_stock` quarantine')
    && historical.includes('fixed Safe-approved recovery vault')
    && historical.includes('excluded from') && historical.includes('included in gross custody')
    && historical.includes('Recovery ETH repairs the exact originating attempt shortfall first')
    && historical.includes('remainder to `unattributed`')
    && historical.includes('public 48-hour delayed and atomic')
    && historical.includes('canonical ETH using fresh independent price')
    && historical.includes('unexpected ERC-20 output receives no recovery credit')
    && historical.includes('greater of fresh independent market value')
    && historical.includes('blocks new exact-version purchases')
    && historical.includes('unique domain-separated immutable `recoveryId`')
    && historical.includes('earlier of one hour after approval and oracle validity')
    && historical.includes('Partial recovery is monotonic through separately authorized exact tranches')
    && historical.includes('Neither Safe nor operator has an arbitrary Stock Token')
    && historical.includes('Anyone may execute an authorized ID with no payload')
    && historical.includes('Permissionless execution cannot create/enqueue records')
    && historical.includes('constant-time') && historical.includes('`nonReentrant`')
    && historical.includes('Invalid, duplicate, expired, cancelled, losing-race, or reverted calls')
    && historical.includes('cost only the caller') && historical.includes('identical-ID front-run')
    && historical.includes('Safe/current main operator may pause recovery immediately')
    && historical.includes('Public recovery/incident data exposes structured canonical facts')
    && historical.includes('finalized is default') && historical.includes('History is')
    && historical.includes('permanent with checksum-addressed cursor exports')
    && historical.includes('invalid/replayed/transport spam cannot scan, write, alert, regenerate exports')
    && historical.includes('Quarantine-and-hold is the')
    && historical.includes('complete default')
    && historical.includes('recovery is optional')
    && historical.includes('not an ordinary') && historical.includes('RWA-launch blocker')
    && historical.includes('stateful fuzz/invariant')
    && historical.includes('independent third-party source/bytecode review')
    && historical.includes('No placeholder generic')
    && historical.includes('Safe authorization then records on-chain')
    && historical.includes('no non-upgradeable mandate')
    && historical.includes('per-version rolling-24-hour')
    && historical.includes('500-bps divergence')
    && historical.includes('conventional balance-delta ERC-20s only')
    && historical.includes('unsigned calldata without gas sponsorship')
    && historical.includes('never auto-pauses, opens an incident, or writes canonical history')
    && historical.includes('bounty/disclosure channel')
    && historical.includes('rehearsed pause/cancel/rotation runbook')
    && historical.includes('dedicated `reconciliation_outflow`')
    && historical.includes('persistent red RWA UI')
    && historical.includes('immutable `incidentId`')
    && historical.includes('incident_state_unknown_stale')
    && historical.includes('Acquisition deficit pauses buying')
    && historical.includes('Incident closure') && historical.includes('every record invariant')
    && historical.includes('blockers') && historical.includes('compose independently')
    && historical.includes('permissionless bounded deterministic rebuild')
    && historical.includes('positive `maxComponents`')
    && historical.includes('Incident API cursors order immutable history')
    && historical.includes('no offset/mutable ordering')
    && historical.includes('exact `nextIntentCancelNonce`')
    && historical.includes('independently of `nextOutflowNonce`')
    && historical.includes('only the Safe may unpause')
    && historical.includes('Existing deadlines continue to run without extension')
    && historical.includes('Exact-provenance refunds up to actual debit')
    && historical.includes('terminal refunds first repair their exact attempt shortfall')
    && historical.includes('remainder becomes available without reopening')
    && historical.includes('Canonical acquisition credit')
    && historical.includes('unique chain/source/external-reference deposit ID')
    && historical.includes('Each ingress approval binds exact address/runtime code hash')
    && historical.includes('prior canonical deposits and consumed IDs remain historical truth')
    && historical.includes('Each vault has one active exact ingress version')
    && historical.includes('Safe rotation is atomic with no overlap/grace')
    && historical.includes('only inclusion-time active version is canonical')
    && historical.includes('deficitRepairAmount = min(msg.value, deficitBefore)')
    && historical.includes('availableCreditAmount')
    && historical.includes('Safe reclassification is immediate but only')
    && historical.includes('unattributed-to-available accounting')
    && historical.includes('public positive accounting')
    && historical.includes('main operator may still withdraw actual remaining balance')
    && historical.includes('no silent haircut is permitted')
    && historical.includes('zero reconciliation reaches configured finality')
    && historical.includes('without acknowledgment/cooldown')
    && historical.includes('no role may manually declare zero')
    && historical.includes('vault-wide `accountingSequence`')
    && historical.includes('compound effects share deterministic component order')
    && historical.includes('finalized canonical inclusion')
    && historical.includes('EOA or ERC-1271 wallet')
    && historical.includes('Vault outflow is ETH-only')
    && historical.includes('cancel the fewest whole reservations')
    && historical.includes('`exposure_cap_reached` skips without substitute')
    && historical.includes('main operator may bypass it for raw ETH outflow'),
  'the historical Stock Machine amendment must carry the unilateral operator trust boundary');
  assert(deploy.includes('DEDICATED ACQUISITION VAULT + MAIN-OPERATOR ARBITRARY ETH EXIT')
    && deploy.includes('ONE PUBLIC OPERATOR / TWO-STEP ROTATION')
    && deploy.includes('DIRECT OR FULLY BOUND EIP-712 OUTFLOW AUTHORIZATION')
    && deploy.includes('CLOSED REASON TAXONOMY + ONE GLOBAL NONCE')
    && deploy.includes('RECONCILIATION LIABILITY / BACKING / SHORTFALL INVARIANT')
    && deploy.includes('DETERMINISTIC QUARANTINE DEBIT + SHORTFALL REPAIR')
    && deploy.includes('UNDERFUNDED FACTUAL RECONCILIATION CLOSURE')
    && deploy.includes('AUTOMATIC EXACT-PRINCIPAL RELEASE AFTER TERMINAL REPAIR')
    && deploy.includes('EXACT LATE REFUND + LATE STOCK QUARANTINE')
    && deploy.includes('EXACT-PROVENANCE LATE-STOCK RECOVERY PROCEEDS')
    && deploy.includes('ONE CODE-PINNED 48-HOUR RECOVERY VAULT')
    && deploy.includes('CONFINED EXACT-STOCK TO CANONICAL-ETH RECOVERY ADAPTER')
    && deploy.includes('CONSERVATIVE QUARANTINED-STOCK EXPOSURE VALUE')
    && deploy.includes('IMMUTABLE ONE-HOUR RECOVERY AUTHORIZATION')
    && deploy.includes('MONOTONIC PARTIAL RECOVERY / NO STOCK SWEEP / SEPARATE GAS')
    && deploy.includes('BLACKHAT- AND GRIEF-RESISTANT RECOVERY EXECUTION')
    && deploy.includes('PUBLIC FINALIZED RECOVERY HISTORY / API SPAM WALL')
    && deploy.includes('RECOVERY IMPLEMENTATION / INDEPENDENT AUDIT ACTIVATION GATE')
    && deploy.includes('CONDITIONAL MINIMAL RECOVERY SECURITY')
    && deploy.includes('CRITICAL RECONCILIATION INCIDENT UI')
    && deploy.includes('TEN-MINUTE STALE INCIDENT MIRROR FAILS RED')
    && deploy.includes('ACQUISITION DEFICIT DOES NOT BLOCK HEALTHY DELIVERY')
    && deploy.includes('EXACT INCIDENT CLOSURE + COMPOSABLE PURCHASE BLOCKERS')
    && deploy.includes('PERMISSIONLESS INDEX REBUILD + MAX-COMPONENT ATOMICITY')
    && deploy.includes('CANONICAL INCIDENT CURSOR + FULL HISTORY EXPORT')
    && deploy.includes('ONE-HOUR RELAYED AUTHORIZATION WINDOW')
    && deploy.includes('NONZERO RECIPIENT / NO ETH BURN PATH')
    && deploy.includes('DIRECT OPERATOR SELF-RENUNCIATION')
    && deploy.includes('INSTANT CURRENT-OPERATOR SELF-REPLACEMENT')
    && deploy.includes('ADDRESS-BASED SMART-WALLET OPERATOR IDENTITY')
    && deploy.includes('FIVE-MINUTE OPERATOR-WALLET WATCH / TEN-MINUTE FRESHNESS')
    && deploy.includes('PUBLIC REASON + DETAILS COMMITMENT FOR EVERY OPERATOR-ROLE CHANGE')
    && deploy.includes('UNATTRIBUTED ETH QUARANTINE + SAFE RECLASSIFICATION')
    && deploy.includes('IMMUTABLE PERMISSIONLESS RESERVATION EXPIRY')
    && deploy.includes('DETERMINISTIC SINGLETON PURCHASE INTENT')
    && deploy.includes('ATOMIC POST-WALL INTENT CREATION')
    && deploy.includes('PERMISSIONLESS EXECUTION OF FULLY BOUND INTENTS')
    && deploy.includes('IMMUTABLE ADAPTER-ATTEMPT RESULTS + RECONCILIATION GATE')
    && deploy.includes('SAFE-ONLY ATTEMPT-RECONCILIATION FINALITY')
    && deploy.includes('EXACT RECONCILIATION EVIDENCE + FINAL-FILL ACCOUNTING')
    && deploy.includes('TERMINAL RECONCILIATION-PENDING QUARANTINE')
    && deploy.includes('CONTRACT-DERIVED RECONCILIATION VALUE BOUNDS')
    && deploy.includes('NO-TIMEOUT RECONCILIATION QUARANTINE')
    && deploy.includes('OPERATOR QUARANTINE OUTFLOW / LIABILITY SURVIVES')
    && deploy.includes('SAFE + MAIN-OPERATOR EXPLICIT INTENT CANCELLATION')
    && deploy.includes('SEPARATE EIP-712 INTENT-CANCEL NONCE')
    && deploy.includes('SAFE/OPERATOR PAUSE + SAFE-ONLY RESUME')
    && deploy.includes('MATCHED ACTIVE / LATE TERMINAL / UNMATCHED REFUNDS')
    && deploy.includes('UNIQUE SAFE-APPROVED CANONICAL ACQUISITION DEPOSITS')
    && deploy.includes('EXACT INGRESS ADDRESS/CODE/IMPLEMENTATION IDENTITY')
    && deploy.includes('ONE ACTIVE CANONICAL INGRESS VERSION')
    && deploy.includes('IMMUTABLE DEFICIT-REPAIR DEPOSIT SPLIT')
    && deploy.includes('IMMEDIATE ACCOUNTING-ONLY SAFE RECLASSIFICATION')
    && deploy.includes('PUBLIC ACCOUNTING DEFICIT / OPERATOR SURVIVAL')
    && deploy.includes('FINALIZED ZERO-DEFICIT AUTOMATIC RESUMPTION')
    && deploy.includes('ONE VAULT-WIDE ACCOUNTING SEQUENCE')
    && deploy.includes('EOA + ERC-1271 MAIN OPERATOR')
    && deploy.includes('ETH-ONLY EMPTY-CALLDATA OUTFLOW')
    && deploy.includes('DETERMINISTIC OUTFLOW DEBIT + IMMEDIATE DISCLOSURE')
    && deploy.includes('SPEND-BASED CONCENTRATION CAPS')
    && deploy.includes('STATE-PRESERVING VAULT MIGRATION / OPERATOR BYPASS')
    && deploy.includes('operator partial/full bypass'),
  'the launch runbook must rehearse both normal vault protections and arbitrary operator exits');
  assert(!design.includes('operator cannot appoint its own successor')
    && !historical.includes('outflow authority cannot self-appoint')
    && !deploy.includes('Do not let outflow authority appoint its own successor'),
  'the superseded Safe-only successor restriction must not survive the instant self-replacement override');
  const admin = read('public/admin.html');
  assert(admin.includes('Quarantined Stock Tokens')
    && admin.includes('hold-only default · conditional future recovery')
    && admin.includes('optional future edge feature')
    && admin.includes('not an RWA launch dependency')
    && admin.includes('no recovery capability is deployed')
    && admin.includes('finalized default · checksummed cursor pages')
    && !admin.includes('Authorize Stock recovery')
    && !admin.includes('Execute Stock recovery')
    && !admin.includes('Recovery abuse guard'),
  'the disabled operator UI must collapse the undeployed recovery edge case into one hold-only quarantine control');
  console.log('✓ pooled ETH is capped/accounted by default but main operator retains arbitrary transfer power');
}

// Founder batch: freeze an exact pre-vote budget, keep the MVP spot-only and units-first, and record
// OMR staking as an allocation direction rather than silently changing the shipped broker formula.
{
  const design = read('omerta-brokers-design.md');
  const historical = read('omerta-rwa-stock-machine-design.md');
  const deploy = read('CHAIN-DEPLOY.md');
  const admin = read('public/admin.html');
  const md = read('docs/WIKI.md');
  const web = read('public/wiki.html');

  for (const [name, src] of [['docs/WIKI.md', md], ['public/wiki.html', web]]) {
    const plain = (name.endsWith('.html') ? src.replace(/<[^>]+>/g, ' ') : src).replace(/\s+/g, ' ');
    assert(plain.includes('does not use an automatic percentage of prior-day protocol revenue')
      && plain.includes('no mandatory minimum acquisition-vault ETH reserve')
      && plain.includes('published and atomically frozen before the ballot opens')
      && plain.includes('There is no policy minimum economic purchase size')
      && plain.includes('ordinary execution walls still fail normally'),
    `${name} must disclose the immutable pre-vote budget with no revenue formula, reserve floor, or policy dust floor`);
    assert(plain.includes('provider-native spot Stock Token')
      && plain.includes('LP tokens') && plain.includes('yield wrappers')
      && plain.includes('may not sell, rebalance, rotate, or market-time')
      && plain.includes('not permanently prohibited')
      && plain.includes('authorizes none of them for the MVP'),
    `${name} must keep the MVP spot-only while preserving unauthorised future-product optionality`);
    assert(plain.includes('Verified OMR staking may multiply active-play allocation')
      && plain.includes('boost is not live')
      && plain.includes('same unified actual on-chain OMR gameplay position')
      && plain.includes('Made Ladder, commitment locks, gameplay loss, unbonding, and inheritance')
      && plain.includes('not a separate') && plain.includes('account_persistent.staked')
      && plain.includes('Active-play qualification for human and agent accounts')
      && plain.includes('NPC/resident exclusion')
      && plain.includes('recurring 30-day Broker activation remain mandatory')
      && plain.includes('activationMult × activityScore × stakeMult')
      && plain.includes('failed activity still produces zero')
      && plain.includes('fixed public tiers')
      && plain.includes('finalized time-weighted-average eligible principal')
      && plain.includes('complete seven-day epoch')
      && plain.includes('no separate 72-hour maturity delay')
      && plain.includes('one verified allocation wallet') && plain.includes('wallet change begins next epoch')
      && plain.includes('Liquid OMR') && plain.includes('claimed rewards not restaked')
      && plain.includes('Broker-activation spend do not count')
      && plain.includes('approved cap is 1.50×')
      && plain.includes('below 300 OMR receives 1.00×')
      && plain.includes('300–999.999… receives 1.10×')
      && plain.includes('1,000–4,999.999… receives 1.20×')
      && plain.includes('5,000–19,999.999… receives 1.35×')
      && plain.includes('20,000 OMR or more receives 1.50×')
      && plain.includes('Only finalized active and committed principal qualifies')
      && plain.includes('Pending deposits, idle loot, unbonding, withdrawable, withdrawn')
      && plain.includes('One verified wallet may qualify one permanent account per epoch')
      && plain.includes('conflicting claim receives zero stake multiplier until resolved')
      && plain.includes('changes the TWA prospectively from canonical time')
      && plain.includes('Only the Safe may change tiers or thresholds')
      && plain.includes('at least seven public days') && plain.includes('first full epoch beginning after notice')
      && plain.includes('Every epoch freezes the schedule')
      && plain.includes('critical defect pauses or cancels that epoch rather than rewriting weights')
      && plain.includes('replacement custody and settlement baseline is approved but not live')
      && plain.includes('OMRGameplayVault') && plain.includes('no personal APY')
      && plain.includes('actual reserve-backed on-chain OMR')
      && plain.includes('one-use typed and rate-bounded chain-first gameplay outcomes')
      && plain.includes('imports legacy stake only against deposited OMR')
      && plain.includes('shipped formula remains') && plain.includes('activationMult × activityScore')
      && plain.includes('no current stake balance counts silently or retroactively')
      && plain.includes('Agent accounts have full economic parity')
      && plain.includes('verified EOA or ERC-1271 controller wallets')
      && plain.includes('receive idle loot') && plain.includes('lose eligible principal')
      && plain.includes('build finalized Broker stake TWA')
      && plain.includes('receive Stock Token allocations and delivery')
      && plain.includes('never denies vault authorization, settlement, checkpoints, Broker weight, RWA allocation, or delivery'),
    `${name} must pin the capped tier schedule, agent-wallet parity, eligible buckets, wallet uniqueness, prospective TWA, Safe governance, and frozen epoch rules`);
    assert(plain.includes('founder-directed replacement makes that stake actual on-chain OMR')
      && plain.includes('rather than a separate database balance')
      && plain.includes('same canonical position must drive the Made Ladder')
      && plain.includes('Broker staking multiplier, gameplay loss, unbonding, inheritance, and public accounting')
      && plain.includes('database may mirror finalized chain state and journal pending settlement')
      && plain.includes('cannot independently create or move stake')
      && plain.includes('approved design uses a new') && plain.includes('OMRGameplayVault')
      && plain.includes('Principal pays no personal APY')
      && plain.includes('Game-earned OMR must first become real')
      && plain.includes('reserve-backed on-chain OMR before staking')
      && plain.includes('Safe-rotatable gameplay signer') && plain.includes('may not sweep funds')
      && plain.includes('Chain settlement finalizes before the game consumes one-use resources')
      && plain.includes('migration mint covers a shortage')
      && plain.includes('approved, not live'),
    `${name} must disclose the approved actual-OMR gameplay-vault custody, settlement, outage, and migration baseline`);
    assert(plain.includes("Only the account's verified controller wallet")
      && plain.includes('claim-and-stake rail may fund its position')
      && plain.includes('bypass transfer cannot stake for somebody else or qualify them')
      && plain.includes('permanent game account') && plain.includes('death or respawn')
      && plain.includes('published on-chain risk-ruleset version')
      && plain.includes('maximum losses of 20%') && plain.includes('50% for idle/unbonding OMR')
      && plain.includes('higher rate or new loss type requires a new public version and fresh consent')
      && plain.includes('prepared, submitted, finalized, and game-committed states')
      && plain.includes('final vault event is the one source for crash recovery')
      && plain.includes('balance actually available') && plain.includes('cannot overdraw')
      && plain.includes('on-chain history for the Made Ladder') && plain.includes('Broker time-weighted average')
      && plain.includes('does not automatically trap withdrawals') && plain.includes('custody-integrity incident')
      && plain.includes('founder selected an upgradeable gameplay vault')
      && plain.includes('non-upgradeable migration-only contract')
      && plain.includes('proxy implementation') && plain.includes('real trust assumptions')
      && plain.includes('upgrade can technically change')
      && plain.includes('approved structure uses an OpenZeppelin Transparent Proxy')
      && plain.includes('dedicated') && plain.includes('ProxyAdmin') && plain.includes('non-upgradeable upgrade governor')
      && plain.includes('Only the Safe may propose, cancel, or execute')
      && plain.includes('main operator, gameplay signer, relayer, servers, and individual wallets have no upgrade power')
      && plain.includes('upgrade or upgrade-control change is published for at least 48 hours')
      && plain.includes('exact old/new code hashes') && plain.includes('storage-layout commitment')
      && plain.includes('cannot bypass that delay')
      && plain.includes('Implementations cannot initialize themselves')
      && plain.includes('versioned setup step runs once inside the exact upgrade transaction')
      && plain.includes('validates OMR identity') && plain.includes('balance and liabilities')
      && plain.includes('failed continuity check reverts the upgrade')
      && plain.includes('Independent review and rehearsal remain necessary')
      && plain.includes('rollback follows the same proposal and delay')
      && plain.includes('increases economic risk requires a new ruleset and fresh consent')
      && plain.includes('does not consent keeps an exit under the previously accepted terms')
      && plain.includes('implementation and code hash') && plain.includes('validation result')
      && plain.includes('authority mismatch stays red')
      && plain.includes('stops new deposits and commitments')
      && plain.includes('without silently stopping exits'),
    `${name} must disclose controller binding, versioned consent, hard rates, exactly-once settlement, checkpointing, scoped pauses, and upgrade trust`);
    assert(plain.includes('Changing a healthy controller normally requires signatures from both the current and proposed wallets')
      && plain.includes('authenticated control of the permanent game account')
      && plain.includes('public seven-day request') && plain.includes('notifies every available account channel')
      && plain.includes('current controller may contest')
      && plain.includes('only the Safe may resolve a contested request against public evidence')
      && plain.includes('nobody may shorten the seven-day minimum')
      && plain.includes('withdrawals, deposits, new commitments, and more controller changes stop')
      && plain.includes('existing commitments, unbonding clocks, gameplay exposure, and valid losses continue')
      && plain.includes('recovery is not a temporary shield')
      && plain.includes('advances the public controller generation')
      && plain.includes('invalidates unfinished old-wallet authorizations')
      && plain.includes('never rewrites finalized history')
      && plain.includes('EOA and ERC-1271 smart-contract wallets are supported')
      && plain.includes('invalid contract-wallet responses fail closed')
      && plain.includes('Unlocked principal is withdrawn directly by the current controller to that same wallet')
      && plain.includes('no arbitrary recipient') && plain.includes('server signature')
      && plain.includes('Stake, unbond, and withdrawal accept partial amounts')
      && plain.includes('Every partial unstake has its own amount')
      && plain.includes('six-hour unlock') && plain.includes('ruleset version') && plain.includes('exposure history')
      && plain.includes('later request cannot restart or rewrite an earlier clock')
      && plain.includes('earliest unlock time') && plain.includes('lowest immutable tranche ID')
      && plain.includes('at most 16 live unbonding tranches per account')
      && plain.includes('matured tranches do not count') && plain.includes('over-cap unstake fails before changing state')
      && plain.includes('partial unstake must be at least 0.01 OMR')
      && plain.includes('exact full remaining eligible stake can always exit')
      && plain.includes('aggregate into one withdrawable balance')
      && plain.includes("preserve each tranche's complete history")
      && plain.includes('accepts only the pinned OMR contract')
      && plain.includes('balance actually received') && plain.includes('caller claimed to send')
      && plain.includes('Transfer fees, rebases, hooks, malformed results, and amount mismatches cannot fabricate a position')
      && plain.includes('sent around the deposit route is unattributed and qualifies nobody')
      && plain.includes('actual OMR balance to cover every accounted liability')
      && plain.includes('red custody-integrity incident that stops new risk')
      && plain.includes('no database or operator entry may conceal it')
      && plain.includes('withdrawal response remains separately visible'),
    `${name} must disclose dual-controller rotation, delayed recovery without sheltering, controller-only partial exits, tranche clocks, and exact OMR solvency`);
    assert(plain.includes('Unattributed OMR remains nonqualifying and nonspendable while the vault is solvent')
      && plain.includes('public 48-hour proposal') && plain.includes('single fixed OMR recovery-treasury address')
      && plain.includes('cannot credit a player, settle gameplay, choose an arbitrary recipient')
      && plain.includes('Anyone may fund a deficit with exact OMR')
      && plain.includes('Actual OMR received repairs the deficit first')
      && plain.includes('creates no qualification, yield, repayment claim, or gameplay credit')
      && plain.includes('excess becomes unattributed')
      && plain.includes('automatically pauses withdrawals as well as deposits, new commitments, and gameplay debits')
      && plain.includes("Every player's liability remains recorded in full")
      && plain.includes('no haircut, pro-rata conversion, first-come payout, operator write-off, or database adjustment')
      && plain.includes('canonical zero deficit reaches configured finality')
      && plain.includes('deficit-specific pauses clear automatically without acknowledgment or cooldown')
      && plain.includes('unrelated pauses remain')
      && plain.includes('checks solvency before and after every value-changing operation')
      && plain.includes('Permissionless solvency and unattributed-balance synchronization')
      && plain.includes('zero-to-positive recurrence receives a new immutable incident ID')
      && plain.includes('actual balance, full liabilities, incident generation, finality, mirror freshness, and sequence continuity')
      && plain.includes('acknowledgment cannot close or conceal an incident'),
    `${name} must disclose fixed-destination delayed surplus recovery, permissionless no-credit deficit funding, full liabilities, automatic deficit pauses, and finalized recovery`);
    assert(plain.includes("each eligible bucket's balance immediately before settlement")
      && plain.includes('signer can supply ceilings but cannot choose or inflate that balance')
      && plain.includes('round down to OMR atomic units') && plain.includes('legitimate zero-loot result still finalizes')
      && plain.includes('settles them atomically in one transaction')
      && plain.includes('approved unbonding-tranche order')
      && plain.includes('credits the killer once with the combined actual loot')
      && plain.includes('reverts everything if any invariant fails')
      && plain.includes("killer's idle on-chain gameplay balance") && plain.includes('exposed at the idle rate')
      && plain.includes('not automatically committed or staked')
      && plain.includes('does not enter the Broker stake time-weighted average')
      && plain.includes('cannot have a future issue time') && plain.includes('canonically included within five minutes')
      && plain.includes('may reach finality after that deadline')
      && plain.includes('prepared state is only an expiring off-chain journal entry')
      && plain.includes('cannot reserve OMR, consume a nonce, pause withdrawals, or lock the victim')
      && plain.includes('globally unique immutable gameplay event ID')
      && plain.includes("victim's exact next monotonic settlement nonce")
      && plain.includes('consumes the nonce even when actual loot is zero')
      && plain.includes('preparation, rejection, expiry, and revert do not')
      && plain.includes('MVP settles exactly one outcome') && plain.includes('batching is not authorized')
      && plain.includes('ordinary signer rotation') && plain.includes('maximum five-minute overlap')
      && plain.includes('emergency Safe revocation has no overlap')
      && plain.includes('Settlement submission is permissionless')
      && plain.includes('gains no authority over the victim, killer, amount, rate, buckets, recipient')
      && plain.includes('no approved-relayer registry, relayer-count cap, or operator-managed relayer set')
      && plain.includes('callers pay their own gas') && plain.includes('spam alone cannot pause settlement')
      && plain.includes('voluntarily fund settlement gas shared by the whole community')
      && plain.includes('dedicated, non-upgradeable') && plain.includes('SettlementGasPool')
      && plain.includes("accepts only the chain's native gas asset")
      && plain.includes('no sponsor balance, refund, yield, priority, allocation weight, governance power')
      && plain.includes('Safe cannot sweep') && plain.includes('move only unreserved ETH')
      && plain.includes('canonical settlement for an event ID and victim nonce')
      && plain.includes('legitimate zero-loot') && plain.includes('calls receive zero')
      && plain.includes('never pushes ETH') && plain.includes('pull accumulated credit')
      && plain.includes('Credits are exact liabilities') && plain.includes('cannot submit a gas bill')
      && plain.includes('public per-settlement wei cap') && plain.includes('unreserved pool ETH')
      && plain.includes('partial or zero credit') && plain.includes('settlement remains permissionless')
      && plain.includes('existing credits remain withdrawable')
      && plain.includes('Increases, a new native-fee source')
      && plain.includes('direct on-chain submission')
      && plain.includes('invalid spam caller-funded and unreimbursed')
      && plain.includes('one exact settlement-finality block count')
      && plain.includes('no action receives a server-, signer-, submitter-, or operator-selected lower threshold')
      && plain.includes('Every increase and decrease follows the same Safe-only 48-hour public')
      && plain.includes('applies only to transactions first included after')
      && plain.includes('never hot-edits finality')
      && plain.includes('pre-finality reorg retries the same event ID and victim nonce')
      && plain.includes('only after canonical absence is proven')
      && plain.includes('post-settlement solvency totals'),
    `${name} must disclose signer rotation, permissionless anti-spam submission, bounded community gas reimbursement, symmetric finality governance, reorg retry, and complete evidence`);
    assert(plain.includes('actual Stock Token units')
      && plain.includes('acquisition reference and cost') && plain.includes('allocation epoch')
      && plain.includes('Estimated market value is secondary')
      && plain.includes('timestamped, source-labeled, and stale-aware')
      && plain.includes('demonstrated recurring material value')
      && plain.includes('measured user demand') && plain.includes('actual failure mode')
      && plain.includes('written Safe scope, authority, invariants, tests, and operating owner'),
    `${name} must lead with units/provenance and admit new RWA complexity only with evidence and ownership`);
  }

  assert(design.includes('Founder fixed pre-vote budget with no reserve/dust policy floor')
    && design.includes('Founder spot-only acquisition and no discretionary trading rule')
    && design.includes('Founder future-product optionality and OMR-stake allocation direction')
    && design.includes('Founder staking-weight composition, qualification, and snapshot rule')
    && design.includes('Founder agent-wallet parity rule')
    && design.includes('Founder unified on-chain OMR gameplay-stake directive')
    && design.includes('Founder purpose-built OMRGameplayVault custody and settlement baseline')
    && design.includes('Founder gameplay-vault identity, consent, settlement-finality, and upgradeability rule')
    && design.includes('Founder gameplay-vault transparent-proxy upgrade-governance rule')
    && design.includes('Founder gameplay-vault controller recovery, partial exit, and exact-OMR accounting rule')
    && design.includes('Founder gameplay-vault tranche bounds, surplus recovery, and deficit-finality rule')
    && design.includes('Founder gameplay-loss calculation and settlement-sequencing rule')
    && design.includes('Founder signer rotation, permissionless settlement, community gas, finality, and Broker stake-weight rule')
    && design.includes('Founder units-first portfolio and evidence-based complexity rule'),
  'the canonical Broker design must pin all four founder decisions');
  assert(historical.includes('no automatic prior-day-revenue percentage')
    && historical.includes('exact backed maximum ETH budget')
    && historical.includes('provider-native spot Stock Token')
    && historical.includes('Verified OMR') && historical.includes('staking may later multiply active-play allocation')
    && historical.includes('activationMult × activityScore × stakeMult')
    && historical.includes('finalized time-weighted-average eligible principal')
    && historical.includes('no separate 72-hour')
    && historical.includes('2× ceiling was') && historical.includes('rejected')
    && historical.includes('Database-only game stake will not remain an alternative')
    && historical.includes('must all use one actual on-chain OMR gameplay position')
    && historical.includes('Agent accounts and their verified EOA or ERC-1271 controller wallets have full economic parity')
    && historical.includes('Broker weight, RWA allocation, or delivery')
    && historical.includes('finalized mirror/pending-settlement')
    && historical.includes('no constrained gameplay loss')
    && historical.includes('No arbitrary') && historical.includes('owner sweep may substitute')
    && historical.includes('new `OMRGameplayVault`, not a retrofit')
    && historical.includes('no personal APY')
    && historical.includes('One-use EIP-712') && historical.includes('outcomes bind chain')
    && historical.includes('Loot reassigns actual victim principal')
    && historical.includes('Settlement finalizes on-chain before irreversible game resource/result commitment')
    && historical.includes('no migration mint is allowed')
    && historical.includes('Only the verified controller wallet or exact claim-and-stake rail')
    && historical.includes('20% active/committed and 50% idle/unbonding')
    && historical.includes('prepared -> submitted -> finalized -> game_committed')
    && historical.includes('lesser of calculated loss and execution-time eligible balance')
    && historical.includes('exactly-once crash-recovery authority')
    && historical.includes('checkpoints on-chain')
    && historical.includes('separately declared custody-integrity')
    && historical.includes('rejected non-upgradeable/migration-only custody')
    && historical.includes('proxy implementation/admin an explicit trust boundary')
    && historical.includes('OpenZeppelin Transparent Proxy')
    && historical.includes('`GameplayVaultUpgradeGovernor`')
    && historical.includes('only the Safe may propose, cancel')
    && historical.includes('wait at least 48 hours')
    && historical.includes('Emergency response is pause-only')
    && historical.includes('reinitializer is only the committed one-use')
    && historical.includes('Atomic validation covers pinned OMR')
    && historical.includes('Rollback') && historical.includes('normal delayed upgrade')
    && historical.includes('Material risk changes require a new ruleset/fresh consent')
    && historical.includes('code/admin/governor/timelock drift stays red')
    && historical.includes('current-wallet release plus new-wallet acceptance')
    && historical.includes('public seven-day clock')
    && historical.includes('Safe-only evidence resolution')
    && historical.includes('recovery freezes withdrawal/deposit/commitment')
    && historical.includes('not existing locks, unbond clocks, gameplay exposure')
    && historical.includes('invalidates unfinalized old-generation authorizations without nonce reset')
    && historical.includes('EOA and ERC-1271 controllers are supported fail-closed')
    && historical.includes('server-independent controller pulls')
    && historical.includes('separate amount/start/six-hour-unlock/ruleset/exposure tranche')
    && historical.includes('earliest unlock time') && historical.includes('lowest immutable tranche ID')
    && historical.includes('at most 16 live unbonding tranches')
    && historical.includes('Partial unstake is at least `0.01 OMR`')
    && historical.includes('aggregate into one withdrawable balance')
    && historical.includes('pins exact OMR') && historical.includes('credits only verified balance delta')
    && historical.includes('Bypass transfers') && historical.includes('unattributed and qualify nobody')
    && historical.includes('actual OMR balance >= total accounted liabilities')
    && historical.includes('public 48-hour proposal to one fixed OMR recovery-treasury address')
    && historical.includes('Permissionless exact-receipt `fundDeficit`')
    && historical.includes('automatically pauses withdrawals plus deposits/commitments/gameplay debits')
    && historical.includes('preserves every liability in full')
    && historical.includes('automatically clears only deficit-specific pauses')
    && historical.includes('permissionless solvency/unattributed sync')
    && historical.includes("execution-time pre-settlement balance")
    && historical.includes('rounds down to OMR atomic units')
    && historical.includes('Multi-bucket loss is one atomic transaction')
    && historical.includes("killer's idle on-chain gameplay balance")
    && historical.includes('expires if not included within five minutes')
    && historical.includes('`prepared` remains an expiring') && historical.includes('off-chain nonlocking journal entry')
    && historical.includes("victim's exact next nonce")
    && historical.includes('successful zero-loot settlement consumes it')
    && historical.includes('MVP settlement is one') && historical.includes('outcome/event per transaction')
    && historical.includes('five-minute overlap') && historical.includes('emergency Safe revocation has no overlap')
    && historical.includes('Settlement submission is permissionless')
    && historical.includes('no approved-relayer registry')
    && historical.includes('callers bear their gas')
    && historical.includes('dedicated non-upgradeable native-asset `SettlementGasPool`')
    && historical.includes('Contributions are final') && historical.includes('Safe has no treasury sweep')
    && historical.includes('moves only unreserved ETH') && historical.includes('outstanding executor-credit backing')
    && historical.includes('winning canonical event/nonce settlement') && historical.includes('zero loot')
    && historical.includes('pull-to-self credit') && historical.includes('Credits are exact liabilities')
    && historical.includes('minimum of contract-measured audited gas')
    && historical.includes('per-settlement wei cap') && historical.includes('unreserved pool ETH')
    && historical.includes('Empty/paused/insufficient sponsorship yields partial or zero credit')
    && historical.includes('Safe may pause credits/reduce caps immediately')
    && historical.includes('Direct chain submission stays open')
    && historical.includes('one public finality') && historical.includes('per-action discretion')
    && historical.includes('every increase or decrease uses the same Safe-only 48-hour exact public proposal')
    && historical.includes('Emergencies pause new value-taking settlements')
    && historical.includes('Pre-finality reorg retry reuses the same event/nonce')
    && historical.includes('complete identities, timings, bucket math, tranche consumption')
    && historical.includes('Broker stake weight is capped at 1.50×')
    && historical.includes('`<300=1.00×`') && historical.includes('`20,000+=1.50×`')
    && historical.includes('Only finalized active/committed principal counts')
    && historical.includes('One wallet qualifies one account per epoch')
    && historical.includes('Canonical transitions affect seven-day TWA prospectively')
    && historical.includes('Safe-only tier changes get seven')
    && historical.includes('each epoch freezes all weighting inputs')
    && historical.includes('shipped formula remains')
    && historical.includes('`activationMult × activityScore`; current balances do not count retroactively')
    && historical.includes('recurring material value, measured user demand, or an actual failure mode'),
  'the historical Stock Machine handoff must preserve the budget, asset, staking, portfolio, and complexity decisions');
  assert(deploy.includes('FIXED PRE-VOTE BUDGET / NO REVENUE FORMULA OR RESERVE FLOOR')
    && deploy.includes('SPOT-ONLY MVP / NO DISCRETIONARY SELLING')
    && deploy.includes('OMR-STAKING MULTIPLICATIVE WEIGHT / FULL-EPOCH TWA — COMPLETE RULE, IMPLEMENTATION PENDING')
    && deploy.includes('UNITS-FIRST PORTFOLIO / EVIDENCE-BASED COMPLEXITY')
    && deploy.includes('finalWeight = activationMult × activityScore × stakeMult')
    && deploy.includes('one verified allocation wallet per account/epoch')
    && deploy.includes('defer wallet changes to the next epoch')
    && deploy.includes('account_persistent.staked')
    && deploy.includes('rejected a 2× maximum')
    && deploy.includes('UNIFIED ON-CHAIN OMR GAMEPLAY STAKE')
    && deploy.includes('replace every independent database-only')
    && deploy.includes('actual OMR custody and canonical on-chain transitions')
    && deploy.includes('finalized database mirror plus explicit pending-chain-settlement journal')
    && deploy.includes('database write never fabricates or') && deploy.includes('settles stake')
    && deploy.includes('guarantees immediately withdrawable principal')
    && deploy.includes('Do not add a generic owner/operator sweep')
    && deploy.includes('AGENT-WALLET PARITY')
    && deploy.includes('verified agent-controlled EOA or ERC-1271 wallet')
    && deploy.includes('receive idle loot') && deploy.includes('lose eligible')
    && deploy.includes('build finalized Broker stake TWA')
    && deploy.includes('receive Stock Token')
    && deploy.includes('never vault authorization, settlement, checkpoints, Broker weights')
    && deploy.includes('PURPOSE-BUILT OMRGAMEPLAYVAULT BASELINE')
    && deploy.includes('Retire vault-level personal APY')
    && deploy.includes('one-use EIP-712 outcome')
    && deploy.includes('Settle chain-first')
    && deploy.includes('before resource consumption')
    && deploy.includes('never mint merely to honor rows')
    && deploy.includes('explicit unfunded liability')
    && deploy.includes('GAMEPLAY-VAULT IDENTITY / CONSENT / EXACTLY-ONCE SETTLEMENT')
    && deploy.includes("account's current verified controller wallet")
    && deploy.includes('20% active/committed and 50% idle/unbonding')
    && deploy.includes('prepared -> submitted -> finalized -> game_committed')
    && deploy.includes('min(calculatedLoss, eligibleBalance)')
    && deploy.includes('sole recovery authority')
    && deploy.includes('Checkpoint every deposit')
    && deploy.includes('withdrawal pause requires a separately declared custody-')
    && deploy.includes('UPGRADEABLE GAMEPLAY VAULT')
    && deploy.includes('rejected a non-upgradeable, migration-')
    && deploy.includes('disclose proxy implementation plus upgrade authority')
    && deploy.includes('TRANSPARENT PROXY + DELAYED UPGRADE GOVERNOR')
    && deploy.includes('not UUPS/Beacon/Diamond/custom proxy')
    && deploy.includes('`GameplayVaultUpgradeGovernor` owns the admin')
    && deploy.includes('only the Safe proposes, cancels, and executes')
    && deploy.includes('upgrade_proposed -> waiting_48h -> executable -> executed_validated | cancelled | expired')
    && deploy.includes('no hot-upgrade or delay bypass')
    && deploy.includes('initialization-calldata hash') && deploy.includes('storage-layout commitment')
    && deploy.includes('allow a versioned reinitializer only once')
    && deploy.includes('Atomically validate pinned OMR token')
    && deploy.includes('malicious implementation can lie')
    && deploy.includes('Treat rollback as another complete delayed proposal')
    && deploy.includes('requires fresh') && deploy.includes('consent, and preserves a prior-terms exit')
    && deploy.includes('mismatch stays red and disables first-party deposits/commitments')
    && deploy.includes('CONTROLLER ROTATION + LOST-WALLET RECOVERY')
    && deploy.includes('paired') && deploy.includes('current-controller release')
    && deploy.includes('public seven-day request')
    && deploy.includes('only Safe resolves a contested request')
    && deploy.includes('Recovery is no shield')
    && deploy.includes('never resets a nonce')
    && deploy.includes('EOA and ERC-1271 across verify/rotate/recover/deposit/withdraw')
    && deploy.includes('CONTROLLER-ONLY PULL WITHDRAWALS + PARTIAL TRANCHES')
    && deploy.includes('expose no arbitrary recipient')
    && deploy.includes('checks-effects-interactions') && deploy.includes('ReentrancyGuard')
    && deploy.includes('independent amount') && deploy.includes('six-hour unlock')
    && deploy.includes('16-live-tranche bound')
    && deploy.includes('EXACT OMR RECEIPT + VAULT SOLVENCY')
    && deploy.includes('balance-after minus balance-before')
    && deploy.includes('Direct bypass transfer is') && deploy.includes('unattributed OMR')
    && deploy.includes('actual OMR balance >= total accounted liabilities')
    && deploy.includes('persistent red custody-')
    && deploy.includes('TRANCHE BOUNDS + SURPLUS RECOVERY + DEFICIT FINALITY')
    && deploy.includes('MAX_LIVE_UNBONDING_TRANCHES = 16')
    && deploy.includes('MIN_PARTIAL_UNBOND = 0.01 OMR')
    && deploy.includes('surplus_recovery_proposed -> waiting_48h -> executable -> executed | cancelled | expired')
    && deploy.includes('Add permissionless `fundDeficit(amount)` using actual balance delta')
    && deploy.includes('deficit-specific withdrawal pause')
    && deploy.includes('Preserve every liability at full face amount')
    && deploy.includes('Clear only deficit-specific pauses automatically')
    && deploy.includes('Check solvency pre/post every value-changing entrypoint')
    && deploy.includes('`syncSolvency()` and `syncUnattributed()`')
    && deploy.includes('EXECUTION-TIME LOSS + SINGLE-OUTCOME SETTLEMENT')
    && deploy.includes("execution-time pre-settlement balance")
    && deploy.includes('Round down to OMR atomic units')
    && deploy.includes('legitimate zero-loot') && deploy.includes('outcome still finalizes')
    && deploy.includes('calculate them independently and atomically in one') && deploy.includes('transaction, apply the approved unbonding-tranche order')
    && deploy.includes("killer's idle on-chain gameplay balance")
    && deploy.includes('cap authorization lifetime at five minutes')
    && deploy.includes('`prepared` as an') && deploy.includes('expiring off-chain journal entry')
    && deploy.includes("victim's exact next monotonic settlement nonce")
    && deploy.includes('MVP accepts one outcome')
    && deploy.includes('SIGNER OVERLAP + PERMISSIONLESS SUBMISSION')
    && deploy.includes('rotation plus five minutes')
    && deploy.includes('Emergency Safe') && deploy.includes('revocation has zero overlap')
    && deploy.includes('Let any address submit an exact valid authorization')
    && deploy.includes('Do not build an approved-relayer')
    && deploy.includes('caller pays that gas')
    && deploy.includes('NON-UPGRADEABLE COMMUNITY SETTLEMENTGASPOOL')
    && deploy.includes("supported chain's native gas asset")
    && deploy.includes('no sponsor balance, refund, yield, priority, allocation')
    && deploy.includes('Safe no treasury sweep')
    && deploy.includes('only unreserved ETH') && deploy.includes('outstanding executor credits')
    && deploy.includes('CANONICAL-SUCCESS GAS CREDIT / PULL WITHDRAWAL')
    && deploy.includes('canonical event-ID/victim-nonce settlement')
    && deploy.includes('wrong-chain/vault') && deploy.includes('losing-race calls zero')
    && deploy.includes('never push ETH during settlement')
    && deploy.includes('checks-effects-interactions') && deploy.includes('`ReentrancyGuard`')
    && deploy.includes('`totalOutstandingCredits` as an exact liability')
    && deploy.includes('cannot revert or invalidate an otherwise canonical gameplay settlement')
    && deploy.includes('CAPPED CONTRACT-DERIVED REIMBURSEMENT')
    && deploy.includes('accept no caller-supplied gas cost')
    && deploy.includes('PER_SETTLEMENT_WEI_CAP')
    && deploy.includes('actualBalance - totalOutstandingCredits')
    && deploy.includes('partial or zero credit') && deploy.includes('never closes permissionless settlement')
    && deploy.includes('GAS-POOL GOVERNANCE + PERMISSIONLESS ABUSE BOUNDARY')
    && deploy.includes('existing credits remain withdrawable')
    && deploy.includes('exact 48-hour public proposal')
    && deploy.includes('never restrict direct on-chain submission')
    && deploy.includes('Invalid spam remains caller-funded and unreimbursed')
    && deploy.includes('FINALITY + REORG + EVENT EVIDENCE')
    && deploy.includes('`SETTLEMENT_FINALITY_BLOCKS` per supported chain')
    && deploy.includes('finality_change_proposed -> waiting_48h -> executable -> executed | cancelled | expired')
    && deploy.includes('every increase and decrease')
    && deploy.includes('transactions first included after the boundary')
    && deploy.includes('never hot-edits finality')
    && deploy.includes('same immutable event ID/victim nonce')
    && deploy.includes('post-settlement solvency totals')
    && deploy.includes('BROKER STAKE MULTIPLIER COMPLETE RULE')
    && deploy.includes('cap `stakeMult` at 1.50×')
    && deploy.includes('`20,000+ = 1.50×`')
    && deploy.includes('Count only finalized active and committed principal')
    && deploy.includes('One verified wallet qualifies one permanent account per epoch')
    && deploy.includes('seven public days') && deploy.includes('first later full')
    && deploy.includes('Freeze per epoch the schedule')
    && deploy.includes('Never read only the current balance at allocation time')
    && deploy.includes('immediate stake/unstake around the snapshot')
    && deploy.includes('flash-weightable'),
  'the launch runbook must keep staking unimplemented until the unified vault and finalized anti-flash history exist');
  assert(admin.includes('OMRGameplayVault control room')
    && admin.includes('design approved · implementation, audit, and funded migration pending')
    && admin.includes('Gameplay settlement health')
    && admin.includes('signer generation · mirror freshness · canonical submission · pending outcomes')
    && admin.includes('Legacy stake backing report')
    && admin.includes('claims · deposited OMR · imports · unfunded liability')
    && admin.includes('Gameplay-vault controller binding')
    && admin.includes('account ID · verified wallet · recovery state · unattributed OMR')
    && admin.includes('Gameplay risk ruleset')
    && admin.includes('consent version · 20%/50% ceilings · Safe reductions')
    && admin.includes('Settlement recovery queue')
    && admin.includes('prepared · submitted · finalized · game committed')
    && admin.includes('Gameplay-vault checkpoints')
    && admin.includes('Made Ladder latest · Broker seven-day TWA')
    && admin.includes('Gameplay-vault upgrade control')
    && admin.includes('Transparent Proxy · non-upgradeable governor · Safe only')
    && admin.includes('Gameplay-vault upgrade queue')
    && admin.includes('exact package · 48-hour delay · cancel / execute / expire')
    && admin.includes('Gameplay-vault implementation monitor')
    && admin.includes('address · code hash · version · admin/governor drift')
    && admin.includes('Gameplay-vault upgrade validation')
    && admin.includes('OMR · liabilities · ruleset · nonces · pauses · bindings')
    && admin.includes('Gameplay-vault rollback proposal')
    && admin.includes('same evidence, delay, validation, and history')
    && admin.includes('Gameplay-vault controller rotation')
    && admin.includes('current release · new acceptance · controller generation')
    && admin.includes('Lost-wallet recovery board')
    && admin.includes('seven days · notifications · contest · Safe evidence review')
    && admin.includes('Gameplay-vault withdrawal state')
    && admin.includes('controller-only pull · server-independent · scoped pause')
    && admin.includes('Gameplay-vault unbonding tranches')
    && admin.includes('partial amounts · independent six-hour clocks · exposure')
    && admin.includes('Gameplay-vault OMR solvency')
    && admin.includes('actual receipt · liabilities · unattributed surplus · deficit incident')
    && admin.includes('Unbonding tranche policy')
    && admin.includes('earliest unlock first · max 16 · 0.01 OMR')
    && admin.includes('Withdrawable aggregation')
    && admin.includes('matured tranches · one balance · history preserved')
    && admin.includes('Unattributed OMR recovery')
    && admin.includes('Safe · fixed treasury · 48-hour proposal')
    && admin.includes('Fund gameplay-vault deficit')
    && admin.includes('permissionless · no player credit · excess unattributed')
    && admin.includes('Gameplay-vault deficit incident')
    && admin.includes('full liabilities · withdrawals paused · no haircut')
    && admin.includes('Gameplay-vault solvency sync')
    && admin.includes('pre/post checks · permissionless sync · incident generations')
    && admin.includes('Gameplay loss calculator')
    && admin.includes('execution-time buckets · floor rounding · signer ceilings')
    && admin.includes('Atomic gameplay settlement')
    && admin.includes('all buckets · one killer credit · full rollback')
    && admin.includes('Gameplay loot state')
    && admin.includes('idle balance · idle exposure · no automatic Broker weight')
    && admin.includes('Settlement authorization clock')
    && admin.includes('five-minute inclusion · future time rejected · finality may follow')
    && admin.includes('Prepared settlement journal')
    && admin.includes('off-chain · expiring · no victim or custody lock')
    && admin.includes('Gameplay settlement sequence')
    && admin.includes('unique event · exact victim nonce · zero loot consumes')
    && admin.includes('Settlement batching policy')
    && admin.includes('MVP one outcome · one transaction · one record')
    && admin.includes('Signer rotation policy')
    && admin.includes('routine five-minute overlap · emergency zero-grace revocation')
    && admin.includes('Permissionless settlement submission')
    && admin.includes('typed authorization · no submitter authority · no relayer registry')
    && admin.includes('Settlement spam defense')
    && admin.includes('caller-funded invalid calls · no mutation · no incident')
    && admin.includes('Community gas pool')
    && admin.includes('native-only non-upgradeable contract · separate from OMR/RWA custody')
    && admin.includes('Sponsor contribution terms')
    && admin.includes('final contribution · no refund, yield, priority, allocation, or governance')
    && admin.includes('Executor gas eligibility')
    && admin.includes('canonical event/nonce winner only · failed and losing calls zero')
    && admin.includes('Executor credit withdrawal')
    && admin.includes('pull-to-self · CEI/reentrancy guard · exact reserved liability')
    && admin.includes('Gas reimbursement formula')
    && admin.includes('measured audited cost · gas/data/wei caps · unreserved ETH')
    && admin.includes('Gas-pool depletion')
    && admin.includes('partial or zero credit · permissionless settlement remains open')
    && admin.includes('Gas-pool governance')
    && admin.includes('risk reductions immediate · increases, fee source, migration wait 48h')
    && admin.includes('Settlement finality threshold')
    && admin.includes('one public block count per chain · no per-action discretion')
    && admin.includes('Finality change policy')
    && admin.includes('every increase/decrease · Safe-only 48h · prospective effective block')
    && admin.includes('Settlement reorg recovery')
    && admin.includes('same event and nonce · canonical-absence proof')
    && admin.includes('Settlement evidence record')
    && admin.includes('bucket math · tranche use · killer credit · solvency')
    && admin.includes('Broker stake multiplier')
    && admin.includes('1.50× cap · 300 / 1k / 5k / 20k tiers')
    && admin.includes('Broker eligible stake')
    && admin.includes('active + committed only · finalized seven-day TWA')
    && admin.includes('Broker wallet uniqueness')
    && admin.includes('one wallet · one account · collisions score zero')
    && admin.includes('Broker stake checkpoints')
    && admin.includes('canonical prospective changes · no backfill')
    && admin.includes('Broker tier governance')
    && admin.includes('Safe only · seven-day notice · later full epoch')
    && admin.includes('Broker epoch ruleset')
    && admin.includes('frozen inputs · pause or cancel · never rewrite'),
  'the operator UI must show gameplay-vault controller recovery, pull withdrawals, tranche state, exact receipt, and solvency');
  console.log('✓ RWA budget is pre-vote fixed, MVP holdings are spot/units-first, and the OMR-staking rule is complete with implementation pending');
}

// ── GRAPH.md's own evidence, against the tree ───────────────────────────────────────────────────
//
// GRAPH.md exists to argue two things: that the engineering memory should be a graph, and that the
// largest fixed token cost is CLAUDE.md. Both arguments are carried entirely by measured figures —
// and every one of them had rotted in the same direction, understating the case:
//
//     CLAUDE.md      5,630 → 17,224 lines   (206% out; the log tripled underneath the sentence)
//     audit reports     57 → 96
//     levers           769 → 727 pinned     (a different metric, restated to the mechanical one)
//
// So the document written to argue for the lever was making the case at a third of its true size.
// That is the class this file exists for, and it is why the figures are now measured rather than
// remembered.
//
// THE BAND IS WIDER THAN SPEC'S 2%, DELIBERATELY. CLAUDE.md is append-only by design and grows by
// hundreds of lines in a working session, so a 2% band (344 lines) would fire on unrelated work —
// and a guard that nags on unrelated work gets deleted, which catches nothing. 10% still catches the
// drift that actually happened by a factor of twenty.
{
  const graphDoc = read('GRAPH.md');
  const figure = (label, re) => {
    const m = graphDoc.match(re);
    assert(m, `GRAPH.md no longer states ${label} in the expected form — the guard below has stopped `
      + 'checking anything. Update this test with the new wording.');
    return Number(m[1].replace(/,/g, ''));
  };
  const band = (claimed, real, what, tol) => assert(Math.abs(claimed - real) / Math.max(real, 1) < tol,
    `GRAPH.md says ${claimed} ${what}; it is ${real} — more than ${tol * 100}% out, so restate it. `
    + 'Its whole argument is carried by these numbers.');

  // Stated three times in the document; all three must move together, or §6's lever argument is
  // made against a size §2 has already contradicted.
  const claimedLog = [...graphDoc.matchAll(/\*\*?([\d,]{5,})\*?\*? ?lines?\b|\b([\d,]{5,})-line\b/g)]
    .map((m) => Number((m[1] || m[2]).replace(/,/g, '')));
  assert(claimedLog.length >= 3, 'GRAPH.md must state the CLAUDE.md line count where it argues from '
    + `it (§2 evidence, §4 aside, §6 token cost); found ${claimedLog.length} such figures`);
  const realLog = lines('CLAUDE.md');
  for (const c of claimedLog) band(c, realLog, 'lines in CLAUDE.md', 0.10);
  assert(new Set(claimedLog).size === 1,
    `GRAPH.md states the CLAUDE.md size as ${[...new Set(claimedLog)].join(' and ')} in different `
    + 'sections; one of them is stale and the two arguments disagree');

  // Audit reports move only when an audit is written — worth restating, so this one is exact.
  const audits = fs.readdirSync('.').filter((f) => /^AUDIT-.*\.md$/.test(f)).length;
  assert.equal(figure('the audit-report count', /\*\*(\d+) audit reports\*\*/), audits,
    `GRAPH.md's audit-report count is stale; the tree holds ${audits}`);

  // Levers move with ordinary balance work, so band rather than nag.
  //
  // Counted INSIDE the SIGNED array, not across the file. A whole-file count reads 735, because
  // test/levers.js also lists 8 levers that are inert with a stated reason — they are deliberately
  // not pinned, so folding them in would make GRAPH.md cite a register that is 8 larger than the one
  // the suite actually enforces. The bracket walk is what makes the two numbers the same number.
  const lev = read('test/levers.js');
  const open = lev.indexOf('const SIGNED = [');
  assert(open >= 0, 'test/levers.js no longer declares `const SIGNED = [` — the lever count below is '
    + 'measuring nothing. Update this test with the new register.');
  let depth = 0, close = -1;
  for (let i = open + 'const SIGNED = '.length; i < lev.length; i += 1) {
    if (lev[i] === '[') depth += 1;
    else if (lev[i] === ']' && (depth -= 1) === 0) { close = i; break; }
  }
  assert(close > open, 'the SIGNED register in test/levers.js never closes');
  const pinned = (lev.slice(open, close).match(/^\s*\['[A-Z][A-Za-z0-9_.]*',/gm) || []).length;
  assert(pinned > 500, `only ${pinned} pins found inside SIGNED — the extractor has stopped reading `
    + 'the register, and a count of nothing reads exactly like a count that agrees');
  band(figure('the signed-lever count', /\*\*([\d,]+) signed levers\*\*/), pinned, 'signed levers', 0.10);

  // §6 says the precondition for trimming the log has been met because the knowledge plane shipped.
  // If that plane is ever removed, the section is claiming a thing that no longer exists.
  assert(fs.existsSync('tools/knowledge.js') && fs.existsSync('knowledge/generated/graph.json'),
    "GRAPH.md §6 says the knowledge plane shipped and so the stated reason to defer trimming CLAUDE.md "
    + 'is spent; that claim requires tools/knowledge.js and knowledge/generated/graph.json to exist');

  console.log('✓ GRAPH.md argues from measured figures, not remembered ones');
}

// ═══ THE SMOKE-DEBRIS NOTE — a runbook line that makes two claims about code ══════════════════════
// DEPLOY.md §8's smoke check creates a real player on the live box, once per deploy, forever. The
// launch rehearsal found 10 of 12 entries on `/v1/live` were dead level-1 accounts from old smoke
// runs, and the fix at the time was a recency gate on the player-facing boards. That closed the
// board half and left the OTHER half unstated: the ops overview's headline counts have no recency
// gate, so smoke debris inflates the founder's own player figure permanently.
//
// The note now says both halves — and a note is prose, which rots. Two claims in it are checkable
// against code, so they are checked, and the guard is deliberately two-sided: it fails when the
// cited window drifts, AND it fails if somebody gates the overview, because then the warning is
// telling a reader a number is inflated when it no longer is. The correct response to that failure
// is to DELETE the warning, not to widen the check.
{
  const R = await import('../src/rules.js');
  const deploy = read('DEPLOY.md');

  const cited = deploy.match(/ages off the player-facing boards after `DISCOVERY\.SEEN_DAYS` \((\d+)\)/);
  assert(cited, 'DEPLOY.md §8 must state the window smoke debris ages off the boards after, citing DISCOVERY.SEEN_DAYS');
  assert.equal(Number(cited[1]), R.DISCOVERY.SEEN_DAYS,
    `DEPLOY.md §8 quotes DISCOVERY.SEEN_DAYS as ${cited[1]}; the live lever is ${R.DISCOVERY.SEEN_DAYS}`);

  // Half one: the boards really are gated, so "debris self-clears there and needs no sweep" is true.
  // Asserted at the CALL SITE, not at the lever — a helper that exists and is never called gates
  // nothing, which is exactly the shape the rehearsal found.
  for (const f of ['src/collision.js', 'src/discovery.js'])
    assert(/seenSince\(\)/.test(read(f)),
      `${f} must apply seenSince() — DEPLOY.md §8 tells the operator smoke debris ages off these boards`);

  // Half two: the overview's headline counts really are UNGATED, so "counts permanently" is true.
  const ops = read('src/ops.js');
  // BOTH quote styles, and that is load-bearing rather than tidy: a gated count MUST be
  // double-quoted, because the SQL then carries an interval literal with a quote inside it. A
  // single-quote-only reader loses the gated row from the corpus entirely, so the mutation that
  // matters fails at the COUNT assertion instead of at the one that names what changed — measured.
  const totals = [...ops.matchAll(/\b(total|alive|dead):\s*await one\((['"])((?:(?!\2).)+)\2/g)].map((m) => [m[1], m[3]]);
  assert.equal(totals.length, 3, `expected the three headline character counts in src/ops.js, saw ${totals.length}`);
  const gated = totals.filter(([, q]) => /last_accrued_at/.test(q)).map(([k]) => k);
  assert.equal(gated.length, 0,
    `src/ops.js now gates ${gated.join('/')} on recency — DEPLOY.md §8's warning that smoke characters `
    + 'count in the headline figure permanently is no longer true. Delete the warning rather than this check.');

  // Half three: "there is no sweep, and the obvious lever makes it worse". Both halves are
  // decidable. If a route ever CAN remove a character, the note is stale in the worst direction —
  // it would be telling an operator to live with debris a real remedy now clears. Comments are
  // stripped first: the rule is cited in prose in this very file, and a scanner that reads its own
  // explanation as a violation is the mostly-wrong advisory people route around.
  // walkSrc, never a flat readdir — its own header records the bug a flat listing reintroduces:
  // the guard goes QUIET when code moves into a subdirectory instead of failing.
  const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const removers = walkSrc('src').filter((f) => /DELETE\s+FROM\s+characters\b/i.test(stripComments(read(f))));
  assert.equal(removers.length, 0,
    `${removers.join(', ')} now deletes character rows — DEPLOY.md §8 tells the operator there is no `
    + 'sweep and to subtract smoke debris by name. Rewrite the note around the new remedy.');
  // …and the lever an operator would reach for really does add a row rather than remove one.
  assert(/INSERT INTO characters/.test(read('src/social/estate.js')),
    'src/social/estate.js must INSERT the heir — DEPLOY.md §8 warns that mod-kill raises `total` by one');
  assert(/runEstate\(/.test(read('src/routes/modtools.js')),
    'POST /v1/mod/kill must run the estate — DEPLOY.md §8 warns it creates an heir');

  console.log('✓ DEPLOY.md §8 states the smoke-debris window the code enforces, the asymmetry it warns about, and that no sweep exists');
}

// ─── INVARIANT_WEBHOOK_URL is not worker-only any more, and the runbook said it was ──────────────
// §5 told the operator "**Must be set on the WORKER process** — every automatic alarm lives there".
// That was true until `startWorkerWatch` shipped, and then it was false in the direction that leaves
// an outage undetected: the API now alarms on its own timer and is the ONLY process that can page
// when the worker is GONE, because a process cannot alarm on being dead. An operator following the
// old sentence literally sets the key on the worker, every other alarm works, and exactly the one
// covering a dark worker is mute — the shape that hid a 17h outage.
//
// The same false claim lived in render.yaml's comment and was corrected there; this is the sweep of
// that class to its second instance. Guarded two-sided: the doc must say BOTH services, and must not
// go back to saying worker-only. If the watchdog ever moves OFF the API the right response is to
// rewrite this note, not to widen the check — and that move is separately caught by test/gates.js,
// which fails if `startWorkerWatch` is defined in src/server.js and never called.
{
  const deploy = read('DEPLOY.md');
  assert(!/Must be set on the WORKER process/.test(deploy),
    'DEPLOY.md §5 says INVARIANT_WEBHOOK_URL must be set on the worker — since startWorkerWatch shipped '
    + 'the API alarms too, and it is the only process that can page when the worker is dead. Setting it '
    + 'worker-only leaves that alarm mute while every other alarm works.');
  assert(/Set it on BOTH processes/.test(deploy),
    'DEPLOY.md §5 must tell the operator to set INVARIANT_WEBHOOK_URL on BOTH processes');

  // …and the drill the note sends them to must exist, on the service it names.
  assert(/send test alert/.test(deploy) && /configured: true/.test(deploy),
    'DEPLOY.md must tell the operator to run the /admin alarm drill and require `configured: true` — '
    + 'a dashboard that renders proves the API is up, never that the alarm can leave the building');
  assert(/\/v1\/mod\/alert\/test/.test(read('src/routes/modtools.js')),
    'DEPLOY.md sends the operator to the alarm drill; POST /v1/mod/alert/test must exist');
  assert(/alert\/test/.test(read('public/admin.html')),
    'DEPLOY.md says the drill is a button on /admin — public/admin.html must call it');

  console.log('✓ DEPLOY.md states the webhook belongs on BOTH services, and the drill it names exists');
}

// ═══ THE POSTED-CLAIM LEDGER — the figures that leave the building ════════════════════════════════
// `MARKETING-POSTS.md` holds the drafts for Hacker News and the MCP registries. Its own header says
// these are the surfaces where "a wrong sentence travels furthest", and HN in particular punishes an
// inaccurate technical claim harder than it punishes an unfinished product — so of every document in
// this repository it is the one where a stale number costs the most, and it was the one with no
// guard at all. Four of its checkable claims had rotted, all understating the tree (~600 routes
// against 746, 100 suites against 148, 85 red-team reports against 97, 30 invariants against 34);
// understating is the safe direction to be wrong in and it is still wrong.
//
// TWO RULES, because each covers what the other cannot:
//   (a) every claim's PATTERN must still match the file — a reworded sentence must fail loudly here
//       rather than silently stop being covered, which is how prose guards quietly die;
//   (b) the number it captures must equal the tree, MEASURED. Routes come from SPEC's own row, which
//       test/routes.js already holds to the live app registry, so the two ends of the chain cannot
//       disagree without something failing.
//
// SPEC's Ledger-invariants row is checked here for the same reason it was found wrong: it sits one
// line under a size table every other row of which is machine-checked, and it said 18 named checks
// against a live 30. An unchecked row in a checked table is the easiest kind of figure to trust.
{
  const posts = read('MARKETING-POSTS.md');

  // Measured, never restated. `npm test` is the chain a reader means by "suites".
  //
  // Three counts of "suites" coexist in this repo and all three are correct about different sets, so
  // do NOT reconcile them by editing one to match another (measured 2026-08-29):
  //   148  the npm test CHAIN — 147 files in test/ plus tools/knowledge-test.js. This is the one a
  //        reader of the post means, because it is what running `npm test` executes.
  //   152  test/*.js at top level — THE SUITE LEDGER in test/gates.js (150 run + 2 declared). The
  //        five outside the chain run elsewhere: three *.postgres.js in CI's real-Postgres job,
  //        test/mcp.js under omerta-mcp's own npm test, and test/contextplus.js.
  //   153  test/**/*.js recursive — SPEC's size table. The extra is test/lib/srcfiles.js, a shared
  //        helper rather than a suite; the row is a file count, not a claim about how many run.
  const pkg = JSON.parse(read('package.json'));
  const suites = new Set(`${pkg.scripts.pretest || ''} ${pkg.scripts.test}`
    .match(/(?:test|tools)\/[\w.-]+\.js/g) || []).size;
  assert(suites > 100, `read only ${suites} suites out of the npm test chain — the extractor stopped `
    + 'seeing the script, and a count of nothing reads exactly like a count that agrees');

  // The red-team reports are AUDIT.md plus AUDIT-*.md at the root. `docs/AUDITS.md` is the INDEX and
  // `CHAIN-AUDIT-PACKET.md` is a packet for an auditor, so neither is a report. Same git-not-the-disk
  // discipline as the markdown count above, and for the same three reasons recorded there.
  let reports;
  try {
    reports = [...new Set(execFileSync('git', ['ls-files', '-z', '--cached', '--others',
      '--exclude-standard', 'AUDIT*.md'], { encoding: 'utf8' }).split('\0').filter(Boolean))].length;
  } catch {
    reports = fs.readdirSync('.').filter((f) => /^AUDIT.*\.md$/.test(f)).length;
  }
  assert(reports > 50, `found only ${reports} red-team reports — the extractor is not reading the root`);

  // The §10.4 sweep is counted by RUNNING it: `invariants.js` pushes one check per currency inside a
  // loop, so a static count of `push(` sites is a restatement of the implementation and is wrong.
  const { makeDb } = await import('../src/db.js');
  const { runLedgerInvariants } = await import('../src/invariants.js');
  const db = await makeDb();
  const { checks } = await runLedgerInvariants(db.pool || db, { alert: false });
  const named = checks.filter((c) => !/ conservation$/.test(c.name)).length;
  const conservation = checks.length - named;
  assert(checks.length > 20, `the §10.4 sweep emitted only ${checks.length} checks on an empty server`);

  // SPEC's own row, in the table whose every other row is already machine-checked.
  const specInv = spec.match(/^\| Ledger invariants \| \*\*(\d+)\*\* checks — \*\*(\d+)\*\* named[^|]*?\*\*(\d+)\*\* per-currency/m);
  assert(specInv, "SPEC.md's size table must state the ledger-invariant count in the checked form "
    + '"**N** checks — **N** named escrow/identity checks + **N** per-currency conservation"');
  assert.deepEqual([+specInv[1], +specInv[2], +specInv[3]], [checks.length, named, conservation],
    `SPEC says ${specInv[1]}/${specInv[2]}/${specInv[3]} ledger invariants (total/named/per-currency); `
    + `the sweep emits ${checks.length}/${named}/${conservation} — restate it`);

  // Routes ride SPEC's row rather than booting the app a second time: test/routes.js already holds
  // that row to `app.routes.length`, so crossing the post against SPEC crosses it against the app.
  const specRoutes = spec.match(/^\| HTTP routes \| \*\*([\d,]+)\*\*/m);
  assert(specRoutes, 'SPEC.md must state the route count in its size table (row "HTTP routes")');
  const routes = Number(specRoutes[1].replace(/,/g, ''));

  const CLAIMS = [
    ['routes (Show HN)', /All ([\d,]+) routes\nwork over HTTP/, routes],
    ['routes (registry listing)', /reaches all ([\d,]+) routes/, routes],
    ['the §10.4 sweep', /sweep runs nightly across ([\d,]+) invariants/, checks.length],
    ['red-team reports', /There are ([\d,]+) red-team reports/, reports],
    ['test suites', /proudest of: ([\d,]+) suites/, suites],
  ];
  const wrong = [];
  for (const [what, re, real] of CLAIMS) {
    const m = posts.match(re);
    // (a) the pattern must MATCH: a claim reworded out from under its check is the failure mode this
    // whole file exists for, so it fails here rather than passing over a sentence nothing reads.
    assert(m, `MARKETING-POSTS.md no longer states ${what} in the form this guard checks — either `
      + 'restore the wording or update the pattern, but do not leave a public claim unchecked');
    const claimed = Number(m[1].replace(/,/g, ''));
    if (claimed !== real) wrong.push(`${what}: the draft says ${claimed}, the tree has ${real}`);
  }
  assert.deepEqual(wrong, [], 'a draft meant for Hacker News and the MCP registries states a figure '
    + `the tree does not support:\n  ${wrong.join('\n  ')}`);

  // The install snippet is the one line a stranger PASTES, so the receipt beside it is held to the
  // package it names — a version or a tool list that has drifted would be a verification of software
  // nobody can install.
  const mcpPkg = JSON.parse(read('omerta-mcp/package.json'));
  assert(posts.includes(`\`${mcpPkg.version}\`, matching the version in`),
    `the clean-machine receipt must name omerta-mcp's current version (${mcpPkg.version})`);
  const tools = [...read('omerta-mcp/index.js').matchAll(/name: '(omerta_\w+)'/g)].map((m) => m[1]);
  assert(tools.length >= 5, `read only ${tools.length} tool declarations out of omerta-mcp/index.js`);
  const missing = tools.filter((t) => !posts.includes(`\`${t}\``));
  assert.deepEqual(missing, [], 'the clean-machine receipt lists the tools an MCP host will see, so '
    + `every tool the package declares must be in it:\n  ${missing.join(', ')}`);
  assert(posts.includes(`| \`tools/list\` | ${tools.length} tools:`),
    `the receipt must state the tool COUNT the package declares (${tools.length})`);

  console.log(`  ✓ the public drafts' ${CLAIMS.length} tree-claims are measured (${routes} routes, `
    + `${checks.length} invariants, ${reports} reports, ${suites} suites) and the MCP receipt matches `
    + `omerta-mcp@${mcpPkg.version}'s ${tools.length} tools`);
}
