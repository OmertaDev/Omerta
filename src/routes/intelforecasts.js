import * as G from '../game.js';
import * as Intel from '../intelforecastjobs.js';

export function register(app, { pool, auth }) {
  app.get('/v1/intel-forecasts', { preHandler: auth }, async req =>
    G.withCharacterReadLocked(pool, req.user.sub, async (ch, client) => ({
      jobs: await Intel.intelForecastJobBoard(client, ch.account_id),
      gameCashOnly: true, accuracyDeterminesPayment: false,
      outcomeDefinition: 'first_server_snapshot_in_window',
    })));
  app.post('/v1/intel-forecasts/reporters/:id/jobs', { preHandler: auth }, async req =>
    G.withTwoCharacters(pool, req.user.sub, req.params.id, (buyer, reporter, client, h) =>
      Intel.createIntelForecastJob(buyer, reporter, req.body, req.headers['idempotency-key'], client, h)));
  app.post('/v1/intel-forecasts/:id/report', { preHandler: auth }, async req => {
    const job = (await pool.query('SELECT buyer_character,status FROM intel_forecast_jobs WHERE id=$1', [req.params.id])).rows[0];
    if (!job) throw new G.GameError('intel_forecast', 'No assigned forecast job.');
    // A stored paid report remains recoverable after its buyer dies. The locked
    // domain replay checks the original reporter account and exact report body.
    if (job.status === 'reported') return G.withCharacter(pool, req.user.sub, async (ch, client) => {
      const result = await Intel.replayIntelForecastReport(ch, req.params.id, req.body, client);
      if (!result) throw new G.GameError('intel_forecast', 'No stored report to recover.');
      return result;
    });
    return G.withTwoCharacters(pool, req.user.sub, job.buyer_character, (reporter, buyer, client, h) =>
      Intel.submitIntelForecastJob(reporter, buyer, req.params.id, req.body, client, h));
  });
  app.post('/v1/intel-forecasts/:id/cancel', { preHandler: auth }, async req =>
    G.withCharacter(pool, req.user.sub, (buyer, client, h) =>
      Intel.cancelIntelForecastJob(buyer, req.params.id, client, h)));
  app.post('/v1/intel-forecasts/:id/resolve', { preHandler: auth }, async req =>
    G.withCharacter(pool, req.user.sub, (ch, client) =>
      Intel.resolveIntelForecastOutcome(ch, req.params.id, client)));
}
