import {
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  isAddress,
  keccak256,
  toFunctionSelector,
} from 'viem';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
export const Q96 = 2n ** 96n;
export const MPS = 10_000_000n;

// Official Robinhood Chain deployments, pinned from Uniswap's v3.2.0 Liquidity Launcher README and
// verified against chain 4663. LBPStrategy v3.1.1 is the strategy currently wired to the v2.1-compatible
// CCA factory; the components intentionally do not all share one version number.
export const ROBINHOOD_GENESIS_STACK = Object.freeze({
  chainId: 4663,
  liquidityLauncher: getAddress('0x0000FffFBE8efE702c8703aE3477FF5dE3d319C0'),
  lbpStrategy: getAddress('0x05d552391067389EE44fec3924157ed33F976000'),
  ccaFactory: getAddress('0x000000001F26a0044BaA66024e7b6599c61963F8'),
  permit2: getAddress('0x000000000022D473030F116dDEE9F6B43aC78BA3'),
  poolManager: getAddress('0x8366a39CC670B4001A1121B8F6A443A643e40951'),
  positionManager: getAddress('0x58daec3116aae6D93017bAAea7749052E8a04fA7'),
  liquidityLauncherVersion: '3.2.0',
  lbpStrategyVersion: '3.1.1',
  ccaVersion: '2.1.0',
  runtimeCodeHashes: Object.freeze({
    liquidityLauncher: '0x4a586d925c9d59ece13ce2239ebd7dea9ee725f9d33c6667e0fd16ae8d977d80',
    lbpStrategy: '0x6e822d6a2f634311363ec357109a691d86912414df5c211a2f6ac6de9a680d68',
    ccaFactory: '0xa1d2a90564f4f63580b25de42efaff92505c254b00fc666f65ab38126cce5cfa',
    permit2: '0x5208783f52488f7d3493e5e38311ab707c1d75457fe472a19b0b4d57d66a7fca',
    poolManager: '0xbd3881180b547f5fe817545743cfb4343e96b1bc6640dcd70c106b0066e95626',
    positionManager: '0xc873e135dc9aaec88489cfbad146b4cb49d6a32e0d80326377784b7ba17670b2',
  }),
});

export const GENESIS_SALE_OMR = 4_410_000n * 10n ** 18n;
export const GENESIS_LP_RESERVE_OMR = 1_653_750n * 10n ** 18n;
export const GENESIS_DISTRIBUTION_OMR = GENESIS_SALE_OMR + GENESIS_LP_RESERVE_OMR;
export const GENESIS_LP_CURRENCY_MPS = 3_750_000;
export const GENESIS_FLOOR_OMR_PER_ETH = 205_882n;

const UINT24_MAX = (1n << 24n) - 1n;
const UINT40_MAX = (1n << 40n) - 1n;
const UINT48_MAX = (1n << 48n) - 1n;
const UINT64_MAX = (1n << 64n) - 1n;
const UINT128_MAX = (1n << 128n) - 1n;
const UINT160_MAX = (1n << 160n) - 1n;

const AUCTION_PARAMETERS = {
  type: 'tuple',
  components: [
    { name: 'currency', type: 'address' },
    { name: 'tokensRecipient', type: 'address' },
    { name: 'fundsRecipient', type: 'address' },
    { name: 'startBlock', type: 'uint64' },
    { name: 'endBlock', type: 'uint64' },
    { name: 'claimBlock', type: 'uint64' },
    { name: 'tickSpacing', type: 'uint256' },
    { name: 'validationHook', type: 'address' },
    { name: 'floorPrice', type: 'uint256' },
    { name: 'requiredCurrencyRaised', type: 'uint128' },
    { name: 'auctionStepsData', type: 'bytes' },
  ],
};

const MIGRATOR_PARAMETERS = {
  type: 'tuple',
  components: [
    { name: 'token', type: 'address' },
    { name: 'currency', type: 'address' },
    { name: 'migrationBlock', type: 'uint64' },
    { name: 'reservedTokenAmountForLP', type: 'uint128' },
    { name: 'recipient', type: 'address' },
    { name: 'positionRecipient', type: 'address' },
    {
      name: 'poolParameters', type: 'tuple', components: [
        { name: 'fee', type: 'uint24' },
        { name: 'tickSpacing', type: 'int24' },
        { name: 'hook', type: 'address' },
      ],
    },
    { name: 'positionDefinitions', type: 'bytes' },
    { name: 'lpAllocationSchedule', type: 'bytes' },
  ],
};

const POSITION_DEFINITIONS = {
  type: 'tuple[]',
  components: [
    { name: 'offsetLower', type: 'int24' },
    { name: 'offsetUpper', type: 'int24' },
    { name: 'weight', type: 'uint24' },
    { name: 'overridePositionRecipient', type: 'address' },
  ],
};

