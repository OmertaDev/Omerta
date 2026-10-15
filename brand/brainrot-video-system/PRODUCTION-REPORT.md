# OMERTÀ video production — revision 3

24 September 2026. Three internal working cuts for the **future fully live release**, including seasonal liquidity Turf. New cast, source images, shots and sound. Nothing has been published.

## Watch

- [Film 1 — What even is OMERTÀ?](../../output/brainrot-r3/Omerta-R3-01-1080.mp4) · 31.5s
- [Film 2 — The economy is the game](../../output/brainrot-r3/Omerta-R3-02-1080.mp4) · 33s
- [Film 3 — The game is watching you](../../output/brainrot-r3/Omerta-R3-03-1080.mp4) · 33s
- [Local review page](../../output/brainrot-r3/index.html)

The cuts include generated motion, performed dialogue, original procedural music/SFX, burned captions and editorial context. **Release gameplay captures remain pending and visibly marked.** Generated scenes and diagrams are labeled. These are review exports, not cleared publication masters.

## New direction

**Dirty web / low-poly crime tabloid:** coarse polygonal adult characters, full-size concrete city locations, fisheye cameras, oversized props, acid lime, cobalt and bone. Openings: four criminals carrying one enormous key; a Rookie trapped inside a tower of cargo cases; a Don demanding answers from a phone. No earlier campaign media enters the selected manifest.

Recurring references: [Rookie](../../public/art/brainrot-r3/refs/R3-C01-poly.png), [Don](../../public/art/brainrot-r3/refs/R3-C02-poly.png), [Consigliere](../../public/art/brainrot-r3/refs/R3-C03-poly.png), [Auditor](../../public/art/brainrot-r3/refs/R3-C04-poly.png). The Consigliere portrait is an editorial persona, not a recording of an agent call.

## Fal execution

| Asset | Actual execution |
|---|---|
| Stills | 48 downloaded: 12 text-to-image and 36 edit requests, including unused development images |
| Final visual foundation | Four polygonal cast references, 18 base frames and four corrected frames |
| Motion | 24 successful five-second takes: 18 base shots plus two additional opening takes per film |
| Selected footage | 18/18 slots use downloaded motion; no reference-still fallback |
| Voices | Four original MiniMax text-designed voices; no real-person voice cloning |
| Dialogue | 72 downloaded takes; 65 lines selected, including seven shortened replacements |
| Sound | Three stereo mixes, with dialogue, music, SFX and room stems |
| Failed requests | Nine earlier photoreal opening requests rejected by the provider; retained and unused |
| Unresolved requests | Zero when the generation session closed |

Endpoints: `bytedance/seedream/v5/pro/text-to-image`, `bytedance/seedream/v5/pro/edit`, `bytedance/seedance-2.5/image-to-video`, `fal-ai/minimax/voice-design`, `fal-ai/minimax/speech-02-hd`.

The authenticated catalog was checked. Seedance 2.5 was retained after the stylized pilot succeeded; no benchmark superiority is claimed. Source motion is 720×1280/24fps, conformed into 1080×1920/30fps delivery, not native 1080p generation. Model audio was disabled for controlled dialogue and comic timing in the edit.

Realistic face inputs received provider likeness rejections. Production created entirely new, visibly abstract polygonal characters from text and rebuilt the frames. Rejected photographic inputs were not retried through another endpoint.

Pricing was checked. Exact billing remains unavailable because billing-event access returned 403 for the inference credential. No estimate is represented as the account's bill. The credential was held in a transient process, not saved in the production files; the process closed after every job reached a terminal state.

## Selections and review

Opening selections: Film 1 take 1 for the clean four-person/key composition and camera reaction; Film 2 take 3 for the intact case tower and Auditor gesture; Film 3 take 1 for stable phone framing. Ordinary shots use their first accepted polygonal take. All 24 takes were sampled at 1s and 4s for identity, framing and action. This does not assert inspection of every source frame.

[Selections](../../public/art/brainrot-r3/selections.json), [render manifest](../../public/art/brainrot-r3/manifest.json), [generation ledger](../../public/art/brainrot-r3/generation-ledger.json), [source contact sheets](../../output/brainrot-r3/qa-motion/) and [audio report](../../public/art/brainrot-r3/audio/mix-r3-report.json) preserve exact inputs, request IDs, failures, outputs, hashes and measured timing. The ledger contains no API credential.

The three **alternative hook concepts per film** are scripted and prompted in the A–L packages. Their separate footage and exports have not been generated. The three generated opening takes per film are variations of the selected hook, not those nine alternative concepts.

## Audio

| Film | Length | Integrated loudness | True peak |
|---|---:|---:|---:|
| 1 | 31.500s | −14.03 LUFS | −1.23 dBTP |
| 2 | 33.000s | −14.03 LUFS | −1.27 dBTP |
| 3 | 33.000s | −14.07 LUFS | −1.26 dBTP |

Mixes are 48kHz stereo PCM24; exports use AAC. All 65 complete lines fit their windows without overlap or hard speech truncation. One replacement uses a 1.355 tempo factor; other lines stay within 1.35. Captions follow line windows. Word-level forced alignment and a perceptual phone-speaker listen remain outstanding; measured timing/loudness do not establish subjective performance quality.

## Remaining release inputs

1. Replace marked slots with genuine release captures. Film 1: salvage/inventory, recipe/crafting, contributions, Family approval/execution, persistent archive state and the separate shipment/market/investigation chain. Film 2: pickup/convoy remainder/toll, game-cash treasury, human-confirmed OMR swap, Hook→POL/Core, separately funded Turf siege, checkpointed ownership and later funded fee credits. Film 3: permitted knowledge, independent evidence, denied private access, own contributions, approval/execution and persistent consequences.
2. Confirm [L01–L05](02-LAUNCH-ASSUMPTIONS.md), especially deployed/funded liquidity and same-build Consigliere integration. The [fact matrix](00-FACT-MATRIX.md) retains actual repository status; the promo setting does not change it.
3. Perform uninterrupted phone viewing/listening, inspect platform upload chrome, tighten performance/caption onset issues and remove production labels only after capture slots are complete.
4. Generate the optional nine alternate-hook assets when preparing the opening A/B test. No virality or performance result is claimed.

No upload, deployment, wallet transaction, external message or publication occurred.

## Rebuild

From the repository root:

```powershell
node brand/brainrot-video-system/build-packages.mjs
node brand/brainrot-video-system/sync-r3-media.mjs
node brand/hype-flywheel-video/scripts/render-brainrot-r3.mjs --full
node brand/brainrot-video-system/build-review.mjs
```

These commands use downloaded media and submit no new fal jobs. Full packages: [Film 1](video-01.md), [Film 2](video-02.md), [Film 3](video-03.md).
