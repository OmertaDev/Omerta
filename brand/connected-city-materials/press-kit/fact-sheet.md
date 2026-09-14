# Omertà — press fact sheet
Prepared 14 September 2026. Verify availability before publication.

## One sentence
Omertà connects a crime-game world with explicit rules for materials, shared evidence and a proposed canonical market.

## 50-word boilerplate
Omertà is a crime-game world built around connected systems. Its World Graph tracks materials and crafting; its Coordination Engine pilots shared investigations with independent evidence. The Market V2 candidate defines canonical-market fees, finite reserves and family interests. Availability differs by system, with implementation and deployment status stated throughout this kit.

## Product facts
- Market V2: implementation candidate; not deployed or funded.
- Canonical pool base sell fee: 9% — developer 2%, RWA recipient 1.6%, community 2.4%, protocol liquidity 3%. Surge adds 0–1%; LP fees are additional. Independent pools have their own policies.
- Companion contracts cover finite reserves, inventory bonds, solver-funded arbitrage, Turf fee rights and liquidity commitments. These are candidate mechanisms, not statements of live availability or returns.
- World Graph Phase 1: implemented. Conserved materials, salvage, crafting, unique items, a mystery and a four-account Crew operation. Phase 2A in development. NFT export is not live.
- World Graph Phase 1 is OMR-neutral. Hardened steel crafting consumes $300 of game cash.
- Coordination Phases 00–01: implemented for review. Value-neutral, default-off API pilots. Private investigations, original discoveries, deliberate sharing and current access checks.
- Coordination does not yet supply a dedicated graphical console; later delegation and economic adapters are planned.

## Demonstration evidence
The narrated walkthrough uses actual local repository handlers and pg-mem with synthetic accounts. All 24 captured API responses returned HTTP 200. The demonstrated Split Ledger ended completed. It is an API demonstration, not a recording of a production graphical interface. Full responses are in ../walkthrough/evidence.json.

## Official links
- Website: https://www.omerta.fun
- Updates: https://x.com/OmertaOnRH
No press email or named spokesperson has been supplied.

## Source basis
- omerta-contracts/docs/market-v2/DESIGN.md and RUNBOOK.md
- SPEC.md, World Graph Phase 1 / Phase 2A sections
- docs/coordination-engine/README.md
- Captured local API responses included in this package
Repository state may include working changes; this package is not a release attestation.
