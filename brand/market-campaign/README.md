# OMERTÀ Market — The city has a treasury.

Current market implementation campaign: five vector diagrams, three eight-post X threads and six standalone posts. The market is an implementation candidate, not deployed or funded. No posts are scheduled or published by this package.

Open `index.html` for the diagrams, post copy, attachment links and alt text. The noir palette uses black, ivory, brass and muted teal.

| Graphic | Subject |
| --- | --- |
| `png/04-tax-map.png` | 9% base sell fee, allocations and separate surge |
| `png/05-seven-compartments.png` | Core, cushions, Garrison, Desk, War Chest and Turf |
| `png/06-inventory-bonds.png` | Funded inventory, reserved entitlement and linear vesting |
| `png/07-arbitrage.png` | Solver capital, two pools and realized trading-profit split |
| `png/08-fee-rights.png` | Protocol principal, family fee rights and historical checkpoints |

All diagrams are 1080 × 1350. Portable outlined SVGs are in `svg/`; editable layout instructions are in `build-infographics.mjs`.

`copy.mjs` holds the structured post copy. `X-THREADS.md` is the editorial copy bank; `POSTS.txt` and `POSTS.csv` provide exports. `manifest.json` records asset hashes, and `validation.json` records attachment and post-length checks. All 30 posts fit within 280 characters. Revalidate after adding copy or links.

The canonical base sell fee is 9%: 2% developer, 1.6% RWA recipient, 2.4% community and 3% protocol liquidity. Additional surge is bounded at 0–1% and routed to stability. LP fees are additional. Families receive allocated, funded LP fees and no authority over principal.

Claims follow the current [market design](../../omerta-contracts/docs/market/DESIGN.md) and [runbook](../../omerta-contracts/docs/market/RUNBOOK.md). Verify release status and parameters before publication. The copy makes no promises of a guaranteed floor, APY, token appreciation, universal tax or unlimited reserves.

Rebuild from the repository root:

```powershell
node brand/market-campaign/build-infographics.mjs
node brand/market-campaign/build-package.mjs
node brand/market-campaign/previews/serve.mjs
```

Rendering uses the installed `@resvg/resvg-js` dependency and the Windows fonts named in the script. The preview server binds `127.0.0.1:8814` and does not publish content.
