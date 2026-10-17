import assert from 'node:assert/strict';
import Ajv from 'ajv';
import { COMMERCIAL_CAMPAIGNS, COMMERCIAL_CAMPAIGN_ACTIONS, commercialCampaignTerms,
  COMMERCIAL_CAMPAIGN_CONTRACTS, COMMERCIAL_CAMPAIGN_SCHEMAS } from '../src/commercialcampaigns-contracts.js';
import { DISTRICTS, M3 } from '../src/rules.js';
import { INTEL_FORECAST } from '../src/intelforecasts.js';

const rows = [], check = (name, fn) => { fn(); rows.push(name); }, clone = value => JSON.parse(JSON.stringify(value));
const rewrite = value => Array.isArray(value) ? value.map(rewrite) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).map(([key, entry]) => [key,
    key === '$ref' ? entry.replace('#/components/schemas/', '#/definitions/') : rewrite(entry)])) : value;
const ajv = new Ajv({ allErrors: true, strict: true }), definitions = rewrite(COMMERCIAL_CAMPAIGN_SCHEMAS);
const compile = schema => ajv.compile({ definitions, ...rewrite(schema) });
const valid = (validator, value) => assert(validator(value), JSON.stringify(validator.errors));
const invalid = (validator, value) => assert.equal(validator(value), false);
const root = '/v1/company/commercial-campaigns', hash = 'a'.repeat(64), timestamp = '2026-10-16T12:00:00.000Z';
const body = { partnershipId: 'partnership_one', relationshipHash: hash, teamRevision: 1, businessId: 'business_one',
  manufacturerAccountId: 'manufacturer_one', guardAccountId: 'guard_one', firstCarrierAccountId: 'first_one', secondCarrierAccountId: 'second_one',
  origin: DISTRICTS[0].id, handoff: DISTRICTS[1].id, destination: DISTRICTS[2].id,
  scoutFeeCash: INTEL_FORECAST.minFeeCash, minimumStock: INTEL_FORECAST.minStock, scoutTargetAt: timestamp,
  manufacturingFeeCash: 1, guardPriceCash: M3.BODYGUARD_MIN_PRICE, firstFeeCash: 1, secondFeeCash: 1,
  lifetimeSeconds: COMMERCIAL_CAMPAIGNS.minimumSeconds, consent: true };
const ref = { campaignId: 'campaign_one', sourceHash: hash, consent: true };
const view = { campaignId: ref.campaignId, sourceHash: hash, partnershipId: body.partnershipId, businessId: body.businessId,
  state: 'active', stage: 'scout', terms: clone(body), roles: [...COMMERCIAL_CAMPAIGNS.roles].map((role, i) => ({ role,
    accountId: 'account_' + i, originalCharacterId: 'character_' + i })), expiresAt: timestamp,
  executionAuthority: false, guardEvidence: COMMERCIAL_CAMPAIGNS.guardEvidence, stageFeesFundedSeparately: true, gameCashOnly: true };
