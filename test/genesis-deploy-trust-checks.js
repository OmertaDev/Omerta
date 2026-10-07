import assert from 'node:assert/strict';
import { keccak256, toHex } from 'viem';
import { compilerSourceSha256, firstDifference, trustedAssetDifference, bytecodeDifference } from '../tools/genesis-deploy-trust-checks.js';
const lf = Buffer.from('pragma solidity 0.8.26;\ncontract A {}\n');
const crlf = Buffer.from(lf.toString().replace(/\n/g, '\r\n'));
const expectedInput = keccak256(toHex(lf));
assert.equal(compilerSourceSha256(lf, expectedInput), compilerSourceSha256(crlf, expectedInput));
assert.throws(() => compilerSourceSha256(crlf, keccak256(toHex(crlf))), /canonical LF/);
assert.throws(() => compilerSourceSha256(Buffer.from('pragma solidity 0.8.26;\ncontract B {}\n'), expectedInput), /canonical LF/);
const moduleBytes = (code, hashes = { 'lib/A.sol': 'ab' }) => Buffer.from(
  `export const TRUSTED_HOOK = Object.freeze(${JSON.stringify({ sourceHashes: hashes, creationBytecode: code })});\n`
  + 'export const TRUSTED_CREATIONS = Object.freeze({});\n');
assert.match(trustedAssetDifference(moduleBytes('0x6000'), moduleBytes('0x6001')), /TRUSTED_HOOK.creationBytecode/);
assert.match(trustedAssetDifference(moduleBytes('0x6000'), moduleBytes('0x6000', { 'lib/A.sol': 'cd' })), /sourceHashes.lib\/A.sol/);
assert.deepEqual(firstDifference({ constructorWords: 16 }, { constructorWords: 17 }).path, '$.constructorWords');
const metadataOnly = JSON.parse(bytecodeDifference('0x6000a101020003', '0x6000a101030003'));
assert.equal(metadataOnly.firstDiffByteOffset, 4);
assert.equal(metadataOnly.bodyBeforeMetadataEqual, true);
assert.notEqual(metadataOnly.storedKeccak256, metadataOnly.compiledKeccak256);
const changedBody = JSON.parse(bytecodeDifference('0x6000a101020003', '0x6001a101020003'));
assert.equal(changedBody.firstDiffByteOffset, 1);
assert.equal(changedBody.bodyBeforeMetadataEqual, false);
console.log('Trusted compiler LF identity is cross-platform; changed source, bytecode and constructor values remain rejected with precise diagnostics PASS');
