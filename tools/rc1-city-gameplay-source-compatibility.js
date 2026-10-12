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
  "101cdaaec2d5f235102e3de839043ba1fef21f81",
  "8dbe85846035dc0fcdba76992834e411632c6f1b"
]);
// Working-tree source pins are independent of the historical source revision. Only these complete files can transfer.
export const CITY_GAMEPLAY_SOURCE_CURRENT_PINS = Object.freeze({
  "package-lock.json": "dfad225d2578f0dddb07fe3888ec88e8b7fe380ee0395a7dfd5a305fa2a73ab1",
  "package.json": "90f448d6535413a578556e803cb2b9579dc72aae2d63fb3c737c91ad77125013",
  "schema.sql": "3dc44972c997f4b59376f1a9052807beda9d6fc686facfded19ecadff6539a96",
  "src/agentgateway.js": "6ae9042114b2a152add059cd387f30fde7d0fe803fc6f11460a01ff706616a0d",
  "src/chain.js": "ce07b1723a4657326ea37ab40010843b711aa04834b14950ffc0e2568eb15110",
  "src/content/phase1-policy.js": "c5ccf95f3ccdff5d7485cb26e3a4b38c8fe1e0b38120f164fe0fb6aa5c8b5f44",
  "src/content/phase1.js": "88f23c44f6ed589d0f9c91c6b6be0035653d6c0754fd8183b55148eb2df6b96a",
  "src/crafting.js": "fa35a537aead0c2bfb5d70cfca9e74daf066da43286503c9f26fec5a79c4b946",
  "src/db.js": "8753bb1f90e55f9b6b239f205af552ac7f93a71989b51bb0892c598ffde15313",
  "src/deeds.js": "22ba152c0cb0814c9f155388fef8848ed6d1eeec9ca1ba1269cc5e5722763579",
  "src/invariants.js": "a68baeef375b92319bf72af491bb417b11f6d7bd723629634eb910e9165e2fbe",
  "src/items.js": "d9c03f41a35f2b62b8ddb2a049a5cc515c5d9b25a8d7515a38f01b664f19fa98",
  "src/mysteries.js": "fcea9d0f4bc8e2ccb6f5b7a76bec02b2c7f5517f27adcdf3922f81e4ca65d046",
  "src/server.js": "5f78ee7fde23caeda6fd2694fbead8998d994a33a8b5211c889de12303cb4ec0",
  "src/social/estate.js": "7bf929e08b96f1ca5f8807ee3f1e6dce5de9a0ec972891fea22af8ac7c375e27",
  "src/worldgraph-ui.js": "b8bb33c5ec1e8f45a12eb9d68fbaeab6dd95e999e06ae8e481f99201d4759829",
  "src/worldgraph-validate.js": "9db7733efb5d989aa852965036f3a77b4bdc0f434d3a10aa468c483bc90d7482"
});
export const CITY_GAMEPLAY_SOURCE_PARENT_PINS = Object.freeze({
  "package-lock.json": "32992eebfd5f5efee48809408ed358c0dc8f20df914331d487126f26b921d40b",
  "package.json": "ef1af611d47674547d76e61704dd789a4a479d903cbbbb8bc5b14528272bf3ea",
  "schema.sql": "2313bee0087bc90c5987ab6482d1cdc176a3060da8e24f487453a518d79a27c0",
  "src/agentgateway.js": "f1e0648de267567c6e261a4cbe5056dce26dc99b4bf79ff529d323495b8062d1",
  "src/chain.js": "182ec8bbd6caef02e6c9084f6ec755333a0e40b554cad2367686865c4d52eae1",
  "src/content/phase1-policy.js": "344c7ffb1a73ae3744d8cfb764c1dfb7ae3d6c5ed53eb515b5c057c44e1d03db",
  "src/content/phase1.js": "566e9d8e7da6b3218ffbf71df2883f208e9e842183a00f2a17729f2913936e5d",
  "src/crafting.js": "a96d3117c5d03b47573eb4a2de7af769b29ade82e5e8a9e9f54300472073d5be",
  "src/db.js": "abaa10fd7e25ff0be9c204fc6c18e300b97ba7fe32d9d8fc61654293eebf4a46",
  "src/deeds.js": "05c92aee0dcda19201aecbc36b239e49ebd203f2ad4805dd9e7fab5683712c6b",
  "src/invariants.js": "842de0a3927272aace7a262d56159336a0576079f855ae05f7ae111521373bc2",
  "src/items.js": "0172726d784cc9faa430280e91374b5f2296cb5294adfac19ae91f307c9f107a",
  "src/mysteries.js": "6fa63eb5239eb22a7a8fb7545a8310ed66dcc80506c893871d332d835c42ad49",
  "src/server.js": "b14c214336686192ab44fa84a1aec991b628ec551fcec129f8f584238b4a1068",
  "src/social/estate.js": "0cbeb5125f2cc7ba542db6ad3d357cb010dc4aff8330c628256687fba7ae45b6",
  "src/worldgraph-ui.js": "6bf80df9302b011e8f8e0d2fec10f1cf0154fb273897dbbd56ec0fd0c30194d1",
  "src/worldgraph-validate.js": "9fc6e08020e5e7b454f7cfacaaac7897a0861c8727a17a542efb0fb15a52fdab"
});
export const CITY_GAMEPLAY_SOURCE_CURRENT_BLOBS = Object.freeze({
  "package-lock.json": "ad4e1feb29157f58f112d0977534ca949688d91f",
  "package.json": "434fa8789834c02eca1e8e47d306bc7493191131",
  "schema.sql": "d217183d8d7d405d39d0d5f48108a98e91e4de90",
  "src/agentgateway.js": "46a37470bc35f26d404bbd666474e530bc2ff6be",
  "src/chain.js": "dc022999473e6f659caa828cf664ca113a9ab1ec",
  "src/content/phase1-policy.js": "cef10bcbd3c21a50c44b2e3d7d6499dbee17112b",
  "src/content/phase1.js": "aa2ffed2557910616472f5d517c405c89c929545",
  "src/crafting.js": "4f697a11ef70c1b86e088340e3ce53b587271c8c",
  "src/db.js": "01a092d4c18666cb1a65fcb58051354c6e71a970",
  "src/deeds.js": "5fe7f2cff05c4a85b4320d5058d4ff3ec1bd4b3a",
  "src/invariants.js": "5aaca87f077a336f879d6b806c73738f8d2a0d3b",
  "src/items.js": "b36c6dec6898a3a29eaf7d4d18842ef8068c7a37",
  "src/mysteries.js": "4e6aea5e5d0828705926cbdeb2767093cd04cf71",
  "src/server.js": "b2db3d401d42b0c108ace0a5866a2cfc1ef023d0",
  "src/social/estate.js": "fd091cf4d9628350af3b4cf23351ea7c0674ca7c",
  "src/worldgraph-ui.js": "9bf9f7ae2573efca5a0f8505b0a5da28d87a9675",
  "src/worldgraph-validate.js": "24a34d664356c2c6db50a61ee10d7e1b910a1e9c"
});
export const CITY_GAMEPLAY_SOURCE_PARENT_BLOBS = Object.freeze({
  "package-lock.json": "f51548100a1d9b6db52838e2060ec6d1b1fb88e0",
  "package.json": "3909741356cd7d23287006937264aef64a6269f6",
  "schema.sql": "ba2c528efe09153899c7fc1ef3c543d95b1f7285",
  "src/agentgateway.js": "e0e665f5581ce70479476377730f8459ccdce758",
  "src/chain.js": "1ef5475706a4e67ab302e082aa82607ae2cf6d77",
  "src/content/phase1-policy.js": "d33a31db0b6c73e5e02f55a71c1b3b9b4af2cbe0",
  "src/content/phase1.js": "153faba1612fa5cf9a82ca999a416aa09961ad23",
  "src/crafting.js": "bb98383d9085375d038fc4a1e848d4687312a630",
  "src/db.js": "e99e39679503978ea1e79a56a1b2a2f4776b8029",
  "src/deeds.js": "50a8691bcbc6ba9af2616c0543a2fe881d6577f4",
  "src/invariants.js": "03644c4b806b972d93d2500afd1da69c6823abbc",
  "src/items.js": "2c9eb10021204d08b7489460be19d4a041577dd9",
  "src/mysteries.js": "447ecfd312dc452535c02d3573d938da915c27ec",
  "src/server.js": "e0786401d991101ed47d949747b8603b512ec882",
  "src/social/estate.js": "e1b23d51ae0e9b77534e06e6df72a4a2f2357cea",
  "src/worldgraph-ui.js": "ad2b6ab76a92685048e8475405f146bd2cb10bb0",
  "src/worldgraph-validate.js": "fa41720c406e78e9a8962a6420a719a31e42fecc"
});
export const CITY_GAMEPLAY_SOURCE_TRANSFER = Object.freeze({
  sourceState: 'exact pinned working-tree source', parentRevisions: CITY_GAMEPLAY_SOURCE_PARENT_REVISIONS,
  currentPins: CITY_GAMEPLAY_SOURCE_CURRENT_PINS, predecessorPins: CITY_GAMEPLAY_SOURCE_PARENT_PINS,
  wholeBlobInverses: Object.freeze(Object.fromEntries(Object.keys(CITY_GAMEPLAY_SOURCE_CURRENT_PINS).map(file => [file, 1]))),
  scope: 'Source-only reconstruction of complete reviewed operator101/8dbe predecessor files before the unchanged exact Company Operator envelope and City Homes/League/Feed/Succession/Strategy/Coverage/Invoice/Intel layers. ALL new gameplay/RPG/Home/NPC/PvE/token authority, current PostgreSQL, worker, migration, activation and deployment qualification remain outside this historical transfer; separate current-source proofs are required. New gameplay modules have no historical alias.',
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
