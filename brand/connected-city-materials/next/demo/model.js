export function allocate(amount,surge){
 if(!Number.isFinite(amount)||amount<=0||amount>1000000||!Number.isFinite(surge)||surge<0||surge>1)throw new Error('Enter an amount above 0 and at most 1,000,000; surge must be between 0 and 1%.');
 const portions=[2,1.6,2.4,3].map(rate=>amount*rate/100);
 const extra=amount*surge/100;
 return {portions,extra,total:amount*.09+extra,remainder:amount*.91-extra};
}
export function workshop(){
 let state={wreck:1,scrap:0,wire:0,parts:0,steel:0,cash:10000};
 return {read:()=>({...state}),salvage(){if(!state.wreck)throw new Error('The wreck has already been consumed. Reset to start another example.');state={...state,wreck:0,scrap:6,wire:2,parts:2};return this.read();},craft(){if(state.scrap<4||state.cash<300)throw new Error('Crafting requires 4 scrap steel and 300 game cash.');state={...state,scrap:state.scrap-4,steel:state.steel+1,cash:state.cash-300};return this.read();}};
}
export function evidenceGate(foundryDiscovered,foundryShared,duplicate){
 const visible=['docks.manifest'];if(duplicate)visible.push('docks.manifest');if(foundryDiscovered&&foundryShared)visible.push('foundry.impression');
 const origins=new Set(visible);return {visible,independent:origins.size,ready:origins.has('docks.manifest')&&origins.has('foundry.impression')};
}
