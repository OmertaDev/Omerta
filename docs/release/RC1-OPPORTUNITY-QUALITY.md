# RC1 opportunity quality evidence

Internal audit of base revision `cf661c399d02290dd1bb4b031c87a9235a65371f` plus the tracked changes present at invocation (exact file hashes in the raw evidence's `sourceOverlay`), using native PostgreSQL projections and an executed Shipment → Market → Informant path. This includes the release patch's clearer consequence copy. Scores are stored only in release evidence and never influence authorization or Director selection.

## Rubric

Scores describe observed evidence, not human enjoyment. **0** means the sampled path visibly lacks the criterion; **1** means explicit authored/projected support; **2** means a native end-to-end demonstration. **NOT_MEASURED** means no adequate observation. Clarity cannot score 2 without a timed unfamiliar-player session. Branch diversity cannot score 2 without executing alternate branches. Repetition requires longitudinal sampling, so remains NOT_MEASURED.

- Clarity: a card supplies an action, description, reason it is known and specific stakes. Generic readiness prose does not answer why the work matters.
- Preparation: requirements are projected; score 2 requires actual acquisition, crafting, commitments and readiness in the sampled operation. This measures demonstrated preparation, not its subjective depth.
- Coordination: helper/participant needs are projected; score 2 requires two actors' real role commitments.
- World relevance: the opportunity names world business; score 2 requires canonical world changes in returned command feedback.
- Consequence visibility: feedback contains a world change; score 2 also requires the exact canonical event ID in the authorized follow-up projection. It does not prove comprehension.
- Follow-up: score 2 requires a newly selected campaign after the committed outcome. Score 0 means the sampled terminal path selected no new campaign; it does not mean all gameplay is exhausted.

| Campaign | Clarity | Preparation | Coordination | World relevance | Consequence visibility | Branch diversity | Follow-up | Repetition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dock War | 0 | 1 | 1 | 1 | NOT_MEASURED | 1 | NOT_MEASURED | NOT_MEASURED |
| Missing Shipment | 1 | 2 | 2 | 2 | 2 | 1 | 2 | NOT_MEASURED |
| Black Market | 1 | 2 | 2 | 2 | 2 | 1 | 2 | NOT_MEASURED |
| Informant | 1 | 2 | 2 | 2 | 2 | 1 | 0 | NOT_MEASURED |

## Concrete projection findings

| Sample | Cards | Available | Generic-stakes cards | Duplicate-label groups |
| --- | ---: | ---: | ---: | ---: |
| new_player | 11 | 9 | 11 | 0 |
| dock_war_opening | 35 | 29 | 34 | 0 |
| shipment_rival | 40 | 32 | 35 | 0 |
| intercept_shipment_prepared | 63 | 41 | 41 | 4 |
| intercept_shipment_after | 38 | 31 | 36 | 0 |
| black_market_opening | 38 | 31 | 36 | 0 |
| establish_market_prepared | 52 | 37 | 36 | 0 |
| establish_market_after | 40 | 30 | 39 | 0 |
| expose_market_prepared | 58 | 40 | 39 | 0 |
| expose_market_after | 42 | 33 | 38 | 0 |
| informant_before_corroboration | 42 | 33 | 38 | 0 |
| informant_after_corroboration | 50 | 40 | 43 | 0 |
| trace_disclosure_prepared | 67 | 47 | 43 | 0 |
| trace_disclosure_after | 41 | 34 | 40 | 0 |

The table counts the actual complete authorized board, not only its featured campaign cards. Duplicate labels can describe separate legitimate commands; this is a readability finding, not an authorization defect. All sampled routine cards correctly omit command-receipt expiration as a gameplay deadline.

## Remaining evidence

- Observe an unfamiliar player's first 30 minutes to validate understanding, practical preparation paths, and card density.
- Execute all alternate branches and representative generated situations before treating diversity or sustained follow-up as established.
- Inspect the no-new-campaign terminal Informant path alongside existing visible work; do not infer an engine dead end from a settled local story.
- Classify any selection or presentation change as P1 only after a reproducible severe UX or campaign failure. These scores alone do not justify architectural or economic changes.

Reproduce: `node tools/rc1-sim-quality.js --postgres` with the same isolated local `COORDINATION_TEST_DATABASE_URL` used by the simulation. Raw authored choices, cards, canonical feedback and post-command projections: [projection-samples.json](evidence/simulation/quality/projection-samples.json).

OPPORTUNITY_QUALITY_GATE=INCOMPLETE
