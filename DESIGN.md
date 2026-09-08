# OMERTA interface direction

OMERTA is artifact-led noir: cinematic at thresholds and high-consequence moments; documentary during routine play. Operational screens should feel like ledgers, dossiers, maps, contracts, receipts, and case files—not generic dashboard cards wearing a dark theme.

## Product principles

1. **The city keeps receipts.** Show costs, risk, status, result, and recovery beside the action they describe.
2. **One move has the floor.** Every operational surface identifies a primary next action. Secondary and dangerous actions remain visually distinct.
3. **Drama is earned.** Use photography, motion, glow, and full-screen reveals for entry, death, indictment, victory, and other peaks. Routine operations stay calm and scannable.
4. **Depth unfolds.** New players get a compact route and one recommendation; advanced systems remain reachable through grouped navigation and search.
5. **Machine truth is human truth.** Public copy, the Codex, the console, and the API must describe the same status and constraints—especially the dormant extraction rail.

## Token contract

The source of truth is `public/omerta-ui.css`. New work uses `--om-*` tokens. Existing short aliases remain only as a compatibility layer.

### Colour

| Token | Value | Use |
|---|---:|---|
| `--om-surface-canvas` | `#0a0909` | Page background |
| `--om-surface-panel` | `#141214` | Standard ledger/panel |
| `--om-surface-raised` | `#1a1719` | Interactive or raised artifacts |
| `--om-border-subtle` | `#302a2d` | Rules and passive boundaries |
| `--om-text-primary` | `#eee6d7` | Headings and primary content |
| `--om-text-secondary` | `#c9c0b1` | Supporting readable content |
| `--om-text-muted` | `#9f9688` | Metadata; never essential information by itself |
| `--om-action-primary` | `#cda653` | Primary action and active location |
| `--om-status-danger` | `#d36b61` | Irreversible action, loss, blocking error |
| `--om-status-warning` | `#e0bd72` | Caution and a reversible risk state |
| `--om-status-success` | `#78ae8a` | Confirmed success |
| `--om-status-info` | `#80a6c1` | Neutral system status |

Colour never carries meaning alone. Status needs text or an icon, and text/background pairs must meet WCAG AA.

### Type

| Role | Token | Use |
|---|---|---|
| Display | `--om-font-display` | Wordmark, location plates, cinematic titles |
| Body | `--om-font-body` | Narrative, explanations, long reading |
| Data | `--om-font-data` | Balances, controls, labels, routes, time, status |

Display type is identity, not body copy. Dense operational copy should be at least 14px; public reading copy should be 16px with a 66–72 character measure.

### Spacing and shape

The spacing scale is 4, 8, 12, 16, 24, 32, 48, and 64px. Use 3–6px radii for ledgers and controls; reserve 10px for large overlays or cinematic panels. Target size is 44×44px on touch surfaces.

### Motion

Motion explains where an interface object came from, what just changed, or what completed. It is not ambient decoration.

| Timing | Token | Use |
|---|---|---|
| 80ms | `--duration-micro` | Press and direct feedback |
| 150ms | `--duration-quick` | Dismissal, hover, colour, and border changes |
| 250ms | `--duration-fast` | Menus, panels, modals, and operation receipts |
| 350–400ms | `--duration-medium` / `--duration-slow` | Toasts and larger public artifacts |

Entrances use `--ease-smooth-out`; direct state changes use `--ease-out`. Menus animate from their trigger edge, and closing is faster than opening. Avoid elastic or bouncing motion. All new animation must remain legible when `prefers-reduced-motion: reduce` collapses its duration.

## Navigation

- Public pages share: City, Codex, Arena, Agent setup, and a primary entry action.
- New human players see four high-frequency mobile destinations plus **More**.
- Full console navigation is grouped by player intent: Streets, Earners, Vice, Blood, Family, Legit.
- Search/quick-jump is the dependable route to the long tail and must remain keyboard reachable with `/`.
- Tabs expose `tablist`, `tab`, `tabpanel`, selection state, and arrow-key behavior.
- Arrow, Home, and End activation keeps focus in the tab rail; opening a destination from search moves focus into the named panel. Refreshes must preserve work in progress without hiding a completed action's new state.
- The landing's four-link index leads to gameplay, Paths, agents, and money. Illustrated gameplay entries link directly to named Codex sections; decorative imagery is silent to screen readers.
- Codex search supports `/`, Enter to open the first result, and Escape to reset. Each section offers its own link, and wide tables are keyboard-scrollable.

## Content and voice

The voice is terse, specific, and in-world. It may be atmospheric, but it cannot obscure a term, consequence, or recovery path.

- Prefer: “Deposit clears in 1h 42m. Until then, a killer can take it.”
- Avoid: “Something went sideways.” when the system knows what failed.
- Button labels use concrete verbs: **Bank $500**, **Hire guard**, **Burn papers**.
- Dangerous confirmation copy names what changes, what is lost, and whether it can be undone.
- Public token/economy copy always distinguishes current production behavior from planned launch behavior.

## States and accessibility

Every async surface needs loading, success, empty, error, and retry states. Actions expose `aria-busy`; success uses a polite live region, blocking errors an assertive alert. Dialogs trap focus, support Escape when safe, and restore focus to the trigger. Reduced-motion and forced-colour modes preserve all information.

