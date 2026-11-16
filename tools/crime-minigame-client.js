// Release harnesses play the same public minigame protocol as other clients.
// Perfect play preserves their pinned crime rolls and economy measurements.
export async function completeCrimeMinigame(request, path, options = {}) {
  if (options.body?.minigame) return request('POST', path, options);
  const approach = options.body?.approach || 'standard';
  const challenge = await request('GET', `${path}/challenge?approach=${encodeURIComponent(approach)}`, { token: options.token });
  // Keep refusal/outage probes on the actual mutation route as well.
  if (challenge.code !== 200) return request('POST', path, options);
  const minigame = challenge.body?.minigame;
  if (!minigame?.token || !Array.isArray(minigame.rounds)) throw new Error(`Missing crime minigame challenge for ${path}`);
  return request('POST', path, { ...options,
    body: { ...options.body, minigame: { token: minigame.token, moves: minigame.rounds.flat() } } });
}
