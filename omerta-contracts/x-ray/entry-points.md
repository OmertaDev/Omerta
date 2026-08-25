# Entry Point Map

> OMERTA contracts | state-changing public/external surfaces only | current source tree

## Protocol Flow Paths

### Bank setup (Safe)

`Denari.setMinter(Alchemist)` → `Denari.setBurner(Transmuter)` → `Transmuter.setFunder(Alchemist,true)` → `Transmuter.fund()` → `Alchemist.setMintCaps()`

### Bank user flow

`[bank setup above]` → `Alchemist.deposit(assets,minSharesOut)` → next block → `Alchemist.mint()`
                                                      ├─→ `Alchemist.repay()`
                                                      ├─→ `Alchemist.harvest()`
                                                      └─→ `Alchemist.withdraw()` ◄── debt remains within LTV

`DNR.approve(Transmuter)` → `Transmuter.redeem()` ◄── tracked reserve and flow-cap capacity exist

### Bond flow

`OMR.setMinter(OmertaBond)` → `OmertaBond.setSigner()` → `OmertaBond.setOracle()` → backend signs quote → `OmertaBond.bond()` → vesting time passes → `OmertaBond.claim()`

### Voucher and asset flow

`GearVault.setMinter(VoucherClaim)` → signer configured → backend signs voucher → `VoucherClaim.claim()` → `GearVault.mint()`

`StreetDeed.claim()` → holder sets transfer lock → transfer or `StreetDeed.redeem()`

`DynastyNFT.claim()` → normal ERC-721 transfer

### Market and treasury flow

`v4 PoolManager.initialize()` → `OmertaHook.afterInitialize()` → `beforeSwap()` → PoolManager swap → `afterSwap()` → `ObservationRequested` → keeper `pokeObserver()` → `OmertaHook.sweep()`

`OmertaFees.pay*()` → immediate ETH forwarding; `StockVault.deliver()` → pre-held ERC-20 transfer.

---

## Permissionless

### `Alchemist.deposit(uint256,uint256)`

| Aspect | Detail |
|---|---|
| Visibility | external, nonReentrant, onlyAllowedCaller |
| Caller | EOA or allowlisted contract |
| Parameters | assets and mandatory `minSharesOut` (user-controlled) |
| Call chain | exact asset receipt → `CollateralEscrow.deployToVault` → measured ERC-4626 share delta → caller floor |
| State modified | escrowOf, principalOf, lastEntryBlock |
| Value flow | asset: caller → escrow → ERC-4626 vault |
| Reentrancy guard | yes |

### `Alchemist.withdraw(uint256)`

| Aspect | Detail |
|---|---|
| Visibility | external, nonReentrant, onlyAllowedCaller, next-block gated |
| Caller | depositor |
| Parameters | assets (user-controlled) |
| Call chain | `Alchemist.withdraw → CollateralEscrow.withdraw → ERC4626.withdraw` |
| State modified | principalOf |
| Value flow | asset: ERC-4626 vault → caller |
| Reentrancy guard | yes |

### `Alchemist.mint(uint256)`

| Aspect | Detail |
|---|---|
| Visibility | external, nonReentrant, onlyAllowedCaller, next-block gated |
| Caller | depositor |
| Parameters | debtAmount (user-controlled) |
| Call chain | pre-buffer check → LTV/caps → `Denari.mint` → post-issuance buffer check |
| State modified | debtOf, mint flow meter, DNR supply |
| Value flow | newly minted DNR → caller |
| Reentrancy guard | yes |

### `Alchemist.repay(uint256)`

| Aspect | Detail |
|---|---|
| Visibility | external, nonReentrant |
| Caller | debtor |
| Parameters | assets (user-controlled) |
| Call chain | `Alchemist.repay → asset.safeTransferFrom → Transmuter.fund` |
| State modified | debtOf, Transmuter.reserves |
| Value flow | reserve asset: caller → Transmuter |
| Reentrancy guard | yes |

### `Alchemist.harvest(address)`

