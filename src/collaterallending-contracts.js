const object = (properties, required = Object.keys(properties)) => ({ type: 'object', additionalProperties: false, properties, required });
const id = { type: 'string', minLength: 1, maxLength: 128, pattern: '^[!-~]+$' };
const digest = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const integer = (minimum = 0) => ({ type: 'integer', minimum });
const yes = { const: true }, no = { const: false }, timestamp = { type: 'string', format: 'date-time' };
const pledge = object({ pledgeId: id, sourceHash: digest, loanId: id, itemId: id, state: { enum: ['held', 'released', 'estate_released'] },
  principal: integer(5000), owed: integer(5000), dueAt: timestamp, collateralTitle: { const: 'original_borrower_account' }, liquidationAvailable: no });
const reference = object({ pledgeId: id, sourceHash: digest, consent: yes });
const take = object({ ok: yes, principal: integer(5000), owed: integer(5000), collateral: no, pledgedOmr: { const: 0 }, dueSeconds: integer() });
const repay = object({ ok: yes, paid: integer(5000), toLender: integer(), vig: integer(), pledgeReturned: { const: 0 } });
const result = object({ ok: yes, pledge, loan: { oneOf: [take, repay] } }, ['ok', 'pledge']);
const quote = object({ ok: yes, loanId: id, itemId: id, sourceHash: digest, principal: integer(5000), owed: integer(5000),
  hours: { type: 'integer', minimum: 1, maximum: 72 }, offerExpiresAt: timestamp,
  collateralTitle: { const: 'original_borrower_account' }, liquidationAvailable: no });
const availability = object({ available: { type: 'boolean' }, nativeOnly: yes, requiresCanonicalEstateBooksAndFinalization: yes,
  currency: { const: 'game_cash' }, cryptoAvailable: no });
const board = object({ pledges: { type: 'array', maxItems: 25, items: pledge }, limits: object({
  templateId: { const: 'item:precision_lock_tool' }, maximumPledges: { const: 1 }, custody: { const: 'original_borrower_account' },
  liquidation: no, cashCurrency: { const: 'game_cash' }, nativeOnly: yes }) });
export const COLLATERAL_LENDING_SCHEMAS = Object.freeze({ CollateralLendingPledge: pledge, CollateralLendingResult: result,
  CollateralLendingQuote: quote, CollateralLendingAvailability: availability, CollateralLendingBoard: board });
const base = '/v1/loans/equipment';
export const COLLATERAL_LENDING_CONTRACTS = Object.freeze({
  ['GET ' + base + '/availability']: { responseSchema: availability },
  ['GET ' + base]: { responseSchema: board },
  ['POST ' + base + '/quote']: { requestSchema: object({ loanId: id, itemId: id }), responseSchema: quote },
  ['POST ' + base + '/pledge']: { requestSchema: object({ loanId: id, itemId: id, sourceHash: digest, consent: yes }), responseSchema: result },
  ['POST ' + base + '/repay']: { requestSchema: reference, responseSchema: result },
  ['POST ' + base + '/release']: { requestSchema: reference, responseSchema: result }
});
