# Coordination Phase 04 — Typed agreements and economic boundaries

Status: planned, with all value-moving adapters disabled until separately implemented, reviewed, and deliberately enabled. Dependencies: Coordination Phases 00–03 plus the relevant existing domain's pinned security/release gate. Product intent: [shared brief](https://chatgpt.com/share/6aa68e3e-9ad8-83ea-ab47-b9c624dce707).

## Result and current authority

A compiled operation may refer to a typed service agreement or a crafting dependency and receive a verifiable domain receipt. Coordination records agreement state and orchestration; it does not become a second balance, escrow, item, bond, or liquidity ledger.

Source boundaries already exist:

- `src/items.js` owns item mutation contexts and `item_stacks`, `item_instances`, `item_events`, and `operation_escrow`.
- `src/crafting.js` and `src/mysteries.js` enforce world-graph recipes, exact custody, and historical escrow recovery.
- `src/content/crafting.js` and `src/content/exchange.js` own authored exact-hash lots, jobs, tools, and barter. Their contracts are distinct from sealed item-definition activation in `src/content/artifacts.js`.
- `src/bonds.js`, `src/liquidityaccounting.js`, `src/liquiditypolicy.js`, and related chain services retain bond, reserve, and protocol-owned liquidity authority. Existing deployment/readiness gates remain necessary.

Read the applicable [security review policy](../../../omerta-contracts/SECURITY-REVIEW-POLICY.md) before extending any money or chain authority. This phase does not imply production extraction or a configured chain.

## Proposed contracts, storage, and rollout slices

Add `src/coordination/agreements.js` with an allowlisted agreement vocabulary. Begin with a value-neutral service agreement: parties, service definition hash, required receipt kinds, explicit deadline, consent, permitted outcomes, and deterministic cancellation.

Proposed `coordination_agreements` stores frozen terms/hash, party scope references, revision, status, and no balances. `coordination_agreement_consents` records consent to exact terms. `coordination_domain_receipts` stores domain name, immutable receipt ID, operation correlation, expected terms hash, and observed status; a unique domain/receipt constraint prevents reuse. Sensitive receipts have independent projection rules.

Proposed `/v1/coordination/agreements` and issued `/accept`, `/cancel`, and `/settle` commands accept exact terms identifiers and revisions. Client-selected amounts, item IDs, or recipients are permitted only if the specific reviewed agreement schema and underlying domain already grant that choice. A generic effect payload is forbidden.

Deliver slices in order: (1) receipt-only crafting dependency checks, (2) no-value agreements, (3) one reviewed item escrow adapter, (4) separately approved cash/OMR adapter if justified, and (5) separately scoped bond/POL integration. Each has its own capability flag and release evidence. Later slices are optional and do not block shipping useful value-neutral coordination.

## Atomicity, accounting, and lifecycle

Receipt-only reads must not consume a recipe input or create an entitlement. An inventory holding is not a permanent promise of availability. When a value-backed commitment is eventually supported, the authoritative domain must reserve or escrow the exact asset before the coordination state claims it is committed.

For same-database effects, choose one existing domain transaction owner and pass its checked client/context through a narrow adapter. The current item and sealed-content transaction contexts are different; do not nest their wrappers or pretend a Phase 2 client carries item authority. Prove a shared transaction integration or keep that adapter disabled. Domain debit/reservation, agreement transition, command receipt, and coordination event must commit together.

For chain/RPC actions, use durable domain-owned intents and finality-aware receipts; database intent is not on-chain success. Unknown outcomes remain pending and reconcile using the original domain operation identity. Never compensate an ambiguous commit or send a second payout under a new key. Any timeout policy must distinguish unapplied intent, reserved value, finalized effect, and recoverable escrow.

Death, departure, version changes, or package retirement cannot rewrite a depositor or recipient. Release returns once to the domain's recorded historical depositor. No coordinator may route recovery to a living heir merely because the old character is dead. Resolution cannot fabricate domain receipts, increase reserve capacity, bypass budget limits, or mint an economic reward for a narrative outcome.

## Acceptance and non-destructive rollback

Test conservation in authoritative tables, unique receipt consumption, exact terms consent, stale definitions, replay, cancelled/dead owners, and retirement recovery. Inject acknowledgement loss at database commit and chain submission boundaries. A crafted completion cannot satisfy a dependency from another owner, hash, quantity, or already-consumed receipt.

Planned `COORDINATION_AGREEMENTS=on` opens only the no-value slice. Separate named adapter flags default off and require specific release artifacts, PostgreSQL race tests, and domain invariant checks. Rollback stops new value commitments, drains/reconciles already-issued intents, and retains release/cancel routes until every reservation has a terminal domain receipt. Never delete escrow, lower reserve commitments, or reverse immutable provenance as a rollback shortcut.

Out of scope: new tokens, yield promises, price prediction, autonomous investment, changing mint/extraction access, a universal asset layer, and converting authored inert items into economic assets. Packages: CE-04-01 through CE-04-05.

