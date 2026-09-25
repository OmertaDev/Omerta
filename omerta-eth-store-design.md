# The Store — ETH revenue packages (build spec)

Founder-directed 2026-07-19 ("Build the eth revenue packages"). Realizes §3 of
`omerta-the-wire-and-revenue-design.md` (the revenue-engine brainstorm) as a concrete, buildable
system. Off-chain-first, chain-dormant (the M6 pattern), **§10.4-neutral by construction**, mainnet
gated on the launch checklist + a third-party audit of contracts AND the payment signer.

## The one design decision that makes this safe

**The Store grants ONLY non-§10.4 things** — entitlements (`mint_credit`, `respawn_token`), access
windows (`pass_until`, `wire_until`), and status/cosmetic flags (`patron`). It **never** grants cash,
$OMR, gear, or any sim-audited power. Consequences:

1. **§10.4 is untouched.** The Store writes ZERO `transactions` rows — the entitlements it grants
   are already outside the in-game conservation set (the `fees.js` precedent: `mint_credits`/
   `respawn_tokens` have always been out-of-band). No new faucet, no new bucket, no vocabulary change,
   no invariant change. A full Store purchase leaves `$OMR conservation` / cash / every §10.4 check
   at drift-0 — proven in the test.
2. **Anti-pay-to-win.** Nothing bought with ETH gives combat/economic advantage a skilled free player
   can't match. Revive insurance, a mint credit, an intel subscription, and a status badge are
   consumables / access / cosmetics — never raw power (the guardrail from the parent design).
3. **Nothing gated is on the shelf.** ETH buys cosmetics, status, access, and bounded consumables — never tokens,
   never stock, never RWA-by-chance. The gated surface stays confined to the one gated
   withdrawal boundary that already exists.

## Revenue routing

Store receipts follow source-specific payment routing and backend accounting in `src/store.js`.
Verify the selected `OmertaFees` recipient/router and runtime split together: a ledger earmark is
not custody of ETH in another wallet. Community, Vig and treasury allocations require actual funds
and their own acquisition or distribution authority. Character creation has a separate 100%
developer-revenue policy; do not apply a Store split to it.

The canonical market's sell fees, inventory-bond proceeds and Turf fees have their own routing in
the [market design](omerta-contracts/docs/market/DESIGN.md). Store checkout does not change those
allocations or authorize new token issuance.

## The packages (`STORE.PACKAGES`, rules.js tail — all sign-off levers)

| SKU | Price (ETH) | Grants | Kind |
|---|---|---|---|
| `made_man` | 0.01 | +1 mint credit (spend → the extract gate) | consumable/access |
| `revive_3` | 0.25 | +3 respawn tokens (vs 0.10 ea — a bundle discount) | consumable |
| `revive_5` | 0.40 | +5 respawn tokens | consumable |
| `wire_month` | 0.03 | +30d Street Wire (`wire_until`) — the ETH intel sub | access |
| `season_pass` | 0.05 | +30d `pass_until` + 2 respawn tokens + the `patron` badge while active | access/status/consumable |
| `patron` | 0.10 | permanent `patron` status badge (the Vanity flex) | status |

All grants are entitlements / access windows / status → §10.4-neutral. `pass_until` + `patron` live on
`account_persistent` (survive death — a real-money purchase carries to the heir, the mint precedent).
`wire_until` is the existing character column. Consumables (`respawn_tokens`, `mint_credits`) already
exist. Store checkout grants no cash/OMR directly. The separate implemented pass track in
`src/pass.js` includes specified OMR reward tiers: claims accrue an entitlement and settle only
as its backing pool funds. Pass access is not an unconditional stipend or guaranteed return.

## The mechanism (the `fees.js` twin, `src/store.js`)

- `recordStorePurchase(pool, { nonce, sku, payer, amountWei, txHash })` — the ingestion the watcher
  calls when a `StorePaid` event fires. Idempotent on `store_payments.nonce` (a re-delivered event is a
  no-op; 23505 → `{duplicate}`). Inside the txn: `splitRevenue` (buyback → `vig_revenue`, rwa →
  `rwa_revenue`), then — if the payer's wallet is linked AND the payment carried value — `grantPackage`
  now; else the row waits (`account_id` NULL, `granted` false) for reconcile-at-link.
