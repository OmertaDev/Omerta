# OMERTÀ Contracts — M6-A

Contracts for Robinhood Chain (Arbitrum Orbit L2, ETH gas; testnet chainId 46630, mainnet 4663). Chain-agnostic EVM — deployable unchanged to Arbitrum One/Base as fallback. See `omerta-chain-migration-evm.md` in the backend repo for the architecture.

The [2026-09-08 comprehensive review](audits/2026-09-08-comprehensive/report.md) covers all 40 local
production Solidity files, used external integrations, corrections, executed evidence and remaining
activation requirements. Its source and artifact manifests identify the reviewed working tree.
The subsequent [character mint allocation amendment](audits/2026-09-08-mint-dev-allocation/report.md)
changes only character mint revenue to 100% DEV and records its own validation. The earlier review
and historical testnet deployment retain their original source and fee policy.

| Contract | Role |
|---|---|
| `OMR.sol` | ERC-20 + Permit. Founding supply `100_000_000e18` goes to the Safe. One owner-selected minter is intended to be OmertaBond; the owner can revoke it or appoint another address, including itself. The owner-controlled sell tax applies to transfers into registered AMM destinations, has four recipients (operations, treasury, community and LP remainder), and is capped at 10%. It defaults to zero and stays zero on the canonical Hook venue. |
| `VoucherClaim.sol` | THE bridge. EIP-712 vouchers signed by the game server; replay-proof, deadline-bound, daily-capped, pausable, tranche-funded. Nothing mints. |
| `GearVault.sol` | ERC-1155 gear (one tokenId per gear class). Mints only via VoucherClaim, which is **fail-closed**: a gearId only mints up to a per-class supply cap the Safe sets (`vc.setGearSupplyCap`). |
| `OMRStaking.sol` | 14% APY (owner-set, 50% hard ceiling), pre-funded reward pool, principal always withdrawable. |
| `OmertaFees.sol` | The inbound entry/revive fee rail (§11). Character mint fees go 100% to `feeRecipient` (`DEV_WALLET`), exposed by `mintDevBps() == 10000`. Respawn, reroll and package fees retain their dev/Vig split. Forwards exact ETH fees in the same tx; custodies nothing, mints nothing; emits a nonce'd event the backend watches. |
| `IOmrOracle.sol` / `OmrTwapOracle.sol` | WALL 4's price feed. A Uniswap V2 cumulative-price **TWAP** (never spot — spot on a mint path is flash-loanable), behind a minimal swappable interface so the mint path stays reviewable and the feed can follow the canonical pool. `PERIOD` has a compile-time floor so a 30-second "TWAP" cannot be deployed; reports **no usable reading** until a full period has closed; `update()` is permissionless and **must be poked at least once per `maxOracleAge`** or bonding halts (a deliberate failure direction, and a real operational dependency). |
| `OmertaBond.sol` | Accepts ETH under an EIP-712 quote bound to its payer and mints the vested OMR commitment at purchase. Forwards ETH to POL, operations, treasury and Vig. Issuance is bounded by the signed quote, discount ceiling, absolute post-discount rate, fresh oracle-derived rate and configured daily cap (zero cap means unlimited). An inflated oracle cannot exceed the absolute ceiling but can loosen the oracle-derived bound; adequate market liquidity remains essential. Only surplus OMR is sweepable while commitments remain. Safe-owned and pausable, with bounded quote lifetime and vest duration. |

| `OmertaHook.sol` | The Uniswap **v4 sell tax**, charged INSIDE the swap (economy v3 step 6; design `../omerta-v4-hook-design.md`). Same economics as `OMR.sol`'s transfer tax — dev/rwa/lp, same 900 bps, same 10% compile-time cap, same remainder-on-LP rule — but taken in the **quote currency**, which removes the reflexivity: the old tax collected OMR that had to be SOLD to pay anyone, and each of those sales was pressure on the pool being taxed. **BUYS ARE FREE.** Three properties an auditor should attack first: (1) `beforeInitialize` is a **pool gate** — anyone can create a pool naming this hook, so without it a stranger could stand up an (OMR, WORTHLESS) pool and emit real `SellTaxTaken` logs with real tx hashes, i.e. fabricated revenue wearing the credential the backend's anti-fabrication gate trusts; (2) the fee **accrues and is swept separately** rather than forwarded in-tx like `OmertaFees`, deliberately — three pushes inside a swap means one reverting recipient bricks the pool; (3) **there is no pause**, because a hook that can revert `beforeSwap` can halt a public market — the only lever is the rate. Permissions are mined into the address (`HOOK_FLAGS`, checked in the constructor) and are IMMUTABLE, which is why an unused `beforeSwap`/fee-override slot and an event-driven `observer` seam ship on day one. Observer code runs only through `pokeObserver` after PoolManager settlement, never synchronously inside a swap. Exact-OUTPUT sells are taxed in OMR rather than the quote (v4 only lets `afterSwap` touch the unspecified currency) — parity with the tax it replaces, documented, not a bypass. |

## Test & deploy
```
./run-forge-test.sh  # one-shot: installs Foundry + deps, builds, runs the suite (recommended)
```
or manually:
```
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts   # first run only
forge test
cp .env.deploy.example .env     # fill reviewed values; .env is gitignored
forge script script/Deploy.s.sol:Deploy --rpc-url $CHAIN_RPC_URL --account omerta-deployer -vvvv
```

