# Deadline-aware business planning implementation plan

> For agentic workers: use superpowers:executing-plans. Track RED/GREEN verification.

**Goal:** Reconcile PR #208 into current main without weakening shadow-only authority or newer commitment protection.
**Architecture:** Extend the existing pure business-policy evaluator and its CLI. Sequential awarded work reserves time before potential pending awards and new bids. Keep funds, duty, detail, and pending-bid gates unchanged.
**Tech Stack:** Node.js ES modules and native assertion tests.
**Spec:** PR #208 at 69c24125c89db5a8c609477051e3cb2bfdf0afcd and current-main safeguards at 0a45705bb34acb5a0a9b620802e042eaa4609259; parent authorized execution.

## Global constraints
- Local isolated branch only. No push, merge into main, deployment, automatic work, payment, or expanded authority.
- Duration 60-3600 seconds, default 300. Horizon 60-86400 seconds, default 3600.
- Preserve current generated knowledge and source evidence; release resealing belongs to the parent.

## Review focus
- Awarded deadlines at the exact finish boundary must fail closed, matching the live submission guard.
- Missing, excess or duplicate active details cannot create apparent capacity.
- Pending awards reserve estimated time without becoming active jobs; unknown/unsafe arithmetic stays unknown.
- Duty filtering and proposal caps cannot reserve phantom work time.
- CLI invalid timing flags must fail before any authenticated read; valid flags remain GET-only.

## Task 1: Reconcile scheduling and CLI
- [x] Extend test/businesspolicy.js for defaults/bounds, sequential deadline ordering, expired and invalid deadlines, submitted/disputed slots, pending awards, horizon and authority boundaries, duty filtering, invariants.
- [x] Extend test/business-agent.js for timing CLI propagation and pre-request validation.
- [x] Run both tests and observe failures for missing behavior.
- [x] Implement workSchedule and timing gates in src/businesspolicy.js; expose flags in tools/business-agent.js.
- [x] Document estimates, immediate-award assumption and separate authority in docs/agent-business-shadow.md.
- [x] Run npm run test:business:shadow plus related resource suites; run npm test and record any source-gate blockers without bypassing them.
- [x] Obtain fresh review, resolve important findings with RED/GREEN tests, and commit local reconciliation preserving both parents.

## Execution evidence and rulings
- Baseline policy suite passed on 0a45705bb. New policy and CLI tests failed before implementation (missing duration default; rejected timing flags), then passed.
- Ruling: reserve potential pending awards after awarded work. Modern main already protects their slots/costs; omitting time would overstate the new horizon. Cost is deliberately conservative under-utilization if buyers do not award.
- Ruling: match runtime strict expiry, including a one-second delivery allowance when a proposed finish otherwise equals its delivery interval. The exact-boundary test failed with [3600,7200,10800] and passed with [3601,7201,10801].
- Ruling: reject snapshots whose awarded schedule or bounded horizon exceeds the JavaScript date range instead of emitting invalid timestamps.
- Historical generated knowledge and the earlier security review were resolved to current main unchanged. Their old evidence does not qualify this reconciliation.
- Passed: business-shadow suite (3 files); resources suite (9 files, including decision-proofs API); labor, outcomes, storefront, outcome observer and company suites (5 files); isolated six-cycle resource pilot; syntax checks and git diff --check.
- At parent direction, the aggregate npm test was stopped during contract-release source checks after Foundry offline controls passed. Full aggregate, source-census resealing, native/Postgres and CI qualification belong to the sealed release candidate. No full-suite or release-readiness claim is made.

- Independent review: no blockers; policy and CLI tests passed independently, plus 66 extreme-date, +/-1 ms boundary and overflow cases. A 100-job observer record remained bounded at 37,637 bytes. No deferred findings.
