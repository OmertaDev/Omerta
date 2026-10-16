import crypto from 'node:crypto';
const normalize=text=>text.replace(/\r\n?/g,'\n');
const freeze=p=>Object.freeze({...p,extraBindings:Object.freeze(p.extraBindings),recordCheck:p.recordCheck?Object.freeze(p.recordCheck):null,terms:Object.freeze(p.terms.map(Object.freeze)),sections:Object.freeze(p.sections.map(s=>Object.freeze({...s,queries:Object.freeze(s.queries),anchors:Object.freeze(s.anchors)})))});
export const MARKET_OPERATIONS_HELPER_PROFILES=Object.freeze([
  {
    "file": "src/merchantreturnsinvariants.js",
    "fn": "collectMerchantReturnIssues",
    "check": "merchant return canonical books",
    "variable": "merchantReturnIssues",
    "import": "import {collectMerchantReturnIssues} from './merchantreturnsinvariants.js';",
    "call": "const merchantReturnIssues = await collectMerchantReturnIssues(pool);",
    "push": "push('merchant return canonical books', merchantReturnIssues.length, 0, 0, {issues:merchantReturnIssues});",
    "extraBindings": [],
    "sections": [
      {
        "start": "export async function collectMerchantReturnIssues(",
        "end": "export async function merchantReturnCashInvariant(",
        "queries": [
          "SELECT * FROM transactions WHERE reason IN ('merchant_return:reserve','merchant_return:payout','merchant_return:refund') ORDER BY id"
        ],
        "anchors": [
          "await merchantReturnSaleWitness(c,r.sale_id,false)",
          "r.sale_hash!==s.row.source_hash",
          "r.item_id!==s.row.item_id",
          "Number(r.refund_cash)>s.net",
          "Number(r.refund_cash)!==Number(r.escrow_cash)+Number(r.paid_cash)+Number(r.refunded_cash)",
          "j?.character_id===actor&&j.account_id===account&&j.currency==='cash'&&Number(j.amount)===amount",
          "reserve[0].id!==r.reserve_journal",
          "!bind(reserve[0],r.seller_character,r.seller_account,-Number(r.refund_cash))",
          "!bind(j,r.buyer_character,r.buyer_account,Number(r.paid_cash))",
          "!bind(j,r.seller_character,r.seller_account,Number(r.refunded_cash))",
          "return issues;"
        ]
      }
    ],
    "terms": [
      [
        "merchant_return:reserve",
        0,
        0
      ],
      [
        "merchant_return:payout",
        0,
        0
      ],
      [
        "merchant_return:refund",
        0,
        0
      ]
    ],
    "sha256": "b708669fb1f58c303395d5126c2f7ee164969f5e03c5471874043ddfca51666b"
  }
].map(freeze));
export function extractMarketOperationsHelperReconciliations(invariants,helpers){
 if(typeof invariants!=='string'||!helpers||typeof helpers!=='object'||Array.isArray(helpers)||Object.keys(helpers).some(file=>!MARKET_OPERATIONS_HELPER_PROFILES.some(p=>p.file===file)))return [];
 const lines=normalize(invariants).split('\n'),exact=literal=>lines.flatMap((line,i)=>line.trim()===literal?[i]:[]),terms=[];
 for(const p of MARKET_OPERATIONS_HELPER_PROFILES){const raw=helpers[p.file];if(typeof raw!=='string')continue;const helper=normalize(raw);if(crypto.createHash('sha256').update(helper).digest('hex')!==p.sha256)continue;
 const imports=exact(p.import),calls=exact(p.call),pushes=exact(p.push);if(imports.length!==1||calls.length!==1||pushes.length!==1||imports[0]>=calls[0]||calls[0]>=pushes[0]||p.extraBindings.some(s=>{const rows=exact(s);return rows.length!==1||rows[0]<=calls[0]||rows[0]>=pushes[0];}))continue;
 const sections=p.sections.map(s=>{const start=helper.indexOf(s.start);if(start<0||helper.indexOf(s.start,start+1)!==-1)return null;const end=s.end===null?helper.length:helper.indexOf(s.end,start+s.start.length);if(end<0)return null;const body=helper.slice(start,end);if(s.anchors.some(a=>!body.includes(a))||s.queries.some(q=>{const n=body.indexOf(q);return n<0||body.indexOf(q,n+1)!==-1;}))return null;return {start,body};});if(sections.some(s=>!s))continue;
 for(const [reason,section,query]of p.terms){const s=sections[section],offset=s.start+s.body.indexOf(p.sections[section].queries[query]);terms.push({check:p.check,reason,file:p.file,line:helper.slice(0,offset).split('\n').length,bindingLine:pushes[0]+1,sourceSha256:p.sha256});}
 if(p.recordCheck){const r=p.recordCheck,s=sections[r.section],offset=s.start+s.body.indexOf(p.sections[r.section].queries[r.query]);for(const [reason]of p.terms)terms.push({check:r.check,reason,file:p.file,line:helper.slice(0,offset).split('\n').length,bindingLine:exact(r.push)[0]+1,sourceSha256:p.sha256});}
 }return terms;
}
