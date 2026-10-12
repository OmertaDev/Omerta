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
  "package.json": "d696fa15c58fb5979d91e34932845a2bf05682708570d7a30692b8c6e7966d9b",
  "schema.sql": "c397de35d2db4d9a979f2cb25d3cc379cb07370f72673549f8e5e6b7994ee0da",
  "src/agentgateway.js": "bf8c205be5db153c03fc1b784b395514833f9244ce4a42e2d4393820c415e9b4",
  "src/chain.js": "ce07b1723a4657326ea37ab40010843b711aa04834b14950ffc0e2568eb15110",
  "src/content/phase1-policy.js": "c5ccf95f3ccdff5d7485cb26e3a4b38c8fe1e0b38120f164fe0fb6aa5c8b5f44",
  "src/content/phase1.js": "88f23c44f6ed589d0f9c91c6b6be0035653d6c0754fd8183b55148eb2df6b96a",
  "src/crafting.js": "d35ee5bc9fa4d91fec3db3c303f4751f80703433cee24db170b275f84d59f286",
  "src/db.js": "8753bb1f90e55f9b6b239f205af552ac7f93a71989b51bb0892c598ffde15313",
  "src/deeds.js": "22ba152c0cb0814c9f155388fef8848ed6d1eeec9ca1ba1269cc5e5722763579",
  "src/invariants.js": "40cc78ba295c3a84d392cf609e4f4b0a0ed94dbbbddf6aedf6585be093a9d79c",
  "src/items.js": "d9c03f41a35f2b62b8ddb2a049a5cc515c5d9b25a8d7515a38f01b664f19fa98",
  "src/mysteries.js": "7faa48d86f2cd18659f0a54080f99db18d9f05115b3f797808e2772c6f811091",
  "src/server.js": "d4732793ee5f0c9725e4f5c3428a5a8a7f97c8e7c108dfa3b4b2499e73295844",
  "src/social/estate.js": "391afbe826e46eab780e50279682670a9f44694f280be13fc76d157c7f93700e",
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
  "package.json": "071a64486b42db8ce1413375736f39f0bb87da8c",
  "schema.sql": "3feffcf6ccb6229d244892d11ee2ae0587abb97f",
  "src/agentgateway.js": "72a9f9a2d83fb1a829a03f830b3d926570d88ff6",
  "src/chain.js": "dc022999473e6f659caa828cf664ca113a9ab1ec",
  "src/content/phase1-policy.js": "cef10bcbd3c21a50c44b2e3d7d6499dbee17112b",
  "src/content/phase1.js": "aa2ffed2557910616472f5d517c405c89c929545",
  "src/crafting.js": "bf17382353118644e8f7191b76e4cd632788344c",
  "src/db.js": "01a092d4c18666cb1a65fcb58051354c6e71a970",
  "src/deeds.js": "5fe7f2cff05c4a85b4320d5058d4ff3ec1bd4b3a",
  "src/invariants.js": "6fc9094b7029758884d2522e439fe45520494271",
  "src/items.js": "b36c6dec6898a3a29eaf7d4d18842ef8068c7a37",
  "src/mysteries.js": "c737b4bcfd9616bca6200a315f029ea68ff6689a",
  "src/server.js": "c828b9a93f1a18a09079b17f430e0ad4a607c844",
  "src/social/estate.js": "c5e8bc5e85c3c2c5c45dac545efb7f0e16970618",
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
export const CITY_GAMEPLAY_SOURCE_TRANSFER = Object.freeze({
  sourceState: 'exact pinned working-tree source', parentRevisions: CITY_GAMEPLAY_SOURCE_PARENT_REVISIONS,
  currentPins: CITY_GAMEPLAY_SOURCE_CURRENT_PINS, predecessorPins: CITY_GAMEPLAY_SOURCE_PARENT_PINS,
  wholeBlobInverses: Object.freeze(Object.fromEntries(Object.keys(CITY_GAMEPLAY_SOURCE_CURRENT_PINS).map(file => [file, 1]))),
  scope: 'Source-only reconstruction of complete reviewed 425 premises/workflow predecessor files before the unchanged exact Commercial Premises, Company Workflow, Game Employment and Company Operator envelopes and City Homes/League/Feed/Succession/Strategy/Coverage/Invoice/Intel layers. ALL new gameplay/RPG/Home/NPC/PvE/token authority, current PostgreSQL, worker, migration, activation and deployment qualification remain outside this historical transfer; separate current-source proofs are required. Premises/workflow/employment/payroll authority also requires separate current-source proofs. New gameplay, premises, workflow and employment modules and the current worker have no gameplay historical alias.',
});
function parentText(file) {
  if (!parentTexts.has(file)) {
    const text = execFileSync('git', ['cat-file', 'blob', CITY_GAMEPLAY_SOURCE_PARENT_BLOBS[file]],
      { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    assert.equal(hash(text), CITY_GAMEPLAY_SOURCE_PARENT_PINS[file], 'Pinned gameplay predecessor full source changed: ' + file);
    assert.equal(blob(text), CITY_GAMEPLAY_SOURCE_PARENT_BLOBS[file], 'Pinned gameplay predecessor Git blob changed: ' + file);
    parentTexts.set(file, text);
  }
  return parentTexts.get(file);
}
export function qualifyCityGameplaySource(file, input) {
  assert(Object.hasOwn(CITY_GAMEPLAY_SOURCE_CURRENT_PINS, file), 'Unknown gameplay source file: ' + file);
  assert.equal(typeof input, 'string', 'Gameplay source must be text: ' + file);
  const text = normalize(input), actualSha256 = hash(text), current = actualSha256 === CITY_GAMEPLAY_SOURCE_CURRENT_PINS[file];
  assert(current || actualSha256 === CITY_GAMEPLAY_SOURCE_PARENT_PINS[file], 'City gameplay source changed: ' + file);
  const baselineText = parentText(file);
  assert.equal(blob(text), current ? CITY_GAMEPLAY_SOURCE_CURRENT_BLOBS[file] : CITY_GAMEPLAY_SOURCE_PARENT_BLOBS[file],
    'Complete gameplay source Git blob changed: ' + file);
  return { actualSha256, baselineText, baselineSha256: CITY_GAMEPLAY_SOURCE_PARENT_PINS[file],
    sourceBlob: current ? CITY_GAMEPLAY_SOURCE_CURRENT_BLOBS[file] : CITY_GAMEPLAY_SOURCE_PARENT_BLOBS[file],
    predecessorBlob: CITY_GAMEPLAY_SOURCE_PARENT_BLOBS[file], wholeBlobInverses: current ? 1 : 0,
    parentRevisions: CITY_GAMEPLAY_SOURCE_PARENT_REVISIONS, sourceOnly: true };
}
export function cityGameplaySourceBaseline(file, input) {
  if (!Object.hasOwn(CITY_GAMEPLAY_SOURCE_CURRENT_PINS, file) || typeof input !== 'string') return input;
  const actual = hash(normalize(input));
  return actual === CITY_GAMEPLAY_SOURCE_CURRENT_PINS[file] || actual === CITY_GAMEPLAY_SOURCE_PARENT_PINS[file]
    ? qualifyCityGameplaySource(file, input).baselineText : input;
}
