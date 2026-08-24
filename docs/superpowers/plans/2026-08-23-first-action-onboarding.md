# First-Action Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hand a new player from the second tour step directly to the real Streets crime controls, then prove the first job and coach transition in an isolated browser.

**Architecture:** Keep the server and gameplay routes unchanged. Replace the four-slide client tour with a two-step arrival-to-action handoff, reuse `setTab()`, `SPOT.streets`, and the existing state-driven tips, and extend the current mobile Playwright harness to exercise the authenticated first session through the visible crime control.

**Tech Stack:** Vanilla browser JavaScript in `public/index.html`, Node.js assertions in `test/client.js`, Playwright Core with the in-process Fastify/pg-mem server in `tools/mobile.js`, repository-native npm checks.

**Spec:** `docs/superpowers/specs/2026-08-23-first-action-onboarding-design.md`

## Global Constraints

- The first crime remains an explicit choice submitted from the existing Streets renderer; tour code must never call `api()`, `act()`, or `/v1/crimes/*`.
- Preserve crime odds, rewards, costs, onboarding payouts, progression gates, schema, routes, telemetry, coach order, Start Here claims, and milestone-tip flags.
- First-run finish and first-run skip open Streets; replay close returns to the captured screen; the final **PULL YOUR FIRST JOB →** action always opens Streets.
- Write `omerta_tour2` and `omerta_welcomed` before closing the modal so contextual tips remain suppressed during the tour and become eligible after play.
- Use the existing modal semantics and reduced-motion behavior. Only the onboarding handoff opts into focus; existing spotlight callers keep scroll/highlight-only behavior.
- Browser verification uses the local in-process pg-mem server and disposable guest identity only. Never create or mutate a production account.
- The worktree contains approved but uncommitted changes in `public/index.html` and `test/client.js`. Do not stage or commit those overlapping files; verify exact diffs and preserve all unrelated work.

## File map

- `public/index.html`: owns tour content, tour completion/navigation policy, current-tab capture, and spotlight/focus behavior.
- `test/client.js`: owns deterministic source contracts proving the tour cannot drift back into four pre-play explanations or submit gameplay itself.
- `tools/mobile.js`: owns the real-browser first-session rehearsal against the local server.
- `SPEC.md`: owns the repository documentation census and changes only after the measured tree proves the current count stale.
- `knowledge/generated/*`: generator-owned output; rebuild with `npm run knowledge`, never edit by hand.

---

### Task 1: Lock the first-action contract red

**Files:**
- Modify: `test/client.js:72-108`
- Modify: `tools/mobile.js:192-212`

**Interfaces:**
- Consumes: current `TOUR`, `openTour()`, `tourStep()`, tour buttons, `setTab()`, `SPOT.streets`, the visible `#tab-streets .verbrow .prime` control, `/v1/me`.
- Produces: a static contract for `closeTour({ play })` and a browser contract proving tour step two → focused Streets control → real crime → coach advancement.

- [ ] **Step 1: Add the deterministic source contract to `test/client.js`**

Insert this block immediately after `const html = ...` and before the existing daily-guidance block:

```js
// ── 0c. FIRST ACTION HAPPENS AT TOUR STEP TWO ──────────────────────────────────────────────────
{
  const tourStart = html.indexOf('const TOUR = [');
  const tour = html.slice(tourStart, html.indexOf('let phoneOpenThread', tourStart));
  assert.equal((tour.match(/\{ art:/g) || []).length, 2,
    'the mandatory tour is arrival + first job; later lessons belong to state-driven tips');
  assert(tour.includes("action: 'first_job'"),
    'the Streets step declares the first-job handoff rather than behaving like generic prose');
  assert(tour.includes("'PULL YOUR FIRST JOB →'"),
    'the final primary action tells the player what happens next');
  assert(/closeTour\(\{ play: true \}\)/.test(tour),
    'the final action takes both first-run and replay users to play');
  assert(/closeTour\(\{ play: !tourReplay \}\)/.test(tour),
    'first-run skip opens Streets while replay close returns to its captured screen');
  assert(/tourReturnTab\s*=\s*currentTab/.test(tour) && /setTab\(tourReturnTab\)/.test(tour),
    'replay captures and restores the screen it interrupted');
  assert(/setTab\('streets'\)[\s\S]*?spotlight\(SPOT\.streets, true\)/.test(tour),
    'the play handoff opens Streets and opts into focus on the real crime control');
  assert(!/\b(?:api|act)\([^)]*\/v1\/crimes\//.test(tour),
    'tour code must not submit a crime or create a second gameplay client');
}
```

