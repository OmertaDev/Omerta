# OMERTÀ contracts

The Solidity suite contains the game's token, payments, assets, Bank and market contracts.
Start with the [current market design](docs/market/DESIGN.md) and
[market deployment runbook](docs/market/RUNBOOK.md) for the canonical ETH/OMR market.
The [core deployment runbook](DEPLOYMENT.md) identifies the separate deployment and activation
requirements for other rails. Source availability does not mean a contract is deployed or funded.

## Contract map

| Area | Implementation and role |
| --- | --- |
| Canonical market | `src/market-v2/`: hook settlement and tax buckets, finalized observations, finite stability reserves, funded inventory bonds, arbitrage, seasonal Turf and player liquidity commitments. See the [market design](docs/market/DESIGN.md). |
| Token | `OMR.sol`: ERC-20 with permit, a founding supply of `100_000_000e18`, one owner-selected minter and a capped transfer-tax path. Leave `ammPairs(PoolManager)` false for the canonical hooked market to avoid taxing settlement twice. |
| Withdrawals and gear | `VoucherClaim.sol` transfers prefunded OMR or requests bounded gear minting. `GearVault.sol` enforces its own per-class live-supply caps. Voucher replay protection, deadlines, daily limits and funding remain required. |
| Staking | `OMRStaking.sol` pays rewards from a prefunded pool and preserves principal withdrawals. |
| Payments | `OmertaFees.sol` forwards character mint fees entirely to `feeRecipient` (`DEV_WALLET`). Non-mint payments use their configured dev/Vig split or reviewed `FeeRevenueRouter` binding. |
| Character and street assets | `DynastyNFT.sol` and `StreetDeed.sol` use deployment-scoped signed authorizations, replay protection and issuance limits. |
| Bank | `Denari.sol`, `Alchemist.sol`, `CollateralEscrow.sol`, `Transmuter.sol` and `BankBufferVault.sol` provide denomination-matched debt, individual collateral custody and bounded redemption. Activation requires reviewed dependencies and actual reserves. |
| Revenue and liquidity operations | `ProtocolLiquidityVault.sol`, `LiquidityBuybackExecutor.sol`, `FeeRevenueRouter.sol`, `KeeperGasVault.sol` and `GenesisLifecycleController.sol` have separate custody and operating bounds. See [liquidity automation](LIQUIDITY-AUTOMATION.md). |
| Existing bond and oracle rail | `OmertaBond.sol`, `GenesisOracle.sol`, `OmrTwapOracle.sol`, `OmrV4TwapOracle.sol` and `OmertaHook.sol` remain dependencies of the core/genesis scripts and backend. Their obligations and permissions are separate from the inventory-funded market bonds. |
| Stock and acquisition modules | Registry, custody, health, settlement-gas and acquisition components retain the readiness and activation gates described in [deployment](DEPLOYMENT.md). Incomplete acquisition outflow paths must not be funded. |

Source, ABI, environment and typed-data identifiers are exact integration names. Their suffixes do
not name separate editions of the game. External protocol names such as Uniswap v4 identify actual
protocol dependencies.

## Build and test

Use the repository's pinned dependencies and Solidity 0.8.26 compiler settings:

```sh
cd omerta-contracts
forge test
```

The native helper `./run-forge-test.sh` installs the toolchain and dependencies when needed.
`./run-forge-test-sandboxed.sh` provides the constrained-environment alternative; the solc-js
fallback can exhaust its heap on PoolManager, so complete verification needs the native compiler.
See the [market runbook](docs/market/RUNBOOK.md) for targeted market and operator checks.

For a core deployment simulation, fill reviewed values in `.env.deploy.example` and follow
[DEPLOYMENT.md](DEPLOYMENT.md). The core, Bank, oracle, hook and market plans have separate inputs
and gates. Broadcast only the exact reviewed and simulated release configuration.

## Server-side signing parity

The chain service must produce signatures accepted by `VoucherClaim.claim`:

```ts
import { privateKeyToAccount } from 'viem/accounts';
const account = privateKeyToAccount(process.env.VOUCHER_SIGNER_PK);
const chainId = await publicClient.getChainId();
const signature = await account.signTypedData({
  domain: { name: 'OmertaVoucherClaim', version: '1', chainId,
            verifyingContract: VOUCHER_CLAIM_ADDRESS },
  types: { Voucher: [
    { name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' },
    { name: 'kind', type: 'uint8' }, { name: 'gearId', type: 'uint256' },
    { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint256' } ] },
  primaryType: 'Voucher',
  message: { to, amount, kind, gearId, nonce, deadline },
});
```

Read the chain ID from the intended chain and use that deployment's verifying contract. Persist the
server-unique `vouchers.nonce` and `signed_payload`; confirmed `Claimed` events reconcile the claim.
Typed-data domain versions are replay-protection inputs and must match the deployed contract.

`src/bonds.js` signs `BondQuote` values under domain `OmertaBond` / `1`. Match the deployed immutable
split, discount and rate bounds. The quote fields are `payer`, `principal`, `priceOmrPerEth`,
`discountBps`, `vestSeconds`, `nonce` and `deadline`, all `uint256` except the address `payer`.
The complete event is
`Bonded(bondId,payer,nonce,principal,payout,toPol,toDev,toRwa,toVig)`.
Committed OMR remains reserved for claims. A fresh oracle cannot override `maxOmrPerEth`; a
manipulated oracle can loosen its own price bound only up to that independently checked ceiling.

## Release evidence

Follow [SECURITY-REVIEW-POLICY.md](SECURITY-REVIEW-POLICY.md) for source-pinned agent-led review,
executed tests, static-analysis triage, retained findings and deployment verification. Contract,
signer, Safe, funding and operational checks apply to the exact release scope.

The [comprehensive review](audits/2026-09-08-comprehensive/report.md),
[liquidity automation review](audits/2026-09-08-liquidity-automation/report.md) and
[character mint allocation review](audits/2026-09-08-mint-dev-allocation/report.md) retain their
original source manifests and dates. They are evidence for those revisions, not a current-tree
contract census or blanket release approval. [Character activation](CHARACTER-NFT-LAUNCH.md) and
[genesis launch](GENESIS-LAUNCH.md) have their own concrete release requirements.
