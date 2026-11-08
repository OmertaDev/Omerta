# Quest quality release review

Scope: the fifty improvements in [the dependency graph](quest-quality-workgraph.json), ten authored cases, player controls, author tools, and the authenticated quality mutation. Reviewed application source: `488d21f3e22a7f9e75bd997025d355a116acb13c`, including the website integration from `7c63a604dc0d2b8a39bc9eb845c4dcb97aa707e9`. Source-only comparison and native-admission metadata are separate from application execution evidence. Production deployment requires the full current [PR #322 checks](https://github.com/OmertaDev/Omerta/pull/322/checks).

## Authority and invariants

- Accounts, membership, roles, scope and issued actions come from the server. A delegation narrows existing authority and requires current participants' acknowledgement.
- Private drafts, motives, study responses and unopened debriefs remain account-specific. Private saves use a separate revision and do not change public progress, attempts, suspicion or NPC knowledge.
- Disclosures accept known evidence and declared recipients. Fieldwork accepts bounded authored questions/methods. NPC knowledge and evidence provenance are validated before revelation.
- New proofs cite only revealed evidence and match an authored sufficient set exactly. Selecting every item cannot substitute for a proof.
- Old versions remain immutable. There are no new tables, currencies, economic rewards, contract changes, signers or external adapters in this scope.

## Findings and retests

| ID | Finding | Correction and executed regression |
|---|---|---|
| QQUAL-R1 | Question search bypassed spoiler prerequisites. | Filter questions/current question by completed, visible prerequisites; pure projection and actual browser checks. |
| QQUAL-R2 | Ordinary spoiler-marked evidence could remain hidden until the debrief and become unusable. | Separate prerequisite revelation from individual finale withholding; actual clue/proof completion regression. |
| QQUAL-R3 | Author/public clause bounds disagreed. | Align the 128-clause public contract; author refusal and typed response checks. |
| QQUAL-R4 | Legal fieldwork/disclosure combinations could exceed executable report bounds. | Validate aggregate limits and align participant/evidence/delegation bounds; author refusal tests. |
| QQUAL-R5 | An inherited object key could be mistaken for an existing mandate. | Require own dictionary entries and use safe computed-key writes; actual runtime refusals for inherited and unknown keys. |
| QQUAL-R6 | A proof verifier selected by a variant could miss its known-evidence context. | Resolve the issued variant's verifier before authority checks; a full variant playthrough without quality metadata completes. |
| QQUAL-U1 | A mandate picker could change after its intent was reviewed. | Capture an immutable payload and invalidate changed previews; real browser verifies no POST until re-review. |
| QQUAL-U2 | A slow save could discard newer local draft/impression edits. | Preserve newer text and update its saved baseline; paused actual requests, full repaint, focus and undo regressions. |
| QQUAL-A1 | Schema branch validation could strip another operation's valid fields. | One closed top-level object with discriminated operation constraints; actual HTTP save and strict type/extra-field regressions. |
| QQUAL-A2 | Spoiler audit ignored ordinary answer verifiers. | Inspect all five verifiers and variants; valid ordinary/text-answer counterexamples now produce review findings. |
| QQUAL-I1 | Website integration disabled private editors during a save. | Keep private editors editable while locking issued actions; both old and new production-shell browser suites pass. |

The study export/report round trip is also covered. No unresolved high or critical issue was identified in this scoped review.

## Executed evidence and limits

The graph retains evaluator hashes, actual input hashes, exit codes and execution log paths for all fifty implementations. The earlier forty-feature graph retains both branches' historical attempts and fresh combined-source executions. Checks include authored runtime paths, alternate proofs and lead orders, adversarial motivations, strict HTTP bodies, privacy/spoiler boundaries, author refusals, actual desktop/390px browser behavior, and legacy compatibility.

Native PostgreSQL 18.4 tests use distinct backend connections for competing private saves, different actors' private writes, public mandate races, voluntary seat release and consented replacement. They assert no economic transactions. A deterministic stateful run (`0x50cafe`) exercises 1,200 transitions: 285 accepted private transitions and 915 refusals, preserving private/public isolation and refusal atomicity. Syntax checks and focused peer review cover the changed JavaScript; browser XSS regressions verify text-only rendering. Solidity fuzzing is outside this unchanged contract scope; broader repository gates remain mandatory.

Spoiler analysis is a lexical review aid, and pacing estimates are static estimates. They do not establish narrative quality, player understanding, enjoyment or human safety. Opt-in comprehension and server-enforced 24-hour recall capture are implemented and tested, but human study results await the user-arranged testers. Automated sessions are labelled separately, and self-reported human status is not identity verification.

## Deployment condition

Merge/deploy only the commit that passes the complete repository checks. Verify the exact API and worker deploys in **My Workspace**, check live asset bytes before activating the ten pinned bundles, then run the named synthetic-account smoke check and production invariants with alerts disabled. Activation, deployment and human research results are separate evidence; none is inferred from source comparison metadata.
