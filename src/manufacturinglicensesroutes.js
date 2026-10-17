import {GameError} from './game.js';
import {manufacturingLicenseAction,manufacturingLicenseBoard} from './manufacturinglicenses.js';
export function register(app,{pool,auth}){
 if(typeof auth!=='function'||typeof pool?.connect!=='function')throw Error('Authenticated canonical item transactions required');
 const query=async req=>{if(Object.keys(req.query||{}).length)throw new GameError('manufacturing_license','query');};
 app.get('/v1/company/manufacturing-licenses',{preHandler:[auth,query]},req=>manufacturingLicenseBoard(pool,req.user.sub));
 app.post('/v1/company/manufacturing-licenses/publish',{preHandler:[auth,query]},req=>manufacturingLicenseAction(pool,req.user.sub,'publish',req.body,req.headers['idempotency-key'],{agent:req.user.agent===true}));
 app.post('/v1/company/manufacturing-licenses/accept',{preHandler:[auth,query]},req=>manufacturingLicenseAction(pool,req.user.sub,'accept',req.body,req.headers['idempotency-key'],{agent:req.user.agent===true}));
 app.post('/v1/company/manufacturing-licenses/run',{preHandler:[auth,query]},req=>manufacturingLicenseAction(pool,req.user.sub,'run',req.body,req.headers['idempotency-key'],{agent:req.user.agent===true}));
 app.post('/v1/company/manufacturing-licenses/cancel',{preHandler:[auth,query]},req=>manufacturingLicenseAction(pool,req.user.sub,'cancel',req.body,req.headers['idempotency-key'],{agent:req.user.agent===true}));
}