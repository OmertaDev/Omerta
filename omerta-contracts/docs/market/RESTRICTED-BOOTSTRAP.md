# Restricted OMERTÀ market bootstrap

The mandatory 5% LP trade charge requires a new `OmertaRestrictedOMRV2` token, `OmertaPoolManagerV2` settlement manager, and PositionManager paired to that manager. The manager caps positive hook surcharges at 0.5%, enforcing a maximum 5.5% protocol charge per swap across reviewed hooks; LP fees are additional. It cannot be installed by changing the hook or adding a PoolManager address to an existing ERC20 tax registry. This is a source-level deployment candidate; no production activation or migration has happened.

## Settlement and custody policy

The manager charges each ETH/OMR swap in both directions, including alternative unhooked pools. Exact-input swaps receive less output; exact-output swaps owe more input. It accounts actual deltas and partial fills, splitting the 500-bps base revenue 200/100/100/100 bps between founder/operations (`dev`), RWA, community and POL. The founder/operations share remains 2%. The canonical hook adds only its separate opening or surge charge, bounded to 50 bps. The manager independently rejects positive post-swap hook charges above `floor(abs(rawUnspecifiedDelta) * 50 / 10000)`, including charges from approved alternative hooks. Adding or withdrawing liquidity does not incur the base trade charge.

The token's public policy ID is `keccak256("OMERTA_RESTRICTED_LP_REVENUE_V2_500_BOTH_DIRECTIONS")`. `bindSettlementManager(address,bytes32)` validates the manager's token, 500-bps rate and policy ID. `setOperator(address,uint8,bytes32)` pins the actual deployed runtime. The enum is `None = 0`, `SettlementInput = 1`, `ProtocolCustody = 2`, `SettlementManager = 3`; role 3 is assigned only by manager binding. `setContractHolder(address,bytes32)` separately registers a runtime-pinned receiving-only contract. It grants no transfer or settlement authority. The genesis Safe is pinned through immutable `genesisTreasury`/`genesisTreasuryRuntimeHash` and is not an operator or an enumerated contract holder.

After `sealPolicy()`, operator and contract-holder lists, roles and runtime pins cannot change. A settlement input can transfer OMR only into the bound manager. A custody contract can receive into and distribute from its own address, and the manager can distribute only its own OMR; each recipient must also be allowed by the receiving policy. Standard wallet approvals work with `OmertaSwapRouterV2`; plain wallet transfers fail after sealing. Direct undelegated EOA traders are enrolled by the router. `registerWallet(address)` also lets an undelegated EOA register itself before or after sealing, with that same wallet as transaction origin. Smart wallets and contract treasuries require explicit receiving-only holder pins before sealing. These are substantial compatibility restrictions.

Register the hook, stability controller, inventory bond and Turf registry as `ProtocolCustody`. Register the swap router, arbitrage contract, paired PositionManager and Permit2 as `SettlementInput`. Register POL funding, reserve funding and the Turf fee bridge as mandatory receiving-only contract holders. These adapters and bridge approve their receiving contracts and do not need transfer authority. Other game custody contracts need their own explicit review and runtime pin before sealing. Arbitrary forwarding contracts, proxy implementations that can change underneath an operator pin, or general-purpose settlement operators undermine the restriction and must not enter the release policy.

PoolManager ERC6909 claims cannot be transferred or traded as substitute OMR. Unsupported deployed contracts and counterfactual contract addresses cannot directly receive native OMR through reviewed operators. The supported native LP guarantee excludes wrapped claims, custody IOUs, centralized books, internal ledgers and EIP-7702 delegation after a wallet has received tokens. The restricted manager admits only ETH/OMR pools and compatible registered hooks; operator or receiving-holder approval does not authorize independent managers.

## Staged deployment

