# public/art — generated art

Most files here are produced by `tools/art.js` from the manifest in that file, and served by
`GET /art/:file` (an allowlist built at boot, so there is no path-traversal surface — a request is
only ever a Map lookup).

The `omr-01-*.png` through `omr-05-*.png` research sheets are exported from the editable
Excalidraw sources in `docs/diagrams/` by `tools/render-omr-excalidraw.mjs`.

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

Art direction, the prompts, and what went wrong in the real runs: `docs/ART.md`.
