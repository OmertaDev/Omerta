import * as G from '../game.js';
import * as Portfolio from '../companybankportfolios.js';

export function register(app, { pool, auth }) {
  const ownerOnly = async req => { if (req.user.agent === true) throw new G.GameError('owner_authority', 'Use the owner session to grant or disable a company game-cash portfolio policy.'); };
  app.get('/v1/company/bank', { preHandler: auth }, req =>
    G.withCharacterReadLocked(pool, req.user.sub, async (ch, client) => ({ ok: true, ...(await Portfolio.companyBankPortfolioBoard(client, ch.account_id)), limits: Portfolio.COMPANY_BANK_PORTFOLIO })));
  app.post('/v1/company/bank/policy', { preHandler: [auth, ownerOnly] }, req =>
    G.withCharacter(pool, req.user.sub, (ch, client) => Portfolio.setCompanyBankPortfolioPolicy(ch, req.body, req.headers['idempotency-key'], client, { ownerSession: true })));
  app.post('/v1/company/bank/run', { preHandler: auth }, req =>
    G.withCharacter(pool, req.user.sub, (ch, client, h) => Portfolio.runCompanyBankPortfolio(ch, req.body, req.headers['idempotency-key'], client, h)));
}
