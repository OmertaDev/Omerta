# Market V2 — original audio plan

MARKET V2 — THE CITY’S RESERVES · 173s · mixed-verified

Fresh account-designed narration plus newly synthesized mechanical noir score and effects. No prior campaign audio or third-party samples are reused. All source takes remain intact. Only contiguous leading/trailing silence is removed; complete speech is retained at no more than 1.12× local tempo.

The voice is dry and centered, with gentle 2:1 dynamics and 75 Hz/12.5 kHz filtering. Music ducks by up to 7 dB under speech, with 10 ms attack and 220 ms release. Audio delivery is 48 kHz stereo PCM24. Manual listening is still needed for pronunciation, emotion, musical timbre and phone-speaker balance.

Measured master: -14.15 LUFS integrated; -1.29 dBTP; 173s exactly.

## Narration and captions

Captions use measured audible sentence edges. Only sentences over 54 characters are split into phrase pages; internal page timing is estimated proportionally rather than forced word alignment. See public/art/market-v2-film/audio/04-captions.json.

| Line | Audible window | Take | Local tempo | Narration |
|---|---|---|---|---|
| M04-L01 | 00:00.080–00:03.245 | v0 | 1.000× | The market has defenses. Every one can run out. |
| M04-L02 | 00:05.080–00:09.611 | v0 | 1.000× | Core supplies two-sided liquidity. The other compartments have specific jobs. |
| M04-L03 | 00:10.080–00:14.479 | v2 | 1.000× | As selling crosses active ranges, Ether converts into OMR. |
| M04-L04 | 00:15.081–00:19.209 | v2 | 1.000× | As buying crosses active ranges, OMR converts into Ether. |
| M04-L05 | 00:20.080–00:23.774 | v0 | 1.000× | Crossing a range isn’t final. Inventory can still convert back. |
| M04-L06 | 00:25.082–00:29.867 | v0 | 1.010× | Finalization removes eligible positions and separates returned principal from fees. |
| M04-L07 | 00:30.126–00:34.636 | v0 | 1.000× | Deployment consumes finite capacity. Deposits and withdrawals don’t reset it. |
| M04-L08 | 00:35.080–00:39.726 | v0 | 1.000× | Historical pool readings inform decisions. They aren’t an external price oracle. |
| M04-L09 | 00:40.078–00:44.459 | v0 | 1.000× | Stress gates and cooldowns restrain deployment. Every response has limits. |
| M04-L10 | 00:45.080–00:49.252 | v0 | 1.000× | Surge fees, bond proceeds and an arbitrage share fund the War Chest. |
| M04-L11 | 00:51.079–00:54.890 | v0 | 1.000× | Spaced healthy observations can unlock a bounded, funded refill. |
| M04-L12 | 00:57.080–01:00.928 | v0 | 1.000× | Only real idle assets move. Lifetime limits stay consumed. |
| M04-L13 | 01:02.080–01:06.348 | v0 | 1.000× | A price recovery creates no Ether. There is no guaranteed floor. |
| M04-L14 | 01:07.080–01:11.373 | v0 | 1.000× | Canonical sells pay nine percent, split across four recipients. |
| M04-L15 | 01:13.080–01:16.881 | v0 | 1.000× | Three percent funds Core. Additional sell pressure funds stability. |
| M04-L16 | 01:18.080–01:21.400 | v0 | 1.000× | A fee receipt can contain Ether or OMR. |
| M04-L17 | 01:22.080–01:26.208 | v0 | 1.000× | Opening buys have temporary rules. Later buys have no Hook tax. |
| M04-L18 | 01:27.080–01:30.372 | v0 | 1.000× | These rules cover the canonical pool, not every trading venue. |
| M04-L19 | 01:31.080–01:36.171 | v0 | 1.000× | Bonds reserve existing OMR upfront, then release it through linear vesting. |
| M04-L20 | 01:37.080–01:41.512 | v0 | 1.000× | No minting or sellback. Vested claims survive a purchasing pause. |
| M04-L21 | 01:42.078–01:46.507 | v0 | 1.000× | Solvers commit a plan, then execute a funded, two-pool arbitrage cycle. |
| M04-L22 | 01:48.080–01:52.307 | v0 | 1.000× | Actual profit is checked. Competition and failed gas remain your risk. |
| M04-L23 | 01:53.080–01:58.870 | v0 | 1.014× | Players commit canonical position NFTs. Rewards require qualifying, fresh depth samples. |
| M04-L24 | 01:59.080–02:03.658 | v0 | 1.000× | Rewards draw from funded campaigns. Mature positions can exit independently. |
| M04-L25 | 02:04.080–02:08.155 | v0 | 1.000× | Families contest seasonal price slabs and future funded fee credits. |
| M04-L26 | 02:09.084–02:13.455 | v2 | 1.000× | Syndicates split fee rights. Status bonuses don’t multiply money. |
| M04-L27 | 02:14.080–02:19.091 | v0 | 1.000× | Before control changes, an onchain checkpoint assigns the fees already earned. |
| M04-L28 | 02:20.080–02:24.028 | v0 | 1.000× | Sieges freeze participant wallets and allocate only funded escrow. |
| M04-L29 | 02:25.079–02:29.164 | v0 | 1.000× | At season exit, fees settle and protocol principal returns for retirement. |
| M04-L30 | 02:31.078–02:35.202 | v2 | 1.000× | The Safe binds and funds systems. Keepers simulate budgeted execution. |
| M04-L31 | 02:36.280–02:41.867 | v0 | 1.032× | Game cash, OMR, Ether and RWA allocations remain separate. |
| M04-L32 | 02:42.080–02:47.211 | v0 | 1.000× | Trades change inventory. Funded revenue supports reserves. Conditions gate the next move. |
| M04-L33 | 02:48.080–02:51.604 | v0 | 1.000× | OMERTÀ Market V2. Learn what moves the city. |

