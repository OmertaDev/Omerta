# Storefront procurement source review

Reviewed product revision: `213491e5a30aba9bc308d63d12b38b2473bc5e04`.
Predecessor: `e837b1bb32b3fda321d672779a9693a8b838de00`.
Review date: 2026-10-11. Phase: source review and historical guard compatibility;
deployment and real financial activation are separate and are not asserted here.

## Scope and exact source

This review covers the pure storefront purchase selector, committed game-cash
procurement mutation, authenticated route, native dispatch case and sorted
two-character lock selection. Automatic Agent Turn descriptor generation is not
present in this product revision and requires a separate integration review.

SHA-256 of Git source after CRLF-to-LF normalization:

| File | SHA-256 |
| --- | --- |
| `src/server.js` | `999208a6e0539a6c0be02119c13c108bf2a7853610a33eb16868de548529a914` |
| `src/delivery.js` | `590331da28927314ff200a3226a4178d22c8134d5138559d40cc8c987e884025` |
| `src/routes/delivery.js` | `9e484b30322c0032f64a8d5629dad7da063d59bdd3bf1c4fd2ef1764d2524048` |
| `src/storefrontfulfillment.js` | `5462546dbb50906564fcac9ea4034d122e4d3884a8205a6b6b953a9f369d443a` |
| `test/storefrontfulfillment.js` | `281a486cbb6b071a34c5340b70b4f25f71ce49ececc65abc81ef44a5c63c579e` |
| `test/storefront-fulfillment-api.js` | `81b2f793591c01e4c8dc75d9f9d0fa99ddc910a329a5123221f2a733e031152c` |

Historical transfer uses two exact, unique inverse chunks: removal of the new
storefront execution case and reversal of the new two-party storefront dispatch
selection. The entire reconstructed predecessor server must hash to the unchanged
Business pin `3e7a9ca662681aadf6cc0aaca515d0cbbc011287346223580288e83a9363e5df`.
The existing Business, City, Goods, genesis, HTTP and deed inverses then run
unchanged. Whole-source hashes reject edits outside these exact chunks.
This transfers only unchanged historical recovery assertions; it does not claim
historical execution of storefront purchases, current deployment or activation.

## Independent review and trust boundaries

Applied relevant adapted methods from the repository security policy:
Pashov `c577eb7799c349de0acb187ba00ca98e14e436fd` access-control, execution-trace,
boundary and economic passes; Plamen `795962b96e254f2e423a2635fe7f8cb8ea1e6d69`
state/accounting transitions and exploit-hypothesis checks; Trail of Bits
`d3323cefbcf645678b8dc481de204b02ad3d02dc` context, specification comparison and
invariant testing. These are adapted JavaScript/SQL review passes, not claims of
running upstream orchestration or Solidity analysis.

The owner lookup is a hint. Canonical execution locks both living characters and
accounts in sorted order, then locks the seller depot, procurement order and
commitment. It revalidates the depot owner, supplier identity, active deadline,
needed quantity, independent storefront, procurement cap and $1,000 personal
reserve. The existing depot purchase owns stock cost, treasury, goods custody,
game-cash ledger and tax accounting; actual paid cash increments committed spend
in the same transaction. Seller death shares the character/depot lock boundary.
No new monetary escrow or outside financial rail is introduced.

No confirmed defect was found in this bounded reviewed seam. Arbitrary supplied
action IDs cannot create executable authority; the canonical pre-action turn must
issue the descriptor. No new signer, chain token, external adapter, real compute,
customer communication or financial activation surface is reviewed here.

## Executed evidence and limits

Independent reviewer executed with Node v24.19.0 on Windows; all listed commands
returned exit status 0:

- `node test/storefrontfulfillment.js`: 2,000 seeded selector trials,
  seed `0x51f0a7`.
- `node test/storefront-fulfillment-api.js`: in-memory canonical API checks,
  access rejection, bounds, exact procurement accounting and replay.
- `node test/rc1-world-qualification.js`: exact Git source reconstruction,
  new dispatch/owner-branch/guard tamper controls, unchanged historical pins.
- `node test/rc1-source-pair.js`: 57 source-pair negative controls.
- `node test/rc1-car-melt-provenance.js`: 24 controls.
- `node test/rc1-world-duration-evidence.js`: synthetic duration controls.
- `node test/rc1-checkpoint-recovery-review.js`: checkpoint inverse controls.
- `node test/rc1-world-checkpoint-series.js`: checkpoint/artifact joins.
- `git diff --check`: no whitespace diagnostics.

The independent reviewer inspected the native PostgreSQL concurrency and seller
death-race assertions but did not rerun those proofs. The coordinator's native
execution evidence must remain separately retained and source-pinned. In-memory
execution alone proves neither PostgreSQL lock serialization nor atomic rollback.
Release checks and later autonomous descriptor integration remain open gates.

## Issued economic-loop continuation proof — 2026-10-11

The implementation agent closed the purchase-to-delivery test seam on runtime
revision `ce374b76080241589c1b9a719b8a794da09b1317`, with only the API proof fixture
changed. `src/agentturn.js` SHA-256 remains
`664248678A243C14588A63AC104513D9EAC2D168BFBFD8C42719AEA6CBAFDB37`.
The executed `test/storefront-fulfillment-api.js` SHA-256 is
`7E8AFF67F1F4FFF258B9ECD5B54365D7528693087AE879D35525F01543B9C97F`.
This is implementation execution evidence, distinct from the independent review
above; no new independent review of the extended fixture is claimed.

Node v24.19.0 commands returned exit status 0:

- `node test/storefront-fulfillment-api.js` — memory execution.
- `node test/storefront-fulfillment-api.js --postgres` — disposable PostgreSQL 18,
  loopback port 35439, fresh database `game_storefront_fullflow_20261011` supplied
  only through `STOREFRONT_TEST_DATABASE_URL`, with a local test market seed.

The test establishes one continuous canonical sequence: a supplier purchases two
units of gin through an issued storefront action for $120, travels through its
next issued action for $250 while preserving those units, and delivers through
the issued commitment settlement action. The customer escrow pays $2,000 gross,
with $40 take and $1,960 recorded supplier income. The commitment's acquisition
spend remains $370 after settlement; remaining quantity and supplier cargo become
zero. The customer receives exactly those two units into its depot. Assertions
check the matching `depot:buy` debit, `market:fill` credit, market-take ledger
delta, replay, stock/cap/price invalidation, and native distinct-request purchase
serialization and storefront-owner death race.

Raw native output is retained in the worktree's ignored
`output/storefront-native-fullflow-proof.log`, SHA-256
`9024E0B5BF129EEAC5E3063B33EE7ACE225135FD60DD451AEFB1BCBD8A9F9A5C`.
The locally started PostgreSQL server was stopped after completion. This proves
the tested game-cash flow on the pinned runtime and fixture, not production
deployment, general strategy profitability, external earnings or crypto backing.
Required source-pinned release checks remain the coordinator's release gate.
