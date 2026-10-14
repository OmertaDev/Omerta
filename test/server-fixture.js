import { buildServer as buildRealServer } from '../src/server.js';
import { adultAuthFixture } from './auth-fixture.js';

// Legacy gameplay suites use synthetic adults. Gate-specific suites import the
// real server directly, so missing-age and underage assertions remain strict.
export async function buildServer(...args) {
  const app = await buildRealServer(...args);
  const inject = app.inject.bind(app);
  app.inject = (options, ...rest) => {
    if (options && typeof options === 'object') {
      const method = String(options.method || 'GET').toUpperCase();
      const url = String(options.url || options.path || '').split('?')[0];
      const headers = options.headers || {};
      const emptyJson = options.payload === undefined && Object.entries(headers)
        .some(([name, value]) => name.toLowerCase() === 'content-type' && String(value).includes('application/json'));
      if (!emptyJson) {
        let body = options.payload;
        const json = typeof body === 'string';
        let valid = true;
        if (json) { try { body = JSON.parse(body); } catch { valid = false; } }
        if (valid && (body === undefined || (body && typeof body === 'object' && !Array.isArray(body) && !Buffer.isBuffer(body)))) {
          const next = adultAuthFixture(method, url, body);
          if (next !== body) options = { ...options, payload: json ? JSON.stringify(next) : next };
        }
      }
    }
    return inject(options, ...rest);
  };
  return app;
}
