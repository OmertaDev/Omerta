const string = (maxLength = 160) => ({ type: 'string', maxLength });
const id = () => ({ ...string(), minLength: 1 });
const list = (items, maxItems = 64) => ({ type: 'array', maxItems, items });
const object = (properties, required = Object.keys(properties)) => ({ type: 'object', additionalProperties: false, properties, required });
const bool = { type: 'boolean' };
const revision = { type: 'integer', minimum: 0 };
const rating = { type: 'integer', minimum: 1, maximum: 5 };
const evidenceType = { type: 'string', enum: ['self_reported_human', 'ai', 'unspecified'] };
const familiarity = { type: 'string', enum: ['new', 'familiar'] };
const answers = object({ what: string(4000), why: string(4000), next: string(4000) });
const operations = {
  save_draft: object({ text: string(4000), evidenceIds: { ...list(id()), uniqueItems: true }, conclusionId: id() }, ['text', 'evidenceIds']),
  set_motive: object({ motiveId: id() }),
  first_impression: object({ text: string(1000), unsure: bool, share: bool }),
  disclose: object({ evidenceId: id(), npcId: id() }),
  fieldwork: object({ assignmentId: id(), questionId: id(), methodId: id() }),
  propose_mandate: object({ nodeId: id(), delegateAccountId: id() }),
  acknowledge_mandate: object({ nodeId: id() }), clear_mandate: object({ nodeId: id() }),
  open_debrief: object({}),
  study_consent: object({ consent: bool, evidenceType, familiarity }),
  study_comprehension: object({ answers }),
  study_recall: object({ memory: string(4000), enjoyment: rating, understanding: rating }),
};
const base = { expectedRevision: revision, expectedQualityRevision: revision,
  operation: { type: 'string', enum: Object.keys(operations) } };
export const QUEST_QUALITY_BODY = {
  type: 'object', additionalProperties: false,
  required: Object.keys(base), properties: { ...base, ...Object.assign({}, ...Object.values(operations).map(shape => shape.properties)) },
  // Fastify removes additional properties. Keep the single closed object above so that
  // trying a different oneOf branch cannot delete another operation's legitimate fields.
  oneOf: Object.entries(operations).map(([operation, shape]) => ({
    properties: { operation: { type: 'string', const: operation } }, required: shape.required,
    not: { anyOf: Object.keys(Object.assign({}, ...Object.values(operations).map(item => item.properties)))
      .filter(key => !Object.hasOwn(shape.properties, key)).map(key => ({ required: [key] })) },
  })),
};
const named = object({ id: id(), label: string(4096) });
const impression = object({ text: string(1000), unsure: bool, shared: bool });
const nullableString = { type: ['string', 'null'] };
export const QUEST_QUALITY_SCHEMA = object({
  version: { type: 'integer', const: 1 }, question: string(4096), revision,
  identity: object({ activity: string(4096), emotionalTurn: string(4096) }),
  assumptions: list(object({ id: id(), text: string(4096) })),
  clauses: list(object({ id: id(), text: string(4096), evidenceNodeId: id() }), 128),
  motives: list(object({ id: id(), label: string(4096), description: string(4096) }, ['id', 'label'])),
  npcs: list(object({ id: id(), label: string(4096), principles: list(string(4096)), voice: string(4096) }, ['id', 'label'])),
  participants: list(object({ id: id(), name: string(4096), roleId: id(), isMe: bool }), 16),
  questions: list(object({ id: id(), text: string(4096), nodeId: id() })),
  currentQuestion: string(4096), evidence: list(object({ id: id(), title: string(4096), text: string(4096),
    evidenceKind: { type: 'string', enum: ['confirmed', 'testimony'] } }, ['id', 'title', 'text']), 512),
  recap: list(string(4096)), draft: object({ text: string(4000), evidenceIds: list(id()), conclusionId: id() }, ['text', 'evidenceIds']),
  motiveId: nullableString, firstImpression: impression,
  sharedImpressions: list(object({ accountId: id(), text: string(1000), unsure: bool }), 16),
  disclosures: list(object({ evidenceId: id(), recipients: list(object({ npcId: id(), label: string(4096) })) })),
  disclosureReports: list(object({ evidenceId: id(), npcId: id(), report: string(4096) }), 256),
  fieldworkAssignments: list(object({ id: id(), title: string(4096), questions: list(named), methods: list(named) })),
  fieldworkReports: list(object({ assignmentId: id(), questionId: id(), methodId: id(), report: string(4096) })),
  delegations: list(object({ nodeId: id(), delegateAccountId: id(), acknowledgedAccountIds: list(id(), 16), requiredAccountIds: list(id(), 16) }), 512),
  debrief: object({ available: bool, opened: bool, text: string(16000) }, ['available', 'opened']),
  study: object({ consented: bool, evidenceType, familiarity, eligibleAt: nullableString,
    comprehensionSubmitted: bool, recallSubmitted: bool, recallEligible: bool, canSubmitComprehension: bool,
    comprehension: answers, recall: object({ memory: string(4000), enjoyment: rating, understanding: rating }) },
  ['consented', 'evidenceType', 'familiarity', 'eligibleAt', 'comprehensionSubmitted', 'recallSubmitted', 'recallEligible', 'canSubmitComprehension']),
  canDelegate: bool, ownMemberId: id(),
}, ['version', 'question', 'revision', 'assumptions', 'clauses', 'participants', 'questions', 'currentQuestion', 'evidence',
  'recap', 'draft', 'motiveId', 'firstImpression', 'sharedImpressions', 'disclosures', 'disclosureReports',
  'fieldworkAssignments', 'fieldworkReports', 'delegations', 'debrief', 'study', 'canDelegate', 'ownMemberId']);
