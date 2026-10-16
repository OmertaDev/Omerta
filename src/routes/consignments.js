import * as C from '../consignments.js';
import { GameError } from '../game.js';
import { withItemRead, withItemTransaction } from '../items.js';
export function register(app,{pool,auth}){
  if(typeof pool?.connect!=='function'||typeof auth!=='function')throw Error('Consignments require canonical transactions and authentication.');
  app.get('/v1/consignments',{preHandler:auth},req=>{if(Object.keys(req.query||{}).some(k=>k!=='after'))throw new GameError('consignment','terms');return withItemRead(pool,c=>C.consignmentBoard(c,req.user.sub,req.query?.after??''));});
  for(const [action,fn] of [['create',C.createConsignment],['accept',C.acceptConsignment],['buy',C.buyConsignment],['cancel',C.cancelConsignment],['expire',C.expireConsignment]])app.post('/v1/consignments/'+action,{preHandler:auth},req=>withItemTransaction(pool,c=>fn(c,req.user.sub,req.body,req.headers['idempotency-key'])));
}
