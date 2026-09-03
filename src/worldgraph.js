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

export function loadGraphPackages(packages) {
  const byPackage = new Map();
  const nodes = new Map();

  for (const pkg of packages) {
    if (byPackage.has(pkg.id)) throw new Error(`duplicate package ${pkg.id}`);
    byPackage.set(pkg.id, pkg);

    for (const node of pkg.nodes || []) {
      if (!TYPES.has(node.type)) throw new Error(`invalid node type ${node.type}`);
      if (nodes.has(node.id)) throw new Error(`duplicate node ${node.id}`);
      nodes.set(node.id, Object.freeze({ ...node, packageId: pkg.id }));
    }
  }

  return Object.freeze({ byPackage, nodes });
}

export const nodeOf = (registry, id) => registry.nodes.get(id) || null;

export function requirementsMet(node, state) {
  const completed = state.completed || new Set();
  return (node.requires || []).every((id) => completed.has(id))
    && (node.requiresAny || []).every((group) => group.some((id) => completed.has(id)))
    && !(node.excludes || []).some((id) => completed.has(id));
}

export function visibleNode(node, state) {
  if (node.visibility === 'public') return true;
  return state.discovered?.has(node.id) || false;
}

export const registerGraphPackage = (pkg) => loadGraphPackages([pkg]);
