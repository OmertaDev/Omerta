// Exact immutable Director reader successor. Source-only; no native or runtime admission.
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const UX_DIRECTOR_READER_SOURCE = freeze({
  "version": 1,
  "status": "SEALED",
  "phase": "EXACT_UX_DIRECTOR_READER_SOURCE_ONLY",
  "revision": "c6dd6c9730c9111a7af5bb47ce290f605d08269c",
  "tree": "637ac47103f0aeb58c054e0f46cf55bdb9f91d7d",
  "targetRevision": "8b6c4f73e691e9ab6518f1539da464d1af17026f",
  "targetTree": "ef8c102efef3d3314bca7e2de8376cd0364b1d63",
  "contextLines": 3,
  "files": [
    {
      "file": "test/director-migration.js",
      "mode": "100644",
      "targetMode": "100644",
      "currentBlob": "9eb82570be54526ef3bc826c4c2a0e2a20d116df",
      "currentSha256": "bb610dbe1896464decb76978079395000363217e377d529d3d25a7f56237e08c",
      "currentRawSha256": {
        "lf": "bb610dbe1896464decb76978079395000363217e377d529d3d25a7f56237e08c",
        "crlf": "0295913a45e446faf34a08d50a71684da3c73abb8ccdfc6c74389fa102b5d433"
      },
      "currentBytes": 63438,
      "targetBlob": "beee063d52c4b817c655475204ea30e6807c823a",
      "targetSha256": "5174ae4d7f531d21520b3356d3dc0407fe465490e6f661fe0b2ae3eee068cddd",
      "targetBytes": 63449,
      "inverses": [
        {
          "current": "import pg from 'pg';\nimport { equipmentEconomyMigrationProjection, EQUIPMENT_ECONOMY_MIGRATION_TABLES } from './lib/equipment-economy-migration-catalog.js';\nimport { createCommerceReleasePhase2MigrationCatalog, readCommerceReleasePhase2Metadata,\n  verifyCommerceReleasePhase2CausalNegatives, COMMERCE_NATIVE_TABLES } from '../tools/ux-release-phase2-native-catalog.js';\nimport { dbCaps, migrateSchemaUnderLock } from '../src/db.js';\nimport { withCharacter, travel } from '../src/game.js';\nimport { boostCar } from '../src/economy.js';\n",
          "baseline": "import pg from 'pg';\nimport { equipmentEconomyMigrationProjection, EQUIPMENT_ECONOMY_MIGRATION_TABLES } from './lib/equipment-economy-migration-catalog.js';\nimport { createCommerceReleasePhase2MigrationCatalog, readCommerceReleasePhase2Metadata,\n  verifyCommerceReleasePhase2CausalNegatives, COMMERCE_NATIVE_TABLES } from '../tools/commerce-deed-release-phase2-native-catalog.js';\nimport { dbCaps, migrateSchemaUnderLock } from '../src/db.js';\nimport { withCharacter, travel } from '../src/game.js';\nimport { boostCar } from '../src/economy.js';\n"
        }
      ]
    }
  ]
});
export const UX_DIRECTOR_READER_SOURCE_SHA256 = "8b11dff91c4f1c0a872fadfb5c1a78d72ab097b74643233cb6243ecb32d26d47";
