// Authored quality rules are data, never runtime authority or a claim of player-tested quality.
const ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const isId = (value) => typeof value === 'string' && value.length <= 160 && ID.test(value);
const isText = (value) => typeof value === 'string' && value.trim().length > 0 && value.length <= 4096;
const record = (value) => value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const closed = (value, keys) => record(value) && Reflect.ownKeys(value).every((key) =>
  typeof key === 'string' && keys.includes(key) && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'));
const uniqueIds = (value, minimum = 0, maximum = 64) => Array.isArray(value)
  && value.length >= minimum && value.length <= maximum && value.every(isId) && new Set(value).size === value.length;
const FIELDS = ['version', 'question', 'assumptions', 'clauses', 'motives', 'npcs', 'revelations',
  'promises', 'branches', 'budget', 'spoilers', 'pacing', 'identity', 'questions', 'procedures',
  'fieldworkAssignments', 'disclosures', 'spotlights'];

export function validateQuestQuality(bundle) {
  const errors = [], warnings = [];
  const issue = (list, code, path, message) => list.push({ code, path, message });
  const error = (code, path, message) => issue(errors, code, path, message);
  const warn = (code, path, message) => issue(warnings, code, path, message);
  const nodes = Array.isArray(bundle?.nodes) ? bundle.nodes : [];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const runtime = bundle?.runtime;
  const entry = nodeById.get(runtime?.entryNodeId), design = entry?.payload?.quality;
  for (const node of nodes) if (node.payload?.quality !== undefined && node !== entry) {
    error('quality_location', node.id, 'Quality metadata belongs only to the runtime entry mystery.');
  }
  if (design === undefined) return { errors, warnings };
  const profile = new Set(runtime?.nodeIds || []), actions = new Set(runtime?.actionNodeIds || []);
  if (profile.size > 512 || (bundle.edges || []).length > 4096) {
    error('graph_bound', 'quality', 'Quality analysis supports at most 512 profile nodes and 4096 edges.');
    return { errors, warnings };
  }
  const flow = new Map(), links = new Map(), incoming = new Map();
  for (const edge of bundle.edges || []) if (profile.has(edge.from) && profile.has(edge.to)
    && ['UNLOCKS', 'REVEALS'].includes(edge.type)) {
    if (!links.has(edge.from)) links.set(edge.from, []); links.get(edge.from).push(edge.to);
    if (!incoming.has(edge.to)) incoming.set(edge.to, []); incoming.get(edge.to).push(edge);
    if (edge.type === 'UNLOCKS') { if (!flow.has(edge.from)) flow.set(edge.from, []); flow.get(edge.from).push(edge.to); }
  }
  const mustPrecede = (source, target, seen = new Set()) => {
    if (source === runtime.entryNodeId || source === target) return true;
    if (seen.has(target)) return false;
    const node = nodeById.get(target);
    if ((node?.payload?.gates || []).some((gate) => gate.kind === 'completed_node' && gate.nodeId === source)) return true;
    const next = new Set(seen); next.add(target);
    const edges = incoming.get(target) || [], unlocks = edges.filter((edge) => edge.type === 'UNLOCKS');
    const revealers = edges.filter((edge) => edge.type === 'REVEALS');
    const routes = revealers.map((edge) => mustPrecede(source, edge.from, next));
    if (unlocks.length) routes.push(node?.payload?.unlockMode === 'any'
      ? unlocks.every((edge) => mustPrecede(source, edge.from, next))
      : unlocks.some((edge) => mustPrecede(source, edge.from, next)));
    return routes.length > 0 && routes.every(Boolean);
  };
  const shape = (value, fields, path) => {
    if (closed(value, fields)) return true;
    error('closed_shape', path, 'Expected a closed data object.'); return false;
  };
  const string = (value, path) => { if (!isText(value)) error('text', path, 'Expected nonempty text of at most 4096 characters.'); };
  const identifier = (value, path) => { if (!isId(value)) error('identifier', path, 'Expected an identifier of at most 160 characters.'); };
  const ref = (value, path, types) => {
    if (!isId(value) || !profile.has(value) || !nodeById.has(value) || (types && !types.includes(nodeById.get(value).type))) {
      error('node_reference', path, 'Expected a profiled node of the declared type.'); return false;
    }
    return true;
  };
  const refs = (value, path, types, minimum = 0) => {
    if (!uniqueIds(value, minimum)) { error('node_references', path, 'Expected bounded unique node identifiers.'); return []; }
    value.forEach((id, i) => ref(id, `${path}[${i}]`, types)); return value;
  };
  const rows = (value, path, maximum = 64, minimum = 0) => {
    if (value === undefined && minimum === 0) return [];
    if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
      error('bounded_array', path, `Expected ${minimum}-${maximum} entries.`); return [];
    }
    return value;
  };
  const keyed = (value, path, fields, maximum = 64, minimum = 0) => {
    const seen = new Set();
    return rows(value, path, maximum, minimum).filter((row, i) => {
      const at = `${path}[${i}]`;
      if (!shape(row, fields, at)) return false;
      identifier(row.id, `${at}.id`);
      if (seen.has(row.id)) error('duplicate_id', at, 'Identifiers must be unique.');
      seen.add(row.id); return true;
    });
  };
  if (!shape(design, FIELDS, 'quality')) return { errors, warnings };
  try { if (Buffer.byteLength(JSON.stringify(design)) > 131072) error('size', 'quality', 'Quality metadata exceeds 128 KiB.'); }
  catch { error('data', 'quality', 'Quality metadata must be serializable data.'); }
  if (design.version !== 1) error('version', 'quality.version', 'Only quality version 1 is supported.');
  string(design.question, 'quality.question');
  const assumptions = keyed(design.assumptions, 'quality.assumptions', ['id', 'text'], 32, 1);
  assumptions.forEach((row) => string(row.text, `assumption.${row.id}.text`));
  const clauses = keyed(design.clauses, 'quality.clauses', ['id', 'text', 'evidenceNodeId'], 128, 1);
  clauses.forEach((row) => { string(row.text, `clause.${row.id}.text`); ref(row.evidenceNodeId, `clause.${row.id}.evidenceNodeId`, ['evidence']); });
  const motives = keyed(design.motives, 'quality.motives', ['id', 'label', 'description'], 16);
  motives.forEach((row) => { string(row.label, `motive.${row.id}.label`); if (row.description !== undefined) string(row.description, `motive.${row.id}.description`); });
  if (design.identity !== undefined && shape(design.identity, ['activity', 'emotionalTurn'], 'quality.identity')) {
    string(design.identity.activity, 'quality.identity.activity'); string(design.identity.emotionalTurn, 'quality.identity.emotionalTurn');
  }
  keyed(design.questions, 'quality.questions', ['id', 'text', 'nodeId']).forEach((row) => {
    string(row.text, `question.${row.id}.text`); ref(row.nodeId, `question.${row.id}.nodeId`);
  });
  const spotlightNodes = new Set(), partyRoles = new Set((bundle.edges || [])
    .filter((edge) => edge.from === runtime.partyPolicyId && edge.type === 'PERFORMED_BY_ROLE').map((edge) => edge.to));
  for (const row of rows(design.spotlights, 'quality.spotlights')) {
    if (!shape(row, ['nodeId', 'roleId'], 'quality.spotlights')) continue;
    ref(row.nodeId, 'spotlight.nodeId', ['puzzle', 'choice']); ref(row.roleId, 'spotlight.roleId', ['role']);
    if (!actions.has(row.nodeId) || !partyRoles.has(row.roleId)) error('spotlight_reference', 'quality.spotlights', 'Spotlights require an action and an actual party role.');
    if (spotlightNodes.has(row.nodeId)) error('duplicate_spotlight', 'quality.spotlights', 'Declare at most one spotlight per action.');
    spotlightNodes.add(row.nodeId);
  }

  const npcs = keyed(design.npcs, 'quality.npcs', ['id', 'label', 'knowledge', 'beliefs', 'conceals', 'principles', 'voice'], 16);
  const npcById = new Map(npcs.map((npc) => [npc.id, npc]));
  for (const npc of npcs) {
    string(npc.label, `npc.${npc.id}.label`);
    for (const kind of ['knowledge', 'beliefs']) {
      const seen = new Set();
      for (const row of rows(npc[kind], `npc.${npc.id}.${kind}`)) {
        if (!shape(row, ['evidenceNodeId', 'sourceNodeId'], `npc.${npc.id}.${kind}`)) continue;
        ref(row.evidenceNodeId, `npc.${npc.id}.${kind}.evidenceNodeId`, ['evidence']);
        ref(row.sourceNodeId, `npc.${npc.id}.${kind}.sourceNodeId`);
        if (seen.has(row.evidenceNodeId)) error('duplicate_knowledge', `npc.${npc.id}.${kind}`, 'Declare each fact once.');
        seen.add(row.evidenceNodeId);
      }
    }
    const known = new Set((Array.isArray(npc.knowledge) ? npc.knowledge : []).map((row) => row?.evidenceNodeId));
    refs(npc.conceals ?? [], `npc.${npc.id}.conceals`, ['evidence']).forEach((id) => {
      if (!known.has(id)) error('concealed_unknown', `npc.${npc.id}.conceals`, 'Concealed evidence must be declared knowledge.');
    });
    rows(npc.principles, `npc.${npc.id}.principles`, 8).forEach((value) => string(value, `npc.${npc.id}.principles`));
    if (npc.voice !== undefined) string(npc.voice, `npc.${npc.id}.voice`);
  }
  const justified = (npc, evidenceId, atNodeId, path) => {
    const testimony = nodeById.get(evidenceId)?.payload?.evidenceKind === 'testimony';
    const sources = [...(Array.isArray(npc?.knowledge) ? npc.knowledge : []),
      ...(testimony && Array.isArray(npc?.beliefs) ? npc.beliefs : [])];
    if (!sources.some((source) => source?.evidenceNodeId === evidenceId && source.sourceNodeId !== atNodeId
      && mustPrecede(source.sourceNodeId, atNodeId))) {
      error('unjustified_revelation', path, 'A revelation requires independent NPC knowledge; belief supports testimony only.');
    }
  };
  for (const row of rows(design.revelations, 'quality.revelations')) {
    if (!shape(row, ['nodeId', 'npcId', 'evidenceIds', 'requiresEvidenceIds'], 'quality.revelations')) continue;
    ref(row.nodeId, 'revelation.nodeId', ['puzzle', 'choice']);
    const npc = npcById.get(row.npcId);
    if (!npc) error('npc_reference', 'revelation.npcId', 'Unknown NPC.');
    refs(row.evidenceIds, 'revelation.evidenceIds', ['evidence'], 1).forEach((id) => justified(npc, id, row.nodeId, 'revelation.evidenceIds'));
    refs(row.requiresEvidenceIds, 'revelation.requiresEvidenceIds', ['evidence']);
  }

  const reaches = (from, to, blocked, graph = links) => {
    const todo = [from], seen = new Set();
    while (todo.length) { const next = todo.pop(); if (next === blocked || seen.has(next)) continue;
      if (next === to) return true; seen.add(next); todo.push(...(graph.get(next) || [])); }
    return false;
  };
  for (const row of keyed(design.promises, 'quality.promises', ['id', 'setupNodeId', 'payoffNodeIds'], 32)) {
    ref(row.setupNodeId, `promise.${row.id}.setupNodeId`);
    for (const payoff of refs(row.payoffNodeIds, `promise.${row.id}.payoffNodeIds`, undefined, 1)) {
      if (payoff === row.setupNodeId || !reaches(row.setupNodeId, payoff)) error('unreachable_payoff', `promise.${row.id}`, 'A payoff must be reachable after its setup.');
    }
  }
  for (const row of rows(design.branches, 'quality.branches', 32)) {
    if (!shape(row, ['choiceNodeId', 'reconvergeNodeId', 'maxActions'], 'quality.branches')) continue;
    ref(row.choiceNodeId, 'branch.choiceNodeId', ['choice']); ref(row.reconvergeNodeId, 'branch.reconvergeNodeId');
    if (!Number.isInteger(row.maxActions) || row.maxActions < 1 || row.maxActions > 128) error('budget', 'branch.maxActions', 'Expected an action budget from 1 to 128.');
    const starts = flow.get(row.choiceNodeId) || [];
    if (!starts.length || starts.some((start) => !reaches(start, row.reconvergeNodeId, undefined, flow)
      || (row.reconvergeNodeId !== runtime.terminalNodeId && reaches(start, runtime.terminalNodeId, row.reconvergeNodeId, flow)))) {
      error('branch_reconvergence', 'quality.branches', 'Every declared branch must reach its join without an earlier terminal escape.');
    }
    const between = [...profile].filter((id) => actions.has(id) && reaches(row.choiceNodeId, id, row.reconvergeNodeId, flow)
      && reaches(id, row.reconvergeNodeId, undefined, flow));
    if (between.length > row.maxActions) warn('branch_budget', 'quality.branches', 'The branch exposes more actions than its declared budget.');
  }
  for (const row of rows(design.spoilers, 'quality.spoilers')) {
    if (!shape(row, ['nodeId', 'requiresNodeIds'], 'quality.spoilers')) continue;
    ref(row.nodeId, 'spoiler.nodeId');
    for (const required of refs(row.requiresNodeIds, 'spoiler.requiresNodeIds', undefined, 1)) {
      if (required === row.nodeId) error('self_spoiler', 'quality.spoilers', 'A reveal cannot require itself.');
      else if (!reaches(required, row.nodeId)) warn('spoiler_order', 'quality.spoilers', 'Graph ordering alone does not demonstrate this spoiler prerequisite.');
    }
  }
  if (design.budget !== undefined && shape(design.budget, ['maxActions', 'maxNewConcepts', 'maxReadingWords'], 'quality.budget')) {
    for (const [key, max] of [['maxActions', 128], ['maxNewConcepts', 128], ['maxReadingWords', 20000]]) {
      if (!Number.isInteger(design.budget[key]) || design.budget[key] < 1 || design.budget[key] > max) error('budget', `quality.budget.${key}`, `Expected a budget from 1 to ${max}.`);
    }
    if (actions.size > design.budget.maxActions) warn('action_budget', 'quality.budget', 'Profile actions exceed the declared action budget.');
    if (assumptions.length > design.budget.maxNewConcepts) warn('concept_budget', 'quality.budget', 'Declared assumptions exceed the concept budget.');
    const authoredText = [...profile].flatMap((id) => {
      const payload = nodeById.get(id)?.payload || {};
      return [payload.title, payload.prompt, payload.summary, payload.description,
        ...(payload.options || []).flatMap((row) => [row.label, row.description]),
        ...(payload.interaction?.items || []).flatMap((row) => [row.label, row.description]),
        ...(payload.interaction?.conclusions || []).flatMap((row) => [row.label, row.description])];
    });
    const words = [design.question, ...assumptions.map((row) => row.text), ...clauses.map((row) => row.text), ...authoredText]
      .filter(isText).join(' ').trim().split(/\s+/).length;
    if (words > design.budget.maxReadingWords) warn('reading_budget', 'quality.budget', 'The authored reading envelope exceeds the budget, including alternate branches.');
  }
  if (design.pacing !== undefined && shape(design.pacing, ['pressureNodeIds', 'safeNodeIds', 'maxConsecutivePressure'], 'quality.pacing')) {
    const pressure = new Set(refs(design.pacing.pressureNodeIds, 'pacing.pressureNodeIds'));
    const safe = new Set(refs(design.pacing.safeNodeIds, 'pacing.safeNodeIds'));
    if ([...safe].some((id) => pressure.has(id))) error('pacing_overlap', 'quality.pacing', 'A beat cannot be both pressure and relief.');
    const limit = design.pacing.maxConsecutivePressure;
    if (!Number.isInteger(limit) || limit < 1 || limit > 16) error('pacing_budget', 'quality.pacing', 'Expected 1-16 consecutive pressure beats.');
    // Bound route exploration by retaining the greatest pressure count seen at each node.
    const best = new Map(), pending = [[runtime.entryNodeId, 0]];
    while (Number.isInteger(limit) && limit >= 1 && limit <= 16 && pending.length) {
      const [id, count] = pending.pop();
      const next = safe.has(id) ? 0 : pressure.has(id) ? count + 1 : count;
      if (next > limit) { if (!warnings.some((row) => row.code === 'pressure_run')) warn('pressure_run', 'quality.pacing', 'An available route exceeds the declared pressure run.'); continue; }
      if ((best.get(id) ?? -1) >= next) continue; best.set(id, next);
      for (const child of flow.get(id) || []) pending.push([child, next]);
    }
  }
  for (const row of keyed(design.procedures, 'quality.procedures', ['id', 'nodeId', 'masteryFlag', 'skipOptionId', 'learnOptionId', 'learnNodeId'], 16)) {
    ref(row.nodeId, `procedure.${row.id}.nodeId`, ['choice']); identifier(row.masteryFlag, `procedure.${row.id}.masteryFlag`);
    ref(row.learnNodeId, `procedure.${row.id}.learnNodeId`, ['puzzle']);
    if (typeof row.masteryFlag !== 'string' || !row.masteryFlag.startsWith('quest.procedure.')) error('procedure_flag', `procedure.${row.id}.masteryFlag`, 'Procedure mastery flags require the quest.procedure. prefix.');
    const options = nodeById.get(row.nodeId)?.payload?.options || [];
    if (row.skipOptionId === row.learnOptionId || !options.some((option) => option.id === row.skipOptionId)
      || !options.some((option) => option.id === row.learnOptionId)) error('procedure_options', `procedure.${row.id}`, 'Learn and skip must name distinct actual choice options.');
    const learn = options.find((option) => option.id === row.learnOptionId)?.nextNodeIds;
    const skip = options.find((option) => option.id === row.skipOptionId)?.nextNodeIds;
    if (!Array.isArray(learn) || !learn.length || !learn.some((id) => reaches(id, row.learnNodeId, undefined, flow))) {
      error('procedure_learning_path', `procedure.${row.id}`, 'The learn option must reach its demonstrated procedure puzzle.');
    }
    if (!Array.isArray(skip) || !skip.length || skip.some((id) => !reaches(id, runtime.terminalNodeId, row.learnNodeId, flow))) {
      error('procedure_skip_path', `procedure.${row.id}`, 'The skip option must retain a completion path without the procedure puzzle.');
    }
  }
  for (const assignment of keyed(design.fieldworkAssignments, 'quality.fieldworkAssignments', ['id', 'title', 'questions', 'methods', 'outcomes'], 16)) {
    string(assignment.title, `fieldwork.${assignment.id}.title`);
    const questions = keyed(assignment.questions, 'fieldwork.questions', ['id', 'label'], 8, 1);
    const methods = keyed(assignment.methods, 'fieldwork.methods', ['id', 'label'], 8, 1);
    [...questions, ...methods].forEach((row) => string(row.label, 'fieldwork.label'));
    const combinations = new Set(); let productive = false;
    for (const outcome of rows(assignment.outcomes, 'fieldwork.outcomes', 64, 1)) {
      if (!shape(outcome, ['questionId', 'methodId', 'report', 'evidenceNodeIds'], 'fieldwork.outcome')) continue;
      const key = JSON.stringify([outcome.questionId, outcome.methodId]);
      if (!questions.some((row) => row.id === outcome.questionId) || !methods.some((row) => row.id === outcome.methodId)
        || combinations.has(key)) error('fieldwork_combination', 'fieldwork.outcomes', 'Every question/method combination must be unique and declared.');
      combinations.add(key); string(outcome.report, 'fieldwork.report');
      if (refs(outcome.evidenceNodeIds, 'fieldwork.evidenceNodeIds', ['evidence']).length) productive = true;
    }
    if (combinations.size !== questions.length * methods.length) error('fieldwork_coverage', 'fieldwork.outcomes', 'All question/method combinations need authored outcomes.');
    if (!productive) error('fieldwork_empty', 'fieldwork.outcomes', 'A fieldwork assignment must have an evidence-producing outcome.');
  }
  const disclosed = new Set();
  for (const row of rows(design.disclosures, 'quality.disclosures', 64)) {
    if (!shape(row, ['evidenceId', 'recipients'], 'quality.disclosures')) continue;
    ref(row.evidenceId, 'disclosure.evidenceId', ['evidence']);
    if (disclosed.has(row.evidenceId)) error('duplicate_disclosure', 'quality.disclosures', 'Declare recipients together for each evidence item.');
    disclosed.add(row.evidenceId); const recipients = new Set();
    for (const recipient of rows(row.recipients, 'disclosure.recipients', 16, 1)) {
      if (!shape(recipient, ['npcId', 'label', 'report', 'revealNodeIds'], 'disclosure.recipient')) continue;
      if (!npcById.has(recipient.npcId) || recipients.has(recipient.npcId)) error('npc_reference', 'disclosure.npcId', 'Expected a unique declared recipient NPC.');
      recipients.add(recipient.npcId); string(recipient.label, 'disclosure.label'); string(recipient.report, 'disclosure.report');
      refs(recipient.revealNodeIds, 'disclosure.revealNodeIds', ['evidence']).forEach((id) => justified(npcById.get(recipient.npcId), id, row.evidenceId, 'disclosure.revealNodeIds'));
    }
  }
  return { errors, warnings };
}

