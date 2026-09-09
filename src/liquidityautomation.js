// One bounded worker cycle. It observes final receipts before planning another action, and
// publishes a short-lived launch/health observation for separate web processes.
import { liquidityKeeperConfig, makeLiquidityKeeperClients, runLiquidityKeeper } from './liquiditykeeper.js';
import { bookConfirmedLiquidityAction } from './liquidityaccounting.js';
import { buildLiquidityPlanningContext, ensureDailyBondOffering } from './liquiditypolicy.js';
import { drainLiquidityQueue } from './liquidityqueue.js';

export async function runLiquidityAutomationCycle(pool, { config, clients, dryRun = false } = {}) {
  try {
  config ||= liquidityKeeperConfig();
  if (!config.enabled) return { state: 'disabled', reason: config.reason, alert: false };
  clients ||= makeLiquidityKeeperClients(config, { signing: !dryRun });
  let indexed = null;
  if (!dryRun) {
    const { syncLiquidityReceipts } = await import('./liquidityindexer.js');
    indexed = await syncLiquidityReceipts(pool, { manifest: config.manifest, clients,
      startBlock: config.manifest.indexing.startL2Block, maxBlocks: config.manifest.indexing.maxBlocks });
    if (indexed?.alert) return { state: 'blocked', reason: 'liquidity_receipt_indexing_held', alert: true, indexed };
    if (!indexed?.caughtUp) return { state: 'indexing', reason: 'liquidity_receipt_backlog', alert: false, indexed };
  }
  let queue = null;
  const result = await runLiquidityKeeper(pool, { config, clients, dryRun,
    onConfirmed: bookConfirmedLiquidityAction,
    planningContext: async (db, manifest, snapshot) => {
      // This callback is reached only after the journal has reconciled pending transactions.
      // Check existing claim backing before publishing health or authorizing another spend.
      if (!dryRun) {
        queue = await drainLiquidityQueue(db, { manifest, clients, indexed, keeperResult: { state: 'idle', alert: false } });
        if (queue.alert) throw Object.assign(new Error(queue.reason), { keeperCode: queue.reason });
      }
      return buildLiquidityPlanningContext(db, manifest, snapshot, { persist: !dryRun });
    } });
  const offering = dryRun || result.alert ? null : await ensureDailyBondOffering(pool, { config });
  return { ...result, indexed, queue, offering };
  } catch (error) {
    return { state: 'blocked', reason: error.keeperCode || 'liquidity_automation_unavailable', alert: true };
  }
}