- [ ] **Step 2: Replace the mobile harness's tour skip with a first-action rehearsal**

Replace `tools/mobile.js:200-210` with the following flow. Keep the later full-screen walk unchanged.

```js
  // THE FIRST ACTION — the tour must hand this disposable local player to the REAL crime control.
  if (!(await page.locator('#welcome:not(.hidden)').count())) {
    fail('(first action)', vp, 'a fresh character never received the first-session tour');
  } else {
    await check(page, 'the tour (arrival)', vp);
    await page.click('#tour-next');
    const step2 = await page.evaluate(() => ({
      title: document.querySelector('#tour-title')?.textContent || '',
      action: document.querySelector('#tour-next')?.textContent || '',
      dots: document.querySelectorAll('#tour-dots i').length,
    }));
    if (step2.title !== 'THE STREETS' || !/PULL YOUR FIRST JOB/.test(step2.action) || step2.dots !== 2)
      fail('(first action)', vp, `step two must be the playable Streets handoff — ${JSON.stringify(step2)}`);
    await check(page, 'the tour (first job)', vp);
    await page.click('#tour-next');
    await page.waitForSelector('#welcome.hidden', { timeout: 5000 });
    await page.waitForTimeout(900); // setTab render + the spotlight's existing 700ms delay
    const handoff = await page.evaluate(() => ({
      streets: document.querySelector('#tab-streets')?.classList.contains('on') || false,
      completed: localStorage.getItem('omerta_tour2') === '1',
      target: document.activeElement?.matches?.('#tab-streets .verbrow .prime') || false,
      lit: document.activeElement?.classList?.contains('spotlit') || false,
    }));
    if (!handoff.streets || !handoff.completed || !handoff.target || !handoff.lit)
      fail('(first action)', vp, `tour did not land on the focused real crime control — ${JSON.stringify(handoff)}`);

    const crime = page.locator('#tab-streets .verbrow .prime').first();
    const random = Math.random;
    Math.random = () => 0; // pin the in-process server's crime die; the browser has its own realm
    try {
      await crime.click();
      await page.waitForTimeout(2200); // action response + vignette expiry + refresh
    } finally {
      Math.random = random;
    }
    const played = await page.evaluate(async () => {
      const h = { authorization: 'Bearer ' + localStorage.omerta_token };
      const [meR, obR] = await Promise.all([fetch('/v1/me', { headers: h }), fetch('/v1/onboard', { headers: h })]);
      const m = (await meR.json())?.character || {}, ob = await obR.json();
      const firstJob = (ob.tasks || []).find((t) => t.id === 'ob_crime');
      return { firstJobReady: !!(firstJob?.ready || firstJob?.claimed), coach: m.coach?.label || '',
        tourOpen: !document.querySelector('#welcome')?.classList.contains('hidden') };
    });
    if (!played.firstJobReady || played.coach === 'Pull your first job' || played.tourOpen)
      fail('(first action)', vp, `visible crime did not advance the fresh player's coach cleanly — ${JSON.stringify(played)}`);
  }

  // Start Here remains reachable and visible after the action-first handoff.
  await page.click('#tabs [data-tab="start"]');
  await check(page, 'start-here (after first action)', vp, { contentMustShow: true });
