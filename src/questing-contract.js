// Public, value-neutral quest services. Author-only drafts have a separate schema from puzzles.
const string = { type: 'string' };
const ref = name => ({ $ref: `#/components/schemas/${name}` });
const array = (items, maxItems) => ({ type: 'array', items, ...(maxItems ? { maxItems } : {}) });
const object = (properties, required = Object.keys(properties)) => ({ type: 'object', additionalProperties: false, required, properties });
const nullable = schema => ({ oneOf: [schema, { type: 'null' }] });
const character = { type: ['object', 'null'], additionalProperties: true };
const labeled = object({ id: string, label: string });
const clue = object({ id: string, text: string });
const template = object({ id: string, title: string, setup: string, question: string });
const mysterySummary = {
  id: string, title: string, templateId: string, sceneId: string,
  status: { type: 'string', enum: ['draft', 'published'] }, authorCredit: string,
  createdAt: { type: 'string', format: 'date-time' }, publishedAt: { type: ['string', 'null'], format: 'date-time' },
  rating: { type: ['number', 'null'], minimum: 1, maximum: 5 }, ratings: { type: 'integer', minimum: 0 },
  solved: { type: 'boolean' }, myRating: { type: ['integer', 'null'], minimum: 1, maximum: 5 },
};

export const QUESTING_SCHEMAS = {
  ContentInteractionItem: object({ id: string, label: string, description: string }, ['id', 'label']),
  ContentInteraction: object({
    kind: { type: 'string', enum: ['deduction', 'interrogation', 'timeline', 'scene', 'planning', 'stealth', 'inventory'] },
    mode: { type: 'string', enum: ['ordered_ids', 'unordered_ids', 'mapping'] },
    items: array(ref('ContentInteractionItem'), 64), slots: array(ref('ContentInteractionItem'), 64),
  }, ['kind', 'mode', 'items']),
  ContentExpectations: object({ durationMinutes: { type: 'integer', minimum: 1 }, difficulty: string,
    summary: string, reasoning: string, combat: string, group: string, commitments: array(string) }, []),
  ContentJournalEntry: object({ nodeId: string, title: { type: ['string', 'null'] }, kind: string,
    summary: { type: ['string', 'null'] }, outcome: { type: ['string', 'null'], enum: ['success', 'complication', null] },
    choiceId: { type: ['string', 'null'] }, evidenceKind: { type: 'string', enum: ['confirmed', 'testimony'] },
  }, ['nodeId', 'title', 'kind', 'summary', 'outcome', 'choiceId']),
  ContentRecap: object({ title: string, lastCompleted: { type: ['string', 'null'] }, nextObjectives: array(string) }),
  ContentAgenda: object({ prompt: string, completed: { type: 'boolean' } }),
  ContentDebriefEntry: object({ name: string, roleId: string, prompt: string, completed: { type: 'boolean' } }),
  ContentCaseNote: object({ id: string, text: { type: 'string', maxLength: 500 }, author: string,
    roleId: string, at: { type: 'string', format: 'date-time' }, untrusted: { type: 'boolean', const: true } }),
  QuestReadingExercise: object({ id: string, title: string, prompt: string, items: array(labeled, 3),
    attempts: { type: 'integer', minimum: 0 }, solved: { type: 'boolean' } }),
  QuestingBoard: object({ character,
    reputation: object({ distinctCases: { type: 'integer', minimum: 0 }, categories: array(string), title: string }),
    relationships: array(object({ id: string, name: string, state: string, summary: string })),
    districtScenes: array(object({ id: string, districtId: string, scope: { type: 'string', const: 'personal' }, title: string, text: string, followupNamespace: string })),
    nemesis: nullable(object({ name: string, response: string, followupNamespace: string })),
    services: array(object({ id: string, title: string, unlocked: { type: 'boolean' }, summary: string,
      unlockNamespace: string, exercise: nullable(ref('QuestReadingExercise')) })),
  }),
  QuestPracticeReceipt: object({ character, ok: { type: 'boolean' }, solved: { type: 'boolean' },
    alreadySolved: { type: 'boolean' }, message: string }, ['character', 'ok', 'solved']),
  QuestWorkshopPuzzle: object({ ...mysterySummary, setup: string, question: string,
    scene: labeled, suspects: array(labeled, 3), clues: array(clue, 6) }),
  QuestWorkshopOwnDraft: object({ ...mysterySummary,
    culpritId: { ...string, description: 'Visible only in the authenticated author’s own drafts.' },
    clueIds: array(string, 6),
  }),
  QuestWorkshopBoard: object({ templates: array(template), suspects: array(labeled, 3), scenes: array(labeled, 3),
    clues: array(clue), mine: array(ref('QuestWorkshopOwnDraft'), 20), published: array(ref('QuestWorkshopPuzzle'), 50) }),
  QuestWorkshopReceipt: object({ mystery: { oneOf: [ref('QuestWorkshopPuzzle'), ref('QuestWorkshopOwnDraft')] } }),
  QuestWorkshopSolveReceipt: object({ ok: { type: 'boolean' }, solved: { type: 'boolean' }, message: string }),
  QuestWorkshopRatingReceipt: object({ rating: { type: 'number', minimum: 1, maximum: 5 }, ratings: { type: 'integer', minimum: 1 }, myRating: { type: 'integer', minimum: 1, maximum: 5 } }),
  ClueDeduction: object({ version: { type: 'integer', const: 2 }, kind: string,
    kindName: { type: 'string', enum: ['Surveillance timeline', 'Courier route', 'Landmark matching', 'Witness statements'] }, prompt: string,
    observations: array(string), choices: array(labeled), hint: string, actionLabel: string,
    endpoint: { type: 'string', const: '/v1/clues/answer' } }),
  ClueTrailReceipt: object({ character, ok: { type: 'boolean' }, cold: { type: 'boolean' },
    riddle: string, energy: { type: 'integer', minimum: 0 }, hint: string,
    step: { type: 'integer', minimum: 1 }, of: { type: 'integer', minimum: 1 },
    interaction: ref('ClueDeduction'), casket: { type: 'boolean' }, take: { type: 'integer', minimum: 0 },
    tier: string, caskets: { type: 'integer', minimum: 0 }, rank: string,
    relic: object({ id: string, name: string }),
  }, ['character', 'ok']),
};

