import { GameError } from '../game.js';
import { pickingPackingAction,pickingPackingBoard } from '../pickingpacking.js';
export function register(app,{pool,auth}){
  if(typeof pool?.connect!=='function'||typeof auth!=='function')throw Error('Picking service requires canonical authenticated game transactions.');
  const noQuery=async req=>{if(Object.keys(req.query||{}).length)throw new GameError('picking_packing','terms');};
  const base='/v1/company/picking-packing';
  app.get(base,{preHandler:[auth,noQuery]},req=>pickingPackingBoard(pool,req.user.sub));
  for(const action of ['create','accept','fulfill','cancel'])app.post(base+'/'+action,{preHandler:[auth,noQuery]},req=>pickingPackingAction(pool,req.user.sub,action,req.body,req.headers['idempotency-key'],{agent:req.user.agent===true}));
}
