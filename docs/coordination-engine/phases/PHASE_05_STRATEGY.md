# Coordination Phase 05 — Game-native strategy

Status: planned after Coordination Phases 01–03. Phase 04 is required only for any explicitly reviewed value-backed mechanism; the first strategy pilot is value-neutral. Product intent: [shared brief](https://chatgpt.com/share/6aa68e3e-9ad8-83ea-ab47-b9c624dce707).

## Result and scope

Compiled game scenarios can introduce private commitments, conflicting intelligence, canary clues, collective decisions, and public-goods dilemmas. The game rules define what these mechanisms mean. They do not grant access to real messages, external accounts, credentials, or out-of-game surveillance.

Extend `src/coordination/graph.js` with individually reviewed mechanism types and add `src/coordination/strategy.js`. Reuse knowledge origins from Phase 01, authorization from Phase 02, and deadlines/resolution from Phase 03. Keep current `src/secrets.js`, authored story choices, and world-graph mystery answers under their own authorities.

## Proposed state and interfaces

Use `coordination_commitments` for commit/reveal state: account, scenario/run ID, round ID, frozen policy hash, commitment digest, committed revision/time, reveal deadline, and terminal reveal status. Enforce one immutable commitment per account/round. Separate private reveal storage from safe aggregate projections.

Use `coordination_strategy_rounds` for typed round policy, phase, revision, deadline, and unique resolution receipt. Canary discoveries remain knowledge claims with server-issued provenance; record observed disclosure as a separate claim relation/event rather than mutating original evidence. Betrayal outcomes are scenario-local, explicitly declared rule consequences, not an inferred real-world accusation or new global trust penalty.

Proposed `/v1/coordination/strategy/:roundId` exposes the caller's permitted phase and descriptors. `/commit` accepts only a bounded digest for the compiled domain. `/reveal` accepts the choice and bounded nonce under strict schema. The committed bytes bind protocol version, run, round, account, policy hash, canonical choice, and a sufficiently random nonce. The same commitment cannot migrate to another actor or scenario.

Initial mechanism catalog:

1. Commit/reveal coordination: choices remain private until the graph's reveal rule permits publication.
2. Consensus: fixed eligible account set and threshold, with a deterministic abstention/timeout/tie policy.
3. Canary evidence: intentionally distinct fictional clues whose later in-game disclosure retains its exact origin.
4. Public-goods or Schelling scenarios: compiled alternatives, declared aggregation, and inert narrative outcomes.

## Authority and adversarial behavior

Validate membership, live role, consent, expected revision, and time under the round transaction lock. Resolution consumes the frozen eligible input set exactly once. Counts must not expose hidden participation where the scenario requires secrecy. Public reveal requires the original compiled disclosure rule; the coordinator cannot broaden it retroactively.

Client digests alone do not prove an authentic discovery or participant independence. The game verifies reveal hashes and eligibility. Use a nonce so a small choice set cannot be recovered by enumerating public hashes; never publish private nonces before reveal. Withheld reveals have a declared result. Repeated rounds, alternative accounts, copied evidence, and self-corroboration do not create additional qualifying participants.

On death or role departure, preserve committed history but refuse unauthorized new role actions. A compiled rule may retain an already-consented locked commitment for aggregation; it may not let a replacement character change the old choice. New definitions create new rounds; active rounds remain pinned. Canary provenance cannot revoke another player's underlying access or trigger economic punishment without a separately authorized mechanism.

## Acceptance and rollout

- Hash vectors prove canonical framing and binding to actor/run/round/policy; reject noncanonical values, oversized nonces, malformed hashes, and cross-round replay.
- Before disclosure, recursively inspect shared boards, errors, logs, and aggregate events for choice/nonce/hidden actor leakage.
- Test commitment replacement attempts, two reveals, deadline races, withheld reveals, ties, revocation, death, and concurrent resolution.
- Canary copies retain one original source; fabricated or merely similar clues cannot establish a verified disclosure.
- Model-check small round configurations for a terminal path under absent or adversarial participants. No mechanism depends on voluntary honesty to terminate.

Planned `COORDINATION_STRATEGY=on` requires the engine, knowledge, organization, and operation gates. Release each mechanism independently with one compiled value-neutral fixture. Disable new rounds on rollback; existing rounds must still reveal, expire, cancel, or resolve according to their pinned disclosure policy. Never disclose private choices as a recovery convenience.

Out of scope: real-world targeting, external intelligence collection, human psychological profiling, arbitrary punishment, automatic PvP, new economic incentives, and model adjudication of who is truthful. Packages: CE-05-01 through CE-05-04.

