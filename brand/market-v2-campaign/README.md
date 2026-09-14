# OMERTÀ Market V2 — The city has a treasury.

Prepared 13 September 2026 for the implementation reveal. Eight graphics, three eight-post X threads and six standalone posts. Nothing is scheduled or published by this package.

Open **index.html** for the visual gallery, individual post copy buttons, full-thread copy buttons, matched image attachments and image alt text. The gallery works from the extracted folder; if a browser blocks local clipboard access, select the text manually or run the included local preview server.

## Creative direction

**The city has a treasury.** Omertà's noir city becomes a visible system of capital, obligations and family interests. Black, ivory, brass and muted teal tie cinematic miniatures to precise ledger diagrams. The posters introduce the story; the diagrams explain what the contracts actually account for.

| File in `png/` | Role | Size |
| --- | --- | --- |
| `01-city-treasury.png` | Vault-and-city campaign reveal | 1122 × 1402 |
| `02-reserve-desk.png` | Seven-compartment reserve desk | 1122 × 1402 |
| `03-turf-city.png` | Family Turf and city boundaries | 1122 × 1402 |
| `04-tax-map.png` | 9% base sell fee, allocation and separate surge | 1080 × 1350 |
| `05-seven-compartments.png` | Core, cushions, Garrison, Desk, War Chest, Turf | 1080 × 1350 |
| `06-inventory-bonds.png` | Funded inventory, reserved purchase, linear vesting | 1080 × 1350 |
| `07-arbitrage.png` | Solver capital, two pools, realized trading-profit split | 1080 × 1350 |
| `08-fee-rights.png` | Protocol principal, family fee rights, historical checkpoint | 1080 × 1350 |

The three cinematic PNGs preserve their original generated dimensions and pixels. The five diagram PNGs are exact 4:5 exports. `svg/` contains portable vector versions of the diagrams with outlined typography; the source builder preserves editable text and layout instructions. The cinematic posters are raster artwork, not layered design files. Their miniature districts are campaign illustration, not a production map or gameplay screenshot.

## Copy and posting sequence

- `X-THREADS.md`: the readable copy bank with per-post counts, attachment links, alt text and internal source notes.
- `POSTS.txt`: plain text for copying into a composer.
- `POSTS.csv`: quoted UTF-8 CSV containing group, title, position, text, attachment path, alt text and character count. This is a generic export, not a promise of compatibility with a particular scheduler.
- `copy.mjs`: canonical structured post data.
- `manifest.json`: asset sizes and SHA-256 hashes.
- `validation.json`: completed post-length and attachment checks.

Recommended editorial order, relative to the day you choose to begin:

1. **Day 1 — The city has a treasury.** Publish the first thread, opening with the vault poster. Its later attachments show the compartments, tax split and fee rights.
2. **Day 2 — Every cut has a job.** Use the tax standalone with its diagram as a focused follow-up.
3. **Day 3 — Capital with orders.** Publish the reserve thread, opening with the desk poster. Follow the supplied image assignments for compartments, bonds and arbitrage.
4. **Day 4 — The bond desk.** Use the inventory-bond standalone and diagram.
5. **Day 5 — Control the Turf.** Publish the family thread, opening with the city poster. Explain future fee rights, historical claims, sieges and commitments.
6. **Following days — Reader-led follow-ups.** Use the remaining standalone posts where they answer reader interest. Avoid repeating the same cover in consecutive posts.

Each numbered thread is eight separate posts. Add posts 2–8 as replies in sequence. The gallery's “Copy all” button inserts separators for convenience; those separators are not post text. Put the supplied alt descriptions into X's image-alt field. Do not add attachment filenames or editorial notes to the post body.

All 30 posts fit the [standard 280-character weighted limit documented by X](https://docs.x.com/fundamentals/counting-characters); the longest has 256 weighted characters. Counts include numbering, spaces, line breaks and handles. This package uses no URLs or emoji in post bodies, so no shortened-URL or emoji weighting ambiguity is present. Adding text or links requires a fresh count.

## Release language and source basis

This is a **built and locally tested implementation candidate, not a deployed or funded market**. That status appears on every graphic, in every thread's opening and closing, and in every standalone post. The copy distinguishes current code from production game integration. No graphic or post claims a guaranteed floor, APY, token appreciation, universal tax, unlimited reserve, MEV immunity or an Olympus affiliation.

Mechanism claims are grounded in the [Market V2 design](../../omerta-contracts/docs/market-v2/DESIGN.md), [runbook](../../omerta-contracts/docs/market-v2/RUNBOOK.md), and [scoped implementation review](../../output/market-v2-review/REVIEW.md). These repository-relative links resolve in the repository; the standalone ZIP contains the campaign rather than copies of the implementation evidence. Brand voice comes from [MARKETING.md](../../MARKETING.md). Review status and taxes should be refreshed against the actual release before reusing this as a launch announcement.

The canonical base sell fee remains 9%: 2% developer, 1.6% RWA recipient, 2.4% community and 3% POL. Additional surge is bounded at 0–1% and routed to stability. LP fees remain additional. Arbitrage trading profit is measured after swap fees and before gas; the solver budgets gas separately. Families receive allocated, funded LP fees and no authority over principal.

## Artwork provenance and rebuilding

Posters 01–03 were created with the built-in **image_gen** tool in text-to-image mode. Full prompts are retained in `prompts/image-prompts.json`; local generation provenance is in `prompts/generation-record.json`. No CLI/API fallback was used. Originals were copied into this campaign without raster edits.

Cards 04–08 are original programmatic SVG artwork rendered with Resvg, following the existing Omertà palette and logo treatment. `build-infographics.mjs` is the editable source. Rebuilding it requires the repository's installed `@resvg/resvg-js` dependency and the Windows fonts named in that script. Delivered SVGs are outlined and do not require those fonts to display. The gallery uses the bundled `assets/display.woff2` copied from the existing project.

From the repository root:

```powershell
node brand/market-v2-campaign/build-infographics.mjs
node brand/market-v2-campaign/build-package.mjs
node brand/market-v2-campaign/previews/serve.mjs
```

The optional preview server binds only `127.0.0.1:8814`. Open `http://127.0.0.1:8814` locally. It has no publishing connection, credentials or transaction capability. `build-package.mjs` refreshes the gallery, CSV/TXT exports and manifests from `copy.mjs`; the editorial Markdown is maintained separately and should be kept in sync after copy edits.
