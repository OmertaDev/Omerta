# Quest quality author contract

Quality metadata belongs on the runtime entry mystery's `payload.quality`. Existing packs without
it retain their established behavior. `validateQuestQuality(bundle)` returns `{errors,warnings}`;
`assertQuestQuality(bundle)` rejects errors and returns the same diagnostics. Call these after
the ordinary compiler has validated the runtime graph. No helper grants rewards or changes state.

Version 1 requires `version:1`, a nonempty `question`, at least one
`assumptions:[{id,text}]`, and at least one `clauses:[{id,text,evidenceNodeId}]`.
All evidence references name profiled `evidence` nodes. Identifiers use lowercase letters,
digits, dots, underscores and hyphens, start with a letter or digit, and contain at most
160 characters. Text is nonempty and at most 4096 characters. Objects are closed data records.
The quality document is limited to 128 KiB, 512 profile nodes and 4096 graph edges.

Optional closed fields:

| Field | Shape and meaning |
|---|---|
| `identity` | `{activity,emotionalTurn}`; player-facing descriptions, without hidden plot facts. |
| `motives` | Up to 16 `{id,label,description?}` player choices. |
| `questions` | Up to 64 `{id,text,nodeId}`; shown only when that node is visible and its spoiler prerequisites are met. |
| `npcs` | Up to 16 `{id,label,knowledge?,beliefs?,conceals?,principles?,voice?}`. Knowledge and beliefs contain up to 64 `{evidenceNodeId,sourceNodeId}` entries each. Conceals lists known evidence IDs. Principles (up to eight strings) and voice are public. |
| `revelations` | Up to 64 `{nodeId,npcId,evidenceIds,requiresEvidenceIds}`. The action produces `evidenceIds`; `requiresEvidenceIds` are prior facts that the NPC must know. |
| `promises` | Up to 32 `{id,setupNodeId,payoffNodeIds}`. At least one profiled payoff must follow the setup through the graph. |
| `branches` | Up to 32 `{choiceNodeId,reconvergeNodeId,maxActions}`. Every declared route must reach its join without an earlier terminal escape. |
| `budget` | `{maxActions,maxNewConcepts,maxReadingWords}`; positive integer limits of 128, 128 and 20000 respectively. |
| `spoilers` | Up to 64 `{nodeId,requiresNodeIds}` with at least one prerequisite. Self-prerequisites are invalid. |
| `pacing` | `{pressureNodeIds,safeNodeIds,maxConsecutivePressure}`; unique disjoint profiled IDs and a limit from 1 to 16. |
| `procedures` | Up to 16 `{id,nodeId,learnNodeId,masteryFlag,skipOptionId,learnOptionId}`. The first node is a choice; `learnNodeId` is a puzzle reached by the learn option. The distinct skip option must retain a terminal path without that puzzle. Flags require the `quest.procedure.` prefix. |
| `spotlights` | Up to 64 `{nodeId,roleId}`. Each action has at most one suggested actual party role. This declaration conveys no exclusive turn or authority. |
| `fieldworkAssignments` | Up to 16 `{id,title,questions,methods,outcomes}`. Questions and methods each contain 1–8 `{id,label}` entries. Every question/method pair has exactly one outcome `{questionId,methodId,report,evidenceNodeIds}`. At least one outcome produces evidence. |
| `disclosures` | Up to 64 `{evidenceId,recipients}`. Each unique evidence item has 1–16 unique recipients `{npcId,label,report,revealNodeIds}`. Targets must be profiled evidence justified by that NPC's knowledge. |

NPC knowledge sourced at the entry is initial knowledge. Other sources must be guaranteed to
complete before a revelation or its disclosure input through the graph or a `completed_node`
gate. An action cannot justify its own revelation. Beliefs may support testimony; they cannot
justify confirmed evidence. Runtime callers must additionally enforce current NPC knowledge,
ownership of disclosed evidence and all normal membership/role permissions.

`qualityNpcKnowledge(design,npcId,completedSet,disclosedSet)` returns a new `Set` of known evidence
IDs. The two sets must come from authoritative server state. Beliefs are not silently promoted
to knowledge. `qualitySpoilerAllows(design,nodeId,visibleSet)` checks declared reveal prerequisites.

Structural errors, illegal references, unjustified revelations, invalid procedure routes, missing
fieldwork combinations and broken reconvergence reject the pack. Exceeding action, concept,
reading or pressure budgets produces warnings. The reading check conservatively counts the
authored public text envelope, including alternate branches. Concept count uses declared
assumptions. Unproven graph ordering for spoilers also warns; runtime disclosure checks remain
necessary. These diagnostics do not establish that prose is fair, accessible, enjoyable or spoiler-free.

## Multiple sufficient proofs

The private answer spec uses:

```json
{"verifier":"proof_sets","proofs":[
  {"conclusionId":"forgery","evidenceIds":["receipt","clock"]},
  {"conclusionId":"forgery","evidenceIds":["witness","ink"]}
]}
```

There are 1–32 unique proofs. Evidence IDs identify public interaction items, not arbitrary world
facts. Each proof contains 1–64 unique IDs. Different valid arguments may support the same conclusion.
The public interaction is `{kind:"deduction",items,conclusions}`. Items are
`{id,label,description?,evidenceNodeId}` with unique linked evidence nodes; conclusions are
`{id,label,description?}`. Both arrays contain 1–64 unique IDs. All solution references must match
these declared public candidates. No slots or private proof fields belong in this interaction.

The client submits only `{conclusionId,evidenceIds}`. Call
`verifyNarrativeSubmission(spec,interaction,submission,{knownEvidenceNodeIds:Set})` with the
server's completed evidence nodes. Missing context, unknown IDs, duplicate citations and
undiscovered evidence produce `{valid:false}`. A well-formed submission matches when it contains
exactly one authored sufficient evidence set, in any order, for the chosen conclusion. Selecting
all evidence does not bypass the proof. Larger legitimate arguments need their own authored set.
An unmatched argument reveals no expected member IDs. The three legacy verifier paths are unchanged.

## Public projection

`projectQuestQuality(design,visibleSet)` explicitly selects public question, assumptions, visible
clauses/questions, motives, identity, NPC labels/principles/voice, fieldwork question/method menus,
and disclosure recipient labels for known evidence. It never projects answer proofs, NPC knowledge,
beliefs or concealed facts, fieldwork outcomes, disclosure reports/grants, future payoff/branch
references or procedure mastery flags. Referenced clauses also respect spoiler prerequisites.
The caller must use actually revealed evidence, not merely unlocked action IDs, as visible evidence.

Runtime code must filter proof items to authorized evidence and enforce eligibility again on
submission. Procedure mastery is earned only by a matched successful `learnNodeId` puzzle;
selecting the learn label does not establish mastery. Fieldwork/disclosure grants require actual
server operations; author declarations and spotlights alone cannot complete evidence or authorize a turn.

Validation: `node test/quest-quality-rules.js` exercises alternate proofs, undiscovered evidence,
select-all refusal, malformed inputs, legacy compatibility, NPC causality, shortcut routes,
fieldwork coverage, warnings, and private-data projection boundaries.