| Aspect | Detail |
|---|---|
| Visibility | external, nonReentrant |
| Caller | any address |
| Parameters | user (user-controlled target) |
| Call chain | `Alchemist.harvest → CollateralEscrow.withdraw → Transmuter.fund` |
| State modified | debtOf[user], accruedFees, principal/yield position |
| Value flow | yield asset: escrow → Transmuter and Alchemist fee balance |
| Reentrancy guard | yes |

### `Alchemist.sweepFees()`

| Aspect | Detail |
|---|---|
| Visibility | external, nonReentrant |
| Caller | any address |
| Parameters | none |
| Call chain | `Alchemist.sweepFees → asset.safeTransfer` |
| State modified | accruedFees |
| Value flow | asset: Alchemist → configured recipient |
| Reentrancy guard | yes |

### `Transmuter.redeem(uint256)`

| Aspect | Detail |
|---|---|
| Visibility | external, nonReentrant |
| Caller | DNR holder |
| Parameters | debtAmount (user-controlled) |
| Call chain | `Transmuter.redeem → DNR.safeTransferFrom → Denari.burn → asset.safeTransfer` |
| State modified | reserves, redeem flow meter, DNR supply |
| Value flow | DNR: caller → burn; reserve asset: Transmuter → caller |
| Reentrancy guard | yes |

### `OMRStaking.stake/unstake/claimRewards/fundRewards`

| Aspect | Detail |
|---|---|
| Visibility | external; user exits/claims are nonReentrant |
| Caller | OMR holder or reward funder |
| Parameters | amount (user-controlled) |
| Call chain | `entry → _updateRewardIndex → _accrue → OMR.safeTransfer*` |
| State modified | rewardIndex, staked, totalStaked, pending, rewardPool |
| Value flow | OMR into/out of staking custody |
| Reentrancy guard | stake, unstake, claim: yes; fundRewards: no |

### `OmertaBond.bond/claim`

| Aspect | Detail |
|---|---|
| Visibility | external payable/nonpayable, nonReentrant |
| Caller | signed quote recipient / bond owner |
| Parameters | quote (backend-signed), signature; bondId (user-controlled) |
| Call chain | `bond → oracle.consult → OMR.mint → ETH recipients`; `claim → OMR.safeTransfer` |
| State modified | used quote, flow meter, bonds, committed/claimed totals |
| Value flow | ETH to four recipients; OMR held then released to owner |
| Reentrancy guard | yes |

### `VoucherClaim.claim`, `DynastyNFT.claim`, `StreetDeed.claim`

| Aspect | Detail |
|---|---|
| Visibility | external, nonReentrant, whenNotPaused |
| Caller | any submitter; destination and entitlement are backend-signed |
| Parameters | voucher (backend-signed), signature |
| Call chain | `claim → ECDSA.recover → token transfer/mint` |
| State modified | used digest, daily flow; NFT ownership/metadata where applicable |
| Value flow | prefunded OMR or newly minted ERC-721/ERC-1155 to signed recipient |
| Reentrancy guard | yes |

### `GearVault.redeem`, `StreetDeed.setTransferLock/redeem`

| Aspect | Detail |
|---|---|
| Visibility | external |
| Caller | token holder/owner |
| Parameters | tokenId and amount/lock state (user-controlled) |
| Call chain | `entry → ERC token burn/update` |
| State modified | token balances/ownership, StreetDeed transferLocked |
| Value flow | token is burned; none leaves protocol custody |
| Reentrancy guard | no |

### `OmertaFees.payMintFee/payRespawnFee/payRerollFee/payForPackage`

| Aspect | Detail |
|---|---|
| Visibility | external payable, nonReentrant |
| Caller | user |
| Parameters | sku where applicable (user-controlled); exact ETH value required |
| Call chain | `pay* → _forward → recipient.call` |
| State modified | no persistent accounting beyond events |
| Value flow | ETH: caller → fee/vig recipients |
| Reentrancy guard | yes |

### `OmertaHook.sweep(Currency)`

| Aspect | Detail |
|---|---|
| Visibility | external |
| Caller | any address |
| Parameters | currency (user-controlled) |
| Call chain | `sweep → Currency.transfer` to configured recipients |
| State modified | owed[currency] zeroed |
| Value flow | accrued currency: hook → fixed recipients |
| Reentrancy guard | no; checks-effects-interactions ordering |

