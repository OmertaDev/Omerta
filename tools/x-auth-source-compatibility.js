// Exact auth successor bridge for historical source fixtures. Reconstructed text is never executed.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const X_AUTH_SOURCE_REVISION = '8e2aec31829b2b22259826125645da8caad7c39e';
export const X_AUTH_SOURCE_PREDECESSOR = '59dbb6d99312fa44dba1fbec5bdf24948740e0dc';
export const X_AUTH_SOURCE_PHASE = 'exact-source-transfer-only; no runtime/native/migration/financial/deployment clearance';
export const X_AUTH_SOURCE_DOMAINS = freeze({
  "public/index.html": {
    "currentSha256": "37dd6cc252fd828fb9da47243fa5e3b3b1485cd5774ee63f7088af7a84f760c9",
    "currentBlob": "455c60fa834eb28162837bed530381d47625f0e4",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "37dd6cc252fd828fb9da47243fa5e3b3b1485cd5774ee63f7088af7a84f760c9",
      "crlf": "1e39aedcf3e0c21a9f17bb60a7748d564a8f2a72778aeeb656d86b86c718832f"
    },
    "baselineSha256": "9f8baaf26731853d89fde6015e51f5355f23ef0347fb0a850f3ad4edfa771951",
    "baselineBlob": "6221711be794023ee60c53f2039795d14be7cf65",
    "baselineMode": "100644",
    "contextLines": 3,
    "inverses": [
      {
        "current": "      const AUTHERR = {\n        oauth_state: 'that sign-in link expired — hit the X button again',\n        oauth_session: 'that sign-in started in a different browser — hit the X button again here',\n        oauth_denied: 'X sign-in was cancelled — hit the X button when you are ready',\n        oauth_authorize: 'X could not authorize the app — try again',\n        oauth_exchange: 'X refused the sign-in — try again',\n        oauth_me: 'X did not return your profile — try again',\n        x_busy: 'X is busy right now — try again in a minute',\n",
        "baseline": "      const AUTHERR = {\n        oauth_state: 'that sign-in link expired — hit the X button again',\n        oauth_session: 'that sign-in started in a different browser — hit the X button again here',\n        oauth_exchange: 'X refused the sign-in — try again',\n        oauth_me: 'X did not return your profile — try again',\n        x_busy: 'X is busy right now — try again in a minute',\n"
      },
      {
        "current": "    if (h.get('token') || h.get('claimed') || h.get('autherr')) history.replaceState(null, '', location.pathname);\n  })();\n  const startXOAuth = async () => {\n    const inviteCode = $('#invite-code')?.value?.trim();\n    const r = await api('POST', '/v1/auth/x/start', inviteCode ? { inviteCode } : {});\n    if (r.body?.url) location.href = r.body.url;\n",
        "baseline": "    if (h.get('token') || h.get('claimed') || h.get('autherr')) history.replaceState(null, '', location.pathname);\n  })();\n  const startXOAuth = async () => {\n    if (!token && !await verifyAge()) return;\n    const inviteCode = $('#invite-code')?.value?.trim();\n    const r = await api('POST', '/v1/auth/x/start', inviteCode ? { inviteCode } : {});\n    if (r.body?.url) location.href = r.body.url;\n"
      },
      {
        "current": "    else toast(r.body?.message || r.body?.error || 'no dice', true);\n    return false;\n  };\n  const enterAsGhost = async () => {\n    const inviteCode = undefined;\n    landToken(await api('POST', '/v1/auth/guest', inviteCode ? { inviteCode } : {}));\n  };\n",
        "baseline": "    else toast(r.body?.message || r.body?.error || 'no dice', true);\n    return false;\n  };\n  let ageChecked = 0;\n  async function verifyAge() {\n    if (ageChecked > Date.now()) return true;\n    if (sessionStorage.getItem('omerta_age_blocked')) {\n      toast('Account creation is unavailable. See the privacy page for help.', true);\n      return false;\n    }\n    return new Promise((resolve) => {\n      const dialog = document.createElement('dialog');\n      dialog.className = 'modal';\n      dialog.setAttribute('aria-labelledby', 'age-title');\n      dialog.innerHTML = `<h2 id=\"age-title\">Your birth date</h2><p>Enter your complete birth date to continue. We check it without saving it.</p><form><label for=\"age-date\">Birth date</label><input id=\"age-date\" name=\"birthDate\" type=\"date\" required min=\"${new Date().getFullYear() - 120}-01-01\" max=\"${new Date().toISOString().slice(0, 10)}\"><p id=\"age-error\" role=\"alert\"></p><p><a href=\"/privacy\">Privacy policy and help</a></p><button class=\"act\" type=\"submit\">Continue</button><button class=\"act\" type=\"button\" id=\"age-cancel\">Cancel</button></form>`;\n      document.body.append(dialog);\n      const finish = (ok) => { dialog.close(); dialog.remove(); resolve(ok); };\n      dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(false); });\n      dialog.querySelector('#age-cancel').onclick = () => finish(false);\n      dialog.querySelector('form').onsubmit = async (event) => {\n        event.preventDefault();\n        const input = dialog.querySelector('input');\n        const birthDate = input.value;\n        input.value = '';\n        const result = await api('POST', '/v1/age-check', { birthDate });\n        if (result.code < 400) { ageChecked = Date.now() + 14 * 60 * 1000; finish(true); }\n        else if (result.body?.error === 'age_ineligible') {\n          sessionStorage.setItem('omerta_age_blocked', '1');\n          dialog.querySelector('form').innerHTML = '<p role=\"alert\">Account creation is unavailable. No birth date was saved.</p><p><a href=\"/privacy\">Privacy policy and help</a></p><button type=\"button\" class=\"act\">Close</button>';\n          dialog.querySelector('button').onclick = () => finish(false);\n        } else dialog.querySelector('#age-error').textContent = result.body?.message || 'Please try again.';\n      };\n      dialog.showModal();\n      dialog.querySelector('input').focus();\n    });\n  }\n  const enterAsGhost = async () => {\n    if (!await verifyAge()) return;\n    const inviteCode = undefined;\n    landToken(await api('POST', '/v1/auth/guest', inviteCode ? { inviteCode } : {}));\n  };\n"
      },
      {
        "current": "  $('#btn-provider').onclick = async () => {\n    const provider = $('#auth-provider').value, tok = $('#auth-token').value.trim();\n    if (!tok) return toast('paste a provider token first', true);\n    const inviteCode = undefined;\n    landToken(await api(`POST`, `/v1/auth/${provider}`, { token: tok, ...(inviteCode ? { inviteCode } : {}) }));\n  };\n",
        "baseline": "  $('#btn-provider').onclick = async () => {\n    const provider = $('#auth-provider').value, tok = $('#auth-token').value.trim();\n    if (!tok) return toast('paste a provider token first', true);\n    if (!await verifyAge()) return;\n    const inviteCode = undefined;\n    landToken(await api(`POST`, `/v1/auth/${provider}`, { token: tok, ...(inviteCode ? { inviteCode } : {}) }));\n  };\n"
      }
    ]
  },
  "src/agentgateway.js": {
    "currentSha256": "ca2dd7ed8c646b140ab736c2b5e8e4b7f1835fd484b3c9d3ce32cf1c154d1114",
    "currentBlob": "d8c2a2216861c43e5f606d65847e4617efabb775",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "ca2dd7ed8c646b140ab736c2b5e8e4b7f1835fd484b3c9d3ce32cf1c154d1114",
      "crlf": "096a66e7e41335821a68cfd098fceb2f1ff9fbcac364dfe45df554210c347ee6"
    },
    "baselineSha256": "e7b51ba30ab4773dc9224cab005ca476b6f172d80f2bc1a608cf780fbc083c76",
    "baselineBlob": "99dff0e486012d7fe50a94aef91f000a6539d499",
    "baselineMode": "100644",
    "contextLines": 3,
    "inverses": [
      {
        "current": "  '/v1/rules', '/v1/catalog', '/v1/arena', '/v1/depots',\n  '/v1/resources/catalog', '/v1/resources/services', '/v1/resources/auctions', '/v1/resources/payments/webhook',\n  '/v1/auth/guest', '/v1/auth/x', '/v1/auth/privy',\n  '/v1/access/redeem', '/v1/access/logout', '/privacy', '/terms', '/dmca', '/resources', '/vendor/walletconnect.js',\n]);\n\n// Human/asset routes we don't advertise in the machine API contract (they serve HTML/markdown).\n",
        "baseline": "  '/v1/rules', '/v1/catalog', '/v1/arena', '/v1/depots',\n  '/v1/resources/catalog', '/v1/resources/services', '/v1/resources/auctions', '/v1/resources/payments/webhook',\n  '/v1/auth/guest', '/v1/auth/x', '/v1/auth/privy',\n  '/v1/access/redeem', '/v1/access/logout', '/v1/age-check', '/privacy', '/terms', '/dmca', '/resources', '/vendor/walletconnect.js',\n]);\n\n// Human/asset routes we don't advertise in the machine API contract (they serve HTML/markdown).\n"
      },
      {
        "current": "    requestSchema: { type: 'object', required: ['bootstrapSecret'], properties: {\n      inviteCode: { type: 'string', maxLength: 128, description: 'Unused launch invitation. Reuse the same bootstrapSecret after an ambiguous response.' },\n      bootstrapSecret: { type: 'string', pattern: '^[A-Za-z0-9_-]{43}$', description: 'Persist 32 cryptographically random bytes encoded as unpadded base64url before submitting.' },\n    } },\n  },\n  'POST /v1/access/session': { operationId: 'restoreBrowserAccess', requestSchema: { type: 'object' } },\n  'POST /v1/access/logout': { operationId: 'clearBrowserAccess', requestSchema: { type: 'object' } },\n  'GET /v1/invites': { operationId: 'getLaunchInvites' },\n",
        "baseline": "    requestSchema: { type: 'object', required: ['bootstrapSecret'], properties: {\n      inviteCode: { type: 'string', maxLength: 128, description: 'Unused launch invitation. Reuse the same bootstrapSecret after an ambiguous response.' },\n      bootstrapSecret: { type: 'string', pattern: '^[A-Za-z0-9_-]{43}$', description: 'Persist 32 cryptographically random bytes encoded as unpadded base64url before submitting.' },\n      birthDate: { type: 'string', format: 'date', description: 'Human/operator-supplied date for first account creation; omitted with a valid age-check cookie or existing bootstrap recovery. Never infer a date.' },\n    } },\n  },\n  'POST /v1/age-check': {\n    operationId: 'checkAgeEligibility',\n    requestSchema: { type: 'object', required: ['birthDate'], properties: {\n      birthDate: { type: 'string', format: 'date', description: 'Complete birth date, processed transiently and never saved in account records.' },\n    } },\n    extraResponses: { 403: { description: 'Account creation is unavailable; use the privacy contact for help.' } },\n  },\n  'POST /v1/access/session': { operationId: 'restoreBrowserAccess', requestSchema: { type: 'object' } },\n  'POST /v1/access/logout': { operationId: 'clearBrowserAccess', requestSchema: { type: 'object' } },\n  'GET /v1/invites': { operationId: 'getLaunchInvites' },\n"
      }
    ]
  },
  "src/server.js": {
    "currentSha256": "f775f051089211078de8336535515d4a76a815e6dee861b22ad242bc745e16a9",
    "currentBlob": "e7f936c6bd5c1638cadfbb26e4fafc7507c734b2",
    "currentMode": "100644",
    "currentRawSha256": {
      "lf": "f775f051089211078de8336535515d4a76a815e6dee861b22ad242bc745e16a9",
      "crlf": "5264ebccd4e18c0b8c64d85ed034434122121e260e2408ef4a424106fc6ae194"
    },
    "baselineSha256": "f1f043bff054253932104d00c8d132c6b64ebdde9b306b87c89a1b37e473c038",
    "baselineBlob": "a04c65a36f8b947cbea45b31f7eb11a81b080ced",
    "baselineMode": "100644",
    "contextLines": 3,
    "inverses": [
      {
        "current": "import jwt from '@fastify/jwt';\nimport websocket from '@fastify/websocket';\nimport crypto from 'node:crypto';\nimport zlib from 'node:zlib';\nimport { makeDb } from './db.js';\nimport { createCityActivityRegistry, readCityActivityActor, cityOwnerActivityCategory } from './city-activity.js';\n",
        "baseline": "import jwt from '@fastify/jwt';\nimport websocket from '@fastify/websocket';\nimport crypto from 'node:crypto';\nimport { eligibleBirthDate, ageCookie, ageStatus, requireAge } from './age.js';\nimport zlib from 'node:zlib';\nimport { makeDb } from './db.js';\nimport { createCityActivityRegistry, readCityActivityActor, cityOwnerActivityCategory } from './city-activity.js';\n"
      },
      {
        "current": "    return { ok: true };\n  });\n\n  const guestLogin = async (req) => {\n    if (req.body && typeof req.body === 'object' && !Array.isArray(req.body) &&\n        Object.prototype.hasOwnProperty.call(req.body, 'bootstrapSecret')) {\n      const { accountId, tokenVersion } = await A.accountForGuestBootstrap(\n        pool, req.body.bootstrapSecret, req.ip || '0.0.0.0', req.body.inviteCode,\n      );\n      return { token: await signFor(accountId, {}, '30d', tokenVersion) };\n    }\n    const id = await A.createGuestAccount(pool, req.ip || '0.0.0.0', req.body?.inviteCode);\n    return { token: await signFor(id, {}, '30d', 0) };\n  };\n",
        "baseline": "    return { ok: true };\n  });\n\n  app.post('/v1/age-check', async (req, reply) => {\n    reply.header('Cache-Control', 'no-store');\n    const eligible = ageStatus(app, req) === false ? false : eligibleBirthDate(req.body?.birthDate);\n    const cookie = app.jwt.sign({ purpose: 'age-check', eligible }, { expiresIn: '15m' });\n    reply.header('Set-Cookie', ageCookie(cookie));\n    if (!eligible) return reply.code(403).send({ error: 'age_ineligible', message: 'Account creation is unavailable. See /privacy for help.' });\n    return { ok: true };\n  });\n  const guestLogin = async (req) => {\n    // Recovery authority does not override a known-ineligible browser or an\n    // explicitly supplied birth date. Existing eligible recovery needs no DOB.\n    if (ageStatus(app, req) === false || req.body?.birthDate !== undefined) requireAge(app, req);\n    if (req.body && typeof req.body === 'object' && !Array.isArray(req.body) &&\n        Object.prototype.hasOwnProperty.call(req.body, 'bootstrapSecret')) {\n      const { accountId, tokenVersion } = await A.accountForGuestBootstrap(\n        pool, req.body.bootstrapSecret, req.ip || '0.0.0.0', req.body.inviteCode, () => requireAge(app, req),\n      );\n      return { token: await signFor(accountId, {}, '30d', tokenVersion) };\n    }\n    requireAge(app, req);\n    const id = await A.createGuestAccount(pool, req.ip || '0.0.0.0', req.body?.inviteCode);\n    return { token: await signFor(id, {}, '30d', 0) };\n  };\n"
      },
      {
        "current": "  app.post('/v1/auth/guest/bootstrap/ack', { preHandler: auth }, async (req) =>\n    A.acknowledgeGuestBootstrap(pool, req.user.sub));\n  const providerLogin = (verify) => async (req) => {\n    const identity = await verify(req.body?.token);\n    // (B2) the invite is consumed ATOMICALLY inside accountForIdentity's create txn — one invite per\n    // new account, gate held even under a concurrent same-identity race (no separate pre-consume).\n",
        "baseline": "  app.post('/v1/auth/guest/bootstrap/ack', { preHandler: auth }, async (req) =>\n    A.acknowledgeGuestBootstrap(pool, req.user.sub));\n  const providerLogin = (verify) => async (req) => {\n    requireAge(app, req);\n    const identity = await verify(req.body?.token);\n    // (B2) the invite is consumed ATOMICALLY inside accountForIdentity's create txn — one invite per\n    // new account, gate held even under a concurrent same-identity race (no separate pre-consume).\n"
      },
      {
        "current": "      const revoked = req.user.tv !== undefined && Number(req.user.tv) !== Number(a?.token_version);\n      if (!a || a.status === 'banned' || revoked) accountId = null;\n    }\n    const { url, state } = await A.xOAuthStart(pool, { accountId, invite: req.body?.inviteCode });\n    // BROWSER-BIND the state (anti account-linking CSRF): the callback must present the same cookie,\n    // so an attacker who leaks their authorize URL can't have a victim's X identity bound to the\n",
        "baseline": "      const revoked = req.user.tv !== undefined && Number(req.user.tv) !== Number(a?.token_version);\n      if (!a || a.status === 'banned' || revoked) accountId = null;\n    }\n    if (!accountId) requireAge(app, req);\n    const { url, state } = await A.xOAuthStart(pool, { accountId, invite: req.body?.inviteCode });\n    // BROWSER-BIND the state (anti account-linking CSRF): the callback must present the same cookie,\n    // so an attacker who leaks their authorize URL can't have a victim's X identity bound to the\n"
      },
      {
        "current": "      if (!req.query?.state || cookieVal(req, 'omerta_oauth') !== req.query.state) {\n        return reply.redirect('/#autherr=oauth_session'); // no matching browser binding → refuse (CSRF guard)\n      }\n      const r = await A.xOAuthCallback(pool, { code: req.query?.code, state: req.query?.state, error: req.query?.error });\n      if (r.purpose === 'upgrade' && r.accountId) {\n        await A.upgradeAccount(pool, r.accountId, r.identity);\n        return reply.redirect('/#claimed=x');\n      }\n      // (B2) invite consumed atomically inside accountForIdentity's create txn — gate held under races\n      const { accountId } = await A.accountForIdentity(pool, r.identity, req.ip || '0.0.0.0', r.invite);\n      const token = await signFor(accountId);\n      const claims = app.jwt.verify(token);\n",
        "baseline": "      if (!req.query?.state || cookieVal(req, 'omerta_oauth') !== req.query.state) {\n        return reply.redirect('/#autherr=oauth_session'); // no matching browser binding → refuse (CSRF guard)\n      }\n      const r = await A.xOAuthCallback(pool, { code: req.query?.code, state: req.query?.state });\n      if (r.purpose === 'upgrade' && r.accountId) {\n        await A.upgradeAccount(pool, r.accountId, r.identity);\n        return reply.redirect('/#claimed=x');\n      }\n      // (B2) invite consumed atomically inside accountForIdentity's create txn — gate held under races\n      requireAge(app, req);\n      const { accountId } = await A.accountForIdentity(pool, r.identity, req.ip || '0.0.0.0', r.invite);\n      const token = await signFor(accountId);\n      const claims = app.jwt.verify(token);\n"
      }
    ]
  }
});
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
const lf = text => text.replaceAll('\r\n', '\n');
const uniform = text => {
  const textLf = lf(text);
  return !textLf.includes('\r') && (text === textLf || text === textLf.replaceAll('\n', '\r\n'));
};
export function assertXAuthSourceTransfer(file, input) {
  assert(Object.hasOwn(X_AUTH_SOURCE_DOMAINS, file), 'Unknown auth successor source domain');
  assert.equal(typeof input, 'string', 'Auth successor source must be text');
  assert(!input.includes('\0') && !input.startsWith('\ufeff'), 'Auth successor source has no binary/BOM alias');
  assert(uniform(input), 'Mixed or bare-CR auth successor source endings');
  const pin = X_AUTH_SOURCE_DOMAINS[file], text = lf(input);
  assert.equal(hash(input), pin.currentRawSha256[input.includes('\r\n') ? 'crlf' : 'lf'], 'Complete auth successor raw source drift: ' + file);
  assert.equal(hash(text), pin.currentSha256, 'Complete auth successor source drift: ' + file);
  assert.equal(blob(text), pin.currentBlob, 'Complete auth successor Git blob drift: ' + file);
  let baselineText = text;
  for (const inverse of pin.inverses) {
    assert(inverse.current && baselineText.split(inverse.current).length === 2, 'Exact auth successor inverse occurs once: ' + file);
    baselineText = baselineText.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(hash(baselineText), pin.baselineSha256, 'Complete auth successor predecessor drift: ' + file);
  assert.equal(blob(baselineText), pin.baselineBlob, 'Complete auth successor predecessor Git blob drift: ' + file);
  return Object.freeze({ sourceOnly: true, native: false, baselineText, sourceRevision: X_AUTH_SOURCE_REVISION,
    predecessorRevision: X_AUTH_SOURCE_PREDECESSOR, phase: X_AUTH_SOURCE_PHASE, inverseChunks: pin.inverses.length });
}
// Unknown bytes remain unchanged so the original historical guard still refuses them.
export function xAuthSourceBaseline(file, input) {
  if (typeof input !== 'string' || !Object.hasOwn(X_AUTH_SOURCE_DOMAINS, file) || !uniform(input)) return input;
  return hash(lf(input)) === X_AUTH_SOURCE_DOMAINS[file].currentSha256
    ? assertXAuthSourceTransfer(file, input).baselineText : input;
}
