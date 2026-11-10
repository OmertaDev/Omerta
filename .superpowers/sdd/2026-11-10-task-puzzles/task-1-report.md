# Task 1: versioned generation and durable issuance

## Result and commits

Implemented on `codex/task-puzzles-20261110`, based on plan `d500f20ca` and origin/main `0a45705bb`.

Implementation commit: `858ff7bdd5791276287aa51feae99cd93131a7ee` (`feat: add versioned persistent task puzzle engine`). This report follows in its own documentation commit.

Owned files only: `src/task-puzzle-engine.js`, `src/task-puzzles.js`, `test/task-puzzle-engine.js`, `test/task-puzzles.js`, appended `schema.sql`, and this report. No deployment, push, merge, economics, job eligibility, reward, or account-cap changes.

## Interfaces

Engine exports:

- `TASK_PUZZLE_VERSION = 1`, `TASK_PUZZLE_KINDS = ['patrol','route','matching','evidence']`.
- `generateTaskPuzzle({seed,kind?})`: synchronous deterministic private puzzle. Seed must be a nonempty string of at most 512 characters. Exact top-level terms only. Private shape consists of the public engine fields below plus `answer` and `structuralSignature`; no seed is retained.
- `publicTaskPuzzle(privatePuzzle)`: detached, deep-copied whitelist of exactly `{version,kind,title,instructions,constraints,controls,hint}`. Unknown versions/kinds throw `TypeError`.
- `verifyTaskPuzzle(privatePuzzle,answer)`: synchronous boolean, strict answer shape with no surplus fields. Unsupported versions return false.

Service exports, all async:

- `issueTaskPuzzle(ch,{scope,targetId,contextKey},client)`: existing issuance or newly persisted public issuance. Same character and exact context never reroll, including after consumption.
- `readTaskPuzzle(ch,context,client)`: persisted public issuance or null. Does not issue or mutate.
- `consumeTaskPuzzle(ch,context,{id,answer},client)`: verify, mark consumed exactly once, and return completion feedback. Does not grant rewards or complete the job itself.

Public issued shape is exactly `{id,version,kind,title,instructions,constraints,controls,hint,status}`, where `id` is a server UUIDv4 and status is `issued` or `consumed`. A read after consumption retains every original field and changes only status. Exact examples are below.

Submission is exactly `{id,answer}`. Answer shapes:

- patrol: `{start:number}`, a safe integer start minute.
- route: `{path:string[]}`, every visited node ID in order, including start and finish.
- matching: `{pairs:Array<{left:string,right:string}>}`, exactly one pair per contact and parcel, with no duplicates. Pair array order is immaterial.
- evidence: `{suspect:string}`, one suspect ID.

Exact success feedback:

```json
{"id":"<issued UUID>","version":1,"kind":"<issued kind>","completed":true,"message":"Puzzle complete. The task can continue."}
```

Context must be derived by trusted adapters. It accepts exactly three fields: scope matches `[a-z][a-z0-9_-]{0,63}`; targetId is 1-128 printable non-space ASCII characters; contextKey is 1-256 such characters. No supplied character ID, completion flag, or arbitrary context fields are accepted.

## Authority and persistence contract

Issue and consume MUST use the same existing locked character transaction client as the authoritative job. The service deliberately does not open, commit, or roll back its own transaction. Adapters remain responsible for current occurrence derivation and all eligibility, cooldown, location, real-legwork, employment-delivery, reward and account-level checks. Verify and consume together with job changes, so a later failure rolls everything back.

The additive `task_puzzles` table stores a server UUID, monotonic `issue_order`, character/scope/target/context binding, version, kind, structural signature, private JSONB puzzle, issued time and nullable consumed time. The unique context binding is `(character_id,scope,target_id,context_key)`. Receipts are retained; current-context reads never search by arbitrary client IDs. Consumption also uses a conditional `consumed_at IS NULL` update. Issue serialization relies on the caller's existing character lock.

Generation uses separate ephemeral 32-byte cryptographic entropy. The seed is not derivable from the public UUID, not returned and not stored. Read/refresh uses stored constraints and answer rather than regenerating. Unknown stored metadata versions fail closed without replacing the row.

Recent selection reads at most 16 issued rows through `(character_id,issue_order DESC)`. It avoids the last three mechanics and the last 16 structural signatures, retrying up to 32 candidates. Signatures ignore labels and presentation order: patrol clock offsets are normalized; routes use their unique DAG topological order; matching uses canonical simultaneous relabeling of solved pair identities; evidence canonicalizes truth sets over all suspect relabelings, independent of clue order and equivalent in/not-in wording. Evidence claims do not duplicate the same truth set within one puzzle.

## Exact GameError codes/messages

