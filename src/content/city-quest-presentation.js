// Server-owned presentation belongs only to an admitted City quest and visible nodes.
import { NEIGHBORHOOD_QUEST_PRESENTATION, NEIGHBORHOOD_QUEST_VENUES } from './neighborhood-initiation.js';
import { FIRST_ERRAND_CASE } from './first-errand-case.js';
import { DISTRICT_STORY_ARCS } from './district-story-arcs.js';

const neighborhood = Object.freeze({ ...NEIGHBORHOOD_QUEST_PRESENTATION, cityQuest: true });
export const CITY_QUEST_PRESENTATIONS = Object.freeze([neighborhood,
  ...DISTRICT_STORY_ARCS.map(story => story.presentation), FIRST_ERRAND_CASE.presentation]);
const presentations = new Map(CITY_QUEST_PRESENTATIONS.map(presentation => [presentation.graphId, presentation]));
const venues = new Map([[neighborhood.graphId, NEIGHBORHOOD_QUEST_VENUES],
  ...DISTRICT_STORY_ARCS.map(story => [story.package.id, story.venues]), [FIRST_ERRAND_CASE.package.id, FIRST_ERRAND_CASE.venues]]);
const actionLabels = new Map([...DISTRICT_STORY_ARCS, FIRST_ERRAND_CASE].map(story => [story.package.id, story.actionLabels]));

export function cityQuestPresentation(graphId) {
  return presentations.get(graphId) || null;
}

export function cityQuestNodePresentation(graphId, nodeId) {
  const presentation = cityQuestPresentation(graphId), venueId = venues.get(graphId)?.[nodeId];
  return venueId ? { venueId, ...(presentation.districtId ? { districtId: presentation.districtId } : {}) } : null;
}

export function cityQuestActionId(graphId, localId) {
  return graphId !== neighborhood.graphId && presentations.has(graphId)
    ? encodeURIComponent(graphId) + ':' + localId : localId;
}

export function cityQuestActionLabel(graphId, nodeId) {
  return actionLabels.get(graphId)?.[nodeId] || null;
}
