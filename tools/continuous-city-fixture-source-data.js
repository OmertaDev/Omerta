// Frozen whole-file source evidence only; no runtime, native, migration, or release admission.
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
// Actual authored reader bytes are pinned independently of the immutable GUI revision.
export const CONTINUOUS_CITY_FIXTURE_PREDECESSOR = "5cdf3f1bfdeb6f06655ae5d49387197eea86b5c0";
export const CONTINUOUS_CITY_FIXTURE_DOMAINS = freeze({
  "test/deed-quest-source-compatibility.js": {
    "currentSha256": "a1ec231aa1faead389b8c6c1310abad347e8d22ac2cf77dc13a522cbc67223a4",
    "currentBlob": "75cd4bc5992f6537646ff9eb9d7ee4161f3195a1",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "a1ec231aa1faead389b8c6c1310abad347e8d22ac2cf77dc13a522cbc67223a4",
      "crlf": "fcc7da07bdb0c4e3d8bd0b3f11e69b14c66110a8a693e5c56888b798da4d46da"
    },
    "predecessorAbsent": false,
    "baselineSha256": "c2a92900fae60d081e1d90fa9432c45ffb5e6d7ff2baf4ef4b05a2bed1aaee79",
    "baselineBlob": "f513b0f17c15e5913d82ba9ac6c394521fc1830e",
    "baselineMode": "100644",
    "inverses": [
      {
        "current": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\n// New exact source evidence composes with historical guards; it never revises their pins.\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\n",
        "baseline": "// New exact source evidence composes with historical guards; it never revises their pins.\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\n"
      },
      {
        "current": "  'test/gates.js', '.github/workflows/ci.yml', 'test/phase2-postgres.js']);\nlet hunks = 0, negatives = 0;\nfor (const [file, pin] of Object.entries(DEED_QUEST_SOURCE_DOMAINS)) {\n  const raw = marketOverDeedSourceBaseline(file, cityActivitySourceBaseline(file, (hasEnterpriseOverRootSource(file) ? enterpriseOverRootSourceBaseline(file, continuousCityHistoricalInput(file, fs.readFileSync(file, 'utf8'))) : continuousCityHistoricalInput(file, fs.readFileSync(file, 'utf8'))))), current = lf(raw);\n  assert(raw === current || raw === current.replaceAll('\\n', '\\r\\n'), 'Working candidate has uniform line endings');\n  const predecessor = git('show', `${DEED_QUEST_SOURCE_PREDECESSOR}:${file}`);\n  assert.equal(hash(current), pin.currentSha256);\n",
        "baseline": "  'test/gates.js', '.github/workflows/ci.yml', 'test/phase2-postgres.js']);\nlet hunks = 0, negatives = 0;\nfor (const [file, pin] of Object.entries(DEED_QUEST_SOURCE_DOMAINS)) {\n  const raw = marketOverDeedSourceBaseline(file, cityActivitySourceBaseline(file, (hasEnterpriseOverRootSource(file) ? enterpriseOverRootSourceBaseline(file, fs.readFileSync(file, 'utf8')) : fs.readFileSync(file, 'utf8')))), current = lf(raw);\n  assert(raw === current || raw === current.replaceAll('\\n', '\\r\\n'), 'Working candidate has uniform line endings');\n  const predecessor = git('show', `${DEED_QUEST_SOURCE_PREDECESSOR}:${file}`);\n  assert.equal(hash(current), pin.currentSha256);\n"
      },
      {
        "current": "    nextLayerEnterpriseCurrent.replace(current, () => current.replace(/\\S/, '?')));\nfor (const raw of nextLayerEnterpriseRefusals) assert.throws(() => inspectNextLayerEnterpriseReader(raw));\nconsole.log('Next-layer Enterprise reader inspection PASS: 2 line-ending positives, '+nextLayerEnterpriseRefusals.length+' refusing controls; source text only');\nconst nextLayerTest = inspectNextLayerActivityReader(inspectNextLayerJointReader(inspectNextLayerEnterpriseReader(continuousCityHistoricalInput('test/next-layer-source-compatibility.js', fs.readFileSync('test/next-layer-source-compatibility.js', 'utf8')))))\n  .replace(\"import {deedQuestSourceBaseline} from '../tools/deed-quest-source-transfer.js';\\n\", '')\n  .replace(\"deedQuestSourceBaseline(file,fs.readFileSync(file,'utf8'))\", \"fs.readFileSync(file,'utf8')\");\nassert.equal(nextLayerTest, git('show', `${DEED_QUEST_SOURCE_PREDECESSOR}:test/next-layer-source-compatibility.js`),\n",
        "baseline": "    nextLayerEnterpriseCurrent.replace(current, () => current.replace(/\\S/, '?')));\nfor (const raw of nextLayerEnterpriseRefusals) assert.throws(() => inspectNextLayerEnterpriseReader(raw));\nconsole.log('Next-layer Enterprise reader inspection PASS: 2 line-ending positives, '+nextLayerEnterpriseRefusals.length+' refusing controls; source text only');\nconst nextLayerTest = inspectNextLayerActivityReader(inspectNextLayerJointReader(inspectNextLayerEnterpriseReader(fs.readFileSync('test/next-layer-source-compatibility.js', 'utf8'))))\n  .replace(\"import {deedQuestSourceBaseline} from '../tools/deed-quest-source-transfer.js';\\n\", '')\n  .replace(\"deedQuestSourceBaseline(file,fs.readFileSync(file,'utf8'))\", \"fs.readFileSync(file,'utf8')\");\nassert.equal(nextLayerTest, git('show', `${DEED_QUEST_SOURCE_PREDECESSOR}:test/next-layer-source-compatibility.js`),\n"
      }
    ]
  },
  "test/economy-release-composition.js": {
    "currentSha256": "8a43357f0052859cb285ec3eeff5a469e17a36bd6704123ead1a30583638f4ac",
    "currentBlob": "55d4c4f66e9397b7963af2c6459ae2c6236ffa1d",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "8a43357f0052859cb285ec3eeff5a469e17a36bd6704123ead1a30583638f4ac",
      "crlf": "43073c7407263079cff6320f83427d8927ca7bbdfb5dbc84eb5f2f1d1cabebfb"
    },
    "predecessorAbsent": false,
    "baselineSha256": "b3ed2f55eee70246a84995140bdcd39605e5ae35abd283207e2c6a09516b5070",
    "baselineBlob": "a20935a4d9ed9d20e20fb2d3b65e0a109b8c100c",
    "baselineMode": "100644",
    "inverses": [
      {
        "current": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {nextFiveSourceBaseline} from '../tools/next-five-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\n",
        "baseline": "import {nextFiveSourceBaseline} from '../tools/next-five-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\n"
      },
      {
        "current": "  for (const [file, pin] of Object.entries(files)) {\n    const current = git('show', COMPOSITION_REVISION + ':' + file);\n    const prior = git('cat-file', 'blob', pin.baselineBlob);\n    assert.equal(nextFiveSourceBaseline(file, lf(cityActivitySourceBaseline(file, (hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,continuousCityHistoricalInput(file, fs.readFileSync(file, 'utf8'))):continuousCityHistoricalInput(file, fs.readFileSync(file, 'utf8')))))), current, 'Complete actual source retains its reviewed composition');\n    const actual = []; let hunk;\n    for (const line of git('diff', '--no-ext-diff', '--unified=' + pin.contextLines, pin.baselineBlob, pin.currentBlob).split('\\n')) {\n      if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; actual.push(hunk); }\n",
        "baseline": "  for (const [file, pin] of Object.entries(files)) {\n    const current = git('show', COMPOSITION_REVISION + ':' + file);\n    const prior = git('cat-file', 'blob', pin.baselineBlob);\n    assert.equal(nextFiveSourceBaseline(file, lf(cityActivitySourceBaseline(file, (hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,fs.readFileSync(file, 'utf8')):fs.readFileSync(file, 'utf8'))))), current, 'Complete actual source retains its reviewed composition');\n    const actual = []; let hunk;\n    for (const line of git('diff', '--no-ext-diff', '--unified=' + pin.contextLines, pin.baselineBlob, pin.currentBlob).split('\\n')) {\n      if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; actual.push(hunk); }\n"
      }
    ]
  },
  "test/enterprise-current-source-compatibility.js": {
    "currentSha256": "d53bd03d15c555bb1e5ab92275ecc402c5912331a4013cc4a2aa568ab3a84b98",
    "currentBlob": "53a278666cb55541f68eda30f6427a56266c7ea4",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "d53bd03d15c555bb1e5ab92275ecc402c5912331a4013cc4a2aa568ab3a84b98",
      "crlf": "3ddb10389a322732f45fcd31b9f3b4198a26022f4b4c65ee2b7c829647f8cbfa"
    },
    "predecessorAbsent": false,
    "baselineSha256": "c7f83990127cc8dedff482f555f16b70cfce39fe0b614cc51cabe1dd77eb5d10",
    "baselineBlob": "b526a843eb436654724bb4924604117d918e4322",
    "baselineMode": "100644",
    "inverses": [
      {
        "current": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport './continuous-city-source-compatibility.js';\n// Current typed source/data proof only. This does not qualify native/migration/gameplay/release execution.\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\n",
        "baseline": "// Current typed source/data proof only. This does not qualify native/migration/gameplay/release execution.\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\n"
      },
      {
        "current": "let positives=0,refusals=0;const pins={...ENTERPRISE_OVER_ROOT_SOURCE_DOMAINS,...ENTERPRISE_OVER_ROOT_IDENTITY_SOURCES};\nassert.equal(Object.keys(ENTERPRISE_OVER_ROOT_SOURCE_DOMAINS).length,31);\nfor(const[file,p]of Object.entries(pins)){\n  const raw=continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8')),current=git(ENTERPRISE_CURRENT_SOURCE_REVISION,file),root=git(ENTERPRISE_ROOT_PREDECESSOR,file);\n  assert.equal(hash(lf(raw)),p.currentSha256,'Exactly proven physical input must reconstruct the current Enterprise phase');assert.equal(blob(lf(raw)),p.currentBlob);assert.equal(lf(raw),current);\n  for(const input of [raw,current,current.replaceAll('\\n','\\r\\n'),root]){assert.equal(enterpriseOverRootSourceBaseline(file,input),root);positives++;}\n  for(const input of [current+'\\n// unknown\\n',current.slice(1),'\\ufeff'+current,current.replace('\\n','\\r\\n'),current.replace('\\n','\\r'),Buffer.from(current)]){assert.throws(()=>enterpriseOverRootSourceBaseline(file,input));refusals++;}\n  for(const h of p.inverses)for(const input of [current.replace(h.current,''),current.replace(h.current,()=>h.current+h.current)]){assert.throws(()=>enterpriseOverRootSourceBaseline(file,input));refusals++;}\n",
        "baseline": "let positives=0,refusals=0;const pins={...ENTERPRISE_OVER_ROOT_SOURCE_DOMAINS,...ENTERPRISE_OVER_ROOT_IDENTITY_SOURCES};\nassert.equal(Object.keys(ENTERPRISE_OVER_ROOT_SOURCE_DOMAINS).length,31);\nfor(const[file,p]of Object.entries(pins)){\n  const raw=fs.readFileSync(file,'utf8'),current=git(ENTERPRISE_CURRENT_SOURCE_REVISION,file),root=git(ENTERPRISE_ROOT_PREDECESSOR,file);\n  assert.equal(hash(lf(raw)),p.currentSha256,'Actual current input must match the current phase, not merely a Root baseline');assert.equal(blob(lf(raw)),p.currentBlob);assert.equal(lf(raw),current);\n  for(const input of [raw,current,current.replaceAll('\\n','\\r\\n'),root]){assert.equal(enterpriseOverRootSourceBaseline(file,input),root);positives++;}\n  for(const input of [current+'\\n// unknown\\n',current.slice(1),'\\ufeff'+current,current.replace('\\n','\\r\\n'),current.replace('\\n','\\r'),Buffer.from(current)]){assert.throws(()=>enterpriseOverRootSourceBaseline(file,input));refusals++;}\n  for(const h of p.inverses)for(const input of [current.replace(h.current,''),current.replace(h.current,()=>h.current+h.current)]){assert.throws(()=>enterpriseOverRootSourceBaseline(file,input));refusals++;}\n"
      },
      {
        "current": "assert.deepEqual(Object.keys(ENTERPRISE_OVER_GUI_SOURCE_DOMAINS),['src/server.js','package.json']);\nlet guiPositives=0,guiRefusals=0;\nfor(const[file,p]of Object.entries(ENTERPRISE_OVER_GUI_SOURCE_DOMAINS)){\n  const raw=continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8')),current=git(ENTERPRISE_GUI_SOURCE_REVISION,file),gui=git(ENTERPRISE_GUI_PREDECESSOR,file);\n  assert.equal(lf(raw),current,'Exactly proven physical input must reconstruct the distinct Enterprise GUI witness');assert.equal(hash(current),p.currentSha256);assert.equal(blob(current),p.currentBlob);assert.equal(hash(gui),p.baselineSha256);assert.equal(blob(gui),p.baselineBlob);\n  for(const input of [raw,current,current.replaceAll('\\n','\\r\\n')]){const selected=enterpriseOverGuiSourceBaseline(file,input);assert.equal(selected,gui);assert.equal(qualifyCityActivityMarketSource(file,selected).baselineText,git('b6be98c7e0233c4b35a74467828e24080b16b0eb',file));assert.equal(hash(input),p.currentRawSha256[input.includes('\\r\\n')?'crlf':'lf']);guiPositives++;}\n  for(const input of [gui,current+'\\n// unknown\\n',current.slice(1),'\\ufeff'+current,current+'\\0',current.replace('\\n','\\r\\n'),current.replace('\\n','\\r'),Buffer.from(current)]){assert.throws(()=>enterpriseOverGuiSourceBaseline(file,input));guiRefusals++;}\n  for(const h of p.inverses)for(const input of [current.replace(h.current,''),current.replace(h.current,()=>h.current+h.current)]){assert.throws(()=>enterpriseOverGuiSourceBaseline(file,input));guiRefusals++;}\n",
        "baseline": "assert.deepEqual(Object.keys(ENTERPRISE_OVER_GUI_SOURCE_DOMAINS),['src/server.js','package.json']);\nlet guiPositives=0,guiRefusals=0;\nfor(const[file,p]of Object.entries(ENTERPRISE_OVER_GUI_SOURCE_DOMAINS)){\n  const raw=fs.readFileSync(file,'utf8'),current=git(ENTERPRISE_GUI_SOURCE_REVISION,file),gui=git(ENTERPRISE_GUI_PREDECESSOR,file);\n  assert.equal(lf(raw),current,'Actual union input must match the distinct GUI witness');assert.equal(hash(current),p.currentSha256);assert.equal(blob(current),p.currentBlob);assert.equal(hash(gui),p.baselineSha256);assert.equal(blob(gui),p.baselineBlob);\n  for(const input of [raw,current,current.replaceAll('\\n','\\r\\n')]){const selected=enterpriseOverGuiSourceBaseline(file,input);assert.equal(selected,gui);assert.equal(qualifyCityActivityMarketSource(file,selected).baselineText,git('b6be98c7e0233c4b35a74467828e24080b16b0eb',file));assert.equal(hash(input),p.currentRawSha256[input.includes('\\r\\n')?'crlf':'lf']);guiPositives++;}\n  for(const input of [gui,current+'\\n// unknown\\n',current.slice(1),'\\ufeff'+current,current+'\\0',current.replace('\\n','\\r\\n'),current.replace('\\n','\\r'),Buffer.from(current)]){assert.throws(()=>enterpriseOverGuiSourceBaseline(file,input));guiRefusals++;}\n  for(const h of p.inverses)for(const input of [current.replace(h.current,''),current.replace(h.current,()=>h.current+h.current)]){assert.throws(()=>enterpriseOverGuiSourceBaseline(file,input));guiRefusals++;}\n"
      }
    ]
  },
  "test/lib/rc1-historical-source-fixture.js": {
    "currentSha256": "70819f799860168ec5fd147408f79ad5c7a71f5e2f6f9a7cc0bc2e37cdfa0dd2",
    "currentBlob": "561ff881b361679eb35f64c1d8b6663c40f1fc63",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "70819f799860168ec5fd147408f79ad5c7a71f5e2f6f9a7cc0bc2e37cdfa0dd2",
      "crlf": "b19e4279140874a678d79ac4570259be139374b4fb76dbe1537efed41e040f4b"
    },
    "predecessorAbsent": false,
    "baselineSha256": "7980a1acc4380d6a274138b4d88013dfdd58b0672d384f8e1a2e1c643c5d0418",
    "baselineBlob": "4eb0767a9633486805d89b09dd65cad64041266c",
    "baselineMode": "100644",
    "inverses": [
      {
        "current": "import { continuousCityHistoricalInput } from '../../tools/continuous-city-source-compatibility.js';\nimport {enterpriseOverGuiSourceBaseline} from '../../tools/enterprise-current-source-compatibility.js';\n// Closed pure-control fixtures. Historical source execution never admits the current release.\nimport {enterpriseOverRootSourceBaseline,ENTERPRISE_OVER_ROOT_SOURCE_DOMAINS,ENTERPRISE_OVER_ROOT_IDENTITY_SOURCES} from '../../tools/enterprise-current-source-compatibility.js';\n",
        "baseline": "import {enterpriseOverGuiSourceBaseline} from '../../tools/enterprise-current-source-compatibility.js';\n// Closed pure-control fixtures. Historical source execution never admits the current release.\nimport {enterpriseOverRootSourceBaseline,ENTERPRISE_OVER_ROOT_SOURCE_DOMAINS,ENTERPRISE_OVER_ROOT_IDENTITY_SOURCES} from '../../tools/enterprise-current-source-compatibility.js';\n"
      },
      {
        "current": "function historical(file) {\n  loadInventories();\n  if (!checked.has(file)) {\n    const selected = currentHistoricalApplicationSource(file, continuousCityHistoricalInput(file, String(originalRead(path.join(root, file)))));\n    checked.add(file);\n    return selected;\n  }\n",
        "baseline": "function historical(file) {\n  loadInventories();\n  if (!checked.has(file)) {\n    const selected = currentHistoricalApplicationSource(file, String(originalRead(path.join(root, file))));\n    checked.add(file);\n    return selected;\n  }\n"
      },
      {
        "current": "    'src/db.js', 'src/deeds.js', 'src/explore.js'];\n  let positives = 0, refusals = 0;\n  for (const file of files) {\n    const raw = continuousCityHistoricalInput(file, String(originalRead(path.join(root, file)))), current = canonical(raw);\n    const rootRaw = enterpriseOverRootSourceBaseline(file,raw), rootCurrent = canonical(rootRaw);\n    const deedRaw = marketOverDeedSourceBaseline(file, rootRaw), deedCurrent = canonical(deedRaw);\n    const witness = assertDeedQuestSourceTransfer(file, deedRaw).baselineText;\n",
        "baseline": "    'src/db.js', 'src/deeds.js', 'src/explore.js'];\n  let positives = 0, refusals = 0;\n  for (const file of files) {\n    const raw = String(originalRead(path.join(root, file))), current = canonical(raw);\n    const rootRaw = enterpriseOverRootSourceBaseline(file,raw), rootCurrent = canonical(rootRaw);\n    const deedRaw = marketOverDeedSourceBaseline(file, rootRaw), deedCurrent = canonical(deedRaw);\n    const witness = assertDeedQuestSourceTransfer(file, deedRaw).baselineText;\n"
      },
      {
        "current": "}\n\nfunction rejectCityActivityHistoricalSources() {\n  const file = 'src/server.js', unionRaw = continuousCityHistoricalInput(file, String(originalRead(path.join(root, file))));\n  const raw = enterpriseOverGuiSourceBaseline(file, unionRaw), current = canonical(raw);\n  const combinedProof = qualifyCityActivityMarketSource(file, raw);\n  const retained = String(git(['cat-file', 'blob', CITY_ACTIVITY_SOURCE_TRANSFER.actualServerBlob]));\n",
        "baseline": "}\n\nfunction rejectCityActivityHistoricalSources() {\n  const file = 'src/server.js', unionRaw = String(originalRead(path.join(root, file)));\n  const raw = enterpriseOverGuiSourceBaseline(file, unionRaw), current = canonical(raw);\n  const combinedProof = qualifyCityActivityMarketSource(file, raw);\n  const retained = String(git(['cat-file', 'blob', CITY_ACTIVITY_SOURCE_TRANSFER.actualServerBlob]));\n"
      }
    ]
  },
  "test/market-operations-source-compatibility.js": {
    "currentSha256": "9fa78e27faff19fc7697c732c6c9c13e68eea98eb18ec49e0b3b8fb84b531c6d",
    "currentBlob": "e70ecba90a32607be7d3c8e09f869c12cc1d36d4",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "9fa78e27faff19fc7697c732c6c9c13e68eea98eb18ec49e0b3b8fb84b531c6d",
      "crlf": "8defa0876810e9362c69a2720b7b0a5cdcc9fbee37369e487d9d4258c1ffefa8"
    },
    "predecessorAbsent": false,
    "baselineSha256": "290acf04a3f5870a09c98f5986ea355ee897dcb1d2626953e1ad3372aa05526b",
    "baselineBlob": "bfffe517a2b7192d1e15647ddac30c6855d835d0",
    "baselineMode": "100644",
    "inverses": [
      {
        "current": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {cityActivitySourceBaseline} from '../tools/rc1-city-activity-source-compatibility.js';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\n",
        "baseline": "import {cityActivitySourceBaseline} from '../tools/rc1-city-activity-source-compatibility.js';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\n"
      },
      {
        "current": "let negatives=0,hunks=0;\nfor(const[file,pin]of Object.entries(MARKET_OPERATIONS_SOURCE_DOMAINS)){\n  const current=git('show',MARKET_OPERATIONS_SOURCE_REVISION+':'+file),prior=git('show',MARKET_OPERATIONS_SOURCE_PREDECESSOR+':'+file);\n  assert.equal(deedOverMarketSourceBaseline(file,cityActivitySourceBaseline(file,enterpriseOverRootSourceBaseline(file,continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))))).replaceAll('\\r\\n','\\n'),current,'Complete actual source is independently pinned after the exact Enterprise then Deed junction');\n  assert.equal(git('rev-parse',MARKET_OPERATIONS_SOURCE_REVISION+':'+file).trim(),pin.currentBlob);\n  assert.equal(git('rev-parse',MARKET_OPERATIONS_SOURCE_PREDECESSOR+':'+file).trim(),pin.baselineBlob);\n  const actual=[];let chunk;\n",
        "baseline": "let negatives=0,hunks=0;\nfor(const[file,pin]of Object.entries(MARKET_OPERATIONS_SOURCE_DOMAINS)){\n  const current=git('show',MARKET_OPERATIONS_SOURCE_REVISION+':'+file),prior=git('show',MARKET_OPERATIONS_SOURCE_PREDECESSOR+':'+file);\n  assert.equal(deedOverMarketSourceBaseline(file,cityActivitySourceBaseline(file,enterpriseOverRootSourceBaseline(file,fs.readFileSync(file,'utf8')))).replaceAll('\\r\\n','\\n'),current,'Complete actual source is independently pinned after the exact Enterprise then Deed junction');\n  assert.equal(git('rev-parse',MARKET_OPERATIONS_SOURCE_REVISION+':'+file).trim(),pin.currentBlob);\n  assert.equal(git('rev-parse',MARKET_OPERATIONS_SOURCE_PREDECESSOR+':'+file).trim(),pin.baselineBlob);\n  const actual=[];let chunk;\n"
      },
      {
        "current": "for(const file of['__proto__','src/unknown.js','schema.sql.extra','knowledge/generated/graph.json']){\n  const text='unknown\\r\\nbytes\\n';assert.throws(()=>assertMarketOperationsSourceTransfer(file,text));assert.equal(marketOperationsSourceBaseline(file,text),text);negatives++;\n}\nconst file='test/lib/phase2-architecture-upgrade-catalog.json',current=JSON.parse(enterpriseOverRootSourceBaseline(file,continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))));\nconst prior=JSON.parse(git('show',MARKET_OPERATIONS_SOURCE_PREDECESSOR+':'+file));\nassert.equal(prior.added.length,1332);assert.equal(current.added.length,1402);\nassert.deepEqual(current.added.slice(0,1332),prior.added);assert.deepEqual(current.removed,prior.removed);\nfor(const[table,columns]of Object.entries(prior.notNullColumns))assert.deepEqual(current.notNullColumns[table],columns);\nconst added=Object.keys(current.notNullColumns).filter(name=>!Object.hasOwn(prior.notNullColumns,name));\nassert.equal(added.length,6);assert.equal(added.reduce((n,name)=>n+current.notNullColumns[name].length,0),66);\nconst schema=enterpriseOverRootSourceBaseline('schema.sql',continuousCityHistoricalInput('schema.sql', fs.readFileSync('schema.sql','utf8')));\nassert.throws(()=>releasePhase2MigrationPredecessor(schema),'Raw542 source does not enter the old528 native profile');\nassert.throws(()=>nextFiveNativePredecessor(schema),'Source transfer never creates historical native admission');\nconsole.log(`Market-operations source-only proof PASS:20 full domains/${hunks} immutable inverses/${negatives} refusals; all1332 prior rows preserved plus70/66; native admission remains separate`);\n",
        "baseline": "for(const file of['__proto__','src/unknown.js','schema.sql.extra','knowledge/generated/graph.json']){\n  const text='unknown\\r\\nbytes\\n';assert.throws(()=>assertMarketOperationsSourceTransfer(file,text));assert.equal(marketOperationsSourceBaseline(file,text),text);negatives++;\n}\nconst file='test/lib/phase2-architecture-upgrade-catalog.json',current=JSON.parse(enterpriseOverRootSourceBaseline(file,fs.readFileSync(file,'utf8')));\nconst prior=JSON.parse(git('show',MARKET_OPERATIONS_SOURCE_PREDECESSOR+':'+file));\nassert.equal(prior.added.length,1332);assert.equal(current.added.length,1402);\nassert.deepEqual(current.added.slice(0,1332),prior.added);assert.deepEqual(current.removed,prior.removed);\nfor(const[table,columns]of Object.entries(prior.notNullColumns))assert.deepEqual(current.notNullColumns[table],columns);\nconst added=Object.keys(current.notNullColumns).filter(name=>!Object.hasOwn(prior.notNullColumns,name));\nassert.equal(added.length,6);assert.equal(added.reduce((n,name)=>n+current.notNullColumns[name].length,0),66);\nconst schema=enterpriseOverRootSourceBaseline('schema.sql',fs.readFileSync('schema.sql','utf8'));\nassert.throws(()=>releasePhase2MigrationPredecessor(schema),'Raw542 source does not enter the old528 native profile');\nassert.throws(()=>nextFiveNativePredecessor(schema),'Source transfer never creates historical native admission');\nconsole.log(`Market-operations source-only proof PASS:20 full domains/${hunks} immutable inverses/${negatives} refusals; all1332 prior rows preserved plus70/66; native admission remains separate`);\n"
      }
    ]
  },
  "test/next-five-source-compatibility.js": {
    "currentSha256": "0b45c416cf81251b8dd38e7dfbf6882c2b344eca9e049ed12ea0ffa41fce0a4a",
    "currentBlob": "941e1052d3e73e5bd2f6d474a1d842d7432e66c3",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "0b45c416cf81251b8dd38e7dfbf6882c2b344eca9e049ed12ea0ffa41fce0a4a",
      "crlf": "be9257798d83bc874ff8d526e728c123be1710c5704578a6ae1ef3f887c9f54c"
    },
    "predecessorAbsent": false,
    "baselineSha256": "d9605ab3b9fc70713e0da18385adc4b52f09d8fb184eadc3a536c00da716a2ff",
    "baselineBlob": "98ea8cd9c3504671f5f5af64842336478553fd84",
    "baselineMode": "100644",
    "inverses": [
      {
        "current": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport {nextLayerSourceBaseline} from '../tools/next-layer-source-compatibility.js';\n",
        "baseline": "import {enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport {nextLayerSourceBaseline} from '../tools/next-layer-source-compatibility.js';\n"
      },
      {
        "current": "let negatives=0,hunks=0;\nfor(const[file,pin]of Object.entries(NEXT_FIVE_SOURCE_DOMAINS)){\n const current=git('show',NEXT_FIVE_SOURCE_REVISION+':'+file),prior=git('show',NEXT_FIVE_SOURCE_PREDECESSOR+':'+file);\n assert.equal(nextLayerSourceBaseline(file,deedQuestSourceBaseline(file,cityActivitySourceBaseline(file,enterpriseOverRootSourceBaseline(file,continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8')))))).replaceAll('\\r\\n','\\n'),current,'Complete actual first-five source is independently pinned');\n const actual=[];let chunk;\n for(const line of git('diff','--no-ext-diff','--unified='+pin.contextLines,pin.baselineBlob,pin.currentBlob).split('\\n')){\n  if(line.startsWith('@@')){chunk={current:'',baseline:''};actual.push(chunk);}\n",
        "baseline": "let negatives=0,hunks=0;\nfor(const[file,pin]of Object.entries(NEXT_FIVE_SOURCE_DOMAINS)){\n const current=git('show',NEXT_FIVE_SOURCE_REVISION+':'+file),prior=git('show',NEXT_FIVE_SOURCE_PREDECESSOR+':'+file);\n assert.equal(nextLayerSourceBaseline(file,deedQuestSourceBaseline(file,cityActivitySourceBaseline(file,enterpriseOverRootSourceBaseline(file,fs.readFileSync(file,'utf8'))))).replaceAll('\\r\\n','\\n'),current,'Complete actual first-five source is independently pinned');\n const actual=[];let chunk;\n for(const line of git('diff','--no-ext-diff','--unified='+pin.contextLines,pin.baselineBlob,pin.currentBlob).split('\\n')){\n  if(line.startsWith('@@')){chunk={current:'',baseline:''};actual.push(chunk);}\n"
      },
      {
        "current": "for(const file of['__proto__','src/unknown.js','schema.sql.extra','knowledge/generated/graph.json']){\n const text='unknown\\r\\nbytes\\n';assert.throws(()=>assertNextFiveSourceTransfer(file,text));assert.equal(nextFiveSourceBaseline(file,text),text);negatives++;\n}\nconst file='test/lib/phase2-architecture-upgrade-catalog.json',currentCatalog=JSON.parse(nextLayerSourceBaseline(file,enterpriseOverRootSourceBaseline(file,continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8')))));\nconst oldCatalog=JSON.parse(git('show',NEXT_FIVE_SOURCE_PREDECESSOR+':'+file));\nassert.equal(oldCatalog.added.length,1153);assert.equal(currentCatalog.added.length,1243);\nassert.deepEqual(currentCatalog.added.slice(0,1153),oldCatalog.added);assert.deepEqual(currentCatalog.removed,oldCatalog.removed);\n",
        "baseline": "for(const file of['__proto__','src/unknown.js','schema.sql.extra','knowledge/generated/graph.json']){\n const text='unknown\\r\\nbytes\\n';assert.throws(()=>assertNextFiveSourceTransfer(file,text));assert.equal(nextFiveSourceBaseline(file,text),text);negatives++;\n}\nconst file='test/lib/phase2-architecture-upgrade-catalog.json',currentCatalog=JSON.parse(nextLayerSourceBaseline(file,enterpriseOverRootSourceBaseline(file,fs.readFileSync(file,'utf8'))));\nconst oldCatalog=JSON.parse(git('show',NEXT_FIVE_SOURCE_PREDECESSOR+':'+file));\nassert.equal(oldCatalog.added.length,1153);assert.equal(currentCatalog.added.length,1243);\nassert.deepEqual(currentCatalog.added.slice(0,1153),oldCatalog.added);assert.deepEqual(currentCatalog.removed,oldCatalog.removed);\n"
      }
    ]
  },
  "test/next-layer-source-compatibility.js": {
    "currentSha256": "9f7710dc8fe74d32207be1890136d65f2d020e7cb9f59ba7cc98775cf8840a53",
    "currentBlob": "cb2b39347a3301e125b4b21d76fe58b04ef46f79",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "9f7710dc8fe74d32207be1890136d65f2d020e7cb9f59ba7cc98775cf8840a53",
      "crlf": "c0590a0427698de9a048a999b6da273883db5d57c85cf936d1e7bb17e6322c73"
    },
    "predecessorAbsent": false,
    "baselineSha256": "463e8efccdeb49612b4356db36a6be0de013091e7cb1738991749a00f591b29b",
    "baselineBlob": "cadb9c7e8f186e59833db870afdddfaeeb443d1e",
    "baselineMode": "100644",
    "inverses": [
      {
        "current": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport {enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport {marketOperationsSourceBaseline} from '../tools/market-operations-source-compatibility.js';\n",
        "baseline": "import { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport {enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport {marketOperationsSourceBaseline} from '../tools/market-operations-source-compatibility.js';\n"
      },
      {
        "current": "let negatives=0,hunks=0;\nfor(const[file,pin]of Object.entries(NEXT_LAYER_SOURCE_DOMAINS)){\n  const current=git('show',NEXT_LAYER_SOURCE_REVISION+':'+file),prior=git('show',NEXT_LAYER_SOURCE_PREDECESSOR+':'+file);\n  assert.equal(marketOperationsSourceBaseline(file,deedQuestSourceBaseline(file,deedOverMarketSourceBaseline(file,cityActivitySourceBaseline(file,enterpriseOverRootSourceBaseline(file,continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))))))).replaceAll('\\r\\n','\\n'),current,'Complete actual source is independently pinned');\n  assert.equal(git('rev-parse',NEXT_LAYER_SOURCE_REVISION+':'+file).trim(),pin.currentBlob);\n  assert.equal(git('rev-parse',NEXT_LAYER_SOURCE_PREDECESSOR+':'+file).trim(),pin.baselineBlob);\n  const actual=[];let chunk;\n",
        "baseline": "let negatives=0,hunks=0;\nfor(const[file,pin]of Object.entries(NEXT_LAYER_SOURCE_DOMAINS)){\n  const current=git('show',NEXT_LAYER_SOURCE_REVISION+':'+file),prior=git('show',NEXT_LAYER_SOURCE_PREDECESSOR+':'+file);\n  assert.equal(marketOperationsSourceBaseline(file,deedQuestSourceBaseline(file,deedOverMarketSourceBaseline(file,cityActivitySourceBaseline(file,enterpriseOverRootSourceBaseline(file,fs.readFileSync(file,'utf8')))))).replaceAll('\\r\\n','\\n'),current,'Complete actual source is independently pinned');\n  assert.equal(git('rev-parse',NEXT_LAYER_SOURCE_REVISION+':'+file).trim(),pin.currentBlob);\n  assert.equal(git('rev-parse',NEXT_LAYER_SOURCE_PREDECESSOR+':'+file).trim(),pin.baselineBlob);\n  const actual=[];let chunk;\n"
      },
      {
        "current": "for(const file of['__proto__','src/unknown.js','schema.sql.extra','knowledge/generated/graph.json']){\n  const text='unknown\\r\\nbytes\\n';assert.throws(()=>assertNextLayerSourceTransfer(file,text));assert.equal(nextLayerSourceBaseline(file,text),text);negatives++;\n}\nconst file='test/lib/phase2-architecture-upgrade-catalog.json',current=JSON.parse(marketOperationsSourceBaseline(file,enterpriseOverRootSourceBaseline(file,continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8')))));\nconst prior=JSON.parse(git('show',NEXT_LAYER_SOURCE_PREDECESSOR+':'+file));\nassert.equal(prior.added.length,1243);assert.equal(current.added.length,1332);\nassert.deepEqual(current.added.slice(0,1243),prior.added);assert.deepEqual(current.removed,prior.removed);\n",
        "baseline": "for(const file of['__proto__','src/unknown.js','schema.sql.extra','knowledge/generated/graph.json']){\n  const text='unknown\\r\\nbytes\\n';assert.throws(()=>assertNextLayerSourceTransfer(file,text));assert.equal(nextLayerSourceBaseline(file,text),text);negatives++;\n}\nconst file='test/lib/phase2-architecture-upgrade-catalog.json',current=JSON.parse(marketOperationsSourceBaseline(file,enterpriseOverRootSourceBaseline(file,fs.readFileSync(file,'utf8'))));\nconst prior=JSON.parse(git('show',NEXT_LAYER_SOURCE_PREDECESSOR+':'+file));\nassert.equal(prior.added.length,1243);assert.equal(current.added.length,1332);\nassert.deepEqual(current.added.slice(0,1243),prior.added);assert.deepEqual(current.removed,prior.removed);\n"
      }
    ]
  },
  "test/player-intel-source-compatibility.js": {
    "currentSha256": "c129a7aad6c8c12d8ee53c5d6b0d1cd0eed698eadf849c35a6fc511411b5fdb3",
    "currentBlob": "ff81594085c708f83167fcd74384802032597f34",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "c129a7aad6c8c12d8ee53c5d6b0d1cd0eed698eadf849c35a6fc511411b5fdb3",
      "crlf": "cd7cbb4e146e19e7bfea966f3c30df7110a20e76d0343928f289b303a3eea0dc"
    },
    "predecessorAbsent": false,
    "baselineSha256": "da6526784686645e3ecc2fd76360d36ee4a96442300838cf31543b53674ba043",
    "baselineBlob": "6ad2b9f21af0687f227e6c5552c71476ab47a8be",
    "baselineMode": "100644",
    "inverses": [
      {
        "current": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport { firstBatchSourceBaseline } from '../tools/rc1-first-batch-source-compatibility.js';\n",
        "baseline": "import {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport { firstBatchSourceBaseline } from '../tools/rc1-first-batch-source-compatibility.js';\n"
      },
      {
        "current": "  'src/secrets.js', 'src/contacts.js', 'src/wire.js']);\nlet negatives = 0, hunks = 0;\nfor (const file of Object.keys(transfer.currentPins)) {\n  const source = cityGameplaySourceBaseline(file, firstBatchSourceBaseline(file, cityActivitySourceBaseline(file,(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,continuousCityHistoricalInput(file, fs.readFileSync(file, 'utf8'))):continuousCityHistoricalInput(file, fs.readFileSync(file, 'utf8')))))).replaceAll('\\r\\n', '\\n');\n  const baseline = git('show', `${transfer.predecessorRevision}:${file}`);\n  assert.equal(source, git('show', `${transfer.sourceRevision}:${file}`), 'complete frozen runtime');\n  assert.equal(source, git('show', transfer.currentBlobs[file]));\n",
        "baseline": "  'src/secrets.js', 'src/contacts.js', 'src/wire.js']);\nlet negatives = 0, hunks = 0;\nfor (const file of Object.keys(transfer.currentPins)) {\n  const source = cityGameplaySourceBaseline(file, firstBatchSourceBaseline(file, cityActivitySourceBaseline(file,(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,fs.readFileSync(file, 'utf8')):fs.readFileSync(file, 'utf8'))))).replaceAll('\\r\\n', '\\n');\n  const baseline = git('show', `${transfer.predecessorRevision}:${file}`);\n  assert.equal(source, git('show', `${transfer.sourceRevision}:${file}`), 'complete frozen runtime');\n  assert.equal(source, git('show', transfer.currentBlobs[file]));\n"
      }
    ]
  },
  "test/rc1-business-season-source-compatibility.js": {
    "currentSha256": "3b22f1bf0ea342a9e86297ad3fffe07884e6162fd407a7c2e744776ad455970b",
    "currentBlob": "32e1b17f0ebb952f3db323a20b30d2cec80d6f46",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "3b22f1bf0ea342a9e86297ad3fffe07884e6162fd407a7c2e744776ad455970b",
      "crlf": "27e63fb8ebf6b3ff794038992ce265cee253c050393966dadffe1ff0e4129e95"
    },
    "predecessorAbsent": false,
    "baselineSha256": "a9b8abf4cce1efeeed8742c28b4f2bc3d89684f2b870402c3515cc79942c44ed",
    "baselineBlob": "29891b9916ad65a28dd377eb2a6e2968df65b6ad",
    "baselineMode": "100644",
    "inverses": [
      {
        "current": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport { cityGameplaySourceBaseline } from '../tools/rc1-city-gameplay-source-compatibility.js';\n",
        "baseline": "import {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport { cityGameplaySourceBaseline } from '../tools/rc1-city-gameplay-source-compatibility.js';\n"
      },
      {
        "current": "const files=['src/server.js','src/worker.js','src/invariants.js','src/social/estate.js','src/market.js'];\nassert.deepEqual(Object.keys(O.BUSINESS_SEASON_SOURCE_CURRENT_PINS),files);\nfor(const file of files){\n const current=playerIntelSourceBaseline(file,cityGameplaySourceBaseline(file,cityActivitySourceBaseline(file,(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))):continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8')))))),prior=git('show',`${O.BUSINESS_SEASON_SOURCE_PREDECESSOR_REVISION}:${file}`);\n entire(current,git('show',`${O.BUSINESS_SEASON_SOURCE_REVIEWED_REVISION}:${file}`));entire(current,git('show',O.BUSINESS_SEASON_SOURCE_CURRENT_BLOBS[file]));entire(prior,git('show',O.BUSINESS_SEASON_SOURCE_BASELINE_BLOBS[file]));entire(prior,git('show',`bcd22b9176186713749908aae5bd334d0362f040:${file}`));\n for(const [text,pins,bs]of [[current,O.BUSINESS_SEASON_SOURCE_CURRENT_PINS,O.BUSINESS_SEASON_SOURCE_CURRENT_BLOBS],[prior,O.BUSINESS_SEASON_SOURCE_BASELINE_PINS,O.BUSINESS_SEASON_SOURCE_BASELINE_BLOBS]]){assert.equal(hash(text),pins[file]);hashes++;assert.equal(blob(text),bs[file]);blobs++;}\n assert.equal(hash(prior),C.COMMERCIAL_REPUTATION_SOURCE_CURRENT_PINS[file]);hashes++;assert.equal(blob(prior),C.COMMERCIAL_REPUTATION_SOURCE_CURRENT_BLOBS[file]);blobs++;\n",
        "baseline": "const files=['src/server.js','src/worker.js','src/invariants.js','src/social/estate.js','src/market.js'];\nassert.deepEqual(Object.keys(O.BUSINESS_SEASON_SOURCE_CURRENT_PINS),files);\nfor(const file of files){\n const current=playerIntelSourceBaseline(file,cityGameplaySourceBaseline(file,cityActivitySourceBaseline(file,(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,fs.readFileSync(file,'utf8')):fs.readFileSync(file,'utf8'))))),prior=git('show',`${O.BUSINESS_SEASON_SOURCE_PREDECESSOR_REVISION}:${file}`);\n entire(current,git('show',`${O.BUSINESS_SEASON_SOURCE_REVIEWED_REVISION}:${file}`));entire(current,git('show',O.BUSINESS_SEASON_SOURCE_CURRENT_BLOBS[file]));entire(prior,git('show',O.BUSINESS_SEASON_SOURCE_BASELINE_BLOBS[file]));entire(prior,git('show',`bcd22b9176186713749908aae5bd334d0362f040:${file}`));\n for(const [text,pins,bs]of [[current,O.BUSINESS_SEASON_SOURCE_CURRENT_PINS,O.BUSINESS_SEASON_SOURCE_CURRENT_BLOBS],[prior,O.BUSINESS_SEASON_SOURCE_BASELINE_PINS,O.BUSINESS_SEASON_SOURCE_BASELINE_BLOBS]]){assert.equal(hash(text),pins[file]);hashes++;assert.equal(blob(text),bs[file]);blobs++;}\n assert.equal(hash(prior),C.COMMERCIAL_REPUTATION_SOURCE_CURRENT_PINS[file]);hashes++;assert.equal(blob(prior),C.COMMERCIAL_REPUTATION_SOURCE_CURRENT_BLOBS[file]);blobs++;\n"
      },
      {
        "current": "}\nfor(const file of ['src/businessseasons.js','src/game.js','toString']){assert.throws(()=>O.assertBusinessSeasonSourceTransfer(file,''));assert.throws(()=>O.qualifyBusinessSeasonSource(file,''));}\nassert.deepEqual(WORLD_RECOVERY_REVIEW.businessSeasonSourceReviewTransfer,O.BUSINESS_SEASON_SOURCE_TRANSFER);assert.deepEqual(WORLD_RECOVERY_REVIEW.commercialReputationSourceReviewTransfer,C.COMMERCIAL_REPUTATION_SOURCE_TRANSFER);\nassert.deepEqual(await verifyWorldRecoverySources({sourceRevision:O.BUSINESS_SEASON_SOURCE_REVIEWED_REVISION,readFile:file=>(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String(continuousCityHistoricalInput(file, fs.readFileSync(file)))):continuousCityHistoricalInput(file, fs.readFileSync(file)))}),await verifyWorldRecoverySources({sourceRevision:O.BUSINESS_SEASON_SOURCE_REVIEWED_REVISION,readFile:file=>files.includes(file)?git('show',`${O.BUSINESS_SEASON_SOURCE_PREDECESSOR_REVISION}:${file}`):(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String(continuousCityHistoricalInput(file, fs.readFileSync(file)))):continuousCityHistoricalInput(file, fs.readFileSync(file)))}));\nconsole.log(`rc1-business-season-source-compatibility: PASS ${hunks} exact Git hunks; ${texts} complete text, ${hashes} SHA256, ${blobs} Git blob comparisons; ${negatives} adversarial controls; CRLF, prior metadata and three unchanged full-file domains; source-only scope`);\n\n",
        "baseline": "}\nfor(const file of ['src/businessseasons.js','src/game.js','toString']){assert.throws(()=>O.assertBusinessSeasonSourceTransfer(file,''));assert.throws(()=>O.qualifyBusinessSeasonSource(file,''));}\nassert.deepEqual(WORLD_RECOVERY_REVIEW.businessSeasonSourceReviewTransfer,O.BUSINESS_SEASON_SOURCE_TRANSFER);assert.deepEqual(WORLD_RECOVERY_REVIEW.commercialReputationSourceReviewTransfer,C.COMMERCIAL_REPUTATION_SOURCE_TRANSFER);\nassert.deepEqual(await verifyWorldRecoverySources({sourceRevision:O.BUSINESS_SEASON_SOURCE_REVIEWED_REVISION,readFile:file=>(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String(fs.readFileSync(file))):fs.readFileSync(file))}),await verifyWorldRecoverySources({sourceRevision:O.BUSINESS_SEASON_SOURCE_REVIEWED_REVISION,readFile:file=>files.includes(file)?git('show',`${O.BUSINESS_SEASON_SOURCE_PREDECESSOR_REVISION}:${file}`):(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String(fs.readFileSync(file))):fs.readFileSync(file))}));\nconsole.log(`rc1-business-season-source-compatibility: PASS ${hunks} exact Git hunks; ${texts} complete text, ${hashes} SHA256, ${blobs} Git blob comparisons; ${negatives} adversarial controls; CRLF, prior metadata and three unchanged full-file domains; source-only scope`);\n\n"
      }
    ]
  },
  "test/rc1-buyer-cooperative-source-compatibility.js": {
    "currentSha256": "2ed16aff285162d2ae3e35228acc3922d7d26d68ce0829688be5a8f885d844d5",
    "currentBlob": "4bc261904856fa880ecf2576064684fc9daf9829",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "2ed16aff285162d2ae3e35228acc3922d7d26d68ce0829688be5a8f885d844d5",
      "crlf": "b91433c4ea0231cc5c0cb9793918fb8b865e15225de0cf2c98de56f7dbcf26de"
    },
    "predecessorAbsent": false,
    "baselineSha256": "3f2ad251cff4d827fd5aa00d08f0a01105536800b04147d5e8a234479377db14",
    "baselineBlob": "a8e3f47d35435fe10887da66294981691c9d26aa",
    "baselineMode": "100644",
    "inverses": [
      {
        "current": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport { companyOpportunitySourceBaseline } from '../tools/rc1-company-opportunity-source-compatibility.js';\n",
        "baseline": "import {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport { companyOpportunitySourceBaseline } from '../tools/rc1-company-opportunity-source-compatibility.js';\n"
      },
      {
        "current": "const entire=(a,b)=>{assert.equal(a,b);texts++;};\nassert.deepEqual(Object.keys(P.BUYER_COOPERATIVE_SOURCE_CURRENT_PINS),['src/server.js','src/worker.js','src/invariants.js','src/social/estate.js','src/market.js']);\nfor(const file of Object.keys(P.BUYER_COOPERATIVE_SOURCE_CURRENT_PINS)) {\n const current=companyOpportunitySourceBaseline(file,cityActivitySourceBaseline(file,(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))):continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))))),prior=git('show',`${P.BUYER_COOPERATIVE_SOURCE_PREDECESSOR_REVISION}:${file}`);\n entire(current,git('show',`${P.BUYER_COOPERATIVE_SOURCE_REVIEWED_REVISION}:${file}`));entire(current,git('show',`ac843ad2c444784a78cae377ab3b99aebb9f8a8f:${file}`));\n entire(current,git('show',P.BUYER_COOPERATIVE_SOURCE_CURRENT_BLOBS[file]));entire(prior,git('show',P.BUYER_COOPERATIVE_SOURCE_BASELINE_BLOBS[file]));\n for(const [text,pins,bs]of [[current,P.BUYER_COOPERATIVE_SOURCE_CURRENT_PINS,P.BUYER_COOPERATIVE_SOURCE_CURRENT_BLOBS],[prior,P.BUYER_COOPERATIVE_SOURCE_BASELINE_PINS,P.BUYER_COOPERATIVE_SOURCE_BASELINE_BLOBS]]) {assert.equal(hash(text),pins[file]);hashes++;assert.equal(blob(text),bs[file]);blobs++;}\n",
        "baseline": "const entire=(a,b)=>{assert.equal(a,b);texts++;};\nassert.deepEqual(Object.keys(P.BUYER_COOPERATIVE_SOURCE_CURRENT_PINS),['src/server.js','src/worker.js','src/invariants.js','src/social/estate.js','src/market.js']);\nfor(const file of Object.keys(P.BUYER_COOPERATIVE_SOURCE_CURRENT_PINS)) {\n const current=companyOpportunitySourceBaseline(file,cityActivitySourceBaseline(file,(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,fs.readFileSync(file,'utf8')):fs.readFileSync(file,'utf8')))),prior=git('show',`${P.BUYER_COOPERATIVE_SOURCE_PREDECESSOR_REVISION}:${file}`);\n entire(current,git('show',`${P.BUYER_COOPERATIVE_SOURCE_REVIEWED_REVISION}:${file}`));entire(current,git('show',`ac843ad2c444784a78cae377ab3b99aebb9f8a8f:${file}`));\n entire(current,git('show',P.BUYER_COOPERATIVE_SOURCE_CURRENT_BLOBS[file]));entire(prior,git('show',P.BUYER_COOPERATIVE_SOURCE_BASELINE_BLOBS[file]));\n for(const [text,pins,bs]of [[current,P.BUYER_COOPERATIVE_SOURCE_CURRENT_PINS,P.BUYER_COOPERATIVE_SOURCE_CURRENT_BLOBS],[prior,P.BUYER_COOPERATIVE_SOURCE_BASELINE_PINS,P.BUYER_COOPERATIVE_SOURCE_BASELINE_BLOBS]]) {assert.equal(hash(text),pins[file]);hashes++;assert.equal(blob(text),bs[file]);blobs++;}\n"
      },
      {
        "current": "}\nfor(const file of ['src/buyercooperatives.js','src/game.js','toString']){assert.throws(()=>P.assertBuyerCooperativeSourceTransfer(file,''));assert.throws(()=>P.qualifyBuyerCooperativeSource(file,''));}\nassert.deepEqual(WORLD_RECOVERY_REVIEW.buyerCooperativeSourceReviewTransfer,P.BUYER_COOPERATIVE_SOURCE_TRANSFER);assert.deepEqual(WORLD_RECOVERY_REVIEW.companyWorkflowSourceReviewTransfer,W.COMPANY_WORKFLOW_SOURCE_TRANSFER);\nconst currentReader=file=>(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String(continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8')))):continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))),priorReader=file=>Object.hasOwn(P.BUYER_COOPERATIVE_SOURCE_CURRENT_PINS,file)?git('show',`${P.BUYER_COOPERATIVE_SOURCE_PREDECESSOR_REVISION}:${file}`):currentReader(file);\nassert.deepEqual(await verifyWorldRecoverySources({readFile:currentReader,sourceRevision:P.BUYER_COOPERATIVE_SOURCE_REVIEWED_REVISION}),await verifyWorldRecoverySources({readFile:priorReader,sourceRevision:P.BUYER_COOPERATIVE_SOURCE_REVIEWED_REVISION}));\nconsole.log(`rc1-buyer-cooperative-source-compatibility: PASS ${hunks} exact Git hunks; ${texts} complete text, ${hashes} SHA256, ${blobs} Git blob comparisons; ${negatives} adversarial controls; CRLF, prior metadata, worker cap/cadence/ordering; source-only scope`);\n\n",
        "baseline": "}\nfor(const file of ['src/buyercooperatives.js','src/game.js','toString']){assert.throws(()=>P.assertBuyerCooperativeSourceTransfer(file,''));assert.throws(()=>P.qualifyBuyerCooperativeSource(file,''));}\nassert.deepEqual(WORLD_RECOVERY_REVIEW.buyerCooperativeSourceReviewTransfer,P.BUYER_COOPERATIVE_SOURCE_TRANSFER);assert.deepEqual(WORLD_RECOVERY_REVIEW.companyWorkflowSourceReviewTransfer,W.COMPANY_WORKFLOW_SOURCE_TRANSFER);\nconst currentReader=file=>(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String(fs.readFileSync(file,'utf8'))):fs.readFileSync(file,'utf8')),priorReader=file=>Object.hasOwn(P.BUYER_COOPERATIVE_SOURCE_CURRENT_PINS,file)?git('show',`${P.BUYER_COOPERATIVE_SOURCE_PREDECESSOR_REVISION}:${file}`):currentReader(file);\nassert.deepEqual(await verifyWorldRecoverySources({readFile:currentReader,sourceRevision:P.BUYER_COOPERATIVE_SOURCE_REVIEWED_REVISION}),await verifyWorldRecoverySources({readFile:priorReader,sourceRevision:P.BUYER_COOPERATIVE_SOURCE_REVIEWED_REVISION}));\nconsole.log(`rc1-buyer-cooperative-source-compatibility: PASS ${hunks} exact Git hunks; ${texts} complete text, ${hashes} SHA256, ${blobs} Git blob comparisons; ${negatives} adversarial controls; CRLF, prior metadata, worker cap/cadence/ordering; source-only scope`);\n\n"
      }
    ]
  },
  "test/rc1-checkpoint-recovery-review.js": {
    "currentSha256": "d2b14e967bcd01b58bdec662e3aedd547869690c14e7c4b9219b296cc2c52041",
    "currentBlob": "b6532c5d69401051a7814a00e6065188afb756ec",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "d2b14e967bcd01b58bdec662e3aedd547869690c14e7c4b9219b296cc2c52041",
      "crlf": "b6b0ac538bdacb749b06478b710da88fa416764084693bcc547ec00113409d8b"
    },
    "predecessorAbsent": false,
    "baselineSha256": "4833f9e9b6733d53d13a4de802581ee6734d35c79d78cf51f17adb3c0ac96c07",
    "baselineBlob": "5ee7fb83aca0580d6f42d65c21bbd8265ef65826",
    "baselineMode": "100644",
    "inverses": [
      {
        "current": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { isHistoricalSourceFixture, runHistoricalSourceFixture } from './lib/rc1-historical-source-fixture.js';\nimport { CREW_LOGISTICS_SOURCE_CURRENT_PINS, CREW_LOGISTICS_SOURCE_PREDECESSOR_PINS, CREW_LOGISTICS_SOURCE_INVERSES, assertCrewLogisticsSourceTransfer } from '../tools/rc1-deed-source-compatibility.js';\n",
        "baseline": "import {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { isHistoricalSourceFixture, runHistoricalSourceFixture } from './lib/rc1-historical-source-fixture.js';\nimport { CREW_LOGISTICS_SOURCE_CURRENT_PINS, CREW_LOGISTICS_SOURCE_PREDECESSOR_PINS, CREW_LOGISTICS_SOURCE_INVERSES, assertCrewLogisticsSourceTransfer } from '../tools/rc1-deed-source-compatibility.js';\n"
      },
      {
        "current": "  assert.equal(sha256(current), '14906ce7b480b8acd325c4967df6e6129d99c08e3f00bec798cacebe469895fd');\n  for (const supplied of [current, current.replaceAll('\\n', '\\r\\n'), current + '\\n// unreviewed C2 checkpoint source\\n']) {\n    await assert.rejects(verifyCheckpointRecoverySources({ sourceRevision: WORLD_RECOVERY_REVIEW.reviewedRevision,\n      readFile: async candidate => candidate === file ? supplied : (hasEnterpriseOverRootSource(candidate)?enterpriseOverRootSourceBaseline(candidate,String(continuousCityHistoricalInput(candidate, await fs.readFile(candidate)))):continuousCityHistoricalInput(candidate, await fs.readFile(candidate))) }),\n    /Checkpoint review source changed: src\\/routes\\/coordination.js/);\n  }\n  console.log('PASS: historical checkpoint source guard rejects exact C2, CRLF and tampering; current source is not admitted');\n",
        "baseline": "  assert.equal(sha256(current), '14906ce7b480b8acd325c4967df6e6129d99c08e3f00bec798cacebe469895fd');\n  for (const supplied of [current, current.replaceAll('\\n', '\\r\\n'), current + '\\n// unreviewed C2 checkpoint source\\n']) {\n    await assert.rejects(verifyCheckpointRecoverySources({ sourceRevision: WORLD_RECOVERY_REVIEW.reviewedRevision,\n      readFile: async candidate => candidate === file ? supplied : (hasEnterpriseOverRootSource(candidate)?enterpriseOverRootSourceBaseline(candidate,String(await fs.readFile(candidate))):fs.readFile(candidate)) }),\n    /Checkpoint review source changed: src\\/routes\\/coordination.js/);\n  }\n  console.log('PASS: historical checkpoint source guard rejects exact C2, CRLF and tampering; current source is not admitted');\n"
      }
    ]
  },
  "test/rc1-city-gameplay-source-compatibility.js": {
    "currentSha256": "aa70be20895a114063f68483f90f337c785e6ed5304b00b4b20f5055b87d565d",
    "currentBlob": "2fbb46ea7e3d5297c1d16fde3a2ed35ee0eeb362",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "aa70be20895a114063f68483f90f337c785e6ed5304b00b4b20f5055b87d565d",
      "crlf": "ed89650d970ba54f04fd1558e85b8573501bb1a2a0a9523c6cc492c56350f626"
    },
    "predecessorAbsent": false,
    "baselineSha256": "270e6c7e5b830b7d602f3d5239561acc60d546d5323b70d99582aa579ad3a4cf",
    "baselineBlob": "8c0af876c4326ca8d3ef45334d5b9835253b6cd1",
    "baselineMode": "100644",
    "inverses": [
      {
        "current": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport {enterpriseCurrentHistorical6bSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { firstBatchSourceBaseline, FIRST_BATCH_SOURCE_PREDECESSOR } from '../tools/rc1-first-batch-source-compatibility.js';\n",
        "baseline": "import { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport {enterpriseCurrentHistorical6bSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { firstBatchSourceBaseline, FIRST_BATCH_SOURCE_PREDECESSOR } from '../tools/rc1-first-batch-source-compatibility.js';\n"
      },
      {
        "current": "assert.match(CITY_GAMEPLAY_SOURCE_TRANSFER.scope, /ALL new gameplay\\/RPG\\/Home\\/NPC\\/PvE\\/token authority, current PostgreSQL, worker, migration, activation and deployment qualification remain outside/);\nlet negatives = 0;\nfor (const file of files) {\n  const raw = firstBatchSourceBaseline(file,cityActivitySourceBaseline(file,enterpriseCurrentHistorical6bSourceBaseline(file,continuousCityHistoricalInput(file, fs.readFileSync(file, 'utf8'))))), current = normalize(raw), parent = git('cat-file', 'blob', CITY_GAMEPLAY_SOURCE_LATEST_MAIN_PARENT_BLOBS[file]);\n  assert.equal(hash(current), CITY_GAMEPLAY_SOURCE_CURRENT_PINS[file], 'Exact current source: ' + file);\n  assert.equal(blob(current), CITY_GAMEPLAY_SOURCE_CURRENT_BLOBS[file]);\n  assert.equal(hash(parent), CITY_GAMEPLAY_SOURCE_LATEST_MAIN_PARENT_PINS[file]); assert.equal(blob(parent), CITY_GAMEPLAY_SOURCE_LATEST_MAIN_PARENT_BLOBS[file]);\n",
        "baseline": "assert.match(CITY_GAMEPLAY_SOURCE_TRANSFER.scope, /ALL new gameplay\\/RPG\\/Home\\/NPC\\/PvE\\/token authority, current PostgreSQL, worker, migration, activation and deployment qualification remain outside/);\nlet negatives = 0;\nfor (const file of files) {\n  const raw = firstBatchSourceBaseline(file,cityActivitySourceBaseline(file,enterpriseCurrentHistorical6bSourceBaseline(file,fs.readFileSync(file, 'utf8')))), current = normalize(raw), parent = git('cat-file', 'blob', CITY_GAMEPLAY_SOURCE_LATEST_MAIN_PARENT_BLOBS[file]);\n  assert.equal(hash(current), CITY_GAMEPLAY_SOURCE_CURRENT_PINS[file], 'Exact current source: ' + file);\n  assert.equal(blob(current), CITY_GAMEPLAY_SOURCE_CURRENT_BLOBS[file]);\n  assert.equal(hash(parent), CITY_GAMEPLAY_SOURCE_LATEST_MAIN_PARENT_PINS[file]); assert.equal(blob(parent), CITY_GAMEPLAY_SOURCE_LATEST_MAIN_PARENT_BLOBS[file]);\n"
      },
      {
        "current": "  }\n}\nfor (const file of Object.keys(GAME_EMPLOYMENT_SOURCE_CURRENT_PINS)) {\n  const current = normalize(firstBatchSourceBaseline(file,cityActivitySourceBaseline(file,enterpriseCurrentHistorical6bSourceBaseline(file,continuousCityHistoricalInput(file, fs.readFileSync(file, 'utf8')))))), combinedParent = companyBankSourceBaseline(file, cityGameplaySourceBaseline(file, current));\n  assert.equal(hash(combinedParent), COMMERCIAL_PREMISES_SOURCE_CURRENT_PINS[file], 'Gameplay preserves the complete premises parent: ' + file);\n  const workflow = commercialPremisesSourceBaseline(file, combinedParent);\n  assert.equal(hash(workflow), COMPANY_WORKFLOW_SOURCE_CURRENT_PINS[file]);\n",
        "baseline": "  }\n}\nfor (const file of Object.keys(GAME_EMPLOYMENT_SOURCE_CURRENT_PINS)) {\n  const current = normalize(firstBatchSourceBaseline(file,cityActivitySourceBaseline(file,enterpriseCurrentHistorical6bSourceBaseline(file,fs.readFileSync(file, 'utf8'))))), combinedParent = companyBankSourceBaseline(file, cityGameplaySourceBaseline(file, current));\n  assert.equal(hash(combinedParent), COMMERCIAL_PREMISES_SOURCE_CURRENT_PINS[file], 'Gameplay preserves the complete premises parent: ' + file);\n  const workflow = commercialPremisesSourceBaseline(file, combinedParent);\n  assert.equal(hash(workflow), COMPANY_WORKFLOW_SOURCE_CURRENT_PINS[file]);\n"
      },
      {
        "current": "    baseline: (input,file) => commercialPremisesSourceBaseline(file,input), assertTransfer: assertCompanyWorkflowSourceTransfer },\n]) {\n  for (const file of Object.keys(GAME_EMPLOYMENT_SOURCE_CURRENT_PINS)) {\n    const current = normalize(firstBatchSourceBaseline(file,cityActivitySourceBaseline(file,enterpriseCurrentHistorical6bSourceBaseline(file,continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8')))))), parent = layer.baseline(companyBankSourceBaseline(file,cityGameplaySourceBaseline(file,current)),file);\n    assert.equal(hash(parent),layer.pins[file]);\n    for (const chunk of layer.inverses[file]) {\n      assert.equal(parent.split(chunk.current).length,2,'Each premises/workflow predecessor hunk is exact and unique: ' + file);\n",
        "baseline": "    baseline: (input,file) => commercialPremisesSourceBaseline(file,input), assertTransfer: assertCompanyWorkflowSourceTransfer },\n]) {\n  for (const file of Object.keys(GAME_EMPLOYMENT_SOURCE_CURRENT_PINS)) {\n    const current = normalize(firstBatchSourceBaseline(file,cityActivitySourceBaseline(file,enterpriseCurrentHistorical6bSourceBaseline(file,fs.readFileSync(file,'utf8'))))), parent = layer.baseline(companyBankSourceBaseline(file,cityGameplaySourceBaseline(file,current)),file);\n    assert.equal(hash(parent),layer.pins[file]);\n    for (const chunk of layer.inverses[file]) {\n      assert.equal(parent.split(chunk.current).length,2,'Each premises/workflow predecessor hunk is exact and unique: ' + file);\n"
      },
      {
        "current": "    }\n  }\n}\nconst server = normalize(firstBatchSourceBaseline('src/server.js',cityActivitySourceBaseline('src/server.js',enterpriseCurrentHistorical6bSourceBaseline('src/server.js',continuousCityHistoricalInput('src/server.js', fs.readFileSync('src/server.js', 'utf8')))))), latestParentServer = cityGameplaySourceBaseline('src/server.js', server);\nconst intel = assertPlayerIntelSourceTransfer('src/server.js', latestParentServer);\nassert.equal(intel.baselineText, git('show', CITY_GAMEPLAY_SOURCE_MAIN_PARENT_REVISIONS[0] + ':src/server.js'));\nassert.equal(intel.baselinePins['src/server.js'], PLAYER_INTEL_SOURCE_TRANSFER.baselinePins['src/server.js']);\n",
        "baseline": "    }\n  }\n}\nconst server = normalize(firstBatchSourceBaseline('src/server.js',cityActivitySourceBaseline('src/server.js',enterpriseCurrentHistorical6bSourceBaseline('src/server.js',fs.readFileSync('src/server.js', 'utf8'))))), latestParentServer = cityGameplaySourceBaseline('src/server.js', server);\nconst intel = assertPlayerIntelSourceTransfer('src/server.js', latestParentServer);\nassert.equal(intel.baselineText, git('show', CITY_GAMEPLAY_SOURCE_MAIN_PARENT_REVISIONS[0] + ':src/server.js'));\nassert.equal(intel.baselinePins['src/server.js'], PLAYER_INTEL_SOURCE_TRANSFER.baselinePins['src/server.js']);\n"
      },
      {
        "current": "  'src/gameemployment.js','src/gameemploymentinvariants.js','src/routes/gameemployment.js','src/commercialpremises.js',\n  'src/commercialpremisesinvariants.js','src/routes/commercialpremises.js','src/companyworkflows.js','src/companyworkflowrunner.js',\n  'src/companyworkflowinvariants.js','src/routes/companyworkflows.js','src/worker.js']) {\n  const text = firstBatchSourceBaseline(file,enterpriseCurrentHistorical6bSourceBaseline(file,continuousCityHistoricalInput(file, fs.readFileSync(file, 'utf8')))); assert.equal(cityGameplaySourceBaseline(file, text), text, 'Files outside the closed17 map have no gameplay predecessor alias.');\n  assert.throws(() => qualifyCityGameplaySource(file, text), /Unknown gameplay source/); negatives++;\n}\nfor (const file of ['toString','constructor','./src/server.js']) {\n",
        "baseline": "  'src/gameemployment.js','src/gameemploymentinvariants.js','src/routes/gameemployment.js','src/commercialpremises.js',\n  'src/commercialpremisesinvariants.js','src/routes/commercialpremises.js','src/companyworkflows.js','src/companyworkflowrunner.js',\n  'src/companyworkflowinvariants.js','src/routes/companyworkflows.js','src/worker.js']) {\n  const text = firstBatchSourceBaseline(file,enterpriseCurrentHistorical6bSourceBaseline(file,fs.readFileSync(file, 'utf8'))); assert.equal(cityGameplaySourceBaseline(file, text), text, 'Files outside the closed17 map have no gameplay predecessor alias.');\n  assert.throws(() => qualifyCityGameplaySource(file, text), /Unknown gameplay source/); negatives++;\n}\nfor (const file of ['toString','constructor','./src/server.js']) {\n"
      }
    ]
  },
  "test/rc1-commercial-premises-source-compatibility.js": {
    "currentSha256": "834ae56cea2fdb549d36a1459002db70347eeecb67f771bade4e94e5978fa52c",
    "currentBlob": "60b6b4fa65c7e5a82dadf4dd556983090412ed96",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "834ae56cea2fdb549d36a1459002db70347eeecb67f771bade4e94e5978fa52c",
      "crlf": "68f1fe40da1a66711ae90fde99e2710ffbd286cf8eb0dfd26807cf6819339294"
    },
    "predecessorAbsent": false,
    "baselineSha256": "248acb4b9d698844f635b0bca1bd1e93c118ada91aa96b36c84ab574528561e5",
    "baselineBlob": "e2cca36fdd550aa257b94e9e3ee5cba5fb5da1f1",
    "baselineMode": "100644",
    "inverses": [
      {
        "current": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport { companyBankSourceBaseline } from '../tools/rc1-company-bank-source-compatibility.js';\n",
        "baseline": "import {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport { companyBankSourceBaseline } from '../tools/rc1-company-bank-source-compatibility.js';\n"
      },
      {
        "current": "const entire=(a,b)=>{assert.equal(a,b);texts++;};\nassert.deepEqual(Object.keys(P.COMMERCIAL_PREMISES_SOURCE_CURRENT_PINS),['src/server.js','src/invariants.js','src/social/estate.js']);\nfor(const file of Object.keys(P.COMMERCIAL_PREMISES_SOURCE_CURRENT_PINS)) {\n const current=companyBankSourceBaseline(file,playerIntelSourceBaseline(file,cityGameplaySourceBaseline(file,cityActivitySourceBaseline(file,(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))):continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))))))),prior=git('show',`${P.COMMERCIAL_PREMISES_SOURCE_PREDECESSOR_REVISION}:${file}`);\n entire(current,git('show',`${P.COMMERCIAL_PREMISES_SOURCE_REVIEWED_REVISION}:${file}`));entire(current,git('show',`194ca68721886ad5bce8f5d32d25ad48ec6b3ff0:${file}`));\n entire(current,git('show',P.COMMERCIAL_PREMISES_SOURCE_CURRENT_BLOBS[file]));entire(prior,git('show',P.COMMERCIAL_PREMISES_SOURCE_BASELINE_BLOBS[file]));\n for(const [text,pins,bs]of [[current,P.COMMERCIAL_PREMISES_SOURCE_CURRENT_PINS,P.COMMERCIAL_PREMISES_SOURCE_CURRENT_BLOBS],[prior,P.COMMERCIAL_PREMISES_SOURCE_BASELINE_PINS,P.COMMERCIAL_PREMISES_SOURCE_BASELINE_BLOBS]]) {assert.equal(hash(text),pins[file]);hashes++;assert.equal(blob(text),bs[file]);blobs++;}\n",
        "baseline": "const entire=(a,b)=>{assert.equal(a,b);texts++;};\nassert.deepEqual(Object.keys(P.COMMERCIAL_PREMISES_SOURCE_CURRENT_PINS),['src/server.js','src/invariants.js','src/social/estate.js']);\nfor(const file of Object.keys(P.COMMERCIAL_PREMISES_SOURCE_CURRENT_PINS)) {\n const current=companyBankSourceBaseline(file,playerIntelSourceBaseline(file,cityGameplaySourceBaseline(file,cityActivitySourceBaseline(file,(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,fs.readFileSync(file,'utf8')):fs.readFileSync(file,'utf8')))))),prior=git('show',`${P.COMMERCIAL_PREMISES_SOURCE_PREDECESSOR_REVISION}:${file}`);\n entire(current,git('show',`${P.COMMERCIAL_PREMISES_SOURCE_REVIEWED_REVISION}:${file}`));entire(current,git('show',`194ca68721886ad5bce8f5d32d25ad48ec6b3ff0:${file}`));\n entire(current,git('show',P.COMMERCIAL_PREMISES_SOURCE_CURRENT_BLOBS[file]));entire(prior,git('show',P.COMMERCIAL_PREMISES_SOURCE_BASELINE_BLOBS[file]));\n for(const [text,pins,bs]of [[current,P.COMMERCIAL_PREMISES_SOURCE_CURRENT_PINS,P.COMMERCIAL_PREMISES_SOURCE_CURRENT_BLOBS],[prior,P.COMMERCIAL_PREMISES_SOURCE_BASELINE_PINS,P.COMMERCIAL_PREMISES_SOURCE_BASELINE_BLOBS]]) {assert.equal(hash(text),pins[file]);hashes++;assert.equal(blob(text),bs[file]);blobs++;}\n"
      },
      {
        "current": "for(const file of ['src/worker.js','src/commercialpremises.js','toString']){assert.throws(()=>P.assertCommercialPremisesSourceTransfer(file,''));assert.throws(()=>P.qualifyCommercialPremisesSource(file,''));}\nconst worker=companyBankSourceBaseline('src/worker.js',fs.readFileSync('src/worker.js','utf8'));entire(worker,git('show',`${P.COMMERCIAL_PREMISES_SOURCE_PREDECESSOR_REVISION}:src/worker.js`));entire(worker,git('show',`${P.COMMERCIAL_PREMISES_SOURCE_REVIEWED_REVISION}:src/worker.js`));entire(P.commercialPremisesSourceBaseline('src/worker.js',worker),worker);\nassert.deepEqual(WORLD_RECOVERY_REVIEW.commercialPremisesSourceReviewTransfer,P.COMMERCIAL_PREMISES_SOURCE_TRANSFER);assert.deepEqual(WORLD_RECOVERY_REVIEW.companyWorkflowSourceReviewTransfer,W.COMPANY_WORKFLOW_SOURCE_TRANSFER);\nconst currentReader=file=>(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String(continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8')))):continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))),priorReader=file=>Object.hasOwn(P.COMMERCIAL_PREMISES_SOURCE_CURRENT_PINS,file)?git('show',`${P.COMMERCIAL_PREMISES_SOURCE_PREDECESSOR_REVISION}:${file}`):currentReader(file);\nassert.deepEqual(await verifyWorldRecoverySources({readFile:currentReader,sourceRevision:P.COMMERCIAL_PREMISES_SOURCE_REVIEWED_REVISION}),await verifyWorldRecoverySources({readFile:priorReader,sourceRevision:P.COMMERCIAL_PREMISES_SOURCE_REVIEWED_REVISION}));\nconsole.log(`rc1-commercial-premises-source-compatibility: PASS ${hunks} exact Git hunks; ${texts} complete text, ${hashes} SHA256, ${blobs} Git blob comparisons; ${negatives} adversarial controls; CRLF, prior metadata and unchanged worker; source-only scope`);\n",
        "baseline": "for(const file of ['src/worker.js','src/commercialpremises.js','toString']){assert.throws(()=>P.assertCommercialPremisesSourceTransfer(file,''));assert.throws(()=>P.qualifyCommercialPremisesSource(file,''));}\nconst worker=companyBankSourceBaseline('src/worker.js',fs.readFileSync('src/worker.js','utf8'));entire(worker,git('show',`${P.COMMERCIAL_PREMISES_SOURCE_PREDECESSOR_REVISION}:src/worker.js`));entire(worker,git('show',`${P.COMMERCIAL_PREMISES_SOURCE_REVIEWED_REVISION}:src/worker.js`));entire(P.commercialPremisesSourceBaseline('src/worker.js',worker),worker);\nassert.deepEqual(WORLD_RECOVERY_REVIEW.commercialPremisesSourceReviewTransfer,P.COMMERCIAL_PREMISES_SOURCE_TRANSFER);assert.deepEqual(WORLD_RECOVERY_REVIEW.companyWorkflowSourceReviewTransfer,W.COMPANY_WORKFLOW_SOURCE_TRANSFER);\nconst currentReader=file=>(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String(fs.readFileSync(file,'utf8'))):fs.readFileSync(file,'utf8')),priorReader=file=>Object.hasOwn(P.COMMERCIAL_PREMISES_SOURCE_CURRENT_PINS,file)?git('show',`${P.COMMERCIAL_PREMISES_SOURCE_PREDECESSOR_REVISION}:${file}`):currentReader(file);\nassert.deepEqual(await verifyWorldRecoverySources({readFile:currentReader,sourceRevision:P.COMMERCIAL_PREMISES_SOURCE_REVIEWED_REVISION}),await verifyWorldRecoverySources({readFile:priorReader,sourceRevision:P.COMMERCIAL_PREMISES_SOURCE_REVIEWED_REVISION}));\nconsole.log(`rc1-commercial-premises-source-compatibility: PASS ${hunks} exact Git hunks; ${texts} complete text, ${hashes} SHA256, ${blobs} Git blob comparisons; ${negatives} adversarial controls; CRLF, prior metadata and unchanged worker; source-only scope`);\n"
      }
    ]
  },
  "test/rc1-commercial-reputation-source-compatibility.js": {
    "currentSha256": "d00078367c0a7d74ff0fa0b18cc9cc3e6b4f000e758d949a2e9c87c4ea47001c",
    "currentBlob": "9b77955ace77b702ac7156c2bd129357b218fa29",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "d00078367c0a7d74ff0fa0b18cc9cc3e6b4f000e758d949a2e9c87c4ea47001c",
      "crlf": "c2de6007a883dc5426afd8924d1d20ebb67d5c4aaaaee65213d261dfe152e4f2"
    },
    "predecessorAbsent": false,
    "baselineSha256": "a39a19ef29dead1e724ab01cddd0d37a72e872b20f71e6caba9d21e932775a99",
    "baselineBlob": "34c208fbbcdf4e93237b6b158940d82b0139769b",
    "baselineMode": "100644",
    "inverses": [
      {
        "current": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport { businessSeasonSourceBaseline } from '../tools/rc1-business-season-source-compatibility.js';\n",
        "baseline": "import {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport { businessSeasonSourceBaseline } from '../tools/rc1-business-season-source-compatibility.js';\n"
      },
      {
        "current": "const files=['src/server.js','src/worker.js','src/invariants.js','src/social/estate.js','src/market.js'];\nassert.deepEqual(Object.keys(O.COMMERCIAL_REPUTATION_SOURCE_CURRENT_PINS),files);\nfor(const file of files){\n const current=businessSeasonSourceBaseline(file,cityActivitySourceBaseline(file,(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))):continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))))),prior=git('show',`${O.COMMERCIAL_REPUTATION_SOURCE_PREDECESSOR_REVISION}:${file}`);\n entire(current,git('show',`${O.COMMERCIAL_REPUTATION_SOURCE_REVIEWED_REVISION}:${file}`));entire(current,git('show',O.COMMERCIAL_REPUTATION_SOURCE_CURRENT_BLOBS[file]));entire(prior,git('show',O.COMMERCIAL_REPUTATION_SOURCE_BASELINE_BLOBS[file]));entire(prior,git('show',`5aadb5267bba9060716ddd82660e59f6aec89ea3:${file}`));\n for(const [text,pins,bs]of [[current,O.COMMERCIAL_REPUTATION_SOURCE_CURRENT_PINS,O.COMMERCIAL_REPUTATION_SOURCE_CURRENT_BLOBS],[prior,O.COMMERCIAL_REPUTATION_SOURCE_BASELINE_PINS,O.COMMERCIAL_REPUTATION_SOURCE_BASELINE_BLOBS]]){assert.equal(hash(text),pins[file]);hashes++;assert.equal(blob(text),bs[file]);blobs++;}\n assert.equal(hash(prior),C.COMPANY_OPPORTUNITY_SOURCE_CURRENT_PINS[file]);hashes++;assert.equal(blob(prior),C.COMPANY_OPPORTUNITY_SOURCE_CURRENT_BLOBS[file]);blobs++;\n",
        "baseline": "const files=['src/server.js','src/worker.js','src/invariants.js','src/social/estate.js','src/market.js'];\nassert.deepEqual(Object.keys(O.COMMERCIAL_REPUTATION_SOURCE_CURRENT_PINS),files);\nfor(const file of files){\n const current=businessSeasonSourceBaseline(file,cityActivitySourceBaseline(file,(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,fs.readFileSync(file,'utf8')):fs.readFileSync(file,'utf8')))),prior=git('show',`${O.COMMERCIAL_REPUTATION_SOURCE_PREDECESSOR_REVISION}:${file}`);\n entire(current,git('show',`${O.COMMERCIAL_REPUTATION_SOURCE_REVIEWED_REVISION}:${file}`));entire(current,git('show',O.COMMERCIAL_REPUTATION_SOURCE_CURRENT_BLOBS[file]));entire(prior,git('show',O.COMMERCIAL_REPUTATION_SOURCE_BASELINE_BLOBS[file]));entire(prior,git('show',`5aadb5267bba9060716ddd82660e59f6aec89ea3:${file}`));\n for(const [text,pins,bs]of [[current,O.COMMERCIAL_REPUTATION_SOURCE_CURRENT_PINS,O.COMMERCIAL_REPUTATION_SOURCE_CURRENT_BLOBS],[prior,O.COMMERCIAL_REPUTATION_SOURCE_BASELINE_PINS,O.COMMERCIAL_REPUTATION_SOURCE_BASELINE_BLOBS]]){assert.equal(hash(text),pins[file]);hashes++;assert.equal(blob(text),bs[file]);blobs++;}\n assert.equal(hash(prior),C.COMPANY_OPPORTUNITY_SOURCE_CURRENT_PINS[file]);hashes++;assert.equal(blob(prior),C.COMPANY_OPPORTUNITY_SOURCE_CURRENT_BLOBS[file]);blobs++;\n"
      },
      {
        "current": "}\nfor(const file of ['src/companyopportunities.js','src/game.js','toString']){assert.throws(()=>O.assertCommercialReputationSourceTransfer(file,''));assert.throws(()=>O.qualifyCommercialReputationSource(file,''));}\nassert.deepEqual(WORLD_RECOVERY_REVIEW.commercialReputationSourceReviewTransfer,O.COMMERCIAL_REPUTATION_SOURCE_TRANSFER);assert.deepEqual(WORLD_RECOVERY_REVIEW.companyOpportunitySourceReviewTransfer,C.COMPANY_OPPORTUNITY_SOURCE_TRANSFER);\nassert.deepEqual(await verifyWorldRecoverySources({sourceRevision:O.COMMERCIAL_REPUTATION_SOURCE_REVIEWED_REVISION,readFile:file=>(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String(continuousCityHistoricalInput(file, fs.readFileSync(file)))):continuousCityHistoricalInput(file, fs.readFileSync(file)))}),await verifyWorldRecoverySources({sourceRevision:O.COMMERCIAL_REPUTATION_SOURCE_REVIEWED_REVISION,readFile:file=>files.includes(file)?git('show',`${O.COMMERCIAL_REPUTATION_SOURCE_PREDECESSOR_REVISION}:${file}`):(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String(continuousCityHistoricalInput(file, fs.readFileSync(file)))):continuousCityHistoricalInput(file, fs.readFileSync(file)))}));\nconsole.log(`rc1-commercial-reputation-source-compatibility: PASS ${hunks} exact Git hunks; ${texts} complete text, ${hashes} SHA256, ${blobs} Git blob comparisons; ${negatives} adversarial controls; CRLF, prior metadata and four unchanged full-file domains; source-only scope`);\n",
        "baseline": "}\nfor(const file of ['src/companyopportunities.js','src/game.js','toString']){assert.throws(()=>O.assertCommercialReputationSourceTransfer(file,''));assert.throws(()=>O.qualifyCommercialReputationSource(file,''));}\nassert.deepEqual(WORLD_RECOVERY_REVIEW.commercialReputationSourceReviewTransfer,O.COMMERCIAL_REPUTATION_SOURCE_TRANSFER);assert.deepEqual(WORLD_RECOVERY_REVIEW.companyOpportunitySourceReviewTransfer,C.COMPANY_OPPORTUNITY_SOURCE_TRANSFER);\nassert.deepEqual(await verifyWorldRecoverySources({sourceRevision:O.COMMERCIAL_REPUTATION_SOURCE_REVIEWED_REVISION,readFile:file=>(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String(fs.readFileSync(file))):fs.readFileSync(file))}),await verifyWorldRecoverySources({sourceRevision:O.COMMERCIAL_REPUTATION_SOURCE_REVIEWED_REVISION,readFile:file=>files.includes(file)?git('show',`${O.COMMERCIAL_REPUTATION_SOURCE_PREDECESSOR_REVISION}:${file}`):(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String(fs.readFileSync(file))):fs.readFileSync(file))}));\nconsole.log(`rc1-commercial-reputation-source-compatibility: PASS ${hunks} exact Git hunks; ${texts} complete text, ${hashes} SHA256, ${blobs} Git blob comparisons; ${negatives} adversarial controls; CRLF, prior metadata and four unchanged full-file domains; source-only scope`);\n"
      }
    ]
  },
  "test/rc1-company-bank-source-compatibility.js": {
    "currentSha256": "737aba52a9e32872a7ac84acd0cecc20ab2300a0dc1c08274d8ca96722cca38a",
    "currentBlob": "7be7b0e8014179cdd1a8b4a3624d98571e466ceb",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "737aba52a9e32872a7ac84acd0cecc20ab2300a0dc1c08274d8ca96722cca38a",
      "crlf": "a8cc6a0e9213b1fa85fd1ed3e37057e087af8420396299faa03c9631d9788010"
    },
    "predecessorAbsent": false,
    "baselineSha256": "4ef8951a097a7144b6f1308a7160b05707477ed7a98561cd9b426688281cfb79",
    "baselineBlob": "8393f41b8d2a056788fd6734bdaec5eca5d56100",
    "baselineMode": "100644",
    "inverses": [
      {
        "current": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport { companyLogisticsHubSourceBaseline } from '../tools/rc1-company-logistics-hub-source-compatibility.js';\n",
        "baseline": "import {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport { companyLogisticsHubSourceBaseline } from '../tools/rc1-company-logistics-hub-source-compatibility.js';\n"
      },
      {
        "current": "const entire=(a,b)=>{assert.equal(a,b);texts++;};\nassert.deepEqual(Object.keys(P.COMPANY_BANK_SOURCE_CURRENT_PINS),['src/server.js','src/worker.js','src/invariants.js','src/social/estate.js']);\nfor(const file of Object.keys(P.COMPANY_BANK_SOURCE_CURRENT_PINS)) {\n const current=companyLogisticsHubSourceBaseline(file,cityActivitySourceBaseline(file,(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))):continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))))),prior=git('show',`${P.COMPANY_BANK_SOURCE_PREDECESSOR_REVISION}:${file}`);\n entire(current,git('show',`${P.COMPANY_BANK_SOURCE_REVIEWED_REVISION}:${file}`));entire(current,git('show',`c0dfd2b56db4991bd56d4a5ce1ce29d7fe24e5d1:${file}`));\n entire(current,git('show',P.COMPANY_BANK_SOURCE_CURRENT_BLOBS[file]));entire(prior,git('show',P.COMPANY_BANK_SOURCE_BASELINE_BLOBS[file]));\n for(const [text,pins,bs]of [[current,P.COMPANY_BANK_SOURCE_CURRENT_PINS,P.COMPANY_BANK_SOURCE_CURRENT_BLOBS],[prior,P.COMPANY_BANK_SOURCE_BASELINE_PINS,P.COMPANY_BANK_SOURCE_BASELINE_BLOBS]]) {assert.equal(hash(text),pins[file]);hashes++;assert.equal(blob(text),bs[file]);blobs++;}\n",
        "baseline": "const entire=(a,b)=>{assert.equal(a,b);texts++;};\nassert.deepEqual(Object.keys(P.COMPANY_BANK_SOURCE_CURRENT_PINS),['src/server.js','src/worker.js','src/invariants.js','src/social/estate.js']);\nfor(const file of Object.keys(P.COMPANY_BANK_SOURCE_CURRENT_PINS)) {\n const current=companyLogisticsHubSourceBaseline(file,cityActivitySourceBaseline(file,(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,fs.readFileSync(file,'utf8')):fs.readFileSync(file,'utf8')))),prior=git('show',`${P.COMPANY_BANK_SOURCE_PREDECESSOR_REVISION}:${file}`);\n entire(current,git('show',`${P.COMPANY_BANK_SOURCE_REVIEWED_REVISION}:${file}`));entire(current,git('show',`c0dfd2b56db4991bd56d4a5ce1ce29d7fe24e5d1:${file}`));\n entire(current,git('show',P.COMPANY_BANK_SOURCE_CURRENT_BLOBS[file]));entire(prior,git('show',P.COMPANY_BANK_SOURCE_BASELINE_BLOBS[file]));\n for(const [text,pins,bs]of [[current,P.COMPANY_BANK_SOURCE_CURRENT_PINS,P.COMPANY_BANK_SOURCE_CURRENT_BLOBS],[prior,P.COMPANY_BANK_SOURCE_BASELINE_PINS,P.COMPANY_BANK_SOURCE_BASELINE_BLOBS]]) {assert.equal(hash(text),pins[file]);hashes++;assert.equal(blob(text),bs[file]);blobs++;}\n"
      },
      {
        "current": "}\nfor(const file of ['src/companybankportfolios.js','src/game.js','toString']){assert.throws(()=>P.assertCompanyBankSourceTransfer(file,''));assert.throws(()=>P.qualifyCompanyBankSource(file,''));}\nassert.deepEqual(WORLD_RECOVERY_REVIEW.companyBankSourceReviewTransfer,P.COMPANY_BANK_SOURCE_TRANSFER);assert.deepEqual(WORLD_RECOVERY_REVIEW.companyWorkflowSourceReviewTransfer,W.COMPANY_WORKFLOW_SOURCE_TRANSFER);\nconst currentReader=file=>(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String(continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8')))):continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))),priorReader=file=>Object.hasOwn(P.COMPANY_BANK_SOURCE_CURRENT_PINS,file)?git('show',`${P.COMPANY_BANK_SOURCE_PREDECESSOR_REVISION}:${file}`):currentReader(file);\nassert.deepEqual(await verifyWorldRecoverySources({readFile:currentReader,sourceRevision:P.COMPANY_BANK_SOURCE_REVIEWED_REVISION}),await verifyWorldRecoverySources({readFile:priorReader,sourceRevision:P.COMPANY_BANK_SOURCE_REVIEWED_REVISION}));\nconsole.log(`rc1-company-bank-source-compatibility: PASS ${hunks} exact Git hunks; ${texts} complete text, ${hashes} SHA256, ${blobs} Git blob comparisons; ${negatives} adversarial controls; CRLF, prior metadata, worker cap/cadence/ordering; source-only scope`);\n",
        "baseline": "}\nfor(const file of ['src/companybankportfolios.js','src/game.js','toString']){assert.throws(()=>P.assertCompanyBankSourceTransfer(file,''));assert.throws(()=>P.qualifyCompanyBankSource(file,''));}\nassert.deepEqual(WORLD_RECOVERY_REVIEW.companyBankSourceReviewTransfer,P.COMPANY_BANK_SOURCE_TRANSFER);assert.deepEqual(WORLD_RECOVERY_REVIEW.companyWorkflowSourceReviewTransfer,W.COMPANY_WORKFLOW_SOURCE_TRANSFER);\nconst currentReader=file=>(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String(fs.readFileSync(file,'utf8'))):fs.readFileSync(file,'utf8')),priorReader=file=>Object.hasOwn(P.COMPANY_BANK_SOURCE_CURRENT_PINS,file)?git('show',`${P.COMPANY_BANK_SOURCE_PREDECESSOR_REVISION}:${file}`):currentReader(file);\nassert.deepEqual(await verifyWorldRecoverySources({readFile:currentReader,sourceRevision:P.COMPANY_BANK_SOURCE_REVIEWED_REVISION}),await verifyWorldRecoverySources({readFile:priorReader,sourceRevision:P.COMPANY_BANK_SOURCE_REVIEWED_REVISION}));\nconsole.log(`rc1-company-bank-source-compatibility: PASS ${hunks} exact Git hunks; ${texts} complete text, ${hashes} SHA256, ${blobs} Git blob comparisons; ${negatives} adversarial controls; CRLF, prior metadata, worker cap/cadence/ordering; source-only scope`);\n"
      }
    ]
  },
  "test/rc1-company-logistics-hub-source-compatibility.js": {
    "currentSha256": "b167f772a58a0c41531b0e54f68a77c72bfc8bbdf296ceb5fe516ef1ccdf1c5a",
    "currentBlob": "2d8807e141dd5a07a7185877a45013f5259949d1",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "b167f772a58a0c41531b0e54f68a77c72bfc8bbdf296ceb5fe516ef1ccdf1c5a",
      "crlf": "fdb365100f1b5fd96357f1536ac42decd62abdff669d74c81d86c86a2f719a0d"
    },
    "predecessorAbsent": false,
    "baselineSha256": "6a73a89d04d1c65fb68b0107f68284b34b03a39e846352aca2af74c3a221f51d",
    "baselineBlob": "4c97ccc3de79d9887984288ccadf03888aa46a4a",
    "baselineMode": "100644",
    "inverses": [
      {
        "current": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport { buyerCooperativeSourceBaseline } from '../tools/rc1-buyer-cooperative-source-compatibility.js';\n",
        "baseline": "import {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport { buyerCooperativeSourceBaseline } from '../tools/rc1-buyer-cooperative-source-compatibility.js';\n"
      },
      {
        "current": "const entire=(a,b)=>{assert.equal(a,b);texts++;};\nassert.deepEqual(Object.keys(P.COMPANY_LOGISTICS_HUB_SOURCE_CURRENT_PINS),['src/server.js','src/invariants.js','src/social/estate.js']);\nfor(const file of Object.keys(P.COMPANY_LOGISTICS_HUB_SOURCE_CURRENT_PINS)) {\n const current=buyerCooperativeSourceBaseline(file,cityActivitySourceBaseline(file,(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))):continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))))),prior=git('show',`${P.COMPANY_LOGISTICS_HUB_SOURCE_PREDECESSOR_REVISION}:${file}`);\n entire(current,git('show',`${P.COMPANY_LOGISTICS_HUB_SOURCE_REVIEWED_REVISION}:${file}`));entire(current,git('show',`880f494311b3aad625ce06af99fcb245b146a351:${file}`));\n entire(current,git('show',P.COMPANY_LOGISTICS_HUB_SOURCE_CURRENT_BLOBS[file]));entire(prior,git('show',P.COMPANY_LOGISTICS_HUB_SOURCE_BASELINE_BLOBS[file]));\n for(const [text,pins,bs]of [[current,P.COMPANY_LOGISTICS_HUB_SOURCE_CURRENT_PINS,P.COMPANY_LOGISTICS_HUB_SOURCE_CURRENT_BLOBS],[prior,P.COMPANY_LOGISTICS_HUB_SOURCE_BASELINE_PINS,P.COMPANY_LOGISTICS_HUB_SOURCE_BASELINE_BLOBS]]) {assert.equal(hash(text),pins[file]);hashes++;assert.equal(blob(text),bs[file]);blobs++;}\n",
        "baseline": "const entire=(a,b)=>{assert.equal(a,b);texts++;};\nassert.deepEqual(Object.keys(P.COMPANY_LOGISTICS_HUB_SOURCE_CURRENT_PINS),['src/server.js','src/invariants.js','src/social/estate.js']);\nfor(const file of Object.keys(P.COMPANY_LOGISTICS_HUB_SOURCE_CURRENT_PINS)) {\n const current=buyerCooperativeSourceBaseline(file,cityActivitySourceBaseline(file,(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,fs.readFileSync(file,'utf8')):fs.readFileSync(file,'utf8')))),prior=git('show',`${P.COMPANY_LOGISTICS_HUB_SOURCE_PREDECESSOR_REVISION}:${file}`);\n entire(current,git('show',`${P.COMPANY_LOGISTICS_HUB_SOURCE_REVIEWED_REVISION}:${file}`));entire(current,git('show',`880f494311b3aad625ce06af99fcb245b146a351:${file}`));\n entire(current,git('show',P.COMPANY_LOGISTICS_HUB_SOURCE_CURRENT_BLOBS[file]));entire(prior,git('show',P.COMPANY_LOGISTICS_HUB_SOURCE_BASELINE_BLOBS[file]));\n for(const [text,pins,bs]of [[current,P.COMPANY_LOGISTICS_HUB_SOURCE_CURRENT_PINS,P.COMPANY_LOGISTICS_HUB_SOURCE_CURRENT_BLOBS],[prior,P.COMPANY_LOGISTICS_HUB_SOURCE_BASELINE_PINS,P.COMPANY_LOGISTICS_HUB_SOURCE_BASELINE_BLOBS]]) {assert.equal(hash(text),pins[file]);hashes++;assert.equal(blob(text),bs[file]);blobs++;}\n"
      },
      {
        "current": "for(const file of ['src/worker.js','src/companylogisticshubs.js','toString']){assert.throws(()=>P.assertCompanyLogisticsHubSourceTransfer(file,''));assert.throws(()=>P.qualifyCompanyLogisticsHubSource(file,''));}\nconst worker=buyerCooperativeSourceBaseline('src/worker.js',fs.readFileSync('src/worker.js','utf8'));entire(worker,git('show',`${P.COMPANY_LOGISTICS_HUB_SOURCE_PREDECESSOR_REVISION}:src/worker.js`));entire(worker,git('show',`${P.COMPANY_LOGISTICS_HUB_SOURCE_REVIEWED_REVISION}:src/worker.js`));entire(P.companyLogisticsHubSourceBaseline('src/worker.js',worker),worker);\nassert.deepEqual(WORLD_RECOVERY_REVIEW.companyLogisticsHubSourceReviewTransfer,P.COMPANY_LOGISTICS_HUB_SOURCE_TRANSFER);assert.deepEqual(WORLD_RECOVERY_REVIEW.companyBankSourceReviewTransfer,W.COMPANY_BANK_SOURCE_TRANSFER);\nconst currentReader=file=>(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String(continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8')))):continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))),priorReader=file=>Object.hasOwn(P.COMPANY_LOGISTICS_HUB_SOURCE_CURRENT_PINS,file)?git('show',`${P.COMPANY_LOGISTICS_HUB_SOURCE_PREDECESSOR_REVISION}:${file}`):currentReader(file);\nassert.deepEqual(await verifyWorldRecoverySources({readFile:currentReader,sourceRevision:P.COMPANY_LOGISTICS_HUB_SOURCE_REVIEWED_REVISION}),await verifyWorldRecoverySources({readFile:priorReader,sourceRevision:P.COMPANY_LOGISTICS_HUB_SOURCE_REVIEWED_REVISION}));\nconsole.log(`rc1-company-logistics-hub-source-compatibility: PASS ${hunks} exact Git hunks; ${texts} complete text, ${hashes} SHA256, ${blobs} Git blob comparisons; ${negatives} adversarial controls; CRLF, prior metadata and unchanged worker; source-only scope`);\n",
        "baseline": "for(const file of ['src/worker.js','src/companylogisticshubs.js','toString']){assert.throws(()=>P.assertCompanyLogisticsHubSourceTransfer(file,''));assert.throws(()=>P.qualifyCompanyLogisticsHubSource(file,''));}\nconst worker=buyerCooperativeSourceBaseline('src/worker.js',fs.readFileSync('src/worker.js','utf8'));entire(worker,git('show',`${P.COMPANY_LOGISTICS_HUB_SOURCE_PREDECESSOR_REVISION}:src/worker.js`));entire(worker,git('show',`${P.COMPANY_LOGISTICS_HUB_SOURCE_REVIEWED_REVISION}:src/worker.js`));entire(P.companyLogisticsHubSourceBaseline('src/worker.js',worker),worker);\nassert.deepEqual(WORLD_RECOVERY_REVIEW.companyLogisticsHubSourceReviewTransfer,P.COMPANY_LOGISTICS_HUB_SOURCE_TRANSFER);assert.deepEqual(WORLD_RECOVERY_REVIEW.companyBankSourceReviewTransfer,W.COMPANY_BANK_SOURCE_TRANSFER);\nconst currentReader=file=>(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String(fs.readFileSync(file,'utf8'))):fs.readFileSync(file,'utf8')),priorReader=file=>Object.hasOwn(P.COMPANY_LOGISTICS_HUB_SOURCE_CURRENT_PINS,file)?git('show',`${P.COMPANY_LOGISTICS_HUB_SOURCE_PREDECESSOR_REVISION}:${file}`):currentReader(file);\nassert.deepEqual(await verifyWorldRecoverySources({readFile:currentReader,sourceRevision:P.COMPANY_LOGISTICS_HUB_SOURCE_REVIEWED_REVISION}),await verifyWorldRecoverySources({readFile:priorReader,sourceRevision:P.COMPANY_LOGISTICS_HUB_SOURCE_REVIEWED_REVISION}));\nconsole.log(`rc1-company-logistics-hub-source-compatibility: PASS ${hunks} exact Git hunks; ${texts} complete text, ${hashes} SHA256, ${blobs} Git blob comparisons; ${negatives} adversarial controls; CRLF, prior metadata and unchanged worker; source-only scope`);\n"
      }
    ]
  },
  "test/rc1-company-operator-source-compatibility.js": {
    "currentSha256": "27bf510b026ce013c17a5eea86a02beb827feeeabafc7521dfe8bde84c18b718",
    "currentBlob": "c214da953603abaa4eb923524e2e010f969d2cea",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "27bf510b026ce013c17a5eea86a02beb827feeeabafc7521dfe8bde84c18b718",
      "crlf": "c320f415fe932c0158382eef8a9424ba0fc07a4d54232a13ff2fffcccd40bfdc"
    },
    "predecessorAbsent": false,
    "baselineSha256": "6e31ca3572cb24b45f2a6496bbcfe40011f4c1446f73b2fd7a464b507f224bc7",
    "baselineBlob": "fdbe7155e32416d74987f01c12c019e6aca95c19",
    "baselineMode": "100644",
    "inverses": [
      {
        "current": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport assert from 'node:assert/strict';\n",
        "baseline": "import {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport assert from 'node:assert/strict';\n"
      },
      {
        "current": "const entire = (actual, expected, message) => { assert.equal(actual, expected, message); wholeFileComparisons++; };\nconst currentFiles = new Map();\nfor (const file of Object.keys(COMPANY_OPERATOR_SOURCE_CURRENT_PINS)) {\n  const current = normalize(gameEmploymentSourceBaseline(file,cityGameplaySourceBaseline(file,cityActivitySourceBaseline(file,(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))):continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))))))), baseline = git('show', COMPANY_OPERATOR_SOURCE_BASELINE_BLOBS[file]);\n  currentFiles.set(file, current);\n  entire(current, git('show', COMPANY_OPERATOR_SOURCE_CURRENT_BLOBS[file]), 'Full working source equals frozen Git blob');\n  entire(current, git('show', `${COMPANY_OPERATOR_SOURCE_REVIEWED_REVISION}:${file}`), 'Full current revision source');\n",
        "baseline": "const entire = (actual, expected, message) => { assert.equal(actual, expected, message); wholeFileComparisons++; };\nconst currentFiles = new Map();\nfor (const file of Object.keys(COMPANY_OPERATOR_SOURCE_CURRENT_PINS)) {\n  const current = normalize(gameEmploymentSourceBaseline(file,cityGameplaySourceBaseline(file,cityActivitySourceBaseline(file,(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,fs.readFileSync(file,'utf8')):fs.readFileSync(file,'utf8')))))), baseline = git('show', COMPANY_OPERATOR_SOURCE_BASELINE_BLOBS[file]);\n  currentFiles.set(file, current);\n  entire(current, git('show', COMPANY_OPERATOR_SOURCE_CURRENT_BLOBS[file]), 'Full working source equals frozen Git blob');\n  entire(current, git('show', `${COMPANY_OPERATOR_SOURCE_REVIEWED_REVISION}:${file}`), 'Full current revision source');\n"
      },
      {
        "current": "    assert.notEqual(changed, current); assert.equal(companyOperatorSourceBaseline(file, changed), changed, 'Unknown source must never manufacture predecessor bytes');\n    assert.throws(() => assertCompanyOperatorSourceTransfer(file, changed), /source changed/); assert.throws(() => qualifyCompanyOperatorSource(file, changed), /source changed/);\n    assert.throws(() => assertCompanyOperatorSourceTransfer(file, changed.replaceAll('\\n', '\\r\\n')), /source changed/);\n    await assert.rejects(() => verifyWorldRecoverySources({ sourceRevision: COMPANY_OPERATOR_SOURCE_REVIEWED_REVISION, readFile: candidate => candidate === file ? changed : (hasEnterpriseOverRootSource(candidate)?enterpriseOverRootSourceBaseline(candidate,String(continuousCityHistoricalInput(candidate, fs.readFileSync(candidate)))):continuousCityHistoricalInput(candidate, fs.readFileSync(candidate))) }), /source changed/);\n    if (file === 'src/worker.js') assert.throws(() => qualifyIntelSource(file, changed), /source changed/);\n    else assert.throws(() => Deed.assertDeedServerCompatibility(changed), /source changed/);\n    negatives++;\n",
        "baseline": "    assert.notEqual(changed, current); assert.equal(companyOperatorSourceBaseline(file, changed), changed, 'Unknown source must never manufacture predecessor bytes');\n    assert.throws(() => assertCompanyOperatorSourceTransfer(file, changed), /source changed/); assert.throws(() => qualifyCompanyOperatorSource(file, changed), /source changed/);\n    assert.throws(() => assertCompanyOperatorSourceTransfer(file, changed.replaceAll('\\n', '\\r\\n')), /source changed/);\n    await assert.rejects(() => verifyWorldRecoverySources({ sourceRevision: COMPANY_OPERATOR_SOURCE_REVIEWED_REVISION, readFile: candidate => candidate === file ? changed : (hasEnterpriseOverRootSource(candidate)?enterpriseOverRootSourceBaseline(candidate,String(fs.readFileSync(candidate))):fs.readFileSync(candidate)) }), /source changed/);\n    if (file === 'src/worker.js') assert.throws(() => qualifyIntelSource(file, changed), /source changed/);\n    else assert.throws(() => Deed.assertDeedServerCompatibility(changed), /source changed/);\n    negatives++;\n"
      },
      {
        "current": "}\nassert.deepEqual(WORLD_RECOVERY_REVIEW.companyOperatorSourceReviewTransfer, COMPANY_OPERATOR_SOURCE_TRANSFER);\nassert.match(COMPANY_OPERATOR_SOURCE_TRANSFER.scope, /no world-soak, native, financial, deployment or onchain qualification/);\nconst actual = await verifyWorldRecoverySources({ sourceRevision: COMPANY_OPERATOR_SOURCE_REVIEWED_REVISION, readFile: file => (hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String(continuousCityHistoricalInput(file, fs.readFileSync(file)))):continuousCityHistoricalInput(file, fs.readFileSync(file))) });\nconst prior = await verifyWorldRecoverySources({ sourceRevision: COMPANY_OPERATOR_SOURCE_REVIEWED_REVISION, readFile: file => currentFiles.has(file) ? git('show', `${COMPANY_OPERATOR_SOURCE_PREDECESSOR_REVISION}:${file}`) : (hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String(continuousCityHistoricalInput(file, fs.readFileSync(file)))):continuousCityHistoricalInput(file, fs.readFileSync(file))) });\nassert.deepEqual(actual, prior, 'Historical source qualification remains exactly unchanged after outer reconstruction');\nconsole.log(`rc1-company-operator-source-compatibility: PASS ${chunks} exact Git hunks; ${wholeFileComparisons} whole-file comparisons (${sha256Comparisons} SHA256 + ${blobComparisons} Git blob + ${wholeFileComparisons - sha256Comparisons - blobComparisons} complete text); ${negatives} unknown/missing/duplicate/reordered/context/hook controls; LF/CRLF; exact full server/worker envelopes; historical scoped parity only`);\n",
        "baseline": "}\nassert.deepEqual(WORLD_RECOVERY_REVIEW.companyOperatorSourceReviewTransfer, COMPANY_OPERATOR_SOURCE_TRANSFER);\nassert.match(COMPANY_OPERATOR_SOURCE_TRANSFER.scope, /no world-soak, native, financial, deployment or onchain qualification/);\nconst actual = await verifyWorldRecoverySources({ sourceRevision: COMPANY_OPERATOR_SOURCE_REVIEWED_REVISION, readFile: file => (hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String(fs.readFileSync(file))):fs.readFileSync(file)) });\nconst prior = await verifyWorldRecoverySources({ sourceRevision: COMPANY_OPERATOR_SOURCE_REVIEWED_REVISION, readFile: file => currentFiles.has(file) ? git('show', `${COMPANY_OPERATOR_SOURCE_PREDECESSOR_REVISION}:${file}`) : (hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String(fs.readFileSync(file))):fs.readFileSync(file)) });\nassert.deepEqual(actual, prior, 'Historical source qualification remains exactly unchanged after outer reconstruction');\nconsole.log(`rc1-company-operator-source-compatibility: PASS ${chunks} exact Git hunks; ${wholeFileComparisons} whole-file comparisons (${sha256Comparisons} SHA256 + ${blobComparisons} Git blob + ${wholeFileComparisons - sha256Comparisons - blobComparisons} complete text); ${negatives} unknown/missing/duplicate/reordered/context/hook controls; LF/CRLF; exact full server/worker envelopes; historical scoped parity only`);\n"
      }
    ]
  },
  "test/rc1-company-opportunity-source-compatibility.js": {
    "currentSha256": "19ce74518694b7ea9d1fa2443aabb230d5ee2a84e693f80729ddfa77624da493",
    "currentBlob": "ea05136096ba66fa44073f621dc110a4547cca33",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "19ce74518694b7ea9d1fa2443aabb230d5ee2a84e693f80729ddfa77624da493",
      "crlf": "648555d32e1f7a6993788a0b3ff3684c2b99426e938818eb677f412fc61dfeb3"
    },
    "predecessorAbsent": false,
    "baselineSha256": "c69f25fda0d045f64ea957b624ad5473ad25143a8d9abe0a8265279e64d88721",
    "baselineBlob": "77848fea85378c38287962830cd34df34e60afb2",
    "baselineMode": "100644",
    "inverses": [
      {
        "current": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport { commercialReputationSourceBaseline } from '../tools/rc1-commercial-reputation-source-compatibility.js';\n",
        "baseline": "import {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport { commercialReputationSourceBaseline } from '../tools/rc1-commercial-reputation-source-compatibility.js';\n"
      },
      {
        "current": "const files=['src/server.js','src/worker.js','src/invariants.js','src/social/estate.js','src/market.js'];\nassert.deepEqual(Object.keys(O.COMPANY_OPPORTUNITY_SOURCE_CURRENT_PINS),files);\nfor(const file of files){\n const current=commercialReputationSourceBaseline(file,cityActivitySourceBaseline(file,(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))):continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))))),prior=git('show',`${O.COMPANY_OPPORTUNITY_SOURCE_PREDECESSOR_REVISION}:${file}`);\n entire(current,git('show',`${O.COMPANY_OPPORTUNITY_SOURCE_REVIEWED_REVISION}:${file}`));entire(current,git('show',O.COMPANY_OPPORTUNITY_SOURCE_CURRENT_BLOBS[file]));entire(prior,git('show',O.COMPANY_OPPORTUNITY_SOURCE_BASELINE_BLOBS[file]));entire(prior,git('show',`ac843ad2c444784a78cae377ab3b99aebb9f8a8f:${file}`));\n for(const [text,pins,bs]of [[current,O.COMPANY_OPPORTUNITY_SOURCE_CURRENT_PINS,O.COMPANY_OPPORTUNITY_SOURCE_CURRENT_BLOBS],[prior,O.COMPANY_OPPORTUNITY_SOURCE_BASELINE_PINS,O.COMPANY_OPPORTUNITY_SOURCE_BASELINE_BLOBS]]){assert.equal(hash(text),pins[file]);hashes++;assert.equal(blob(text),bs[file]);blobs++;}\n assert.equal(hash(prior),C.BUYER_COOPERATIVE_SOURCE_CURRENT_PINS[file]);hashes++;assert.equal(blob(prior),C.BUYER_COOPERATIVE_SOURCE_CURRENT_BLOBS[file]);blobs++;\n",
        "baseline": "const files=['src/server.js','src/worker.js','src/invariants.js','src/social/estate.js','src/market.js'];\nassert.deepEqual(Object.keys(O.COMPANY_OPPORTUNITY_SOURCE_CURRENT_PINS),files);\nfor(const file of files){\n const current=commercialReputationSourceBaseline(file,cityActivitySourceBaseline(file,(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,fs.readFileSync(file,'utf8')):fs.readFileSync(file,'utf8')))),prior=git('show',`${O.COMPANY_OPPORTUNITY_SOURCE_PREDECESSOR_REVISION}:${file}`);\n entire(current,git('show',`${O.COMPANY_OPPORTUNITY_SOURCE_REVIEWED_REVISION}:${file}`));entire(current,git('show',O.COMPANY_OPPORTUNITY_SOURCE_CURRENT_BLOBS[file]));entire(prior,git('show',O.COMPANY_OPPORTUNITY_SOURCE_BASELINE_BLOBS[file]));entire(prior,git('show',`ac843ad2c444784a78cae377ab3b99aebb9f8a8f:${file}`));\n for(const [text,pins,bs]of [[current,O.COMPANY_OPPORTUNITY_SOURCE_CURRENT_PINS,O.COMPANY_OPPORTUNITY_SOURCE_CURRENT_BLOBS],[prior,O.COMPANY_OPPORTUNITY_SOURCE_BASELINE_PINS,O.COMPANY_OPPORTUNITY_SOURCE_BASELINE_BLOBS]]){assert.equal(hash(text),pins[file]);hashes++;assert.equal(blob(text),bs[file]);blobs++;}\n assert.equal(hash(prior),C.BUYER_COOPERATIVE_SOURCE_CURRENT_PINS[file]);hashes++;assert.equal(blob(prior),C.BUYER_COOPERATIVE_SOURCE_CURRENT_BLOBS[file]);blobs++;\n"
      },
      {
        "current": "}\nfor(const file of ['src/companyopportunities.js','src/game.js','toString']){assert.throws(()=>O.assertCompanyOpportunitySourceTransfer(file,''));assert.throws(()=>O.qualifyCompanyOpportunitySource(file,''));}\nassert.deepEqual(WORLD_RECOVERY_REVIEW.companyOpportunitySourceReviewTransfer,O.COMPANY_OPPORTUNITY_SOURCE_TRANSFER);assert.deepEqual(WORLD_RECOVERY_REVIEW.buyerCooperativeSourceReviewTransfer,C.BUYER_COOPERATIVE_SOURCE_TRANSFER);\nassert.deepEqual(await verifyWorldRecoverySources({sourceRevision:O.COMPANY_OPPORTUNITY_SOURCE_REVIEWED_REVISION,readFile:file=>(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String(continuousCityHistoricalInput(file, fs.readFileSync(file)))):continuousCityHistoricalInput(file, fs.readFileSync(file)))}),await verifyWorldRecoverySources({sourceRevision:O.COMPANY_OPPORTUNITY_SOURCE_REVIEWED_REVISION,readFile:file=>files.includes(file)?git('show',`${O.COMPANY_OPPORTUNITY_SOURCE_PREDECESSOR_REVISION}:${file}`):(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String(continuousCityHistoricalInput(file, fs.readFileSync(file)))):continuousCityHistoricalInput(file, fs.readFileSync(file)))}));\nconsole.log(`rc1-company-opportunity-source-compatibility: PASS ${hunks} exact Git hunks; ${texts} complete text, ${hashes} SHA256, ${blobs} Git blob comparisons; ${negatives} adversarial controls; CRLF, prior metadata and three unchanged full-file domains; source-only scope`);\n",
        "baseline": "}\nfor(const file of ['src/companyopportunities.js','src/game.js','toString']){assert.throws(()=>O.assertCompanyOpportunitySourceTransfer(file,''));assert.throws(()=>O.qualifyCompanyOpportunitySource(file,''));}\nassert.deepEqual(WORLD_RECOVERY_REVIEW.companyOpportunitySourceReviewTransfer,O.COMPANY_OPPORTUNITY_SOURCE_TRANSFER);assert.deepEqual(WORLD_RECOVERY_REVIEW.buyerCooperativeSourceReviewTransfer,C.BUYER_COOPERATIVE_SOURCE_TRANSFER);\nassert.deepEqual(await verifyWorldRecoverySources({sourceRevision:O.COMPANY_OPPORTUNITY_SOURCE_REVIEWED_REVISION,readFile:file=>(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String(fs.readFileSync(file))):fs.readFileSync(file))}),await verifyWorldRecoverySources({sourceRevision:O.COMPANY_OPPORTUNITY_SOURCE_REVIEWED_REVISION,readFile:file=>files.includes(file)?git('show',`${O.COMPANY_OPPORTUNITY_SOURCE_PREDECESSOR_REVISION}:${file}`):(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String(fs.readFileSync(file))):fs.readFileSync(file))}));\nconsole.log(`rc1-company-opportunity-source-compatibility: PASS ${hunks} exact Git hunks; ${texts} complete text, ${hashes} SHA256, ${blobs} Git blob comparisons; ${negatives} adversarial controls; CRLF, prior metadata and three unchanged full-file domains; source-only scope`);\n"
      }
    ]
  },
  "test/rc1-company-succession-source-compatibility.js": {
    "currentSha256": "670a3e4e5f9cb3494d46f98d7ae1b8d9c2a06458a04fe75da2d586aeddcbda69",
    "currentBlob": "fc2f0873d15f66dcff60e36fd6777d5cbc5b3c1c",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "670a3e4e5f9cb3494d46f98d7ae1b8d9c2a06458a04fe75da2d586aeddcbda69",
      "crlf": "11129b7a084f10f60e03eeee4518bd27a83cda9f8ee3390b61179c78ab32ecd7"
    },
    "predecessorAbsent": false,
    "baselineSha256": "5ee562c8e4e29989e46da8d98a8cc5bf2322b6eff399c04e3e498f6d23a5f7ef",
    "baselineBlob": "5a02fee59c236a546c1081f4ac035fdf25ac72f7",
    "baselineMode": "100644",
    "inverses": [
      {
        "current": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport { cityHomesLeagueSourceBaseline } from '../tools/rc1-deed-source-compatibility.js';\n",
        "baseline": "import {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport { cityHomesLeagueSourceBaseline } from '../tools/rc1-deed-source-compatibility.js';\n"
      },
      {
        "current": "const hash = text => crypto.createHash('sha256').update(text).digest('hex');\nlet chunks = 0, negatives = 0;\nfor (const file of Object.keys(COMPANY_SUCCESSION_SOURCE_CURRENT_PINS)) {\n  const current = normalize(marketFeedSourceBaseline(file, strategyLeagueSourceBaseline(file, cityHomesLeagueSourceBaseline(file, cityActivitySourceBaseline(file, (hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,continuousCityHistoricalInput(file, fs.readFileSync(file, 'utf8'))):continuousCityHistoricalInput(file, fs.readFileSync(file, 'utf8')))))))), baseline = gitText(COMPANY_SUCCESSION_SOURCE_BASELINE_BLOBS[file]);\n  assert.equal(companySuccessionSourceBaseline(file, current), baseline);\n  assert.equal(companySuccessionSourceBaseline(file, baseline), baseline);\n  const unknown = current + '\\n// unknown source suffix\\n';\n",
        "baseline": "const hash = text => crypto.createHash('sha256').update(text).digest('hex');\nlet chunks = 0, negatives = 0;\nfor (const file of Object.keys(COMPANY_SUCCESSION_SOURCE_CURRENT_PINS)) {\n  const current = normalize(marketFeedSourceBaseline(file, strategyLeagueSourceBaseline(file, cityHomesLeagueSourceBaseline(file, cityActivitySourceBaseline(file, (hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,fs.readFileSync(file, 'utf8')):fs.readFileSync(file, 'utf8'))))))), baseline = gitText(COMPANY_SUCCESSION_SOURCE_BASELINE_BLOBS[file]);\n  assert.equal(companySuccessionSourceBaseline(file, current), baseline);\n  assert.equal(companySuccessionSourceBaseline(file, baseline), baseline);\n  const unknown = current + '\\n// unknown source suffix\\n';\n"
      }
    ]
  },
  "test/rc1-company-workflow-source-compatibility.js": {
    "currentSha256": "a24b9cdd7f72881a008d3420cc9be6bf2f10b5c442ed4d9d0b88c5052246a20b",
    "currentBlob": "ed3fbf8216cb60e89426f28277f39b0505e2bf7b",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "a24b9cdd7f72881a008d3420cc9be6bf2f10b5c442ed4d9d0b88c5052246a20b",
      "crlf": "a81d54e578c489ff569a8fdcd966895d6564d8450c37412cb1f823904551e431"
    },
    "predecessorAbsent": false,
    "baselineSha256": "a69dd218344e0c6639673a5672b99416b5307b77756e9142e39cf5530d84c811",
    "baselineBlob": "6fbf99dba6f3cabca5afd491adc7089d1f2538fa",
    "baselineMode": "100644",
    "inverses": [
      {
        "current": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport { commercialPremisesSourceBaseline } from '../tools/rc1-commercial-premises-source-compatibility.js';\n",
        "baseline": "import {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport { commercialPremisesSourceBaseline } from '../tools/rc1-commercial-premises-source-compatibility.js';\n"
      },
      {
        "current": "const sources = new Map(), predecessors = new Map();\nassert.deepEqual(Object.keys(COMPANY_WORKFLOW_SOURCE_CURRENT_PINS), ['src/server.js', 'src/worker.js', 'src/invariants.js', 'src/social/estate.js']);\nfor (const file of Object.keys(COMPANY_WORKFLOW_SOURCE_CURRENT_PINS)) {\n  const current = commercialPremisesSourceBaseline(file,cityGameplaySourceBaseline(file,cityActivitySourceBaseline(file,(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))):continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8')))))), baseline = git('show', COMPANY_WORKFLOW_SOURCE_BASELINE_BLOBS[file]); sources.set(file, current); predecessors.set(file, baseline);\n  entire(current, git('show', COMPANY_WORKFLOW_SOURCE_CURRENT_BLOBS[file])); entire(current, git('show', `${COMPANY_WORKFLOW_SOURCE_REVIEWED_REVISION}:${file}`)); entire(current, git('show', `129ab229990c2b9c0d3a460ed75f731081fd1f5c:${file}`));\n  entire(baseline, git('show', `${COMPANY_WORKFLOW_SOURCE_PREDECESSOR_REVISION}:${file}`));\n  assert.equal(hash(current), COMPANY_WORKFLOW_SOURCE_CURRENT_PINS[file]); assert.equal(hash(baseline), COMPANY_WORKFLOW_SOURCE_BASELINE_PINS[file]); sha256Comparisons += 2;\n",
        "baseline": "const sources = new Map(), predecessors = new Map();\nassert.deepEqual(Object.keys(COMPANY_WORKFLOW_SOURCE_CURRENT_PINS), ['src/server.js', 'src/worker.js', 'src/invariants.js', 'src/social/estate.js']);\nfor (const file of Object.keys(COMPANY_WORKFLOW_SOURCE_CURRENT_PINS)) {\n  const current = commercialPremisesSourceBaseline(file,cityGameplaySourceBaseline(file,cityActivitySourceBaseline(file,(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,fs.readFileSync(file,'utf8')):fs.readFileSync(file,'utf8'))))), baseline = git('show', COMPANY_WORKFLOW_SOURCE_BASELINE_BLOBS[file]); sources.set(file, current); predecessors.set(file, baseline);\n  entire(current, git('show', COMPANY_WORKFLOW_SOURCE_CURRENT_BLOBS[file])); entire(current, git('show', `${COMPANY_WORKFLOW_SOURCE_REVIEWED_REVISION}:${file}`)); entire(current, git('show', `129ab229990c2b9c0d3a460ed75f731081fd1f5c:${file}`));\n  entire(baseline, git('show', `${COMPANY_WORKFLOW_SOURCE_PREDECESSOR_REVISION}:${file}`));\n  assert.equal(hash(current), COMPANY_WORKFLOW_SOURCE_CURRENT_PINS[file]); assert.equal(hash(baseline), COMPANY_WORKFLOW_SOURCE_BASELINE_PINS[file]); sha256Comparisons += 2;\n"
      },
      {
        "current": "    if (file === 'src/server.js') assert.throws(() => Deed.assertDeedServerCompatibility(changed), /source changed/);\n    if (file === 'src/invariants.js') assert.throws(() => Deed.assertDeedBacklogCompatibility(file, changed), /source changed/);\n    // WQ's historical file domain is unchanged; invariant/estate bytes have their own closed guards.\n    if (Object.hasOwn(WORLD_RECOVERY_REVIEW.sourceFiles, file)) await assert.rejects(() => verifyWorldRecoverySources({ sourceRevision: COMPANY_WORKFLOW_SOURCE_REVIEWED_REVISION, readFile: candidate => candidate === file ? changed : (hasEnterpriseOverRootSource(candidate)?enterpriseOverRootSourceBaseline(candidate,String(continuousCityHistoricalInput(candidate, fs.readFileSync(candidate)))):continuousCityHistoricalInput(candidate, fs.readFileSync(candidate))) }), /source changed/);\n    else assert.throws(() => qualifyIntelSource(file, invoiceSourceBaseline(file, changed)), /source changed/);\n    negatives++;\n  }\n",
        "baseline": "    if (file === 'src/server.js') assert.throws(() => Deed.assertDeedServerCompatibility(changed), /source changed/);\n    if (file === 'src/invariants.js') assert.throws(() => Deed.assertDeedBacklogCompatibility(file, changed), /source changed/);\n    // WQ's historical file domain is unchanged; invariant/estate bytes have their own closed guards.\n    if (Object.hasOwn(WORLD_RECOVERY_REVIEW.sourceFiles, file)) await assert.rejects(() => verifyWorldRecoverySources({ sourceRevision: COMPANY_WORKFLOW_SOURCE_REVIEWED_REVISION, readFile: candidate => candidate === file ? changed : (hasEnterpriseOverRootSource(candidate)?enterpriseOverRootSourceBaseline(candidate,String(fs.readFileSync(candidate))):fs.readFileSync(candidate)) }), /source changed/);\n    else assert.throws(() => qualifyIntelSource(file, invoiceSourceBaseline(file, changed)), /source changed/);\n    negatives++;\n  }\n"
      },
      {
        "current": "assert.equal(intel.actualSha256, COMPANY_WORKFLOW_SOURCE_CURRENT_PINS['src/worker.js']);\nassert.deepEqual(WORLD_RECOVERY_REVIEW.companyWorkflowSourceReviewTransfer, COMPANY_WORKFLOW_SOURCE_TRANSFER); assert.deepEqual(WORLD_RECOVERY_REVIEW.gameEmploymentSourceReviewTransfer, GAME_EMPLOYMENT_SOURCE_TRANSFER); assert.deepEqual(WORLD_RECOVERY_REVIEW.companyOperatorSourceReviewTransfer, COMPANY_OPERATOR_SOURCE_TRANSFER);\nassert.match(COMPANY_WORKFLOW_SOURCE_TRANSFER.scope, /no world-soak, native, financial, deployment or onchain qualification/);\nconst currentQualification = await verifyWorldRecoverySources({ sourceRevision: COMPANY_WORKFLOW_SOURCE_REVIEWED_REVISION, readFile: file => (hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String(continuousCityHistoricalInput(file, fs.readFileSync(file)))):continuousCityHistoricalInput(file, fs.readFileSync(file))) });\nconst priorQualification = await verifyWorldRecoverySources({ sourceRevision: COMPANY_WORKFLOW_SOURCE_REVIEWED_REVISION, readFile: file => predecessors.get(file) || (hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String(continuousCityHistoricalInput(file, fs.readFileSync(file)))):continuousCityHistoricalInput(file, fs.readFileSync(file))) }); assert.deepEqual(currentQualification, priorQualification);\nconsole.log(`rc1-company-workflow-source-compatibility: PASS ${hunks} exact Git hunks; ${completeTextComparisons} full text + ${sha256Comparisons} SHA256 + ${blobComparisons} Git blob comparisons; ${negatives} missing/duplicate/reordered/full-file/context/auth/import/worker-cap-cadence/estate/invariant/older-layer controls; LF/CRLF; completecurrent metadata; original N02/N01/historical scope only`);\n",
        "baseline": "assert.equal(intel.actualSha256, COMPANY_WORKFLOW_SOURCE_CURRENT_PINS['src/worker.js']);\nassert.deepEqual(WORLD_RECOVERY_REVIEW.companyWorkflowSourceReviewTransfer, COMPANY_WORKFLOW_SOURCE_TRANSFER); assert.deepEqual(WORLD_RECOVERY_REVIEW.gameEmploymentSourceReviewTransfer, GAME_EMPLOYMENT_SOURCE_TRANSFER); assert.deepEqual(WORLD_RECOVERY_REVIEW.companyOperatorSourceReviewTransfer, COMPANY_OPERATOR_SOURCE_TRANSFER);\nassert.match(COMPANY_WORKFLOW_SOURCE_TRANSFER.scope, /no world-soak, native, financial, deployment or onchain qualification/);\nconst currentQualification = await verifyWorldRecoverySources({ sourceRevision: COMPANY_WORKFLOW_SOURCE_REVIEWED_REVISION, readFile: file => (hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String(fs.readFileSync(file))):fs.readFileSync(file)) });\nconst priorQualification = await verifyWorldRecoverySources({ sourceRevision: COMPANY_WORKFLOW_SOURCE_REVIEWED_REVISION, readFile: file => predecessors.get(file) || (hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String(fs.readFileSync(file))):fs.readFileSync(file)) }); assert.deepEqual(currentQualification, priorQualification);\nconsole.log(`rc1-company-workflow-source-compatibility: PASS ${hunks} exact Git hunks; ${completeTextComparisons} full text + ${sha256Comparisons} SHA256 + ${blobComparisons} Git blob comparisons; ${negatives} missing/duplicate/reordered/full-file/context/auth/import/worker-cap-cadence/estate/invariant/older-layer controls; LF/CRLF; completecurrent metadata; original N02/N01/historical scope only`);\n"
      }
    ]
  },
  "test/rc1-fifth-batch-source-compatibility.js": {
    "currentSha256": "9339550b633f0d2ee2d6e19e895b1c3814b3c8f800d38f4ff3ff608a8919d5d8",
    "currentBlob": "a6e154560414e2253216ac8a56c3cf86f1ed864c",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "9339550b633f0d2ee2d6e19e895b1c3814b3c8f800d38f4ff3ff608a8919d5d8",
      "crlf": "fb0c310d7392c9569718eb4a6e3b27e1b902f05c97aef2981849b69b62d72494"
    },
    "predecessorAbsent": false,
    "baselineSha256": "8254cb0bf9effd8ed448750fdf466b665d7ff3efeaa70708425dc16679d4bef4",
    "baselineBlob": "2db77bf71835522cdf6c744146119a65f4a53cae",
    "baselineMode": "100644",
    "inverses": [
      {
        "current": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport {nextFiveSourceBaseline} from '../tools/next-five-source-compatibility.js';\nimport assert from 'node:assert/strict';\n",
        "baseline": "import {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport {nextFiveSourceBaseline} from '../tools/next-five-source-compatibility.js';\nimport assert from 'node:assert/strict';\n"
      },
      {
        "current": "\n// Legacy EOL normalization is intentionally unchanged; substantive full-caller drift must still refuse.\nconst worldFiles=['src/server.js','src/worker.js'];\nconst worldRead=file=>(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String(continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8')))):continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))).replaceAll('\\r\\n','\\n');\nawait verifyWorldRecoverySources({sourceRevision:O.FIFTH_BATCH_SOURCE_REVISION,readFile:worldRead});\nlet worldNegatives=0;\nfor(const file of worldFiles){const text=worldRead(file),d=O.FIFTH_BATCH_SOURCE_DOMAINS[file];const bads=[text+'\\n// unknown substantive change\\n',text.slice(1),text.replace(/\\S/,'?')];for(const h of d.inverses)bads.push(text.replace(h.current,''),text.replace(h.current,()=>h.current+h.current),text.replace(h.current,()=>h.current.replace(/\\S/,'?')));for(const bad of bads){await assert.rejects(()=>verifyWorldRecoverySources({sourceRevision:O.FIFTH_BATCH_SOURCE_REVISION,readFile:f=>f===file?bad:worldRead(f)}),file+' substantive mutation index '+bads.indexOf(bad));worldNegatives++;}}\n",
        "baseline": "\n// Legacy EOL normalization is intentionally unchanged; substantive full-caller drift must still refuse.\nconst worldFiles=['src/server.js','src/worker.js'];\nconst worldRead=file=>(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String(fs.readFileSync(file,'utf8'))):fs.readFileSync(file,'utf8')).replaceAll('\\r\\n','\\n');\nawait verifyWorldRecoverySources({sourceRevision:O.FIFTH_BATCH_SOURCE_REVISION,readFile:worldRead});\nlet worldNegatives=0;\nfor(const file of worldFiles){const text=worldRead(file),d=O.FIFTH_BATCH_SOURCE_DOMAINS[file];const bads=[text+'\\n// unknown substantive change\\n',text.slice(1),text.replace(/\\S/,'?')];for(const h of d.inverses)bads.push(text.replace(h.current,''),text.replace(h.current,()=>h.current+h.current),text.replace(h.current,()=>h.current.replace(/\\S/,'?')));for(const bad of bads){await assert.rejects(()=>verifyWorldRecoverySources({sourceRevision:O.FIFTH_BATCH_SOURCE_REVISION,readFile:f=>f===file?bad:worldRead(f)}),file+' substantive mutation index '+bads.indexOf(bad));worldNegatives++;}}\n"
      }
    ]
  },
  "test/rc1-first-batch-source-compatibility.js": {
    "currentSha256": "956b1a6e323dd40fb835c8f05d343a44e2c60be8d52d816ce9bd90b596c43a97",
    "currentBlob": "92092fe12e61db52b6d26328ba432ac29e43b334",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "956b1a6e323dd40fb835c8f05d343a44e2c60be8d52d816ce9bd90b596c43a97",
      "crlf": "fe532c484f79e192eba78b9db1cc09857430c42f583ee3d74cad02c910657ebd"
    },
    "predecessorAbsent": false,
    "baselineSha256": "ed864d02f3b7f98e13c2b6fec35663c7b8fe9b1dc6a09069c64e98caca9775e8",
    "baselineBlob": "f1c6d0b3645accfafbc726f045f4ce1a4872b417",
    "baselineMode": "100644",
    "inverses": [
      {
        "current": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport {enterpriseCurrentHistorical6bSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { secondBatchSourceBaseline, assertSecondBatchSourceTransfer, SECOND_BATCH_SOURCE_DOMAINS } from '../tools/rc1-second-batch-source-compatibility.js';\n",
        "baseline": "import { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport {enterpriseCurrentHistorical6bSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { secondBatchSourceBaseline, assertSecondBatchSourceTransfer, SECOND_BATCH_SOURCE_DOMAINS } from '../tools/rc1-second-batch-source-compatibility.js';\n"
      },
      {
        "current": "for(const[file,d]of Object.entries(O.FIRST_BATCH_SOURCE_DOMAINS)){\n const revision=d.currentRevision??O.FIRST_BATCH_SOURCE_REVISION;\n assert.equal(d.currentRevision??null,file==='package.json'?'b34c79f9e43bd2960801f3ecc9a3426af5907d3a':null,'Only the two reviewed recovery script additions use a separate exact package revision');\n const raw=lf(cityActivitySourceBaseline(file,enterpriseCurrentHistorical6bSourceBaseline(file,continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8')))));if(Object.hasOwn(SECOND_BATCH_SOURCE_DOMAINS,file))assert.equal(assertSecondBatchSourceTransfer(file,raw).baselineText,secondBatchSourceBaseline(file,raw));const current=secondBatchSourceBaseline(file,raw),pinned=git('show',revision+':'+file);entire(current,pinned);entire(current,git('show',d.currentBlob));assert.equal(hash(current),d.currentSha256);hashes++;assert.equal(blob(current),d.currentBlob);blobs++;\n const proof=O.assertFirstBatchSourceTransfer(file,current);assert.equal(proof.sourceRevision,revision);entire(O.assertFirstBatchSourceTransfer(file,current.replaceAll('\\n','\\r\\n')).baselineText,proof.baselineText);\n const actualHunks=[];let chunk=null;for(const line of git('diff','--no-ext-diff','--unified=3',O.FIRST_BATCH_SOURCE_PREDECESSOR,revision,'--',file).split('\\n')){if(line.startsWith('@@')){chunk={current:'',baseline:''};actualHunks.push(chunk);}else if(chunk){if(line[0]==='+')chunk.current+=line.slice(1)+'\\n';else if(line[0]==='-')chunk.baseline+=line.slice(1)+'\\n';else if(line[0]===' '){chunk.current+=line.slice(1)+'\\n';chunk.baseline+=line.slice(1)+'\\n';}}}assert.deepEqual(d.inverses,d.predecessorAbsent?[]:actualHunks,'Only complete actual Git diff contexts are reversible');\n if(d.predecessorAbsent){assert(['src/content/company-production-quality.js','src/company-economy-contracts.js'].includes(file));assert.throws(()=>git('show',O.FIRST_BATCH_SOURCE_PREDECESSOR+':'+file));assert.equal(proof.baselineText,null);assert.equal(d.baselineSha256,null);assert.equal(d.baselineBlob,null);assert.deepEqual(d.inverses,[]);entire(O.firstBatchSourceBaseline(file,current),current);}\n",
        "baseline": "for(const[file,d]of Object.entries(O.FIRST_BATCH_SOURCE_DOMAINS)){\n const revision=d.currentRevision??O.FIRST_BATCH_SOURCE_REVISION;\n assert.equal(d.currentRevision??null,file==='package.json'?'b34c79f9e43bd2960801f3ecc9a3426af5907d3a':null,'Only the two reviewed recovery script additions use a separate exact package revision');\n const raw=lf(cityActivitySourceBaseline(file,enterpriseCurrentHistorical6bSourceBaseline(file,fs.readFileSync(file,'utf8'))));if(Object.hasOwn(SECOND_BATCH_SOURCE_DOMAINS,file))assert.equal(assertSecondBatchSourceTransfer(file,raw).baselineText,secondBatchSourceBaseline(file,raw));const current=secondBatchSourceBaseline(file,raw),pinned=git('show',revision+':'+file);entire(current,pinned);entire(current,git('show',d.currentBlob));assert.equal(hash(current),d.currentSha256);hashes++;assert.equal(blob(current),d.currentBlob);blobs++;\n const proof=O.assertFirstBatchSourceTransfer(file,current);assert.equal(proof.sourceRevision,revision);entire(O.assertFirstBatchSourceTransfer(file,current.replaceAll('\\n','\\r\\n')).baselineText,proof.baselineText);\n const actualHunks=[];let chunk=null;for(const line of git('diff','--no-ext-diff','--unified=3',O.FIRST_BATCH_SOURCE_PREDECESSOR,revision,'--',file).split('\\n')){if(line.startsWith('@@')){chunk={current:'',baseline:''};actualHunks.push(chunk);}else if(chunk){if(line[0]==='+')chunk.current+=line.slice(1)+'\\n';else if(line[0]==='-')chunk.baseline+=line.slice(1)+'\\n';else if(line[0]===' '){chunk.current+=line.slice(1)+'\\n';chunk.baseline+=line.slice(1)+'\\n';}}}assert.deepEqual(d.inverses,d.predecessorAbsent?[]:actualHunks,'Only complete actual Git diff contexts are reversible');\n if(d.predecessorAbsent){assert(['src/content/company-production-quality.js','src/company-economy-contracts.js'].includes(file));assert.throws(()=>git('show',O.FIRST_BATCH_SOURCE_PREDECESSOR+':'+file));assert.equal(proof.baselineText,null);assert.equal(d.baselineSha256,null);assert.equal(d.baselineBlob,null);assert.deepEqual(d.inverses,[]);entire(O.firstBatchSourceBaseline(file,current),current);}\n"
      }
    ]
  },
  "test/rc1-fourth-batch-source-compatibility.js": {
    "currentSha256": "29bceded012501d755a1da5cb20d84f73aad8e2caafa622369b12966a80a08ed",
    "currentBlob": "4235ff325dea11703918572facc7e19b21d49454",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "29bceded012501d755a1da5cb20d84f73aad8e2caafa622369b12966a80a08ed",
      "crlf": "d42de9afa94d72ace25ec9a28b1d7ccaaed1943faf4d94d37afc78d6e4c38ac1"
    },
    "predecessorAbsent": false,
    "baselineSha256": "1a3b606fdb3593293cf54c3a60564d850f2681ae21e0d8ff4cae4a22202a2215",
    "baselineBlob": "5c41e62df6f1c087c377666c4242273605374814",
    "baselineMode": "100644",
    "inverses": [
      {
        "current": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport { fifthBatchSourceBaseline } from '../tools/rc1-fifth-batch-source-compatibility.js';\n",
        "baseline": "import {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport { fifthBatchSourceBaseline } from '../tools/rc1-fifth-batch-source-compatibility.js';\n"
      },
      {
        "current": "\n// Legacy EOL normalization is intentionally unchanged; substantive full-caller drift must still refuse.\nconst worldFiles=['src/server.js','src/worker.js'];\nconst worldRead=file=>fifthBatchSourceBaseline(file,cityActivitySourceBaseline(file,(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))):continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))))).replaceAll('\\r\\n','\\n');\nawait verifyWorldRecoverySources({sourceRevision:O.FOURTH_BATCH_SOURCE_REVISION,readFile:worldRead});\nlet worldNegatives=0;\nfor(const file of worldFiles){const text=worldRead(file),d=O.FOURTH_BATCH_SOURCE_DOMAINS[file];const bads=[text+'\\n// unknown substantive change\\n',text.slice(1),text.replace(/\\S/,'?')];for(const h of d.inverses)bads.push(text.replace(h.current,''),text.replace(h.current,()=>h.current+h.current),text.replace(h.current,()=>h.current.replace(/\\S/,'?')));for(const bad of bads){await assert.rejects(()=>verifyWorldRecoverySources({sourceRevision:O.FOURTH_BATCH_SOURCE_REVISION,readFile:f=>f===file?bad:worldRead(f)}),file+' substantive mutation index '+bads.indexOf(bad));worldNegatives++;}}\n",
        "baseline": "\n// Legacy EOL normalization is intentionally unchanged; substantive full-caller drift must still refuse.\nconst worldFiles=['src/server.js','src/worker.js'];\nconst worldRead=file=>fifthBatchSourceBaseline(file,cityActivitySourceBaseline(file,(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,fs.readFileSync(file,'utf8')):fs.readFileSync(file,'utf8')))).replaceAll('\\r\\n','\\n');\nawait verifyWorldRecoverySources({sourceRevision:O.FOURTH_BATCH_SOURCE_REVISION,readFile:worldRead});\nlet worldNegatives=0;\nfor(const file of worldFiles){const text=worldRead(file),d=O.FOURTH_BATCH_SOURCE_DOMAINS[file];const bads=[text+'\\n// unknown substantive change\\n',text.slice(1),text.replace(/\\S/,'?')];for(const h of d.inverses)bads.push(text.replace(h.current,''),text.replace(h.current,()=>h.current+h.current),text.replace(h.current,()=>h.current.replace(/\\S/,'?')));for(const bad of bads){await assert.rejects(()=>verifyWorldRecoverySources({sourceRevision:O.FOURTH_BATCH_SOURCE_REVISION,readFile:f=>f===file?bad:worldRead(f)}),file+' substantive mutation index '+bads.indexOf(bad));worldNegatives++;}}\n"
      }
    ]
  },
  "test/rc1-game-employment-source-compatibility.js": {
    "currentSha256": "d1fedae49626838983bb5b35fed13b222093e34cda60dad3fabef9bc2b96f297",
    "currentBlob": "02a5e7815c51a636b8261f5b9d338eb927bf78d8",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "d1fedae49626838983bb5b35fed13b222093e34cda60dad3fabef9bc2b96f297",
      "crlf": "04a333f7c490614a09c2e4a593349174926632b7e88c5b1a04831b61589c44dd"
    },
    "predecessorAbsent": false,
    "baselineSha256": "647d2e28f5c7744db16576afd523c9e2b5bf3ce8e03cc566e07fc7e9342dfb06",
    "baselineBlob": "c9291eba5a96d77b885c6a3aa17f6b0dc2d5a1ec",
    "baselineMode": "100644",
    "inverses": [
      {
        "current": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport assert from 'node:assert/strict';\n",
        "baseline": "import {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport assert from 'node:assert/strict';\n"
      },
      {
        "current": "const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\\0`).update(text).digest('hex');\nlet completeTextComparisons = 0, sha256Comparisons = 0, blobComparisons = 0, negatives = 0, totalHunks = 2;\nconst entire = (actual, expected, message) => { assert.equal(actual, expected, message); completeTextComparisons++; };\nconst file = 'src/server.js', current = normalize(companyWorkflowSourceBaseline(file,cityGameplaySourceBaseline(file,cityActivitySourceBaseline(file,(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))):continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))))))), baseline = git('show', GAME_EMPLOYMENT_SOURCE_BASELINE_BLOBS[file]);\nassert.deepEqual(Object.keys(GAME_EMPLOYMENT_SOURCE_CURRENT_PINS), [file, 'src/invariants.js', 'src/social/estate.js'], 'Closed authorized source domains, no new worker scope');\nfor (const spec of [GAME_EMPLOYMENT_SOURCE_CURRENT_BLOBS[file], `${GAME_EMPLOYMENT_SOURCE_REVIEWED_REVISION}:${file}`, 'e9d2aa81c4547ec792efa7a75270c8afa98151db:src/server.js', '56ccfe6e03c8a1b161e3203179cc0fa2605a6d39:src/server.js']) entire(current, git('show', spec), 'Complete frozen employment runtime');\nentire(baseline, git('show', `${GAME_EMPLOYMENT_SOURCE_PREDECESSOR_REVISION}:${file}`), 'Complete N01 predecessor');\n",
        "baseline": "const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\\0`).update(text).digest('hex');\nlet completeTextComparisons = 0, sha256Comparisons = 0, blobComparisons = 0, negatives = 0, totalHunks = 2;\nconst entire = (actual, expected, message) => { assert.equal(actual, expected, message); completeTextComparisons++; };\nconst file = 'src/server.js', current = normalize(companyWorkflowSourceBaseline(file,cityGameplaySourceBaseline(file,cityActivitySourceBaseline(file,(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,fs.readFileSync(file,'utf8')):fs.readFileSync(file,'utf8')))))), baseline = git('show', GAME_EMPLOYMENT_SOURCE_BASELINE_BLOBS[file]);\nassert.deepEqual(Object.keys(GAME_EMPLOYMENT_SOURCE_CURRENT_PINS), [file, 'src/invariants.js', 'src/social/estate.js'], 'Closed authorized source domains, no new worker scope');\nfor (const spec of [GAME_EMPLOYMENT_SOURCE_CURRENT_BLOBS[file], `${GAME_EMPLOYMENT_SOURCE_REVIEWED_REVISION}:${file}`, 'e9d2aa81c4547ec792efa7a75270c8afa98151db:src/server.js', '56ccfe6e03c8a1b161e3203179cc0fa2605a6d39:src/server.js']) entire(current, git('show', spec), 'Complete frozen employment runtime');\nentire(baseline, git('show', `${GAME_EMPLOYMENT_SOURCE_PREDECESSOR_REVISION}:${file}`), 'Complete N01 predecessor');\n"
      },
      {
        "current": "  assert.throws(() => assertGameEmploymentSourceTransfer(file, changed), /source changed/); assert.throws(() => qualifyGameEmploymentSource(file, changed), /source changed/);\n  assert.throws(() => assertGameEmploymentSourceTransfer(file, changed.replaceAll('\\n', '\\r\\n')), /source changed/);\n  assert.throws(() => Deed.assertDeedServerCompatibility(changed), /source changed/);\n  await assert.rejects(() => verifyWorldRecoverySources({ sourceRevision: GAME_EMPLOYMENT_SOURCE_REVIEWED_REVISION, readFile: candidate => candidate === file ? changed : (hasEnterpriseOverRootSource(candidate)?enterpriseOverRootSourceBaseline(candidate,String(continuousCityHistoricalInput(candidate, fs.readFileSync(candidate)))):continuousCityHistoricalInput(candidate, fs.readFileSync(candidate))) }), /source changed/);\n  negatives++;\n}\nfor (const unknown of ['src/worker.js', 'src/gameemployment.js', 'toString']) {\n",
        "baseline": "  assert.throws(() => assertGameEmploymentSourceTransfer(file, changed), /source changed/); assert.throws(() => qualifyGameEmploymentSource(file, changed), /source changed/);\n  assert.throws(() => assertGameEmploymentSourceTransfer(file, changed.replaceAll('\\n', '\\r\\n')), /source changed/);\n  assert.throws(() => Deed.assertDeedServerCompatibility(changed), /source changed/);\n  await assert.rejects(() => verifyWorldRecoverySources({ sourceRevision: GAME_EMPLOYMENT_SOURCE_REVIEWED_REVISION, readFile: candidate => candidate === file ? changed : (hasEnterpriseOverRootSource(candidate)?enterpriseOverRootSourceBaseline(candidate,String(fs.readFileSync(candidate))):fs.readFileSync(candidate)) }), /source changed/);\n  negatives++;\n}\nfor (const unknown of ['src/worker.js', 'src/gameemployment.js', 'toString']) {\n"
      },
      {
        "current": "assert.deepEqual(WORLD_RECOVERY_REVIEW.gameEmploymentSourceReviewTransfer, GAME_EMPLOYMENT_SOURCE_TRANSFER);\nassert.deepEqual(WORLD_RECOVERY_REVIEW.companyOperatorSourceReviewTransfer, COMPANY_OPERATOR_SOURCE_TRANSFER);\nassert.match(GAME_EMPLOYMENT_SOURCE_TRANSFER.scope, /no worker, world-soak, native, financial, deployment or onchain qualification/);\nconst actual = await verifyWorldRecoverySources({ sourceRevision: GAME_EMPLOYMENT_SOURCE_REVIEWED_REVISION, readFile: candidate => (hasEnterpriseOverRootSource(candidate)?enterpriseOverRootSourceBaseline(candidate,String(continuousCityHistoricalInput(candidate, fs.readFileSync(candidate)))):continuousCityHistoricalInput(candidate, fs.readFileSync(candidate))) });\nconst historical = await verifyWorldRecoverySources({ sourceRevision: GAME_EMPLOYMENT_SOURCE_REVIEWED_REVISION, readFile: candidate => candidate === file ? baseline : (hasEnterpriseOverRootSource(candidate)?enterpriseOverRootSourceBaseline(candidate,String(continuousCityHistoricalInput(candidate, fs.readFileSync(candidate)))):continuousCityHistoricalInput(candidate, fs.readFileSync(candidate))) });\nassert.deepEqual(actual, historical, 'Historical qualification parity unchanged');\nfor (const sourceFile of ['src/invariants.js', 'src/social/estate.js']) {\n  const source = normalize(companyWorkflowSourceBaseline(sourceFile,cityGameplaySourceBaseline(sourceFile,cityActivitySourceBaseline(sourceFile,(hasEnterpriseOverRootSource(sourceFile)?enterpriseOverRootSourceBaseline(sourceFile,continuousCityHistoricalInput(sourceFile, fs.readFileSync(sourceFile,'utf8'))):continuousCityHistoricalInput(sourceFile, fs.readFileSync(sourceFile,'utf8'))))))), prior = git('show', GAME_EMPLOYMENT_SOURCE_BASELINE_BLOBS[sourceFile]);\n  entire(source, git('show', GAME_EMPLOYMENT_SOURCE_CURRENT_BLOBS[sourceFile])); entire(source, git('show', `${GAME_EMPLOYMENT_SOURCE_REVIEWED_REVISION}:${sourceFile}`));\n  entire(prior, git('show', `${GAME_EMPLOYMENT_SOURCE_PREDECESSOR_REVISION}:${sourceFile}`));\n  assert.equal(hash(source), GAME_EMPLOYMENT_SOURCE_CURRENT_PINS[sourceFile]); assert.equal(hash(prior), GAME_EMPLOYMENT_SOURCE_BASELINE_PINS[sourceFile]); sha256Comparisons += 2;\n",
        "baseline": "assert.deepEqual(WORLD_RECOVERY_REVIEW.gameEmploymentSourceReviewTransfer, GAME_EMPLOYMENT_SOURCE_TRANSFER);\nassert.deepEqual(WORLD_RECOVERY_REVIEW.companyOperatorSourceReviewTransfer, COMPANY_OPERATOR_SOURCE_TRANSFER);\nassert.match(GAME_EMPLOYMENT_SOURCE_TRANSFER.scope, /no worker, world-soak, native, financial, deployment or onchain qualification/);\nconst actual = await verifyWorldRecoverySources({ sourceRevision: GAME_EMPLOYMENT_SOURCE_REVIEWED_REVISION, readFile: candidate => (hasEnterpriseOverRootSource(candidate)?enterpriseOverRootSourceBaseline(candidate,String(fs.readFileSync(candidate))):fs.readFileSync(candidate)) });\nconst historical = await verifyWorldRecoverySources({ sourceRevision: GAME_EMPLOYMENT_SOURCE_REVIEWED_REVISION, readFile: candidate => candidate === file ? baseline : (hasEnterpriseOverRootSource(candidate)?enterpriseOverRootSourceBaseline(candidate,String(fs.readFileSync(candidate))):fs.readFileSync(candidate)) });\nassert.deepEqual(actual, historical, 'Historical qualification parity unchanged');\nfor (const sourceFile of ['src/invariants.js', 'src/social/estate.js']) {\n  const source = normalize(companyWorkflowSourceBaseline(sourceFile,cityGameplaySourceBaseline(sourceFile,cityActivitySourceBaseline(sourceFile,(hasEnterpriseOverRootSource(sourceFile)?enterpriseOverRootSourceBaseline(sourceFile,fs.readFileSync(sourceFile,'utf8')):fs.readFileSync(sourceFile,'utf8')))))), prior = git('show', GAME_EMPLOYMENT_SOURCE_BASELINE_BLOBS[sourceFile]);\n  entire(source, git('show', GAME_EMPLOYMENT_SOURCE_CURRENT_BLOBS[sourceFile])); entire(source, git('show', `${GAME_EMPLOYMENT_SOURCE_REVIEWED_REVISION}:${sourceFile}`));\n  entire(prior, git('show', `${GAME_EMPLOYMENT_SOURCE_PREDECESSOR_REVISION}:${sourceFile}`));\n  assert.equal(hash(source), GAME_EMPLOYMENT_SOURCE_CURRENT_PINS[sourceFile]); assert.equal(hash(prior), GAME_EMPLOYMENT_SOURCE_BASELINE_PINS[sourceFile]); sha256Comparisons += 2;\n"
      }
    ]
  },
  "test/rc1-intel-source-compatibility.js": {
    "currentSha256": "7bc1ffd4f2e64c43faf385241fe2a70dd46fde851aedcc1243844c5a322656dc",
    "currentBlob": "d7565980cc00ea431bbdbb2ece8ee7ef6b1b1c17",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "7bc1ffd4f2e64c43faf385241fe2a70dd46fde851aedcc1243844c5a322656dc",
      "crlf": "2009ee33ece3c820a3328df3851823f6ec6e30eaf310b499e3dc66f3f087978a"
    },
    "predecessorAbsent": false,
    "baselineSha256": "0f2b57e89e25b22ab2c46b4257cebe659be8071840163379757dd5391681680a",
    "baselineBlob": "628ba3aa0d67cd20068d6b035e40f6b802c47994",
    "baselineMode": "100644",
    "inverses": [
      {
        "current": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityHomesLeagueSourceBaseline } from '../tools/rc1-deed-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\n",
        "baseline": "import {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityHomesLeagueSourceBaseline } from '../tools/rc1-deed-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\n"
      },
      {
        "current": "const hash = text => crypto.createHash('sha256').update(text).digest('hex');\nlet chunks = 0, negatives = 0;\nfor (const file of Object.keys(INTEL_SOURCE_CURRENT_PINS)) {\n  const raw = normalize((hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String(continuousCityHistoricalInput(file, fs.readFileSync(file, 'utf8')))):continuousCityHistoricalInput(file, fs.readFileSync(file, 'utf8'))));\n  const compose = text => invoiceSourceBaseline(file, coverageSourceBaseline(file, strategySourceBaseline(file, companySuccessionSourceBaseline(file, marketFeedSourceBaseline(file, strategyLeagueSourceBaseline(file, cityHomesLeagueSourceBaseline(file, cityActivitySourceBaseline(file, text))))))));\n  const current = compose(raw), baseline = gitText(INTEL_SOURCE_BASELINE_BLOBS[file]);\n  const unknown = raw + '\\n// unreviewed composed source\\n';\n",
        "baseline": "const hash = text => crypto.createHash('sha256').update(text).digest('hex');\nlet chunks = 0, negatives = 0;\nfor (const file of Object.keys(INTEL_SOURCE_CURRENT_PINS)) {\n  const raw = normalize((hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String(fs.readFileSync(file, 'utf8'))):fs.readFileSync(file, 'utf8')));\n  const compose = text => invoiceSourceBaseline(file, coverageSourceBaseline(file, strategySourceBaseline(file, companySuccessionSourceBaseline(file, marketFeedSourceBaseline(file, strategyLeagueSourceBaseline(file, cityHomesLeagueSourceBaseline(file, cityActivitySourceBaseline(file, text))))))));\n  const current = compose(raw), baseline = gitText(INTEL_SOURCE_BASELINE_BLOBS[file]);\n  const unknown = raw + '\\n// unreviewed composed source\\n';\n"
      }
    ]
  },
  "test/rc1-invoice-source-compatibility.js": {
    "currentSha256": "811de5ddcba3857c62b7ccd4e5a1adcb18a850eb6be3fb259247b09cba9a950f",
    "currentBlob": "101707c4f82ce17a90fe739cf77a3428ebd107d9",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "811de5ddcba3857c62b7ccd4e5a1adcb18a850eb6be3fb259247b09cba9a950f",
      "crlf": "5ecb6f562e4beb036ae927a556b271503cff51ad5a6b65b5e8a7fcbc804524d8"
    },
    "predecessorAbsent": false,
    "baselineSha256": "5eb1d984cafa91496c9414617a2e667d50de845b6d449a69ec40b10a6717f6ba",
    "baselineBlob": "164662f9fc2c8afd637bcde80e5800e62ad493c6",
    "baselineMode": "100644",
    "inverses": [
      {
        "current": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { companyOperatorSourceBaseline } from '../tools/rc1-company-operator-source-compatibility.js';\nimport { cityHomesLeagueSourceBaseline } from '../tools/rc1-deed-source-compatibility.js';\n",
        "baseline": "import {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { companyOperatorSourceBaseline } from '../tools/rc1-company-operator-source-compatibility.js';\nimport { cityHomesLeagueSourceBaseline } from '../tools/rc1-deed-source-compatibility.js';\n"
      },
      {
        "current": "const hash = text => crypto.createHash('sha256').update(text).digest('hex');\nlet chunks = 0, negatives = 0;\nfor (const file of Object.keys(INVOICE_SOURCE_CURRENT_PINS)) {\n  const current = normalize(coverageSourceBaseline(file, strategySourceBaseline(file, companySuccessionSourceBaseline(file, marketFeedSourceBaseline(file, strategyLeagueSourceBaseline(file, cityHomesLeagueSourceBaseline(file, cityActivitySourceBaseline(file, (hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,continuousCityHistoricalInput(file, fs.readFileSync(file, 'utf8'))):continuousCityHistoricalInput(file, fs.readFileSync(file, 'utf8'))))))))))), baseline = gitText(INVOICE_SOURCE_BASELINE_BLOBS[file]);\n  assert.equal(invoiceSourceBaseline(file, current), baseline);\n  assert.equal(invoiceSourceBaseline(file, baseline), baseline);\n  const unknown = current + '\\n// unknown source suffix\\n';\n",
        "baseline": "const hash = text => crypto.createHash('sha256').update(text).digest('hex');\nlet chunks = 0, negatives = 0;\nfor (const file of Object.keys(INVOICE_SOURCE_CURRENT_PINS)) {\n  const current = normalize(coverageSourceBaseline(file, strategySourceBaseline(file, companySuccessionSourceBaseline(file, marketFeedSourceBaseline(file, strategyLeagueSourceBaseline(file, cityHomesLeagueSourceBaseline(file, cityActivitySourceBaseline(file, (hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,fs.readFileSync(file, 'utf8')):fs.readFileSync(file, 'utf8')))))))))), baseline = gitText(INVOICE_SOURCE_BASELINE_BLOBS[file]);\n  assert.equal(invoiceSourceBaseline(file, current), baseline);\n  assert.equal(invoiceSourceBaseline(file, baseline), baseline);\n  const unknown = current + '\\n// unknown source suffix\\n';\n"
      }
    ]
  },
  "test/rc1-lifecycle-applicability.js": {
    "currentSha256": "379844144acc3afc38e5b1571245057e37c31d401da68da89941e232ae2201bf",
    "currentBlob": "3d921fdb2ea7a691b0a12f80b733db3dd068ad54",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "379844144acc3afc38e5b1571245057e37c31d401da68da89941e232ae2201bf",
      "crlf": "54d3504ad6f5970f8737607e597eb1a4f1c5c8c5cf6e87ca37bc0985aebfabc8"
    },
    "predecessorAbsent": false,
    "baselineSha256": "004ba172a04693b3059388ce2556934e84b8755e96f7e916f6e19c65c9b6b094",
    "baselineBlob": "08a9f93537cf44abe3e3cff2ddb516c6ddacba5a",
    "baselineMode": "100644",
    "inverses": [
      {
        "current": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { isHistoricalSourceFixture, runHistoricalSourceFixture } from './lib/rc1-historical-source-fixture.js';\nimport { WORLD_RECOVERY_REVIEW } from '../tools/rc1-world-qualification.js';\n",
        "baseline": "import {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { isHistoricalSourceFixture, runHistoricalSourceFixture } from './lib/rc1-historical-source-fixture.js';\nimport { WORLD_RECOVERY_REVIEW } from '../tools/rc1-world-qualification.js';\n"
      },
      {
        "current": "  assert.equal(sha256(current), '89decd4437290888d81602171e6de006d26da6596985f150bc3caeebe2c210e5');\n  for (const supplied of [current, current.replaceAll('\\n', '\\r\\n'), current + '\\n// unreviewed C2 lifecycle source\\n']) {\n    await assert.rejects(verifyLifecycleSources({ sourceRevision: WORLD_RECOVERY_REVIEW.reviewedRevision,\n      readFile: async candidate => candidate === file ? supplied : (hasEnterpriseOverRootSource(candidate)?enterpriseOverRootSourceBaseline(candidate,String(continuousCityHistoricalInput(candidate, await fs.readFile(candidate)))):continuousCityHistoricalInput(candidate, await fs.readFile(candidate))) }),\n    /Lifecycle source changed: src\\/made.js/);\n  }\n  console.log('PASS: historical lifecycle source guard rejects exact C2, CRLF and tampering; current source is not admitted');\n",
        "baseline": "  assert.equal(sha256(current), '89decd4437290888d81602171e6de006d26da6596985f150bc3caeebe2c210e5');\n  for (const supplied of [current, current.replaceAll('\\n', '\\r\\n'), current + '\\n// unreviewed C2 lifecycle source\\n']) {\n    await assert.rejects(verifyLifecycleSources({ sourceRevision: WORLD_RECOVERY_REVIEW.reviewedRevision,\n      readFile: async candidate => candidate === file ? supplied : (hasEnterpriseOverRootSource(candidate)?enterpriseOverRootSourceBaseline(candidate,String(await fs.readFile(candidate))):fs.readFile(candidate)) }),\n    /Lifecycle source changed: src\\/made.js/);\n  }\n  console.log('PASS: historical lifecycle source guard rejects exact C2, CRLF and tampering; current source is not admitted');\n"
      }
    ]
  },
  "test/rc1-logistics-coverage-source-compatibility.js": {
    "currentSha256": "e0e01ae520f41a327ecbda74b737f230c65a43741eccd12e7b9bb974422298e7",
    "currentBlob": "3598816669dcea140927c4c83cf84a3d831dcbd3",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "e0e01ae520f41a327ecbda74b737f230c65a43741eccd12e7b9bb974422298e7",
      "crlf": "466910fc288f25871410c63cf1a5e6a28252b715f77f4dd47d9a6d187f68874e"
    },
    "predecessorAbsent": false,
    "baselineSha256": "b2dca6c986391f77100dd4949f0cde042741744213475ab751c351ba9ae4eeda",
    "baselineBlob": "6a164f23b03c211c268f7609139d962632edce25",
    "baselineMode": "100644",
    "inverses": [
      {
        "current": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport { cityHomesLeagueSourceBaseline } from '../tools/rc1-deed-source-compatibility.js';\n",
        "baseline": "import {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport { cityHomesLeagueSourceBaseline } from '../tools/rc1-deed-source-compatibility.js';\n"
      },
      {
        "current": "const hash = text => crypto.createHash('sha256').update(text).digest('hex');\nlet chunks = 0, negatives = 0;\nfor (const file of Object.keys(COVERAGE_SOURCE_CURRENT_PINS)) {\n  const current = normalize(strategySourceBaseline(file, companySuccessionSourceBaseline(file, marketFeedSourceBaseline(file, strategyLeagueSourceBaseline(file, cityHomesLeagueSourceBaseline(file, cityActivitySourceBaseline(file, (hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,continuousCityHistoricalInput(file, fs.readFileSync(file, 'utf8'))):continuousCityHistoricalInput(file, fs.readFileSync(file, 'utf8')))))))))), baseline = gitText(COVERAGE_SOURCE_BASELINE_BLOBS[file]);\n  assert.equal(coverageSourceBaseline(file, current), baseline);\n  assert.equal(coverageSourceBaseline(file, baseline), baseline);\n  const unknown = current + '\\n// unknown source suffix\\n';\n",
        "baseline": "const hash = text => crypto.createHash('sha256').update(text).digest('hex');\nlet chunks = 0, negatives = 0;\nfor (const file of Object.keys(COVERAGE_SOURCE_CURRENT_PINS)) {\n  const current = normalize(strategySourceBaseline(file, companySuccessionSourceBaseline(file, marketFeedSourceBaseline(file, strategyLeagueSourceBaseline(file, cityHomesLeagueSourceBaseline(file, cityActivitySourceBaseline(file, (hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,fs.readFileSync(file, 'utf8')):fs.readFileSync(file, 'utf8'))))))))), baseline = gitText(COVERAGE_SOURCE_BASELINE_BLOBS[file]);\n  assert.equal(coverageSourceBaseline(file, current), baseline);\n  assert.equal(coverageSourceBaseline(file, baseline), baseline);\n  const unknown = current + '\\n// unknown source suffix\\n';\n"
      }
    ]
  },
  "test/rc1-market-feed-source-compatibility.js": {
    "currentSha256": "3bab978fa743d883fdc4234564ff86fa95e8179abf602da70449bd11c75686c2",
    "currentBlob": "efc358efd94ef1f6eb4c8e0d8c59bf483db109e2",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "3bab978fa743d883fdc4234564ff86fa95e8179abf602da70449bd11c75686c2",
      "crlf": "a2deae23e6e281b2067b394a42163af5e81061a382bd818964d1c199b96679d8"
    },
    "predecessorAbsent": false,
    "baselineSha256": "174e919870a2a9a7a162a53157a986b0b950d72f2150dfcf005fcecf4f010722",
    "baselineBlob": "20e10f549549245180d32fbfe3e8d06f5575d3e4",
    "baselineMode": "100644",
    "inverses": [
      {
        "current": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport { cityHomesLeagueSourceBaseline } from '../tools/rc1-deed-source-compatibility.js';\n",
        "baseline": "import {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport { cityHomesLeagueSourceBaseline } from '../tools/rc1-deed-source-compatibility.js';\n"
      },
      {
        "current": "}\nlet chunks = 0, negatives = 0;\nfor (const file of Object.keys(MARKET_FEED_SOURCE_CURRENT_PINS)) {\n  const current = normalize(strategyLeagueSourceBaseline(file, cityHomesLeagueSourceBaseline(file, cityActivitySourceBaseline(file, (hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,continuousCityHistoricalInput(file, fs.readFileSync(file, 'utf8'))):continuousCityHistoricalInput(file, fs.readFileSync(file, 'utf8'))))))), baseline = gitText(MARKET_FEED_SOURCE_BASELINE_BLOBS[file]);\n  assert.equal(marketFeedSourceBaseline(file, current), baseline);\n  assert.equal(marketFeedSourceBaseline(file, baseline), baseline);\n  const unknown = current + '\\n// unknown source suffix\\n';\n",
        "baseline": "}\nlet chunks = 0, negatives = 0;\nfor (const file of Object.keys(MARKET_FEED_SOURCE_CURRENT_PINS)) {\n  const current = normalize(strategyLeagueSourceBaseline(file, cityHomesLeagueSourceBaseline(file, cityActivitySourceBaseline(file, (hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,fs.readFileSync(file, 'utf8')):fs.readFileSync(file, 'utf8')))))), baseline = gitText(MARKET_FEED_SOURCE_BASELINE_BLOBS[file]);\n  assert.equal(marketFeedSourceBaseline(file, current), baseline);\n  assert.equal(marketFeedSourceBaseline(file, baseline), baseline);\n  const unknown = current + '\\n// unknown source suffix\\n';\n"
      }
    ]
  },
  "test/rc1-second-batch-source-compatibility.js": {
    "currentSha256": "1fce0530564cca3a90f21c43f740c71e1405e689bc8d8eafde4284e232b3bbd0",
    "currentBlob": "987099e9ee99800383231e70bb4e4fcc6716361a",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "1fce0530564cca3a90f21c43f740c71e1405e689bc8d8eafde4284e232b3bbd0",
      "crlf": "e94085507a89f87f9d05be652e04c3ee69c493884acf4ec3822a008194980043"
    },
    "predecessorAbsent": false,
    "baselineSha256": "b007abea1a90f6eb3b396a03131fd2fe79ac2d95f9cdbf9a0dfa64543fe05076",
    "baselineBlob": "bc272b6d92a10ec76495d055ea53bd884e4eebb4",
    "baselineMode": "100644",
    "inverses": [
      {
        "current": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport { thirdBatchSourceBaseline } from '../tools/rc1-third-batch-source-compatibility.js';\n",
        "baseline": "import {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport { thirdBatchSourceBaseline } from '../tools/rc1-third-batch-source-compatibility.js';\n"
      },
      {
        "current": "const entire=(a,b)=>{assert.equal(a,b);texts++;};\nconst reject=(f,t)=>{assert.throws(()=>O.assertSecondBatchSourceTransfer(f,t));negatives++;entire(O.secondBatchSourceBaseline(f,t),lf(t));};\nfor(const [file,d] of Object.entries(O.SECOND_BATCH_SOURCE_DOMAINS)){\n const current=thirdBatchSourceBaseline(file,lf(cityActivitySourceBaseline(file,(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))):continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8')))))),prior=git('show',O.SECOND_BATCH_SOURCE_PREDECESSOR+':'+file);\n entire(current,git('show',O.SECOND_BATCH_SOURCE_REVISION+':'+file));entire(current,git('cat-file','blob',d.currentBlob));\n assert.equal(hash(current),d.currentSha256);hashes++;assert.equal(blob(current),d.currentBlob);blobs++;\n entire(prior,git('cat-file','blob',d.baselineBlob));assert.equal(hash(prior),d.baselineSha256);hashes++;assert.equal(blob(prior),d.baselineBlob);blobs++;\n",
        "baseline": "const entire=(a,b)=>{assert.equal(a,b);texts++;};\nconst reject=(f,t)=>{assert.throws(()=>O.assertSecondBatchSourceTransfer(f,t));negatives++;entire(O.secondBatchSourceBaseline(f,t),lf(t));};\nfor(const [file,d] of Object.entries(O.SECOND_BATCH_SOURCE_DOMAINS)){\n const current=thirdBatchSourceBaseline(file,lf(cityActivitySourceBaseline(file,(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,fs.readFileSync(file,'utf8')):fs.readFileSync(file,'utf8'))))),prior=git('show',O.SECOND_BATCH_SOURCE_PREDECESSOR+':'+file);\n entire(current,git('show',O.SECOND_BATCH_SOURCE_REVISION+':'+file));entire(current,git('cat-file','blob',d.currentBlob));\n assert.equal(hash(current),d.currentSha256);hashes++;assert.equal(blob(current),d.currentBlob);blobs++;\n entire(prior,git('cat-file','blob',d.baselineBlob));assert.equal(hash(prior),d.baselineSha256);hashes++;assert.equal(blob(prior),d.baselineBlob);blobs++;\n"
      }
    ]
  },
  "test/rc1-strategy-league-source-compatibility.js": {
    "currentSha256": "b09d4c64335e4dceed84c6d2c3d2393fe67bd1d22db4f1aa64adbf47d0e3f054",
    "currentBlob": "134df991ba32caabf4ab20ea505d99e05304abd6",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "b09d4c64335e4dceed84c6d2c3d2393fe67bd1d22db4f1aa64adbf47d0e3f054",
      "crlf": "56e7523c83f8e78ff552c939205b57690d9aa235be98301fc01b8d9ab3a2c606"
    },
    "predecessorAbsent": false,
    "baselineSha256": "91cfadad33111b5b526fed5d73b5e7bd89b7a53c206ee47a1569a9519a89cef0",
    "baselineBlob": "3bb0b0537c2d6edd043840b3129d963384f6bdbc",
    "baselineMode": "100644",
    "inverses": [
      {
        "current": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport { companyOperatorSourceBaseline } from '../tools/rc1-company-operator-source-compatibility.js';\n",
        "baseline": "import {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport { companyOperatorSourceBaseline } from '../tools/rc1-company-operator-source-compatibility.js';\n"
      },
      {
        "current": "const normalize = text => text.replaceAll('\\r\\n', '\\n');\nconst gitText = spec => normalize(execFileSync('git', ['show', spec], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));\nconst hash = text => crypto.createHash('sha256').update(text).digest('hex');\nconst homeRaw=companyOperatorSourceBaseline('src/server.js',cityGameplaySourceBaseline('src/server.js',normalize(cityActivitySourceBaseline('src/server.js',(hasEnterpriseOverRootSource('src/server.js')?enterpriseOverRootSourceBaseline('src/server.js',continuousCityHistoricalInput('src/server.js', fs.readFileSync('src/server.js','utf8'))):continuousCityHistoricalInput('src/server.js', fs.readFileSync('src/server.js','utf8')))))));\nconst homeProof=assertCityHomesLeagueServerTransfer(homeRaw);\nassert.equal(homeRaw,gitText(CITY_HOMES_LEAGUE_SERVER_BLOB));\nassert.equal(homeProof.baselineText,gitText(CITY_HOMES_LEAGUE_PREDECESSOR_SERVER_BLOB));\n",
        "baseline": "const normalize = text => text.replaceAll('\\r\\n', '\\n');\nconst gitText = spec => normalize(execFileSync('git', ['show', spec], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));\nconst hash = text => crypto.createHash('sha256').update(text).digest('hex');\nconst homeRaw=companyOperatorSourceBaseline('src/server.js',cityGameplaySourceBaseline('src/server.js',normalize(cityActivitySourceBaseline('src/server.js',(hasEnterpriseOverRootSource('src/server.js')?enterpriseOverRootSourceBaseline('src/server.js',fs.readFileSync('src/server.js','utf8')):fs.readFileSync('src/server.js','utf8'))))));\nconst homeProof=assertCityHomesLeagueServerTransfer(homeRaw);\nassert.equal(homeRaw,gitText(CITY_HOMES_LEAGUE_SERVER_BLOB));\nassert.equal(homeProof.baselineText,gitText(CITY_HOMES_LEAGUE_PREDECESSOR_SERVER_BLOB));\n"
      },
      {
        "current": "}\nlet chunks = 0, negatives = 0;\nfor (const file of Object.keys(STRATEGY_LEAGUE_SOURCE_CURRENT_PINS)) {\n  const current = normalize(cityHomesLeagueSourceBaseline(file, cityActivitySourceBaseline(file, (hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,continuousCityHistoricalInput(file, fs.readFileSync(file, 'utf8'))):continuousCityHistoricalInput(file, fs.readFileSync(file, 'utf8')))))), baseline = gitText(STRATEGY_LEAGUE_SOURCE_BASELINE_BLOBS[file]);\n  assert.equal(strategyLeagueSourceBaseline(file, current), baseline);\n  assert.equal(strategyLeagueSourceBaseline(file, baseline), baseline);\n  const unknown = current + '\\n// unknown source suffix\\n';\n",
        "baseline": "}\nlet chunks = 0, negatives = 0;\nfor (const file of Object.keys(STRATEGY_LEAGUE_SOURCE_CURRENT_PINS)) {\n  const current = normalize(cityHomesLeagueSourceBaseline(file, cityActivitySourceBaseline(file, (hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,fs.readFileSync(file, 'utf8')):fs.readFileSync(file, 'utf8'))))), baseline = gitText(STRATEGY_LEAGUE_SOURCE_BASELINE_BLOBS[file]);\n  assert.equal(strategyLeagueSourceBaseline(file, current), baseline);\n  assert.equal(strategyLeagueSourceBaseline(file, baseline), baseline);\n  const unknown = current + '\\n// unknown source suffix\\n';\n"
      }
    ]
  },
  "test/rc1-strategy-source-compatibility.js": {
    "currentSha256": "12650695bc6404335214b8988ec8abcd720abe7ee51f9eb44d23fbe87f9f3533",
    "currentBlob": "09b9e05a7bc890ba2254168f698fe672d78f9d26",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "12650695bc6404335214b8988ec8abcd720abe7ee51f9eb44d23fbe87f9f3533",
      "crlf": "b840adda0831f9d6122958c9a542d8da0f80e3b99acbe582955faca355ceb84a"
    },
    "predecessorAbsent": false,
    "baselineSha256": "8eb288323ba80de6b7e9ed8d1e0005fd0733fc068aaeac9c0240c7d846a3fd3c",
    "baselineBlob": "f676889cf4b5449abd20ba46af78e9975906117a",
    "baselineMode": "100644",
    "inverses": [
      {
        "current": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport { cityHomesLeagueSourceBaseline } from '../tools/rc1-deed-source-compatibility.js';\n",
        "baseline": "import {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport { cityHomesLeagueSourceBaseline } from '../tools/rc1-deed-source-compatibility.js';\n"
      },
      {
        "current": "const hash = text => crypto.createHash('sha256').update(text).digest('hex');\nlet chunks = 0, negatives = 0;\nfor (const file of Object.keys(STRATEGY_SOURCE_CURRENT_PINS)) {\n  const current = normalize(companySuccessionSourceBaseline(file, marketFeedSourceBaseline(file, strategyLeagueSourceBaseline(file, cityHomesLeagueSourceBaseline(file, cityActivitySourceBaseline(file, (hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,continuousCityHistoricalInput(file, fs.readFileSync(file, 'utf8'))):continuousCityHistoricalInput(file, fs.readFileSync(file, 'utf8'))))))))), baseline = gitText(STRATEGY_SOURCE_BASELINE_BLOBS[file]);\n  assert.equal(strategySourceBaseline(file, current), baseline);\n  assert.equal(strategySourceBaseline(file, baseline), baseline);\n  const unknown = current + '\\n// unknown source suffix\\n';\n",
        "baseline": "const hash = text => crypto.createHash('sha256').update(text).digest('hex');\nlet chunks = 0, negatives = 0;\nfor (const file of Object.keys(STRATEGY_SOURCE_CURRENT_PINS)) {\n  const current = normalize(companySuccessionSourceBaseline(file, marketFeedSourceBaseline(file, strategyLeagueSourceBaseline(file, cityHomesLeagueSourceBaseline(file, cityActivitySourceBaseline(file, (hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,fs.readFileSync(file, 'utf8')):fs.readFileSync(file, 'utf8')))))))), baseline = gitText(STRATEGY_SOURCE_BASELINE_BLOBS[file]);\n  assert.equal(strategySourceBaseline(file, current), baseline);\n  assert.equal(strategySourceBaseline(file, baseline), baseline);\n  const unknown = current + '\\n// unknown source suffix\\n';\n"
      }
    ]
  },
  "test/rc1-third-batch-source-compatibility.js": {
    "currentSha256": "53609b5a0ed566d95f9019f8c991ebd727ecdadf4b6d0e430a74300585a11dcb",
    "currentBlob": "656128d8b79487ec1d3a0c7aa20e57f2a3495da3",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "53609b5a0ed566d95f9019f8c991ebd727ecdadf4b6d0e430a74300585a11dcb",
      "crlf": "14c9bdaf4d0a7679679419c073d209de7e0883f9174d0c1368f9fde93f75cdb0"
    },
    "predecessorAbsent": false,
    "baselineSha256": "6919b63ab0a0dd4bb6c572a21f57bdcb8f5f6808b7557d6f2ab4ef8612fe44e8",
    "baselineBlob": "f8bb03a25c5879298d73a582a09f3847c27b38d9",
    "baselineMode": "100644",
    "inverses": [
      {
        "current": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport { fourthBatchSourceBaseline } from '../tools/rc1-fourth-batch-source-compatibility.js';\n",
        "baseline": "import {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport { fourthBatchSourceBaseline } from '../tools/rc1-fourth-batch-source-compatibility.js';\n"
      },
      {
        "current": "const entire=(a,b)=>{assert.equal(a,b);texts++;};\nconst reject=(f,t)=>{assert.throws(()=>O.assertThirdBatchSourceTransfer(f,t));negatives++;entire(O.thirdBatchSourceBaseline(f,t),lf(t));};\nfor(const [file,d] of Object.entries(O.THIRD_BATCH_SOURCE_DOMAINS)){\n const current=fourthBatchSourceBaseline(file,releaseSourceBaseline(file,lf(cityActivitySourceBaseline(file,(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))):continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))))))),prior=git('show',O.THIRD_BATCH_SOURCE_PREDECESSOR+':'+file);\n entire(current,git('show',O.THIRD_BATCH_SOURCE_REVISION+':'+file));entire(current,git('cat-file','blob',d.currentBlob));\n assert.equal(hash(current),d.currentSha256);hashes++;assert.equal(blob(current),d.currentBlob);blobs++;\n entire(prior,git('cat-file','blob',d.baselineBlob));assert.equal(hash(prior),d.baselineSha256);hashes++;assert.equal(blob(prior),d.baselineBlob);blobs++;\n",
        "baseline": "const entire=(a,b)=>{assert.equal(a,b);texts++;};\nconst reject=(f,t)=>{assert.throws(()=>O.assertThirdBatchSourceTransfer(f,t));negatives++;entire(O.thirdBatchSourceBaseline(f,t),lf(t));};\nfor(const [file,d] of Object.entries(O.THIRD_BATCH_SOURCE_DOMAINS)){\n const current=fourthBatchSourceBaseline(file,releaseSourceBaseline(file,lf(cityActivitySourceBaseline(file,(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,fs.readFileSync(file,'utf8')):fs.readFileSync(file,'utf8')))))),prior=git('show',O.THIRD_BATCH_SOURCE_PREDECESSOR+':'+file);\n entire(current,git('show',O.THIRD_BATCH_SOURCE_REVISION+':'+file));entire(current,git('cat-file','blob',d.currentBlob));\n assert.equal(hash(current),d.currentSha256);hashes++;assert.equal(blob(current),d.currentBlob);blobs++;\n entire(prior,git('cat-file','blob',d.baselineBlob));assert.equal(hash(prior),d.baselineSha256);hashes++;assert.equal(blob(prior),d.baselineBlob);blobs++;\n"
      }
    ]
  },
  "test/rc1-world-checkpoint-series.js": {
    "currentSha256": "0ca71a63f9e11aa23a8e9faad29731d151bd015253bced6a51732e8b0a24256b",
    "currentBlob": "a19e9569387ac938f1451e2653c9a2814f45b10d",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "0ca71a63f9e11aa23a8e9faad29731d151bd015253bced6a51732e8b0a24256b",
      "crlf": "94b9651ffdf6fc83bfe32b78b8367950d25f26dcd3389cb5500962b47a6252db"
    },
    "predecessorAbsent": false,
    "baselineSha256": "e527c52273c0f099edb243425ebcf4332a3b5d645ccf244e5e5b164c96578b0a",
    "baselineBlob": "39e3464d3ef252036260cde665a6c2e48740ce7e",
    "baselineMode": "100644",
    "inverses": [
      {
        "current": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport { enterpriseOverRootSourceBaseline, hasEnterpriseOverRootSource } from '../tools/enterprise-current-source-compatibility.js';\nimport { WORLD_RECOVERY_REVIEW } from '../tools/rc1-world-qualification.js';\nimport assert from 'node:assert/strict';\n",
        "baseline": "import { enterpriseOverRootSourceBaseline, hasEnterpriseOverRootSource } from '../tools/enterprise-current-source-compatibility.js';\nimport { WORLD_RECOVERY_REVIEW } from '../tools/rc1-world-qualification.js';\nimport assert from 'node:assert/strict';\n"
      },
      {
        "current": "import { reviewWorldCheckpointSeries } from '../tools/rc1-world-checkpoint-series.js';\n\nconst DAY = 86400000, hash = value => sha256(canonicalJson(value)), copy = value => structuredClone(value);\nconst source = await verifyWorldRecoverySources({ sourceRevision: WORLD_RECOVERY_REVIEW.reviewedRevision, readFile: async file => { const raw = continuousCityHistoricalInput(file, await fs.readFile(file)); return hasEnterpriseOverRootSource(file) ? Buffer.from(enterpriseOverRootSourceBaseline(file, String(raw))) : raw; } });\nconst manifest = JSON.parse(await fs.readFile('docs/release/readiness-work/scenario-manifest.json', 'utf8'));\nfunction fixture({ days = 90, missingDay = null, changedConcentration = false, growth = false, interiorGrowth = false, economyGap = false, earlyPartial = false, duplicateFinal = false } = {}) {\n  const files = new Map(), values = new Map(), configurationSha256 = hash('frozen configuration');\n",
        "baseline": "import { reviewWorldCheckpointSeries } from '../tools/rc1-world-checkpoint-series.js';\n\nconst DAY = 86400000, hash = value => sha256(canonicalJson(value)), copy = value => structuredClone(value);\nconst source = await verifyWorldRecoverySources({ sourceRevision: WORLD_RECOVERY_REVIEW.reviewedRevision, readFile: async file => { const raw = await fs.readFile(file); return hasEnterpriseOverRootSource(file) ? Buffer.from(enterpriseOverRootSourceBaseline(file, String(raw))) : raw; } });\nconst manifest = JSON.parse(await fs.readFile('docs/release/readiness-work/scenario-manifest.json', 'utf8'));\nfunction fixture({ days = 90, missingDay = null, changedConcentration = false, growth = false, interiorGrowth = false, economyGap = false, earlyPartial = false, duplicateFinal = false } = {}) {\n  const files = new Map(), values = new Map(), configurationSha256 = hash('frozen configuration');\n"
      }
    ]
  },
  "test/rc1-world-qualification.js": {
    "currentSha256": "ae4ba61a6eb2d08236a6cf221ff73c01e76715d36a68806d82930fc9ae863bc1",
    "currentBlob": "fefaabd887daf22e0ee70059e4c5629b4d26c91f",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "ae4ba61a6eb2d08236a6cf221ff73c01e76715d36a68806d82930fc9ae863bc1",
      "crlf": "56f40ffe496007fcf8acc25e4615f84e55f1d8a9794ef813b7d64893ff80a52b"
    },
    "predecessorAbsent": false,
    "baselineSha256": "d7cd0defc773c4b3aaef5ba10c9205eb846d76a1929ea4a50469f023b5789468",
    "baselineBlob": "d93e0f947d1aa2b323f24d1591a68b55829f768e",
    "baselineMode": "100644",
    "inverses": [
      {
        "current": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {enterpriseOverGuiSourceBaseline,enterpriseOverRootSourceBaseline,hasEnterpriseOverRootSource,ENTERPRISE_OVER_GUI_SOURCE_DOMAINS,ENTERPRISE_OVER_ROOT_SOURCE_DOMAINS,ENTERPRISE_OVER_ROOT_IDENTITY_SOURCES} from '../tools/enterprise-current-source-compatibility.js';\nimport { firstBatchSourceBaseline } from '../tools/rc1-first-batch-source-compatibility.js';\nimport { BUSINESS_SEASON_SOURCE_TRANSFER } from '../tools/rc1-business-season-source-compatibility.js';\n",
        "baseline": "import {enterpriseOverGuiSourceBaseline,enterpriseOverRootSourceBaseline,hasEnterpriseOverRootSource,ENTERPRISE_OVER_GUI_SOURCE_DOMAINS,ENTERPRISE_OVER_ROOT_SOURCE_DOMAINS,ENTERPRISE_OVER_ROOT_IDENTITY_SOURCES} from '../tools/enterprise-current-source-compatibility.js';\nimport { firstBatchSourceBaseline } from '../tools/rc1-first-batch-source-compatibility.js';\nimport { BUSINESS_SEASON_SOURCE_TRANSFER } from '../tools/rc1-business-season-source-compatibility.js';\n"
      },
      {
        "current": "async function readEnterpriseWorldSource(file, encoding) {\n  assert.equal(typeof file, 'string');\n  assert(encoding === undefined || encoding === 'utf8', 'Closed world source read encoding');\n  const raw = continuousCityHistoricalInput(file, await fs.readFile(file, encoding));\n  let selected;\n  if (Object.hasOwn(ENTERPRISE_OVER_GUI_SOURCE_DOMAINS, file)) {\n    selected = enterpriseOverGuiSourceBaseline(file, String(raw));\n",
        "baseline": "async function readEnterpriseWorldSource(file, encoding) {\n  assert.equal(typeof file, 'string');\n  assert(encoding === undefined || encoding === 'utf8', 'Closed world source read encoding');\n  const raw = await fs.readFile(file, encoding);\n  let selected;\n  if (Object.hasOwn(ENTERPRISE_OVER_GUI_SOURCE_DOMAINS, file)) {\n    selected = enterpriseOverGuiSourceBaseline(file, String(raw));\n"
      },
      {
        "current": "assert.deepEqual(CITY_ACTIVITY_MARKET_PACKAGE_INVERSES, CITY_ACTIVITY_PACKAGE_SOURCE_INVERSES);\nlet jointPositives = 0, jointRefusals = 0;\nfor (const [file, pin] of Object.entries(CITY_ACTIVITY_MARKET_SOURCE_DOMAINS)) {\n  const unionRaw = continuousCityHistoricalInput(file, await fs.readFile(file, 'utf8'));\n  const raw = enterpriseOverGuiSourceBaseline(file, unionRaw), current = raw.replaceAll('\\r\\n', '\\n');\n  const expected = readActivityBlob(CITY_ACTIVITY_MARKET_SOURCE_PREDECESSOR + ':' + file);\n  assert.equal(current, readActivityBlob(CITY_ACTIVITY_MARKET_SOURCE_REVISION + ':' + file));\n",
        "baseline": "assert.deepEqual(CITY_ACTIVITY_MARKET_PACKAGE_INVERSES, CITY_ACTIVITY_PACKAGE_SOURCE_INVERSES);\nlet jointPositives = 0, jointRefusals = 0;\nfor (const [file, pin] of Object.entries(CITY_ACTIVITY_MARKET_SOURCE_DOMAINS)) {\n  const unionRaw = await fs.readFile(file, 'utf8');\n  const raw = enterpriseOverGuiSourceBaseline(file, unionRaw), current = raw.replaceAll('\\r\\n', '\\n');\n  const expected = readActivityBlob(CITY_ACTIVITY_MARKET_SOURCE_PREDECESSOR + ':' + file);\n  assert.equal(current, readActivityBlob(CITY_ACTIVITY_MARKET_SOURCE_REVISION + ':' + file));\n"
      }
    ]
  },
  "test/release-source-transfer.js": {
    "currentSha256": "c51bd76a15cbee314761366fb0c843fb44f6b97e11e7db1646e3d75ab95028a3",
    "currentBlob": "3b4a152612354c160f34630b88445d91fc704e98",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "c51bd76a15cbee314761366fb0c843fb44f6b97e11e7db1646e3d75ab95028a3",
      "crlf": "1212b5ac0822fa1de32c2bfab484015f2e4b759d2e9aba748cf02bc1a82522e7"
    },
    "predecessorAbsent": false,
    "baselineSha256": "78cefb9a6d5794a330ac7d399783c6d1ceed16451f26577e091358ec1b5e369c",
    "baselineBlob": "66541c1b559e3d79ef17a10089a2d7e8ba523359",
    "baselineMode": "100644",
    "inverses": [
      {
        "current": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { economyReleaseSource } from '../tools/economy-release-composition.js';\n",
        "baseline": "import { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport { economyReleaseSource } from '../tools/economy-release-composition.js';\n"
      },
      {
        "current": "for (const [file, domain] of Object.entries(RELEASE_SOURCE_DOMAINS)) {\n  const current = git('show', RELEASE_SOURCE_REVISION + ':' + file);\n  const prior = git('show', RELEASE_SOURCE_PREDECESSOR + ':' + file);\n  entire(economyReleaseSource('main', file, cityPlaySourceBaseline(file, lf(cityActivitySourceBaseline(file,(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,continuousCityHistoricalInput(file, fs.readFileSync(file, 'utf8'))):continuousCityHistoricalInput(file, fs.readFileSync(file, 'utf8'))))))), current);\n  entire(current, git('cat-file', 'blob', domain.currentBlob));\n  entire(prior, git('cat-file', 'blob', domain.baselineBlob));\n  assert.equal(hash(current), domain.currentSha256); assert.equal(blob(current), domain.currentBlob);\n",
        "baseline": "for (const [file, domain] of Object.entries(RELEASE_SOURCE_DOMAINS)) {\n  const current = git('show', RELEASE_SOURCE_REVISION + ':' + file);\n  const prior = git('show', RELEASE_SOURCE_PREDECESSOR + ':' + file);\n  entire(economyReleaseSource('main', file, cityPlaySourceBaseline(file, lf(cityActivitySourceBaseline(file,(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,fs.readFileSync(file, 'utf8')):fs.readFileSync(file, 'utf8')))))), current);\n  entire(current, git('cat-file', 'blob', domain.currentBlob));\n  entire(prior, git('cat-file', 'blob', domain.baselineBlob));\n  assert.equal(hash(current), domain.currentSha256); assert.equal(blob(current), domain.currentBlob);\n"
      },
      {
        "current": "  cityNegatives++;\n};\nfor (const [file, domain] of Object.entries(CITY_PLAY_SOURCE_DOMAINS)) {\n  const current = economyReleaseSource('city', file, lf(cityActivitySourceBaseline(file,(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,continuousCityHistoricalInput(file, fs.readFileSync(file, 'utf8'))):continuousCityHistoricalInput(file, fs.readFileSync(file, 'utf8'))))));\n  const prior = git('show', CITY_PLAY_SOURCE_PREDECESSOR + ':' + file);\n  assert(Object.isFrozen(domain) && Object.isFrozen(domain.inverses));\n  assert.equal(hash(current), domain.currentSha256); assert.equal(blob(current), domain.currentBlob);\n",
        "baseline": "  cityNegatives++;\n};\nfor (const [file, domain] of Object.entries(CITY_PLAY_SOURCE_DOMAINS)) {\n  const current = economyReleaseSource('city', file, lf(cityActivitySourceBaseline(file,(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,fs.readFileSync(file, 'utf8')):fs.readFileSync(file, 'utf8')))));\n  const prior = git('show', CITY_PLAY_SOURCE_PREDECESSOR + ':' + file);\n  assert(Object.isFrozen(domain) && Object.isFrozen(domain.inverses));\n  assert.equal(hash(current), domain.currentSha256); assert.equal(blob(current), domain.currentBlob);\n"
      }
    ]
  }
});
