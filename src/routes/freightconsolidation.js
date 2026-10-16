import * as G from '../game.js';
import * as F from '../freightconsolidation.js';
export function register(app,{pool,auth}){
  if(typeof pool?.connect!=='function'||typeof auth!=='function')throw Error('Freight requires canonical authenticated game transactions.');
  const base='/v1/company/freight';const noQuery=async req=>{if(Object.keys(req.query||{}).length)throw new G.GameError('freight_consolidation','terms');};
  app.get(base,{preHandler:[auth,noQuery]},req=>F.freightConsolidationBoard(pool,req.user.sub));
  const act=async(req,action,batchId)=>{
    const key=req.headers['idempotency-key'];
    const prior=await F.replayFreightConsolidation(pool,req.user.sub,action,batchId,req.body,key);if(prior)return prior;
    const hook=F.freightLockHooks(action,batchId,req.body);
    return G.withCharacter(pool,req.user.sub,(ch,c,h)=>action==='create'?F.createFreightConsolidation(ch,req.body,key,c,h)
      :action==='accept'?F.acceptFreightConsolidation(ch,batchId,req.body,key,c)
      :action==='run'?F.runFreightConsolidation(ch,batchId,req.body,key,c,h):F.cancelFreightConsolidation(ch,batchId,req.body,key,c),hook);
  };
  app.post(base,{preHandler:[auth,noQuery]},req=>act(req,'create',null));
  for(const action of ['accept','run','cancel'])app.post(`${base}/:id/${action}`,{preHandler:[auth,noQuery]},req=>act(req,action,req.params.id));
}
