# Impeccable Critique — Assessment B (detector + browser evidence)

## Provenance

- Assessment: **B only**, run independently from Assessment A.
- Target: `https://omerta.fun` (redirects to `https://www.omerta.fun/`).
- Project: `C:\Users\Jorge\Documents\Omerta`.
- Date: 2026-08-23.
- Required references read in full: Impeccable `SKILL.md`, `reference/critique.md`, `reference/product.md`, and Browser `SKILL.md`.
- Impeccable context result: `NO_PRODUCT_MD`; the shipped UI and committed visual system were used as product context.
- Ignore list: `.impeccable/critique/ignore.md` does not exist.
- Product code was not edited. This assessment added only this report and screenshots under `.audit/`.

## Scope and limits

Live browser inspection covered four representative public surfaces in desktop and phone viewports:

1. `/` — public landing/authentication surface and the DOM shell for the human game console.
2. `/arena` — live autonomous-agent leaderboard and acquisition surface.
3. `/play` — three-step agent setup guide.
4. `/wiki` — the Codex/reference experience.

The authenticated human console is gated by sign-in or creation of a guest account. No test credentials were provided, and creating an account is an external side effect, so Assessment B did not create one. The authenticated console was therefore inspected from committed `public/index.html` source only. This is the largest coverage limitation for a request phrased as the “entire UI.” Source evidence still covers its navigation model, mobile sizing, dialogs, keyboard path, motion handling, and accessibility semantics.

## Deterministic detector

Command (using the required bundled runtime):

```powershell
& 'C:\Users\Jorge\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' \
  'C:\Users\Jorge\.codex\plugins\cache\openai-curated-remote\impeccable\3.9.1\skills\impeccable\scripts\detect.mjs' \
  --json public
```

Observed result: **10 warnings**. The process exited **1**, although the critique reference documents exit code 2 for findings. JSON output was complete and usable.

| Rule | Count | Files / locations | Detector evidence |
|---|---:|---|---|
| `side-tab` | 4 | `public/arena.html:46`; `public/fee-flows.html:83,109`; `public/play.html:37` | 3px or 5px single-side accent borders |
| `em-dash-overuse` | 3 | `public/arena.html` (10); `public/index.html` (49); `public/play.html` (11) | More than two em dashes in body copy |
| `bounce-easing` | 1 | `public/index.html:631` | `cubic-bezier(.2,1.6,.4,1)` on the crime-result stamp |
| `broken-image` | 1 | `public/index.html:1267` | `<img id="tour-art" alt="" src="">` |
| `dark-glow` | 1 | `public/index.html:166` | Colored success glow on the dark page |

### Detector interpretation and false positives

- `side-tab` is a real match to Impeccable’s explicit ban. It is visibly repeated on all three Arena cards and the highlighted quotation on `/play`; the `fee-flows` instances were not part of the four-page browser sample.
- `em-dash-overuse` is partly the site’s deliberate noir/editorial voice, so count alone is not an accessibility failure. It does become a scanability issue in the densest Arena and landing paragraphs.
- `bounce-easing` is not a generic page entrance: it is a short game-result stamp. The detector is correct mechanically, but the context lowers impact from systemic to localized polish.
- `broken-image` is visually hidden in the first-session tour until JavaScript supplies the art. The live DOM nevertheless reports it as complete with `naturalWidth: 0`, so the warning is technically valid but not a visible broken box in the audited unauthenticated state.
- `dark-glow` is overly broad for a noir game whose glows communicate success, danger, and live state. It should not be treated as a reason to remove all state lighting; the issue is repetition and restraint, not the existence of a glow.

### Significant anti-patterns the detector missed

- `public/wiki.html:26-28` uses gradient text for the Codex masthead (`background-clip:text; color:transparent`), an explicit Impeccable ban.
- The Codex renders a numbered marker on every section (`#doc .num`, visible as `01 — START`, `02 — START`, etc.), matching the banned “numbered section markers as scaffolding” pattern.
- The landing includes a procedural grain data SVG using `feTurbulence` (`.grain`), another explicit Codex/AI-tell called out by the skill.
- `public/wiki.html` uses a 2px left accent on `.loop`; the detector found 3px/5px side stripes but missed this instance.
- The Arena uses the repeated hero-metric card pattern: six same-shaped number/label cards, including five zeros and a lone sixth card wrapping to a second desktop row.

