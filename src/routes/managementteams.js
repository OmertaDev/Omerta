import { withItemRead } from '../items.js';
import { withManagementTeamScope, setManagementTeamAutonomy, replayManagementTeamAutonomy } from '../managementteamautonomy.js';
import * as G from '../game.js';
import * as T from '../managementteams.js';
export function register(app,{pool,auth,currentTeamTurn=null}){
 const service=T.managementTeams(currentTeamTurn);const recorded=async(req,kind,entity,execute)=>{const old=await withItemRead(pool,c=>T.replayManagementTeamRequest(c,req.user.sub,kind,entity,req.body,req.headers['idempotency-key']));return old||execute();};const pair=async(req,entity,plan,fn)=>{const target=await T.managementTeamParty(pool,req.user.sub,entity,plan);return G.withTwoCharacters(pool,req.user.sub,target,fn,{meet:false,withActionScope:(c,account,execute)=>withManagementTeamScope(c,account,target,execute)});};
 app.get('/v1/company/management-teams',{preHandler:auth},req=>{if(Object.keys(req.query||{}).length)throw new G.GameError('management_team','terms');return withItemRead(pool,c=>T.managementTeamBoard(c,req.user.sub));});
 app.post('/v1/company/partnerships/:id/team/optin',{preHandler:auth},req=>pair(req,req.params.id,false,(ch,o,c)=>service.optIn(ch,o,req.params.id,req.body,req.headers['idempotency-key'],c,req.user.agent===true)));
 app.get('/v1/company/partnerships/:id/team/snapshot',{preHandler:auth},req=>{if(Object.keys(req.query||{}).length)throw new G.GameError('management_team','terms');return pair(req,req.params.id,false,(ch,o,c,h)=>service.snapshot(ch,o,req.params.id,c,h));});
 app.post('/v1/company/partnerships/:id/team/plans',{preHandler:auth},req=>pair(req,req.params.id,false,(ch,o,c,h)=>service.propose(ch,o,req.params.id,req.body,req.headers['idempotency-key'],c,h)));
 app.post('/v1/company/management-teams/plans/:id/execute',{preHandler:auth},req=>recorded(req,'execute',req.params.id,()=>pair(req,req.params.id,true,(ch,o,c,h)=>service.execute(ch,o,req.params.id,req.body,req.headers['idempotency-key'],c,h,req.user.agent===true))));
 app.post('/v1/company/management-teams/plans/:id/autonomy',{preHandler:auth},async req=>{const old=await replayManagementTeamAutonomy(pool,req.user.sub,req.params.id,req.body,req.headers['idempotency-key']);if(old)return old;return pair(req,req.params.id,true,(ch,o,c)=>setManagementTeamAutonomy(ch,o,req.params.id,req.body,req.headers['idempotency-key'],c,req.user.agent===true));});
 app.post('/v1/company/partnerships/:id/team/withdraw',{preHandler:auth},req=>pair(req,req.params.id,false,(ch,o,c)=>service.withdraw(ch,o,req.params.id,req.body,req.headers['idempotency-key'],c)));
}
