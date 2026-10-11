import * as G from '../game.js';
import * as Crew from '../crew.js';
import * as Logistics from '../crewlogistics.js';

export function register(app, { pool, auth }) {
  app.get('/v1/crew/logistics', { preHandler: auth }, async req =>
    G.withCharacterReadLocked(pool, req.user.sub,
      (ch, client) => Logistics.crewLogisticsBoard(client, ch), Crew.CREW_FIRST_CHARACTER_LOCKS));
  app.post('/v1/crew/logistics-links', { preHandler: auth }, async req =>
    G.withCharacter(pool, req.user.sub,
      (ch, client) => Logistics.publishCrewLogisticsLink(ch, req.body, client), Crew.CREW_FIRST_CHARACTER_LOCKS));
  app.post('/v1/crew/logistics-links/:id/revoke', { preHandler: auth }, async req =>
    G.withCharacter(pool, req.user.sub,
      (ch, client) => Logistics.revokeCrewLogisticsLink(ch, req.params.id, client), Crew.CREW_FIRST_CHARACTER_LOCKS));
}
