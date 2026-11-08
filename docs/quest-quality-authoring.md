# Quest quality authoring

The pilot is [Three Witnesses version 2](../content/packs/quest-three-witnesses-v2/pack.json).
The [version 1 source](../content/packs/quest-three-witnesses/pack.json) remains unchanged.
Nine independently activatable experimental cases accompany the pilot. These are authored
source candidates; activation and player comprehension remain separate decisions.

| Pack | Signature activity | Consequential work |
| --- | --- | --- |
| `quest-three-witnesses-v2` | Independent person/object proof chains | Challenge the employer or file a bounded finding; optional witness correction and red-herring closure |
| `quest-quality-open-office` | Separate a known illegal operation from legitimate wages | Choose an auditor or the clerks' own account while the antagonist keeps the same stated principle |
| `quest-quality-payday` | Repair a payroll boundary and run three test cases | Cover every shift exactly once without inventing a thief |
| `quest-quality-truce` | Test fictional clauses against mixed cargo and exceptions | Adopt a recorded emergency rule or openly retain the narrower agreement |
| `quest-quality-night-edition` | Complete one legitimate newspaper shift | Publish a precise correction, choose a useful notice and handle an unverified interruption |
| `quest-quality-field-notes` | Commission bounded fieldwork and route known evidence | Inspect method limitations, then explicitly disclose the registry and quay findings to appropriate recipients |
| `quest-quality-favors` | Follow fictional promises and a conditional guarantee | Resolve one underlying obligation and separately retain or mutually release another |
| `quest-quality-shared-meaning` | Translate institutional shorthand through counterexamples | Establish both independent conditions instead of treating an ambiguous word as universal permission |
| `quest-quality-last-ferry` | Turn player-only knowledge into a character observation | Preserve safety and choose a personal act of care within a fixed departure |
| `quest-quality-small-fire` | Combine public records, testimony and a stove inspection | Two consenting participants may volunteer across role spotlights, acknowledge decisions and challenge the employer |

## Studio commands

Run these from the repository root. Pack names resolve through the explicit quality inventory;
the same commands accept a regular JSON file up to 2 MiB.

```sh
node tools/quest-quality-studio.js validate --all
node tools/quest-quality-studio.js report quest-three-witnesses-v2
node tools/quest-quality-studio.js impact quest-three-witnesses-v2 door-image
node tools/quest-quality-studio.js impact quest-three-witnesses-v2 door-image --replace "The image no longer identifies Luca."
node tools/quest-quality-studio.js preview quest-three-witnesses-v2 --preset fresh
node tools/quest-quality-studio.js preview quest-three-witnesses-v2 --preset ready-to-file
node tools/quest-quality-studio.js scenarios quest-three-witnesses-v2
node tools/quest-quality-studio.js presets
node tools/quest-quality-studio.js preset clauses --out ./output/my-truce-draft.json
```

Preset creation refuses to overwrite an existing file. It creates an editable source draft
and performs no activation. Review its namespace and version before publication.

Preview accepts `fresh`, `first-fact`, and `ready-to-file` prior-state presets. A custom
`--state ./state.json` file can instead supply a closed object containing `completedNodeIds`,
`choices`, `masteredProcedures`, `roleId` and `disclosures`. Every node and option must exist;
disclosure presets require known evidence and a declared recipient. An example is:

```json
{
  "completedNodeIds": ["three-witnesses", "opening"],
  "choices": {},
  "masteredProcedures": ["quest.procedure.shared-clock"]
}
```

This is a hypothetical author state. The preview uses the real content compiler, quality
validator and shared quality projection, redacts answer specifications, and applies evidence,
role, NPC-disclosure and spoiler prerequisites. Blocked scenes are reported separately.
It grants no player progress, mastery, rewards or runtime authority.
The runtime test below exercises actual issued actions separately.

## Evidence and inference

Put quality metadata on the entry mystery's `payload.quality` only. Declare the central
`question`, explicit `assumptions`, exact `clauses` linked to evidence nodes, and a distinct
`identity.activity` and `identity.emotionalTurn`. A clause preserves its original negation,
quantifiers and conditions; the public view includes it only when its source is known.

