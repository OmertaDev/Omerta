import { GameError } from './game.js';

// Dormant until the complete caller cutover. This admits only the selected exact Crew prefix;
// organization-first locking is not a general capability. Items sort by subtype then canonical ID.
const CLASSES = Object.freeze({
  definition: ['definition'], crew: ['crew'], character: ['character'], account: ['account'],
  social_mapping: ['mapping'], subject_generation: ['subject'], organization: ['gang'],
  guard: ['guard'], aggregate: ['craft', 'mystery', 'operation', 'reward', 'salvage'],
  item: ['custody', 'lot', 'unique'], budget: ['budget', 'singleton'],
});
const ORDER = Object.keys(CLASSES);
const fail = (code) => { throw new GameError(code, 'Item lock acquisition must restart in canonical order.'); };
const compareText = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b));
function entry(value) {
  if (!value || typeof value !== 'object' || Reflect.ownKeys(value).length !== 5
    || !['className', 'subtype', 'key', 'id', 'generation'].every((key) => Object.hasOwn(value, key))) fail('item_lock_order');
  const { className, subtype, key, id, generation } = value;
  if (!Object.hasOwn(CLASSES, className) || !CLASSES[className].includes(subtype)
    || [key, id].some((part) => typeof part !== 'string' || !part.length || part.length > 256 || part.trim() !== part)
    || !Number.isSafeInteger(generation) || generation < 0) fail('item_lock_order');
  return Object.freeze({ className, subtype, key, id, generation });
}
export function compareItemLockEntries(a, b) {
  return ORDER.indexOf(a.className) - ORDER.indexOf(b.className)
    || compareText(a.subtype, b.subtype) || compareText(a.key, b.key)
    || compareText(a.id, b.id) || a.generation - b.generation;
}
const identity = (row) => JSON.stringify([row.className, row.subtype, row.key, row.id, row.generation]);

export function createItemLockTrace() {
  const rows = [];
  const candidates = new Map();
  return Object.freeze({
    // Crew IDs are resolved before the prefix. Item/custody candidates are resolved later using
    // locked owners and aggregate authority. Each complete class set seals independently.
    admitCandidates(className, values) {
      if (!['crew', 'item'].includes(className)) fail('item_lock_order');
      if (candidates.has(className)
        || (rows.length && ORDER.indexOf(rows.at(-1).className) >= ORDER.indexOf(className))) fail('contention');
      if (!Array.isArray(values) || values.length > 4096) fail('item_lock_order');
      const admitted = values.map(entry);
      if (admitted.some((row) => row.className !== className)) fail('item_lock_order');
      const members = new Set(admitted.map(identity));
      if (members.size !== admitted.length) fail('item_lock_order');
      candidates.set(className, members);
    },
    record(value) {
      const row = entry(value);
      if (['crew', 'item'].includes(row.className)) {
        if (!candidates.get(row.className)?.has(identity(row))) fail('contention');
      }
      if (rows.length && compareItemLockEntries(rows.at(-1), row) > 0) fail('item_lock_order');
      rows.push(row);
      return row;
    },
    snapshot() { return Object.freeze([...rows]); },
  });
}
