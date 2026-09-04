// Reserved Phase 1 item-economy value vocabulary. Keeping this separate from the package manifest
// lets the runtime and invariant sweep share the exact namespace without importing graph data.
export const PHASE1_CRAFT_REASON_PREFIX = 'craft:recipe:';
export const PHASE1_MYSTERY_REASON_PREFIX = 'mystery:';
export const PHASE1_OPERATION_REASON_PREFIX = 'operation:';
export const PHASE1_HARDENING_RECIPE_ID = 'recipe:hardened_steel';
export const PHASE1_HARDENING_CASH_COST = 300;
export const PHASE1_HARDENING_CASH_REASON =
  `${PHASE1_CRAFT_REASON_PREFIX}hardened_steel`;
export const PHASE1_PACKAGE_IDS = Object.freeze([
  'core-materials', 'automotive-salvage', 'belladonna-demo',
]);

export function phase1CraftReason(recipeId) {
  return `craft:${recipeId}`;
}

export class Phase1EconomyPolicyError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'Phase1EconomyPolicyError';
    this.code = 'phase1_economy_policy';
    this.details = Object.freeze({ ...details });
  }
}

const TEXT_ONLY_FIELDS = new Set(['title', 'description', 'lore', 'privateevidence']);
const ECONOMIC_IDENTIFIER_FIELDS = new Set([
  'adapter', 'asset', 'assettype', 'currency', 'kind', 'rewardtype', 'symbol', 'type', 'unit',
]);
const CASH_COST_FIELDS = new Set(['cashcost', 'costcash', 'cost']);

const normalized = (value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
const economicValue = (value) => value !== undefined && value !== null && value !== false
  && value !== 0 && value !== '';
const currencyToken = (value, currency) => {
  if (typeof value !== 'string') return false;
  const words = value.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase().split(/[^a-z0-9]+/);
  return words.includes(currency);
};

function scanEconomicSignals(value, path, signals) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanEconomicSignals(entry, `${path}[${index}]`, signals));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, entry] of Object.entries(value)) {
    const keyName = normalized(key);
    const entryPath = `${path}.${key}`;
    if (TEXT_ONLY_FIELDS.has(keyName)) continue;
    if (keyName.includes('omr') && economicValue(entry)) signals.omr.push(entryPath);
    if (keyName.includes('cash') && economicValue(entry)) signals.cash.push(entryPath);
    if (ECONOMIC_IDENTIFIER_FIELDS.has(keyName) && typeof entry === 'string') {
      if (currencyToken(entry, 'omr')) signals.omr.push(entryPath);
      if (currencyToken(entry, 'cash')) signals.cash.push(entryPath);
    }
    scanEconomicSignals(entry, entryPath, signals);
  }
}

// Phase 1 is intentionally stricter than the reusable graph validator. The general validator
// supports finite seasonal OMR and configurable recipe sinks; this release slice supports neither.
// Inspect the canonical package objects themselves so a definition cannot gain currency authority
// merely because the generic graph shape remains valid.
export function validatePhase1EconomyPolicy(packages) {
  const signals = { omr: [], cash: [] };
  const cashCosts = [];
  for (const [packageIndex, pkg] of packages.entries()) {
    for (const [nodeIndex, node] of (pkg.nodes || []).entries()) {
      const nodePath = `packages[${packageIndex}].nodes[${nodeIndex}]`;
      scanEconomicSignals(node, nodePath, signals);
      if (node.type !== 'recipe') continue;
      const declarations = [];
      for (const [containerName, container] of [['node', node], ['metadata', node.metadata || {}]]) {
        for (const [key, value] of Object.entries(container)) {
          if (!CASH_COST_FIELDS.has(normalized(key)) || typeof value !== 'number') continue;
          declarations.push({ path: `${nodePath}.${containerName}.${key}`, value });
        }
      }
      if (declarations.length) cashCosts.push({ nodeId: node.id, declarations });
    }
  }

  // Known recipe cashCost fields are counted by the exact census below, not as an independent
  // reward/source signal. Every other cash-shaped path is forbidden.
  const declaredCashPaths = new Set(cashCosts.flatMap(({ declarations }) => (
    declarations.map(({ path }) => path.replace('.metadata.', '.metadata.').replace('.node.', '.'))
  )));
  const uncontrolledCash = [...new Set(signals.cash)].filter((path) => !declaredCashPaths.has(path));
  const uniqueOmr = [...new Set(signals.omr)];
  if (uniqueOmr.length) {
    throw new Phase1EconomyPolicyError(
      `Phase 1 permits zero OMR inputs, outputs, costs, rewards, or mutations; found ${uniqueOmr.join(', ')}`,
      { kind: 'omr', paths: uniqueOmr },
    );
  }
  if (uncontrolledCash.length) {
    throw new Phase1EconomyPolicyError(
      `Phase 1 permits no cash rewards, sources, or mutations; found ${uncontrolledCash.join(', ')}`,
      { kind: 'cash_authority', paths: uncontrolledCash },
    );
  }
  if (cashCosts.length !== 1
    || cashCosts[0].nodeId !== PHASE1_HARDENING_RECIPE_ID
    || cashCosts[0].declarations.length !== 1
    || !cashCosts[0].declarations[0].path.endsWith('.metadata.cashCost')
    || cashCosts[0].declarations[0].value !== PHASE1_HARDENING_CASH_COST) {
    throw new Phase1EconomyPolicyError(
      `Phase 1 cash-cost census must contain only ${PHASE1_HARDENING_RECIPE_ID} at exactly $${PHASE1_HARDENING_CASH_COST}`,
      { kind: 'cash_cost_census', cashCosts },
    );
  }
  const packageIds = packages.map(({ id }) => id);
  if (packageIds.length !== PHASE1_PACKAGE_IDS.length
    || packageIds.some((id, index) => id !== PHASE1_PACKAGE_IDS[index])) {
    throw new Phase1EconomyPolicyError(
      `Phase 1 package census must be exactly ${PHASE1_PACKAGE_IDS.join(', ')}`,
      { kind: 'package_census', packageIds },
    );
  }
  return Object.freeze({
    omrAuthorityPaths: 0,
    cashRewardSourcePaths: 0,
    cashCosts: Object.freeze([Object.freeze({
      recipeId: PHASE1_HARDENING_RECIPE_ID,
      amount: PHASE1_HARDENING_CASH_COST,
    })]),
  });
}
