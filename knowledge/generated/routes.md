# Generated HTTP route catalog

> 802 literal registrations extracted from `src/server.js` and `src/routes/`. Runtime authority remains `GET /openapi.json`.

## Route groups

| Group | Routes |
|---|---:|
| mod | 76 |
| leaderboard | 46 |
| casino | 28 |
| worldgraph | 26 |
| web | 26 |
| gangs | 22 |
| pen | 19 |
| coordination | 18 |
| content | 16 |
| crew | 16 |
| speakeasy | 13 |
| kitchen | 12 |
| rwa | 12 |
| loans | 12 |
| streets | 12 |
| world | 12 |
| port | 11 |
| business | 11 |
| wire | 11 |
| boxing | 10 |
| deeds | 10 |
| races | 10 |
| territory | 10 |
| estate | 9 |
| heists | 9 |
| law | 9 |
| auth | 9 |
| market | 9 |
| convoy | 8 |
| stable | 8 |
| dynasty | 8 |
| diplomacy | 7 |
| underworld | 7 |
| commission | 7 |
| sov | 6 |
| mentor | 6 |
| armory | 5 |
| skills | 5 |
| auction | 5 |
| phone | 5 |
| soldiers | 5 |
| identity | 4 |
| character | 4 |
| garage | 4 |
| districts | 4 |
| drop | 4 |
| exchange | 4 |
| favors | 4 |
| primetime | 4 |
| digest | 4 |
| campaigns | 4 |
| secrets | 4 |
| bonds | 4 |
| megaproject | 4 |
| duels | 4 |
| npcfamily | 4 |
| commands | 3 |
| access | 3 |
| regimen | 3 |
| corner | 3 |
| rackets | 3 |
| roster | 3 |
| portfolio | 3 |
| contracts | 3 |
| feud | 3 |
| vanity | 3 |
| shipment | 3 |
| wallet | 3 |
| withdraw | 3 |
| nft | 3 |
| plex | 3 |
| defi | 2 |
| made | 2 |
| projections | 2 |
| art | 2 |
| hustle | 2 |
| bank | 2 |
| workshop | 2 |
| goods | 2 |
| assets | 2 |
| window | 2 |
| stake | 2 |
| gear | 2 |
| mastery | 2 |
| vault | 2 |
| landmarks | 2 |
| brokers | 2 |
| provenance | 2 |
| people | 2 |
| paper | 2 |
| agent | 2 |
| bodyguard | 2 |
| chat | 2 |
| invites | 2 |
| discovery | 2 |
| streak | 2 |
| vouch | 2 |
| push | 2 |
| daily | 2 |
| onboard | 2 |
| career | 2 |
| social | 2 |
| bond | 2 |
| store | 2 |
| pass | 2 |
| bulletin | 2 |
| clues | 2 |
| capo | 1 |
| avatar | 1 |
| u | 1 |
| path-quiz | 1 |
| me | 1 |
| session | 1 |
| crimes | 1 |
| train | 1 |
| heal | 1 |
| checkin | 1 |
| broadcast | 1 |
| screens | 1 |
| travel | 1 |
| items | 1 |
| yield | 1 |
| desk | 1 |
| swap | 1 |
| unstake | 1 |
| claim-rewards | 1 |
| catalog | 1 |
| rules | 1 |
| convoys | 1 |
| map | 1 |
| day | 1 |
| payroll | 1 |
| home | 1 |
| block | 1 |
| citywide | 1 |
| rivals | 1 |
| opportunities | 1 |
| arena | 1 |
| safehouse | 1 |
| notifications | 1 |
| ws | 1 |
| online | 1 |
| contacts | 1 |
| call | 1 |
| events | 1 |
| results | 1 |
| fairness | 1 |
| circle | 1 |
| live | 1 |
| explore | 1 |
| vouches | 1 |
| path | 1 |
| respec | 1 |
| heist | 1 |
| missions | 1 |
| referral | 1 |
| profile | 1 |
| wage | 1 |
| bloodline | 1 |
| collection | 1 |
| firsts | 1 |
| fees | 1 |
| forge | 1 |
| seasons | 1 |
| season | 1 |
| city | 1 |

## Full catalog