const travel = { from: body.origin, to: body.handoff, original: 'character_4', transaction: 'travel_journal', cost: 10, observedAt: timestamp };
function receipt(action) {
  const result = { ok: true, campaign: clone(view) };
  if (action === 'create' || action === 'consent') result.consentedRole = action === 'create' ? 'owner' : 'scout';
  else if (['withdraw', 'cancel', 'expire'].includes(action)) result.retiredMetadataOnly = true;
  else if (action.startsWith('scout-')) result.source = { kind: 'scout', sourceId: 'scout_job',
    state: action === 'scout-fund' ? 'funded' : 'completed', feeCash: body.scoutFeeCash,
    paidFeeCash: action === 'scout-fund' ? 0 : body.scoutFeeCash, targetAt: timestamp,
    reportedAt: action === 'scout-fund' ? null : timestamp, predictsAvailable: action === 'scout-fund' ? null : true,
    observedStock: action === 'scout-fund' ? null : 4 };
  else if (action.startsWith('manufacture-')) result.source = { kind: 'manufacture', sourceId: 'commission_one', sourceHash: hash,
    state: action === 'manufacture-fund' ? 'funded' : action === 'manufacture-accept' ? 'accepted' : 'completed',
    recipeId: COMMERCIAL_CAMPAIGNS.recipeId, feeCash: 1, paidFeeCash: action === 'manufacture-complete' ? 1 : 0,
    outputItemId: action === 'manufacture-complete' ? 'original_output' : null };
  else if (action === 'guard-hire') result.source = { kind: 'guard', state: 'completed', evidence: COMMERCIAL_CAMPAIGNS.guardEvidence,
    priceCash: body.guardPriceCash, paidGuardCash: 9800, canonicalFeeCash: 100, streetTaxCash: 100,
    until: timestamp, payerJournal: 'payer_journal', guardJournal: 'guard_journal' };
  else result.source = { kind: 'courier', sourceId: 'courier_one', sourceHash: hash, itemId: 'original_output',
    state: ({ 'courier-publish': 'offered', 'courier-consent': 'ready', 'courier-dispatch': 'first_leg',
      'courier-travel': 'first_leg', 'courier-handoff': 'second_leg', 'courier-arrive': 'completed' })[action],
    firstConsent: true, secondConsent: true, reservedCash: 0, paidFirstCash: 0, paidSecondCash: 0,
    firstTravel: action === 'courier-publish' ? null : clone(travel), secondTravel: null };
  return result;
}
check('exact eighteen route descriptors and unique operation identifiers', () => {
  assert.equal(Object.keys(COMMERCIAL_CAMPAIGN_CONTRACTS).length, 18);
  assert.equal(Object.keys(COMMERCIAL_CAMPAIGN_SCHEMAS).length, 20);
  assert.deepEqual(Object.keys(COMMERCIAL_CAMPAIGN_CONTRACTS), ['GET ' + root,
    ...COMMERCIAL_CAMPAIGN_ACTIONS.map(action => 'POST ' + root + '/' + action)]);
  assert.equal(new Set(Object.values(COMMERCIAL_CAMPAIGN_CONTRACTS).map(row => row.operationId)).size, 18);
});
for (const [name, schema] of Object.entries(COMMERCIAL_CAMPAIGN_SCHEMAS)) check(name + ' strict AJV compile', () => compile(schema));
function closed(schema) {
  assert(schema && typeof schema === 'object');
  if (schema.type === 'object') {
    assert.equal(schema.additionalProperties, false);
    assert.deepEqual([...schema.required].sort(), Object.keys(schema.properties).sort());
    for (const child of Object.values(schema.properties)) closed(child);
  } else if (schema.type === 'array') closed(schema.items);
  else if (schema.anyOf || schema.oneOf) (schema.anyOf || schema.oneOf).forEach(closed);
  else assert(schema.$ref || schema.type || Object.hasOwn(schema, 'const') || schema.enum, 'No unrestricted schema');
}
check('all schema objects are closed and all descriptor data is deeply frozen', () => {
  Object.values(COMMERCIAL_CAMPAIGN_SCHEMAS).forEach(closed);
  const frozen = value => { if (value && typeof value === 'object') { assert(Object.isFrozen(value)); Object.values(value).forEach(frozen); } };
  frozen(COMMERCIAL_CAMPAIGN_SCHEMAS); frozen(COMMERCIAL_CAMPAIGN_CONTRACTS);
});
for (const action of COMMERCIAL_CAMPAIGN_ACTIONS) {
  const descriptor = COMMERCIAL_CAMPAIGN_CONTRACTS['POST ' + root + '/' + action], request = compile(descriptor.requestSchema),
    response = compile(descriptor.responseSchema), key = descriptor.requestParameters[0], terms = action === 'create' ? clone(body)
      : action === 'scout-report' ? { ...ref, predictsAvailable: true } : clone(ref), actual = receipt(action);
  check(action + ' source-derived request/response shapes and unchanged pure terms', () => {
    valid(request, terms); assert.deepEqual(commercialCampaignTerms(action, terms), terms); valid(response, actual);
    assert.equal(key.name, 'Idempotency-Key'); assert.equal(key.in, 'header'); assert.equal(key.required, true);
  });
  for (const field of Object.keys(terms)) check(action + ' missing request ' + field, () => { const v = clone(terms); delete v[field]; invalid(request, v); });
  check(action + ' rejects extra/private request and wrong consent', () => {
    invalid(request, { ...terms, ownerCash: 1 }); invalid(request, { ...terms, consent: false });
    invalid(request, { ...terms, consent: 'true' }); invalid(request, []);
  });
  check(action + ' requires every actual receipt field and excludes private DTO material', () => {
    for (const field of Object.keys(actual)) { const v = clone(actual); delete v[field]; invalid(response, v); }
    invalid(response, { ...actual, proof: {} });
    invalid(response, { ...actual, campaign: { ...actual.campaign, source_json: {} } });
    const v = clone(actual); v.campaign.roles[0].cash = 1; invalid(response, v);
    if (actual.source) invalid(response, { ...actual, source: { ...actual.source, proof_json: {} } });
    invalid(response, { ...actual, campaign: { ...actual.campaign, executionAuthority: true } });
  });
}
const create = compile(COMMERCIAL_CAMPAIGN_CONTRACTS['POST ' + root + '/create'].requestSchema);
for (const [field, min, max] of [['teamRevision', 1, 2147483647], ['scoutFeeCash', INTEL_FORECAST.minFeeCash, INTEL_FORECAST.maxFeeCash],
  ['minimumStock', INTEL_FORECAST.minStock, INTEL_FORECAST.maxStock], ['manufacturingFeeCash', 1, COMMERCIAL_CAMPAIGNS.maximumManufacturingFee],
  ['guardPriceCash', M3.BODYGUARD_MIN_PRICE, COMMERCIAL_CAMPAIGNS.maximumGuardPrice],
  ['firstFeeCash', 1, COMMERCIAL_CAMPAIGNS.maximumCarrierFee], ['secondFeeCash', 1, COMMERCIAL_CAMPAIGNS.maximumCarrierFee],
  ['lifetimeSeconds', COMMERCIAL_CAMPAIGNS.minimumSeconds, COMMERCIAL_CAMPAIGNS.maximumSeconds]]) check(field + ' exact constants/bounds', () => {
  valid(create, { ...body, [field]: min }); valid(create, { ...body, [field]: max });
  for (const value of [min - 1, max + 1, min + 0.5, String(min), null]) invalid(create, { ...body, [field]: value });
});
check('exact identity, hash, district and printable idempotency-key domains', () => {
  valid(create, { ...body, businessId: 'x'.repeat(128) });
  for (const value of ['', 'x'.repeat(129), 'bad:id', 'space id', 'é']) invalid(create, { ...body, businessId: value });
  for (const value of ['A'.repeat(64), 'a'.repeat(63), 'a'.repeat(65), 12]) invalid(create, { ...body, relationshipHash: value });
  invalid(create, { ...body, origin: 'unknown_district' });
  const key = compile(COMMERCIAL_CAMPAIGN_CONTRACTS['POST ' + root + '/create'].requestParameters[0].schema);
  valid(key, '!'); valid(key, '~'.repeat(128));
  for (const value of ['', ' ', 'é', '\n', 'x'.repeat(129), 1]) invalid(key, value);
});
const board = { campaigns: [{ ...clone(view), supportedStage: 'scout', blockedReason: null, retireActions: ['cancel'],
  recovery: 'Retiring campaign metadata does not refund, cancel or alter independent canonical source obligations.',
  stages: COMMERCIAL_CAMPAIGNS.stages.map(kind => ({ kind, state: 'pending', sourceId: null, outputItemId: null })) }], next: null,
  executionAuthority: false, guardEvidence: COMMERCIAL_CAMPAIGNS.guardEvidence, gameCashOnly: true };
