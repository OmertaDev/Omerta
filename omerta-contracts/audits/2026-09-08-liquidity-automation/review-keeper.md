# Liquidity keeper transport, planner and local execution review

Reviewed 2026-09-08 against the final source hashes below. This current subreport supersedes the earlier implementation checkpoints retained under `output/liquidity-automation/`; those historical files remain unchanged. The scoped transport, planner and local integration checks passed. This is an implementation-phase review and local rehearsal. Deployed addresses, runtime hashes, ownership, funding and production configuration remain release inputs under the separate release policy.

## Evidence executed

- `test/keepertransactions.js`: 18 grouped cases passed against isolated PostgreSQL 18.4, including SQL rollback after a bookkeeping write and advisory locking across separate module instances. Real EIP-1559 signatures with deterministic RPC failures; evidence: `transport-postgres.log`.
- `test/liquiditykeeper.js`: 10 deterministic groups, 11 when the read-only PostgreSQL planning-context case is enabled. Evidence: `planner-postgres.log`.
- `test/genesiskeeper.js`: 4 grouped cases for actual-migration proof shape, canonical receipt/NFT custody discovery, bounded L2 scanning, and stopped/failed/unbound phase decisions.
- `tools/liquidity-e2e.js`: 19 groups passed using actual compiled OMR, Hook, v4 PoolManager, PositionManager, Permit2, ProtocolLiquidityVault, LiquidityBuybackExecutor, OmertaFees, FeeRevenueRouter, VoucherClaim and KeeperGasVault. Eleven actual keeper transactions settled; a twelfth deliberately unsafe native Hook receipt was held without bookkeeping. Current evidence: `output/liquidity-automation/e2e-wrapper-run.log`, its exit status `0`, and `output/liquidity-automation/e2e-report.json`.

The final E2E additionally invokes `runLiquidityAutomationCycle` in live local mode with the same full manifest after all eleven jobs settle. It proves that indexing is caught up, the withdrawal queue reports `voucher_signing_dormant` with zero signatures, the unset daily policy creates no offering, and a deployment-bound `live`/ready health observation is persisted for 90 seconds. The observation keeps `bond_ready` false and its issuance cap zero. All eleven interval keys remain attempted; the cycle returns idle with unchanged pending nonce, journal rows, settlement/flow counts, reserve and offering count. The subsequent unsafe Hook experiment still holds in both settlement paths.

The local rehearsal deploys only to its own loopback Anvil instance on chain ID 4663 and requires an empty, explicitly named loopback PostgreSQL test database. It verifies Anvil before issuing mutations, uses generated test keys, excludes private keys and raw signed bytes from the report, and stops Anvil on completion. The report retains actual deployment artifact hashes, runtime pins, transaction hashes, ledger results and the held receipt.

## Authority and recovery properties

The transport reserves a whole chain/wallet nonce domain through a PostgreSQL session advisory lock and a same-process guard. It persists signed bytes before broadcasting, verifies their signer/chain/nonce/target/calldata/value/gas/fee caps, and resumes only those bytes. Unknown consumed nonces, pending external transactions, changed finalized blocks and reorgs hold new wallet work. Asset and gas budgets cover completed and reserved actions before signing; finalized reverts release only the asset reservation.

Required accounting must acknowledge `{ settled: true }`. Its writes and the journal's settled marker share one database transaction. Native Hook receipt proofs run before that transaction: historical runtime and recipient pins, absence of any recipient rotation in the complete receipt block, and canonical block identity must pass. A missing/no-op/rejected proof leaves the receipt confirmed and the wallet blocked. Canonicality is checked again after the historical RPC proof.

The planner uses a closed, SHA-256-pinned public manifest and checks the chain, current block age, a single pinned read block and its canonical identity. It verifies owner/dependency relationships, recipients, the exact pool, fixed custody, oracle policy, POL health, pause/emergency state and signer separation. Only typed jobs are available. One new transaction is signed per invocation after pending work is reconciled. Exact current cadence keys are queried independently of the 100-row status window, and older attempted jobs receive fair scheduling.

Genesis automation requires the declared controller/auction/strategy/splitter/vault relationships, actual success-state evidence and canonical migration receipts. Foundation acceptance additionally requires one eligible same-pool full-range NFT in the real migration receipt, adequate liquidity, correct custody and no subscriber. A pool's initialized flag alone does not authorize migration success. Missing or ambiguous proof blocks that job.

## Findings fixed and retested

