# Agent Alpha and Deep City Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Launch one bounded autonomous canary and replace broad system discovery with one telemetry-backed recommendation across OMERTÀ's canonical 40-system graph.

**Architecture:** A dependency-free Agent Alpha runner owns one durable external identity and drives only server-issued conservative actions. The server adds a read-only Agent Turn exploration sibling backed by a canonical coverage resolver and existing telemetry; the same resolver powers a one-card human Deep City surface. Successful agent actions add bounded operational evidence without changing the economy.

**Tech Stack:** Node.js 20+ ESM, Fastify 5, PostgreSQL/pg-mem, existing JSON API/telemetry, vanilla browser JavaScript, native assertion-based tests.

**Spec:** `docs/superpowers/specs/2026-08-25-agent-alpha-deep-city-design.md`

## Global Constraints

- Preserve the exact Agent Turn policy and keep exploration outside actions, EV ranking, recommendedActionId, and /v1/agent/act authorization.
- One fail-closed Agent Alpha session; default one action, maximum 50, minimum 3100 ms mutation cadence; no reset/replacement identity.
- Never persist/report tokens, headers, wallets, IDs, action bodies, prompts, or authored text.
- Use exactly the 40 engagement SYSTEMS keys and classify every telemetry event once.
- Recommend exactly one eligible unvisited system or null; do not change coach priority or human discovery exclusions.
- No dependency, service, queue, table, economy, chain, PvP, borrowing, or faucet expansion.
- The sole additive schema object is ix_telemetry_account_event.
- Every behavior follows red → green TDD; every task ends with focused verification and a commit.

---

### Task 1: Repair Public Agent Discovery

**Files:**
- Modify: `src/agentgateway.js`
- Modify: `public/arena.html`
- Test: `test/hardening.js`
- Test: `test/docs.js`

**Interfaces:**
- Consumes: public GET /v1/arena and authenticated GET /v1/leaderboard/agents.
- Produces: public links to /v1/arena; no auth/route change.

- [ ] **Step 1: Write failing assertions**

Assert llmsTxt() and public/arena.html identify /v1/arena as the JSON Arena board and do not link unauthenticated navigation to /v1/leaderboard/agents. Keep the authenticated leaderboard test.

- [ ] **Step 2: Verify red**

Run: `node test/hardening.js && node test/docs.js`

Expected: FAIL on both stale public links.

- [ ] **Step 3: Implement minimal copy/link fix**

Use /v1/arena, label “Arena snapshot (JSON),” and describe “the public banded board behind this page.” Do not make the detailed leaderboard public.

- [ ] **Step 4: Verify green**

Run: `node test/hardening.js && node test/docs.js && git diff --check`

Expected: PASS.

- [ ] **Step 5: Commit**

~~~text
fix: point public agent discovery at the Arena
~~~

### Task 2: Build the Finite Agent Alpha Runner

