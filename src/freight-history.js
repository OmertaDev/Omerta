import crypto from 'node:crypto';
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
// Structural history only; canonical cash/GIN books remain authoritative.
export async function collectFreightHistoryIssues(c){
 const issues=[],rows=(await c.query('SELECT * FROM freight_consolidations ORDER BY id')).rows;
 for(const b of rows){const bad=reason=>issues.push({batchId:b.id,reason}),m=b.manifest;
  if(!m||hash(m)!==b.manifest_hash||!Array.isArray(m.entries)||m.entries.length!==2){bad('manifest');continue;}
  const e=m.entries;
  if(m.supplierCharacter!==b.supplier_character||e[0].buyerCharacter!==b.buyer_a_character||e[0].buyerAccount!==b.buyer_a_account||e[1].buyerCharacter!==b.buyer_b_character||e[1].buyerAccount!==b.buyer_b_account||new Set([b.supplier_character,...e.map(v=>v.buyerCharacter)]).size!==3||new Set([b.supplier_account,...e.map(v=>v.buyerAccount)]).size!==3||new Set(e.map(v=>v.orderId)).size!==2||new Set(e.map(v=>v.commitmentId)).size!==2||new Set(e.map(v=>v.depotId)).size!==2)bad('original_bindings');
  if(!Number.isSafeInteger(m.quantity)||m.quantity<2||m.quantity>8||e.reduce((n,v)=>n+v.quantity,0)!==m.quantity||m.travelCommitmentId!==e[0].commitmentId||e[0].allocatedTravelCash!==m.travelCost||e[1].allocatedTravelCash!==0)bad('quantity_or_travel');
  const accepts=(await c.query('SELECT * FROM freight_consolidation_acceptances WHERE batch_id=$1',[b.id])).rows;
  if(accepts.length>2||accepts.some(a=>e.filter(v=>v.buyerAccount===a.buyer_account&&v.buyerCharacter===a.buyer_character&&v.orderId===a.order_id&&v.commitmentId===a.commitment_id&&a.manifest_hash===b.manifest_hash).length!==1))bad('acceptance_binding');
  if(['ready','completed'].includes(b.state)&&accepts.length!==2)bad('missing_consent');
  if(b.state==='completed'){const r=b.receipt;
   if(!r||r.batchId!==b.id||r.manifestHash!==b.manifest_hash||r.revision!==b.revision||r.state!=='completed'||r.totalDelivered!==m.quantity||r.travel?.chargedCommitmentId!==m.travelCommitmentId||r.travel?.cost!==m.travelCost||r.travel?.loc!==m.destination||!Array.isArray(r.handoffs)||r.handoffs.length!==2){bad('completion_binding');continue;}
   if(r.handoffs.some((h,i)=>h.orderId!==e[i].orderId||h.commitmentId!==e[i].commitmentId||h.quantity!==e[i].quantity||h.receipt?.delivered!==e[i].quantity||h.receipt?.gross!==e[i].quantity*e[i].unitPrice||h.receipt?.earned+h.receipt?.take!==h.receipt?.gross)||r.earned!==r.handoffs.reduce((n,h)=>n+h.receipt.earned,0))bad('completion_amounts');
  }else if(b.receipt!==null)bad('unexpected_completion');
 }
 return issues;
}