1. Hook `authorized()` is its initializer, not its governance owner. `owner()` is checked separately against governance, and the initializer is checked against its explicit manifest pin.
2. A legacy DEX key can enable old senders independently of their flag. New-mode configuration rejects a legacy DEX key, and integration disables the old transport while new automation is enabled.
3. Missing accounting acknowledgement previously permitted ambiguous success. Required acknowledgement now gates settlement atomically.
4. Gas spent before a refill can increase its amount beyond the preview. The planner reserves the entire immutable refill cap and requires it to fit approved limits.
5. POL fee growth is an estimate. The planner simulates exact fixed-position collection before applying its economic threshold.
6. Spending all native inventory on OMR could strand matching inventory. Funding is bounded by half the positive native excess over oracle-valued OMR and by explicit action/window/daily limits.
7. Delayed reconciliation previously risked making an old fill appear current. Receipts carry their actual canonical block timestamp into accounting.
8. A long-cadence job could leave the normal 100-row history window. Exact current job-key queries preserve its authority independently of status pagination.
9. End-of-block Hook recipient getters do not prove native delivery when governance rotates and restores in the same block. Shared historical verification now holds those receipts in both keeper and indexer paths. The actual local rotate/sweep/restore block confirmed one broadcast and zero accounting growth.

## Explicit rehearsal boundaries

The oracle is the real administered GenesisOracle, not a production observation/TWAP deployment. Governance is represented by a local EOA; Permit2 uses the upstream test helper's runtime etching on the disposable chain. LBP/GenesisController execution, Bank/ERC-4626 markets, active withdrawal signing and active daily issuance are not exercised by this E2E script; they have separate scoped tests. The full-wrapper group proves health publication and dormant extraction/issuance behavior only. Native fee tests prove local contract delivery, not future production funding or operator configuration.

Desk direct token delivery is exercised, while price-band ETH purchases rely on the separate strategy and accounting tests. No unproven native Hook delivery is automatically reversed or credited. Pending signed transactions are not replaced automatically; unknown nonces and reorgs require operator investigation. Gas allocations reserve the signed maximum conservatively. Chain amounts remain exact at the receipt boundary before the ledger's declared rounding.

No production transaction, live configuration change or live funding action was performed.

## Source snapshot

| File | SHA-256 |
| --- | --- |
| src/keepertransactions.js | b6fcee6ac2d6c892cfad46d44a477bf5bd5c7dcfad2cf4711ef6bf77c33d21aa |
| src/liquiditykeeper.js | 5016d9081b0a812ca5dccd40e6978a2d4fa3c6de273ce9206f32d2b8d65a690c |
| src/genesiskeeper.js | 8c762da122a95be442db0c3d065be8470044201c4a40d3491bfbd23b136e2cba |
| test/keepertransactions.js | 9d53b5fbbbfcc106c768091e4ddad43cb050ea7b631d944b603f75d0de4709bc |
| test/liquiditykeeper.js | eb549e5f8073c7135035e74a8fb0839e21963c21d430b1d5b99412bf76e710c1 |
| test/genesiskeeper.js | 2fa5886cc018fcf6bf5af4c85b490e2e00d75e89410b8a79600ca3ca3874c4df |
| tools/liquidity-e2e.js | 8d5146e33bf185dfebfad0c73d2bb1bb383ce8af8b40ce1e4198dff79296b7fe |
| src/liquidityindexer.js | 74c79035129b602e1705ad45766ff898ab80c38e3473bff63892211a1aeaa151 |
| src/liquidityaccounting.js | c7dd052b74eb9d2f69e7c2c59f7ec595b6c350762459717054e3dc1aa79b6894 |
| src/liquidityautomation.js | 54a005e7cf2f6e6bb478829e14d9bb1625e70ce502f3dfd9d23058135461010e |
| src/liquiditypolicy.js | 2fd027f06cce991b76b3f19d5b5078c69a9e2486d9bba6ebea25fc6f3c8658e6 |
| src/liquidityqueue.js | 4d6b7145d901a138c07be52c8c662330fd3472968cc683c351f24ee59cada012 |

## Final E2E evidence snapshot

| File | SHA-256 |
| --- | --- |
| output/liquidity-automation/e2e-wrapper-run.log | 1dd593bedd48199f14df2e602dfb7f4393cd1c36fac2aa130d2de6b159d3ee6d |
| output/liquidity-automation/e2e-report.json | 8370b18bcb233435595ad8cf36be9ada29f5ff71a3f97142a91cbff06a8e4e20 |
