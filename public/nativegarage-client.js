// Wallet-only transaction controller. The API reads chain state; it never sends or claims assets.
const ADDRESS = /^0x[0-9a-f]{40}$/i;
const HASH = /^0x[0-9a-f]{64}$/i;
const ZERO = `0x${'0'.repeat(64)}`;
const FEE = 600000000000000000n;
const PREFIX = 'omerta:native-garage:v1:';
const SELECTOR = Object.freeze({ claim: 'bd66528a', requestGta: '331570cd', fulfill: '0d9577c6',
  settleGta: '6709c1d9', salvage: 'd96653c4', abandonCar: '82383450', harden: '31adb5b2',
  approve: '095ea7b3', craft: '75965386', assign: '8aed312b', unassign: '1be38c08', retire: '1f2b6f23',
  transferCar: '42842e0e', transferTool: '42842e0e' });
const lower = value => String(value || '').toLowerCase();
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };
const validAddress = value => ADDRESS.test(value || '') && !/^0x0{40}$/i.test(value);
const integer = (value, positive = false) => {
  if ((typeof value === 'number' && !Number.isSafeInteger(value)) || !/^(0|[1-9]\d*)$/.test(String(value)))
    fail('invalid_number', 'Enter a whole, positive transaction amount or item number.');
  const result = BigInt(value);
  if (result >= 1n << 256n || (positive && result === 0n)) fail('invalid_number', 'The transaction amount is outside its allowed range.');
  return result;
};
const chain = value => {
  const result = typeof value === 'string' && /^0x[0-9a-f]+$/i.test(value) ? BigInt(value) : integer(value, true);
  if (result <= 0n || result > BigInt(Number.MAX_SAFE_INTEGER)) fail('invalid_chain', 'The selected network cannot be verified.');
  return result;
};
const word = value => integer(value).toString(16).padStart(64, '0');
const addressWord = value => {
  if (!validAddress(value)) fail('invalid_address', 'Enter a valid recipient wallet address.');
  return lower(value).slice(2).padStart(64, '0');
};
const profile = board => board.profile?.id || null;
const keyFor = context => PREFIX + [context.chainId, lower(context.engine), lower(context.wallet)].join(':');
function storageDefault() { try { return globalThis.sessionStorage; } catch { return null; } }
function readable(error) {
  const message = typeof error?.message === 'string' ? error.message : '';
  return message && message.length <= 260 && !/^[\[{]|\[object Object\]|\b(stack|calldata)\b/i.test(message)
    ? message : 'The native garage could not verify this action. Refresh and try again.';
}
function explorerLink(explorer, hash) {
  if (!hash || !HASH.test(hash)) return null;
  try {
    const url = new URL(explorer);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) return null;
    url.search = ''; url.hash = ''; url.pathname = url.pathname.replace(/\/$/, '') + '/tx/' + hash;
    return url.href;
  } catch { return null; }
}
function validateConfig(config) {
  if (!config || typeof config.configured !== 'boolean' || typeof config.enabled !== 'boolean')
    fail('invalid_config', 'Native garage configuration cannot be verified.');
  if (!config.configured || !config.enabled) return config;
  chain(config.chainId);
  if (!HASH.test(config.manifestHash || '') || lower(config.manifestHash) === ZERO
    || !['engine', 'module', 'drand', 'rules', 'omr', 'house'].every(name => validAddress(config.contracts?.[name])))
    fail('invalid_config', 'Native garage contract addresses cannot be verified.');
  return clone(config);
}
function validateBoard(board, config, wallet) {
  if (!board || !board.configured || !board.enabled || chain(board.chainId) !== chain(config.chainId)
    || lower(board.manifestHash) !== lower(config.manifestHash) || lower(board.wallet) !== lower(wallet)
    || !Object.keys(config.contracts).every(name => lower(board.contracts?.[name]) === lower(config.contracts[name]))
    || !Array.isArray(board.availableActions) || board.availableActions.some(action => !Object.hasOwn(SELECTOR, action)))
    fail('invalid_board', 'The garage account or deployment changed. Refresh before sending.');
  if (board.profile && (!HASH.test(board.profile.id || '') || lower(board.profile.id) === ZERO
    || lower(board.profile.wallet) !== lower(wallet))) fail('invalid_profile', 'Select the wallet that owns this native profile.');
  return clone(board);
}
function targetFor(board, action) {
  if (['approve'].includes(action)) return board.contracts.omr;
  if (action === 'fulfill') return board.contracts.drand;
  return ['salvage', 'harden', 'craft', 'assign', 'unassign', 'transferTool'].includes(action)
    ? board.contracts.module : board.contracts.engine;
}
function normalizeIntent(board, action, input = {}) {
  if (!Object.hasOwn(SELECTOR, action) || !board.availableActions.includes(action))
    fail('action_unavailable', 'That action is not available in the confirmed garage state.');
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('invalid_intent', 'The selected action is invalid.');
  const keys = ['harden', 'approve'].includes(action) ? ['batches']
    : ['fulfill', 'settleGta'].includes(action) ? ['requestId']
      : ['salvage', 'abandonCar', 'assign', 'unassign'].includes(action) ? ['tokenId']
        : ['transferCar', 'transferTool'].includes(action) ? ['tokenId', 'to'] : [];
  if (Object.keys(input).some(key => !keys.includes(key))) fail('invalid_intent', 'The selected action contains unsupported fields.');
  const args = {};
  if (keys.includes('batches')) args.batches = String(integer(input.batches ?? '1', true));
  if (keys.includes('requestId')) {
    args.requestId = String(integer(input.requestId ?? board.pending?.requestId, true));
    if (!board.pending || args.requestId !== String(board.pending.requestId))
      fail('stale_request', 'The pending acquisition changed. Refresh before sending.');
  }
  if (keys.includes('tokenId')) args.tokenId = String(integer(input.tokenId, true));
  if (keys.includes('to')) {
    if (!validAddress(input.to)) fail('invalid_address', 'Enter a valid recipient wallet address.');
    args.to = lower(input.to);
  }
  if (['salvage', 'abandonCar', 'transferCar', 'assign', 'unassign', 'transferTool'].includes(action)) {
    const item = (['assign', 'unassign', 'transferTool'].includes(action) ? board.tools : board.cars)
      ?.find(row => String(row.tokenId) === args.tokenId && lower(row.owner) === lower(board.wallet));
    if (!item) fail('item_unavailable', 'This wallet no longer owns that item. Refresh the garage.');
    if (action === 'salvage' && integer(item.modelIndex) !== 0n) fail('not_junker', 'Only a junker can be salvaged into these materials.');
  }
  if (['approve', 'harden'].includes(action)) {
    if (integer(board.omr?.hardeningCostWei) !== FEE) fail('price_changed', 'The hardening price cannot be verified.');
    const amount = integer(args.batches, true) * FEE;
    integer(String(amount), true);
    if (integer(board.materials?.scrap) < 4n * integer(args.batches, true) || integer(board.omr.balance) < amount)
      fail('insufficient_resources', 'The confirmed garage needs enough scrap and OMR for this exact hardening amount.');
    if (action === 'harden' && integer(board.omr.allowance) < amount)
      fail('approval_required', 'Approve this exact OMR amount first, then wait for confirmation.');
  }
  return { action, args };
}
function calldata(board, intent, suppliedData = '') {
  const { action, args } = intent;
  const selector = '0x' + SELECTOR[action];
  const id = profile(board);
  if (['claim', 'requestGta', 'retire', 'craft', 'salvage', 'harden', 'assign'].includes(action)
    && (!id || !HASH.test(id))) fail('profile_required', 'This action needs an active native profile.');
  const profileWord = id?.slice(2).toLowerCase();
  if (['claim', 'requestGta', 'retire', 'craft'].includes(action)) return selector + profileWord;
  if (action === 'salvage') return selector + profileWord + word(args.tokenId);
  if (action === 'harden') return selector + profileWord + word(args.batches);
  if (action === 'approve') return selector + addressWord(board.contracts.module) + word(String(FEE * integer(args.batches, true)));
  if (action === 'assign') return selector + word(args.tokenId) + profileWord;
  if (['unassign', 'abandonCar'].includes(action)) return selector + word(args.tokenId);
  if (['transferCar', 'transferTool'].includes(action)) return selector + addressWord(board.wallet) + addressWord(args.to) + word(args.tokenId);
  if (action === 'settleGta') return selector + word(args.requestId);
  if (action === 'fulfill') {
    if (!/^0x[0-9a-f]{328}$/i.test(suppliedData)) fail('invalid_proof', 'The beacon proof call is malformed.');
    const signature = suppliedData.slice(202);
    return selector + word(args.requestId) + word('64') + word('64') + signature.toLowerCase();
  }
  fail('invalid_intent', 'The transaction action is unsupported.');
}

export function createNativeGarageClient({ api, pickProvider, getExpectedWallet = () => null, onState = () => {},
  storage = storageDefault(), pollIntervalMs = 1500, maxPolls = 20,
  wait = ms => new Promise(resolve => setTimeout(resolve, ms)), now = () => Date.now() } = {}) {
  if (typeof api !== 'function' || typeof pickProvider !== 'function') throw new TypeError('Native garage API and wallet picker are required.');
  let state = { board: null, phase: 'ready', busy: false, error: null, message: '', transaction: null, receipt: null };
  let config = null, selectedWallet = null, provider = null, listeners = [], attempt = null, pending = null;
  let disposed = false, generation = 0, polling = null, storageBlocked = false;
  let explicitSelection = false;
  let pageCursor = '0';
  const snapshot = () => clone(state);
  const emit = patch => { state = { ...state, ...patch }; if (!disposed) { try { onState(snapshot()); } catch { /* observer errors cannot interrupt receipt tracking */ } } };
  const expected = () => {
    // The callback also guards the authenticated session, even after a wallet is explicitly chosen.
    const defaultWallet = getExpectedWallet();
    return explicitSelection ? selectedWallet : defaultWallet || selectedWallet || null;
  };
  const assertExpected = wallet => {
    const value = expected();
    if (value && (!validAddress(value) || lower(value) !== lower(wallet)))
      fail('wallet_changed', 'Select the wallet that owns this native garage.');
  };
  const context = board => ({ chainId: String(chain(board.chainId)), engine: lower(board.contracts.engine), wallet: lower(board.wallet),
    manifestHash: lower(board.manifestHash), profileId: profile(board) });
  const publicTransaction = record => record ? { action: record.action, hash: record.hash, wallet: record.wallet,
    chainId: record.chainId, to: record.to, summary: record.summary, stage: record.stage,
    link: explorerLink(config?.explorer, record.hash) } : null;
  const persist = record => {
    try {
      if (!storage?.setItem || !storage?.getItem) throw Error();
      const text = JSON.stringify(record); storage.setItem(keyFor(record), text);
      if (storage.getItem(keyFor(record)) !== text) throw Error();
    } catch { fail('storage_unavailable', 'Session tracking is unavailable. Keep the transaction hash and check wallet activity before retrying.'); }
  };
  const remove = record => {
    try { storage.removeItem(keyFor(record)); if (storage.getItem(keyFor(record)) !== null) throw Error(); }
    catch { fail('storage_unavailable', 'The transaction is resolved, but session tracking could not be cleared. Resume verification before another action.'); }
  };
  function saved(board) {
    let text;
    try { text = storage?.getItem?.(keyFor(context(board))); } catch { return null; }
    if (text == null) return null;
    try {
      const record = JSON.parse(text), current = context(board);
      if (record.version !== 1 || record.chainId !== current.chainId || record.engine !== current.engine
        || record.wallet !== current.wallet || record.manifestHash !== current.manifestHash
        || !Object.hasOwn(SELECTOR, record.action) || !validAddress(record.to) || record.value !== '0x0'
        || !/^0x(?:[0-9a-f]{2})+$/i.test(record.data || '') || (record.hash !== null && !HASH.test(record.hash || '')))
        throw Error();
      const intent = { action: record.action, args: record.args };
      if (lower(targetFor(board, intent.action)) !== lower(record.to) || lower(calldata(board, intent, record.data)) !== lower(record.data)) throw Error();
      return record;
    } catch {
      storageBlocked = true;
      fail('pending_storage_invalid', 'Saved transaction tracking cannot be verified. Check wallet activity before sending another action.');
    }
  }
  const detach = () => {
    for (const [event, listener] of listeners) { try { provider?.removeListener?.(event, listener); } catch { /* provider already disconnected */ } }
    listeners = [];
  };
  function bind(next) {
    if (!next || typeof next.request !== 'function') fail('wallet_unavailable', 'Connect a compatible wallet to continue.');
    if (provider === next) return;
    detach(); provider = next;
    if (typeof provider.on !== 'function') return;
    for (const event of ['accountsChanged', 'chainChanged', 'disconnect']) {
      const listener = value => {
        if (!attempt?.bound) return;
        if (event === 'accountsChanged' && lower(value?.[0]) === attempt.wallet) return;
        if (event === 'chainChanged') {
          try { if (chain(value) === BigInt(attempt.chainId)) return; } catch { /* malformed provider event invalidates the plan */ }
        }
        attempt.invalid = true;
        emit({ message: attempt.sending
          ? 'The wallet changed while its request was open. Any submitted transaction is still being tracked.'
          : 'The wallet or network changed. Refresh before trying this action again.' });
      };
      provider.on(event, listener); listeners.push([event, listener]);
    }
  }
  function current(run) {
    if (disposed || attempt !== run || run.invalid) fail('wallet_changed', 'The wallet or network changed. Refresh before sending.');
    assertExpected(run.wallet);
  }
  async function checkWallet(run) {
    current(run);
    const accounts = await provider.request({ method: 'eth_accounts' });
    current(run);
    if (lower(accounts?.[0]) !== run.wallet) fail('wallet_changed', 'Select the wallet that owns this native garage.');
    const network = await provider.request({ method: 'eth_chainId' });
    current(run);
    if (chain(network) !== BigInt(run.chainId)) fail('wrong_chain', 'Switch the wallet to the native garage network.');
  }
  async function boardFor(wallet) {
    return validateBoard(await api('GET', '/v1/native-garage?wallet=' + encodeURIComponent(wallet)
      + '&cursor=' + encodeURIComponent(pageCursor)), config, wallet);
  }
  async function load({ cursor } = {}) {
    if (disposed || attempt || (state.busy && !pending)) return snapshot();
    const own = ++generation;
    emit({ phase: pending ? 'recoverable' : 'loading', error: null, message: pending ? 'Reading the tracked transaction and garage…' : 'Reading the confirmed native garage…' });
    try {
      if (cursor !== undefined) pageCursor = String(integer(cursor));
      const nextConfig = validateConfig(await api('GET', '/v1/native-garage/config'));
      if (disposed || own !== generation) return snapshot();
      config = nextConfig;
      if (!config.configured || !config.enabled) {
        emit({ board: config, phase: pending ? 'recoverable' : 'unavailable', busy: Boolean(pending),
          message: config.reason || 'The native garage is not active in this deployment.' });
        return snapshot();
      }
      const wallet = expected();
      if (!wallet) { emit({ board: config, phase: 'ready', busy: false, message: 'Connect your wallet to read its native garage.' }); return snapshot(); }
      if (!validAddress(wallet)) fail('invalid_wallet', 'The native garage wallet cannot be verified.');
      const board = await boardFor(wallet);
      if (disposed || own !== generation) return snapshot();
      assertExpected(wallet); selectedWallet = lower(wallet);
      pending ||= saved(board);
      emit({ board, phase: pending ? 'recoverable' : 'ready', busy: Boolean(pending), transaction: publicTransaction(pending),
        message: pending ? 'A previous wallet request is still tracked. Resume it before another action.' : 'Confirmed garage state is up to date.' });
    } catch (error) {
      if (!disposed && own === generation) emit({ phase: pending || storageBlocked ? 'recoverable' : 'error', busy: Boolean(pending || storageBlocked),
        error: error.code || 'garage_unavailable', message: readable(error) });
    }
    return snapshot();
  }
  async function connect({ force = false } = {}) {
    if (disposed || state.busy || pending || storageBlocked) return snapshot();
    const own = ++generation;
    emit({ busy: true, phase: 'preparing', error: null, message: 'Connecting the garage wallet…' });
    try {
      expected();
      const next = await pickProvider(force ? { force: true } : undefined);
      if (disposed || own !== generation) return snapshot();
      expected(); bind(next);
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      if (disposed || own !== generation) return snapshot();
      expected();
      if (!validAddress(accounts?.[0])) fail('wallet_unavailable', 'No wallet account was selected.');
      if (selectedWallet !== lower(accounts[0])) pageCursor = '0';
      selectedWallet = lower(accounts[0]); explicitSelection = true;
      emit({ busy: false }); return load();
    } catch (error) {
      emit({ busy: false, phase: error.code === 4001 ? 'cancelled' : 'error', error: error.code || 'wallet_unavailable',
        message: error.code === 4001 ? 'Wallet connection cancelled.' : readable(error) });
      return snapshot();
    }
  }
  function verifyReceipt(value, record) {
    if (!value || lower(value.hash) !== lower(record.hash) || !['pending', 'confirming', 'confirmed', 'reverted'].includes(value.status))
      fail('invalid_receipt', 'The tracked transaction receipt cannot be verified.');
    if (value.transaction) {
      const tx = value.transaction;
      if (chain(tx.chainId) !== BigInt(record.chainId) || lower(tx.from) !== record.wallet || lower(tx.to) !== lower(record.to)
        || lower(tx.data ?? tx.input) !== lower(record.data) || !['0', '0x0', '0x00'].includes(String(tx.value)))
        fail('transaction_mismatch', 'That transaction does not match the tracked garage action.');
    } else if (['confirmed', 'reverted'].includes(value.status)) fail('invalid_receipt', 'The transaction details are not yet available. Resume verification shortly.');
    const confirmations = integer(value.confirmations ?? '0');
    const required = integer(value.requiredConfirmations ?? '1', true);
    const minimum = BigInt(record.chainId) === 4663n ? 5n : 1n;
    if (['confirmed', 'reverted'].includes(value.status) && (!HASH.test(value.blockHash || '') || value.blockNumber == null))
      fail('invalid_receipt', 'The confirmed transaction block cannot be verified. Resume verification shortly.');
    return { ...value, status: ['confirmed', 'reverted'].includes(value.status) && confirmations < (required > minimum ? required : minimum)
      ? 'confirming' : value.status };
  }
  async function track() {
    const record = pending;
    if (!record) return snapshot();
    if (!record.hash) {
      emit({ busy: true, phase: 'recoverable', transaction: publicTransaction(record),
        message: 'The wallet did not return a hash. Check its activity and resume with the submitted transaction hash; do not send again.' });
      return snapshot();
    }
    try {
      persist(record);
      for (let index = 0; index < maxPolls && !disposed && pending === record; ++index) {
        const receipt = verifyReceipt(await api('GET', '/v1/native-garage/receipt/' + record.hash + '?wallet=' + encodeURIComponent(record.wallet)), record);
        if (disposed || pending !== record) return snapshot();
        const publicReceipt = { ...receipt }; delete publicReceipt.transaction;
        emit({ busy: true, phase: receipt.status === 'pending' ? 'submitted' : 'confirming', receipt: publicReceipt,
          transaction: publicTransaction(record), message: receipt.status === 'pending' ? 'Submitted. Waiting for a confirmed chain receipt…'
            : 'Waiting for final confirmations. The garage has not been changed locally.' });
        if (['confirmed', 'reverted'].includes(receipt.status)) {
          record.stage = receipt.status + '_refresh'; persist(record);
          emit({ phase: 'refreshing', message: 'Reading authoritative ownership and balances after the receipt…' });
          const board = await boardFor(record.wallet);
          if (disposed || pending !== record) return snapshot();
          const boardNumber = integer(board.confirmedBlock?.number);
          const receiptNumber = integer(receipt.blockNumber);
          if (boardNumber < receiptNumber || board.indexing?.status !== 'ready'
            || (boardNumber === receiptNumber && lower(board.confirmedBlock?.hash) !== lower(receipt.blockHash)))
            fail('projection_pending', 'The transaction is confirmed, but the garage is still catching up. Resume verification shortly.');
          assertExpected(record.wallet);
          remove(record); pending = null;
          emit({ board, busy: false, phase: receipt.status === 'reverted' ? 'reverted' : 'ready',
            error: receipt.status === 'reverted' ? 'transaction_reverted' : null, transaction: publicTransaction(record),
            message: receipt.status === 'reverted' ? 'The transaction reverted. Confirmed garage state has been refreshed.'
              : 'Transaction confirmed. Ownership, materials and allowance have been refreshed.' });
          return snapshot();
        }
        if (index + 1 < maxPolls) await wait(pollIntervalMs);
      }
      if (!disposed) emit({ busy: true, phase: 'recoverable', message: 'The transaction is still pending. Resume tracking instead of sending it again.' });
    } catch (error) {
      if (!disposed) emit({ busy: true, phase: 'recoverable', error: error.code || 'receipt_unavailable',
        transaction: publicTransaction(record), message: readable(error) });
    }
    return snapshot();
  }
  async function resume(hash) {
    if (disposed) return snapshot();
    if (!pending) await load();
    if (!pending || storageBlocked) return snapshot();
    if (hash !== undefined) {
      if (!HASH.test(hash || '') || (pending.hash && lower(pending.hash) !== lower(hash))) {
        emit({ error: 'invalid_recovery_hash', message: 'Use the original submitted transaction hash from wallet activity.' }); return snapshot();
      }
      pending.hash = lower(hash); pending.stage = 'submitted';
      try { persist(pending); } catch (error) { emit({ phase: 'recoverable', error: error.code, message: readable(error) }); return snapshot(); }
    }
    if (polling) return polling;
    polling = track().finally(() => { polling = null; });
    return polling;
  }
  async function perform(action, args = {}) {
    if (disposed || state.busy || pending || storageBlocked) return { ...snapshot(), ignored: true };
    const run = { bound: false, invalid: false, sending: false };
    ++generation; // A previous read cannot replace deployment/wallet state during this action.
    attempt = run;
    emit({ busy: true, phase: 'preparing', error: null, receipt: null, message: 'Verifying the wallet and current onchain action…' });
    try {
      if (!config?.enabled || !state.board?.wallet) fail('garage_unavailable', 'Read the garage and connect its wallet before sending.');
      bind(await pickProvider());
      let accounts = await provider.request({ method: 'eth_accounts' });
      if (!accounts?.length) accounts = await provider.request({ method: 'eth_requestAccounts' });
      if (!validAddress(accounts?.[0])) fail('wallet_unavailable', 'No wallet account was selected.');
      run.wallet = lower(accounts[0]); assertExpected(run.wallet);
      if (run.wallet !== lower(state.board.wallet)) fail('wallet_changed', 'Select the wallet that owns this native garage.');
      run.chainId = String(chain(config.chainId)); run.bound = true;
      if (chain(await provider.request({ method: 'eth_chainId' })) !== BigInt(run.chainId)) {
        await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x' + BigInt(run.chainId).toString(16) }] });
      }
      await checkWallet(run);
      const board = await boardFor(run.wallet); current(run);
      const previous = saved(board);
      if (previous) { pending = previous; emit({ board, phase: 'recoverable', busy: true, transaction: publicTransaction(previous),
        message: 'A previous wallet request must be resolved before another action.' }); return snapshot(); }
      const intent = normalizeIntent(board, action, args);
      emit({ board });
      const plan = await api('POST', '/v1/native-garage/prepare', { wallet: run.wallet, action, args: intent.args }); current(run);
      if (!plan || chain(plan.chainId) !== BigInt(run.chainId) || lower(plan.from) !== run.wallet
        || lower(plan.to) !== lower(targetFor(board, action)) || plan.value !== '0x0' || plan.action !== action
        || lower(plan.manifestHash) !== lower(board.manifestHash) || lower(plan.profileId) !== lower(profile(board))
        || lower(plan.data) !== lower(calldata(board, intent, plan.data)))
        fail('invalid_plan', 'The prepared call does not match this garage action. Refresh before sending.');
      if (!plan.preparedBlock || !HASH.test(plan.preparedBlock.hash || '')
        || integer(plan.preparedBlock.number) < 0n || integer(plan.validUntilMs, true) <= BigInt(now()))
        fail('plan_expired', 'The prepared transaction expired or its block could not be verified. Refresh and try again.');
      await checkWallet(run);
      const record = { version: 1, ...context(board), action, args: intent.args, to: lower(plan.to), data: lower(plan.data),
        value: '0x0', hash: null, stage: 'wallet', createdAt: now(), summary: typeof plan.summary === 'string' ? plan.summary.slice(0, 180) : action };
      persist(record); pending = record;
      await checkWallet(run);
      emit({ phase: 'wallet', transaction: publicTransaction(record), message: 'Review this exact transaction in your wallet.' });
      current(run);
      if (integer(plan.validUntilMs, true) <= BigInt(now())) fail('plan_expired', 'The prepared transaction expired. Refresh and try again.');
      run.sending = true;
      const result = await provider.request({ method: 'eth_sendTransaction', params: [{ from: run.wallet, to: record.to,
        data: record.data, value: '0x0', chainId: '0x' + BigInt(run.chainId).toString(16) }] });
      if (!HASH.test(result || '')) fail('submission_unknown', 'The wallet did not return a valid hash. Check wallet activity before sending another action.');
      record.hash = lower(result); record.stage = 'submitted'; persist(record);
      emit({ phase: 'submitted', transaction: publicTransaction(record), message: 'Transaction submitted. Waiting for authoritative confirmation…' });
      return resume();
    } catch (error) {
      if (run.sending && error?.code !== 4001) {
        const knownHash = error?.data?.transactionHash;
        if (pending && HASH.test(knownHash || '')) pending.hash = lower(knownHash);
        try { if (pending) persist(pending); } catch { /* the pre-send record still blocks duplicate submission */ }
        emit({ busy: true, phase: 'recoverable', error: error.code || 'submission_unknown', transaction: publicTransaction(pending), message: readable(error) });
      } else {
        if (pending && !run.sending || error?.code === 4001) {
          try { if (pending) remove(pending); pending = null; } catch (cleanupError) {
            emit({ busy: true, phase: 'recoverable', error: cleanupError.code, message: readable(cleanupError) }); return snapshot();
          }
        }
        emit({ busy: Boolean(pending || storageBlocked), phase: storageBlocked ? 'recoverable' : error?.code === 4001 ? 'cancelled' : 'error',
          error: error.code || 'wallet_unavailable', message: error?.code === 4001 ? 'Wallet request cancelled. No automatic retry was sent.' : readable(error) });
      }
      return snapshot();
    } finally { if (attempt === run) attempt = null; }
  }
  function dispose() { disposed = true; ++generation; if (attempt) attempt.invalid = true; detach(); }
  return Object.freeze({ load, connect, perform, resume, dispose, getState: snapshot });
}
