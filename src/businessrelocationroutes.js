import {withItemRead} from './items.js';
import {GameError} from './game.js';
import {businessRelocationBoard,quoteBusinessRelocation,runBusinessRelocation} from './businessrelocation.js';
const noQuery=async req=>{if(Object.keys(req.query||{}).length)throw new GameError('business_relocation','query');};
export function register(app,{pool,auth}){
 app.get('/v1/business/relocations',{preHandler:[auth,noQuery]},req=>withItemRead(pool,c=>businessRelocationBoard(c,req.user.sub)));
 app.post('/v1/business/relocations/quote',{preHandler:[auth,noQuery]},req=>quoteBusinessRelocation(pool,req.user.sub,req.body,{agent:req.user.agent===true}));
 app.post('/v1/business/relocations/create',{preHandler:[auth,noQuery]},req=>runBusinessRelocation(pool,req.user.sub,'create',req.body,req.headers['idempotency-key'],{agent:req.user.agent===true}));
 app.post('/v1/business/relocations/execute',{preHandler:[auth,noQuery]},req=>runBusinessRelocation(pool,req.user.sub,'execute',req.body,req.headers['idempotency-key'],{agent:req.user.agent===true}));
 app.post('/v1/business/relocations/cancel',{preHandler:[auth,noQuery]},req=>runBusinessRelocation(pool,req.user.sub,'cancel',req.body,req.headers['idempotency-key'],{agent:req.user.agent===true}));
}

