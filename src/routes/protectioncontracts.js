import { GameError } from '../game.js';
import { withItemRead } from '../items.js';
import { PROTECTION_CONTRACT_ACTIONS } from '../protectioncontracts-contracts.js';
import { protectionContractAction, protectionContractBoard } from '../protectioncontracts.js';

export function register(app, { pool, auth }) {
  if (typeof pool?.connect !== 'function' || typeof auth !== 'function') throw Error('Protection contracts require canonical authenticated transactions.');
  const base = '/v1/company/protection-contracts';
  app.get(base, { preHandler: auth }, req => {
    if (Object.keys(req.query || {}).some(key => key !== 'after')) throw new GameError('protection_contract', 'terms');
    return withItemRead(pool, c => protectionContractBoard(c, req.user.sub, req.query?.after ?? ''));
  });
  for (const action of PROTECTION_CONTRACT_ACTIONS) app.post(base + '/' + action, { preHandler: auth }, req => {
    if (Object.keys(req.query || {}).length) throw new GameError('protection_contract', 'terms');
    return protectionContractAction(pool, req.user.sub, action, req.body, req.headers['idempotency-key']);
  });
}
