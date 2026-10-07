// A reviewed packet reader and five individually approved EOA deployments. No Safe operations.
import { keccak_256 } from './genesis-deploy-vendor/sha3.js';
import { TRUSTED_HOOK } from './genesis-deploy-artifact.js';
export const DEPLOYER = '0x5ae54b5555ae5dc9f899e03cb9aac74dccdc4e7e';
export const SAFE = '0xbe225658718dcb3865902437887a11830e4a9b10';
export const FACTORY = '0x4e59b44847b379578588920ca78fbf26c0b4956c';
export const STORAGE_KEY = `omerta:genesis-deploy:4663:${DEPLOYER}`;
const ROLES = ['polFunding', 'reserveFunding', 'coordinator', 'hook', 'auction'];
const DEPENDENCIES = {
  omr: '0x2e82f8c1cfd5172612b3af56088d7d68d920545d',
  characterNft: '0x669c8878a2db3c3d0f7a447f398daa3178a0200b',
  poolManager: '0x8366a39cc670b4001a1121b8f6a443a643e40951',
  positionManager: '0x58daec3116aae6d93017baaea7749052e8a04fa7',
  permit2: '0x000000000022d473030f116ddee9f6b43ac78ba3', create2Factory: FACTORY,
};
const HASH = /^0x[\da-f]{64}$/i, SHA = /^[\da-f]{64}$/i, ADDRESS = /^0x[\da-f]{40}$/i;
const bytes = hex => {
  if (typeof hex !== 'string' || !/^0x(?:[\da-f]{2})*$/i.test(hex)) throw Error('Invalid bytecode or calldata.');
  return Uint8Array.from(hex.slice(2).match(/../g) || [], x => parseInt(x, 16));
};
const lower = value => typeof value === 'string' ? value.toLowerCase() : '';
const check = (condition, message) => { if (!condition) throw Error(message); };
const integer = value => {
  check(typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value) && value.length <= 78, 'Invalid decimal integer.');
  const n = BigInt(value); check(n < 1n << 256n, 'Integer exceeds the transaction limit.'); return n;
};
const hexInt = value => {
  check(typeof value === 'string' && /^0x(?:0|[1-9a-f][\da-f]*)$/i.test(value), 'Invalid wallet integer.');
  return BigInt(value);
};
const hex = value => `0x${value.toString(16)}`;
const byteHex = value => `0x${[...value].map(x => x.toString(16).padStart(2, '0')).join('')}`;
const concat = (...parts) => {
  const output = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0; for (const part of parts) { output.set(part, offset); offset += part.length; } return output;
};
export const keccakHex = value => byteHex(keccak_256(bytes(value)));
export function predictCreateAddress(from, nonce) {
  check(ADDRESS.test(from || '') && nonce >= 0n && nonce < 1n << 64n, 'Invalid CREATE address input.');
  let encodedNonce;
  if (nonce === 0n) encodedNonce = Uint8Array.of(0x80);
  else if (nonce < 128n) encodedNonce = Uint8Array.of(Number(nonce));
  else {
    const raw = bytes(`0x${nonce.toString(16).padStart(Math.ceil(nonce.toString(16).length / 2) * 2, '0')}`);
    encodedNonce = concat(Uint8Array.of(0x80 + raw.length), raw);
  }
  const body = concat(Uint8Array.of(0x94), bytes(from), encodedNonce);
  return byteHex(keccak_256(concat(Uint8Array.of(0xc0 + body.length), body)).slice(-20));
}
export function predictCreate2Address(factory, salt, initCode) {
  check(ADDRESS.test(factory || '') && HASH.test(salt || ''), 'Invalid CREATE2 address input.');
  return byteHex(keccak_256(concat(Uint8Array.of(0xff), bytes(factory), bytes(salt), keccak_256(bytes(initCode)))).slice(-20));
}
function verifyHookCreation(p) {
  const configuration = p.hookConfiguration;
  check(configuration && configuration.poolFee === 3000 && configuration.tickSpacing === 60
    && configuration.opening?.blocks === 0 && configuration.opening?.buyBps === 0 && configuration.opening?.maxBuyQuote === '0'
    && configuration.surgeFullTicks === 100 && configuration.epochDuration === 3600,
    'The reviewed static 0.3% LP fee and disabled opening policy metadata differs.');
  const deployment = p.deployments[3], raw = bytes(deployment.data), template = bytes(TRUSTED_HOOK.creationBytecode);
  check(TRUSTED_HOOK.constructorWords === 16 && template.length === TRUSTED_HOOK.creationBytecodeBytes
    && keccakHex(TRUSTED_HOOK.creationBytecode) === TRUSTED_HOOK.creationBytecodeKeccak256,
    'The locally shipped trusted hook creation template is inconsistent.');
  check(raw.length === 32 + template.length + 16 * 32
    && byteHex(raw.slice(32, 32 + template.length)) === lower(TRUSTED_HOOK.creationBytecode),
    'Hook calldata does not contain the trusted local compiled creation bytecode and canonical constructor size.');
  const words = Array.from({ length: 16 }, (_, i) => byteHex(raw.slice(32 + template.length + i * 32, 32 + template.length + (i + 1) * 32)));
  const addressWord = (index, expected) => check(words[index] === `0x${'00'.repeat(12)}${lower(expected).slice(2)}`,
    'A hook constructor authority, recipient, token or manager differs.');
  const uintWord = (index, expected) => check(words[index] === `0x${BigInt(expected).toString(16).padStart(64, '0')}`,
    'The hook fee, spacing, opening, surge or epoch constructor policy differs.');
  addressWord(0, DEPENDENCIES.poolManager); addressWord(1, DEPENDENCIES.omr); addressWord(2, p.deployments[2].predicted);
  uintWord(3, 3000); uintWord(4, 60);
  [ '0xa87b7a7eecb6f4c771445f5cba5bb0d4b29e5ced', SAFE,
    '0x785be68e426a382c52004e04340897f834f2fcaf', p.deployments[0].predicted, p.deployments[1].predicted ]
    .forEach((address, i) => addressWord(5 + i, address));
  [10, 11, 12].forEach(i => uintWord(i, 0)); uintWord(13, 100); uintWord(14, 3600); addressWord(15, SAFE);
  const predicted = predictCreate2Address(FACTORY, byteHex(raw.slice(0, 32)), byteHex(raw.slice(32)));
  check(predicted === lower(deployment.predicted) && (BigInt(predicted) & 0x3fffn) === 0x35c4n,
    'The salt/initcode CREATE2 address or hook permission flags differ from the reviewed prediction.');
}
export async function sha256(value, cryptoApi = globalThis.crypto) {
  const digest = await cryptoApi.subtle.digest('SHA-256', value);
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
}

