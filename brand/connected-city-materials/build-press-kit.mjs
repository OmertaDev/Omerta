import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const out=path.join(root,'press-kit');fs.mkdirSync(out,{recursive:true});
fs.copyFileSync(path.resolve(root,'../../public/icon-512.png'),path.join(out,'omerta-app-icon.png'));
const factSheet=`# Omertà — press fact sheet
Prepared 14 September 2026. Verify availability before publication.

## One sentence
Omertà connects a crime-game world with explicit rules for materials, shared evidence and a proposed canonical market.

## 50-word boilerplate
Omertà is a crime-game world built around connected systems. Its World Graph tracks materials and crafting; its Coordination Engine pilots shared investigations with independent evidence. The Market candidate defines canonical-market fees, finite reserves and family interests. Availability differs by system, with implementation and deployment status stated throughout this kit.

## Product facts
- Market: implementation candidate; not deployed or funded.
- Canonical pool base sell fee: 9% — developer 2%, RWA recipient 1.6%, community 2.4%, protocol liquidity 3%. Surge adds 0–1%; LP fees are additional. Independent pools have their own policies.
- Companion contracts cover finite reserves, inventory bonds, solver-funded arbitrage, Turf fee rights and liquidity commitments. These are candidate mechanisms, not statements of live availability or returns.
- World Graph Phase 1: implemented. Conserved materials, salvage, crafting, unique items, a mystery and a four-account Crew operation. Phase 2A in development. NFT export is not live.
- World Graph Phase 1 is OMR-neutral. Hardened steel crafting consumes $300 of game cash.
- Coordination Phases 00–01: implemented for review. Value-neutral, default-off API pilots. Private investigations, original discoveries, deliberate sharing and current access checks.
- Coordination does not yet supply a dedicated graphical console; later delegation and economic adapters are planned.

## Demonstration evidence
The narrated walkthrough uses actual local repository handlers and pg-mem with synthetic accounts. All 24 captured API responses returned HTTP 200. The demonstrated Split Ledger ended completed. It is an API demonstration, not a recording of a production graphical interface. Full responses are in ../walkthrough/evidence.json.

## Official links
- Website: https://www.omerta.fun
- Updates: https://x.com/OmertaOnRH
No press email or named spokesperson has been supplied.

## Source basis
- omerta-contracts/docs/market/DESIGN.md and RUNBOOK.md
- SPEC.md, World Graph Phase 1 / Phase 2A sections
- docs/coordination-engine/README.md
- Captured local API responses included in this package
Repository state may include working changes; this package is not a release attestation.
`;
const talkingPoints=`# Proposed founder talking points
Draft prompts and answers; these are not attributed quotations.

1. What connects the three systems?
   A common design principle: make dependencies explicit. Materials have inputs, evidence has origins, and the candidate market allocates fees according to defined rules.
2. What can you demonstrate today?
   The local API walkthrough shows salvage, crafting and an investigation completed through independent evidence sharing. Distinguish local implementation from public rollout.
3. Why does original evidence matter?
   Two copies of one discovery cannot become two independent sources. Sharing preserves provenance and access is checked when evidence is used.
4. How should people understand the Hook?
   Start with the canonical pool and its base sell fee, then explain finite reserves and companion contracts. State that Market is not deployed or funded.
5. What comes next?
   Discuss World Graph Phase 2A and later Coordination phases as development plans. Do not attach launch dates that have not been approved.

## Short FAQ
Is everything live? No. See the fact sheet for status by system.
Does the Coordination pilot pay rewards? No; the demonstrated pilot is value-neutral.
Can World Graph inventory be exported as NFTs? Not currently.
Do all pools use the canonical Hook rules? No. Independent pools have their own policies.
Are returns promised? This kit makes no return or price claims.
`;
const posts=`# Launch copy — ready for editorial review

## Campaign introduction
The city is connected. Follow the Hook, the World Graph and the Omertà Coordination Engine — with every system’s built / next status clearly marked. Explore: https://www.omerta.fun

## Hook teaser
Every cut has a job. Explore the Market candidate’s 9% base sell fee and four destinations. Surge and LP fees are additional. Candidate only: not deployed or funded.

## World Graph teaser
The wreck is a beginning. Salvage materials. Consume inputs. Craft the next object. World Graph Phase 1 is implemented; Phase 2A is in development. NFT export is not live.

## Coordination teaser
No one has the whole story. Two original sources. Deliberate sharing. One corroborated conclusion. Explore Omertà’s default-off, value-neutral Coordination API pilots.

## Walkthrough post
From a wreck to hardened steel. From two investigators to a completed ledger. Watch Omertà’s real local API handlers in action with synthetic demo accounts. Full demonstration evidence is included.

## Suggested sequence
1. Publish the landing page with the overview film after reviewing deployment status.
2. Introduce each system with its six-slide carousel.
3. Pair each carousel with the matching 15-second teaser.
4. Follow with the narrated API walkthrough and evidence.
5. Share the press kit with interested writers and partners.

Nothing has been posted or sent by this build.
`;
const credits=`# Assets and usage notes
- omerta-app-icon.png: existing project app icon, copied without alteration from public/icon-512.png.
- ../assets/{city,reserve,turf}.jpg and film background plates: generated with fal.ai for this campaign. Conceptual artwork, not gameplay screenshots.
- Carousels: original campaign diagrams; PNG export plus outlined editable SVG; alt text and post copy are included alongside them.
- Walkthrough: custom response presentation based on real local handlers. It is not a production UI screenshot. Synthetic accounts and local data only.
- Voice: fal.ai MiniMax speech-02-hd stock Deep_Voice_Man narration; no voice cloning.
- No third-party testimonials, endorsements or performance figures are included.
- Keep availability labels and fee qualifications when cropping or republishing.
- For legal rights beyond this project's use, consult the relevant asset/provider terms; no new license grant is asserted here.
`;
for(const [file,copy] of Object.entries({'fact-sheet.md':factSheet,'talking-points-and-faq.md':talkingPoints,'launch-copy.md':posts,'asset-notes.md':credits}))fs.writeFileSync(path.join(out,file),copy);
fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Omertà — press room</title><link rel="stylesheet" href="../style.css"><main class="shell" style="padding-block:60px"><a href="../index.html">← The connected city</a><p class="eyebrow" style="margin-top:65px">Press room / September 2026</p><h1 style="font-size:clamp(64px,10vw,130px)">The story.<br>The facts.</h1><p class="lead" style="max-width:800px">Omertà connects a crime-game world with explicit rules for materials, shared evidence and a proposed canonical market.</p><p class="status">Market candidate · World Graph Phase 1 implemented · Coordination API pilots default off</p><section class="extras"><a href="fact-sheet.md" download><span>Fact sheet & boilerplate</span><span>Product facts and availability ↓</span></a><a href="talking-points-and-faq.md" download><span>Founder talking points</span><span>Draft answers and FAQ ↓</span></a><a href="launch-copy.md" download><span>Launch copy</span><span>Campaign and teaser captions ↓</span></a><a href="asset-notes.md" download><span>Artwork & credits</span><span>Origin and usage notes ↓</span></a><a href="../walkthrough/evidence.json" download><span>Demonstration evidence</span><span>24 real local API responses ↓</span></a></section><section><p class="eyebrow">Visual assets</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:24px"><figure style="margin:0"><img src="omerta-app-icon.png" alt="Omertà app icon" style="width:100%;max-width:280px"><figcaption><a href="omerta-app-icon.png" download>Project app icon ↓</a></figcaption></figure>${['city','reserve','turf'].map(a=>`<figure style="margin:0"><img src="../assets/${a}.jpg" alt="Conceptual ${a} campaign artwork" style="width:100%;max-height:360px;object-fit:cover"><figcaption><a href="../assets/${a}.jpg" download>${a} artwork ↓</a></figcaption></figure>`).join('')}</div><p class="fine">Conceptual generated artwork. These images are not gameplay screenshots.</p></section><section class="extras"><a href="../carousels/hook.html">Hook carousel →</a><a href="../carousels/world-graph.html">World Graph carousel →</a><a href="../carousels/coordination.html">Coordination carousel →</a><a href="../teasers/index.html">Two teaser videos →</a><a href="../walkthrough/index.html">Narrated API walkthrough →</a></section><footer><p><a href="https://www.omerta.fun">Explore Omertà ↗</a> · <a href="https://x.com/OmertaOnRH">Official updates ↗</a></p><p class="fine">No press email or named spokesperson supplied. Proposed talking points are not attributed quotations.</p></footer></main></html>`);
console.log('Press kit complete');
