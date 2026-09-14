# Omertà — Connected City marketing package

Open index.html to browse all materials, or run node serve.mjs and visit http://127.0.0.1:8817.

1. Responsive landing page with built / next status and seven original campaign films.
2. Three six-slide carousels: 18 PNGs (1080×1350), outlined SVGs, alt text and post copy.
3. Three silent 15-second teasers (1080×1920).
4. A 78-second narrated API walkthrough (1920×1080), English captions, transcript and 24 recorded local responses.
5. Press kit with fact sheet, boilerplate, proposed founder talking points, FAQ, launch copy and artwork.

All materials are local and unpublished. Background artwork is illustrative. Market V2 is a candidate, not deployed or funded; Coordination pilots default off.

Verification: 116 internal page and asset links resolved; all four new videos fully decoded; TypeScript and scoped ESLint passed. Landing page checked on desktop and mobile.

Build scripts depend on the surrounding Omertà repository and its installed dependencies. Remotion sources are in ../hype-flywheel-video/src/marketing-extension. No credentials are included.

## Second collection — next/index.html

- Interactive fee, material and evidence simulations (use node serve.mjs; JavaScript modules require HTTP).
- Three audience sheets in HTML and one-page PDF.
- Developer quickstart with a runnable repository fixture, verified example results, 31.7-second narrated video, captions and transcript.
- Four announcement sets, each with X, Discord and email drafts plus PNG/SVG artwork and alt text. Replace [CAMPAIGN_URL] before publication.
- Split Ledger case study tied to recorded local responses.

Additional fal.ai usage: zero. Existing artwork, narration and video were reused.
Verification: three simulation invariant tests passed; real example passed 24 HTTP responses plus inventory, cash and completion assertions; 227 local page/asset links resolved; all three PDFs have one page; developer video decoded with audio; desktop and 390px responsive interactions checked.

## Crypto field guide — crypto/index.html

Six exhibits: ownership/authority, illustrative fee receipts, finite-budget stress scenarios, Family Turf season, account identity/evidence gates, and release evidence. Includes a PNG/SVG ownership overview and captured documentation with 17 source hashes.

Checks: four teaching-model tests passed; receipt validation and stages, capacity exhaustion despite extra funding, identity/current-access changes and all six season steps verified in the browser. 323 local HTML asset/page references resolve. No live deployment check or contract security review was performed. No additional fal.ai credits used.