const LP_ALLOCATION_SCHEDULE = {
  type: 'tuple[]',
  components: [
    { name: 'lowerThreshold', type: 'uint128' },
    { name: 'rate', type: 'uint24' },
  ],
};

const LAUNCHER_ABI = [
  {
    type: 'function', name: 'depositToken', stateMutability: 'payable',
    inputs: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint160' }], outputs: [],
  },
  {
    type: 'function', name: 'distributeToken', stateMutability: 'payable', inputs: [
      { name: 'tokenAddress', type: 'address' },
      {
        name: 'distribution', type: 'tuple', components: [
          { name: 'strategy', type: 'address' },
          { name: 'amount', type: 'uint128' },
          { name: 'configData', type: 'bytes' },
        ],
      },
      { name: 'salt', type: 'bytes32' },
    ], outputs: [],
  },
  {
    type: 'function', name: 'multicall', stateMutability: 'payable',
    inputs: [{ name: 'data', type: 'bytes[]' }], outputs: [{ name: 'results', type: 'bytes[]' }],
  },
];

const ERC20_APPROVE_ABI = [{
  type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [
    { name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' },
  ], outputs: [{ name: '', type: 'bool' }],
}];

const PERMIT2_APPROVE_ABI = [{
  type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [
    { name: 'token', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'amount', type: 'uint160' },
    { name: 'expiration', type: 'uint48' },
  ], outputs: [],
}];

const HOOK_ABI = [{
  type: 'function', name: 'setAllowedQuote', stateMutability: 'nonpayable', inputs: [
    { name: 'currency', type: 'address' }, { name: 'allowed', type: 'bool' },
  ], outputs: [],
}];

const STACK_ABI = [
  { type: 'function', name: 'permit2', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  {
    type: 'function', name: 'initializerFactory', stateMutability: 'view', inputs: [],
    outputs: [{ type: 'address' }],
  },
  { type: 'function', name: 'poolManager', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  {
    type: 'function', name: 'positionManager', stateMutability: 'view', inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function', name: 'protocolFeeController', stateMutability: 'view', inputs: [],
    outputs: [{ type: 'address' }],
  },
];

const PROTOCOL_FEE_ABI = [
  {
    type: 'function', name: 'protocolFeeRecipient', stateMutability: 'view', inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function', name: 'globalProtocolFeePips', stateMutability: 'view', inputs: [],
    outputs: [{ type: 'uint24' }],
  },
  {
    type: 'function', name: 'getProtocolFeeBracketsForCurrency', stateMutability: 'view',
    inputs: [{ name: 'currency', type: 'address' }],
    outputs: [{
      name: 'fees', type: 'tuple[]', components: [
        { name: 'lowerThreshold', type: 'uint128' },
        { name: 'protocolFeePips', type: 'uint24' },
      ],
    }],
  },
  {
    type: 'function', name: 'getProtocolFeeAmount', stateMutability: 'view', inputs: [
      { name: 'currency', type: 'address' }, { name: 'amount', type: 'uint256' },
    ], outputs: [{ name: 'protocolFeeAmount', type: 'uint256' }],
  },
];

const TOKEN_READINESS_ABI = [
  { type: 'function', name: 'sellTaxBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function', name: 'allowance', stateMutability: 'view', inputs: [
      { name: 'owner', type: 'address' }, { name: 'spender', type: 'address' },
    ], outputs: [{ type: 'uint256' }],
  },
];

const PERMIT2_READINESS_ABI = [{
  type: 'function', name: 'allowance', stateMutability: 'view', inputs: [
    { name: 'owner', type: 'address' },
    { name: 'token', type: 'address' },
    { name: 'spender', type: 'address' },
  ], outputs: [
    { name: 'amount', type: 'uint160' },
    { name: 'expiration', type: 'uint48' },
    { name: 'nonce', type: 'uint48' },
  ],
}];

const HOOK_READINESS_ABI = [
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'poolManager', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'omr', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'authorized', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'HOOK_FLAGS', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint160' }] },
  { type: 'function', name: 'sellTaxBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    type: 'function', name: 'allowedQuote', stateMutability: 'view',
    inputs: [{ name: 'currency', type: 'address' }], outputs: [{ type: 'bool' }],
  },
  {
    type: 'function', name: 'supportsInterface', stateMutability: 'view',
    inputs: [{ name: 'interfaceId', type: 'bytes4' }], outputs: [{ type: 'bool' }],
  },
];

const SPLITTER_READINESS_ABI = [
  { type: 'function', name: 'poolManager', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  {
    type: 'function', name: 'canonicalPoolId', stateMutability: 'view', inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function', name: 'canonicalPoolInitialized', stateMutability: 'view', inputs: [],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function', name: 'treasuryRecipient', stateMutability: 'view', inputs: [],
    outputs: [{ type: 'address' }],
  },
  { type: 'function', name: 'vigRecipient', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  {
    type: 'function', name: 'founderRecipient', stateMutability: 'view', inputs: [],
    outputs: [{ type: 'address' }],
  },
];

const POOL_KEY = {
  type: 'tuple',
  components: [
    { name: 'currency0', type: 'address' },
    { name: 'currency1', type: 'address' },
    { name: 'fee', type: 'uint24' },
    { name: 'tickSpacing', type: 'int24' },
    { name: 'hooks', type: 'address' },
  ],
};

const INITIALIZER_HOOK_INTERFACE_ID = toFunctionSelector('authorized()');
export const V4_OBSERVATION_SOURCE_INTERFACE_ID = `0x${(
  BigInt(toFunctionSelector('poolManager()'))
  ^ BigInt(toFunctionSelector('currentTickCumulative(bytes32)'))
).toString(16).padStart(8, '0')}`;
const OMERTA_HOOK_FLAGS = 0x30ccn;

function uint(name, value, max) {
  let n;
  try { n = BigInt(value); } catch { throw new Error(`${name} must be an unsigned integer`); }
  if (n < 0n || n > max) throw new Error(`${name} is outside its unsigned integer range`);
  return n;
}

function address(name, value, { zero = false } = {}) {
  if (!isAddress(value || '')) throw new Error(`${name} must be a valid EVM address`);
  const normalized = getAddress(value);
  if (!zero && normalized === ZERO_ADDRESS) throw new Error(`${name} cannot be the zero address`);
  return normalized;
}

function bytes32(name, value) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(String(value || ''))) throw new Error(`${name} must be 32 bytes`);
  return value;
}

function sameAddress(actual, expected) {
  return getAddress(actual) === getAddress(expected);
}

async function assertRuntimeCode(client, label, target, expectedHash) {
  const code = await client.getBytecode({ address: target });
  if (!code || code === '0x') throw new Error(`${label} has no runtime code at ${target}`);
  const runtimeCodeHash = keccak256(code);
  if (expectedHash && runtimeCodeHash.toLowerCase() !== expectedHash.toLowerCase()) {
    throw new Error(`${label} runtime code hash mismatch: expected ${expectedHash}, received ${runtimeCodeHash}`);
  }
  return runtimeCodeHash;
}

function assertAddressRead(label, actual, expected) {
  if (!sameAddress(actual, expected)) throw new Error(`${label} mismatch: expected ${expected}, received ${actual}`);
}

/// Read-only verification of every external singleton the launch trusts. The protocol-fee controller
/// is intentionally read live: a nonzero controller can change the amount that reaches LBP migration.
export async function verifyRobinhoodGenesisStack(client, {
  representativeRaise = 10n * 10n ** 18n,
  verifyRuntimeHashes = true,
} = {}) {
  if (!client || typeof client.getChainId !== 'function' || typeof client.readContract !== 'function') {
    throw new Error('a viem-compatible public client is required');
  }
  const quotedRaise = uint('representativeRaise', representativeRaise, (1n << 256n) - 1n);
  if (quotedRaise === 0n) throw new Error('representativeRaise must be positive');
  const chainId = await client.getChainId();
  if (chainId !== ROBINHOOD_GENESIS_STACK.chainId) {
    throw new Error(`RPC chain ID mismatch: expected ${ROBINHOOD_GENESIS_STACK.chainId}, received ${chainId}`);
  }

  const stackNames = [
    'liquidityLauncher', 'lbpStrategy', 'ccaFactory', 'permit2', 'poolManager', 'positionManager',
  ];
  const codeEntries = [];
  for (const name of stackNames) {
    const runtimeCodeHash = await assertRuntimeCode(
      client,
      name,
      ROBINHOOD_GENESIS_STACK[name],
      verifyRuntimeHashes ? ROBINHOOD_GENESIS_STACK.runtimeCodeHashes[name] : undefined,
    );
    codeEntries.push([name, runtimeCodeHash]);
  }

  const read = (target, functionName, args = []) => client.readContract({
    address: target, abi: STACK_ABI, functionName, args,
  });
  const launcherPermit2 = await read(ROBINHOOD_GENESIS_STACK.liquidityLauncher, 'permit2');
  const strategyFactory = await read(ROBINHOOD_GENESIS_STACK.lbpStrategy, 'initializerFactory');
  const strategyPoolManager = await read(ROBINHOOD_GENESIS_STACK.lbpStrategy, 'poolManager');
  const strategyPositionManager = await read(ROBINHOOD_GENESIS_STACK.lbpStrategy, 'positionManager');
  const protocolFeeController = await read(ROBINHOOD_GENESIS_STACK.ccaFactory, 'protocolFeeController');
  assertAddressRead('LiquidityLauncher Permit2', launcherPermit2, ROBINHOOD_GENESIS_STACK.permit2);
  assertAddressRead('LBPStrategy initializer factory', strategyFactory, ROBINHOOD_GENESIS_STACK.ccaFactory);
  assertAddressRead('LBPStrategy PoolManager', strategyPoolManager, ROBINHOOD_GENESIS_STACK.poolManager);
  assertAddressRead(
    'LBPStrategy PositionManager', strategyPositionManager, ROBINHOOD_GENESIS_STACK.positionManager,
  );

  let fee = {
    controller: getAddress(protocolFeeController),
    enabled: false,
    recipient: ZERO_ADDRESS,
    globalPips: 0n,
    nativeBrackets: [],
    representativeRaise: quotedRaise,
    amount: 0n,
    netRaise: quotedRaise,
    effectivePips: 0n,
  };
  if (!sameAddress(protocolFeeController, ZERO_ADDRESS)) {
    const controller = getAddress(protocolFeeController);
    const controllerCodeHash = await assertRuntimeCode(client, 'CCA protocol fee controller', controller);
    const feeRead = (functionName, args = []) => client.readContract({
      address: controller, abi: PROTOCOL_FEE_ABI, functionName, args,
    });
    const recipient = await feeRead('protocolFeeRecipient');
    const globalPips = await feeRead('globalProtocolFeePips');
    const nativeBrackets = await feeRead('getProtocolFeeBracketsForCurrency', [ZERO_ADDRESS]);
    const amount = await feeRead('getProtocolFeeAmount', [ZERO_ADDRESS, quotedRaise]);
    if (amount > quotedRaise) throw new Error(`CCA protocol fee ${amount} exceeds representative raise ${quotedRaise}`);
    if (amount > 0n && sameAddress(recipient, ZERO_ADDRESS)) {
      throw new Error('CCA protocol fee is nonzero but its recipient is the zero address');
    }
    fee = {
      controller,
      controllerCodeHash,
      enabled: true,
      recipient: getAddress(recipient),
      globalPips,
      nativeBrackets,
      representativeRaise: quotedRaise,
      amount,
      netRaise: quotedRaise - amount,
      effectivePips: amount * 1_000_000n / quotedRaise,
    };
  }

  return {
    chainId,
    checkedAtBlock: await client.getBlockNumber(),
    runtimeCodeHashes: Object.fromEntries(codeEntries),
    immutables: {
      launcherPermit2: getAddress(launcherPermit2),
      strategyFactory: getAddress(strategyFactory),
      strategyPoolManager: getAddress(strategyPoolManager),
      strategyPositionManager: getAddress(strategyPositionManager),
    },
    protocolFee: fee,
  };
}

export function canonicalGenesisPoolId({ token, hook }) {
  const canonicalToken = address('token', token);
  const canonicalHook = address('hook', hook);
  return keccak256(encodeAbiParameters([POOL_KEY], [{
    currency0: ZERO_ADDRESS,
    currency1: canonicalToken,
    fee: 3_000,
    tickSpacing: 60,
    hooks: canonicalHook,
  }]));
}

/// Verify the OMERTÀ-controlled contracts and one-shot allowances immediately before the launch
/// multicall. This is expected to run after the three preparation Safe calls have landed.
export async function verifyGenesisLaunchReadiness(client, artifacts) {
  if (!artifacts?.participants || !artifacts?.allocation || !artifacts?.approvals) {
    throw new Error('buildGenesisLaunchArtifacts output is required');
  }
  const {
    token, launchOwner, treasury, vigRecipient, founderRecipient, proceedsSplitter, hook,
  } = artifacts.participants;
  const expectedPoolId = canonicalGenesisPoolId({ token, hook });

  const customCode = [
    await assertRuntimeCode(client, 'OMR', token),
    await assertRuntimeCode(client, 'OmertaHook', hook),
    await assertRuntimeCode(client, 'GenesisProceedsSplitter', proceedsSplitter),
  ];
  const tokenRead = (functionName, args = []) => client.readContract({
    address: token, abi: TOKEN_READINESS_ABI, functionName, args,
  });
  const hookRead = (functionName, args = []) => client.readContract({
    address: hook, abi: HOOK_READINESS_ABI, functionName, args,
  });
  const splitterRead = (functionName) => client.readContract({
    address: proceedsSplitter, abi: SPLITTER_READINESS_ABI, functionName,
  });

  const tokenSellTaxBps = await tokenRead('sellTaxBps');
  const ownerBalance = await tokenRead('balanceOf', [launchOwner]);
  const erc20Permit2Allowance = await tokenRead('allowance', [
    launchOwner, ROBINHOOD_GENESIS_STACK.permit2,
  ]);
  const permit2Allowance = await client.readContract({
    address: ROBINHOOD_GENESIS_STACK.permit2,
    abi: PERMIT2_READINESS_ABI,
    functionName: 'allowance',
    args: [launchOwner, token, ROBINHOOD_GENESIS_STACK.liquidityLauncher],
  });
  const hookOwner = await hookRead('owner');
  const hookPoolManager = await hookRead('poolManager');
  const hookOmr = await hookRead('omr');
  const hookAuthorized = await hookRead('authorized');
  const hookFlags = await hookRead('HOOK_FLAGS');
  const hookSellTaxBps = await hookRead('sellTaxBps');
  const nativeQuoteAllowed = await hookRead('allowedQuote', [ZERO_ADDRESS]);
  const initializerInterfaceSupported = await hookRead('supportsInterface', [INITIALIZER_HOOK_INTERFACE_ID]);
  const observationSourceInterfaceSupported = await hookRead(
    'supportsInterface', [V4_OBSERVATION_SOURCE_INTERFACE_ID],
  );
  const splitterPoolManager = await splitterRead('poolManager');
  const splitterPoolId = await splitterRead('canonicalPoolId');
  const poolInitialized = await splitterRead('canonicalPoolInitialized');
  const splitterTreasury = await splitterRead('treasuryRecipient');
  const splitterVig = await splitterRead('vigRecipient');
  const splitterFounder = await splitterRead('founderRecipient');
  const latestBlock = await client.getBlock({ blockTag: 'latest' });

  const required = artifacts.allocation.totalOmr;
  if (latestBlock.number >= artifacts.timeline.startBlock) {
    throw new Error(
      `auction start block ${artifacts.timeline.startBlock} is not in the future; latest block is ${latestBlock.number}`,
    );
  }
  if (tokenSellTaxBps !== 0n) throw new Error(`OMR sell tax must be zero for launch, received ${tokenSellTaxBps}`);
  if (hookSellTaxBps !== 0n) throw new Error(`OmertaHook sell tax must be zero for launch, received ${hookSellTaxBps}`);
  if (ownerBalance < required) throw new Error(`launch owner OMR balance ${ownerBalance} is below ${required}`);
  if (erc20Permit2Allowance !== required) {
    throw new Error(`OMR -> Permit2 allowance must equal ${required}, received ${erc20Permit2Allowance}`);
  }
  const [permit2Amount, permit2Expiration, permit2Nonce] = permit2Allowance;
  if (permit2Amount !== required) {
    throw new Error(`Permit2 -> LiquidityLauncher allowance must equal ${required}, received ${permit2Amount}`);
  }
  // viem represents ABI integers at or below 48 bits as JavaScript numbers, while the unsigned
  // builder keeps every ceremony integer as bigint. Normalize at this chain-read boundary so an
  // exactly equal Permit2 expiry cannot fail preflight solely because its JS representation differs.
  const permit2ExpirationValue = BigInt(permit2Expiration);
  if (permit2ExpirationValue !== artifacts.approvals.permit2Expiration) {
    throw new Error(
      `Permit2 expiration mismatch: expected ${artifacts.approvals.permit2Expiration}, received ${permit2Expiration}`,
    );
  }
  if (permit2ExpirationValue <= latestBlock.timestamp) {
    throw new Error(`Permit2 allowance expired at ${permit2Expiration}; latest block is ${latestBlock.timestamp}`);
  }
  assertAddressRead('OmertaHook owner', hookOwner, launchOwner);
  assertAddressRead('OmertaHook PoolManager', hookPoolManager, ROBINHOOD_GENESIS_STACK.poolManager);
  assertAddressRead('OmertaHook OMR', hookOmr, token);
  assertAddressRead('OmertaHook authorized initializer', hookAuthorized, ROBINHOOD_GENESIS_STACK.lbpStrategy);
  if (hookFlags !== OMERTA_HOOK_FLAGS || (BigInt(hook) & 0x3fffn) !== OMERTA_HOOK_FLAGS) {
    throw new Error(`OmertaHook address/flags must both encode 0x30cc; getter=${hookFlags}, address=${hook}`);
  }
  if (!initializerInterfaceSupported) throw new Error('OmertaHook does not advertise IInitializerHook through ERC165');
  if (!observationSourceInterfaceSupported) {
    throw new Error('OmertaHook does not advertise IOmrV4ObservationSource through ERC165');
  }
  if (!nativeQuoteAllowed) throw new Error('OmertaHook native ETH quote is not allowed');
  assertAddressRead('GenesisProceedsSplitter PoolManager', splitterPoolManager, ROBINHOOD_GENESIS_STACK.poolManager);
  if (splitterPoolId.toLowerCase() !== expectedPoolId.toLowerCase()) {
    throw new Error(`GenesisProceedsSplitter pool ID mismatch: expected ${expectedPoolId}, received ${splitterPoolId}`);
  }
  if (poolInitialized) throw new Error('the committed genesis pool is already initialized');
  assertAddressRead('GenesisProceedsSplitter treasury', splitterTreasury, treasury);
  assertAddressRead('GenesisProceedsSplitter Vig recipient', splitterVig, vigRecipient);
  assertAddressRead('GenesisProceedsSplitter founder recipient', splitterFounder, founderRecipient);

  return {
    checkedAtBlock: latestBlock.number,
    checkedAtTimestamp: latestBlock.timestamp,
    customRuntimeCodeHashes: { token: customCode[0], hook: customCode[1], proceedsSplitter: customCode[2] },
    canonicalPoolId: expectedPoolId,
    taxes: { tokenSellTaxBps, hookSellTaxBps },
    funding: {
      launchOwner,
      ownerBalance,
      required,
      erc20Permit2Allowance,
      permit2Amount,
      permit2Expiration: permit2ExpirationValue,
      permit2Nonce,
    },
    hook: {
      owner: getAddress(hookOwner),
      poolManager: getAddress(hookPoolManager),
      omr: getAddress(hookOmr),
      authorized: getAddress(hookAuthorized),
      hookFlags,
      nativeQuoteAllowed,
      initializerInterfaceSupported,
      observationSourceInterfaceSupported,
    },
    splitter: {
      poolManager: getAddress(splitterPoolManager),
      canonicalPoolId: splitterPoolId,
      poolInitialized,
      treasury: getAddress(splitterTreasury),
      vig: getAddress(splitterVig),
      founder: getAddress(splitterFounder),
    },
  };
}

export function floorPriceConfig(omrPerEth = GENESIS_FLOOR_OMR_PER_ETH, tickBps = 100n) {
  const omr = uint('omrPerEth', omrPerEth, (1n << 256n) - 1n);
  const bps = uint('tickBps', tickBps, 10_000n);
  if (omr === 0n || bps === 0n) throw new Error('omrPerEth and tickBps must be positive');
  const rawFloorPrice = Q96 / omr;
  const tickSpacing = (rawFloorPrice * bps) / 10_000n;
  if (tickSpacing === 0n) throw new Error('tick spacing rounded to zero');
  const floorPrice = (rawFloorPrice / tickSpacing) * tickSpacing;
  if (floorPrice % tickSpacing !== 0n) throw new Error('floor price is not aligned to tick spacing');
  return { omrPerEth: omr, tickBps: bps, rawFloorPrice, floorPrice, tickSpacing };
}

/// Generate the Uniswap-recommended convex schedule while preserving both constructor invariants:
/// `sum(mps * blockDelta) == 1e7` and `sum(blockDelta) == auctionBlocks + prebidBlocks`.
export function generateSupplySchedule({
  auctionBlocks,
  prebidBlocks = 0,
  steps = 12,
  alpha = 1.2,
  gradualMps = 7_000_000,
} = {}) {
  if (!Number.isSafeInteger(auctionBlocks) || auctionBlocks < steps + 1)
    throw new Error('auctionBlocks must be a safe integer larger than the gradual step count');
  if (!Number.isSafeInteger(prebidBlocks) || prebidBlocks < 0)
    throw new Error('prebidBlocks must be a non-negative safe integer');
  if (!Number.isSafeInteger(steps) || steps < 1 || steps > 64) throw new Error('steps must be between 1 and 64');
  if (!(Number.isFinite(alpha) && alpha > 1)) throw new Error('alpha must be greater than 1');
  if (!Number.isSafeInteger(gradualMps) || gradualMps < 6_000_000 || gradualMps > 8_000_000)
    throw new Error('gradualMps must leave a meaningful 20-40% final block');

  const schedule = [];
  if (prebidBlocks > 0) schedule.push({ mps: 0, blockDelta: prebidBlocks });

  const gradualBlocks = auctionBlocks - 1; // reserve one explicit final block
  const targetPerStep = gradualMps / steps;
  let priorBoundary = 0;
  let released = 0;
  for (let i = 1; i <= steps; i++) {
    const boundary = Math.round(gradualBlocks * ((i / steps) ** (1 / alpha)));
    const blockDelta = boundary - priorBoundary;
    if (blockDelta <= 0) throw new Error('auctionBlocks is too small for the requested convex schedule');
    priorBoundary = boundary;
    const mps = Math.round(targetPerStep / blockDelta);
    if (mps <= 0) throw new Error('auction is too long for nonzero per-block MPS precision');
    released += mps * blockDelta;
    schedule.push({ mps, blockDelta });
  }
  const finalMps = Number(MPS) - released;
  schedule.push({ mps: finalMps, blockDelta: 1 });
  validateSupplySchedule(schedule, auctionBlocks + prebidBlocks);
  return schedule;
}

export function validateSupplySchedule(schedule, expectedBlocks) {
  if (!Array.isArray(schedule) || schedule.length < 2) throw new Error('supply schedule must contain multiple steps');
  let totalMps = 0n;
  let totalBlocks = 0n;
  for (const [i, step] of schedule.entries()) {
    const mps = uint(`schedule[${i}].mps`, step?.mps, UINT24_MAX);
    const blockDelta = uint(`schedule[${i}].blockDelta`, step?.blockDelta, UINT40_MAX);
    if (blockDelta === 0n) throw new Error(`schedule[${i}].blockDelta must be positive`);
    totalMps += mps * blockDelta;
    totalBlocks += blockDelta;
  }
  if (totalMps !== MPS) throw new Error(`supply schedule releases ${totalMps}, expected ${MPS}`);
  if (expectedBlocks != null && totalBlocks !== uint('expectedBlocks', expectedBlocks, UINT64_MAX))
    throw new Error(`supply schedule spans ${totalBlocks} blocks, expected ${expectedBlocks}`);
  const last = schedule.at(-1);
  if (Number(last.blockDelta) !== 1 || Number(last.mps) < 2_000_000 || Number(last.mps) > 4_000_000)
    throw new Error('the last block must release a meaningful 20-40% of supply');
  return { totalMps, totalBlocks, finalMps: BigInt(last.mps) };
}

export function encodeSupplySchedule(schedule) {
  validateSupplySchedule(schedule);
  let encoded = '0x';
  for (const step of schedule) {
    const packed = (BigInt(step.mps) << 40n) | BigInt(step.blockDelta);
    encoded += packed.toString(16).padStart(16, '0');
  }
  return encoded;
}

/// Build the exact unsigned Safe calls for the existing-token Liquidity Launcher path.
/// Nothing here sends a transaction or reads a private key.
export function buildGenesisLaunchArtifacts(input = {}) {
  const token = address('token', input.token);
  const treasury = address('treasury', input.treasury);
  const launchOwner = address('launchOwner', input.launchOwner ?? input.treasury);
  const vigRecipient = address('vigRecipient', input.vigRecipient);
  const founderRecipient = address('founderRecipient', input.founderRecipient);
  const proceedsSplitter = address('proceedsSplitter', input.proceedsSplitter);
  const positionRecipient = address('positionRecipient', input.positionRecipient);
  const hook = address('hook', input.hook);
  if ((BigInt(hook) & 0x3fffn) !== OMERTA_HOOK_FLAGS) {
    throw new Error('hook address must encode OmertaHook permission flags 0x30cc');
  }
  const salt = bytes32('salt', input.salt);
  const startBlock = uint('startBlock', input.startBlock, UINT64_MAX);
  const auctionBlocks = Number(uint('auctionBlocks', input.auctionBlocks, UINT40_MAX));
  const prebidBlocks = Number(uint('prebidBlocks', input.prebidBlocks ?? 0, UINT40_MAX));
  const claimDelayBlocks = uint('claimDelayBlocks', input.claimDelayBlocks, UINT40_MAX);
  const permit2Expiration = uint('permit2Expiration', input.permit2Expiration, UINT48_MAX);
  const requiredCurrencyRaised = uint(
    'requiredCurrencyRaised', input.requiredCurrencyRaised ?? 10n * 10n ** 18n, UINT128_MAX,
  );
  if (permit2Expiration === 0n) throw new Error('permit2Expiration must be nonzero');

  const schedule = generateSupplySchedule({ auctionBlocks, prebidBlocks });
  const scheduleSummary = validateSupplySchedule(schedule, auctionBlocks + prebidBlocks);
  const auctionStepsData = encodeSupplySchedule(schedule);
  const endBlock = startBlock + scheduleSummary.totalBlocks;
  const migrationBlock = endBlock + 1n;
  const claimBlock = endBlock + claimDelayBlocks;
  if (claimBlock < migrationBlock) throw new Error('claimBlock must be at or after migrationBlock');

  const prices = floorPriceConfig();
  const initializerParameters = {
    currency: ZERO_ADDRESS,
    tokensRecipient: treasury,
    fundsRecipient: ROBINHOOD_GENESIS_STACK.lbpStrategy,
    startBlock,
    endBlock,
    claimBlock,
    tickSpacing: prices.tickSpacing,
    validationHook: ZERO_ADDRESS,
    floorPrice: prices.floorPrice,
    requiredCurrencyRaised,
    auctionStepsData,
  };
  const initializerParams = encodeAbiParameters([AUCTION_PARAMETERS], [initializerParameters]);
  const positionDefinitions = encodeAbiParameters([POSITION_DEFINITIONS], [[]]);
  const lpAllocationSchedule = encodeAbiParameters(
    [LP_ALLOCATION_SCHEDULE], [[{ lowerThreshold: 0n, rate: GENESIS_LP_CURRENCY_MPS }]],
  );
  const migratorParameters = {
    token,
    currency: ZERO_ADDRESS,
    migrationBlock,
    reservedTokenAmountForLP: GENESIS_LP_RESERVE_OMR,
    recipient: proceedsSplitter,
    positionRecipient,
    poolParameters: { fee: 3_000, tickSpacing: 60, hook },
    positionDefinitions,
    lpAllocationSchedule,
  };
  const strategyConfigData = encodeAbiParameters(
    [MIGRATOR_PARAMETERS, { type: 'bytes' }], [migratorParameters, initializerParams],
  );
  const distribution = {
    strategy: ROBINHOOD_GENESIS_STACK.lbpStrategy,
    amount: GENESIS_DISTRIBUTION_OMR,
    configData: strategyConfigData,
  };

  if (GENESIS_DISTRIBUTION_OMR > UINT128_MAX || GENESIS_DISTRIBUTION_OMR > UINT160_MAX)
    throw new Error('genesis distribution exceeds launcher or Permit2 integer widths');
  const launcherCalls = [
    encodeFunctionData({
      abi: LAUNCHER_ABI, functionName: 'depositToken', args: [token, GENESIS_DISTRIBUTION_OMR],
    }),
    encodeFunctionData({
      abi: LAUNCHER_ABI, functionName: 'distributeToken', args: [token, distribution, salt],
    }),
  ];
  const launchCalldata = encodeFunctionData({
    abi: LAUNCHER_ABI, functionName: 'multicall', args: [launcherCalls],
  });

  return {
    chainId: ROBINHOOD_GENESIS_STACK.chainId,
    stack: ROBINHOOD_GENESIS_STACK,
    participants: {
      token,
      launchOwner,
      treasury,
      vigRecipient,
      founderRecipient,
      proceedsSplitter,
      positionRecipient,
      hook,
    },
    allocation: {
      auctionOmr: GENESIS_SALE_OMR,
      lpReserveOmr: GENESIS_LP_RESERVE_OMR,
      totalOmr: GENESIS_DISTRIBUTION_OMR,
      lpCurrencyMps: GENESIS_LP_CURRENCY_MPS,
      residualSplitBps: { treasury: 4_000, vig: 3_600, founder: 2_400 },
    },
    timeline: { startBlock, endBlock, migrationBlock, claimBlock, auctionBlocks, prebidBlocks, claimDelayBlocks },
    pricing: prices,
    graduation: { requiredCurrencyRaised },
    supplySchedule: schedule,
    auctionStepsData,
    initializerParameters,
    initializerParams,
    migratorParameters,
    strategyConfigData,
    distribution,
    approvals: { permit2Expiration },
    calldataDigests: { launchKeccak256: keccak256(launchCalldata) },
    safeTransactions: {
      prepare: [
        {
          from: launchOwner, to: token, value: 0n,
          purpose: 'Approve Permit2 to pull only the reviewed genesis allocation',
          data: encodeFunctionData({
            abi: ERC20_APPROVE_ABI, functionName: 'approve',
            args: [ROBINHOOD_GENESIS_STACK.permit2, GENESIS_DISTRIBUTION_OMR],
          }),
        },
        {
          from: launchOwner, to: ROBINHOOD_GENESIS_STACK.permit2, value: 0n,
          purpose: 'Approve Liquidity Launcher in Permit2; the atomic launch consumes the full allowance',
          data: encodeFunctionData({
            abi: PERMIT2_APPROVE_ABI, functionName: 'approve',
            args: [token, ROBINHOOD_GENESIS_STACK.liquidityLauncher, GENESIS_DISTRIBUTION_OMR, permit2Expiration],
          }),
        },
        {
          from: launchOwner, to: hook, value: 0n,
          purpose: 'Allow the native ETH quote before LBP migration initializes the pool',
          data: encodeFunctionData({ abi: HOOK_ABI, functionName: 'setAllowedQuote', args: [ZERO_ADDRESS, true] }),
        },
      ],
      launch: {
        from: launchOwner,
        to: ROBINHOOD_GENESIS_STACK.liquidityLauncher,
        value: 0n,
        purpose: 'Atomically deposit treasury OMR and initialize the CCA/LBP distribution',
        data: launchCalldata,
      },
    },
    invariants: {
      scheduleMps: scheduleSummary.totalMps,
      scheduleBlocks: scheduleSummary.totalBlocks,
      finalBlockMps: scheduleSummary.finalMps,
      floorAligned: prices.floorPrice % prices.tickSpacing === 0n,
      fundsRecipientIsStrategy: initializerParameters.fundsRecipient === ROBINHOOD_GENESIS_STACK.lbpStrategy,
      hookIsCanonicalTarget: migratorParameters.poolParameters.hook === hook,
      feeOnTransferMustRemainDisabled: true,
    },
  };
}
