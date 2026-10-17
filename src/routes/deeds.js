// Street Deeds — the map as property (the Monopoly layer). Phase 1: claim a named deed mapped to a
// district, read its legend. Pure status (ZERO §10.4). The registrar takes the shared closure the
// sibling route files use (pool, auth), so nothing about what is mounted or how it is authenticated
// changes; test/routes.js asserts the mounted surface is identical.
import * as Deeds from '../deeds.js';
import * as G from '../game.js';
import * as Custody from '../deedcustody.js';
import { prepareCharacterDeedEquipment, characterDeedExitIntent, characterDeedChainConfig,
  characterDeedSafeHouseIntent, submitCharacterDeedSafeHouse } from '../deedcustodychain.js';
import { buildingAtlas } from '../deedbuildings.js';
import { deedDiscoveryBoard, investigateDeed } from '../deeddiscovery.js';

export function register(app, { pool, auth }) {
  app.get('/v1/deeds/custody', { preHandler: auth }, async (req) => Custody.characterDeedStatus(pool, req.user.sub));
  app.post('/v1/deeds/equip', { preHandler: auth }, async (req) => prepareCharacterDeedEquipment(pool, req.user.sub, req.body?.tokenId));
  app.get('/v1/deeds/exit-intent/:tokenId', { preHandler: auth }, async (req) => characterDeedExitIntent(pool, req.user.sub, req.params.tokenId));
  app.post('/v1/deeds/exit', { preHandler: auth }, async (req) => {
    if (!characterDeedChainConfig()) throw new G.GameError('custody_unconfigured', 'Character deed custody is not enabled.');
    return Custody.requestCharacterDeedExit(pool, req.user.sub, {
      tokenId: req.body?.tokenId, userNonce: req.body?.userNonce, userIssuedAt: req.body?.userIssuedAt,
      userDeadline: req.body?.userDeadline, userSignature: req.body?.userSignature,
    });
  });
  app.post('/v1/deeds/exit/cancel', { preHandler: auth }, async (req) => {
    if (!characterDeedChainConfig()) throw new G.GameError('custody_unconfigured', 'Character deed custody is not enabled.');
    return Custody.cancelCharacterDeedExit(pool, req.user.sub, { tokenId: req.body?.tokenId });
  });
  app.get('/v1/deeds/safe-house-intent/:tokenId', { preHandler: auth }, async (req) =>
    characterDeedSafeHouseIntent(pool, req.user.sub, req.params.tokenId, req.query?.days ?? 1));
  app.post('/v1/deeds/safe-house', { preHandler: auth }, async (req) => submitCharacterDeedSafeHouse(pool, req.user.sub, {
    tokenId: req.body?.tokenId, days: req.body?.days, priceDay: req.body?.priceDay, maxBurn: req.body?.maxBurn,
    userNonce: req.body?.userNonce, userIssuedAt: req.body?.userIssuedAt, userDeadline: req.body?.userDeadline,
    userSignature: req.body?.userSignature,
  }));
  app.get('/v1/deeds/buildings', { preHandler: auth }, async (req) =>
    buildingAtlas(pool, { district: req.query?.district }));
  app.get('/v1/deeds/discovery', { preHandler: auth }, async (req) =>
    G.readCharacter(pool, req.user.sub, (ch, client) =>
      deedDiscoveryBoard(client, ch, { district: req.query?.district })));
  app.post('/v1/deeds/investigate', { preHandler: auth }, async (req) =>
    G.withCharacter(pool, req.user.sub, (ch, client, h) =>
      investigateDeed(ch, { buildingId: req.body?.buildingId, actionId: req.body?.actionId }, client, h)));
  app.get('/v1/deeds', { preHandler: auth }, async (req) => ({
    ...await G.readCharacter(pool, req.user.sub, (ch, client, h) => Deeds.deedBoard(ch, client, h)),
    custodyEnabled: !!characterDeedChainConfig(), custody: await Custody.characterDeedStatus(pool, req.user.sub),
  }));
  app.post('/v1/deeds/claim', { preHandler: auth }, async (req) =>
    G.withCharacter(pool, req.user.sub, (ch, client, h) =>
      Deeds.claimDeed(ch, { name: req.body?.name, district: req.body?.district, buildingId: req.body?.buildingId }, client, h)));
  // Phase 2 — CONTROL: collect the corner take off every deed you control; muscle in on a rival's corner.
  app.post('/v1/deeds/corner', { preHandler: auth }, async (req) =>
    G.withCharacter(pool, req.user.sub, (ch, client, h) => Deeds.collectCorner(ch, client, h)));
  app.post('/v1/deeds/shakedown/:targetCharacterId', { preHandler: auth }, async (req) =>
    G.withCharacter(pool, req.user.sub, (ch, client, h) =>
      Deeds.shakedownCorner(ch, req.params.targetCharacterId, client, h)));
  // Phase 3 — the secondary market: list/pull your street, or buy a listed one (two-party).
  app.post('/v1/deeds/list', { preHandler: auth }, async (req) =>
    G.withCharacter(pool, req.user.sub, (ch, client, h) => Deeds.listDeed(ch, req.body?.price, client, h)));
  app.post('/v1/deeds/unlist', { preHandler: auth }, async (req) =>
    G.withCharacter(pool, req.user.sub, (ch, client, h) => Deeds.unlistDeed(ch, client, h)));
  app.post('/v1/deeds/buy/:sellerCharacterId', { preHandler: auth }, async (req) =>
    G.withTwoCharacters(pool, req.user.sub, req.params.sellerCharacterId, (ch, seller, client, h) =>
      Deeds.buyDeed(ch, seller, client, h)));
  // THE BUY-CONFIRM VAULT READ. A street's ERC-6551 vault is keyed on its NAME, so it survives a burn
  // and travels with the deed — a buyer is entitled to see it before the money moves. Two halves: the
  // delivery RECORD inside the read txn, then the LIVE balance OUTSIDE it (an RPC inside a held
  // transaction pins a pooled connection — the /v1/bank posture), which is also why this is a confirm
  // step rather than a field on the polled board.
  app.get('/v1/deeds/vault/:sellerCharacterId', { preHandler: auth }, async (req) => {
    const rec = await G.readCharacter(pool, req.user.sub, (ch, client) =>
      Deeds.deedVaultRecord(client, ch, req.params.sellerCharacterId));
    return { ...rec, live: await Deeds.deedVaultLive(rec.street) };
  });
}