export async function verifyDeploymentPacket(rawBytes, expectedSha, { now = Date.now(), cryptoApi = globalThis.crypto, recoveryOnly = false } = {}) {
  check(SHA.test(expectedSha || '') && rawBytes.byteLength <= 4_194_304, 'Enter the reviewed packet SHA-256 and a bounded packet file.');
  const digest = await sha256(rawBytes, cryptoApi);
  check(digest === expectedSha.toLowerCase(), 'Packet bytes differ from the reviewed SHA-256.');
  const p = JSON.parse(new TextDecoder().decode(rawBytes));
  check(p.signingReady === true && p.chainId === 4663, 'This packet is not approved for signing on Robinhood Chain.');
  for (const key of ['validUntil', 'deploymentDeadline']) {
    check(typeof p[key] === 'string' && Number.isFinite(Date.parse(p[key])) && (recoveryOnly || Date.parse(p[key]) > now),
      'The deployment packet is expired or missing its deadline.');
  }
  const policy = p.finalManifest?.policy;
  const amounts = { totalSupplyWei: '100000000000000000000000000', decimals: 18,
    saleTokenAmountWei: '40000000000000000000000000', lpTokenAmountWei: '20000000000000000000000000',
    bondTokenAmountWei: '40000000000000000000000000', minimumRaiseWei: '10000000000000000000',
    lpProceedsBps: 5000, claimsAtAuctionEnd: true };
  check(p.finalManifest?.chainId === 4663 && policy && Object.entries(amounts).every(([k, v]) => policy[k] === v)
    && ['familySafe', 'liquidityOwner', 'unsoldRecipient', 'bondReserveCustodian'].every(k => lower(policy[k]) === SAFE),
  'The founder-approved allocation, proceeds or Safe custody differs.');
  const governance = p.finalManifest.hookGovernance;
  check(governance && Object.keys(governance).length === 5 && lower(governance.governanceSafe) === SAFE
    && lower(governance.fixedFounderRecipient) === '0xa87b7a7eecb6f4c771445f5cba5bb0d4b29e5ced'
    && governance.fixedFounderBps === 200 && governance.delaySeconds === 172800 && governance.executionSafeOnly === true,
    'The fixed founder 2% and 48-hour Safe-only tax governance differs.');
  const clock = p.launchClock;
  check(clock && ['arbsys', 'block.number'].includes(clock.mode), 'The native launch clock is missing.');
  check(integer(clock.startBlock) < integer(clock.endBlock) && clock.claimBlock === clock.endBlock,
    'The closure claim clock or auction schedule differs.');
  check(Array.isArray(p.deployments) && p.deployments.length === 5 && p.runtimeChecks
    && Object.keys(p.runtimeChecks).length === 5, 'Exactly five deployment and runtime checks are required.');
  let first;
  for (let i = 0; i < 5; i++) {
    const d = p.deployments[i], pin = p.runtimeChecks[ROLES[i]];
    check(d.role === ROLES[i] && d.chainId === 4663 && lower(d.from) === DEPLOYER && d.value === '0x0',
      'Deployment role, account, chain or value differs.');
    const nonce = integer(d.nonce); if (i === 0) first = nonce;
    check(nonce === first + BigInt(i) && nonce < (1n << 64n) - 1n, 'The five deployment nonces are not sequential.');
    check(ADDRESS.test(d.predicted || '') && !/^0x0{40}$/i.test(d.predicted), 'A predicted deployment address is missing.');
    check(bytes(d.data).length > 0, 'Deployment calldata is empty.');
    if (i === 3) check(lower(d.to) === FACTORY && bytes(d.data).length > 32, 'The hook must use the reviewed CREATE2 factory.');
    else check(d.to === undefined || d.to === null, 'This deployment must be a contract creation.');
    check(pin && lower(pin.address) === lower(d.predicted) && SHA.test(pin.sha256 || '') && !/^0{64}$/.test(pin.sha256),
      'A deployment runtime SHA-256 is missing or differs.');
  }
  check(new Set(p.deployments.map(d => lower(d.predicted))).size === 5, 'Deployment addresses collide.');
  for (const index of [0, 1, 2, 4]) check(lower(p.deployments[index].predicted)
    === predictCreateAddress(DEPLOYER, integer(p.deployments[index].nonce)), 'A CREATE deployment address differs from the reviewed EOA nonce.');
  verifyHookCreation(p);
  check(Array.isArray(p.dependencyChecks) && p.dependencyChecks.length === 6, 'Six production dependency checks are required.');
  const names = new Set();
  for (const pin of p.dependencyChecks) {
    check(Object.hasOwn(DEPENDENCIES, pin.name) && !names.has(pin.name) && lower(pin.address) === DEPENDENCIES[pin.name]
      && SHA.test(pin.sha256 || '') && !/^0{64}$/.test(pin.sha256), 'A production dependency address or SHA-256 differs.');
    names.add(pin.name);
  }
  check(Array.isArray(p.auxiliaryRuntimeChecks) && p.auxiliaryRuntimeChecks.length === 2,
    'Both internally created auction runtime checks are required.');
  const auxiliaryAddresses = { validator: p.internalValidatorAddress, scheduleStore: p.internalScheduleAddress };
  check(lower(p.internalValidatorAddress) === predictCreateAddress(p.deployments[4].predicted, 1n)
    && lower(p.internalScheduleAddress) === predictCreateAddress(p.deployments[4].predicted, 2n),
    'Internal auction addresses differ from their actual CREATE nonce predictions.');
  const auxiliaryNames = new Set();
  for (const pin of p.auxiliaryRuntimeChecks) {
    check(Object.hasOwn(auxiliaryAddresses, pin.name) && !auxiliaryNames.has(pin.name)
      && ADDRESS.test(pin.address || '') && lower(pin.address) === lower(auxiliaryAddresses[pin.name])
      && SHA.test(pin.sha256 || '') && !/^0{64}$/.test(pin.sha256),
      'An internal auction runtime address or SHA-256 differs.');
    auxiliaryNames.add(pin.name);
  }
  check(p.internalValidatorApprovedSupply === amounts.totalSupplyWei,
    'The validator constructor snapshot must match the approved 100M supply.');
  const schedule = p.releaseSchedule?.auctionStepsData;
  check(typeof schedule === 'string' && /^0x(?:[\da-f]{16})+$/i.test(schedule)
    && lower(p.internalScheduleRuntime) === `0x00${schedule.slice(2).toLowerCase()}`,
    'The reviewed schedule-store runtime must be STOP followed by the exact schedule bytes.');
  check(await sha256(bytes(p.internalScheduleRuntime), cryptoApi)
    === p.auxiliaryRuntimeChecks.find(pin => pin.name === 'scheduleStore').sha256.toLowerCase(),
    'The schedule-store SHA-256 differs from the exact reviewed schedule runtime.');
  check(new Set([...p.dependencyChecks, ...Object.values(p.runtimeChecks), ...p.auxiliaryRuntimeChecks]
    .map(pin => lower(pin.address))).size === 13, 'Production, deployment and internal runtime addresses collide.');
  const snapshot = structuredClone(p);
  const freeze = x => { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x); } };
  freeze(snapshot);
  return { packet: snapshot, digest };
}

