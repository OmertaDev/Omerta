# Omertà — The city is connected

Seven vertical films designed 14 September 2026. A 92.3-second overview and six 54-second chapters, each at 1080 × 1920 / 30 fps. Black, ivory, brass and muted teal; cinematic establishing shots, kinetic titles, numbered ledger reveals and evidence paths. All copy is legible without audio. The overview includes fal-generated MiniMax narration; the six detailed chapters are silent. Overview subtitles are exported as SRT and WebVTT.

| Composition | Coverage |
| --- | --- |
| Omerta-ConnectedCity | Hook, reserve limits, capital, Turf, World Graph, shared evidence |
| Hook-TheCut | Base fee allocation, surge, opening protection, observations, actual-delta settlement, independent claims |
| Hook-TheReserve | Seven compartments, two-sided Core, directional ranges, cooldowns, stress, finite capacity, funded recovery, fee routing, bounded keeper |
| Hook-TheCapital | Inventory bonds, discount/caps/vesting, solver commit/reveal, realized profit, reserve share, NFT custody, sampled useful depth, prefunded rewards, maturity exit |
| Hook-TheTurf | Seasonal slabs, principal/fee separation, syndicates, historical ownership, sieges, typed settlement, corridors, loyalty, fortification |
| Omerta-WorldGraph | Canonical manifest, conserved materials, car salvage, crafting, quality, unique custody, mystery, four-account Crew operation; Phase 2A roadmap |
| Omerta-Coordination | Private graph runner, Dead Letter, Split Ledger, independent sources, discoveries/assertions/archives, live account/Crew/Family permissions, revocation; later phases |

## Review and export

From this directory:

```powershell
npx remotion studio src/hook-campaign/index.tsx --public-dir ../../public --no-open --port 8815
node scripts/generate-hook-plates.mjs --plan
# FAL_KEY is supplied only through the process environment.
node scripts/generate-hook-plates.mjs
node scripts/generate-hook-voice.mjs
node scripts/render-hook-campaign.mjs
```

`src/hook-campaign/copy.ts` owns the editable copy and shot order. `scenes/` owns the three shot treatments. `--stills` exports a storyboard without MP4s. `--id=Omerta-ConnectedCity` scopes an export to one film. The renderer saves videos, posters, shot previews and a local gallery in `../../output/omerta-connected-city/`.

Each shot is eight seconds; ten-frame crossfades overlap adjacent shots. The overview deliberately summarizes; the six chapter films provide full feature coverage. The underlying assets and source are reusable for later aspect-ratio cuts; only the vertical format is currently composed.

## Source and release boundaries

- Hook mechanics: `../../omerta-contracts/src/market-v2/OmertaHookV2.sol` and `../../omerta-contracts/docs/market-v2/DESIGN.md` / `RUNBOOK.md`. Latest local implementation, not a funded or deployed market. Companion contracts are identified separately from the Hook. No universal tax, guaranteed floor, APY, token appreciation or MEV immunity is claimed.
- World Graph: `../../SPEC.md` Phase 1 World Graph section, `../../src/worldgraph.js`, and the September 4 Phase 2A materials/salvage specification with September 13 workflow amendment. Phase 1 is implemented; Phase 2A is in development. NFT export is not live. The $300 crafting charge is game cash, not real dollars.
- Coordination: `../../docs/coordination-engine/README.md`. Phases 00–01 are implemented for scoped review. Value-neutral JSON API pilots default off. Organization delegation, economic adapters, AI generation and mass operations remain planned.
- Brand voice and handle: `../../MARKETING.md`. The CTA invites exploration and following development, not deposits or investment.

The campaign is a creative implementation, not a new contract audit or production readiness assessment. No production application, economic configuration or publishing destination is changed.

## Asset provenance

`../../public/art/hook-campaign/fal-prompts.json` holds three original Seedance 2.5 prompts for a city vault, a seven-compartment reserve desk and family Turf. Generated footage is visual metaphor, not a literal system diagram or gameplay capture. The generator retains request IDs and SHA-256 hashes in `fal-manifest.json`, and resumes existing jobs without automatic duplicate paid submissions. The legacy `art/hype/hero-backdrop.mp4` is the temporary Studio fallback until the new plates finish. Existing poster PNGs in that asset folder were copied without modification from the Market V2 campaign and are not used behind the film text.

Generation estimate: three eight-second 720p plates, approximately $11.35 using the repository's prior $0.473/second estimate. Actual fal billing may differ. The current model/schema was checked against https://fal.ai/models/bytedance/seedance-2.5/text-to-video/api on 14 September 2026. No key is saved in source or manifests.

The overview's twelve MiniMax Speech-02 HD takes use the stock Deep_Voice_Man voice, not a cloned person. `voice-manifest.json` retains exact spoken copy, durations and hashes. Playback is adjusted only enough to fit each take within its 6.9-second window. Voice generation is additional to the video estimate. No music is included.
