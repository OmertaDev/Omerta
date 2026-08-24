# Impeccable Assessment A — OMERTÀ UI/UX design review

Assessment A only. This review was produced independently of the deterministic detector and Assessment B.

## Review coverage and method

- Live visual review on 2026-08-23: `https://omerta.fun/`, `/arena`, `/wiki`, and `/play`.
- Desktop viewport: the in-app browser's normal 1264×710 viewport.
- Mobile viewport: 390×844.
- States inspected live: logged-out landing/auth, Arena's current zero-agent empty state, Codex default and no-search-results states, and the agent onboarding instructions.
- Source reviewed: `public/index.html`, `public/wiki.html`, `public/arena.html`, and `public/play.html`, including the app shell, tour, character-creation and outage screens, navigation construction, feedback patterns, empty-state helpers, and responsive rules.
- I did not press **Enter as a Ghost**, because that would create a live guest identity. The authenticated console and its high-risk actions were therefore assessed from the shipping source and state/render definitions, not from a newly created player account.
- There is no `PRODUCT.md` or `DESIGN.md`; the brand and product intent below are inferred from the live experience, the copy, the source's own design-system comments, and the repository's player guide.

## Executive judgment

OMERTÀ has a real point of view. The cinematic alley, condensed gold wordmark, wet-street imagery, in-character copy, and unusually deep game systems make it far more memorable than a generic crypto game or browser dashboard. The core console also contains evidence of careful product thinking: it progressively unlocks complexity, teaches with a coach and first-visit intros, preserves local preferences, gives specific disabled-state reasons, and recovers honestly from server outages.

The largest problem is that users do not encounter one coherent product. They encounter at least four:

1. a cinematic human-player landing page;
2. an extremely dense, multi-rail game console;
3. an older-feeling documentation/leaderboard microsite family;
4. a developer setup guide branded around Claude.

The brand is strong enough to unify these, but the current information architecture, component drift, and copy density hide that strength. The public landing also spends its emotional capital badly: it opens with a superb fantasy peak, then turns into a card grid, an oversized scenery break, and a centered three-paragraph token-policy essay. The visitor feels invited into a city and then routed into a compliance memo.

The biggest redesign opportunity is not a palette change. It is to make the whole journey feel like one city with clear doors: **Play now**, **Return to your street**, **Learn the rules**, and **Run an agent**. After that, simplify each surface around its primary task and let the noir art direction carry the personality instead of asking repeated cards, tracked labels, and long centered prose to do it.

## AI-slop verdict

**Verdict: not generic AI slop overall, but with visible generative and template fingerprints.**

The main landing does not read like a default SaaS page. It commits to atmosphere, has a distinctive voice, uses real imagery throughout, and avoids the cream-gradient startup monoculture. The hero is the best visual moment on the site.

However, someone could still plausibly say “AI made this” because several saturated patterns sit directly under that hero:

- Six nearly identical feature cards use the same photograph-under-scrim, heading, and paragraph grammar (`public/index.html:1109`). This is the identical-card-grid reflex.
- The noir category cues are almost perfectly predictable: black, amber-gold, blood red, a lone fedora silhouette, wet cobbles, fog, and teal/orange night photography. The execution is good, but the art direction rarely reaches beyond “AI noir mafia.” A more ownable visual language would incorporate artifacts unique to this game—ledger entries, dossiers, street maps, contracts, mugshots, marked bills, family seals, and living economy traces.
- The console's repeated `.hband` statistic blocks are the hero-metric pattern in product clothing (`public/index.html:392`, `public/index.html:5328`). They give every system the same “large number / small uppercase label” face.
- Arena and Play use the same tiny tracked `// KICKER`, centered heading, italic intro, bordered cards, and gold-on-black document template (`public/arena.html:25`, `public/play.html:26`). These pages feel generated from a common prompt rather than art-directed for their jobs.
- The Codex repeats tiny uppercase numbered markers above every section and uses gradient-clipped logo text (`public/wiki.html:32`, `public/wiki.html:68`, `public/wiki.html:864`). Both are explicit contemporary AI-design tells. Its gold side-stripe callouts are another templated accent (`public/wiki.html:94`).
- Card and panel structures are the default answer almost everywhere. Even empty metrics in Arena occupy six equal cards, which makes absence look like a dashboard template rather than a designed state.

The right move is not to abandon noir. It is to replace generic noir signifiers and universal card grammar with OMERTÀ-specific evidence: the city's live ledger, player actions, turf boundaries, contracts, case files, wanted posters, newspaper-like event recaps, and objects with consequences.

