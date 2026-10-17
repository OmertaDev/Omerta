import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fixture } from './merchantloyalty-fixture.js';
const f=await fixture();try{
  const sourceURL=new URL('../src/merchantloyalty.js',import.meta.url),source=fs.readFileSync(sourceURL,'utf8'),needle="import * as C from './consignments.js';";assert.equal(source.split(needle).length,2);
  // Deliberately missing only the fixed N01 capability in a standalone module; canonical imports,
  // Items branding, DB and all action code remain real. This remains meaningful after integration.
  for(const missing of ['consignmentEconomyListing','consignmentEconomySaleWitness','buyConsignmentWithEconomyContext','assertFreshConsignmentSaleProof']){
    let adapted=source.replace(needle,`import * as CanonicalC from '${new URL('../src/consignments.js',import.meta.url).href}'; const C=Object.freeze(Object.fromEntries(Object.entries(CanonicalC).filter(([name])=>name!=='${missing}')));`);
    for(const path of ['./game.js','./items.js'])adapted=adapted.replace(`'${path}'`,`'${new URL(path,sourceURL).href}'`);
    const standalone=await import('data:text/javascript;base64,'+Buffer.from(adapted).toString('base64')),before=await f.state();
    await assert.rejects(f.tx(c=>standalone.merchantLoyaltyAction(c,'owner','create',f.programTerms,'closed-'+missing)),/integration_required/);assert.deepEqual(await f.state(),before);
  }
  const before=await f.state();await assert.rejects(f.tx(c=>f.L.assertMerchantLoyaltyPurchaseScope(c,{},'sale','0'.repeat(64),'buyer')),/purchase_scope/);assert.deepEqual(await f.state(),before);
  console.log('Merchant loyalty standalone missing-capability controls and forged private scope refuse without metadata/money/UID effects PASS. Source SHA256 '+crypto.createHash('sha256').update(source).digest('hex')+'; only named N01 import adapter changed. Component boundary only.');
}finally{await f.pool.end();}
