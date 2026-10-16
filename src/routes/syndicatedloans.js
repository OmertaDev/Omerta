import * as S from '../syndicatedloans.js';
import { GameError } from '../game.js';
export function register(app,{pool,auth}) {
  if(typeof auth!=='function')throw Error('Syndicated loans require canonical authentication.');
  const runtime=S.createSyndicatedLoanRuntime({pool});
  const query=req=>{if(Object.keys(req.query||{}).length)throw new GameError('syndicated_loan','query');};
  const ready=async()=>{if(!await runtime.ready())throw Object.assign(new GameError('syndicated_loan_unavailable','Canonical loan guard and three-original persistence required.'),{statusCode:503});};
  app.get('/v1/company/syndicated-loans/availability',{preHandler:auth},async req=>{query(req);return {available:await runtime.ready(),currency:'game_cash',lenders:2,fullRepaymentOnly:true,pooledFunds:false,cryptoAvailable:false};});
  app.get('/v1/company/syndicated-loans',{preHandler:auth},async req=>{query(req);await ready();return S.syndicatedLoanBoard(pool,req.user.sub);});
  for(const action of ['propose','fund','take','repay','cancel'])app.post('/v1/company/syndicated-loans/'+action,{preHandler:auth},req=>{query(req);return runtime.action(req.user.sub,action,req.body,req.headers['idempotency-key']);});
}
