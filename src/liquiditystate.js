// Process-local read model, refreshed from the durable, deployment-bound keeper observation.
// An expired or absent observation closes new issuance; it cannot interrupt existing claims.
let current = null;
export function setLiquidityObservation(value) { current = value ? { ...value } : null; }
export function automaticLiquidityPhase(now = Date.now()) {
  if (!current || current.expiresAt <= now || current.observedAt > now) return 'oracle_warmup';
  return current.phase;
}
