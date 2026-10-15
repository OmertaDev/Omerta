import assert from 'node:assert/strict';import fs from 'node:fs';
import {build,normalizeText,NEXT_FIVE_HELPER_PROFILES as profiles,extractNextFiveHelperReconciliations as extract}from'../tools/graph.js';
const invariantSource=fs.readFileSync(new URL('../src/invariants.js',import.meta.url),'utf8');const helpers=Object.fromEntries(profiles.map(p=>[p.file,fs.readFileSync(new URL('../'+p.file,import.meta.url),'utf8')]));
const expected=[['consignment sale books','consignment:purchase'],['consignment sale books','consignment:proceeds'],['consignment sale books','consignment:host_fee'],['commissioned crafting canonical sources','commissioned_crafting:reserve'],['commissioned crafting canonical sources','commissioned_crafting:fee'],['commissioned crafting canonical sources','commissioned_crafting:refund'],['picking packing paid custody books','picking_packing:pay'],['picking packing paid custody books','picking_packing:receive']];
const terms=extract(invariantSource,helpers);assert.deepEqual(terms.map(t=>[t.check,t.reason]),expected);assert.deepEqual(extract(normalizeText(invariantSource).replaceAll('\n','\r\n'),Object.fromEntries(Object.entries(helpers).map(([k,v])=>[k,normalizeText(v).replaceAll('\n','\r\n')]))).map(t=>[t.check,t.reason]),expected);
const graph=build();for(const term of terms){assert(graph.edges.some(e=>e.type==='RECONCILES'&&e.from==='Check:'+term.check&&e.to==='Reason:'+term.reason&&e.prov.file===term.file&&e.prov.reviewedSha256===term.sourceSha256&&e.prov.binding.file==='src/invariants.js'),'Actual graph lacks source-bound helper edge '+term.reason);assert(term.line>0&&term.bindingLine>0);}
let negatives=0;const mutate=(s,a,b=a+'__unknown')=>{assert(s.includes(a),'Exact causal target exists');const changed=s.replace(a,()=>b);assert.notEqual(changed,s);return changed;};
for(const p of profiles){assert(Object.isFrozen(p)&&Object.isFrozen(p.reasons)&&Object.isFrozen(p.anchors));const helper=helpers[p.file],isolated={[p.file]:helper};assert.equal(extract(invariantSource,isolated).length,p.reasons.length);const absent=(inv,map)=>{assert.equal(extract(inv,map).some(t=>t.check===p.check),false);negatives++;};
 for(const target of [p.import,p.call,p.push])absent(mutate(invariantSource,target),isolated);
 absent(mutate(invariantSource,p.push,p.push.replace(p.variable,'unboundIssues')),isolated);
 absent(mutate(invariantSource,p.call,p.call+'\n'+p.call),isolated);absent(mutate(invariantSource,p.import,p.import+'\n'+p.import),isolated);absent(mutate(invariantSource,p.push,p.push+'\n'+p.push),isolated);
 absent(invariantSource.replace(p.call,'').replace(p.push,()=>p.push+'\n'+p.call),isolated);
 for(const binding of p.extraBindings){absent(invariantSource.replace(binding,'').replace(p.push,()=>p.push+'\n'+binding),isolated);absent(mutate(invariantSource,binding),isolated);absent(mutate(invariantSource,binding,binding+'\n'+binding),isolated);}
 for(const literal of [p.sql,...p.anchors,...p.reasons.map(r=>"'"+r+"'")])absent(invariantSource,{[p.file]:mutate(helper,literal)});
 absent(invariantSource,{[p.file]:helper+'\n// unknown helper bytes'});absent(invariantSource,{[p.file]:undefined});
}
assert.deepEqual(extract(invariantSource,{unknown:'unreviewed helper'}),[]);negatives++;
console.log('Next-five graph helper proof PASS:8 actual monetary helper-provenance terms; LF/CRLF; '+negatives+' import/call/result/order/duplicate/source/amount/party/reason/unknown causal refusals. Existing direct sum edges remain independently present; this test grants no native/gameplay/financial authority.');
