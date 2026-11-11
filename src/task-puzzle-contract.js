const str = { type: 'string' }, integer = { type: 'integer' };
const object = properties => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
const array = items => ({ type: 'array', items });
const namedId = object({ id: str, label: str });
export const TASK_PUZZLE_SUBMISSION = object({
  id: { type: 'string', format: 'uuid', pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' },
  answer: { oneOf: [object({ start: integer }), object({ path: array(str) }),
    object({ pairs: array(object({ left: str, right: str })) }), object({ suspect: str })] },
});
export const TASK_PUZZLE_SELECTOR = object({ scope: { type: 'string', enum: ['mission', 'hustle', 'crime'] },
  targetId: { type: 'string', description: 'mission: m2, m11 or m12; hustle: legwork after meeting the contact; crime: a valid crime ID from /v1/rules.' } });
const variants = [
  ['patrol', object({ startOptions: array(integer), duration: integer, deadline: integer, blocked: array(object({ start: integer, end: integer })) }),
    object({ type: { const: 'start' }, options: array(integer) })],
  ['route', object({ nodes: array(namedId), edges: array(object({ from: str, to: str, cost: integer })), start: str, end: str, required: array(str), budget: integer }),
    object({ type: { const: 'path' }, nodeIds: array(str) })],
  ['matching', object({ left: array(namedId), right: array(namedId), allowed: array(object({ left: str, rights: array(str) })) }),
    object({ type: { const: 'pairs' }, leftIds: array(str), rightIds: array(str) })],
  ['evidence', object({ suspects: array(namedId), statements: array(object({ id: str, op: { enum: ['in', 'not-in'] }, suspects: array(str) })), trueCount: integer }),
    object({ type: { const: 'choice' }, options: array(namedId) })],
];
export const TASK_PUZZLE_SCHEMAS = {
  TaskPuzzleSubmission: TASK_PUZZLE_SUBMISSION,
  TaskPuzzle: { oneOf: variants.map(([kind, constraints, controls]) => object({
    id: { type: 'string', format: 'uuid' }, version: { const: 1 }, kind: { const: kind },
    title: str, instructions: str, constraints, controls, hint: str, status: { enum: ['issued', 'consumed'] },
  })) },
};
export const TASK_PUZZLE_CONTRACTS = {
  'POST /v1/task-puzzles': { operationId: 'issueOrResumeTaskPuzzle', requestSchema: TASK_PUZZLE_SELECTOR,
    responseSchema: { type: 'object', required: ['puzzle'], properties: { puzzle: { $ref: '#/components/schemas/TaskPuzzle' }, character: { type: ['object', 'null'] } } } },
  'GET /v1/task-puzzles': { operationId: 'readTaskPuzzle',
    requestParameters: Object.entries(TASK_PUZZLE_SELECTOR.properties).map(([name, schema]) => ({ name, schema, in: 'query', required: true })),
    responseSchema: object({ puzzle: { oneOf: [{ $ref: '#/components/schemas/TaskPuzzle' }, { type: 'null' }] } }) },
  'POST /v1/missions/:id': { operationId: 'completeFamilyMission', requestSchema: { type: 'object', additionalProperties: false,
    description: 'm2, m11 and m12 require puzzle:{id,answer}. Other missions are unchanged. Read /v1/rules mission.puzzle. All readiness and cooldown checks still apply.',
    properties: { puzzle: TASK_PUZZLE_SUBMISSION } } },
  'POST /v1/hustle/advance': { operationId: 'advanceHustle', requestSchema: { type: 'object', additionalProperties: false,
    description: 'Step 1 requires puzzle:{id,answer} in addition to real legwork and the correct district. Other steps need no puzzle.',
    properties: { puzzle: TASK_PUZZLE_SUBMISSION } } },
};