**Files:**
- Create: `tools/agent-alpha.js`
- Create: `test/agent-alpha.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: /v1/session, /v1/auth/guest, /v1/auth/agent-key, /v1/character, /v1/agent/turn, /v1/agent/act.
- Produces: runAgentAlpha(options): Promise<summary> and CLI flags --create, --name, --max-actions, --session, --report.

- [ ] **Step 1: Write failing lifecycle tests**

Against a real local Fastify listener and temporary files, assert explicit create produces one agent/character, persists phase agent, executes at most maxActions, writes redacted JSONL, and a second run resumes without guest creation.

- [ ] **Step 2: Verify red**

Run: `node test/agent-alpha.js`

Expected: FAIL because tools/agent-alpha.js is absent.

- [ ] **Step 3: Implement session and creation**

Implement the spec's runAgentAlpha seam, origin checks, atomic owner-only writes, lock file, phase transitions, explicit-create requirement, /v1/session probe, and fail-closed errors. Expose no reset.

- [ ] **Step 4: Implement finite safe loop**

Validate maxActions 1–50; require at least 3100 ms outside injected tests; require the exact conservative policy; accept only the spec allowlist; journal operationId/turnId/actionId before POST; hash/reuse operationId; consume post/stale replacement turns; stop rather than invent.

- [ ] **Step 5: Add red → green recovery/security cases**

Cover corrupt JSON, wrong origin, expired 401, transient probe, missing token, duplicate lock, unsafe recommendation, policy mismatch, max bound, and ambiguous post replayed with one idempotency key. Assert no forbidden value enters report/session except the token confined to session.

- [ ] **Step 6: Add suite and verify**

Run: `node test/agent-alpha.js && node test/mcp.js && node test/agentturn.js && git diff --check`

Expected: PASS.

- [ ] **Step 7: Commit**

~~~text
feat: add the bounded Agent Alpha runner
~~~

### Task 3: Add Coverage, Agent Turn v3, and Activation Evidence

**Files:**
- Modify: `src/explore.js`
- Modify: `src/agentturn.js`
- Modify: `src/server.js`
- Modify: `src/agentgateway.js`
- Modify: `src/engagement.js`
- Modify: `schema.sql`
- Test: `test/explore.js`
- Test: `test/agentturn.js`
- Test: `test/engagement.js`
- Test: `test/growth.js`

**Interfaces:**
- Consumes: engagement SYSTEMS, gameplay telemetry, state/legends, live rule constants, accrued turn state.
- Produces: systemCoverage(db,ch,acct,owned,options), async exploreBoard, required AgentTurn.exploration, agent_turn_action, agent heatmap fields.

- [ ] **Step 1: Write failing 40-system coverage tests**

Assert exact catalog equality/count/version/scope; one next; telemetry/state evidence; eligible/blocked counts; deterministic order; agent/status/resource exclusions; next null when none ready; and zero ledger writes.

- [ ] **Step 2: Verify red**

Run: `node test/explore.js`

Expected: FAIL because current Explore has 19 featured entries and a grid.

- [ ] **Step 3: Implement resolver and index**

Implement the spec's exact 40-row metadata, one grouped account query, existing state predicates, blocker categories, and ordering. Add ix_telemetry_account_event. Keep exploreBoard a thin wrapper.

- [ ] **Step 4: Write failing Agent Turn v3 tests**

Assert required OpenAPI exploration with no action/EV/executable fields; never in actions. Change telemetry and prove exploration changes while every action descriptor/rank/score/recommendation is identical. Assert /v1/agent/act rejects an exploration id.

- [ ] **Step 5: Implement read-only turn sibling**

Resolve coverage in agentTurn and declare it in OpenAPI. Omit it from authority. Do not change policy, ranking, dispatcher, or action lookup.

- [ ] **Step 6: Write failing activation tests**

One successful issued action writes one allowed-key agent_turn_action row; failed/stale/unknown writes none. opsEngagement preserves human semantics while reporting agent action kinds/blockers and per-system agentAccounts/agentEvents.

- [ ] **Step 7: Implement activation evidence**

Track after canonical success inside the transaction, classify as NON_ENGAGEMENT, and aggregate agent fields without identifiers or authored values.

- [ ] **Step 8: Verify**

Run: `node test/explore.js && node test/agentturn.js && node test/engagement.js && node test/growth.js && npm run pgquery && git diff --check`

Expected: PASS.

- [ ] **Step 9: Commit**

~~~text
feat: add Agent Turn exploration coverage
~~~

### Task 4: Redesign Deep City as One Recommendation

**Files:**
- Modify: `src/home.js`
- Modify: `src/server.js`
- Modify: `public/index.html`
- Test: `test/home.js`
- Test: `test/client.js`
- Test: `test/explore.js`

**Interfaces:**
- Consumes: Task 3 canonical async payload and setTab(tab).
- Produces: one New territory card, X of 40 progress, exact navigation, honest null/all-worked states.

- [ ] **Step 1: Write failing Home/client tests**

Assert standalone Explore equals Home.explore; client consumes only explore.next, renders at most one action, shows canonical progress, and does not iterate untapped. Preserve escaping/aggregate isolation.

- [ ] **Step 2: Verify red**

Run: `node test/home.js && node test/client.js && node test/explore.js`

Expected: FAIL because client renders the untapped grid.

- [ ] **Step 3: Thread the same async/live context**

Pass DB client and available online accounts into the same resolver from standalone and Home; no second query/ranker or ID exposure.

- [ ] **Step 4: Implement accessible one-card UI**

Render escaped next name/hook, progress, and one setTab(next.tab) control. If next null and remaining > 0 say no new territory is actionable now; only remaining 0 is all-worked. No skip/dismiss persistence.

- [ ] **Step 5: Verify**

Run: `node test/home.js && node test/client.js && node test/explore.js && npm run mobile && git diff --check`

Expected: PASS.

- [ ] **Step 6: Commit**

~~~text
feat: guide players into one new city system
~~~

### Task 5: Document, Rebuild Graphs, and Rehearse Alpha

**Files:**
- Modify: `AGENTS.md`
- Modify: `SPEC.md`
- Modify: `src/agentgateway.js`
- Modify: `omerta-mcp/README.md`
- Modify: `knowledge/generated/*` only via npm run knowledge
- Test: `test/docs.js`
- Test: `test/routes.js`
- Test: `tools/knowledge-test.js`

**Interfaces:**
- Consumes: shipped v3/Deep City/runner contracts.
- Produces: consistent discovery docs, current provenance graph, and redacted finite production evidence outside Git.

- [ ] **Step 1: Write failing docs assertions**

Assert guides describe exploration as read-only/non-EV/non-executable, Deep City as one of 40, fair-play/dormant extraction, and the bounded runner without reset/fleet promises.

- [ ] **Step 2: Verify red**

Run: `node test/docs.js && node test/routes.js`

Expected: FAIL because v3/Deep City/runner text is absent.

- [ ] **Step 3: Update canonical surfaces**

Use exact shipped names/payloads. Do not claim extraction, earnings, autonomous PvP/borrowing, or public detailed leaderboard.

- [ ] **Step 4: Rebuild/check graphs**

Run: `npm run knowledge && npm run graph && npm run knowledge:check && node tools/graph.js check && node tools/knowledge-test.js`

Expected: PASS with current provenance.

- [ ] **Step 5: Run full gates**

Run: `node test/agent-alpha.js && node test/agentturn.js && node test/explore.js && node test/engagement.js && node test/home.js && node test/client.js && node test/hardening.js && node test/docs.js && npm run pgquery && npm run pgcheck && npm test && git diff --check`

Expected: every command exits 0.

- [ ] **Step 6: Commit docs/generated graph**

~~~text
docs: publish Agent Turn v3 and Deep City coverage
~~~

- [ ] **Step 7: Run bounded production canary outside Git**

Use owner-only paths outside the repo, https://www.omerta.fun, one explicit create/resume session, and max-actions 5. Never print/copy the session; always resume it.

- [ ] **Step 8: Verify live evidence**

Read only the redacted report, GET /v1/arena, /health, and deployed version. Confirm one qualifying agent, no forbidden action, no duplicate, no unresolved pending operation, and healthy production.

- [ ] **Step 9: Prove no secret/report entered Git**

Run: `git status --short && git grep -n "Bearer " -- . ':!test/*'`

Expected: no canary session/report and no bearer value.