```

- [ ] **Step 3: Run the static contract and confirm the former tour fails**

Run: `node test/client.js`

Expected: FAIL at `the mandatory tour is arrival + first job` because the current `TOUR` has four entries and no `first_job` action.

- [ ] **Step 4: Run the browser rehearsal and confirm the former tour fails**

Run: `npm run mobile`

Expected: FAIL with a first-action finding because the second step's button still reads `next →`, finishing/skipping still opens Start Here, and no Streets target receives focus.

---

### Task 2: Implement the two-step action handoff

**Files:**
- Modify: `public/index.html:4460-4496`
- Modify: `public/index.html:5353-5367`

**Interfaces:**
- Consumes: `currentTab: string`, `setTab(id: string): void`, `SPOT.streets: string`, local-storage keys `omerta_tour2` and `omerta_welcomed`.
- Produces: `openTour(): void`, `closeTour({ play = false } = {}): void`, and `spotlight(sel: string, focus = false): void`.

- [ ] **Step 1: Replace the tour array and navigation policy**

Replace the current `TOUR`, `tourStep()`, `openTour()`, and `endTour()` block with this implementation:

```js
  const TOUR = [
    { art: 'hero-poster', title: 'WELCOME TO THE CITY', body:
      `<p>You start as a nobody in the Docks. The city remembers every job, debt, alliance, and enemy you make.</p>
       <p><b>Your first loop:</b> pull a job → earn cash and respect → bank the take → follow the next move on your sheet.</p>` },
    { art: 'interior-streets', title: 'THE STREETS', action: 'first_job', body:
      `<p><b style="color:var(--neon)">First goal: pull one job.</b> Jobs pay cash and respect; respect raises your level and opens the city.</p>
       <p class="dim">Jobs spend <b>nerve</b>, which refills on its own. The ordinary play is safest to learn. Quiet and loud variants make more sense once you know the terms.</p>` },
  ];
  let tourAt = 0, tourReplay = false, tourReturnTab = 'streets';
  function tourStep(i) {
    tourAt = Math.max(0, Math.min(TOUR.length - 1, i));
    const s = TOUR[tourAt], last = tourAt === TOUR.length - 1;
    $('#tour-art').src = `/art/${s.art}.jpg`;
    $('#tour-body').innerHTML = `<h2 id="tour-title">${s.title}</h2>${s.body}`;
    $('#tour-dots').innerHTML = TOUR.map((_, j) => `<i${j === tourAt ? ' class="on"' : ''}></i>`).join('');
    $('#tour-back').style.visibility = tourAt ? 'visible' : 'hidden';
    $('#tour-skip').textContent = tourReplay ? 'close' : 'skip';
    $('#tour-skip').style.display = last && !tourReplay ? 'none' : '';
    $('#tour-next').textContent = s.action === 'first_job' ? 'PULL YOUR FIRST JOB →' : 'next →';
  }
  function openTour() {
    tourReplay = !!localStorage.getItem('omerta_tour2');
    tourReturnTab = currentTab;
    tourStep(0);
    $('#welcome').classList.remove('hidden');
  }
  window.openTour = openTour;
  const closeTour = ({ play = false } = {}) => {
    localStorage.setItem('omerta_tour2', '1');
    localStorage.setItem('omerta_welcomed', '1');
    $('#welcome').classList.add('hidden');
    if (play || !tourReplay) {
      setTab('streets');
      spotlight(SPOT.streets, true);
    } else setTab(tourReturnTab);
  };
  $('#tour-next').onclick = () => (tourAt === TOUR.length - 1
    ? closeTour({ play: true }) : tourStep(tourAt + 1));
  $('#tour-back').onclick = () => tourStep(tourAt - 1);
  $('#tour-skip').onclick = () => closeTour({ play: !tourReplay });
```

- [ ] **Step 2: Add opt-in focus to the shared spotlight helper**

Change only the function signature and add the guarded focus call; leave every existing one-argument caller unchanged:

```js
  function spotlight(sel, focus = false) {
    if (!sel) return;
    setTimeout(() => {
      const scoped = sel.split(',').map((x) => `#tab-${currentTab} ${x.trim()}`).join(', ');
      const el = document.querySelector(scoped) || document.querySelector(sel);
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: REDUCED ? 'auto' : 'smooth' });
      el.classList.add('spotlit');
      if (focus && typeof el.focus === 'function') el.focus({ preventScroll: true });
      setTimeout(() => el.classList.remove('spotlit'), 6500);
    }, 700);
  }
