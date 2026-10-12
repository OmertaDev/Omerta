import * as Operators from '../companyoperators.js';
import * as G from '../game.js';

export function register(app, { pool, auth }) {
  const ownerOnly = async (req) => {
    if (req.user.agent === true) throw new G.GameError('owner_authority', 'Use the owner session to enroll or disable a company operator.');
  };
  app.get('/v1/company/operator', { preHandler: auth }, async (req) => ({ operators: await Operators.companyOperatorBoard(pool, req.user.sub) }));
  app.post('/v1/company/operator', { preHandler: [auth, ownerOnly] }, async (req) =>
    G.withCharacter(pool, req.user.sub, (ch, client) => Operators.setCompanyOperator(ch, req.body, client)));
  app.post('/v1/company/operator/run', { preHandler: auth }, async (req) =>
    G.withCharacter(pool, req.user.sub, (ch, client, h) => Operators.runCompanyOperator(ch, req.body, client, h)));
}