The deploy is intentionally staged: the pre-pool core, THE BANK, the post-pool TWAP, and the mined v4
hook each have their own script and verification gate. Follow [`DEPLOYMENT.md`](DEPLOYMENT.md) for the
complete dry-run, broadcast, Safe-wiring, backend activation, and rollback sequence. Never add
`--broadcast` until the identical simulation trace has been reviewed.
> The suite **also runs inside the sandboxed build environment** — `./run-forge-test-sandboxed.sh`
> (forge from the official npm dist, forge-std/OZ from npm, solc via a solc-js 0.8.26 stdio shim:
> the same compiler version+commit as native, plus `@uniswap/v4-core` for the hook). First executed
> 2026-07-23 at 73/73; **128/128 green** after the v4 hook. The runner now prefers the NATIVE solc
> binary when `binaries.soliditylang.org` is reachable — and needs it: the emscripten build runs out
> of heap compiling v4's `PoolManager`, so on a shim-only box every suite runs EXCEPT
> `OmertaHook.t.sol`. Current reviews use native solc and retain the full executed evidence under
> [SECURITY-REVIEW-POLICY.md](SECURITY-REVIEW-POLICY.md).
>
> Those figures are runner history, not the current tree census. The latest complete native run on
> 2026-08-27 passed **531/531 across 27 suites**. The 2026-09-08 tree has 32 top-level Solidity files plus
> eight dedicated interface files; see `DEPLOYMENT.md` for which artifacts have scripts and which
> reviewed slices remain deliberately dormant.

## Server-side signing parity (for M6-B, viem)
The chain service must produce signatures `VoucherClaim.claim` accepts:
```ts
import { privateKeyToAccount } from 'viem/accounts';
const account = privateKeyToAccount(process.env.VOUCHER_SIGNER_PK);
const chainId = await publicClient.getChainId(); // NEVER hardcode: the on-chain EIP-712
                                                 // domain uses the deployed chain's id, so a
                                                 // wrong constant makes every claim revert
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
`nonce` = the `vouchers.nonce` column (server-unique). Store `signed_payload`, hand `(voucher, signature)` to the client, watch `Claimed(nonce,...)` to set `claimed_onchain`.

### OmertaBond quote signing (backend `src/bonds.js` parity — mainnet wiring)
The bond service signs `BondQuote`s the contract accepts; domain `OmertaBond`/`1`, chainId from the live
chain (never hardcode), `verifyingContract` = the deployed `OmertaBond`. **On-chain/off-chain must not
drift:** the contract's immutable `polBps`/`devBps` == the backend `BONDS.POL_BPS`/`BONDS.DEV_BPS`, and `MAX_DISCOUNT_BPS` (2000) ==
`BONDS.MAX_DISCOUNT_BPS`. The backend prices `payout = principal × priceOmrPerEth / 1e18 × 1e4/(1e4−discountBps)`
(the exact integer math the contract recomputes), watches `Bonded(bondId, payer, nonce, principal, payout, toPol, toDev, toVig)`
→ `recordBond` (attributes/reconciles the bonder), and the `bond_reserve` tranche mirrors the on-chain
`committedOMR ≤ omr.balanceOf(bond)` cap.
```ts
const signature = await account.signTypedData({
  domain: { name: 'OmertaBond', version: '1', chainId, verifyingContract: OMERTA_BOND_ADDRESS },
  types: { BondQuote: [
    { name: 'payer', type: 'address' }, { name: 'principal', type: 'uint256' },
    { name: 'priceOmrPerEth', type: 'uint256' }, { name: 'discountBps', type: 'uint256' },
    { name: 'vestSeconds', type: 'uint256' }, { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' } ] },
  primaryType: 'BondQuote',
  message: { payer, principal, priceOmrPerEth, discountBps, vestSeconds, nonce, deadline },
});
```

## Before mainnet (non-negotiable)
Third-party audit of the exact release-frozen contract phase plus the signing service; launch review of Robinhood Chain ToS re: wagering-adjacent dApps; Safe signer ceremony; VoucherClaim's daily cap + OMR tranche, OmertaBond's `dailyCapOMR` + `maxOmrPerEth`, and the **per-gearId supply caps** (gear is fail-closed — no class mints until the Safe caps it) all set deliberately small for launch. The 2026-08-21 audit packet predates RegistryV2, the settlement-gas pool, and the O1 AcquisitionVault base; refresh it before engagement and do not deploy incomplete/dormant slices.

⚠ **Point the auditor at tokenomics v2 step 4 explicitly.** Until 2026-07-29 this suite's headline
property was "nothing mints", and every prior review leaned on it. OMR now has a mint path and bonds
use it. What must be reviewed as new: `OMR.minter` (single path, owner-set, no owner mint),
OmertaBond's four walls, and `OmrTwapOracle`. **The single highest-value thing to attack is the
composition of walls 3 and 4** — a price feed on a mint path is normally the softest link, and the
claim here is that it cannot be: `maxOmrPerEth` is checked independently, so a manipulated oracle can
only tighten the bound. Break that and the mint is unbounded. Also worth attacking: the TWAP itself
(pool depth vs window length), and the keeper dependency (`update()` must be poked within
`maxOracleAge` or bonding halts).

## Internal red-team pass (see `../AUDIT-contracts.md`)
Patched: gear mints are now bounded per class (was uncapped — a compromised signer could mint unlimited gear); GearVault is Safe-owned from deploy (no hot-deployer window); a `MAX_VOUCHER_TTL` deadline backstop; and the signer snippet no longer hardcodes a chainId. The OMR rail, EIP-712/replay, reentrancy, and staking pool-separation were reviewed and found sound. Accepted-as-designed (Safe is root of trust): sweep/pause, global daily-cap contention, APY-change retroactivity. The suite compiles clean (solc 0.8.26 + OZ 5.6.1 + forge-std, 0 warnings) but the producing environment had no `forge` — run `forge test` locally to execute the VM assertions.
