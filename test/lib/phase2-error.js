const safeCodes = new Set(['08000', '08003', '08006', '22003', '23502', '23503', '23505', '23514',
  '25P02', '40001', '40P01', '42P01', '42703', '55000', '57014', 'P0001',
  'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ERR_MODULE_NOT_FOUND', 'ERR_INVALID_ARG_TYPE',
  'content_registry_schema_invalid', 'content_registry_schema_missing']);
const safeOperators = new Set(['==', '!=', '===', '!==', 'strictEqual', 'notStrictEqual',
  'deepEqual', 'notDeepEqual', 'deepStrictEqual', 'notDeepStrictEqual', 'throws', 'doesNotThrow',
  'rejects', 'doesNotReject', 'match', 'doesNotMatch', 'ifError']);

export function phase2ErrorSummary(error) {
  let code, stackValue, message, actual, expected, operator;
  try { ({ code, stack: stackValue, message, actual, expected, operator } = error ?? {}); }
  catch { return 'code: test_failed'; }
  if (code !== 'ERR_ASSERTION') return `code: ${safeCodes.has(code) ? code : 'test_failed'}`;
  let location = 'unknown assertion location';
  const stack = typeof stackValue === 'string' ? stackValue : '';
  const header = typeof message === 'string'
    ? ['AssertionError [ERR_ASSERTION]', 'AssertionError']
      .map((name) => name + (message ? ': ' + message : ''))
      .find((value) => stack === value || stack.startsWith(value + '\n') || stack.startsWith(value + '\r\n')) : null;
  // A multiline message can contain frame-shaped data. Consume its complete exact header first.
  for (const line of (header == null ? '' : stack.slice(header.length)).split(/\r?\n/)) {
    if (!/^\s+at\s+/.test(line)) continue;
    const frame = line.match(/(?:^|[\\/ (\t])([A-Za-z0-9][A-Za-z0-9_.-]*\.m?js:[1-9]\d{0,6}:[1-9]\d{0,6})\)?\s*$/);
    if (frame) { location = frame[1]; break; }
  }
  const scalar = (value) => value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))
    ? JSON.stringify(value) : '[redacted non-scalar]';
  return `assertion at ${location}; actual=${scalar(actual)} expected=${scalar(expected)}; ${safeOperators.has(operator) ? operator : 'unknown'}`;
}
