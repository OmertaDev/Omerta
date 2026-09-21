# Scoped world resource observer

`tools/rc1-world-resource-observer.js` is read-only test tooling. It adds no gameplay ledger, balance setter, authority or outcome override. It does not qualify a simulation matrix cell or close the thirteen resource categories.

## Interface

- `snapshotWorldResources(pool)` takes a repeatable-read committed snapshot of the declared resource and lineage tables. PostgreSQL NUMERIC and bigint columns are explicitly selected as text, so values above JavaScript's safe integer range and sub-cent amounts survive unchanged.
- `reconcileWorldResources(before, after, { identity })` is pure. It rejects unexplained covered balance changes and rewritten/deleted immutable receipts, and returns exact parity checks, receipt/event identities, all canonical in-game OMR bucket amounts and an explicit `unsupported` inventory.
- `worldResourceHash(state)` hashes the resource projection without the snapshot boundary marker.
- `omrBuckets(state)` exposes the full canonical in-game OMR custody list. Accrued `account_persistent.rewards` is a claim on a pool, not extra supply. Chain reserve backing is separately unproved.
- `createWorldResourceObserver({ pool, record, requireSupportedReasons: false }).observe(identity, work)` records one isolated action or job. It records committed partial work even if the action throws. On a reconciliation error it retains both snapshots and the error. Overlapping or nested observations are rejected instead of falsely attributing concurrent commits. Strict mode also rejects any unsupported lineage after retaining its journal.

The callback's result is unchanged. Expected gameplay refusals still throw to the caller after a valid no-change journal is retained. `record` should append to private evidence storage. Actor policies must never receive these snapshots.

For a transaction proxy, take the baseline snapshot once and call the pure snapshot/reconcile functions for each durable boundary. Use an independent, uninstrumented read pool in the same isolated world database. Observing through the instrumented gameplay pool would recurse. These files do not install that proxy or claim per-commit coverage on their own.

## Covered checks and limits

The observer checks exact per-character cash plus bank, ammunition and contraband against authoritative receipts and canonical birth defaults. It checks total in-game OMR supply against the canonical mint/sink vocabulary while retaining every individual bucket delta. Changed OMR custody is explicitly marked as missing complete per-owner attribution; equal global totals are not a transfer proof.

It also checks append-only transaction/item/input/output/operation-event histories, immutable completed mutation guards, ordered legacy stack quantities, item/lot quantity and owner transitions, input/output quantities and mutation linkage, per-operation held cash, and open-loan cash escrow. Changed unimplemented tables are reported, not silently counted as covered. Full lot definition/provenance/custody validation remains with the existing canonical invariants. Per-role operation revision linkage, Family spoils, other escrow branches, legacy inventory, external backing and full cash creation/destruction taxonomy remain open.

The observer does not subtract initial invariant drift or derive balancing adjustments from endpoint differences. A receipt-backed signed delta is reported as receipt parity; it is not mislabeled as creation, destruction or a complete global conservation equation.

## Verification

Run `node test/rc1-world-resource-observer.js` for exact-decimal and corruption controls. For native checks, use a clean committed checkout, an isolated local administrative PostgreSQL endpoint in `RC1_RESOURCE_DATABASE_URL`, and run:

```
node test/rc1-world-resource-observer.js --postgres
```

The runner creates a unique retained database and private temporary output. `RC1_RESOURCE_OUTPUT` can select a new private output directory. `--development` retains diagnostic results but cannot establish evidence for its named HEAD. Source-bound runs verify clean tracked source before and after execution.

The native workload declares one initial character cash fixture, then uses canonical loan offer/refund, crime, stack grant/consume/refusal/replay, and unique creation/transfer/consumption. The material grant is a declared test invocation of the canonical primitive, not naturally earned inventory. Its final negative control commits an unledgered cash increment of `0.000000001`, requires rejection and retains before/after evidence without repairing that impossible state. Native lot/capital execution, worker integration, production deployment and full matrix coverage are excluded from this focused invocation. Installed dependencies are local shared runtime inputs, not independently attested.
