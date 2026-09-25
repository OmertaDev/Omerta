// Passive, bounded diagnostics. No DOM/state writes, synthetic focus, or retries.
export async function installFocusDiagnostics(page) {
  const network = [], pending = new Set();
  const selected = request => /\/v1\/(me|crew(?:\/chat)?|circle|invites|notifications)$/.test(new URL(request.url()).pathname);
  page.on('request', request => { if (selected(request)) { pending.add(request); network.push({ at: Date.now(), event: 'request', path: new URL(request.url()).pathname, pending: pending.size }); } });
  const end = (request, event) => { if (pending.delete(request)) network.push({ at: Date.now(), event, path: new URL(request.url()).pathname, pending: pending.size }); };
  page.on('requestfinished', request => end(request, 'finished')); page.on('requestfailed', request => end(request, 'failed'));
  await page.addInitScript(() => {
    const events = [], nodes = new WeakMap(); let counter = 0;
    const identify = node => {
      if (!node || node.nodeType !== 1) return null;
      if (!nodes.has(node)) nodes.set(node, ++counter);
      return { serial: nodes.get(node), tag: node.tagName, id: node.id || null, connected: node.isConnected,
        inputLength: typeof node.value === 'string' ? node.value.length : null };
    };
    const state = () => ({ at: Date.now(), active: identify(document.activeElement), input: identify(document.querySelector('#crew-say')),
      viewport: { width: innerWidth, height: innerHeight }, crewVisible: !!document.querySelector('#tab-crew.on'),
      modals: [...document.querySelectorAll('.modal-bg:not(.hidden)')].map(node => ({ id: node.id || null, managed: node.hasAttribute('data-managed-dialog') })) });
    const record = (event, extra = {}) => { events.push({ event, ...state(), ...extra }); if (events.length > 800) events.shift(); };
    window.__rc1FocusDiagnostics = { mark: label => record('checkpoint', { label }), read: () => ({ state: state(), events: [...events] }) };
    for (const event of ['focusin', 'focusout', 'input', 'change']) document.addEventListener(event, value => {
      record(event, { target: identify(value.target), trusted: value.isTrusted });
    }, true);
    addEventListener('resize', () => record('resize'));
    const focus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function (...args) { record('focus-call', { target: identify(this), stack: new Error().stack }); return focus.apply(this, args); };
    const html = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    Object.defineProperty(Element.prototype, 'innerHTML', { ...html, set(value) {
      if (this.id === 'tab-crew') record('crew-render-before', { target: identify(this), stack: new Error().stack });
      html.set.call(this, value);
      if (this.id === 'tab-crew') record('crew-render-after', { target: identify(this) });
    } });
    new MutationObserver(records => {
      if (records.some(row => row.target?.classList?.contains('modal-bg') || [...row.removedNodes].some(node => node.nodeType === 1 && (node.id === 'crew-say' || node.querySelector?.('#crew-say')))))
        record('modal-or-input-mutation');
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  });
  return { async mark(label) { await page.evaluate(label => window.__rc1FocusDiagnostics?.mark(label), label); },
    async read() { return { ...(await page.evaluate(() => window.__rc1FocusDiagnostics?.read() || null)), network: network.slice(-500), pending: [...pending].map(request => new URL(request.url()).pathname) }; } };
}
