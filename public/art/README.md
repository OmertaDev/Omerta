# public/art — generated art

Most files here are produced by `tools/art.js` from the manifest in that file, and served by
`GET /art/:file` (an allowlist built at boot, so there is no path-traversal surface — a request is
only ever a Map lookup).

The `*-480.webp` through `*-1920.webp` landing derivatives are generated from the committed source
art by `npm run art:responsive`. The originals remain the legacy/no-JavaScript fallback and the
full-resolution download target; the WebP files are the viewport-sized display sources. The
`hype-money-720.mp4` mobile encode is derived from `hype-money.mp4` with H.264 CRF 29, 1280×720,
96 kbps AAC, and the MP4 fast-start atom enabled. It is deliberately a separate file so phone
playback does not spend the full 1080p source's transfer cost.

`hype-flywheel-v3.mp4` is the 82.3-second narrated game-economy film built by the Remotion project in
`brand/hype-flywheel-video/`. Its `hype-flywheel-v3-720.mp4` delivery copy uses H.264 CRF 27,
1280×720, 160 kbps AAC, and fast start; the matching `*-poster-960.webp` and `*-poster-640.webp`
files keep the deferred landing embed responsive. Three campaign-specific Seedance plates (hero,
Street Deeds, and future RWA), nine MiniMax voice segments, and their provenance ledger live together
under `art/hype/`. The dedicated Deeds/RWA chapters separate permanent deed provenance from
contestable control, then trace the gated family-ballot → walled buy → held-unit allocation →
extracted-Deed vault path.

The `omr-01-*.png` through `omr-05-*.png` economy sheets and `gameplay-01-*.png` through
`gameplay-09-*.png` character-route sheets are exported from editable Excalidraw sources in
`docs/diagrams/` by `tools/render-omr-excalidraw.mjs`. Their visual language follows the site
tokens: near-black canvas, warm paper text, gold for value or advantage, blue for code-controlled
state, green for arrived backing or constructive progress, and blood red for cost, counterplay,
blocked, irreversible, or dormant paths. The renderer rejects any declared element outside the
1600 × 1000 artboard before export. Run it with `--list` to audit both supported source families
without launching the browser renderer.

`manifest.json` is the ledger: for each image it records the model, aspect, seed, size, the _job_ the
image has to do, the exact prompt, and when it was generated — plus the running spend. Any image here
can be explained or reproduced from it.

Where they are used:

|                                   |                                                                                                                             |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `hero-poster`                     | the landing hero (behind the wordmark)                                                                                      |
| `landing-break`                   | the landing's full-bleed mid-page band, and the City screen's plate                                                         |
| `hero-backdrop`                   | unused — kept because it is a good image that lost the hero job on the merits (too dark, too blue, letterbox bars baked in) |
| `card-*`                          | broadcast card backgrounds, embedded as data URIs by `src/cards.js` (these unfurl on X)                                     |
| `district-*`                      | the six core districts + landing feature pills                                                                              |
| `interior-*`                      | one per console screen (`TAB_ART` in `public/index.html`)                                                                   |
| `pill-*`                          | landing feature pills whose subject needed to be specific                                                                   |
| `crest`, `icons`, `citymap`       | flat graphic work, currently unused                                                                                         |
| `omr-01-*` … `omr-05-*`           | OMR mechanism explainer series on the landing page and in the Codex                                                         |
| `gameplay-01-*` … `gameplay-09-*` | Path, build, mastery, and Career field guide on the landing page and in the Codex                                           |

Art direction, the prompts, and what went wrong in the real runs: `docs/ART.md`.
