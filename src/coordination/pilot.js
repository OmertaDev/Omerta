import { coordinationGraphs, createCoordinationRegistry } from './graph.js';

// A source-controlled, inert pilot. Shipping source does not enable the rollout.
const always = { kind: 'always' };
const completed = (nodeId) => ({ kind: 'node_completed', nodeId });
export const COORDINATION_PILOT = createCoordinationRegistry([{
  schemaVersion: 1, id: 'omerta.coordination.dead-letter', version: 1,
  title: 'The Dead Letter',
  nodes: [
    { id: 'envelope', kind: 'task', title: 'Open the envelope', visibility: 'public',
      description: 'An empty envelope bears two marks: a tide line and a printer’s seal.',
      discover: always, requires: always },
    { id: 'tide', kind: 'task', title: 'Read the tide line', visibility: 'hidden',
      description: 'Water reached the paper before the address was written.',
      discover: completed('envelope'), requires: always },
    { id: 'seal', kind: 'task', title: 'Inspect the printer’s seal', visibility: 'hidden',
      description: 'The seal belongs to a press that closed before the letter was sent.',
      discover: completed('envelope'), requires: always },
    { id: 'conclusion', kind: 'terminal', title: 'File the contradiction', visibility: 'hidden',
      description: 'The letter was assembled from two different messages. Keep that fact between these pages.',
      discover: { kind: 'all', rules: [completed('tide'), completed('seal')] },
      requires: { kind: 'all', rules: [completed('tide'), completed('seal')] } },
  ],
}]);

// Each account may deliberately discover either district source. A conclusion requires another
// original account's complementary source and current explicit sharing; local copies add no weight.
const claimValue = { type: 'text', value: 'assembled-after-the-fire' };
const domain = 'omerta.knowledge.split-ledger';
const proposition = 'ledger.assembly';
const knowledgeGate = { kind: 'independent_evidence', domain, proposition,
  value: claimValue, sourceRoots: ['docks.manifest', 'foundry.impression'] };
const localSource = { kind: 'any', rules: [completed('docks-source'), completed('foundry-source')] };
const knowledgeSource = {
  schemaVersion: 2, id: 'omerta.coordination.split-ledger', version: 1,
  title: 'The Split Ledger',
  nodes: [
    { id: 'briefing', kind: 'task', title: 'Read the case notes', visibility: 'public',
      description: 'A shipping manifest and a printer’s impression tell the same story. Each source needs its own discoverer.',
      discover: always, requires: always },
    { id: 'docks-source', kind: 'task', title: 'Read the surviving manifest', visibility: 'hidden',
      description: 'The manifest dates the ledger’s assembly after the warehouse fire. Its original discovery remains yours.',
      discover: { kind: 'all', rules: [completed('briefing'), { kind: 'at_district', districtId: 'docks' }] },
      requires: always,
      claim: { domain, proposition, sourceRoot: 'docks.manifest', value: claimValue } },
    { id: 'foundry-source', kind: 'task', title: 'Inspect the saved impression', visibility: 'hidden',
      description: 'The impression confirms the ledger was assembled after the fire. Share it deliberately with another investigator.',
      discover: { kind: 'all', rules: [completed('briefing'), { kind: 'at_district', districtId: 'foundry' }] },
      requires: always,
      claim: { domain, proposition, sourceRoot: 'foundry.impression', value: claimValue } },
    { id: 'conclusion', kind: 'terminal', title: 'Record the corroborated account', visibility: 'hidden',
      description: 'Two original discoverers, two surviving sources, one corroborated account. This record pays no reward.',
      discover: { kind: 'all', rules: [localSource, knowledgeGate] },
      requires: { kind: 'all', rules: [localSource, knowledgeGate] } },
  ],
};

// Keep the original single-graph export stable for Phase 0 clients and regression tests.
export const COORDINATION_KNOWLEDGE_PILOT = createCoordinationRegistry([knowledgeSource]);
export const COORDINATION_ALL_PILOTS = createCoordinationRegistry([
  ...coordinationGraphs(COORDINATION_PILOT).map(({ contentHash: _hash, ...source }) => source),
  knowledgeSource,
]);
