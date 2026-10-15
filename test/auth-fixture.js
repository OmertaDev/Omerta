// Synthetic adult fixtures for unrelated auth tests; age.js tests the gate itself.
export function adultAuthFixture(method, url, body) {
  if (method === 'POST' && ['/v1/auth/guest', '/v1/auth/x', '/v1/auth/privy', '/v1/auth/x/start', '/v1/access/redeem'].includes(url))
    return { birthDate: '1990-01-01', ...body };
  return body;
}
