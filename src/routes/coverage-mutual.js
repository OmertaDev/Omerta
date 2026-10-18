import { withItemTransaction } from '../items.js';
import * as Mutual from '../coverage-mutual.js';

export function register(app, { pool, auth }) {
  const noQuery = async req => { if (Object.keys(req.query || {}).length) throw Object.assign(Error('query'), { code: 'coverage_mutual', reason: 'query' }); };
  const errorHandler = (error, _req, reply) => error.code === 'coverage_mutual'
    ? reply.code(409).send({ error: 'coverage_mutual', message: error.reason }) : reply.send(error);
  const options = { preHandler: [auth, noQuery], errorHandler }, base = '/v1/company/coverage-mutuals';
  app.get(base, options, req => Mutual.coverageMutualBoard(pool, req.user.sub));
  for (const [path, action] of [['', Mutual.openCoverageMutual], ['/join', Mutual.joinCoverageMutual],
    ['/claim', Mutual.claimCoverageMutual], ['/close', Mutual.closeCoverageMutual]])
    app.post(base + path, options, req => withItemTransaction(pool, c => action(c, req.user.sub, req.body, req.headers['idempotency-key'])));
}
