import { createHash } from 'node:crypto';
import { parseUnits } from 'viem';
import { BAND, DESK_BUYBACK, dayOf } from './rules.js';
import { bandAnchor } from './desk.js';
import { liquidityKeeperConfig } from './liquiditykeeper.js';
import { setLiquidityObservation } from './liquiditystate.js';
import { GameError } from './game.js';

const OBSERVATION_TTL_MS = 90_000;
const manifestHash = (m) => createHash('sha256').update(JSON.stringify(m)).digest('hex');
const phases = ['prepare', 'auction', 'migration', 'failed', 'oracle_warmup', 'live'];
const dailyPolicy = (manifest) => manifest.bondDailyIssuance ?? 'capped';
const dailyCapMatches = (policy, cap) => {
  try { return policy === 'unlimited' ? BigInt(cap) === 0n : policy === 'capped' && BigInt(cap) > 0n; }
  catch { return false; }
};

// Called only with the freshly verified chain snapshot from readLiquiditySnapshot, before planning.
// The database heartbeat lets separate web and worker processes enforce the same launch state.
export async function buildLiquidityPlanningContext(pool, manifest, snapshot, { persist = true } = {}) {
  const context = { desk: {} };
  const oracleOkay = !!snapshot.oracle;
  const phase = snapshot.genesisPhase == null
    ? snapshot.health && oracleOkay ? 'live' : 'oracle_warmup'
    : phases[Number(snapshot.genesisPhase)] || 'failed';
  const ready = phase === 'live' && snapshot.health && oracleOkay;
  const bondReady = !!ready && snapshot.bond?.ready === true
    && dailyCapMatches(dailyPolicy(manifest), snapshot.bond.dailyCapOmrWei);
  const dailyCapWei = bondReady ? String(snapshot.bond.dailyCapOmrWei) : '0';
  const observation = { phase: ready ? 'live' : phase === 'live' ? 'oracle_warmup' : phase,
    observedAt: snapshot.readAt, expiresAt: snapshot.readAt + OBSERVATION_TTL_MS };
  if (pool) {
    if (persist) {
      const update = await pool.query('INSERT INTO liquidity_market_status (chain_id,manifest_hash,phase,ready,block_number,block_hash,observed_at,expires_at,bond_ready,bond_daily_cap_wei) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (chain_id,manifest_hash) DO UPDATE SET phase=EXCLUDED.phase,ready=EXCLUDED.ready,block_number=EXCLUDED.block_number,block_hash=EXCLUDED.block_hash,observed_at=EXCLUDED.observed_at,expires_at=EXCLUDED.expires_at,bond_ready=EXCLUDED.bond_ready,bond_daily_cap_wei=EXCLUDED.bond_daily_cap_wei WHERE liquidity_market_status.observed_at <= EXCLUDED.observed_at',
        [manifest.chainId, manifestHash(manifest), observation.phase, !!ready, snapshot.blockNumber, snapshot.blockHash,
          new Date(observation.observedAt), new Date(observation.expiresAt), bondReady, dailyCapWei]);
      if (update.rowCount > 0) setLiquidityObservation(observation);
    }
    if (ready) {
      const band = await bandAnchor(pool, snapshot.readAt);
      if (!band.stale && band.anchor > 0 && band.ageMs >= 0) {
        const anchorWei = parseUnits(String(band.anchor), 18);
        const ceilingWei = anchorWei * BigInt(BAND.LOWER_BPS) / 10000n;
        const floorWei = anchorWei * BigInt(DESK_BUYBACK.PRICE_FLOOR_BPS) / 10000n;
        const oraclePrice = BigInt(snapshot.oracle.omrPerEth);
        for (const job of manifest.jobs.filter((j) => j.kind === 'buyback' && j.stream === 1)) {
          const amount = BigInt(snapshot.jobs[job.id]?.amount || 0);
          // Price ceiling uses conservative ceiling division: a fill cannot use slippage to
          // cross above the Desk's existing lower-band buy threshold.
          const minOut = ceilingWei > 0n ? (amount * 10n ** 18n + ceilingWei - 1n) / ceilingWei : 0n;
          context.desk[job.id] = { buyAllowed: 10n ** 36n <= ceilingWei * oraclePrice
              && 10n ** 36n >= floorWei * oraclePrice && minOut > 0n,
            anchorEthPerOmr: band.anchor, minOutWei: minOut.toString() };
        }
      }
    }
  }
  return context;
}