## Browser visualization / overlay flow

The required overlay flow was attempted in a **fresh in-app browser tab**.

1. Opened a new tab and navigated to `https://omerta.fun/` (resolved to `https://www.omerta.fun/`).
2. Preflight attempted both required mutations in one evaluation: set `document.title` and append a `<script data-impeccable-preflight>` element.
3. Mutation failed immediately with: `TypeError: Cannot set property title of [object Object] which has only a getter`.
4. This browser’s Playwright evaluation surface is read-only, matching the Browser skill’s warning. Because mutable injection was unavailable, the critique flow required skipping the helper live server, browser presentation, `detect.js` injection, and `impeccable` console collection.
5. No live server was started, so there was no server process to stop. No overlay temp file was created.
6. Browser visibility remained `false`; it was never presented as a `[Human]` overlay tab.
7. The responsive viewport override was reset and the fresh audit tab was closed.

**Fallback signal:** deterministic CLI findings, read-only live DOM measurements, committed source inspection, console logs, and eight saved browser screenshots. There is **no reliable user-visible overlay** for this run.

## Screenshot evidence

- `C:\Users\Jorge\Documents\Omerta\.audit\screenshots\home-desktop.png`
- `C:\Users\Jorge\Documents\Omerta\.audit\screenshots\home-mobile.png`
- `C:\Users\Jorge\Documents\Omerta\.audit\screenshots\arena-desktop.png`
- `C:\Users\Jorge\Documents\Omerta\.audit\screenshots\arena-mobile.png`
- `C:\Users\Jorge\Documents\Omerta\.audit\screenshots\play-desktop.png`
- `C:\Users\Jorge\Documents\Omerta\.audit\screenshots\play-mobile.png`
- `C:\Users\Jorge\Documents\Omerta\.audit\screenshots\wiki-desktop.png`
- `C:\Users\Jorge\Documents\Omerta\.audit\screenshots\wiki-mobile.png`

The homepage, Arena, and Play screenshots are full-page captures. The Codex screenshots capture the initial viewport because its document is 34,763px tall on desktop and 48,903px on mobile.

## Cross-page DOM and responsive measurements

“Small target” means a visible anchor, button, input, select, textarea, summary, or `role=button` whose rendered width or height is below 44px. This is a clue, not an automatic failure: inline text links are naturally less than 44px tall, while compact standalone controls and navigation rows are stronger failures.

| Page / viewport | Document height | Links | Buttons | Inputs | Visible interactives | Small-target clues | Landmarks | `<main>` | `aria-live` | Horizontal overflow |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `/` 1440×900 | 3,147px | 7 | 31 total | 9 total / 3 visible | 15 | 12 | 1 | 0 | 0 | none |
| `/` 390×844 | 3,974px | 7 | 31 total | 9 total / 3 visible | 14 | 12 | 1 | 0 | 0 | none |
| `/arena` 1280×800 | 1,769px | 15 | 0 | 0 | 15 | 8 | 2 | 0 | 0 | none |
| `/arena` 390×844, fully loaded | 2,821px | 15 | 0 | 0 | 15 | 8 | 2 | 0 | 0 | none |
| `/play` 1280×800 | 2,034px | 13 | 2 | 0 | 19 | 19 | 2 | 0 | 0 | none |
| `/play` 390×844 | 2,928px | 13 | 2 | 0 | 19 | 18 | 2 | 0 | 0 | none |
| `/wiki` 1280×800 | 34,763px | 43 | 0 | 1 | 44 | 39 | 0 | 0 | 0 | none |
| `/wiki` 390×844 | 48,903px | 43 | 0 | 1 | 44 | 43 | 0 | 0 | 0 | none |

No tested viewport produced positive page-level horizontal overflow. This is a meaningful strength, especially given the long code samples, tables, and dense game vocabulary.

## Page-by-page evidence

### `/` — landing and authentication

Visual evidence:

