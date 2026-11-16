import { createNativeGarageClient } from './nativegarage-client.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);
const number = value => /^(0|[1-9][0-9]*)$/.test(String(value ?? '')) ? BigInt(value) : 0n;
const short = value => value ? `${String(value).slice(0, 8)}…${String(value).slice(-6)}` : '—';
const units = (value, decimals = 18, places = 4) => {
  const raw = number(value), scale = 10n ** BigInt(decimals);
  const fraction = String(raw % scale).padStart(decimals, '0').slice(0, places).replace(/0+$/, '');
  return `${raw / scale}${fraction ? '.' + fraction : ''}`;
};
const date = value => {
  const millis = Number(value);
  return Number.isFinite(millis) && millis > 0 ? new Date(millis).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Ready';
};
const captions = {
  preparing: 'Checking the action against the latest chain state…',
  wallet: 'Review and confirm in your wallet.',
  submitted: 'Transaction sent. Waiting for its receipt…',
  confirming: 'Waiting for chain confirmations…',
  refreshing: 'Confirmed. Refreshing your onchain inventory…',
  recoverable: 'This transaction still needs checking. Check its receipt before sending another action.',
  cancelled: 'Wallet request declined. Nothing else has been sent.',
};

/** One controller survives tab renders; its transaction record outlives the current DOM mount. */
export function createNativeGarageView(options) {
  let root, state = {}, abandonedToken = '', disposed = false;
  const recipients = new Map();
  const client = createNativeGarageClient({ ...options, onState(next) { state = next; render(); } });
  const disabled = action => state.busy || !state.board?.availableActions?.includes(action);
  const button = (action, label, args = {}, extra = '') => `<button type="button" class="act ng-action" data-ng-action="${esc(action)}" data-ng-args="${esc(JSON.stringify(args))}"${disabled(action) ? ' disabled' : ''}${extra}>${esc(label)}</button>`;
  const explanation = text => `<p class="ng-note">${esc(text)}</p>`;

  function status() {
    const tx = state.transaction, receipt = state.receipt;
    const hash = tx?.hash || receipt?.hash;
    const explorer = state.board?.explorer;
    const link = hash && /^0x[0-9a-f]{64}$/i.test(hash) && /^https:\/\//.test(explorer || '')
      ? `<a href="${esc(explorer.replace(/\/$/, '') + '/tx/' + hash)}" target="_blank" rel="noopener noreferrer">View transaction ↗</a>` : '';
    const message = state.message || captions[state.phase] || (state.phase === 'loading' ? 'Reading confirmed chain state…' : '');
    const confirmations = receipt && receipt.requiredConfirmations
      ? ` · ${receipt.confirmations || 0}/${receipt.requiredConfirmations} confirmations` : '';
    return `<div class="ng-status" data-ng-status role="status" aria-live="polite" aria-atomic="true">${state.error ? '' : esc(message)}${esc(confirmations)} ${link}</div>
      ${state.error ? `<p class="ng-error" role="alert">${esc(state.error.message || state.message || 'This action could not be verified. Refresh and try again.')}</p>` : ''}
      ${state.phase === 'recoverable' ? `<div class="ng-recovery">
        ${hash ? '' : '<label>Transaction hash from your wallet<input data-ng-recovery-hash autocomplete="off" placeholder="0x…" aria-label="Transaction hash"></label>'}
        <button type="button" class="act" data-ng-resume>Check transaction</button>
        ${explanation('A slow or missing response does not mean a transaction failed. Your inventory changes only after confirmation.')}
      </div>` : ''}`;
  }

  function transfer(kind, tokenId) {
    const key = `${kind}:${tokenId}`, saved = recipients.get(key) || '';
    return `<details class="ng-transfer"><summary>Transfer to another wallet</summary>
      <label>Recipient wallet (0x address)<input id="ng-to-${esc(kind)}-${esc(tokenId)}" data-ng-recipient="${esc(key)}" value="${esc(saved)}" autocomplete="off" spellcheck="false" placeholder="0x…"></label>
      ${explanation(kind === 'car' ? 'The receiving wallet needs an active onchain character and a free garage slot. Use a full address; name resolution is unavailable here.' : 'Use a full address; name resolution is unavailable here. Unassign a tool before transferring it.')}
      ${button(kind === 'car' ? 'transferCar' : 'transferTool', 'Transfer', { tokenId }, ` data-ng-transfer="${esc(key)}"`)}
    </details>`;
  }

  function cars(board) {
    if (!board.cars?.length) return '<p class="ng-empty">No cars in this wallet. A successful theft adds one here after confirmation.</p>';
    return `<div class="ng-inventory">${board.cars.map(car => {
      const tokenId = String(car.tokenId), junker = Number(car.modelIndex) === 0;
      const rarity = car.rarityName || car.rarity || '';
      return `<article class="ng-item" data-ng-car="${esc(tokenId)}">
        <div class="ng-item-head"><h4>${esc(car.modelName || car.model || `Car #${tokenId}`)}</h4><span class="ng-token">#${esc(tokenId)}</span></div>
        <p class="ng-item-meta">${esc(car.trimName || car.trim || 'Ordinary car')}${rarity ? ' · ' + esc(rarity) : ''} · ${esc(car.damage ?? 0)}% damage</p>
        ${junker ? `<p class="ng-yield">Salvage yields 6 scrap · 2 wire · 2 parts</p>${button('salvage', 'Salvage junker', { tokenId })}` : explanation('Keep or transfer this car. This foundry salvages junkers.')}
        <details class="ng-provenance"><summary>Provenance</summary><dl><dt>Source</dt><dd>${esc(car.sourceHash || car.provenance?.sourceHash || '—')}</dd><dt>Theft request</dt><dd>${esc(car.requestId || car.provenance?.requestId || '—')}</dd><dt>Origin character</dt><dd>${esc(car.originProfile || car.provenance?.originProfile || '—')}</dd></dl></details>
        ${transfer('car', tokenId)}
        ${abandonedToken === tokenId ? `<div class="ng-abandon-confirm"><p>Abandon car #${esc(tokenId)} permanently? This burns the car and returns no OMR or materials.</p>${button('abandonCar', 'Confirm abandonment', { tokenId })}<button type="button" class="act" data-ng-keep>Keep car</button></div>`
          : `<button type="button" class="ng-text-button" data-ng-abandon="${esc(tokenId)}"${disabled('abandonCar') ? ' disabled' : ''}>Abandon for no reward</button>`}
      </article>`;
    }).join('')}</div>`;
  }

  function tools(board) {
    if (!board.tools?.length) return '<p class="ng-empty">No precision lock tools in this wallet. Craft one from steel and salvage parts below.</p>';
    return `<div class="ng-inventory">${board.tools.map(tool => {
      const id = String(tool.tokenId), assigned = !!tool.assignedProfile && !/^0x0+$/.test(tool.assignedProfile);
      const provenance = tool.provenance || {};
      return `<article class="ng-item" data-ng-tool="${esc(id)}"><div class="ng-item-head"><h4>Precision lock tool</h4><span class="ng-token">#${esc(id)}</span></div>
        <p class="ng-item-meta">${assigned ? 'Assigned to an onchain character · unassign to transfer' : 'Unassigned · transferable'}</p>
        ${button(assigned ? 'unassign' : 'assign', assigned ? 'Unassign tool' : 'Assign tool', { tokenId: id })}
        ${assigned ? '' : transfer('tool', id)}
        <details class="ng-provenance"><summary>Provenance</summary><dl><dt>Crafting character</dt><dd>${esc(provenance.characterIdHash || '—')}</dd><dt>Recipe</dt><dd>${esc(provenance.recipeCommitment || '—')}</dd><dt>Sequence</dt><dd>${esc(provenance.sequence || id)}</dd></dl></details>
      </article>`;
    }).join('')}</div>`;
  }

  function render() {
    if (disposed || !root?.isConnected) return;
    const focused = root.contains(document.activeElement) ? document.activeElement.id : '';
    const open = [...root.querySelectorAll('details[open]')].map(detail => detail.dataset.ngDetails).filter(Boolean);
    const board = state.board;
    const header = `<header class="ng-header"><div><span class="ng-kicker">Your wallet · your inventory</span><h2>Onchain Garage</h2></div>
      <div class="ng-header-actions">${board?.enabled ? `<button type="button" class="act" data-ng-connect${state.busy ? ' disabled' : ''}>Choose wallet</button>` : ''}<button type="button" class="act" data-ng-refresh${state.busy ? ' disabled' : ''}>Refresh</button></div></header>`;
    if (!board?.configured || !board?.enabled) {
      root.innerHTML = `${header}${status()}<div class="ng-unavailable"><span class="ng-tag">Not active</span><h3>${board ? 'The onchain garage is not connected yet' : 'Checking the onchain garage'}</h3><p>${esc(board?.reason || 'Waiting for a verified deployment. Your city inventory is separate.')}</p></div>`;
      bind(); return;
    }
    if (!board.wallet) {
      root.innerHTML = `${header}${status()}<p class="ng-empty">Connect your wallet to read its onchain character and inventory.</p><button type="button" class="act primary" data-ng-connect>Connect wallet</button>`;
      bind(); return;
    }
    const profile = board.profile, pending = board.pending, material = board.materials || {};
    const fee = units(board.omr?.hardeningCostWei || '600000000000000000', 18, 4);
    const indexing = board.indexing?.status && board.indexing.status !== 'ready';
    root.innerHTML = `${header}
      <div class="ng-account"><span class="ng-tag">${profile?.retired ? 'Retired character' : profile?.claimed ? 'Onchain character' : profile?.id ? 'Claim available' : 'No onchain character'}</span><span title="${esc(board.wallet)}">${esc(short(board.wallet))}</span><span>Chain ${esc(board.chainId)}</span></div>
      ${status()}
      ${indexing ? `<p class="ng-indexing" role="status">Updating confirmed inventory… ${esc(board.indexing.cursorBlock || '')} / ${esc(board.indexing.targetBlock || '')}</p>` : ''}
      ${!board.wallet ? `<p class="ng-empty">Connect your wallet to read its onchain character and inventory.</p><button type="button" class="act primary" data-ng-connect>Connect wallet</button>`
        : !profile?.id ? explanation('This wallet has no character in this deployment. Connect a wallet with an onchain character to play here.')
          : !profile.claimed ? `<div class="ng-claim"><h3>Your character is ready to claim</h3><p>Claim once from the wallet shown above. The city character stays in onchain mode.</p>${button('claim', 'Claim onchain character')}</div>` : ''}
      ${profile?.claimed ? `<section class="ng-theft" aria-labelledby="ng-theft-title"><div><span class="ng-kicker">The next set of wheels</span><h3 id="ng-theft-title">Boost a car</h3><p>10 energy per attempt · 5-minute cooldown · ordinary cars</p></div>
        <div class="ng-energy"><b>${esc(units(board.energy?.micros, 6, 2))}</b><span>/ ${esc(units(board.energy?.capMicros, 6, 2))} energy</span></div>
        ${pending?.requestId && pending.requestId !== '0' ? `<div class="ng-pending"><h4>Theft in progress</h4><p>${pending.fulfilled ? 'Your beacon proof is verified. Settle the fixed result to finish the attempt.' : 'The attempt is locked. Submit the beacon proof when its round is ready.'}</p><p class="ng-note">Request #${esc(pending.requestId)} · round ${esc(pending.round)}${pending.readyAt ? ' · ready at ' + esc(date(Number(pending.readyAt) * 1000)) : ''}</p>
          ${button(pending.fulfilled ? 'settleGta' : 'fulfill', pending.fulfilled ? 'Settle theft' : 'Submit beacon proof', { requestId: pending.requestId })}</div>`
          : `${button('requestGta', 'Boost a car · 10 energy')}${number(board.energy?.nextGtaAtMs) > BigInt(Date.now()) ? explanation('Next attempt at ' + date(board.energy.nextGtaAtMs)) : ''}${number(board.energy?.jailUntilMs) > BigInt(Date.now()) ? explanation('Jail ends at ' + date(board.energy.jailUntilMs)) : ''}`}
        ${profile.retired ? explanation('This character is retired. Existing items can still leave the wallet; a locked theft keeps its original result.') : ''}
      </section>` : ''}
      <section class="ng-foundry" aria-labelledby="ng-foundry-title"><div class="ng-section-head"><div><span class="ng-kicker">Salvage → steel → tools</span><h3 id="ng-foundry-title">The Foundry</h3></div><p>${esc(units(board.omr?.balance))} OMR in wallet</p></div>
        <dl class="ng-materials">${[['scrap', 'Scrap'], ['wire', 'Wire'], ['steel', 'Hardened steel'], ['parts', 'Salvage parts']].map(([key, label]) => `<div><dt>${label}</dt><dd>${esc(material[key] || '0')}</dd></div>`).join('')}</dl>
        <div class="ng-recipes"><article><h4>Harden steel</h4><p>4 scrap + ${esc(fee)} OMR → 1 hardened steel</p>${number(board.omr?.allowance) < number(board.omr?.hardeningCostWei || '600000000000000000') ? button('approve', `Approve ${fee} OMR`, { batches: '1' }) : button('harden', `Harden steel · ${fee} OMR`, { batches: '1' })}<p class="ng-note">Exact allowance for one batch. Payment goes to the house. USD estimate unavailable; your wallet shows network gas.</p></article>
          <article><h4>Precision lock tool</h4><p>1 hardened steel + 2 salvage parts → 1 unique tool</p>${button('craft', 'Craft precision lock tool')}<p class="ng-note">Permanent crafting provenance stays with the tool after a transfer.</p></article></div>
      </section>
      <section class="ng-fleet" aria-labelledby="ng-fleet-title"><div class="ng-section-head"><h3 id="ng-fleet-title">Your cars</h3><span>${esc(board.cars?.length || 0)} / 12 garage slots</span></div>${indexing ? explanation('Inventory is being reconciled. Refresh to see confirmed ownership.') : cars(board)}</section>
      <section class="ng-tools" aria-labelledby="ng-tools-title"><h3 id="ng-tools-title">Your tools</h3>${indexing ? explanation('Inventory is being reconciled.') : tools(board)}
        ${board.inventory?.hasNext ? `<button type="button" class="act" data-ng-next="${esc(board.inventory.nextCursor)}"${state.busy ? ' disabled' : ''}>Next inventory page</button>` : ''}
        ${board.inventory?.cursor && board.inventory.cursor !== '0' ? `<button type="button" class="act" data-ng-first${state.busy ? ' disabled' : ''}>First inventory page</button>` : ''}</section>
      <footer class="ng-footer">Inventory and materials come from confirmed chain state. Sending a transaction does not credit an item.</footer>`;
    root.querySelectorAll('details').forEach((detail, index) => { detail.dataset.ngDetails = String(index); if (open.includes(String(index))) detail.open = true; });
    bind();
    if (focused) root.querySelector(`#${CSS.escape(focused)}`)?.focus({ preventScroll: true });
  }

  function bind() {
    root.querySelector('[data-ng-refresh]')?.addEventListener('click', () => client.load());
    root.querySelectorAll('[data-ng-connect]').forEach(control => control.addEventListener('click', () => client.connect({ force: true })));
    root.querySelector('[data-ng-resume]')?.addEventListener('click', () => client.resume(root.querySelector('[data-ng-recovery-hash]')?.value?.trim()));
    root.querySelector('[data-ng-next]')?.addEventListener('click', event => client.load({ cursor: event.currentTarget.dataset.ngNext }));
    root.querySelector('[data-ng-first]')?.addEventListener('click', () => client.load({ cursor: '0' }));
    root.querySelectorAll('[data-ng-recipient]').forEach(input => input.addEventListener('input', () => recipients.set(input.dataset.ngRecipient, input.value)));
    root.querySelectorAll('[data-ng-abandon]').forEach(control => control.addEventListener('click', () => { abandonedToken = control.dataset.ngAbandon; render(); }));
    root.querySelector('[data-ng-keep]')?.addEventListener('click', () => { abandonedToken = ''; render(); });
    root.querySelectorAll('[data-ng-action]').forEach(control => control.addEventListener('click', () => {
      let args;
      try { args = JSON.parse(control.dataset.ngArgs); } catch { return; }
      if (control.dataset.ngTransfer) args.to = (recipients.get(control.dataset.ngTransfer) || '').trim();
      client.perform(control.dataset.ngAction, args);
    }));
  }

  const interval = setInterval(() => {
    if (!disposed && root?.isConnected && root.getClientRects().length && !document.hidden && !state.busy && state.board?.enabled) client.load();
  }, 12000);
  return {
    client,
    mount(element) { root = element; render(); return client.load(); },
    dispose() { disposed = true; clearInterval(interval); client.dispose(); root = null; },
  };
}
