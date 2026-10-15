# Gameplay, world and agents: factual production notes

Reviewed 2026-09-29 against main **3280817300cdcff3301745b1fce0bac9fe290129**. Detailed claim IDs, boundaries and exact links are in [claims-gameplay.json](claims-gameplay.json). This shard is source review, not deployment verification or a fresh test run. No claim is marked LIVE.

## Status that changes the film

**GP33 — UNVERIFIED availability.** The latest readiness engineering retains unmet qualification proof and authorizes no cohort admission. The old RC1 blocked decision is historical; the newer work also does not clear release. [Current qualification boundary](https://github.com/OmertaDev/Omerta/blob/3280817300cdcff3301745b1fce0bac9fe290129/docs/release/readiness-work/README.md#L55-L91). The film may show an implemented development build. Default-off world scenes require a visible development/pilot label; passing tests cannot support “available now.”

**GP29 — UNVERIFIED Consigliere integration.** The current local dirty branch contains a scoped adviser/proposal prototype. It is absent from canonical main. Native Muse support and integration with latest campaigns are unverified. Do not stage an AI transcript against latest-main game state and call it a working integration. Separately, the main game has a player-to-player dynasty Consigliere office; that name does not prove an AI adviser.

**GP27–28 — IMPLEMENTED agents.** Agent Turn and the MCP/API interface are real source features. The owner-operated Agent Alpha runner is finite, allowlisted and excludes PvP, borrowing, wallet/mint/withdrawal and arbitrary mutations. Agent Turn’s exploration advice is read-only; World Graph/authoring discovery does not authorize autonomous execution. Do not say every agent move needs a manual click: bounded routine automation exists. [Actual boundary](https://github.com/OmertaDev/Omerta/blob/3280817300cdcff3301745b1fce0bac9fe290129/AGENTS.md#L197-L244).

## Player truth to prioritize

**GP02–03:** Begin at the Docks with a small game-cash balance and no reputation. Jobs, training, bank use and income sources form the first loop. Resources, jail and heat make choices consequential. Bank transit and death rules prevent an “everything banked is safe” claim. [First loop](https://github.com/OmertaDev/Omerta/blob/3280817300cdcff3301745b1fce0bac9fe290129/docs/WIKI.md#L38-L110).

**GP04–05:** Six exact Path names, with scoped strengths and drawbacks:

| Path | Supported edge | Supported tradeoff |
|---|---|---|
| The Gun | Street combat and contracts | Worse goods sales |
| The Ledger | Front/racket income and trade | Weaker street combat |
| The Kitchen | Cook quality and lower dealing heat | Longer jail |
| The Wheel | Faster convoys | Slower cooking |
| The Shadow | Faster searches | Weaker duels/bouts |
| The Ring | Stronger duels/bouts | More expensive healing |

[Catalog](https://github.com/OmertaDev/Omerta/blob/3280817300cdcff3301745b1fce0bac9fe290129/data/rules.js#L424-L430) and [executable modifiers](https://github.com/OmertaDev/Omerta/blob/3280817300cdcff3301745b1fce0bac9fe290129/src/rules.tail.js#L5033-L5064). Paths are level/cost gated, not a free opening class selection.

**GP06–11:** Six districts have distinct advantages. Fronts have upkeep and exposure; Kitchen production has clocks and risk. Cars may be repaired/fenced/melted; material salvage is a separate World Graph action. Boats run vulnerable voyages. Player goods markets preserve district pickup and trunk constraints. Secondary loops include races, fights, stables, casino/card games, fixers, skills, law and prison. These provide depth, not a reason to recite a feature list. [Market/logistics](https://github.com/OmertaDev/Omerta/blob/3280817300cdcff3301745b1fce0bac9fe290129/docs/WIKI.md#L1911-L1964).

**GP12–18:** Persistent Crew, ad-hoc heist group, Kitchen hired crew and Family are different. A persistent Crew is a small account-bound mutual-aid group without a shared treasury or turf. Families have hierarchy, treasury, wars and territory; Commission seats support bounded rule votes. [Crew authority](https://github.com/OmertaDev/Omerta/blob/3280817300cdcff3301745b1fce0bac9fe290129/src/crew.js#L1-L23), [Family/territory](https://github.com/OmertaDev/Omerta/blob/3280817300cdcff3301745b1fce0bac9fe290129/docs/WIKI.md#L599-L674), [Commission](https://github.com/OmertaDev/Omerta/blob/3280817300cdcff3301745b1fce0bac9fe290129/docs/WIKI.md#L678-L689).

## Connected examples safe to dramatize

1. **Ordinary first action (GP02–03):** new Docks character → available job with visible cost → actual result → decision to train or bank. Capture the result; do not script guaranteed success. No gated world completion is required.
2. **Trust in a heist (GP14–15):** leader stakes → specialists fill seats → execution → shared result. A real informing option can blow the job; the public result says somebody talked and does not identify whom. All participants, including the informer, receive jail in that branch. [Authoritative informing/privacy behavior](https://github.com/OmertaDev/Omerta/blob/3280817300cdcff3301745b1fce0bac9fe290129/src/heists.js#L182-L195), [resolution](https://github.com/OmertaDev/Omerta/blob/3280817300cdcff3301745b1fce0bac9fe290129/src/heists.js#L300-L322). No “AI finds the rat” claim.
3. **Preparation becomes a world consequence (GP19–23):** approved development pilot: acquire eligible asset → salvage → discover permitted information → craft → each participant contributes → leadership approves → defined executor resolves → authorized world/history view shows consequence. Keep puzzle solutions and exact hidden prerequisites out of the film. The four-seat Foundry example is specific, not universal. [Pilot and authority](https://github.com/OmertaDev/Omerta/blob/3280817300cdcff3301745b1fce0bac9fe290129/docs/core-architecture/IMPLEMENTATION.md#L78-L90).
4. **Consequences create context (GP24–26):** approved development pilot: actual route outcome → eligible market infrastructure → exposure → investigation. Director selects authored situations from state; it does not mint money or evidence. The Informant can establish disclosure without proving betrayal. Do not turn every ending into another opportunity. [Network boundaries](https://github.com/OmertaDev/Omerta/blob/3280817300cdcff3301745b1fce0bac9fe290129/docs/living-world-director/WORLD-CAMPAIGN-NETWORK.md#L7-L37).

## Legacy and extraction

### Root capture scenario check

Nico Vale's fresh start, explicit composite time jump, later Wheel choice, and Mara Serrano's Gun choice fit GP02–05 if actual server gates pass. **The Payroll Office** is the exact two-seat job: muscle and wheelman, with a 10,000 gameplay-cash stake and level gate ([catalog](https://github.com/OmertaDev/Omerta/blob/3280817300cdcff3301745b1fce0bac9fe290129/src/rules.tail.js#L1935)). Path names do not directly grant invented heist bonuses; actual role stats govern. Relay Nine making one issued crime action proves a deterministic automated client, not LLM reasoning or a deployed Consigliere. Keep the ordinary persistent Crew separate from the heist group. An informing action filmed from Mara's own account is her private POV, not knowledge Nico's board reveals. These are pre-capture checks, not assertions that filming has succeeded.

**GP30–31 — IMPLEMENTED:** characters die; accounts and specified legacy survive. Many street assets, cash and abilities are lost; an heir does not inherit every permission or previous mystery run. Seasons reset specified progression while retaining designated account/Family records. Avoid both “everything resets” and “nothing resets.” [Estate/season rules](https://github.com/OmertaDev/Omerta/blob/3280817300cdcff3301745b1fce0bac9fe290129/docs/WIKI.md#L84-L110), [Family season](https://github.com/OmertaDev/Omerta/blob/3280817300cdcff3301745b1fce0bac9fe290129/docs/WIKI.md#L647-L655).

**GP32 — IMPLEMENTED rail, activation UNVERIFIED:** docs instruct treating production extraction as dormant until separately verified. Eligible exported assets become inert in gameplay; not every World Graph item is exportable. Wallet linking/minting are prerequisites, not activation evidence. If shown, use an inactive design preview, not a fabricated successful transaction. [Availability boundary](https://github.com/OmertaDev/Omerta/blob/3280817300cdcff3301745b1fce0bac9fe290129/AGENTS.md#L438-L458).

## Filming blockers

- Runtime availability for the intended audience remains separate from this audit.
- Actual UI must be captured from a pinned disposable build using authorized actors; overlay no fake native command, model answer or public secret.
- World Graph, Knowledge, Family operations, core progression and Director use explicit flags/cohort gates. Preserve current authority and active content configuration in capture notes.
- There are real retained test results, but this audit reran no tests.
- Local-only adviser source: `docs/agent-gateway-capabilities.md:11–31,48–52`, `docs/agent-gateway-muse.md:101–125`; these are not part of the pinned main.
