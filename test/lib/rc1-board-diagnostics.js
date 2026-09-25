// Read-only bounded DOM lifecycle trace. No identities, text, tokens or request bodies.
export async function installBoardDiagnostics(page) {
  await page.evaluate(() => {
    if (window.__rc1BoardDiagnostics) return;
    const events = []; let sequence = 0;
    const state = () => ({ at: Date.now(), loading: [...document.querySelectorAll('#tab-world .world-card[role="status"]')]
      .some(node => node.textContent.includes('Refreshing your street')), summary: !!document.querySelector('#tab-world .world-summary'),
      buttons: document.querySelectorAll('#tab-world button').length });
    const observer = new MutationObserver(records => {
      if (!records.some(r => r.target.id === 'tab-world' || r.target.closest?.('#tab-world'))) return;
      events.push({ sequence: ++sequence, ...state() }); if (events.length > 40) events.shift();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.__rc1BoardDiagnostics = { read: () => ({ state: state(), events: events.slice() }) };
  });
  return () => page.evaluate(() => window.__rc1BoardDiagnostics.read());
}
