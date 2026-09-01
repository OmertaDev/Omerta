// THE GATE MATRIX — sibling verbs must not forget a gate their twin enforces.
//
// This is the single most productive bug class in this project's history, and it keeps recurring
// because the gates live at each call site rather than in one place:
//   • `jump` was missing the unreachable-victim gates `fire` had (AUDIT-full-system-v3)
//   • `collectFrontier` was missing the signed D2 safehouse gate `collectTerritory` enforces
//     (AUDIT-world-frontier F1)
//   • `npcHit` was blind to the Pen shields, so a $25k burner beat the yard boss's protection
//     (AUDIT-the-pen-step-two)
//   • `payProtection` let a PROTECTED inmate shank with impunity (AUDIT-the-pen)
// Every one of those was found by a person noticing an asymmetry. This asserts the asymmetry away.
//
// WHAT IT CHECKS. Each FAMILY below declares the gates every member must enforce, and why. A gate
// counts as enforced if the function calls the helper, reaches it through an `assert*` helper it
// calls (the `assertStreetCrime` pattern — the RIGHT way to share a gate set), or writes the check
// INLINE against the same column. All three forms are live in the tree today; a matrix that saw
// only direct calls would report false positives and be ignored, which is worse than no check.
//
// AND IT CHECKS ITS OWN COMPLETENESS. A guard over a hand-written list quietly stops covering the
// code the moment somebody adds a verb — so the membership itself is derived and asserted: every
// street crime (anything routed through `assertStreetCrime`) and every `collect*` action must be
// declared in a family or exempted WITH a stated reason.
//
// Scope, honestly: this checks that a gate is REACHED, not that it is correct. `fire` calling
// `safeHoused(ch)` proves the shield is consulted, not that the comparison is the right way round.
import assert from 'node:assert';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const relPath = (from, to) => path.relative(from, to).replaceAll('\\', '/');

// Comments OUT before any capability or wall scan. A capability NAMED IN PROSE is not a capability,
// and a scanner that reads prose produces the mostly-wrong advisory people learn to route around —
// this file's own recorded class. One implementation, because two copies of a rule is how the two
// come to disagree. `//` is left alone after a colon so a URL in a string does not eat its own line.
const decomment = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const GATES = ['jailed', 'hospitalized', 'safeHoused', 'penSafe', 'inHole', 'witproActive'];
// The column each gate reads, so a hand-written inline check counts as enforcement. Matched as a
// PROPERTY ACCESS (`ch.safe_until`) rather than the bare column, because the bare name also appears
// in every `WHERE jail_until IS NULL` in the tree — and a query predicate is not a hand-rolled gate.
// Counting those would put two dozen board and sweep functions on the drift-hazard list, and an
// advisory that is mostly wrong gets ignored, which this file's own header calls worse than none.
// And matched as the gate's SHAPE — a date COMPARISON (`new Date(x.safe_until) > new Date()`),
// which is what the helper does. Display and pricing code reads the same column and SUBTRACTS
// (`(new Date(ch.safe_until) - Date.now()) / 1000`, `bribeGuard` costing a remaining sentence); that
// is not a second copy of the gate and listing it as one is how an advisory line becomes noise.
const shape = (col) => new RegExp(`new Date\\(\\s*[\\w.?\\[\\]'"]*\\.${col}\\s*\\)(\\.getTime\\(\\))?\\s*>`);
const INLINE = { safeHoused: shape('safe_until'), jailed: shape('jail_until'),
  hospitalized: shape('hosp_until'), penSafe: shape('pen_safe_until'),
  inHole: shape('hole_until'), witproActive: shape('witpro_until') };

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js') || e.name.endsWith('.mjs')) files.push(p);
  }
}(SRC));

// A function's body is its BRACE-MATCHED extent, not "up to the next export". Slicing to the next
// marker over-reads badly — `referralXpBonus` is the last `export function` in a 4,606-line
// rules.tail.js, so it would swallow every gate helper's own DEFINITION and be credited with all
// six. And an over-read makes the requirement check MORE PERMISSIVE (a verb credited with a gate it
// never reaches), which is the failure direction that turns a green run into a false clean bill.
// Scanner skips strings, template literals, comments and regex literals, since a `[{]` inside a
// regex would otherwise unbalance the count.
function bodyOf(src, from) {
  // Skip the PARAMETER LIST first by paren-matching. Taking the first `{` instead finds the default
  // parameter in `npcHit(h, ch, targetId, tierId, opts = {})` and yields a two-character body — which
  // reads as "this verb enforces nothing" and would fire on correct code.
  let i = src.indexOf('(', from);
  if (i < 0) return src.slice(from, from + 4000);
  for (let d = 0; i < src.length; i++) {
    if (src[i] === '(') d++;
    else if (src[i] === ')') { d--; if (!d) { i++; break; } }
  }
  i = src.indexOf('{', i);
  if (i < 0) return src.slice(from, from + 4000);
  const start = i;
  let depth = 0;
  let prev = '';                                     // last significant char, for regex-vs-divide
  for (; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (c === '/' && n === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue; }
    if (c === '/' && n === '*') { i = src.indexOf('*/', i) + 1; if (i < 1) break; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      for (i++; i < src.length; i++) {
        if (src[i] === '\\') { i++; continue; }
        if (src[i] === q) break;
        // a `${…}` inside a template can hold anything, including quotes and braces
        if (q === '`' && src[i] === '$' && src[i + 1] === '{') {
          let d = 1; i += 2;
          for (; i < src.length && d; i++) { if (src[i] === '{') d++; else if (src[i] === '}') d--; }
          i--;
        }
      }
      prev = q; continue;
    }
    if (c === '/' && /[(,=:[!&|?{};]/.test(prev)) {    // regex literal, not division
      for (i++; i < src.length; i++) {
        if (src[i] === '\\') { i++; continue; }
        if (src[i] === '[') { for (i++; i < src.length && src[i] !== ']'; i++) if (src[i] === '\\') i++; continue; }
        if (src[i] === '/') break;
        if (src[i] === '\n') break;                   // not a regex after all; bail rather than run away
      }
      prev = '/'; continue;
    }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (!depth) return src.slice(from, i + 1); }
    if (!/\s/.test(c)) prev = c;
  }
  return src.slice(from, start + 4000);               // unbalanced: fall back, never run to EOF
}

// ── extract every exported function with the gates it can reach ──────────────────────────────────
const fns = new Map();
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const marks = [];
  const re = /export\s+(?:async\s+)?function\s+(\w+)\s*\(/g;
  let m; while ((m = re.exec(src))) marks.push({ name: m[1], at: m.index });
  for (let i = 0; i < marks.length; i++) {
    const body = bodyOf(src, marks[i].at);
    // comments stripped FIRST: a gate merely discussed in prose is not a gate enforced, and this
    // file is dense with prose about gates.
    const code = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    let scope = code;
    const helpers = [];
    // Helpers are brace-matched too, for the same reason the caller is: a fixed-size window spills
    // past the helper's end into whatever function is declared next, and if THAT one gates something
    // the helper does not, every caller silently inherits credit for a gate it never reaches.
    // Measured on `assertStreetCrime`: a 2,000-char window over a 1,072-char helper carried 928
    // characters of a neighbouring function. Nothing is mis-credited today — the spill happens to
    // hold no extra gate — which is exactly why it had to be checked rather than assumed.
    for (const hm of code.matchAll(/(?<![\w$])(assert\w+|require\w+)\s*\(/g)) {
      const hi = src.search(new RegExp(`function\\s+${hm[1]}\\s*\\(`));
      if (hi >= 0) { scope += bodyOf(src, hi); helpers.push(hm[1]); }
    }
    // A THIN WRAPPER delegates its gates to the one function it returns — `robBusiness` and
    // `shakedownBusiness` are both a single `return extortFront(...)`, which is the one-core
    // discipline working exactly as intended, so refusing to follow it would make the matrix report
    // the RIGHT structure as a defect. Deliberately narrow: only a body that is nothing but that
    // one call. Following any called function would let a verb inherit a gate it never reaches and
    // turn this guard's passes into false negatives, which is the worse failure by far.
    const thin = code.match(/\{\s*return\s+(\w+)\s*\([^;]*\);?\s*\}\s*$/);
    if (thin) {
      const ti = src.search(new RegExp(`function\\s+${thin[1]}\\s*\\(`));
      if (ti >= 0) { scope += bodyOf(src, ti); helpers.push(thin[1]); }
    }
    const has = (g) => new RegExp(`(?<![\\w$])${g}\\s*\\(`).test(scope) || (INLINE[g] && INLINE[g].test(scope));
    fns.set(marks[i].name, { file: path.basename(f), scope, gates: new Set(GATES.filter(has)), helpers,
      inline: GATES.filter((g) => INLINE[g] && INLINE[g].test(code) && !new RegExp(`(?<![\\w$])${g}\\s*\\(`).test(code)) });
  }
}

// ── the families, and what each one's members must all enforce ───────────────────────────────────
const FAMILIES = [
  { name: 'street crime (offensive PvP)',
    why: 'you cannot work the streets from lockup, a hospital bed, or a safehouse — P1.3, "a shield, not a bunker"',
    require: ['jailed', 'hospitalized', 'safeHoused'],
    members: ['jump', 'fire', 'npcHit', 'stealCar', 'stealBoat', 'robTrunk', 'sabotage', 'robBusiness',
      'shakedownBusiness', 'takeoverBusiness', 'standoverSpeakeasy', 'raidRivalRacket', 'ambushConvoy', 'interceptRun'] },

  { name: 'PERSON crime (the mark must be reachable)',
    why: 'jail must never be MORE dangerous than the street — the class AUDIT-full-system-v2/v3 closed on '
       + 'fire/npcHit and v3 then closed on jump. Property crimes are deliberately NOT here: the garage '
       + 'does not go to lockup with its owner.',
    require: ['penSafe', 'inHole', 'witproActive'],
    members: ['jump', 'fire', 'npcHit', 'robTrunk'] },

  { name: 'collect income',
    why: 'BALANCE D2, SIGNED — collecting is an EXPOSED act; a man to ground does not walk the district. '
       + 'This is the exact gate collectFrontier was shipped without (AUDIT-world-frontier F1).',
    require: ['safeHoused'],
    members: ['collectBusiness', 'collectTerritory', 'collectFrontier', 'collectSov', 'collectSpeakeasy', 'collectRun', 'collectFamilyTribute', 'collectCorner'] },

  { name: 'debt enforcement',
    why: 'a lender leaning on a defaulter is doing street work, so the ACTOR needs the street-work '
       + 'gates (AUDIT-loan-sharking MED: the dropped `hospitalized` helper betrayed the intent). '
       + 'The BORROWER stays reachable on purpose — this is a civil recovery, not an attack.',
    require: ['jailed', 'hospitalized', 'safeHoused'],
    members: ['collectLoan'] },

  { name: 'extraction / parking money out of reach',
    why: 'the loot-proof-vault rule: escrow a stranger cannot reach must not be openable from inside a '
       + 'safehouse, or wealth shelters itself and Make-Risk-Pay stops meaning anything',
    require: ['jailed', 'safeHoused'],
    // (D11 2026-08-05: `invest` left the family with the Portfolio — its tombstone throws
    //  before any gate could run, so there is no gate left to require of it)
    members: ['offerLoan', 'postOrder', 'claimVaulted', 'buyPaper'] },
];

let checked = 0;
for (const fam of FAMILIES) {
  for (const name of fam.members) {
    const fn = fns.get(name);
    assert(fn, `${fam.name}: declared member ${name}() is not an exported function any more — `
      + 'the family list has rotted, so this whole family is checking nothing');
    for (const g of fam.require) {
      assert(fn.gates.has(g),
        `${name}() [${fn.file}] does not enforce ${g}() — every other verb in "${fam.name}" does.\n`
        + `      why it matters: ${fam.why}`);
      checked++;
    }
  }
}
console.log(`✓ ${checked} gate requirements hold across ${FAMILIES.length} families`);

// ── COMPLETENESS: a new verb must not slip past the matrix by not being listed ───────────────────
// Anything routed through assertStreetCrime IS a street crime by construction.
const streetCrimes = [...fns].filter(([, v]) => v.helpers.includes('assertStreetCrime')).map(([k]) => k);
const declaredStreet = new Set(FAMILIES.find((f) => f.name.startsWith('street crime')).members);
const undeclared = streetCrimes.filter((n) => !declaredStreet.has(n));
assert.equal(undeclared.length, 0,
  `street crime(s) routed through assertStreetCrime but absent from the matrix: ${undeclared.join(', ')} — `
  + 'add them to the family (or the matrix silently stops covering the newest PvP verbs)');

// Every collect* action must be classified. EXEMPT needs a reason, so "it was inconvenient" cannot
// pass as one.
const COLLECT_EXEMPT = {
  collectContentSource: 'authored salvage emits only gameplay-inert exact-hash lots; the capability '
    + 'validator admits trade only through the separate cashless, same-hash barter manifest, while the '
    + 'source mutation itself enforces location, finite global budget, per-account epoch, and ownership caps',
  collectConvoy: 'gated at the route by district — the freight lands where it lands, and the '
    + 'safehouse block is enforced separately in the collect path',
  collectFrontierTribute: 'not an exported action',
};
// Classified means declared in ANY family, not just the income one — `collectLoan` is a collect
// verb whose gates belong to debt enforcement, and forcing it into the income family to satisfy
// the counter would assert the wrong requirement about it.
const declared = new Set(FAMILIES.flatMap((f) => f.members));
const strayCollect = [...fns.keys()].filter((n) => /^collect[A-Z]/.test(n)
  && !declared.has(n) && !COLLECT_EXEMPT[n]);
assert.equal(strayCollect.length, 0,
  `collect action(s) neither in the family nor exempted with a reason: ${strayCollect.join(', ')}`);
console.log(`✓ completeness: ${streetCrimes.length} street crimes and every collect* action are classified`);

// ── FAMILY 6: AGENT-EXCLUDED CASH FAUCETS, ENFORCED AT THE POINT OF PAYMENT ──────────────────────
// Recommended by the night economy red-team after it found two instances the five families above
// structurally could not see, because they are about WHO is paid rather than about reachability.
//
// The rule, and why it is a rule rather than a list: a handful of cash faucets exist specifically to
// reward a HUMAN for showing up — a login streak, a mentor's protégé stake, a crew's weekly job, a
// nightly window, the corner, the hustle. Agents are excluded from every one of them by standing
// posture, and that exclusion is the whole anti-Sybil argument for those faucets existing at all.
//
// AND IT MUST BE CHECKED AT THE POINT OF PAYMENT, which is the finding worth keeping: `agent_flag`
// is set by the account's OWN call to /v1/auth/agent-key, so it is mutable at any moment. A gate at
// formation time — "you may not be offered a mentorship if you are an agent" — reads state that can
// change before the money moves, and `mentor` shipped exactly that: form the tie as a human, flip
// the flag, collect $20,000. So membership is derived from the LEDGER WRITE, not from a hand list:
// any function that writes one of these reasons must reference agent_flag in the same scope.
const REWARD_PREFIXES = ['streak:', 'mentor:protege', 'crew:objective', 'primetime:', 'corner:', 'hustle:', 'firstblood:'];
// DECLARE-or-WAIVE (the NOT_API / COLLECT_EXEMPT discipline): a faucet on these prefixes either
// excludes agents at the point of payment, or says here why it does not. What the check enforces is
// therefore not "every participation faucet excludes agents" — that was never the standing posture,
// and asserting it would be inventing policy — but the thing that actually generalises: **the
// decision is made explicitly, and where it is made, it is made where the money moves.**
const FAUCET_WAIVED = {
  // A TRANSFER between two players out of the mentor's own earned cash, not a faucet — nothing is
  // created, so there is nothing for an agent to farm.
  mentorGift: 'a two-party transfer of the mentor\'s own cash, not a faucet',
  // ⚑ FOUNDER CALL, flagged 2026-08-11 (BALANCE.md § AGENTS AND THE PARTICIPATION FAUCETS). These
  // three pay a participation reward and do NOT exclude agents, while streak / crew-objective /
  // primetime / mentor do. Neither posture is obviously right: an agent that plays the corner is
  // playing the game, and the cash is non-extractable since the severance (it can never become
  // $OMR). Left as they ship rather than changed unilaterally — but now they are a decision on the
  // record instead of an omission nobody had noticed.
  claimCorner: 'not agent-excluded — founder call (petty, capped 5/day, non-extractable)',
  advanceHustle: 'not agent-excluded — founder call (level-scaled daily, non-extractable)',
  settleFirstBlood: 'not agent-excluded — founder call (once ever per street, non-extractable)',
};
const paysReward = (v) => REWARD_PREFIXES.some((p) => new RegExp(`reason: ['\`]${p}`).test(v.scope || ''));
// The anti-vacuity guard measures what the EXTRACTOR finds, before waivers — otherwise waiving
// everything would silently satisfy it, which is the failure mode it exists to prevent.
const allFaucets = [...fns].filter(([, v]) => paysReward(v));
assert(allFaucets.length >= 7,
  `the reward-faucet scan found only ${allFaucets.length} function(s) — the extractor has stopped seeing `
  + 'the ledger writes it keys on, so this family is checking nothing');
const faucets = allFaucets.filter(([n]) => !FAUCET_WAIVED[n]);
const leaky = faucets.filter(([, v]) => !/agent_flag/.test(v.scope || ''));
assert.equal(leaky.length, 0,
  `participation cash faucet(s) that never read agent_flag: ${leaky.map(([n, v]) => `${n}() [${v.file}]`).join(', ')}\n`
  + '      why it matters: these faucets exist to reward a human for showing up, and agents are excluded\n'
  + '      from every one by standing posture. Check the flag WHERE THE MONEY MOVES — a gate at\n'
  + '      formation time reads state the account can flip before it collects.');
console.log(`✓ ${faucets.length} participation cash faucets exclude agents at the point of payment `
  + `(${allFaucets.length - faucets.length} waived with a stated reason)`);

// ── the inline copies, COUNTED rather than silently tolerated ────────────────────────────────────
// A hand-rolled `safe_until` comparison is byte-equivalent to safeHoused() today. That is exactly
// the shape the extortFront/sackEmpire "one core, not a copy" lesson is about: the day the shield
// grows a second condition (a decree, a new state), the helper learns it and the copies do not.
const inlineSites = [...fns].filter(([, v]) => v.inline.length)
  .map(([k, v]) => `${k}() [${v.file}] inlines ${v.inline.join(', ')}`);
console.log(inlineSites.length
  ? `⚠ ${inlineSites.length} site(s) hand-roll a gate instead of calling the helper (equivalent today, a drift hazard):\n   - ${inlineSites.join('\n   - ')}`
  : '✓ no site hand-rolls a gate');

// ── THE PRIVATE COPY — the blind spot the inline advisory could not see ──────────────────────────
// The advisory above finds a date comparison written AT THE CALL SITE. It cannot find the far more
// common shape: a module that opens with its own `const jailed = (ch) => ...` and then calls it.
// To the extractor that is indistinguishable from calling the shared helper — `has()` sees
// `jailed(` and credits the gate — so twenty-six modules carried fifty-three private copies while
// this file reported sixteen problems and passed. That is the over-read direction, which is the
// dangerous one: it makes a requirement check MORE permissive and turns a green run into a false
// clean bill.
//
// So the three canonical names are RESERVED. Only their definition site may bind them; every other
// module imports. This is a hard assertion rather than an advisory because the tree is clean now,
// and because the whole point of collapsing the copies is that the next one must not be quiet.
const CANON = ['jailed', 'hospitalized', 'safeHoused'];
const DEFINES_CANON = {                                 // file → why it may bind the name
  'src/rules.tail.js': 'the definition site (the universal leaf, beside penSafe/inHole/witproActive)',
};
const copies = [];
for (const f of files) {
  const rel = relPath(process.cwd(), f);
  if (DEFINES_CANON[rel]) continue;
  const src = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const g of CANON) {
    // any binding of the name — `const jailed =`, `function jailed(`, `let jailed =`. A re-export
    // (`export { jailed } from ...`) binds nothing locally and is how social/shared.js keeps its
    // ~100 call sites working, so it is correctly not matched here.
    if (new RegExp(`(?:const|let|var)\\s+${g}\\s*=|function\\s+${g}\\s*\\(`).test(src)) {
      copies.push(`${rel} defines its own ${g}`);
    }
  }
}
assert.equal(copies.length, 0,
  'a canonical status predicate must be IMPORTED, never re-defined — a private copy is invisible to '
  + `the inline check above and cannot be fixed by fixing the helper:\n   - ${copies.join('\n   - ')}`);
console.log(`✓ no module re-defines ${CANON.join('/')} — every gate resolves to the one definition`);

// ── EVERY LOCATION GATE NAMES THE WAY OUT ────────────────────────────────────────────────────────
// A refusal that only says WHERE you should be leaves the player to go find the travel control,
// which is one screen out of twenty-five. Tester feedback 2026-08-11, verbatim: "if I try to do
// something in foundry but I can't cause I was in docs, I have to click through half of the tabs
// [...] before I find the tab where I even can move to a different location."
//
// Prose cannot be turned into a button, so `GameError` carries the destination as DATA and the
// client renders a one-tap "go there" from it. That works only if EVERY gate carries it — a single
// site that forgets is a refusal with no way out, and it looks identical to the others until a
// player hits exactly that one. So the payload is required here rather than remembered at 27 call
// sites, and a 28th written next month fails by name instead of shipping mute.
const DISTRICT_WAIVED = {
  // Not a location gate at all: the argument is a district NAME that doesn't exist, so there is
  // nowhere to send anyone. Travelling cannot help, and offering to travel would be a lie.
  'src/landmarks.js': 'bad district argument, not a wrong-location refusal — nowhere to travel to',
  // STREET DEEDS: the player PICKS the district for their new street from a list; 'district' means
  // "pick a valid one", not "you're in the wrong place" — there is no single destination to offer.
  'src/deeds.js': 'the caller chooses which district to claim in — a bad pick, not a wrong-location refusal',
};
const mute = [];
let districtGates = 0;
for (const f of files) {
  const rel = relPath(process.cwd(), f);
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/new GameError\(\s*'district'/g)) {
    districtGates++;
    // paren-match the whole argument list — the payload is the third argument and a `.slice(+200)`
    // window would run past the throw into the next statement's object literals and read as a pass.
    let i = src.indexOf('(', m.index);
    let d = 0; let end = i;
    for (; i < src.length; i++) {
      if (src[i] === '(') d++;
      else if (src[i] === ')') { d--; if (!d) { end = i; break; } }
    }
    const args = src.slice(m.index, end);
    if (!/district:/.test(args) && !DISTRICT_WAIVED[rel]) {
      mute.push(`${rel}:${src.slice(0, m.index).split('\n').length} — ${args.slice(0, 90)}…`);
    }
  }
}
// Anti-vacuity: if the extractor stops matching, "0 mute gates" is what a broken scan looks like.
assert(districtGates >= 20,
  `the location-gate scan found only ${districtGates} site(s) — the extractor has stopped seeing the `
  + 'throws it keys on, so this check is passing over code it never read');
assert.equal(mute.length, 0,
  `location refusal(s) that name the destination in prose but not in DATA, so the client cannot offer\n`
  + `      a one-tap way out (pass it as the third GameError argument: { district: <id> }):\n   - ${mute.join('\n   - ')}`);
console.log(`✓ all ${districtGates - Object.keys(DISTRICT_WAIVED).length} wrong-location refusals carry the `
  + 'destination as data — the client turns every one into a "go there" button');

console.log('✅ THE GATE MATRIX passed — every verb in a family enforces the gates its siblings do, '
  + 'checked through direct calls, shared assert helpers and inline column comparisons alike; the '
  + 'membership is derived from the code rather than trusted, so a new street crime or collect action '
  + 'cannot slip past unclassified; the sites that hand-roll a gate instead of calling the helper '
  + 'are named rather than quietly accepted; and no module may re-define a canonical predicate, which '
  + 'is the shape the inline check structurally cannot see. Scope: it proves a gate is REACHED, not '
  + 'that it is correct.');

// ── THE PRICE WALLS — every real-value rate, or a stated reason ─────────────────────────────────
// Four times now a caller-supplied price has reached a real-value ledger with nothing bounding it
// (the family buyback, the bank buy, the sell tax, the stock fill), and each time the fix was the
// same wall and each time the checks downstream read green throughout — because they compare two
// numbers BOTH derived from the bad price. That is the class this asserts away.
//
// The rule is narrow so it stays true rather than becoming noise: in the REAL-VALUE modules, an
// exported function that takes a price (or derives a rate from an amount and a quantity) must
// either enforce a continuity wall or be listed here WITH the bound that stands in its place. A
// player's asking price on a listing is in-game cash, not a rate against real value, so those
// modules are out of scope by construction rather than by waiver.
{
  const MODULES = ['treasury.js', 'community.js', 'bank.js', 'desk.js', 'vig.js', 'bonds.js'];
  // A function is walled if it throws/returns a price refusal, or reads a *_MAX_PRICE_JUMP bound.
  const WALLED = /price_sanity|price_unanchored|price_high|price_low|MAX_PRICE_JUMP|MIN_PRICE_FRAC|PRICE_FLOOR_BPS/;
  const WAIVED = {
    // Bounded by QUANTITY rather than rate, in two places at once: the anti-Ponzi tranche cap
    // (`committed + payout <= capacity`) bounds the off-chain path, and the REAL path books the
    // contract's own authoritative payout, which Solidity already bounded with `maxOmrPerEth`
    // (fail-closed at 0), MAX_DISCOUNT_BPS and dailyCapOMR. A rate wall here would be a fourth
    // bound on a path that has three.
    'bonds.js:recordBond': 'the tranche cap off-chain; maxOmrPerEth + discount ceiling + daily cap on-chain',
    // The price is not the caller's at all: it is the descending Dutch clock read off the auction
    // row (`auctionPriceAt`), clamped at both ends, so the reserve IS the floor. The caller supplies
    // a QUANTITY, itself clamped to the lot and the shelf. Nothing to be continuous with.
    'desk.js:recordAuctionBuy': 'the price is server-computed (the Dutch clock), not supplied',
  };
  const unwalled = [];
  let scanned = 0;
  // Comments OUT first (the shared `decomment`). A body slice runs to the next `export`, which
  // swallows THAT function's leading doc comment — so prose about a price would put a neighbour in
  // scope, and prose about a wall would credit one that isn't there. Both directions observed on
  // the first run, and the over-read is the dangerous one: it makes the check MORE permissive.
  for (const rel of MODULES) {
    const src = decomment(fs.readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8'));
    // split on exported function boundaries so each body is read whole and no wall is credited to
    // its neighbour (the sliced-body lesson — an over-read makes the check MORE permissive, which
    // is the direction that turns a green run into a false clean bill of health).
    const marks = [...src.matchAll(/^export (?:async )?function (\w+)\s*\(/gm)];
    for (let i = 0; i < marks.length; i++) {
      const name = marks[i][1];
      const body = src.slice(marks[i].index, i + 1 < marks.length ? marks[i + 1].index : src.length);
      const sig = body.slice(0, body.indexOf(')') + 1);
      // in scope: it is handed a price, or it derives a rate to store as one
      const takesPrice = /price/i.test(sig);
      const derivesRate = /price_(?:omr|eth)_per|round6\([a-z]+ \/ [a-z]+\)/.test(body) && /INSERT INTO/.test(body);
      if (!takesPrice && !derivesRate) continue;
      scanned++;
      if (WAIVED[`${rel}:${name}`] || WALLED.test(body)) continue;
      unwalled.push(`${rel}:${name}`);
    }
  }
  // Anti-vacuity: if the extractor stops matching, an empty `unwalled` is what a broken scan looks
  // like. Eight surfaces were walled by hand; the scan must still be finding them.
  assert(scanned >= 7,
    `the price-wall scan found only ${scanned} real-value rate surface(s) — the extractor has stopped `
    + 'seeing them, so this check is passing over code it never read');
  assert.equal(unwalled.length, 0,
    'real-value function(s) that take or derive a PRICE with nothing bounding it. A downstream check\n'
    + '      cannot catch this: it compares two numbers both derived from the bad price. Add a continuity\n'
    + `      wall against the last REAL print, or waive it here with the bound that replaces it:\n   - ${unwalled.join('\n   - ')}`);
  console.log(`✓ all ${scanned} real-value price surfaces are walled or waived with a stated bound`);
}

// ═══ THE CONNECTION LEDGER — a pooled client that is taken must be given back ═══
//
// Found by the red team of 2026-08-16, and it is this file's own class exactly: `sweepNpcWars` and
// `sweepFamilyAggro` each took a connection per due row and never released it, while the three
// sibling sweeps a few hundred lines DOWN THE SAME FILE all release in a `finally` — and so do the
// other 105 `pool.connect()` sites in src/. Two of 109.
//
// Why it earns a hard check rather than a note. A leaked pooled client is not one slow request: it
// is PERMANENT and CUMULATIVE for the life of the process, so the damage is not proportional to the
// mistake. Measured on real Postgres (pool max 3, five due rows): three connections leaked, the
// sweep then threw `timeout exceeded when trying to connect` ON ITSELF at row four, and the next
// job to ask for a connection failed the same way. In production the worker's pool is 20, and the
// worker is the process that owns the nightly §10.4 sweep, the drift alarm, the backup watchdog and
// every timed settlement — so the failure mode is the whole background half of the game stopping,
// silently, with the alarms that would have told you about it stopped too.
//
// The rule is deliberately narrow so it stays true: every `const x = await pool.connect()` must
// have an `x.release()` before its enclosing function ends. It does NOT check that the release is
// in a `finally` — a few sites legitimately hold a connection across a whole job (the advisory-lock
// pattern) and release it on a later path — because a rule that flagged those would be noise, and
// noise gets deleted. Taking one and never giving it back is the thing that has no defensible form.
{
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d)) {
    const p = path.join(d, e);
    if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p);
  } };
  walk(SRC);
  const leaked = [];
  let seen = 0;
  for (const f of files) {
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = /(?:const|let)\s+(\w+)\s*=\s*await\s+pool\.connect\(\)/.exec(lines[i]);
      if (!m) continue;
      seen++;
      const v = m[1];
      let released = false;
      // scan to the end of the enclosing top-level function: the next line that CLOSES at column 0
      for (let j = i + 1; j < lines.length && !/^\}/.test(lines[j]); j++) {
        if (new RegExp(`\\b${v}\\.release\\(\\)`).test(lines[j])) { released = true; break; }
      }
      if (!released) leaked.push(`${relPath(SRC, f)}:${i + 1} (${v})`);
    }
  }
  // Anti-vacuity: an empty `leaked` is also what a broken scanner looks like. The tree has >100 of
  // these, so if the extractor stops finding them the guard is passing over code it never read.
  assert(seen >= 100,
    `the pooled-connection scan found only ${seen} \`pool.connect()\` site(s) — the extractor has `
    + 'stopped seeing them, so this check is vacuous rather than clean');
  assert.equal(leaked.length, 0,
    'pooled connection(s) taken and never released. This is permanent and cumulative: once the pool\n'
    + '      is exhausted the process can never open another transaction, and for the WORKER that means\n'
    + '      the §10.4 sweep, the drift alarm and every timed settlement stop — silently.\n'
    + `      Add a \`finally { ${'${client}'}.release(); }\`:\n   - ${leaked.join('\n   - ')}`);
  console.log(`✓ all ${seen} pooled connections are released before their function returns`);
}