const operation = (operationId, response, requestSchema) => ({ operationId,
  responseSchema: ref(response), ...(requestSchema ? { requestSchema } : {}) });
const empty = object({});
export const QUESTING_CONTRACTS = {
  'GET /v1/questing': operation('getQuestingBoard', 'QuestingBoard'),
  'POST /v1/questing/practice': operation('submitQuestReadingExercise', 'QuestPracticeReceipt', object({
    exerciseId: { type: 'string', minLength: 1 }, ids: { type: 'array', maxItems: 3, uniqueItems: true, items: string },
  })),
  'GET /v1/quest-workshop': operation('getQuestWorkshop', 'QuestWorkshopBoard'),
  'POST /v1/quest-workshop': operation('createQuestWorkshopDraft', 'QuestWorkshopReceipt', object({
    title: { type: 'string', minLength: 3, maxLength: 80 },
    templateId: { type: 'string', enum: ['missing-ledger', 'switched-envelope', 'silent-piano'] },
    sceneId: { type: 'string', enum: ['docks', 'canal', 'foundry'] },
    culpritId: { type: 'string', enum: ['courier', 'tailor', 'pianist'] },
    clueIds: { type: 'array', minItems: 2, maxItems: 6, uniqueItems: true, items: string },
  })),
  'GET /v1/quest-workshop/:id': operation('getQuestWorkshopMystery', 'QuestWorkshopReceipt'),
  'POST /v1/quest-workshop/:id/publish': operation('publishQuestWorkshopMystery', 'QuestWorkshopReceipt', empty),
  'POST /v1/quest-workshop/:id/solve': operation('solveQuestWorkshopMystery', 'QuestWorkshopSolveReceipt', object({ suspectId: { type: 'string', enum: ['courier', 'tailor', 'pianist'] } })),
  'POST /v1/quest-workshop/:id/rate': operation('rateQuestWorkshopMystery', 'QuestWorkshopRatingReceipt', object({ stars: { type: 'integer', minimum: 1, maximum: 5 } })),
  'POST /v1/clues/answer': operation('answerClueDeduction', 'ClueTrailReceipt', object({
    step: { type: 'integer', minimum: 1, maximum: 7 }, answerId: { type: 'string', pattern: '^[a-f0-9]{20}$' },
  })),
};