- The first viewport has a strong, legible noir scene, one dominant action (“ENTER AS A GHOST”), a clear one-sentence premise, and an attractive poster-grade wordmark.
- The live Wire ticker is visually close to black-on-black in the screenshot; its content is almost invisible compared with the hero title and CTA.
- Six feature cards repeat the same template and visual weight. Their copy is substantial, and the “Agents welcome” card contains three inline links, producing a dense acquisition block.
- A large cinematic city image creates a long, nearly actionless scroll interval before the “Money Map.” On mobile it becomes a substantial separator but is less extreme than desktop.
- The 90-second Money Map video and the long “Two economies, deliberately severed” essay precede the sign-in choices at the bottom. Users who do not choose the immediate guest CTA must traverse a very long persuasion sequence before OAuth sign-in.
- The mobile layout does not overflow, preserves the primary CTA, stacks cards cleanly, and keeps text at a readable 14px median.

DOM/accessibility evidence:

- Visible heading order is `H1` followed by six `H3`s, then `H2`s. The feature-card headings skip level 2.
- There are no visible form labels. The provider `<select id="auth-provider">`, provider token `<input id="auth-token">`, and language `<select>` lack `<label>`, `aria-label`, and `aria-labelledby`.
- `<button id="btn-provider">` is visually rendered but has no inner text, `aria-label`, or title, so it has no accessible name.
- The page has no `<main>` landmark and no live region despite dynamic authentication/status surfaces.
- The hidden first-session tour image is a broken resource in the unauthenticated DOM (`naturalWidth: 0`, empty alt, URL resolved to the page root).
- The source includes a robust `:focus-visible` outline and reduced-motion kill switch.

Standalone mobile controls below 44px include the provider select (39px high), provider token input (38px), provider submit button (40px), and language select (39px). The large guest and X buttons are 50–52px high and pass comfortably.

### `/arena` — live agent leaderboard

Visual evidence:

- The “live board” presentation loads successfully and uses a clear hierarchy.
- Current data is an empty city: five zero-like metrics plus a wealth band, a sixth “0 kills” card, and an empty Hall of Fame. Desktop layout leaves the sixth metric alone on a second row; mobile produces a balanced two-column grid but devotes a large first screen to zeros.
- The page claims live activity yet provides no last-updated time, refresh affordance, skeleton, or connection state once loaded.
- All three educational cards use the detector-flagged side stripe. The page then ends with another seven-card link grid, creating two visually repetitive card systems.
- On mobile, long agent-economy prose becomes a dense uninterrupted block. Code samples scroll internally without forcing the page wide.

DOM/accessibility evidence:

- Dynamic stats, pitch, leaderboard, and link content are inserted asynchronously with zero `aria-live` regions.
- There is no `<main>` element. The only landmarks are the `header` and `footer`.
- Eight compact inline links are below 44px in at least one dimension. The large machine-surface link cards are adequately sized on mobile.
- A second measurement 2.5 seconds after navigation was necessary to capture all 15 links; the first immediate mobile measurement saw only 7 static links while asynchronous content was still arriving. The UI has loading text, but assistive technology is not notified when the content changes.

### `/play` — agent setup guide

Visual evidence:

- The three numbered steps provide excellent chunking and a coherent linear path. Copy buttons are placed directly on the snippets, and the FAQ addresses realistic failure cases.
- The surface is visually much flatter than the cinematic home page: same dark background, but no shared masthead, imagery, or persistent site navigation. It reads as a separate documentation microsite.
- Mobile stacking is clean with no page overflow. However, the config-table file paths wrap into awkward fragments, and code snippets rely on horizontal scrolling with little indication that more content exists.
- The introductory requirement copy and notes are dim/italic, which reduces scan speed.

DOM/accessibility evidence:

- Heading order is `H1` → three `H3` step titles → `H2`; the step headings skip level 2.
- Both Copy buttons render at approximately 55×22px on desktop and mobile, far below a 44px touch target.
- FAQ summaries are 22px high on desktop; three become 43px on mobile, but “I want to build my own bot instead” remains 22px high.
- Copy feedback changes the button text to “Copied” for 1.4 seconds, but there is no live region, so a screen reader may not announce success.
- The page has no `<main>` landmark. Header and footer are the only landmarks.

### `/wiki` — Codex

Visual evidence:

