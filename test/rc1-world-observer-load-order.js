// No database is opened. Proves the exact canonical observer import dependency
// requires worker instrumentation first, using exact historical DB source.
// Current release source remains outside the historical loader's admission.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const results = [];
for (const installedFirst of [false, true]) {
  const script = `import assert from 'node:assert/strict';
    import {registerHooks} from 'node:module';
    import {historicalWorkerDatabaseSource} from './test/lib/rc1-historical-worker-source.js';
    import {createWorkerSchedule,installWorkerInstrumentation,makeWorkerDatabase} from './tools/rc1-native-worker.js';
    const target=new URL('./src/db.js','file://'+process.cwd().replaceAll('\\\\','/')+'/').href;
    const supplied=historicalWorkerDatabaseSource('current');
    const fixture=registerHooks({load(url,context,nextLoad){const result=nextLoad(url,context);return url===target?{...result,source:supplied}:result;}});
    ${installedFirst ? '' : "await import('./tools/rc1-world-resource-observer.js');"}
    const controller=createWorkerSchedule({start:0,setClock(){}});
    const seam=installWorkerInstrumentation(controller,{namespace:'rc1_worker_import_control'});
    ${installedFirst ? "await import('./tools/rc1-world-resource-observer.js');" : ''}
    const sentinel=Error('CONTROL_REACHED_INSTRUMENTED_POOL_WITHOUT_DATABASE');let pools=0;
    controller.Pool=class {constructor(){pools++;throw sentinel;}};
    try {
      await assert.rejects(makeWorkerDatabase(controller),error=>${installedFirst ? 'error===sentinel' : '/Cached uninstrumented db.js/.test(error.message)'});
      assert.equal(pools,${installedFirst ? 1 : 0});
      console.log(JSON.stringify({installedFirst:${installedFirst},pools,databaseSourceInstrumented:controller.transformations.some(t=>t.file==='src/db.js')}));
    } finally {seam.restore();fixture.deregister();await controller.close();}`;
  results.push(JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    encoding: 'utf8', env: { ...process.env, DATABASE_URL: 'postgres://postgres@127.0.0.1:1/no_database' },
  })));
}
assert.deepEqual(results, [{ installedFirst: false, pools: 0, databaseSourceInstrumented: false },
  { installedFirst: true, pools: 1, databaseSourceInstrumented: true }]);
console.log('PASS canonical observer load ordering: cached DB rejected; original source instrumented before pool admission; zero database connections');

for (const sourceCase of ['release-c2', 'release-c2-crlf', 'unknown-release-c2', 'raw-current', 'raw-current-crlf', 'unknown-raw-current']) {
  execFileSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import fs from 'node:fs';
    import {assertDeedQuestSourceTransfer} from './tools/deed-quest-source-transfer.js';
    import {registerHooks} from 'node:module';
    import {historicalWorkerDatabaseSource} from './test/lib/rc1-historical-worker-source.js';
    import {createWorkerSchedule,installWorkerInstrumentation,makeWorkerDatabase} from './tools/rc1-native-worker.js';
    const sourceCase=${JSON.stringify(sourceCase)};
    const target=new URL('./src/db.js','file://'+process.cwd().replaceAll('\\\\','/')+'/').href;
    let supplied=historicalWorkerDatabaseSource('release-c2');
    const actual=fs.readFileSync('./src/db.js','utf8');
    assert.equal(assertDeedQuestSourceTransfer('src/db.js',actual).baselineText,supplied);
    if(sourceCase.includes('raw-current')) supplied=actual;
    if(sourceCase==='raw-current-crlf') supplied=supplied.replaceAll('\\r\\n','\\n');
    if(sourceCase.endsWith('-crlf')) supplied=supplied.replaceAll('\\n','\\r\\n');
    if(sourceCase.startsWith('unknown')) supplied+='\\n// unsupported database source change\\n';
    const fixture=registerHooks({load(url,context,nextLoad){const result=nextLoad(url,context);return url===target?{...result,source:supplied}:result;}});
    const controller=createWorkerSchedule({start:0,setClock(){}});
    const seam=installWorkerInstrumentation(controller,{namespace:'rc1_worker_release_rejection'});
    let pools=0;controller.Pool=class {constructor(){pools++;throw Error('Release source reached pool');}};
    try {
      await assert.rejects(import('./tools/rc1-world-resource-observer.js'),/Pinned production source changed: src\\/db.js/);
      await assert.rejects(makeWorkerDatabase(controller),/Pinned production source changed: src\\/db.js/);
      assert.equal(pools,0);assert.equal(controller.pools.length,0);assert.equal(controller.transformations.length,0);
    } finally {seam.restore();fixture.deregister();await controller.close();}
  `], { stdio: 'pipe', env: { ...process.env, DATABASE_URL: 'postgres://postgres@127.0.0.1:1/no_database' } });
}
console.log('PASS: observer-first historical instrumentation rejects exact release C2, CRLF and tampering before any pool or transformation');
console.log('PASS: observer-first actual current Deed raw, whole-CRLF and tampering refuse before any pool or transformation');
