# Finalized Event-Time Evidence and Consumer Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the approved Finalized Observation kernel with immutable canonical event-block timestamps, then freeze the separate H2 and RegistryV2 consumer contracts without adding domain authority, reachability, signing, deployment, or cutover.

**Architecture:** `observeFinalized` already fetches every unique event block to verify its hash. It will retain the canonical timestamp from that same exact block response as a frozen `eventBlocks` evidence array and include the array in the observation commitment. Task 5 continues to own only the complete getter mirror; future H2 and CN-6 consumers receive separate identities, checkpoints, inboxes, reducers, and atomic adapters.

**Tech Stack:** Node.js ESM, viem-compatible public-client seams, native `node:assert`, PostgreSQL/pg-mem consumer tests, repository knowledge generator.

**Spec:** `docs/superpowers/specs/2026-08-26-grill-completion.md`; predecessor plan `docs/superpowers/plans/2026-08-26-finalized-observation-kernel.md`; architecture evidence `.superpowers/sdd/2026-08-26-finalized-observation-kernel/task-6-recon.md`.

## Global Constraints

- Supported chain is exactly `4663`; chain IDs, block numbers, timestamps, generations, indices, days, budgets and other authority-sized values never pass through JavaScript `Number` unless the approved viem `getChainId()` compatibility seam immediately canonicalizes a safe integer.
- The kernel owns mechanical observation only. It owns no production schema, route, worker, domain readiness state, ABI decoder, reviewer policy, Safe package, signer, private key, transaction broadcast, funds/token movement, deployment, or cutover.
- For checkpoint `C`, finalized horizon `F`, and reviewed span `S`, the observed target remains `N = min(F, C + S)`. Logs cover the exact inclusive requested range and getters remain pinned to `N`.
- A trusted-RPC response is operational completeness evidence, not cryptographic proof of provider non-omission.
- Event-block timestamps come only from the exact `getBlock({blockNumber})` response already used to prove each log block hash. They are never caller-supplied, inferred from the target head, fetched inside a database transaction, or copied from a receipt.
- The event-time extension must preserve exact address/topic/range/order/hash validation, work/byte ceilings, target/finalized brackets, pinned getter capabilities, secret-safe fixed public errors, and deep immutability.
- Task 5 getter evidence, future CN-6 lifecycle evidence, and future H2 clearance evidence never share consumer keys, checkpoints, inboxes, locks, readiness, or domain transitions.
- Provisional receipts and local wall-clock labels never authorize. Only a finalized exact event plus the owning consumer's atomic apply may change finalized domain state.
- Production remains dormant: no environment value, address, signer, Safe action, RPC worker, route, funds, deployment, or feature selector is activated by this plan.

## Frozen handoff rulings

1. `observeFinalized` adds `eventBlocks`, a deeply frozen array with one entry per unique block represented by normalized logs, ordered by the logs' first canonical occurrence. Each entry is exactly:

   ```js
   {
     blockNumber: 123n,
     blockHash: '0x' + 64 lowercase hex characters,
     blockTimestamp: 1_700_000_000n,
   }
   ```

2. `blockTimestamp` is a nonnegative canonical `BigInt`. A `Number`, decimal string, float, negative value, missing timestamp, reflected getter, accessor, symbol, sparse value, cycle, or live capability rejects with a fixed secret-safe FO code/message.
3. The observation commitment includes `eventBlocks` in full. Changing only a timestamp changes `observationHash`; exact replay therefore requires the same timestamps as well as the same head/log/getter evidence.
4. A log-free observation has `eventBlocks: []`. Multiple logs in one block cause one exact block fetch/evidence entry, not one per log. A log whose declared block hash differs from the fetched block still fails before evidence is published.
5. This extension does not alter FO inbox identity. Consumer inbox identity remains `(chainId, contractAddress, blockHash, transactionHash, logIndex)`; a typed consumer separately persists the matching event-block timestamp as evidence.
6. There is no production migration requirement for Task 5 checkpoint commitments because the getter consumer is dormant and unscheduled. Compatibility tests must still prove the existing Task 5 consumer accepts the extended observation and preserves its categorical getter-only authority.
7. CN-6 will use one registry-wide lifecycle cursor/adapter over all five ordered RegistryV2 topics. Activation and ballot application are transition helpers under that adapter, not separate coordinators.
8. Unmatched canonical RegistryV2 events are retained as exact chain facts, advance the cursor, raise persistent public drift, and remain non-authorizing until exact local provenance matches. They do not wedge the whole registry stream.
9. A future RegistryV2 publisher must persist the exact signed transaction bytes and canonical hash before broadcast and may rebroadcast only identical bytes. This plan adds no signer or broadcaster.
10. Deep finalized checkpoint disagreement halts the affected consumer with a persistent incident. No automatic rewind, deletion, or fabricated replay is allowed; a later reviewed recovery node owns rebuild.

