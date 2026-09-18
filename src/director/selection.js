import crypto from 'node:crypto';
import { canonicalBytes } from '../content/canonical.js';
import { evaluateDirectorPredicate } from './definitions.js';

export const DIRECTOR_LIMITS = Object.freeze({ active: 32, startsPerTick: 4, evaluations: 64,
  player: 3, crew: 4, family: 6, territory: 1, tickSeconds: 300, campaigns: 32 });
export const directorHash = (value) => crypto.createHash('sha256').update(canonicalBytes(value)).digest('hex');
export const predicatesMatch = (predicates, facts) => predicates.every((predicate) => evaluateDirectorPredicate(predicate, facts));
export const situationEligible = (definition, facts) => !!facts
  && facts.objectId === definition.objectId
  && predicatesMatch(definition.eligibility, facts) && predicatesMatch(definition.requiredWorldFacts, facts)
  && !definition.excludedWorldFacts.some((p) => evaluateDirectorPredicate(p, facts))
  && (definition.network?.relatedWorld || []).every((rule) => rule.states.includes(facts.relatedWorld?.[rule.objectId]?.state))
  && !(definition.network?.competition.includes('CONTESTED') && (facts.historyAvailable !== 1 || facts.recentActivity === 0))
  && facts.activePlayers >= definition.participants.minimumPlayers
  && facts.activeFamilies >= definition.participants.minimumFamilies
  && facts.activeCrews >= definition.participants.minimumCrews;

// Deterministic ranking: semantic pressure, authored bounded priority, oldest
// unserved branch, stable content identity. No random situation fabrication.
export function selectDirectorCandidates(candidates, active, history, now, limits = DIRECTOR_LIMITS) {
  const ranked = candidates.filter(({ definition, facts }) => situationEligible(definition, facts)).map((candidate) => {
    const { definition, facts } = candidate;
    return { ...candidate, score: definition.pressureInputs.reduce((sum, name) => sum + (facts.pressures[name] || 0), 0)
      * definition.weight / ({ common: 1, uncommon: 2, rare: 4 }[definition.rarity])
      * (definition.network?.competition.includes('CONTESTED') && facts.historyAvailable === 1 ? Math.min(1, facts.recentActivity / 4) : 1),
      tie: directorHash([definition.id, facts.objectId, candidate.campaignId || '']) };
  }).sort((a, b) => Number(!!b.campaignId) - Number(!!a.campaignId) || b.score - a.score
    || a.tie.localeCompare(b.tie));
  const selected = [], rejected = [];
  for (const candidate of ranked.slice(0, limits.evaluations)) {
    const { definition: d, facts: f } = candidate;
    const current = [...active, ...selected.map((s) => ({ object_id: s.facts.objectId,
      controller_family_id: s.facts.controllerFamilyId, definition_id: s.definition.id }))];
    const recent = history.filter((h) => h.object_id === f.objectId && h.definition_id === d.id);
    const last = recent.reduce((n, h) => Math.max(n, new Date(h.created_at).getTime()), 0);
    const lastTerminal = history.filter((h) => h.object_id === f.objectId && h.terminal)
      .reduce((n, h) => Math.max(n, new Date(h.updated_at).getTime()), 0);
    const policy = d.concurrencyPolicy;
    let reason = null;
    if (selected.length >= limits.startsPerTick || current.length >= Math.min(limits.active, policy.global)) reason = 'global_budget';
    else if (current.filter((s) => s.object_id === f.objectId).length >= Math.min(limits.territory, policy.perTerritory, policy.perScope)) reason = 'territory_budget';
    else if (f.controllerFamilyId && current.filter((s) => s.controller_family_id === f.controllerFamilyId).length >= Math.min(limits.family, policy.perFamily)) reason = 'family_budget';
    else if (last && now - last < d.cooldownPolicy.seconds * 1000) reason = 'cooldown';
    else if (lastTerminal && now - lastTerminal < d.cooldownPolicy.quietSeconds * 1000) reason = 'quiet_period';
    else if (recent.filter((h) => now - new Date(h.created_at).getTime() < d.cooldownPolicy.repetitionWindowSeconds * 1000).length >= d.cooldownPolicy.maximumPerWindow) reason = 'repetition';
    if (reason) rejected.push({ definitionId: d.id, objectId: f.objectId, reason });
    else selected.push(candidate);
  }
  return { selected, rejected, eligible: ranked.length, truncated: ranked.length > limits.evaluations };
}
