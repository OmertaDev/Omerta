import { GameError } from '../game.js';
import { territoryEconomicsAction, territoryEconomicsBoard } from '../territoryeconomics.js';
export function register(app,{pool,auth}){const noQuery=async req=>{if(Object.keys(req.query||{}).length)throw new GameError('territory_economics','terms');};
  if(typeof pool?.connect!=='function'||typeof auth!=='function')throw Error('Territory economics requires authenticated canonical gameplay.');
  const base='/v1/company/territory-economics';
  app.get(base,{preHandler:[auth,noQuery]},req=>{if(Object.keys(req.query||{}).length)throw new GameError('territory_economics','terms');return territoryEconomicsBoard(pool,req.user.sub);});
  for(const action of ['configure','run','close'])app.post(`${base}/${action}`,{preHandler:[auth,noQuery]},req=>territoryEconomicsAction(pool,req.user.sub,action,req.body,req.headers['idempotency-key'],{agentCredential:req.user.agent===true}));
}