## Nielsen design health score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of system status | 3/4 | The console has a busy line, toasts, live countdowns, connection status, an online badge, coach state, and a self-healing outage screen. Arena calls itself “live” but only fetches once, exposes no “updated” timestamp, and dynamic feedback is not announced assistively. |
| 2 | Match between system and the real world | 2/4 | The mob voice is excellent for genre fluency, but “ghost,” “make your bones,” `$OMR`, “The Window,” “the pad,” “in transit,” staking, RICO, and the large system vocabulary arrive before many users have a mental model. Plain-language help exists, but often elsewhere. |
| 3 | User control and freedom | 2/4 | The tour is skippable/replayable, Codex search is reversible, sections remember open/closed state, the quick-jump offers escape, and wallet selection has cancel. Most modals are custom divs without consistent Esc behavior or focus management, high-stakes economy actions have uneven confirmation, and undo is scarce. |
| 4 | Consistency and standards | 2/4 | The console itself is coherent, but Landing, Arena, Play, and Codex use divergent tokens, type systems, corner radii, headings, navigation, and link behavior. “Enter as a Ghost,” “Make Your Bones,” “Play,” and “Continue with X” are overlapping entry concepts with different labels. |
| 5 | Error prevention | 2/4 | Source shows thoughtful disabled reasons, safehouse constraints, idempotent action handling, and previews for some terms. Character name/referrer and provider-token fields rely on placeholders without visible constraints; many direct actions are rendered from generic `data-do` buttons; Play tells novices to replace a JSON config without a validation/backup step. |
| 6 | Recognition rather than recall | 3/4 | Simple mode, first-visit system intros, the coach, glossary, Codex, active navigation, bottom nav, and the `/` quick-jump are strong. Full mode still requires learning 29 screens, eight navigation groups, multiple currencies, and which surface owns each system. |
| 7 | Flexibility and efficiency | 3/4 | Returning users get remembered group/tab state, saved drawers, a command-like quick-jump, keyboard focus handoff, live re-rendering that protects active fields, and a first-class API for true automation. Human power-user accelerators remain thin beyond `/`; common collection and maintenance loops are still one system at a time. |
| 8 | Aesthetic and minimalist design | 2/4 | The hero and cinematic assets are strong, but the public page becomes long, centered, and card-heavy; the Codex is 48,903px tall on mobile; Arena gives six empty metrics equal weight; and the app combines coach, vitals, two tab rails, content, sheet, feed, and bottom navigation. |
| 9 | Recognize, diagnose, and recover from errors | 3/4 | The outage state is unusually honest and automatically retries with backoff; stable errors are mapped to in-world explanations; Codex's empty search suggests a recovery. Toasts can disappear without a persistent record or assistive announcement, clipboard failure is swallowed on Play, and some recovery depends on knowing which system to visit. |
| 10 | Help and documentation | 3/4 | An illustrated tour, Start Here checklist, coach, glossary, searchable Codex, per-system intros, and developer surfaces are substantial. The help volume itself becomes an IA problem, mobile Codex navigation dominates the viewport, and guidance is divided across multiple pages without a unified help model. |
| **Total** |  | **25/40** | **Acceptable — a strong foundation with significant cross-surface and accessibility work needed.** |

## Cognitive-load assessment

**Overall: high cognitive load, 6 of 8 checklist items fail across the end-to-end journey.** The core console contains meaningful mitigation, but the public funnel and full-city state exceed working-memory limits repeatedly.

| Checklist item | Result | Evidence |
|---|---|---|
| Single focus | Fail | The landing simultaneously sells human play, agent play, a token model, on-chain extraction, X sign-in, raw-provider sign-in, and a money-map video. The desktop console can show a coach, sheet, current screen, and street feed at once. |
| Chunking | Fail | Six feature cards appear as one equal set; the landing's economy argument is three long centered paragraphs; the Codex exposes 12 groups and dozens of sections in one mobile contents region. |
| Grouping | Pass | App tabs are meaningfully grouped into Streets/Earners/Vice/Blood/Family/Legit; panels and section drawers generally preserve proximity; Codex groups are explicit. |
| Visual hierarchy | Partial fail | Hero hierarchy is excellent. Lower landing sections, Arena zero-stat cards, dense app cards, and full Codex navigation flatten priorities. The same panel and heading treatments recur too often. |
| One thing at a time | Fail | The app has duplicate navigation layers plus live feed and vitals, while money actions often ask users to reconcile balances, costs, cooldowns, heat, location, and risk simultaneously. |
| Minimal choices | Fail | Full app navigation has eight group stops and 29 screens; the Family group alone has six sub-screens; the mobile full-mode bottom bar can show eight stops; Arena exposes seven machine links; language selection offers 15 choices. |
| Working memory | Fail | Users must remember differences among pocket/bank/in-transit cash, loose/staked/unbonding `$OMR`, heat/investigation, energy/nerve, front upkeep, location, and several rank systems. Much of the explanation lives in another tab or the Codex. |
| Progressive disclosure | Pass | Fresh players see six starter tabs, full-city access waits until level 8 unless requested, the tour is sequenced, system intros show once, drawers remember their state, and the coach names one next action. |

Decision points that exceed four visible options:

- Landing: six equally weighted feature cards, three separate agent links inside one card, and two equal-looking entry CTAs near the bottom.
- App full mode: eight groups, four-to-six screens per group, plus duplicated desktop/mobile routes.
- Mobile app: bottom nav + group rail + screen rail + top-bar utilities are concurrent navigation systems.
- Codex mobile: 12 group headings and more than 30 section links occupy a 44vh scroll pane before the document starts.
- Arena: six metrics and seven machine-surface links are presented with little prioritization.

