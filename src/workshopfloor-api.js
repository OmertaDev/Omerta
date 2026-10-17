import {configureWorkshopFloor,workshopFloorBoard} from './workshopfloor.js';
import {withItemTransaction,withItemRead} from './items.js';
import {GameError} from './game.js';
export function registerWorkshopFloor(app,{pool,auth}){
  if(typeof pool?.connect!=='function'||typeof auth!=='function')throw Error('Workshop floor requires canonical transactions and authentication.');
  const noQuery=async req=>{if(Object.keys(req.query||{}).length)throw new GameError('workshop_floor','terms');};
  app.get('/v1/company/workshop-floor',{preHandler:[auth,noQuery]},req=>withItemRead(pool,c=>workshopFloorBoard(c,req.user.sub)));
  app.post('/v1/company/workshop-floor/configure',{preHandler:[auth,noQuery]},req=>withItemTransaction(pool,c=>configureWorkshopFloor(c,req.user.sub,req.body,req.headers['idempotency-key'])));
}
