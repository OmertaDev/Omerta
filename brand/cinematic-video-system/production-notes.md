# OMERTÀ — cinematic release campaign

Three new vertical films: **Build an Empire (72s)**, **The Economy Has Territory (75s)** and **The City Remembers (72s)**. This follows the revised cinematic brief, with genuine game screenshots, pans, short scope/360 impacts, fresh fal narration and original sound design. The earlier brainrot footage and music are not used.

## Source and release setting

The creative setting is the user's future fully live release. The [96-family fact matrix](mechanics-coverage.md), [machine-readable sources and statuses](coverage.json), and [beat mapping](coverage-map.json) distinguish implementation evidence from launch assumptions. Canonical Explore coverage is 40/40. A mapped mechanic may be a supporting label; three short films do not explain every individual rule or endpoint.

Actual captures come from the repository's local preview UI with synthetic players. They establish the appearance of the interface, not production activation, real balances, transactions, or a live external AI conversation. The local adviser fixture invokes real scoped game handlers deterministically. The human-confirmation capture is a real product approval control. Screens are not AI-generated or reconstructed.

Liquidity, World Director and other release integrations that the preview cannot demonstrate use explicitly labeled editorial diagrams. These cuts are reviewable release-setting promos; publication timing must match the activation assumptions in the fact matrix.

## 01 — Build an Empire

**Concept.** Follow the expansion from one street action into a system of capabilities, assets, businesses, Crew coordination and Family control. Every source of power creates upkeep, exposure or a rival. The ending turns the economic loop into a personal stake: build something worth defending.

**Audience and share idea.** Recognizable mafia strategy and RPG screens establish trust immediately. The novelty is how many connected activities sit behind one decision. Slow pans let the interface register; an occasional 360 turn or scope impact punctuates the shift from personal progression to collective power. The information gap is whether the empire can survive what it attracts. The share trigger is the breadth of playable systems.

**Voice and sensation.** Dry, low male delivery; 84 BPM pulse, low percussion and restrained impacts. Sound follows the actual transitions, with a short instrumental vacuum before important turns. No celebrity imitation, borrowed music or MLG logos.

**Alternate first four seconds** — replace only beat C1-B01; keep the rest of the timeline:

1. "One job can become an empire." — scope onto the crime card, snap to the Family treasury.
2. "Getting rich is the easy part." — treasury close-up, silent half-beat, incoming law screen.
3. "You don't inherit power. You build it." — inventory pan into territory cards.

## 02 — The Economy Has Territory

**Concept.** Trace separate balances and custody paths, from defined OMR access and useful spending to inventory recycling. Then distinguish the canonical market's Hook allocations from seasonal Turf fee rights. Bonds, LP commitments and eligible NFT/RWA delivery complete the economic picture without promising income or appreciation.

**Audience and share idea.** Familiar game shops become a legible monetary circuit. The novelty is that liquidity fee rights become something Families contest, while principal remains with the protocol. The opening establishes two currencies with different jobs; the reveal explains why liquidity can have territory. The likely discussion is about custody and who controls future funded fees.

**Voice and sensation.** Precise auditor delivery; 108 BPM clockwork pulse. Parallel fee bars appear together rather than as sequential transfers. Numbers remain visible after the impact. No price chart, yield promise or investment CTA.

**Alternate first four seconds** — replace only C2-B01:

1. "The cash and the token do different jobs." — split the real cash and OMR readouts.
2. "Who owns the liquidity? Watch the custody." — protocol principal stays fixed while fee rights move.
3. "A Family can fight over future fees." — actual territory UI match-cuts to the Turf diagram.

## 03 — The City Remembers

**Concept.** Begin with an information advantage. Follow clues through original evidence, sharing permissions, different roles, useful equipment and authorized action. The player confirms the move; committed history and an authored world response create the conditions for another opportunity.

**Audience and share idea.** Investigation and conspiracy are immediately recognizable. The novelty is information with provenance, visibility boundaries and multiplayer consequences. A real case file replaces a cinematic crime scene, then an approval control reveals where agency resides. The share trigger is the distinction between a scripted cutscene and a state-dependent system.

