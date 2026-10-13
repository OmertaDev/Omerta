import { GameError } from '../game.js';
import { activateHome, homeInteriorBoard, homeInvitations, homeRecoveryBoard, updateHomeLayout, inviteHomeVisitor,
  acceptHomeVisitor, revokeHomeVisitor, leaveHomeVisitor, storeHomeItem, retrieveHomeItem, recoverArchivedHomeItem, craftAtHome,
  openHomeActivity,joinHomeActivity,answerHomeActivity,closeHomeActivity,leaveHomeActivity,homeActivityHistory } from '../city-home-interiors.js';

export function registerCityHomeInteriors(app, { pool, auth, craftingContext }) {
  const privateResponse = async (_req, reply) => { reply.header('Cache-Control', 'private, no-store'); reply.header('Vary', 'Authorization'); };
  const requireKey = async req => {
    if (typeof req.headers['idempotency-key'] !== 'string' || !/^[!-~]{1,128}$/.test(req.headers['idempotency-key']) || !req._idem?.reservationToken) {
      throw new GameError('idempotency_required', 'Supply the reserved Idempotency-Key for this home action.');
    }
  };
  const safeError = (error, _req, reply) => {
    const status = error?.statusCode === 401 ? 401 : ['contention','home_identity_changed','home_authority_changed','home_layout_changed','item_idempotency_conflict'].includes(error?.code) ? 409
      : ['item_commit_unknown','item_recovery_required','item_integrity_error'].includes(error?.code) ? 503 : error instanceof GameError ? 400 : 503;
    reply.header('Cache-Control', 'private, no-store'); reply.header('Vary', 'Authorization');
    return reply.code(status).send({ error: status === 401 ? 'unauthorized' : error instanceof GameError ? error.code : 'home_unavailable',
      message: error?.code === 'item_commit_unknown' ? 'The result is uncertain. Retry this same request key.'
        : error instanceof GameError ? error.message : 'The home could not refresh. Try again.' });
  };
  const options = { onRequest: privateResponse, errorHandler: safeError };
  app.get('/v1/city/home/interior', { ...options, preHandler: auth }, req => homeInteriorBoard(pool, req.user.sub, req.query || {}, craftingContext));
  for (const [name, read] of [['invitations',homeInvitations],['recovery',homeRecoveryBoard],['activity-history',homeActivityHistory]]) app.get('/v1/city/home/' + name,
    { ...options, preHandler: auth }, req => {
      if (Object.keys(req.query || {}).length) throw new GameError('bad_home_request', 'This view belongs to your current character.');
      return read(pool, req.user.sub);
    });
  const writes = [['activate',activateHome],['layout',updateHomeLayout],['visitors/invite',inviteHomeVisitor],
    ['visitors/accept',acceptHomeVisitor],['visitors/revoke',revokeHomeVisitor],['visitors/leave',leaveHomeVisitor],['storage/store',storeHomeItem],
    ['storage/retrieve',retrieveHomeItem],['storage/recover',recoverArchivedHomeItem],['workbench/craft',craftAtHome],
    ['activity/open',openHomeActivity],['activity/join',joinHomeActivity],['activity/answer',answerHomeActivity],
    ['activity/close',closeHomeActivity],['activity/leave',leaveHomeActivity]];
  for (const [name, write] of writes) app.post('/v1/city/home/' + name, { ...options, preHandler: [auth,requireKey] }, req =>
    write(pool, req.user.sub, req.body, { ...req._idem, accountId: req.user.sub }, craftingContext));
}
