import {build} from '../tools/graph.js';
import assert from 'node:assert/strict';import fs from 'node:fs';
import {NEXT_LAYER_HELPER_PROFILES as profiles,extractNextLayerHelperReconciliations as extract} from '../tools/next-layer-graph-helpers.js';
const invariants=fs.readFileSync(new URL('../src/invariants.js',import.meta.url),'utf8'),helpers=Object.fromEntries(profiles.map(p=>[p.file,fs.readFileSync(new URL('../'+p.file,import.meta.url),'utf8')]));
const normalized=x=>x.replace(/\r\n?/g,'\n');
const expected=profiles.flatMap(p=>[...p.terms.map(([reason])=>[p.check,reason]),...(p.recordCheck?p.terms.map(([reason])=>[p.recordCheck.check,reason]):[])]);assert.equal(expected.length,16);assert.equal(new Set(expected.map(t=>t[1])).size,11);assert.deepEqual(extract(invariants,helpers).map(t=>[t.check,t.reason]),expected);assert.deepEqual(extract(normalized(invariants).replaceAll('\n','\r\n'),Object.fromEntries(Object.entries(helpers).map(([k,v])=>[k,normalized(v).replaceAll('\n','\r\n')]))).map(t=>[t.check,t.reason]),expected);
let controls=0;const mutate=(text,old,fresh=old+'__unknown')=>{assert(text.includes(old),'Causal target exists: '+old);return text.replace(old,()=>fresh);};
for(const p of profiles){const helper=helpers[p.file],isolated={[p.file]:helper},absent=(inv,map=isolated)=>{assert(!extract(inv,map).some(t=>t.file===p.file));controls++;};assert(Object.isFrozen(p)&&Object.isFrozen(p.sections)&&Object.isFrozen(p.terms));assert.equal(extract(invariants,isolated).length,p.terms.length*(p.recordCheck?2:1));
 for(const binding of [p.import,p.call,p.push]){absent(mutate(invariants,binding));absent(mutate(invariants,binding,binding+'\n'+binding));}
 absent(mutate(invariants,p.push,p.push.replace(p.variable,'unboundResult')));absent(invariants.replace(p.call,'').replace(p.push,()=>p.push+'\n'+p.call));
 for(const extra of p.extraBindings){absent(mutate(invariants,extra));absent(mutate(invariants,extra,extra+'\n'+extra));absent(invariants.replace(extra,'').replace(p.push,()=>p.push+'\n'+extra));}
 for(const section of p.sections)for(const literal of [section.start,...section.queries,...section.anchors])absent(invariants,{[p.file]:mutate(helper,literal)});
 for(const [reason]of p.terms)absent(invariants,{[p.file]:mutate(helper,"'"+reason+"'")});
 absent(invariants,{[p.file]:helper+'\n// unknown source'});absent(invariants,{[p.file]:undefined});absent(invariants,{[p.file]:42});
}
for(const map of [null,[],{unknown:'source'}]){assert.deepEqual(extract(invariants,map),[]);controls++;}assert.deepEqual(extract(null,helpers),[]);controls++;
// A record-returning vault helper is never treated as a bare issue array.
const vault=profiles.find(p=>p.fn==='customerVaultAccounting');for(const changed of [invariants.replace('vault.issues.length','vault.length'),invariants.replace(vault.extraBindings[0],''),invariants.replace(vault.extraBindings[0],vault.extraBindings[0].replace('vault.reserve','vault.issues.length'))]){assert(!extract(changed,helpers).some(t=>t.check===vault.check));controls++;}
const terms=extract(invariants,helpers);for(const t of terms){assert(t.line>0&&t.bindingLine>0);assert.match(t.sourceSha256,/^[a-f0-9]{64}$/);}
console.log('Next-layer graph helper unit PASS:11 distinct monetary reasons/16 actual source-bound edges; '+controls+' import/call/result/order/duplicate/source/amount/party/currency/reason/unknown causal refusals; vault record return preserved. No native/gameplay/financial qualification.');

const graph=build();for(const term of terms)assert(graph.edges.some(e=>e.type==='RECONCILES'&&e.from==='Check:'+term.check&&e.to==='Reason:'+term.reason&&e.prov.file===term.file&&e.prov.reviewedSha256===term.sourceSha256&&e.prov.binding.file==='src/invariants.js'));console.log('Actual graph build contains all16 next-layer source-bound monetary edges PASS');