export function assertQuestQuality(bundle) {
  const result = validateQuestQuality(bundle);
  if (result.errors.length) throw new Error(`Invalid quest quality: ${result.errors.map((row) => `${row.path}: ${row.message}`).join('; ')}`);
  return result;
}

export function qualityNpcKnowledge(design, npcId, completedNodeIds, disclosedEvidenceIds = new Set()) {
  const completed = completedNodeIds instanceof Set ? completedNodeIds : new Set();
  const disclosed = disclosedEvidenceIds instanceof Set ? disclosedEvidenceIds : new Set();
  const npc = design?.npcs?.find((row) => row.id === npcId);
  if (!npc) return new Set();
  return new Set([...(npc.knowledge || []).filter((row) => completed.has(row.sourceNodeId)).map((row) => row.evidenceNodeId), ...disclosed]);
}

export function qualitySpoilerAllows(design, nodeId, visibleNodeIds) {
  if (!(visibleNodeIds instanceof Set)) return false;
  return (design?.spoilers || []).filter((row) => row.nodeId === nodeId)
    .every((row) => row.requiresNodeIds.every((id) => visibleNodeIds.has(id)));
}

export function projectQuestQuality(design, visibleNodeIds) {
  if (!design) return null;
  const visible = visibleNodeIds instanceof Set ? visibleNodeIds : new Set();
  const entries = (values, fields) => (values || []).map((row) => Object.fromEntries(fields.filter((key) => row[key] !== undefined)
    .map((key) => [key, Array.isArray(row[key]) ? [...row[key]] : row[key]])));
  return {
    version: 1, question: design.question,
    assumptions: entries(design.assumptions, ['id', 'text']),
    clauses: entries((design.clauses || []).filter((row) => visible.has(row.evidenceNodeId)
      && qualitySpoilerAllows(design, row.evidenceNodeId, visible)), ['id', 'text', 'evidenceNodeId']),
    ...(design.identity ? { identity: { activity: design.identity.activity, emotionalTurn: design.identity.emotionalTurn } } : {}),
    motives: entries(design.motives, ['id', 'label', 'description']),
    npcs: entries(design.npcs, ['id', 'label', 'principles', 'voice']),
    questions: entries((design.questions || []).filter((row) => visible.has(row.nodeId)
      && qualitySpoilerAllows(design, row.nodeId, visible)), ['id', 'text', 'nodeId']),
    fieldworkAssignments: (design.fieldworkAssignments || []).map((row) => ({ id: row.id, title: row.title,
      questions: entries(row.questions, ['id', 'label']), methods: entries(row.methods, ['id', 'label']) })),
    disclosures: (design.disclosures || []).filter((row) => visible.has(row.evidenceId)).map((row) => ({ evidenceId: row.evidenceId,
      recipients: entries(row.recipients, ['npcId', 'label']) })),
  };
}
