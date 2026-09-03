const TYPES = new Set([
  'material',
  'item_template',
  'recipe',
  'source',
  'sink',
  'evidence',
  'mystery_step',
  'operation_step',
  'social_gate',
  'world_gate',
  'choice',
  'reward',
]);
const WORLD_GRAPH_REGISTRIES = new WeakSet();

function immutableData(value, seen = new WeakMap()) {
  if (typeof value === 'function') {
    throw new Error('graph package data must not contain executable functions');
  }
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);

  if (Array.isArray(value)) {
    const copy = [];
    seen.set(value, copy);
    for (const entry of value) copy.push(immutableData(entry, seen));
    return Object.freeze(copy);
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error('graph package data must use plain objects and arrays');
  }
  const copy = Object.create(prototype);
  seen.set(value, copy);
  for (const [key, entry] of Object.entries(value)) {
    Object.defineProperty(copy, key, {
      configurable: true,
      enumerable: true,
      value: immutableData(entry, seen),
      writable: true,
    });
  }
  return Object.freeze(copy);
}

function readonlyMap(source) {
  let view;
  view = Object.freeze({
    get size() { return source.size; },
    get(key) { return source.get(key); },
    has(key) { return source.has(key); },
    entries() { return source.entries(); },
    keys() { return source.keys(); },
    values() { return source.values(); },
    forEach(callback, thisArg) {
      for (const [key, value] of source) callback.call(thisArg, value, key, view);
    },
    [Symbol.iterator]() { return source[Symbol.iterator](); },
  });
  return view;
}

export function loadGraphPackages(packages) {
  const byPackage = new Map();
  const nodes = new Map();

  for (const candidate of packages) {
    const pkg = immutableData(candidate);
    if (byPackage.has(pkg.id)) throw new Error(`duplicate package ${pkg.id}`);
    byPackage.set(pkg.id, pkg);

    for (const node of pkg.nodes || []) {
      if (!TYPES.has(node.type)) throw new Error(`invalid node type ${node.type}`);
      if (nodes.has(node.id)) throw new Error(`duplicate node ${node.id}`);
      nodes.set(node.id, immutableData({ ...node, packageId: pkg.id }));
    }
  }

  const registry = Object.freeze({ byPackage: readonlyMap(byPackage), nodes: readonlyMap(nodes) });
  WORLD_GRAPH_REGISTRIES.add(registry);
  return registry;
}

// An Object.freeze check is forgeable: a caller can freeze a wrapper around still-mutable Maps.
// Runtime authority accepts only registries minted by this module after deep-copying/freezing every
// package and node. The private WeakSet cannot be reproduced by content or an HTTP caller.
export const isWorldGraphRegistry = (registry) => (
  !!registry && typeof registry === 'object' && WORLD_GRAPH_REGISTRIES.has(registry)
);

export const nodeOf = (registry, id) => registry.nodes.get(id) || null;

export function requirementsMet(node, state) {
  const completed = state.completed || new Set();
  return (node.requires || []).every((id) => completed.has(id))
    && (node.requiresAny || []).every((group) => group.some((id) => completed.has(id)))
    && !(node.excludes || []).some((id) => completed.has(id));
}

export function visibleNode(node, state) {
  if (node.visibility === 'public') return true;
  const discovered = state.discovered?.has(node.id) || false;
  if (node.visibility !== 'role_private') return discovered;
  const requiredRole = node.metadata?.roleId;
  return discovered && !!requiredRole && (state.assignedRoles?.has(requiredRole) || false);
}

export const registerGraphPackage = (pkg) => loadGraphPackages([pkg]);