// ═══ THE HANDOVER LEDGER — a car changes hands STOCK ═════════════════════════════════════════════
//
// Six places move a car between characters: a market buy-now, an auction settle, a loan collect, the
// grace-forfeit sweep, a pink-slip race, and a theft. A car carries two kinds of flag that must not
// survive the handover — CONSENT (`race_limit`, `pink_slip`: the owner offered THIS car on the strip
// or for pinks, and the new owner never agreed to either) and a CONSUMABLE (`nos`: charges the old
// owner paid for). Five sites clear all three. The theft cleared only the two consent flags, and it
// read as deliberate because its own comment named only "the consent flags" — which is exactly how a
// sixth site diverges quietly (red team #6; the consent half of the same class was found by
// AUDIT-street-races-step-two, so this is the second finding here and the reason it gets a check).
//
// The rule is narrow on purpose: it applies to a statement that RE-POINTS `character_id`, which is
// what a handover is. A waiver must say why. Scope: it proves the clause is PRESENT, not that the
// surrounding gate logic is right.
{
  const HANDOVER_WAIVED = {
    // The estate re-points only EXTRACTED cars/boats at the heir. Extraction already refuses a
    // listed or pledged row and clears the consent flags itself (`nft.js:KINDS[*].clear`), and an
    // extracted row is filtered out of `owned.cars` entirely — so there is no flag left to clear and
    // nothing that reads one.
    'social/estate.js': 'the estate moves only minted_onchain rows, which extraction already cleared',
  };
  const MUST_CLEAR = { cars: ['race_limit', 'pink_slip', 'nos'], boats: ['rendezvous'] };
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d)) {
    const p2 = path.join(d, e);
    if (fs.statSync(p2).isDirectory()) walk(p2); else if (p2.endsWith('.js')) files.push(p2);
  } };
  walk(SRC);
  const bad = [];
  let handovers = 0;
  for (const f of files) {
    const rel = relPath(SRC, f);
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = /UPDATE (cars|boats) SET character_id\s*=/.exec(lines[i]);
      if (!m) continue;
      handovers++;
      if (HANDOVER_WAIVED[rel]) continue;
      const stmt = lines[i];
      const missing = MUST_CLEAR[m[1]].filter((c) => !new RegExp(`\\b${c}\\s*=`).test(stmt));
      if (missing.length) bad.push(`${rel}:${i + 1} keeps ${missing.join(', ')}`);
    }
  }
  assert(handovers >= 6,
    `the handover scan found only ${handovers} ownership transfer(s) — the extractor has stopped `
    + 'seeing them, so this check is vacuous rather than clean');
  assert.equal(bad.length, 0,
    'ownership transfer(s) that leave a flag behind. A car arrives on the strip its new owner never\n'
    + '      put it on, offered for pinks they never offered, or carrying nitrous somebody else paid for:\n'
    + `   - ${bad.join('\n   - ')}`);
  console.log(`✓ all ${handovers} vehicle handovers clear the consent flags and the consumable`);
}

// ═══ THE SCENERY LEDGER — a human status board must not rank NPCs ═════════════════════════════════
//
// The population layer makes a resident a REAL character: real `accounts`, real `characters`, real
// legends, dying through the ORDINARY estate. That is what lights up every board at once, and it is
// also what puts scenery on the boards meant to rank PEOPLE. The rule was already written down —
// "a future step that gives residents a legend must exclude them on that board at the same time" —
// and it was followed on five boards and forgotten on the rest, of which four were reachable:
//
//   • duels     — the ONE board with no `> 0` threshold: it ranks every living character on raw elo,
//                 and a resident's `duel_elo` DEFAULTS to ELO_START. Reproduced at 6 of 7 entries.
//   • bloodline — residents die normally, so each death writes a `bloodline` row; six generations of
//                 a boss-band line out-scored the only human on the server. Reproduced at score 520.
//   • heists    — `fillHeist` hires resident hands so a solo player can run crew content, and the
//                 success loop bumps `heists_pulled` for EVERY member row, hired ones included.
//   • feuds     — had NEITHER exclusion, and nothing in the vendetta swear consults `is_npc`.
//
// So this is catalogue-or-declare on the class rather than four patches: every exported *Leaderboard
// must exclude residents (`is_npc` / `npc_flag`), or be waived HERE with the reason it cannot rank
// one. It proves the exclusion is REACHED, not that the whole query is right — the same scope as the
// gate matrix. Agents are deliberately NOT part of this check: wire/world include them by a recorded
// decision, so folding the two rules together would make this one fire on a settled question.
const SCENERY_WAIVED = {
  // ranks GANGS, never characters — an NPC family is the scenery here, and each of these is already
  // bounded by a quantity a resident-run family cannot accrue (standing, turf, strongholds, $OMR).
  'sov.js:sovLeaderboard': 'ranks gangs by stronghold points; NPC families build none',
  'territory.js:territoryLeaderboard': 'ranks gangs by territory income; NPC families hold no turf',
  'world.js:frontierLeaderboard': 'ranks gangs by outposts held; NPC families hold none',
  'vanity.js:foundationLeaderboard': 'ranks gangs by foundation tier; NPC families hold no $OMR',
  'megaproject.js:familyBuildLeaderboard': 'ranks gangs by monument value; NPC families build none',
  'npcwar.js:conquestLeaderboard': 'ranks player gangs BY conquering NPC outfits — the NPCs are the subject',
  // account-only boards with no character join and no resident-reachable quantity
  'megaproject.js:builderLeaderboard': 'ranks accounts by monument value laid; residents contribute none',
  'crew.js:crewLeaderboard': 'ranks crews by member kills; residents never join a crew',
  'portfolio.js:portfolioLeaderboard': 'retired with D11 — the paper book no longer exists',
  'portfolio.js:familyPortfolioLeaderboard': 'retired with D11 — the paper book no longer exists',
  // the agent board's POSITIVE filter is the exclusion: a resident is not agent-flagged
  'growth.js:agentLeaderboard': 'ranks agent_flag accounts only, so a resident cannot appear',
};