The core product has already chosen the right strategy—progressive disclosure—but it applies that strategy after entry. The redesign should extend it to the landing, authentication, public documentation, and the full-city navigation.

## Emotional journey

### Peak

The landing hero is a convincing invitation. The lone figure, wet alley, warm lamp, strong wordmark, “the city remembers everything,” and a one-tap no-wallet promise create mystery with low commitment. This is OMERTÀ's most ownable moment.

### First valley

Immediately below, the player gets six explanatory cards. They are informative but replace fantasy with feature inventory. The following poster break is visually beautiful but disproportionately tall: on mobile it consumes most of a screen without advancing the story. The visitor then lands on the Money Map and a three-paragraph explanation of economic separation. Momentum changes from “I want to enter this city” to “I am being asked to audit its token design.”

### Conversion valley

Returning sign-in is buried after the whole pitch. On a 390px viewport, the visitor must pass roughly the entire 4,059px page before reaching **Continue with X**. **Make Your Bones** and **Continue with X** receive nearly the same visual weight and do not clearly state the persistence tradeoff. A returning player whose local session is gone has no obvious fast lane back to their street.

### Onboarding

The core app recovers well. The eight-step illustrated tour is skippable, each step teaches one concept, simple mode hides most screens, and the coach provides a concrete next move. This converts intimidation into momentum better than the marketing site suggests. However, eight tour steps still precede a deeply populated shell, so the first playable action should happen earlier—ideally inside the tour or immediately after step two—with later lessons triggered by behavior.

### High-stakes moments

Death, wallets, staking, withdrawals, bank transit, upkeep, and destructive actions need a consistent “terms before action” grammar. Source shows some strong examples: risk-colored buttons, disabled controls with reasons, wallet copy explaining that signatures prove address ownership, and a dedicated **The Heir Rises** death resolution. These moments should become a named system used everywhere: consequence summary, amount at risk, cooldown/irreversibility, primary action, and a safe exit.

### End and return

The source's Morning Paper, Situation, coach, live timers, and self-healing outage state are excellent return hooks. Public surfaces are weaker. Arena currently ends the first fold with six zero cards and “No agents in the city yet”; it makes the city feel abandoned instead of poised. Play ends as a long document with no connection test, no success checkpoint, and no celebratory “the connector is live” moment. The end state should leave the user with proof and a next action, not just instructions.

## What is working

### 1. The core brand has conviction

The main hero commits to a physical scene rather than a generic product backdrop. Oswald is reserved for identity moments in the console, the serif body gives the city a period voice, and amber/red/steel semantic roles generally fit the fiction. The best copy is concise and unmistakably in-world: “No wallet, no email — one tap,” “the city remembers everything,” “The Line's Dead,” and “The Heir Rises.”

### 2. The console contains unusually thoughtful onboarding and resilience

The source shows mature responses to actual usability failures: starter tabs only, group navigation after level 8, a `/` quick-jump, saved open/closed drawers, first-time illustrated system intros, focus transfer from a keyboard-selected tab into content, live cooldowns, safehouse-specific disabled reasons, empty-state coach cards, a retrying outage screen, and re-render protection while typing. These are not cosmetic fixes; they directly reduce abandonment and errors.

### 3. Help is comprehensive and risk is discussed honestly

The Codex is searchable, deep-linked, and written in relatively direct language. The site repeatedly discloses that extraction is dormant, differentiates cash and `$OMR`, explains death and loot, and avoids promising income. The product has the substance needed for trust; it needs better sequencing and presentation.

## Primary personas

These are the three primary audiences implied by the shipping experience:

1. **New human strategist** — attracted by mafia fantasy, wants to understand the first action quickly, may not know crypto or deep simulation terms.
2. **Returning/power human player** — manages several earning, risk, and social loops; values fast navigation, live status, batch maintenance, and dependable recovery.
3. **Agent operator/developer** — wants proof that agents can play, a safe setup path, machine-readable surfaces, live competition, and clear production status.

The site also needs to serve keyboard, screen-reader, low-vision, and one-handed mobile users as first-class variants of all three personas, not a separate audience.

## Priority issues

### 1. [P1] The entry architecture mixes audiences and hides the return path

**What:** The landing has no global header or persistent navigation. It leads with **Enter as a Ghost**, places agent entry inside the sixth feature card, hides **Continue with X** near the bottom, and puts the Codex/Arena/developer destinations in mid-page text or the footer. “Enter as a Ghost,” “Make Your Bones,” and “Continue with X” all participate in account entry but do not explain their relationship.

**Why it matters:** First-time humans cannot tell whether “ghost” is a demo, temporary account, or mode. Returning humans must scroll through the pitch to recover their street. Agent operators are asked to decode a human landing before finding their route. Every audience pays for the others' content.

**Fix:** Add one shared public header across Landing, Arena, Play, and Codex: **Play**, **Codex**, **Arena**, **Agents**, plus a quiet **Sign in / return to your street** action. In the hero, use one primary CTA, **Play instantly**, with “temporary guest; claim later” beneath it, and one secondary **Sign in / recover** action. Give agents a separate high-contrast band later with one route, not three inline links. Preserve “ghost” and “make your bones” as voice after the plain-language label, not instead of it.

