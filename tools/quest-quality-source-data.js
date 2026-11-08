// Exact quest quality source comparison only; never execution evidence.
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const QUEST_QUALITY_SOURCE = freeze({ status:'UNSEALED', phase:'EXACT_QUEST_QUALITY_SOURCE_COMPARISON_ONLY', files:{}, additions:{} });
export const QUEST_QUALITY_SOURCE_SHA256 = '';