const boardCheck = compile(COMMERCIAL_CAMPAIGN_CONTRACTS['GET ' + root].responseSchema);
check('actual board/recovery fields, pagination and privacy', () => {
  valid(boardCheck, board); valid(boardCheck, { ...board, campaigns: [], next: null });
  invalid(boardCheck, { ...board, campaigns: Array.from({ length: 21 }, () => clone(board.campaigns[0])) });
  const v = clone(board); v.campaigns[0].stages[0].proof_json = {}; invalid(boardCheck, v);
  const duplicateRole = clone(board); duplicateRole.campaigns[0].roles[1].role = 'owner'; invalid(boardCheck, duplicateRole);
  const duplicateStage = clone(board); duplicateStage.campaigns[0].stages[1] = clone(duplicateStage.campaigns[0].stages[0]); invalid(boardCheck, duplicateStage);
  const q = compile(COMMERCIAL_CAMPAIGN_CONTRACTS['GET ' + root].requestParameters[0].schema);
  valid(q, ''); valid(q, 'campaign_one'); invalid(q, 'bad after'); invalid(q, 'x'.repeat(129));
});
check('cross-field distinctness and actual Date parsing remain the unchanged canonical pure checks', () => {
  for (const value of [{ ...body, firstCarrierAccountId: body.guardAccountId }, { ...body, handoff: body.origin },
    { ...body, scoutTargetAt: '2026-02-31T00:00:00.000Z' }]) {
    valid(create, value); assert.throws(() => commercialCampaignTerms('create', value), /Invalid commercial campaign terms/);
  }
});
console.log(JSON.stringify({ phase: 'COMMERCIAL_CAMPAIGN_DESCRIPTOR_SOURCE_ONLY', checks: rows.length,
  paths: 18, schemas: 20, actions: 17, postgres: false, gameplay: false, names: rows }));


