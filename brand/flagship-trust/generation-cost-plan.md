# Bounded generation plan

Prepared **2026-09-29**. **Actual new spend: $0.00. Requested maximum authorization: $100.00 USD in incremental fal usage.** This is a proposed ceiling, not approval and not an instruction to buy credits. Account access, balances and custom commercial terms were not inspected. Complete the claim ledger, exact narration, storyboard and rough timed animatic before any paid generation.

Target one 390s film, 1920×1080, 16:9, 24fps; 780–860 spoken words. Plan **ten five-second atmospheric inserts**, under this bounded production plan. Let authentic UI and source-grounded graphics carry the story; at least 175.5s of a 390s film must contain them, and aim above that floor. Existing low-resolution atmosphere can stand in during preproduction. Never count AI footage as game evidence.

## Current public model check

These are two suitable benchmark candidates, not an asserted universal ranking. Prices are public observations dated 2026-09-29; recheck exact settings/quote at execution.

| Use | Endpoint | Public pricing and planning treatment |
| --- | --- | --- |
| Candidate A: primary continuity test | `bytedance/seedance-2.5/image-to-video` | [Page](https://fal.ai/models/bytedance/seedance-2.5/image-to-video): approximately **$1.164/output second at 1080p**, token-based. Audio toggle does not alter cost. Use this higher candidate allowance for all production motion. |
| Candidate B: restrained camera/character test | `fal-ai/kling-video/o3/pro/image-to-video` | [Page](https://fal.ai/models/fal-ai/kling-video/o3/pro/image-to-video): **$0.112/output second, audio off**; $0.14 with audio. The [Kling overview](https://fal.ai/kling-3) advertises up to 1080p. Verify decoded output before accepting final media. |
| Exact selected Voice A | `fal-ai/minimax/speech-2.8-hd` | [Official page](https://fal.ai/models/fal-ai/minimax/speech-2.8-hd): public billing metadata **$0.10/1,000 input characters**. Count characters, not words. |
| Original landscape references/first frames | `bytedance/seedream/v5/pro/text-to-image` / `bytedance/seedream/v5/pro/edit` | [Text](https://fal.ai/models/bytedance/seedream/v5/pro/text-to-image): tentative $0.0675/image at ≤1536² total pixels. [Edit](https://fal.ai/models/bytedance/seedream/v5/pro/edit): same base plus $0.0045 per additional input image. 1920×1080 fits this area tier. Budget $0.081/output with at most four input references. |
| Optional replacement score | `elevenlabs/music/v2.5` | [Exact version page](https://fal.ai/models/elevenlabs/music/v2.5): **$0.60/output minute**, rounded upward per request. Do not substitute the $0.80 rate shown on older unversioned ElevenLabs pages. |
| Final caption alignment | `fal-ai/elevenlabs/forced-alignment` | [Page](https://fal.ai/models/fal-ai/elevenlabs/forced-alignment): **$0.22/input hour rounded upward per request**. Align the assembled narration once; reserve one correction call. |

Seedance’s current [API schema](https://fal.ai/models/bytedance/seedance-2.5/image-to-video/api) offers 1080p, while parts of its marketing copy still say 720p. The schema also exposes draft preview/completion, but its separate billing and completion workflow were not costed here. **Do not use draft/completion in this budget.** If 1080p is unavailable at execution, use the other benchmark candidate if it passes; do not claim an upscaled 720p insert is native 1080p. These models have not been compared on this film’s shots yet.

## One small benchmark, then a decision

Use one approved original 1920×1080 first frame: the representative newcomer at a ledger table, face in three-quarter view, one hand closing an unmarked envelope. Five seconds, subtle lateral camera move, no spoken dialogue, no text or logos. Submit **one take to each candidate**, never more than two models. Score identity/wardrobe continuity, hands/prop integrity, adherence, restrained motion, negative space for overlays, temporal artifacts, decoded resolution/fps, measured latency and actual cost. Reuse the accepted test as an insert when possible. Do not expand into a benchmark campaign.

Seedance input settings: `image_url`, `prompt`, `duration:"5"`, `resolution:"1080p"`, `aspect_ratio:"auto"` (first frame is 16:9), `generate_audio:false`, `bitrate_mode:"high"`, `codec:"H264"`. No input seed or dedicated negative-prompt field is exposed in this endpoint’s current schema; log the returned seed. Keep failure conditions in the shot prompt/review checklist.

Kling input settings: `image_url`, `prompt`, `duration:"5"`, `generate_audio:false`, `shot_type:"customize"`; optional `end_image_url`. Its [current endpoint schema](https://fal.ai/models/fal-ai/kling-video/o3/pro/image-to-video/api) has no explicit resolution, aspect-ratio or seed input. Do not invent those fields; use a 16:9 first frame and inspect the result. Both candidates accept camera direction in the prompt. Composite all UI, claims, financial numbers and wordmark afterward.

## Budget arithmetic

| Line | Hard unit bound | Allowance USD |
| --- | --- | ---: |
| Benchmark | 5s Seedance + 5s Kling; one request each | 6.380 |
| Production motion | ≤10 accepted-shot first attempts ×5s; priced at Seedance allowance even if Kling wins | 58.200 |
| Replacement motion | ≤3 replacement requests total ×5s; at most one replacement per shot | 17.460 |
| Character/scene stills | ≤16 outputs total, including rejected candidates and corrections; ≤4 input refs/output | 1.296 |
| Narration | ≤10,000 input characters cumulative, including retakes | 1.000 |
| Alignment | ≤2 calls; each assembled audio ≤1 hour | 0.440 |
| Optional score | ≤7 billed minutes total, including any correction; preferably reuse existing score | 4.200 |
| Ring-fenced correction/rate reserve | Unspent unless a documented final correction or quote variance requires it; does not lift any unit bound | 11.024 |
| **Total ceiling** | **One film only** | **100.000** |

The normal first-pass allowance, including both tests, all stills, full narration, two alignment calls and optional score, is **$71.516**. The full bounded request allowance before reserve is **$88.976**. These are planning calculations from observed public prices; Seedance prices are approximate, images are tentative, and actual billed cost may differ. The account’s actual cumulative charges plus pending-request upper bounds must remain ≤$100.00. Any applicable taxes or fees must fit the ceiling; otherwise stop before submission. Reusing the benchmark winner or existing score reduces spend; it does not authorize extra variants or shots.

Voice A stays `ttv-voice-2026092513153126-73DRGCkR`. Use the existing narration settings as the starting point; maintain natural speed and pronunciation direction. Generate meaningful chapter performances, not isolated words. The 780–860-word target is not proof of duration: measure the actual read before final picture lock. Keep generated audio at a supported sample rate, then resample in the existing mix pipeline to 48kHz. Do not silently change the voice if the original account can no longer access it.

## Spend controls and acceptance

1. No paid work until the script, storyboard, claim ledger and rough animatic are reviewable and the user supplies both authorized account access and the stated ceiling.
2. Recheck official schema, commercial-use status and current price. Record the applicable provider/account terms for accepted assets. Submit serially while budgeting from confirmed charges plus pending cost bounds.
3. Log shot ID, endpoint, complete settings, prompt hash, reference hashes, request ID, generation time, output hash/dimensions/fps, take count, accepted/rejected status, rejection reason and actual billing. Provider failure or uncertain submission must be reconciled by request ID before any retry. Do not assume a rejection is unbilled.
4. Maximum two attempts per production shot, with only three replacement attempts across the entire film. A benchmark take accepted into the film counts toward that shot’s attempts. Never regenerate accepted work without a concrete defect. If the limit is exhausted, use a source-grounded graphic or approved still; retain the spending limit.
5. No generated readable game UI, unapproved hidden clues, invented economic proofs, recognizable actors or franchise material. No extra cuts, thumbnails campaigns or model exploration.
6. Inspect actual accepted exports, including natural motion at 24fps, before delivery. Do not apply frame interpolation merely to force an advertised native rate. Final targets: 48kHz audio, about -14 LUFS integrated, maximum -1dBTP; captioned master, clean master and subtitles. This plan does not claim those exports exist.

**Exact pending authorization:** up to **$100.00 total incremental fal usage** for this one film under the unit and retry limits above. Current actual spend remains **$0.00**, paid request count **0**. Publication, paid distribution, wallet actions and unrelated account changes are excluded.