| Method | Path | Access | Domain | Definition | Handler |
|---|---|---|---|---|---|
| GET | `/` | public | client-experience | [src/server.js:480](../../src/server.js#L480) | `serveLaunchPage` |
| GET | `/admin` | public | client-experience | [src/server.js:486](../../src/server.js#L486) | `servePage` |
| GET | `/agents` | public | client-experience | [src/server.js:764](../../src/server.js#L764) | — |
| GET | `/AGENTS.md` | public | client-experience | [src/server.js:765](../../src/server.js#L765) | — |
| GET | `/arena` | public | client-experience | [src/server.js:496](../../src/server.js#L496) | `servePage` |
| GET | `/art/:file` | public | client-experience | [src/server.js:599](../../src/server.js#L599) | `sendVideo` |
| GET | `/art/hype/:file` | public | client-experience | [src/server.js:605](../../src/server.js#L605) | `sendVideo` |
| GET | `/beef/:a/:b` | public | client-experience | [src/server.js:754](../../src/server.js#L754) | `Cards.beefDossier` |
| GET | `/card/:type/:name` | public | client-experience | [src/server.js:718](../../src/server.js#L718) | `Cards.publicDossier` |
| GET | `/card/beef/:a/:b` | public | client-experience | [src/server.js:734](../../src/server.js#L734) | `Cards.beefDossier` |
| GET | `/deed/:tokenId` | public | client-experience | [src/server.js:703](../../src/server.js#L703) | `Deeds.deedByToken` |
| GET | `/favicon.ico` | public | client-experience | [src/server.js:545](../../src/server.js#L545) | — |
| GET | `/health` | public | client-experience | [src/server.js:937](../../src/server.js#L937) | — |
| GET | `/llms.txt` | public | client-experience | [src/server.js:766](../../src/server.js#L766) | — |
| GET | `/manifest.json` | public | client-experience | [src/server.js:530](../../src/server.js#L530) | — |
| GET | `/manifest.webmanifest` | public | client-experience | [src/server.js:531](../../src/server.js#L531) | — |
| GET | `/omerta-ui.css` | public | client-experience | [src/server.js:518](../../src/server.js#L518) | — |
| GET | `/openapi.json` | public | client-experience | [src/server.js:782](../../src/server.js#L782) | — |
| GET | `/path` | public | client-experience | [src/server.js:505](../../src/server.js#L505) | `servePage` |
| GET | `/path/:id` | public | client-experience | [src/server.js:507](../../src/server.js#L507) | — |
| GET | `/play` | public | client-experience | [src/server.js:501](../../src/server.js#L501) | `servePage` |
| GET | `/robots.txt` | public | client-experience | [src/server.js:770](../../src/server.js#L770) | — |
| GET | `/sitemap.xml` | public | client-experience | [src/server.js:775](../../src/server.js#L775) | — |
| GET | `/sw.js` | public | client-experience | [src/server.js:523](../../src/server.js#L523) | — |
| GET | `/u/:name` | public | client-experience | [src/server.js:748](../../src/server.js#L748) | `Cards.publicDossier` |
| POST | `/v1/access/logout` | public | platform-core | [src/server.js:1345](../../src/server.js#L1345) | — |
| POST | `/v1/access/redeem` | public | platform-core | [src/server.js:1329](../../src/server.js#L1329) | `G.GameError` |
| POST | `/v1/access/session` | authenticated | platform-core | [src/server.js:1338](../../src/server.js#L1338) | — |
| POST | `/v1/agent/act` | authenticated | platform-core | [src/server.js:2628](../../src/server.js#L2628) | `executeAgentAction` |
| GET | `/v1/agent/turn` | authenticated | platform-core | [src/server.js:2569](../../src/server.js#L2569) | `readAgentTurn` |
| GET | `/v1/arena` | public | engagement-growth | [src/server.js:2680](../../src/server.js#L2680) | `arenaBoard` |
| POST | `/v1/armory/ammo` | authenticated | economy-ledger | [src/server.js:1699](../../src/server.js#L1699) | `E.buyAmmo` |
| POST | `/v1/armory/gun/:id/buy` | authenticated | economy-ledger | [src/server.js:1691](../../src/server.js#L1691) | `E.buyGun` |
| POST | `/v1/armory/gun/:id/equip` | authenticated | economy-ledger | [src/server.js:1693](../../src/server.js#L1693) | `E.equipGun` |
| POST | `/v1/armory/unequip` | authenticated | economy-ledger | [src/server.js:1695](../../src/server.js#L1695) | `E.equipGun` |
| POST | `/v1/armory/vest/:id` | authenticated | economy-ledger | [src/server.js:1697](../../src/server.js#L1697) | `E.buyVest` |
| GET | `/v1/art/:kind/:id` | public | platform-core | [src/server.js:621](../../src/server.js#L621) | — |
| GET | `/v1/art/motion` | public | platform-core | [src/server.js:610](../../src/server.js#L610) | — |
| POST | `/v1/assets/:id/buy` | authenticated | economy-ledger | [src/server.js:1644](../../src/server.js#L1644) | `E.buyAsset` |
| POST | `/v1/assets/:id/sell` | authenticated | economy-ledger | [src/server.js:1646](../../src/server.js#L1646) | `E.sellAsset` |
| GET | `/v1/auction` | authenticated | platform-core | [src/server.js:2245](../../src/server.js#L2245) | `Auction.auctionBoard` |
| POST | `/v1/auction/:lotId/bid` | authenticated | platform-core | [src/server.js:2247](../../src/server.js#L2247) | `Auction.bidAuction` |
| POST | `/v1/auction/consign` | authenticated | platform-core | [src/server.js:2250](../../src/server.js#L2250) | `Auction.consignTrophy` |
| POST | `/v1/auction/consign/:id/bid` | authenticated | platform-core | [src/server.js:2252](../../src/server.js#L2252) | `Auction.bidConsignment` |
| POST | `/v1/auction/consign/:id/cancel` | authenticated | platform-core | [src/server.js:2254](../../src/server.js#L2254) | `Auction.reclaimConsignment` |
| POST | `/v1/auth/agent-key` | authenticated | platform-core | [src/server.js:1436](../../src/server.js#L1436) | `A.acknowledgeGuestBootstrap` |
| POST | `/v1/auth/guest` | public | platform-core | [src/server.js:1328](../../src/server.js#L1328) | — |
| POST | `/v1/auth/guest/bootstrap/ack` | authenticated | platform-core | [src/server.js:1349](../../src/server.js#L1349) | `A.acknowledgeGuestBootstrap` |
| POST | `/v1/auth/logout-all` | authenticated | platform-core | [src/server.js:1446](../../src/server.js#L1446) | — |
| POST | `/v1/auth/privy` | public | platform-core | [src/server.js:1359](../../src/server.js#L1359) | `providerLogin` |
| POST | `/v1/auth/upgrade` | authenticated | platform-core | [src/server.js:1427](../../src/server.js#L1427) | `A.upgradeAccount` |
| POST | `/v1/auth/x` | public | platform-core | [src/server.js:1358](../../src/server.js#L1358) | `providerLogin` |
| GET | `/v1/auth/x/callback` | public | platform-core | [src/server.js:1401](../../src/server.js#L1401) | `A.xOAuthCallback` |
| POST | `/v1/auth/x/start` | public | platform-core | [src/server.js:1369](../../src/server.js#L1369) | `A.upgradeAccount` |
| GET | `/v1/avatar/:seed` | public | platform-core | [src/server.js:636](../../src/server.js#L636) | — |
| GET | `/v1/bank` | authenticated | platform-core | [src/server.js:2225](../../src/server.js#L2225) | `Bank.bankBoard` |
| POST | `/v1/bank/:dir` | authenticated | platform-core | [src/server.js:1612](../../src/server.js#L1612) | `G.withCharacter` |
| GET | `/v1/block` | authenticated | social-combat | [src/server.js:2451](../../src/server.js#L2451) | `Block.streetsBoard` |
| GET | `/v1/bloodline` | authenticated | platform-core | [src/server.js:3273](../../src/server.js#L3273) | `Bloodline.bloodlineBoard` |
| POST | `/v1/bodyguard/hire/:guardId` | authenticated | social-combat | [src/server.js:2728](../../src/server.js#L2728) | `S.hireBodyguard` |
| POST | `/v1/bodyguard/offer` | authenticated | social-combat | [src/server.js:2726](../../src/server.js#L2726) | `S.offerBodyguard` |
| POST | `/v1/bond/calldata` | authenticated | chain-economy | [src/server.js:3374](../../src/server.js#L3374) | `Chain.bondCalldata` |
| POST | `/v1/bond/quote` | authenticated | chain-economy | [src/server.js:3371](../../src/server.js#L3371) | `Chain.quoteBond` |
| GET | `/v1/bonds` | authenticated | platform-core | [src/server.js:3363](../../src/server.js#L3363) | `Bonds.bondBoard` |
| POST | `/v1/bonds/:id/claim` | authenticated | platform-core | [src/server.js:3364](../../src/server.js#L3364) | `Bonds.claimBond` |
| POST | `/v1/bonds/charter` | authenticated | platform-core | [src/server.js:3369](../../src/server.js#L3369) | `Bonds.commissionCharter` |
| POST | `/v1/bonds/pledge` | authenticated | platform-core | [src/server.js:3367](../../src/server.js#L3367) | `Bonds.pledgeTreasury` |
| GET | `/v1/boxing` | authenticated | vice-competition | [src/routes/boxing.js:10](../../src/routes/boxing.js#L10) | `Boxing.boxingBoard` |
| POST | `/v1/boxing/announce/:opponentId` | authenticated | vice-competition | [src/routes/boxing.js:27](../../src/routes/boxing.js#L27) | `Boxing.announceMainEvent` |
| POST | `/v1/boxing/bout/:id/bet` | authenticated | vice-competition | [src/routes/boxing.js:30](../../src/routes/boxing.js#L30) | `Boxing.placeBoutBet` |
| POST | `/v1/boxing/callout/:fighterId` | authenticated | vice-competition | [src/routes/boxing.js:33](../../src/routes/boxing.js#L33) | `Boxing.callOutChamp` |
| POST | `/v1/boxing/callout/accept` | authenticated | vice-competition | [src/routes/boxing.js:35](../../src/routes/boxing.js#L35) | `Boxing.acceptCallout` |
| POST | `/v1/boxing/exhibition` | authenticated | vice-competition | [src/routes/boxing.js:21](../../src/routes/boxing.js#L21) | `Boxing.exhibitionBout` |
| POST | `/v1/boxing/fight/:opponentId` | authenticated | vice-competition | [src/routes/boxing.js:23](../../src/routes/boxing.js#L23) | `Boxing.fightBout` |
| POST | `/v1/boxing/list` | authenticated | vice-competition | [src/routes/boxing.js:18](../../src/routes/boxing.js#L18) | `Boxing.listBout` |
| POST | `/v1/boxing/recruit` | authenticated | vice-competition | [src/routes/boxing.js:14](../../src/routes/boxing.js#L14) | `Boxing.recruitFighter` |
| POST | `/v1/boxing/train` | authenticated | vice-competition | [src/routes/boxing.js:16](../../src/routes/boxing.js#L16) | `Boxing.trainFighter` |
| POST | `/v1/broadcast/shared` | authenticated | platform-core | [src/server.js:1581](../../src/server.js#L1581) | `G.track` |
| GET | `/v1/brokers` | authenticated | platform-core | [src/server.js:2266](../../src/server.js#L2266) | `Brokers.brokerBoard` |
| POST | `/v1/brokers/activate` | authenticated | platform-core | [src/server.js:2268](../../src/server.js#L2268) | `Brokers.activate` |
| GET | `/v1/bulletin` | authenticated | engagement-growth | [src/server.js:3527](../../src/server.js#L3527) | `bulletinBoard` |
| POST | `/v1/bulletin/claim` | authenticated | platform-core | [src/server.js:3532](../../src/server.js#L3532) | `G.withCharacter` |
| GET | `/v1/business` | authenticated | enterprise-logistics | [src/server.js:2084](../../src/server.js#L2084) | `Business.businessesOf` |
| DELETE | `/v1/business/:id` | authenticated | enterprise-logistics | [src/server.js:2056](../../src/server.js#L2056) | `Business.shutterBusiness` |
| POST | `/v1/business/:id/launder` | authenticated | enterprise-logistics | [src/server.js:2058](../../src/server.js#L2058) | `Business.launderAtBusiness` |
| POST | `/v1/business/:id/rob` | authenticated | enterprise-logistics | [src/server.js:2069](../../src/server.js#L2069) | `Business.robBusiness` |
| POST | `/v1/business/:id/shakedown` | authenticated | enterprise-logistics | [src/server.js:2062](../../src/server.js#L2062) | `Business.shakedownBusiness` |
| POST | `/v1/business/:id/specialize` | authenticated | enterprise-logistics | [src/server.js:2076](../../src/server.js#L2076) | `Business.specializeBusiness` |
| POST | `/v1/business/:id/takeover` | authenticated | enterprise-logistics | [src/server.js:2078](../../src/server.js#L2078) | `Business.takeoverBusiness` |
| POST | `/v1/business/:id/upgrade` | authenticated | enterprise-logistics | [src/server.js:2051](../../src/server.js#L2051) | `Business.upgradeBusiness` |
| POST | `/v1/business/:kind/buy` | authenticated | enterprise-logistics | [src/server.js:2043](../../src/server.js#L2043) | `Business.buyBusiness` |
| POST | `/v1/business/collect` | authenticated | enterprise-logistics | [src/server.js:2045](../../src/server.js#L2045) | `Business.collectBusiness` |
| POST | `/v1/business/upkeep` | authenticated | enterprise-logistics | [src/server.js:2049](../../src/server.js#L2049) | `Business.payBusinessUpkeep` |
| POST | `/v1/call/fulfill` | authenticated | engagement-growth | [src/server.js:3042](../../src/server.js#L3042) | `Contacts.fulfillCall` |
| GET | `/v1/campaigns` | authenticated | platform-core | [src/server.js:3265](../../src/server.js#L3265) | `Campaigns.campaignBoard` |
| POST | `/v1/campaigns/:id/choose` | authenticated | platform-core | [src/server.js:3269](../../src/server.js#L3269) | `Campaigns.chooseCampaign` |
| POST | `/v1/campaigns/:id/claim` | authenticated | platform-core | [src/server.js:3271](../../src/server.js#L3271) | `Campaigns.claimCampaign` |
| POST | `/v1/campaigns/:id/start` | authenticated | platform-core | [src/server.js:3267](../../src/server.js#L3267) | `Campaigns.startCampaign` |
| GET | `/v1/capo` | authenticated | engagement-growth | [src/routes/leaderboards.js:88](../../src/routes/leaderboards.js#L88) | `W.capoBoard` |
| GET | `/v1/career` | authenticated | engagement-growth | [src/server.js:3245](../../src/server.js#L3245) | `Career.careerBoard` |
| POST | `/v1/career/:taskId` | authenticated | engagement-growth | [src/server.js:3247](../../src/server.js#L3247) | `Career.claimCareer` |
| GET | `/v1/casino` | authenticated | vice-competition | [src/routes/casino.js:79](../../src/routes/casino.js#L79) | `Casino.denInfo` |
| POST | `/v1/casino/blackjack` | authenticated | vice-competition | [src/routes/casino.js:44](../../src/routes/casino.js#L44) | `Casino.blackjackDeal` |
| POST | `/v1/casino/blackjack/double` | authenticated | vice-competition | [src/routes/casino.js:50](../../src/routes/casino.js#L50) | `Casino.blackjackDouble` |
| POST | `/v1/casino/blackjack/hit` | authenticated | vice-competition | [src/routes/casino.js:46](../../src/routes/casino.js#L46) | `Casino.blackjackHit` |
| POST | `/v1/casino/blackjack/stand` | authenticated | vice-competition | [src/routes/casino.js:48](../../src/routes/casino.js#L48) | `Casino.blackjackStand` |
| POST | `/v1/casino/dice` | authenticated | vice-competition | [src/routes/casino.js:12](../../src/routes/casino.js#L12) | `Casino.playDice` |
| POST | `/v1/casino/dice/:targetId` | authenticated | vice-competition | [src/routes/casino.js:21](../../src/routes/casino.js#L21) | `Casino.pvpDice` |
| POST | `/v1/casino/fade` | authenticated | vice-competition | [src/routes/casino.js:19](../../src/routes/casino.js#L19) | `Casino.setFadeLimit` |
| POST | `/v1/casino/fight` | authenticated | vice-competition | [src/routes/casino.js:24](../../src/routes/casino.js#L24) | `Casino.betFight` |
| POST | `/v1/casino/fight/claim` | authenticated | vice-competition | [src/routes/casino.js:26](../../src/routes/casino.js#L26) | `Casino.claimFight` |
| POST | `/v1/casino/fight/fix` | authenticated | vice-competition | [src/routes/casino.js:28](../../src/routes/casino.js#L28) | `Casino.fixFight` |
| POST | `/v1/casino/futurity/bet` | authenticated | vice-competition | [src/routes/casino.js:41](../../src/routes/casino.js#L41) | `Casino.betFuturity` |
| POST | `/v1/casino/futurity/nominate/:racerId` | authenticated | vice-competition | [src/routes/casino.js:39](../../src/routes/casino.js#L39) | `Casino.nominateFuturity` |
| POST | `/v1/casino/numbers` | authenticated | vice-competition | [src/routes/casino.js:14](../../src/routes/casino.js#L14) | `Casino.playNumbers` |
| POST | `/v1/casino/numbers/claim` | authenticated | vice-competition | [src/routes/casino.js:16](../../src/routes/casino.js#L16) | `Casino.claimNumbers` |
| POST | `/v1/casino/poker/:targetId` | authenticated | vice-competition | [src/routes/casino.js:54](../../src/routes/casino.js#L54) | `Casino.playPoker` |
| POST | `/v1/casino/poker/deal` | authenticated | vice-competition | [src/routes/casino.js:52](../../src/routes/casino.js#L52) | `Casino.setPokerLimit` |
| GET | `/v1/casino/ring` | authenticated | vice-competition | [src/routes/casino.js:61](../../src/routes/casino.js#L61) | `Ring.ringLobby` |
| GET | `/v1/casino/ring/:id` | authenticated | vice-competition | [src/routes/casino.js:65](../../src/routes/casino.js#L65) | `Ring.viewOf` |
| POST | `/v1/casino/ring/:id/act` | authenticated | vice-competition | [src/routes/casino.js:77](../../src/routes/casino.js#L77) | `Ring.actAt` |
| POST | `/v1/casino/ring/:id/deal` | authenticated | vice-competition | [src/routes/casino.js:75](../../src/routes/casino.js#L75) | `Ring.dealHand` |
| POST | `/v1/casino/ring/:id/leave` | authenticated | vice-competition | [src/routes/casino.js:73](../../src/routes/casino.js#L73) | `Ring.leaveTable` |
| POST | `/v1/casino/ring/:id/sit` | authenticated | vice-competition | [src/routes/casino.js:71](../../src/routes/casino.js#L71) | `Ring.sitAt` |
| POST | `/v1/casino/ring/open` | authenticated | vice-competition | [src/routes/casino.js:69](../../src/routes/casino.js#L69) | `Ring.openTable` |
| POST | `/v1/casino/tournament` | authenticated | vice-competition | [src/routes/casino.js:58](../../src/routes/casino.js#L58) | `Casino.enterTournament` |
| POST | `/v1/casino/track` | authenticated | vice-competition | [src/routes/casino.js:31](../../src/routes/casino.js#L31) | `Casino.betTrack` |
| POST | `/v1/casino/track/claim` | authenticated | vice-competition | [src/routes/casino.js:33](../../src/routes/casino.js#L33) | `Casino.claimTrack` |
| POST | `/v1/casino/track/enter/:racerId` | authenticated | vice-competition | [src/routes/casino.js:36](../../src/routes/casino.js#L36) | `Casino.enterTrackRace` |
| GET | `/v1/catalog` | public | enterprise-logistics | [src/server.js:1764](../../src/server.js#L1764) | `Business.catalog` |
| POST | `/v1/character` | authenticated | platform-core | [src/server.js:1460](../../src/server.js#L1460) | `Store.claimPendingWire` |
| POST | `/v1/character/forge` | authenticated | chain-economy | [src/server.js:3425](../../src/server.js#L3425) | `Forge.forgeCharacter` |
| POST | `/v1/character/mint` | authenticated | economy-ledger | [src/server.js:3416](../../src/server.js#L3416) | `Fees.mintCharacter` |
| POST | `/v1/character/reroll` | authenticated | economy-ledger | [src/server.js:3419](../../src/server.js#L3419) | `Fees.rerollCharacter` |
| GET | `/v1/chat` | authenticated | platform-core | [src/server.js:3018](../../src/server.js#L3018) | `readChat` |
| POST | `/v1/chat` | authenticated | platform-core | [src/server.js:3017](../../src/server.js#L3017) | `postChat` |
| POST | `/v1/checkin` | authenticated | platform-core | [src/server.js:1577](../../src/server.js#L1577) | `G.withCharacter` |
| GET | `/v1/circle` | authenticated | engagement-growth | [src/server.js:3157](../../src/server.js#L3157) | `Circle.circleBoard` |
| GET | `/v1/city` | public | platform-core | [src/server.js:3482](../../src/server.js#L3482) | — |
| GET | `/v1/citywide` | authenticated | world-progression | [src/server.js:2455](../../src/server.js#L2455) | `Citywide.citywideBoard` |
| POST | `/v1/claim-rewards` | authenticated | economy-ledger | [src/server.js:1685](../../src/server.js#L1685) | `E.claimRewards` |
| GET | `/v1/clues` | authenticated | platform-core | [src/server.js:3558](../../src/server.js#L3558) | `Clues.clueBoard` |
| POST | `/v1/clues/dig` | authenticated | platform-core | [src/server.js:3560](../../src/server.js#L3560) | `Clues.dig` |
| GET | `/v1/collection` | authenticated | law-intelligence | [src/server.js:3332](../../src/server.js#L3332) | `Collection.collectionBoard` |
| GET | `/v1/commands` | public | platform-core | [src/routes/commands.js:43](../../src/routes/commands.js#L43) | `traceAuthorizedCommand` |
| POST | `/v1/commands/execute` | public | platform-core | [src/routes/commands.js:55](../../src/routes/commands.js#L55) | `traceAuthorizedCommand` |
| POST | `/v1/commands/observations` | authenticated | platform-core | [src/routes/commands.js:50](../../src/routes/commands.js#L50) | — |
| GET | `/v1/commission` | public | platform-core | [src/server.js:2100](../../src/server.js#L2100) | `Commission.commissionBoard` |
| POST | `/v1/commission/override` | authenticated | platform-core | [src/server.js:2109](../../src/server.js#L2109) | `Commission.overrideVeto` |
| POST | `/v1/commission/propose` | authenticated | platform-core | [src/server.js:2106](../../src/server.js#L2106) | `Commission.proposeDecree` |
| GET | `/v1/commission/ticker` | public | platform-core | [src/server.js:2114](../../src/server.js#L2114) | `Commission.tickerBallotBoard` |
| POST | `/v1/commission/ticker` | authenticated | platform-core | [src/server.js:2115](../../src/server.js#L2115) | `Commission.castTickerVote` |
| POST | `/v1/commission/veto` | authenticated | platform-core | [src/server.js:2103](../../src/server.js#L2103) | `Commission.vetoDecree` |
| POST | `/v1/commission/vote` | authenticated | platform-core | [src/server.js:2101](../../src/server.js#L2101) | `Commission.castVote` |
| GET | `/v1/contacts` | authenticated | engagement-growth | [src/server.js:3036](../../src/server.js#L3036) | `Contacts.contactsBoard` |
| GET | `/v1/content` | authenticated | platform-core | [src/routes/content.js:134](../../src/routes/content.js#L134) | `contentBoard` |
| POST | `/v1/content/:namespace/exchange/:listingId/cancel` | authenticated | platform-core | [src/routes/content.js:156](../../src/routes/content.js#L156) | `G.withCharacter` |
| POST | `/v1/content/:namespace/exchange/:listingId/fill` | authenticated | platform-core | [src/routes/content.js:164](../../src/routes/content.js#L164) | `G.GameError` |
| POST | `/v1/content/:namespace/exchange/list` | authenticated | platform-core | [src/routes/content.js:143](../../src/routes/content.js#L143) | `G.withCharacter` |
| POST | `/v1/content/:namespace/instances` | authenticated | platform-core | [src/routes/content.js:224](../../src/routes/content.js#L224) | `createContentInstance` |
| POST | `/v1/content/:namespace/jobs/:jobId/collect` | authenticated | platform-core | [src/routes/content.js:200](../../src/routes/content.js#L200) | `G.withCharacter` |
| POST | `/v1/content/:namespace/jobs/:jobId/start` | authenticated | platform-core | [src/routes/content.js:192](../../src/routes/content.js#L192) | `G.withCharacter` |
| POST | `/v1/content/:namespace/recipes/:recipeId/craft` | authenticated | platform-core | [src/routes/content.js:208](../../src/routes/content.js#L208) | `G.withCharacter` |
| POST | `/v1/content/:namespace/sources/:sourceId/collect` | authenticated | platform-core | [src/routes/content.js:184](../../src/routes/content.js#L184) | `G.withCharacter` |
| POST | `/v1/content/:namespace/tools/:toolId/repair` | authenticated | platform-core | [src/routes/content.js:216](../../src/routes/content.js#L216) | `G.withCharacter` |
| GET | `/v1/content/instances/:instanceId` | authenticated | platform-core | [src/routes/content.js:233](../../src/routes/content.js#L233) | `contentInstanceBoard` |
| POST | `/v1/content/instances/:instanceId/act` | authenticated | platform-core | [src/routes/content.js:252](../../src/routes/content.js#L252) | `actOnContentInstance` |
| POST | `/v1/content/instances/:instanceId/claim` | authenticated | platform-core | [src/routes/content.js:267](../../src/routes/content.js#L267) | `claimContentRewards` |
| POST | `/v1/content/instances/:instanceId/consent` | authenticated | platform-core | [src/routes/content.js:245](../../src/routes/content.js#L245) | `setContentConsent` |
| POST | `/v1/content/instances/:instanceId/join` | authenticated | platform-core | [src/routes/content.js:237](../../src/routes/content.js#L237) | `joinContentInstance` |
| POST | `/v1/content/instances/:instanceId/leave` | authenticated | platform-core | [src/routes/content.js:261](../../src/routes/content.js#L261) | `leaveContentInstance` |
| GET | `/v1/contracts` | authenticated | social-combat | [src/server.js:2547](../../src/server.js#L2547) | `S.listContracts` |
| POST | `/v1/contracts/:targetId/:kind/cancel` | authenticated | social-combat | [src/server.js:2551](../../src/server.js#L2551) | `S.cancelBounty` |
| POST | `/v1/contracts/peek` | authenticated | social-combat | [src/server.js:2549](../../src/server.js#L2549) | `S.peekContracts` |
| POST | `/v1/convoy` | authenticated | enterprise-logistics | [src/routes/convoy.js:9](../../src/routes/convoy.js#L9) | `Convoy.openConvoy` |
| POST | `/v1/convoy/:id/ambush` | authenticated | enterprise-logistics | [src/routes/convoy.js:17](../../src/routes/convoy.js#L17) | `Convoy.ambushConvoy` |
| POST | `/v1/convoy/:id/collect` | authenticated | enterprise-logistics | [src/routes/convoy.js:19](../../src/routes/convoy.js#L19) | `Convoy.collectConvoy` |
| POST | `/v1/convoy/cancel` | authenticated | enterprise-logistics | [src/routes/convoy.js:15](../../src/routes/convoy.js#L15) | `Convoy.cancelConvoy` |
| POST | `/v1/convoy/depart` | authenticated | enterprise-logistics | [src/routes/convoy.js:13](../../src/routes/convoy.js#L13) | `Convoy.departConvoy` |
| POST | `/v1/convoy/load` | authenticated | enterprise-logistics | [src/routes/convoy.js:11](../../src/routes/convoy.js#L11) | `Convoy.loadConvoy` |
| POST | `/v1/convoy/rig/:kind` | authenticated | enterprise-logistics | [src/routes/convoy.js:22](../../src/routes/convoy.js#L22) | `Convoy.buyRig` |
| POST | `/v1/convoy/rig/upgrade` | authenticated | enterprise-logistics | [src/routes/convoy.js:24](../../src/routes/convoy.js#L24) | `Convoy.upgradeRig` |
| GET | `/v1/convoys` | authenticated | enterprise-logistics | [src/server.js:2317](../../src/server.js#L2317) | `Convoy.convoyBoard` |
| GET | `/v1/coordination` | public | platform-core | [src/routes/coordination.js:114](../../src/routes/coordination.js#L114) | — |
| POST | `/v1/coordination/:graphId/instances` | public | platform-core | [src/routes/coordination.js:115](../../src/routes/coordination.js#L115) | — |
| GET | `/v1/coordination/instances/:instanceId` | public | platform-core | [src/routes/coordination.js:117](../../src/routes/coordination.js#L117) | — |
| POST | `/v1/coordination/instances/:instanceId/act` | public | platform-core | [src/routes/coordination.js:119](../../src/routes/coordination.js#L119) | — |
| POST | `/v1/coordination/instances/:instanceId/cancel` | public | platform-core | [src/routes/coordination.js:121](../../src/routes/coordination.js#L121) | — |
| GET | `/v1/coordination/knowledge` | public | platform-core | [src/routes/coordination.js:126](../../src/routes/coordination.js#L126) | — |
| GET | `/v1/coordination/knowledge/:claimId` | public | platform-core | [src/routes/coordination.js:132](../../src/routes/coordination.js#L132) | — |
| POST | `/v1/coordination/knowledge/:claimId/revoke` | public | platform-core | [src/routes/coordination.js:136](../../src/routes/coordination.js#L136) | — |
| POST | `/v1/coordination/knowledge/:claimId/share` | public | platform-core | [src/routes/coordination.js:134](../../src/routes/coordination.js#L134) | — |
| GET | `/v1/coordination/knowledge/archive` | public | platform-core | [src/routes/coordination.js:130](../../src/routes/coordination.js#L130) | — |
| POST | `/v1/coordination/knowledge/archive` | public | platform-core | [src/routes/coordination.js:140](../../src/routes/coordination.js#L140) | — |
| POST | `/v1/coordination/knowledge/links` | public | platform-core | [src/routes/coordination.js:138](../../src/routes/coordination.js#L138) | — |
| POST | `/v1/coordination/knowledge/rebuild` | public | platform-core | [src/routes/coordination.js:142](../../src/routes/coordination.js#L142) | — |
| GET | `/v1/coordination/knowledge/targets` | public | platform-core | [src/routes/coordination.js:128](../../src/routes/coordination.js#L128) | — |
| GET | `/v1/coordination/operations` | authenticated | platform-core | [src/routes/family-operations.js:60](../../src/routes/family-operations.js#L60) | — |
| POST | `/v1/coordination/operations` | authenticated | platform-core | [src/routes/family-operations.js:62](../../src/routes/family-operations.js#L62) | — |
| GET | `/v1/coordination/operations/:operationId` | authenticated | platform-core | [src/routes/family-operations.js:61](../../src/routes/family-operations.js#L61) | — |
| POST | `/v1/coordination/operations/:operationId/actions/:action` | authenticated | platform-core | [src/routes/family-operations.js:63](../../src/routes/family-operations.js#L63) | — |
| GET | `/v1/corner` | authenticated | platform-core | [src/server.js:1569](../../src/server.js#L1569) | `Corner.cornerBoard` |
| POST | `/v1/corner/:slot/accept` | authenticated | platform-core | [src/server.js:1571](../../src/server.js#L1571) | `Corner.acceptCorner` |
| POST | `/v1/corner/:slot/claim` | authenticated | platform-core | [src/server.js:1573](../../src/server.js#L1573) | `Corner.claimCorner` |
| GET | `/v1/crew` | authenticated | social-combat | [src/server.js:3064](../../src/server.js#L3064) | `Crew.crewBoard` |
| POST | `/v1/crew` | authenticated | social-combat | [src/server.js:3074](../../src/server.js#L3074) | `Crew.createCrew` |
| POST | `/v1/crew/accept/:crewId` | authenticated | social-combat | [src/server.js:3078](../../src/server.js#L3078) | `Crew.acceptInvite` |
| GET | `/v1/crew/chat` | authenticated | platform-core | [src/server.js:3022](../../src/server.js#L3022) | `readChat` |
| POST | `/v1/crew/chat` | authenticated | platform-core | [src/server.js:3021](../../src/server.js#L3021) | `postChat` |
| POST | `/v1/crew/decline/:crewId` | authenticated | social-combat | [src/server.js:3080](../../src/server.js#L3080) | `Crew.declineInvite` |
| POST | `/v1/crew/invite` | authenticated | social-combat | [src/server.js:3076](../../src/server.js#L3076) | `Crew.inviteToCrew` |
| POST | `/v1/crew/leave` | authenticated | social-combat | [src/server.js:3082](../../src/server.js#L3082) | `Crew.leaveCrew` |
| DELETE | `/v1/crew/member/:characterId` | authenticated | social-combat | [src/server.js:3085](../../src/server.js#L3085) | `Crew.kickMember` |
| POST | `/v1/crew/objective/claim` | authenticated | social-combat | [src/server.js:3111](../../src/server.js#L3111) | `Crew.claimObjective` |
| POST | `/v1/crew/recruiting` | authenticated | social-combat | [src/server.js:3097](../../src/server.js#L3097) | `Crew.setRecruiting` |
| DELETE | `/v1/crew/request/:characterId` | authenticated | social-combat | [src/server.js:3107](../../src/server.js#L3107) | `Crew.declineRequest` |
| POST | `/v1/crew/request/:characterId/accept` | authenticated | social-combat | [src/server.js:3103](../../src/server.js#L3103) | `Crew.acceptRequest` |
| POST | `/v1/crew/request/:crewId` | authenticated | social-combat | [src/server.js:3101](../../src/server.js#L3101) | `Crew.requestJoin` |
| DELETE | `/v1/crew/target` | authenticated | social-combat | [src/server.js:3093](../../src/server.js#L3093) | `Crew.clearCrewTarget` |
| POST | `/v1/crew/target` | authenticated | social-combat | [src/server.js:3091](../../src/server.js#L3091) | `Crew.setCrewTarget` |
| POST | `/v1/crimes/:id` | authenticated | platform-core | [src/server.js:1551](../../src/server.js#L1551) | `G.withCharacter` |
| GET | `/v1/daily` | authenticated | engagement-growth | [src/server.js:3235](../../src/server.js#L3235) | `W.getDaily` |
| POST | `/v1/daily/:id/claim` | authenticated | engagement-growth | [src/server.js:3240](../../src/server.js#L3240) | `W.claimDaily` |
| GET | `/v1/day` | authenticated | world-progression | [src/server.js:2429](../../src/server.js#L2429) | `Day.dayBoard` |
| GET | `/v1/deeds` | authenticated | enterprise-logistics | [src/routes/deeds.js:9](../../src/routes/deeds.js#L9) | `Deeds.deedBoard` |
| POST | `/v1/deeds/buy/:sellerCharacterId` | authenticated | enterprise-logistics | [src/routes/deeds.js:25](../../src/routes/deeds.js#L25) | `Deeds.buyDeed` |
| POST | `/v1/deeds/claim` | authenticated | enterprise-logistics | [src/routes/deeds.js:11](../../src/routes/deeds.js#L11) | `Deeds.claimDeed` |
| POST | `/v1/deeds/corner` | authenticated | enterprise-logistics | [src/routes/deeds.js:15](../../src/routes/deeds.js#L15) | `Deeds.collectCorner` |
| POST | `/v1/deeds/extract` | authenticated | chain-economy | [src/server.js:3396](../../src/server.js#L3396) | `Chain.requestDeedWithdraw` |
| POST | `/v1/deeds/list` | authenticated | enterprise-logistics | [src/routes/deeds.js:21](../../src/routes/deeds.js#L21) | `Deeds.listDeed` |
| GET | `/v1/deeds/plate/:tokenId` | public | enterprise-logistics | [src/server.js:695](../../src/server.js#L695) | `Deeds.deedByToken` |
| POST | `/v1/deeds/shakedown/:targetCharacterId` | authenticated | enterprise-logistics | [src/routes/deeds.js:17](../../src/routes/deeds.js#L17) | `Deeds.shakedownCorner` |
| POST | `/v1/deeds/unlist` | authenticated | enterprise-logistics | [src/routes/deeds.js:23](../../src/routes/deeds.js#L23) | `Deeds.unlistDeed` |
| GET | `/v1/deeds/vault/:sellerCharacterId` | authenticated | enterprise-logistics | [src/routes/deeds.js:33](../../src/routes/deeds.js#L33) | `Deeds.deedVaultRecord` |
| GET | `/v1/defi` | public | platform-core | [src/routes/defi.js:29](../../src/routes/defi.js#L29) | — |
| POST | `/v1/defi/tx` | public | platform-core | [src/routes/defi.js:41](../../src/routes/defi.js#L41) | — |
| GET | `/v1/desk` | public | platform-core | [src/server.js:1668](../../src/server.js#L1668) | `Desk.deskBoard` |
| GET | `/v1/digest` | authenticated | engagement-growth | [src/server.js:3197](../../src/server.js#L3197) | `Dispatch.getDigestPrefs` |
| POST | `/v1/digest` | authenticated | engagement-growth | [src/server.js:3198](../../src/server.js#L3198) | `Dispatch.setDigestPrefs` |
| GET | `/v1/digest/confirm` | public | engagement-growth | [src/server.js:3202](../../src/server.js#L3202) | `Dispatch.confirmEmail` |
| GET | `/v1/digest/unsubscribe` | public | engagement-growth | [src/server.js:3212](../../src/server.js#L3212) | `Dispatch.unsubscribe` |
| GET | `/v1/diplomacy` | authenticated | platform-core | [src/routes/diplomacy.js:10](../../src/routes/diplomacy.js#L10) | `Diplomacy.diplomacyBoard` |
| POST | `/v1/diplomacy/coalition/:gangId` | authenticated | platform-core | [src/routes/diplomacy.js:18](../../src/routes/diplomacy.js#L18) | `Diplomacy.formCoalition` |
| DELETE | `/v1/diplomacy/coalition/:id` | authenticated | platform-core | [src/routes/diplomacy.js:22](../../src/routes/diplomacy.js#L22) | `Diplomacy.leaveCoalition` |
| POST | `/v1/diplomacy/coalition/:id/join` | authenticated | platform-core | [src/routes/diplomacy.js:20](../../src/routes/diplomacy.js#L20) | `Diplomacy.joinCoalition` |
| DELETE | `/v1/diplomacy/pact/:gangId` | authenticated | platform-core | [src/routes/diplomacy.js:16](../../src/routes/diplomacy.js#L16) | `Diplomacy.breakPact` |
| POST | `/v1/diplomacy/pact/:gangId` | authenticated | platform-core | [src/routes/diplomacy.js:12](../../src/routes/diplomacy.js#L12) | `Diplomacy.proposePact` |
| POST | `/v1/diplomacy/pact/:gangId/accept` | authenticated | platform-core | [src/routes/diplomacy.js:14](../../src/routes/diplomacy.js#L14) | `Diplomacy.acceptPact` |
| GET | `/v1/discovery` | authenticated | engagement-growth | [src/server.js:3116](../../src/server.js#L3116) | `Discovery.discoveryBoard` |
| POST | `/v1/discovery/lfg` | authenticated | engagement-growth | [src/server.js:3121](../../src/server.js#L3121) | `Discovery.setLfg` |
| GET | `/v1/districts` | public | social-combat | [src/server.js:2381](../../src/server.js#L2381) | `S.onWatch` |
| POST | `/v1/districts/:id/claim` | authenticated | social-combat | [src/server.js:1757](../../src/server.js#L1757) | `S.stakeClaim` |
| POST | `/v1/districts/:id/seize` | authenticated | social-combat | [src/server.js:1743](../../src/server.js#L1743) | `S.seizeDistrict` |
| POST | `/v1/districts/:id/watch` | authenticated | social-combat | [src/server.js:1746](../../src/server.js#L1746) | `S.setWatch` |
| GET | `/v1/drop` | authenticated | engagement-growth | [src/server.js:2461](../../src/server.js#L2461) | `Drop.dropBoard` |
| POST | `/v1/drop/claim` | authenticated | engagement-growth | [src/server.js:2463](../../src/server.js#L2463) | `Drop.claimDrop` |
| POST | `/v1/drop/solana` | authenticated | engagement-growth | [src/server.js:2470](../../src/server.js#L2470) | `Drop.claimDropSolana` |
| POST | `/v1/drop/solana/challenge` | authenticated | engagement-growth | [src/server.js:2468](../../src/server.js#L2468) | `Drop.solanaChallenge` |
| GET | `/v1/duels` | authenticated | social-combat | [src/server.js:3547](../../src/server.js#L3547) | `Duels.duelBoard` |
| POST | `/v1/duels/:targetId` | authenticated | social-combat | [src/server.js:3553](../../src/server.js#L3553) | `Duels.challenge` |
| POST | `/v1/duels/list` | authenticated | social-combat | [src/server.js:3549](../../src/server.js#L3549) | `Duels.listDuel` |
| POST | `/v1/duels/style` | authenticated | social-combat | [src/server.js:3551](../../src/server.js#L3551) | `Duels.pickStyle` |
| GET | `/v1/dynasty` | authenticated | chain-economy | [src/server.js:3275](../../src/server.js#L3275) | `Dynasty.dynastyBoard` |
| POST | `/v1/dynasty/accept/:accountId` | authenticated | chain-economy | [src/server.js:3279](../../src/server.js#L3279) | `Dynasty.acceptMarriage` |
| DELETE | `/v1/dynasty/consigliere` | authenticated | chain-economy | [src/server.js:3287](../../src/server.js#L3287) | `Dynasty.endConsigliere` |
| POST | `/v1/dynasty/consigliere/:characterId` | authenticated | chain-economy | [src/server.js:3283](../../src/server.js#L3283) | `Dynasty.nameConsigliere` |
| POST | `/v1/dynasty/consigliere/accept/:accountId` | authenticated | chain-economy | [src/server.js:3285](../../src/server.js#L3285) | `Dynasty.acceptConsigliere` |
| POST | `/v1/dynasty/divorce` | authenticated | chain-economy | [src/server.js:3281](../../src/server.js#L3281) | `Dynasty.divorceMarriage` |
| POST | `/v1/dynasty/name` | authenticated | economy-ledger | [src/server.js:2235](../../src/server.js#L2235) | `Portfolio.nameDynasty` |
| POST | `/v1/dynasty/propose/:characterId` | authenticated | chain-economy | [src/server.js:3277](../../src/server.js#L3277) | `Dynasty.proposeMarriage` |
| GET | `/v1/estate` | authenticated | enterprise-logistics | [src/routes/estate.js:18](../../src/routes/estate.js#L18) | `Estate.estateBoard` |
| POST | `/v1/estate/feature/:id` | authenticated | enterprise-logistics | [src/routes/estate.js:22](../../src/routes/estate.js#L22) | `Estate.unlockFeature` |
| POST | `/v1/estate/gala` | authenticated | enterprise-logistics | [src/routes/estate.js:33](../../src/routes/estate.js#L33) | `Estate.throwGala` |
| POST | `/v1/estate/gala/attend` | authenticated | enterprise-logistics | [src/routes/estate.js:35](../../src/routes/estate.js#L35) | `Estate.attendGala` |
| POST | `/v1/estate/name` | authenticated | enterprise-logistics | [src/routes/estate.js:24](../../src/routes/estate.js#L24) | `Estate.nameEstate` |
| DELETE | `/v1/estate/staff/:id` | authenticated | enterprise-logistics | [src/routes/estate.js:29](../../src/routes/estate.js#L29) | `Estate.dismissStaff` |
| POST | `/v1/estate/staff/:id` | authenticated | enterprise-logistics | [src/routes/estate.js:27](../../src/routes/estate.js#L27) | `Estate.hireStaff` |
| POST | `/v1/estate/upgrade` | authenticated | enterprise-logistics | [src/routes/estate.js:20](../../src/routes/estate.js#L20) | `Estate.upgradeEstate` |
| POST | `/v1/estate/wages` | authenticated | enterprise-logistics | [src/routes/estate.js:31](../../src/routes/estate.js#L31) | `Estate.payStaffWages` |
| GET | `/v1/events` | public | world-progression | [src/server.js:3126](../../src/server.js#L3126) | `cityEventBoard` |
| GET | `/v1/exchange` | public | platform-core | [src/server.js:2760](../../src/server.js#L2760) | — |
| DELETE | `/v1/exchange/:id` | authenticated | social-combat | [src/server.js:2767](../../src/server.js#L2767) | `S.cancelListing` |
| POST | `/v1/exchange/:id/buy` | authenticated | social-combat | [src/server.js:2769](../../src/server.js#L2769) | `S.buyListing` |
| POST | `/v1/exchange/list` | authenticated | social-combat | [src/server.js:2765](../../src/server.js#L2765) | `S.listItem` |
| GET | `/v1/explore` | authenticated | world-progression | [src/server.js:3167](../../src/server.js#L3167) | `Explore.exploreBoard` |
| GET | `/v1/fairness` | public | economy-ledger | [src/server.js:3134](../../src/server.js#L3134) | `fairnessBoard` |
| GET | `/v1/favors` | authenticated | engagement-growth | [src/server.js:3052](../../src/server.js#L3052) | `Favors.favorBoard` |
| POST | `/v1/favors` | authenticated | engagement-growth | [src/server.js:3054](../../src/server.js#L3054) | `Favors.postFavor` |
| DELETE | `/v1/favors/:id` | authenticated | engagement-growth | [src/server.js:3058](../../src/server.js#L3058) | `Favors.cancelFavor` |
| POST | `/v1/favors/:id/run` | authenticated | engagement-growth | [src/server.js:3056](../../src/server.js#L3056) | `Favors.runFavor` |
| GET | `/v1/fees/status` | authenticated | economy-ledger | [src/server.js:3420](../../src/server.js#L3420) | `Fees.feeStatus` |
| GET | `/v1/feud/:characterId` | authenticated | platform-core | [src/server.js:2684](../../src/server.js#L2684) | `G.GameError` |
| POST | `/v1/feud/:targetId/peace` | authenticated | social-combat | [src/server.js:2705](../../src/server.js#L2705) | `S.proposePeace` |
| POST | `/v1/feud/:targetId/peace/accept` | authenticated | social-combat | [src/server.js:2707](../../src/server.js#L2707) | `S.acceptPeace` |
| GET | `/v1/firsts` | authenticated | world-progression | [src/server.js:3335](../../src/server.js#L3335) | `Firsts.firstsBoard` |
| GET | `/v1/forge` | authenticated | chain-economy | [src/server.js:3424](../../src/server.js#L3424) | `Forge.forgeBoard` |
| GET | `/v1/gangs` | public | platform-core | [src/server.js:2328](../../src/server.js#L2328) | — |
| POST | `/v1/gangs` | authenticated | social-combat | [src/server.js:1703](../../src/server.js#L1703) | `S.createGang` |
| GET | `/v1/gangs/:id` | public | social-combat | [src/server.js:2345](../../src/server.js#L2345) | `S.resolveWarIfDue` |
| POST | `/v1/gangs/:id/join` | authenticated | social-combat | [src/server.js:1705](../../src/server.js#L1705) | `S.joinGang` |
| POST | `/v1/gangs/charter/:id` | authenticated | social-combat | [src/server.js:2745](../../src/server.js#L2745) | `S.chooseCharter` |
| GET | `/v1/gangs/chat` | authenticated | platform-core | [src/server.js:3020](../../src/server.js#L3020) | `readChat` |
| POST | `/v1/gangs/chat` | authenticated | platform-core | [src/server.js:3019](../../src/server.js#L3019) | `postChat` |
| POST | `/v1/gangs/contract/:targetId` | authenticated | social-combat | [src/server.js:2720](../../src/server.js#L2720) | `S.postFamilyContract` |
| POST | `/v1/gangs/contract/:targetId/:kind/cancel` | authenticated | social-combat | [src/server.js:2723](../../src/server.js#L2723) | `S.cancelFamilyContract` |
| POST | `/v1/gangs/foundation` | authenticated | engagement-growth | [src/server.js:2743](../../src/server.js#L2743) | `V.buyFoundation` |
| POST | `/v1/gangs/kick` | authenticated | social-combat | [src/server.js:1716](../../src/server.js#L1716) | `S.kickMember` |
| POST | `/v1/gangs/leave` | authenticated | social-combat | [src/server.js:1707](../../src/server.js#L1707) | `S.leaveGang` |
| POST | `/v1/gangs/portfolio/dividend` | authenticated | economy-ledger | [src/server.js:2207](../../src/server.js#L2207) | `Portfolio.claimFamilyDividend` |
| POST | `/v1/gangs/portfolio/invest` | authenticated | economy-ledger | [src/server.js:2201](../../src/server.js#L2201) | `Portfolio.familyInvest` |
| POST | `/v1/gangs/portfolio/name` | authenticated | economy-ledger | [src/server.js:2233](../../src/server.js#L2233) | `Portfolio.nameFamilyDynasty` |
| POST | `/v1/gangs/promote` | authenticated | social-combat | [src/server.js:1734](../../src/server.js#L1734) | `S.promoteMember` |
| POST | `/v1/gangs/tribute` | authenticated | social-combat | [src/server.js:1736](../../src/server.js#L1736) | `S.tribute` |
| POST | `/v1/gangs/tribute/omr` | authenticated | social-combat | [src/server.js:1739](../../src/server.js#L1739) | `S.tributeOmr` |
| POST | `/v1/gangs/vanity/color` | authenticated | engagement-growth | [src/server.js:2737](../../src/server.js#L2737) | `V.recolorGang` |
| POST | `/v1/gangs/vanity/name` | authenticated | engagement-growth | [src/server.js:2739](../../src/server.js#L2739) | `V.renameGang` |
| POST | `/v1/gangs/vanity/seal` | authenticated | engagement-growth | [src/server.js:2741](../../src/server.js#L2741) | `V.buySeal` |
| POST | `/v1/gangs/war/:targetGangId` | authenticated | social-combat | [src/server.js:1741](../../src/server.js#L1741) | `S.declareWar` |
| POST | `/v1/garage/:carId/fence` | authenticated | economy-ledger | [src/server.js:1624](../../src/server.js#L1624) | `E.fenceCar` |
| POST | `/v1/garage/:carId/melt` | authenticated | economy-ledger | [src/server.js:1620](../../src/server.js#L1620) | `E.meltCar` |
| POST | `/v1/garage/:carId/repair` | authenticated | economy-ledger | [src/server.js:1622](../../src/server.js#L1622) | `E.repairCar` |
| POST | `/v1/garage/boost` | authenticated | economy-ledger | [src/server.js:1618](../../src/server.js#L1618) | `E.boostCar` |
| POST | `/v1/gear/:id/mint` | authenticated | chain-economy | [src/server.js:1687](../../src/server.js#L1687) | `E.mintGear` |
| POST | `/v1/gear/:id/withdraw` | authenticated | chain-economy | [src/server.js:3386](../../src/server.js#L3386) | `Chain.requestGearWithdraw` |
| POST | `/v1/goods/buy` | authenticated | economy-ledger | [src/server.js:1636](../../src/server.js#L1636) | `E.buyGood` |
| POST | `/v1/goods/sell` | authenticated | economy-ledger | [src/server.js:1638](../../src/server.js#L1638) | `E.sellGood` |
| POST | `/v1/heal` | authenticated | platform-core | [src/server.js:1575](../../src/server.js#L1575) | `G.withCharacter` |
| POST | `/v1/heist` | authenticated | engagement-growth | [src/server.js:3231](../../src/server.js#L3231) | `W.heist` |
| GET | `/v1/heists` | authenticated | social-combat | [src/routes/heists.js:10](../../src/routes/heists.js#L10) | `Heists.heistBoard` |
| POST | `/v1/heists/:id/case` | authenticated | social-combat | [src/routes/heists.js:24](../../src/routes/heists.js#L24) | `Heists.caseJob` |
| POST | `/v1/heists/:id/execute` | authenticated | social-combat | [src/routes/heists.js:28](../../src/routes/heists.js#L28) | `Heists.executeHeist` |
| POST | `/v1/heists/:id/fill` | authenticated | social-combat | [src/routes/heists.js:22](../../src/routes/heists.js#L22) | `Heists.fillHeist` |
| POST | `/v1/heists/:id/join` | authenticated | social-combat | [src/routes/heists.js:18](../../src/routes/heists.js#L18) | `Heists.joinHeist` |
| POST | `/v1/heists/:id/leave` | authenticated | social-combat | [src/routes/heists.js:20](../../src/routes/heists.js#L20) | `Heists.leaveHeist` |
| POST | `/v1/heists/:id/rat` | authenticated | social-combat | [src/routes/heists.js:26](../../src/routes/heists.js#L26) | `Heists.ratHeist` |
| POST | `/v1/heists/fence` | authenticated | social-combat | [src/routes/heists.js:30](../../src/routes/heists.js#L30) | `Heists.fenceLoot` |
| POST | `/v1/heists/plan` | authenticated | social-combat | [src/routes/heists.js:15](../../src/routes/heists.js#L15) | `Heists.planHeist` |
| GET | `/v1/home` | authenticated | engagement-growth | [src/server.js:2443](../../src/server.js#L2443) | `Home.homeBoard` |
| GET | `/v1/hustle` | authenticated | platform-core | [src/server.js:1563](../../src/server.js#L1563) | `Hustle.hustleBoard` |
| POST | `/v1/hustle/advance` | authenticated | platform-core | [src/server.js:1565](../../src/server.js#L1565) | `Hustle.advanceHustle` |
| GET | `/v1/identity/:characterId` | public | platform-core | [src/server.js:663](../../src/server.js#L663) | — |
| GET | `/v1/identity/:characterId/portrait.svg` | public | platform-core | [src/server.js:650](../../src/server.js#L650) | — |
| POST | `/v1/identity/bio` | authenticated | engagement-growth | [src/server.js:3257](../../src/server.js#L3257) | `W.setBio` |
| POST | `/v1/identity/mint` | authenticated | chain-economy | [src/server.js:3402](../../src/server.js#L3402) | `Chain.requestDynastyMint` |
| GET | `/v1/invites` | authenticated | platform-core | [src/server.js:3066](../../src/server.js#L3066) | `Invites.inviteBoard` |
| POST | `/v1/invites` | authenticated | platform-core | [src/server.js:3070](../../src/server.js#L3070) | `Invites.issueCrewInvite` |
| POST | `/v1/items/:id/use` | authenticated | economy-ledger | [src/server.js:1632](../../src/server.js#L1632) | `E.useItem` |
| POST | `/v1/kitchen/cleanpapers` | authenticated | platform-core | [src/routes/kitchen.js:30](../../src/routes/kitchen.js#L30) | `K.cleanPapers` |
| POST | `/v1/kitchen/collect` | authenticated | platform-core | [src/routes/kitchen.js:16](../../src/routes/kitchen.js#L16) | `K.collect` |
| POST | `/v1/kitchen/cook` | authenticated | platform-core | [src/routes/kitchen.js:14](../../src/routes/kitchen.js#L14) | `K.cook` |
| DELETE | `/v1/kitchen/crew` | authenticated | platform-core | [src/routes/kitchen.js:26](../../src/routes/kitchen.js#L26) | `K.layOffCrew` |
| POST | `/v1/kitchen/crew/hire` | authenticated | platform-core | [src/routes/kitchen.js:20](../../src/routes/kitchen.js#L20) | `K.hireCrew` |
| POST | `/v1/kitchen/crew/wages` | authenticated | platform-core | [src/routes/kitchen.js:23](../../src/routes/kitchen.js#L23) | `K.payCrewWages` |
| POST | `/v1/kitchen/cut/:drugId` | authenticated | platform-core | [src/routes/kitchen.js:35](../../src/routes/kitchen.js#L35) | `K.cutStash` |
| POST | `/v1/kitchen/deal` | authenticated | platform-core | [src/routes/kitchen.js:18](../../src/routes/kitchen.js#L18) | `K.deal` |
| POST | `/v1/kitchen/lab/upgrade` | authenticated | platform-core | [src/routes/kitchen.js:12](../../src/routes/kitchen.js#L12) | `K.upgradeLab` |
| POST | `/v1/kitchen/laylow` | authenticated | platform-core | [src/routes/kitchen.js:28](../../src/routes/kitchen.js#L28) | `K.layLow` |
| POST | `/v1/kitchen/makings/:drugId` | authenticated | platform-core | [src/routes/kitchen.js:10](../../src/routes/kitchen.js#L10) | `K.buyMakings` |
| POST | `/v1/kitchen/module/:mod` | authenticated | platform-core | [src/routes/kitchen.js:33](../../src/routes/kitchen.js#L33) | `K.upgradeModule` |
| GET | `/v1/landmarks` | public | world-progression | [src/server.js:2258](../../src/server.js#L2258) | `Landmarks.landmarkBoard` |
| POST | `/v1/landmarks/:districtId` | authenticated | world-progression | [src/server.js:2259](../../src/server.js#L2259) | `Landmarks.dedicateLandmark` |
| GET | `/v1/law` | authenticated | law-intelligence | [src/routes/law.js:11](../../src/routes/law.js#L11) | `Law.lawBoard` |
| POST | `/v1/law/bribe` | authenticated | law-intelligence | [src/routes/law.js:13](../../src/routes/law.js#L13) | `Law.bribe` |
| POST | `/v1/law/envelope` | authenticated | law-intelligence | [src/routes/law.js:17](../../src/routes/law.js#L17) | `Law.payEnvelope` |
| POST | `/v1/law/flip/:targetId` | authenticated | law-intelligence | [src/routes/law.js:28](../../src/routes/law.js#L28) | `Law.flip` |
| POST | `/v1/law/jury` | authenticated | law-intelligence | [src/routes/law.js:21](../../src/routes/law.js#L21) | `Law.buyJury` |
| POST | `/v1/law/plea` | authenticated | law-intelligence | [src/routes/law.js:19](../../src/routes/law.js#L19) | `Law.plea` |
| POST | `/v1/law/retainer` | authenticated | law-intelligence | [src/routes/law.js:15](../../src/routes/law.js#L15) | `Law.retainer` |
| POST | `/v1/law/trial` | authenticated | law-intelligence | [src/routes/law.js:23](../../src/routes/law.js#L23) | `Law.demandTrial` |
| POST | `/v1/law/witpro` | authenticated | law-intelligence | [src/routes/law.js:25](../../src/routes/law.js#L25) | `Law.enterWitpro` |
| GET | `/v1/leaderboard/agents` | authenticated | engagement-growth | [src/routes/leaderboards.js:85](../../src/routes/leaderboards.js#L85) | `W.agentLeaderboard` |
| GET | `/v1/leaderboard/blood-wars` | authenticated | world-progression | [src/routes/leaderboards.js:115](../../src/routes/leaderboards.js#L115) | `NpcWar.bloodWarLeaderboard` |
| GET | `/v1/leaderboard/bloodline` | authenticated | platform-core | [src/routes/leaderboards.js:96](../../src/routes/leaderboards.js#L96) | `Bloodline.bloodlineLeaderboard` |
| GET | `/v1/leaderboard/boxing` | authenticated | vice-competition | [src/routes/leaderboards.js:49](../../src/routes/leaderboards.js#L49) | `Boxing.boxingLeaderboard` |
| GET | `/v1/leaderboard/builders` | authenticated | enterprise-logistics | [src/routes/leaderboards.js:109](../../src/routes/leaderboards.js#L109) | `Mega.builderLeaderboard` |
| GET | `/v1/leaderboard/city` | authenticated | world-progression | [src/routes/leaderboards.js:71](../../src/routes/leaderboards.js#L71) | `Standing.cityStanding` |
| GET | `/v1/leaderboard/clues` | authenticated | platform-core | [src/routes/leaderboards.js:112](../../src/routes/leaderboards.js#L112) | `Clues.clueLeaderboard` |
| GET | `/v1/leaderboard/collection` | authenticated | law-intelligence | [src/routes/leaderboards.js:101](../../src/routes/leaderboards.js#L101) | `Collection.collectionLeaderboard` |
| GET | `/v1/leaderboard/collectors` | authenticated | enterprise-logistics | [src/routes/leaderboards.js:61](../../src/routes/leaderboards.js#L61) | `Estate.collectorLeaderboard` |
| GET | `/v1/leaderboard/commanders` | authenticated | social-combat | [src/routes/leaderboards.js:100](../../src/routes/leaderboards.js#L100) | `Soldiers.commanderLeaderboard` |
| GET | `/v1/leaderboard/conquest` | authenticated | world-progression | [src/routes/leaderboards.js:116](../../src/routes/leaderboards.js#L116) | `NpcWar.conquestLeaderboard` |
| GET | `/v1/leaderboard/contacts` | authenticated | engagement-growth | [src/server.js:3039](../../src/server.js#L3039) | `Contacts.contactsLeaderboard` |
| GET | `/v1/leaderboard/convoy` | authenticated | enterprise-logistics | [src/routes/leaderboards.js:65](../../src/routes/leaderboards.js#L65) | `Convoy.convoyLeaderboard` |
| GET | `/v1/leaderboard/crews` | authenticated | social-combat | [src/server.js:3109](../../src/server.js#L3109) | `Crew.crewLeaderboard` |
| GET | `/v1/leaderboard/duels` | authenticated | social-combat | [src/routes/leaderboards.js:111](../../src/routes/leaderboards.js#L111) | `Duels.duelLeaderboard` |
| GET | `/v1/leaderboard/estates` | authenticated | enterprise-logistics | [src/routes/leaderboards.js:60](../../src/routes/leaderboards.js#L60) | `Estate.estateLeaderboard` |
| GET | `/v1/leaderboard/family-build` | authenticated | enterprise-logistics | [src/routes/leaderboards.js:110](../../src/routes/leaderboards.js#L110) | `Mega.familyBuildLeaderboard` |
| GET | `/v1/leaderboard/family-portfolio` | authenticated | economy-ledger | [src/routes/leaderboards.js:57](../../src/routes/leaderboards.js#L57) | `Portfolio.familyPortfolioLeaderboard` |
| GET | `/v1/leaderboard/family-wars` | authenticated | world-progression | [src/routes/leaderboards.js:117](../../src/routes/leaderboards.js#L117) | `NpcWar.familyWarWinsLeaderboard` |
| GET | `/v1/leaderboard/feuds` | authenticated | social-combat | [src/routes/leaderboards.js:91](../../src/routes/leaderboards.js#L91) | `S.feudLeaderboard` |
| GET | `/v1/leaderboard/foundation` | authenticated | engagement-growth | [src/routes/leaderboards.js:59](../../src/routes/leaderboards.js#L59) | `V.foundationLeaderboard` |
| GET | `/v1/leaderboard/frontier` | authenticated | world-progression | [src/routes/leaderboards.js:119](../../src/routes/leaderboards.js#L119) | `World.frontierLeaderboard` |
| GET | `/v1/leaderboard/heists` | authenticated | social-combat | [src/routes/leaderboards.js:66](../../src/routes/leaderboards.js#L66) | `Heists.heistLeaderboard` |
| GET | `/v1/leaderboard/hitmen` | authenticated | social-combat | [src/routes/leaderboards.js:68](../../src/routes/leaderboards.js#L68) | `S.hitmanLeaderboard` |
| GET | `/v1/leaderboard/honor` | authenticated | social-combat | [src/routes/leaderboards.js:98](../../src/routes/leaderboards.js#L98) | `Honor.honorLeaderboard` |
| GET | `/v1/leaderboard/kingpins` | authenticated | platform-core | [src/routes/leaderboards.js:93](../../src/routes/leaderboards.js#L93) | `K.kingpinLeaderboard` |
| GET | `/v1/leaderboard/launderers` | authenticated | enterprise-logistics | [src/routes/leaderboards.js:44](../../src/routes/leaderboards.js#L44) | `Business.laundererLeaderboard` |
| GET | `/v1/leaderboard/mentors` | authenticated | social-combat | [src/server.js:3148](../../src/server.js#L3148) | `Mentor.mentorLeaderboard` |
| GET | `/v1/leaderboard/nightlife` | authenticated | vice-competition | [src/routes/leaderboards.js:45](../../src/routes/leaderboards.js#L45) | `Speakeasy.nightlifeLeaderboard` |
| GET | `/v1/leaderboard/patrons` | authenticated | platform-core | [src/routes/leaderboards.js:107](../../src/routes/leaderboards.js#L107) | `Store.benefactorLeaderboard` |
| GET | `/v1/leaderboard/port` | authenticated | enterprise-logistics | [src/routes/leaderboards.js:55](../../src/routes/leaderboards.js#L55) | `Port.portLeaderboard` |
| GET | `/v1/leaderboard/portfolio` | authenticated | economy-ledger | [src/routes/leaderboards.js:58](../../src/routes/leaderboards.js#L58) | `Portfolio.portfolioLeaderboard` |
| GET | `/v1/leaderboard/races` | authenticated | vice-competition | [src/routes/leaderboards.js:54](../../src/routes/leaderboards.js#L54) | `Races.raceLeaderboard` |
| GET | `/v1/leaderboard/recruiters` | authenticated | platform-core | [src/routes/leaderboards.js:83](../../src/routes/leaderboards.js#L83) | `recruitersBoard` |
| GET | `/v1/leaderboard/sov` | authenticated | world-progression | [src/routes/leaderboards.js:95](../../src/routes/leaderboards.js#L95) | `Sov.sovLeaderboard` |
| GET | `/v1/leaderboard/stable` | authenticated | vice-competition | [src/routes/leaderboards.js:53](../../src/routes/leaderboards.js#L53) | `Stable.stableLeaderboard` |
| GET | `/v1/leaderboard/statesmen` | authenticated | platform-core | [src/routes/leaderboards.js:56](../../src/routes/leaderboards.js#L56) | `Commission.statesmenLeaderboard` |
| GET | `/v1/leaderboard/streak` | authenticated | world-progression | [src/server.js:3155](../../src/server.js#L3155) | `Streak.streakLeaderboard` |
| GET | `/v1/leaderboard/streets` | authenticated | enterprise-logistics | [src/routes/leaderboards.js:62](../../src/routes/leaderboards.js#L62) | `Deeds.greatStreetsLeaderboard` |
| GET | `/v1/leaderboard/territory` | authenticated | enterprise-logistics | [src/routes/leaderboards.js:43](../../src/routes/leaderboards.js#L43) | `Territory.territoryLeaderboard` |
| GET | `/v1/leaderboard/trades` | authenticated | world-progression | [src/routes/leaderboards.js:94](../../src/routes/leaderboards.js#L94) | `Mastery.tradesLeaderboard` |
| GET | `/v1/leaderboard/tycoons` | authenticated | economy-ledger | [src/routes/leaderboards.js:42](../../src/routes/leaderboards.js#L42) | `E.tycoonLeaderboard` |
| GET | `/v1/leaderboard/underwriters` | authenticated | platform-core | [src/routes/leaderboards.js:102](../../src/routes/leaderboards.js#L102) | `Bonds.underwriterLeaderboard` |
| GET | `/v1/leaderboard/vouches` | authenticated | social-combat | [src/server.js:3188](../../src/server.js#L3188) | `Vouch.vouchLeaderboard` |
| GET | `/v1/leaderboard/wire` | authenticated | law-intelligence | [src/routes/leaderboards.js:63](../../src/routes/leaderboards.js#L63) | `Wire.wireLeaderboard` |
| GET | `/v1/leaderboard/world` | authenticated | world-progression | [src/routes/leaderboards.js:114](../../src/routes/leaderboards.js#L114) | `World.worldLeaderboard` |
| GET | `/v1/live` | authenticated | engagement-growth | [src/server.js:3162](../../src/server.js#L3162) | `Collision.collisionBoard` |
| GET | `/v1/loans` | authenticated | enterprise-logistics | [src/server.js:2141](../../src/server.js#L2141) | `Loans.loanBoard` |
| POST | `/v1/loans` | authenticated | enterprise-logistics | [src/server.js:2145](../../src/server.js#L2145) | `Loans.offerLoan` |
| POST | `/v1/loans/:id/buy` | authenticated | enterprise-logistics | [src/server.js:2186](../../src/server.js#L2186) | `Loans.buyPaper` |
| POST | `/v1/loans/:id/cancel` | authenticated | enterprise-logistics | [src/server.js:2149](../../src/server.js#L2149) | `Loans.cancelLoan` |
| POST | `/v1/loans/:id/collect` | authenticated | enterprise-logistics | [src/server.js:2158](../../src/server.js#L2158) | `Loans.collectLoan` |
| POST | `/v1/loans/:id/repay` | authenticated | enterprise-logistics | [src/server.js:2152](../../src/server.js#L2152) | `Loans.repayLoan` |
| POST | `/v1/loans/:id/sell` | authenticated | enterprise-logistics | [src/server.js:2164](../../src/server.js#L2164) | `Loans.sellPaper` |
| POST | `/v1/loans/:id/take` | authenticated | enterprise-logistics | [src/server.js:2147](../../src/server.js#L2147) | `Loans.takeLoan` |
| POST | `/v1/loans/:id/unsell` | authenticated | enterprise-logistics | [src/server.js:2166](../../src/server.js#L2166) | `Loans.unsellPaper` |
| POST | `/v1/loans/house` | authenticated | enterprise-logistics | [src/server.js:2170](../../src/server.js#L2170) | `Loans.takeHouseLoan` |
| POST | `/v1/loans/house/repay` | authenticated | enterprise-logistics | [src/server.js:2172](../../src/server.js#L2172) | `Loans.repayHouseLoan` |
| POST | `/v1/loans/square` | authenticated | enterprise-logistics | [src/server.js:2183](../../src/server.js#L2183) | `Loans.squareWanted` |
| GET | `/v1/made` | authenticated | social-combat | [src/routes/estate.js:13](../../src/routes/estate.js#L13) | `Made.madeBoard` |
| POST | `/v1/made` | authenticated | social-combat | [src/routes/estate.js:15](../../src/routes/estate.js#L15) | `Made.payDues` |
| GET | `/v1/map` | authenticated | world-progression | [src/server.js:2425](../../src/server.js#L2425) | `CityMap.cityMap` |
| GET | `/v1/market` | public | economy-ledger | [src/server.js:2298](../../src/server.js#L2298) | `Market.marketBoard` |
| POST | `/v1/market` | authenticated | economy-ledger | [src/server.js:2299](../../src/server.js#L2299) | `Market.listItem` |
| POST | `/v1/market/:id/bid` | authenticated | economy-ledger | [src/server.js:2301](../../src/server.js#L2301) | `Market.bidListing` |
| POST | `/v1/market/:id/buy` | authenticated | economy-ledger | [src/server.js:2303](../../src/server.js#L2303) | `Market.buyListing` |
| POST | `/v1/market/:id/cancel` | authenticated | economy-ledger | [src/server.js:2305](../../src/server.js#L2305) | `Market.cancelListing` |
| POST | `/v1/market/:id/claim` | authenticated | economy-ledger | [src/server.js:2313](../../src/server.js#L2313) | `Market.claimOrder` |
| POST | `/v1/market/:id/fill` | authenticated | economy-ledger | [src/server.js:2311](../../src/server.js#L2311) | `Market.fillOrder` |
| POST | `/v1/market/order` | authenticated | economy-ledger | [src/server.js:2309](../../src/server.js#L2309) | `Market.postOrder` |
| GET | `/v1/market/prices` | public | social-combat | [src/server.js:3471](../../src/server.js#L3471) | `Block.marketPrices` |
| GET | `/v1/mastery` | authenticated | world-progression | [src/server.js:2122](../../src/server.js#L2122) | `Mastery.masteryBoard` |
| POST | `/v1/mastery/trait/:trackId` | authenticated | world-progression | [src/server.js:2124](../../src/server.js#L2124) | `Mastery.chooseTrait` |
| GET | `/v1/me` | authenticated | platform-core | [src/server.js:1533](../../src/server.js#L1533) | `G.readCharacter` |
| GET | `/v1/megaproject` | authenticated | enterprise-logistics | [src/server.js:3537](../../src/server.js#L3537) | `Mega.megaBoard` |
| POST | `/v1/megaproject/cash` | authenticated | enterprise-logistics | [src/server.js:3538](../../src/server.js#L3538) | `Mega.giveCash` |
| POST | `/v1/megaproject/goods` | authenticated | enterprise-logistics | [src/server.js:3540](../../src/server.js#L3540) | `Mega.giveGoods` |
| POST | `/v1/megaproject/omr` | authenticated | enterprise-logistics | [src/server.js:3542](../../src/server.js#L3542) | `Mega.giveOmr` |
| GET | `/v1/mentor` | authenticated | social-combat | [src/server.js:3136](../../src/server.js#L3136) | `Mentor.mentorBoard` |
| POST | `/v1/mentor/accept/:mentorCharId` | authenticated | social-combat | [src/server.js:3142](../../src/server.js#L3142) | `Mentor.acceptMentor` |
| POST | `/v1/mentor/claim` | authenticated | social-combat | [src/server.js:3144](../../src/server.js#L3144) | `Mentor.claimMentor` |
| POST | `/v1/mentor/gift/:protegeCharId` | authenticated | social-combat | [src/server.js:3146](../../src/server.js#L3146) | `Mentor.mentorGift` |
| POST | `/v1/mentor/offer/:characterId` | authenticated | social-combat | [src/server.js:3140](../../src/server.js#L3140) | `Mentor.offerMentor` |
| POST | `/v1/mentor/seeking` | authenticated | social-combat | [src/server.js:3138](../../src/server.js#L3138) | `Mentor.seekMentor` |
| POST | `/v1/missions/:id` | authenticated | engagement-growth | [src/server.js:3233](../../src/server.js#L3233) | `W.doMission` |
| GET | `/v1/mod/actions` | moderator | platform-core | [src/server.js:1022](../../src/server.js#L1022) | — |
| GET | `/v1/mod/activity` | moderator | platform-core | [src/routes/modtools.js:150](../../src/routes/modtools.js#L150) | `Ops.opsActivity` |
| POST | `/v1/mod/alert/test` | moderator | platform-core | [src/routes/modtools.js:138](../../src/routes/modtools.js#L138) | — |
| GET | `/v1/mod/audit` | moderator | platform-core | [src/routes/modtools.js:167](../../src/routes/modtools.js#L167) | — |
| POST | `/v1/mod/ban` | moderator | platform-core | [src/routes/modtools.js:42](../../src/routes/modtools.js#L42) | `G.GameError` |
| GET | `/v1/mod/bank` | moderator | platform-core | [src/routes/modtools.js:253](../../src/routes/modtools.js#L253) | `Bank.runBankInvariants` |
| POST | `/v1/mod/bank/buy` | moderator | platform-core | [src/routes/modtools.js:254](../../src/routes/modtools.js#L254) | `Bank.recordBankBuy` |
| POST | `/v1/mod/bank/epoch` | moderator | platform-core | [src/routes/modtools.js:258](../../src/routes/modtools.js#L258) | `Bank.runCityLeg` |
| POST | `/v1/mod/bank/harvest` | moderator | economy-ledger | [src/routes/modtools.js:234](../../src/routes/modtools.js#L234) | `Treasury.recordHarvestFee` |
| POST | `/v1/mod/bond/fund` | moderator | platform-core | [src/routes/modtools.js:294](../../src/routes/modtools.js#L294) | `Bonds.fundBondTranche` |
| POST | `/v1/mod/bond/offer` | moderator | platform-core | [src/routes/modtools.js:297](../../src/routes/modtools.js#L297) | `Bonds.setBondOffering` |
| POST | `/v1/mod/bond/simulate` | moderator | platform-core | [src/routes/modtools.js:298](../../src/routes/modtools.js#L298) | `Bonds.recordBond` |
| GET | `/v1/mod/bonds` | moderator | platform-core | [src/routes/modtools.js:175](../../src/routes/modtools.js#L175) | `Bonds.bondStatus` |
| GET | `/v1/mod/brokers` | moderator | platform-core | [src/server.js:2270](../../src/server.js#L2270) | `Brokers.epochBoard` |
| POST | `/v1/mod/brokers/allocate` | moderator | platform-core | [src/server.js:2271](../../src/server.js#L2271) | `Brokers.allocateEpoch` |
| GET | `/v1/mod/chain/params` | moderator | platform-core | [src/routes/modtools.js:157](../../src/routes/modtools.js#L157) | `ChainParams.readChainParams` |
| POST | `/v1/mod/chain/tx` | moderator | platform-core | [src/routes/modtools.js:158](../../src/routes/modtools.js#L158) | `ChainParams.buildParamTx` |
| GET | `/v1/mod/coach` | moderator | platform-core | [src/routes/modtools.js:151](../../src/routes/modtools.js#L151) | `Ops.opsCoach` |
| GET | `/v1/mod/community` | moderator | engagement-growth | [src/routes/modtools.js:266](../../src/routes/modtools.js#L266) | `Community.runFamilyBuybackInvariants` |
| POST | `/v1/mod/community/buy` | moderator | engagement-growth | [src/routes/modtools.js:270](../../src/routes/modtools.js#L270) | `Community.runFamilyBuyback` |
| POST | `/v1/mod/confiscate` | moderator | platform-core | [src/routes/modtools.js:91](../../src/routes/modtools.js#L91) | `G.GameError` |
| POST | `/v1/mod/content/activate` | moderator | platform-core | [src/routes/content.js:273](../../src/routes/content.js#L273) | `activateContentBundle` |
| GET | `/v1/mod/coordination/metrics` | public | platform-core | [src/routes/coordination.js:123](../../src/routes/coordination.js#L123) | — |
| POST | `/v1/mod/deeds/recover` | moderator | chain-economy | [src/routes/modtools.js:321](../../src/routes/modtools.js#L321) | `Chain.recoverStrandedDeed` |
| GET | `/v1/mod/deeds/stranded` | moderator | chain-economy | [src/routes/modtools.js:316](../../src/routes/modtools.js#L316) | `Chain.strandedDeeds` |
| GET | `/v1/mod/defi` | moderator | platform-core | [src/routes/defi.js:76](../../src/routes/defi.js#L76) | — |
| POST | `/v1/mod/defi/tx` | moderator | platform-core | [src/routes/defi.js:97](../../src/routes/defi.js#L97) | — |
| GET | `/v1/mod/desk` | moderator | platform-core | [src/routes/modtools.js:280](../../src/routes/modtools.js#L280) | `Desk.runDeskInvariants` |
| POST | `/v1/mod/desk/buy` | moderator | platform-core | [src/routes/modtools.js:291](../../src/routes/modtools.js#L291) | `Desk.runDeskBuyback` |
| POST | `/v1/mod/desk/fees` | moderator | platform-core | [src/routes/modtools.js:289](../../src/routes/modtools.js#L289) | `Desk.recordPolFees` |
| POST | `/v1/mod/desk/fill` | moderator | platform-core | [src/routes/modtools.js:282](../../src/routes/modtools.js#L282) | `Desk.recordAuctionBuy` |
| POST | `/v1/mod/desk/open` | moderator | platform-core | [src/routes/modtools.js:281](../../src/routes/modtools.js#L281) | `Desk.openAuction` |
| GET | `/v1/mod/dev` | moderator | platform-core | [src/routes/modtools.js:376](../../src/routes/modtools.js#L376) | — |
| POST | `/v1/mod/dev/claim` | moderator | platform-core | [src/routes/modtools.js:382](../../src/routes/modtools.js#L382) | — |
| GET | `/v1/mod/dexbot` | moderator | economy-ledger | [src/routes/modtools.js:341](../../src/routes/modtools.js#L341) | `DexBot.dexBotBoard` |
| POST | `/v1/mod/dexbot/buyback` | moderator | economy-ledger | [src/routes/modtools.js:343](../../src/routes/modtools.js#L343) | `DexBot.runDexBuyback` |
| POST | `/v1/mod/dexbot/pol` | moderator | economy-ledger | [src/routes/modtools.js:345](../../src/routes/modtools.js#L345) | `DexBot.runPolPairing` |
| GET | `/v1/mod/drop` | moderator | engagement-growth | [src/routes/modtools.js:362](../../src/routes/modtools.js#L362) | `Drop.dropStatus` |
| POST | `/v1/mod/drop/load` | moderator | engagement-growth | [src/routes/modtools.js:358](../../src/routes/modtools.js#L358) | `Drop.loadAllocations` |
| POST | `/v1/mod/drop/window` | moderator | engagement-growth | [src/routes/modtools.js:360](../../src/routes/modtools.js#L360) | `Drop.setDropWindow` |
| GET | `/v1/mod/emission` | moderator | platform-core | [src/routes/modtools.js:402](../../src/routes/modtools.js#L402) | — |
| POST | `/v1/mod/emission/fund` | moderator | platform-core | [src/routes/modtools.js:413](../../src/routes/modtools.js#L413) | `G.GameError` |
| GET | `/v1/mod/engagement` | moderator | engagement-growth | [src/routes/modtools.js:165](../../src/routes/modtools.js#L165) | `opsEngagement` |
| GET | `/v1/mod/exchange` | moderator | economy-ledger | [src/server.js:1669](../../src/server.js#L1669) | `Exchange.exchangePool` |
| POST | `/v1/mod/fees/record` | moderator | economy-ledger | [src/routes/modtools.js:325](../../src/routes/modtools.js#L325) | `Fees.recordFeePayment` |
| GET | `/v1/mod/funnel` | moderator | engagement-growth | [src/routes/modtools.js:148](../../src/routes/modtools.js#L148) | `W.funnelStats` |
| GET | `/v1/mod/integrations` | moderator | platform-core | [src/routes/modtools.js:152](../../src/routes/modtools.js#L152) | `Ops.integrationsStatus` |
| GET | `/v1/mod/invariants` | moderator | economy-ledger | [src/routes/modtools.js:131](../../src/routes/modtools.js#L131) | `runLedgerInvariants` |
| POST | `/v1/mod/invites` | moderator | platform-core | [src/routes/modtools.js:116](../../src/routes/modtools.js#L116) | — |
| GET | `/v1/mod/items/stranded` | moderator | chain-economy | [src/routes/modtools.js:320](../../src/routes/modtools.js#L320) | `Chain.strandedItems` |
| POST | `/v1/mod/kill` | moderator | social-combat | [src/routes/modtools.js:65](../../src/routes/modtools.js#L65) | `S.runEstate` |
| POST | `/v1/mod/loanhouse/fund` | moderator | enterprise-logistics | [src/routes/modtools.js:40](../../src/routes/modtools.js#L40) | `Loans.fundLoanHouse` |
| GET | `/v1/mod/overview` | moderator | platform-core | [src/routes/modtools.js:149](../../src/routes/modtools.js#L149) | `Ops.opsOverview` |
| GET | `/v1/mod/referral/push` | moderator | platform-core | [src/routes/modtools.js:130](../../src/routes/modtools.js#L130) | `G.referralPushStatus` |
| POST | `/v1/mod/referral/push` | moderator | platform-core | [src/routes/modtools.js:128](../../src/routes/modtools.js#L128) | `G.startReferralPush` |
| GET | `/v1/mod/release-funnel` | moderator | platform-core | [src/routes/modtools.js:166](../../src/routes/modtools.js#L166) | `worldReleaseMetrics` |
| GET | `/v1/mod/reserve` | moderator | chain-economy | [src/routes/modtools.js:309](../../src/routes/modtools.js#L309) | `Chain.reserveStatus` |
| POST | `/v1/mod/reserve/claimed` | moderator | chain-economy | [src/routes/modtools.js:310](../../src/routes/modtools.js#L310) | `Chain.markClaimed` |
| POST | `/v1/mod/reserve/fund` | moderator | chain-economy | [src/routes/modtools.js:308](../../src/routes/modtools.js#L308) | `Chain.fundReserve` |
| GET | `/v1/mod/revenue` | moderator | platform-core | [src/routes/modtools.js:366](../../src/routes/modtools.js#L366) | `Store.revenueStatus` |
| POST | `/v1/mod/revoke` | moderator | platform-core | [src/routes/modtools.js:54](../../src/routes/modtools.js#L54) | `G.GameError` |
| GET | `/v1/mod/router` | moderator | platform-core | [src/routes/modtools.js:370](../../src/routes/modtools.js#L370) | `Router.routerBoard` |
| POST | `/v1/mod/store/grant` | moderator | platform-core | [src/routes/modtools.js:371](../../src/routes/modtools.js#L371) | `Store.recordStorePurchase` |
| GET | `/v1/mod/tokenhealth` | moderator | economy-ledger | [src/routes/modtools.js:278](../../src/routes/modtools.js#L278) | `TokenHealth.tokenHealth` |
| GET | `/v1/mod/treasury` | moderator | economy-ledger | [src/routes/modtools.js:182](../../src/routes/modtools.js#L182) | `Treasury.runTreasuryInvariants` |
| GET | `/v1/mod/treasury/budget` | moderator | economy-ledger | [src/routes/modtools.js:185](../../src/routes/modtools.js#L185) | `Treasury.stockBudget` |
| POST | `/v1/mod/treasury/buy` | moderator | economy-ledger | [src/routes/modtools.js:198](../../src/routes/modtools.js#L198) | `Treasury.recordStockBuy` |
| POST | `/v1/mod/treasury/deliver` | moderator | economy-ledger | [src/routes/modtools.js:218](../../src/routes/modtools.js#L218) | `StockDeliver.deliverStock` |
| GET | `/v1/mod/treasury/deliveries` | moderator | economy-ledger | [src/routes/modtools.js:216](../../src/routes/modtools.js#L216) | `StockDeliver.stockDeliveryBoard` |
| POST | `/v1/mod/treasury/deliveries/run` | moderator | economy-ledger | [src/routes/modtools.js:224](../../src/routes/modtools.js#L224) | `StockDeliver.runStockDeliveryKeeper` |
| POST | `/v1/mod/treasury/distribute` | moderator | platform-core | [src/routes/modtools.js:207](../../src/routes/modtools.js#L207) | `Brokers.distributeBuy` |
| POST | `/v1/mod/treasury/keeper` | moderator | economy-ledger | [src/routes/modtools.js:191](../../src/routes/modtools.js#L191) | `Treasury.runStockBuyback` |
| POST | `/v1/mod/treasury/tax` | moderator | economy-ledger | [src/routes/modtools.js:229](../../src/routes/modtools.js#L229) | `Treasury.recordSellTax` |
| GET | `/v1/mod/vig` | moderator | economy-ledger | [src/routes/modtools.js:330](../../src/routes/modtools.js#L330) | `Vig.vigStatus` |
| POST | `/v1/mod/vig/buyback` | moderator | economy-ledger | [src/routes/modtools.js:332](../../src/routes/modtools.js#L332) | `Vig.runVigBuyback` |
| POST | `/v1/mod/vig/prizes` | moderator | economy-ledger | [src/routes/modtools.js:335](../../src/routes/modtools.js#L335) | `Vig.payPrizes` |
| GET | `/v1/nft` | authenticated | platform-core | [src/server.js:3389](../../src/server.js#L3389) | `G.readCharacter` |
| POST | `/v1/nft/:kind/:id/upgrade` | authenticated | platform-core | [src/server.js:3390](../../src/server.js#L3390) | `G.withCharacter` |
| POST | `/v1/nft/:kind/:id/withdraw` | authenticated | chain-economy | [src/server.js:3392](../../src/server.js#L3392) | `Chain.requestItemWithdraw` |
| GET | `/v1/notifications` | authenticated | platform-core | [src/server.js:2777](../../src/server.js#L2777) | — |
| GET | `/v1/npcfamily` | authenticated | world-progression | [src/server.js:3567](../../src/server.js#L3567) | `NpcWar.warBoard` |
| POST | `/v1/npcfamily/:gangId/raid` | authenticated | world-progression | [src/server.js:3569](../../src/server.js#L3569) | `NpcWar.raidFamily` |
| POST | `/v1/npcfamily/:gangId/war` | authenticated | world-progression | [src/server.js:3574](../../src/server.js#L3574) | `NpcWar.declareNpcWar` |
| POST | `/v1/npcfamily/collect` | authenticated | world-progression | [src/server.js:3571](../../src/server.js#L3571) | `NpcWar.collectFamilyTribute` |
| GET | `/v1/onboard` | authenticated | engagement-growth | [src/server.js:3242](../../src/server.js#L3242) | `W.onboardBoard` |
| POST | `/v1/onboard/:taskId/claim` | authenticated | engagement-growth | [src/server.js:3344](../../src/server.js#L3344) | `W.claimOnboard` |
| GET | `/v1/online` | public | platform-core | [src/server.js:2896](../../src/server.js#L2896) | — |
| GET | `/v1/opportunities` | authenticated | engagement-growth | [src/server.js:2553](../../src/server.js#L2553) | `opportunityBoard` |
| GET | `/v1/paper` | authenticated | engagement-growth | [src/server.js:2538](../../src/server.js#L2538) | `People.paperBoard` |
| POST | `/v1/paper/read` | authenticated | engagement-growth | [src/server.js:2540](../../src/server.js#L2540) | `People.foldPaper` |
| GET | `/v1/pass` | authenticated | platform-core | [src/server.js:3454](../../src/server.js#L3454) | `Pass.passBoard` |
| POST | `/v1/pass/claim` | authenticated | platform-core | [src/server.js:3455](../../src/server.js#L3455) | `Pass.claimPass` |
| POST | `/v1/path` | authenticated | engagement-growth | [src/server.js:3226](../../src/server.js#L3226) | `W.choosePath` |
| POST | `/v1/path-quiz` | public | platform-core | [src/server.js:1258](../../src/server.js#L1258) | `G.track` |
| GET | `/v1/payroll` | authenticated | enterprise-logistics | [src/server.js:2435](../../src/server.js#L2435) | `Payroll.payrollBoard` |
| GET | `/v1/pen` | authenticated | law-intelligence | [src/routes/pen.js:10](../../src/routes/pen.js#L10) | `Pen.penBoard` |
| POST | `/v1/pen/break` | authenticated | law-intelligence | [src/routes/pen.js:20](../../src/routes/pen.js#L20) | `Pen.attemptBreak` |
| POST | `/v1/pen/break/:id/go` | authenticated | law-intelligence | [src/routes/pen.js:34](../../src/routes/pen.js#L34) | `Pen.executeBreak` |
| POST | `/v1/pen/break/:id/join` | authenticated | law-intelligence | [src/routes/pen.js:30](../../src/routes/pen.js#L30) | `Pen.joinBreak` |
| POST | `/v1/pen/break/:id/leave` | authenticated | law-intelligence | [src/routes/pen.js:32](../../src/routes/pen.js#L32) | `Pen.leaveBreak` |
| POST | `/v1/pen/break/:id/rat` | authenticated | law-intelligence | [src/routes/pen.js:50](../../src/routes/pen.js#L50) | `Pen.ratBreak` |
| POST | `/v1/pen/break/plan` | authenticated | law-intelligence | [src/routes/pen.js:28](../../src/routes/pen.js#L28) | `Pen.planBreak` |
| GET | `/v1/pen/breaks` | authenticated | law-intelligence | [src/routes/pen.js:23](../../src/routes/pen.js#L23) | `Pen.breakBoard` |
| POST | `/v1/pen/bribe` | authenticated | law-intelligence | [src/routes/pen.js:18](../../src/routes/pen.js#L18) | `Pen.bribeGuard` |
| POST | `/v1/pen/burner/:targetId` | authenticated | law-intelligence | [src/routes/pen.js:43](../../src/routes/pen.js#L43) | `Pen.burnerHit` |
| POST | `/v1/pen/buy/:item` | authenticated | law-intelligence | [src/routes/pen.js:14](../../src/routes/pen.js#L14) | `Pen.buyContraband` |
| POST | `/v1/pen/cards` | authenticated | law-intelligence | [src/routes/pen.js:55](../../src/routes/pen.js#L55) | `Pen.yardCards` |
| POST | `/v1/pen/faction` | authenticated | law-intelligence | [src/routes/pen.js:48](../../src/routes/pen.js#L48) | `Pen.leaveFaction` |
| POST | `/v1/pen/faction/:id` | authenticated | law-intelligence | [src/routes/pen.js:46](../../src/routes/pen.js#L46) | `Pen.joinFaction` |
| POST | `/v1/pen/protection` | authenticated | law-intelligence | [src/routes/pen.js:16](../../src/routes/pen.js#L16) | `Pen.payProtection` |
| POST | `/v1/pen/shank/:targetId` | authenticated | law-intelligence | [src/routes/pen.js:36](../../src/routes/pen.js#L36) | `Pen.shank` |
| POST | `/v1/pen/talk` | authenticated | law-intelligence | [src/routes/pen.js:57](../../src/routes/pen.js#L57) | `Pen.yardTalk` |
| POST | `/v1/pen/work` | authenticated | law-intelligence | [src/routes/pen.js:12](../../src/routes/pen.js#L12) | `Pen.workYard` |
| POST | `/v1/pen/workout/:id` | authenticated | law-intelligence | [src/routes/pen.js:53](../../src/routes/pen.js#L53) | `Pen.yardWorkout` |
| GET | `/v1/people` | authenticated | engagement-growth | [src/server.js:2532](../../src/server.js#L2532) | `People.peopleBoard` |
| GET | `/v1/people/history/:characterId` | authenticated | engagement-growth | [src/server.js:2534](../../src/server.js#L2534) | `People.pairHistory` |
| GET | `/v1/phone` | authenticated | platform-core | [src/server.js:3026](../../src/server.js#L3026) | `Phone.phoneBoard` |
| DELETE | `/v1/phone/block/:characterId` | authenticated | platform-core | [src/server.js:3033](../../src/server.js#L3033) | `Phone.unblockLine` |
| POST | `/v1/phone/block/:characterId` | authenticated | platform-core | [src/server.js:3031](../../src/server.js#L3031) | `Phone.blockLine` |
| POST | `/v1/phone/dm/:characterId` | authenticated | platform-core | [src/server.js:3029](../../src/server.js#L3029) | `Phone.sendDm` |
| GET | `/v1/phone/thread/:characterId` | authenticated | platform-core | [src/server.js:3027](../../src/server.js#L3027) | `Phone.readThread` |
| POST | `/v1/plex/mint` | authenticated | economy-ledger | [src/server.js:3432](../../src/server.js#L3432) | `Vig.payPlex` |
| GET | `/v1/plex/price` | public | economy-ledger | [src/server.js:3439](../../src/server.js#L3439) | `Vig.plexQuote` |
| POST | `/v1/plex/respawn` | authenticated | economy-ledger | [src/server.js:3434](../../src/server.js#L3434) | `Vig.payPlex` |
| GET | `/v1/port` | authenticated | enterprise-logistics | [src/routes/port.js:10](../../src/routes/port.js#L10) | `Port.portBoard` |
| POST | `/v1/port/berth` | authenticated | enterprise-logistics | [src/routes/port.js:22](../../src/routes/port.js#L22) | `Port.rentBerth` |
| POST | `/v1/port/boat/:boatId/rendezvous` | authenticated | enterprise-logistics | [src/routes/port.js:28](../../src/routes/port.js#L28) | `Port.setRendezvous` |
| POST | `/v1/port/boat/:boatId/sell` | authenticated | enterprise-logistics | [src/routes/port.js:14](../../src/routes/port.js#L14) | `Port.sellBoat` |
| POST | `/v1/port/boat/:kind` | authenticated | enterprise-logistics | [src/routes/port.js:12](../../src/routes/port.js#L12) | `Port.buyBoat` |
| POST | `/v1/port/collect/:boatId` | authenticated | enterprise-logistics | [src/routes/port.js:18](../../src/routes/port.js#L18) | `Port.collectRun` |
| POST | `/v1/port/fence` | authenticated | enterprise-logistics | [src/routes/port.js:20](../../src/routes/port.js#L20) | `Port.fenceContraband` |
| POST | `/v1/port/intercept/:boatId` | authenticated | enterprise-logistics | [src/routes/port.js:26](../../src/routes/port.js#L26) | `Port.interceptRun` |
| POST | `/v1/port/rendezvous/:boatId` | authenticated | enterprise-logistics | [src/routes/port.js:30](../../src/routes/port.js#L30) | `Port.rendezvous` |
| POST | `/v1/port/run/:boatId` | authenticated | enterprise-logistics | [src/routes/port.js:16](../../src/routes/port.js#L16) | `Port.launchRun` |
| POST | `/v1/port/upgrade/:boatId` | authenticated | enterprise-logistics | [src/routes/port.js:24](../../src/routes/port.js#L24) | `Port.upgradeBoat` |
| GET | `/v1/portfolio` | authenticated | economy-ledger | [src/server.js:2197](../../src/server.js#L2197) | `Portfolio.portfolioBoard` |
| POST | `/v1/portfolio/dividend` | authenticated | economy-ledger | [src/server.js:2204](../../src/server.js#L2204) | `Portfolio.claimDividend` |
| POST | `/v1/portfolio/invest` | authenticated | economy-ledger | [src/server.js:2199](../../src/server.js#L2199) | `Portfolio.invest` |
| GET | `/v1/primetime` | authenticated | engagement-growth | [src/server.js:3172](../../src/server.js#L3172) | `Prime.primeTimeBoard` |
| POST | `/v1/primetime/answer` | authenticated | engagement-growth | [src/server.js:3174](../../src/server.js#L3174) | `Prime.answerCall` |
| POST | `/v1/primetime/round` | authenticated | engagement-growth | [src/server.js:3176](../../src/server.js#L3176) | `Prime.buyRound` |
| POST | `/v1/primetime/siege` | authenticated | engagement-growth | [src/server.js:3178](../../src/server.js#L3178) | `Prime.joinSiege` |
| GET | `/v1/profile` | authenticated | engagement-growth | [src/server.js:3253](../../src/server.js#L3253) | `W.myProfile` |
| GET | `/v1/projections/player` | authenticated | platform-core | [src/routes/projections.js:58](../../src/routes/projections.js#L58) | — |
| GET | `/v1/projections/world` | authenticated | platform-core | [src/routes/projections.js:63](../../src/routes/projections.js#L63) | — |
| GET | `/v1/provenance` | authenticated | engagement-growth | [src/server.js:2476](../../src/server.js#L2476) | `Drop.colorsBoard` |
| POST | `/v1/provenance` | authenticated | engagement-growth | [src/server.js:2478](../../src/server.js#L2478) | `Drop.claimColors` |
| POST | `/v1/push/subscribe` | authenticated | engagement-growth | [src/server.js:3191](../../src/server.js#L3191) | `Push.saveSubscription` |
| POST | `/v1/push/unsubscribe` | authenticated | engagement-growth | [src/server.js:3193](../../src/server.js#L3193) | `Push.removeSubscription` |
| GET | `/v1/races` | authenticated | vice-competition | [src/routes/races.js:10](../../src/routes/races.js#L10) | `Races.raceBoard` |
| POST | `/v1/races/challenge/:ownerId` | authenticated | vice-competition | [src/routes/races.js:24](../../src/routes/races.js#L24) | `Races.raceChallenge` |
| POST | `/v1/races/gp` | authenticated | vice-competition | [src/routes/races.js:30](../../src/routes/races.js#L30) | `Races.enterGrandPrix` |
| POST | `/v1/races/list/:carId` | authenticated | vice-competition | [src/routes/races.js:18](../../src/routes/races.js#L18) | `Races.listRace` |
| POST | `/v1/races/nos/:carId` | authenticated | vice-competition | [src/routes/races.js:16](../../src/routes/races.js#L16) | `Races.buyNos` |
| POST | `/v1/races/npc` | authenticated | vice-competition | [src/routes/races.js:12](../../src/routes/races.js#L12) | `Races.raceNpc` |
| POST | `/v1/races/pinks/:ownerId` | authenticated | vice-competition | [src/routes/races.js:27](../../src/routes/races.js#L27) | `Races.pinkSlipRace` |
| POST | `/v1/races/pinkslip/:carId` | authenticated | vice-competition | [src/routes/races.js:22](../../src/routes/races.js#L22) | `Races.pinkSlipList` |
| POST | `/v1/races/tune/:carId` | authenticated | vice-competition | [src/routes/races.js:14](../../src/routes/races.js#L14) | `Races.tuneCar` |
| POST | `/v1/races/unlist/:carId` | authenticated | vice-competition | [src/routes/races.js:20](../../src/routes/races.js#L20) | `Races.unlistRace` |
| DELETE | `/v1/rackets/:id` | authenticated | economy-ledger | [src/server.js:1652](../../src/server.js#L1652) | `E.retireRacket` |
| POST | `/v1/rackets/:id/buy` | authenticated | economy-ledger | [src/server.js:1642](../../src/server.js#L1642) | `E.buyRacket` |
| POST | `/v1/rackets/:id/upgrade` | authenticated | economy-ledger | [src/server.js:1649](../../src/server.js#L1649) | `E.upgradeRacket` |
| POST | `/v1/referral/claim` | authenticated | engagement-growth | [src/server.js:3250](../../src/server.js#L3250) | `W.claimReferral` |
| GET | `/v1/regimen` | authenticated | platform-core | [src/server.js:1556](../../src/server.js#L1556) | `RG.regimenBoard` |
| POST | `/v1/regimen/:id` | authenticated | platform-core | [src/server.js:1558](../../src/server.js#L1558) | `RG.trainDiscipline` |
| POST | `/v1/regimen/drill/:npc` | authenticated | platform-core | [src/server.js:1560](../../src/server.js#L1560) | `RG.claimDrill` |
| POST | `/v1/respec` | authenticated | engagement-growth | [src/server.js:3229](../../src/server.js#L3229) | `W.respec` |
| GET | `/v1/results` | public | platform-core | [src/server.js:3129](../../src/server.js#L3129) | — |
| GET | `/v1/rivals` | authenticated | social-combat | [src/server.js:2528](../../src/server.js#L2528) | `Rivals.rivalsBoard` |
| GET | `/v1/roster` | authenticated | social-combat | [src/server.js:1749](../../src/server.js#L1749) | `S.rosterOf` |
| DELETE | `/v1/roster/:post` | authenticated | social-combat | [src/server.js:1753](../../src/server.js#L1753) | `S.vacatePost` |
| POST | `/v1/roster/:post` | authenticated | social-combat | [src/server.js:1751](../../src/server.js#L1751) | `S.assignPost` |
| GET | `/v1/rules` | public | platform-core | [src/server.js:1771](../../src/server.js#L1771) | `jsonEtag` |
| POST | `/v1/rwa/ballots/:day/open` | moderator | platform-core | [src/routes/rwa.js:232](../../src/routes/rwa.js#L232) | `openTickerBallotV2` |
| GET | `/v1/rwa/health` | public | platform-core | [src/routes/rwa.js:247](../../src/routes/rwa.js#L247) | `rwaHealthBoard` |
| GET | `/v1/rwa/health/:assetVersionKey` | public | platform-core | [src/routes/rwa.js:255](../../src/routes/rwa.js#L255) | `rwaHealthDetail` |
| GET | `/v1/rwa/nominations` | public | platform-core | [src/routes/rwa.js:199](../../src/routes/rwa.js#L199) | — |
| POST | `/v1/rwa/nominations` | authenticated | platform-core | [src/routes/rwa.js:209](../../src/routes/rwa.js#L209) | — |
| POST | `/v1/rwa/nominations/:id/endorsement` | authenticated | platform-core | [src/routes/rwa.js:217](../../src/routes/rwa.js#L217) | — |
| POST | `/v1/rwa/nominations/:id/sponsor-renewal` | authenticated | platform-core | [src/routes/rwa.js:222](../../src/routes/rwa.js#L222) | — |
| POST | `/v1/rwa/reviewer/health/:assetVersionKey/enter` | public | platform-core | [src/routes/rwa.js:258](../../src/routes/rwa.js#L258) | `reviewerPost` |
| POST | `/v1/rwa/reviewer/nominations/:id/claim` | public | platform-core | [src/routes/rwa.js:265](../../src/routes/rwa.js#L265) | `reviewerPost` |
| POST | `/v1/rwa/reviewer/nominations/:id/disposition` | public | platform-core | [src/routes/rwa.js:271](../../src/routes/rwa.js#L271) | `reviewerPost` |
| POST | `/v1/rwa/reviewer/nominations/:id/submission` | public | platform-core | [src/routes/rwa.js:278](../../src/routes/rwa.js#L278) | `reviewerPost` |
| GET | `/v1/rwa/reviewer/queue` | public | platform-core | [src/routes/rwa.js:284](../../src/routes/rwa.js#L284) | — |
| POST | `/v1/safehouse` | authenticated | social-combat | [src/server.js:2717](../../src/server.js#L2717) | `S.enterSafehouse` |
| POST | `/v1/screens` | authenticated | platform-core | [src/server.js:1599](../../src/server.js#L1599) | `G.track` |
| GET | `/v1/season/recap` | authenticated | world-progression | [src/server.js:3477](../../src/server.js#L3477) | `Season.seasonRecaps` |
| GET | `/v1/seasons` | public | world-progression | [src/server.js:3475](../../src/server.js#L3475) | `Season.seasonBoard` |
| GET | `/v1/secrets` | authenticated | law-intelligence | [src/server.js:3301](../../src/server.js#L3301) | `Secrets.secretsBoard` |
| POST | `/v1/secrets/:id/expose` | authenticated | law-intelligence | [src/server.js:3321](../../src/server.js#L3321) | `Secrets.exposeSecret` |
| POST | `/v1/secrets/:id/extort` | authenticated | law-intelligence | [src/server.js:3305](../../src/server.js#L3305) | `Secrets.extortSecret` |
| POST | `/v1/secrets/:id/pay` | authenticated | law-intelligence | [src/server.js:3309](../../src/server.js#L3309) | `Secrets.payHush` |
| GET | `/v1/session` | authenticated | platform-core | [src/server.js:1538](../../src/server.js#L1538) | — |
| GET | `/v1/shipment` | authenticated | enterprise-logistics | [src/server.js:3338](../../src/server.js#L3338) | `Shipment.shipmentBoard` |
| POST | `/v1/shipment/commission/:id` | authenticated | enterprise-logistics | [src/server.js:3342](../../src/server.js#L3342) | `Shipment.commissionPiece` |
| POST | `/v1/shipment/take` | authenticated | enterprise-logistics | [src/server.js:3340](../../src/server.js#L3340) | `Shipment.takeShipment` |
| GET | `/v1/skills` | authenticated | world-progression | [src/server.js:2119](../../src/server.js#L2119) | `Skills.skillsBoard` |
| POST | `/v1/skills/:id` | authenticated | world-progression | [src/server.js:2133](../../src/server.js#L2133) | `Skills.learnSkill` |
| POST | `/v1/skills/active/:ability` | authenticated | world-progression | [src/server.js:2129](../../src/server.js#L2129) | `Skills.useActive` |
| POST | `/v1/skills/respec` | authenticated | world-progression | [src/server.js:2126](../../src/server.js#L2126) | `Skills.respecSkills` |
| POST | `/v1/skills/respec/:id` | authenticated | world-progression | [src/server.js:2131](../../src/server.js#L2131) | `Skills.respecOne` |
| GET | `/v1/social` | authenticated | engagement-growth | [src/server.js:3347](../../src/server.js#L3347) | `W.socialBoard` |
| POST | `/v1/social/:taskId/claim` | authenticated | engagement-growth | [src/server.js:3351](../../src/server.js#L3351) | `W.claimSocial` |
| GET | `/v1/soldiers` | authenticated | social-combat | [src/server.js:3290](../../src/server.js#L3290) | `Soldiers.soldierBoard` |
| DELETE | `/v1/soldiers/:id` | authenticated | social-combat | [src/server.js:3298](../../src/server.js#L3298) | `Soldiers.dismissSoldier` |
| POST | `/v1/soldiers/:id/assign` | authenticated | social-combat | [src/server.js:3294](../../src/server.js#L3294) | `Soldiers.assignSoldier` |
| POST | `/v1/soldiers/hire` | authenticated | social-combat | [src/server.js:3292](../../src/server.js#L3292) | `Soldiers.hireSoldier` |
| POST | `/v1/soldiers/unassign` | authenticated | social-combat | [src/server.js:3296](../../src/server.js#L3296) | `Soldiers.unassignSoldier` |
| GET | `/v1/sov` | authenticated | world-progression | [src/routes/sov.js:9](../../src/routes/sov.js#L9) | `Sov.sovBoard` |
| POST | `/v1/sov/:district/build` | authenticated | world-progression | [src/routes/sov.js:11](../../src/routes/sov.js#L11) | `Sov.buildSov` |
| POST | `/v1/sov/:district/siege` | authenticated | world-progression | [src/routes/sov.js:17](../../src/routes/sov.js#L17) | `Sov.siegeSov` |
| POST | `/v1/sov/:district/upgrade` | authenticated | world-progression | [src/routes/sov.js:13](../../src/routes/sov.js#L13) | `Sov.upgradeSov` |
| POST | `/v1/sov/collect` | authenticated | world-progression | [src/routes/sov.js:19](../../src/routes/sov.js#L19) | `Sov.collectSov` |
| POST | `/v1/sov/upkeep` | authenticated | world-progression | [src/routes/sov.js:15](../../src/routes/sov.js#L15) | `Sov.paySovUpkeep` |
| GET | `/v1/speakeasy` | authenticated | vice-competition | [src/routes/speakeasy.js:10](../../src/routes/speakeasy.js#L10) | `Speakeasy.speakeasyBoard` |
| POST | `/v1/speakeasy/:districtId/bottle` | authenticated | vice-competition | [src/routes/speakeasy.js:22](../../src/routes/speakeasy.js#L22) | `Speakeasy.bottleService` |
| POST | `/v1/speakeasy/:districtId/buy` | authenticated | vice-competition | [src/routes/speakeasy.js:44](../../src/routes/speakeasy.js#L44) | `Speakeasy.buySpeakeasy` |
| POST | `/v1/speakeasy/:districtId/open` | authenticated | vice-competition | [src/routes/speakeasy.js:14](../../src/routes/speakeasy.js#L14) | `Speakeasy.openSpeakeasy` |
| POST | `/v1/speakeasy/:districtId/round` | authenticated | vice-competition | [src/routes/speakeasy.js:26](../../src/routes/speakeasy.js#L26) | `Speakeasy.visitSpeakeasy` |
| POST | `/v1/speakeasy/:districtId/standover` | authenticated | vice-competition | [src/routes/speakeasy.js:55](../../src/routes/speakeasy.js#L55) | `Speakeasy.standoverSpeakeasy` |
| POST | `/v1/speakeasy/:districtId/table` | authenticated | vice-competition | [src/routes/speakeasy.js:33](../../src/routes/speakeasy.js#L33) | `Speakeasy.playTable` |
| POST | `/v1/speakeasy/collect` | authenticated | vice-competition | [src/routes/speakeasy.js:16](../../src/routes/speakeasy.js#L16) | `Speakeasy.collectSpeakeasy` |
| POST | `/v1/speakeasy/decor` | authenticated | vice-competition | [src/routes/speakeasy.js:52](../../src/routes/speakeasy.js#L52) | `Speakeasy.applyDecor` |
| POST | `/v1/speakeasy/list` | authenticated | vice-competition | [src/routes/speakeasy.js:40](../../src/routes/speakeasy.js#L40) | `Speakeasy.listSpeakeasy` |
| POST | `/v1/speakeasy/name` | authenticated | vice-competition | [src/routes/speakeasy.js:20](../../src/routes/speakeasy.js#L20) | `Speakeasy.nameSpeakeasy` |
| POST | `/v1/speakeasy/unlist` | authenticated | vice-competition | [src/routes/speakeasy.js:42](../../src/routes/speakeasy.js#L42) | `Speakeasy.unlistSpeakeasy` |
| POST | `/v1/speakeasy/upgrade` | authenticated | vice-competition | [src/routes/speakeasy.js:18](../../src/routes/speakeasy.js#L18) | `Speakeasy.upgradeSpeakeasy` |
| GET | `/v1/stable` | authenticated | vice-competition | [src/routes/stable.js:10](../../src/routes/stable.js#L10) | `Stable.stableBoard` |
| POST | `/v1/stable/breed` | authenticated | vice-competition | [src/routes/stable.js:26](../../src/routes/stable.js#L26) | `Stable.breedRacers` |
| POST | `/v1/stable/buy` | authenticated | vice-competition | [src/routes/stable.js:14](../../src/routes/stable.js#L14) | `Stable.buyRacer` |
| POST | `/v1/stable/circuit/:racerId` | authenticated | vice-competition | [src/routes/stable.js:20](../../src/routes/stable.js#L20) | `Stable.raceCircuit` |
| POST | `/v1/stable/list/:racerId` | authenticated | vice-competition | [src/routes/stable.js:18](../../src/routes/stable.js#L18) | `Stable.listRacer` |
| POST | `/v1/stable/match/:opponentId` | authenticated | vice-competition | [src/routes/stable.js:22](../../src/routes/stable.js#L22) | `Stable.matchRace` |
| POST | `/v1/stable/stakes/:racerId` | authenticated | vice-competition | [src/routes/stable.js:28](../../src/routes/stable.js#L28) | `Stable.enterStakes` |
| POST | `/v1/stable/train/:racerId` | authenticated | vice-competition | [src/routes/stable.js:16](../../src/routes/stable.js#L16) | `Stable.trainRacer` |
| POST | `/v1/stake` | authenticated | economy-ledger | [src/server.js:1677](../../src/server.js#L1677) | `E.stake` |
| POST | `/v1/stake/lock` | authenticated | economy-ledger | [src/server.js:1683](../../src/server.js#L1683) | `E.lockStake` |
| GET | `/v1/store` | authenticated | platform-core | [src/server.js:3446](../../src/server.js#L3446) | `Store.storeBoard` |
| POST | `/v1/store/plex/:sku` | authenticated | platform-core | [src/server.js:3448](../../src/server.js#L3448) | `Store.payPackagePlex` |
| GET | `/v1/streak` | authenticated | world-progression | [src/server.js:3151](../../src/server.js#L3151) | `Streak.streakBoard` |
| POST | `/v1/streak/claim` | authenticated | world-progression | [src/server.js:3153](../../src/server.js#L3153) | `Streak.claimStreak` |
| GET | `/v1/streets` | authenticated | platform-core | [src/server.js:2483](../../src/server.js#L2483) | — |
| POST | `/v1/streets/:targetId/boat` | authenticated | social-combat | [src/server.js:2524](../../src/server.js#L2524) | `S.stealBoat` |
| POST | `/v1/streets/:targetId/bounty` | authenticated | social-combat | [src/server.js:2542](../../src/server.js#L2542) | `S.postBounty` |
| POST | `/v1/streets/:targetId/bust` | authenticated | social-combat | [src/server.js:2756](../../src/server.js#L2756) | `S.bust` |
| POST | `/v1/streets/:targetId/fire` | authenticated | social-combat | [src/server.js:2751](../../src/server.js#L2751) | `S.fire` |
| POST | `/v1/streets/:targetId/jump` | authenticated | social-combat | [src/server.js:2515](../../src/server.js#L2515) | `S.jump` |
| POST | `/v1/streets/:targetId/npchit` | authenticated | social-combat | [src/server.js:2709](../../src/server.js#L2709) | `S.npcHit` |
| POST | `/v1/streets/:targetId/sabotage` | authenticated | social-combat | [src/server.js:2526](../../src/server.js#L2526) | `S.sabotage` |
| POST | `/v1/streets/:targetId/search` | authenticated | social-combat | [src/server.js:2747](../../src/server.js#L2747) | `S.startSearch` |
| POST | `/v1/streets/:targetId/steal` | authenticated | social-combat | [src/server.js:2519](../../src/server.js#L2519) | `S.stealCar` |
| POST | `/v1/streets/:targetId/trunk` | authenticated | social-combat | [src/server.js:2522](../../src/server.js#L2522) | `S.robTrunk` |
| DELETE | `/v1/streets/search` | authenticated | social-combat | [src/server.js:2749](../../src/server.js#L2749) | `S.callOffSearch` |
| POST | `/v1/swap` | authenticated | economy-ledger | [src/server.js:1675](../../src/server.js#L1675) | `E.swap` |
| GET | `/v1/territory` | authenticated | enterprise-logistics | [src/routes/territory.js:32](../../src/routes/territory.js#L32) | `Territory.territoryOf` |
| POST | `/v1/territory/:districtId/establish` | authenticated | enterprise-logistics | [src/routes/territory.js:11](../../src/routes/territory.js#L11) | `Territory.establishRacket` |
| POST | `/v1/territory/:districtId/fortify` | authenticated | enterprise-logistics | [src/routes/territory.js:21](../../src/routes/territory.js#L21) | `Territory.fortifyRacket` |
| POST | `/v1/territory/:districtId/op` | authenticated | enterprise-logistics | [src/routes/territory.js:30](../../src/routes/territory.js#L30) | `Territory.runTerritoryOp` |
| POST | `/v1/territory/:districtId/raid` | authenticated | enterprise-logistics | [src/routes/territory.js:23](../../src/routes/territory.js#L23) | `Territory.raidRivalRacket` |
| DELETE | `/v1/territory/:districtId/specialist` | authenticated | enterprise-logistics | [src/routes/territory.js:28](../../src/routes/territory.js#L28) | `Territory.unassignSpecialist` |
| POST | `/v1/territory/:districtId/specialist` | authenticated | enterprise-logistics | [src/routes/territory.js:26](../../src/routes/territory.js#L26) | `Territory.assignSpecialist` |
| POST | `/v1/territory/:districtId/upgrade` | authenticated | enterprise-logistics | [src/routes/territory.js:13](../../src/routes/territory.js#L13) | `Territory.upgradeRacket` |
| POST | `/v1/territory/collect` | authenticated | enterprise-logistics | [src/routes/territory.js:15](../../src/routes/territory.js#L15) | `Territory.collectTerritory` |
| POST | `/v1/territory/upkeep` | authenticated | enterprise-logistics | [src/routes/territory.js:18](../../src/routes/territory.js#L18) | `Territory.payTerritoryUpkeep` |
| POST | `/v1/train/:stat` | authenticated | platform-core | [src/server.js:1553](../../src/server.js#L1553) | `G.withCharacter` |
| POST | `/v1/travel/:district` | authenticated | platform-core | [src/server.js:1614](../../src/server.js#L1614) | `G.withCharacter` |
| GET | `/v1/u/:name` | public | platform-core | [src/server.js:716](../../src/server.js#L716) | `Cards.publicDossier` |
| GET | `/v1/underworld` | authenticated | world-progression | [src/routes/underworld.js:10](../../src/routes/underworld.js#L10) | `Underworld.underworldBoard` |
| POST | `/v1/underworld/:npc/errand` | authenticated | world-progression | [src/routes/underworld.js:24](../../src/routes/underworld.js#L24) | `Underworld.startErrand` |
| POST | `/v1/underworld/:npc/favor` | authenticated | world-progression | [src/routes/underworld.js:21](../../src/routes/underworld.js#L21) | `Underworld.claimFavor` |
| POST | `/v1/underworld/:npc/gift` | authenticated | world-progression | [src/routes/underworld.js:16](../../src/routes/underworld.js#L16) | `Underworld.giftNpc` |
| POST | `/v1/underworld/:npc/penance` | authenticated | world-progression | [src/routes/underworld.js:19](../../src/routes/underworld.js#L19) | `Underworld.payPenance` |
| POST | `/v1/underworld/discharge` | authenticated | world-progression | [src/routes/underworld.js:12](../../src/routes/underworld.js#L12) | `Underworld.discharge` |
| POST | `/v1/underworld/gun/:gunId/sell` | authenticated | world-progression | [src/routes/underworld.js:14](../../src/routes/underworld.js#L14) | `Underworld.sellGunBack` |
| POST | `/v1/unstake` | authenticated | economy-ledger | [src/server.js:1679](../../src/server.js#L1679) | `E.unstake` |
| POST | `/v1/vanity/name` | authenticated | engagement-growth | [src/server.js:2731](../../src/server.js#L2731) | `V.changeName` |
| POST | `/v1/vanity/plate/:carId` | authenticated | engagement-growth | [src/server.js:2735](../../src/server.js#L2735) | `V.setPlate` |
| POST | `/v1/vanity/title` | authenticated | engagement-growth | [src/server.js:2733](../../src/server.js#L2733) | `V.setTitle` |
| GET | `/v1/vault` | authenticated | economy-ledger | [src/server.js:2216](../../src/server.js#L2216) | `Treasury.vaultBoard` |
| POST | `/v1/vault/claim` | authenticated | economy-ledger | [src/server.js:2230](../../src/server.js#L2230) | `Treasury.claimVaulted` |
| DELETE | `/v1/vouch/:characterId` | authenticated | social-combat | [src/server.js:3186](../../src/server.js#L3186) | `Vouch.revokeVouch` |
| POST | `/v1/vouch/:characterId` | authenticated | social-combat | [src/server.js:3184](../../src/server.js#L3184) | `Vouch.giveVouch` |
| GET | `/v1/vouches` | authenticated | social-combat | [src/server.js:3182](../../src/server.js#L3182) | `Vouch.vouchBoard` |
| GET | `/v1/wage` | authenticated | economy-ledger | [src/server.js:3260](../../src/server.js#L3260) | `Emission.wageBoard` |
| POST | `/v1/wallet` | authenticated | chain-economy | [src/server.js:3356](../../src/server.js#L3356) | `G.GameError` |
| POST | `/v1/wallet/challenge` | authenticated | chain-economy | [src/server.js:3377](../../src/server.js#L3377) | `Chain.walletChallenge` |
| POST | `/v1/wallet/verify` | authenticated | chain-economy | [src/server.js:3378](../../src/server.js#L3378) | `Chain.walletVerify` |
| GET | `/v1/window` | authenticated | economy-ledger | [src/server.js:1663](../../src/server.js#L1663) | `Exchange.exchangeBoard` |
| POST | `/v1/window/redeem` | authenticated | economy-ledger | [src/server.js:1665](../../src/server.js#L1665) | `Exchange.redeem` |
| GET | `/v1/wire` | authenticated | law-intelligence | [src/server.js:2274](../../src/server.js#L2274) | `Wire.wireBoard` |
| POST | `/v1/wire/dig/:targetId` | authenticated | law-intelligence | [src/server.js:3303](../../src/server.js#L3303) | `Secrets.digSecret` |
| POST | `/v1/wire/disinfo` | authenticated | law-intelligence | [src/server.js:2292](../../src/server.js#L2292) | `Wire.plantDisinfo` |
| POST | `/v1/wire/dossier/:targetId` | authenticated | law-intelligence | [src/server.js:2290](../../src/server.js#L2290) | `Wire.pullDossier` |
| POST | `/v1/wire/informant/:targetId` | authenticated | law-intelligence | [src/server.js:2294](../../src/server.js#L2294) | `Wire.recruitInformant` |
| POST | `/v1/wire/subscribe` | authenticated | law-intelligence | [src/server.js:2280](../../src/server.js#L2280) | `Wire.subscribeWire` |
| POST | `/v1/wire/sweep` | authenticated | law-intelligence | [src/server.js:2278](../../src/server.js#L2278) | `Wire.sweepBugs` |
| POST | `/v1/wire/tap/:targetId` | authenticated | law-intelligence | [src/server.js:2276](../../src/server.js#L2276) | `Wire.placeTap` |
| POST | `/v1/wire/trace` | authenticated | law-intelligence | [src/server.js:2288](../../src/server.js#L2288) | `Wire.traceBugs` |
| DELETE | `/v1/wire/watch/:targetId` | authenticated | law-intelligence | [src/server.js:2285](../../src/server.js#L2285) | `Wire.cancelWatch` |
| POST | `/v1/wire/watch/:targetId` | authenticated | law-intelligence | [src/server.js:2283](../../src/server.js#L2283) | `Wire.enrollWatch` |
| POST | `/v1/withdraw` | authenticated | chain-economy | [src/server.js:3380](../../src/server.js#L3380) | `Chain.requestWithdraw` |
| POST | `/v1/withdraw/:id/cancel` | authenticated | chain-economy | [src/server.js:3384](../../src/server.js#L3384) | `Chain.cancelQueuedWithdraw` |
| GET | `/v1/withdraw/status` | authenticated | chain-economy | [src/server.js:3404](../../src/server.js#L3404) | `Chain.reserveStatus` |
| POST | `/v1/workshop/ammo` | authenticated | economy-ledger | [src/server.js:1630](../../src/server.js#L1630) | `E.craftAmmo` |
| POST | `/v1/workshop/craft/:id` | authenticated | economy-ledger | [src/server.js:1628](../../src/server.js#L1628) | `E.craft` |
| GET | `/v1/world` | authenticated | world-progression | [src/server.js:3562](../../src/server.js#L3562) | `World.worldBoard` |
| POST | `/v1/world/:npcId/invade` | authenticated | world-progression | [src/server.js:3592](../../src/server.js#L3592) | `World.invadeOutpost` |
| POST | `/v1/world/:npcId/plan` | authenticated | world-progression | [src/server.js:3578](../../src/server.js#L3578) | `World.planRaid` |
| POST | `/v1/world/:npcId/raid` | authenticated | world-progression | [src/server.js:3564](../../src/server.js#L3564) | `World.raidNpc` |
| POST | `/v1/world/:npcId/reinforce` | authenticated | world-progression | [src/server.js:3595](../../src/server.js#L3595) | `World.reinforceOutpost` |
| POST | `/v1/world/collect` | authenticated | world-progression | [src/server.js:3590](../../src/server.js#L3590) | `World.collectFrontier` |
| GET | `/v1/world/raids` | authenticated | world-progression | [src/server.js:3576](../../src/server.js#L3576) | `World.raidBoard` |
| POST | `/v1/world/raids/:id/dismiss` | authenticated | world-progression | [src/server.js:3584](../../src/server.js#L3584) | `World.dismissGun` |
| POST | `/v1/world/raids/:id/go` | authenticated | world-progression | [src/server.js:3588](../../src/server.js#L3588) | `World.executeRaid` |
| POST | `/v1/world/raids/:id/hire` | authenticated | world-progression | [src/server.js:3582](../../src/server.js#L3582) | `World.hireRaid` |
| POST | `/v1/world/raids/:id/join` | authenticated | world-progression | [src/server.js:3580](../../src/server.js#L3580) | `World.joinRaid` |
| POST | `/v1/world/raids/:id/leave` | authenticated | world-progression | [src/server.js:3586](../../src/server.js#L3586) | `World.leaveRaid` |
| GET | `/v1/worldgraph/inventory` | authenticated | world-graph | [src/routes/worldgraph.js:471](../../src/routes/worldgraph.js#L471) | — |
| POST | `/v1/worldgraph/items/:itemId/assign-current-character` | authenticated | world-graph | [src/routes/worldgraph.js:463](../../src/routes/worldgraph.js#L463) | — |
| GET | `/v1/worldgraph/kernel/recipes` | authenticated | platform-core | [src/routes/world-kernel.js:79](../../src/routes/world-kernel.js#L79) | — |
| POST | `/v1/worldgraph/kernel/recipes/:recipeId/craft` | authenticated | world-graph | [src/routes/world-kernel.js:81](../../src/routes/world-kernel.js#L81) | `withItemTransaction` |
| GET | `/v1/worldgraph/mysteries` | authenticated | world-graph | [src/routes/worldgraph.js:500](../../src/routes/worldgraph.js#L500) | — |
| GET | `/v1/worldgraph/mysteries/:graphId` | authenticated | world-graph | [src/routes/worldgraph.js:516](../../src/routes/worldgraph.js#L516) | — |
| POST | `/v1/worldgraph/mysteries/:graphId/cancel` | authenticated | world-graph | [src/routes/worldgraph.js:560](../../src/routes/worldgraph.js#L560) | — |
| POST | `/v1/worldgraph/mysteries/:graphId/choices/:nodeId` | authenticated | world-graph | [src/routes/worldgraph.js:549](../../src/routes/worldgraph.js#L549) | — |
| POST | `/v1/worldgraph/mysteries/:graphId/nodes/:nodeId/complete` | authenticated | world-graph | [src/routes/worldgraph.js:539](../../src/routes/worldgraph.js#L539) | — |
| POST | `/v1/worldgraph/mysteries/:graphId/nodes/:nodeId/discover` | authenticated | world-graph | [src/routes/worldgraph.js:529](../../src/routes/worldgraph.js#L529) | — |
| POST | `/v1/worldgraph/mysteries/:graphId/start` | authenticated | world-graph | [src/routes/worldgraph.js:505](../../src/routes/worldgraph.js#L505) | — |
| GET | `/v1/worldgraph/objects` | authenticated | platform-core | [src/routes/world-kernel.js:75](../../src/routes/world-kernel.js#L75) | — |
| GET | `/v1/worldgraph/objects/:objectId` | authenticated | platform-core | [src/routes/world-kernel.js:76](../../src/routes/world-kernel.js#L76) | — |
| POST | `/v1/worldgraph/objects/:objectId/actions/:actionId` | authenticated | platform-core | [src/routes/world-kernel.js:77](../../src/routes/world-kernel.js#L77) | — |
| GET | `/v1/worldgraph/operations` | authenticated | world-graph | [src/routes/worldgraph.js:572](../../src/routes/worldgraph.js#L572) | — |
| POST | `/v1/worldgraph/operations/:graphId/:operationNodeId/open` | authenticated | world-graph | [src/routes/worldgraph.js:577](../../src/routes/worldgraph.js#L577) | — |
| GET | `/v1/worldgraph/operations/:operationId` | authenticated | world-graph | [src/routes/worldgraph.js:588](../../src/routes/worldgraph.js#L588) | — |
| POST | `/v1/worldgraph/operations/:operationId/cancel` | authenticated | world-graph | [src/routes/worldgraph.js:623](../../src/routes/worldgraph.js#L623) | — |
| POST | `/v1/worldgraph/operations/:operationId/complete` | authenticated | world-graph | [src/routes/worldgraph.js:617](../../src/routes/worldgraph.js#L617) | — |
| POST | `/v1/worldgraph/operations/:operationId/contributions/:nodeId` | authenticated | world-graph | [src/routes/worldgraph.js:610](../../src/routes/worldgraph.js#L610) | — |
| GET | `/v1/worldgraph/operations/:operationId/role` | authenticated | world-graph | [src/routes/worldgraph.js:596](../../src/routes/worldgraph.js#L596) | — |
| POST | `/v1/worldgraph/operations/:operationId/roles/:roleId` | authenticated | world-graph | [src/routes/worldgraph.js:604](../../src/routes/worldgraph.js#L604) | — |
| GET | `/v1/worldgraph/recipes` | authenticated | world-graph | [src/routes/worldgraph.js:476](../../src/routes/worldgraph.js#L476) | — |
| POST | `/v1/worldgraph/recipes/:recipeId/craft` | authenticated | world-graph | [src/routes/worldgraph.js:486](../../src/routes/worldgraph.js#L486) | — |
| POST | `/v1/worldgraph/recipes/:recipeId/salvage/:carId` | authenticated | world-graph | [src/routes/worldgraph.js:493](../../src/routes/worldgraph.js#L493) | — |
| GET | `/v1/worldgraph/state` | authenticated | platform-core | [src/routes/world-kernel.js:74](../../src/routes/world-kernel.js#L74) | — |
| GET | `/v1/ws` | token-query | platform-core | [src/server.js:2800](../../src/server.js#L2800) | — |
| GET | `/v1/yield` | public | economy-ledger | [src/server.js:1667](../../src/server.js#L1667) | `Exchange.yieldBoard` |
| GET | `/wiki` | public | client-experience | [src/server.js:490](../../src/server.js#L490) | `servePage` |
