# Market V2 build, review and deployment

No command in the offline planning workflow broadcasts. `run`, `commit` and `execute` are explicit signing operations and require a reviewed public manifest, separate keeper identity and PostgreSQL journal. No such operation was invoked while implementing V2.

## Reproduce the contract checks

Run from `omerta-contracts` with Foundry on PATH:

```powershell
forge build lib/v4-core/src/PoolManager.sol
$env:FOUNDRY_INVARIANT_RUNS = '128'
$env:FOUNDRY_INVARIANT_DEPTH = '64'
forge test --match-path 'test/market-v2/*.t.sol' --offline -vv
```

The fixture uses `deployCode` for the real pinned PoolManager artifact, avoiding an observed Solidity 0.8.26 optimizer/Yul failure when a test inlines `new PoolManager` under the V2 via-IR profile. The AMM is not mocked. PositionManager custody tests likewise use the actual pinned periphery implementation. Some policy-boundary tests intentionally use a controlled observation fixture; the integration suite separately uses the actual hook and finalized market state.

V2 sources and tests use Solidity 0.8.26, optimizer 800, Cancun and via-IR restrictions added to the existing Foundry configuration. No global switch changes legacy contracts' compiler settings. Retain source SHA-256, artifact SHA-256, bytecode templates, constructor parameters and actual deployed runtime hashes separately. Runtime templates containing immutable placeholders are not hashes of deployed instances.

From the repository root:

```powershell
node test/marketv2keeper.js
node test/marketv2solver.js
node test/market-v2-deployment-plan.js
```

The scoped review package lists exact executed commands and outcomes. Native static analysis supplements tests; warnings require triage. A green test count does not establish profitable parameters or an MEV-proof market.

## Build the concrete deployment plan

Use `tools/market-v2-deployment-plan.js` and its example/template mode. Fill every required public parameter and pin the intended artifacts before planning. The builder resolves deployment order, reserves CREATE nonces, mines the hook's CREATE2 address flags and emits typed setup transactions. A plan for an unknown Safe, recipient or token is incomplete; do not substitute an arbitrary live address.

Required sequence and invariants:

1. Pin chain, deployer, nonces, CREATE2 factory/code, existing OMR, PoolManager, PositionManager and Permit2. Verify the canonical token's decimals and that `ammPairs(PoolManager)` is false. Verify the Safe's actual owners and threshold separately.
2. Deploy Core and War Chest funding adapters and the game adapter. The adapters exist before contracts that record them as immutable recipients.
3. Deploy the mined hook with exact currency order, fixed LP fee/tick spacing, opening policy, epoch length, surge calibration and all five funding recipients. A new hook means a new pool identity.
4. Deploy market state and Turf registry. Bind the game adapter to that registry. Establish initial family treasuries; create the future season and ordered slabs before their start.
5. Deploy each Turf fee bridge after its range exists. Deploy its matching controller with the same season, ticks, token, market-state source and Safe. Bind controller/bridge/funding adapters, authorize the unique fee source, and register the game lane before the season starts.
6. Deploy inventory bonds, solver executor and commitment vault against the same canonical market. Verify all finite caps, vesting, rates, recipients and custody bindings.
7. Initialize the fresh pool through its authorized initializer and seed actual initial liquidity. The controller cannot bootstrap itself from a zero-liquidity oracle gate. Mint/add-liquidity amounts need explicit slippage and price checks in the reviewed initialization transaction.
8. Fund the chosen compartments, bond inventory and commitment campaign with actual assets. Funding by itself does not change deployment limits or reset consumed capacity.
9. Wait for a complete qualifying observation interval. Refresh market state, inspect measured depth/spot and simulate each first strategy action. A partial genesis interval is insufficient.
10. Populate runtime-pinned upkeep and solver manifests from the verified deployed instances. Start with read-only plans. Simulate the exact proposed transactions and retain receipts/finality checks when the owner activates operation.

The shipped plan covers one explicit season and slab. Replicate controller/bridge pairs with separate budgets for additional slabs and update the active-lane manifest. Keep the aggregate maximum of 64 active game lanes in view; archive closed prior-season lanes before exceeding it.

Existing pools cannot have their hook address rewritten. If an old pool has positions, fees or obligations, inventory and retire them through their own authority paths; changing frontend addresses does not migrate those assets. Existing vouchers, bonds and family credits remain obligations of their original contracts. A fully greenfield redeployment can avoid legacy compatibility constraints but cannot erase an existing claim.

## Upkeep and solver operation

`node tools/market-v2-keeper.js plan manifest.json` reads current chain state and simulates typed jobs. It does not load a key or open the database. Public manifest fields include schema version 2, chain, separate keeper/Safe, contract addresses/artifacts/runtime hashes, bounded job cadence, and gas limits. Tests contain a complete synthetic example.

For a configured and accepted release, `run` performs at most one newly signed transaction per invocation and first reconciles any pending journaled transaction. It requires `MARKET_V2_RPC_URL`, `MARKET_V2_KEEPER_KEY` and `DATABASE_URL`. Keep keys outside manifests and the repository. Choose job order deliberately: expired position settlement and fee forwarding, observation refresh, recovery and new placement have different priorities. The contract rechecks every economic condition at execution.

Solver `quote` evaluates a finite set of approved pool/amount/direction candidates. `commit` persists the exact selected plan before sending a journaled commitment; `execute` verifies the persisted plan and live commitment before simulation and journaled reveal. Use its CLI usage and test fixture for the complete public policy schema. Gas allowances include commitment, execution and claim; failed competition can still consume gas. The reserve recipient is paid by `claimFor`, followed by its funding adapter's `flush`.

The solver manifest additionally pins PoolManager, OMR and V4Quoter. Its optional `networkFeeReserveWei` must cover any separately charged chain data fees that the EIP-1559 gas allowance does not bound. The upkeep jobs `lp_recover` and `lp_regenerate` are separate actions: the first records an eligible recovery observation, and the second attempts the funded partial replenishment after the required window. Fee-collection eligibility projects the pinned v4 StateLibrary storage layout; successful on-chain simulation and contract checks remain the authority.

The local review exercised the existing transaction journal's regression suite using pg-mem. It did not perform a new native PostgreSQL or production RPC rehearsal for these V2 operators. Run those checks with an isolated database and the intended chain configuration before activating a signer.

## Recovery and season transitions

- Pause controller deployment or new inventory-bond purchases with their own Safe controls when appropriate. The canonical hook has no discretionary trading pause.
- Controller `collect`, `claimFees`, Safe `exit` and principal retirement do not require a healthy oracle. `expireTurf` becomes permissionless at the season end.
- LP commitment maturity withdrawal and already vested bond claims remain available during a pause or oracle outage. Already credited family claims depend only on their funded balances.
- Siege expiry passes through the game adapter so the final fee batch reaches the frozen recipients. Do not substitute a bare EOA for the registry's game adapter in deployment.
- Close/settle every ending Turf bridge and archive it. Record the actual on-chain cutoff and outstanding family credits. A new season creates new fixed lanes; old claims remain claimable.
- When a finite lifetime budget is exhausted, new funding does not restore authority. A newly reviewed controller deployment with explicitly approved new limits is a new risk allocation.

## Release scope

The repo's `SECURITY-REVIEW-POLICY.md` governs source-pinned agent-led review. Retain the exact working-tree/source manifest, test logs, static output and triage, remediated findings, dependency commits, constructor configuration and intended release phase. Review of the market contracts does not activate the game's withdrawal rail, token issuance, RWA execution or production gameplay settlement. Production parameter calibration, exact-chain fork rehearsal, Safe acceptance and deployment verification remain concrete release operations.
