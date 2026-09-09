// Read-only RPC preflight for the recorded Robinhood testnet character NFT deployment.
// No wallet, environment file, signer, transaction submission, or game database is used.
// node tools/character-nft-preflight.js                 # print the public report
// node tools/character-nft-preflight.js --write-report  # retain a new timestamped report
// Build the current Foundry artifacts before comparing a new contract revision.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPublicClient, decodeAbiParameters, getAddress, http, keccak256, parseAbi } from 'viem';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'omerta-contracts/deployments/46630/manifest.json');
const reportDirectory = path.join(root, 'output/character-nft/preflight');
const expectedBaseUri = 'https://www.omerta.fun/v1/identity/';
const args = process.argv.slice(2);
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain && args.includes('--help')) {
  console.log('Usage: node tools/character-nft-preflight.js [--write-report]\nChecks the recorded testnet only; never submits a transaction. Requires Foundry out/ artifacts.');
  process.exit(0);
}
if (isMain) assert(args.every((arg) => arg === '--write-report'), 'Only --write-report is accepted; this tool does not target mainnet.');
let observedTarget;

const serialise = (value) => JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item, 2);
const equalAddress = (actual, expected, label) => assert.equal(getAddress(actual), getAddress(expected), label);

// Probe the live capability before comparing artifacts. The previously deployed fee contract
// has no mintDevBps getter and still splits mint fees; its historical passing report does not
// establish readiness for this revised policy.
export async function verifyCharacterMintPolicy(read) {
  let mintDevBps;
  try {
    mintDevBps = await read('mintDevBps');
  } catch {
    const error = new Error('OmertaFees.mintDevBps is unavailable; this deployment is unready for 100% DEV character mint fees.');
    error.code = 'character_mint_policy_unavailable';
    throw error;
  }
  if (mintDevBps !== 10_000n) {
    const error = new Error('OmertaFees.mintDevBps must be 10000 for the current character mint policy.');
    error.code = 'character_mint_policy_mismatch';
    throw error;
  }
  return { mintDevBps, mintVigBps: 0n, recipientGetter: 'feeRecipient', verified: true };
}

function emitReport(report) {
  if (args.includes('--write-report')) {
    fs.mkdirSync(reportDirectory, { recursive: true });
    const reportPath = path.join(reportDirectory, `${report.checkedAt.replaceAll(':', '-').replaceAll('.', '-')}.json`);
    fs.writeFileSync(reportPath, `${serialise(report)}\n`, { flag: 'wx' });
  }
  console.log(serialise(report));
}

// Solidity appends CBOR metadata and its two-byte length. Metadata varies with compiler input
// paths; comparing executable bytes with immutable slots masked is useful evidence, not audit
// approval or explorer source verification. Retain the complete live runtime hash in the report.
function withoutMetadata(hex) {
  assert.match(hex, /^0x[0-9a-f]+$/i, 'Bytecode must be hex');
  const bytes = Number.parseInt(hex.slice(-4), 16);
  assert(bytes > 0 && bytes * 2 + 4 < hex.length - 2, 'Missing Solidity metadata length');
  return hex.slice(0, -(bytes * 2 + 4));
}