**Suggested command:** `$impeccable shape` for the public IA and authentication funnel, followed by `$impeccable clarify`.

### 2. [P1] The full console has three concurrent navigation systems and too many destinations

**What:** Full mode defines 29 screens across eight groups (`public/index.html:4990`). Desktop has a group rail and a screen rail; mobile adds a fixed bottom rail while retaining the horizontal rails and top-bar utilities. The full mobile bottom bar can show eight destinations, with 8.5px labels (`public/index.html:912`). The console also renders the character sheet and street feed alongside the task panel on desktop.

**Why it matters:** Grouping is a meaningful improvement over 29 flat tabs, but duplicated route systems force users to maintain several maps. A returning player may know the action they want yet still need to recall whether it lives in Streets, Earners, Blood, Family, or Legit. On mobile, visible navigation consumes attention and thumb space before the current task.

**Fix:** Choose one persistent navigation model per breakpoint. Desktop: a compact left navigation with groups, recent screens, unread/state badges, and `/` search; keep the live street as a collapsible drawer. Mobile: five stable destinations—Home, Streets, Earn, Family, More—with More opening the quick-jump; remove the duplicate group rail. Let the coach deep-link directly to a control. Add recent/favorite screens for power players and a “collect/maintain” queue for repeated economy chores.

**Suggested command:** `$impeccable distill` and `$impeccable layout`.

### 3. [P1] The accessibility foundation is incomplete on the most interactive surface

**What:** Custom modals are plain `<div>` structures without `role="dialog"`, `aria-modal`, an accessible name, focus trap/return, or consistent Esc behavior (`public/index.html:1265`). Toasts, the busy bar, outage countdown, and live state have no `aria-live`/status semantics. The help control is a 24×24 clickable `<span>` without button semantics or keyboard focus (`public/index.html:637`, `public/index.html:1198`). Tabs expose neither tab roles nor `aria-selected`; active navigation exposes no `aria-current`. Feed-filter and sound toggles expose no pressed state. Character, referral, provider-token, and some app inputs rely on placeholders instead of visible labels. `translate="no"` blocks browser translation even though only menu chrome is localized and game prose remains English (`public/index.html:2`).

Measured contrast also has failures or near-failures: Arena's `--dim` on its panel is about **4.31:1**, below WCAG AA for normal text; the Codex placeholder is about **3.28:1**; many 11–13px dim/italic strings sit at the edge of legibility. Landing copy over the moving/photo hero is visibly low-contrast in bright areas. Arena's pulse has no reduced-motion override, and the Codex only removes transitions, not all motion.

**Why it matters:** Keyboard and screen-reader users cannot reliably open help, understand dialogs, hear confirmations, or perceive selected state. Low-vision users face small, dim text on the pages carrying the most trust-sensitive explanations. This is not polish; it blocks or destabilizes the primary flow.

**Fix:** Replace modal wrappers with native `<dialog>` or a fully managed dialog primitive; add focus containment/return and Esc everywhere. Make Help a 44px button. Implement status/live regions, tab/listbox semantics, `aria-current`, `aria-pressed`, visible labels and descriptions, and stateful accessible names. Remove `translate="no"`; mark only fixed brand phrases as non-translatable. Establish contrast-tested text tokens for 11–14px copy and raise mobile targets to 44×44 CSS px. Run keyboard, NVDA/VoiceOver, 200% zoom, forced-colors, and reduced-motion passes.

**Suggested command:** `$impeccable audit` and `$impeccable harden`.

### 4. [P1] Mobile is responsive but not yet mobile-native

**What:** The landing remains 4,059px tall at 390×844; the oversized poster consumes almost a viewport, and the three economy paragraphs are centered in a narrow card. Codex is 48,903px tall, while its contents panel permanently occupies about 371px/44vh above the article. The console's bottom navigation uses 8.5px labels and coexists with horizontal rails. Base app controls are 38–40px, short of the 44px touch target. Arena's populated seven-column leaderboard has no responsive wrapper or alternate row design in source, so the currently empty state masks a likely mobile table failure.

**Why it matters:** A mobile user must scroll through decoration, re-read centered prose, and manage multiple small navigation controls one-handed. The Codex's permanent table of contents halves the reading viewport before a user has read one rule. A populated Arena will be hard to scan even if it technically fits.

**Fix:** Make mobile a distinct composition. Crop the landing poster to a short cinematic transition or remove it. Left-align long prose and collapse the economy thesis to a diagram plus expandable details. Turn Codex navigation into a search-first drawer with collapsible groups and a sticky “contents” button. Convert Arena rows to ranked cards or a horizontally scrollable, clearly signposted table. Use at least 44px targets and five bottom destinations.

**Suggested command:** `$impeccable adapt`.

### 5. [P2] The public surfaces do not share one visual system

