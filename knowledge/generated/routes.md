# Generated HTTP route catalog

> 762 literal registrations extracted from `src/server.js` and `src/routes/`. Runtime authority remains `GET /openapi.json`.

## Route groups

| Group | Routes |
|---|---:|
| mod | 72 |
| leaderboard | 46 |
| casino | 28 |
| web | 26 |
| gangs | 22 |
| worldgraph | 20 |
| pen | 19 |
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
| made | 2 |
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
| GET | `/` | public | client-experience | [src/server.js:425](../../src/server.js#L425) | `servePage` |
| GET | `/admin` | public | client-experience | [src/server.js:431](../../src/server.js#L431) | `servePage` |
| GET | `/agents` | public | client-experience | [src/server.js:695](../../src/server.js#L695) | — |
| GET | `/AGENTS.md` | public | client-experience | [src/server.js:696](../../src/server.js#L696) | — |
| GET | `/arena` | public | client-experience | [src/server.js:441](../../src/server.js#L441) | `servePage` |
| GET | `/art/:file` | public | client-experience | [src/server.js:544](../../src/server.js#L544) | `sendVideo` |
| GET | `/art/hype/:file` | public | client-experience | [src/server.js:550](../../src/server.js#L550) | `sendVideo` |
| GET | `/beef/:a/:b` | public | client-experience | [src/server.js:685](../../src/server.js#L685) | `Cards.beefDossier` |
| GET | `/card/:type/:name` | public | client-experience | [src/server.js:649](../../src/server.js#L649) | `Cards.publicDossier` |
| GET | `/card/beef/:a/:b` | public | client-experience | [src/server.js:665](../../src/server.js#L665) | `Cards.beefDossier` |
| GET | `/deed/:tokenId` | public | client-experience | [src/server.js:634](../../src/server.js#L634) | `Deeds.deedByToken` |
| GET | `/favicon.ico` | public | client-experience | [src/server.js:490](../../src/server.js#L490) | — |
| GET | `/health` | public | client-experience | [src/server.js:868](../../src/server.js#L868) | — |
| GET | `/llms.txt` | public | client-experience | [src/server.js:697](../../src/server.js#L697) | — |
| GET | `/manifest.json` | public | client-experience | [src/server.js:475](../../src/server.js#L475) | — |
| GET | `/manifest.webmanifest` | public | client-experience | [src/server.js:476](../../src/server.js#L476) | — |
| GET | `/omerta-ui.css` | public | client-experience | [src/server.js:463](../../src/server.js#L463) | — |
| GET | `/openapi.json` | public | client-experience | [src/server.js:713](../../src/server.js#L713) | — |
| GET | `/path` | public | client-experience | [src/server.js:450](../../src/server.js#L450) | `servePage` |
| GET | `/path/:id` | public | client-experience | [src/server.js:452](../../src/server.js#L452) | — |
| GET | `/play` | public | client-experience | [src/server.js:446](../../src/server.js#L446) | `servePage` |
| GET | `/robots.txt` | public | client-experience | [src/server.js:701](../../src/server.js#L701) | — |
| GET | `/sitemap.xml` | public | client-experience | [src/server.js:706](../../src/server.js#L706) | — |
| GET | `/sw.js` | public | client-experience | [src/server.js:468](../../src/server.js#L468) | — |
| GET | `/u/:name` | public | client-experience | [src/server.js:679](../../src/server.js#L679) | `Cards.publicDossier` |
| POST | `/v1/agent/act` | authenticated | platform-core | [src/server.js:2480](../../src/server.js#L2480) | `executeAgentAction` |
| GET | `/v1/agent/turn` | authenticated | platform-core | [src/server.js:2421](../../src/server.js#L2421) | `readAgentTurn` |
| GET | `/v1/arena` | public | engagement-growth | [src/server.js:2532](../../src/server.js#L2532) | `arenaBoard` |
| POST | `/v1/armory/ammo` | authenticated | economy-ledger | [src/server.js:1557](../../src/server.js#L1557) | `E.buyAmmo` |
| POST | `/v1/armory/gun/:id/buy` | authenticated | economy-ledger | [src/server.js:1549](../../src/server.js#L1549) | `E.buyGun` |
| POST | `/v1/armory/gun/:id/equip` | authenticated | economy-ledger | [src/server.js:1551](../../src/server.js#L1551) | `E.equipGun` |
| POST | `/v1/armory/unequip` | authenticated | economy-ledger | [src/server.js:1553](../../src/server.js#L1553) | `E.equipGun` |
| POST | `/v1/armory/vest/:id` | authenticated | economy-ledger | [src/server.js:1555](../../src/server.js#L1555) | `E.buyVest` |
| GET | `/v1/art/:kind/:id` | public | platform-core | [src/server.js:566](../../src/server.js#L566) | — |
| GET | `/v1/art/motion` | public | platform-core | [src/server.js:555](../../src/server.js#L555) | — |
| POST | `/v1/assets/:id/buy` | authenticated | economy-ledger | [src/server.js:1502](../../src/server.js#L1502) | `E.buyAsset` |
| POST | `/v1/assets/:id/sell` | authenticated | economy-ledger | [src/server.js:1504](../../src/server.js#L1504) | `E.sellAsset` |
| GET | `/v1/auction` | authenticated | platform-core | [src/server.js:2097](../../src/server.js#L2097) | `Auction.auctionBoard` |
| POST | `/v1/auction/:lotId/bid` | authenticated | platform-core | [src/server.js:2099](../../src/server.js#L2099) | `Auction.bidAuction` |
| POST | `/v1/auction/consign` | authenticated | platform-core | [src/server.js:2102](../../src/server.js#L2102) | `Auction.consignTrophy` |
| POST | `/v1/auction/consign/:id/bid` | authenticated | platform-core | [src/server.js:2104](../../src/server.js#L2104) | `Auction.bidConsignment` |
| POST | `/v1/auction/consign/:id/cancel` | authenticated | platform-core | [src/server.js:2106](../../src/server.js#L2106) | `Auction.reclaimConsignment` |
| POST | `/v1/auth/agent-key` | authenticated | platform-core | [src/server.js:1294](../../src/server.js#L1294) | `A.acknowledgeGuestBootstrap` |
| POST | `/v1/auth/guest` | public | platform-core | [src/server.js:1195](../../src/server.js#L1195) | `A.accountForGuestBootstrap` |
| POST | `/v1/auth/guest/bootstrap/ack` | authenticated | platform-core | [src/server.js:1210](../../src/server.js#L1210) | `A.acknowledgeGuestBootstrap` |
| POST | `/v1/auth/logout-all` | authenticated | platform-core | [src/server.js:1304](../../src/server.js#L1304) | — |
| POST | `/v1/auth/privy` | public | platform-core | [src/server.js:1220](../../src/server.js#L1220) | `providerLogin` |
| POST | `/v1/auth/upgrade` | authenticated | platform-core | [src/server.js:1285](../../src/server.js#L1285) | `A.upgradeAccount` |
| POST | `/v1/auth/x` | public | platform-core | [src/server.js:1219](../../src/server.js#L1219) | `providerLogin` |
| GET | `/v1/auth/x/callback` | public | platform-core | [src/server.js:1262](../../src/server.js#L1262) | `A.xOAuthCallback` |
| POST | `/v1/auth/x/start` | public | platform-core | [src/server.js:1230](../../src/server.js#L1230) | `A.upgradeAccount` |
| GET | `/v1/avatar/:seed` | public | platform-core | [src/server.js:581](../../src/server.js#L581) | — |
| GET | `/v1/bank` | authenticated | platform-core | [src/server.js:2077](../../src/server.js#L2077) | `Bank.bankBoard` |
| POST | `/v1/bank/:dir` | authenticated | platform-core | [src/server.js:1470](../../src/server.js#L1470) | `G.withCharacter` |
| GET | `/v1/block` | authenticated | social-combat | [src/server.js:2303](../../src/server.js#L2303) | `Block.streetsBoard` |
| GET | `/v1/bloodline` | authenticated | platform-core | [src/server.js:3113](../../src/server.js#L3113) | `Bloodline.bloodlineBoard` |
| POST | `/v1/bodyguard/hire/:guardId` | authenticated | social-combat | [src/server.js:2580](../../src/server.js#L2580) | `S.hireBodyguard` |
| POST | `/v1/bodyguard/offer` | authenticated | social-combat | [src/server.js:2578](../../src/server.js#L2578) | `S.offerBodyguard` |
| POST | `/v1/bond/calldata` | authenticated | chain-economy | [src/server.js:3214](../../src/server.js#L3214) | `Chain.bondCalldata` |
| POST | `/v1/bond/quote` | authenticated | chain-economy | [src/server.js:3211](../../src/server.js#L3211) | `Chain.quoteBond` |
| GET | `/v1/bonds` | authenticated | platform-core | [src/server.js:3203](../../src/server.js#L3203) | `Bonds.bondBoard` |
| POST | `/v1/bonds/:id/claim` | authenticated | platform-core | [src/server.js:3204](../../src/server.js#L3204) | `Bonds.claimBond` |
| POST | `/v1/bonds/charter` | authenticated | platform-core | [src/server.js:3209](../../src/server.js#L3209) | `Bonds.commissionCharter` |
| POST | `/v1/bonds/pledge` | authenticated | platform-core | [src/server.js:3207](../../src/server.js#L3207) | `Bonds.pledgeTreasury` |
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
| POST | `/v1/broadcast/shared` | authenticated | platform-core | [src/server.js:1439](../../src/server.js#L1439) | `G.track` |
| GET | `/v1/brokers` | authenticated | platform-core | [src/server.js:2118](../../src/server.js#L2118) | `Brokers.brokerBoard` |
| POST | `/v1/brokers/activate` | authenticated | platform-core | [src/server.js:2120](../../src/server.js#L2120) | `Brokers.activate` |
| GET | `/v1/bulletin` | authenticated | engagement-growth | [src/server.js:3367](../../src/server.js#L3367) | `bulletinBoard` |
| POST | `/v1/bulletin/claim` | authenticated | platform-core | [src/server.js:3372](../../src/server.js#L3372) | `G.withCharacter` |
| GET | `/v1/business` | authenticated | enterprise-logistics | [src/server.js:1942](../../src/server.js#L1942) | `Business.businessesOf` |
| DELETE | `/v1/business/:id` | authenticated | enterprise-logistics | [src/server.js:1914](../../src/server.js#L1914) | `Business.shutterBusiness` |
| POST | `/v1/business/:id/launder` | authenticated | enterprise-logistics | [src/server.js:1916](../../src/server.js#L1916) | `Business.launderAtBusiness` |
| POST | `/v1/business/:id/rob` | authenticated | enterprise-logistics | [src/server.js:1927](../../src/server.js#L1927) | `Business.robBusiness` |
| POST | `/v1/business/:id/shakedown` | authenticated | enterprise-logistics | [src/server.js:1920](../../src/server.js#L1920) | `Business.shakedownBusiness` |
| POST | `/v1/business/:id/specialize` | authenticated | enterprise-logistics | [src/server.js:1934](../../src/server.js#L1934) | `Business.specializeBusiness` |
| POST | `/v1/business/:id/takeover` | authenticated | enterprise-logistics | [src/server.js:1936](../../src/server.js#L1936) | `Business.takeoverBusiness` |
| POST | `/v1/business/:id/upgrade` | authenticated | enterprise-logistics | [src/server.js:1909](../../src/server.js#L1909) | `Business.upgradeBusiness` |
| POST | `/v1/business/:kind/buy` | authenticated | enterprise-logistics | [src/server.js:1901](../../src/server.js#L1901) | `Business.buyBusiness` |
| POST | `/v1/business/collect` | authenticated | enterprise-logistics | [src/server.js:1903](../../src/server.js#L1903) | `Business.collectBusiness` |
| POST | `/v1/business/upkeep` | authenticated | enterprise-logistics | [src/server.js:1907](../../src/server.js#L1907) | `Business.payBusinessUpkeep` |
| POST | `/v1/call/fulfill` | authenticated | engagement-growth | [src/server.js:2890](../../src/server.js#L2890) | `Contacts.fulfillCall` |
| GET | `/v1/campaigns` | authenticated | platform-core | [src/server.js:3105](../../src/server.js#L3105) | `Campaigns.campaignBoard` |
| POST | `/v1/campaigns/:id/choose` | authenticated | platform-core | [src/server.js:3109](../../src/server.js#L3109) | `Campaigns.chooseCampaign` |
| POST | `/v1/campaigns/:id/claim` | authenticated | platform-core | [src/server.js:3111](../../src/server.js#L3111) | `Campaigns.claimCampaign` |
| POST | `/v1/campaigns/:id/start` | authenticated | platform-core | [src/server.js:3107](../../src/server.js#L3107) | `Campaigns.startCampaign` |
| GET | `/v1/capo` | authenticated | engagement-growth | [src/routes/leaderboards.js:88](../../src/routes/leaderboards.js#L88) | `W.capoBoard` |
| GET | `/v1/career` | authenticated | engagement-growth | [src/server.js:3085](../../src/server.js#L3085) | `Career.careerBoard` |
| POST | `/v1/career/:taskId` | authenticated | engagement-growth | [src/server.js:3087](../../src/server.js#L3087) | `Career.claimCareer` |
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
| GET | `/v1/catalog` | public | enterprise-logistics | [src/server.js:1622](../../src/server.js#L1622) | `Business.catalog` |
| POST | `/v1/character` | authenticated | platform-core | [src/server.js:1318](../../src/server.js#L1318) | `Store.claimPendingWire` |
| POST | `/v1/character/forge` | authenticated | chain-economy | [src/server.js:3265](../../src/server.js#L3265) | `Forge.forgeCharacter` |
| POST | `/v1/character/mint` | authenticated | economy-ledger | [src/server.js:3256](../../src/server.js#L3256) | `Fees.mintCharacter` |
| POST | `/v1/character/reroll` | authenticated | economy-ledger | [src/server.js:3259](../../src/server.js#L3259) | `Fees.rerollCharacter` |
| GET | `/v1/chat` | authenticated | platform-core | [src/server.js:2866](../../src/server.js#L2866) | `readChat` |
| POST | `/v1/chat` | authenticated | platform-core | [src/server.js:2865](../../src/server.js#L2865) | `postChat` |
| POST | `/v1/checkin` | authenticated | platform-core | [src/server.js:1435](../../src/server.js#L1435) | `G.withCharacter` |
| GET | `/v1/circle` | authenticated | engagement-growth | [src/server.js:2997](../../src/server.js#L2997) | `Circle.circleBoard` |
| GET | `/v1/city` | public | platform-core | [src/server.js:3322](../../src/server.js#L3322) | — |
| GET | `/v1/citywide` | authenticated | world-progression | [src/server.js:2307](../../src/server.js#L2307) | `Citywide.citywideBoard` |
| POST | `/v1/claim-rewards` | authenticated | economy-ledger | [src/server.js:1543](../../src/server.js#L1543) | `E.claimRewards` |
| GET | `/v1/clues` | authenticated | platform-core | [src/server.js:3398](../../src/server.js#L3398) | `Clues.clueBoard` |
| POST | `/v1/clues/dig` | authenticated | platform-core | [src/server.js:3400](../../src/server.js#L3400) | `Clues.dig` |
| GET | `/v1/collection` | authenticated | law-intelligence | [src/server.js:3172](../../src/server.js#L3172) | `Collection.collectionBoard` |
| GET | `/v1/commission` | public | platform-core | [src/server.js:1958](../../src/server.js#L1958) | `Commission.commissionBoard` |
| POST | `/v1/commission/override` | authenticated | platform-core | [src/server.js:1967](../../src/server.js#L1967) | `Commission.overrideVeto` |
| POST | `/v1/commission/propose` | authenticated | platform-core | [src/server.js:1964](../../src/server.js#L1964) | `Commission.proposeDecree` |
| GET | `/v1/commission/ticker` | public | platform-core | [src/server.js:1972](../../src/server.js#L1972) | `Commission.tickerBallotBoard` |
| POST | `/v1/commission/ticker` | authenticated | platform-core | [src/server.js:1973](../../src/server.js#L1973) | `Commission.castTickerVote` |
| POST | `/v1/commission/veto` | authenticated | platform-core | [src/server.js:1961](../../src/server.js#L1961) | `Commission.vetoDecree` |
| POST | `/v1/commission/vote` | authenticated | platform-core | [src/server.js:1959](../../src/server.js#L1959) | `Commission.castVote` |
| GET | `/v1/contacts` | authenticated | engagement-growth | [src/server.js:2884](../../src/server.js#L2884) | `Contacts.contactsBoard` |
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
| GET | `/v1/contracts` | authenticated | social-combat | [src/server.js:2399](../../src/server.js#L2399) | `S.listContracts` |
| POST | `/v1/contracts/:targetId/:kind/cancel` | authenticated | social-combat | [src/server.js:2403](../../src/server.js#L2403) | `S.cancelBounty` |
| POST | `/v1/contracts/peek` | authenticated | social-combat | [src/server.js:2401](../../src/server.js#L2401) | `S.peekContracts` |
| POST | `/v1/convoy` | authenticated | enterprise-logistics | [src/routes/convoy.js:9](../../src/routes/convoy.js#L9) | `Convoy.openConvoy` |
| POST | `/v1/convoy/:id/ambush` | authenticated | enterprise-logistics | [src/routes/convoy.js:17](../../src/routes/convoy.js#L17) | `Convoy.ambushConvoy` |
| POST | `/v1/convoy/:id/collect` | authenticated | enterprise-logistics | [src/routes/convoy.js:19](../../src/routes/convoy.js#L19) | `Convoy.collectConvoy` |
| POST | `/v1/convoy/cancel` | authenticated | enterprise-logistics | [src/routes/convoy.js:15](../../src/routes/convoy.js#L15) | `Convoy.cancelConvoy` |
| POST | `/v1/convoy/depart` | authenticated | enterprise-logistics | [src/routes/convoy.js:13](../../src/routes/convoy.js#L13) | `Convoy.departConvoy` |
| POST | `/v1/convoy/load` | authenticated | enterprise-logistics | [src/routes/convoy.js:11](../../src/routes/convoy.js#L11) | `Convoy.loadConvoy` |
| POST | `/v1/convoy/rig/:kind` | authenticated | enterprise-logistics | [src/routes/convoy.js:22](../../src/routes/convoy.js#L22) | `Convoy.buyRig` |
| POST | `/v1/convoy/rig/upgrade` | authenticated | enterprise-logistics | [src/routes/convoy.js:24](../../src/routes/convoy.js#L24) | `Convoy.upgradeRig` |
| GET | `/v1/convoys` | authenticated | enterprise-logistics | [src/server.js:2169](../../src/server.js#L2169) | `Convoy.convoyBoard` |
| GET | `/v1/corner` | authenticated | platform-core | [src/server.js:1427](../../src/server.js#L1427) | `Corner.cornerBoard` |
| POST | `/v1/corner/:slot/accept` | authenticated | platform-core | [src/server.js:1429](../../src/server.js#L1429) | `Corner.acceptCorner` |
| POST | `/v1/corner/:slot/claim` | authenticated | platform-core | [src/server.js:1431](../../src/server.js#L1431) | `Corner.claimCorner` |
| GET | `/v1/crew` | authenticated | social-combat | [src/server.js:2912](../../src/server.js#L2912) | `Crew.crewBoard` |
| POST | `/v1/crew` | authenticated | social-combat | [src/server.js:2914](../../src/server.js#L2914) | `Crew.createCrew` |
| POST | `/v1/crew/accept/:crewId` | authenticated | social-combat | [src/server.js:2918](../../src/server.js#L2918) | `Crew.acceptInvite` |
| GET | `/v1/crew/chat` | authenticated | platform-core | [src/server.js:2870](../../src/server.js#L2870) | `readChat` |
| POST | `/v1/crew/chat` | authenticated | platform-core | [src/server.js:2869](../../src/server.js#L2869) | `postChat` |
| POST | `/v1/crew/decline/:crewId` | authenticated | social-combat | [src/server.js:2920](../../src/server.js#L2920) | `Crew.declineInvite` |
| POST | `/v1/crew/invite` | authenticated | social-combat | [src/server.js:2916](../../src/server.js#L2916) | `Crew.inviteToCrew` |
| POST | `/v1/crew/leave` | authenticated | social-combat | [src/server.js:2922](../../src/server.js#L2922) | `Crew.leaveCrew` |
| DELETE | `/v1/crew/member/:characterId` | authenticated | social-combat | [src/server.js:2925](../../src/server.js#L2925) | `Crew.kickMember` |
| POST | `/v1/crew/objective/claim` | authenticated | social-combat | [src/server.js:2951](../../src/server.js#L2951) | `Crew.claimObjective` |
| POST | `/v1/crew/recruiting` | authenticated | social-combat | [src/server.js:2937](../../src/server.js#L2937) | `Crew.setRecruiting` |
| DELETE | `/v1/crew/request/:characterId` | authenticated | social-combat | [src/server.js:2947](../../src/server.js#L2947) | `Crew.declineRequest` |
| POST | `/v1/crew/request/:characterId/accept` | authenticated | social-combat | [src/server.js:2943](../../src/server.js#L2943) | `Crew.acceptRequest` |
| POST | `/v1/crew/request/:crewId` | authenticated | social-combat | [src/server.js:2941](../../src/server.js#L2941) | `Crew.requestJoin` |
| DELETE | `/v1/crew/target` | authenticated | social-combat | [src/server.js:2933](../../src/server.js#L2933) | `Crew.clearCrewTarget` |
| POST | `/v1/crew/target` | authenticated | social-combat | [src/server.js:2931](../../src/server.js#L2931) | `Crew.setCrewTarget` |
| POST | `/v1/crimes/:id` | authenticated | platform-core | [src/server.js:1409](../../src/server.js#L1409) | `G.withCharacter` |
| GET | `/v1/daily` | authenticated | engagement-growth | [src/server.js:3075](../../src/server.js#L3075) | `W.getDaily` |
| POST | `/v1/daily/:id/claim` | authenticated | engagement-growth | [src/server.js:3080](../../src/server.js#L3080) | `W.claimDaily` |
| GET | `/v1/day` | authenticated | world-progression | [src/server.js:2281](../../src/server.js#L2281) | `Day.dayBoard` |
| GET | `/v1/deeds` | authenticated | enterprise-logistics | [src/routes/deeds.js:9](../../src/routes/deeds.js#L9) | `Deeds.deedBoard` |
| POST | `/v1/deeds/buy/:sellerCharacterId` | authenticated | enterprise-logistics | [src/routes/deeds.js:25](../../src/routes/deeds.js#L25) | `Deeds.buyDeed` |
| POST | `/v1/deeds/claim` | authenticated | enterprise-logistics | [src/routes/deeds.js:11](../../src/routes/deeds.js#L11) | `Deeds.claimDeed` |
| POST | `/v1/deeds/corner` | authenticated | enterprise-logistics | [src/routes/deeds.js:15](../../src/routes/deeds.js#L15) | `Deeds.collectCorner` |
| POST | `/v1/deeds/extract` | authenticated | chain-economy | [src/server.js:3236](../../src/server.js#L3236) | `Chain.requestDeedWithdraw` |
| POST | `/v1/deeds/list` | authenticated | enterprise-logistics | [src/routes/deeds.js:21](../../src/routes/deeds.js#L21) | `Deeds.listDeed` |
| GET | `/v1/deeds/plate/:tokenId` | public | enterprise-logistics | [src/server.js:626](../../src/server.js#L626) | `Deeds.deedByToken` |
| POST | `/v1/deeds/shakedown/:targetCharacterId` | authenticated | enterprise-logistics | [src/routes/deeds.js:17](../../src/routes/deeds.js#L17) | `Deeds.shakedownCorner` |
| POST | `/v1/deeds/unlist` | authenticated | enterprise-logistics | [src/routes/deeds.js:23](../../src/routes/deeds.js#L23) | `Deeds.unlistDeed` |
| GET | `/v1/deeds/vault/:sellerCharacterId` | authenticated | enterprise-logistics | [src/routes/deeds.js:33](../../src/routes/deeds.js#L33) | `Deeds.deedVaultRecord` |
| GET | `/v1/desk` | public | platform-core | [src/server.js:1526](../../src/server.js#L1526) | `Desk.deskBoard` |
| GET | `/v1/digest` | authenticated | engagement-growth | [src/server.js:3037](../../src/server.js#L3037) | `Dispatch.getDigestPrefs` |
| POST | `/v1/digest` | authenticated | engagement-growth | [src/server.js:3038](../../src/server.js#L3038) | `Dispatch.setDigestPrefs` |
| GET | `/v1/digest/confirm` | public | engagement-growth | [src/server.js:3042](../../src/server.js#L3042) | `Dispatch.confirmEmail` |
| GET | `/v1/digest/unsubscribe` | public | engagement-growth | [src/server.js:3052](../../src/server.js#L3052) | `Dispatch.unsubscribe` |
| GET | `/v1/diplomacy` | authenticated | platform-core | [src/routes/diplomacy.js:10](../../src/routes/diplomacy.js#L10) | `Diplomacy.diplomacyBoard` |
| POST | `/v1/diplomacy/coalition/:gangId` | authenticated | platform-core | [src/routes/diplomacy.js:18](../../src/routes/diplomacy.js#L18) | `Diplomacy.formCoalition` |
| DELETE | `/v1/diplomacy/coalition/:id` | authenticated | platform-core | [src/routes/diplomacy.js:22](../../src/routes/diplomacy.js#L22) | `Diplomacy.leaveCoalition` |
| POST | `/v1/diplomacy/coalition/:id/join` | authenticated | platform-core | [src/routes/diplomacy.js:20](../../src/routes/diplomacy.js#L20) | `Diplomacy.joinCoalition` |
| DELETE | `/v1/diplomacy/pact/:gangId` | authenticated | platform-core | [src/routes/diplomacy.js:16](../../src/routes/diplomacy.js#L16) | `Diplomacy.breakPact` |
| POST | `/v1/diplomacy/pact/:gangId` | authenticated | platform-core | [src/routes/diplomacy.js:12](../../src/routes/diplomacy.js#L12) | `Diplomacy.proposePact` |
| POST | `/v1/diplomacy/pact/:gangId/accept` | authenticated | platform-core | [src/routes/diplomacy.js:14](../../src/routes/diplomacy.js#L14) | `Diplomacy.acceptPact` |
| GET | `/v1/discovery` | authenticated | engagement-growth | [src/server.js:2956](../../src/server.js#L2956) | `Discovery.discoveryBoard` |
| POST | `/v1/discovery/lfg` | authenticated | engagement-growth | [src/server.js:2961](../../src/server.js#L2961) | `Discovery.setLfg` |
| GET | `/v1/districts` | public | social-combat | [src/server.js:2233](../../src/server.js#L2233) | `S.onWatch` |
| POST | `/v1/districts/:id/claim` | authenticated | social-combat | [src/server.js:1615](../../src/server.js#L1615) | `S.stakeClaim` |
| POST | `/v1/districts/:id/seize` | authenticated | social-combat | [src/server.js:1601](../../src/server.js#L1601) | `S.seizeDistrict` |
| POST | `/v1/districts/:id/watch` | authenticated | social-combat | [src/server.js:1604](../../src/server.js#L1604) | `S.setWatch` |
| GET | `/v1/drop` | authenticated | engagement-growth | [src/server.js:2313](../../src/server.js#L2313) | `Drop.dropBoard` |
| POST | `/v1/drop/claim` | authenticated | engagement-growth | [src/server.js:2315](../../src/server.js#L2315) | `Drop.claimDrop` |
| POST | `/v1/drop/solana` | authenticated | engagement-growth | [src/server.js:2322](../../src/server.js#L2322) | `Drop.claimDropSolana` |
| POST | `/v1/drop/solana/challenge` | authenticated | engagement-growth | [src/server.js:2320](../../src/server.js#L2320) | `Drop.solanaChallenge` |
| GET | `/v1/duels` | authenticated | social-combat | [src/server.js:3387](../../src/server.js#L3387) | `Duels.duelBoard` |
| POST | `/v1/duels/:targetId` | authenticated | social-combat | [src/server.js:3393](../../src/server.js#L3393) | `Duels.challenge` |
| POST | `/v1/duels/list` | authenticated | social-combat | [src/server.js:3389](../../src/server.js#L3389) | `Duels.listDuel` |
| POST | `/v1/duels/style` | authenticated | social-combat | [src/server.js:3391](../../src/server.js#L3391) | `Duels.pickStyle` |
| GET | `/v1/dynasty` | authenticated | chain-economy | [src/server.js:3115](../../src/server.js#L3115) | `Dynasty.dynastyBoard` |
| POST | `/v1/dynasty/accept/:accountId` | authenticated | chain-economy | [src/server.js:3119](../../src/server.js#L3119) | `Dynasty.acceptMarriage` |
| DELETE | `/v1/dynasty/consigliere` | authenticated | chain-economy | [src/server.js:3127](../../src/server.js#L3127) | `Dynasty.endConsigliere` |
| POST | `/v1/dynasty/consigliere/:characterId` | authenticated | chain-economy | [src/server.js:3123](../../src/server.js#L3123) | `Dynasty.nameConsigliere` |
| POST | `/v1/dynasty/consigliere/accept/:accountId` | authenticated | chain-economy | [src/server.js:3125](../../src/server.js#L3125) | `Dynasty.acceptConsigliere` |
| POST | `/v1/dynasty/divorce` | authenticated | chain-economy | [src/server.js:3121](../../src/server.js#L3121) | `Dynasty.divorceMarriage` |
| POST | `/v1/dynasty/name` | authenticated | economy-ledger | [src/server.js:2087](../../src/server.js#L2087) | `Portfolio.nameDynasty` |
| POST | `/v1/dynasty/propose/:characterId` | authenticated | chain-economy | [src/server.js:3117](../../src/server.js#L3117) | `Dynasty.proposeMarriage` |
| GET | `/v1/estate` | authenticated | enterprise-logistics | [src/routes/estate.js:18](../../src/routes/estate.js#L18) | `Estate.estateBoard` |
| POST | `/v1/estate/feature/:id` | authenticated | enterprise-logistics | [src/routes/estate.js:22](../../src/routes/estate.js#L22) | `Estate.unlockFeature` |
| POST | `/v1/estate/gala` | authenticated | enterprise-logistics | [src/routes/estate.js:33](../../src/routes/estate.js#L33) | `Estate.throwGala` |
| POST | `/v1/estate/gala/attend` | authenticated | enterprise-logistics | [src/routes/estate.js:35](../../src/routes/estate.js#L35) | `Estate.attendGala` |
| POST | `/v1/estate/name` | authenticated | enterprise-logistics | [src/routes/estate.js:24](../../src/routes/estate.js#L24) | `Estate.nameEstate` |
| DELETE | `/v1/estate/staff/:id` | authenticated | enterprise-logistics | [src/routes/estate.js:29](../../src/routes/estate.js#L29) | `Estate.dismissStaff` |
| POST | `/v1/estate/staff/:id` | authenticated | enterprise-logistics | [src/routes/estate.js:27](../../src/routes/estate.js#L27) | `Estate.hireStaff` |
| POST | `/v1/estate/upgrade` | authenticated | enterprise-logistics | [src/routes/estate.js:20](../../src/routes/estate.js#L20) | `Estate.upgradeEstate` |
| POST | `/v1/estate/wages` | authenticated | enterprise-logistics | [src/routes/estate.js:31](../../src/routes/estate.js#L31) | `Estate.payStaffWages` |
| GET | `/v1/events` | public | world-progression | [src/server.js:2966](../../src/server.js#L2966) | `cityEventBoard` |
| GET | `/v1/exchange` | public | platform-core | [src/server.js:2612](../../src/server.js#L2612) | — |
| DELETE | `/v1/exchange/:id` | authenticated | social-combat | [src/server.js:2619](../../src/server.js#L2619) | `S.cancelListing` |
| POST | `/v1/exchange/:id/buy` | authenticated | social-combat | [src/server.js:2621](../../src/server.js#L2621) | `S.buyListing` |
| POST | `/v1/exchange/list` | authenticated | social-combat | [src/server.js:2617](../../src/server.js#L2617) | `S.listItem` |
| GET | `/v1/explore` | authenticated | world-progression | [src/server.js:3007](../../src/server.js#L3007) | `Explore.exploreBoard` |
| GET | `/v1/fairness` | public | economy-ledger | [src/server.js:2974](../../src/server.js#L2974) | `fairnessBoard` |
| GET | `/v1/favors` | authenticated | engagement-growth | [src/server.js:2900](../../src/server.js#L2900) | `Favors.favorBoard` |
| POST | `/v1/favors` | authenticated | engagement-growth | [src/server.js:2902](../../src/server.js#L2902) | `Favors.postFavor` |
| DELETE | `/v1/favors/:id` | authenticated | engagement-growth | [src/server.js:2906](../../src/server.js#L2906) | `Favors.cancelFavor` |
| POST | `/v1/favors/:id/run` | authenticated | engagement-growth | [src/server.js:2904](../../src/server.js#L2904) | `Favors.runFavor` |
| GET | `/v1/fees/status` | authenticated | economy-ledger | [src/server.js:3260](../../src/server.js#L3260) | `Fees.feeStatus` |
| GET | `/v1/feud/:characterId` | authenticated | platform-core | [src/server.js:2536](../../src/server.js#L2536) | `G.GameError` |
| POST | `/v1/feud/:targetId/peace` | authenticated | social-combat | [src/server.js:2557](../../src/server.js#L2557) | `S.proposePeace` |
| POST | `/v1/feud/:targetId/peace/accept` | authenticated | social-combat | [src/server.js:2559](../../src/server.js#L2559) | `S.acceptPeace` |
| GET | `/v1/firsts` | authenticated | world-progression | [src/server.js:3175](../../src/server.js#L3175) | `Firsts.firstsBoard` |
| GET | `/v1/forge` | authenticated | chain-economy | [src/server.js:3264](../../src/server.js#L3264) | `Forge.forgeBoard` |
| GET | `/v1/gangs` | public | platform-core | [src/server.js:2180](../../src/server.js#L2180) | — |
| POST | `/v1/gangs` | authenticated | social-combat | [src/server.js:1561](../../src/server.js#L1561) | `S.createGang` |
| GET | `/v1/gangs/:id` | public | social-combat | [src/server.js:2197](../../src/server.js#L2197) | `S.resolveWarIfDue` |
| POST | `/v1/gangs/:id/join` | authenticated | social-combat | [src/server.js:1563](../../src/server.js#L1563) | `S.joinGang` |
| POST | `/v1/gangs/charter/:id` | authenticated | social-combat | [src/server.js:2597](../../src/server.js#L2597) | `S.chooseCharter` |
| GET | `/v1/gangs/chat` | authenticated | platform-core | [src/server.js:2868](../../src/server.js#L2868) | `readChat` |
| POST | `/v1/gangs/chat` | authenticated | platform-core | [src/server.js:2867](../../src/server.js#L2867) | `postChat` |
| POST | `/v1/gangs/contract/:targetId` | authenticated | social-combat | [src/server.js:2572](../../src/server.js#L2572) | `S.postFamilyContract` |
| POST | `/v1/gangs/contract/:targetId/:kind/cancel` | authenticated | social-combat | [src/server.js:2575](../../src/server.js#L2575) | `S.cancelFamilyContract` |
| POST | `/v1/gangs/foundation` | authenticated | engagement-growth | [src/server.js:2595](../../src/server.js#L2595) | `V.buyFoundation` |
| POST | `/v1/gangs/kick` | authenticated | social-combat | [src/server.js:1574](../../src/server.js#L1574) | `S.kickMember` |
| POST | `/v1/gangs/leave` | authenticated | social-combat | [src/server.js:1565](../../src/server.js#L1565) | `S.leaveGang` |
| POST | `/v1/gangs/portfolio/dividend` | authenticated | economy-ledger | [src/server.js:2059](../../src/server.js#L2059) | `Portfolio.claimFamilyDividend` |
| POST | `/v1/gangs/portfolio/invest` | authenticated | economy-ledger | [src/server.js:2053](../../src/server.js#L2053) | `Portfolio.familyInvest` |
| POST | `/v1/gangs/portfolio/name` | authenticated | economy-ledger | [src/server.js:2085](../../src/server.js#L2085) | `Portfolio.nameFamilyDynasty` |
| POST | `/v1/gangs/promote` | authenticated | social-combat | [src/server.js:1592](../../src/server.js#L1592) | `S.promoteMember` |
| POST | `/v1/gangs/tribute` | authenticated | social-combat | [src/server.js:1594](../../src/server.js#L1594) | `S.tribute` |
| POST | `/v1/gangs/tribute/omr` | authenticated | social-combat | [src/server.js:1597](../../src/server.js#L1597) | `S.tributeOmr` |
| POST | `/v1/gangs/vanity/color` | authenticated | engagement-growth | [src/server.js:2589](../../src/server.js#L2589) | `V.recolorGang` |
| POST | `/v1/gangs/vanity/name` | authenticated | engagement-growth | [src/server.js:2591](../../src/server.js#L2591) | `V.renameGang` |
| POST | `/v1/gangs/vanity/seal` | authenticated | engagement-growth | [src/server.js:2593](../../src/server.js#L2593) | `V.buySeal` |
| POST | `/v1/gangs/war/:targetGangId` | authenticated | social-combat | [src/server.js:1599](../../src/server.js#L1599) | `S.declareWar` |
| POST | `/v1/garage/:carId/fence` | authenticated | economy-ledger | [src/server.js:1482](../../src/server.js#L1482) | `E.fenceCar` |
| POST | `/v1/garage/:carId/melt` | authenticated | economy-ledger | [src/server.js:1478](../../src/server.js#L1478) | `E.meltCar` |
| POST | `/v1/garage/:carId/repair` | authenticated | economy-ledger | [src/server.js:1480](../../src/server.js#L1480) | `E.repairCar` |
| POST | `/v1/garage/boost` | authenticated | economy-ledger | [src/server.js:1476](../../src/server.js#L1476) | `E.boostCar` |
| POST | `/v1/gear/:id/mint` | authenticated | chain-economy | [src/server.js:1545](../../src/server.js#L1545) | `E.mintGear` |
| POST | `/v1/gear/:id/withdraw` | authenticated | chain-economy | [src/server.js:3226](../../src/server.js#L3226) | `Chain.requestGearWithdraw` |
| POST | `/v1/goods/buy` | authenticated | economy-ledger | [src/server.js:1494](../../src/server.js#L1494) | `E.buyGood` |
| POST | `/v1/goods/sell` | authenticated | economy-ledger | [src/server.js:1496](../../src/server.js#L1496) | `E.sellGood` |
| POST | `/v1/heal` | authenticated | platform-core | [src/server.js:1433](../../src/server.js#L1433) | `G.withCharacter` |
| POST | `/v1/heist` | authenticated | engagement-growth | [src/server.js:3071](../../src/server.js#L3071) | `W.heist` |
| GET | `/v1/heists` | authenticated | social-combat | [src/routes/heists.js:10](../../src/routes/heists.js#L10) | `Heists.heistBoard` |
| POST | `/v1/heists/:id/case` | authenticated | social-combat | [src/routes/heists.js:24](../../src/routes/heists.js#L24) | `Heists.caseJob` |
| POST | `/v1/heists/:id/execute` | authenticated | social-combat | [src/routes/heists.js:28](../../src/routes/heists.js#L28) | `Heists.executeHeist` |
| POST | `/v1/heists/:id/fill` | authenticated | social-combat | [src/routes/heists.js:22](../../src/routes/heists.js#L22) | `Heists.fillHeist` |
| POST | `/v1/heists/:id/join` | authenticated | social-combat | [src/routes/heists.js:18](../../src/routes/heists.js#L18) | `Heists.joinHeist` |
| POST | `/v1/heists/:id/leave` | authenticated | social-combat | [src/routes/heists.js:20](../../src/routes/heists.js#L20) | `Heists.leaveHeist` |
| POST | `/v1/heists/:id/rat` | authenticated | social-combat | [src/routes/heists.js:26](../../src/routes/heists.js#L26) | `Heists.ratHeist` |
| POST | `/v1/heists/fence` | authenticated | social-combat | [src/routes/heists.js:30](../../src/routes/heists.js#L30) | `Heists.fenceLoot` |
| POST | `/v1/heists/plan` | authenticated | social-combat | [src/routes/heists.js:15](../../src/routes/heists.js#L15) | `Heists.planHeist` |
| GET | `/v1/home` | authenticated | engagement-growth | [src/server.js:2295](../../src/server.js#L2295) | `Home.homeBoard` |
| GET | `/v1/hustle` | authenticated | platform-core | [src/server.js:1421](../../src/server.js#L1421) | `Hustle.hustleBoard` |
| POST | `/v1/hustle/advance` | authenticated | platform-core | [src/server.js:1423](../../src/server.js#L1423) | `Hustle.advanceHustle` |
| GET | `/v1/identity/:characterId` | public | platform-core | [src/server.js:604](../../src/server.js#L604) | — |
| GET | `/v1/identity/:characterId/portrait.svg` | public | platform-core | [src/server.js:595](../../src/server.js#L595) | — |
| POST | `/v1/identity/bio` | authenticated | engagement-growth | [src/server.js:3097](../../src/server.js#L3097) | `W.setBio` |
| POST | `/v1/identity/mint` | authenticated | chain-economy | [src/server.js:3242](../../src/server.js#L3242) | `Chain.requestDynastyMint` |
| POST | `/v1/items/:id/use` | authenticated | economy-ledger | [src/server.js:1490](../../src/server.js#L1490) | `E.useItem` |
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
| GET | `/v1/landmarks` | public | world-progression | [src/server.js:2110](../../src/server.js#L2110) | `Landmarks.landmarkBoard` |
| POST | `/v1/landmarks/:districtId` | authenticated | world-progression | [src/server.js:2111](../../src/server.js#L2111) | `Landmarks.dedicateLandmark` |
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
| GET | `/v1/leaderboard/contacts` | authenticated | engagement-growth | [src/server.js:2887](../../src/server.js#L2887) | `Contacts.contactsLeaderboard` |
| GET | `/v1/leaderboard/convoy` | authenticated | enterprise-logistics | [src/routes/leaderboards.js:65](../../src/routes/leaderboards.js#L65) | `Convoy.convoyLeaderboard` |
| GET | `/v1/leaderboard/crews` | authenticated | social-combat | [src/server.js:2949](../../src/server.js#L2949) | `Crew.crewLeaderboard` |
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
| GET | `/v1/leaderboard/mentors` | authenticated | social-combat | [src/server.js:2988](../../src/server.js#L2988) | `Mentor.mentorLeaderboard` |
| GET | `/v1/leaderboard/nightlife` | authenticated | vice-competition | [src/routes/leaderboards.js:45](../../src/routes/leaderboards.js#L45) | `Speakeasy.nightlifeLeaderboard` |
| GET | `/v1/leaderboard/patrons` | authenticated | platform-core | [src/routes/leaderboards.js:107](../../src/routes/leaderboards.js#L107) | `Store.benefactorLeaderboard` |
| GET | `/v1/leaderboard/port` | authenticated | enterprise-logistics | [src/routes/leaderboards.js:55](../../src/routes/leaderboards.js#L55) | `Port.portLeaderboard` |
| GET | `/v1/leaderboard/portfolio` | authenticated | economy-ledger | [src/routes/leaderboards.js:58](../../src/routes/leaderboards.js#L58) | `Portfolio.portfolioLeaderboard` |
| GET | `/v1/leaderboard/races` | authenticated | vice-competition | [src/routes/leaderboards.js:54](../../src/routes/leaderboards.js#L54) | `Races.raceLeaderboard` |
| GET | `/v1/leaderboard/recruiters` | authenticated | platform-core | [src/routes/leaderboards.js:83](../../src/routes/leaderboards.js#L83) | `recruitersBoard` |
| GET | `/v1/leaderboard/sov` | authenticated | world-progression | [src/routes/leaderboards.js:95](../../src/routes/leaderboards.js#L95) | `Sov.sovLeaderboard` |
| GET | `/v1/leaderboard/stable` | authenticated | vice-competition | [src/routes/leaderboards.js:53](../../src/routes/leaderboards.js#L53) | `Stable.stableLeaderboard` |
| GET | `/v1/leaderboard/statesmen` | authenticated | platform-core | [src/routes/leaderboards.js:56](../../src/routes/leaderboards.js#L56) | `Commission.statesmenLeaderboard` |
| GET | `/v1/leaderboard/streak` | authenticated | world-progression | [src/server.js:2995](../../src/server.js#L2995) | `Streak.streakLeaderboard` |
| GET | `/v1/leaderboard/streets` | authenticated | enterprise-logistics | [src/routes/leaderboards.js:62](../../src/routes/leaderboards.js#L62) | `Deeds.greatStreetsLeaderboard` |
| GET | `/v1/leaderboard/territory` | authenticated | enterprise-logistics | [src/routes/leaderboards.js:43](../../src/routes/leaderboards.js#L43) | `Territory.territoryLeaderboard` |
| GET | `/v1/leaderboard/trades` | authenticated | world-progression | [src/routes/leaderboards.js:94](../../src/routes/leaderboards.js#L94) | `Mastery.tradesLeaderboard` |
| GET | `/v1/leaderboard/tycoons` | authenticated | economy-ledger | [src/routes/leaderboards.js:42](../../src/routes/leaderboards.js#L42) | `E.tycoonLeaderboard` |
| GET | `/v1/leaderboard/underwriters` | authenticated | platform-core | [src/routes/leaderboards.js:102](../../src/routes/leaderboards.js#L102) | `Bonds.underwriterLeaderboard` |
| GET | `/v1/leaderboard/vouches` | authenticated | social-combat | [src/server.js:3028](../../src/server.js#L3028) | `Vouch.vouchLeaderboard` |
| GET | `/v1/leaderboard/wire` | authenticated | law-intelligence | [src/routes/leaderboards.js:63](../../src/routes/leaderboards.js#L63) | `Wire.wireLeaderboard` |
| GET | `/v1/leaderboard/world` | authenticated | world-progression | [src/routes/leaderboards.js:114](../../src/routes/leaderboards.js#L114) | `World.worldLeaderboard` |
| GET | `/v1/live` | authenticated | engagement-growth | [src/server.js:3002](../../src/server.js#L3002) | `Collision.collisionBoard` |
| GET | `/v1/loans` | authenticated | enterprise-logistics | [src/server.js:1999](../../src/server.js#L1999) | `Loans.loanBoard` |
| POST | `/v1/loans` | authenticated | enterprise-logistics | [src/server.js:2003](../../src/server.js#L2003) | `Loans.offerLoan` |
| POST | `/v1/loans/:id/buy` | authenticated | enterprise-logistics | [src/server.js:2038](../../src/server.js#L2038) | `Loans.buyPaper` |
| POST | `/v1/loans/:id/cancel` | authenticated | enterprise-logistics | [src/server.js:2007](../../src/server.js#L2007) | `Loans.cancelLoan` |
| POST | `/v1/loans/:id/collect` | authenticated | enterprise-logistics | [src/server.js:2016](../../src/server.js#L2016) | `Loans.collectLoan` |
| POST | `/v1/loans/:id/repay` | authenticated | enterprise-logistics | [src/server.js:2010](../../src/server.js#L2010) | `Loans.repayLoan` |
| POST | `/v1/loans/:id/sell` | authenticated | enterprise-logistics | [src/server.js:2022](../../src/server.js#L2022) | `Loans.sellPaper` |
| POST | `/v1/loans/:id/take` | authenticated | enterprise-logistics | [src/server.js:2005](../../src/server.js#L2005) | `Loans.takeLoan` |
| POST | `/v1/loans/:id/unsell` | authenticated | enterprise-logistics | [src/server.js:2024](../../src/server.js#L2024) | `Loans.unsellPaper` |
| POST | `/v1/loans/house` | authenticated | enterprise-logistics | [src/server.js:2028](../../src/server.js#L2028) | `Loans.takeHouseLoan` |
| POST | `/v1/loans/house/repay` | authenticated | enterprise-logistics | [src/server.js:2030](../../src/server.js#L2030) | `Loans.repayHouseLoan` |
| POST | `/v1/loans/square` | authenticated | enterprise-logistics | [src/server.js:2035](../../src/server.js#L2035) | `Loans.squareWanted` |
| GET | `/v1/made` | authenticated | social-combat | [src/routes/estate.js:13](../../src/routes/estate.js#L13) | `Made.madeBoard` |
| POST | `/v1/made` | authenticated | social-combat | [src/routes/estate.js:15](../../src/routes/estate.js#L15) | `Made.payDues` |
| GET | `/v1/map` | authenticated | world-progression | [src/server.js:2277](../../src/server.js#L2277) | `CityMap.cityMap` |
| GET | `/v1/market` | public | economy-ledger | [src/server.js:2150](../../src/server.js#L2150) | `Market.marketBoard` |
| POST | `/v1/market` | authenticated | economy-ledger | [src/server.js:2151](../../src/server.js#L2151) | `Market.listItem` |
| POST | `/v1/market/:id/bid` | authenticated | economy-ledger | [src/server.js:2153](../../src/server.js#L2153) | `Market.bidListing` |
| POST | `/v1/market/:id/buy` | authenticated | economy-ledger | [src/server.js:2155](../../src/server.js#L2155) | `Market.buyListing` |
| POST | `/v1/market/:id/cancel` | authenticated | economy-ledger | [src/server.js:2157](../../src/server.js#L2157) | `Market.cancelListing` |
| POST | `/v1/market/:id/claim` | authenticated | economy-ledger | [src/server.js:2165](../../src/server.js#L2165) | `Market.claimOrder` |
| POST | `/v1/market/:id/fill` | authenticated | economy-ledger | [src/server.js:2163](../../src/server.js#L2163) | `Market.fillOrder` |
| POST | `/v1/market/order` | authenticated | economy-ledger | [src/server.js:2161](../../src/server.js#L2161) | `Market.postOrder` |
| GET | `/v1/market/prices` | public | social-combat | [src/server.js:3311](../../src/server.js#L3311) | `Block.marketPrices` |
| GET | `/v1/mastery` | authenticated | world-progression | [src/server.js:1980](../../src/server.js#L1980) | `Mastery.masteryBoard` |
| POST | `/v1/mastery/trait/:trackId` | authenticated | world-progression | [src/server.js:1982](../../src/server.js#L1982) | `Mastery.chooseTrait` |
| GET | `/v1/me` | authenticated | platform-core | [src/server.js:1391](../../src/server.js#L1391) | `G.readCharacter` |
| GET | `/v1/megaproject` | authenticated | enterprise-logistics | [src/server.js:3377](../../src/server.js#L3377) | `Mega.megaBoard` |
| POST | `/v1/megaproject/cash` | authenticated | enterprise-logistics | [src/server.js:3378](../../src/server.js#L3378) | `Mega.giveCash` |
| POST | `/v1/megaproject/goods` | authenticated | enterprise-logistics | [src/server.js:3380](../../src/server.js#L3380) | `Mega.giveGoods` |
| POST | `/v1/megaproject/omr` | authenticated | enterprise-logistics | [src/server.js:3382](../../src/server.js#L3382) | `Mega.giveOmr` |
| GET | `/v1/mentor` | authenticated | social-combat | [src/server.js:2976](../../src/server.js#L2976) | `Mentor.mentorBoard` |
| POST | `/v1/mentor/accept/:mentorCharId` | authenticated | social-combat | [src/server.js:2982](../../src/server.js#L2982) | `Mentor.acceptMentor` |
| POST | `/v1/mentor/claim` | authenticated | social-combat | [src/server.js:2984](../../src/server.js#L2984) | `Mentor.claimMentor` |
| POST | `/v1/mentor/gift/:protegeCharId` | authenticated | social-combat | [src/server.js:2986](../../src/server.js#L2986) | `Mentor.mentorGift` |
| POST | `/v1/mentor/offer/:characterId` | authenticated | social-combat | [src/server.js:2980](../../src/server.js#L2980) | `Mentor.offerMentor` |
| POST | `/v1/mentor/seeking` | authenticated | social-combat | [src/server.js:2978](../../src/server.js#L2978) | `Mentor.seekMentor` |
| POST | `/v1/missions/:id` | authenticated | engagement-growth | [src/server.js:3073](../../src/server.js#L3073) | `W.doMission` |
| GET | `/v1/mod/actions` | moderator | platform-core | [src/server.js:941](../../src/server.js#L941) | — |
| GET | `/v1/mod/activity` | moderator | platform-core | [src/routes/modtools.js:149](../../src/routes/modtools.js#L149) | `Ops.opsActivity` |
| POST | `/v1/mod/alert/test` | moderator | platform-core | [src/routes/modtools.js:137](../../src/routes/modtools.js#L137) | — |
| GET | `/v1/mod/audit` | moderator | platform-core | [src/routes/modtools.js:165](../../src/routes/modtools.js#L165) | — |
| POST | `/v1/mod/ban` | moderator | platform-core | [src/routes/modtools.js:40](../../src/routes/modtools.js#L40) | `G.GameError` |
| GET | `/v1/mod/bank` | moderator | platform-core | [src/routes/modtools.js:251](../../src/routes/modtools.js#L251) | `Bank.runBankInvariants` |
| POST | `/v1/mod/bank/buy` | moderator | platform-core | [src/routes/modtools.js:252](../../src/routes/modtools.js#L252) | `Bank.recordBankBuy` |
| POST | `/v1/mod/bank/epoch` | moderator | platform-core | [src/routes/modtools.js:256](../../src/routes/modtools.js#L256) | `Bank.runCityLeg` |
| POST | `/v1/mod/bank/harvest` | moderator | economy-ledger | [src/routes/modtools.js:232](../../src/routes/modtools.js#L232) | `Treasury.recordHarvestFee` |
| POST | `/v1/mod/bond/fund` | moderator | platform-core | [src/routes/modtools.js:292](../../src/routes/modtools.js#L292) | `Bonds.fundBondTranche` |
| POST | `/v1/mod/bond/offer` | moderator | platform-core | [src/routes/modtools.js:295](../../src/routes/modtools.js#L295) | `Bonds.setBondOffering` |
| POST | `/v1/mod/bond/simulate` | moderator | platform-core | [src/routes/modtools.js:296](../../src/routes/modtools.js#L296) | `Bonds.recordBond` |
| GET | `/v1/mod/bonds` | moderator | platform-core | [src/routes/modtools.js:173](../../src/routes/modtools.js#L173) | `Bonds.bondStatus` |
| GET | `/v1/mod/brokers` | moderator | platform-core | [src/server.js:2122](../../src/server.js#L2122) | `Brokers.epochBoard` |
| POST | `/v1/mod/brokers/allocate` | moderator | platform-core | [src/server.js:2123](../../src/server.js#L2123) | `Brokers.allocateEpoch` |
| GET | `/v1/mod/chain/params` | moderator | platform-core | [src/routes/modtools.js:156](../../src/routes/modtools.js#L156) | `ChainParams.readChainParams` |
| POST | `/v1/mod/chain/tx` | moderator | platform-core | [src/routes/modtools.js:157](../../src/routes/modtools.js#L157) | `ChainParams.buildParamTx` |
| GET | `/v1/mod/coach` | moderator | platform-core | [src/routes/modtools.js:150](../../src/routes/modtools.js#L150) | `Ops.opsCoach` |
| GET | `/v1/mod/community` | moderator | engagement-growth | [src/routes/modtools.js:264](../../src/routes/modtools.js#L264) | `Community.runFamilyBuybackInvariants` |
| POST | `/v1/mod/community/buy` | moderator | engagement-growth | [src/routes/modtools.js:268](../../src/routes/modtools.js#L268) | `Community.runFamilyBuyback` |
| POST | `/v1/mod/confiscate` | moderator | platform-core | [src/routes/modtools.js:90](../../src/routes/modtools.js#L90) | `G.GameError` |
| POST | `/v1/mod/content/activate` | moderator | platform-core | [src/routes/content.js:273](../../src/routes/content.js#L273) | `activateContentBundle` |
| POST | `/v1/mod/deeds/recover` | moderator | chain-economy | [src/routes/modtools.js:319](../../src/routes/modtools.js#L319) | `Chain.recoverStrandedDeed` |
| GET | `/v1/mod/deeds/stranded` | moderator | chain-economy | [src/routes/modtools.js:314](../../src/routes/modtools.js#L314) | `Chain.strandedDeeds` |
| GET | `/v1/mod/desk` | moderator | platform-core | [src/routes/modtools.js:278](../../src/routes/modtools.js#L278) | `Desk.runDeskInvariants` |
| POST | `/v1/mod/desk/buy` | moderator | platform-core | [src/routes/modtools.js:289](../../src/routes/modtools.js#L289) | `Desk.runDeskBuyback` |
| POST | `/v1/mod/desk/fees` | moderator | platform-core | [src/routes/modtools.js:287](../../src/routes/modtools.js#L287) | `Desk.recordPolFees` |
| POST | `/v1/mod/desk/fill` | moderator | platform-core | [src/routes/modtools.js:280](../../src/routes/modtools.js#L280) | `Desk.recordAuctionBuy` |
| POST | `/v1/mod/desk/open` | moderator | platform-core | [src/routes/modtools.js:279](../../src/routes/modtools.js#L279) | `Desk.openAuction` |
| GET | `/v1/mod/dev` | moderator | platform-core | [src/routes/modtools.js:374](../../src/routes/modtools.js#L374) | — |
| POST | `/v1/mod/dev/claim` | moderator | platform-core | [src/routes/modtools.js:380](../../src/routes/modtools.js#L380) | — |
| GET | `/v1/mod/dexbot` | moderator | economy-ledger | [src/routes/modtools.js:339](../../src/routes/modtools.js#L339) | `DexBot.dexBotBoard` |
| POST | `/v1/mod/dexbot/buyback` | moderator | economy-ledger | [src/routes/modtools.js:341](../../src/routes/modtools.js#L341) | `DexBot.runDexBuyback` |
| POST | `/v1/mod/dexbot/pol` | moderator | economy-ledger | [src/routes/modtools.js:343](../../src/routes/modtools.js#L343) | `DexBot.runPolPairing` |
| GET | `/v1/mod/drop` | moderator | engagement-growth | [src/routes/modtools.js:360](../../src/routes/modtools.js#L360) | `Drop.dropStatus` |
| POST | `/v1/mod/drop/load` | moderator | engagement-growth | [src/routes/modtools.js:356](../../src/routes/modtools.js#L356) | `Drop.loadAllocations` |
| POST | `/v1/mod/drop/window` | moderator | engagement-growth | [src/routes/modtools.js:358](../../src/routes/modtools.js#L358) | `Drop.setDropWindow` |
| GET | `/v1/mod/emission` | moderator | platform-core | [src/routes/modtools.js:400](../../src/routes/modtools.js#L400) | — |
| POST | `/v1/mod/emission/fund` | moderator | platform-core | [src/routes/modtools.js:411](../../src/routes/modtools.js#L411) | `G.GameError` |
| GET | `/v1/mod/engagement` | moderator | engagement-growth | [src/routes/modtools.js:164](../../src/routes/modtools.js#L164) | `opsEngagement` |
| GET | `/v1/mod/exchange` | moderator | economy-ledger | [src/server.js:1527](../../src/server.js#L1527) | `Exchange.exchangePool` |
| POST | `/v1/mod/fees/record` | moderator | economy-ledger | [src/routes/modtools.js:323](../../src/routes/modtools.js#L323) | `Fees.recordFeePayment` |
| GET | `/v1/mod/funnel` | moderator | engagement-growth | [src/routes/modtools.js:147](../../src/routes/modtools.js#L147) | `W.funnelStats` |
| GET | `/v1/mod/integrations` | moderator | platform-core | [src/routes/modtools.js:151](../../src/routes/modtools.js#L151) | `Ops.integrationsStatus` |
| GET | `/v1/mod/invariants` | moderator | economy-ledger | [src/routes/modtools.js:130](../../src/routes/modtools.js#L130) | `runLedgerInvariants` |
| POST | `/v1/mod/invites` | moderator | platform-core | [src/routes/modtools.js:115](../../src/routes/modtools.js#L115) | — |
| GET | `/v1/mod/items/stranded` | moderator | chain-economy | [src/routes/modtools.js:318](../../src/routes/modtools.js#L318) | `Chain.strandedItems` |
| POST | `/v1/mod/kill` | moderator | social-combat | [src/routes/modtools.js:63](../../src/routes/modtools.js#L63) | `S.runEstate` |
| POST | `/v1/mod/loanhouse/fund` | moderator | enterprise-logistics | [src/routes/modtools.js:38](../../src/routes/modtools.js#L38) | `Loans.fundLoanHouse` |
| GET | `/v1/mod/overview` | moderator | platform-core | [src/routes/modtools.js:148](../../src/routes/modtools.js#L148) | `Ops.opsOverview` |
| GET | `/v1/mod/referral/push` | moderator | platform-core | [src/routes/modtools.js:129](../../src/routes/modtools.js#L129) | `G.referralPushStatus` |
| POST | `/v1/mod/referral/push` | moderator | platform-core | [src/routes/modtools.js:127](../../src/routes/modtools.js#L127) | `G.startReferralPush` |
| GET | `/v1/mod/reserve` | moderator | chain-economy | [src/routes/modtools.js:307](../../src/routes/modtools.js#L307) | `Chain.reserveStatus` |
| POST | `/v1/mod/reserve/claimed` | moderator | chain-economy | [src/routes/modtools.js:308](../../src/routes/modtools.js#L308) | `Chain.markClaimed` |
| POST | `/v1/mod/reserve/fund` | moderator | chain-economy | [src/routes/modtools.js:306](../../src/routes/modtools.js#L306) | `Chain.fundReserve` |
| GET | `/v1/mod/revenue` | moderator | platform-core | [src/routes/modtools.js:364](../../src/routes/modtools.js#L364) | `Store.revenueStatus` |
| POST | `/v1/mod/revoke` | moderator | platform-core | [src/routes/modtools.js:52](../../src/routes/modtools.js#L52) | `G.GameError` |
| GET | `/v1/mod/router` | moderator | platform-core | [src/routes/modtools.js:368](../../src/routes/modtools.js#L368) | `Router.routerBoard` |
| POST | `/v1/mod/store/grant` | moderator | platform-core | [src/routes/modtools.js:369](../../src/routes/modtools.js#L369) | `Store.recordStorePurchase` |
| GET | `/v1/mod/tokenhealth` | moderator | economy-ledger | [src/routes/modtools.js:276](../../src/routes/modtools.js#L276) | `TokenHealth.tokenHealth` |
| GET | `/v1/mod/treasury` | moderator | economy-ledger | [src/routes/modtools.js:180](../../src/routes/modtools.js#L180) | `Treasury.runTreasuryInvariants` |
| GET | `/v1/mod/treasury/budget` | moderator | economy-ledger | [src/routes/modtools.js:183](../../src/routes/modtools.js#L183) | `Treasury.stockBudget` |
| POST | `/v1/mod/treasury/buy` | moderator | economy-ledger | [src/routes/modtools.js:196](../../src/routes/modtools.js#L196) | `Treasury.recordStockBuy` |
| POST | `/v1/mod/treasury/deliver` | moderator | economy-ledger | [src/routes/modtools.js:216](../../src/routes/modtools.js#L216) | `StockDeliver.deliverStock` |
| GET | `/v1/mod/treasury/deliveries` | moderator | economy-ledger | [src/routes/modtools.js:214](../../src/routes/modtools.js#L214) | `StockDeliver.stockDeliveryBoard` |
| POST | `/v1/mod/treasury/deliveries/run` | moderator | economy-ledger | [src/routes/modtools.js:222](../../src/routes/modtools.js#L222) | `StockDeliver.runStockDeliveryKeeper` |
| POST | `/v1/mod/treasury/distribute` | moderator | platform-core | [src/routes/modtools.js:205](../../src/routes/modtools.js#L205) | `Brokers.distributeBuy` |
| POST | `/v1/mod/treasury/keeper` | moderator | economy-ledger | [src/routes/modtools.js:189](../../src/routes/modtools.js#L189) | `Treasury.runStockBuyback` |
| POST | `/v1/mod/treasury/tax` | moderator | economy-ledger | [src/routes/modtools.js:227](../../src/routes/modtools.js#L227) | `Treasury.recordSellTax` |
| GET | `/v1/mod/vig` | moderator | economy-ledger | [src/routes/modtools.js:328](../../src/routes/modtools.js#L328) | `Vig.vigStatus` |
| POST | `/v1/mod/vig/buyback` | moderator | economy-ledger | [src/routes/modtools.js:330](../../src/routes/modtools.js#L330) | `Vig.runVigBuyback` |
| POST | `/v1/mod/vig/prizes` | moderator | economy-ledger | [src/routes/modtools.js:333](../../src/routes/modtools.js#L333) | `Vig.payPrizes` |
| GET | `/v1/nft` | authenticated | platform-core | [src/server.js:3229](../../src/server.js#L3229) | `G.readCharacter` |
| POST | `/v1/nft/:kind/:id/upgrade` | authenticated | platform-core | [src/server.js:3230](../../src/server.js#L3230) | `G.withCharacter` |
| POST | `/v1/nft/:kind/:id/withdraw` | authenticated | chain-economy | [src/server.js:3232](../../src/server.js#L3232) | `Chain.requestItemWithdraw` |
| GET | `/v1/notifications` | authenticated | platform-core | [src/server.js:2629](../../src/server.js#L2629) | — |
| GET | `/v1/npcfamily` | authenticated | world-progression | [src/server.js:3407](../../src/server.js#L3407) | `NpcWar.warBoard` |
| POST | `/v1/npcfamily/:gangId/raid` | authenticated | world-progression | [src/server.js:3409](../../src/server.js#L3409) | `NpcWar.raidFamily` |
| POST | `/v1/npcfamily/:gangId/war` | authenticated | world-progression | [src/server.js:3414](../../src/server.js#L3414) | `NpcWar.declareNpcWar` |
| POST | `/v1/npcfamily/collect` | authenticated | world-progression | [src/server.js:3411](../../src/server.js#L3411) | `NpcWar.collectFamilyTribute` |
| GET | `/v1/onboard` | authenticated | engagement-growth | [src/server.js:3082](../../src/server.js#L3082) | `W.onboardBoard` |
| POST | `/v1/onboard/:taskId/claim` | authenticated | engagement-growth | [src/server.js:3184](../../src/server.js#L3184) | `W.claimOnboard` |
| GET | `/v1/online` | public | platform-core | [src/server.js:2744](../../src/server.js#L2744) | — |
| GET | `/v1/opportunities` | authenticated | engagement-growth | [src/server.js:2405](../../src/server.js#L2405) | `opportunityBoard` |
| GET | `/v1/paper` | authenticated | engagement-growth | [src/server.js:2390](../../src/server.js#L2390) | `People.paperBoard` |
| POST | `/v1/paper/read` | authenticated | engagement-growth | [src/server.js:2392](../../src/server.js#L2392) | `People.foldPaper` |
| GET | `/v1/pass` | authenticated | platform-core | [src/server.js:3294](../../src/server.js#L3294) | `Pass.passBoard` |
| POST | `/v1/pass/claim` | authenticated | platform-core | [src/server.js:3295](../../src/server.js#L3295) | `Pass.claimPass` |
| POST | `/v1/path` | authenticated | engagement-growth | [src/server.js:3066](../../src/server.js#L3066) | `W.choosePath` |
| POST | `/v1/path-quiz` | public | platform-core | [src/server.js:1136](../../src/server.js#L1136) | `G.track` |
| GET | `/v1/payroll` | authenticated | enterprise-logistics | [src/server.js:2287](../../src/server.js#L2287) | `Payroll.payrollBoard` |
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
| GET | `/v1/people` | authenticated | engagement-growth | [src/server.js:2384](../../src/server.js#L2384) | `People.peopleBoard` |
| GET | `/v1/people/history/:characterId` | authenticated | engagement-growth | [src/server.js:2386](../../src/server.js#L2386) | `People.pairHistory` |
| GET | `/v1/phone` | authenticated | platform-core | [src/server.js:2874](../../src/server.js#L2874) | `Phone.phoneBoard` |
| DELETE | `/v1/phone/block/:characterId` | authenticated | platform-core | [src/server.js:2881](../../src/server.js#L2881) | `Phone.unblockLine` |
| POST | `/v1/phone/block/:characterId` | authenticated | platform-core | [src/server.js:2879](../../src/server.js#L2879) | `Phone.blockLine` |
| POST | `/v1/phone/dm/:characterId` | authenticated | platform-core | [src/server.js:2877](../../src/server.js#L2877) | `Phone.sendDm` |
| GET | `/v1/phone/thread/:characterId` | authenticated | platform-core | [src/server.js:2875](../../src/server.js#L2875) | `Phone.readThread` |
| POST | `/v1/plex/mint` | authenticated | economy-ledger | [src/server.js:3272](../../src/server.js#L3272) | `Vig.payPlex` |
| GET | `/v1/plex/price` | public | economy-ledger | [src/server.js:3279](../../src/server.js#L3279) | `Vig.plexQuote` |
| POST | `/v1/plex/respawn` | authenticated | economy-ledger | [src/server.js:3274](../../src/server.js#L3274) | `Vig.payPlex` |
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
| GET | `/v1/portfolio` | authenticated | economy-ledger | [src/server.js:2049](../../src/server.js#L2049) | `Portfolio.portfolioBoard` |
| POST | `/v1/portfolio/dividend` | authenticated | economy-ledger | [src/server.js:2056](../../src/server.js#L2056) | `Portfolio.claimDividend` |
| POST | `/v1/portfolio/invest` | authenticated | economy-ledger | [src/server.js:2051](../../src/server.js#L2051) | `Portfolio.invest` |
| GET | `/v1/primetime` | authenticated | engagement-growth | [src/server.js:3012](../../src/server.js#L3012) | `Prime.primeTimeBoard` |
| POST | `/v1/primetime/answer` | authenticated | engagement-growth | [src/server.js:3014](../../src/server.js#L3014) | `Prime.answerCall` |
| POST | `/v1/primetime/round` | authenticated | engagement-growth | [src/server.js:3016](../../src/server.js#L3016) | `Prime.buyRound` |
| POST | `/v1/primetime/siege` | authenticated | engagement-growth | [src/server.js:3018](../../src/server.js#L3018) | `Prime.joinSiege` |
| GET | `/v1/profile` | authenticated | engagement-growth | [src/server.js:3093](../../src/server.js#L3093) | `W.myProfile` |
| GET | `/v1/provenance` | authenticated | engagement-growth | [src/server.js:2328](../../src/server.js#L2328) | `Drop.colorsBoard` |
| POST | `/v1/provenance` | authenticated | engagement-growth | [src/server.js:2330](../../src/server.js#L2330) | `Drop.claimColors` |
| POST | `/v1/push/subscribe` | authenticated | engagement-growth | [src/server.js:3031](../../src/server.js#L3031) | `Push.saveSubscription` |
| POST | `/v1/push/unsubscribe` | authenticated | engagement-growth | [src/server.js:3033](../../src/server.js#L3033) | `Push.removeSubscription` |
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
| DELETE | `/v1/rackets/:id` | authenticated | economy-ledger | [src/server.js:1510](../../src/server.js#L1510) | `E.retireRacket` |
| POST | `/v1/rackets/:id/buy` | authenticated | economy-ledger | [src/server.js:1500](../../src/server.js#L1500) | `E.buyRacket` |
| POST | `/v1/rackets/:id/upgrade` | authenticated | economy-ledger | [src/server.js:1507](../../src/server.js#L1507) | `E.upgradeRacket` |
| POST | `/v1/referral/claim` | authenticated | engagement-growth | [src/server.js:3090](../../src/server.js#L3090) | `W.claimReferral` |
| GET | `/v1/regimen` | authenticated | platform-core | [src/server.js:1414](../../src/server.js#L1414) | `RG.regimenBoard` |
| POST | `/v1/regimen/:id` | authenticated | platform-core | [src/server.js:1416](../../src/server.js#L1416) | `RG.trainDiscipline` |
| POST | `/v1/regimen/drill/:npc` | authenticated | platform-core | [src/server.js:1418](../../src/server.js#L1418) | `RG.claimDrill` |
| POST | `/v1/respec` | authenticated | engagement-growth | [src/server.js:3069](../../src/server.js#L3069) | `W.respec` |
| GET | `/v1/results` | public | platform-core | [src/server.js:2969](../../src/server.js#L2969) | — |
| GET | `/v1/rivals` | authenticated | social-combat | [src/server.js:2380](../../src/server.js#L2380) | `Rivals.rivalsBoard` |
| GET | `/v1/roster` | authenticated | social-combat | [src/server.js:1607](../../src/server.js#L1607) | `S.rosterOf` |
| DELETE | `/v1/roster/:post` | authenticated | social-combat | [src/server.js:1611](../../src/server.js#L1611) | `S.vacatePost` |
| POST | `/v1/roster/:post` | authenticated | social-combat | [src/server.js:1609](../../src/server.js#L1609) | `S.assignPost` |
| GET | `/v1/rules` | public | engagement-growth | [src/server.js:1629](../../src/server.js#L1629) | `Push.pushPublicKey` |
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
| POST | `/v1/safehouse` | authenticated | social-combat | [src/server.js:2569](../../src/server.js#L2569) | `S.enterSafehouse` |
| POST | `/v1/screens` | authenticated | platform-core | [src/server.js:1457](../../src/server.js#L1457) | `G.track` |
| GET | `/v1/season/recap` | authenticated | world-progression | [src/server.js:3317](../../src/server.js#L3317) | `Season.seasonRecaps` |
| GET | `/v1/seasons` | public | world-progression | [src/server.js:3315](../../src/server.js#L3315) | `Season.seasonBoard` |
| GET | `/v1/secrets` | authenticated | law-intelligence | [src/server.js:3141](../../src/server.js#L3141) | `Secrets.secretsBoard` |
| POST | `/v1/secrets/:id/expose` | authenticated | law-intelligence | [src/server.js:3161](../../src/server.js#L3161) | `Secrets.exposeSecret` |
| POST | `/v1/secrets/:id/extort` | authenticated | law-intelligence | [src/server.js:3145](../../src/server.js#L3145) | `Secrets.extortSecret` |
| POST | `/v1/secrets/:id/pay` | authenticated | law-intelligence | [src/server.js:3149](../../src/server.js#L3149) | `Secrets.payHush` |
| GET | `/v1/session` | authenticated | platform-core | [src/server.js:1396](../../src/server.js#L1396) | — |
| GET | `/v1/shipment` | authenticated | enterprise-logistics | [src/server.js:3178](../../src/server.js#L3178) | `Shipment.shipmentBoard` |
| POST | `/v1/shipment/commission/:id` | authenticated | enterprise-logistics | [src/server.js:3182](../../src/server.js#L3182) | `Shipment.commissionPiece` |
| POST | `/v1/shipment/take` | authenticated | enterprise-logistics | [src/server.js:3180](../../src/server.js#L3180) | `Shipment.takeShipment` |
| GET | `/v1/skills` | authenticated | world-progression | [src/server.js:1977](../../src/server.js#L1977) | `Skills.skillsBoard` |
| POST | `/v1/skills/:id` | authenticated | world-progression | [src/server.js:1991](../../src/server.js#L1991) | `Skills.learnSkill` |
| POST | `/v1/skills/active/:ability` | authenticated | world-progression | [src/server.js:1987](../../src/server.js#L1987) | `Skills.useActive` |
| POST | `/v1/skills/respec` | authenticated | world-progression | [src/server.js:1984](../../src/server.js#L1984) | `Skills.respecSkills` |
| POST | `/v1/skills/respec/:id` | authenticated | world-progression | [src/server.js:1989](../../src/server.js#L1989) | `Skills.respecOne` |
| GET | `/v1/social` | authenticated | engagement-growth | [src/server.js:3187](../../src/server.js#L3187) | `W.socialBoard` |
| POST | `/v1/social/:taskId/claim` | authenticated | engagement-growth | [src/server.js:3191](../../src/server.js#L3191) | `W.claimSocial` |
| GET | `/v1/soldiers` | authenticated | social-combat | [src/server.js:3130](../../src/server.js#L3130) | `Soldiers.soldierBoard` |
| DELETE | `/v1/soldiers/:id` | authenticated | social-combat | [src/server.js:3138](../../src/server.js#L3138) | `Soldiers.dismissSoldier` |
| POST | `/v1/soldiers/:id/assign` | authenticated | social-combat | [src/server.js:3134](../../src/server.js#L3134) | `Soldiers.assignSoldier` |
| POST | `/v1/soldiers/hire` | authenticated | social-combat | [src/server.js:3132](../../src/server.js#L3132) | `Soldiers.hireSoldier` |
| POST | `/v1/soldiers/unassign` | authenticated | social-combat | [src/server.js:3136](../../src/server.js#L3136) | `Soldiers.unassignSoldier` |
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
| POST | `/v1/stake` | authenticated | economy-ledger | [src/server.js:1535](../../src/server.js#L1535) | `E.stake` |
| POST | `/v1/stake/lock` | authenticated | economy-ledger | [src/server.js:1541](../../src/server.js#L1541) | `E.lockStake` |
| GET | `/v1/store` | authenticated | platform-core | [src/server.js:3286](../../src/server.js#L3286) | `Store.storeBoard` |
| POST | `/v1/store/plex/:sku` | authenticated | platform-core | [src/server.js:3288](../../src/server.js#L3288) | `Store.payPackagePlex` |
| GET | `/v1/streak` | authenticated | world-progression | [src/server.js:2991](../../src/server.js#L2991) | `Streak.streakBoard` |
| POST | `/v1/streak/claim` | authenticated | world-progression | [src/server.js:2993](../../src/server.js#L2993) | `Streak.claimStreak` |
| GET | `/v1/streets` | authenticated | platform-core | [src/server.js:2335](../../src/server.js#L2335) | — |
| POST | `/v1/streets/:targetId/boat` | authenticated | social-combat | [src/server.js:2376](../../src/server.js#L2376) | `S.stealBoat` |
| POST | `/v1/streets/:targetId/bounty` | authenticated | social-combat | [src/server.js:2394](../../src/server.js#L2394) | `S.postBounty` |
| POST | `/v1/streets/:targetId/bust` | authenticated | social-combat | [src/server.js:2608](../../src/server.js#L2608) | `S.bust` |
| POST | `/v1/streets/:targetId/fire` | authenticated | social-combat | [src/server.js:2603](../../src/server.js#L2603) | `S.fire` |
| POST | `/v1/streets/:targetId/jump` | authenticated | social-combat | [src/server.js:2367](../../src/server.js#L2367) | `S.jump` |
| POST | `/v1/streets/:targetId/npchit` | authenticated | social-combat | [src/server.js:2561](../../src/server.js#L2561) | `S.npcHit` |
| POST | `/v1/streets/:targetId/sabotage` | authenticated | social-combat | [src/server.js:2378](../../src/server.js#L2378) | `S.sabotage` |
| POST | `/v1/streets/:targetId/search` | authenticated | social-combat | [src/server.js:2599](../../src/server.js#L2599) | `S.startSearch` |
| POST | `/v1/streets/:targetId/steal` | authenticated | social-combat | [src/server.js:2371](../../src/server.js#L2371) | `S.stealCar` |
| POST | `/v1/streets/:targetId/trunk` | authenticated | social-combat | [src/server.js:2374](../../src/server.js#L2374) | `S.robTrunk` |
| DELETE | `/v1/streets/search` | authenticated | social-combat | [src/server.js:2601](../../src/server.js#L2601) | `S.callOffSearch` |
| POST | `/v1/swap` | authenticated | economy-ledger | [src/server.js:1533](../../src/server.js#L1533) | `E.swap` |
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
| POST | `/v1/train/:stat` | authenticated | platform-core | [src/server.js:1411](../../src/server.js#L1411) | `G.withCharacter` |
| POST | `/v1/travel/:district` | authenticated | platform-core | [src/server.js:1472](../../src/server.js#L1472) | `G.withCharacter` |
| GET | `/v1/u/:name` | public | platform-core | [src/server.js:647](../../src/server.js#L647) | `Cards.publicDossier` |
| GET | `/v1/underworld` | authenticated | world-progression | [src/routes/underworld.js:10](../../src/routes/underworld.js#L10) | `Underworld.underworldBoard` |
| POST | `/v1/underworld/:npc/errand` | authenticated | world-progression | [src/routes/underworld.js:24](../../src/routes/underworld.js#L24) | `Underworld.startErrand` |
| POST | `/v1/underworld/:npc/favor` | authenticated | world-progression | [src/routes/underworld.js:21](../../src/routes/underworld.js#L21) | `Underworld.claimFavor` |
| POST | `/v1/underworld/:npc/gift` | authenticated | world-progression | [src/routes/underworld.js:16](../../src/routes/underworld.js#L16) | `Underworld.giftNpc` |
| POST | `/v1/underworld/:npc/penance` | authenticated | world-progression | [src/routes/underworld.js:19](../../src/routes/underworld.js#L19) | `Underworld.payPenance` |
| POST | `/v1/underworld/discharge` | authenticated | world-progression | [src/routes/underworld.js:12](../../src/routes/underworld.js#L12) | `Underworld.discharge` |
| POST | `/v1/underworld/gun/:gunId/sell` | authenticated | world-progression | [src/routes/underworld.js:14](../../src/routes/underworld.js#L14) | `Underworld.sellGunBack` |
| POST | `/v1/unstake` | authenticated | economy-ledger | [src/server.js:1537](../../src/server.js#L1537) | `E.unstake` |
| POST | `/v1/vanity/name` | authenticated | engagement-growth | [src/server.js:2583](../../src/server.js#L2583) | `V.changeName` |
| POST | `/v1/vanity/plate/:carId` | authenticated | engagement-growth | [src/server.js:2587](../../src/server.js#L2587) | `V.setPlate` |
| POST | `/v1/vanity/title` | authenticated | engagement-growth | [src/server.js:2585](../../src/server.js#L2585) | `V.setTitle` |
| GET | `/v1/vault` | authenticated | economy-ledger | [src/server.js:2068](../../src/server.js#L2068) | `Treasury.vaultBoard` |
| POST | `/v1/vault/claim` | authenticated | economy-ledger | [src/server.js:2082](../../src/server.js#L2082) | `Treasury.claimVaulted` |
| DELETE | `/v1/vouch/:characterId` | authenticated | social-combat | [src/server.js:3026](../../src/server.js#L3026) | `Vouch.revokeVouch` |
| POST | `/v1/vouch/:characterId` | authenticated | social-combat | [src/server.js:3024](../../src/server.js#L3024) | `Vouch.giveVouch` |
| GET | `/v1/vouches` | authenticated | social-combat | [src/server.js:3022](../../src/server.js#L3022) | `Vouch.vouchBoard` |
| GET | `/v1/wage` | authenticated | economy-ledger | [src/server.js:3100](../../src/server.js#L3100) | `Emission.wageBoard` |
| POST | `/v1/wallet` | authenticated | chain-economy | [src/server.js:3196](../../src/server.js#L3196) | `G.GameError` |
| POST | `/v1/wallet/challenge` | authenticated | chain-economy | [src/server.js:3217](../../src/server.js#L3217) | `Chain.walletChallenge` |
| POST | `/v1/wallet/verify` | authenticated | chain-economy | [src/server.js:3218](../../src/server.js#L3218) | `Chain.walletVerify` |
| GET | `/v1/window` | authenticated | economy-ledger | [src/server.js:1521](../../src/server.js#L1521) | `Exchange.exchangeBoard` |
| POST | `/v1/window/redeem` | authenticated | economy-ledger | [src/server.js:1523](../../src/server.js#L1523) | `Exchange.redeem` |
| GET | `/v1/wire` | authenticated | law-intelligence | [src/server.js:2126](../../src/server.js#L2126) | `Wire.wireBoard` |
| POST | `/v1/wire/dig/:targetId` | authenticated | law-intelligence | [src/server.js:3143](../../src/server.js#L3143) | `Secrets.digSecret` |
| POST | `/v1/wire/disinfo` | authenticated | law-intelligence | [src/server.js:2144](../../src/server.js#L2144) | `Wire.plantDisinfo` |
| POST | `/v1/wire/dossier/:targetId` | authenticated | law-intelligence | [src/server.js:2142](../../src/server.js#L2142) | `Wire.pullDossier` |
| POST | `/v1/wire/informant/:targetId` | authenticated | law-intelligence | [src/server.js:2146](../../src/server.js#L2146) | `Wire.recruitInformant` |
| POST | `/v1/wire/subscribe` | authenticated | law-intelligence | [src/server.js:2132](../../src/server.js#L2132) | `Wire.subscribeWire` |
| POST | `/v1/wire/sweep` | authenticated | law-intelligence | [src/server.js:2130](../../src/server.js#L2130) | `Wire.sweepBugs` |
| POST | `/v1/wire/tap/:targetId` | authenticated | law-intelligence | [src/server.js:2128](../../src/server.js#L2128) | `Wire.placeTap` |
| POST | `/v1/wire/trace` | authenticated | law-intelligence | [src/server.js:2140](../../src/server.js#L2140) | `Wire.traceBugs` |
| DELETE | `/v1/wire/watch/:targetId` | authenticated | law-intelligence | [src/server.js:2137](../../src/server.js#L2137) | `Wire.cancelWatch` |
| POST | `/v1/wire/watch/:targetId` | authenticated | law-intelligence | [src/server.js:2135](../../src/server.js#L2135) | `Wire.enrollWatch` |
| POST | `/v1/withdraw` | authenticated | chain-economy | [src/server.js:3220](../../src/server.js#L3220) | `Chain.requestWithdraw` |
| POST | `/v1/withdraw/:id/cancel` | authenticated | chain-economy | [src/server.js:3224](../../src/server.js#L3224) | `Chain.cancelQueuedWithdraw` |
| GET | `/v1/withdraw/status` | authenticated | chain-economy | [src/server.js:3244](../../src/server.js#L3244) | `Chain.reserveStatus` |
| POST | `/v1/workshop/ammo` | authenticated | economy-ledger | [src/server.js:1488](../../src/server.js#L1488) | `E.craftAmmo` |
| POST | `/v1/workshop/craft/:id` | authenticated | economy-ledger | [src/server.js:1486](../../src/server.js#L1486) | `E.craft` |
| GET | `/v1/world` | authenticated | world-progression | [src/server.js:3402](../../src/server.js#L3402) | `World.worldBoard` |
| POST | `/v1/world/:npcId/invade` | authenticated | world-progression | [src/server.js:3432](../../src/server.js#L3432) | `World.invadeOutpost` |
| POST | `/v1/world/:npcId/plan` | authenticated | world-progression | [src/server.js:3418](../../src/server.js#L3418) | `World.planRaid` |
| POST | `/v1/world/:npcId/raid` | authenticated | world-progression | [src/server.js:3404](../../src/server.js#L3404) | `World.raidNpc` |
| POST | `/v1/world/:npcId/reinforce` | authenticated | world-progression | [src/server.js:3435](../../src/server.js#L3435) | `World.reinforceOutpost` |
| POST | `/v1/world/collect` | authenticated | world-progression | [src/server.js:3430](../../src/server.js#L3430) | `World.collectFrontier` |
| GET | `/v1/world/raids` | authenticated | world-progression | [src/server.js:3416](../../src/server.js#L3416) | `World.raidBoard` |
| POST | `/v1/world/raids/:id/dismiss` | authenticated | world-progression | [src/server.js:3424](../../src/server.js#L3424) | `World.dismissGun` |
| POST | `/v1/world/raids/:id/go` | authenticated | world-progression | [src/server.js:3428](../../src/server.js#L3428) | `World.executeRaid` |
| POST | `/v1/world/raids/:id/hire` | authenticated | world-progression | [src/server.js:3422](../../src/server.js#L3422) | `World.hireRaid` |
| POST | `/v1/world/raids/:id/join` | authenticated | world-progression | [src/server.js:3420](../../src/server.js#L3420) | `World.joinRaid` |
| POST | `/v1/world/raids/:id/leave` | authenticated | world-progression | [src/server.js:3426](../../src/server.js#L3426) | `World.leaveRaid` |
| GET | `/v1/worldgraph/inventory` | authenticated | world-graph | [src/routes/worldgraph.js:415](../../src/routes/worldgraph.js#L415) | — |
| POST | `/v1/worldgraph/items/:itemId/assign-current-character` | public | world-graph | [src/routes/worldgraph.js:407](../../src/routes/worldgraph.js#L407) | — |
| GET | `/v1/worldgraph/mysteries` | authenticated | world-graph | [src/routes/worldgraph.js:442](../../src/routes/worldgraph.js#L442) | — |
| GET | `/v1/worldgraph/mysteries/:graphId` | authenticated | world-graph | [src/routes/worldgraph.js:458](../../src/routes/worldgraph.js#L458) | — |
| POST | `/v1/worldgraph/mysteries/:graphId/cancel` | public | world-graph | [src/routes/worldgraph.js:494](../../src/routes/worldgraph.js#L494) | — |
| POST | `/v1/worldgraph/mysteries/:graphId/choices/:nodeId` | public | world-graph | [src/routes/worldgraph.js:483](../../src/routes/worldgraph.js#L483) | — |
| POST | `/v1/worldgraph/mysteries/:graphId/nodes/:nodeId/complete` | public | world-graph | [src/routes/worldgraph.js:473](../../src/routes/worldgraph.js#L473) | — |
| POST | `/v1/worldgraph/mysteries/:graphId/nodes/:nodeId/discover` | public | world-graph | [src/routes/worldgraph.js:463](../../src/routes/worldgraph.js#L463) | — |
| POST | `/v1/worldgraph/mysteries/:graphId/start` | public | world-graph | [src/routes/worldgraph.js:447](../../src/routes/worldgraph.js#L447) | — |
| GET | `/v1/worldgraph/operations` | authenticated | world-graph | [src/routes/worldgraph.js:505](../../src/routes/worldgraph.js#L505) | — |
| POST | `/v1/worldgraph/operations/:graphId/:operationNodeId/open` | public | world-graph | [src/routes/worldgraph.js:510](../../src/routes/worldgraph.js#L510) | — |
| GET | `/v1/worldgraph/operations/:operationId` | authenticated | world-graph | [src/routes/worldgraph.js:521](../../src/routes/worldgraph.js#L521) | — |
| POST | `/v1/worldgraph/operations/:operationId/cancel` | public | world-graph | [src/routes/worldgraph.js:556](../../src/routes/worldgraph.js#L556) | — |
| POST | `/v1/worldgraph/operations/:operationId/complete` | public | world-graph | [src/routes/worldgraph.js:550](../../src/routes/worldgraph.js#L550) | — |
| POST | `/v1/worldgraph/operations/:operationId/contributions/:nodeId` | public | world-graph | [src/routes/worldgraph.js:543](../../src/routes/worldgraph.js#L543) | — |
| GET | `/v1/worldgraph/operations/:operationId/role` | authenticated | world-graph | [src/routes/worldgraph.js:529](../../src/routes/worldgraph.js#L529) | — |
| POST | `/v1/worldgraph/operations/:operationId/roles/:roleId` | public | world-graph | [src/routes/worldgraph.js:537](../../src/routes/worldgraph.js#L537) | — |
| GET | `/v1/worldgraph/recipes` | authenticated | world-graph | [src/routes/worldgraph.js:420](../../src/routes/worldgraph.js#L420) | — |
| POST | `/v1/worldgraph/recipes/:recipeId/craft` | public | world-graph | [src/routes/worldgraph.js:430](../../src/routes/worldgraph.js#L430) | — |
| POST | `/v1/worldgraph/recipes/:recipeId/salvage/:carId` | public | world-graph | [src/routes/worldgraph.js:436](../../src/routes/worldgraph.js#L436) | — |
| GET | `/v1/ws` | token-query | platform-core | [src/server.js:2652](../../src/server.js#L2652) | — |
| GET | `/v1/yield` | public | economy-ledger | [src/server.js:1525](../../src/server.js#L1525) | `Exchange.yieldBoard` |
| GET | `/wiki` | public | client-experience | [src/server.js:435](../../src/server.js#L435) | `servePage` |