- Desktop has a useful two-column reference layout, sticky contents, full-text search, active-section tracking, a constrained reading column, and a functional back-to-top link.
- The mobile layout is the strongest measured UX failure. The full table of contents remains expanded above the article with `max-height:44vh`, producing a nested scroll region that consumes roughly 371px of an 844px viewport plus the top bar. Users land with less than half the screen available for content and must manage page scroll plus sidebar scroll.
- The document expands from 34,763px on desktop to 48,903px on mobile. The contents list has 41 section links; all remain in the mobile DOM and visible inside the nested scroller. There is no collapse/drawer control.
- The custom scrollbar appears as a bright white rail against the black UI, visually breaking the palette.
- Every section repeats a tiny tracked number/group marker and large all-caps heading. The scheme gives orientation but also exactly matches the banned numbered-section scaffold and makes a 49-heading document feel more mechanically generated.
- The masthead uses gradient-clipped text, which the detector missed.

DOM/accessibility evidence:

- The search input has an explicit `aria-label` and the no-result state is useful. Searching `zzzzzz` hid all 41 sections and displayed: “Nothing matches … Try a shorter word.”
- The search result update has no live region, and no result count or highlight is provided for non-empty queries.
- The page has zero semantic landmarks (`main`, `nav`, `header`, `footer`, `aside`, or equivalent roles) despite visually presenting a top bar, navigation, and main document.
- On mobile, the search control is 35px high, the city link 33px, and all 41 contents rows are 31px high.
- `--faint` text is used for section numbers, nav group labels, route receipts, and placeholder copy at contrast ratios around 3.2–3.4:1 on the dark surfaces; much of it is only 10–12px.

## Contrast measurements

Ratios were calculated from committed color tokens using WCAG relative luminance. Image-backed hero text needs screenshot/pixel-level analysis and is not represented by these flat-token ratios.

| Token pairing | Ratio | Evidence / implication |
|---|---:|---|
| Landing `--dim #85826f` on `--bg #0a0a0e` | 5.10:1 | Passes normal-text AA |
| Landing `--faint #858276` on `--bg #0a0a0e` | 5.13:1 | Passes normal-text AA |
| Arena/Play `--dim #7d7a6f` on `--bg #0b0b0e` | 4.57:1 | Barely passes normal-text AA |
| Arena/Play `--dim #7d7a6f` on `--panel #131318` | 4.31:1 | Fails normal-text AA; used by 11–13px labels/copy on panels |
| Arena/Play `--ink #d6d2c4` on `--bg #0b0b0e` | 12.99:1 | Strong pass |
| Codex `--dim #9a9184` on `--bg #0a0908` | 6.40:1 | Pass |
| Codex `--faint #6b6357` on `--bg #0a0908` | 3.36:1 | Fails normal-text AA |
| Codex `--faint #6b6357` on `--panel #121110` | 3.19:1 | Fails normal-text AA |
| Codex `--neon #c9a24a` on `--bg #0a0908` | 8.29:1 | Strong pass |

## Media and performance clues

Browser performance entries/network waterfalls were not exposed by the selected browser API, so no transfer-time claims are made. Local shipped asset sizes provide useful risk clues:

| Asset | Local size | Behavior |
|---|---:|---|
| `hero-poster.mp4` | 1,489,497 bytes | Muted autoplay loop, mounted only when not reduced-motion and not Save-Data; good gating |
| `hype-money.mp4` | 53,855,688 bytes | User-controlled 1:26 video with `preload="metadata"`; playback is a major mobile bandwidth commitment |
| `landing-break.jpg` | 749,629 bytes | Large full-width cinematic separator |
| `hype-money-poster.jpg` | 109,915 bytes | Video poster |
| `display.woff2` | 12,740 bytes | Small self-hosted display font |

Positive implementation evidence:

- Hero motion has reduced-motion and Save-Data gates and fails back to the still image.
- The long Money Map video uses `preload="metadata"`, avoiding an automatic 53.9MB download.
- CSS includes a global reduced-motion rule and visible focus styles.
- All tested public surfaces avoided page-level horizontal overflow at 390px.

## Authenticated console — source-only evidence

