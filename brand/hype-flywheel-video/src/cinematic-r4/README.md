# OMERTÀ cinematic capture edit

Three isolated, data-driven vertical compositions, separate from previous advertisements.

- `Omerta-Cinematic-01`: empire / action framing.
- `Omerta-Cinematic-02`: economic precision, restrained camera movement.
- `Omerta-Cinematic-03`: investigation, serif headlines and slower vertical evidence pans.

Production data is read from `art/cinematic-r4/production-data.json` in the staged render directory. The renderer copies the canonical `brand/cinematic-video-system/production-data.json` there. Real game screenshots and completed audio are resolved through `public/art/cinematic-r4/manifest.json`. Missing capture mappings fail a render; no generated replacement screen is shown.

Each beat uses the agreed `start` / `end` seconds, `headline`, `kicker`, `screen`, normalized `focus` (`x`, `y`, optional `scale`, optional `fit`), `transition`, `flow`, `note`, and `kind`. Default `kind` is `capture`; `flow` draws an explicitly editorial system relationship diagram; `end` shows the OMERTÀ wordmark and closing line. `focus.fit` defaults to cover; `contain` is available when an entire wide screen is necessary. Camera motion never changes screenshot contents.

Optional `screens: ['city', 'inventory', 'crafting']` replaces `screen` with an ordered montage. Each screenshot receives an equal part of the beat and its own pan. The original beat transition only happens once. All listed screens are validated against the capture manifest, including screens used behind editorial flow scenes. Two or three short `tags` appear in a 41 px system ribbon under the capture window. Keep their combined text short enough for two lines (about 60–70 characters). They are never substituted with invented interface elements.

`flowMode: 'allocation'` draws parallel recipient bars instead of sequential steps. Supply exact source-verified values in `flow`, such as `Recipient — 2%`; the component extracts and emphasizes supplied percentages but performs no economic calculation, invents no values, and draws no causal arrows between recipients. Omit `flowMode` or use `sequence` for causal paths.

Film captions accept standard Caption JSON objects with absolute millisecond windows. If absent, `caption` or `narration` is paginated into short line windows across its beat, with no words omitted. That fallback is proportional timing, not word alignment.

The only scope and spin effects are original graphic overlays and 11-frame transitions. Their matching audio belongs in the mix. The edit does not use game franchise marks, commercial songs, meme sound files, generated characters, or fake gameplay UI.

```powershell
node brand/hype-flywheel-video/node_modules/typescript/bin/tsc -p brand/hype-flywheel-video/src/cinematic-r4/tsconfig.json
node brand/hype-flywheel-video/scripts/render-cinematic-r4.mjs --stills
node brand/hype-flywheel-video/scripts/render-cinematic-r4.mjs
node brand/hype-flywheel-video/scripts/render-cinematic-r4.mjs --full
node brand/hype-flywheel-video/scripts/render-cinematic-r4.mjs --full --id=Omerta-Cinematic-02
```

Full delivery is 1080 × 1920, 30 fps, H.264 CRF 18, AAC 256 kbps, Rec.709. Default drafts are 540 × 960. Every render also outputs five review stills. Use the shared local Remotion install; no dependency or application entry-point changes are needed.