**What:** The console/landing uses the self-hosted condensed display face, 7–12px radii, richer elevation, images, motion, and a specific amber token. Arena and Play fall back to Georgia/Courier, 5–6px cards, template kickers, and no imagery. Codex uses a different amber, warmer background, 2px corners, gradient wordmark, numbered eyebrows, and side-stripe callouts. Each page recreates tokens and components inline.

**Why it matters:** Satellite pages feel like adjacent sites, so trust resets at every route. The Arena—a flagship proof surface for the product's central differentiator—looks older and less alive than the landing card that links to it. Component drift also makes accessibility and responsive bugs recur.

**Fix:** Extract one shared public shell and token set: wordmark, header, footer, focus, buttons, statuses, content widths, and motion rules. Preserve register differences: Landing can be cinematic, Arena can be data-dense, Play can be instructional, and Codex can be long-form. Consistency should live in identity and interaction, not identical cards. Replace Arena's template stat grid with live narrative evidence; replace Codex's AI-tell numbering/gradient/side stripes with artifact-led section treatments.

**Suggested command:** `$impeccable document`, then `$impeccable extract` and `$impeccable polish`.

### 6. [P2] The landing's second half spends excitement on an economy defense

**What:** After the strongest visual moment, the page shows a six-card feature inventory, a 38vh full-width poster, a 90-second Money Map, and three centered paragraphs explaining why cash and `$OMR` are severed. The explanation is thoughtful but dominates the path to action. There is almost no UI proof: no console crop, sample decision, player story, turf map, or current-city evidence.

**Why it matters:** Players attracted by mafia strategy get a token architecture essay before seeing what a turn feels like. Crypto-skeptical users interpret the defensive length as risk; crypto-native users see extraction repeatedly described as dormant. The page talks about a living city without showing live play.

**Fix:** Re-sequence around experience: hero → a 30-second “make one move” interaction or annotated console capture → live city proof → three differentiated pillars → player/agent pathways → concise economy diagram with “read the full ledger model” disclosure. Keep the full argument in the Codex. Use left-aligned prose for explanations. Let the poster become a paced scene break only if it carries a line of narrative or live city transition.

**Suggested command:** `$impeccable shape`, `$impeccable layout`, and `$impeccable clarify`.

### 7. [P2] Empty and “live” states currently make the city look uninhabited

**What:** Arena's current first fold contains six metrics that are zero or `<$100k`, followed by “No agents in the city yet.” `$OMR extracted` is guaranteed to be zero while the rail is dormant, yet it receives a prime metric card. The page says “live board,” but source fetches `/v1/arena` once and shows no timestamp, refresh, polling, or connection state (`public/arena.html:96`).

**Why it matters:** The page intended to prove autonomous activity instead proves absence. “Live” without freshness information weakens trust. Empty metrics consume space but offer no reason to act.

**Fix:** Design a true zero state. Hide meaningless metrics; lead with “The first machine has not entered yet” and one clear route to claim the first place. Show a transparent sample of what the board will measure without fabricating activity. While extraction is dormant, replace that card with an active metric such as opportunities open, actions today, city event, or widest arbitrage spread. When populated, poll at a respectful cadence, show “updated N seconds ago,” and add a latest-actions strip.

**Suggested command:** `$impeccable onboard` and `$impeccable harden`.

### 8. [P2] The Claude onboarding promises simplicity, then asks novices to edit infrastructure

**What:** `/play` says “no code, no terminal” and “three steps, about two minutes,” but requires installing Node.js, opening a developer config, editing JSON, and fully restarting an app. It later says “You don't install or download anything,” contradicting the prerequisite Node installation. “Replace whatever's in the file” risks wiping existing connectors; the caveat to add one line does not provide a safe merge example. Clipboard errors fail silently, and there is no validation or success checkpoint.

**Why it matters:** The page is aimed at the least technical audience but asks them to perform the most failure-prone setup without screenshots or a test step. When the connector does not appear, users cannot distinguish invalid JSON, missing Node, restart failure, or service failure.

**Fix:** Be precise: “No coding; one small configuration edit.” Branch immediately into Mac/Windows tabs with screenshots. Detect or explain Node before config editing. Offer safe instructions for both empty and existing `mcpServers` files, a JSON validator, and a backup note. Add a final verification: where the OMERTÀ tool appears, what success looks like, and a one-click copy for a test prompt. If the product can support it, move toward a packaged installer or deep-link connector flow.

**Suggested command:** `$impeccable onboard` and `$impeccable clarify`.

## Persona walkthrough red flags

### Jordan — confused first-time human player

Primary action: understand the game, enter, name a character, and complete the first job.

- “Enter as a Ghost” is voiceful but does not define whether progress persists. The explanatory line helps, yet “Claim it with X / Privy later” adds two provider concepts before Jordan has played.
- The hero provides no visible “already have an account” route; **Continue with X** is near the bottom of a 4,059px mobile page.
- The landing introduces city events, RICO, `$OMR`, staking, minting, agents, extraction, the Window, and economy severance before demonstrating one job.
- Character creation has placeholder-only fields and does not surface name length/uniqueness rules before submission (`public/index.html:1168`). An error is therefore likely to be Jordan's first system feedback.
- The eight-step tour is well structured, but the first action still occurs after all eight steps. Jordan learns freight, death, family, and law before pulling a job.
- The console's in-world labels—Streets, Life, Big Scores, Wet Work, Shylock, Wire, Legit—reward learning but require translation. The coach and intros help; they should be the dominant interface, not compete with several rails.
- The Codex is comprehensive but does not provide a concise “first ten minutes” mode; the mobile contents pane presents dozens of choices before the first paragraph.