```

- [ ] **Step 3: Run the focused static and onboarding suites**

Run: `node test/client.js`

Expected: PASS, including the new first-action contract and all existing client/server mirror checks.

Run: `node test/growth.js`

Expected: PASS, including the fresh-character `Pull your first job` coach and post-crime advancement assertions.

- [ ] **Step 4: Run the authenticated browser rehearsal**

Run: `npm run mobile`

Expected: PASS on both mobile viewports. Each disposable local player sees two tour steps, lands on the focused standard crime button, completes one visible crime under the harness-pinned in-process roll, advances the coach, and can still open Start Here.

- [ ] **Step 5: Review the exact implementation diff**

Run:

```text
git diff -- public/index.html test/client.js tools/mobile.js
git diff --check -- public/index.html test/client.js tools/mobile.js
```

Expected: only the tour, opt-in focus, deterministic contract, and first-session browser rehearsal changed. Do not stage or commit the overlapping dirty files.

---

### Task 3: Independent review and repository reconciliation

**Files:**
- Modify: `SPEC.md:21` only if `node test/docs.js` reports the documentation census changed
- Regenerate: `knowledge/generated/*` with `npm run knowledge`

**Interfaces:**
- Consumes: the completed Task 2 diff and the repository's test, documentation, and knowledge generators.
- Produces: independent spec/correctness review, green full suite, current documentation census, and a provenance-valid knowledge graph.

- [ ] **Step 1: Request independent specification-compliance review**

Give a fresh reviewer the approved spec, this plan, and only the three implementation-file diffs. Require explicit findings for: first action by step two, no gameplay submission in the tour, replay/skip destination policy, completion-flag ordering, focused real control, and production-state isolation.

Expected: APPROVED or a concrete file/line finding. Resolve every material finding with a red regression before continuing.

- [ ] **Step 2: Request independent code-quality review**

Give a different fresh reviewer the resolved diff. Require checks for modal/replay edge cases, focus regressions on existing spotlight callers, brittle browser waits, random-crime flake risk, and accidental capture of unrelated dirty changes.

Expected: APPROVED or a concrete file/line finding. Resolve and rerun Task 2 checks for every material finding.

- [ ] **Step 3: Run the complete repository suite**

Run: `npm test`

Expected: PASS through gameplay, route/client census, engagement, docs, playthrough truth, and knowledge tests. If docs or knowledge freshness alone fails, continue to the measured reconciliation steps below; any behavior failure returns to Task 2.

- [ ] **Step 4: Reconcile the measured documentation census**

Run: `node test/docs.js`

Expected before reconciliation: FAIL because the approved spec and this plan add two Markdown files beyond `SPEC.md`'s recorded 396. Count the tree with the same command used by `test/docs.js`, update only the `Design + audit docs` count and line total in `SPEC.md`, then rerun `node test/docs.js` to PASS. Do not estimate the line total.

- [ ] **Step 5: Rebuild and validate knowledge artifacts**

Run:

```text
npm run knowledge
npm run knowledge:check
node tools/knowledge-test.js
```

Expected: the graph rebuild reports its new census, then both checks confirm current generated artifacts, valid provenance, endpoints, and links.

- [ ] **Step 6: Run final changed-surface checks**

Run:

```text
node test/client.js
node test/growth.js
npm run mobile
node test/docs.js
git diff --check
git status --short
```

Expected: every check passes; status still shows pre-existing dirty work, with no unrelated file staged or removed.

- [ ] **Step 7: Record the handoff**

Report the first-session result, exact test commands, final knowledge-graph census, review outcomes, documentation census, and the fact that overlapping implementation files remain uncommitted to preserve unrelated worktree changes.
