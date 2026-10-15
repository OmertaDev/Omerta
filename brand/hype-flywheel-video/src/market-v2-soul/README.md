# Market V2 · Soul revision

Separate cinematic treatment; the original Market V2 film is preserved.

Full-bleed original photographs/video plates, amber light, olive and burgundy shadows, large Georgia serif titles, asymmetrical compositions, slow camera drift, selective whip/scope/spin cuts, and tilted actual-interface close-ups replace the previous slide framing. Cinema beats show the photograph without diagrams. Critical diagram beats use transparent annotations and glass-like inventory vessels, with their verified conversion, recovery and custody logic retained.

Canonical source: `brand/market-v2-soul/production-data.json`. Media manifest: `public/art/market-v2-soul/manifest.json`. Every beat needs a `plate`; optional `secondPlate` makes a mid-beat cut. `layout` selects `cinema`, `diagram`, or `capture`. Plates may be still images or muted video, played once and slowed only when needed to fit the scene. Video duration is read from the manifest or probed during staging. Generated atmosphere is separate from genuine interface captures. No prior voice track is implicitly reused.

Actual UI close-ups appear in B10, B18, B20, B26 and B31. B25 retains its Turf diagram before a brief district UI insert whose label distinguishes that interface from Turf fee rights. `captureInsert` controls the cut; `captureLabel` provides a distinction label. Diagram scenes preserve both source condition tags. Captions prioritize `film.captions`, then top-level `captions`, then narration fallback.

```powershell
node brand/hype-flywheel-video/node_modules/typescript/bin/tsc -p brand/hype-flywheel-video/src/market-v2-soul/tsconfig.json
node brand/hype-flywheel-video/scripts/render-market-v2-soul.mjs --stills
node brand/hype-flywheel-video/scripts/render-market-v2-soul.mjs --stills --beats=M04-B01,M04-B03,M04-B31
node brand/hype-flywheel-video/scripts/render-market-v2-soul.mjs --motion-qa --beats=M04-B01,M04-B13 --concurrency=4
node brand/hype-flywheel-video/scripts/render-market-v2-soul.mjs --full --concurrency=4
```

Default still pass is three direction frames. `--all-stills` samples all scenes and both sides of any UI insert. `--motion-qa` renders silent 540p scene clips for the selected beats without requiring final audio. Full delivery is 1080 × 1920 at 30 fps; draft exports are 540 × 960. Full video requires the new audio mix in the Soul manifest. Staging includes only the isolated Soul inputs.
