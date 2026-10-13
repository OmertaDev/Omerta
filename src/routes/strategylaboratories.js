import { GameError } from '../game.js';
import { strategyLaboratoryAction, strategyLaboratoryBoard } from '../strategylaboratories.js';
export function register(app,{pool,auth}){if(typeof pool?.connect!=='function'||typeof auth!=='function')throw Error('Strategy laboratories require authenticated canonical gameplay.');const base='/v1/company/strategy-laboratories';
 app.get(base,{preHandler:auth},req=>{if(Object.keys(req.query||{}).length)throw new GameError('strategy_laboratory','terms');return strategyLaboratoryBoard(pool,req.user.sub);});
 for(const action of ['create','advance','close'])app.post(`${base}/${action}`,{preHandler:auth},req=>strategyLaboratoryAction(pool,req.user.sub,action,req.body,req.headers['idempotency-key'],{agentCredential:req.user.agent===true}));}