- `task_puzzle_context`: `The task context is invalid. Reopen the task to recover.`
- `task_puzzle_required`: `Complete the task puzzle before continuing.` (submission absent/undefined)
- `bad_task_puzzle_answer`: `Submit the issued puzzle ID and its answer only.` (malformed submission, null or invalid UUID)
- `bad_task_puzzle_answer`: `That answer does not satisfy the puzzle. Review the constraints or use the hint.` (malformed answer or wrong answer)
- `stale_task_puzzle`: `This answer belongs to another task or occurrence. Reopen the current task.`
- `task_puzzle_consumed`: `This puzzle was already used for its task. Refresh the task to see the result.`
- `unsupported_task_puzzle`: `This issued puzzle version is unavailable. Keep this task and try again after the service is updated.`
- `task_puzzle_unavailable`: `A fresh puzzle could not be prepared. Reopen the task and try again.`

An absent/invalid database client is a programmer-contract TypeError, not a player-facing GameError. Wrong/malformed/stale answers do not consume or reward anything. Receipts remain available for replay refusal and diagnosis.

## Verification

Observed RED before implementation:

- `node test/task-puzzle-engine.js`: assertion `versioned task-puzzle engine must exist`.
- `node test/task-puzzles.js`: assertion `durable task-puzzle service must exist`.
- Additional red/green regressions cover sparse route arrays, independent private entropy, and duplicate semantic evidence claims.

Final focused gates all PASS:

- `node test/task-puzzle-engine.js`: 500 seeds per mechanic, independent exhaustive legal-answer enumeration, unique solution, real structural variation, malformed-answer rejection, detached public projection, no answer/seed leakage, and fail-closed version checks.
- `node test/task-puzzles.js`: actual pg-mem database with caller character transactions, durable refresh/read, owner/scope/target/occurrence binding, wrong/malformed answers, retained consumed receipt, consume-once, recent-kind/signature avoidance, forced candidate-collision retry, private entropy and unsupported persisted versions.
- `node test/clue-puzzles.js`: existing clue-puzzle preservation and API/economic checks unchanged and passing.
- `node --check src/task-puzzle-engine.js`, `node --check src/task-puzzles.js`: PASS.
- `git diff --cached --check`: PASS after removing trailing blank lines. Git's LF-to-CRLF notices are repository conversion notices only.

Bounded real-PostgreSQL service smoke also PASS on the plan's disposable loopback database with a verified pinned search_path in fresh schema `task_puzzles_service_03b601cbfad4`. It ran the same service test, reached native migration readiness, passed, then removed its tables individually and schema and verified the exact schema absent.

The first native attempt in `task_puzzles_service_9a4cbab4a0fc` was inconclusive because final bulk `DROP SCHEMA CASCADE` raised PostgreSQL 53200 `out of shared memory` with the default `max_locks_per_transaction=64`, masking the original outcome. Its exact 588-table schema was subsequently cleaned in bounded per-table queries and verified absent. No cluster configuration was changed. Only those newly created schemas were touched. The successful retry used per-table cleanup to avoid the bulk-drop lock limit.

## Concerns and remaining integration work

- Real concurrent job-plus-consumption races and rollback proofs belong to the controller's integration/native phase; this task does not claim to prove those composite paths.
- No adapters, routes, UI, OpenAPI changes or economy changes are part of Task 1. Trusted adapters must not accept arbitrary context from requests.
- Old and abandoned occurrences are intentionally retained, not expired or rerolled. Lookup/selection work is bounded, while eventual archival can be a later storage concern.
- Puzzles are gameplay and remain equally accessible to agents. They are not a bot-proof or human-verification mechanism.
- Controller owns aggregate `npm test` at integrated completion; this task ran only the requested task/clue gates.

## Exact public issued examples

Examples show the real engine projection with an illustrative issued UUID. They contain no server answer, structural signature, seed, or solution internals.

### patrol

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "version": 1,
  "kind": "patrol",
  "title": "Patrol timing",
  "instructions": "Choose a listed start minute. The crossing must finish by the deadline and never overlap a blocked patrol interval. Intervals include their start and exclude their end.",
  "constraints": {
    "startOptions": [
      43,
      44,
      45,
      46,
      47,
      48,
      49,
      50,
      51,
      52,
      53,
      54,
      55,
      56
    ],
    "duration": 2,
    "deadline": 57,
    "blocked": [
      {
        "start": 43,
        "end": 44
      },
      {
        "start": 45,
        "end": 46
      },
      {
        "start": 47,
        "end": 48
      },
      {
        "start": 50,
        "end": 51
      },
      {
        "start": 52,
        "end": 58
      }
    ]
  },
  "controls": {
    "type": "start",
    "options": [
      43,
      44,
      45,
      46,
      47,
      48,
      49,
      50,
      51,
      52,
      53,
      54,
      55,
      56
    ]
  },
  "hint": "Look for an uninterrupted gap at least as long as the crossing. Finishing exactly when a patrol starts is safe.",
  "status": "issued"
}
```

### route

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "version": 1,
  "kind": "route",
  "title": "Courier route",
  "instructions": "Build a directed route from the start to the finish, visiting every required stop. Add the edge costs and stay within the budget. Do not visit a stop twice.",
  "constraints": {
    "nodes": [
      {
        "id": "n1",
        "label": "Rope Shed"
      },
      {
        "id": "n2",
        "label": "Tram Depot"
      },
      {
        "id": "n3",
        "label": "Lock House"
      },
      {
        "id": "n0",
        "label": "Kiln Door"
      },
      {
        "id": "n4",
        "label": "Stage Door"
      },
      {
        "id": "n5",
        "label": "Bell Gate"
      }
    ],
    "edges": [
      {
        "from": "n1",
        "to": "n2",
        "cost": 8
      },
      {
        "from": "n4",
        "to": "n1",
        "cost": 9
      },
      {
        "from": "n5",
        "to": "n3",
        "cost": 7
      },
      {
        "from": "n0",
        "to": "n4",
        "cost": 6
      },
      {
        "from": "n3",
        "to": "n1",
        "cost": 10
      },
      {
        "from": "n4",
        "to": "n5",
        "cost": 9
      },
      {
        "from": "n0",
        "to": "n3",
        "cost": 3
      }
    ],
    "start": "n0",
    "end": "n2",
    "required": [
      "n5",
      "n3"
    ],
    "budget": 40
  },
  "controls": {
    "type": "path",
    "nodeIds": [
      "n2",
      "n5",
      "n3",
      "n1",
      "n0",
      "n4"
    ]
  },
  "hint": "Trace the arrows, include the required stops, and compare the total costs of the possible routes.",
  "status": "issued"
}
```

