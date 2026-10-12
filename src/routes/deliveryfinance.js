import * as G from '../game.js';
import * as Finance from '../deliveryfinance.js';
import * as Delivery from '../delivery.js';
import * as Loans from '../loans.js';

const refuse = () => { throw new G.GameError('delivery_finance', 'Refresh the funded delivery and its current creditor.'); };
const emptyBody = body => {
  if (body != null && (typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length))
    throw new G.GameError('body', 'This action accepts no fields.');
};

// This hint only chooses the canonical pair lock. The domain rechecks the loan,
// request, creditor and commitment inside that transaction before changing cash.
export async function deliverOwnedAdvance(pool, accountId, commitmentId, qty) {
  const row = (await pool.query("SELECT loan_id FROM delivery_loan_requests WHERE commitment_id=$1 AND state='active'", [commitmentId])).rows[0];
  const loan = row?.loan_id && (await pool.query('SELECT lender_character,status FROM loans WHERE id=$1', [row.loan_id])).rows[0];
  if (!loan || loan.status !== 'active') return G.withCharacter(pool, accountId,
    (ch, client, h) => Delivery.deliverCommitment(ch, commitmentId, qty, client, h));
  if (!loan.lender_character) refuse();
  return G.withTwoCharacters(pool, accountId, loan.lender_character,
    (supplier, lender, client, h) => Finance.deliverFinancedCommitment(supplier, lender, commitmentId, qty, client, h), { meet: false });
}

export async function takeOwnedAdvance(pool, accountId, loanId, carId) {
  const row = (await pool.query('SELECT id FROM delivery_loan_requests WHERE loan_id=$1', [loanId])).rows[0];
  if (!row) return G.withCharacter(pool, accountId,
    (ch, client, h) => Loans.takeLoan(ch, loanId, carId, client, h));
  if (carId != null) throw new G.GameError('body', 'This funded delivery advance has no collateral pledge.');
  const loan = (await pool.query('SELECT lender_character FROM loans WHERE id=$1', [loanId])).rows[0];
  if (!loan?.lender_character) refuse();
  return G.withTwoCharacters(pool, accountId, loan.lender_character,
    (supplier, lender, client, h) => Finance.takeDeliveryAdvance(supplier, lender, row.id, client, h), { meet: false });
}

export function register(app, { pool, auth }) {
  app.get('/v1/delivery-finance', { preHandler: auth }, async req =>
    G.withCharacterReadLocked(pool, req.user.sub, async (ch, client) => ({
      requests: await Finance.deliveryFinanceBoard(client, ch.account_id), gameCashOnly: true,
    })));
  app.post('/v1/delivery-finance/requests', { preHandler: auth }, async req => {
    if (typeof req.body?.lenderId !== 'string' || !req.body.lenderId || req.body.lenderId.length > 200) refuse();
    return G.withTwoCharacters(pool, req.user.sub, req.body.lenderId,
      (supplier, lender, client, h) => Finance.requestDeliveryAdvance(supplier, lender, req.body,
        req.headers['idempotency-key'], client, h), { meet: false });
  });
  app.post('/v1/delivery-finance/:id/offer', { preHandler: auth }, async req => {
    emptyBody(req.body);
    const row = (await pool.query('SELECT supplier_character FROM delivery_loan_requests WHERE id=$1', [req.params.id])).rows[0];
    if (!row) refuse();
    return G.withTwoCharacters(pool, req.user.sub, row.supplier_character,
      (lender, supplier, client, h) => Finance.offerDeliveryAdvance(lender, supplier, req.params.id, client, h), { meet: false });
  });
  app.post('/v1/delivery-finance/:id/take', { preHandler: auth }, async req => {
    emptyBody(req.body);
    const row = (await pool.query('SELECT requested_lender_character,loan_id FROM delivery_loan_requests WHERE id=$1', [req.params.id])).rows[0];
    if (!row) refuse();
    const loan = row.loan_id && (await pool.query('SELECT lender_character FROM loans WHERE id=$1', [row.loan_id])).rows[0];
    const creditor = loan?.lender_character || row.requested_lender_character;
    if (!creditor) refuse();
    return G.withTwoCharacters(pool, req.user.sub, creditor,
      (supplier, lender, client, h) => Finance.takeDeliveryAdvance(supplier, lender, req.params.id, client, h), { meet: false });
  });
  app.post('/v1/delivery-finance/:id/cancel', { preHandler: auth }, async req => {
    emptyBody(req.body);
    return G.withCharacter(pool, req.user.sub,
      (supplier, client) => Finance.cancelRequestedDeliveryAdvance(supplier, req.params.id, client));
  });
}
