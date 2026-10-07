import assert from 'node:assert/strict';
import { keccak256, toHex } from 'viem';
import { compilerSourceSha256, firstDifference, trustedAssetDifference } from '../tools/genesis-deploy-trust-checks.js';
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
console.log('Trusted compiler LF identity is cross-platform; changed source, bytecode and constructor values remain rejected with precise diagnostics PASS');