### matching

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "version": 1,
  "kind": "matching",
  "title": "One-to-one matching",
  "instructions": "Assign exactly one parcel to each contact using only that contact's allowed parcels. Every parcel must be used exactly once.",
  "constraints": {
    "left": [
      {
        "id": "l3",
        "label": "Courier"
      },
      {
        "id": "l4",
        "label": "Keeper"
      },
      {
        "id": "l1",
        "label": "Broker"
      },
      {
        "id": "l0",
        "label": "Lookout"
      },
      {
        "id": "l2",
        "label": "Driver"
      }
    ],
    "right": [
      {
        "id": "r1",
        "label": "Token"
      },
      {
        "id": "r2",
        "label": "Map"
      },
      {
        "id": "r0",
        "label": "Envelope"
      },
      {
        "id": "r4",
        "label": "Seal"
      },
      {
        "id": "r3",
        "label": "Key"
      }
    ],
    "allowed": [
      {
        "left": "l3",
        "rights": [
          "r0"
        ]
      },
      {
        "left": "l1",
        "rights": [
          "r3",
          "r0"
        ]
      },
      {
        "left": "l2",
        "rights": [
          "r1"
        ]
      },
      {
        "left": "l0",
        "rights": [
          "r2"
        ]
      },
      {
        "left": "l4",
        "rights": [
          "r0",
          "r4",
          "r2"
        ]
      }
    ]
  },
  "controls": {
    "type": "pairs",
    "leftIds": [
      "l4",
      "l2",
      "l1",
      "l3",
      "l0"
    ],
    "rightIds": [
      "r2",
      "r0",
      "r1",
      "r4",
      "r3"
    ]
  },
  "hint": "Start with a contact who has only one possible parcel, then remove that parcel from the remaining choices.",
  "status": "issued"
}
```

### evidence

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "version": 1,
  "kind": "evidence",
  "title": "Evidence deduction",
  "instructions": "Exactly one listed suspect carried the envelope. A statement marked in claims the carrier is in its list; not-in claims the carrier is outside its list. Choose the only suspect that makes exactly the stated number of statements true.",
  "constraints": {
    "suspects": [
      {
        "id": "s3",
        "label": "Broker"
      },
      {
        "id": "s2",
        "label": "Clerk"
      },
      {
        "id": "s1",
        "label": "Lookout"
      },
      {
        "id": "s4",
        "label": "Courier"
      },
      {
        "id": "s0",
        "label": "Keeper"
      }
    ],
    "statements": [
      {
        "id": "e0",
        "op": "in",
        "suspects": [
          "s2"
        ]
      },
      {
        "id": "e1",
        "op": "not-in",
        "suspects": [
          "s4"
        ]
      },
      {
        "id": "e4",
        "op": "not-in",
        "suspects": [
          "s4",
          "s3",
          "s0",
          "s2"
        ]
      },
      {
        "id": "e3",
        "op": "in",
        "suspects": [
          "s2",
          "s4"
        ]
      },
      {
        "id": "e2",
        "op": "not-in",
        "suspects": [
          "s0",
          "s3"
        ]
      }
    ],
    "trueCount": 3
  },
  "controls": {
    "type": "choice",
    "options": [
      {
        "id": "s1",
        "label": "Lookout"
      },
      {
        "id": "s2",
        "label": "Clerk"
      },
      {
        "id": "s3",
        "label": "Broker"
      },
      {
        "id": "s0",
        "label": "Keeper"
      },
      {
        "id": "s4",
        "label": "Courier"
      }
    ]
  },
  "hint": "Try each suspect as the carrier. Count true statements for that suspect, including the not-in statements.",
  "status": "issued"
}
```