// N20-DESC-R1: original retire() marks unfinished stages retired, and recoveryView emits them unchanged.
// These are source-derived public shapes only, not HTTP/gameplay or history-oracle qualification.
const n20RetiredOriginalChecks = rows.length;
assert.equal(n20RetiredOriginalChecks, 153, 'All original descriptor checks execute unchanged first');
const n20RetiredContexts = [
  ['cancel', 'cancelled'], ['withdraw', 'suspended'], ['expire', 'expired'], ['estate', 'suspended'],
];
function n20RetiredBoard(state, completedPrefix, blockedReason = 'terminal_metadata') {
  const value = clone(board), campaign = value.campaigns[0];
  campaign.state = state;
  campaign.stage = COMMERCIAL_CAMPAIGNS.stages[completedPrefix];
  campaign.supportedStage = null;
  campaign.blockedReason = blockedReason;
  campaign.retireActions = [];
  campaign.stages = COMMERCIAL_CAMPAIGNS.stages.map((kind, index) => ({ kind,
    state: index < completedPrefix ? 'completed' : 'retired',
    sourceId: index < completedPrefix && kind === 'scout' ? 'original_forecast_job'
      : index < completedPrefix && kind === 'manufacture' ? 'original_commission' : null,
    outputItemId: index < completedPrefix && kind === 'manufacture' ? 'original_output' : null,
  }));
  return value;
}
function n20RetiredPublic(value) {
  valid(boardCheck, value);
  for (const index of [0, 1, 2, 3]) {
    const privateProof = clone(value); privateProof.campaigns[0].stages[index].proof_json = {}; invalid(boardCheck, privateProof);
  }
  const privateSource = clone(value); privateSource.campaigns[0].source_json = {}; invalid(boardCheck, privateSource);
  const privateCash = clone(value); privateCash.campaigns[0].roles[0].cash = 1; invalid(boardCheck, privateCash);
  const privateTop = clone(value); privateTop.character = { cash: 1 }; invalid(boardCheck, privateTop);
}
for (const [reason, state] of n20RetiredContexts) for (const completedPrefix of [0, 1, 2, 3]) {
  check(reason + ' actual retired recovery board with completed prefix ' + completedPrefix, () =>
    n20RetiredPublic(n20RetiredBoard(state, completedPrefix)));
}
check('retired funded scout keeps original public source identifier', () => {
  const value = n20RetiredBoard('cancelled', 0); value.campaigns[0].stages[0].sourceId = 'original_forecast_job'; n20RetiredPublic(value);
});
check('retired funded manufacture keeps original source and no unsupported output', () => {
  const value = n20RetiredBoard('cancelled', 1); value.campaigns[0].stages[1].sourceId = 'original_commission'; n20RetiredPublic(value);
});
check('retired published courier preserves original network and output identifiers', () => {
  const value = n20RetiredBoard('cancelled', 3); value.campaigns[0].stages[3].sourceId = 'original_network';
  value.campaigns[0].stages[3].outputItemId = 'original_output'; n20RetiredPublic(value);
});
check('estate recovery board for replaced original retains genuine blocked reason', () =>
  n20RetiredPublic(n20RetiredBoard('suspended', 2, 'original_replaced')));
check('retired state does not admit unknown stage states or private receipt fields', () => {
  for (const kind of COMMERCIAL_CAMPAIGNS.stages) {
    const value = n20RetiredBoard('cancelled', 0); value.campaigns[0].stages.find(stage => stage.kind === kind).state = 'unknown'; invalid(boardCheck, value);
  }
  const value = n20RetiredBoard('cancelled', 0); value.campaigns[0].stages[0].source_json = {}; invalid(boardCheck, value);
});
assert.equal(rows.length - n20RetiredOriginalChecks, 21);
console.log(JSON.stringify({ phase: 'COMMERCIAL_CAMPAIGN_DESCRIPTOR_RETIRED_SUCCESSOR_SOURCE_ONLY', checks: rows.length,
  originalChecks: n20RetiredOriginalChecks, newRegressionChecks: rows.length - n20RetiredOriginalChecks,
  sourceDerivedValidBoards: 20, privateFieldRefusals: 140, unknownStageStateRefusals: 4,
  paths: 18, schemas: 20, actions: 17, postgres: false, gameplay: false, names: rows.slice(n20RetiredOriginalChecks) }));