- `reconcileStore(pool, accountId, address)` — called right after SIWE links a wallet (and swept
  periodically by the worker): claim-then-grant atomically (`UPDATE … WHERE NOT granted RETURNING`, the
  fee-reconcile precedent — exactly-once, race-safe, case-insensitive address match).
- `grantPackage(client, accountId, sku)` — applies the SKU's grant to `account_persistent` (+ the
  character's `wire_until` for the wire package), logs a `store_grants` row, notifies the player.
  Consumables ADD; `patron`/`pass` are set/extended (the retainer precedent — extend from the later of
  now / current end). Headless (direct SQL — the fees.js discipline; no in-memory `h` clobber).
- `storeBoard` / `storeStatus` — the catalog + your live entitlements. `revenueStatus` — the founder's
  three-way split totals for the ops dashboard.

## The chain layer (dormant, the milestone after the launch checklist + audit)

On-chain, `OmertaFees` gains a generic `payForPackage(bytes32 sku)` that enforces a per-SKU price,
forwards the ETH to the dev wallet, and emits `StorePaid(nonce, sku, payer, amount)` — the `MintFeePaid`
twin. The watcher gains a dormant `storeLogs` observer (inert unless `OMERTA_FEES_ADDRESS` + the event
are wired) that calls `recordStorePurchase`. **Neither is built this drop** (the contract needs the
Foundry toolchain + the third-party audit that already gates mainnet). This drop delivers the full
backend + a **mod comp/simulate route** (`POST /v1/mod/store/grant`, mod-key) that drives
`recordStorePurchase` with a synthetic nonce — for comps, QA, and until the paywall ships. The test
drives `recordStorePurchase` directly (the `test/chain.js` fee precedent).

**Comp vs real payment (revenue is gated on a `txHash`).** The revenue split is recorded ONLY when the
payment carries a `txHash` — i.e. a REAL on-chain `StorePaid` event (the watcher always passes the tx).
A **comp** through the mod route (no `txHash`) grants the entitlement but records ZERO Vig buyback
basis. Without this, a free comp would fabricate real-ETH "revenue" that `runVigBuyback` (which sums
`vig_revenue` across all sources) could then spend, unbacking the withdrawal reserve on the real-money
side. So: real ETH → revenue + grant; comp → grant only.

## §10.4 / invariants

- The Store writes zero `transactions` rows (ETH + entitlements are out-of-band). No new §10.4 reason,
  no vocabulary change. The test asserts a full purchase → drift-0 on every §10.4 check.
- The buyback share rides the existing `vig_revenue` → `runVigInvariants` already covers it
  (`spend ≤ revenue` now includes Store revenue).
- New: `rwa_revenue` is recorded-only (R2 dormant). A light assertion in `runVigInvariants` (or a note)
  that it's never spent until R2 ships.

## Deferred (post-this-drop, ranked)

1. The on-chain `OmertaFees.payForPackage` + the watcher `storeLogs` wiring (the mainnet milestone).
2. ~~PLEX-for-packages (pay a SKU's fee from earned $OMR — the `vig.js:payPlex` pattern, per-SKU).~~
   **BUILT** — `payPackagePlex` / `plexPackageQuote`; every SKU is payable in earned $OMR, priced
   `max(floor, feeEth × the buyback oracle × premium)` off the ONE genesis rate. Retired wholesale on
   2026-08-10 and restored the same day for everything but a mint credit; the `made_man` SKU (which
   sold one) was retired outright rather than left on a second, schedule-free ETH price.
3. ~~The Season Pass reward *track* (tiered claims) + a per-pass prize-pool $OMR stipend.~~ **BUILT** —
   `src/pass.js` (THE LEDGER): a 12-tier daily-claim track; status/consumable rewards + a backed $OMR
   stipend through `Vig.payPrizes` (pool-bounded, funded by the pass's own buyback share). See CLAUDE.md.
4. Named landmarks / Founder's charter numbers (whale status flexes — more `store_grants` SKUs).
5. R2: the rwa_revenue → real-RWA-buy bot + the reserve that backs Dynasty shares (launch-gated).

All prices/splits are founder sign-off levers — sim + sign-off into BALANCE.md before production.
