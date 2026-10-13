import {FUNDED_EXTERNAL_WORK_STATUS} from '../fundedexternalwork.js';
export function register(app,{auth}){
 // Deliberately no pool, game transaction, source verifier, signer or provider dependency.
 const unavailable=(_req,reply)=>reply.code(503).send({...FUNDED_EXTERNAL_WORK_STATUS});
 app.get('/v1/company/external-work',{preHandler:auth},()=>({...FUNDED_EXTERNAL_WORK_STATUS,work:[]}));
 for(const path of['/v1/company/external-work','/v1/company/external-work/:id/accept','/v1/company/external-work/:id/allocate','/v1/company/external-work/:id/cancel','/v1/company/external-work/:id/recover'])app.post(path,{preHandler:auth},unavailable);
}
