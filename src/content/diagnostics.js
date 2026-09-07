const DEFAULT_MAXIMUM_BYTES = 4_096;

function isEscapedControl(code) {
  return code <= 0x1f
    || (code >= 0x7f && code <= 0x9f)
    || code === 0x061c
    || code === 0x200e
    || code === 0x200f
    || code === 0x2028
    || code === 0x2029
    || (code >= 0x202a && code <= 0x202e)
    || (code >= 0x2066 && code <= 0x2069);
}

function escapedCodeUnit(code) {
  return `\\u${code.toString(16).padStart(4, '0')}`;
}

function sanitizeDiagnostic(value) {
  const source = String(value);
  const chunks = [];
  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index);
    if (isEscapedControl(code)) {
      chunks.push(escapedCodeUnit(code));
      continue;
    }
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = source.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        chunks.push(source[index], source[index + 1]);
        index += 1;
      } else {
        chunks.push(escapedCodeUnit(code));
      }
      continue;
    }
    if (code >= 0xdc00 && code <= 0xdfff) {
      chunks.push(escapedCodeUnit(code));
      continue;
    }
    chunks.push(source[index]);
  }
  return chunks.join('');
}

export function safeDiagnostic(value, maximumBytes = DEFAULT_MAXIMUM_BYTES) {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 0) {
    throw new TypeError('diagnostic byte limit must be a non-negative safe integer');
  }
  const escaped = sanitizeDiagnostic(value);
  if (Buffer.byteLength(escaped, 'utf8') <= maximumBytes) return escaped;
  const suffix = maximumBytes >= 3 ? '...' : '.'.repeat(maximumBytes);
  const available = maximumBytes - Buffer.byteLength(suffix, 'utf8');
  const chunks = [];
  let bytes = 0;
  for (const character of escaped) {
    const size = Buffer.byteLength(character, 'utf8');
    if (bytes + size > available) break;
    chunks.push(character);
    bytes += size;
  }
  return `${chunks.join('')}${suffix}`;
}