---

### Task 1: Add immutable event-block time evidence

**Files:**

- Modify: `src/finalizedobservation.js`
- Modify: `test/finalizedobservation.js`
- Modify: `test/stockcatalogv2.js`
- Modify only if exact census figures move: `SPEC.md`
- Modify generated knowledge only through `npm run knowledge`

**Interfaces:**

- Consumes: approved `observeFinalized({client, identity, checkpoint, topics, limits, readGetters})` and its exact block-hash cache.
- Produces: the same immutable observation plus `eventBlocks: ReadonlyArray<{blockNumber: bigint, blockHash: Hex32, blockTimestamp: bigint}>`; no other exported API changes.

- [ ] **Step 1: Write literal RED tests for the new evidence**

  Add an independent fake-client fixture where two normalized logs share block `101` and a third log uses block `102`. The fake `getBlock` responses must carry literal hashes and timestamps. Assert before implementation:

  ```js
  assert.deepEqual(observation.eventBlocks, [
    { blockNumber: 101n, blockHash: BLOCK_101_HASH, blockTimestamp: 1_700_000_101n },
    { blockNumber: 102n, blockHash: BLOCK_102_HASH, blockTimestamp: 1_700_000_102n },
  ]);
  assert.equal(getBlockCallsFor(101n), 1);
  assert.equal(getBlockCallsFor(102n), 1);
  assert(Object.isFrozen(observation.eventBlocks));
  assert(Object.isFrozen(observation.eventBlocks[0]));
  ```

  Add a log-free observation assertion for `eventBlocks: []`. Do not derive expected timestamps or hashes through production helpers.

- [ ] **Step 2: Run the focused test and preserve the expected RED**

  Run:

  ```powershell
  node test/finalizedobservation.js
  ```

  Expected: failure because `eventBlocks` is absent; existing assertions before the new one remain green.

- [ ] **Step 3: Extend the exact block-evidence cache minimally**

  Replace the hash-only cached evidence with one immutable internal record per unique log block. The normalization must be equivalent to:

  ```js
  function normalizeEventBlockEvidence(blockNumber, rawBlock) {
    return Object.freeze({
      blockNumber: canonicalBlockBigInt(blockNumber),
      blockHash: canonicalBytes32(rawBlock.hash),
      blockTimestamp: canonicalNonNegativeBigInt(rawBlock.timestamp),
    });
  }
  ```

  Preserve the existing exact block-number request and hash comparison. Deduplicate by canonical block number in the logs' existing order; never sort provider logs or let a callback choose blocks.

- [ ] **Step 4: Commit the timestamp evidence into the observation**

  Add the frozen `eventBlocks` array to the immutable observation object before computing `observationHash`. Keep the existing byte cap over the complete committed evidence. Do not add a getter, callback, raw client, retry, pagination, or fallback field.

- [ ] **Step 5: Add RED→GREEN validation and mutation coverage**

  Add tests that reject a missing timestamp, `Number`, decimal string, float, negative BigInt, accessor, symbol, sparse/cyclic structure, and attacker-reflected values without exposing the value in the public message. Add a paired observation where only one timestamp differs and assert different `observationHash` values. Add post-return mutation attempts and assert the observation/evidence stays unchanged.

- [ ] **Step 6: Prove Task 5 compatibility**

  Extend the existing production-boundary catalog test so its fake blocks return timestamps. Assert the getter consumer still:

  - issues one exact raw log request;
  - applies the same complete getter snapshot;
  - stores raw logs only in its getter inbox;
  - advances readiness only when caught up;
  - does not write lifecycle/reviewer/publisher/Safe/ballot authority.

- [ ] **Step 7: Run focused and coupled verification**

  ```powershell
  node test/finalizedobservation.js
  node test/stockcatalogv2.js
  node test/stockballotv2.js
  node test/rwanominations.js
  node test/preflight.js
  node --check src/finalizedobservation.js
  node --check src/stockcatalogv2.js
  git diff --check
  ```

  Every command must exit `0`. Record exact TDD and mutation evidence in the task report.

