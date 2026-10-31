// Server-owned presentation belongs only to an admitted City quest and visible nodes.
import { NEIGHBORHOOD_QUEST_PRESENTATION, NEIGHBORHOOD_QUEST_VENUES } from './neighborhood-initiation.js';
import { DISTRICT_STORY_ARCS } from './district-story-arcs.js';
import { NEIGHBORHOOD_BROADCAST_PRESENTATION, NEIGHBORHOOD_BROADCAST_VENUES,
  NEIGHBORHOOD_BROADCAST_ACTION_LABELS } from './neighborhood-broadcast.js';
import { NEIGHBORHOOD_AFTERWORD_PRESENTATION, NEIGHBORHOOD_AFTERWORD_VENUES,
  NEIGHBORHOOD_AFTERWORD_ACTION_LABELS } from './neighborhood-afterword.js';
import { PROPERTY_QUEST_PRESENTATION, PROPERTY_QUEST_VENUES, PROPERTY_QUEST_DISTRICTS } from './property-investigation.js';

const neighborhood = Object.freeze({ ...NEIGHBORHOOD_QUEST_PRESENTATION, cityQuest: true });
export const CITY_QUEST_PRESENTATIONS = Object.freeze([neighborhood,
  ...DISTRICT_STORY_ARCS.map(story => story.presentation), NEIGHBORHOOD_BROADCAST_PRESENTATION, NEIGHBORHOOD_AFTERWORD_PRESENTATION,
  PROPERTY_QUEST_PRESENTATION]);
const presentations = new Map(CITY_QUEST_PRESENTATIONS.map(presentation => [presentation.graphId, presentation]));
const venues = new Map([[neighborhood.graphId, NEIGHBORHOOD_QUEST_VENUES],
  ...DISTRICT_STORY_ARCS.map(story => [story.package.id, story.venues]),
  [NEIGHBORHOOD_BROADCAST_PRESENTATION.graphId, NEIGHBORHOOD_BROADCAST_VENUES],
  [NEIGHBORHOOD_AFTERWORD_PRESENTATION.graphId, NEIGHBORHOOD_AFTERWORD_VENUES],
  [PROPERTY_QUEST_PRESENTATION.graphId, PROPERTY_QUEST_VENUES]]);
const actionLabels = new Map([...DISTRICT_STORY_ARCS.map(story => [story.package.id, story.actionLabels]),
  [NEIGHBORHOOD_BROADCAST_PRESENTATION.graphId, NEIGHBORHOOD_BROADCAST_ACTION_LABELS],
  [NEIGHBORHOOD_AFTERWORD_PRESENTATION.graphId, NEIGHBORHOOD_AFTERWORD_ACTION_LABELS]]);

export function cityQuestPresentation(graphId) {
  return presentations.get(graphId) || null;
}

export function cityQuestNodePresentation(graphId, nodeId) {
  const presentation = cityQuestPresentation(graphId), venueId = venues.get(graphId)?.[nodeId];
  const districtId = graphId === PROPERTY_QUEST_PRESENTATION.graphId
    ? PROPERTY_QUEST_DISTRICTS[nodeId] : presentation?.districtId;
  return venueId ? { venueId, ...(districtId ? { districtId } : {}) } : null;
}

export function cityQuestActionId(graphId, localId) {
  return graphId !== neighborhood.graphId && presentations.has(graphId)
    ? encodeURIComponent(graphId) + ':' + localId : localId;
}

export function cityQuestActionLabel(graphId, nodeId) {
  return actionLabels.get(graphId)?.[nodeId] || null;
}
