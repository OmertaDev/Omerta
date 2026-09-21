# Scoped OMR loan terminal proof

The pure read-only `tools/rc1-omr-loan-journal.js` reconciles exact six-decimal OMR
account and custody buckets using canonical loan rows, immutable transaction
receipts and observed request route/body/owner bindings. `test/rc1-native-omr-loan-terminals.js`
executes the authored HTTP routes and original worker callbacks in an owned
PostgreSQL database. It never changes gameplay, balances or original deadlines
after the declared baseline. This is a fixture-assisted subset, not RC1 clearance.

Run from a clean committed checkout:

```powershell
$env:RC1_RESOURCE_DATABASE_URL='postgres://postgres@127.0.0.1:55438/postgres'
node test/rc1-native-omr-loan-terminals.js --postgres --output=C:/private/unique-run
```

The runner records full source identity, original worker pins, configuration,
private before/after snapshots, HTTP bodies, movements, immutable receipt
checks, worker schedule, random tape and artifact hashes. It retains failures
and checks source identity at completion. Each output directory must be new.
It neither needs nor records bearer/mod tokens. Private artifacts do contain
fixture actor identifiers; public summaries must omit those identifiers.

## Authority and intended branches

| Branch | Exact authority and disposition |
| --- | --- |
| Directed pledge and replay | Original offer/take and durable body/owner receipt; borrower liquid to active loan escrow |
| Paper listing and same-key concurrent purchase | Actual current lender change; ask10001, authored rounded take201, seller9800; collateral unchanged |
| Manual collection | Old lender refused; new lender refused before due, permitted exactly at original one-hour due; full31 to new lender |
| Lender estate | Canonical mod death creates same-account heir and transfers active claim;37 remains escrowed, then canonical repayment returns it to borrower |
| Nonlooting borrower estate | Canonical mod death deletes loan and credits whole35 to lender; repeated dead-target request refused |
| Fire estate | Original three-hour search; third-party31 splits15 killer/16 creditor; killer-creditor33 splits16/17 into one account using two distinct receipts |
| Original grace | Two one-hour loans remain active at25h equality; first eligible26h sweep aborts after credits/receipts; original27h sweep forfeits33/35 once; terminal sweep replay unchanged |

Transaction rows have no loan-id foreign key. The journal pairs the exact
reason/account/counterparty/amount multiset within a declared completed boundary;
it does not manufacture unique cross-receipt lineage. Player success and replay
must resolve to durable idempotency records with the actual request hash and
response body. Mod kill has no durable idempotency contract: its completed
privileged request, same-account heir, actual terminal and receipts are retained
with that limitation. Concurrent batches retain actual requests/completions,
without claiming a total transaction commit order.

Initial allocations are explicit:235 collateral OMR and1900 funding OMR come
from the retired AMM's20000 seed. The1000000 cash till is a declared fixture;
canonical window redemptions and240 standard ammo boxes fund the actions.
Three initial rat flags provide existing progression eligibility; the actual
one-use witness-protection route grants the original48h deadline before baseline.
There are no arbitrary hospital or shield deadline edits. Natural rat and
protection acquisition are excluded. All original local callbacks execute;
the population deploy switch is off. Full canonical invariants run separately.

Late SQL trigger faults verify credit receipts already exist in the transaction
before rejecting the terminal loan write/delete. Rolled-back states are retained.
Corrupted copies test missing, rewritten, duplicate and wrong-owner receipts,
wrong heir, odd split, premature grace and subatomic drift. They are never applied
to the game database. Every nonzero proof has independently rerunnable inputs.

## Review boundaries and limits

Security review follows the repository policy's pinned methods: Pashov
`c577eb7799c349de0acb187ba00ca98e14e436fd` concrete adversarial traces,
Plamen `795962b96e254f2e423a2635fe7f8cb8ea1e6d69` asset-flow and recovery reasoning,
and Trail of Bits `d3323cefbcf645678b8dc481de204b02ad3d02dc` caller/storage authority
and property checks. These methods are adapted manually to JavaScript/PostgreSQL;
no upstream agent orchestration, Solidity fuzzing or chain audit is claimed.
Reviewed authorities are offer/take/repay/collect, paper transfer, sweepLoans,
voidLoansAtDeath, runEstate, fire, enterWitpro and their actual HTTP wrappers.
The trusted fixture/operator and separate HTTP authentication domains remain
visible. Runtime repairs require a separately reproduced finding.

Unexecuted: no-heir lender fallback (runEstate always generates an heir), House
loans/car collateral, races of paper/death/grace against each other, unrelated
OMR rewards/mint/Family/auctions, full cash/death/Wanted ecology, provider and
local-chain backing, literal wall-time equivalence, browser/network/deployment,
natural progression and integrated matrix cells. Full gaps remain OPEN.
Native results belong to their retained exact commit, never to this source
inventory or to a later integration without rerun.

Initial native source `ae7df02597875e30516787e7068d66453510546e` retained a
harness failure after45 completed boundaries: the journal treated the schema's
TEXT notification payload as an object at the successful27h forfeiture. The
native terminal and all four notifications existed; the full gate was FAIL.
The correction parses the stored JSON text and also checks the borrower-only
`lost` flag. No runtime bytes or gameplay were changed.
