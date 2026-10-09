// Original newcomer quest; immutable authoring data interpreted by the existing mystery runtime.
import { readFileSync } from 'node:fs';

function frozen(value) {
  if (value && typeof value === 'object') {
    for (const entry of Object.values(value)) frozen(entry);
    Object.freeze(value);
  }
  return value;
}

export const NEIGHBORHOOD_INITIATION_PACKAGE = frozen(JSON.parse(readFileSync(
  new URL('./neighborhood-initiation.json', import.meta.url), 'utf8',
)));
export const NEIGHBORHOOD_QUEST_GRAPH_ID = NEIGHBORHOOD_INITIATION_PACKAGE.id;
export const NEIGHBORHOOD_QUEST_VENUES = Object.freeze({
  'mystery:neighborhood-fixer': 'fixer',
  'choice:neighborhood-approach': 'fixer',
  'mystery:neighborhood-listen': 'workshop',
  'mystery:neighborhood-ask': 'workshop',
  'mystery:neighborhood-newsroom': 'stories',
});

// Presentation mappings are server-only authoring aids. Project them only onto already visible nodes.
export const NEIGHBORHOOD_QUEST_PRESENTATION = Object.freeze({
  graphId: NEIGHBORHOOD_QUEST_GRAPH_ID,
  version: 1,
  title: 'A Name Worth Remembering',
  description: 'Meet Nico, inspect a lead with Ada, and bring Elena an account she can publish.',
  ownerScope: 'character',
  startVenueId: 'fixer',
  exploreVenueId: 'stories',
  rewardTitle: 'Neighborhood Notebook',
  deathPolicy: 'immutable_history_no_inheritance',
});

export default NEIGHBORHOOD_INITIATION_PACKAGE;