- [ ] **Step 8: Commit and independently review Task 1**

  Commit only the focused source/tests and any exact census/knowledge normalization. Review for block-fetch deduplication, timestamp provenance, BigInt/no-Number authority, commitment inclusion, byte bounds, deep immutability, secret-safe errors, Task 5 compatibility, and absence of domain/reachability/signing/funds code. Critical/Important findings block Task 2.

---

### Task 2: Freeze independent consumer acceptance contracts

**Files:**

- Modify: `docs/superpowers/plans/2026-08-26-finalized-observation-kernel.md`
- Modify: `docs/superpowers/plans/2026-08-26-grill-completion-umbrella.md`
- Modify: `docs/superpowers/plans/2026-08-26-registry-nominations-ballots.md`
- Modify generated knowledge only through `npm run knowledge`

**Interfaces:**

- Consumes: approved Task-1 `eventBlocks` evidence; approved Task-5 getter mirror; H1/H2 recon; CN-6 recon.
- Produces: exact plan-level contracts for H2 and CN-6. This task produces no runtime function, schema, route, worker, signer, funds path, deployment, or cutover.

- [ ] **Step 1: Amend the FO handoff surface**

  Document `eventBlocks`, its ordering/deduplication/type/commitment rules, and the rule that consumers map every decoded log to an exact `(blockNumber, blockHash, blockTimestamp)` entry before `BEGIN`.

- [ ] **Step 2: Freeze H2's separate consumer contract**

  Document top-level future entry point `syncFinalizedRwaHealthOverlay(pool)`, its own chain/address/start/topics/limits, `rwa_health_overlay_lock_v2`, checkpoint, raw+decoded inbox, overlay-generation reducer, and atomic clearance apply. State explicitly that it cannot read/advance the getter or registry-lifecycle cursor and that finalized clearance still requires a new post-finality health evaluation before green.

- [ ] **Step 3: Freeze CN-6's one-cursor registry contract**

  Document top-level future entry point `syncFinalizedRwaRegistryLifecycle(pool)` and helper signatures:

  ```js
  applyFinalizedRwaActivationEvents(client, decodedBatch)
  applyFinalizedRwaBallotEvents(client, decodedBatch)
  ```

  Both helpers run under one registry-lifecycle adapter/transaction and never connect, begin, commit, release, retry, or perform RPC. Record the fixed initial limits: 10,000 blocks, 2,000 logs, 2,000,000 bytes, 256 unique version keys, 64 ballot days, and 256 proposal/result matches.

- [ ] **Step 4: Freeze lifecycle and publisher rulings**

  Record:

  - activation identity `(4663, registry, assetVersionKey, activationGeneration)`;
  - inclusion valid only when `approvedAt <= eventBlockTimestamp < validUntil`;
  - unmatched canonical events progress with persistent drift but never authorize;
  - local `approval_stale` yields to later finalized proof of timely canonical inclusion;
  - finalized checkpoint disagreement halts for reviewed recovery;
  - the future publisher is dormant and must persist exact signed bytes/hash before any broadcast/rebroadcast;
  - `purchase_window_elapsed_before_publication` is terminal with no extension, reopening, runner-up, or replacement winner.

- [ ] **Step 5: Correct graph/status truth**

  Mark CN-5 and FO Tasks 1-5 implemented/independently approved/dormant; mark event-time evidence according to its actual review status; state H2 and AcquisitionVault budget provenance remain mandatory before CN-6 publisher reachability; state `RWA_STOCK_PIPELINE` is a future selector not yet implemented in production code.

- [ ] **Step 6: Run plan and knowledge verification**

  ```powershell
  npm test
  npm run knowledge
  node tools/knowledge-test.js
  git diff --check
  ```

  Use exact searches to prove FO still reads no environment/private key/reviewer secret, owns no production table/route/worker, signs/sends nothing, moves no value, and imports neither legacy `watcher.js` nor `chain_cursor`.

- [ ] **Step 7: Commit and independently review Task 2**

  Review for accurate implementation/review/configuration/deployment/finality/activation status, exact separate-consumer boundaries, no duplicate scanner/cursor, no fabricated external evidence, and DAG consistency. This task completes the FO plan and unblocks the separately planned H0/H1/H2 implementation; it does not itself start CN-6 or production cutover.

---

## Completion gate

This plan is complete only when:

- Task 1 has a focused commit, independent approval, controller verification, and normalized knowledge provenance;
- Task 2 has a documentation-only commit, independent approval, full native/knowledge verification, and a clean worktree;
- the final report states separately what is implemented, reviewed, configured, deployed, Safe-executed, finalized, funded, and active;
- no production signer, key, address, RPC worker, route, funds/token mutation, deployment, or selector activation has been introduced.

