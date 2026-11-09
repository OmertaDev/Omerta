import { buildServer as buildRealServer } from '../src/server.js';

export async function buildServer(...args) {
  return buildRealServer(...args);
}
