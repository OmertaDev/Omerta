import { decisionReplay,decisionReplayBoard } from '../decisionreplay.js';
import { GameError } from '../game.js';
export function register(app,{pool,auth}){
 if(typeof auth!=='function'||typeof pool?.connect!=='function')throw Error('Decision replay requires authenticated canonical read snapshots.');
 const noQuery=async req=>{if(Object.keys(req.query||{}).length)throw new GameError('decision_replay','terms');};
 app.get('/v1/agent/decision-replay',{preHandler:auth},req=>decisionReplayBoard(pool,req.user.sub,req.query));
 app.get('/v1/agent/decision-replay/:kind/:id',{preHandler:[auth,noQuery]},req=>decisionReplay(pool,req.user.sub,req.params.kind,req.params.id));
}
