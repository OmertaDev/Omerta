import * as G from '../game.js';import * as T from '../managementteams.js';
export function register(app,{pool,auth,currentTeamTurn=null}){
 const service=T.managementTeams(currentTeamTurn),pair=async(req,entity,plan,fn)=>G.withTwoCharacters(pool,req.user.sub,await T.managementTeamParty(pool,req.user.sub,entity,plan),fn,{meet:false});
 app.get('/v1/company/management-teams',{preHandler:auth},req=>T.managementTeamBoard(pool,req.user.sub));
 app.post('/v1/company/partnerships/:id/team/optin',{preHandler:auth},req=>pair(req,req.params.id,false,(ch,o,c)=>service.optIn(ch,o,req.params.id,req.body,req.headers['idempotency-key'],c,req.user.agent===true)));
 app.get('/v1/company/partnerships/:id/team/snapshot',{preHandler:auth},req=>pair(req,req.params.id,false,(ch,o,c,h)=>service.snapshot(ch,o,req.params.id,c,h)));
 app.post('/v1/company/partnerships/:id/team/plans',{preHandler:auth},req=>pair(req,req.params.id,false,(ch,o,c,h)=>service.propose(ch,o,req.params.id,req.body,req.headers['idempotency-key'],c,h)));
 app.post('/v1/company/management-teams/plans/:id/execute',{preHandler:auth},req=>pair(req,req.params.id,true,(ch,o,c,h)=>service.execute(ch,o,req.params.id,req.body,req.headers['idempotency-key'],c,h,req.user.agent===true)));
 app.post('/v1/company/partnerships/:id/team/withdraw',{preHandler:auth},req=>pair(req,req.params.id,false,(ch,o,c)=>service.withdraw(ch,o,req.params.id,req.body,req.headers['idempotency-key'],c)));
}