function normaliseRuntime(hex, immutableReferences) {
  let result = hex;
  for (const entries of Object.values(immutableReferences || {})) {
    for (const { start, length } of entries) {
      const offset = 2 + start * 2;
      assert(offset + length * 2 <= result.length, 'Invalid immutable artifact offset');
      result = result.slice(0, offset) + '0'.repeat(length * 2) + result.slice(offset + length * 2);
    }
  }
  return withoutMetadata(result);
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.network.chainId, 46630, 'Manifest must name the recorded testnet');
  const rpc = new URL(manifest.network.rpc);
  assert.equal(rpc.href, 'https://rpc.testnet.chain.robinhood.com/', 'Unexpected public testnet RPC');
  const client = createPublicClient({ transport: http(rpc.href, { timeout: 20_000, retryCount: 1 }) });
  assert.equal(await client.getChainId(), 46630, 'RPC chain ID does not match testnet');
  // Public RPC replicas can trail the sequencer head. Pin a recent historical block so every
  // call sees one coherent state and the newest, not-yet-served height cannot cause false failure.
  const head = await client.getBlockNumber();
  assert(head > 64n, 'RPC has not reached the preflight confirmation depth');
  const block = await client.getBlock({ blockNumber: head - 64n });
  assert(block.number != null && block.hash, 'RPC did not return a mined block');
  const core = manifest.phases.core;
  const profile = core.profile;
  const governance = manifest.governance;
  const contracts = {};
  observedTarget = { address: getAddress(core.contracts.OmertaFees),
    snapshot: { blockNumber: block.number, blockHash: block.hash, blockTimestamp: block.timestamp,
      observedHead: head, confirmationDepth: 64 } };
  const characterMintPolicy = await verifyCharacterMintPolicy((functionName) => client.readContract({
    address: getAddress(core.contracts.OmertaFees),
    abi: parseAbi(['function mintDevBps() view returns (uint256)']), functionName, blockNumber: block.number,
  }));

  for (const name of ['OmertaFees', 'DynastyNFT']) {
    const address = getAddress(core.contracts[name]);
    const artifactPath = path.join(root, `omerta-contracts/out/${name}.sol/${name}.json`);
    assert(fs.existsSync(artifactPath), `Build the Foundry artifact first: ${name}`);
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const hash = core.transactions[name].transactionHash;
    const [code, receipt, transaction] = await Promise.all([
      client.getCode({ address, blockNumber: block.number }),
      client.getTransactionReceipt({ hash }),
      client.getTransaction({ hash }),
    ]);
    assert(code && code !== '0x', `${name}: missing deployed code`);
    assert.equal(receipt.status, 'success', `${name}: deployment receipt failed`);
    equalAddress(receipt.contractAddress, address, `${name}: deployment receipt address mismatch`);
    assert.equal(receipt.blockNumber, BigInt(core.transactions[name].blockNumber), `${name}: deployment block mismatch`);
    assert.equal(transaction.to, null, `${name}: expected a contract creation transaction`);
    assert(receipt.blockNumber <= block.number, `${name}: deployment is newer than the snapshot`);
    assert.equal(
      normaliseRuntime(code, artifact.deployedBytecode.immutableReferences),
      normaliseRuntime(artifact.deployedBytecode.object, artifact.deployedBytecode.immutableReferences),
      `${name}: executable runtime differs from local artifact`,
    );
    const creationLength = artifact.bytecode.object.length;
    assert.equal(withoutMetadata(transaction.input.slice(0, creationLength)), withoutMetadata(artifact.bytecode.object),
      `${name}: deployment creation code differs from local artifact`);
    const constructorInputs = artifact.abi.find((entry) => entry.type === 'constructor').inputs;
    const constructorValues = decodeAbiParameters(constructorInputs, `0x${transaction.input.slice(creationLength)}`);
    const read = (functionName, callArgs = []) => client.readContract({
      address, abi: artifact.abi, functionName, args: callArgs, blockNumber: block.number,
    });
    const owner = await read('owner');
    equalAddress(owner, governance.safe.address, `${name}: owner differs from manifest Safe`);
    equalAddress(constructorValues[0], governance.safe.address, `${name}: constructor owner mismatch`);
    const report = contracts[name] = {
      address,
      explorerUrl: `${manifest.network.explorer}/address/${address}`,
      runtimeCodeBytes: (code.length - 2) / 2,
      runtimeCodeHash: keccak256(code),
      runtimeMatchesLocalArtifactIgnoringMetadataAndImmutables: true,
      creationMatchesLocalArtifactIgnoringMetadata: true,
      artifact: path.relative(root, artifactPath).replaceAll('\\', '/'),
      owner,
      deployment: { transactionHash: hash, blockNumber: receipt.blockNumber, status: receipt.status },
      constructor: Object.fromEntries(constructorInputs.map((input, index) => [input.name, constructorValues[index]])),
    };

    if (name === 'OmertaFees') {
      const functions = ['mintFee', 'respawnFee', 'rerollFee', 'mintDevBps', 'vigBps', 'feeRecipient', 'vigRecipient', 'nonce'];
      const values = await Promise.all(functions.map((fn) => read(fn)));
      const state = Object.fromEntries(functions.map((fn, index) => [fn, values[index]]));
      assert.equal(state.mintFee, BigInt(profile.mintFeeWei), 'Mint fee differs from manifest');
      assert.equal(state.respawnFee, BigInt(profile.respawnFeeWei), 'Respawn fee differs from manifest');
      assert.equal(state.rerollFee, BigInt(profile.mintFeeWei), 'Reroll fee differs from deployment profile');
      assert.equal(state.mintDevBps, 10_000n, 'Character mint DEV share differs from current policy');
      assert.equal(state.vigBps, BigInt(profile.feeVigBps), 'Immutable non-mint fee split differs from manifest');
      equalAddress(state.feeRecipient, governance.devRecipient, 'Developer fee recipient mismatch');
      equalAddress(state.vigRecipient, governance.vigRecipient, 'Vig fee recipient mismatch');
      equalAddress(constructorValues[1], governance.devRecipient, 'Constructor developer recipient mismatch');
      equalAddress(constructorValues[2], governance.vigRecipient, 'Constructor Vig recipient mismatch');
      assert.equal(constructorValues[3], BigInt(profile.feeVigBps), 'Constructor fee split mismatch');
      assert.equal(constructorValues[4], BigInt(profile.mintFeeWei), 'Constructor mint fee mismatch');
      assert.equal(constructorValues[5], BigInt(profile.respawnFeeWei), 'Constructor respawn fee mismatch');
      report.state = state;
    } else {
      const [signer, dailyMintCap, nextId, paused, royalty] = await Promise.all([
        read('signer'), read('dailyMintCap'), read('nextId'), read('paused'), read('royaltyInfo', [1n, 10_000n]),
      ]);
      equalAddress(signer, governance.voucherSigner, 'Dynasty signer differs from manifest');
      assert.notEqual(signer.toLowerCase(), owner.toLowerCase(), 'Dynasty signer must be separate from owner');
      assert.equal(dailyMintCap, BigInt(profile.dynastyDailyMintCap), 'Dynasty cap differs from manifest');
      assert(dailyMintCap > 0n, 'Dynasty cap must be finite');
      assert.equal(paused, false, 'Dynasty minting is paused');
      equalAddress(royalty[0], governance.safe.address, 'Dynasty royalty recipient mismatch');
      assert.equal(royalty[1], BigInt(profile.dynastyRoyaltyBps), 'Dynasty royalty BPS mismatch');
      equalAddress(constructorValues[1], governance.voucherSigner, 'Constructor dynasty signer mismatch');
      assert.equal(constructorValues[2], expectedBaseUri, 'Constructor dynasty metadata URI mismatch');
      equalAddress(constructorValues[3], governance.safe.address, 'Constructor royalty recipient mismatch');
      assert.equal(constructorValues[4], BigInt(profile.dynastyRoyaltyBps), 'Constructor royalty BPS mismatch');
      assert.equal(constructorValues[5], BigInt(profile.dynastyDailyMintCap), 'Constructor dynasty cap mismatch');
      report.state = { signer, dailyMintCap, nextId, mintedCount: nextId - 1n, paused,
        royaltyRecipient: royalty[0], royaltyBps: royalty[1] };
      report.metadata = { constructorBaseUri: constructorValues[2], currentBaseUri: null,
        currentBaseUriVerification: 'Unavailable through tokenURI: no token exists, and the base URI has no public getter.',
        servedMetadataChecked: false };
      if (nextId > 1n) {
        const uri = await read('tokenURI', [1n]);
        assert.equal(uri, `${expectedBaseUri}1`, 'Current dynasty metadata URI mismatch');
        report.metadata.currentBaseUri = expectedBaseUri;
        report.metadata.currentBaseUriVerification = 'Verified using tokenURI(1) at the report block.';
      }
    }
  }

  const safeAbi = parseAbi(['function getOwners() view returns (address[])', 'function getThreshold() view returns (uint256)']);
  const safeAddress = getAddress(governance.safe.address);
  const [safeOwners, safeThreshold] = await Promise.all(['getOwners', 'getThreshold'].map((functionName) =>
    client.readContract({ address: safeAddress, abi: safeAbi, functionName, blockNumber: block.number })));
  assert.deepEqual(safeOwners.map((address) => address.toLowerCase()).sort(),
    governance.safe.owners.map((address) => address.toLowerCase()).sort(), 'Safe owner set differs from manifest');
  assert.equal(safeThreshold, BigInt(governance.safe.threshold), 'Safe threshold differs from manifest');
  const confirmedBlock = await client.getBlock({ blockNumber: block.number });
  assert.equal(confirmedBlock.hash, block.hash, 'RPC snapshot block changed; rerun the preflight');

  const report = {
    schemaVersion: 2,
    checkedAt: new Date().toISOString(),
    status: 'passed-read-only-testnet-configuration-checks',
    network: { name: manifest.network.name, chainId: 46630, rpc: manifest.network.rpc },
    snapshot: { blockNumber: block.number, blockHash: block.hash, blockTimestamp: block.timestamp,
      observedHead: head, confirmationDepth: 64 },
    referenceManifest: path.relative(root, manifestPath).replaceAll('\\', '/'),
    referenceSourceCommit: manifest.source.commit,
    characterMintPolicy,
    verification: {
      rpcConfigurationAndDeploymentReceipts: 'passed',
      artifactExecutableBytecodeComparison: 'passed; metadata and immutable slots excluded from runtime comparison',
      artifactFreshness: 'Uses existing local Foundry artifacts; build current source before checking a changed revision.',
      explorerSourceVerification: 'not checked; manifest verified status is not treated as explorer source verification',
      independentAudit: 'not performed by this tool',
      mintRehearsal: 'not performed by this tool',
      mainnetLaunchApproval: false,
      transactionsSubmitted: 0,
    },
    governance: { safe: safeAddress, owners: safeOwners, threshold: safeThreshold },
    contracts,
    observations: [
      'The two contracts support fee payment and a separately claimed identity NFT; game entitlements remain account-bound.',
      'Unpaused Dynasty minting accepts valid signer vouchers. OmertaFees accepts exact fee payments immediately and has no pause function.',
      'Fee nonce and NFT supply are observed chain state, not evidence that the complete backend or wallet flow has passed.',
      'Character mint fees go entirely to feeRecipient (DEV_WALLET); vigBps applies only to respawn, reroll and package fees.',
      'No production configuration, keys, wallet signing, deployment, or game mutation is performed.',
    ],
  };
  return report;
}

if (isMain) {
  main().then(emitReport).catch((error) => {
    // Retain failed current-policy checks separately from historical passing evidence. Never
    // include RPC payloads or environment contents in operator errors.
    emitReport({ schemaVersion: 2, checkedAt: new Date().toISOString(), status: 'unready',
      network: { name: 'Robinhood Chain Testnet', chainId: 46630 },
      referenceManifest: path.relative(root, manifestPath).replaceAll('\\', '/'),
      ...(observedTarget ? { feeContract: observedTarget.address, snapshot: observedTarget.snapshot } : {}),
      requiredCharacterMintPolicy: { mintDevBps: 10000, mintVigBps: 0, recipientGetter: 'feeRecipient' },
      failure: { code: error.code || 'preflight_failed', message: error.shortMessage || error.message },
      verification: { mainnetLaunchApproval: false, transactionsSubmitted: 0 },
    });
    process.exitCode = 1;
  });
}
