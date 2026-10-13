import * as G from '../game.js';
import { companyDemand, companyDemandScenario, applyCompanyDemandScenario } from '../companydemand.js';
export function register(app,{pool,auth}){
 app.get('/v1/company/demand/:id',{preHandler:auth,schema:{querystring:{type:'object',additionalProperties:false,properties:{windowHours:{type:'integer',enum:[4,12,24]}}}}},req=>G.readCharacter(pool,req.user.sub,(ch,c)=>companyDemand(ch,req.params.id,req.query,c)));
 app.post('/v1/company/demand/:id/scenario',{preHandler:auth},req=>G.readCharacter(pool,req.user.sub,(ch,c,h)=>companyDemandScenario(ch,req.params.id,req.body,c,h)));
 app.post('/v1/company/demand/:id/apply',{preHandler:auth},req=>G.withCharacter(pool,req.user.sub,(ch,c,h)=>applyCompanyDemandScenario(ch,req.params.id,req.body,c,req.user.agent===true,h)));
}
