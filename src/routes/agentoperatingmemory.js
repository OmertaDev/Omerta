import * as G from '../game.js';
import { withItemTransaction } from '../items.js';
import * as M from '../agentoperatingmemory.js';
export function register(app,{pool,auth,readAuthorizedAgentTurn}){if(typeof pool?.connect!=='function'||typeof auth!=='function'||typeof readAuthorizedAgentTurn!=='function')throw Error('Agent operating memory requires canonical transactions, authentication and the actual authorized Agent Turn reader.');const base='/v1/agent/memory',key=req=>req.headers['idempotency-key'];app.get(base,{preHandler:auth},req=>{if(Object.keys(req.query||{}).some(k=>k!=='after'))throw new G.GameError('agent_operating_memory','terms');return M.agentOperatingMemoryBoard(pool,req.user.sub,req.query?.after??null);});
 app.get(`${base}/selection`,{preHandler:auth},async req=>{if(Object.keys(req.query||{}).length)throw new G.GameError('agent_operating_memory','terms');const turn=await readAuthorizedAgentTurn(req.user.sub);return M.selectAgentOperatingMemory(pool,req.user.sub,turn?.state?.identity?.id,turn);});
 for(const [action,fn]of [['policy',M.setAgentOperatingMemory],['capture',M.captureAgentOperatingMemory],['observe',M.observeAgentOperatingMemory],['forget',M.forgetAgentOperatingMemory]])app.post(`${base}/${action}`,{preHandler:auth},req=>withItemTransaction(pool,c=>fn(c,req.user.sub,req.body,key(req))));
}