Abandonment risk is highest between the hero and first action, and again when the first full console shell appears.

### Alex — impatient returning/power player

Primary action: return, assess risk/income, collect/maintain several systems, and execute a chosen strategy quickly.

- If the local token is gone, the return/sign-in path is buried under the entire marketing page.
- The `/` quick-jump, remembered group tabs, saved drawers, live countdowns, and protected input focus are excellent accelerators.
- Full mode still has eight groups, 29 screens, and duplicate rails. Alex knows the task but must remember its taxonomy.
- Repeated upkeep/collect/claim loops do not appear to have a unified action queue or batch overview. The coach names one move, but a veteran may need five maintenance actions before a strategic move.
- The right-side Street feed competes with the current task on desktop and may continually pull attention during financial or planning work.
- Arena is not actually live-updating, so Alex cannot leave it open as a reliable spectator surface.
- No visible keyboard-shortcut system exists beyond `/`; bottom navigation and many action cards are click-first.

Alex will tolerate density if it saves time. The redesign should convert learned complexity into acceleration, not merely hide more options.

### Sam — keyboard/screen-reader/low-vision user

Primary action: enter or sign in, understand the tour, navigate to a screen, receive action feedback, and recover from errors without vision or pointer input.

- The Help `span` is neither focusable nor semantically a button; the primary glossary can be unreachable by keyboard.
- Custom modal wrappers lack dialog semantics, names, `aria-modal`, focus trapping, focus return, and consistent Esc behavior. The jump modal handles Esc, but tour, phone, glossary, death, and wallet picker do not expose a shared dialog model.
- Tabs and group rails do not communicate selected state or relationships; bottom navigation has no current-page state.
- Toast, busy, live connection, unread, and retry countdown state are visual-only; source contains no live regions.
- Several toggles change appearance without `aria-pressed` or stateful labels.
- Placeholder-only forms create label and error-association problems; the Play copy action gives no announced success/failure.
- Arena's dim panel text fails AA at approximately 4.31:1; Codex placeholder contrast is approximately 3.28:1; 8.5px mobile bottom-nav labels and 11–12px dim/italic explanations are difficult even when contrast technically passes.
- `translate="no"` prevents assistive browser translation while most prose remains English.
- The console has a strong `:focus-visible` rule and keyboard focus handoff after tab selection. Preserve these good foundations while correcting semantics.

Sam is currently blocked from a dependable, fully perceivable core flow.

## Surface-by-surface observations

### Landing / logged-out auth

- The hero is the site's strongest composition and should remain the visual anchor.
- The moving hero is progressive enhancement over a still and respects Save Data/reduced motion in source—good engineering and good UX.
- The tag line is memorable, but supporting text is visibly dim over the bright wet street on mobile.
- The rotating Wire ticker adds life, though its truncation means the most interesting text can end mid-thought.
- The three numbered steps are orientation, so numbering is earned here. They are still too small and visually secondary to be useful as a real progress model.
- Six feature cards are too many and too equal. “Agents welcome” is especially overloaded: parenthetical launch status plus three links in a body paragraph.
- The poster break is beautiful but narrative-free. It costs scroll depth without changing understanding.
- The Money Map video is a stronger explainer than the following essay; let it replace most of that essay rather than precede it.
- Long prose is centered. Center alignment should stop after two or three lines; these paragraphs need left alignment and a narrower measure.
- Both lower CTAs use the same glowing outlined treatment, creating a false equivalence between guest creation and persistent sign-in.
- There is no visible loading/pressed state on the public CTA itself beyond the global busy behavior.
- Footer disclosure is appropriately cautious but tiny and far from the first `$OMR`/on-chain claims.
- The page has no shared header, route context, or quick access to Arena/Codex/Agents.

### Character creation and outage source states

- “A Name” / “Step Out” preserve the voice and keep the form short.
- Add visible labels, name constraints, an availability check, examples, and explicit persistence/referral wording.
- The referral field is given nearly equal visual weight to the required name even though it is optional and growth-oriented. Defer it or explain it after character creation.
- “The Line's Dead” is excellent recovery copy: it distinguishes connection from character safety, retries automatically, backs off, and offers manual retry.
- Add `role=status`, announce the countdown, preserve focus, and provide a status link if outages last longer.

### Authenticated console source