A `proof_sets` answer specification contains independently sufficient sets:

```json
{
  "verifier": "proof_sets",
  "proofs": [
    {"conclusionId": "carrier", "evidenceIds": ["face", "book-record"]},
    {"conclusionId": "carrier", "evidenceIds": ["exchange", "exit", "pocket"]}
  ]
}
```

The puzzle exposes candidate conclusions and evidence selectors; each selector references
an actual evidence node. The server requires those evidence nodes to be revealed to the
actor. A submission must match one complete authored set; selecting every clue does not
automatically satisfy a proof. Keep the resolution available before optional leads finish
so sufficient reasoning can actually shorten the case.

Establish a source's expected completeness before treating an absent record as evidence.
Three Witnesses verifies the mandatory departure procedure and the complete interval list
before revealing the absent entry. Its conclusion remains narrower than a general alibi.

## NPCs, fieldwork and information

Declare an NPC's initial `knowledge`, attributed `beliefs`, concealed known facts, voice and
principles. Each knowledge row names an evidence node and the independent source node that
justifies it. Use the entry node for facts the NPC already knows; this does not make the
fact known to the investigator. A revelation names the NPC, produced evidence, and any
information the NPC must first receive. A sincerely mistaken account belongs in testimony.

Rosa's correction requires the investigator to acquire the face image and explicitly
disclose it to her. Her initial knowledge is her own visual limitation, not omniscient
knowledge of the corrected carrier.

Fieldwork declares a complete, bounded question-by-method outcome table. Every combination
has a report, including methods that cannot support the requested claim. Different tuples
can be commissioned, allowing a player to correct an unsuitable method. Identical tuples
are idempotent. Reports confer only declared evidence and no economic reward.

Operation-produced evidence is disconnected from automatic graph revelation. Field Notes
requires a registry report before its review and recipient responses before its final
routing decision. Disclosures whitelist recipients and expose only evidence already known
to the sender. Recipient policy knowledge stays distinct from the newly disclosed fact.

## Choices, procedures and cooperation

Give a challenged commission a real alternative action path. The pilot's authority inquiry
and bounded-account route contain different playable puzzles and retain distinct story
flags before reconverging. Motives describe the player's own purpose and carry no universal
morality score.

Declare each branch's join and action budget. The report lists actions before the join and
the retained story flag keys and values. A shared endpoint by itself does not demonstrate
that a choice matters.

Procedure shortcuts require a distinct `learnNodeId` puzzle with a successful submission.
Selecting the learn label does not establish mastery. The shared clock procedure appears
in both the pilot and Payday; the shortcut preserves the new deduction or repair afterward.

Small Fire uses public role spotlights rather than rigid role gates. Both participants can
volunteer for the public work, while consequential shared choices still require a current
delegate and acknowledgements. Its explicit role-replacement policy supports safe handoff.
Existing packs' private information and original role gates remain governed by those packs.

## Author reports and evidence limits

The studio reports reachable promise payoffs, branch budgets and retained consequences,
fact references and surviving alternative proofs, potentially revealing public titles,
rewards, markers or errors, and reading/reasoning/dialogue/procedure/travel counts.
Repeated identical instructions are flagged separately from declared quiet scenes.
Fact replacement previews preserve the source while identifying producing scenes, dialogue,
answer specifications and downstream nodes that need review. The tool traces declared
dependencies; the author must assess whether a proposed new proposition still supports them.

Spoiler matching is a lexical heuristic against accepted private conclusions. A clean
report does not establish that a title is semantically safe. Reading minutes are estimates,
not measured player pacing. Reports retain these labels and never invent tester responses.

```sh
node test/quest-quality-content.js
node test/quest-quality-studio.js
```

The first test plays all ten authored packs through the actual server runtime, including
both proof chains, early resolution, fieldwork, disclosure, adversarial motivations,
procedure mastery and cooperative acknowledgements. The second tests executable authoring
commands, invalid NPC knowledge and promises, impact reports, spoiler warnings and preview
boundaries. Their output is automated evidence. Opted-in comprehension and delayed recall
responses must come from actual participants through the study workflow.
