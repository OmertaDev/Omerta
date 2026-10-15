import crypto from 'node:crypto';
const normalize=text=>text.replace(/\r\n?/g,'\n');
const freeze=p=>Object.freeze({...p,extraBindings:Object.freeze(p.extraBindings),recordCheck:p.recordCheck?Object.freeze(p.recordCheck):null,terms:Object.freeze(p.terms.map(Object.freeze)),sections:Object.freeze(p.sections.map(s=>Object.freeze({...s,queries:Object.freeze(s.queries),anchors:Object.freeze(s.anchors)})))});
export const NEXT_LAYER_HELPER_PROFILES=Object.freeze([
 {
  "file": "src/customerlayaway.js",
  "fn": "collectCustomerLayawayIssues",
  "check": "customer layaway source history",
  "variable": "layawayIssues",
  "import": "import { collectCustomerLayawayIssues } from './customerlayaway.js';",
  "call": "const layawayIssues = await collectCustomerLayawayIssues(pool);",
  "push": "push('customer layaway source history', layawayIssues.length, 0, 0);",
  "extraBindings": [],
  "sections": [
   {
    "start": "async function backing(c,r,readOnly=false)",
    "end": "async function returnFunds(",
    "queries": [
     "SELECT * FROM transactions WHERE id=$1",
     "SELECT id FROM transactions WHERE counterparty=$1 AND reason='customer_layaway:reserve'"
    ],
    "anchors": [
     "t.character_id!==r.buyer_character",
     "t.currency!=='cash'",
     "t.counterparty!==r.id",
     "t.reason!=='customer_layaway:reserve'",
     "Number(t.amount)!==-Number(p.amount_cash)",
     "pieces.reduce((n,p)=>n+Number(p.amount_cash),0)!==Number(r.total_paid)"
    ]
   },
   {
    "start": "export async function collectCustomerLayawayIssues(",
    "end": "import {assertEstateResolutionScope}",
    "queries": [
     "SELECT * FROM transactions WHERE counterparty=$1 AND reason IN ('customer_layaway:proceeds','customer_layaway:refund')"
    ],
    "anchors": [
     "await backing(c,r,true);",
     "paid.reduce((n,t)=>n+Number(t.amount),0)!==Number(r.paid_to_seller)",
     "refund.reduce((n,t)=>n+Number(t.amount),0)!==Number(r.refunded_cash)",
     "paid.some(t=>t.character_id!==r.seller_character||t.currency!=='cash')",
     "refund.some(t=>t.character_id!==r.buyer_character||t.currency!=='cash')",
     "return issues;",
     "hash(source(r))!==r.source_hash"
    ]
   }
  ],
  "terms": [
   [
    "customer_layaway:reserve",
    0,
    0
   ],
   [
    "customer_layaway:proceeds",
    1,
    0
   ],
   [
    "customer_layaway:refund",
    1,
    0
   ]
  ],
  "sha256": "e1291c68e1589ce99c7f33c22b7c44507a459235b45e1b1e94d1f0ead97c6ffc"
 },
 {
  "file": "src/customervaults.js",
  "fn": "customerVaultAccounting",
  "check": "customer vault canonical funding",
  "variable": "vault",
  "import": "import { customerVaultAccounting } from './customervaults.js';",
  "call": "const vault = await customerVaultAccounting(pool);",
  "push": "push('customer vault canonical funding', vault.issues.length, 0, 0, { issues: vault.issues });",
  "extraBindings": [
   "push('customer vault reserved custody', vault.reserve, -vault.ledgerDelta, 0);"
  ],
  "sections": [
   {
    "start": "async function funding(c,r)",
    "end": "async function ",
    "queries": [
     "SELECT id,character_id,currency,amount,reason,counterparty FROM transactions WHERE counterparty=$1 AND reason IN ('customer_vault:reserve','customer_vault:fee_pay','customer_vault:fee_receive','customer_vault:withdraw','customer_vault:estate_refund') ORDER BY id"
    ],
    "anchors": [
     "v.id===tx&&v.character_id===character&&v.currency==='cash'&&Number(v.amount)===amount&&v.reason===reason&&v.counterparty===r.id",
     "matches(r.reserve_debit,r.customer_character,-Number(r.principal),'customer_vault:reserve')",
     "matches(r.fee_debit,r.customer_character,-fee,'customer_vault:fee_pay')",
     "matches(r.fee_credit,r.operator_character,fee,'customer_vault:fee_receive')",
     "matches(r.release_credit,r.customer_character,Number(r.principal),r.state==='withdrawn'?'customer_vault:withdraw':'customer_vault:estate_refund')",
     "Number(r.remaining)!==(released?0:Number(r.principal))",
     "r.source_hash!==positionHash(r)",
     "service.operator_account!==r.operator_account",
     "v.id===r.customer_character&&v.account_id===r.customer_account",
     "v.id===r.operator_character&&v.account_id===r.operator_account"
    ]
   },
   {
    "start": "export async function customerVaultAccounting(",
    "end": null,
    "queries": [
     "SELECT id,currency,amount FROM transactions WHERE reason IN ('customer_vault:reserve','customer_vault:fee_pay','customer_vault:fee_receive','customer_vault:withdraw','customer_vault:estate_refund')"
    ],
    "anchors": [
     "await funding(c,r);reserve+=Number(r.remaining);",
     "[r.reserve_debit,r.fee_debit,r.fee_credit,r.release_credit]",
     "if(!bound.has(t.id))issues.push({reason:'unbound_journal'})",
     "if(t.currency!=='cash')issues.push({reason:'wrong_currency'})",
     "ledgerDelta+reserve!==0",
     "return {reserve,ledgerDelta,issues};"
    ]
   }
  ],
  "terms": [
   [
    "customer_vault:reserve",
    0,
    0
   ],
   [
    "customer_vault:fee_pay",
    0,
    0
   ],
   [
    "customer_vault:fee_receive",
    0,
    0
   ],
   [
    "customer_vault:withdraw",
    0,
    0
   ],
   [
    "customer_vault:estate_refund",
    0,
    0
   ]
  ],
  "sha256": "fbce32ae943b274b5e62a30d02879eebca66ef3c06428d897e89a0beefd03df8",
  "recordCheck": {
   "check": "customer vault reserved custody",
   "push": "push('customer vault reserved custody', vault.reserve, -vault.ledgerDelta, 0);",
   "section": 1,
   "query": 0
  }
 },
 {
  "file": "src/multihopcourier.js",
  "fn": "collectMultiHopCourierIssues",
  "check": "multi-hop courier custody and fee source",
  "variable": "courierIssues",
  "import": "import { collectMultiHopCourierIssues } from './multihopcourier.js';",
  "call": "const courierIssues = await collectMultiHopCourierIssues(pool);",
  "push": "push('multi-hop courier custody and fee source', courierIssues.length, 0, 0, { issues: courierIssues });",
  "extraBindings": [],
  "sections": [
   {
    "start": "export async function collectMultiHopCourierIssues(",
    "end": "import {assertEstateResolutionScope}",
    "queries": [
     "SELECT * FROM transactions WHERE counterparty=$1 AND reason IN ('multi_hop_courier:reserve','multi_hop_courier:fee','multi_hop_courier:refund') ORDER BY id"
    ],
    "anchors": [
     "legs.some(t=>t.currency!=='cash')",
     "held.some(t=>t.character_id!==r.owner_character||Number(t.amount)!==-total)",
     "t.character_id===r.first_character&&Number(t.amount)===Number(r.earned_first)",
     "t.character_id===r.second_character&&Number(t.amount)===Number(r.earned_second)",
     "refunds.some(t=>t.character_id!==r.owner_character||Number(t.amount)!==Number(r.refunded_cash))",
     "legs.reduce((n,t)=>n+Number(t.amount),0)+Number(r.reserved_cash)!==0",
     "return issues;",
     "hash(source(r))!==r.source_hash"
    ]
   }
  ],
  "terms": [
   [
    "multi_hop_courier:reserve",
    0,
    0
   ],
   [
    "multi_hop_courier:fee",
    0,
    0
   ],
   [
    "multi_hop_courier:refund",
    0,
    0
   ]
  ],
  "sha256": "d065c836bf0086b67b9a7ab385e7de9dd760675c266a7049d3de910f86f8b9bf"
 }
].map(freeze));
export function extractNextLayerHelperReconciliations(invariants,helpers){
 if(typeof invariants!=='string'||!helpers||typeof helpers!=='object'||Array.isArray(helpers)||Object.keys(helpers).some(file=>!NEXT_LAYER_HELPER_PROFILES.some(p=>p.file===file)))return [];
 const lines=normalize(invariants).split('\n'),exact=literal=>lines.flatMap((line,i)=>line.trim()===literal?[i]:[]),terms=[];
 for(const p of NEXT_LAYER_HELPER_PROFILES){const raw=helpers[p.file];if(typeof raw!=='string')continue;const helper=normalize(raw);if(crypto.createHash('sha256').update(helper).digest('hex')!==p.sha256)continue;
 const imports=exact(p.import),calls=exact(p.call),pushes=exact(p.push);if(imports.length!==1||calls.length!==1||pushes.length!==1||imports[0]>=calls[0]||calls[0]>=pushes[0]||p.extraBindings.some(s=>{const rows=exact(s);return rows.length!==1||rows[0]<=calls[0]||rows[0]>=pushes[0];}))continue;
 const sections=p.sections.map(s=>{const start=helper.indexOf(s.start);if(start<0||helper.indexOf(s.start,start+1)!==-1)return null;const end=s.end===null?helper.length:helper.indexOf(s.end,start+s.start.length);if(end<0)return null;const body=helper.slice(start,end);if(s.anchors.some(a=>!body.includes(a))||s.queries.some(q=>{const n=body.indexOf(q);return n<0||body.indexOf(q,n+1)!==-1;}))return null;return {start,body};});if(sections.some(s=>!s))continue;
 for(const [reason,section,query]of p.terms){const s=sections[section],offset=s.start+s.body.indexOf(p.sections[section].queries[query]);terms.push({check:p.check,reason,file:p.file,line:helper.slice(0,offset).split('\n').length,bindingLine:pushes[0]+1,sourceSha256:p.sha256});}
 if(p.recordCheck){const r=p.recordCheck,s=sections[r.section],offset=s.start+s.body.indexOf(p.sections[r.section].queries[r.query]);for(const [reason]of p.terms)terms.push({check:r.check,reason,file:p.file,line:helper.slice(0,offset).split('\n').length,bindingLine:exact(r.push)[0]+1,sourceSha256:p.sha256});}
 }return terms;
}
