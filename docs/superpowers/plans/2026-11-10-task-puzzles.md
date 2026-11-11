# Task Puzzles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent varied challenges to selected jobs without changing their economy or bypassing their existing requirements.

**Architecture:** A pure versioned generator produces public constraints and private answers. A small persistence service issues/resumes a character-bound challenge and verifies/consumes it inside the existing character transaction. Job adapters establish trusted contexts; a shared accessible client renders each mechanic and submits the answer with the real job action.

**Tech Stack:** Existing Node ES modules, Fastify, PostgreSQL/pg-mem and browser JavaScript; Playwright for local browser tests. No new runtime dependencies.

**Spec:** docs/superpowers/specs/2026-11-10-task-puzzles.md

## Global Constraints

- Puzzles are gameplay, not bot-proof human verification. Agents remain first-class players.
- No increased currency, item, chance, XP or other reward for optional preparation.
- Preserve eligibility, cooldown, location, real legwork, reward, account-level caps and employment-delivery requirements.
- Verify and consume with the job in the same existing character transaction. No client completion flags.
- Preserve issued versions and constraints across refresh; do not reveal server answer or seed in public payloads.
- Isolated branch only; no deployment, merge, force-push or unrelated changes.

## Review Focus

- Concurrent tabs issuing and consuming the same occurrence get one challenge and at most one job payout: Task 2 PostgreSQL race tests.
- A correct answer followed by downstream job failure remains reusable after rollback: Task 2 PostgreSQL rollback test.
- Character death, task rollover and cross-scope substitutions cannot reuse completion: Task 2 API/DB rejection tests.
- Dismissal, refresh and unknown request outcomes preserve the issued challenge and avoid duplicate submissions: Task 3 real browser tests.
- Answer ordering, malformed values, repeated mechanics and ambiguous generator instances are rejected or prevented: Task 1 independent enumeration tests.

### Task 1: Versioned generation and durable issuance

**Files:** Create src/task-puzzle-engine.js, src/task-puzzles.js, test/task-puzzle-engine.js, test/task-puzzles.js; modify schema.sql.

**Interfaces:**
- Export generateTaskPuzzle({ seed, kind? }) -> private puzzle, publicTaskPuzzle(privatePuzzle) -> safe public shape, verifyTaskPuzzle(privatePuzzle, answer) -> boolean.
- Export issueTaskPuzzle(ch, { scope, targetId, contextKey }, client) -> public issued puzzle, readTaskPuzzle(ch, context, client) -> public issued puzzle|null, consumeTaskPuzzle(ch, context, submission, client) -> completion feedback. submission is { id, answer }; missing/invalid/stale submissions throw GameError without reward or completion.
- Context values come only from trusted server adapters. issue/read must return identical issued IDs and constraints for the same character/scope/target/context. Service records bounded recent mechanics and structural signatures, with recent avoidance in generation.
- Public shape includes id, version, kind, title, instructions, constraints, input controls or options and hint. Private answer, generator seed and solution internals never leave server. Keep generators independently solvable from public constraints.

- [x] Write tests that enumerate legal solutions independently for at least 500 seeds per mechanic, assert one solution, malformed-answer refusal, materially varied structural signatures and no answer leakage.
- [x] Run node test/task-puzzle-engine.js and observe missing-feature failure before implementing.
- [x] Implement four distinct mechanics: patrol timing, constrained route planning, one-to-one matching and evidence deduction. Use versioned immutable generation with deterministic seeds and exact shape validation.
- [x] Write failing service tests for refresh identity, recent-kind/pattern avoidance, owner/context binding, wrong answers, consume-once and unsupported versions.
- [x] Implement additive storage and service with server-issued UUID, bounded history lookup, exact context binding and consumed state; rely on the existing character lock and document this caller contract. Retain consumed receipts for replay refusal and diagnosis.
- [x] Run node test/task-puzzle-engine.js and node test/task-puzzles.js, plus node test/clue-puzzles.js. Commit only this task's files and report exact tests and interfaces.

### Task 2: Integrate required and optional job puzzles

**Files:** Modify src/growth.js, src/hustle.js, src/game.js, src/server.js, src/openapi.js or current OpenAPI source, relevant agent descriptors, package.json; create src/task-puzzle-jobs.js, test/task-puzzle-jobs.js, test/task-puzzle-postgres.js; adjust existing job tests for new required flows.

**Interfaces:** Consume Task 1 service and public shape. Add POST /v1/task-puzzles with {scope,targetId} to issue/resume a server-resolved current context, and GET /v1/task-puzzles with the same query to read without issuance. Accept puzzle:{id,answer} on the existing job action bodies; no stand-alone completion token.
- Selected required missions are m2 (Collection Run), m11 (Witness Problem), m12 (Warehouse Ledger); all other missions retain current behavior. Publish required-puzzle metadata in mission catalogs and agent discovery.
- Hustle step 1 (legwork check-in) requires a puzzle in addition to real legwork and location. Publish metadata on hustle board.
- Optional crime preparation applies to valid crime IDs, uses an issuance cycle that refresh cannot reroll, and is consumed with the crime attempt. No reward/odds changes; ordinary crime without preparation remains valid.
- Append optional puzzle arguments to existing mutation signatures so other callers remain compatible; enforce required gates inside authoritative mutation functions, not only HTTP handlers.

- [x] Write failing HTTP and direct-function tests proving required API bypass refusal and wrong/cross-task/old-character answer refusal before job mutations.
- [x] Implement trusted task-context resolution, metadata and routing, preserving existing eligibility error priorities and agent compatibility. Do not modify employment or authored content progression.
- [x] Add tests that eligible completed jobs retain exact reward formulas/caps; crime preparation preserves random outcome/payout and does not substitute for Hustle legwork.
- [x] Add native PostgreSQL tests using only an explicitly guarded disposable loopback omerta_task_puzzles* database and isolated schema. Race issue, required completion and replay; force rollback after consumption and prove neither completion nor payout persists.
- [x] Run task engine/service/job tests, relevant existing growth/daily-lineage/security/client tests and native PostgreSQL test. Add package scripts for the new suites. Commit only task files; document any unrelated failures precisely.

### Task 3: Accessible puzzle interaction and release verification

**Files:** Create public/ux-task-puzzles.js, public/ux-task-puzzles.css, test/task-puzzles-browser.js; modify public/index.html, src/server.js asset allowlist, relevant public/API documentation and package scripts.

**Interfaces:** Render Task 1 public shape; issue/resume through Task 2 routes and send puzzle:{id,answer} with existing mission/hustle/crime action. Distinct controls for timing selection, ordered route, one-to-one matching and deduction, all usable without dragging or fast reactions.

- [ ] Write failing real-page Playwright tests covering actual mission and Hustle entry points, optional crime prep and shared renderer controls at 390px and keyboard-only input.
- [ ] Implement labeled controls, visible focus, touch targets, hint disclosure, progress/error feedback, pending-submit guard and focus restoration. Dismissal must not execute a job; refresh resumes the same issued puzzle. Explain preparation adds feedback but no reward/odds bonus.
- [ ] Cover wrong answer then retry, reload, dismissal/reopen, repeated clicks, request failure and stale occurrence recovery in browser tests. Assert no horizontal overflow or page errors and that real job rewards arrive only once.
- [ ] Run new browser tests, existing clue/quest browser tests, all feature unit/API/native tests and npm test on final code. Record failed/blocked/never-run checks accurately; do not call focused tests a full suite pass.
- [ ] Perform independent final review and fix material findings with regression tests. Update plan evidence and commit tested changes. Leave isolated branch ready for user review; no publish/merge/deploy.