**Voice and sensation.** Controlled Consigliere delivery; 72 BPM suspended minor textures, room tone and mechanical ticks. Red accents and serif headings distinguish this film. No implication that an Agent knows private information it has not been granted or controls an unrestricted wallet.

**Alternate first four seconds** — replace only C3-B01:

1. "Your Crew does not share one truth." — cut between two actual participant views.
2. "That rumor needs a second source." — evidence pan freezes on provenance.
3. "The city keeps the consequence." — archive entry reverses into the original case file.

Alternate hooks are production-ready copy and edit directions, not generated alternate final movies.

## Production handoff

- **Exact speech, timecodes, captions and shot order:** [screenplay.md](screenplay.md) and [production-data.json](production-data.json). Every beat has a capture ID, timing, headline, narration, supporting labels, transition and evidence IDs.
- **Complete shot handoff:** [shot-plans.csv](shot-plans.csv) and [shot-plans.json](shot-plans.json) contain all 54 beats with purpose, visual, character/account context, action, environment, camera, lighting, audio, dialogue, caption, UI overlay, transition, fal input/settings, failure conditions and required source assets.
- **Source assets:** `public/art/cinematic-r4/captures/`; [manifest](../../public/art/cinematic-r4/manifest.json) records decoded dimensions, hashes, capture times and provenance. Extensions preserve the captured filenames; decoded format is recorded separately.
- **fal prompts/settings:** `generation-requests/narration*.json` contains copy-paste API inputs, original voice IDs, model, speed, sample rate and format. `generation-ledger.json` records request IDs and downloaded hashes. Final selected takes are in the audio report. No credential is stored in these files.
- **Image/video generation:** none. Real screenshot capture replaces synthetic shots under the revised brief. Do not feed screenshot text through a video model; animate the original pixels in the editor to preserve product accuracy.
- **Camera and lighting:** deterministic virtual pans, very small push-ins, black/ivory/gold, sage or muted red. Preserve the game's real artwork and UI. Do not re-light or invent controls.
- **Captions:** burned in, centered in the safe region, timed to complete spoken phrases. These are sentence/phrase timings, not claimed phoneme-level alignment. Essential copy stays inside x90–900 and above y1472 in the 1080×1920 canvas.
- **Motion:** 11-frame scope/spin/snap entrances, then readable holds. The main screenshot pans continuously. Multi-screen beats divide their hold across the named actual captures. Custom impacts are original geometry, not copied game overlays.
- **Audio:** fresh narration, 48 kHz stereo PCM masters, separate dialogue/music/SFX/room stems. Target −14 LUFS and ≤−1 dBTP. No spoken word is hard-trimmed to fit. See `audio-plan.md` and the measured report for actual fit, loudness and silence checks.
- **Master:** 1080×1920, 30 fps, H.264/yuv420p, BT.709, AAC 256 kbps, 72/75/72 seconds. All three use the same safe area for TikTok, Reels, Shorts and X; platform overlays still vary by device.

## Regeneration and review

1. Edit `build-production.mjs`, then run it. That generates screenplay, production data and the coverage map.
2. Record new actual screens through the browser if needed; run `prepare-captures.mjs` to refresh provenance and dimensions.
3. Submit only changed narration IDs through the authenticated fal session. Use a new version suffix; do not resubmit existing IDs.
4. Run `mix-audio.mjs`. Any unfitted speech blocks final audio instead of being truncated.
5. Run `finalize-production.mjs` to attach measured sentence timing, restore the approved adviser crop, write VTT files and add completed audio paths to the manifest. Then run `export-shot-plans.mjs` to check audio/script agreement and generate the handoff tables.
6. Run `node brand/hype-flywheel-video/scripts/render-cinematic-r4.mjs --stills`, review crops/type/diagrams, then `--full` for all three masters.
7. Verify dimensions, durations, audio, decoded frames and the local review players. Existing older campaign assets are separate.

`build-review.mjs` writes the local three-player review page. `review-server.mjs` serves it at `http://127.0.0.1:8769` with video range requests; it binds only to this computer.
