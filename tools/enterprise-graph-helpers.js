import crypto from 'node:crypto';
const normalize=text=>text.replace(/\r\n?/g,'\n');
const freeze=p=>Object.freeze({...p,extraBindings:Object.freeze(p.extraBindings),recordCheck:p.recordCheck?Object.freeze(p.recordCheck):null,terms:Object.freeze(p.terms.map(Object.freeze)),sections:Object.freeze(p.sections.map(s=>Object.freeze({...s,queries:Object.freeze(s.queries),anchors:Object.freeze(s.anchors)})))});
export const ENTERPRISE_STRUCTURAL_CHECKS=Object.freeze([
  {
    "check": "business relocation history",
    "file": "src/businessrelocationhistory.js",
    "fn": "collectBusinessRelocationIssues",
    "why": "original relocation/travel/depot-stock receipt identities; no separate money bucket",
    "push": "push('business relocation history',relocationIssues.length,0,0,{issues:relocationIssues});",
    "sha256": "4a3c0c9bc21f3c610f4f496bf21cf5f483277fb17f10f798728c2f7111646cd2",
    "revision": "5fb8ec516236ceb4456f1f38b0d19ac111c35087",
    "blob": "5615c94dcd61c99ba993cdba1bc0d7cd11debe8d"
  },
  {
    "check": "equipment recovery consumed UID and material history",
    "file": "src/equipmentrecoveryhistory.js",
    "fn": "collectEquipmentRecoveryIssues",
    "why": "original consumed tool and conserved material/item-event receipts; zero cash",
    "push": "push('equipment recovery consumed UID and material history',recoveryIssues.length,0,0,{issues:recoveryIssues});",
    "sha256": "0387463758f4f82e9fbddf5f5c10d4bdb5d2bfd3ca09a2ccfb4d80d9fa2fed88",
    "revision": "5fb8ec516236ceb4456f1f38b0d19ac111c35087",
    "blob": "bef3ee4ea8a7a5b39d9b07fa588e240f061b3cde"
  },
  {
    "check": "mobile shop canonical source/history",
    "file": "src/mobileshops.js",
    "fn": "collectMobileShopIssues",
    "why": "original listing/sale/return and canonical market journal identities; market cash is reconciled separately",
    "push": "push('mobile shop canonical source/history', mobileShopIssues.length, 0, 0, { issues: mobileShopIssues });",
    "sha256": "7489f3710e4dc1e41de1f4d0280a348e47c6fea3036fe6405d7ef5a0af2f922d",
    "revision": "4f5fde87c29453a71f027fae5f694f44e8677b3d",
    "blob": "41347b97c38d5aaa4d31a58fbc27d88e81a7d3ae"
  },
  {
    "check": "workshop floor source and allocation history",
    "file": "src/workshopfloor.js",
    "fn": "collectWorkshopFloorIssues",
    "why": "original allocations, slot/source references and acknowledgement history; no cash bucket",
    "push": "push('workshop floor source and allocation history',floorIssues.length,0,0,{issues:floorIssues});",
    "sha256": "857f1e6425332bacfed91e61861ac3fb3e56f82ad135ca7ba784f0529561b21c",
    "revision": "84499ed6242ab569667802dacb2d5c17612e3c33",
    "blob": "1800358bc1fb8d2dbdba15b6b388dfa5205e15a3"
  }
].map(Object.freeze));
export const ENTERPRISE_HELPER_PROFILES=Object.freeze([
  {
    "file": "src/manufacturinglicensesinvariants.js",
    "fn": "manufacturingLicenseAccounting",
    "check": "manufacturing license canonical royalty history",
    "variable": "manufacturingLicenseBooks",
    "import": "const {manufacturingLicenseAccounting}=await import('./manufacturinglicensesinvariants.js');",
    "call": "const manufacturingLicenseBooks=await manufacturingLicenseAccounting(pool);",
    "push": "push('manufacturing license canonical royalty history',manufacturingLicenseBooks.issues.length+Math.abs(manufacturingLicenseBooks.royaltyNet),0,0,{issues:manufacturingLicenseBooks.issues});",
    "extraBindings": [],
    "sections": [
      {
        "start": "export async function manufacturingLicenseAccounting(c){",
        "end": "export async function collectManufacturingLicenseIssues(c)",
        "queries": [
          "SELECT * FROM transactions WHERE reason IN ('manufacturing_license:pay','manufacturing_license:receive') ORDER BY id"
        ],
        "anchors": [
          "if(!leg||used.has(leg.id)||leg.character_id!==character||leg.account_id!==null||leg.currency!=='cash'||Number(leg.amount)!==amount||leg.reason!==reason||leg.counterparty!==row.id)throw Error('royalty_witness');",
          "for(const leg of legs)if(!used.has(leg.id))issues.push({id:leg.id,reason:'unbound_royalty'});",
          "const paidCash=legs.filter(t=>t.reason==='manufacturing_license:pay').reduce((n,t)=>n-Number(t.amount),0),receivedCash=legs.filter(t=>t.reason==='manufacturing_license:receive').reduce((n,t)=>n+Number(t.amount),0),royaltyNet=receivedCash-paidCash;",
          "if(!Number.isSafeInteger(paidCash)||!Number.isSafeInteger(receivedCash)||royaltyNet!==0)issues.push({reason:'royalty_conservation'});",
          "return {paidCash,receivedCash,royaltyNet,verifiedRuns,issues};"
        ]
      }
    ],
    "terms": [
      [
        "manufacturing_license:pay",
        0,
        0
      ],
      [
        "manufacturing_license:receive",
        0,
        0
      ]
    ],
    "sha256": "a44d7776aad7f4c2cee236a3db27416176656d7c9646f071db9d1febc9962fc8",
    "revision": "5fb8ec516236ceb4456f1f38b0d19ac111c35087",
    "blob": "f468c041592c5ad77d5cf2cb39b3f4076dabca18"
  }
].map(freeze));
export function extractEnterpriseHelperReconciliations(invariants,helpers){
 if(typeof invariants!=='string'||!helpers||typeof helpers!=='object'||Array.isArray(helpers)||Object.keys(helpers).some(file=>!ENTERPRISE_HELPER_PROFILES.some(p=>p.file===file)))return [];
 const lines=normalize(invariants).split('\n'),exact=literal=>lines.flatMap((line,i)=>line.trim()===literal?[i]:[]),terms=[];
 for(const p of ENTERPRISE_HELPER_PROFILES){const raw=helpers[p.file];if(typeof raw!=='string')continue;const helper=normalize(raw);if(crypto.createHash('sha256').update(helper).digest('hex')!==p.sha256)continue;
 const imports=exact(p.import),calls=exact(p.call),pushes=exact(p.push);if(imports.length!==1||calls.length!==1||pushes.length!==1||imports[0]>=calls[0]||calls[0]>=pushes[0]||p.extraBindings.some(s=>{const rows=exact(s);return rows.length!==1||rows[0]<=calls[0]||rows[0]>=pushes[0];}))continue;
 const sections=p.sections.map(s=>{const start=helper.indexOf(s.start);if(start<0||helper.indexOf(s.start,start+1)!==-1)return null;const end=s.end===null?helper.length:helper.indexOf(s.end,start+s.start.length);if(end<0)return null;const body=helper.slice(start,end);if(s.anchors.some(a=>!body.includes(a))||s.queries.some(q=>{const n=body.indexOf(q);return n<0||body.indexOf(q,n+1)!==-1;}))return null;return {start,body};});if(sections.some(s=>!s))continue;
 for(const [reason,section,query]of p.terms){const s=sections[section],offset=s.start+s.body.indexOf(p.sections[section].queries[query]);terms.push({check:p.check,reason,file:p.file,line:helper.slice(0,offset).split('\n').length,bindingLine:pushes[0]+1,sourceSha256:p.sha256});}
 if(p.recordCheck){const r=p.recordCheck,s=sections[r.section],offset=s.start+s.body.indexOf(p.sections[r.section].queries[r.query]);for(const [reason]of p.terms)terms.push({check:r.check,reason,file:p.file,line:helper.slice(0,offset).split('\n').length,bindingLine:exact(r.push)[0]+1,sourceSha256:p.sha256});}
 }return terms;
}