1. Pin the reviewed source revision, compiler artifacts, chain snapshot, public roles and nonce owners. Predict the companion addresses using the explicit starting nonce; `polFunding` is needed in the manager constructor. The twelve companion deployments preserve their established order and append `OmertaSwapRouterV2`. A separate prerequisite deployment account avoids consuming companion nonces; if an account is reused, account explicitly for every prerequisite deployment before selecting `startingNonce`.
2. Deploy `OmertaRestrictedOMRV2(treasurySafe)`. Its fixed 100,000,000 OMR supply is minted to the Safe and must remain there until sealing. Set `roles.capitalProvider` to that same Safe. No pool, independent wallet or protocol custody contract may be prefunded before the seal: pre-seal funding of a foreign manager could create internal claims that trade after sealing without a token transfer. `sealPolicy()` rejects any genesis inventory outside the owner.
3. Deploy `OmertaPoolManagerV2(omr,owner,recipients)`, with recipients in founder/operations (`dev`)/RWA/community/POL order and POL equal to the predicted `polFunding` address. Deploy the reviewed PositionManager against this manager and the selected Permit2. A PositionManager bound to a public Uniswap manager is incompatible.
4. Supply the replacement token, custom manager, paired PositionManager and Permit2 as `external.omr`, `external.poolManager`, `external.positionManager` and `external.permit2`, each with reviewed actual runtime hashes. Generate the offline companion plan with schema 2. It emits unsigned inner Safe calls and direct public-caller transactions; it never contacts RPC, reads a signer, signs, simulates or broadcasts.
5. Deploy every companion and any additional reviewed custody/receiving contract. Complete its one-time game, season, bridge and controller bindings. Before manager binding, verify token ownership and policy ID, `operatorCount() == 0`, `contractHolderCount() == 0`, genesis Safe runtime identity, and that the Safe's balance equals the entire fixed supply with zero external inventory; manager OMR, fee and all four recipients; PositionManager manager/Permit2 pairing; every constructor binding and actual operator/holder runtime. The POL recipient must match the plan's deployed funding adapter.
6. Execute manager binding, operator registration and receiving-only holder registration as Safe calls. Fee and family treasury wallets that are neither genesis, operators nor approved holders self-register through direct unsigned EOA calls; verify live code is empty and the caller equals the transaction origin. Immediately before `sealPolicy()`, confirm the full supply still belongs to the Safe and compare both complete ordered registries. `operatorCount()` must equal nine plus additional operators; `operatorAt(index)`, `operatorRole` and `operatorRuntimeHash` must match manager first, eight required operators, then additions. `contractHolderCount()` must equal three plus additional holders; `contractHolderAt(index)` and `contractHolderRuntimeHash` must match POL funding, reserve funding, Turf bridge, then additions. Both enumerations include all ever-configured entries, including revoked ones; extra historical entries stop bootstrap. Verify every configured treasury is an allowed recipient. All twelve deployments precede these calls, and sealing precedes pool initialization, bootstrap approvals, LP minting and controller/bond funding. A faulty sealed policy cannot be repaired by an owner update; stop if any binding, inventory balance, registry entry or runtime differs.
7. Initialize the canonical pool through its authorized initializer, seed the explicitly funded bootstrap PositionManager position, revoke temporary allowances and wait for a complete healthy observation epoch. Fund the declared controller tranches and bond inventory through their typed calls. Reproduce the whole sequence on the intended chain fork and retain resulting balances, deltas and runtime/configuration evidence before release authorization.

Configure upkeep base-revenue jobs as `manager_claim` with the manager artifact/runtime and buckets 0–3, for each required currency. Keep `hook_claim` bucket 4 for opening/surge charges. POL delivery requires a manager bucket-3 sweep before the Core funding adapter's `funding_flush` can forward those assets.

Every `readiness` step is a required live-verification condition, not an executed transaction or a verified assertion from the offline generator. Complete the independent chain reads and comparisons before the next transaction; preserve their evidence alongside the unsigned plan.

All LP and protocol inventory funding happens after sealing through the approved typed operators: the Safe approves Permit2/PositionManager for bootstrap and authorizes the controller and bond to pull their declared inventory. An independent capital provider would require a separate reviewed distribution path after sealing; this plan provides none and rejects that role assignment.

## Public manifest changes

The offline planner rejects schema 1 and any manifest without the explicit restricted policy. Add:

```json
{
  "schemaVersion": 2,
  "restrictedMarket": {
    "policyId": "<32-byte policy ID>",
    "operatorRuntimeHashes": {
      "hook": "<actual runtime hash>",
      "controller": "<actual runtime hash>",
      "bond": "<actual runtime hash>",
      "turf": "<actual runtime hash>",
      "arbitrage": "<actual runtime hash>",
      "router": "<actual runtime hash>",
      "positionManager": "<actual runtime hash>",
      "permit2": "<actual runtime hash>"
    },
    "additionalOperators": [],
    "holderRuntimeHashes": {
      "polFunding": "<actual runtime hash>",
      "reserveFunding": "<actual runtime hash>",
      "turfFeeBridge": "<actual runtime hash>"
    },
    "contractHolders": []
  }
}
```

All runtime inputs are public nonzero 32-byte hashes. PositionManager and Permit2 hashes must match their external pins. Additional operators require distinct public `address`, `role: 2`, `runtimeHash` and an explicit custody `purpose`. Additional receiving-only holders require distinct public `address`, `runtimeHash` and receiving `purpose`; they cannot duplicate an operator, mandatory holder or genesis Safe. A contract treasury for developer, RWA, community or family fees belongs in this holder list. The planner does not infer additional transfer permissions.

Artifact `runtimeTemplateKeccak256` values with unresolved immutable substitutions are not deployed runtime evidence. Constructor-specific runtimes must be reproduced and reviewed, then checked against the actual deployed code before registration and sealing. The local-chain example deliberately uses synthetic hashes and is unsuitable for a funded release. Set opening `buyBps` to at most 50: the manager's permanent 500 bps plus the bounded canonical hook addition stays within the configured 550-bps ceiling, before LP fees and rounding.

## Migration and release boundary

Existing OMR, LP positions, fee claims, bonds and funded game obligations remain on their existing contracts. Do not strand those claims by pointing existing clients at replacement contracts, asserting that old balances became restricted OMR, or withdrawing reserves before their obligations are discharged. A migration needs explicit allocation, custody, reserve and claim reconciliation; this bootstrap plan performs none of those actions.

Review the new token, custom manager, router, operator policy and their actual deployment configuration under the [agent-led security review policy](../../SECURITY-REVIEW-POLICY.md). Pin source revision, scope and release phase; retain targeted proofs, settlement tests, fuzzing/invariant evidence, findings and retests. An unsigned plan or passing source tests does not establish production activation or clear a funded release.