The committed game shell defines **30 screens** (`start`, `profile`, `streets`, `pvp`, `kitchen`, `family`, `map`, `deeds`, `crew`, `discover`, `market`, `garage`, `empire`, `speakeasy`, `boxing`, `races`, `stable`, `scores`, `loans`, `portfolio`, `estate`, `life`, `pen`, `law`, `wire`, `store`, `city`, `den`, `port`, `deck`). It groups them into named rails and uses progressive disclosure:

- New players below level 8 see six screens: Start, Profile, Streets, Garage, City, and Family.
- Full mode exposes grouped clusters and remembers the last screen in each group.
- `/` opens a quick-jump command surface, a useful expert shortcut.
- Mobile moves the active tab content ahead of the sheet and Wire, adds a sticky vitals strip, and supplies bottom/thumb navigation.

Concrete accessibility and interaction gaps visible in source:

- Tabs are created as bare `<button data-tab>` elements and panels as bare `<div class="tab">`; there are no `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-controls`, `aria-selected`, or `aria-labelledby` relationships.
- Custom modal overlays are plain `.modal-bg` / `.modal` divs with no `dialog` role or `aria-modal`; there is no general focus-trap implementation. Only the quick-jump input handles Escape explicitly.
- Mobile group/tab buttons are `min-height:40px`; general action controls and inputs are `min-height:38px`, below the 44px target named in the critique persona guidance.
- Visible focus rings are implemented globally, top icon controls have labels, and `/` opens quick-jump without stealing keystrokes from form fields; these are meaningful strengths.
- The first-session tour supports skip/back/next and reduced-motion media behavior, but it cannot be visually validated without creating/signing into an account.

## Cross-surface consistency evidence

The public surfaces share noir colors but not one coherent component/navigation system:

- Landing/game shell: self-hosted condensed display face, `--neon #e8b34b`, 7–12px radii, rich imagery, layered shadows.
- Arena/Play: mostly Georgia headings, `--neon #e8b34b`, 5–6px radii, flat documentation cards, no persistent top navigation.
- Codex: separate `--neon #c9a24a`, 2px radii, a different display token, gradient masthead, persistent top bar and sidebar.

This produces three recognizable visual dialects for one product. The strongest shared elements are color, serif body text, tracked caps, and noir copy; navigation, component geometry, heading treatment, and information density vary substantially.

## Browser diagnostics and cleanup

- Fresh tab: yes.
- Browser screenshots: 8 saved successfully.
- Console errors: none reported on `/`, `/arena`, `/play`, or `/wiki` in the inspected states.
- Network-error inspection: not supported by the selected browser API; successful rendered content and empty console were used as fallback signals.
- Overlay injection: failed at mutable preflight; no `impeccable` console messages exist.
- Browser visibility: remained hidden (`false`).
- Local live server: not started because mutation was unavailable; cleanup not applicable.
- Viewport override: reset.
- Audit tab: closed.
- Temp files: none created.

## Evidence-backed priorities for parent synthesis

1. **P1 candidate — mobile Codex navigation:** 44vh nested contents scroller, 41 compact rows, less than half a phone viewport left for reading, 48,903px document, and no collapse/drawer.
2. **P1 candidate — semantic/accessibility architecture:** zero `<main>` landmarks across all sampled pages, zero landmarks in Codex, unlabeled landing auth controls, an unnamed submit button, dynamic content without live regions, and source-only tab/modal semantics gaps.
3. **P1/P2 candidate — full game audit coverage:** the core logged-in console was not visually testable without account creation/test credentials; a release-level “entire UI” critique should include a seeded test account and representative game states.
4. **P2 candidate — cross-surface system drift:** three public-site dialects with different geometry, heading systems, and navigation conventions.
5. **P2 candidate — mobile target sizing:** standalone Copy, FAQ, Codex navigation/search, landing auth controls, and source-defined game controls fall below 44px.
6. **P2 candidate — hierarchy and cognitive load:** 30 console screens (mitigated by progressive disclosure), 49 Codex headings, long landing persuasion before OAuth, and zero-heavy Arena metrics.
7. **P2/P3 candidate — detector/AI tells:** side stripes, gradient text, numbered section markers, procedural grain, repeated metric/card templates, em-dash density, and one bounce easing.
8. **P3 candidate — content/state polish:** Arena lacks last-updated/refresh semantics; Copy success is not announced; the landing Wire ticker is visually too subdued; Codex search lacks result count/highlighting.

