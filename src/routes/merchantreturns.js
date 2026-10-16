import { merchantReturnAction,merchantReturnBoard } from '../merchantreturns.js';
import { withItemTransaction,withItemRead } from '../items.js';
import { GameError } from '../game.js';
export function register(app,{pool,auth,assertLifecycle}){
 if(typeof auth!=='function'||typeof pool?.connect!=='function')throw Error('Merchant returns require canonical authenticated Items transactions.');
 const noQuery=async req=>{if(Object.keys(req.query||{}).length)throw new GameError('merchant_return','terms');};
 const base='/v1/items/merchant-returns';
 app.get(base,{preHandler:[auth,noQuery]},req=>withItemRead(pool,c=>merchantReturnBoard(c,req.user.sub)));
 for(const action of ['offer','accept','return','cancel','expire'])app.post(base+'/'+action,{preHandler:[auth,noQuery]},req=>withItemTransaction(pool,c=>merchantReturnAction(c,req.user.sub,action,req.body,req.headers['idempotency-key'],{assertLifecycle})));
}
