// Exact current enterprise source transfer; native, migration and release qualification remain separate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {commerceSourceBaseline} from '../tools/commerce-source-compatibility.js';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {ENTERPRISE_SOURCE_REVISION,ENTERPRISE_SOURCE_PREDECESSOR,ENTERPRISE_SOURCE_DOMAINS,ENTERPRISE_OWNED_CURRENT_SOURCES,assertEnterpriseSourceTransfer,assertEnterpriseOwnedSource,enterpriseSourceBaseline} from '../tools/enterprise-source-compatibility.js';
assert.deepEqual(process.argv.slice(2),[], 'Complete canonical source test only');
const root=fileURLToPath(new URL('../',import.meta.url)),git=(...a)=>execFileSync('git',a,{cwd:root,encoding:'utf8',maxBuffer:16e6}),read=f=>{const raw=commerceSourceBaseline(f,fs.readFileSync(path.join(root,f),'utf8'));if(Object.hasOwn(ENTERPRISE_SOURCE_DOMAINS,f))assertEnterpriseSourceTransfer(f,raw);else assertEnterpriseOwnedSource(f,raw);return raw.replaceAll('\r\n','\n');},hash=t=>crypto.createHash('sha256').update(t).digest('hex'),blob=t=>crypto.createHash('sha1').update('blob '+Buffer.byteLength(t)+'\0').update(t).digest('hex');
const rows=[],check=(name,fn)=>{fn();rows.push(name);},crlf=t=>t.replaceAll('\n','\r\n'),mixed=t=>t.replace('\n','\r\n');
check('exact current phase identifiers',()=>{assert.equal(ENTERPRISE_SOURCE_REVISION,'75edcd9c3d37382adf32754c1443c91f7903083f');assert.equal(ENTERPRISE_SOURCE_PREDECESSOR,'4ca724fcf9a45632ed8df3016b0b6d96aaa3e111');assert.equal(Object.keys(ENTERPRISE_SOURCE_DOMAINS).length,31);assert.equal(Object.keys(ENTERPRISE_OWNED_CURRENT_SOURCES).length,23);});
for(const[file,p]of Object.entries(ENTERPRISE_SOURCE_DOMAINS)){const text=read(file),base=assertEnterpriseSourceTransfer(file,text).baselineText;assert.equal(text,git('show',ENTERPRISE_SOURCE_REVISION+':'+file));assert.equal(base,git('show',ENTERPRISE_SOURCE_PREDECESSOR+':'+file));assert.equal(git('rev-parse',ENTERPRISE_SOURCE_REVISION+':'+file).trim(),p.currentBlob);assert.equal(git('rev-parse',ENTERPRISE_SOURCE_PREDECESSOR+':'+file).trim(),p.baselineBlob);
 check(file+' whole LF and unique literal inverse restore',()=>{assert.equal(hash(text),p.currentSha256);assert.equal(blob(text),p.currentBlob);assert.equal(hash(base),p.baselineSha256);assert.equal(blob(base),p.baselineBlob);let working=text;for(const h of p.inverses){assert.equal(working.split(h.current).length,2);working=working.replace(h.current,()=>h.baseline);}assert.equal(working,base);assert.equal(enterpriseSourceBaseline(file,text),base);});
 check(file+' whole CRLF',()=>assert.equal(assertEnterpriseSourceTransfer(file,crlf(text)).baselineText,base));
 check(file+' whole baseline remains unchanged for historical downstream',()=>assert.equal(enterpriseSourceBaseline(file,base),base));
 check(file+' changed or duplicated source refuses',()=>{for(const changed of[text+'\n',text+'// foreign source\n',text+p.inverses[0].current,text.slice(1),text.replace(p.inverses[0].current,p.inverses[0].baseline)])assert.throws(()=>assertEnterpriseSourceTransfer(file,changed),/source drift/);});
 check(file+' mixed and bare CR refuse',()=>{assert.throws(()=>assertEnterpriseSourceTransfer(file,mixed(text)),/endings/);assert.throws(()=>enterpriseSourceBaseline(file,mixed(text)),/endings/);assert.throws(()=>assertEnterpriseSourceTransfer(file,text.replace('\n','\r')),/endings/);});
 check(file+' non-string and relabel refuse',()=>{assert.throws(()=>assertEnterpriseSourceTransfer(file,Buffer.from(text)));assert.throws(()=>assertEnterpriseSourceTransfer('foreign/'+file,text),/Unknown enterprise source domain/);});
 check(file+' immutable domain and inverse data',()=>{assert(Object.isFrozen(p)&&Object.isFrozen(p.inverses)&&p.inverses.every(Object.isFrozen));assert.throws(()=>{p.currentSha256='0'.repeat(64);},TypeError);});
}
for(const[file,p]of Object.entries(ENTERPRISE_OWNED_CURRENT_SOURCES)){const text=read(file);
 check(file+' whole current LF and CRLF only',()=>{assert.equal(hash(text),p.currentSha256);assert.equal(blob(text),p.currentBlob);assert.equal(assertEnterpriseOwnedSource(file,text).sourceRevision,ENTERPRISE_SOURCE_REVISION);assert.equal(assertEnterpriseOwnedSource(file,crlf(text)).sourceRevision,ENTERPRISE_SOURCE_REVISION);assert(!Object.hasOwn(p,'baselineSha256')&&!Object.hasOwn(p,'baselineBlob'));});
 check(file+' changed mixed or relabeled current refuses',()=>{assert.throws(()=>assertEnterpriseOwnedSource(file,text+'\n'),/source drift/);assert.throws(()=>assertEnterpriseOwnedSource(file,mixed(text)),/endings/);assert.throws(()=>assertEnterpriseOwnedSource('foreign/'+file,text),/Unknown enterprise owned current source/);assert.throws(()=>assertEnterpriseSourceTransfer(file,text),/Unknown enterprise source domain/);});
 check(file+' immutable current pin',()=>{assert(Object.isFrozen(p));assert.throws(()=>{p.currentBlob='0'.repeat(40);},TypeError);});
}
check('closed own-key membership and unknown passthrough',()=>{for(const key of['__proto__','constructor','toString','../schema.sql']){assert.throws(()=>assertEnterpriseSourceTransfer(key,'x'),/Unknown/);assert.throws(()=>assertEnterpriseOwnedSource(key,'x'),/Unknown/);assert.equal(enterpriseSourceBaseline(key,'x'),'x');}assert(Object.isFrozen(ENTERPRISE_SOURCE_DOMAINS)&&Object.isFrozen(ENTERPRISE_OWNED_CURRENT_SOURCES));});
console.log(JSON.stringify({phase:'CURRENT_SOURCE_TRANSFER_PURE_ONLY',assertions:rows.length,names:rows,postgres:false,native:false,release:false}));
