// Private deed-backed interiors. Furniture coordinates describe decoration cells, never actor positions.
import { GameError } from './game.js';
import { validateCityRoom, validateCityViewer } from './city-social.js';
import { CITY_FURNITURE } from './city-social-contract.js';
export { CITY_FURNITURE };

export const HOME_STORAGE_CAPACITY = 8;
export const HOME_VISITOR_CAPACITY = 8;
export const HOME_INVITATION_MS = 60 * 60 * 1000;
export const HOME_ROOM_SIZE = Object.freeze({ width: 6, height: 6 });
export const HOME_PUZZLES = Object.freeze([
  Object.freeze({ id: 'evening-notebook', title: 'The evening notebook',
    sequence: Object.freeze(['chair','table','lamp']), clues: Object.freeze(['Begin at the chair nearest the top-left.', 'Check the table nearest the top-left.', 'Finish at the lamp nearest the top-left.']) }),
  Object.freeze({ id: 'lights-out', title: 'Lights out',
    sequence: Object.freeze(['lamp','window','table']), clues: Object.freeze(['Start with the lamp nearest the top-left.', 'Check the window nearest the top-left.', 'Return to the table nearest the top-left.']) }),
  Object.freeze({ id: 'visitor-welcome', title: 'A visitor arrives',
    sequence: Object.freeze(['window','chair','table']), clues: Object.freeze(['Look through the window nearest the top-left.', 'Find the chair nearest the top-left.', 'Finish at the table nearest the top-left.']) }),
  Object.freeze({ id: 'two-voices-v1', title: 'Two voices, one room', cooperative: true,
    sequence: Object.freeze(['chair','table','lamp']), clues: Object.freeze([
      'Tell your host: the first mark lies where a visitor sits, nearest the top-left.',
      'Tell your guest: the second mark lies where a meal is shared, nearest the top-left.',
      'Tell your host: the final mark lies where the room finds its light, nearest the top-left.',
    ]) }),
]);
export const HOME_ACTIVITY_CAPACITY = 4;
const fail = () => { throw new GameError('bad_home_request', 'Use the current home action.'); };
export const homeKey = value => typeof value === 'string' && value.length >= 1 && value.length <= 128 && !/[\x00-\x1f\x7f]/.test(value);
const identifier = value => typeof value === 'string' && /^[!-~]{1,200}$/.test(value);
const extra = Object.freeze({ activate: [], layout: ['room','expectedLayoutRevision'], invite: ['targetCharacterId', 'rights'],
  accept: ['grantId'], revoke: ['grantId'], leave: ['grantId'], store: ['itemId'], retrieve: ['itemId'], craft: ['recipeId'], recover: ['itemId'],
  activity_open: ['puzzleId'], activity_join: ['activityId','consent'], activity_answer: ['activityId','cellKey'],
  activity_close: ['activityId'], activity_leave: ['activityId'] });

export function validateHomeQuery(query) {
  if (!query || typeof query !== 'object' || Array.isArray(query)
    || Object.keys(query).some(key => key !== 'homeKey') || !homeKey(query.homeKey)) fail();
  return query.homeKey;
}
export function validateHomeBody(kind, body) {
  if (!Object.hasOwn(extra, kind) || !body || typeof body !== 'object' || Array.isArray(body)) fail();
  const independent = ['recover','leave','activity_leave'].includes(kind);
  const keys = ['characterId', 'generation', 'district', ...extra[kind], ...(independent ? [] : ['homeKey', 'authorityToken'])];
  if (Object.keys(body).some(key => !keys.includes(key))) fail();
  validateCityViewer(body);
  if (!independent && (!homeKey(body.homeKey) || (kind === 'activate'
    ? body.authorityToken !== null && !identifier(body.authorityToken) : !identifier(body.authorityToken)))) fail();
  for (const key of extra[kind]) if (!['room','rights','consent','expectedLayoutRevision'].includes(key) && !identifier(body[key])) fail();
  if (kind === 'layout') {
    validateCityRoom(body.room);
    if (!Number.isSafeInteger(body.expectedLayoutRevision) || body.expectedLayoutRevision < 1) fail();
  }
  if (kind === 'invite' && (!Array.isArray(body.rights) || body.rights.length < 1 || body.rights.length > 2
    || !body.rights.includes('visit') || new Set(body.rights).size !== body.rights.length
    || body.rights.some(right => !['visit', 'workbench'].includes(right)))) fail();
  if (kind === 'activity_open' && !HOME_PUZZLES.some(puzzle => puzzle.id === body.puzzleId)) fail();
  if (kind === 'activity_join' && body.consent !== true) fail();
  if (kind === 'activity_answer' && !/^(?:chair|table|lamp|window):[0-5]:[0-5]$/.test(body.cellKey)) fail();
  return body;
}

