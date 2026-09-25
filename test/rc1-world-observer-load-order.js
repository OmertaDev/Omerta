// No database is opened. Proves the exact canonical observer import dependency
// requires worker instrumentation first; the native world test exercises it.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const results = [];
for (const installedFirst of [false, true]) {
  const script = `import assert from 'node:assert/strict';
    import {createWorkerSchedule,installWorkerInstrumentation,makeWorkerDatabase} from './tools/rc1-native-worker.js';
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
    } finally {seam.restore();}`;
  results.push(JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    encoding: 'utf8', env: { ...process.env, DATABASE_URL: 'postgres://postgres@127.0.0.1:1/no_database' },
  })));
}
assert.deepEqual(results, [{ installedFirst: false, pools: 0, databaseSourceInstrumented: false },
  { installedFirst: true, pools: 1, databaseSourceInstrumented: true }]);
console.log('PASS canonical observer load ordering: cached DB rejected; original source instrumented before pool admission; zero database connections');
