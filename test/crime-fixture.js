// Legacy feature suites explicitly complete the required crime minigame. The
// shared server fixture stays untouched so protocol tests exercise raw requests.
const receipts = new WeakMap();

export async function injectWithCrimeMinigame(app, options) {
  if (options.method !== 'POST' || !/^\/v1\/crimes\/[^/?]+$/.test(options.url)
    || options.payload?.minigame) return app.inject(options);
  const headers = options.headers || {};
  const key = headers['idempotency-key'];
  const identity = key ? `${headers.authorization}:${options.url}:${key}` : null;
  let cache = receipts.get(app);
  if (!cache) { cache = new Map(); receipts.set(app, cache); }
  let minigame = identity && cache.get(identity);
  if (!minigame) {
    const approach = options.payload?.approach || 'standard';
    const challenge = await app.inject({ method: 'GET',
      url: `${options.url}/challenge?approach=${encodeURIComponent(approach)}`, headers });
    if (challenge.statusCode !== 200) return app.inject(options);
    const lock = challenge.json().minigame;
    minigame = { token: lock.token, moves: lock.rounds.flat() };
    if (identity) cache.set(identity, minigame);
  }
  return app.inject({ ...options, payload: { ...options.payload, minigame } });
}

export async function solveCrimeMinigame(page) {
  const dialog = page.locator('dialog.crime-minigame');
  await dialog.waitFor({ state: 'visible' });
  for (let round = 0; round < 3; round++) {
    const begin = dialog.locator('[data-crime-begin]');
    await begin.waitFor({ state: 'visible' });
    const values = await dialog.locator('[data-crime-sequence] [data-crime-value]')
      .evaluateAll((tokens) => tokens.map((token) => token.dataset.crimeValue));
    if (!values.length) throw new Error('The crime minigame must show a sequence before each round.');
    await begin.click();
    for (const value of values) await dialog.locator(`[data-crime-pad="${value}"]`).click();
  }
  await dialog.waitFor({ state: 'hidden' });
}
