// Explicit reviewed candidate must be sealed before any historical comparison can run.
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const GRAND_STRATEGY_SOURCE = freeze({
  status: 'UNSEALED', phase: 'EXACT_GRAND_STRATEGY_SOURCE_COMPARISON_ONLY',
  predecessor: '7d52e1f08dc9540b182553b70dedfce4fecfac22', revision: null,
  tree: null, predecessorTree: null, files: {}, additions: {},
});
export const GRAND_STRATEGY_SOURCE_SHA256 = 'UNSEALED';
