import assert from 'node:assert/strict';
import {fixture as workshopFixture} from './workshopfloor-fixture.js';
import * as B from '../src/productionbooking.js';
import {productionBookingAccounting} from '../src/productionbooking-invariants.js';
import {runLedgerInvariants} from '../src/invariants.js';

export async function fixture(api=false){
  Object.assign(process.env,{RESOURCE_ECONOMY:'off',LEGAL_OPERATOR_NAME:'CI Test Operator',LEGAL_POSTAL_ADDRESS:'123 Fixture Street, Test City',PRIVACY_CONTACT_EMAIL:'privacy@example.test',DMCA_AGENT_NAME:'CI Test Agent',DMCA_AGENT_EMAIL:'copyright@example.test',DMCA_AGENT_ADDRESS:'123 Fixture Street, Test City',DMCA_AGENT_PHONE:'+1 202 555 0100',DMCA_AGENT_REGISTERED:'true',PAYMENT_REFUND_POLICY:'Test fixture policy; not a production policy.'});
  // Reuse N13's genuine strict-fresh native admission and canonical fixtures;
  // its owned workshop_floor_test_<nonce> database is never an ambient endpoint.
  const f=await workshopFixture(api);let n=0;
  const tool=await f.tool();await f.specialize('maker','quality',tool);await f.configure('maker',[f.bench(tool,1),f.service(2)]);
  await f.materials('customer',[{templateId:'mat:hardened_steel',quantity:8},{templateId:'mat:salvage_parts',quantity:16}]);
  const terms=()=>({businessId:f.businesses.maker,customerCharacterId:'customer-actor',feeCash:100,bonusCash:10,lifetimeSeconds:1200,consent:true});
  const ref=q=>({bookingId:q.offer?.bookingId??q.bookingId,sourceHash:q.offer?.sourceHash??q.sourceHash,consent:true});
  const accept=q=>({...ref(q),feeCash:100,bonusCash:10});
  const invoke=(action,a,b,key='booking-test-'+(++n),agentCredential=false)=>f.tx(c=>B[action+'ProductionBooking'](c,a,b,key,{agentCredential}));
  const snapshot=async()=>{const s=await f.state();for(const t of ['production_booking_offers','production_booking_runs','production_booking_positions','production_booking_requests'])s[t]=(await f.pool.query('SELECT * FROM '+t)).rows.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));return s;};
  const books=async()=>{assert.deepEqual((await productionBookingAccounting(f.pool)).issues,[]);const b=await runLedgerInvariants(f.pool,{alert:false});assert.deepEqual(b.checks.filter(x=>!x.ok),[]);return b.checks.length;};
  return{...f,B,tool,terms,ref,accept,invoke,snapshot,books};
}