const viewer = { characterId: { type: 'string', minLength: 1, maxLength: 200 },
  generation: { type: 'integer', minimum: 1 }, district: { type: 'string', minLength: 1, maxLength: 200 } };
const id = { type: 'string', minLength: 1, maxLength: 200 };
const home = { homeKey: { type: 'string', minLength: 1, maxLength: 128 }, authorityToken: id };
const fields = { room: { type: 'object', additionalProperties: false, required: ['furniture'], properties: {
  furniture: { type: 'array', maxItems: 12, items: { type: 'object', additionalProperties: false,
    required: ['id', 'x', 'y'], properties: { id: { type: 'string', enum: CITY_FURNITURE.map(entry => entry.id) }, x: { type: 'integer', minimum: 0, maximum: 5 },
      y: { type: 'integer', minimum: 0, maximum: 5 }, rotation: { type: 'integer', minimum: 0, maximum: 3 } } } } } },
  expectedLayoutRevision: { type: 'integer', minimum: 1 },
  targetCharacterId: id, puzzleId: { type: 'string', enum: HOME_PUZZLES.map(puzzle => puzzle.id) }, activityId: id,
  consent: { type: 'boolean', const: true }, cellKey: { type: 'string', pattern: '^(chair|table|lamp|window):[0-5]:[0-5]$' },
  rights: { type: 'array', minItems: 1, maxItems: 2, uniqueItems: true,
    items: { type: 'string', enum: ['visit', 'workbench'] }, contains: { const: 'visit' } }, grantId: id, itemId: id, recipeId: id };
export const CITY_HOME_BODIES = Object.freeze(Object.fromEntries(Object.entries(extra).map(([kind, names]) => {
  const properties = { ...viewer, ...(['recover','leave','activity_leave'].includes(kind) ? {} : home), ...Object.fromEntries(names.map(name => [name, fields[name]])) };
  if (kind === 'activate') properties.authorityToken = { anyOf: [id, { type: 'null' }] };
  return [kind, { type: 'object', additionalProperties: false, required: Object.keys(properties), properties }];
})));

const reference = name => ({ $ref: '#/components/schemas/' + name });
const text = { type: 'string', maxLength: 512 };
const object = (properties, required = Object.keys(properties)) => ({ type: 'object', additionalProperties: false, required, properties });
const array = (items, maxItems) => ({ type: 'array', maxItems, items });
const rights = fields.rights;
const nullableToken = { anyOf: [id, { type: 'null' }] };
const blockers = array(object({ code: { type: 'string', minLength: 1, maxLength: 200 } }), 32);
const actionBody = object({ ...viewer, ...home, authorityToken: nullableToken, ...fields }, Object.keys(viewer));
const homeAction = object({ id: { type: 'string', minLength: 1, maxLength: 300 }, label: text, method: { const: 'POST' },
  path: { type: 'string', enum: ['activate','layout','visitors/invite','visitors/accept','visitors/revoke','visitors/leave',
    'storage/store','storage/retrieve','storage/recover','workbench/craft','activity/open','activity/join','activity/answer','activity/close','activity/leave'].map(value => '/v1/city/home/' + value) },
  body: actionBody, available: { type: 'boolean' }, blockedBy: blockers,
  inputFields: { type: 'array', minItems: 1, maxItems: 2, uniqueItems: true, items: { type: 'string', enum: ['room','targetCharacterId','rights','consent'] } },
}, ['id','label','method','path','body','available','blockedBy']);
const shelfItem = object({ id, templateId: id, state: { type: 'string', enum: ['active','stored'] }, title: text, action: reference('CityHomeAction') });
const permission = object({ id, homeKey: home.homeKey, rights, status: { type: 'string', enum: ['invited','active','expired'] },
  expiresAt: { type: 'string', format: 'date-time' }, action: reference('CityHomeAction') });
const recipeEntry = object({ kind: { type: 'string', enum: ['item','material','car'] }, templateId: id, title: text,
  quantity: { type: 'integer', minimum: 1, maximum: 2147483647 }, quality: { type: 'string', minLength: 1, maxLength: 80 } }, ['kind','quantity']);
