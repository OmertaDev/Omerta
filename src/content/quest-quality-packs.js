// Explicit inventory: these artifacts are activated by an operator, never at server boot.
import fs from 'node:fs';
export const QUEST_QUALITY_PACK_NAMES = Object.freeze([
  'quest-three-witnesses-v2', 'quest-quality-open-office', 'quest-quality-payday',
  'quest-quality-truce', 'quest-quality-night-edition', 'quest-quality-field-notes',
  'quest-quality-favors', 'quest-quality-shared-meaning', 'quest-quality-last-ferry',
  'quest-quality-small-fire',
]);
// Literal source paths keep every executable authored input visible to release admission.
const sources = [
  new URL('../../content/packs/quest-three-witnesses-v2/pack.json', import.meta.url),
  new URL('../../content/packs/quest-quality-open-office/pack.json', import.meta.url),
  new URL('../../content/packs/quest-quality-payday/pack.json', import.meta.url),
  new URL('../../content/packs/quest-quality-truce/pack.json', import.meta.url),
  new URL('../../content/packs/quest-quality-night-edition/pack.json', import.meta.url),
  new URL('../../content/packs/quest-quality-field-notes/pack.json', import.meta.url),
  new URL('../../content/packs/quest-quality-favors/pack.json', import.meta.url),
  new URL('../../content/packs/quest-quality-shared-meaning/pack.json', import.meta.url),
  new URL('../../content/packs/quest-quality-last-ferry/pack.json', import.meta.url),
  new URL('../../content/packs/quest-quality-small-fire/pack.json', import.meta.url),
];
export const QUEST_QUALITY_PACKS = Object.freeze(sources.map(source => JSON.parse(fs.readFileSync(source, 'utf8'))));
export const QUEST_QUALITY_ROLLOUT = Object.freeze(QUEST_QUALITY_PACK_NAMES.map((name, index) => ({
  name, namespace: QUEST_QUALITY_PACKS[index].namespace, version: QUEST_QUALITY_PACKS[index].version,
  stage: index === 0 ? 'pilot' : 'experimental',
})));
