# UX production release candidate — 2026-10-25

Base: origin/main at c6247976ff71e8d4c103ebd1498c2d373217d077.
This isolated candidate ports UI/UX improvements1–150 onto the current production
source lineage. The older shared checkout was not copied wholesale, and the frozen
tokenomics review checkout was not modified. Existing game rules, current car/goods behavior,
command/projection routing, dependencies and lockfile are preserved.

The runtime additions are presentation modules, authorized reading/planning APIs,
Circle highlights, a parity-tested consumable preview helper, and seven additive
metadata tables. No contract, chain activation, environment, worker program,
liquidity or gameplay-economic configuration is changed.

## Verification

- New UX backend and model suites pass against the modern base.
- Original economy/items, migration and client compatibility checks are retained.
- Native PostgreSQL18.4: pgcheck221 passed/0 failed.
- Native load proof:8 players/20seconds,3633 operations, no5xx/pool failures/deadlocks,
  and all133 conservation checks unchanged.
- Native UX proof: owner isolation, concurrent workspace CAS, current Crew gates,
  private metadata, exact-character avatar consent and unchanged gameplay state.
- Actual RLS: all seven populated UX tables deny SELECT/INSERT/UPDATE/DELETE to an
  explicitly granted NOSUPERUSER/NOBYPASSRLS role, while owner APIs remain usable.
- Tactics projections use the actual current model: no invented street-job cooldown;
  two consecutive real crime API actions match the current published quote.
- Browser coverage includes all150 improvements plus the current main navigation,
  Fieldwork, desktop/mobile, private synchronization and successor boundaries.
- CI retains the existing release gates and adds UX browser and PostgreSQL proofs.
- The separate source qualification reconstructs all eight guarded files to the
  exact main predecessor: 53 Git inverse hunks, 32 positive and 314 refusal probes.
  Independent review and 12 additional tamper probes passed; older pins are retained.
  This source proof grants no runtime, native, contract or deployment clearance.

## Deployment status

Prepared for production deployment. Render requires an explicit workspace choice
because its connected session has no selected workspace. No deploy has been
triggered by this preparation. The public baseline at https://www.omerta.fun/health
returned200 with db up; the new /ux-feedback.js asset was not yet present.
The authored UX checkpoint is 940df6a1efbe4ddcd8301cd138d5643dbe48a0bc.
The complete CI run remains a release requirement before production deployment.

After workspace confirmation, record the exact published commit and both API/worker
deploy IDs, wait for live status, then verify health, static modules and API auth.