export const CITY_HOME_SCHEMAS = Object.freeze({
  CityHomeViewer: object(viewer),
  CityHomeAction: homeAction,
  CityHomeInterior: object({
    viewer: reference('CityHomeViewer'),
    home: object({ key: home.homeKey, street: text, districtId: id, authorityToken: nullableToken,
      revision: { type: 'integer', minimum: 0 }, layoutRevision: { type: 'integer', minimum: 0 }, host: object({ characterId: id, generation: viewer.generation, name: text }) }),
    access: object({ role: { type: 'string', enum: ['owner','visitor'] }, rights }),
    room: object({ active: { type: 'boolean' }, furniture: fields.room.properties.furniture,
      catalog: array(object({ id, name: text }), 4), size: object({ width: { const: 6 }, height: { const: 6 } }) }),
    storage: { anyOf: [{ type: 'null' }, object({ capacity: { const: HOME_STORAGE_CAPACITY },
      items: array(shelfItem, HOME_STORAGE_CAPACITY), availableItems: array(shelfItem, 64) })] },
    visitors: array(object({ id, name: text, characterId: id, status: { type: 'string', enum: ['invited','active','revoked','expired'] },
      rights, expiresAt: { type: 'string', format: 'date-time' }, action: reference('CityHomeAction') }), 32),
    workbench: object({ recipes: array(object({ id, title: text, available: { type: 'boolean' },
      cashCost: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'null' }] }, inputs: array(recipeEntry, 32), outputs: array(recipeEntry, 32),
      blockedBy: blockers, action: reference('CityHomeAction') }), 50) }),
    actions: array(reference('CityHomeAction'), 3),
    activity: reference('CityHomeActivityBoard'),
  }),
  CityHomeInvitations: object({ viewer: reference('CityHomeViewer'),
    invitations: array(object({ id, homeKey: home.homeKey, street: text, host: object({ characterId: id, name: text }),
      rights, expiresAt: { type: 'string', format: 'date-time' }, action: reference('CityHomeAction') }), 32),
    permissions: array(permission, 32) }),
  CityHomeRecovery: object({ viewer: reference('CityHomeViewer'), items: array(object({ id, templateId: id,
    homeKey: home.homeKey, action: reference('CityHomeAction') }), 64) }),
  CityHomeAck: object({ ok: { const: true }, kind: { type: 'string', enum: Object.keys(extra).map(value => 'home_' + value) },
    viewer: reference('CityHomeViewer'), homeKey: home.homeKey, authorityToken: id, revision: { type: 'integer', minimum: 1 },
    effect: object({ itemId: id, state: { type: 'string', enum: ['active','stored'] }, grantId: id,
      expiresAt: { type: 'string', format: 'date-time' }, recipeId: id, activityId: id, puzzleId: fields.puzzleId,
      step: { type: 'integer', minimum: 0, maximum: 3 }, complete: { type: 'boolean' }, outcome: reference('CityHomePuzzleOutcome') }, []), message: text },
  ['ok','kind','viewer','homeKey','authorityToken','effect','message']),
  CityHomePuzzleOutcome: object({ puzzleId: fields.puzzleId, solvedAt: { type: 'string', format: 'date-time' } }),
  CityHomeActivityBoard: object({ catalog: array(object({ id: fields.puzzleId, title: text,
    requires: array({ type: 'string', enum: CITY_FURNITURE.map(entry => entry.id) }, 3),
    action: { anyOf: [reference('CityHomeAction'), { type: 'null' }] } }), 4),
    active: { anyOf: [{ type: 'null' }, object({ id, puzzleId: fields.puzzleId, title: text, layoutRevision: { type: 'integer', minimum: 1 },
      capacity: { type: 'integer', enum: [2, HOME_ACTIVITY_CAPACITY] }, roster: array(object({ name: text }), HOME_ACTIVITY_CAPACITY),
      self: { anyOf: [{ type: 'null' }, object({ status: { type: 'string', enum: ['active','solved','left'] }, step: { type: 'integer', minimum: 0, maximum: 3 },
        clue: { anyOf: [text, { type: 'null' }] }, outcome: { anyOf: [reference('CityHomePuzzleOutcome'), { type: 'null' }] } })] },
      cells: array(object({ key: fields.cellKey, furnishingId: { type: 'string', enum: CITY_FURNITURE.map(entry => entry.id) }, label: text,
        action: { anyOf: [reference('CityHomeAction'), { type: 'null' }] } }), 12), actions: array(reference('CityHomeAction'), 3) })] } }),
  CityHomeActivityHistory: object({ viewer: reference('CityHomeViewer'), outcomes: array(object({ activityId: id,
    characterId: id, generation: viewer.generation, title: text, outcome: reference('CityHomePuzzleOutcome') }), 16) }),
});
