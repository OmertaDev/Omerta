import assert from 'node:assert/strict';import fs from 'node:fs';
import crypto from 'node:crypto';import vm from 'node:vm';
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

// Exercise the actual exported extractor with each changed helper admitted under its
// own TEST-only whole hash. This supplies no production profile or execution authority.
{
 const p=profiles.find(p=>p.file==='src/consignments.js'),helper=normalizeText(helpers[p.file]);
 assert.equal(p.end,'\n\n// N16/N17 proposal: fixed source-bound private contexts, no caller-installed adapters.\n');
 const actualExtractor='('+extract.toString()+')';
 const inside=(text,target,replacement)=>{const start=text.indexOf('export async function '+p.fn+'('),end=text.indexOf(p.end,start);assert(start>=0&&end>start);const body=text.slice(start,end);assert.equal(body.split(target).length,2,'Exact unique collector causal target');return text.slice(0,start)+body.replace(target,()=>replacement)+text.slice(end);};
 const admitted=(text,end=p.end)=>{const testProfiles=Object.freeze(profiles.map(profile=>profile===p?Object.freeze({...profile,end,sha256:crypto.createHash('sha256').update(normalizeText(text)).digest('hex')}):profile));const actual=vm.runInNewContext(actualExtractor,{crypto,normalizeText,NEXT_FIVE_HELPER_PROFILES:testProfiles},{timeout:1000});return actual(invariantSource,{...helpers,[p.file]:text});};
 const kept=text=>assert.deepEqual(Array.from(admitted(text),term=>[term.check,term.reason]),expected);
 const refused=text=>{assert.equal(admitted(text).some(term=>term.check===p.check),false);negatives++;};
 kept(helper);
 kept(helper.replaceAll('\n','\r\n'));
 const outside=helper+'\n// Additional query outside the closed collector: '+p.sql+'\n';kept(outside);
 assert.equal(extract(invariantSource,{...helpers,[p.file]:outside}).some(term=>term.check===p.check),false,'Unknown whole helper bytes never use TEST-only admission');negatives++;
 refused(inside(helper,'return issues;','await c.query('+JSON.stringify(p.sql)+',[]);return issues;'));
 const removedQuery=inside(helper,p.sql,p.sql.replace('SELECT id','SELECT removed_id'));
 refused(removedQuery);refused(removedQuery+'\n// Moved query outside collector: '+p.sql+'\n');
 const anchorChanges=[['row.host_character','row.owner_character'],['Number(row.price)-fee','Number(row.price)-fee+1'],['-Number(row.price)','-Number(row.price)-1'],["legs[i]?.currency!=='cash'","legs[i]?.currency==='cash'"],['Number(legs[i]?.amount)!==amount','Number(legs[i]?.amount)===amount']];
 for(const [from,to]of anchorChanges)refused(inside(helper,from,to));
 const movedAnchor=inside(helper,p.anchors[0],p.anchors[0].replace('row.host_character','row.owner_character'))+'\n// Moved anchor outside collector: '+p.anchors[0]+'\n';refused(movedAnchor);
 refused(inside(helper,'return issues;','return [];'));
 refused(helper.replace(p.end,'\n\n// Missing reviewed collector boundary\n'));
 refused(helper+p.end);
 for(const end of ['',null,{},'\n// unknown boundary\n']){assert.equal(admitted(helper,end).some(term=>term.check===p.check),false);negatives++;}
}

console.log('Next-five graph helper proof PASS:8 actual monetary helper-provenance terms; LF/CRLF; '+negatives+' import/call/result/order/duplicate/source/amount/party/reason/unknown causal refusals. Existing direct sum edges remain independently present; this test grants no native/gameplay/financial authority.');
