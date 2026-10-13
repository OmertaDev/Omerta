import * as G from '../game.js';
import * as C from '../companygovernance.js';
export function register(app,{pool,auth}){
 const pair=async(req,entityId,proposal,fn)=>G.withTwoCharacters(pool,req.user.sub,await C.companyGovernanceParty(pool,req.user.sub,entityId,proposal),fn,{meet:false});
 app.get('/v1/company/governance',{preHandler:auth},req=>{if(Object.keys(req.query||{}).length)throw new G.GameError('company_governance','filters');return C.companyGovernanceBoard(pool,req.user.sub);});
 app.post('/v1/company/partnerships/:id/governance/optin',{preHandler:auth},req=>pair(req,req.params.id,false,(ch,o,c)=>C.optInCompanyGovernance(ch,o,req.params.id,req.body,req.headers['idempotency-key'],c)));
 app.get('/v1/company/partnerships/:id/governance/snapshot',{preHandler:auth},req=>{if(Object.keys(req.query||{}).length)throw new G.GameError('company_governance','filters');return pair(req,req.params.id,false,(ch,o,c)=>C.companyGovernanceSnapshot(ch,o,req.params.id,c));});
 app.post('/v1/company/partnerships/:id/governance/proposals',{preHandler:auth},req=>pair(req,req.params.id,false,(ch,o,c)=>C.proposeCompanyGovernance(ch,o,req.params.id,req.body,req.headers['idempotency-key'],c)));
 app.post('/v1/company/governance/:id/vote',{preHandler:auth},req=>pair(req,req.params.id,true,(ch,o,c)=>C.voteCompanyGovernance(ch,o,req.params.id,req.body,req.headers['idempotency-key'],c)));
 app.post('/v1/company/governance/:id/execute',{preHandler:auth},req=>pair(req,req.params.id,true,(ch,o,c)=>C.executeCompanyGovernance(ch,o,req.params.id,req.body,req.headers['idempotency-key'],c,req.user.agent===true)));
}