{
  const bad = [], boards = [];
  for (const f of files) {
    const rel = relPath(SRC, f);
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/export async function (\w*[Ll]eaderboard)\s*\(/g)) {
      const name = `${rel}:${m[1]}`;
      boards.push(name);
      if (SCENERY_WAIVED[name]) continue;
      const body = bodyOf(src, m.index);
      // PER RANKING STATEMENT, not per body — the first cut asked only whether the exclusion appeared
      // ANYWHERE in the function, and a board with two queries (duels ranks an elo ladder AND a titles
      // board) passed with one of them guarded. That is the exact shape of the bug being fixed, so the
      // check has to be at least as fine-grained as the defect. A RANKING statement is one that reads
      // `characters` and ORDERs — which excludes the per-account steward lookups the JS-aggregating
      // boards do inside a loop over an already-filtered set, where demanding the clause is noise.
      const stmts = [...body.matchAll(/`([^`]+)`/g)].map((q) => q[1])
        .filter((q) => /\b(FROM|JOIN)\s+characters\b/i.test(q) && /ORDER\s+BY/i.test(q));
      const unguarded = stmts.filter((q) => !/is_npc|npc_flag/.test(q));
      if (unguarded.length) bad.push(`${name} (${unguarded.length} of ${stmts.length} ranking queries)`);
      else if (!stmts.length && !/is_npc|npc_flag/.test(body)) bad.push(name);
    }
  }
  // the waiver list is data too: a waived board that no longer exists is a stale exemption, and a
  // stale exemption is how a real board later inherits somebody else's reason.
  const stale = Object.keys(SCENERY_WAIVED).filter((k) => !boards.includes(k));
  assert.equal(stale.length, 0,
    `waived board(s) that no longer exist — stale exemption(s):\n   - ${stale.join('\n   - ')}`);
  assert(boards.length >= 40,
    `the leaderboard scan found only ${boards.length} board(s) — the extractor has stopped seeing them, `
    + 'so this check is vacuous rather than clean');
  assert.equal(bad.length, 0,
    'human status board(s) that do not exclude residents. The population layer makes a resident a real\n'
    + '      character with real legends, so scenery ranks on a board meant for people:\n'
    + `   - ${bad.join('\n   - ')}`);
  console.log(`✓ all ${boards.length - Object.keys(SCENERY_WAIVED).length} human status boards exclude `
    + `residents (${Object.keys(SCENERY_WAIVED).length} waived with a stated reason)`);
}

// ═══ THE WATCHER POISON LEDGER — a malformed log must never wedge a stream ════════════════════════
// The chain watchers share ONE isolation rule (`src/watcher.js:isolate`): a DETERMINISTIC data fault
// in a log is skipped so the cursor advances past it, and anything else re-throws so the cursor does
// NOT advance past a good event. That rule is only as good as the POISON list, and the list had been
// grown once, for the stream that prompted it — so `recordHarvestFee`'s codes sat outside it while
// `syncHarvestFees`' own comment promised the protection. Reproduced (red-team R31 F3): a dust
// harvest whose fee rounds to zero re-threw every tick, the cursor never moved, the good fee behind
// it never booked, and the Bank's revenue stopped permanently.
//
// So the list is catalogued rather than remembered: every GameError code a watcher recorder can
// throw is either POISON (skip it — it can never succeed) or waived HERE with the reason it must
// re-throw. A new recorder, or a new code on an existing one, fails this until somebody decides
// which it is. Scope: it proves each code is CLASSIFIED, not that the classification is right.
{
  const WATCHER = fs.readFileSync(path.join(SRC, 'watcher.js'), 'utf8');
  const poison = new Set(
    (WATCHER.match(/const POISON = new Set\(\[([\s\S]*?)\]\)/)?.[1] || '')
      .replace(/\/\/[^\n]*/g, '').match(/'([a-z_]+)'/g)?.map((s) => s.slice(1, -1)) || []);
  assert(poison.size >= 6, 'the POISON set could not be read out of src/watcher.js — this check is vacuous');

  // A code that MUST re-throw, with the reason. These are not data faults: retrying is the point.
  const WAIVED = {
    // recordStorePurchase deliberately HOLDS the cursor on a sku we no longer sell: real money
    // arrived for something unknown, so a human looks rather than the payment being skipped past.
    retired: 'a real payment for a retired sku must stop the stream, not be skipped',
    bad_sku: 'same — money arrived for a package this build does not know',
    // recordBond guards BOTH of these on `!onchain`, and the watcher always passes `onchainPayout`
    // (the chain is the source of truth for a real bond, and bypassing the backend tranche cap is
    // deliberately what stops a real bond stalling this very cursor). Unreachable from a log.
    price: 'recordBond: !onchain only — the watcher books the event\'s own payout',
    over_capacity: 'recordBond: !onchain only — a real bond deliberately bypasses the backend tranche cap',
  };

  // the recorders each stream hands to isolate(), then every GameError code in their bodies
  const recorders = [...WATCHER.matchAll(/isolate\('[^']+',\s*\(\)\s*=>\s*([A-Za-z_]+)\(/g)].map((m) => m[1]);
  assert(recorders.length >= 10, `only ${recorders.length} watcher recorders found — the extractor is broken`);
  const unclassified = [];
  for (const fn of new Set(recorders)) {
    let src = null;
    for (const f of files) {                  // the tree-wide list built at the top of this file
      const text = fs.readFileSync(f, 'utf8');
      const at = text.search(new RegExp(`(export\\s+)?async function ${fn}\\s*\\(`));
      if (at >= 0) { src = bodyOf(text, at); break; }
    }
    assert(src, `watcher recorder ${fn} could not be located — the extractor is broken, not the code`);
    for (const m of src.matchAll(/GameError\('([a-z_]+)'/g)) {
      const code = m[1];
      if (!poison.has(code) && !WAIVED[code]) unclassified.push(`${fn} → '${code}'`);
    }
  }
  assert.equal(unclassified.length, 0,
    'watcher recorder(s) can throw a code that is neither POISON nor waived. Whichever it is, decide:\n'
    + '      POISON = the log can never succeed, skip it and advance the cursor;\n'
    + '      waived = it must re-throw, and the stream stalls until a human looks.\n'
    + '      Leaving it unclassified means it re-throws by default, which wedges the stream forever:\n'
    + `   - ${unclassified.join('\n   - ')}`);
  console.log(`✓ every code ${new Set(recorders).size} watcher recorders can throw is classified poison or waived`);
}

// ═══ THE ISOLATION LEDGER — one poison stream must not starve the other ten ══════════════════════
//
// The worker tick fans out to ~60 independent jobs and isolates each one with `safe()`, so a poison
// row in one cannot starve the rest. The CHAIN-SYNC tick did not: eleven watcher syncs, the stock
// delivery keeper, and the two DEX bots all sat inside ONE try/catch. A throw in the first sync
// skipped every job below it — including the two bots that RT#4 had individually `safe()`-wrapped
// for exactly this reason, so that fix was silently bypassed by an outer catch one level up (red
// team #8). The failure mode is the recorded one: the fee stream wedges, and the bond sync, the
// deed transfers, the delivery keeper and both real-money keepers stop with it, every tick, quietly.
//
// The rule is narrow so it stays true: inside `startWorker`, every awaited call to a `sync*` /
// `run*` / `sweep*` job must be wrapped in `safe(...)`. It says nothing about what a job does with
// its own errors — only that ONE job's throw cannot take its siblings down with it.
//
// The second half is what makes the first half real: `safe()` returns NULL on failure, so a caller
// that immediately dereferences the result (`c.processed`) turns a contained failure back into an
// uncontained TypeError, landing in the same outer catch the wrap was meant to avoid. Every read of
// a wrapped result must be optional-chained.
{
  const src = fs.readFileSync(path.join(SRC, 'worker.js'), 'utf8');
  // the worker's two ticks live inside the main-module guard, not a named export
  const at = src.search(/if \(process\.argv\[1\] && process\.argv\[1\]\.endsWith\('worker\.js'\)\)/);
  assert(at >= 0, 'the worker main-module block could not be located — the extractor is broken, not the code');
  const body = bodyOf(src, at);

  // the tick harnesses themselves (`syncTick`, `guardedTick`, …) are declared IN this block; a job
  // is imported from a module, so anything locally declared is the harness and not a job.
  const local = new Set([...body.matchAll(/(?:const|let)\s+(\w+)\s*=/g)].map((m) => m[1]));
  const bare = [];
  let jobs = 0;
  for (const line of body.split('\n')) {
    if (!/\bawait\b/.test(line)) continue;
    for (const m of line.matchAll(/\b((?:sync|run|sweep)[A-Z]\w*)\s*\(/g)) {
      if (local.has(m[1])) continue;
      jobs++;
      if (!/\bsafe\(/.test(line)) bare.push(`${m[1]}()`);
    }
  }
  assert(jobs >= 60,
    `the worker-job scan found only ${jobs} job call(s) — the extractor has stopped seeing them, so `
    + 'this check is vacuous rather than clean');
  assert.equal(bare.length, 0,
    'worker job(s) run outside `safe()`. One throw then skips every job BELOW it in the same tick —\n'
    + '      which is how a wedged stream silently stops the settlements and keepers that follow it:\n'
    + `   - ${bare.join('\n   - ')}`);

  // and the null-deref half: a `safe()`-wrapped result read without `?.`
  const unsafeRead = [];
  const lines = body.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = /(?:const|let)\s+(\w+)\s*=\s*await\s+safe\(/.exec(lines[i]);
    if (!m) continue;
    const v = m[1];
    for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
      if (new RegExp(`(?:const|let)\\s+${v}\\s*=`).test(lines[j])) break;   // rebound
      const hit = new RegExp(`\\b${v}\\.\\w`).exec(lines[j]);
      if (!hit) continue;
      // What is unsafe is a deref that runs UNCONDITIONALLY. `?.` is one way to be safe; a
      // truthiness test between the binding and the read is the other, and it takes several shapes
      // here (`if (r) …r.toWindow`, `if (s?.converted > 0) …s.season`, `arch && arch.state`,
      // and multi-line `if (pop && …)`). So scope to the enclosing statement — walk back to the
      // and multi-line `if (pop && …)`, and derefs inside an `if (oh && …) {` block). So look at
      // everything between the binding and the read: if the code tested `v` anywhere in that span
      // it cannot be null at the deref. Scope limit: a deref that falls OUTSIDE an earlier guard's
      // block reads as guarded — the shape this catches is bind-then-deref, which is the one that
      // shipped.
      const stmt = lines.slice(i + 1, j).join('\n') + lines[j].slice(0, hit.index);
      const guarded = new RegExp(`\\b${v}\\s*(?:\\?\\.|&&)`).test(stmt)
        || new RegExp(`if\\s*\\(\\s*${v}\\s*[)&?]`).test(stmt);
      if (!guarded) unsafeRead.push(`${v} at line ${j + 1} of the worker main block`);
    }
  }
  assert.equal(unsafeRead.length, 0,
    '`safe()` returns NULL on failure, and these read the result without `?.` — so a CONTAINED\n'
    + '      failure becomes an uncontained TypeError in the very next statement, landing in the\n'
    + '      outer catch the wrap exists to avoid:\n'
    + `   - ${unsafeRead.join('\n   - ')}`);
  console.log(`✓ all ${jobs} worker jobs are isolated and every wrapped result is read null-safely`);
}

// ═══ THE STARTUP-ORDER LEDGER — a schedule you never reached is not a schedule ═══════════════════
//
// MEASURED IN PRODUCTION, 2026-08-29: the live worker went dark for 14 hours and `/health` reported
// `uptimeSeconds 50788, worker.beatAgoSeconds 50780` — a gap pinned at exactly 8 seconds across
// three readings hours apart. The beat happened ONCE, 8s after boot, and never again. That is not a
// crash and not a slow job; it is the signature of a first tick that never returned.
//
// The mechanism is an ordering, and it is worth stating because it reads as harmless:
//
//     await guardedTick();                 // ← hangs
//     setInterval(guardedTick, 3600_000);  // ← never reached, so NO INTERVAL OBJECT EVER EXISTS
//
// Not a skipped tick — no schedule at all, forever. And the process does not die: it stays alive on
// the pending top-level await, so the platform sees a healthy process and never restarts it. Worse,
// the in-flight guard's own `previous tick still running` warning can never fire either, because the
// interval that would have fired it was the statement below the hang. So the failure is SILENT from
// inside and from outside alike, on the one process that owns every alarm in the game — when the
// worker stops, the thing that would tell you has stopped too.
//
// Registered FIRST, the identical hang costs one tick instead of the whole schedule, and announces
// itself hourly. So the rule is exactly the defect and nothing wider: a guarded scheduler must not
// be INVOKED above its own `setInterval` registration. It says nothing about awaiting one below the
// registration — `await guardedSync()` is the last statement in the block and starves nothing.
//
// This is a SOURCE-level check, honestly labelled: the startup sequence lives inside
// `if (process.argv[1].endsWith('worker.js'))` with top-level await, so it is not importable and
// there is nothing to drive. The `pool.on('error')` tripwire in test/hardening.js is the precedent.
{
  const src = fs.readFileSync(path.join(SRC, 'worker.js'), 'utf8');
  const at = src.search(/if \(process\.argv\[1\] && process\.argv\[1\]\.endsWith\('worker\.js'\)\)/);
  assert(at >= 0, 'the worker main-module block could not be located — the extractor is broken, not the code');
  // COMMENTS ARE STRIPPED FIRST, and this check caught itself on the recorded lesson: the very
  // paragraph in worker.js explaining this ordering contains the string `await guardedTick()`, so
  // the first cut flagged its own documentation as the defect. `decomment` keeps the newline, so
  // reported line numbers still name the real line (there are no block comments in this block).
  const body = decomment(bodyOf(src, at));

  const inverted = [];
  const scheduled = new Set();
  for (const m of body.matchAll(/setInterval\(\s*(guarded\w+)\s*,/g)) {
    const fn = m[1];
    if (scheduled.has(fn)) continue;
    scheduled.add(fn);
    // its own invocation: `await guardedX(`, `void guardedX(`, or a bare statement call — but never
    // the declaration itself (`const guardedX = `) and never the registration we just matched.
    const call = new RegExp(`(?:await|void)\\s+${fn}\\s*\\(|^\\s*${fn}\\s*\\(`, 'm');
    const before = body.slice(0, m.index);
    const hit = call.exec(before);
    if (hit) {
      const line = before.slice(0, hit.index).split('\n').length;
      inverted.push(`${fn}() is called at line ${line} of the worker main block, `
        + `${before.slice(hit.index).split('\n').length - 1} line(s) ABOVE its own setInterval`);
    }
  }

  // Two-sided, because the two halves fail differently. Without the floor, DELETING a registration
  // silently shrinks the governed set to nothing and this reads exactly like a clean sweep.
  assert(scheduled.size >= 2,
    `the startup-order scan found only ${scheduled.size} guarded scheduler(s) — the worker registers `
    + 'the hourly tick and the chain poll, so either a schedule has been deleted or the extractor has '
    + 'stopped seeing them; this check is vacuous rather than clean');
  assert.equal(inverted.length, 0,
    'a guarded scheduler is INVOKED above its own setInterval. If that call hangs, the registration\n'
    + '      below it is never reached — no interval object is ever created, the process stays alive on\n'
    + '      the pending await, the platform sees a healthy process, and the in-flight guard that would\n'
    + '      have warned hourly was itself the statement that was skipped. Fire the first run BELOW the\n'
    + '      registration (and un-awaited, so nothing after it is starved either):\n'
    + `   - ${inverted.join('\n   - ')}`);
  console.log(`✓ all ${scheduled.size} guarded worker schedulers are registered before they are first run`);

  // AND THE WATCHDOG MUST NAME WHERE IT IS STUCK. Ordering keeps the schedule alive; this is the other
  // half — what the operator reads at 3am. Measured in production 2026-08-29: the heartbeat (job 1) and
  // the fair-draw stamp (job 2) both landed and nothing among the other 119 ever did, so "a tick has
  // been running 14 hours" left the reader to guess which. Three claims, because the first two are each
  // blind to the third: safe() must RECORD the label, the watchdog must PRINT it, and no safe() may nest
  // inside another — a nested call's finally would clear the label while its parent is still running,
  // so the watchdog would name nothing at exactly the moment it is needed.
  {
    // Comments are stripped here too, and for the reason this file has been bitten by twice: the
    // paragraph in worker.js explaining the watchdog NAMES `currentJob`, so a scan of raw source
    // would match its own documentation and pass over a watchdog that had stopped printing it.
    const code = decomment(src);
    const w = code.slice(code.search(/const guardedTick = async/));
    assert(/currentJob\s*=\s*label/.test(body),
      'safe() no longer records the job it is running (`currentJob = label`), so the watchdog below it '
      + 'can only report a duration — which is the state production was in on 2026-08-29');
    assert(/currentJob\s*\?/.test(w) || /\$\{currentJob/.test(w),
      'the worker watchdog no longer prints the job it is stuck in; a duration alone leaves the reader '
      + `to guess which of ${(code.match(/safe\('/g) || []).length} jobs, which is the whole defect`);

    let nested = 0, seen = 0;
    for (const m of code.matchAll(/\bsafe\(/g)) {
      // balanced-paren slice of the call's own arguments, so a multi-line query stays one call
      let i = m.index + m[0].length, d = 1;
      for (; i < code.length && d > 0; i++) { if (code[i] === '(') d++; else if (code[i] === ')') d--; }
      const args = code.slice(m.index + m[0].length, i - 1);
      if (!args.startsWith("'")) continue;           // the definition itself, not a call
      seen++;
      if (/\bsafe\(/.test(args)) nested++;
    }
    assert(seen >= 100,
      `the nesting scan found only ${seen} safe() call(s) — the worker tick runs over a hundred, so the `
      + 'extractor has stopped reading it; this check is vacuous rather than clean');
    assert.equal(nested, 0,
      'a safe() job is nested inside another. The inner call\'s finally clears currentJob while the '
      + 'outer job is still running, so the watchdog reports no job for the one still in flight. Give '
      + 'the inner work its own name at the top level, or drop the label clear.');
    // AND A HANG MUST END. Ordering keeps the schedule alive and the label says where it stopped —
    // neither RECOVERS. The hourly interval fires, the in-flight guard skips it, and the worker does
    // nothing forever. Production supplied the missing half: `/health` said `stale: true` for 14.6
    // hours and nobody was polling it, so the remedy cannot be a log line. Bounded, the same hang
    // costs one restart. The window is asserted as a RELATION rather than a literal, because both
    // ends are real: too short and a legitimately long tick (the season rollover measures ~2 min at
    // 50,000 players) is killed on a capacity problem; too long and the remedy never arrives.
    // BOUNDED to the watchdog's own callback, deliberately. A slice to end-of-file reads any later
    // `process.exit(1)` in worker.js (there is one at the boot-failure branch) and the claim below
    // passes with the watchdog's own exit deleted — measured: mutation M1 SURVIVED exactly that way.
    const wdStart = w.search(/const watchdog = setInterval/);
    const wdEnd = w.indexOf('}, HANG_WARN_MS)', wdStart);
    assert(wdStart >= 0 && wdEnd > wdStart,
      'the hung-tick watchdog is gone from src/worker.js, so a tick that never returns leaves the '
      + 'worker dark forever — which is the state production was in for 14.6 hours on 2026-08-29');
    const wd = w.slice(wdStart, wdEnd);
    // `wdEnd` was found by matching the interval's own `}, HANG_WARN_MS)` terminator, so the period is
    // already proven to be HANG_WARN_MS; all that is left is to read what that constant is worth.
    const period = w.match(/HANG_WARN_MS\s*=\s*(\d+)\s*\*\s*60\s*\*\s*1000/);
    const warns = w.match(/HANG_EXIT_WARNINGS\s*=\s*(\d+)/);
    assert(/process\.exit\(1\)/.test(wd),
      'the worker watchdog no longer exits on a hung tick, so a hang is announced forever and never '
      + 'remedied — which is the state production was in for 14.6 hours on 2026-08-29');
    assert(period && warns, 'the hang bound is no longer two readable constants (HANG_WARN_MS x '
      + 'HANG_EXIT_WARNINGS), so this check cannot size it');
    const boundMin = Number(period[1]) * Number(warns[1]);
    assert(boundMin >= 15 && boundMin <= 60,
      `the hung-tick restart fires after ${boundMin}m. Under 15m it can kill a legitimately long tick `
      + '(the season rollover measures ~2m at 50,000 players — tools/workercost.js); over 60m the '
      + 'remedy arrives too late to be one. Re-measure the longest job before moving this.');
    console.log(`✓ the worker watchdog names the job it is stuck in, across ${seen} un-nested safe() `
      + `jobs, and restarts the process after ${boundMin}m`);
  }

  // ── AND SOMEBODY WATCHES THE WATCHER ────────────────────────────────────────────────────────────
  // A process cannot alarm on being dead, so every claim above is worth exactly nothing on the night
  // the worker does not come back — and that night has already happened: 14.8 hours dark on
  // 2026-08-29, with `/health` reporting `worker.stale: true` the whole time and nobody looking. A
  // field on an endpoint is not an alarm. The API is the only process that stays up when the worker
  // does not, so it is the one that has to shout, on the channel every other alarm already uses.
  {
    const api = decomment(fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8'));
    assert(/import\s*\{[^}]*\balertDrift\b[^}]*\}\s*from\s*'\.\/invariants\.js'/.test(api),
      "src/server.js calls alertDrift but does not import it — the watchdog would throw the first time "
      + 'the worker went dark, i.e. exactly when it is the only thing running');
    assert(/worker_heartbeat/.test(api),
      'the API no longer reads worker_heartbeat; nothing outside the worker can tell whether it is alive');
    // BOTH EDGES. The latch is what stops a dark worker paging every 15 minutes; the recovery line is
    // what tells an operator their restart worked. A latch without a recovery is a watchdog that cries
    // once and then goes as quiet as the thing it was watching — and worse, one that latches and never
    // unlatches goes PERMANENTLY quiet: the second dark episode never pages at all.
    //
    // Bounded to the callback BODY, deliberately. `let workerDarkAlerted = false;` is the declaration
    // and sits above it, so a tree-wide search for `= false` matches that and passes with the unlatch
    // deleted — measured: mutation M4 SURVIVED exactly that way. The declaration is not an edge.
    const wStart = api.search(/export function startWorkerWatch/);
    const wEnd = api.indexOf('\n}\n', wStart);
    assert(wStart >= 0 && wEnd > wStart,
      'the API no longer runs a worker watchdog, so nothing outside the worker can notice it stop — '
      + 'the state production was in for 14.8 hours on 2026-08-29');
    const watch = api.slice(wStart, wEnd);
    assert(/workerDarkAlerted\s*=\s*true/.test(watch),
      'the worker watchdog no longer latches, so a dark worker pages on every sweep of the interval '
      + 'until somebody mutes the channel — which is how a real alarm gets ignored');
    assert(/workerDarkAlerted\s*=\s*false/.test(watch),
      'the worker watchdog never unlatches, so it announces recovery to nobody AND never fires again: '
      + 'the second dark episode is silent. (test/hardening.js DRIVES both edges; this catches the '
      + 'shape regressing in a way that fixture happens not to reach.)');
    assert(/startWorkerWatch\(/.test(api.slice(wEnd)),
      'startWorkerWatch is defined and never CALLED — a watchdog nobody starts is prose. It must run '
      + 'in the main-module block beside the drain handler.');

    // ONE THRESHOLD, not two. `/health`'s `worker.stale` and the alarm answer the same question, and a
    // second copy of the number is how a dashboard and an alarm come to disagree about whether the
    // worker is alive — the restatement class this project keeps paying for.
    const uses = (api.match(/WORKER_STALE_SEC/g) || []).length;
    assert(uses >= 3, `WORKER_STALE_SEC is referenced ${uses} time(s): it must be declared and read by `
      + "BOTH /health and the alarm, or the two disagree about what 'stale' means");
    assert(!/ageSec\s*>\s*\d/.test(api),
      'a bare numeric staleness threshold is back in src/server.js — both readers must share the constant');
    console.log('✓ the API watches the worker heartbeat and shouts on the founder channel, one shared threshold');
  }
}

// ═══ THE CATALOG LEDGER — an object index is not an allowlist ════════════════════════════════════
//
// `if (!CATALOG[userInput]) throw` reads like a membership test and is not one: every JavaScript
// object inherits `__proto__`, `constructor`, `toString`, `valueOf` and `hasOwnProperty`, and each
// of those indexes TRUTHY. So the gate passes for exactly those keys and the value flows on.
//
// Found by the red team of 2026-08-17, driven through the real routes. Two of the five
// user-reachable gates were live defects: `KITCHEN.MODULES[modId]` reached a `lab_${modId}` COLUMN
// NAME and 500'd on it, and `MASTERY.TRAITS[traitId]` returned 200 and WROTE `trait_id='__proto__'`
// — permanently consuming the once-ever level-50 choice with a trait that then grants nothing.
// Injection was never possible (a quoted payload is not a prototype key, so the gate catches it),
// which is precisely what made the gate look adequate.
//
// The rule: a gate of the form `CATALOG[key]` where CATALOG is a module-level (SHOUTY) catalog and
// `key` is a variable must use `Object.hasOwn`. A waiver must say why the key cannot be
// user-supplied — a numeric index, a column read back out of our own database, a route name we
// generated. Scope: it proves the PREDICATE is right, not that the surrounding logic is.
{
  const CATALOG_WAIVED = {
    // key is a loop index over our own array, never a request field
    'chainparams.js:CHAIN_PARAMS': 'the key is a numeric index into our own array',
    // tier is an integer column read back out of account_persistent
    'pass.js:PASS.TRACK': 'the key is an integer tier read out of our own row',
    // district ids are validated upstream against DISTRICTS; the `|| []` fallback is already safe
    'rules.tail.js:DEEDS.NEIGHBORHOODS': 'district is validated upstream and the || [] fallback is safe',
    // the key is the route name WE registered, never a request field
    'server.js:ACTIVITY_WIRE': 'the key is a route name the server itself emitted',
    // trackId comes from MASTERY.TRACKS.find() at every call site; returns a neutral 1 either way
    'game.js:MASTERY.PERKS': 'trackId is resolved from the TRACKS catalog before it reaches here, and the miss path returns a neutral 1',
    // taskId is gated by the ONBOARD_TASKS lookup above it; returns a boolean, touches no SQL
    'verify.js:TASK_PROVIDER': 'taskId is gated upstream and the result is a boolean, never a column or a write',
  };
  const bare = [];
  const seenKeys = new Set();
  let gates = 0;
  for (const f of files) {                       // the tree-wide list built at the top of this file
    const rel = relPath(SRC, f);
    // line-based, so drop whole-line comments: prose about a gate is not a gate (the gate-matrix
    // extractor learned this the expensive way — an over-read is the permissive direction).
    const lines = fs.readFileSync(f, 'utf8').split('\n').map((l) => (/^\s*(\/\/|\*)/.test(l) ? '' : l));
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      // A gate reads one of two ways, and the extractor must see BOTH — a scanner that only knows
      // the broken form stops counting a site the moment it is fixed, so the guard silently shrinks
      // to nothing as the tree gets healthier. That is the vacuity trap wearing a new hat.
      const safe = [...l.matchAll(/Object\.hasOwn\(\s*([A-Z][\w.]*)\s*,\s*([a-z]\w*)\s*\)/g)];
      for (const m of safe) {
        gates++;
        seenKeys.add(`${path.basename(rel)}:${m[1]}`);
      }
      // …and the bare index form: `const x = CAT[key]` with an `if (!x)` in the next three lines,
      // or an inline `if (!CAT[key])`.
      const decl = /(?:const|let)\s+(\w+)\s*=\s*([A-Z][\w.]*)\[([a-z]\w*)\]/.exec(l);
      const inline = /if\s*\(\s*!\s*([A-Z][\w.]*)\[([a-z]\w*)\]/.exec(l);
      let cat = null; let key = null;
      if (inline) { cat = inline[1]; key = inline[2]; }
      else if (decl && new RegExp(`if\\s*\\(\\s*!\\s*${decl[1]}\\b`).test(lines.slice(i + 1, i + 4).join('\n'))) {
        cat = decl[2]; key = decl[3];
      }
      if (!cat) continue;
      const id = `${path.basename(rel)}:${cat}`;
      if (safe.some((m) => m[1] === cat)) continue;   // already counted above, and it IS the fix
      gates++;
      seenKeys.add(id);
      if (CATALOG_WAIVED[id]) continue;
      bare.push(`${rel}:${i + 1}  ${cat}[${key}]`);
    }
  }
  assert(gates >= 8,
    `the catalog-gate scan found only ${gates} gate(s) — the extractor has stopped seeing them, so `
    + 'this check is vacuous rather than clean');
  assert.equal(bare.length, 0,
    'catalog membership tested by INDEX rather than `Object.hasOwn`. `__proto__`, `constructor`,\n'
    + '      `toString`, `valueOf` and `hasOwnProperty` all index truthy, so the gate is decorative for\n'
    + '      exactly those keys — and what flows past it has reached a column name (a 500) and a write\n'
    + '      (permanent data corruption) before:\n'
    + `   - ${bare.join('\n   - ')}`);
  const stale = Object.keys(CATALOG_WAIVED).filter((k) => !seenKeys.has(k));
  assert.equal(stale.length, 0,
    `catalog gate waiver(s) for a gate that no longer exists — drop them: ${stale.join(', ')}`);
  console.log(`✓ all ${gates} catalog gates test membership, not truthiness `
    + `(${Object.keys(CATALOG_WAIVED).length} waived with a stated reason)`);
}

// ═══ THE ABI LEDGER — the backend's event signatures must match the contracts' ════════════════════
//
// Every watcher decodes a log through a `parseAbiItem('event …')` string written by hand, against a
// declaration that lives in a different language in a different directory. Nothing crossed them
// until RT#9 did it once, by eye, and found a drift: `HarvestFeeTaken`'s third parameter is `assets`
// on-chain and was `amount` in the backend. That one was inert — viem decodes POSITIONALLY, so both
// sides being wrong together still worked — which is exactly why it survived: it could only be
// caught by comparing the two declarations, never by running either.
//
// WHY THE PARAMETER NAME IS THE POINT. A type-only comparison passes the drift that actually hurts:
// a SAME-TYPED ADJACENT SWAP. `Bonded` has six adjacent non-indexed `uint256` (principal, payout,
// toPol, toDev, toRwa, toVig); `Delivered` has two adjacent `address indexed`; `Extracted` has two
// adjacent `string`. Swap any neighbouring pair and every type still lines up, the topic hash is
// unchanged, viem decodes without complaint — and the backend books the POL slice as the dev slice,
// or delivers stock to the token instead of the recipient. Only the names disagree, so the names are
// what this checks.
//
// The indexed flag is checked for a different reason: it decides whether a field arrives in `topics`
// or in `data`, so getting it wrong is not a mis-labelling, it is a decode that silently yields the
// wrong value for every field after it.
//
// AND THE READER, which is the half a declaration check cannot see. `parseAbiItem` says what the
// log contains; the mapper below it says which field to take. Fix one and not the other and the
// read is `undefined` — silently, since viem returns no such key rather than throwing. So the
// second half binds every `l.args.X` to the event its own `getLogs({ event: … })` names, and
// requires X to be a parameter that event declares. That is what makes the rename above safe to
// have done: the ABI and its reader are now checked against each other, not merely each against
// itself.
{
  // an event the backend watches that no contract in this repo declares. Each must name its real
  // source, because "not ours" is the only honest reason a signature has nothing to be checked
  // against — and an unexplained miss is how a typo'd event name would hide here forever.
  const ABI_EXTERNAL = {
    ModifyLiquidity: 'Uniswap v4-core IPoolManager — vendored dependency, not a contract of ours',
    Transfer: 'the ERC-721 standard event (OpenZeppelin IERC721), not declared in our sources',
  };

  const SOL = fileURLToPath(new URL('../omerta-contracts/src/', import.meta.url));
  const walkSol = (d) => fs.readdirSync(d, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walkSol(path.join(d, e.name)) : [path.join(d, e.name)]));

  // "event Name(type indexed name, …)" → a comparable shape. Solidity and the viem string use the
  // same grammar here, so ONE parser reads both — which is the point: two parsers could disagree
  // about the thing they exist to compare.
  const parseEvt = (sig) => {
    const m = /^\s*event\s+(\w+)\s*\(([\s\S]*)\)\s*;?\s*$/.exec(sig);
    if (!m) return null;
    const body = m[2].trim();
    const params = body ? body.split(',').map((p) => {
      const t = p.trim().split(/\s+/);
      return { type: t[0], indexed: t.includes('indexed'), pname: t[t.length - 1] === 'indexed' ? '' : (t.length > 1 ? t[t.length - 1] : '') };
    }) : [];
    return { name: m[1], params };
  };
  const fmt = (e) => `${e.name}(${e.params.map((p) => `${p.type}${p.indexed ? ' indexed' : ''} ${p.pname}`).join(', ')})`;

  const backendEvents = [];
  for (const f of files) {                       // the tree-wide src list built at the top of this file
    const s = fs.readFileSync(f, 'utf8');
    for (const m of s.matchAll(/parseAbiItem\(\s*'(event [^']+)'\s*\)/g)) {
      const e = parseEvt(m[1]);
      if (e) backendEvents.push({ file: relPath(SRC, f), ...e });
    }
  }
  const onchain = new Map();
  for (const f of walkSol(SOL).filter((f) => f.endsWith('.sol'))) {
    // strip line comments: a commented-out event declaration is not a declaration
    const s = fs.readFileSync(f, 'utf8').replace(/\/\/[^\n]*/g, '');
    for (const m of s.matchAll(/\bevent\s+\w+\s*\([\s\S]*?\)\s*;/g)) {
      const e = parseEvt(m[0]);
      if (!e) continue;
      if (!onchain.has(e.name)) onchain.set(e.name, []);
      onchain.get(e.name).push({ file: path.basename(f), ...e });
    }
  }

  assert(backendEvents.length >= 12,
    `the ABI scan found only ${backendEvents.length} backend event signature(s) — the extractor has `
    + 'stopped seeing them, so this check is vacuous rather than clean');
  assert(onchain.size >= 40,
    `the ABI scan found only ${onchain.size} contract event declaration(s) — it is not reading the `
    + 'Solidity sources, so every comparison below is against nothing');

  const drift = [];
  const unexplained = [];
  const seenExternal = new Set();
  for (const b of backendEvents) {
    const cands = onchain.get(b.name) || [];
    if (!cands.length) {
      if (ABI_EXTERNAL[b.name]) { seenExternal.add(b.name); continue; }
      unexplained.push(`${b.file}  ${fmt(b)}`);
      continue;
    }
    if (cands.some((c) => fmt(c) === fmt(b))) continue;
    drift.push(`${b.file}\n       backend: ${fmt(b)}\n       onchain: ${cands.map((c) => `${fmt(c)}  [${c.file}]`).join('\n       onchain: ')}`);
  }

  assert.equal(drift.length, 0,
    'a watcher decodes a log against a signature the contract does not declare. viem decodes\n'
    + '      POSITIONALLY, so a name drift is silent until somebody renames one side and the reader\n'
    + '      destructures `undefined`; a same-typed ADJACENT SWAP is silent forever and books the\n'
    + '      wrong field:\n'
    + `   - ${drift.join('\n   - ')}`);
  assert.equal(unexplained.length, 0,
    'a watched event matches no contract declaration and is not listed as external. Either the name\n'
    + '      is a typo (in which case the stream is dead and nothing says so) or it belongs to a\n'
    + '      dependency and must say which:\n'
    + `   - ${unexplained.join('\n   - ')}`);
  const staleExternal = Object.keys(ABI_EXTERNAL).filter((k) => !seenExternal.has(k));
  assert.equal(staleExternal.length, 0,
    `external-event waiver(s) for an event nothing watches — drop them: ${staleExternal.join(', ')}`);

  console.log(`✓ all ${backendEvents.length - seenExternal.size} watched event signatures match their `
    + `contract declaration on type, indexed-ness AND parameter name (${seenExternal.size} external)`);

  // ── the reader half: every `l.args.X` must be a field the event it decodes actually declares ────
  // Both decoders in the tree share one idiom — `getLogs({ …, event: someEv })` and then `l.args.X`
  // below it — so a read binds to the nearest event named before it.
  const argDrift = [];
  let argReads = 0;
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    const declared = new Map();                  // local var → the params its event declares
    for (const m of src.matchAll(/(?:const|let)\s+(\w+)\s*=\s*parseAbiItem\(\s*'event \w+\(([^']*)\)'\s*\)/g)) {
      const ps = m[2].trim() ? m[2].split(',').map((p) => p.trim().split(/\s+/).pop()) : [];
      declared.set(m[1], ps);
    }
    if (!declared.size) continue;
    const lines = src.split('\n').map((l) => (/^\s*(\/\/|\*)/.test(l) ? '' : l));
    let bound = null;
    for (let i = 0; i < lines.length; i++) {
      const e = /event:\s*(\w+)/.exec(lines[i]);
      if (e && declared.has(e[1])) bound = e[1];
      for (const m of lines[i].matchAll(/\b\w+\.args\.(\w+)/g)) {
        if (!bound) continue;                    // nothing named an event yet — not a decode we can bind
        argReads++;
        if (!declared.get(bound).includes(m[1]))
          argDrift.push(`${relPath(SRC, f)}:${i + 1}  reads .args.${m[1]}, but ${bound} declares (${declared.get(bound).join(', ')})`);
      }
    }
  }
  assert(argReads >= 20,
    `the log-reader scan found only ${argReads} \`.args.\` read(s) — the extractor has stopped seeing `
    + 'them, so the reader half of this ledger is vacuous rather than clean');
  assert.equal(argDrift.length, 0,
    'a log mapper reads a field its own event does not declare. viem returns no such key rather than\n'
    + '      throwing, so the value is `undefined` and books as NaN — a stream that looks quiet, not broken:\n'
    + `   - ${argDrift.join('\n   - ')}`);
  console.log(`✓ all ${argReads} decoded-log field reads name a parameter their own event declares`);
}

// ═══ THE LOCK LEDGER — one pair of rows, one order, everywhere ═══════════════════════════════════
//
// The most productive deadlock class in this project, and the only one that has been fixed the same
// way four separate times: two code paths take the same two `FOR UPDATE` locks in opposite orders.
// `pvpDice` locked street_tax before den_volume where the rest of the den locked them the other way;
// `refundPot` iterated funders unsorted; `payFamilyYield` locked the pool before the gangs while
// `runBuyback` writes it after them; the poker tournament locked its row before `poker_state`. Each
// was found by a person noticing an asymmetry, and each fix stated the canonical order in a comment —
// which is exactly as durable as the next person reading that comment.
//
// The sweep that produced this ledger found ONE surviving pair on a tree that had already had nine
// red teams over it: `callOutChamp` locked boxing_title→fighters where `acceptCallout` locks
// fighters→title. Its comment argued that was safe, on a precondition — "any counter-path that would
// lock this fighter must first block on the held caller char" — that `acceptCallout`, a function the
// same comment NAMED as canonical, violates in its own explicit words. Both were right about
// themselves and wrong about each other, which is the shape a per-site comment cannot catch.
//
// TWO RULES, and the second exists because the first is blind to it. (1) No pair of tables may be
// locked in both orders by any two transactions. (2) No SINGLETON may be locked before a `characters`
// row — because every player action already holds its own character via withCharacter before it ever
// reaches a pot, that implicit lock makes characters→singleton the universal order, and rule (1)
// cannot see a lock the enclosing wrapper took.
//
// SPLITTING ON TRANSACTION BOUNDARIES IS WHAT MAKES IT USABLE. A function may open several
// independent transactions — the ring sweep has two, a route-registration function has dozens — and
// concatenating them invents pairs no single transaction ever holds together. Without the split this
// sweep reported two false positives out of three, and a mostly-wrong advisory is worse than none.
{
  const files = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p);
    }
  })(SRC);

  // the global pots and singletons a player path reaches while already holding its own character row
  const SINGLETON = /^(street_tax|den_volume|desk_inventory|chain_reserve|bond_reserve|family_yield_pool|vig_prize_pool|stake_pool|event_fund|dev_fund|world_npcs|poker_state|stakes_state|futurity_state|population_state|loan_house|convoy_insurance|megaprojects|boxing_title|rwa_dividend_pool|rwa_family_dividend_pool|community_revenue|exchange_pool)$/;

  // A pair may be waived only with a reason that is a PROPERTY of the pair — never "it's rare" or
  // "the retry catches it", which are true of every deadlock and would waive the whole ledger.
  const WAIVED = new Map([]);

  const order = new Map();          // "a|b" → Set(sites that lock a before b)
  let segments = 0, singletonSites = 0, sequences = 0;
  const singletonFirst = [];

  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    const marks = [];
    for (const m of src.matchAll(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g)) marks.push({ name: m[1], at: m.index });
    for (let i = 0; i < marks.length; i++) {
      const body = src.slice(marks[i].at, i + 1 < marks.length ? marks[i + 1].at : src.length);
      for (const part of body.split(/query\(\s*['"`]BEGIN/)) {
        const seg = part.split(/query\(\s*['"`](?:COMMIT|ROLLBACK)/)[0];
        const locks = [];
        for (const q of seg.matchAll(/FROM\s+([a-z_]+)[^'`"]*?FOR\s+UPDATE/gi)) locks.push(q[1].toLowerCase());
        if (!locks.length) continue;
        segments++;
        singletonSites += locks.filter((t) => SINGLETON.test(t)).length;
        const site = `${relPath(SRC, f)}:${marks[i].name}`;
        // rule 2 — a pot taken before a character row, inside one transaction
        const firstChar = locks.indexOf('characters');
        if (firstChar > 0) {
          const early = [...new Set(locks.slice(0, firstChar).filter((t) => SINGLETON.test(t)))];
          if (early.length) singletonFirst.push(`${site} — ${early.join(', ')} before characters (${locks.join(' → ')})`);
        }
        // rule 1 — every ordered pair this transaction establishes
        if (locks.length < 2) continue;
        sequences++;
        const seen = [];
        for (const t of locks) {
          for (const p of seen) if (p !== t) {
            const k = `${p}|${t}`;
            if (!order.has(k)) order.set(k, new Set());
            order.get(k).add(site);
          }
          seen.push(t);
        }
      }
    }
  }

  // ANTI-VACUITY. Both floors matter and they fail differently: the first catches an extractor that
  // has stopped seeing `FOR UPDATE` at all, the second catches a SINGLETON list that has drifted off
  // the real table names — which would make rule 2 pass over every pot in the game while looking
  // exactly as clean as it does when it holds.
  assert(sequences >= 40,
    `the lock scan found only ${sequences} transaction(s) holding two or more locks — the extractor has `
    + 'stopped reading them, so this ledger is vacuous rather than clean');
  assert(singletonSites >= 30,
    `the lock scan matched only ${singletonSites} singleton lock site(s) — the SINGLETON list has drifted `
    + 'off the real table names, so rule 2 is checking nothing');

  const conflicts = [];
  for (const k of order.keys()) {
    const [a, b] = k.split('|');
    if (a >= b) continue;                                  // report each pair once
    const rev = `${b}|${a}`;
    if (!order.has(rev)) continue;
    if (WAIVED.has(`${a}|${b}`)) continue;
    conflicts.push(`${a} ↔ ${b}\n       ${a} first: ${[...order.get(k)].join(', ')}`
      + `\n       ${b} first: ${[...order.get(rev)].join(', ')}`);
  }
  assert.equal(conflicts.length, 0,
    'two transactions take the same pair of locks in opposite orders — an AB-BA deadlock. Postgres\n'
    + '      catches it and `deadlockToRetry` maps it to a retryable `contention`, so it costs a retry\n'
    + '      rather than money; what it costs for certain is that the canonical order is no longer one\n'
    + '      thing anybody can state. Take the order rather than argue for it — read the second row\n'
    + '      unlocked, lock in the canonical order, then re-verify under the lock:\n'
    + `   - ${conflicts.join('\n   - ')}`);

  assert.equal(singletonFirst.length, 0,
    'a singleton pot is locked BEFORE a character row. Every player action already holds its own\n'
    + '      character via withCharacter before it reaches a pot, so this inverts against every one of\n'
    + '      them at once — and the wrapper\'s lock is invisible to the pairwise rule above:\n'
    + `   - ${singletonFirst.join('\n   - ')}`);

  console.log(`✓ all ${sequences} multi-lock transactions agree on one order for each of ${order.size} pairs`
    + `, and no singleton (${singletonSites} lock sites) is taken before a character row`);
}

// ═══ THE CONNECTION-SHARING LEDGER — one client cannot run two queries at once ═══════════════════
//
// Found by PLAYING (2026-08-18): the hustle card offered a CHECK IN that always refused, and adding
// the missing gate to `hustleBoard` surfaced a DeprecationWarning that traced straight into
// `dayBoard`'s `Promise.all` — five board readers issued CONCURRENTLY on ONE pooled client.
//
// node-pg cannot execute concurrent queries on a single connection. It queues them today behind
// `Calling client.query() when the client is already executing a query is deprecated`, and it
// THROWS from pg@9. So the parallel form is a false optimisation in both directions: it buys no
// speed (the one connection serializes them regardless) and it carries a latent hard break. It is
// also self-disguising — `career.js`'s own comment called it "one batched pass", which is precisely
// the belief that makes somebody write the next one.
//
// The fix is never "give each reader its own connection": these run inside a request's transaction,
// so a second connection reads outside its snapshot, and acquiring N per request is the
// pool-exhaustion shape this project has already been bitten by twice (`bankPosition`, `/v1/bank`).
// Sequential is correct AND identical in speed.
//
// Scope, stated honestly: every executable `Promise.all` in src/ is unsafe BY DEFAULT. JavaScript's
// callable/alias forms make regex proof speculative: an async arrow, an object/class method, or a
// helper-built task bag can close over the same checked-out client without naming it in the call.
// The only passes are exact FILE + CONTENT site classifications below: a genuine pool fan-out or a
// non-PG (viem RPC) batch. New concurrency therefore fails until somebody classifies that exact
// call, and a moved/deleted/over-broad classification fails through the hit-count checks.
{
  // catalogue-or-declare: safe concurrency earns a waiver BY SITE with a reason — a new one has to
  // be classified rather than silently inheriting an exemption.
  // Keyed on FILE + a CONTENT mark inside the call's own argument, never a line number: the first
  // cut waived `src/chain.js:1533`, and a two-line COMMENT added 1,200 lines above it shifted the
  // site to :1535 and failed the build on an edit that changed nothing — a line-keyed waiver rots
  // on any edit above it (the preflight-restatement class, in a guard). Every waiver must MATCH
  // (the stale-waiver assert below), so a mark that stops matching fails loudly instead of leaving
  // a real pg site quietly waived.
  const SAFE_CONCURRENT_SITES = [
    { file: 'src/bank.js', mark: "'collateralOf', 'debtOf', 'maxDebtOf'",
      why: 'viem, five independent Alchemist market RPC reads' },
    { file: 'src/watcher.js', mark: 'event: mintEv, ...range(from, to)',
      why: 'viem, three independent fee-event RPC streams over one range' },
    { file: 'src/chain.js', mark: "opt(fees, 'mintFee'), opt(fees, 'respawnFee')",
      why: 'viem, two independent fee-contract RPC reads through the local opt helper' },
    { file: 'src/chain.js', mark: "opt(addr, 'sellTaxBps'), opt(addr, 'taxDevBps')",
      why: 'viem, four independent sell-tax RPC reads through the local opt helper' },
    { file: 'src/chain.js', mark: "functionName: 'polBps'", why: "viem, OmertaBond's three immutable bps" },
    { file: 'src/chainparams.js', mark: 'abi: abiFor(p), functionName: p.read',
      why: 'viem, independent control-room live-value RPC reads' },
    { file: 'src/v4oraclekeeper.js', mark: "functionName: 'MAX_WINDOW_MULT'",
      why: 'viem, one read-only oracle snapshot assembled from independent contract and block RPC reads' },
    { file: 'src/arena.js', mark: 'agentLeaderboard(pool, 25), agentEconomyStats(pool)',
      why: 'a genuine app pool; each reader acquires its own connection and no request snapshot is shared' },
  ];
  const waiverHits = new Map(SAFE_CONCURRENT_SITES.map((w) => [`${w.file}#${w.mark}`, 0]));
  const offenders = [];
  const ambiguous = [];
  let scanned = 0;
  // Acorn owns JavaScript grammar. Its tokens recover the exact argument span for content-bound
  // waivers; the AST decides whether a syntactic call is the static built-in member we audit.
  const unwrapExpression = (node) => {
    while (node && (node.type === 'ChainExpression' || node.type === 'ParenthesizedExpression')) {
      node = node.expression;
    }
    return node;
  };
  const staticPromiseAllMember = (callee) => {
    const member = unwrapExpression(callee);
    if (member?.type !== 'MemberExpression') return null;
    const object = unwrapExpression(member.object);
    if (object?.type !== 'Identifier' || object.name !== 'Promise') return null;
    if (!member.computed) {
      return member.property?.type === 'Identifier' && member.property.name === 'all' ? object : null;
    }
    const property = unwrapExpression(member.property);
    if (property?.type === 'Literal' && property.value === 'all') return object;
    if (property?.type === 'TemplateLiteral' && property.expressions.length === 0 &&
        property.quasis.length === 1 && property.quasis[0].value.cooked === 'all') return object;
    return null;
  };
  const argumentTokens = (call, tokens, sourceName) => {
    let q = tokens.findLastIndex((token) => token.type.label === ')' && token.end === call.end);
    if (q < 0) throw new Error(`${sourceName}: Acorn omitted the closing token for a CallExpression`);
    const close = tokens[q];
    let depth = 0;
    for (; q >= 0; q--) {
      const label = tokens[q].type.label;
      if (label === ')') depth++;
      else if (label === '(' && --depth === 0) return { open: tokens[q], close };
    }
    throw new Error(`${sourceName}: Acorn tokens did not balance a CallExpression`);
  };
  const promiseAllCalls = (src, sourceName = '<fixture>') => {
    const tokens = [];
    let ast;
    try {
      ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module', onToken: tokens });
    } catch (error) {
      error.message = `${sourceName}: ${error.message}`;
      throw error;
    }
    const calls = [];
    const visit = (node) => {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'CallExpression') {
        const promise = staticPromiseAllMember(node.callee);
        if (promise) {
          const { open, close } = argumentTokens(node, tokens, sourceName);
          calls.push({ at: promise.start, arg: src.slice(open.end, close.start) });
        }
      }
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) {
          for (const child of value) if (child?.type) visit(child);
        } else if (value?.type) visit(value);
      }
    };
    visit(ast);
    return calls.sort((a, b) => a.at - b.at);
  };

  const arenaPoolWaiver = SAFE_CONCURRENT_SITES.find((waiver) =>
    waiver.mark === 'agentLeaderboard(pool, 25), agentEconomyStats(pool)');
  assert(arenaPoolWaiver, 'the arena genuine-pool Promise.all retains its exact reviewed waiver');
  const exactWaiverHits = (waiver) => promiseAllCalls(
    fs.readFileSync(path.resolve(waiver.file), 'utf8'), waiver.file)
    .filter(({ arg }) => arg.includes(waiver.mark)).length;
  assert.equal(exactWaiverHits({ ...arenaPoolWaiver, file: 'src/opportunities.js' }), 0,
    'the stale opportunities.js provenance cannot consume the moved arena pool waiver');
  assert.equal(exactWaiverHits(arenaPoolWaiver), 1,
    'the live arena.js provenance consumes the exact genuine-pool waiver once');

  const balancedSource = "const x = Promise.all([')', /\\)/, `raw ) ${inside(')')}`]);";
  assert.equal(promiseAllCalls(balancedSource)[0]?.arg,
    "[')', /\\)/, `raw ) ${inside(')')}`]",
    'Promise.all argument extraction must ignore parentheses in lexical literals');

  // AST discovery contract. Positive fixtures are executable direct member calls regardless of
  // trivia, chaining, parentheses, or static computed access. Negative fixtures are inert source
  // text or a member VALUE, not a call.
  const discoveryCases = [
    { name: 'whitespace around dot', src: 'const x = Promise . all([one(), two()]);', want: 1 },
    { name: 'block comments between member segments and call',
      src: 'const x = Promise /* p */ . /* dot */ all /* call */ ([one(), two()]);', want: 1 },
    { name: 'line comments between member segments and call',
      src: `const x = Promise // p
        . // dot
        all // call
        ([one(), two()]);`, want: 1 },
    { name: 'computed single-quote access', src: "const x = Promise['all']([one(), two()]);", want: 1 },
    { name: 'computed double-quote access', src: 'const x = Promise["all"]([one(), two()]);', want: 1 },
    { name: 'optional dot member', src: 'const x = Promise?.all([one(), two()]);', want: 1 },
    { name: 'optional call', src: 'const x = Promise.all?.([one(), two()]);', want: 1 },
    { name: 'optional computed member', src: "const x = Promise?.['all']([one(), two()]);", want: 1 },
    { name: 'parenthesized member call', src: 'const x = (Promise.all)([one(), two()]);', want: 1 },
    { name: 'template-computed member', src: 'const x = Promise[`all`]([one(), two()]);', want: 1 },
    { name: 'executable template expression', src: 'const x = `raw ${Promise . all([one(), two()])}`;', want: 1 },
    { name: 'single-quoted appearance', src: "const x = 'Promise.all([one(), two()])';", want: 0 },
    { name: 'double-quoted appearance', src: 'const x = "Promise.all([one(), two()])";', want: 0 },
    { name: 'line-comment appearance', src: '// Promise.all([one(), two()])\nconst x = 1;', want: 0 },
    { name: 'block-comment appearance', src: '/* Promise.all([one(), two()]) */ const x = 1;', want: 0 },
    { name: 'regex appearance', src: 'const x = /Promise\\.all\\s*\\(/;', want: 0 },
    { name: 'regex statement after if block',
      src: 'if (ready) {} /Promise.all()/.test(text);', want: 0 },
    { name: 'regex statement after function declaration',
      src: 'function ready() {} /Promise.all()/.test(text);', want: 0 },
    { name: 'raw template appearance', src: 'const x = `Promise.all([one(), two()])`;', want: 0 },
    { name: 'dot member reference not called', src: 'const x = Promise.all;', want: 0 },
    { name: 'computed member reference not called', src: "const x = Promise['all'];", want: 0 },
  ];
  for (const fixture of discoveryCases) assert.equal(promiseAllCalls(fixture.src).length, fixture.want,
    `Promise.all AST discovery failed: ${fixture.name}`);
  assert.throws(() => promiseAllCalls('export const = broken;'), SyntaxError,
    'a parse failure must abort Promise.all auditing rather than silently returning no calls');

  // Function-form and indirection pressure tests. Safe concurrency is not inferred from a name: it
  // earns one exact content-bound waiver, which the fixture must consume. This is the contract the
  // live source scan below needs to enforce, rather than merely recognizing named declarations.
  const auditFixture = (src, waiver = null) => {
    const [{ arg } = { arg: '' }] = promiseAllCalls(src);
    const waived = waiver && waiver.file === 'fixture.js' && arg.includes(waiver.mark);
    return { offenders: waived ? 0 : 1, waiverHits: waived ? 1 : 0 };
  };
  const fixtureCases = [
    {
      name: 'async arrow db task bag',
      src: `const load = async (db) => {
        const tasks = { one: db.query('SELECT 1'), two: db.query('SELECT 2') };
        return Promise.all(Object.values(tasks));
      };`,
      want: { offenders: 1, waiverHits: 0 },
    },
    {
      name: 'object async method db task bag',
      src: `const loader = { async load(db) {
        const tasks = { one: db.query('SELECT 1'), two: db.query('SELECT 2') };
        return Promise.all(Object.values(tasks));
      } };`,
      want: { offenders: 1, waiverHits: 0 },
    },
    {
      name: 'class async method db task bag',
      src: `class Loader { async load(db) {
        const tasks = { one: db.query('SELECT 1'), two: db.query('SELECT 2') };
        return Promise.all(Object.values(tasks));
      } }`,
      want: { offenders: 1, waiverHits: 0 },
    },
    {
      name: 'renamed handle delegated to helper task builder',
      src: `const buildTasks = (store) => ({ one: readOne(store), two: readTwo(store) });
      async function loadCoverage(store) {
        const tasks = buildTasks(store);
        return Promise.all(Object.values(tasks));
      }`,
      want: { offenders: 1, waiverHits: 0 },
    },
    {
      name: 'genuine pool batch with exact waiver',
      src: `const loadArena = async (pool) => Promise.all([
        agentLeaderboard(pool, 25), agentEconomyStats(pool)
      ]);`,
      waiver: { file: 'fixture.js', mark: 'agentLeaderboard(pool, 25), agentEconomyStats(pool)' },
      want: { offenders: 0, waiverHits: 1 },
    },
    {
      name: 'non-PG viem batch with exact waiver',
      src: `const loadChain = async (rpc) => Promise.all([
        rpc.readContract({ functionName: 'one' }), rpc.readContract({ functionName: 'two' })
      ]);`,
      waiver: { file: 'fixture.js', mark: "rpc.readContract({ functionName: 'one' })" },
      want: { offenders: 0, waiverHits: 1 },
    },
  ];
  for (const fixture of fixtureCases) assert.deepEqual(auditFixture(fixture.src, fixture.waiver), fixture.want,
    `shared-client fixture failed: ${fixture.name}`);
  for (const f of files) {
    // Acorn parses every JS/MJS module, including files with no calls: a syntax failure aborts the
    // gate. Token offsets keep exact waivers and line reports tied to the original source.
    const src = fs.readFileSync(f, 'utf8');
    const shortFile = relPath(process.cwd(), f);
    for (const call of promiseAllCalls(src, shortFile)) {
      scanned++;
      const { at, arg } = call;
      const site = `${relPath(process.cwd(), f)}:${src.slice(0, at).split('\n').length}`;
      const waivers = SAFE_CONCURRENT_SITES.filter((w) => w.file === shortFile && arg.includes(w.mark));
      if (waivers.length > 1) { ambiguous.push(`${site} (${waivers.map((w) => w.mark).join(' | ')})`); continue; }
      if (waivers.length === 1) {
        const waiver = waivers[0];
        waiverHits.set(`${waiver.file}#${waiver.mark}`, waiverHits.get(`${waiver.file}#${waiver.mark}`) + 1);
        continue;
      }
      offenders.push(site);
    }
  }
  assert(scanned >= 8, `the Promise.all scan found only ${scanned} sites — the extractor has stopped `
    + 'reading src/, so a green run here would mean nothing');
  assert.deepEqual(ambiguous, [], 'one Promise.all matched multiple safe-concurrency waivers; the content marks are too broad:\n   '
    + ambiguous.join('\n   '));
  // A waiver must match EXACTLY one call: zero is stale; two means its content mark is broad enough
  // to let a future unrelated batch inherit the exemption.
  for (const [key, hits] of waiverHits) assert.equal(hits, 1,
    `the safe-concurrency waiver "${key}" matched ${hits} Promise.all sites — it must identify exactly one; re-classify, tighten, or delete it`);
  assert.deepEqual(offenders, [], 'an UNCLASSIFIED Promise.all may issue concurrent queries on a SHARED pg client. One '
    + 'connection cannot do that: node-pg queues them behind a deprecation warning today and THROWS '
    + 'from pg@9, and the parallel form buys no speed because the connection serializes them either '
    + 'way. Await them in sequence — do NOT hand each one its own connection (it would read outside '
    + `the request's transaction, and N connections per request is the pool-exhaustion shape):\n   - ${offenders.join('\n   - ')}`);
  console.log(`✓ all ${scanned} Promise.all sites are exact-classified as genuine-pool/non-PG concurrency; no shared pg client is waived by syntax inference`);
}

// ═══ THE WIRE LEDGER — a notification a player cannot read is a notification they never got ═══════
//
// `feedText` renders the wire, and its fallback prints the TYPE NAME: an unmapped `extortion` (a
// money demand with a deadline, on the URGENT tier) rendered as the literal word "extortion", and
// `witpro` as "witpro". Ninety-eight types were dark. Worse than dark is WRONG: several types are
// emitted with TWO shapes — the `me` NOTIFY (what happened to YOU) and the `streets` shout (what the
// town hears) — and a template written for one renders the other as `undefined`. `busted {from}` is
// somebody springing you from lockup; against the streets template it read "undefined got hauled in",
// telling a freed player they had been arrested.
//
// Two rules, and the second exists because the first is blind to it:
//   1. every notify() type has a feedText entry (catalogue-or-declare);
//   2. a type emitted with two DIFFERENT key sets must BRANCH — one template cannot honestly render
//      two shapes, and the failure is silent.
// Scope: it proves an entry EXISTS and BRANCHES, not that the sentence is right. That still needs a
// person reading the wire — which is how these were found.
{
  const CLIENT = fileURLToPath(new URL('../public/index.html', import.meta.url));
  const html = fs.readFileSync(CLIENT, 'utf8');
  const start = html.indexOf('function feedText(');
  assert(start > 0, 'feedText not found in the client — this check cannot run');
  const body = html.slice(start, html.indexOf('\n  }', html.indexOf('    };', start)));
  const known = new Set([...body.matchAll(/^\s{6}([a-z_0-9]+):\s*\(\)/gm)].map((m) => m[1]));
  assert(known.size > 150, `feedText yielded only ${known.size} templates — the extractor has stopped `
    + 'reading the client, so a green run here would mean nothing');

  // every notify(client, <who>, '<type>', <payload>) in src/, with its payload key set
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d)) {
    const p2 = path.join(d, e);
    if (fs.statSync(p2).isDirectory()) walk(p2); else if (p2.endsWith('.js')) files.push(p2);
  } };
  walk(SRC);
  const keysOf = (lit) => {
    let depth = 0, cur = '', parts = [];
    for (const ch of lit.replace(/^\{/, '')) {
      if ('([{'.includes(ch)) depth++;
      else if (')]}'.includes(ch)) { if (depth === 0) break; depth--; }
      if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
      cur += ch;
    }
    parts.push(cur);
    return parts.map((p2) => (p2.match(/^\s*([a-zA-Z_$][\w$]*)\s*(?::|$)/) || [])[1]).filter(Boolean).sort();
  };
  const shapes = new Map();   // type -> Set of "k1,k2" key signatures (both channels)
  const personal = new Set();  // types that reach the `me` channel — these MUST have a template
  let sites = 0;
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    const scan = (re, mine) => {
      let m;
      while ((m = re.exec(src))) {
        sites++;
        if (mine) personal.add(m[1]);
        const raw = m[2].startsWith('{') ? m[2] : '{' + m[2];
        const sig = keysOf(raw).filter((k) => k !== 'type').join(',');
        if (!shapes.has(m[1])) shapes.set(m[1], new Set());
        shapes.get(m[1]).add(sig);
        re.lastIndex = m.index + m[0].indexOf(m[1]) + m[1].length;   // never run past a later call
      }
    };
    scan(/notify\(\s*[a-zA-Z_$][\w$]*\s*,[^,]+,\s*'([a-z_0-9]+)'\s*,\s*(\{[\s\S]{0,400})/g, true);
    // A TERNARY TYPE was invisible to the pattern above: `[^,]+` cannot cross the comma in
    // `notify(client, victim.id, rob ? 'robbed' : 'shakedown', {…})`, so the whole call — both
    // branches — was never read. Three types shipped dark that way (`shakedown`, `campaign_done`,
    // `campaign_step`): a player leaned on for a cut of their own till was shown the literal word
    // "shakedown". Both arms are scanned, and the payload is taken from after the second literal,
    // since a ternary payload (`isSiege ? {…} : {…}`) belongs to whichever arm was chosen and the
    // shapes are unioned per type anyway.
    scan(/notify\([\s\S]{0,120}?\?\s*'([a-z_0-9]+)'\s*:\s*'[a-z_0-9]+'\s*,\s*(\{[\s\S]{0,400})/g, true);
    scan(/notify\([\s\S]{0,120}?\?\s*'[a-z_0-9]+'\s*:\s*'([a-z_0-9]+)'\s*,\s*(\{[\s\S]{0,400})/g, true);
    scan(/bus\.emit\(\s*'streets'\s*,\s*\{\s*type:\s*'([a-z_0-9]+)'([\s\S]{0,300})/g, false);
  }
  assert(sites >= 200, `the emit scan found only ${sites} sites — the extractor has stopped reading `
    + 'src/, so a green run here would mean nothing');

  // Rule 1 is scoped to the `me` channel ON PURPOSE. The field-stitcher (`who + type + target`) is
  // the DESIGNED renderer for ambient street news and reads acceptably there ("Vella seized docks").
  // It does not for a notification ABOUT YOU, where there is no who/target to stitch and the player
  // is simply shown the type name — which is how "extortion", "witpro" and "flipped" shipped.
  const dark = [...personal].filter((t) => !known.has(t)).sort();
  assert.deepEqual(dark, [], 'notification type(s) sent to a PLAYER that the wire cannot render — '
    + 'they are shown the literal type name instead of a sentence about what happened to them:'
    + `\n   - ${dark.join('\n   - ')}`);

  // rule 2: two distinct shapes need a branching template
  const MULTI_WAIVED = {
    // one shape carries a superset of the other's keys and the template reads only the shared ones,
    // so both render the same true sentence.
    world_raid_fail: 'both shapes carry npc; the template reads nothing else',
    heist_blown: 'both shapes carry job; the template reads nothing else',
    belt_ducked: 'both shapes carry challenger; the template reads nothing else',
    market_sold: 'both shapes carry kind and net; the template reads nothing else',
    family_retaliation: 'both shapes carry family; the template reads nothing else',
    vendetta_settled: 'the template reads no field at all',
    npc_pact_signed: "the template already falls back (`d.npc || 'an outfit'`)",
  };
  const unbranched = [];
  for (const [t, sigs] of shapes) {
    if (sigs.size < 2 || MULTI_WAIVED[t]) continue;
    if (!known.has(t)) continue;   // no template → the stitcher handles it, which is its job
    const tpl = (body.match(new RegExp(`^\\s{6}${t}:\\s*\\(\\)[\\s\\S]*?(?=\\n\\s{6}[a-z_0-9]+:\\s*\\(\\)|\\n\\s{4}\\};)`, 'm')) || [''])[0];
    if (!tpl.includes('?')) unbranched.push(`${t} — ${[...sigs].map((s) => `{${s}}`).join(' vs ')}`);
  }
  assert.deepEqual(unbranched, [], 'type(s) emitted with two DIFFERENT payload shapes whose feedText '
    + 'template does not branch. One template cannot render both, and the loser renders `undefined` '
    + '(`busted {from}` — somebody springing you from lockup — read as "undefined got hauled in"). '
    + `Branch on a key unique to each shape, or waive with the reason both are the same sentence:\n   - ${unbranched.join('\n   - ')}`);
  console.log(`✓ all ${personal.size} personal notification types render a sentence, and every `
    + `multi-shape type branches (${sites} emit sites, ${shapes.size} types)`);
}

// ═══ THE MONEY LEDGER — a refusal is the most-read line in the game ═══════════════════════════════
// `describe()` shows `body.message` FIRST, so the server's own sentence is what a player reads every
// time they cannot afford something — the single most common refusal there is. 158 of them
// interpolated the raw number, so the retainer read "$150000" and signing a fighter "$25000": debug
// output in a game that formats money on every other surface, and at that many digits genuinely hard
// to tell an order of magnitude apart at a glance. Driven and read out of the real client before it
// was called a defect.
//
// The rule is narrow on purpose: inside a GameError MESSAGE, a `$` immediately followed by an
// interpolation is a figure the player reads, and it must go through `usd()` — the one helper, which
// mirrors the client's own `fmt` so the two surfaces cannot disagree about the same number. 158
// copies of a formatting rule is how they came to disagree in the first place (the jailed/penSafe
// collapse, at 69 copies of three predicates).
//
// The first cut of this guard matched `GameError\('reason',\s*\`([^`]*)\`` — a backtick immediately
// after the reason, captured up to the NEXT backtick — and it had two blind spots that shipped three
// raw-money refusals right past it (a play session found them by reading the lines): (1) `[^`]*`
// TRUNCATES at the first NESTED template literal, so `$${premium}` inside `${cond ? \` … $${premium}\` : ''}`
// was never scanned; and (2) a message that is a TERNARY or any expression rather than a bare backtick
// (`GameError('treasury', occupied ? \`…\` : \`…\`)`) is not matched at all — and the tree has many
// such messages (drop.js, gangs.js, dynasty.js, economy.js). Both are closed by extracting the FULL
// balanced-paren argument list of every GameError call and scanning THAT for `$${...}` — which also
// keeps the ~65 legitimate `$${i+1}` SQL-placeholder builders out (they live outside GameError calls).
{
  const raw = [];
  let calls = 0;
  for (const f of files) {
    const s = fs.readFileSync(f, 'utf8');
    for (const m of s.matchAll(/\bGameError\(/g)) {
      // walk balanced parens (skipping string/template bodies so a `)` inside a message doesn't
      // miscount) to the close of this call's argument list, then scan the whole span.
      let i = m.index + m[0].length, depth = 1, str = null;
      const start = i;
      while (i < s.length && depth > 0) {
        const c = s[i];
        if (str) {
          if (c === '\\') { i += 2; continue; }
          if (c === str) str = null;
        } else if (c === "'" || c === '"' || c === '`') str = c;
        else if (c === '(') depth++;
        else if (c === ')') depth--;
        i++;
      }
      calls++;
      const args = s.slice(start, i - 1);
      for (const d of args.matchAll(/\$\$\{([^}]*)\}/g))
        raw.push(`${f}:${s.slice(0, m.index).split('\n').length} — $\${${d[1]}}`);
    }
  }
  // anti-vacuity: an extractor that has stopped seeing GameError calls reports zero problems and
  // reads exactly like a clean bill of health (the fourth time that shape has cost this project a
  // session). The tree carries ~2,000; a handful means the reader broke, not that the code got tidy.
  assert(calls > 1000, `THE MONEY LEDGER read only ${calls} GameError calls — the extractor is broken, `
    + 'not the tree. A scan that sees nothing passes for a clean sweep.');
  assert.deepEqual(raw, [], 'refusal message(s) interpolating a RAW money figure. A player reads this '
    + 'sentence — "$150000" is debug output, and at that many digits it is hard to tell from $1,500,000 '
    + `at a glance. Use \`usd(x)\` (one helper, mirroring the client's fmt) instead of \`$\${x}\`:
   - ${raw.join('\n   - ')}`);
  console.log(`✓ every money figure across all ${calls} GameError refusals is formatted for a player`);
}

// ═══ THE ARTICLE LEDGER — a name that already carries its own article ═════════════════════════════
// Same corpus, same reason: a refusal is the most-read line in the game, and a player reads the whole
// sentence rather than the figure alone. `The ${cfg.name} runs …` reads "The The Semi runs $2,000,000"
// on the apex rig, "The The Deep Run needs a boat that makes 24+ knots" on the deepest lane, and the
// PUBLIC Discord wire said "The The Volkov Bratva was routed on the frontier". It is not one typo:
// 105 of this game's catalogs hold at least one rung whose name begins with "The", so any catalog
// that grows one tomorrow breaks every sentence that names it — which is why the rule is a guard
// rather than a sweep of the instances that happened to surface.
//
// Narrow on purpose. Only an interpolated `.name`/`.title` counts — a catalog NAME is the thing that
// can supply its own article. A district id, a track word ("The engine is as built as it gets"), a
// role id and a money figure all read as an article followed by an interpolation and are none of them
// names, so a rule wide enough to catch them would be a rule people route around. The fix is
// `art(x)` / `art(x, 'A')` — ONE helper mirroring the client's own, because a judgement call per site
// is how the wave-10 attempt (drop the article on speakeasy tiers) failed to generalise: most rungs
// do NOT begin with "The", and "Panel Van runs $40,000" reads clipped.
{
  const bad = [];
  let names = 0;
  for (const f of files) {
    const s = fs.readFileSync(f, 'utf8');
    for (const m of s.matchAll(/GameError\('[a-z_]+',\s*`([^`]*)`/g)) {
      const line = () => s.slice(0, m.index).split('\n').length;
      // The corpus is the SENTENCES this rule governs — the ones already routed through the helper
      // PLUS the ones still hardcoding an article. Counting violations alone would floor at zero the
      // moment the tree is clean, so the anti-vacuity check below would be measuring nothing.
      for (const _ of m[1].matchAll(/\bart\(/g)) names++;
      for (const d of m[1].matchAll(/(^|[^\w])(the|a|an)\s+\$\{([^}]*)\}/gi)) {
        if (!/\.(name|title)\b/.test(d[3])) continue;           // not a catalog name — see above
        names++;
        bad.push(`${f}:${line()} — ${d[2]} $\{${d[3]}}`);
      }
    }
  }
  // anti-vacuity, and it fails differently from the money ledger's: that one catches an extractor
  // that has stopped seeing GameError at all, this one catches a NARROWING that has stopped seeing
  // interpolated names — after which every article in the tree passes and it reads as a clean sweep.
  assert(names > 20, `THE ARTICLE LEDGER found only ${names} article+name interpolations — the ` +
    'narrowing is broken, not the tree. A scan that matches nothing passes for a clean bill of health.');
  assert.deepEqual(bad, [], 'refusal message(s) hardcoding an article before a catalog NAME. 105 ' +
    'catalogs carry a rung that begins with "The", so this reads "The The Semi runs $2,000,000" the ' +
    'day that rung is the one refused. Use `art(x)` / `art(x, \'A\')`:\n   - ' + bad.join('\n   - '));
  console.log(`✓ all ${names} refusal messages naming a catalog rung let the NAME supply its own article`);
}

// ── the CLIENT half of the same rule ──────────────────────────────────────────────────────────────
// Wave 57 fixed 17 client lines by hand and left nothing behind it, so wave 62 found five more the
// same way — by driving a rung that happened to begin with "The". `describe()` said "at the The
// Gambler table" on the yard, "an The Iron Capital stands on The Docks" on a $1.2M stronghold,
// "rolled a The Full Confession" at the bench, and the Estate card read "You hold a The Compound."
// The server rule cannot see any of it: those sentences are built in public/index.html.
//
// Scope is the WHOLE client script, not just describe(), because the Estate card is a render — and
// it stays tractable for the same reason the server half does: only an interpolation naming a
// `.name`/`.title`/`*Name` counts. A district id, a role word and a money figure all read as an
// article followed by an interpolation and none of them is a catalog rung.
{
  const html = fs.readFileSync(fileURLToPath(new URL('../public/index.html', import.meta.url)), 'utf8')
    .replace(/^\s*\/\/.*$/gm, '');                       // prose describing the rule is not a violation
  const bad = [];
  let names = 0, raw = 0;
  for (const _ of html.matchAll(/\bart\(/g)) names++;      // the sentences already routed through the helper
  for (const d of html.matchAll(/(^|[^\w])(the|a|an)\s+\$\{([^}]*)\}/gi)) {
    raw++;
    if (!/(\.name\b|\.title\b|Name\b|Title\b)/.test(d[3])) continue;
    names++;
    bad.push(`${d[2]} $\{${d[3]}}  (line ${html.slice(0, d.index).split('\n').length})`);
  }
  // TWO floors, because they fail differently. `names` (the art() calls plus the violations) is the
  // corpus the rule GOVERNS — violations floor at zero the moment the tree is clean, so counting only
  // those would measure nothing forever. `raw` is the MATCHER: with the tree clean, blinding the
  // article pattern leaves every art() call standing and the first floor holds, so only a count of
  // what the pattern finds AT ALL tells a broken narrowing from a clean tree.
  assert(names > 20, `THE ARTICLE LEDGER (client) governs only ${names} sentences — the narrowing is ` +
    'broken, not the tree. A scan that matches nothing passes for a clean bill of health.');
  assert(raw > 20, `THE ARTICLE LEDGER (client) matched only ${raw} article+interpolation sites — the ` +
    'pattern itself is broken, and a matcher that finds nothing reads exactly like a clean tree.');
  assert.deepEqual(bad, [], 'client line(s) hardcoding an article before a catalog NAME. The client has ' +
    'its own `art(n, a)` at module scope — use it, and the name supplies its own article:\n   - ' + bad.join('\n   - '));
  console.log(`✓ all ${names} client lines naming a catalog rung let the NAME supply its own article`);
}

// ═══ THE RAW-KEY LEDGER — a catalog id is not a name ══════════════════════════════════════════════
// `describe()` has no catalog of its own, so a reply that sends a catalog `id` where a display NAME
// belongs leaves the client nothing to print but the key: "the payroll came off HOT" on the biggest
// co-op payout in the game, "the laundro is yours" on a racket purchase, "the Coast Guard took the
// deeprun run" on the wire. The fix is always the same and always at the SOURCE — send the name with
// the id — which is why this is a guard rather than a sweep: the class has been paid for six separate
// times now (npcName, taskLabel, goodName, the cartels, drugs+goods, and the twelve fixed here), each
// time in a system nobody had driven yet, and each time one verb of a loop already had it right while
// its siblings did not. `heists.js` sent `job.name` on the PLAN and the id on all five terminal
// replies; `races.js` still emits `race: tier.name` to the STREETS feed while the racer's own reply
// carried the id. The town was told the name and the man who did it was told a key.
//
// The rule: inside a player-visible payload — a `return {…}` or a `notify(…, {…})`, never a `ledger`
// or `track` row — a property `k: X.id` must be accompanied by a display name in the same literal
// (`name`, `title`, `label`, or `<k>Name`), or be DECLARED below with the property that makes it safe.
// Two things make it checkable rather than a matter of taste. A HANDLE is named by convention
// (`carId`, `heistId`, `character_id`) and is skipped outright — that convention is the discriminator,
// so a field named for the thing rather than for its id is asserting it IS the thing. And the waivers
// are keyed on (file, key) rather than on a line: a line-keyed waiver rots on any edit above it, which
// is what the connection ledger's viem waivers cost once already.
//
// Scope, stated because it is narrower than it looks: this proves a reply CAN be rendered without a
// raw key, not that the client renders it. The client half is the ACTION LEDGER in test/client.js,
// which drives the line and reads it back.
{
  // (file, key) → why this id needs no name beside it. A waiver is a claim about the FIELD, and each
  // one has to stay true: the stale check below fails if a waived site stops existing.
  const WAIVED = {
    'casino.js:futurity':   'a DB row id — the open card the client posts back to, never rendered as prose',
    'casino.js:tournament': 'a DB row id — the handle for the follow-up call',
    'market.js:listing':    'a DB row id — the handle a bid/buy/cancel posts back to',
    'market.js:cancelled':  'the DB row id of the listing just pulled — an acknowledgement, not a name',
    'races.js:grandPrix':   'a DB row id — the open race the entry posts back to',
    'stable.js:stakes':     'a DB row id — the open stakes race',
    'port.js:boat':         'a boats row id — the vessel is named by its own catalog elsewhere',
    'defense.js:guard':     'a CHARACTER id — the bodyguard hired, not a catalog rung',
    'population.js:band':   'an internal spawn return, never a player-facing reply',
    'favors.js:good':       'the client resolves it through goodName off the published /v1/rules catalog',
    'game.js:approach':     'published on /v1/rules; the client COMPARES it to pick a phrase, never renders it',
    'combat.js:intent':     'published on /v1/rules; compared, never rendered (the approach precedent)',
    'rules.tail.js:rarity': 'a catalog helper return — its callers attach the display name',
    // ── the `.kind` half. The rule was widened from `X.id` to `X.id|X.kind` after the business
    // TAKEOVER shipped `kind: r.kind` and the wire read "took your nightclub" as "took your
    // nightclub" only by luck of the id reading like a word — seven feedText templates were
    // rendering a raw `d.kind` at a player. Most `kind` fields are NOT catalog rungs though: they
    // are two- and three-value DISCRIMINATORS the client branches on, and a rule that demanded a
    // display name beside those would be mostly wrong, which is the shape people route around.
    // business.js is deliberately UNWAIVED: it is the file the takeover defect came out of, and a
    // (file, key) waiver is a BLANKET one — waiving `business.js:kind` for the shutter reply would
    // have silently re-covered the raid, the rob and the shakedown notifies fixed alongside it.
    'casino.js:kind':     'dog|horse — the racer kind IS the display word, on a board, not prose',
    'stable.js:kind':     'dog|horse — the same two-value word on the stakes board',
    'chain.js:kind':      "the EIP-712 voucher struct's numeric kind — signed, never rendered",
    'chain.js:amount':    'the same voucher struct — a wei amount reached by the kind ternary',
    'server.js:kind':     "omr|gear on the chain board — a voucher's rail, not a catalog rung",
    'contacts.js:kind':   'freight|visit — the discriminator the client branches on',
    'corner.js:kind':     'the drawn daily-counter kind (crime|jump|…) the client jumps a tab on',
    'diplomacy.js:kind':  'pact|coalition — the discriminator',
    'market.js:kind':     'car|good|order — the discriminator every market card branches on',
    'game.js:kind':       'an internal progress return; crew.js attaches the label before a player sees it',
    'regimen.js:kind':    "the drawn drill; `how` in the same literal is the human sentence",
    'rules.tail.js:kind': 'the same drill helper — `how` is the sentence beside it',
  };
  const seen = new Set();
  const bad = [];
  let corpus = 0;
  const literals = (s) => {                                   // return-literals and notify payloads
    const out = [];
    for (const m of s.matchAll(/(return\s*\{|notify\([^;]{0,200}?,\s*\{)/g)) {
      const i = s.indexOf('{', m.index);
      let d = 0;
      for (let j = i; j < Math.min(s.length, i + 4000); j++) {
        if (s[j] === '{') d++;
        else if (s[j] === '}' && --d === 0) { out.push(s.slice(i, j + 1)); break; }
      }
    }
    return out;
  };
  for (const f of files) {
    const s = fs.readFileSync(f, 'utf8');
    const base = path.basename(f);
    for (const lit of literals(s)) {
      for (const m of lit.matchAll(/\b(\w+):\s*(\w+)\.(id|kind)\b/g)) {
        const [, k, src] = m;
        // a HANDLE says so in its own name — `carId`, `heistId`, `character_id`, or the bare `id`
        if (k === 'id' || /Id$/.test(k) || /_id$/.test(k)) continue;
        corpus++;
        const named = new RegExp(`\\b(name|title|label|${k}Name)\\s*:`).test(lit)
          || new RegExp(`:\\s*${src}\\.(name|title|label)\\b`).test(lit)
          // the SHORTHAND spelling of the same assertion: `{ kind: r.kind, kindName }` ships the
          // display name exactly as `kindName: kindName` would, and a matcher that only knows the
          // colon form stops seeing a companion the moment it is written the other legal way — the
          // extractor-only-knows-one-form class (the CATALOG LEDGER lesson). Only `<k>Name` gets
          // the shorthand form: a bare `name`/`title` shorthand would be some unrelated variable.
          || new RegExp(`(?<![\\w$.])${k}Name\\s*[,}]`).test(lit);
        if (named) continue;
        const key = `${base}:${k}`;
        if (WAIVED[key]) { seen.add(key); continue; }
        bad.push(`${f} — ${k}: ${src}.${m[3]}`);
      }
    }
  }
  // anti-vacuity: an extractor that has stopped finding payload literals reports zero problems and
  // reads exactly like a clean bill of health — the shape that has cost this project five sessions.
  assert(corpus > 50, `THE RAW-KEY LEDGER found only ${corpus} catalog-id payload fields — the `
    + 'extractor is broken, not the tree. A scan that sees nothing passes for a clean sweep.');
  const stale = Object.keys(WAIVED).filter((k) => !seen.has(k));
  assert.deepEqual(stale, [], 'RAW-KEY waiver(s) that no longer match a site. A waiver is a decision '
    + `about a field that exists; one pointing at nothing is a decision nobody is making:
   - ${stale.join('\n   - ')}`);
  assert.deepEqual(bad, [], 'player-visible payload(s) sending a catalog id with no display name. The '
    + 'client has no catalog handle, so it can print nothing but the key — "the payroll came off HOT". '
    + `Send the name with the id, or declare the field in WAIVED with the property that makes it safe:
   - ${bad.join('\n   - ')}`);
  console.log(`✓ all ${corpus} catalog ids in player-visible payloads carry a name (${Object.keys(WAIVED).length} declared handles)`);

  // ── THE WIRE HALF ─────────────────────────────────────────────────────────────────────────────
  // The rule above matches `k: X.id` — deliberately narrow and high-signal. The WIRE ships its ids
  // under three other shapes (`X.good_id`, `boat.run_route`, a bare `trackId`), and widening the
  // SERVER rule to catch them flags 40 sites of which most are the RIGHT architecture: an id the
  // client resolves off a published catalog (goodName/discName/$d — the goodName precedent). A rule
  // that is mostly wrong is one people route around.
  //
  // So the wire is checked at the INTERSECTION — a payload field a feedText template actually
  // renders — which is narrow enough to be a hard rule. Three things are decidable there, and the
  // FIRST cut of this check had only one of them and was very nearly vacuous: it looked for a bare
  // `${d.x}`, so `${art(d.routeName || d.route)}` hid the raw fallback and four of five mutations
  // survived. The `|| d.rawId` tail is CORRECT code (a queued notification predating the field must
  // still render something), so the property is not "don't fall back" — it is "the server sends the
  // name", which only a server-side rule can hold.
  {
    const payloads = {};
    for (const f of files) {
      const s2 = fs.readFileSync(f, 'utf8');
      // BOTH feeds: a personal notify() and a streets bus.emit() are rendered by the same feedText,
      // and the same type can arrive in two shapes from the two of them (the wire ledger's rule 2).
      // Reading only notify() is how the first cut passed a streets emit shipping `run: run.runId`.
      // Two loops rather than one alternation, because each ends at its own payload brace — a shared
      // pattern whose tail is optional lands the brace index past it and reads the NEXT literal.
      const feeds = [
        [/notify\([^;]{0,200}?,\s*'(\w+)'\s*,\s*\{/g, 0],
        [/bus\.emit\('streets',\s*\{\s*type:\s*'(\w+)'/g, 1],
      ];
      for (const [re, kind] of feeds) {
        for (const m of s2.matchAll(re)) {
          const i = kind ? s2.indexOf('{', m.index) : m.index + m[0].length - 1;
          let d = 0, j = i;
          for (; j < Math.min(s2.length, i + 2000); j++) {
            if (s2[j] === '{') d++;
            else if (s2[j] === '}' && --d === 0) break;
          }
          (payloads[m[1]] ||= []).push([f, s2.slice(i, j + 1)]);
        }
      }
    }
    // (c) field names whose value is a catalog id in EVERY payload that ships them — the client has
    // a module-scope resolver for each, so a BARE render is the defect. Catalogue-or-declare: a new
    // one is a decision, not a silent regression.
    const RESOLVE = {
      good:       'goodName() off the published /v1/rules goods catalog',
      discipline: 'discName() off /v1/rules.regimen.disciplines',
      district:   'the $d() resolver feedText declares at its own scope',
    };
    const cli = fs.readFileSync('public/index.html', 'utf8');
    const a = cli.indexOf('function feedText('), b = cli.indexOf('\n  function ', a + 10);
    assert(a > 0 && b > a, 'feedText not found — the wire extractor is reading nothing');
    const ft = cli.slice(a, b);
    const raw = new Set();
    let templates = 0, watched = 0;
    for (const m of ft.matchAll(/(\w+): \(\) =>[^\n]*/g)) {
      templates++;
      const [line, type] = [m[0], m[1]];
      // (c) a bare interpolation of a known catalog-id field
      for (const mm of line.matchAll(/\$\{d\.(\w+)\}/g)) {
        if (RESOLVE[mm[1]]) raw.add(`${type}.${mm[1]} renders the raw id — resolve it with ${RESOLVE[mm[1]]}`);
      }
      for (const [f, lit] of payloads[type] || []) {
        // (a) the template naming `d.<k>Name` is an assertion that the server sends it. Both legal
        // spellings count — `kindName: x` AND the SHORTHAND `{ kind, kindName }` — or the matcher
        // reports correct code the moment it is written the other way (the extractor-only-knows-
        // one-form class, the CATALOG LEDGER lesson; the server half above was widened identically).
        for (const mm of line.matchAll(/\bd\.(\w+)Name\b/g)) {
          watched++;
          if (!new RegExp(`\\b${mm[1]}Name\\s*:`).test(lit)
              && !new RegExp(`(?<![\\w$.])${mm[1]}Name\\s*[,}]`).test(lit)) {
            raw.add(`${type}.${mm[1]}Name — the line reads it, ${f} does not send it (it falls back to the id)`);
          }
        }
        // (b) a rendered field the payload ships as an id must come with a display name
        for (const mm of line.matchAll(/\bd\.(\w+)\b/g)) {
          const k = mm[1];
          if (k === 'type' || /Name$/.test(k)) continue;
          if (RESOLVE[k]) continue;                                // (c) governs these: the client resolves them
          const v = new RegExp(`\\b${k}:\\s*([^,\\n}]+)`).exec(lit);
          if (!v) continue;
          const e = v[1].trim();
          if (/\bname\b/.test(e)) continue;                        // resolved at the source
          // a plain member access only — `shares[m.id]` and `x && winner.id === y` are not ids
          // `.kind` joins `.id` here for the reason the SERVER half was widened: the seven templates
          // rendering a raw `d.kind` were invisible to both halves, because a `kind` field is shipped
          // as `row.kind` and not as an id. It is narrow — only a field the LINE renders and the
          // PAYLOAD ships as a bare member access — so the many `kind` discriminators nothing renders
          // are untouched.
          if (!/^[\w.?]+$/.test(e) || !/\.(id|kind|\w*_id)\b|\w+Id\b/.test(e)) continue;
          watched++;
          // the shorthand `{ kind, kindName }` ships the name exactly as `kindName: kindName` would —
          // both spellings satisfy "a display name rides beside the id" (and both arm rule (d) below).
          const sentName = new RegExp(`\\b(name|${k}Name)\\s*:`).test(lit)
            || new RegExp(`(?<![\\w$.])${k}Name\\s*[,}]`).test(lit);
          const sentKName = new RegExp(`\\b${k}Name\\s*:`).test(lit)
            || new RegExp(`(?<![\\w$.])${k}Name\\s*[,}]`).test(lit);
          if (!sentName) {
            raw.add(`${type}.${k} — ${f} sends ${e} with no display name beside it`);
          } else if (sentKName && !new RegExp(`\\bd\\.${k}Name\\b`).test(line)) {
            // (d) the INVERSE of (a): the server went and sent the name and the line still renders the
            // key. Rule (b) above cannot see it — it asks whether the payload carries a name, and it
            // does. This is the half that would have let the seven `d.kind` templates sit unfixed
            // beside a server that had already been corrected.
            raw.add(`${type}.${k} — ${f} sends ${k}Name and the line renders the raw ${k}`);
          }
        }
      }
    }
    // anti-vacuity, both halves: an extractor that has stopped reading the client, and a rule that
    // has stopped GOVERNING anything — the first cut of this check policed nine sites and could not
    // fail on any of the five it was written for.
    assert(templates > 100, `the wire extractor read only ${templates} feedText templates — it has `
      + 'stopped seeing the client, and a sweep that reaches nothing reads exactly like one that passes');
    assert(watched >= 15, `the wire rule governs only ${watched} rendered payload fields — it has `
      + 'stopped matching, which reads identically to a clean tree');
    assert.deepEqual([...raw], [], 'a wire line renders a catalog id where a name belongs. feedText '
      + 'has no catalog handle for most of these, so the fix is at the SOURCE (ship the name beside '
      + `the id — the routeName precedent) or through a module-scope resolver:
   - ${[...raw].join('\n   - ')}`);
    console.log(`  ✓ no wire line renders a raw catalog id (${watched} rendered id fields across ${templates} templates)`);
  }


// ═══ THE JS-ARRAY ANY BAN — a query shape that arms itself when somebody adds an index ═══════════
// `WHERE col = ANY($1)` with a JS array bound to $1 is CORRECT SQL and correct on production
// Postgres. pg-mem returns ZERO ROWS for it — silently, no error — so the suites go green over a
// query that found nothing. src/game.js states the rule in its own comments twice and src/growth.js
// once, and nothing enforced it.
//
// WHY IT IS WORTH A GUARD rather than a comment: it is not merely wrong-under-pg-mem, it is LATENT.
// Without an index on the filtered column pg-mem seq-scans and evaluates ANY correctly, so the site
// reads fine for as long as the column stays unindexed — and then arms the day somebody indexes it
// for a completely unrelated reason. That is exactly what happened: `ix_char_account` (a 120x cut on
// the per-request character lookup — pgcheck §9c) made two referral sites in game.js return nothing,
// so the spark and the qualification paid NOBODY, on a shape that had been sitting there for years.
//
// THE CORPUS IS THE `IN (…)` SITES, not the violations — a rule counted by its own violations floors
// at zero the moment the tree is clean and then measures nothing forever (the ARTICLE LEDGER lesson).
{
  const inForms = [];
  // Each reviewed expression is identified independently by source, SQL statement, indexed column,
  // and placeholder. The binding is checked from the query CallExpression's params ArrayExpression;
  // approving one expression can never approve a neighbour that happens to share its source line.
  const reviewedAny = [
    { column: 'c.id', param: 1, sql: /FROM characters c JOIN account_persistent ap/i },
    { column: 'c.account_id', param: 2, sql: /FROM characters c JOIN account_persistent ap/i },
    { column: 'character_id', param: 1, sql: /SELECT character_id, gang_id FROM gang_members/i },
    { column: 'account_id', param: 1, sql: /SELECT account_id, crew_id FROM crew_members/i },
    { column: 'target_account', param: 2, sql: /FROM digs WHERE character_id=\$1/i },
    { column: 'gang_id', param: 1, sql: /SELECT gang_id, COUNT\(\*\) n FROM gang_members/i },
  ];
  const unwrap = (node) => {
    while (node && (node.type === 'ChainExpression' || node.type === 'ParenthesizedExpression'))
      node = node.expression;
    return node;
  };
  const isQueryCall = (node) => {
    const callee = unwrap(node?.callee);
    if (callee?.type !== 'MemberExpression') return false;
    if (!callee.computed) return callee.property?.type === 'Identifier' && callee.property.name === 'query';
    const property = unwrap(callee.property);
    return property?.type === 'Literal' && property.value === 'query';
  };
  const staticText = (node) => {
    if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
    if (node?.type === 'TemplateLiteral' && node.expressions.length === 0)
      return node.quasis.map((part) => part.value.cooked ?? part.value.raw).join('');
    return null;
  };
  const makeScope = (parent, type) => ({ parent, type, bindings: new Map() });
  const bindingScope = (scope, kind) => {
    if (kind !== 'var') return scope;
    while (scope.parent && scope.type !== 'function' && scope.type !== 'program') scope = scope.parent;
    return scope;
  };
  const bindPattern = (pattern, scope, declaration, kind) => {
    pattern = unwrap(pattern);
    if (!pattern) return;
    if (pattern.type === 'Identifier') {
      bindingScope(scope, kind).bindings.set(pattern.name, { declaration, kind });
      return;
    }
    if (pattern.type === 'RestElement') return bindPattern(pattern.argument, scope, declaration, kind);
    if (pattern.type === 'AssignmentPattern') return bindPattern(pattern.left, scope, declaration, kind);
    if (pattern.type === 'ArrayPattern') {
      for (const element of pattern.elements) bindPattern(element, scope, declaration, kind);
      return;
    }
    if (pattern.type === 'ObjectPattern') for (const property of pattern.properties)
      bindPattern(property.type === 'RestElement' ? property.argument : property.value, scope, declaration, kind);
  };
  const lexicalBindings = (ast) => {
    const scopeAt = new WeakMap();
    const program = makeScope(null, 'program');
    const visit = (node, scope) => {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'Program') {
        scopeAt.set(node, program);
        for (const child of node.body) visit(child, program);
        return;
      }
      if (node.type === 'BlockStatement') {
        const block = makeScope(scope, 'block');
        scopeAt.set(node, block);
        for (const child of node.body) visit(child, block);
        return;
      }
      if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression'
        || node.type === 'ArrowFunctionExpression') {
        if (node.type === 'FunctionDeclaration' && node.id)
          bindPattern(node.id, scope, node, 'function');
        const fn = makeScope(scope, 'function');
        scopeAt.set(node, fn);
        if (node.type === 'FunctionExpression' && node.id) bindPattern(node.id, fn, node, 'function');
        for (const parameter of node.params) bindPattern(parameter, fn, parameter, 'parameter');
        for (const parameter of node.params) visit(parameter, fn);
        visit(node.body, fn);
        return;
      }
      if (node.type === 'CatchClause') {
        const caught = makeScope(scope, 'block');
        scopeAt.set(node, caught);
        bindPattern(node.param, caught, node.param, 'catch');
        visit(node.param, caught);
        visit(node.body, caught);
        return;
      }
      scopeAt.set(node, scope);
      if (node.type === 'VariableDeclaration') {
        for (const declaration of node.declarations)
          bindPattern(declaration.id, scope, declaration, node.kind);
      } else if (node.type === 'ImportDeclaration') {
        for (const specifier of node.specifiers)
          bindPattern(specifier.local, scope, specifier, 'import');
      } else if ((node.type === 'ClassDeclaration' || node.type === 'ClassExpression') && node.id) {
        bindPattern(node.id, scope, node, 'class');
      }
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) {
          for (const child of value) if (child?.type) visit(child, scope);
        } else if (value?.type) visit(value, scope);
      }
    };
    visit(ast, program);
    return { program, scopeAt };
  };
  const resolveBinding = (name, scope) => {
    while (scope) {
      if (scope.bindings.has(name)) return scope.bindings.get(name);
      scope = scope.parent;
    }
    return null;
  };
  const boundBySqlTextArray = (params, param, lexical, canonicalBinding) => {
    const binding = unwrap(params?.type === 'ArrayExpression' ? params.elements[param - 1] : null);
    const callee = unwrap(binding?.type === 'CallExpression' ? binding.callee : null);
    return !!canonicalBinding && callee?.type === 'Identifier' && callee.name === 'sqlTextArray'
      && resolveBinding(callee.name, lexical.scopeAt.get(callee)) === canonicalBinding;
  };
  // This is deliberately a small SQL lexer rather than a regex. PostgreSQL permits comments between
  // a keyword and `(`, treats SOME as an ANY synonym, and permits both words inside comments/quoted
  // values where they are not executable. Trivia is discarded before the membership shape is read.
  const sqlTokens = (sql) => {
    const tokens = [];
    let index = 0;
    while (index < sql.length) {
      if (/\s/.test(sql[index])) { index += 1; continue; }
      if (sql.startsWith('--', index)) {
        const end = sql.indexOf('\n', index + 2);
        index = end < 0 ? sql.length : end + 1;
        continue;
      }
      if (sql.startsWith('/*', index)) {
        let depth = 1;
        index += 2;
        while (index < sql.length && depth) {
          if (sql.startsWith('/*', index)) { depth += 1; index += 2; }
          else if (sql.startsWith('*/', index)) { depth -= 1; index += 2; }
          else index += 1;
        }
        continue;
      }
      if (sql[index] === "'") {
        index += 1;
        while (index < sql.length) {
          if (sql[index] !== "'") { index += 1; continue; }
          if (sql[index + 1] === "'") { index += 2; continue; }
          index += 1;
          break;
        }
        continue;
      }
      if (sql[index] === '"') {
        const start = index;
        index += 1;
        while (index < sql.length) {
          if (sql[index] !== '"') { index += 1; continue; }
          if (sql[index + 1] === '"') { index += 2; continue; }
          index += 1;
          break;
        }
        tokens.push({ type: 'quoted', value: sql.slice(start, index), start });
        continue;
      }
      if (sql[index] === '$') {
        const dollarQuote = sql.slice(index).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)?.[0];
        if (dollarQuote) {
          const end = sql.indexOf(dollarQuote, index + dollarQuote.length);
          index = end < 0 ? sql.length : end + dollarQuote.length;
          continue;
        }
        const parameter = sql.slice(index).match(/^\$(\d+)/);
        if (parameter) {
          tokens.push({ type: 'parameter', value: parameter[0], param: Number(parameter[1]), start: index });
          index += parameter[0].length;
          continue;
        }
      }
      const word = sql.slice(index).match(/^[A-Za-z_][A-Za-z0-9_$]*/)?.[0];
      if (word) {
        tokens.push({ type: 'word', value: word, upper: word.toUpperCase(), start: index });
        index += word.length;
        continue;
      }
      const symbol = sql.startsWith('::', index) ? '::' : sql[index];
      tokens.push({ type: 'symbol', value: symbol, start: index });
      index += symbol.length;
    }
    return tokens;
  };
  const membershipExpressions = (sql) => {
    const tokens = sqlTokens(sql), expressions = [];
    for (let index = 0; index + 1 < tokens.length; index += 1) {
      const operator = tokens[index];
      if (operator.type !== 'word' || !['ANY', 'SOME'].includes(operator.upper)
        || tokens[index + 1].value !== '(') continue;
      let depth = 1, end = index + 2;
      for (; end < tokens.length && depth; end += 1) {
        if (tokens[end].value === '(') depth += 1;
        else if (tokens[end].value === ')') depth -= 1;
      }
      const args = tokens.slice(index + 2, depth ? tokens.length : end - 1);
      const scalarParameter = args.length === 5 && args[0]?.type === 'parameter'
        && args[1].value === '::' && args[2].type === 'word' && args[2].upper === 'TEXT'
        && args[3].value === '[' && args[4].value === ']';
      const canonicalOperator = tokens[index - 1]?.value === '=';
      const prior = tokens[index - 2];
      const qualified = tokens[index - 3]?.value === '.' && tokens[index - 4]?.type === 'word';
      const column = canonicalOperator && prior?.type === 'word'
        ? `${qualified ? `${tokens[index - 4].value}.` : ''}${prior.value}` : '<expression>';
      expressions.push({ column, param: scalarParameter ? args[0].param : null,
        operator: operator.upper, canonicalOperator, start: operator.start });
    }
    return expressions;
  };
  const collectAny = (source, sourceName = '<fixture>') => {
    const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
    const lexical = lexicalBindings(ast);
    const moduleSerializer = lexical.program.bindings.get('sqlTextArray');
    const canonicalBinding = moduleSerializer?.kind === 'const'
      && moduleSerializer.declaration?.type === 'VariableDeclarator' ? moduleSerializer : null;
    const usages = [];
    const reviewedQueryFunctions = new Set(['scopedSocialContext']);
    const functionName = (node, parent) => node.id?.type === 'Identifier' ? node.id.name
      : parent?.type === 'VariableDeclarator' && parent.id?.type === 'Identifier' ? parent.id.name : null;
    const visit = (node, parent = null, insideReviewedQueryFunction = false) => {
      if (!node || typeof node !== 'object') return;
      const isFunction = node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression'
        || node.type === 'ArrowFunctionExpression';
      const insideReviewed = insideReviewedQueryFunction || (sourceName === 'explore.js' && isFunction
        && reviewedQueryFunctions.has(functionName(node, parent)));
      if (insideReviewed && node.type === 'CallExpression' && isQueryCall(node)
        && staticText(node.arguments[0]) === null) {
        usages.push({ source: sourceName, line: node.loc?.start.line || 0, sql: '<non-literal>',
          column: '<query>', param: null, operator: 'ANY/SOME', unsafeReviewedQuery: true,
          dynamic: false, scalarLiteral: false });
      }
      if (node.type === 'Literal' || node.type === 'TemplateLiteral') {
        const dynamic = node.type === 'TemplateLiteral' && node.expressions.length > 0;
        const text = staticText(node) ?? (dynamic
          ? node.quasis.map((part) => part.value.cooked ?? part.value.raw).join(' ') : null);
        if (text) {
          const call = parent?.type === 'CallExpression' && parent.arguments[0] === node && isQueryCall(parent)
            ? parent : null;
          const dynamicReviewedQuery = dynamic && !!call && sourceName === 'explore.js'
            && reviewedAny.some((site) => site.sql.test(text));
          if (dynamicReviewedQuery) {
            usages.push({ source: sourceName, line: node.loc?.start.line || 0, sql: text,
              column: '<dynamic>', param: null, operator: 'ANY/SOME', dynamic: true, scalarLiteral: false });
          } else {
            for (const expression of membershipExpressions(text)) usages.push({ source: sourceName,
              line: (node.loc?.start.line || 1) + text.slice(0, expression.start).split('\n').length - 1,
              sql: text, ...expression, dynamic,
              scalarLiteral: !dynamic && !!call && !!expression.param
                && boundBySqlTextArray(call.arguments[1], expression.param, lexical, canonicalBinding) });
          }
        }
      }
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) {
          for (const child of value) if (child?.type) visit(child, node, insideReviewed);
        } else if (value?.type) visit(value, node, insideReviewed);
      }
    };
    visit(ast);
    return usages;
  };
  const classifyAny = (usages, { complete = false } = {}) => {
    const seen = new Set(), bad = [], approved = [];
    for (const usage of usages) {
      if (usage.unsafeReviewedQuery) {
        bad.push(`${usage.source}:${usage.line} scopedSocialContext passes non-literal SQL to query(...)`);
        continue;
      }
      if (usage.dynamic) {
        bad.push(`${usage.source}:${usage.line} interpolates a reviewed ANY/SOME SQL statement`);
        continue;
      }
      if (!usage.canonicalOperator) {
        bad.push(`${usage.source}:${usage.line} uses ${usage.operator} with an unreviewed surrounding operator`);
        continue;
      }
      const matches = reviewedAny.map((site, index) => ({ site, index })).filter(({ site }) =>
        usage.source === 'explore.js' && usage.column === site.column && usage.param === site.param
          && site.sql.test(usage.sql));
      if (matches.length !== 1) {
        bad.push(`${usage.source}:${usage.line} unreviewed ${usage.column}=${usage.operator}($${usage.param || '?'})`);
        continue;
      }
      const [{ index }] = matches;
      if (!usage.scalarLiteral) {
        bad.push(`${usage.source}:${usage.line} ${usage.column}=${usage.operator}($${usage.param}) is not bound by the module sqlTextArray(...)`);
        continue;
      }
      if (seen.has(index)) {
        bad.push(`${usage.source}:${usage.line} duplicates reviewed occurrence ${usage.column}=${usage.operator}($${usage.param})`);
        continue;
      }
      seen.add(index);
      approved.push(usage);
    }
    if (complete) for (const [index, site] of reviewedAny.entries()) if (!seen.has(index))
      bad.push(`explore.js missing reviewed occurrence ${site.column}=ANY/SOME($${site.param})`);
    return { accepted: bad.length === 0, approved, bad };
  };
  const anyGuardAccepts = (source) => classifyAny(collectAny(source, 'explore.js')).accepted;
  const canonicalSerializer = 'const sqlTextArray = (values) => String(values); ';
  const exploreBytesForSeal = fs.readFileSync(path.join(SRC, 'explore.js'));
  const exploreSourceForSeal = exploreBytesForSeal.toString('utf8');
  const scopedDeclarationIn = (source) => {
    const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
    const declarations = ast.body.filter((node) => node.type === 'FunctionDeclaration'
      && node.id?.name === 'scopedSocialContext');
    assert.equal(declarations.length, 1, 'seal mutation fixture starts from one top-level scopedSocialContext declaration');
    return declarations[0];
  };
  const mutateScopedDeclaration = (mutate) => {
    const declaration = scopedDeclarationIn(exploreSourceForSeal);
    const original = exploreSourceForSeal.slice(declaration.start, declaration.end);
    const changed = mutate(original);
    assert.notEqual(changed, original, 'seal mutation fixture must actually change scopedSocialContext');
    return exploreSourceForSeal.slice(0, declaration.start) + changed + exploreSourceForSeal.slice(declaration.end);
  };
  const replaceScopedOnce = (before, after) => mutateScopedDeclaration((source) => {
    assert(source.includes(before), `seal mutation fixture cannot find ${before}`);
    return source.replace(before, after);
  });
  // This is a review seal, not a generated snapshot. Updating the digest requires reviewing the whole
  // function and deliberately replacing this literal. Canonical AST ignores comments, whitespace,
  // quote style and source locations, while every syntactic callee/query/SQL/parameter/body change is
  // semantic and therefore changes the digest. See the independently pinned canonicalizer fixture.
  const REVIEWED_SCOPED_SOCIAL_CONTEXT_SHA256 = '54497b859d3ff1be3ddb06cb4b8d33b36b6a9e72290a84ed8205b0d912bb3c54';
  const AST_SEAL_METADATA = new Set(['start', 'end', 'loc', 'raw']);
  const canonicalAst = (value) => {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(canonicalAst);
    const canonical = {};
    for (const key of Object.keys(value).sort()) if (!AST_SEAL_METADATA.has(key)) {
      const child = canonicalAst(value[key]);
      if (child !== undefined) canonical[key] = child;
    }
    return canonical;
  };
  const scopedSocialContextDigest = (source) => {
    let ast;
    try { ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }); }
    catch { return null; }
    const declarations = ast.body.filter((node) => node.type === 'FunctionDeclaration'
      && node.id?.name === 'scopedSocialContext');
    if (declarations.length !== 1) return null;
    return createHash('sha256').update(JSON.stringify(canonicalAst(declarations[0]))).digest('hex');
  };
  assert.equal(scopedSocialContextDigest(
    "function scopedSocialContext(db) { return db.query('SELECT 1', []); }"),
  'b6239d1ec76f2cd76b1a3ce97b5f4599b60ba9d2a121ebdc917d46cd2446e00b',
  'the canonical-AST helper retains its independently recomputed fixture digest');
  const scopedSocialContextSealAccepts = (source) =>
    scopedSocialContextDigest(source) === REVIEWED_SCOPED_SOCIAL_CONTEXT_SHA256;
  // Authoritative boundary: exact tracked bytes, with CRLF normalized to LF solely so Git's Windows
  // checkout policy cannot false-fail the review. Comments, whitespace and every other byte remain
  // sealed. This literal was independently recomputed with PowerShell SHA256.HashData over the same
  // byte-level CRLF normalization; it is never derived from the checked-out source at assertion time.
  const REVIEWED_EXPLORE_FILE_SHA256 = 'd56b18801cd3109f84bae8caaa3ba7478c773eda4b223f4504e6f5ad8e871ffd';
  const normalizeCrlfBytes = (value) => {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
    const normalized = Buffer.allocUnsafe(bytes.length);
    let written = 0;
    for (let index = 0; index < bytes.length; index += 1) {
      if (bytes[index] === 13 && bytes[index + 1] === 10) index += 1;
      normalized[written] = bytes[index];
      written += 1;
    }
    return normalized.subarray(0, written);
  };
  const wholeExploreFileDigest = (bytes) =>
    createHash('sha256').update(normalizeCrlfBytes(bytes)).digest('hex');
  assert.equal(wholeExploreFileDigest(Buffer.from('seal\nfixture\n')),
    'ab40ee53bd51c029356ee1b88f352c14760961e5c81db10cc550902f6aeab4ef',
    'the whole-file hash helper retains its independently recomputed fixture digest');
  assert.equal(wholeExploreFileDigest(Buffer.from('seal\r\nfixture\r\n')),
    'ab40ee53bd51c029356ee1b88f352c14760961e5c81db10cc550902f6aeab4ef',
    'CRLF and LF checkouts normalize to the same reviewed bytes');
  const wholeExploreFileSealAccepts = (bytes) =>
    wholeExploreFileDigest(bytes) === REVIEWED_EXPLORE_FILE_SHA256;
  const normalizedExploreSource = exploreSourceForSeal.replace(/\r\n/g, '\n');
  const reassignment = `
scopedSocialContext = async function(db) {
  const ids = [];
  return db['que' + 'ry']('SELECT character_id FROM gang_' + 'members WHERE character_id = A' + 'NY($1::text[])', [ids]);
};
`;
  const wholeFileSealCases = [
    { name: 'reviewed tracked bytes', bytes: exploreBytesForSeal, accepted: true },
    { name: 'LF checkout', bytes: Buffer.from(normalizedExploreSource), accepted: true },
    { name: 'CRLF checkout', bytes: Buffer.from(normalizedExploreSource.replace(/\n/g, '\r\n')), accepted: true },
    { name: 'appended computed double-obscured reassignment',
      bytes: Buffer.from(exploreSourceForSeal + reassignment), accepted: false },
    { name: 'prepended computed double-obscured reassignment',
      bytes: Buffer.from(reassignment + exploreSourceForSeal), accepted: false },
    { name: 'export alias and rebinding', bytes: Buffer.from(exploreSourceForSeal
      + `\nexport { scopedSocialContext as reviewedSocialContext };${reassignment}`), accepted: false },
    { name: 'indirect eval statement', bytes: Buffer.from(exploreSourceForSeal
      + "\n(0, eval)('scopedSocialContext = async function () { return null; }');\n"), accepted: false },
    { name: 'new Function rebinding', bytes: Buffer.from(exploreSourceForSeal
      + "\nscopedSocialContext = new Function('return async function scopedSocialContext() { return null; }')();\n"),
    accepted: false },
    { name: 'added executable statement', bytes: Buffer.from(exploreSourceForSeal
      + '\nvoid scopedSocialContext;\n'), accepted: false },
    { name: 'added comment byte', bytes: Buffer.from(exploreSourceForSeal
      + '\n// review seal bypass\n'), accepted: false },
    { name: 'added whitespace byte', bytes: Buffer.from(exploreSourceForSeal + ' '), accepted: false },
  ];
  const currentScopedDeclaration = scopedDeclarationIn(exploreSourceForSeal);
  const currentScopedSource = exploreSourceForSeal.slice(currentScopedDeclaration.start, currentScopedDeclaration.end);
  const sealCases = [
    { name: 'reviewed declaration', source: exploreSourceForSeal, accepted: true },
    { name: 'whitespace is not semantic', source: replaceScopedOnce('async function scopedSocialContext',
      'async   function   scopedSocialContext'), accepted: true },
    { name: 'comments are not semantic', source: mutateScopedDeclaration((source) =>
      source.replace('{', '{\n  /* review-seal ignores comments */')), accepted: true },
    { name: 'computed template query member', source: replaceScopedOnce('db.query(', 'db[`query`]('), accepted: false },
    { name: 'concatenated query member', source: replaceScopedOnce('db.query(', "db['que' + 'ry']("), accepted: false },
    { name: 'destructured query alias', source: mutateScopedDeclaration((source) => source.replace('{',
      '{\n  const { query } = db;').replace('db.query(', 'query.call(db,')), accepted: false },
    { name: 'bound query alias', source: mutateScopedDeclaration((source) => source.replace('{',
      '{\n  const query = db.query.bind(db);').replace('db.query(', 'query(')), accepted: false },
    { name: 'Function.call query invocation', source: replaceScopedOnce('db.query(', 'db.query.call(db,'), accepted: false },
    { name: 'sequence query invocation', source: replaceScopedOnce('db.query(', '(0, db.query).call(db,'), accepted: false },
    { name: 'composite literal LHS', source: replaceScopedOnce('character_id = ANY($1::text[])',
      "'' || character_id = ANY($1::text[])"), accepted: false },
    { name: 'composite identifier LHS', source: replaceScopedOnce('character_id = ANY($1::text[])',
      'role || character_id = ANY($1::text[])'), accepted: false },
    { name: 'raw JavaScript array parameter', source: replaceScopedOnce('[sqlTextArray(ids)]', '[ids]'), accepted: false },
    { name: 'alternate variable function form', source: mutateScopedDeclaration((source) =>
      source.replace('async function scopedSocialContext', 'const scopedSocialContext = async function') + ';'),
    accepted: false },
    { name: 'alternate object method form', source: mutateScopedDeclaration(() =>
      'const scopedHolder = { async scopedSocialContext(db, ch, onlineAccounts) { return null; } };'), accepted: false },
    { name: 'alternate assignment function form', source: mutateScopedDeclaration(() =>
      'let scopedSocialContext; scopedSocialContext = async function(db, ch, onlineAccounts) { return null; };'),
    accepted: false },
    { name: 'missing declaration', source: exploreSourceForSeal.slice(0, currentScopedDeclaration.start)
      + exploreSourceForSeal.slice(currentScopedDeclaration.end), accepted: false },
    { name: 'duplicate declaration', source: `${exploreSourceForSeal}\n${currentScopedSource}`, accepted: false },
  ];
  const anyGuardCases = [
    {
      name: 'reviewed scalar literal',
      source: canonicalSerializer
        + "db.query('SELECT character_id, gang_id FROM gang_members WHERE character_id = ANY($1::text[])', [sqlTextArray(ids)])",
      accepted: true,
    },
    {
      name: 'unshadowed module serializer through a function scope',
      source: canonicalSerializer
        + "function run() { return db.query('SELECT character_id, gang_id FROM gang_members WHERE character_id = ANY($1::text[])', [sqlTextArray(ids)]); }",
      accepted: true,
    },
    {
      name: 'reviewed SOME synonym with module serializer',
      source: canonicalSerializer
        + "db.query('SELECT character_id, gang_id FROM gang_members WHERE character_id = SOME /* trivia */ ($1::text[])', [sqlTextArray(ids)])",
      accepted: true,
    },
    {
      name: 'same-line extra ANY',
      source: "db.query('SELECT character_id, gang_id FROM gang_members WHERE character_id = ANY($1::text[]) OR role = ANY($2::text[])', [sqlTextArray(ids), ids])",
      accepted: false,
    },
    {
      name: 'block-comment-hidden extra ANY',
      source: canonicalSerializer
        + "db.query('SELECT character_id, gang_id FROM gang_members WHERE character_id = ANY($1::text[]) OR role = ANY /* hidden */ ($2::text[])', [sqlTextArray(ids), ids])",
      accepted: false,
    },
    {
      name: 'line-comment-hidden extra ANY',
      source: canonicalSerializer
        + "db.query(`SELECT character_id, gang_id FROM gang_members WHERE character_id = ANY($1::text[]) OR role = ANY -- hidden\n ($2::text[])`, [sqlTextArray(ids), ids])",
      accepted: false,
    },
    {
      name: 'membership text inside a SQL comment is not executable',
      source: canonicalSerializer
        + "db.query('SELECT character_id, gang_id FROM gang_members WHERE character_id = ANY($1::text[]) /* role = ANY($2::text[]) */', [sqlTextArray(ids)])",
      accepted: true,
    },
    {
      name: 'PostgreSQL SOME synonym with unsafe binding',
      source: canonicalSerializer
        + "db.query('SELECT character_id, gang_id FROM gang_members WHERE character_id = ANY($1::text[]) OR role = SOME($2::text[])', [sqlTextArray(ids), ids])",
      accepted: false,
    },
    {
      name: 'multiline extra ANY',
      source: `db.query(\`SELECT character_id, gang_id FROM gang_members
        WHERE character_id = ANY($1::text[])
           OR role = ANY($2::text[])\`, [sqlTextArray(ids), ids])`,
      accepted: false,
    },
    {
      name: 'duplicate reviewed occurrence',
      source: "db.query('SELECT character_id FROM gang_members WHERE character_id = ANY($1::text[]) OR character_id = ANY($1::text[])', [sqlTextArray(ids)])",
      accepted: false,
    },
    {
      name: 'duplicate reviewed SOME synonym occurrence',
      source: canonicalSerializer
        + "db.query('SELECT character_id, gang_id FROM gang_members WHERE character_id = ANY($1::text[]) OR character_id = SOME($1::text[])', [sqlTextArray(ids)])",
      accepted: false,
    },
    {
      name: 'dynamic reviewed template suffix',
      source: canonicalSerializer
        + 'db.query(`SELECT character_id, gang_id FROM gang_members WHERE character_id = ANY($1::text[]) ${extra}`, [sqlTextArray(ids)])',
      accepted: false,
    },
    {
      name: 'dynamic reviewed template splitting the membership keyword',
      source: canonicalSerializer
        + 'db.query(`SELECT character_id, gang_id FROM gang_members WHERE character_id = A${middle}NY($1::text[])`, [sqlTextArray(ids)])',
      accepted: false,
    },
    {
      name: 'reviewed function rejects a dynamic table and split ANY keyword',
      source: canonicalSerializer
        + 'async function scopedSocialContext(db, table, middle, ids) { return db.query(`SELECT character_id, gang_id FROM gang_${table} WHERE character_id = A${middle}NY($1::text[])`, [ids]); }',
      accepted: false,
    },
    {
      name: 'reviewed function rejects a dynamic table and split SOME keyword',
      source: canonicalSerializer
        + 'async function scopedSocialContext(db, table, middle, ids) { return db.query(`SELECT character_id, gang_id FROM gang_${table} WHERE character_id = S${middle}OME($1::text[])`, [ids]); }',
      accepted: false,
    },
    {
      name: 'reviewed function rejects a non-literal query argument',
      source: canonicalSerializer
        + 'async function scopedSocialContext(db, sql, ids) { return db.query(sql, [ids]); }',
      accepted: false,
    },
    {
      name: 'reviewed function permits a fully static query without membership',
      source: canonicalSerializer
        + "async function scopedSocialContext(db) { return db.query('SELECT target_account FROM secrets'); }",
      accepted: true,
    },
    {
      name: 'qualified OPERATOR form cannot hide ANY with a JavaScript array',
      source: canonicalSerializer
        + "db.query('SELECT character_id, gang_id FROM gang_members WHERE character_id OPERATOR(pg_catalog.=) ANY($1::text[])', [ids])",
      accepted: false,
    },
    {
      name: 'unqualified OPERATOR form cannot hide SOME with a JavaScript array',
      source: canonicalSerializer
        + "db.query('SELECT character_id, gang_id FROM gang_members WHERE character_id OPERATOR(=) SOME($1::text[])', [ids])",
      accepted: false,
    },
    {
      name: 'reviewed membership requires the explicit text-array cast',
      source: canonicalSerializer
        + "db.query('SELECT character_id, gang_id FROM gang_members WHERE character_id = ANY($1)', [sqlTextArray(ids)])",
      accepted: false,
    },
    {
      name: 'reviewed membership rejects a different array cast',
      source: canonicalSerializer
        + "db.query('SELECT character_id, gang_id FROM gang_members WHERE character_id = ANY($1::varchar[])', [sqlTextArray(ids)])",
      accepted: false,
    },
    {
      name: 'membership text inside strings comments and dollar bodies is ignored',
      source: canonicalSerializer
        + "db.query(`SELECT character_id, gang_id FROM gang_members WHERE character_id = ANY($1::text[]) AND 'role = ANY($2::text[])' <> '' AND $$role = SOME($3::text[])$$ <> '' /* role = ANY($4::text[]) */`, [sqlTextArray(ids)])",
      accepted: true,
    },
    {
      name: 'JavaScript array at a reviewed placeholder',
      source: "db.query('SELECT character_id, gang_id FROM gang_members WHERE character_id = ANY($1::text[])', [ids])",
      accepted: false,
    },
    {
      name: 'function parameter shadows the module serializer',
      source: canonicalSerializer
        + "function run(sqlTextArray) { return db.query('SELECT character_id, gang_id FROM gang_members WHERE character_id = ANY($1::text[])', [sqlTextArray(ids)]); }",
      accepted: false,
    },
    {
      name: 'block-local declaration shadows the module serializer',
      source: canonicalSerializer
        + "{ const sqlTextArray = (values) => values; db.query('SELECT character_id, gang_id FROM gang_members WHERE character_id = ANY($1::text[])', [sqlTextArray(ids)]); }",
      accepted: false,
    },
    {
      name: 'serializer alias is not the reviewed binding',
      source: canonicalSerializer
        + "const serializer = sqlTextArray; db.query('SELECT character_id, gang_id FROM gang_members WHERE character_id = ANY($1::text[])', [serializer(ids)])",
      accepted: false,
    },
    {
      name: 'import alias is not the reviewed binding',
      source: canonicalSerializer
        + "import { sqlTextArray as serializer } from './serializer.js'; db.query('SELECT character_id, gang_id FROM gang_members WHERE character_id = ANY($1::text[])', [serializer(ids)])",
      accepted: false,
    },
    {
      name: 'serializer wrapper is not the reviewed binding',
      source: canonicalSerializer
        + "const wrapper = (values) => sqlTextArray(values); db.query('SELECT character_id, gang_id FROM gang_members WHERE character_id = ANY($1::text[])', [wrapper(ids)])",
      accepted: false,
    },
    {
      name: 'computed serializer callee is not the reviewed binding',
      source: canonicalSerializer
        + "db.query('SELECT character_id, gang_id FROM gang_members WHERE character_id = ANY($1::text[])', [(0, sqlTextArray)(ids)])",
      accepted: false,
    },
    {
      name: 'computed-property serializer callee is not the reviewed binding',
      source: canonicalSerializer
        + "db.query('SELECT character_id, gang_id FROM gang_members WHERE character_id = ANY($1::text[])', [globalThis['sqlTextArray'](ids)])",
      accepted: false,
    },
  ];
  const misclassifiedAnyFixtures = anyGuardCases.map((fixture) => ({
    name: fixture.name, expected: fixture.accepted, actual: anyGuardAccepts(fixture.source),
  })).filter((fixture) => fixture.actual !== fixture.expected);
  assert.deepEqual(misclassifiedAnyFixtures, [],
    'every adversarial SQL occurrence and serializer-binding mutation is classified independently');
  const misclassifiedSealFixtures = sealCases.map((fixture) => ({ name: fixture.name,
    expected: fixture.accepted, actual: scopedSocialContextSealAccepts(fixture.source) }))
    .filter((fixture) => fixture.actual !== fixture.expected);
  assert.deepEqual(misclassifiedSealFixtures, [],
    'the scopedSocialContext review seal changes or fails for every syntactic mutation');
  const misclassifiedWholeFileSealFixtures = wholeFileSealCases.map((fixture) => ({ name: fixture.name,
    expected: fixture.accepted, actual: wholeExploreFileSealAccepts(fixture.bytes) }))
    .filter((fixture) => fixture.actual !== fixture.expected);
  assert.deepEqual(misclassifiedWholeFileSealFixtures, [],
    'the authoritative explore.js byte seal rejects every change outside or inside the function');
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d)) {
    const q = path.join(d, e);
    if (fs.statSync(q).isDirectory()) walk(q); else if (q.endsWith('.js')) files.push(q);
  } };
  walk(SRC);
  const usages = [];
  for (const f of files) {
    const source = fs.readFileSync(f, 'utf8');
    usages.push(...collectAny(source, path.relative(SRC, f).replace(/\\/g, '/')));
    const txt = source.split(/\r?\n/).map((line) => line.replace(/\/\/.*$/, '')).join('\n');
    txt.split('\n').forEach((line) => {
      if (/IN \(\$\d|IN \(\$\{/.test(line)) inForms.push(f);
    });
  }
  const classified = classifyAny(usages, { complete: true });
  assert(inForms.length >= 20, `THE JS-ARRAY ANY/SOME BAN sees only ${inForms.length} IN(…) sites — the `
    + 'extractor has stopped reading src/, and a sweep that reaches nothing reads exactly like a clean tree');
  assert.deepEqual(classified.bad, [], 'each ANY/SOME expression must be an exact reviewed Explore occurrence '
    + 'whose own placeholder is bound by sqlTextArray(...); same-line neighbours receive no waiver:\n   - '
    + classified.bad.join('\n   - '));
  assert.equal(classified.approved.length, reviewedAny.length,
    'Explore must retain exactly six reviewed scalar-literal ANY/SOME expressions across five statements');
  console.log(`  ✓ no query binds a JS array to ANY/SOME($n); ${classified.approved.length} exact scalar-literal `
    + `expressions and ${inForms.length} IN(…) sites govern the rule`);
}

}

// H1 is observation and evidence only. Read every dedicated H1 source unit so splitting the
// implementation cannot move a forbidden capability outside the gate's field of view.
{
  // Read the CODE, never the prose: a capability named in a comment is not a capability, and a
  // guard that fires on an explanatory sentence is one commit away from being reworded around.
  // (Observed: a comment about a test's own time budget tripped the budget/mint/burn assertion.)
  const healthSource = decomment([
    'rwahealth.js', 'rwahealthread.js', 'rwahealthreview.js', 'rwahealthsweep.js',
  ].map((name) => fs.readFileSync(path.join(SRC, name), 'utf8')).join('\n'));
  assert.match(healthSource, /finalizedStockCatalogForHealthV2/,
    'H1 authority is the exact finalized Registry V2 health reader, never a legacy catalog read');
  assert.doesNotMatch(healthSource,
    /\b(?:privateKeyToAccount|walletClient|sendTransaction|writeContract|signMessage|signTypedData)\b/,
    'H1 has no signing or transaction-broadcast capability');
  assert.doesNotMatch(healthSource,
    /\b(?:buildStockTokenActivationV2|buildStockTokenDeactivationV2|publishTickerBallot|executeSafe)\b/,
    'H1 cannot mutate Registry state, publish ballots, or execute Safe packages');
  assert.doesNotMatch(healthSource, /\b(?:budget|withdraw|transferEth|burn|mint)\b/i,
    'H1 has no budget, token, ETH, mint, burn, or withdrawal surface');
  assert.doesNotMatch(healthSource, /process\.env|CHAIN_RPC_URL|fetch\s*\(/,
    'H1 has no environment-selected provider URL, generic production fetch, or hidden config surface');
}

// CN-6A is a read-only finalized Registry lifecycle consumer, not the later CN-6B publisher. Keep
// the capability boundary executable: the module has exactly the frozen coordinator/read helpers,
// and no production entry point may schedule or cut over its dormant coordinator in this slice.
{
  const lifecyclePath = path.join(SRC, 'rwaregistrylifecycle.js');
  assert(fs.existsSync(lifecyclePath),
    'CN-6A RED: src/rwaregistrylifecycle.js is missing; implement only the frozen read-only consumer');
  const lifecycleSource = fs.readFileSync(lifecyclePath, 'utf8');
  const executable = lifecycleSource
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  const actualExports = [...executable.matchAll(
    /^export\s+(?:async\s+)?function\s+(\w+)\s*\(/gm,
  )].map((match) => match[1]).sort();
  const expectedExports = [
    'syncFinalizedRwaRegistryLifecycle',
    'applyFinalizedRwaActivationEvents',
    'applyFinalizedRwaBallotEvents',
    'readFinalizedRwaLifecycleHeadV2',
    'compareFinalizedRwaActivationV2',
    'requireFinalizedRwaActivationV2',
  ].sort();
  assert.deepEqual(actualExports, expectedExports,
    'CN-6A exposes exactly its one coordinator and five transaction-local read/apply helpers');
  assert.match(executable, /\bobserveFinalized\b/,
    'CN-6A must delegate finalized-head observation to the shared FO kernel');
  assert.match(executable, /\bcommitFinalizedObservation\b/,
    'CN-6A must delegate checkpoint/inbox/domain atomicity to the shared FO kernel');
  assert.doesNotMatch(executable,
    /\b(?:privateKeyToAccount|createWalletClient|walletClient|signMessage|signTypedData|serializeTransaction|prepareTransactionRequest|sendTransaction|sendRawTransaction|writeContract|executeSafe)\b/,
    'CN-6A has no private key, signer, Safe execution, transaction construction, or send capability');
  assert.doesNotMatch(executable,
    /\b(?:setPublisher|activateVersion|deactivateVersion|publishBallot|publishTickerBallot|buildStockTokenActivationV2|buildStockTokenDeactivationV2)\b/,
    'CN-6A cannot mutate Registry publisher, activation, deactivation, or ballot state');
  assert.doesNotMatch(executable,
    /\b(?:eth_sendRawTransaction|eth_sendTransaction|broadcastTransaction)\b|\b(?:withdraw|transferEth|mint|burn)\s*\(/i,
    'CN-6A has no broadcast, funds, token, mint, burn, or withdrawal surface');
  assert.doesNotMatch(executable,
    /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+rwa_health_/i,
    'CN-6A cannot mutate H1 or H2 health/clearance state');
  const configuredEnvironmentKeys = [...executable.matchAll(/process\.env\.([A-Z0-9_]+)/g)]
    .map((match) => match[1]);
  assert(configuredEnvironmentKeys.every((key) => [
    'CHAIN_RPC_URL',
    'STOCK_TOKEN_REGISTRY_V2_ADDRESS',
    'STOCK_TOKEN_REGISTRY_V2_START_BLOCK',
  ].includes(key)), 'CN-6A may read only the frozen Task-5 chain, Registry, and start-block config');
  assert.doesNotMatch(executable, /process\.env\[[^\]]+\]|process\.env\.[A-Z0-9_]*(?:CUTOVER|ACTIVATION)/,
    'CN-6A has no dynamic, cutover, or activation-authority environment selector');

  // RUNNING ITS TESTS IS NOT SCHEDULING IT. The rule this enforces is the one stated above — no
  // PRODUCTION entry point may schedule or cut over the dormant coordinator — and for package.json
  // the pattern was broader than that intent: it also forbade a script that merely invokes
  // `test/rwaregistrylifecycle*.js`, which is why those three suites were the only ones in the tree
  // that nothing could run (THE SUITE LEDGER found ten more, and two of them were red). A test
  // invocation is stripped BEFORE the check rather than the pattern being loosened, so every other
  // mention — a coordinator import, a scheduled script, the exported symbol — still fails, and the
  // dormancy property is unchanged.
  const pkgText = fs.readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8');
  const pkgProduction = pkgText
    // a whole script entry whose body is NOTHING BUT invocations of its test files — key included,
    // since the key names the suite it runs
    .replace(/^\s*"[^"]*":\s*"(?:node test\/rwaregistrylifecycle[A-Za-z0-9._-]*\.js(?: && )?)+",?$/gm, '')
    // and the same invocations sitting inside a longer chain (`pretest`), fragment only
    .replace(/node test\/rwaregistrylifecycle[A-Za-z0-9._-]*\.js/g, '');
  const unreachable = [
    ['worker.js', fs.readFileSync(path.join(SRC, 'worker.js'), 'utf8')],
    ['package.json', pkgProduction],
  ];
  for (const [name, source] of unreachable) {
    assert.doesNotMatch(source,
      /\b(?:syncFinalizedRwaRegistryLifecycle|rwaregistrylifecycle)\b/,
      `CN-6A remains dormant: ${name} must not schedule or cut over its coordinator`);
  }
  // and the narrowing must never become a hole: the coordinator's own SYMBOL is forbidden in
  // package.json outright, test invocation or not.
  assert.doesNotMatch(pkgText, /\bsyncFinalizedRwaRegistryLifecycle\b/,
    'CN-6A remains dormant: package.json may run its tests but may never name its coordinator');
  const serverSource = fs.readFileSync(path.join(SRC, 'server.js'), 'utf8');
  assert.doesNotMatch(serverSource, /\bsyncFinalizedRwaRegistryLifecycle\b/,
    'CN-6A remains dormant: server.js may expose future read-only facts but cannot run its coordinator');
}

// ═══ THE INTERPOLATION LEDGER — every `${...}` reaching SQL text is classified or declared ════════
//
// `tools/pgquery.js` PREPAREs every static SQL string in src/ against real Postgres. It structurally
// CANNOT read a query built with `${...}`, so it counts those against a ceiling and says so — the
// honesty rule. But a count is a PROXY. What actually matters about an interpolated query is whether
// a USER STRING can reach the SQL text, and a ceiling cannot tell a new IN-list fan-out (harmless,
// and the only portable form — `= ANY($1)` returns zero rows on pg-mem the moment the column is
// indexed, THE ANY-OF-ARRAY BAN below) from a new `WHERE name = '${req.body.name}'`. Both move the
// number by one.
//
// AUDIT-red-team-eight lens 3 proved the real property BY HAND: all 95 interpolations of the day
// traced to a placeholder list, a ternary over two literals, a module constant or an allowlisted
// column name, so no user string reached SQL text. It was never made into a test. The corpus is 215
// interpolations across 162 statements now, and without this every one of those hand-sweeps has to
// be redone from scratch by the next person who wonders.
//
// THE RULE. Every interpolated expression must EITHER match a declared safe SHAPE, or trace in one
// level to bindings that ALL do, or be DECLARED here with the property that makes it safe. Waivers
// are keyed on (file, expression text) and NEVER on a line — a line-keyed waiver rots on the next
// edit above it, which the connection ledger's viem waivers cost once already.
//
// THE CORPUS IS SHARED WITH pgquery, via tools/sqlscan.js. Two guards over the same set that
// disagree about what the set IS are worse than one of them: pgquery's ceiling would then bound a
// corpus this never sees, and this would clear expressions pgquery never counted.
//
// Scope, stated rather than implied: this proves an expression cannot CARRY a user string into SQL
// text. It does not prove the resulting SQL is correct — that is pgquery's job for the static half,
// and precisely why the interpolated half stays counted rather than waved through.
{
  const LIT = "(?:'[^']*'|\"[^\"]*\")";
  // Each shape is safe for a reason that survives a reader who has never seen this file:
  const SHAPES = [
    // The engine shims. `dbCaps` is set at boot from the real engine, never from a request, and each
    // of these returns one of a fixed set of SQL fragments (they are NOT uniform across modules —
    // `nowSql()` has three different expansions — which is exactly why a substitution table would be
    // a new restatement surface that rots, and a named-helper allowlist is not).
    [/^(nowSql|lockSuffix|lock|epochTimestampSql|healthDbNowSql|sqlHonorDelta|inList|filt)\s*\(/,
      'declared SQL-fragment helper (engine shim / bound-placeholder builder)'],
    [new RegExp(`\\?\\s*${LIT}\\s*:\\s*${LIT}\\s*$`), 'ternary over two string literals'],
    // `$${...}` builds a PLACEHOLDER number. The value it stands for is bound, by construction.
    [/\$\$\{/, 'generated $n placeholder fan-out (every value bound)'],
    [/^\s*Number\(|^\s*Math\.(floor|round|min|max|abs)\(/, 'numeric coercion — cannot carry text'],
    [/^\s*[A-Z][A-Z0-9_]*(\.[A-Z][A-Z0-9_]*)*\s*$/, 'ALL_CAPS module constant'],
    [/^\s*\d+(\s*[-+*/]\s*\d+)*\s*$/, 'numeric literal'],
    [/^\s*params\.length(\s*[-+]\s*\d+)?\s*$/, 'parameter-count index (a $n number)'],
    [/^\s*(''|"")\s*$/, 'empty string'],
  ];
  const shapeOf = (e) => { for (const [re, why] of SHAPES) if (re.test(e)) return why; return null; };

  // ONE-LEVEL TRACING, and ALL bindings must be safe — not "any". A weaker rule would clear an array
  // initialised safely and then pushed to unsafely, which is the only interesting way this fails.
  // Matching is file-wide rather than function-scoped, which is the conservative direction: a
  // same-named binding in another function makes the requirement STRICTER, never looser.
  const bindings = (src, id) => {
    const esc = id.replace(/\$/g, '\\$');
    const out = [];
    const grab = (re) => { for (const m of src.matchAll(re)) out.push(m[1].replace(/\s+/g, ' ').trim()); };
    grab(new RegExp(`(?:const|let|var)\\s+${esc}\\s*=\\s*([\\s\\S]{0,220}?)(?:;|\\n)`, 'g'));
    grab(new RegExp(`\\b${esc}\\.push\\(([\\s\\S]{0,220}?)\\)\\s*[;\\n]`, 'g'));
    grab(new RegExp(`(?<![\\w$.])${esc}\\s*=\\s*([^=][\\s\\S]{0,220}?)(?:;|\\n)`, 'g'));
    return out;
  };
  const classify = (src, expr) => {
    const direct = shapeOf(expr);
    if (direct) return direct;
    const base = expr.match(/^([A-Za-z_$][\w$]*)(?:\.join\([^)]*\))?$/);
    if (!base) return null;
    const b = bindings(src, base[1]);
    if (!b.length || !b.every((r) => shapeOf(r))) return null;
    return `traced: ${shapeOf(b[0])}`;
  };

  // SELF-TEST, and it runs FIRST on purpose. The floors below catch a matcher that matches too
  // LITTLE; this catches one that matches too MUCH, which is the direction that lets an injection
  // site through quietly — and if it ran last, a permissive matcher would fail at the stale-waiver
  // assert instead (every declaration goes unused when everything is "safe"), sending the reader to
  // delete waivers over a matcher that had stopped checking anything.
  const synth = "const sort = req.query.sort;\nconst safe = dbCaps.skipLocked ? 'a' : 'b';\n"
    + 'const mixed = nowSql();\nmixed = req.body.dir;\n';
  assert.equal(classify(synth, 'req.body.name'), null, 'a raw request field must never classify safe');
  assert.equal(classify(synth, 'sort'), null, 'a binding that traces to a request field must never classify safe');
  assert.equal(classify(synth, 'mixed'), null, 'a binding assigned safely ONCE and unsafely once must '
    + 'never classify safe — the rule is ALL bindings, not any, because the only interesting way this '
    + 'fails is an array built safely and then pushed to unsafely');
  assert(classify(synth, 'safe'), 'a binding that traces to a two-literal ternary must classify safe');

  // ── DECLARED. Each of these was read at its call sites; the reason is the PROPERTY that makes a
  // user string unreachable, never "it looked fine". Keyed on file + expression text.
  const DECLARED = {
    // A SQL-fragment PARAMETER of a module-local helper whose every call site passes a literal.
    'src/honor.js|col': 'board(col,dir,cond) — both call sites pass literal column/direction/predicate',
    'src/honor.js|dir': 'board(col,dir,cond) — both call sites pass literals',
    'src/honor.js|cond': 'board(col,dir,cond) — both call sites pass literals',
    'src/vig.js|table': 'sumEth(pool,table,col,where) — every call site passes a literal table name',
    'src/vig.js|col': 'sumEth(...) — literal column at every call site',
    'src/vig.js|where': 'sumEth(...) — literal predicate at every call site (default empty)',
    'src/invariants.js|where': 'sum(pool,where) — literal predicates at every call site',
    'src/heists.js|cols': 'setMember(id,cols,params) — every call site passes a literal SET clause; values bound',
    'src/heists.js|extra': 'local candidate-scan helper — literal predicate at every call site',
    'src/world.js|cols': 'raid setMember(id,cols,params) — literal SET clause at every call site; values bound',
    'src/world.js|extra': 'freeQ(extra,params) — literal predicate at both call sites; values bound',
    'src/pen.js|cols': 'break setMember/setMemberRat — literal SET clause at every call site; values bound',
    'src/wire.js|col': "claim(w,col) — three literal column names ('alerted_hunt'/'_wanted'/'_indicted')",
    'src/rwanominations.js|setClause': 'updateQueueNominationIds(...,setClause,marker) — literal at every call site',
    'src/rwanominations.js|marker': 'a literal SQL-comment tag at every call site (query attribution only)',
    'src/stockcatalogv2.js|marker': 'readState(marker) — two literal tags, inside a /* */ SQL comment',

    // A CLOSED SET: the value indexes a module-private map, or is membership-gated before it is used.
    'src/chain.js|k.table': 'k is a value of the module-private KINDS map; nftKind() null-guards a bad key',
    'src/chain.js|k.clear': 'same KINDS map — the column name is declared in the map, not supplied',
    'src/nft.js|k.table': 'same module-private KINDS map, reached only through nftKind() (throws bad_kind)',
    'src/kitchen.js|col': "Object.hasOwn(KITCHEN.MODULES, modId) gates it, so `lab_${modId}` is a catalog key",
    'src/boxing.js|s': "String(stat||'') then a .includes(s) membership check against the fixed stat list",
    'src/stable.js|s': 'same membership gate against the fixed racer stat list',
    'src/standing.js|sel': 'ALL_COLS.map(...) — column list derived from the STANDING_PILLARS constant',
    'src/social/estate.js|t': "for (const t of ['cars','boats']) — literal array",
    'src/social/estate.js|table': 'for (const table of [...47 literal table names]) — literal array',
    'src/rwaregistrylifecycle.js|runtimeMode': "lockHeadRows(client, runtimeMode='SHARE') — lock mode, literal at both call sites",

    // A DECLARED MIGRATION SPEC — the strings come from a hardcoded const array in the same file.
    'src/db.js|table': 'migration spec table name from a module const array',
    'src/db.js|name': 'migration spec constraint name from the same const array',
    'src/db.js|expression': 'migration spec CHECK expression from the same const array',
    'src/db.js|spec.table': 'the same const array, read through the spec object',
    'src/db.js|spec.name': 'the same const array, read through the spec object',

    // GENERATED PLACEHOLDERS — the fragment is `$n,$n,...`; every value is bound.
    'src/game.js|vals.join(\',\')': 'multi-row INSERT VALUES tuples built from $n placeholders; values bound',
    'src/rwanominations.js|values.join(\',\')': 'same batched-INSERT placeholder fan-out; values bound',
    'src/rwanominations.js|placeholders': 'same — a generated $n list; values bound',
    'src/rwanominations.js|conditions.join(\' OR \')': 'OR of generated $n comparisons; values bound',

    // LOCALLY-BUILT PAGINATION FRAGMENTS. Each is a template containing only $n placeholders; the
    // cursor VALUES are validated in pageOptions and pushed as bound parameters, never spliced.
    'src/rwanominations.js|after': 'keyset predicate of $n placeholders; cursor values bound',
    'src/rwanominations.js|cursor': 'keyset predicate of $n placeholders; cursor values bound',
    'src/rwanominations.js|cursorClause': 'keyset predicate of $n placeholders; cursor values bound',
    'src/rwanominations.js|activeWhere': 'built from literal fragments + $n placeholders',
    'src/rwanominations.js|finalizedJoin': 'literal JOIN fragment chosen in-file, no request value',
    'src/rwanominations.js|staleEndorsement': 'staleness predicate of $n placeholders; values bound',
    'src/rwanominations.js|staleSponsor': 'staleness predicate of $n placeholders; values bound',

    // MULTI-LINE ternaries over literals — safe for the same reason as the one-line shape, but the
    // normalised text is too long for the pattern to be worth widening (a wider one would start
    // matching ternaries whose arms are not literals at all).
    'src/rwahealthreview.js|clockExpression': "dbCaps ternary over two literal clock expressions",
    'src/rwahealthclearance.js|select': "wholeSecond ? date_trunc('second',expr) : expr — both literal",
  };

  const { scanQueryCalls } = await import('../tools/sqlscan.js');
  const { readable } = scanQueryCalls(SRC, { root: fileURLToPath(new URL('../', import.meta.url)) });
  let total = 0, shaped = 0;
  const undeclared = [], usedDecl = new Set();
  for (const g of readable) {
    if (!g.interpolated) continue;
    for (const part of g.parts) {
      const expr = part.replace(/\s+/g, ' ').trim();
      total++;
      const why = classify(g.src, expr);
      if (why) { shaped++; continue; }
      const key = `${g.rel}|${expr}`;
      if (DECLARED[key]) { usedDecl.add(key); continue; }
      undeclared.push(`${g.where}  \${${expr}}`);
    }
  }

  // Two floors, because they fail differently: one catches an extractor that has stopped reading
  // src/ (a sweep that reaches nothing reads exactly like a clean tree), the other a shape matcher
  // that has stopped MATCHING — which would push everything into `undeclared` and, in the tempting
  // fix, into blanket waivers.
  assert(total > 150, `THE INTERPOLATION LEDGER read only ${total} interpolated expressions — the `
    + 'shared scanner has stopped reading src/, and a sweep that reaches nothing reads exactly like a clean tree');
  assert(shaped > 100, `only ${shaped} of ${total} interpolations matched a safe shape — the shape `
    + 'matcher is broken, and the next reader will be tempted to bulk-declare what it stopped seeing');

  assert.deepEqual(undeclared, [], 'interpolated expression(s) reaching SQL text that match no safe '
    + 'shape and carry no declaration. If the value cannot be a user string, declare it in THE '
    + 'INTERPOLATION LEDGER with the property that makes that true; if it can, it is an injection '
    + `site and must be bound as a parameter instead:\n   - ${undeclared.join('\n   - ')}`);

  const stale = Object.keys(DECLARED).filter((k) => !usedDecl.has(k)).sort();
  assert.deepEqual(stale, [], 'declaration(s) for interpolations that no longer exist — a stale '
    + 'waiver silently re-covers whatever moves into its place, so remove them:'
    + `\n   - ${stale.join('\n   - ')}`);

  console.log(`  ✓ all ${total} SQL interpolations are shape-safe (${shaped}) or declared `
    + `(${usedDecl.size}) — no user string can reach SQL text`);
}

// ═══ THE SUITE LEDGER — a test nobody runs is not a guard ═════════════════════════════════════════
// `package.json`'s `test` is a single ~120-entry `&&` chain on ONE LINE. Any two branches that each
// add a suite conflict on that line, git cannot merge it, and whoever resolves picks a side — which
// silently drops the other side's suites. That is not hypothetical: merge 48238abe took one side and
// dropped FIVE suites plus the `test:stockcatalogv2:postgres` script, and because CI still invoked
// that script by name the real-Postgres job failed in ZERO SECONDS on every run afterwards ("Missing
// script"). Sweeping the class then found TWELVE test/*.js that nothing ran at all — including
// test/rwahealthoverlay.schema.js, where a guard had been added earlier in the same session as this
// ledger. Ten of the twelve passed when finally run; a suite that does not execute reads on the
// summary line exactly like one that does.
//
// TWO RULES, because the first is blind to the second:
//   (a) every test/*.js is RUN — by `test`, by `pretest` (npm runs it automatically), by a script CI
//       invokes with `npm run`, or named directly in the workflow — or is DECLARED below with the
//       property that makes it unrunnable there.
//   (b) every `npm run X` in the workflow names a script that EXISTS. This is the rule that would
//       have caught the break at the merge: rule (a) sees a file with no runner, and says nothing at
//       all about a runner with no script.
//
// Scope, honestly: this proves a suite is INVOKED, not that it is meaningful. A file wired into the
// chain and asserting nothing still passes here.
{
  const ROOT = fileURLToPath(new URL('../', import.meta.url));
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const scripts = pkg.scripts || {};
  const ci = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');

  // A suite is covered if it is named by `test`/`pretest` (npm runs pretest before test), by any
  // script the workflow actually invokes, or directly by the workflow.
  const invoked = new Set(['test', 'pretest']);
  for (const m of ci.matchAll(/npm run ([a-zA-Z0-9:_-]+)/g)) invoked.add(m[1]);
  const covered = new Set();
  for (const name of invoked) {
    const body = scripts[name];
    if (!body) continue;
    for (const f of body.matchAll(/test\/[A-Za-z0-9._-]+\.js/g)) covered.add(f[0]);
  }
  for (const f of ci.matchAll(/test\/[A-Za-z0-9._-]+\.js/g)) covered.add(f[0]);

  // Declared: a suite the chain cannot run, each with the property that makes that true. A reason,
  // not a category — "it fails in CI" is a description of the symptom and would waive a real break.
  const DECLARED = {
    'test/contextplus.js':
      'Windows-only by construction: it spawns %SystemRoot%\\System32\\...\\powershell.exe to drive '
      + 'the ContextPlus .ps1 launcher, so on Linux `join(process.env.SystemRoot, ...)` throws before '
      + 'any assertion runs. Wiring it into the chain would make every Linux run red for a reason '
      + 'that says nothing about the product.',
    'test/mcp.js':
      'Needs the SEPARATE omerta-mcp package\'s own dependencies (@modelcontextprotocol/sdk), which '
      + 'the repo root does not install — `npm ci` here would have to carry a dep only that package '
      + 'uses. It is the clean-machine check for the published MCP server and belongs to that '
      + 'package\'s own verification, run from omerta-mcp/ after its install.',
  };

  const onDisk = fs.readdirSync(path.join(ROOT, 'test'))
    .filter((f) => f.endsWith('.js')).map((f) => `test/${f}`).sort();
  const orphans = onDisk.filter((f) => !covered.has(f) && !DECLARED[f]);

  // anti-vacuity, TWO floors because they fail differently: the first catches a reader that has
  // stopped seeing test files on disk, the second one that has stopped resolving the npm scripts —
  // and with the second broken EVERY file reads as an orphan, which is the tempting-to-bulk-declare
  // failure rather than a silent pass.
  assert(onDisk.length > 100, `THE SUITE LEDGER saw only ${onDisk.length} test files on disk — the `
    + 'directory read is broken, and a sweep that reaches nothing reads exactly like a clean tree');
  assert(covered.size > 100, `THE SUITE LEDGER resolved only ${covered.size} suites out of the npm `
    + 'scripts — the script reader is broken, not the tree');

  // Rule (b): the workflow may not call a script that does not exist. This is the one that fires at
  // the merge — a dropped script is invisible to rule (a), which only ever looks for files.
  const missing = [...invoked].filter((n) => n !== 'test' && n !== 'pretest' && !scripts[n]).sort();
  assert.deepEqual(missing, [], 'the workflow invokes npm script(s) that package.json does not '
    + 'define — `npm run` exits non-zero immediately ("Missing script"), so the step fails in zero '
    + 'seconds and everything reading the run assumes the check ran. This is how merge 48238abe left '
    + `the real-Postgres job red:\n   - ${missing.join('\n   - ')}`);

  assert.deepEqual(orphans, [], 'test suite(s) that NOTHING runs — not `npm test`, not `pretest`, not '
    + 'any script the workflow invokes. A guard that never executes reads on the summary line exactly '
    + 'like one that passes. Add it to `pretest` (or, if it needs a real database, give it a script '
    + 'and a step in the pgcheck job), or declare it above with the property that makes it '
    + `unrunnable here:\n   - ${orphans.join('\n   - ')}`);

  const stale = Object.keys(DECLARED).filter((f) => covered.has(f) || !onDisk.includes(f)).sort();
  assert.deepEqual(stale, [], 'declaration(s) for suites that are now run, or no longer exist — a '
    + 'stale waiver silently re-covers whatever moves into its place, so remove them:'
    + `\n   - ${stale.join('\n   - ')}`);

  console.log(`  ✓ all ${onDisk.length} test suites are run (${covered.size}) or declared `
    + `(${Object.keys(DECLARED).length}), and all ${invoked.size - 2} scripts the workflow calls exist`);
}

// ═══ THE SINGLE-INSTANCE LEDGER — state that does not exist across boxes ══════════════════════════
// render.yaml documents, at length, that this service runs exactly ONE instance because the process
// holds state a second box would not share. That warning is prose: nothing fails when somebody adds
// the sixteenth Map, or declares numInstances, and the failure mode is the worst kind — a player on
// box A never hears an event emitted on box B, silently, with nothing red anywhere.
//
// THREE RULES, because each covers what the others cannot:
//   (a) the deployment does not declare numInstances, and the warning still NAMES each documented
//       piece of per-process state — so deleting the reasoning fails, not just the number.
//   (b) every module-scope mutable collection in src/ is CLASSIFIED, and anything classified SHARED
//       is named in that warning.
//   (c) the WORKER carries its own warning, and it names every module that takes an advisory lock.
//
// SCOPE, stated because it is not obvious and a reader would otherwise over-trust this: rule (b)
// sees MODULE-scope collections only. Two of the four things render.yaml names are invisible to it —
// `wsClients` is function-scope inside server.js and `bus` is an EventEmitter, not a Map — so they
// are covered by rule (a) instead. A syntactic sweep alone would report all-clear while blind to the
// two biggest, which reads exactly like a clean bill of health.
{
  const ROOT = fileURLToPath(new URL('../', import.meta.url));
  const render = fs.readFileSync(path.join(ROOT, 'render.yaml'), 'utf8');

  // (a) the constraint itself. numInstances is deliberately ABSENT (it defaults to 1); declaring it
  // at all — even as 1 — is the edit that makes raising it a one-character change.
  assert.doesNotMatch(render, /^\s*numInstances:/m,
    'render.yaml must not declare numInstances — the single-instance constraint is the DEFAULT, and '
    + 'declaring it makes scaling out a one-character edit past every reason in the comment above it');
  for (const named of ['game.js `bus`', '`wsClients` presence registry', 'rate-limit buckets', 'flood brakes']) {
    assert(render.includes(named),
      `render.yaml's single-instance warning must still name ${named} — the warning IS the guard for `
      + 'state this ledger cannot see, so deleting a bullet silently removes the only thing standing '
      + 'between an operator and a scale-out that breaks it');
  }

  // (b) classify every module-scope mutable collection. Three postures, and the distinction is
  // correctness rather than taste: a deterministic cache costs CPU on a second box and nothing else;
  // a same-process fast path whose real guard is a DB constraint is correct anywhere; genuine
  // cross-request state is not.
  const POSTURE = {
    'aggregate.js:validated': 'cache: a WeakSet of board maps already validated — a second box re-validates, same answer',
    'stockdeliver.js:decCache': 'cache: ERC-20 decimals are immutable on-chain, so every box reads the same value',
    'cardpng.js:CACHE': 'cache: content-hash-keyed PNG renders of a deterministic SVG; a second box re-renders',
    'rwahealth.js:observationMemo': 'cache: per-observation-object memo of two pure hashes; a different body is a different object',
    'rwahealthread.js:FRESH_HEALTH_RECEIPTS': 'cache: per-receipt-object freshness memo, keyed on the object itself',
    'rwaregistrylifecycle.js:HEAD_RECEIPT_CLIENTS': 'cache: per-client head-receipt memo, keyed on the client object',
    'finalizedobservation.js:PUBLISHED_FO_ERRORS': 'cache: per-error-object marker; a second box marks its own errors',
    'finalizedobservation.js:SAFE_DOMAIN_ERRORS': 'cache: per-error-object marker; a second box marks its own errors',
    'rwahealthclearance.js:CREATE_REQUESTS': 'cache: per-request-object marker, scoped to the request being served',
    'rwahealthclearance.js:SUBMISSION_REQUESTS': 'cache: per-request-object marker, scoped to the request being served',
    'rwahealthclearance.js:READ_REQUESTS': 'cache: per-request-object marker, scoped to the request being served',
    'v4oraclekeeper.js:IN_FLIGHT_WINDOWS': 'db-backstopped: same-process guard; the DB primary key is the cross-process guard (said at the site)',
    'auth.js:guestBootstrapLocks': 'db-backstopped: a process-local queue for same-process retries; the unique index is the cross-process backstop (said at the site)',
    'ratelimit.js:buckets': 'shared: N instances = N× every limit, unless REDIS_URL is set',
    'phone.js:lastDmAt': 'shared: the DM flood brake — N instances = N× the allowed rate, and REDIS_URL does NOT cover it',
  };
  const found = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith('.js')) continue;
      const rel = relPath(SRC, full);
      const text = fs.readFileSync(full, 'utf8');
      // module scope is column 0 — an indented declaration is inside a function and out of scope.
      // Then keep only the ones WRITTEN after construction: a Map/Set built once from a literal and
      // never touched is a lookup table, not state, and 27 of the 42 declarations are exactly that.
      // Classifying constants would be the mostly-wrong advisory people learn to route around.
      for (const m of text.matchAll(/^(?:const|let|var) ([A-Za-z_$][\w$]*) = new (?:Map|Set|WeakMap|WeakSet)\(/gm)) {
        const name = m[1];
        if (!new RegExp(`\\b${name}\\.(?:set|add|delete|clear)\\s*\\(`).test(text)) continue;
        found.push(`${rel}:${name}`);
      }
    }
  };
  walk(SRC);
  found.sort();

  assert(found.length > 10,
    `read only ${found.length} module-scope collections — the scan stopped seeing src/, and a sweep `
    + 'that reaches nothing reads exactly like a sweep that passes');

  const unclassified = found.filter((k) => !POSTURE[k]);
  assert.deepEqual(unclassified, [],
    'module-scope mutable collection(s) with no single-instance posture — classify each as a '
    + 'deterministic cache (a second box computes the same answer), db-backstopped (the real guard '
    + 'is a DB constraint), or shared (single-instance only, and named in render.yaml):\n  '
    + unclassified.join('\n  '));

  // anything SHARED must be in the warning an operator actually reads
  // decidable: the warning must name the IDENTIFIER, so an operator reading it before scaling out
  // can find the code rather than being told a category
  const undocumented = found.filter((k) => POSTURE[k].startsWith('shared:'))
    .filter((k) => !render.includes(k.slice(k.indexOf(':') + 1)));
  assert.deepEqual(undocumented, [],
    'state classified SHARED but not named in render.yaml\'s single-instance warning — the warning is '
    + 'what an operator reads before scaling out, so an unnamed one is invisible exactly then:\n  '
    + undocumented.join('\n  '));

  const stalePosture = Object.keys(POSTURE).filter((k) => !found.includes(k)).sort();
  assert.deepEqual(stalePosture, [],
    'posture(s) declared for module-scope state that no longer exists — drop them so the ledger keeps '
    + 'describing the tree:\n  ' + stalePosture.join('\n  '));

  // (c) the WORKER's own posture, which is a DIFFERENT property and had one line of prose. Rules
  // (a) and (b) are about state that does not exist across boxes — the API's failure. A second
  // WORKER loses no state; it DOUBLE-RUNS work, and the defence is per-job rather than global: a
  // handful of modules take a session advisory lock and every other job rests on its own
  // claim-then-act latch. Until this rule the worker's whole comment was "Run exactly ONE. The game
  // works without it" — which explains running ZERO and never says a word about running TWO, the
  // case that sends a push twice and moves money twice with nothing red anywhere.
  //
  // The crossing is TWO-DIRECTIONAL and DERIVED, never a list restated here (a list in a test is a
  // second copy of the thing it checks, which is how the two come to disagree): add a lock without
  // documenting it and this fails; delete a lock and the comment stops being allowed to claim it.
  // `pg_try_advisory_lock` only, which is the SESSION lock the sentence is about. db.js takes a
  // plain `pg_advisory_lock` for the schema boot (it QUEUES rather than skipping, and is not a
  // worker job), and treasury.js also takes `pg_advisory_xact_lock` inside two claim paths — a
  // transaction-scoped lock over one row's arithmetic, not a single-writer posture for a sweep.
  {
    const from = render.indexOf('# 2) the background worker');
    assert(from > 0, "render.yaml no longer carries the worker's warning block");
    const cut = render.indexOf('\n  - type:', from);
    const warning = cut > 0 ? render.slice(from, cut) : render.slice(from);
    for (const phrase of ['RUN EXACTLY ONE INSTANCE', 'TWICE']) {
      assert(warning.includes(phrase),
        `render.yaml's worker warning must still say ${phrase} — one instance is the DEFAULT and the `
        + 'reasoning is the only thing standing between an operator and a second replica that '
        + 'double-sends and double-spends');
    }
    const locked = fs.readdirSync(path.join(ROOT, 'src')).filter((f) => f.endsWith('.js'))
      .filter((f) => fs.readFileSync(path.join(ROOT, 'src', f), 'utf8').includes('pg_try_advisory_lock'))
      .sort();
    assert(locked.length >= 3,
      `only ${locked.length} module(s) in src/ take a pg_try_advisory_lock — the extractor has stopped `
      + 'reading them, so this crossing is vacuous rather than clean');
    const named = [...new Set([...warning.matchAll(/`([a-z]+\.js)`/g)].map((m) => m[1]))].sort();
    assert.deepEqual(named, locked,
      "render.yaml's worker warning and src/ disagree about which jobs are guarded against a second\n"
      + '      replica. Every module taking an advisory lock must be named there (an undocumented one\n'
      + '      reads as unguarded) and no module may be named that has stopped taking one (a comment\n'
      + `      claiming a defence that is gone is worse than none).\n   named: ${named.join(', ')}\n`
      + `   locked: ${locked.join(', ')}`);
  }

  // AND THE ALARM CHANNEL MUST REACH THE API. INVARIANT_WEBHOOK_URL sits in the SHARED env group,
  // and until 2026-08-29 render.yaml explained that with "the alarms run in the worker" — a reason
  // that is no longer complete, because the API now runs the one alarm the worker cannot: the
  // watchdog that shouts when the WORKER is dark. A process cannot alarm on being dead. So a later
  // tidy-up that followed that stated reason and moved the key onto the worker alone would silently
  // mute exactly the alarm that covers the worker being gone, and nothing would fail. Two decidable
  // halves: the key is in the group, and the web service pulls that group.
  {
    const group = render.match(/envVarGroups:[\s\S]*?(?=\nservices:)/);
    assert(group && /INVARIANT_WEBHOOK_URL/.test(group[0]),
      'INVARIANT_WEBHOOK_URL has left render.yaml\'s shared env group. The API reads it to page when '
      + 'the WORKER goes dark (src/server.js startWorkerWatch) — a process cannot alarm on being dead, '
      + 'so on the worker alone that alarm is mute and the outage is silent again.');
    const web = render.slice(render.indexOf('- type: web'), render.indexOf('- type: worker'));
    assert(/fromGroup: omerta-secrets/.test(web),
      'the web service no longer pulls the shared env group, so the API cannot reach '
      + 'INVARIANT_WEBHOOK_URL and its worker watchdog can write telemetry but never page a human.');
  }

  // AND THE PUSH KEY PAIR MUST SPAN BOTH PROCESSES. Web push is the only activation switch in the
  // game that is a KEY PAIR read by two different services — the API serves the public half on
  // /v1/rules and stores the subscriptions, the WORKER signs and sends — so it is the one switch
  // where "set it on the service that needs it" is the wrong instruction. Set on the API alone, or
  // generated twice, and the failure is SILENT in the worst way: /admin → Integrations reads env
  // presence on the API, so the panel says LIVE while every push is never attempted or is rejected,
  // with nothing red anywhere. Declaring all three keys in the SHARED group is what makes "both
  // services, same pair" structural rather than a thing an operator has to remember, and a
  // per-service declaration is exactly the shape that lets the two halves diverge.
  {
    const group = render.match(/envVarGroups:[\s\S]*?(?=\nservices:)/);
    const KEYS = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'];
    for (const k of KEYS) {
      assert(group && new RegExp(`key: ${k}\\b`).test(group[0]),
        `${k} is not declared in render.yaml's SHARED env group. Web push is a key pair spanning the `
        + 'API (serves the public key, stores subscriptions) and the WORKER (signs and sends): declared '
        + 'per-service, or not at all, the two halves can differ and /admin reads LIVE while nothing sends.');
    }
    const web = render.slice(render.indexOf('- type: web'), render.indexOf('- type: worker'));
    const worker = render.slice(render.indexOf('- type: worker'));
    for (const [name, body] of [['web', web], ['worker', worker]]) {
      assert(/fromGroup: omerta-secrets/.test(body),
        `the ${name} service no longer pulls the shared env group, so it cannot see the VAPID pair — `
        + 'push then reads LIVE on the panel while one half of the rail is unconfigured.');
      for (const k of KEYS) {
        assert(!new RegExp(`key: ${k}\\b`).test(body),
          `${name} declares ${k} in its OWN envVars. That is the divergence vector this guard exists `
          + 'for: two services holding two different pairs is a rail that reads LIVE and sends nothing. '
          + 'Keep the pair in the shared group.');
      }
    }
    // ...and the panel must SAY so where it matters, which is the LIVE branch. `live` is computed from
    // the API's own env, so the one reading a founder most needs to distrust is the reassuring one.
    const ops = fs.readFileSync(path.join(ROOT, 'src', 'ops.js'), 'utf8');
    const push = ops.slice(ops.indexOf("{ id: 'push'"), ops.indexOf("{ id: 'x_oauth'"));
    assert(push && /caveat:/.test(push),
      "src/ops.js's push integration has lost its `caveat`. `live` reads env presence on the API alone, "
      + 'so without it the panel makes a confident claim about a rail whose sending half it cannot see.');
    const admin = fs.readFileSync(path.join(ROOT, 'public', 'admin.html'), 'utf8');
    assert(/x\.caveat/.test(admin),
      'public/admin.html no longer renders `caveat`, so the warning is a field on an endpoint that '
      + 'nobody reads — the same shape as an alarm posting nowhere.');
    console.log('  ✓ the web-push key pair is declared once, in the shared group both services pull, '
      + 'and the panel says its LIVE reading only covers this process');
  }

  const shared = found.filter((k) => POSTURE[k].startsWith('shared:')).length;
  console.log(`  ✓ all ${found.length} module-scope collections carry a single-instance posture `
    + `(${shared} shared, each named in render.yaml); numInstances stays undeclared`);
  console.log('  ✓ the alarm channel reaches the API, so the watchdog that covers a dark worker can page');
}

// ═══ THE CHILD-EXIT LEDGER — a listener attached after the work never fires ═══════════════════════
//
// Found five times across three files before it was worth a check, which is this file's own class.
// A child process that is spawned, worked against, and only THEN listened to is a coin toss: if it
// died inside the work window — and a held child CAN, since Node exits 13 of its own accord on an
// unsettled top-level await, and a real worker can crash, fail to boot, or be OOM-killed — the
// `exit` event fired before anybody was listening and the await never settles.
//
// The failure is not a wrong answer. `test/agent-alpha.js` had an 8s `waitFor`, so it surfaced as
// `Timed out waiting for bootstrap child hard exit` in a full-suite run while passing standalone —
// a red that reads like a flake and gets re-run. `test/mcp.js` and both `tools/chaos.js` sites carry
// NO timeout at all, so there it is an infinite hang, reported to CI as a job timeout with no
// message. chaos.js's second site holds the gap open for a 60-second poll loop.
//
// Reproduced rather than argued, with the exact shape: spawn a process that exits immediately, wait
// 300ms, kill (a no-op on a corpse), then attach — `HUNG — exit never observed`. Capture at spawn
// instead — `OBSERVED`.
//
// The rule is narrow so it stays true: if a spawned child's exit is EVER awaited, the listener that
// observes it must be attached with no `await` between it and the spawn. A child nobody waits on
// (an anvil the parent simply kills at teardown) is not this check's business. And one site is
// DECLARED rather than fixed, because it already solves the problem a different and equally sound
// way — it reads exitCode/signalCode first and falls back to a listener with a timeout, so a death
// inside the gap is seen rather than waited on forever.
{
  const ROOT = fileURLToPath(new URL('../', import.meta.url));
  const dirs = ['test', 'tools'].map((d) => path.join(ROOT, d));
  const files = [];
  for (const d of dirs) {
    for (const e of fs.readdirSync(d)) if (e.endsWith('.js')) files.push(path.join(d, e));
  }

  // catalogue-or-declare: a site that solves it another way is named WITH the property that makes
  // it sound, so the next reader sees a decision rather than an oversight.
  const WAIVED = new Map([
    ['tools/chaos.js:child', 'reads exitCode/signalCode FIRST and only falls back to a listener, '
      + 'with a 12s timeout — a death inside the gap is observed, not waited on; its own comment '
      + 'records the related lesson that reading exitCode alone misreports a signalled death'],
  ]);

  const late = [];
  const usedWaivers = new Set();
  let captures = 0;
  for (const f of files) {
    const rel = relPath(ROOT, f);
    // Strip line comments first. A scanner that reads prose reports the very comments a fix leaves
    // behind — my own first run flagged two sites whose only `await` was in the sentence explaining
    // why they capture at spawn, and a mostly-wrong advisory is the kind people route around. Line
    // positions are preserved so the failure still names the real line.
    const lines = fs.readFileSync(f, 'utf8').split('\n').map((l) => l.replace(/\/\/.*$/, ''));
    for (let i = 0; i < lines.length; i++) {
      const m = /(?:const|let|var)?\s*\b(\w+)\s*=\s*spawn\(/.exec(lines[i]);
      if (!m) continue;
      const v = m[1];
      // Where is this child's exit observed? `process.on('exit')` is the PARENT's and must not match,
      // so the variable name is required. 'close' carries the identical hazard and counts too.
      const listener = new RegExp(`\\b${v}\\.(?:once|on)\\(\\s*['"](?:exit|close)['"]`);
      let at = -1;
      for (let j = i + 1; j < lines.length && j < i + 400; j++) {
        if (listener.test(lines[j])) { at = j; break; }
      }
      if (at === -1) continue;   // nobody ever waits on this child — not this check's business
      captures++;
      // Anything that yields between the spawn and the capture is a window the child can die in.
      let yields = false;
      for (let j = i + 1; j < at; j++) if (/\bawait\b/.test(lines[j])) { yields = true; break; }
      if (!yields) continue;
      const key = `${rel}:${v}`;
      if (WAIVED.has(key)) { usedWaivers.add(key); continue; }
      late.push(`${rel}:${i + 1} — \`${v}\` spawned here, its exit first observed at line ${at + 1}, `
        + 'with an await in between');
    }
  }

  // Two anti-vacuity floors, because they fail differently. The first catches an extractor that has
  // stopped seeing spawns at all; the second a WAIVER list that has drifted off the tree, which
  // would silently re-cover a real site.
  assert(captures >= 6,
    `THE CHILD-EXIT LEDGER found only ${captures} awaited child exit(s) — the extractor has stopped `
    + 'reading them, so this check is vacuous rather than clean');
  for (const key of WAIVED.keys()) {
    assert(usedWaivers.has(key),
      `THE CHILD-EXIT LEDGER carries a stale waiver for ${key} — that site no longer attaches its `
      + 'listener late, so the declaration is covering nothing and would quietly re-cover a real one');
  }
  assert.equal(late.length, 0,
    'a child process\'s exit listener is attached AFTER work that can outlive the child. If it dies\n'
    + '      in that window the event fires before anybody is listening and the await never settles —\n'
    + '      a job timeout with no message, or an 8s "flake" that only reddens under load.\n'
    + '      Capture it at SPAWN (`const gone = new Promise((r) => child.once(\'exit\', r));`):\n'
    + `   - ${late.join('\n   - ')}`);
  console.log(`✓ all ${captures} awaited child exits are captured at spawn `
    + `(${WAIVED.size} declared: reads exitCode first, with a timeout)`);
}

// ═══ THE PACKAGE MANIFEST LEDGER — the gate drives the source, the registry gets the artifact ═════
//
// `omerta-mcp` is the only thing this project publishes, and the command it publishes is the one
// `/play`, `AGENTS.md`, the README and the public posts all hand a non-technical reader verbatim:
// `npx -y omerta-mcp`. Its publish gate is the package's own `npm test`, which is `node
// ../test/mcp.js` — and that spawns `index.js` from the WORKING TREE, where every file exists. So
// the gate proves the SOURCE works and says nothing about what the tarball carries.
//
// `files` is what makes the two disagree. Reproduced 2026-08-29 rather than argued: plant a sibling
// `_probe_helper.js`, import it from `index.js`, leave `files` alone —
//   • `npm pack --dry-run`  →  3 files, the sibling absent
//   • `npm test`            →  green
// The published package then ERR_MODULE_NOT_FOUNDs for EVERY user, on the one command the docs
// promise, while every gate in the repo is green and nothing anywhere says so until somebody
// reports it. Latent today — `index.js` genuinely imports nothing but the SDK and node builtins —
// and reachable on the next revision that splits a helper out of a 700-line file. The package is at
// 1.3.0, so it has been revised three times already.
//
// NPM IS THE ORACLE, deliberately. `files` supports globs and directories, and npm always includes
// package.json/README/LICENSE and always excludes others; a check that reimplemented those rules
// would be a second implementation of npm's semantics, which is exactly how the two come to
// disagree — the class this file exists for. `npm pack --dry-run --json` lists what the registry
// receives, costs ~0.5s, needs no network, and runs no lifecycle script here (the package declares
// none). If it cannot run, this FAILS rather than skips: a guard that quietly does nothing reads on
// the summary line exactly like a clean one.
//
// Only RELATIVE specifiers are the tarball's business — a bare specifier is a dependency npm
// installs for the user and `node:` is builtin — and the closure is walked transitively from the
// declared entry points, so a file two hops deep is covered rather than only the first.
//
// TWO HONEST SCOPE NOTES, both measured while mutating this. The ENTRY-POINT half is UNREACHABLE:
// npm always ships the file named by `main`/`bin` whatever `files` says (removing `index.js` from
// the list still packs it), so that assertion is defence in depth over a guarantee npm already
// makes — kept, because an unreachable guard costs nothing and an untested one that READS as tested
// costs everything, but nobody should think it is load-bearing. And the closure walk has nothing to
// walk today: `index.js` is the whole package, so the transitive step is exercised by the mutation
// that plants a sibling, not by the tree in its current shape.
{
  const ROOT = fileURLToPath(new URL('../', import.meta.url));
  const { execFileSync } = await import('node:child_process');

  // The governed set is derived, never a hardcoded name: a package can only ship SHORT if it
  // declares `files`, so that declaration is the membership test. A private package is nobody's
  // registry problem, and one without `files` ships everything and cannot be short.
  const pkgs = execFileSync('git', ['ls-files', '*package.json'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter((p) => p && !p.includes('node_modules'))
    .map((rel) => ({ rel, dir: path.dirname(path.join(ROOT, rel)),
      json: JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')) }))
    .filter(({ json }) => !json.private && Array.isArray(json.files));
  assert(pkgs.length >= 1,
    'THE PACKAGE MANIFEST LEDGER found no publishable package declaring `files` — the extractor has '
    + 'stopped reading them, so this check is vacuous rather than clean');

  const missing = [];
  let walked = 0;
  for (const { rel, dir, json } of pkgs) {
    let shipped;
    try {
      const out = execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd: dir, encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'] });
      shipped = new Set(JSON.parse(out)[0].files.map((f) => f.path));
    } catch (e) {
      assert.fail(`THE PACKAGE MANIFEST LEDGER could not ask npm what ${rel} ships (${e.message}). `
        + 'It fails rather than skipping: a guard that quietly does nothing looks exactly like one '
        + 'that passed, and this is the only check standing between a short `files` list and a '
        + 'published package that cannot start.');
    }
    assert(shipped.size >= 2, `npm reports ${rel} shipping ${shipped.size} file(s) — too few to be real`);

    // Entry points first, because that is the sharpest possible break: a `bin` aimed at a file the
    // manifest excludes is a package that cannot start at all.
    const entries = [json.main, ...Object.values(json.bin ?? {})].filter(Boolean)
      .map((p) => p.replace(/^\.\//, ''));
    const seen = new Set();
    const queue = [...new Set(entries)];
    while (queue.length) {
      const f = queue.shift();
      if (seen.has(f)) continue;
      seen.add(f);
      if (!shipped.has(f)) { missing.push(`${rel}: \`${f}\` is imported (or is an entry point) but is not in the tarball`); continue; }
      const abs = path.join(dir, f);
      if (!fs.existsSync(abs)) continue;
      walked++;
      for (const m of fs.readFileSync(abs, 'utf8')
        .matchAll(/(?:^|[^\w$.])(?:import|export)\s+(?:[^'"]*?\sfrom\s+)?['"](\.[^'"]+)['"]|import\s*\(\s*['"](\.[^'"]+)['"]/g)) {
        const spec = m[1] ?? m[2];
        queue.push(path.posix.normalize(path.posix.join(path.posix.dirname(f), spec)));
      }
    }
  }

  assert(walked >= 1,
    `THE PACKAGE MANIFEST LEDGER walked only ${walked} source file(s) — the entry points did not `
    + 'resolve, so nothing was actually checked');
  assert.equal(missing.length, 0,
    'a published package imports a file its `files` manifest does not ship. The publish gate spawns\n'
    + '      the entry point from the WORKING TREE, so it stays green while the tarball the registry\n'
    + '      serves cannot start — every `npx -y <pkg>` user gets ERR_MODULE_NOT_FOUND and no check\n'
    + '      anywhere says so. Add the file to `files`:\n'
    + `   - ${missing.join('\n   - ')}`);
  console.log(`✓ every relative import reachable from ${pkgs.length} publishable package `
    + `(${walked} source file${walked === 1 ? '' : 's'}) is in the tarball npm would publish`);
}

// ═══ THE COOLDOWN LEDGER — "not yet" is not a wait ════════════════════════════════════════════════
// 38 of 39 cooldown refusals held the exact expiry IN THE COMPARISON ONE LINE ABOVE THE THROW and
// threw it away. The FIRE path — the most expensive verb in the game, a two-hour trigger cooldown —
// said only "Your trigger's still hot."; three street-race sites said "cool down" with no number;
// `world.js` literally said "later". Six siblings already named their wait (the gym, the charter,
// the mission ladder, the shank, the boost, the social verify), which is what makes this the
// forgotten-sibling shape rather than a convention nobody had adopted.
//
// It is the WITHHELD-TERM class — the line is FLUENT and the actionable number is left off — so
// check 14 (THE SILENCE LEDGER), which proves a handler is not MUTE, is structurally blind to it.
// And it costs agents more than people: agents are first-class players here, they read these codes,
// and with nothing machine-readable to back off on they retry blind into a 1/3s throttle.
//
// THE RULE: every `GameError('cooldown', …)` carries `cooldownSeconds` — the {district}/{lockSeconds}
// discipline — so a client can count it down and an agent can sleep on it. The SENTENCE is checked by
// the wave regression in test/client.js, which drives the real reply; this checks the payload, which
// is the half a driven test cannot cover for 39 sites. Catalogue-or-declare, both directions.
{
  const DECLARED = {
    // none today: every cooldown refusal in the tree holds its own expiry at the throw. A site that
    // genuinely cannot (a cooldown whose end is not knowable at the refusal) is declared here WITH
    // that property — never because computing it was awkward.
  };
  const sites = [];
  for (const f of files) {
    const src = decomment(fs.readFileSync(f, 'utf8'));
    for (const m of src.matchAll(/\bnew GameError\(\s*'cooldown'/g)) {
      let i = m.index + m[0].length, depth = 1, q = null;
      const start = i;
      while (i < src.length && depth > 0) {
        const c = src[i];
        if (q) { if (c === '\\') { i += 2; continue; } if (c === q) q = null; }
        else if (c === "'" || c === '"' || c === '`') q = c;
        else if ('([{'.includes(c)) depth++;
        else if (')]}'.includes(c)) depth--;
        i++;
      }
      const args = src.slice(start, i - 1);
      const rel = f.replace(/^.*\/src\//, 'src/');
      const line = src.slice(0, m.index).split('\n').length;
      sites.push({ at: `${rel}:${line}`, args });
    }
  }
  assert(sites.length >= 30, `THE COOLDOWN LEDGER found only ${sites.length} cooldown refusals — the `
    + 'extractor is broken, not the tree. A scan that sees nothing passes for a clean sweep.');

  const mute = sites.filter((s) => !/cooldownSeconds/.test(s.args) && !DECLARED[s.at]);
  assert.deepEqual(mute.map((s) => s.at), [], 'cooldown refusal(s) that never say WHEN. The expiry is '
    + 'in the comparison one line above the throw — pass it as `{ cooldownSeconds }` so a client can '
    + 'count it down and an agent can back off instead of retrying blind:\n   - '
    + mute.map((s) => s.at).join('\n   - '));
  const stale = Object.keys(DECLARED).filter((at) => !sites.some((s) => s.at === at));
  assert.deepEqual(stale, [], 'declaration(s) for a cooldown refusal the tree no longer has at that '
    + `line. A stale waiver silently re-covers the next site that lands there:\n   - ${stale.join('\n   - ')}`);
  console.log(`✓ all ${sites.length} cooldown refusals carry the remainder — none says only "not yet"`);
}

// ═══ THE BUCKET LEDGER — a refill is not a day ════════════════════════════════════════════════════
// Eleven rolling token buckets meter this game (`*_used`/`*_at` pairs: the exchange window, the
// vault's daily claim, jailhouse attempts, safehouse time, the public wash, the port supplier, the
// level-up refill, stat-by-use, RICO structuring, club notoriety, the retired launder cap). They all
// REFILL CONTINUOUSLY on the wall clock — `used = max(0, stored − elapsed/window × cap)` — which
// makes "come back tomorrow" false in the ordinary partially-spent state, and false by a lot: at 5
// bust attempts a day one comes back every ~4.8h, so that line overstated the wait by up to 19 hours.
//
// This is the fluent-but-false class, which no silence pattern can see — check 14 (THE SILENCE
// LEDGER) proves a handler is not MUTE and is structurally blind to a handler that speaks and is
// wrong. Wave 76 fixed it in `exchange.js` and did not sweep it; the sweep found two more (the vault
// and the jailhouse) and a third bucket carrying the same expression in two copies (the safehouse,
// in the till AND the sheet — the sixty-nine-private-copies shape, waiting).
//
// THE RULE: a bucket whose guard REFUSES must name the remainder, and must carry it as a payload —
// the {district}/{lockSeconds} discipline, so a client can offer the ask instead of sending the
// player to read a board that never said so. Catalogue-or-declare, both directions: a bucket in
// neither list fails, and so does a declaration for a bucket the tree no longer has.
{
  const REMAINDER = /\b(headroom|left|Left|refill|Refill|remaining|pool|Pool)/;
  // bucket → the refusal it guards. The payload is what makes it machine-readable; the sentence is
  // checked by the wave regressions in test/client.js, which drive the real reply.
  const ENFORCED = {
    exchange_used: { file: 'src/exchange.js', codes: ['cap', 'dry'] },
    vault_used: { file: 'src/treasury.js', codes: ['daily_cap'] },
    bust_used: { file: 'src/social/combat.js', codes: ['bust_cap'] },
    safehouse_used: { file: 'src/social/defense.js', codes: ['safe_cap'] },
  };
  // Declared: a bucket that REFUSES NOBODY has no remainder to name. Each reason is a property of
  // the bucket, not a preference — meter silently and there is no sentence to get wrong.
  const DECLARED = {
    port_used: 'refuses, and already names the remainder — `The supplier can only move ${usd(left)} more contraband today` (this was the pattern the others should have followed)',
    wash_used: 'the D3 public wash cap guarded swap-buy, which tokenomics v3 severed — no live refusal reads it',
    launder_used: 'business laundering is retired (`launderAtBusiness` throws `retired`); the column and its board figure are vestigial',
    rwa_used: 'the RICO structuring window ADDS HEAT rather than refusing — there is no refusal to name a figure in',
    noto_used: 'an internal per-patron clamp on how much notoriety one account can put on a club — it silences a grief vector, it never refuses the player',
    statuse_used: 'the stats-by-use drip is metered SILENTLY by design — a gift that scolds you for taking it too often is worse than one that simply stops',
    refill_used: 'the level-up refill ceiling is metered SILENTLY for the same reason (BALANCE § THE REFILL CEILING) — the crossing still happens, only the gift is bounded',
  };

  // the corpus is every bucket the TREE has, never the two lists — a ledger that enumerates itself
  // cannot notice a twelfth bucket landing tomorrow.
  const found = new Set();
  for (const f of files) for (const m of fs.readFileSync(f, 'utf8').matchAll(/\b(\w+)_used\b/g)) found.add(`${m[1]}_used`);
  assert(found.size >= 8, `THE BUCKET LEDGER found only ${found.size} token buckets — the extractor is `
    + 'broken, not the tree. A scan that sees nothing passes for a clean sweep.');

  const undeclared = [...found].filter((b) => !ENFORCED[b] && !DECLARED[b]);
  assert.deepEqual(undeclared, [], 'rolling token bucket(s) in neither list. A bucket that REFUSES must '
    + 'name what is LEFT (and carry it as a payload) — "come back tomorrow" is false for anything that '
    + 'refills on the wall clock. One that refuses nobody is declared with the property that makes it '
    + `silent:\n   - ${undeclared.join('\n   - ')}`);
  const stale = [...Object.keys(ENFORCED), ...Object.keys(DECLARED)].filter((b) => !found.has(b));
  assert.deepEqual(stale, [], 'declaration(s) for a bucket the tree no longer has. A stale waiver '
    + `silently re-covers the next bucket that takes the name:\n   - ${stale.join('\n   - ')}`);

  const mute = [];
  for (const [bucket, { file, codes }] of Object.entries(ENFORCED)) {
    const s = fs.readFileSync(file, 'utf8');
    for (const code of codes) {
      const re = new RegExp(`\\bGameError\\(\\s*'${code}'`, 'g');
      let seen = 0;
      for (const m of s.matchAll(re)) {
        // walk the balanced argument list (skipping string bodies so a `)` in a message cannot
        // miscount), then split on DEPTH-0 commas: the third argument is the payload.
        let i = m.index + m[0].length - `'${code}'`.length, depth = 1, str = null;
        const start = i;
        while (i < s.length && depth > 0) {
          const c = s[i];
          if (str) { if (c === '\\') { i += 2; continue; } if (c === str) str = null; }
          else if (c === "'" || c === '"' || c === '`') str = c;
          else if (c === '(' || c === '{' || c === '[') depth++;
          else if (c === ')' || c === '}' || c === ']') depth--;
          i++;
        }
        const args = s.slice(start, i - 1);
        const parts = []; let d = 0, q = null, last = 0;
        for (let j = 0; j < args.length; j++) {
          const c = args[j];
          if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
          if (c === "'" || c === '"' || c === '`') { q = c; continue; }
          if ('([{'.includes(c)) d++;
          else if (')]}'.includes(c)) d--;
          else if (c === ',' && d === 0) { parts.push(args.slice(last, j)); last = j + 1; }
        }
        parts.push(args.slice(last));
        seen++;
        if (parts.length < 3 || !REMAINDER.test(parts.slice(2).join(',')))
          mute.push(`${file} — GameError('${code}', …) guards ${bucket} and carries no remainder in its payload`);
      }
      assert(seen > 0, `THE BUCKET LEDGER found no GameError('${code}') in ${file} — the ENFORCED entry `
        + 'for ' + bucket + ' points at a refusal that has moved or gone. A mapping that matches nothing '
        + 'reads exactly like a rule that holds.');
    }
  }
  assert.deepEqual(mute, [], 'bucket refusal(s) naming the BOUND with no machine-readable remainder. The '
    + 'figure a capped player needs is what is LEFT (or when it reopens), and it is computed one line '
    + 'above the throw — pass it as the third GameError argument so a client can offer the ask:\n   - '
    + mute.join('\n   - '));
  console.log(`✓ all ${found.size} rolling token buckets classified — ${Object.keys(ENFORCED).length} refuse and name what is left, ${Object.keys(DECLARED).length} refuse nobody`);
}
