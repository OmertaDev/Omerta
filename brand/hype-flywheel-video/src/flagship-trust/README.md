# Trust Is the Game — launch-day edit preview

Isolated 1920 × 1080, 24 fps composition. It does not alter other campaigns.

The canonical timeline is `brand/flagship-trust/production-data.json`. The asset index is `public/art/flagship-trust/manifest.json`. Genuine screenshots belong in each beat's `capture` field; atmospheric references belong in `asset`. The renderer copies only referenced public media into its own render directory. Source media and the original brand asset are not modified.

`DossierScene`, `GameplayScene`, and `DiagramScene` keep the timeline modular. The user-directed creative framing presents the fully launched public game. On-screen chrome uses `EDIT PREVIEW` for the editing stage and `OMERTÀ · TRUST IS THE GAME` for the footer; it does not display availability, pilot, composite-scenario, or scratch-voice labels. Production evidence and temporary audio provenance remain in the accompanying package. Financial graphics retain their actual custody, eligibility, funding, and payout boundaries.

```powershell
node brand/hype-flywheel-video/node_modules/typescript/bin/tsc -p brand/hype-flywheel-video/src/flagship-trust/tsconfig.json
node brand/hype-flywheel-video/scripts/render-flagship-trust.mjs --stills
node brand/hype-flywheel-video/scripts/render-flagship-trust.mjs --stills --beats=S01,S02
node brand/hype-flywheel-video/scripts/render-flagship-trust.mjs --all-stills
```

`--animatic` renders one clean frame per beat at full resolution, assembles a still-based timing movie with the available scratch audio, and writes SRT/VTT sidecars. It embeds default English `mov_text` subtitles only if the existing FFmpeg binary supports them; the bundled Remotion binary does not. The browser review page must load the VTT track. It is a review artifact, not a motion or final-voice master. `--full` explicitly opts into rendering the complete Remotion timeline; add `--clean` to omit burned-in captions while preserving the edit-preview chrome. Preview stills use half resolution. All outputs go under `output/flagship-trust`.

`--animatic --reuse-stills` is an encode retry for already-reviewed 1080 clean frames. It rejects a changed timeline or missing full-resolution PNGs. Do not use it after editing scene code or assets; render new stills in that case. Composition props are resolved before still rendering, so clean frames cannot accidentally retain a sampled caption. Stills omit audio loading; FFmpeg attaches the full track during assembly.

Video references play once, with restrained duration fitting and no looping. Font files may be supplied in `manifest.fonts`. For an SVG containing text, use an approved raster of the unchanged source with its documented font resolved; a web font loaded into the composition cannot change text inside an external SVG image.
