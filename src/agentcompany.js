import { resourceError, resourceTransaction } from './resourcebook.js';

function terms(body) {
  if (!body || Array.isArray(body) || typeof body !== 'object'
      || Object.keys(body).length !== 4 || Object.keys(body).some(key => !['expectedRevision','name','published','premises'].includes(key))
      || !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0 || body.expectedRevision > 2147483646
      || typeof body.published !== 'boolean' || ![null,'estate','street'].includes(body.premises)
      || typeof body.name !== 'string') throw resourceError('terms', 'Use exact bounded company terms.');
  const name = body.name.normalize('NFC').trim();
  if (Array.from(name).length < 2 || Array.from(name).length > 64
      || !/^[\p{L}\p{N}][\p{L}\p{N} .&'’-]*$/u.test(name)) throw resourceError('terms', 'Use a plain company name between 2 and 64 characters.');
  return { ...body, name };
}

async function projection(client, row) {
  let premises = null;
  if (row.premises_kind === 'estate') {
    const estate = (await client.query('SELECT tier FROM estates WHERE account_id=$1', [row.account_id])).rows[0];
    const verified = row.premises_key === row.account_id && Number.isSafeInteger(estate?.tier) && estate.tier >= 1;
    premises = verified ? { kind: 'estate', verified: true, tier: estate.tier } : { kind: 'estate', verified: false };
  } else if (row.premises_kind === 'street') {
    const deed = (await client.query('SELECT name_lc,district,onchain_token_id FROM street_deeds WHERE account_id=$1', [row.account_id])).rows[0];
    const verified = Boolean(deed && deed.onchain_token_id === null && deed.name_lc === row.premises_key && deed.district === row.premises_district);
    premises = verified ? { kind: 'street', verified: true, district: deed.district } : { kind: 'street', verified: false };
  }
  return { accountId: row.account_id, revision: row.revision, name: row.name, published: row.published, premises };
}

async function profile(client, account) {
  return (await client.query('SELECT account_id,revision,name,published,premises_kind,premises_key,premises_district FROM agent_company_profiles WHERE account_id=$1', [account])).rows[0];
}

export async function setAgentCompany(pool, account, input) {
  const body = terms(input);
  return resourceTransaction(pool, async client => {
    const owner = (await client.query('SELECT id FROM accounts WHERE id=$1 FOR UPDATE', [account])).rows[0];
    if (!owner) throw resourceError('not_found', 'Company owner was not found.');
    const old = await profile(client, account);
    if ((old?.revision || 0) !== body.expectedRevision) throw resourceError('revision', 'Company revision changed.');
    let key = null, district = null;
    if (body.premises === 'estate') {
      const estate = (await client.query('SELECT tier FROM estates WHERE account_id=$1', [account])).rows[0];
      if (!Number.isSafeInteger(estate?.tier) || estate.tier < 1) throw resourceError('premises', 'An owned established estate is required.');
      key = account;
    } else if (body.premises === 'street') {
      const deed = (await client.query('SELECT name_lc,district,onchain_token_id FROM street_deeds WHERE account_id=$1', [account])).rows[0];
      if (!deed || deed.onchain_token_id !== null) throw resourceError('premises', 'An owned active street deed is required.');
      key = deed.name_lc; district = deed.district;
    }
    await client.query('INSERT INTO agent_company_profiles(account_id,revision,name,published,premises_kind,premises_key,premises_district) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(account_id) DO UPDATE SET revision=EXCLUDED.revision,name=EXCLUDED.name,published=EXCLUDED.published,premises_kind=EXCLUDED.premises_kind,premises_key=EXCLUDED.premises_key,premises_district=EXCLUDED.premises_district,updated_at=now()',
      [account, body.expectedRevision + 1, body.name, body.published, body.premises, key, district]);
    return { company: await projection(client, await profile(client, account)) };
  });
}

export async function ownAgentCompany(pool, account) {
  return resourceTransaction(pool, async client => {
    const row = await profile(client, account);
    return { company: row ? await projection(client, row) : null };
  });
}
export async function publicAgentCompany(client, account) {
  const row = await profile(client, account);
  return row?.published === true ? projection(client, row) : null;
}
export async function getAgentCompany(pool, account) {
  return resourceTransaction(pool, async client => {
    const company = await publicAgentCompany(client, account);
    if (!company) throw resourceError('not_found', 'Company was not found.');
    return { company };
  });
}
