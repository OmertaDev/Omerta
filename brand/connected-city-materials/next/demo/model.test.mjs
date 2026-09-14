import assert from 'node:assert/strict';
import {test} from 'node:test';
import {allocate,workshop,evidenceGate} from './model.js';
test('fee allocations conserve the notional across allowed amounts and surge bounds',()=>{
 for(const amount of [.0001,1,1000,1000000])for(const surge of [0,.5,1]){
  const r=allocate(amount,surge);assert(Math.abs(r.portions.reduce((a,b)=>a+b,0)+r.extra+r.remainder-amount)<1e-8);assert(Math.abs(r.total-amount*(.09+surge/100))<1e-8);
 }
 for(const args of [[0,0],[-1,0],[1000001,0],[1,-.1],[1,1.1],[NaN,0],[1,NaN]])assert.throws(()=>allocate(...args));
});
test('salvage consumes the wreck once and craft requires and consumes its inputs',()=>{
 const s=workshop();assert.throws(()=>s.craft());s.salvage();assert.throws(()=>s.salvage());assert.deepEqual(s.craft(),{wreck:0,scrap:2,wire:2,parts:2,steel:1,cash:9700});assert.throws(()=>s.craft());
});
test('copies cannot create independence and inaccessible Foundry evidence cannot unlock the gate',()=>{
 assert.equal(evidenceGate(false,false,true).independent,1);assert.equal(evidenceGate(true,false,true).ready,false);assert.equal(evidenceGate(true,true,true).ready,true);assert.equal(evidenceGate(true,false,false).ready,false);assert.equal(evidenceGate(false,true,false).ready,false);
});