### `OmrTwapOracle.update()`

| Aspect | Detail |
|---|---|
| Visibility | external |
| Caller | any address after PERIOD |
| Parameters | none |
| Call chain | `update → pair cumulative/reserve reads` |
| State modified | cumulative snapshots, average, lastUpdate |
| Value flow | none |
| Reentrancy guard | no |

---

## Role-Gated

### Denari issuer roles

| Contract | Function | Caller | State / value flow |
|---|---|---|---|
| Denari | `mint(to,amount)` | minter | DNR supply and recipient balance increase |
| Denari | `burn(from,amount)` | burner | DNR supply and selected balance decrease |

### Gear issuer role

| Contract | Function | Caller | State / value flow |
|---|---|---|---|
| GearVault | `mint(to,id,amount)` | minter | Lifetime redeemed counter and ERC-1155 balance increase |

### Stock keeper role

| Contract | Function | Caller | State / value flow |
|---|---|---|---|
| StockVault | `deliver(id,token,to,units)` | keeper | One delivery ID and one daily counter; held token exits |
| StockVault | `deliverBatch(ids,tokens,tos,units)` | keeper | Repeats `_deliver` atomically across arrays |

### Transmuter funder role

| Contract | Function | Caller | State / value flow |
|---|---|---|---|
| Transmuter | `fund(assets)` | allowlisted funder | Reserve asset enters and tracked reserves increase |

### v4 PoolManager callbacks

| Contract | Function | Caller | State / value flow |
|---|---|---|---|
| OmertaHook | `beforeInitialize/afterInitialize` | PoolManager | Quote allowlist validated; pool opening recorded |
| OmertaHook | `beforeSwap/afterSwap` | PoolManager | Anti-snipe/surge state read; tax accrued and taken |

---

## Admin-Only

All entries below are immediate `onlyOwner` calls; ownership uses OpenZeppelin two-step transfer where inherited.

| Contract | Functions | State Modified |
|---|---|---|
| Alchemist | `setLtvBps`, `setHarvestFee`, `setMintCaps`, `setAllowedContract` | risk limits, fee route, flow caps, contract caller allowlist |
| Denari | `setMinter`, `setBurner` | singular issuance/redemption roles |
| Transmuter | `setFunder`, `setBufferFloorBps`, `setRedeemCaps`, `setAllowedContract` | reserve ingress, buffer, flow caps, caller allowlist |
| OMR | `setMinter`, `setSellTax`, `setTaxRecipients`, `setPair`, `setExempt` | issuer and transfer-tax policy |
| OMRStaking | `setApy` | reward index checkpoint then rate |
| OmertaBond | `setDailyCap`, `setMaxRate`, `setOracle`, `setSigner`, `setRecipients`, `pause`, `unpause`, `sweep`, `sweepETH` | issuance walls, trust roots, pause and surplus recovery |
| GenesisOracle | `setPrice` | genesis price/window |
| VoucherClaim | `setSigner`, `setDailyCap`, `setGearSupplyCap`, `pause`, `unpause`, `sweep` | signature root, caps, pause, surplus OMR |
| GearVault | `setMinter`, `setGearCap`, `setImageBase`, `setClassName(s)` | issuer, live caps, metadata |
| DynastyNFT | `setSigner`, `setDailyMintCap`, `setBaseUri`, `setDefaultRoyalty`, `pause`, `unpause` | signature root, cap, metadata/royalty, pause |
| StreetDeed | `setSigner`, `setDailyMintCap`, `setImageBase`, `setExternalBase`, `pause`, `unpause` | signature root, cap, metadata, pause |
| StockVault | `setKeeper`, `setDailyCap`, `setDefaultDailyCap`, `pause`, `unpause`, `sweep` | operator, per-token limits, pause, arbitrary held-token recovery |
| OmertaFees | `setFeeRecipient`, `setVigRecipient`, `setFees`, `setRerollFee`, `setPackagePrice`, `sweep` | recipients, exact prices, forced-balance recovery |
| OmertaHook | `setSellTax`, `setRecipients`, `setAllowedQuote`, `setObserver`, `setAntiSnipe`, `setSurge` | swap tax, recipients, initialization allowlist, callback, launch controls |