## Score

Mechanical noir: E/D/C/B low harmony, felt plucks, sparse relay clicks and muted rotating machinery; a new five-step motif over ten-quarter harmonic phrases.

Tempo: 96 BPM. q = 0.625000s. n in the following formulas is a nonnegative integer. Rhythmic events stop before 02:47.500.

Harmonic phrases start at −0.900 + 10nq and last 10q+1.800s. Negative preroll is cropped at delivery start. Phrases cycle through E, D, C, B roots, overlapping by 1.800s. Actual oscillator frequencies are recorded in audio-report.json.

Relay clicks: 4nq and (4n+3)q, each 0.055s. Rotor pulses: 4nq+0.030, each 1.100s. Felt notes: 2nq+q/2, each 1.450s, following the five-step motif. Act II adds a 0.400s spring accent at (8n+5)q. Act III adds a 2.100s upper felt note at (8n+6)q+q/3.

- Act 1: 00:00.000–00:55.440; rhythmic gain 0.72.

- Act 2: 00:55.440–02:00.960; rhythmic gain 0.95.

- Act 3: 02:00.960–02:48.000; rhythmic gain 0.83.

The final brand impact begins 02:48.000. E/B harmony begins 02:48.100 and continues to the end. Score and room fade over 02:52.520–02:53.000.

## Intentional silence

Instrumental silence covers music, room and effects. Narration stays complete. Source effects scheduled inside these windows are muted.

- M04-B07, 00:30.000: Finite inventory / funding boundary.

- M04-B11, 00:51.000: Recovery / reconciliation boundary.

- 00:29.620–00:30.480: verified exact instrumental silence.

- 00:50.620–00:51.480: verified exact instrumental silence.

- 02:47.640–02:48.000: verified exact instrumental silence.

## Exact effects

Scope transitions use a short impact/chirp; spins use a traveling sweep plus impact; snaps use a relay click. No licensed meme clips or game sound samples are used.

| Time | Effect | Duration | Stereo pan | Pre-master gain |
|---|---|---|---|---|
| 00:00.000 | whoosh | 0.290s | -0.18 → 0.18 | 0.093 |
| 00:00.000 | impact | 0.340s | 0 → 0 | 0.23 |
| 00:00.030 | marker | 0.085s | 0 → 0 | 0.038 |
| 00:20.000 | relay | 0.075s | 0 → 0 | 0.063 |
| 00:29.780 | whoosh | 0.460s | -0.8 → 0.8 | 0.16 |
| 00:30.025 | impact | 0.460s | 0 → 0 | 0.19 |
| 00:30.060 | marker | 0.085s | 0 → 0 | 0.043 |
| 00:40.000 | relay | 0.075s | 0 → 0 | 0.063 |
| 00:44.860 | whoosh | 0.290s | -0.18 → 0.18 | 0.093 |
| 00:45.000 | impact | 0.340s | 0 → 0 | 0.125 |
| 00:45.030 | marker | 0.085s | 0 → 0 | 0.038 |
| 01:01.780 | whoosh | 0.460s | -0.8 → 0.8 | 0.16 |
| 01:02.025 | impact | 0.460s | 0 → 0 | 0.19 |
| 01:02.060 | marker | 0.085s | 0 → 0 | 0.043 |
| 01:22.000 | relay | 0.075s | 0 → 0 | 0.063 |
| 01:30.860 | whoosh | 0.290s | -0.18 → 0.18 | 0.093 |
| 01:31.000 | impact | 0.340s | 0 → 0 | 0.125 |
| 01:31.030 | marker | 0.085s | 0 → 0 | 0.038 |
| 01:42.000 | relay | 0.075s | 0 → 0 | 0.063 |
| 02:04.000 | relay | 0.075s | 0 → 0 | 0.063 |
| 02:08.780 | whoosh | 0.460s | -0.8 → 0.8 | 0.16 |
| 02:09.025 | impact | 0.460s | 0 → 0 | 0.19 |
| 02:09.060 | marker | 0.085s | 0 → 0 | 0.043 |
| 02:13.860 | whoosh | 0.290s | -0.18 → 0.18 | 0.093 |
| 02:14.000 | impact | 0.340s | 0 → 0 | 0.125 |
| 02:14.030 | marker | 0.085s | 0 → 0 | 0.038 |
| 02:25.000 | relay | 0.075s | 0 → 0 | 0.063 |
| 02:48.000 | brand | 2.250s | 0 → 0 | 0.23 |

## Files

- public/art/market-v2-film/audio/04-mix.wav

- public/art/market-v2-film/audio/04-dialogue.wav

- public/art/market-v2-film/audio/04-music.wav

- public/art/market-v2-film/audio/04-sfx.wav

- public/art/market-v2-film/audio/04-room.wav

- public/art/market-v2-film/audio/audio-report.json

- public/art/market-v2-film/audio/04-captions.json
