import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL('../public/player-experience.js',import.meta.url),'utf8'), context);
const x=context.window.PlayerExperience;
assert.equal(x.nextUnlock({level:2},[{id:'a',name:'A',lvl:3},{id:'b',name:'B',lvl:8}]).level,3);
assert.equal(x.nextUnlock({level:20},[{id:'a',name:'A',lvl:3}]),null);
assert.equal(x.nextUnlock({level:2},[]),null);
const statuses=x.recovery({jailSeconds:60,hospSeconds:120,safeSeconds:180});
assert.equal(statuses.length,3);
assert.equal(statuses[0].tab,'pen');
assert.equal(statuses[1].tab,'life','hospital recovery opens the tab with the Doc');
assert.equal(x.recovery({}).length,0);
const snapshotAt=1700000000000;
const readiness=(me,at=snapshotAt,now=snapshotAt)=>JSON.parse(JSON.stringify(x.actionReadiness(me,at,now)));
const clockOwner=Object.freeze({id:'current-owner',gtaSeconds:40,trainSeconds:0,heistSeconds:90,missionSeconds:0,jailSeconds:0});
assert.deepEqual(readiness(clockOwner),[
  {label:'Car theft',tab:'garage',seconds:40,state:'waiting'},
  {label:'Training',tab:'streets',seconds:0,state:'review'},
  {label:'Heists',tab:'scores',seconds:90,state:'waiting'},
  {label:'Missions',tab:'start',seconds:0,state:'review'},
]);
assert.equal(readiness(clockOwner,snapshotAt,snapshotAt+1)[0].seconds,40,'round up a partial remaining second');
assert.equal(readiness(clockOwner,snapshotAt,snapshotAt+39999)[0].seconds,1);
assert.equal(readiness(clockOwner,snapshotAt,snapshotAt+40000)[0].state,'refresh','locally cleared clocks require an authoritative refresh');
assert.equal(readiness(clockOwner,snapshotAt,snapshotAt+40000)[0].seconds,0);
assert.equal(readiness(clockOwner,snapshotAt,snapshotAt+40001)[1].state,'review','an initially clear clock remains advisory');
assert.equal(readiness(clockOwner,snapshotAt,snapshotAt+60000)[2].seconds,30,'the sixty-second freshness boundary is inclusive');
assert(readiness(clockOwner,snapshotAt,snapshotAt+60001).every(item=>item.state==='refresh' && item.seconds===null));
for (const at of [null,undefined,'',NaN,Infinity,-1,snapshotAt+1001]) {
  const items=JSON.parse(JSON.stringify(x.actionReadiness(clockOwner,at,snapshotAt)));
  assert(items.every(item=>item.state==='refresh' && item.seconds===null),'missing, invalid or excessively future snapshots require refresh');
}
assert.equal(readiness(clockOwner,snapshotAt+1000,snapshotAt)[0].seconds,40,'small clock skew cannot extend the duration');
assert(readiness(clockOwner,snapshotAt,NaN).every(item=>item.state==='refresh'));
for (const duration of [null,undefined,'',' ',NaN,Infinity,-1,false,{},[]]) {
  const items=readiness({...clockOwner,gtaSeconds:duration});
  assert.equal(items[0].state,'refresh','unknown clock values cannot mean clear');
  assert.equal(items[0].seconds,null);
  assert.equal(items[1].state,'review','one unknown clock does not invalidate other known clocks');
}
assert.equal(readiness({...clockOwner,gtaSeconds:'40'},snapshotAt,snapshotAt+1000)[0].seconds,39);
for (const owner of [null,undefined,{}, {...clockOwner,id:''}, {...clockOwner,id:' '}, {...clockOwner,id:12}])
  assert.deepEqual(readiness(owner),[],'no action strip without a current owner identity');
const jailedOwner=Object.freeze({...clockOwner,jailSeconds:15});
assert(readiness(jailedOwner).every(item=>item.state==='blocked' && item.message==='In jail' && item.seconds===null));
assert(readiness(jailedOwner,snapshotAt,snapshotAt+60001).every(item=>item.state==='refresh' && !item.message),'stale jail status cannot be presented as current');
for (const extra of [{hospSeconds:30},{safeSeconds:30},{jailSeconds:null},{jailSeconds:undefined}])
  assert.equal(readiness({...clockOwner,...extra})[1].state,'review','different action rules do not imply a global status gate');
assert.equal(clockOwner.gtaSeconds,40,'reading and decaying a clock never mutates its snapshot');
assert.equal(jailedOwner.jailSeconds,15);
assert.equal(x.waiting({gtaSeconds:40,heistSeconds:0,trainSeconds:0,missionSeconds:0}).clocks[0].seconds,40);
assert.equal(x.waiting({gtaSeconds:0}).clocks.length,0);
assert(!x.waiting({gtaSeconds:40,heistSeconds:30,trainSeconds:20,missionSeconds:10}).destinations.some(d=>d.tab==='garage'));
const summary=x.production([{incomePerHr:100,upkeepPerHr:10,pending:50,upkeepOwed:4,cold:false},{incomePerHr:200,upkeepPerHr:20,pending:80,upkeepOwed:8,cold:true}]);
assert.equal(summary.activeIncomePerHr,100,'cold production is not advertised as current income');
assert.equal(summary.pending,130);
assert.equal(summary.upkeepOwed,12);
assert.equal(summary.cold,1);
assert.equal(x.production([]).pending,0);
assert(x.source('tap',30).includes('disinformation'));
assert(x.source('informant',30).includes('bypasses'));
assert.equal(x.source('tap',0),'Expired report. Refresh before use.');
assert.equal(x.roleLabel('driver',{driver:'speed'}),'driver (speed)');
assert.equal(x.blockerLabel('jailed'),'in jail');
assert.equal(x.blockerLabel('unrecognized'),'not ready');
console.log('player experience client behavior tests passed');
