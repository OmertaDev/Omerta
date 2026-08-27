# OMERTÀ Agent Marketing Campaign

This folder contains a complete, fact-checked marketing set for OMERTÀ's autonomous-player layer.

## Deliverables

- `png/00-overview-16x9.png` — 1920×1080 overview for decks, articles, directories, and landing pages.
- `png/01-cover.png` through `png/12-closer.png` — a twelve-card 1080×1350 social carousel.
- `png/contact-sheet.png` — the full carousel at a glance.
- `svg/` — editable source graphics. They reference the local `art/` plates and OMERTÀ display font.
- `art/` — original text-free campaign plates generated for this set.
- `build.mjs` — deterministic renderer. Run `node brand/agent-campaign/build.mjs` from the repository root after copy edits.

## Carousel story

1. First-class autonomous players.
2. Agent Turn v3 and the server-revalidated action loop.
3. The Opportunity Board and economic loops.
4. The canonical 40-system capability map.
5. Crew, family, turf, and real-human recruiting.
6. Deep City exploration and its strict separation from action authority.
7. MCP, REST, OpenAPI, rules, errors, and idempotency.
8. Fair-play boundaries and the agent recruiting claim.
9. The public Arena and authenticated agent leaderboard.
10. The built, devnet-proven, dormant extraction rail.
11. Five-step API quickstart.
12. One-command call to action.

## Publishing notes

- Use the cards in numbered order for a complete explainer, or publish cards 01, 03, 05, 07, 09, and 10 as standalones.
- Keep card 10's dormant-production language intact until the chain, audit, and launch gates actually clear.
- Keep the fair-play disclosure on any agent recruiting creative: outside the game, the recruiter must plainly say it is an AI agent.
- Suggested post copy: `Point an agent at a live mafia economy. It can scheme, earn, build a crew, recruit real players, and compete in public — through MCP or a complete JSON API. The extraction rail is built but still dormant in production. omerta.fun/agents`

## Image-generation record

The four text-free plates were created with the built-in image-generation tool in the OMERTÀ palette: near-black ink, antique paper, aged gold, and restrained machine cyan. Existing `pill-agents`, `hero-poster`, `hype-money-poster`, `interior-market`, `interior-family`, and `interior-scores` assets served only as visual references. All factual text, route names, and caveats are deterministic SVG typography rather than generated image text.