export async function refreshLiquidityObservation(pool, { config, now = Date.now() } = {}) {
  config ||= liquidityKeeperConfig();
  if (!config.enabled) return { enabled: false, ready: true };
  const dailyIssuancePolicy = dailyPolicy(config.manifest);
  const row = (await pool.query('SELECT phase,ready,observed_at,expires_at,bond_ready,bond_daily_cap_wei FROM liquidity_market_status WHERE chain_id=$1 AND manifest_hash=$2',
    [config.manifest.chainId, manifestHash(config.manifest)])).rows[0];
  const observedAt = new Date(row?.observed_at || 0).getTime(), expiresAt = new Date(row?.expires_at || 0).getTime();
  if (!row || observedAt > now || expiresAt <= now) {
    setLiquidityObservation(null);
    return { enabled: true, ready: false, bondReady: false, dailyIssuancePolicy,
      phase: 'oracle_warmup', reason: 'liquidity_observation_stale' };
  }
  setLiquidityObservation({ phase: row.phase, observedAt, expiresAt });
  return { enabled: true, ready: row.ready === true && row.phase === 'live', phase: row.phase,
    bondAddress: config.manifest.contracts?.bond?.address, chainId: config.manifest.chainId,
    dailyIssuancePolicy,
    bondReady: row.ready === true && row.phase === 'live' && row.bond_ready === true
      && dailyCapMatches(dailyIssuancePolicy, row.bond_daily_cap_wei),
    bondDailyCapWei: String(row.bond_daily_cap_wei || '0') };
}

export async function assertLiquidityMarketReady(pool) {
  if (process.env.LIQUIDITY_AUTOMATION_ENABLED !== 'on') return;
  const state = await refreshLiquidityObservation(pool);
  if (!state.ready) throw new GameError('liquidity_unavailable', 'New market commitments are paused until liquidity and its oracle are healthy.');
}

export async function assertLiquidityBondReady(pool) {
  if (process.env.LIQUIDITY_AUTOMATION_ENABLED !== 'on') return;
  const state = await refreshLiquidityObservation(pool);
  if (!state.bondReady) throw new GameError('liquidity_unavailable', 'New bonds are paused until liquidity, the oracle, and bond issuance are ready.');
  return state;
}

// Create one daily policy row; never replace a manual stop or raise an existing day's authority.
// All numbers are explicit owner-approved limits, and the existing lifetime tranche still binds.
export async function ensureDailyBondOffering(pool, { dailyOmr, now = Date.now(), config } = {}) {
  const state = await refreshLiquidityObservation(pool, { config, now });
  if (!state.enabled || !state.bondReady) return { created: false, reason: 'liquidity_unavailable' };
  if (state.dailyIssuancePolicy === 'unlimited') return { created: false, reason: 'daily_limit_removed' };
  const limit = Number(dailyOmr ?? process.env.BOND_AUTOMATION_DAILY_OMR);
  if (!Number.isSafeInteger(limit) || limit <= 0) return { created: false, reason: 'daily_policy_unset' };
  const contractCap = BigInt(state.bondDailyCapWei) / 10n ** 18n;
  const cappedLimit = Number(contractCap < BigInt(limit) ? contractCap : BigInt(limit));
  if (!cappedLimit) return { created: false, reason: 'contract_daily_capacity_unavailable' };
  const q = await pool.connect();
  try {
    await q.query('BEGIN');
    const reserve = (await q.query('SELECT capacity_omr,committed_omr FROM bond_reserve WHERE id=1 FOR UPDATE')).rows[0];
    const day = dayOf(now);
    const existing = (await q.query('SELECT offered_omr FROM bond_offerings WHERE day=$1', [day])).rows[0];
    if (existing) { await q.query('COMMIT'); return { created: false, reason: 'already_defined', offeredOmr: Number(existing.offered_omr) }; }
    const remaining = (parseUnits(String(reserve?.capacity_omr || 0), 6)
      - parseUnits(String(reserve?.committed_omr || 0), 6)) / 1_000_000n;
    const amount = remaining <= 0n ? 0 : Number(remaining < BigInt(cappedLimit) ? remaining : BigInt(cappedLimit));
    if (!amount) { await q.query('COMMIT'); return { created: false, reason: 'lifetime_capacity_exhausted' }; }
    await q.query('INSERT INTO bond_offerings (day,offered_omr) VALUES ($1,$2)', [day, amount]);
    await q.query('COMMIT');
    return { created: true, day, offeredOmr: amount };
  } catch (e) { await q.query('ROLLBACK'); throw e; } finally { q.release(); }
}
