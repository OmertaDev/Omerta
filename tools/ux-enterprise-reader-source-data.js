// One immutable Enterprise test-reader mapping. Source-only; native capture reads actual bytes.
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const UX_ENTERPRISE_READER_SOURCE = freeze({
  "version": 1,
  "status": "SEALED",
  "phase": "EXACT_UX_ENTERPRISE_READER_SOURCE_ONLY",
  "revision": "79b1c6dbfaa4f7046ae8e62da32d4e3a2d312c58",
  "tree": "be50116546d52c493572a3e1e683be26da6e071d",
  "targetRevision": "c6247976ff71e8d4c103ebd1498c2d373217d077",
  "targetTree": "cebc1a714722b5c25e8a66d1121daef42769a6bb",
  "contextLines": 3,
  "files": [
    {
      "file": "test/enterprise-release-phase2-migration-catalog.js",
      "mode": "100644",
      "targetMode": "100644",
      "currentBlob": "1047f357293cf4b61689f38be0ff9a90c9722f8f",
      "currentSha256": "ac187cb4540fca23dc748c052885aa17cdba41ec672c878313d264e073d9cf18",
      "currentRawSha256": {
        "lf": "ac187cb4540fca23dc748c052885aa17cdba41ec672c878313d264e073d9cf18",
        "crlf": "402795af589062202c4f3df1240c44fa614446d11636d97aa4cdac19a507c5da"
      },
      "currentBytes": 30957,
      "targetBlob": "8db275cac3a74e2eee02b0674ac9426f27c71ca4",
      "targetSha256": "499748c0c688c3f40ec185cd8cf538a7e1dde717c1ed4a8f98b046982120741f",
      "targetBytes": 30822,
      "inverses": [
        {
          "current": "import crypto from 'node:crypto';\nimport {isDeepStrictEqual} from 'node:util';\nimport {execFileSync} from 'node:child_process';\nimport {uxHistoricalInput} from '../tools/ux-source-compatibility.js';\n\nassert.equal(process.execArgv.length,0,'Only the bare Node test entrypoint is admitted');\nconst native=process.argv.length===3&&process.argv[2]==='--postgres';\n",
          "baseline": "import crypto from 'node:crypto';\nimport {isDeepStrictEqual} from 'node:util';\nimport {execFileSync} from 'node:child_process';\n\nassert.equal(process.execArgv.length,0,'Only the bare Node test entrypoint is admitted');\nconst native=process.argv.length===3&&process.argv[2]==='--postgres';\n"
        },
        {
          "current": "const hash=text=>crypto.createHash('sha256').update(text).digest('hex');\nconst frozenText=(relative,expected)=>{const raw=fs.readFileSync(new URL(relative,import.meta.url),'utf8');assert(uniform(raw),'Only exact LF or uniform checkout CRLF');const text=lf(raw);assert.equal(hash(text),expected,'Complete reviewed source remains exact: '+relative);return text;};\n// Explicit current-Commerce dispatch in the same original Enterprise16 catalog slot.\nconst dispatchSchema=uxHistoricalInput('schema.sql',fs.readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));assert(uniform(dispatchSchema));\nconst commerceCurrent=hash(lf(dispatchSchema))==='ce98d276e71072975bd745f43205fa21bcfe2f3bc163b26f08eea4c6f0dac97c';\nconst commerceDeedCurrent=hash(lf(dispatchSchema))==='833373245ddb1ce5a3c9ed386a9b3245d81ddb0bdb51e75d1e5ffee2a7684335';\nif(commerceDeedCurrent){\n",
          "baseline": "const hash=text=>crypto.createHash('sha256').update(text).digest('hex');\nconst frozenText=(relative,expected)=>{const raw=fs.readFileSync(new URL(relative,import.meta.url),'utf8');assert(uniform(raw),'Only exact LF or uniform checkout CRLF');const text=lf(raw);assert.equal(hash(text),expected,'Complete reviewed source remains exact: '+relative);return text;};\n// Explicit current-Commerce dispatch in the same original Enterprise16 catalog slot.\nconst dispatchSchema=fs.readFileSync(new URL('../schema.sql',import.meta.url),'utf8');assert(uniform(dispatchSchema));\nconst commerceCurrent=hash(lf(dispatchSchema))==='ce98d276e71072975bd745f43205fa21bcfe2f3bc163b26f08eea4c6f0dac97c';\nconst commerceDeedCurrent=hash(lf(dispatchSchema))==='833373245ddb1ce5a3c9ed386a9b3245d81ddb0bdb51e75d1e5ffee2a7684335';\nif(commerceDeedCurrent){\n"
        },
        {
          "current": "assert.equal(sources.predecessor,old.predecessor+append);\nfor(const input of[sources.current,sources.current.replaceAll('\\n','\\r\\n')])assert.equal(enterpriseMigrationPredecessor(input),sources.predecessor);\nfor(const input of[sources.predecessor,sources.predecessor.replaceAll('\\n','\\r\\n')])assert.equal(enterpriseNativeHistoricalPredecessor(input),prior.marketOperationsNativeHistoricalPredecessor(old.predecessor));\nconst actualSchema=uxHistoricalInput('schema.sql',fs.readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));assert(uniform(actualSchema));const currentDeed=enterprise.enterpriseCurrentDeedSources(actualSchema);assert.equal(currentDeed.predecessor,sources.current);assert.throws(()=>historicalEnterprise.enterpriseMigrationPredecessor(actualSchema),error=>error?.code==='ERR_ASSERTION','Raw555 never gains historical551 admission');\nconst currentDeedBranches=enterprise.enterpriseCurrentDeedNativeSources();assert.equal(lf(actualSchema),currentDeedBranches.current);assert.equal(hash(currentDeedBranches.premain),'5cba5f46e5b29c9a4e46e8172ef4d025db388f468f0d3789a0ae359c4812b480');\nassert.deepEqual(ENTERPRISE_TABLES,['workshop_floorplans','workshop_floor_requests','manufacturing_licenses','manufacturing_license_requests','mobile_shops','mobile_shop_requests','business_relocation_plans','business_relocation_requests','equipment_recovery_requests']);\nassert.deepEqual(ENTERPRISE_NATIVE_TABLES,[...prior.MARKET_OPERATIONS_NATIVE_TABLES,...ENTERPRISE_TABLES]);assert.equal(ENTERPRISE_NATIVE_TABLES.length,23);\n",
          "baseline": "assert.equal(sources.predecessor,old.predecessor+append);\nfor(const input of[sources.current,sources.current.replaceAll('\\n','\\r\\n')])assert.equal(enterpriseMigrationPredecessor(input),sources.predecessor);\nfor(const input of[sources.predecessor,sources.predecessor.replaceAll('\\n','\\r\\n')])assert.equal(enterpriseNativeHistoricalPredecessor(input),prior.marketOperationsNativeHistoricalPredecessor(old.predecessor));\nconst actualSchema=fs.readFileSync(new URL('../schema.sql',import.meta.url),'utf8');assert(uniform(actualSchema));const currentDeed=enterprise.enterpriseCurrentDeedSources(actualSchema);assert.equal(currentDeed.predecessor,sources.current);assert.throws(()=>historicalEnterprise.enterpriseMigrationPredecessor(actualSchema),error=>error?.code==='ERR_ASSERTION','Raw555 never gains historical551 admission');\nconst currentDeedBranches=enterprise.enterpriseCurrentDeedNativeSources();assert.equal(lf(actualSchema),currentDeedBranches.current);assert.equal(hash(currentDeedBranches.premain),'5cba5f46e5b29c9a4e46e8172ef4d025db388f468f0d3789a0ae359c4812b480');\nassert.deepEqual(ENTERPRISE_TABLES,['workshop_floorplans','workshop_floor_requests','manufacturing_licenses','manufacturing_license_requests','mobile_shops','mobile_shop_requests','business_relocation_plans','business_relocation_requests','equipment_recovery_requests']);\nassert.deepEqual(ENTERPRISE_NATIVE_TABLES,[...prior.MARKET_OPERATIONS_NATIVE_TABLES,...ENTERPRISE_TABLES]);assert.equal(ENTERPRISE_NATIVE_TABLES.length,23);\n"
        }
      ]
    }
  ]
});
export const UX_ENTERPRISE_READER_SOURCE_SHA256 = "7ec9688b652d2f20f72a97b56073c337c99f4383156931331178eb2e28fc84ed";
