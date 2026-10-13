import * as G from '../game.js';
import { companyForecast, applyCompanyForecast } from '../companyforecast.js';
export function register(app,{pool,auth}){
 app.post('/v1/company/forecast/:id',{preHandler:auth},req=>G.readCharacter(pool,req.user.sub,(ch,c,h)=>companyForecast(ch,req.params.id,req.body,c,h)));
 app.post('/v1/company/forecast/:id/apply',{preHandler:auth},req=>G.withCharacter(pool,req.user.sub,(ch,c,h)=>applyCompanyForecast(ch,req.params.id,req.body,c,req.user.agent===true,h)));
}
