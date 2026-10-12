import * as G from '../game.js';
import * as Employment from '../gameemployment.js';

export function register(app, { pool, auth }) {
  const base = '/v1/company/employment';
  const key = req => req.headers['idempotency-key'];
  app.get(base, { preHandler: auth }, req => G.readCharacter(pool, req.user.sub,
    async (ch, client) => ({ ok:true, employment:await Employment.ownEmploymentBoard(client, ch.account_id) })));
  app.get(`${base}/offers`, { preHandler: auth }, req => G.readCharacter(pool, req.user.sub,
    async (_ch, client) => ({ ok:true, offers:await Employment.publicEmploymentOffers(client) })));
  app.post(base, { preHandler: auth }, req => G.withCharacter(pool, req.user.sub, async (ch, client, h) => {
    return Employment.createEmployment(ch, req.body, key(req), client, h, { agent: req.user.agent === true });
  }));
  const employer = async employmentId => {
    const row = (await pool.query('SELECT employer_character FROM game_employment_jobs WHERE id=$1', [employmentId])).rows[0];
    if (!row) throw new G.GameError('game_employment', 'job'); return row.employer_character;
  };
  app.post(`${base}/:id/accept`, { preHandler: auth }, async req => {
    if (!req.body || Object.keys(req.body).sort().join(',') !== 'commitmentId,consent') throw new G.GameError('game_employment', 'terms');
    const prior = await Employment.replayEmploymentRequest(req.user.sub, 'accept', { ...req.body, employmentId: req.params.id }, key(req), pool, { agent: req.user.agent === true });
    if (prior) return prior;
    const target = await employer(req.params.id);
    return G.withTwoCharacters(pool, req.user.sub, target, (ch, owner, client, h) =>
      Employment.acceptEmployment(ch, owner, { ...req.body, employmentId: req.params.id }, key(req), client, h, { agent: req.user.agent === true }), { meet: false });
  });
  app.post(`${base}/:id/claim`, { preHandler: auth }, async req => {
    if (!req.body || Object.keys(req.body).join(',') !== 'commitmentId') throw new G.GameError('game_employment', 'terms');
    const prior = await Employment.replayEmploymentRequest(req.user.sub, 'claim', { ...req.body, employmentId: req.params.id }, key(req), pool);
    if (prior) return prior;
    const target = await employer(req.params.id);
    return G.withTwoCharacters(pool, req.user.sub, target, (ch, owner, client, h) =>
      Employment.claimEmployment(ch, owner, req.params.id, req.body.commitmentId, key(req), client, h), { meet: false });
  });
  app.post(`${base}/:id/close`, { preHandler: auth }, req => {
    if (req.body && Object.keys(req.body).length) throw new G.GameError('game_employment', 'terms');
    return G.withCharacter(pool, req.user.sub,
      (ch, client, h) => Employment.closeEmployment(ch, req.params.id, key(req), client, h));
  });
}
