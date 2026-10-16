import * as E from '../eventmarkets.js';import {GameError} from '../game.js';
export function register(app,{pool,auth}){
 if(typeof auth!=='function')throw Error('Market events require canonical authentication.');const query=req=>{if(Object.keys(req.query||{}).length)throw new GameError('event_market','query');};
 app.get('/v1/events/markets/availability',{preHandler:auth},async req=>{query(req);return{available:await E.eventMarketReady(),currency:'game_cash',vendorLimit:1,participantLimit:3,requiresNativeTransactions:true,venueConsentRequired:true,vendorActiveLimit:1,pickupActiveLimit:1,cryptoAvailable:false};});
 app.get('/v1/events/markets',{preHandler:auth},req=>{query(req);return E.eventMarketBoard(pool,req.user.sub);});
 for(const action of ['fund','enroll','venue','withdraw','join','leave','visit','finish','cancel','expire'])app.post('/v1/events/markets/'+action,{preHandler:auth},req=>{query(req);return E.runEventMarket(pool,req.user.sub,action,req.body,req.headers['idempotency-key']);});
}