- The three-column desktop frame appropriately exposes self / task / city, but it should let users collapse the Sheet and Street to focus.
- On mobile, current task first and the Sheet/Street later is the correct order.
- The sticky vitals row is useful, but coupled with a wrapping top bar, coach, horizontal rails, and bottom nav it creates a large persistent-chrome stack.
- Group color shifts—green earners, violet vice, red blood, steel family, teal legit—are semantically useful. Verify all text/accent contrast and avoid using color as the only group cue.
- Cards hover/raise even when non-interactive, which can imply clickability.
- Risk/primary button weights are an important improvement; make their semantics and confirmation rules systematic.
- “Last Word” is an implementation/result log rather than a user task. On desktop it consumes a panel; on mobile it appears low in the sheet. Recast it as a collapsible activity/receipt drawer.
- The live Street panel has useful filters, but selected/muted filter state needs text/assistive semantics and an easy “restore all.”
- Collapsible sections and saved state are strong, though native `<details>` needs careful heading/summary screen-reader testing.
- First-time intros use a generic “got it” dismissal. Better retention comes from offering the first action directly within the intro.
- The coach is one of the best product mechanisms. Its destination should remain visible as a queue/history so users can recover if a toast or live update changes it.
- The generic `heroBand` gives many screens the same dashboard face. Replace it selectively with system-native forms: a ledger balance, a case file timeline, a turf map, a race card, a contract sheet.
- Several background animations and glow layers are justified by the fiction and are responsibly disabled in the main reduced-motion block.

### Codex

- Search, deep links, scroll tracking, active-section autoscroll, and a useful no-results message are solid.
- The reading measure (roughly 66–72ch) and 16px body are generally good.
- The mobile TOC should be a drawer or collapsible region; 44vh is too much permanent preamble.
- Search hides links but leaves every empty group heading, so the no-results state still shows a long list of irrelevant categories.
- Search has no result count, snippets, term highlighting, or “clear” control.
- Section numbering is decorative across a non-sequential rulebook and reinforces template grammar.
- The gradient wordmark, side-stripe callouts, tracked category labels, and repeated rules create an editorial-tech aesthetic that is less ownable than the game's artifact language.
- The Codex is organized by systems; newcomers need task-oriented paths: Start playing, Make money, Survive, Join people, Understand `$OMR`, Run an agent.
- Tables need responsive overflow affordance or stacked transformations on mobile.
- The page lacks a true global header and cross-links beyond “the city.”
- The page source is authored as one massive JavaScript data array. Content could be semantic HTML/Markdown for search indexing, no-JS resilience, and maintainability.

### Arena

- Banded wealth is a thoughtful safety/gameplay choice and the source explains why.
- The current zero state is visually honest but emotionally flat.
- “Live board” is not backed by polling, freshness, or a timestamp.
- The long centered italic pitch is hard to scan and low contrast; turn it into one crisp claim and one supporting line.
- Six equal metric cards include metrics that are not useful while empty or dormant.
- The page's strongest differentiated content—the ranked agents and their activity—is absent in the current state; the rest looks like a developer document.
- A populated seven-column table has no mobile adaptation in source.
- The page should show latest moves, specialties, current city event, and opportunity context, not only accumulated totals.
- Link cards repeat the same template and do not distinguish human-readable, machine-readable, and executable routes.
- The pulse lacks a reduced-motion fallback.

### Play / agent onboarding

- The numbered three-step structure is clear and appropriately sequential.
- The copy button is useful and visually located correctly.
- The “no code” promise should not expand to “no terminal” if Node installation and JSON editing remain required.
- Use OS tabs and screenshots; the current generic cards are text-heavy for the novice audience.
- Split config instructions into “new config” and “existing connectors”; never lead with replacing the whole file.
- Provide JSON validation and a visible success test.
- The config block horizontally scrolls on 390px mobile; acceptable for code, but the copy button partially competes with code and the scrollbar is visually loud.
- The page lacks the main site's display identity and imagery.
- The FAQ is useful but sits after the only three steps; surface the most common failure immediately beside each step.
- The final sections about other models and “what is this” are useful but dilute completion. Put them behind clear audience links after the verified-success state.

## Performance and perceived-speed observations

- `public/index.html` is approximately **1.08MB uncompressed** and contains the entire console's CSS and JavaScript inline. Transfer compression may reduce bytes, but the browser still parses the public landing and all authenticated-system renderers before the user chooses to play.
- The initial landing can request a 645KB hero poster, a 1.49MB autoplay hero clip, a 750KB poster break, roughly 1.1MB across six feature images, the HTML, and other assets. This is a multi-megabyte first impression on mobile.
- The Money Map video is approximately **53.9MB**. It is user-controlled and `preload="metadata"`, which is appropriate, but should have an explicit size/duration hint and adaptive delivery if mobile users play it.
- The source thoughtfully avoids motion under Save Data/reduced motion and removes failed video enhancement. Preserve that.
- Split the public landing shell from authenticated console bundles; externalize and cache shared design assets; lazy-load system renderers and non-visible art; supply responsive image sizes; retain still-first video enhancement.

## Minor observations and polish backlog