export class GenesisDeploymentClient {
  constructor({ provider, storage = globalThis.localStorage, locks = globalThis.navigator?.locks,
    cryptoApi = globalThis.crypto, now = () => Date.now(), readTimeoutMs = 12_000, status = () => {},
    confirm = async text => globalThis.confirm(text) } = {}) {
    this.provider = provider; this.storage = storage; this.locks = locks; this.crypto = cryptoApi;
    this.now = now; this.readTimeoutMs = readTimeoutMs; this.status = status; this.inFlight = false; this.loaded = null;
    this.confirm = confirm;
  }
  state() {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) return { stage: 0, pending: null, halted: null, receipts: [], failures: [] };
    const s = JSON.parse(raw);
    check(Number.isInteger(s.stage) && s.stage >= 0 && s.stage <= 5 && Array.isArray(s.receipts) && Array.isArray(s.failures),
      'Stored deployment state is invalid. Stop and review wallet activity.');
    return s;
  }
  save(s) { this.storage.setItem(STORAGE_KEY, JSON.stringify(s)); }
  async load(raw, expectedSha) {
    check(!this.inFlight, 'A deployment action is in flight; wait before replacing its packet.');
    const s = this.state();
    const recoveryOnly = !!s.pending && lower(expectedSha) === s.packetHash;
    const verified = await verifyDeploymentPacket(raw, expectedSha, { now: this.now(), cryptoApi: this.crypto, recoveryOnly });
    return this.exclusive(async () => {
      const current = this.state();
      if (current.packetHash && current.packetHash !== verified.digest) {
        check(!current.pending && (['confirmed_failed', 'nonce_changed', 'start_passed'].includes(current.halted)
          || this.now() >= Date.parse(current.validUntil) || this.now() >= Date.parse(current.deploymentDeadline)),
          'A different packet cannot replace pending or unresolved deployment state.');
        this.save({ stage: 0, pending: null, halted: null, receipts: [], failures: current.failures,
          packetHash: verified.digest, validUntil: verified.packet.validUntil, deploymentDeadline: verified.packet.deploymentDeadline });
      } else if (!current.packetHash) this.save({ ...current, packetHash: verified.digest,
        validUntil: verified.packet.validUntil, deploymentDeadline: verified.packet.deploymentDeadline });
      this.loaded = verified; return this.summary();
    });
  }
  summary() { const s = this.state(); return { packetHash: this.loaded?.digest || s.packetHash,
    stage: s.stage, nextRole: ROLES[s.stage] || 'complete', pending: s.pending?.hash || (s.pending ? 'unknown wallet outcome' : null), halted: s.halted }; }
  async rpc(method, params = []) {
    let timer;
    try { return await Promise.race([this.provider.request({ method, params }), new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error('The public wallet read timed out. No new deployment was requested.')), this.readTimeoutMs);
    })]); } finally { clearTimeout(timer); }
  }
  async identity() {
    const chain = hexInt(await this.rpc('eth_chainId')), accounts = await this.rpc('eth_accounts');
    check(chain === 4663n && lower(accounts?.[0]) === DEPLOYER, 'Select the reviewed deployment account on Robinhood Chain.');
  }
  async codeMatches(address, expected, block = 'latest') {
    const code = await this.rpc('eth_getCode', [address, block]);
    check(bytes(code).length > 0 && await sha256(bytes(code), this.crypto) === expected.toLowerCase(),
      'A required deployed runtime differs from its reviewed SHA-256.');
  }
  deadline() {
    check(this.loaded, 'Load and verify the reviewed packet first.');
    const p = this.loaded.packet;
    check(this.now() < Date.parse(p.validUntil) && this.now() < Date.parse(p.deploymentDeadline), 'The deployment signing deadline passed.');
  }
  async exclusive(work) {
    check(!this.inFlight && this.locks?.request, 'A deployment is already in flight, or this browser lacks transaction locking.');
    this.inFlight = true;
    try { return await this.locks.request(STORAGE_KEY, { ifAvailable: true }, async lock => {
      check(lock, 'Another tab is reviewing this deployment account.'); return work();
    }); } finally { this.inFlight = false; }
  }
  async sendNext() {
    return this.exclusive(async () => {
      this.deadline(); let s = this.state();
      check(s.packetHash === this.loaded.digest && !s.pending && !s.halted && s.stage < 5,
        'Check the pending transaction or regenerate a halted packet before deploying.');
      const packetDigest = this.loaded.digest, initialStage = s.stage;
      const initialState = this.storage.getItem(STORAGE_KEY);
      const p = this.loaded.packet, d = p.deployments[initialStage], nonce = integer(d.nonce);
      await this.identity();
      const head = await this.rpc('eth_getBlockByNumber', ['latest', false]);
      check(HASH.test(head?.hash || '') && hexInt(head.number) >= 0n, 'The chain snapshot is incomplete.');
      let native;
      if (p.launchClock.mode === 'arbsys') {
        const word = await this.rpc('eth_call', [{ to: '0x0000000000000000000000000000000000000064', data: '0xa3b1b31d' }, head.number]);
        check(HASH.test(word || ''), 'The native auction clock returned an invalid word.'); native = BigInt(word);
      } else native = hexInt(head.number);
      if (native >= integer(p.launchClock.startBlock)) {
        this.save({ ...s, halted: 'start_passed' });
        throw Error('Auction start passed; regenerate the reviewed deployment packet.');
      }
      const pins = [...p.dependencyChecks, ...ROLES.slice(0, s.stage).map(role => p.runtimeChecks[role])];
      const reads = await Promise.allSettled([
        ...pins.map(pin => this.codeMatches(pin.address, pin.sha256, head.number)),
        this.rpc('eth_getCode', [d.predicted, head.number]).then(code =>
          check(code === '0x', 'The predicted deployment address is already occupied.')),
      ]);
      for (const result of reads) if (result.status === 'rejected') throw result.reason;
      const exactNonce = async () => {
        const latest = hexInt(await this.rpc('eth_getTransactionCount', [DEPLOYER, 'latest']));
        const pending = hexInt(await this.rpc('eth_getTransactionCount', [DEPLOYER, 'pending']));
        if (latest !== nonce || pending !== nonce) {
          this.save({ ...this.state(), halted: 'nonce_changed' });
          throw Error('Deployment account nonce changed or has another pending transaction. Halt and regenerate the packet.');
        }
      };
      await exactNonce();
      const tx = { from: DEPLOYER, data: d.data, value: '0x0', nonce: hex(nonce), chainId: '0x1237' };
      if (d.to) tx.to = d.to;
      const estimated = hexInt(await this.rpc('eth_estimateGas', [tx]));
      check(estimated > 0n, 'Gas estimation did not return a usable limit.');
      const gas = (estimated * 120n + 99n) / 100n;
      const gasPrice = hexInt(await this.rpc('eth_gasPrice'));
      const balance = hexInt(await this.rpc('eth_getBalance', [DEPLOYER, 'pending']));
      check(gasPrice > 0n && balance >= gas * gasPrice, 'The deployment account does not cover the buffered gas estimate.');
      tx.gas = hex(gas);
      if (!await this.confirm(`Review deployment ${s.stage + 1} of 5: ${d.role}\nAccount: ${DEPLOYER}\nNonce: ${d.nonce}\nTarget: ${d.to || 'contract creation'}\nNew contract: ${d.predicted}\nETH sent: 0, plus wallet gas\nBuffered gas limit: ${gas}\nApprove only this deployment in MetaMask.`)) return this.summary();
      await this.identity(); await exactNonce(); this.deadline();
      const fresh = await this.rpc('eth_getBlockByNumber', ['latest', false]);
      check(HASH.test(fresh?.hash || '') && hexInt(fresh.number) >= hexInt(head.number), 'The fresh deployment snapshot is incomplete.');
      let freshNative;
      if (p.launchClock.mode === 'arbsys') {
        const word = await this.rpc('eth_call', [{ to: '0x0000000000000000000000000000000000000064', data: '0xa3b1b31d' }, fresh.number]);
        check(HASH.test(word || ''), 'The native auction clock returned an invalid word.'); freshNative = BigInt(word);
      } else freshNative = hexInt(fresh.number);
      const finals = await Promise.all([this.rpc('eth_getBlockByNumber', [head.number, false]),
        this.rpc('eth_getBlockByNumber', [fresh.number, false])]);
      check(lower(finals[0]?.hash) === lower(head.hash) && lower(finals[1]?.hash) === lower(fresh.hash),
        'The deployment snapshot changed. Review again.');
      if (freshNative >= integer(p.launchClock.startBlock)) {
        this.save({ ...this.state(), halted: 'start_passed' });
        throw Error('Auction start passed during review; regenerate the deployment packet.');
      }
      await this.identity(); await exactNonce(); this.deadline();
      s = this.state(); check(this.loaded.digest === packetDigest && this.loaded.packet === p
        && this.storage.getItem(STORAGE_KEY) === initialState && s.stage === initialStage
        && !s.pending && !s.halted && s.packetHash === packetDigest && d.role === ROLES[initialStage],
        'Another tab changed deployment state or the reviewed packet.');
      const id = this.crypto.randomUUID();
      const intent = { id, packetHash: packetDigest, stage: initialStage, role: d.role, from: DEPLOYER,
        to: d.to || null, value: '0x0', data: d.data, nonce: d.nonce, predicted: d.predicted,
        runtimeSha256: p.runtimeChecks[d.role].sha256, hash: null };
      this.save({ ...s, pending: intent });
      this.status('Review this one deployment in MetaMask. Keep this page open while the wallet request is pending.');
      let hash;
      try {
        // Deliberately no timeout: a late wallet approval remains the same durable request.
        hash = await this.provider.request({ method: 'eth_sendTransaction', params: [tx] });
      } catch (error) {
        if (error?.code === 4001) {
          const current = this.state(); if (current.pending?.id === id) this.save({ ...current, pending: null });
        }
        throw error;
      }
      check(HASH.test(hash || ''), 'Unknown wallet outcome. The durable request is retained; check MetaMask activity.');
      const current = this.state(); check(current.pending?.id === id, 'Stored request changed. Keep the returned hash and review wallet activity.');
      this.save({ ...current, pending: { ...intent, hash } });
      return this.summary();
    });
  }
  async checkPending(manualHash = '') {
    return this.exclusive(async () => {
      check(this.loaded, 'Load the same reviewed packet before checking its transaction.');
      let s = this.state(); const intent = s.pending;
      check(intent && s.packetHash === this.loaded.digest && intent.packetHash === this.loaded.digest, 'No matching pending request is recorded.');
      check(Number.isInteger(intent.stage) && intent.stage >= 0 && intent.stage < 5 && s.stage === intent.stage,
        'Stored deployment stage differs from the reviewed packet. Keep the pending record for review.');
      const reviewed = this.loaded.packet.deployments[intent.stage];
      const runtime = this.loaded.packet.runtimeChecks[reviewed.role];
      check(intent.from === DEPLOYER && intent.role === reviewed.role && intent.nonce === reviewed.nonce
        && intent.value === '0x0' && intent.to === (reviewed.to || null) && intent.data === reviewed.data
        && intent.predicted === reviewed.predicted && intent.runtimeSha256 === runtime.sha256,
        'Stored deployment intent differs from the reviewed packet. Keep the pending record for review.');
      const hash = intent.hash || manualHash.trim();
      check(HASH.test(hash || '') && (!manualHash || lower(manualHash.trim()) === lower(hash)),
        'Enter the transaction hash from MetaMask activity; an unknown request cannot be cleared automatically.');
      await this.identity();
      const sent = await this.rpc('eth_getTransactionByHash', [hash]);
      check(sent && lower(sent.hash) === lower(hash) && lower(sent.from) === DEPLOYER
        && lower(sent.to) === lower(intent.to) && hexInt(sent.value) === 0n
        && hexInt(sent.nonce) === integer(intent.nonce) && lower(sent.input || sent.data) === lower(intent.data),
        'The wallet transaction differs from the recorded deployment intent.');
      if (!intent.hash) { this.save({ ...s, pending: { ...intent, hash } }); s = this.state(); }
      const receipt = await this.rpc('eth_getTransactionReceipt', [hash]);
      check(receipt && HASH.test(receipt.transactionHash || '') && lower(receipt.transactionHash) === lower(hash)
        && HASH.test(receipt.blockHash || '') && HASH.test(sent.blockHash || '')
        && lower(sent.blockHash) === lower(receipt.blockHash)
        && hexInt(sent.blockNumber) === hexInt(receipt.blockNumber) && /^0x[01]$/.test(receipt.status || ''),
        'Transaction is pending or its receipt is incomplete. Keep the pending request.');
      const canonical = async () => {
        const block = await this.rpc('eth_getBlockByNumber', [receipt.blockNumber, false]);
        check(block && hexInt(block.number) === hexInt(receipt.blockNumber) && lower(block.hash) === lower(receipt.blockHash),
          'Receipt block was reorganized. Keep the pending request and check again.');
        const head = hexInt(await this.rpc('eth_blockNumber'));
        check(head >= hexInt(receipt.blockNumber) + 5n, 'Wait for five confirmations before advancing.');
      };
      await canonical();
      if (receipt.status === '0x1') {
        if (intent.to === null) check(lower(receipt.contractAddress) === lower(intent.predicted), 'Created contract address differs from the reviewed prediction.');
        if (intent.role === 'auction') {
          const pins = [...Object.values(this.loaded.packet.runtimeChecks), ...this.loaded.packet.auxiliaryRuntimeChecks];
          const runtimes = await Promise.allSettled(pins.map(pin => this.codeMatches(pin.address, pin.sha256, receipt.blockNumber)));
          for (const runtime of runtimes) if (runtime.status === 'rejected') throw runtime.reason;
        } else await this.codeMatches(intent.predicted, intent.runtimeSha256, receipt.blockNumber);
      }
      await this.identity(); await canonical();
      const current = this.state();
      check(current.pending?.id === intent.id && lower(current.pending.hash) === lower(hash) && current.stage === intent.stage,
        'Another tab changed the recorded deployment. Do not advance.');
      if (receipt.status === '0x0') {
        this.save({ ...current, pending: null, halted: 'confirmed_failed', failures: [...current.failures, { hash, role: intent.role, nonce: intent.nonce }] });
        throw Error('Deployment reverted and consumed its nonce. Halt; obtain a newly reviewed packet.');
      }
      this.save({ ...current, pending: null, stage: current.stage + 1,
        receipts: [...current.receipts, { hash, role: intent.role, address: intent.predicted, blockHash: receipt.blockHash }] });
      return this.summary();
    });
  }
}

