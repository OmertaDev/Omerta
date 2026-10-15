import * as G from '../game.js';
import * as P from '../performanceemployment.js';
import {withItemTransaction} from '../items.js';
export function register(app,{pool,auth}){
 const query=req=>{if(Object.keys(req.query||{}).length)throw new G.GameError('performance_employment','query');};
 app.get('/v1/company/performance-employment',{preHandler:auth},req=>{query(req);return P.performanceEmploymentBoard(pool,req.user.sub);});
 app.post('/v1/company/performance-employment',{preHandler:auth},async req=>{
  query(req);const key=req.headers['idempotency-key'];const prior=await P.replayPerformanceEmployment(pool,req.user.sub,req.body,key);if(prior)return prior;
  return withItemTransaction(pool,c=>P.fundPerformanceEmployment(c,req.user.sub,req.body,key,{agent:req.user.agent===true}));
 });
}
