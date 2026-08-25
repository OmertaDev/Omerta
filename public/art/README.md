# public/art — generated art

Most files here are produced by `tools/art.js` from the manifest in that file, and served by
`GET /art/:file` (an allowlist built at boot, so there is no path-traversal surface — a request is
only ever a Map lookup).

The `omr-01-*.png` through `omr-05-*.png` economy sheets and `gameplay-01-*.png` through
`gameplay-09-*.png` character-route sheets are exported from editable Excalidraw sources in
`docs/diagrams/` by `tools/render-omr-excalidraw.mjs`. Their visual language follows the site
tokens: near-black canvas, warm paper text, gold for value or advantage, blue for code-controlled
state, green for arrived backing or constructive progress, and blood red for cost, counterplay,
blocked, irreversible, or dormant paths. The renderer rejects any declared element outside the
1600 × 1000 artboard before export. Run it with `--list` to audit both supported source families
without launching the browser renderer.

`manifest.json` is the ledger: for each image it records the model, aspect, seed, size, the *job* the
image has to do, the exact prompt, and when it was generated — plus the running spend. Any image here
can be explained or reproduced from it.

Where they are used:

| | |
|---|---|
| `hero-poster` | the landing hero (behind the wordmark) |
| `landing-break` | the landing's full-bleed mid-page band, and the City screen's plate |
| `hero-backdrop` | unused — kept because it is a good image that lost the hero job on the merits (too dark, too blue, letterbox bars baked in) |
| `card-*` | broadcast card backgrounds, embedded as data URIs by `src/cards.js` (these unfurl on X) |
| `district-*` | the six core districts + landing feature pills |
| `interior-*` | one per console screen (`TAB_ART` in `public/index.html`) |
| `pill-*` | landing feature pills whose subject needed to be specific |
| `crest`, `icons`, `citymap` | flat graphic work, currently unused |
| `omr-01-*` … `omr-05-*` | OMR mechanism explainer series on the landing page and in the Codex |
| `gameplay-01-*` … `gameplay-09-*` | Path, build, mastery, and Career field guide on the landing page and in the Codex |

Art direction, the prompts, and what went wrong in the real runs: `docs/ART.md`.
