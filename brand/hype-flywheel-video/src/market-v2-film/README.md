# Market V2 mechanism film

Standalone `Omerta-Market-V2` composition. The renderer stages only the dedicated production JSON, manifest, screenshots, and audio into `output/market-v2-film/render-public`. R4 remains unchanged.

The timeline comes from `brand/market-v2-film/production-data.json`; media comes from `public/art/market-v2-film/manifest.json`. Range, reserve, allocation, observation, custody, vesting, commitment, and solver scenes are original editorial diagrams. Their inventory/line motion is illustrative, without quantitative price or balance scales. Captures remain actual repository UI, and captions use supplied absolute Caption JSON when available.

```powershell
node brand/hype-flywheel-video/node_modules/typescript/bin/tsc -p brand/hype-flywheel-video/src/market-v2-film/tsconfig.json
node brand/hype-flywheel-video/scripts/render-market-v2.mjs --stills
node brand/hype-flywheel-video/scripts/render-market-v2.mjs --all-stills
node brand/hype-flywheel-video/scripts/render-market-v2.mjs --full --concurrency=4
```

Default video renders are 540 × 960 drafts; full renders are 1080 × 1920 at 30 fps, H.264 CRF 18 and AAC 256 kbps. `--stills` samples key mechanisms; `--all-stills` renders one review frame per beat. No full-frame blur or scanline effects are used. Static asset paths and dimensions are validated before bundling. Completed audio is required for an MP4 render.