Focus uses an explicit two-pixel outline, including in forced-colour mode; shadows alone cannot carry it. Mobile entry fields use at least 16px type. Drafts survive failed sends and remain separate by conversation. Public rankings identify the actual snapshot time and keep the last successful snapshot visible if a refresh fails.

Ambient hero video starts only through **Animate scene**, with a visible **Pause scene** control. It pauses outside the viewport or when the page is hidden. Reduced-motion, Save-Data, and mobile visits keep the still photograph. Existing responsive art is the first choice; this refinement used no paid generations.

## Verification and delivery

`npm run ui:quality` checks the landing's 768 KB cold-transfer ceiling, responsive images, public keyboard navigation, search, dialogs, and core gameplay handoffs against a disposable local database. `npm run mobile` covers the broader phone screen catalog. Setup and coverage limits are documented below under Browser quality checks.

Installed clients fetch shared CSS from the network first, with an offline fallback. Each successful public page has its own cache entry; a Codex visit cannot replace the game's offline shell. API responses remain outside the service-worker cache.

## Review rule

Before adding a new hex value, shadow, spacing value, button treatment, navigation rail, or modal pattern, check the shared tokens and existing primitives. If the system cannot express the needed intent, extend the token or pattern deliberately and document the new role here.

## Browser quality checks

Run `npm run ui:quality` after changes to the public pages, shared styles, onboarding, or console navigation. The check starts the real application with disposable `pg-mem` data on a random loopback port and drives Chromium through the visible controls. It creates only a temporary local guest; it does not connect to the production game or need a wallet, API token, or paid media key.

The command refuses to run when `DATABASE_URL` is present. Use a fresh shell without that variable rather than pointing the harness at a persistent database. There is deliberately no remote base-URL option.

### Setup

Use the repository's installed dependencies (`npm ci` for a clean checkout). `playwright-core` does not download a browser as part of dependency installation. The quality check discovers installed Chrome, Windows Edge, or a Playwright-managed Chromium cache. To select a browser explicitly in PowerShell:

```powershell
$env:CHROMIUM_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
npm run ui:quality
```

On macOS or Linux:

```sh
CHROMIUM_PATH='/path/to/chrome' npm run ui:quality
```

An unavailable browser is a failure with setup guidance, never a skipped success. `PLAYWRIGHT_BROWSERS_PATH` is supported for an existing managed browser cache.

### What the focused check proves

The command prints each scenario as it starts and exits nonzero if an assertion fails or an uncaught browser error occurs. Its checks cover:

- First-paint reading and CTA visibility, the landing transfer budget, responsive hero coverage, and deferred media loading.
- Opt-in hero atmosphere: pointer movement fetches no video; Animate scene plays valid local media, and Pause scene stops it with matching accessible pressed states.
- Native city-guide links reach named Codex sections, and the phone's hero index links to named page sections with 44-pixel touch targets.
- Completion of the seven-question Path finder, useful result choices, and real downloadable image dimensions.
- Layout at 320 CSS pixels, primary touch targets, the Codex's highlighted search results, and the Arena's empty state.
- Local guest onboarding, meaningful action costs and blockers, scoped pending feedback, result receipts, and recovery after a rejected action.
- Keyboard-triggered Gym training updates its visible recovery gate after success and keeps focus usable in the refreshed screen.
- Reuse of the same idempotency key after a simulated in-progress response, then completion against the real local server.
- Repeated arrow-key navigation through the console tablist, Home/End/wrap behavior, one selected and tabbable tab, and a matching visible panel.
- Quick-jump keyboard results and focus at the destination; static and generated dialog focus containment, Escape cancellation, and return to the opener.
- Real Tab/Enter access through public skip links, named navigation and main landmarks, document language, and page titles.
- Reduced-motion visits to the city, Codex, agent setup, and Arena, with no running animation, autoplaying video, or smooth scrolling.

Selectors describe stable UI contracts and native roles. Keyboard checks send real key events instead of invoking private application functions, so a visually correct control that strands focus still fails.

### Diagnosing failures

Failure messages include the scenario or route and measured state. Check the first problem before treating later failures as independent: a broken guest boot can prevent every console check from running.

For a screenshot when a scenario stops on an exception or timeout, set an output directory outside the tracked source tree:

```powershell
$env:UI_QUALITY_SHOTS = Join-Path $env:TEMP 'omerta-ui-quality'
npm run ui:quality
```

The harness then captures each still-open page before closing its browser and server. Screenshots contain disposable test-player data. It does not export browser storage, authorization tokens, or request headers.

For broader console coverage, run `npm run mobile` with the same explicit `CHROMIUM_PATH`. That separate harness walks all screens at multiple phone sizes and checks screen visibility, overflow, navigation targets, and browser errors. The focused check complements it with end-to-end keyboard, feedback, and public-page contracts.

These checks use Chromium and cannot establish full accessibility conformance, visual quality, screen-reader output, color contrast, or Safari and Firefox behavior. Review the changed pages at desktop and phone widths, and use an actual screen reader for changes to complex interactions. They also do not replace the existing API, ledger, or agent-authority test suites.
