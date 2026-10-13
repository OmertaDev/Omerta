// Test/tool-only whole-source transfer. This reconstructs reviewed predecessor bytes; it does not qualify new gameplay authority.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const normalize = text => text.replaceAll('\r\n', '\n');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
const root = fileURLToPath(new URL('../', import.meta.url));
const parentTexts = new Map();
export const CITY_GAMEPLAY_SOURCE_PARENT_REVISIONS = Object.freeze([
  "425de0010a3ee3500870a04e796029d671f464ef"
]);
// Working-tree source pins are independent of the historical source revision. Only these complete files can transfer.
export const CITY_GAMEPLAY_SOURCE_CURRENT_PINS = Object.freeze({
  "package-lock.json": "dfad225d2578f0dddb07fe3888ec88e8b7fe380ee0395a7dfd5a305fa2a73ab1",
  "package.json": "69847139798a2d74a10c5a2fe0de8b505b69f8d9520ea6c4b5ab805b70712ae8",
  "schema.sql": "a80ab83a46480b0969546b6966911b13bda6a0d5cbc75b7336291bd1d704850a",
  "src/agentgateway.js": "ebd8cf8f05c6eb696912c9f5571c2bb9952f577155bd6c213c76e98bf2a6338d",
  "src/chain.js": "ce07b1723a4657326ea37ab40010843b711aa04834b14950ffc0e2568eb15110",
  "src/content/phase1-policy.js": "28b95d32649b4df8d748be2479b35e0bef467acfa039a49c6f5e28ba823f7296",
  "src/content/phase1.js": "8406dcc2f0f97fa44325455ec9d72866b8f04467aa6f523613961a4ecdca1d48",
  "src/crafting.js": "d35ee5bc9fa4d91fec3db3c303f4751f80703433cee24db170b275f84d59f286",
  "src/db.js": "a7f3eb1e7e5b35dc028b6765acdab78e4d04ae883a7a746bc8deec95db7bbe65",
  "src/deeds.js": "22ba152c0cb0814c9f155388fef8848ed6d1eeec9ca1ba1269cc5e5722763579",
  "src/invariants.js": "35b63417a338cca386eff1fabd4d5be95fe3adcec61ba7582bb9a646d06295f1",
  "src/items.js": "d9c03f41a35f2b62b8ddb2a049a5cc515c5d9b25a8d7515a38f01b664f19fa98",
  "src/mysteries.js": "7faa48d86f2cd18659f0a54080f99db18d9f05115b3f797808e2772c6f811091",
  "src/server.js": "a9947ce55044b785ab7d6fc39f03695336e82f3e691ba912e61eddc29e6273dd",
  "src/social/estate.js": "52fb24d52199b946a4cb0dc8c81fa7b21da88c8a1b094c0591c9bf86871a1e8e",
  "src/worldgraph-ui.js": "b8bb33c5ec1e8f45a12eb9d68fbaeab6dd95e999e06ae8e481f99201d4759829",
  "src/worldgraph-validate.js": "9db7733efb5d989aa852965036f3a77b4bdc0f434d3a10aa468c483bc90d7482"
});
export const CITY_GAMEPLAY_SOURCE_PARENT_PINS = Object.freeze({
  "package-lock.json": "32992eebfd5f5efee48809408ed358c0dc8f20df914331d487126f26b921d40b",
  "package.json": "b0ff963a3cdf27fec2b13408fa788570bb85732590c8a9ab877d021a78fa51be",
  "schema.sql": "1191b16bc1483a3d5376012752d0060b9a17d01b07ce76d5c10b2aa6d795fd5c",
  "src/agentgateway.js": "0345030983e2a0d3b0ce678c543245a3dfddb87b7422dc78fee443f6ad4aff12",
  "src/chain.js": "182ec8bbd6caef02e6c9084f6ec755333a0e40b554cad2367686865c4d52eae1",
  "src/content/phase1-policy.js": "344c7ffb1a73ae3744d8cfb764c1dfb7ae3d6c5ed53eb515b5c057c44e1d03db",
  "src/content/phase1.js": "566e9d8e7da6b3218ffbf71df2883f208e9e842183a00f2a17729f2913936e5d",
  "src/crafting.js": "a96d3117c5d03b47573eb4a2de7af769b29ade82e5e8a9e9f54300472073d5be",
  "src/db.js": "abaa10fd7e25ff0be9c204fc6c18e300b97ba7fe32d9d8fc61654293eebf4a46",
  "src/deeds.js": "05c92aee0dcda19201aecbc36b239e49ebd203f2ad4805dd9e7fab5683712c6b",
  "src/invariants.js": "c271e1b5fea11fe5f117c5d2283ce346271cb5a849aea07ccd4eecb26bc675d0",
  "src/items.js": "0172726d784cc9faa430280e91374b5f2296cb5294adfac19ae91f307c9f107a",
  "src/mysteries.js": "6fa63eb5239eb22a7a8fb7545a8310ed66dcc80506c893871d332d835c42ad49",
  "src/server.js": "35134b856e2b7a62efe63c8334c2684f1813e93469d42f0e456b71e4c6928b1d",
  "src/social/estate.js": "ad1e2ac1d41b0fcc4542717d75e433a572da69deeffe13788a36a3646e14d702",
  "src/worldgraph-ui.js": "6bf80df9302b011e8f8e0d2fec10f1cf0154fb273897dbbd56ec0fd0c30194d1",
  "src/worldgraph-validate.js": "9fc6e08020e5e7b454f7cfacaaac7897a0861c8727a17a542efb0fb15a52fdab"
});
export const CITY_GAMEPLAY_SOURCE_CURRENT_BLOBS = Object.freeze({
  "package-lock.json": "ad4e1feb29157f58f112d0977534ca949688d91f",
  "package.json": "1750248e2530b9c5d7ae5a0af61e05d025e1f87f",
  "schema.sql": "ada0cf5bb82daf08667a584e55a7641f879e3c8e",
  "src/agentgateway.js": "b8839913de47732610b578dbfbe5def2a65552b4",
  "src/chain.js": "dc022999473e6f659caa828cf664ca113a9ab1ec",
  "src/content/phase1-policy.js": "394c04dc04254d7940ac83a67777eeeff8adb6e2",
  "src/content/phase1.js": "4ed2a005e13eae04aa7c216eef1e1ecbe51e04c9",
  "src/crafting.js": "bf17382353118644e8f7191b76e4cd632788344c",
  "src/db.js": "7bda2b0adc69b1c6f348920acd1e8153c8e333dc",
  "src/deeds.js": "5fe7f2cff05c4a85b4320d5058d4ff3ec1bd4b3a",
  "src/invariants.js": "7b56207187c472b3b4465e711545f5a834f4ffa4",
  "src/items.js": "b36c6dec6898a3a29eaf7d4d18842ef8068c7a37",
  "src/mysteries.js": "c737b4bcfd9616bca6200a315f029ea68ff6689a",
  "src/server.js": "4861c65211bd43c1927b8ea78204a52ea86c3666",
  "src/social/estate.js": "0559adc99ba7b86e46aa339d5cb6070e6555c90e",
  "src/worldgraph-ui.js": "9bf9f7ae2573efca5a0f8505b0a5da28d87a9675",
  "src/worldgraph-validate.js": "24a34d664356c2c6db50a61ee10d7e1b910a1e9c"
});
export const CITY_GAMEPLAY_SOURCE_PARENT_BLOBS = Object.freeze({
  "package-lock.json": "f51548100a1d9b6db52838e2060ec6d1b1fb88e0",
  "package.json": "211d29a9e761e781d83a37333caddfdc92834f1e",
  "schema.sql": "69ed195e3d3ff0c2446f3711113c5cd05c0079f9",
  "src/agentgateway.js": "2a15e361870451bb85fe2391b87fc7dfed8de791",
  "src/chain.js": "1ef5475706a4e67ab302e082aa82607ae2cf6d77",
  "src/content/phase1-policy.js": "d33a31db0b6c73e5e02f55a71c1b3b9b4af2cbe0",
  "src/content/phase1.js": "153faba1612fa5cf9a82ca999a416aa09961ad23",
  "src/crafting.js": "bb98383d9085375d038fc4a1e848d4687312a630",
  "src/db.js": "e99e39679503978ea1e79a56a1b2a2f4776b8029",
  "src/deeds.js": "50a8691bcbc6ba9af2616c0543a2fe881d6577f4",
  "src/invariants.js": "48c231af05551bb5f4507f39beee0592b2426c08",
  "src/items.js": "2c9eb10021204d08b7489460be19d4a041577dd9",
  "src/mysteries.js": "447ecfd312dc452535c02d3573d938da915c27ec",
  "src/server.js": "68b4f7c94cb3710e6eff5debb6ef26f01c279613",
  "src/social/estate.js": "425cd1e0b8172d283e8c867523c13f4261c685a8",
  "src/worldgraph-ui.js": "ad2b6ab76a92685048e8475405f146bd2cb10bb0",
  "src/worldgraph-validate.js": "fa41720c406e78e9a8962a6420a719a31e42fecc"
});
// Complete incoming-main parents are distinct from the unchanged original 425 historical witnesses.
export const CITY_GAMEPLAY_SOURCE_MAIN_PARENT_REVISIONS = Object.freeze([
  "fb695d002198a67c68ff49df48469e033684e99c"
]);
export const CITY_GAMEPLAY_SOURCE_MAIN_PARENT_PINS = Object.freeze({
  "package-lock.json": "32992eebfd5f5efee48809408ed358c0dc8f20df914331d487126f26b921d40b",
  "package.json": "716e7688b2da69fa1a5e54f41191697ff521e8633afd5dff611684964bbf70d0",
  "schema.sql": "16ce88ad565d44e2cd3be13bc1e12ceae692825b2ad14314d9482851dd716913",
  "src/agentgateway.js": "2fc19c21341ff246d8dd21e9020199d4fc6c6d2112e178a41242521b5f2677cf",
  "src/chain.js": "182ec8bbd6caef02e6c9084f6ec755333a0e40b554cad2367686865c4d52eae1",
  "src/content/phase1-policy.js": "344c7ffb1a73ae3744d8cfb764c1dfb7ae3d6c5ed53eb515b5c057c44e1d03db",
  "src/content/phase1.js": "566e9d8e7da6b3218ffbf71df2883f208e9e842183a00f2a17729f2913936e5d",
  "src/crafting.js": "a96d3117c5d03b47573eb4a2de7af769b29ade82e5e8a9e9f54300472073d5be",
  "src/db.js": "abaa10fd7e25ff0be9c204fc6c18e300b97ba7fe32d9d8fc61654293eebf4a46",
  "src/deeds.js": "05c92aee0dcda19201aecbc36b239e49ebd203f2ad4805dd9e7fab5683712c6b",
  "src/invariants.js": "c2879af55021696e1bc358e34bb95794737b3846a54de22be393c29101c68743",
  "src/items.js": "0172726d784cc9faa430280e91374b5f2296cb5294adfac19ae91f307c9f107a",
  "src/mysteries.js": "6fa63eb5239eb22a7a8fb7545a8310ed66dcc80506c893871d332d835c42ad49",
  "src/server.js": "e0090465696793006f50496af54e7cea6146456b85d3c63a37de3844792a5536",
  "src/social/estate.js": "6db50d8cd63eb0341971c4447b2b2c4b7c4bc82b8c8a98abd6232ab361a92498",
  "src/worldgraph-ui.js": "6bf80df9302b011e8f8e0d2fec10f1cf0154fb273897dbbd56ec0fd0c30194d1",
  "src/worldgraph-validate.js": "9fc6e08020e5e7b454f7cfacaaac7897a0861c8727a17a542efb0fb15a52fdab"
});
export const CITY_GAMEPLAY_SOURCE_MAIN_PARENT_BLOBS = Object.freeze({
  "package-lock.json": "f51548100a1d9b6db52838e2060ec6d1b1fb88e0",
  "package.json": "a51e70121742e6fbe281e58dbc05733ece089b65",
  "schema.sql": "77e40854c8a19d16a0e178b2fb8a39392f12f00f",
  "src/agentgateway.js": "2de1f67b783f96bab4097e95e29cfbdfe4bc850e",
  "src/chain.js": "1ef5475706a4e67ab302e082aa82607ae2cf6d77",
  "src/content/phase1-policy.js": "d33a31db0b6c73e5e02f55a71c1b3b9b4af2cbe0",
  "src/content/phase1.js": "153faba1612fa5cf9a82ca999a416aa09961ad23",
  "src/crafting.js": "bb98383d9085375d038fc4a1e848d4687312a630",
  "src/db.js": "e99e39679503978ea1e79a56a1b2a2f4776b8029",
  "src/deeds.js": "50a8691bcbc6ba9af2616c0543a2fe881d6577f4",
  "src/invariants.js": "26ec65e64aa0c76519c2995df377c9529713fef4",
  "src/items.js": "2c9eb10021204d08b7489460be19d4a041577dd9",
  "src/mysteries.js": "447ecfd312dc452535c02d3573d938da915c27ec",
  "src/server.js": "4a33da610db9260f191c22ed678b4f9f2b68afdb",
  "src/social/estate.js": "3c1adee020c5804f871a9daffba3f01db185c12b",
  "src/worldgraph-ui.js": "ad2b6ab76a92685048e8475405f146bd2cb10bb0",
  "src/worldgraph-validate.js": "fa41720c406e78e9a8962a6420a719a31e42fecc"
});
// The exact latest-main parent is a separate witness; original 425 and fb pins remain unchanged.
export const CITY_GAMEPLAY_SOURCE_LATEST_MAIN_PARENT_REVISIONS = Object.freeze([
  "30f61aeb3dbb6deac89591b0fcd57d3f6b51574c"
]);
export const CITY_GAMEPLAY_SOURCE_LATEST_MAIN_PARENT_PINS = Object.freeze({
  "package-lock.json": "32992eebfd5f5efee48809408ed358c0dc8f20df914331d487126f26b921d40b",
  "package.json": "4a46e533d476fa264053d69a3a19da4f1c32dd919d7a9dd651185ad127ca292d",
  "schema.sql": "a8b5b750c2c3b6f99396bc0c210a75bc93dfe56b2af553b549c1d57424ce39a3",
  "src/agentgateway.js": "2fc19c21341ff246d8dd21e9020199d4fc6c6d2112e178a41242521b5f2677cf",
  "src/chain.js": "182ec8bbd6caef02e6c9084f6ec755333a0e40b554cad2367686865c4d52eae1",
  "src/content/phase1-policy.js": "344c7ffb1a73ae3744d8cfb764c1dfb7ae3d6c5ed53eb515b5c057c44e1d03db",
  "src/content/phase1.js": "566e9d8e7da6b3218ffbf71df2883f208e9e842183a00f2a17729f2913936e5d",
  "src/crafting.js": "a96d3117c5d03b47573eb4a2de7af769b29ade82e5e8a9e9f54300472073d5be",
  "src/db.js": "abaa10fd7e25ff0be9c204fc6c18e300b97ba7fe32d9d8fc61654293eebf4a46",
  "src/deeds.js": "05c92aee0dcda19201aecbc36b239e49ebd203f2ad4805dd9e7fab5683712c6b",
  "src/invariants.js": "c2879af55021696e1bc358e34bb95794737b3846a54de22be393c29101c68743",
  "src/items.js": "0172726d784cc9faa430280e91374b5f2296cb5294adfac19ae91f307c9f107a",
  "src/mysteries.js": "6fa63eb5239eb22a7a8fb7545a8310ed66dcc80506c893871d332d835c42ad49",
  "src/server.js": "d80acf5224ce62489cfcefd55d19dc5b3c6fc44912933b3f349b46cbbe46152c",
  "src/social/estate.js": "6db50d8cd63eb0341971c4447b2b2c4b7c4bc82b8c8a98abd6232ab361a92498",
  "src/worldgraph-ui.js": "6bf80df9302b011e8f8e0d2fec10f1cf0154fb273897dbbd56ec0fd0c30194d1",
  "src/worldgraph-validate.js": "9fc6e08020e5e7b454f7cfacaaac7897a0861c8727a17a542efb0fb15a52fdab"
});
export const CITY_GAMEPLAY_SOURCE_LATEST_MAIN_PARENT_BLOBS = Object.freeze({
  "package-lock.json": "f51548100a1d9b6db52838e2060ec6d1b1fb88e0",
  "package.json": "cc3649ddc16535be0daa5baf03f69979ad2cede6",
  "schema.sql": "dd6c8d919993ea9d69318dd1e249554cf87e8ff5",
  "src/agentgateway.js": "2de1f67b783f96bab4097e95e29cfbdfe4bc850e",
  "src/chain.js": "1ef5475706a4e67ab302e082aa82607ae2cf6d77",
  "src/content/phase1-policy.js": "d33a31db0b6c73e5e02f55a71c1b3b9b4af2cbe0",
  "src/content/phase1.js": "153faba1612fa5cf9a82ca999a416aa09961ad23",
  "src/crafting.js": "bb98383d9085375d038fc4a1e848d4687312a630",
  "src/db.js": "e99e39679503978ea1e79a56a1b2a2f4776b8029",
  "src/deeds.js": "50a8691bcbc6ba9af2616c0543a2fe881d6577f4",
  "src/invariants.js": "26ec65e64aa0c76519c2995df377c9529713fef4",
  "src/items.js": "2c9eb10021204d08b7489460be19d4a041577dd9",
  "src/mysteries.js": "447ecfd312dc452535c02d3573d938da915c27ec",
  "src/server.js": "02aefa2218757aac48a98583f713abacd720f57a",
  "src/social/estate.js": "3c1adee020c5804f871a9daffba3f01db185c12b",
  "src/worldgraph-ui.js": "ad2b6ab76a92685048e8475405f146bd2cb10bb0",
  "src/worldgraph-validate.js": "fa41720c406e78e9a8962a6420a719a31e42fecc"
});
export const CITY_GAMEPLAY_SOURCE_TRANSFER = Object.freeze({
  sourceState: 'exact pinned working-tree source', parentRevisions: CITY_GAMEPLAY_SOURCE_PARENT_REVISIONS,
  currentPins: CITY_GAMEPLAY_SOURCE_CURRENT_PINS, predecessorPins: CITY_GAMEPLAY_SOURCE_PARENT_PINS,
  mainParentRevisions: CITY_GAMEPLAY_SOURCE_MAIN_PARENT_REVISIONS, mainPredecessorPins: CITY_GAMEPLAY_SOURCE_MAIN_PARENT_PINS,
  mainPredecessorBlobs: CITY_GAMEPLAY_SOURCE_MAIN_PARENT_BLOBS,
  latestMainParentRevisions: CITY_GAMEPLAY_SOURCE_LATEST_MAIN_PARENT_REVISIONS,
  latestMainPredecessorPins: CITY_GAMEPLAY_SOURCE_LATEST_MAIN_PARENT_PINS, latestMainPredecessorBlobs: CITY_GAMEPLAY_SOURCE_LATEST_MAIN_PARENT_BLOBS,
  wholeBlobInverses: Object.freeze(Object.fromEntries(Object.keys(CITY_GAMEPLAY_SOURCE_CURRENT_PINS).map(file => [file, 1]))),
  scope: 'Source-only reconstruction of complete pinned 30f latest-main parent files before the exact Player Intel transfer, retaining complete pinned fb main parent files before exact Business Season, Commercial Reputation, Company Opportunity, Buyer Cooperative, Company Logistics Hub and Company Bank transfers, while retaining complete reviewed 425 premises/workflow predecessor files before the unchanged exact Commercial Premises, Company Workflow, Game Employment and Company Operator envelopes and City Homes/League/Feed/Succession/Strategy/Coverage/Invoice/Intel layers. ALL new gameplay/RPG/Home/NPC/PvE/token authority, current PostgreSQL, worker, migration, activation and deployment qualification remain outside this historical transfer; separate current-source proofs are required. Player Intel visibility, target discovery, consent, PvP and projections also require separate current-source proofs with no inherited native or deployment qualification. Premises/workflow/employment/payroll authority also requires separate current-source proofs. New gameplay, premises, workflow and employment modules and the current worker have no gameplay historical alias.',
});
function parentText(file, pins, blobs) {
  const sourceBlob = blobs[file];
  if (!parentTexts.has(sourceBlob)) {
    const text = execFileSync('git', ['cat-file', 'blob', sourceBlob],
      { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    assert.equal(hash(text), pins[file], 'Pinned gameplay predecessor full source changed: ' + file);
    assert.equal(blob(text), sourceBlob, 'Pinned gameplay predecessor Git blob changed: ' + file);
    parentTexts.set(sourceBlob, text);
  }
  return parentTexts.get(sourceBlob);
}
export function qualifyCityGameplaySource(file, input) {
  assert(Object.hasOwn(CITY_GAMEPLAY_SOURCE_CURRENT_PINS, file), 'Unknown gameplay source file: ' + file);
  assert.equal(typeof input, 'string', 'Gameplay source must be text: ' + file);
  const text = normalize(input), actualSha256 = hash(text), current = actualSha256 === CITY_GAMEPLAY_SOURCE_CURRENT_PINS[file];
  const latestParent = actualSha256 === CITY_GAMEPLAY_SOURCE_LATEST_MAIN_PARENT_PINS[file];
  const mainParent = actualSha256 === CITY_GAMEPLAY_SOURCE_MAIN_PARENT_PINS[file];
  assert(current || latestParent || mainParent || actualSha256 === CITY_GAMEPLAY_SOURCE_PARENT_PINS[file], 'City gameplay source changed: ' + file);
  const pins = current || latestParent ? CITY_GAMEPLAY_SOURCE_LATEST_MAIN_PARENT_PINS
    : mainParent ? CITY_GAMEPLAY_SOURCE_MAIN_PARENT_PINS : CITY_GAMEPLAY_SOURCE_PARENT_PINS;
  const blobs = current || latestParent ? CITY_GAMEPLAY_SOURCE_LATEST_MAIN_PARENT_BLOBS
    : mainParent ? CITY_GAMEPLAY_SOURCE_MAIN_PARENT_BLOBS : CITY_GAMEPLAY_SOURCE_PARENT_BLOBS;
  const revisions = current || latestParent ? CITY_GAMEPLAY_SOURCE_LATEST_MAIN_PARENT_REVISIONS
    : mainParent ? CITY_GAMEPLAY_SOURCE_MAIN_PARENT_REVISIONS : CITY_GAMEPLAY_SOURCE_PARENT_REVISIONS;
  const baselineText = parentText(file, pins, blobs), sourceBlob = current ? CITY_GAMEPLAY_SOURCE_CURRENT_BLOBS[file] : blobs[file];
  assert.equal(blob(text), sourceBlob, 'Complete gameplay source Git blob changed: ' + file);
  return { actualSha256, baselineText, baselineSha256: pins[file], sourceBlob, predecessorBlob: blobs[file],
    wholeBlobInverses: current ? 1 : 0, parentRevisions: revisions, sourceOnly: true };
}
export function cityGameplaySourceBaseline(file, input) {
  if (!Object.hasOwn(CITY_GAMEPLAY_SOURCE_CURRENT_PINS, file) || typeof input !== 'string') return input;
  const actual = hash(normalize(input));
  return actual === CITY_GAMEPLAY_SOURCE_CURRENT_PINS[file] || actual === CITY_GAMEPLAY_SOURCE_LATEST_MAIN_PARENT_PINS[file]
    || actual === CITY_GAMEPLAY_SOURCE_MAIN_PARENT_PINS[file]
    || actual === CITY_GAMEPLAY_SOURCE_PARENT_PINS[file] ? qualifyCityGameplaySource(file, input).baselineText : input;
}
