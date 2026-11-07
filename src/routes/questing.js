import * as G from '../game.js';
import { questingBoard, submitReadingRoom } from '../questing.js';

export function register(app, { pool, auth }) {
  app.get('/v1/questing', { preHandler: auth }, req => G.readCharacter(pool, req.user.sub,
    (ch, client) => questingBoard(ch, client)));
  app.post('/v1/questing/practice', { preHandler: auth, bodyLimit: 2048 }, req => G.withCharacter(pool, req.user.sub,
    (ch, client) => submitReadingRoom(ch, req.body, client)));
}