if (typeof document !== 'undefined' && document.getElementById('genesis-deploy-status')) {
  const status = text => { document.getElementById('genesis-deploy-status').textContent = text; };
  let client;
  const getClient = () => {
    check(globalThis.ethereum?.request, 'Open this page in the browser with MetaMask installed.');
    return client ||= new GenesisDeploymentClient({ provider: globalThis.ethereum, status });
  };
  const show = s => status(JSON.stringify(s, null, 2));
  const bind = (id, action) => document.getElementById(id).addEventListener('click', async () => {
    try { await action(); } catch (error) { status(error?.message || 'Deployment verification failed.'); }
  });
  bind('genesis-deploy-load', async () => {
    const file = document.getElementById('genesis-deploy-packet').files[0]; check(file, 'Choose the reviewed packet file.');
    check(file.size <= 4_194_304, 'The reviewed packet file exceeds the size limit.');
    show(await getClient().load(await file.arrayBuffer(), document.getElementById('genesis-deploy-sha').value.trim()));
  });
  bind('genesis-deploy-connect', async () => {
    const c = getClient(); await c.provider.request({ method: 'eth_requestAccounts' }); await c.identity(); status('Reviewed account and network connected.');
  });
  bind('genesis-deploy-next', async () => show(await getClient().sendNext()));
  bind('genesis-deploy-check', async () => show(await getClient().checkPending(document.getElementById('genesis-deploy-hash').value)));
}
