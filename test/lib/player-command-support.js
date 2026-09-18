import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { newDb, DataType } from 'pg-mem';
import { dbCaps, registerPgMemCompatibility } from '../../src/db.js';
import { createPlayerCommandEngine } from '../../src/player-commands.js';

export const postgres = process.argv.includes('--postgres');
export const key = () => crypto.randomUUID();
export const characterId = (accountId) => `${accountId}-character`;

export async function commandDatabase(tag) {
  let result;
  if (postgres) {
    const url = process.env.COORDINATION_TEST_DATABASE_URL || process.env.WORLD_KERNEL_TEST_DATABASE_URL;
    assert(url, 'An explicit isolated PostgreSQL database URL is required');
    const endpoint = new URL(url);
    assert(['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname));
    const { Pool } = await import('pg');
    const base = new Pool({ connectionString: endpoint.toString() });
    const namespace = `command_${tag}_${crypto.randomBytes(8).toString('hex')}`;
    assert(/^[a-z_0-9]+$/.test(namespace));
    await base.query(`CREATE SCHEMA ${namespace}`);
    const reopen = () => new Pool({ connectionString: endpoint.toString(),
      options: `-c search_path=${namespace} -c lock_timeout=8000 -c statement_timeout=20000` });
    result = { pool: reopen(), reopen, async cleanup(pool) {
      await pool.end(); await base.query(`DROP SCHEMA ${namespace} CASCADE`); await base.end();
    } };
    dbCaps.skipLocked = true;
  } else {
    const mem = newDb({ noAstCoverageCheck: true });
    registerPgMemCompatibility(mem, DataType);
    const { Pool } = mem.adapters.createPg();
    result = { pool: new Pool(), reopen: () => new Pool(), cleanup: (pool) => pool.end() };
    dbCaps.skipLocked = false;
  }
  await result.pool.query(fs.readFileSync(new URL('../../schema.sql', import.meta.url), 'utf8'));
  return result;
}

export const engineFor = (pool, content) => createPlayerCommandEngine({ pool, content: { ...content, progression: true },
  enabled: true, knowledgeEnabled: true, sharingEnabled: true, accountIds: [] });

export async function addPlayer(pool, accountId, name = accountId, location = 'docks') {
  await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [accountId]);
  await pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [accountId]);
  await pool.query(`INSERT INTO characters(id,account_id,name,season,loc,respect,cash,muscle,cunning,speed)
    VALUES($1,$2,$3,1,$4,10000,100000,50,50,50)`, [characterId(accountId), accountId, name, location]);
}

export function findCommand(view, type, parameters = {}, availability = 'AVAILABLE') {
  const result = view.commands.find((command) => command.commandType === type
    && command.availability === availability
    && Object.entries(parameters).every(([name, value]) => command.parameters?.[name] === value));
  assert(result, `Expected ${availability} ${type} ${JSON.stringify(parameters)}; received ${JSON.stringify(view.commands.map((c) => ({
    type: c.commandType, state: c.availability, parameters: c.parameters })))}`);
  return result;
}

export const executeIssued = (engine, accountId, command, confirmed = true) => engine.execute(accountId,
  { executionId: command.executionIdentity.executionId, confirmed }, command.executionIdentity.executionId);

export async function issueAndExecute(engine, accountId, type, parameters = {}, options = {}) {
  const view = await engine.snapshot(accountId, options);
  const command = findCommand(view, type, parameters);
  const response = await executeIssued(engine, accountId, command);
  assert.equal(response.status, 'COMPLETED');
  assert.equal(response.executionId, command.executionIdentity.executionId);
  return { response, command, before: view };
}
