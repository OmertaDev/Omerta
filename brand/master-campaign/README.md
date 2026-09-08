# OMERTÀ Complete Marketing Campaign

This is the master, source-tagged campaign for OMERTÀ. It covers the playable game, player economy, organizations, authored content, autonomous-player stack, $OMR/Capital Desk lifecycle, and the World Graph systems currently under construction.

## What is included

- 108 portrait campaign cards at 1080×1350 PNG, organized into nine 12-card series.
- Editable SVG source for every campaign card, with a packaged source-art directory so the files remain portable outside the repository.
- A 1920×1080 master overview for a pinned X post, campaign opener, or video end card.
- Nine series contact sheets and one full-campaign contact sheet.
- A matched X copy bank; every post is 280 characters or fewer.
- A dated Monday–Saturday publishing calendar beginning September 8, 2026.
- Markdown and CSV campaign matrices for filtering, editing, and operational handoff.
- A responsive gallery that can be opened locally in a desktop or phone browser.
- Three newly generated text-free editorial plates for the production economy, Content Desk, and living-city system map.

## Series

1. World & Progression
2. The Street Economy
3. Blood & the Law
4. Organizations & Power
5. Vice & the Living City
6. The Authored City
7. $OMR & the Capital Desk
8. Autonomous Players
9. The World Graph — In Build

## Status vocabulary

The status pill is part of every claim and must remain visible.

- `LIVE`: represented as currently playable in the repository’s product source.
- `LIVE / CONDITIONAL`: live, but a qualifying condition or finite budget matters.
- `LIVE WHEN FUNDED`: the route exists, but execution requires its funded till.
- `BUILT`: implemented surface or rail; this does not automatically mean every dependent lifecycle is open.
- `BUILT / GATED`: implemented, with policy, launch, configuration, liquidity, or lifecycle gates still in force.
- `BUILT / DORMANT`: implemented and tested, but intentionally unavailable in production.
- `IN BUILD`: covered by the active World Graph program, not represented as a live feature.
- `IN BUILD · BRANCH FOUNDATION`: a committed foundation exists on the active work branch; the complete system remains in build and under review.

## Claim rules

- Game cash cannot be converted to $OMR. The retired swap/laundering paths are not a demand claim.
- The Cash Window is one-way: it can burn $OMR for game cash only while the till can honor the redemption. A short till refuses and burns nothing.
- Production extraction is dormant until the third-party audit and launch checklist clear. Do not frame it as present income.
- Never promise token price, profit, yield, liquidity, or a launch date.
- Agent recruiting must disclose that the recruiter is an AI. Raw reach, agent recruits, hidden astroturfing, spam, and sockpuppets do not qualify.
- Authored stories, workshops, story flags, and mementos are gameplay-inert and do not pay cash or $OMR.
- World Graph production and mystery cards must retain the `IN BUILD` label until production verification changes the source record.

## Authoritative campaign data

`campaign-data.mjs` is the single source of truth for card text, X copy, status, claim source, background art, and image-generation records. Generated assets should not be hand-edited without updating the source record.

Rebuild from the repository root:

```powershell
node brand/master-campaign/build.mjs
```

The build validates:

- exactly nine series;
- exactly 12 cards per series;
- exactly 108 cards total;
- unique card IDs;
- exactly three supporting facts per card; and
- X copy no longer than 280 characters.

## Primary product sources

- `SPEC.md` — complete product and system inventory.
- `AGENTS.md` — autonomous-player rules, current API contract, fair-play constraints, authored content, extraction state, and recruiting policy.
- `MARKETING.md` — claim framing and accounting language.
- Capital Desk implementation and product copy in the current repository.
- Active `world-graph-phases-2-3` worktree and its reviewed Phase 2A–3E program state. Those cards are deliberately marked `IN BUILD`.

Before publishing, verify status against the production deployment. A repository claim can become stale; status is controlled campaign data, not decoration.

## Generated editorial art record

Mode: built-in image generation, one new text-free plate per independent brief. No text, logos, currency marks, or UI labels were requested inside the generated images so campaign typography remains deterministic in the renderer.

1. `art/production-economy-foundry.png` — cinematic 1930s industrial foundry/garage; dismantled period automobile; mechanics sorting conserved material lots; blueprint drafting; tools, durability, repair, facility and specialist-production cues; sepia/teal noir; wide editorial composition with clear negative space.
2. `art/content-desk-evidence-room.png` — cinematic municipal evidence room; case files, evidence photographs, red thread, sealed folders, a central empty chair, role-private clue areas and archival continuity; sepia/teal noir; no legible writing; negative space for campaign copy.
3. `art/living-city-system-map.png` — cinematic isometric six-district city-at-night network; routes joining crime, markets, organizations, authored stories, machines and token/accounting infrastructure; luminous nodes and physical map-table feel; sepia/teal noir; no text or logos.

The original generation outputs remain in the local Codex generated-images cache; the campaign-owned copies above are the durable project assets.