- Landing jumps from `h1` to feature-card `h3`s before an `h2`, weakening document hierarchy.
- Arena and Play do not define a branded focus-visible treatment; default focus is not enough to guarantee consistency.
- The Arena leaderboard needs a caption, sortable semantics if sorting is added, and clearer numeric alignment.
- Arena's “collective wealth `<$100k`” alongside zero agents is confusing; hide aggregate bands with no population.
- Play's clipboard failure path catches and says nothing. Show “Copy failed—select the code manually.”
- Play's path strings use `word-break: break-all`, which harms scanability; prefer `overflow-wrap:anywhere` for paths.
- Play's final prompt includes a predetermined character name; explain that names must be unique or offer a replaceable placeholder.
- Codex search interpolates a sanitized term into `innerHTML`; visual safety is handled, but semantic quotes and screen-reader announcement should be improved.
- Codex group headings stay visible even when all their links are filtered out.
- Codex's Back to Top button appears visually but has no announcement; acceptable, but it could be integrated into a sticky reading toolbar.
- Public pages use different footer link names for the same destination (“The City,” “Play,” “Play it yourself,” “human console”). Standardize.
- External links should indicate that they open a new tab in accessible text, not only use `target="_blank"`.
- “CODEX” opens a new tab from the console without a visible external/new-tab cue.
- The top console bar is crowded on mobile and collapses Sign Out to a power glyph. The title attribute is not a reliable mobile explanation; preserve an accessible label and consider moving account actions into a menu.
- Top-level language selection translates menus only. Make that limitation visible at selection time, allow browser translation for prose, and test mixed RTL/LTR behavior.
- Some mobile controls are explicitly 38px or 40px tall; raise the baseline to 44px.
- Hover elevation on `.card` should apply only to clickable cards; static cards should remain still.
- The console's visual z-index values include 2500 for the reveal and several unrelated numeric tiers. Replace with semantic tokens.
- Ambient grain is a generated SVG noise filter. It is subtle, but it adds the familiar “digital film grain” AI/noir tell; verify that removing it does not improve clarity and performance.
- The main landing's feature imagery is dark enough to preserve text but hard to distinguish at a glance. If every image becomes the same dim plate, imagery stops carrying information.
- The Money Map and economy manifesto use the same card treatment despite having different jobs. The video is an explainer; the thesis is long-form editorial content.
- The landing's first CTA breathes forever. Reduce sustained motion after the first few seconds.
- Arena's `live` pulse similarly runs forever and ignores reduced-motion preference.
- Current public pages have no shared breadcrumb/current-location state.
- The account-provider developer fields should use `<label>` elements, autocomplete guidance, and explicit secret-handling copy.
- Character-name creation should show character limits, uniqueness, allowed characters, and an inline result without relying on submit errors.
- Referral attribution is growth-sensitive but optional; it should not distract from the only required creation decision.
- “No wallet, no email” is excellent conversion copy—keep it verbatim or very close.
- The self-healing outage copy is excellent—promote it into a reusable status component across Arena, Play verification, and API status.
- The main app uses an excellent single-focus coach. Consider making that same coach metaphor the public-site navigation principle: one recommended next action per surface.

## Provocative questions

1. If `$OMR` vanished from the landing until after the player completed one job, would more people enter the city—and would anyone who matters be less informed?
2. Is the landing page trying to recruit a human player, convince a crypto skeptic, document economic integrity, and onboard an agent operator at the same time? Which one deserves the first viewport?
3. What is the one screenshot or live artifact that proves this is a game rather than a noir-themed token project?
4. What would the Arena celebrate today if extraction were not a metric at all?
5. Could “The City” become the shared navigation metaphor—four doors in one place—rather than four pages that each invent their own shell?
6. Does a veteran need 29 destinations, or do they need a queue of obligations, threats, opportunities, and recent places?
7. If the Codex were organized around questions—“How do I earn?”, “How do I stay alive?”, “What happens when I die?”—would most users ever need the full system taxonomy?
8. Which visual artifacts exist only in OMERTÀ? What happens if those replace the generic noir silhouette, stat card, and tiny tracked kicker wherever possible?
9. Can the agent setup truly become one click? If not, should the promise be “no coding” instead of “no code, no terminal”?
10. At every irreversible action, can the user answer three questions without leaving the card: what will I spend, what can I lose, and how do I recover?

## Recommended redesign sequence

1. **Public IA and conversion:** unify header/footer, split human/returning/agent entry, move sign-in to the first fold, and restructure the landing around a playable proof.
2. **Accessibility foundation:** dialogs, live regions, labels, selected states, translation, targets, and contrast before further visual polish.
3. **Navigation distillation:** one navigation system per breakpoint, recent/favorite destinations, maintenance queue, collapsible desktop side panels.
4. **Mobile-native Codex and Arena:** drawer TOC, task-based guides, responsive leaderboard, true live/freshness model, meaningful zero state.
5. **Shared design system:** extract public shell/tokens/components while giving each register a distinct job-specific composition.
6. **Performance split:** separate landing/auth from the authenticated console bundle, lazy-load system renderers/art, and provide responsive media.
7. **Agent onboarding rewrite:** honest promise, OS-specific visual steps, safe config merge, validation, and a verified-success ending.

The core product is not missing craft; it is hiding its craft behind too much simultaneous explanation and too many parallel shells. Preserve the city, the voice, the coach, and the resilient state work. Redesign the doors, the hierarchy, and the semantics around them.
