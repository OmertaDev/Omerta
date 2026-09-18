// Bounded, deterministic pressure memory. These observations are audit samples,
// not inventory, culpability, or an alternative canonical event store.
export const PRESSURE_MEMORY = Object.freeze({ windowSeconds: 604800, bucketSeconds: 21600, buckets: 28, events: 32, operations: 128 });
const timestamp = (value) => new Date(value).getTime();

export async function readPressureSamples(client, at) {
  const width = PRESSURE_MEMORY.bucketSeconds * 1000, end = Math.floor(at / width) * width;
  const samples = [];
  // One indexed point-window lookup per bucket; ticks cannot make history scans
  // or retained payloads grow. The incomplete current bucket is excluded.
  for (let index = 0; index < PRESSURE_MEMORY.buckets; index++) {
    const upper = end - index * width;
    const row = (await client.query(`SELECT evaluated_at,facts_json FROM director_selections
      WHERE evaluated_at >= $1 AND evaluated_at < $2 ORDER BY evaluated_at DESC,id LIMIT 1`,
    [new Date(upper - width), new Date(upper)])).rows[0];
    if (!row) continue;
    let facts;
    try { facts = JSON.parse(row.facts_json); } catch { return []; }
    if (!Array.isArray(facts) || facts.length > 100) return [];
    samples.push({ at: timestamp(row.evaluated_at), facts });
  }
  return samples;
}

export function aggregatePressureMemory({ objectId, controllerFamilyId, at, samples = [], events = [], operations = [],
  discoveries = 0, actionSignals = {}, saturated = false }) {
  const empty = { historyAvailable: 0, historicalSamples: 0, shortageWindows: 0, repeatedFamilyFailures: 0,
    dominanceSeconds: 0, recentTerritoryChanges: 0, recentMysteryDiscoveries: 0, peacefulResolutions: 0, violentEvents: 0, recentActivity: 0 };
  if (!Number.isSafeInteger(at) || at < 0 || saturated || samples.length > 28 || events.length > 32 || operations.length > 128
    || !Number.isSafeInteger(discoveries) || discoveries < 0 || discoveries > 32) return Object.freeze(empty);
  const since = at - PRESSURE_MEMORY.windowSeconds * 1000, width = PRESSURE_MEMORY.bucketSeconds * 1000;
  const buckets = new Map();
  for (const sample of samples) {
    if (!Number.isSafeInteger(sample.at) || sample.at < since || sample.at >= at || !Array.isArray(sample.facts)) continue;
    const fact = sample.facts.find((f) => f.objectId === objectId);
    if (!fact || fact.references?.stockSaturated || !Number.isSafeInteger(fact.resourceQuantity) || fact.resourceQuantity < 0
      || !Number.isSafeInteger(fact.resourceDemand) || fact.resourceDemand < 0 || !Number.isSafeInteger(fact.worldRevision)) continue;
    const bucket = Math.floor(sample.at / width), prior = buckets.get(bucket);
    if (!prior || sample.at > prior.at) buckets.set(bucket, { ...sample, fact });
  }
  const history = [...buckets.values()].sort((a, b) => a.at - b.at);
  const canonical = [...new Map(events.filter((e) => timestamp(e.occurred_at) <= at).map((e) => [e.id, e])).values()]
    .sort((a, b) => Number(a.revision) - Number(b.revision));
  const recent = canonical.filter((e) => timestamp(e.occurred_at) >= since);
  let changes = 0, controlSince = null, previousFamily;
  for (const event of canonical) {
    if (event.family_id !== previousFamily) {
      if (previousFamily !== undefined && timestamp(event.occurred_at) >= since) changes++;
      controlSince = timestamp(event.occurred_at); previousFamily = event.family_id;
    }
  }
  const completed = operations.filter((o) => timestamp(o.resolved_at) >= since && timestamp(o.resolved_at) <= at);
  const signals = (name) => recent.filter((event) => Object.hasOwn(actionSignals, event.action_id)
    && actionSignals[event.action_id].includes(name)).length;
  return Object.freeze({ historyAvailable: 1, historicalSamples: history.length,
    shortageWindows: history.filter(({ fact }) => fact.resourceDemand > fact.resourceQuantity).length,
    repeatedFamilyFailures: completed.filter((o) => ['failed', 'expired'].includes(o.status)).length,
    dominanceSeconds: controllerFamilyId && previousFamily === controllerFamilyId && Number.isFinite(controlSince)
      ? Math.max(0, Math.min(PRESSURE_MEMORY.windowSeconds, Math.floor((at - controlSince) / 1000))) : 0,
    recentTerritoryChanges: changes, recentMysteryDiscoveries: discoveries,
    peacefulResolutions: signals('peaceful'), violentEvents: signals('violence'),
    recentActivity: recent.length + completed.length + discoveries });
}
