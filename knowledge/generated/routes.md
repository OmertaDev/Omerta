# Generated HTTP route catalog

> 938 literal registrations extracted from `src/server.js` and `src/routes/`. Runtime authority remains `GET /openapi.json`.

## Route groups

| Group | Routes |
|---|---:|
| mod | 79 |
| leaderboard | 46 |
| web | 39 |
| resources | 38 |
| casino | 28 |
| worldgraph | 27 |
| gangs | 22 |
| crew | 19 |
| pen | 19 |
| coordination | 18 |
| depot | 17 |
| content | 16 |
| speakeasy | 13 |
| kitchen | 12 |
| rwa | 12 |
| loans | 12 |
| streets | 12 |
| world | 12 |
| deeds | 11 |
| market | 11 |
| port | 11 |
| business | 11 |
| wire | 11 |
| boxing | 10 |
| races | 10 |
| territory | 10 |
| estate | 9 |
| heists | 9 |
| law | 9 |
| auth | 9 |
| convoy | 8 |
| stable | 8 |
| dynasty | 8 |
| company | 7 |
| diplomacy | 7 |
| underworld | 7 |
| identity | 7 |
| commission | 7 |
| sov | 6 |
| mentor | 6 |
| city | 5 |
| delivery-finance | 5 |
| intel-forecasts | 5 |
| strategies | 5 |
| supply-tenders | 5 |
| armory | 5 |
| skills | 5 |
| auction | 5 |
| phone | 5 |
| soldiers | 5 |
| deliveries | 4 |
| strategy-leagues | 4 |
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
| franchise-licenses | 3 |
| logistics-coverage | 3 |
| warehouse-leases | 3 |
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
| company-succession | 2 |
| defi | 2 |
| made | 2 |
| genesis-auction | 2 |
| projections | 2 |
| warehouses | 2 |
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
| depots | 1 |
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

## Full catalog

| Method | Path | Access | Domain | Definition | Handler |
|---|---|---|---|---|---|
| GET | `/` | public | client-experience | [src/server.js:508](../../src/server.js#L508) | `serveLaunchPage` |
| GET | `/admin` | public | client-experience | [src/server.js:514](../../src/server.js#L514) | `servePage` |
| GET | `/agents` | public | client-experience | [src/server.js:827](../../src/server.js#L827) | — |
| GET | `/AGENTS.md` | public | client-experience | [src/server.js:828](../../src/server.js#L828) | — |
| GET | `/arena` | public | client-experience | [src/server.js:524](../../src/server.js#L524) | `servePage` |
| GET | `/art/:file` | public | client-experience | [src/server.js:662](../../src/server.js#L662) | `sendVideo` |
| GET | `/art/hype/:file` | public | client-experience | [src/server.js:668](../../src/server.js#L668) | `sendVideo` |
| GET | `/beef/:a/:b` | public | client-experience | [src/server.js:817](../../src/server.js#L817) | `Cards.beefDossier` |
| GET | `/card/:type/:name` | public | client-experience | [src/server.js:781](../../src/server.js#L781) | `Cards.publicDossier` |
| GET | `/card/beef/:a/:b` | public | client-experience | [src/server.js:797](../../src/server.js#L797) | `Cards.beefDossier` |
| GET | `/deed/:tokenId` | public | client-experience | [src/server.js:766](../../src/server.js#L766) | `Deeds.deedByToken` |
| GET | `/defi` | public | client-experience | [src/server.js:571](../../src/server.js#L571) | — |
| GET | `/defi.html` | public | client-experience | [src/server.js:572](../../src/server.js#L572) | — |
| GET | `/favicon.ico` | public | client-experience | [src/server.js:608](../../src/server.js#L608) | — |
| GET | `/fee-flows` | public | client-experience | [src/server.js:574](../../src/server.js#L574) | — |
| GET | `/fee-flows.html` | public | client-experience | [src/server.js:575](../../src/server.js#L575) | — |
| GET | `/genesis-deploy` | public | client-experience | [src/server.js:577](../../src/server.js#L577) | — |
| GET | `/genesis-deploy-artifact.js` | public | client-experience | [src/server.js:586](../../src/server.js#L586) | `reviewedModule` |
| GET | `/genesis-deploy-client.js` | public | client-experience | [src/server.js:584](../../src/server.js#L584) | `reviewedModule` |
| GET | `/genesis-deploy-vendor/_u64.js` | public | client-experience | [src/server.js:588](../../src/server.js#L588) | `reviewedModule` |
| GET | `/genesis-deploy-vendor/crypto.js` | public | client-experience | [src/server.js:590](../../src/server.js#L590) | `reviewedModule` |
| GET | `/genesis-deploy-vendor/sha3.js` | public | client-experience | [src/server.js:587](../../src/server.js#L587) | `reviewedModule` |
| GET | `/genesis-deploy-vendor/utils.js` | public | client-experience | [src/server.js:589](../../src/server.js#L589) | `reviewedModule` |
| GET | `/genesis-deploy.html` | public | client-experience | [src/server.js:578](../../src/server.js#L578) | — |
| GET | `/genesis-snapshot-rpc.js` | public | client-experience | [src/server.js:585](../../src/server.js#L585) | `reviewedModule` |
| GET | `/health` | public | client-experience | [src/server.js:1000](../../src/server.js#L1000) | — |
| GET | `/llms.txt` | public | client-experience | [src/server.js:829](../../src/server.js#L829) | — |
| GET | `/manifest.json` | public | client-experience | [src/server.js:593](../../src/server.js#L593) | — |
| GET | `/manifest.webmanifest` | public | client-experience | [src/server.js:594](../../src/server.js#L594) | — |
| GET | `/omerta-ui.css` | public | client-experience | [src/server.js:546](../../src/server.js#L546) | — |
| GET | `/openapi.json` | public | client-experience | [src/server.js:845](../../src/server.js#L845) | — |
| GET | `/path` | public | client-experience | [src/server.js:533](../../src/server.js#L533) | `servePage` |
| GET | `/path/:id` | public | client-experience | [src/server.js:535](../../src/server.js#L535) | — |
| GET | `/play` | public | client-experience | [src/server.js:529](../../src/server.js#L529) | `servePage` |
| GET | `/robots.txt` | public | client-experience | [src/server.js:833](../../src/server.js#L833) | — |
| GET | `/sitemap.xml` | public | client-experience | [src/server.js:838](../../src/server.js#L838) | — |
| GET | `/sw.js` | public | client-experience | [src/server.js:564](../../src/server.js#L564) | — |
| GET | `/u/:name` | public | client-experience | [src/server.js:811](../../src/server.js#L811) | `Cards.publicDossier` |
| POST | `/v1/access/logout` | public | platform-core | [src/server.js:1416](../../src/server.js#L1416) | — |
| POST | `/v1/access/redeem` | public | platform-core | [src/server.js:1400](../../src/server.js#L1400) | `G.GameError` |
| POST | `/v1/access/session` | authenticated | platform-core | [src/server.js:1409](../../src/server.js#L1409) | — |
| POST | `/v1/agent/act` | authenticated | platform-core | [src/server.js:2746](../../src/server.js#L2746) | `executeAgentAction` |
| GET | `/v1/agent/turn` | authenticated | platform-core | [src/server.js:2660](../../src/server.js#L2660) | `readAgentTurn` |
| GET | `/v1/arena` | public | engagement-growth | [src/server.js:2820](../../src/server.js#L2820) | `arenaBoard` |
| POST | `/v1/armory/ammo` | authenticated | economy-ledger | [src/server.js:1770](../../src/server.js#L1770) | `E.buyAmmo` |
| POST | `/v1/armory/gun/:id/buy` | authenticated | economy-ledger | [src/server.js:1762](../../src/server.js#L1762) | `E.buyGun` |
| POST | `/v1/armory/gun/:id/equip` | authenticated | economy-ledger | [src/server.js:1764](../../src/server.js#L1764) | `E.equipGun` |
| POST | `/v1/armory/unequip` | authenticated | economy-ledger | [src/server.js:1766](../../src/server.js#L1766) | `E.equipGun` |
| POST | `/v1/armory/vest/:id` | authenticated | economy-ledger | [src/server.js:1768](../../src/server.js#L1768) | `E.buyVest` |
| GET | `/v1/art/:kind/:id` | public | platform-core | [src/server.js:684](../../src/server.js#L684) | — |
| GET | `/v1/art/motion` | public | platform-core | [src/server.js:673](../../src/server.js#L673) | — |
| POST | `/v1/assets/:id/buy` | authenticated | economy-ledger | [src/server.js:1715](../../src/server.js#L1715) | `E.buyAsset` |
| POST | `/v1/assets/:id/sell` | authenticated | economy-ledger | [src/server.js:1717](../../src/server.js#L1717) | `E.sellAsset` |
| GET | `/v1/auction` | authenticated | platform-core | [src/server.js:2318](../../src/server.js#L2318) | `Auction.auctionBoard` |
| POST | `/v1/auction/:lotId/bid` | authenticated | platform-core | [src/server.js:2320](../../src/server.js#L2320) | `Auction.bidAuction` |
| POST | `/v1/auction/consign` | authenticated | platform-core | [src/server.js:2323](../../src/server.js#L2323) | `Auction.consignTrophy` |
| POST | `/v1/auction/consign/:id/bid` | authenticated | platform-core | [src/server.js:2325](../../src/server.js#L2325) | `Auction.bidConsignment` |
| POST | `/v1/auction/consign/:id/cancel` | authenticated | platform-core | [src/server.js:2327](../../src/server.js#L2327) | `Auction.reclaimConsignment` |
| POST | `/v1/auth/agent-key` | authenticated | platform-core | [src/server.js:1507](../../src/server.js#L1507) | `A.acknowledgeGuestBootstrap` |
| POST | `/v1/auth/guest` | public | platform-core | [src/server.js:1399](../../src/server.js#L1399) | — |
| POST | `/v1/auth/guest/bootstrap/ack` | authenticated | platform-core | [src/server.js:1420](../../src/server.js#L1420) | `A.acknowledgeGuestBootstrap` |
| POST | `/v1/auth/logout-all` | authenticated | platform-core | [src/server.js:1517](../../src/server.js#L1517) | — |
| POST | `/v1/auth/privy` | public | platform-core | [src/server.js:1430](../../src/server.js#L1430) | `providerLogin` |
| POST | `/v1/auth/upgrade` | authenticated | platform-core | [src/server.js:1498](../../src/server.js#L1498) | `A.upgradeAccount` |
| POST | `/v1/auth/x` | public | platform-core | [src/server.js:1429](../../src/server.js#L1429) | `providerLogin` |
| GET | `/v1/auth/x/callback` | public | platform-core | [src/server.js:1472](../../src/server.js#L1472) | `A.xOAuthCallback` |
| POST | `/v1/auth/x/start` | public | platform-core | [src/server.js:1440](../../src/server.js#L1440) | `A.upgradeAccount` |
| GET | `/v1/avatar/:seed` | public | platform-core | [src/server.js:699](../../src/server.js#L699) | — |
| GET | `/v1/bank` | authenticated | platform-core | [src/server.js:2298](../../src/server.js#L2298) | `Bank.bankBoard` |
| POST | `/v1/bank/:dir` | authenticated | platform-core | [src/server.js:1683](../../src/server.js#L1683) | `G.withCharacter` |
| GET | `/v1/block` | authenticated | social-combat | [src/server.js:2542](../../src/server.js#L2542) | `Block.streetsBoard` |
| GET | `/v1/bloodline` | authenticated | platform-core | [src/server.js:3414](../../src/server.js#L3414) | `Bloodline.bloodlineBoard` |
| POST | `/v1/bodyguard/hire/:guardId` | authenticated | social-combat | [src/server.js:2868](../../src/server.js#L2868) | `S.hireBodyguard` |
| POST | `/v1/bodyguard/offer` | authenticated | social-combat | [src/server.js:2866](../../src/server.js#L2866) | `S.offerBodyguard` |
| POST | `/v1/bond/calldata` | authenticated | chain-economy | [src/server.js:3515](../../src/server.js#L3515) | `Chain.bondCalldata` |
| POST | `/v1/bond/quote` | authenticated | chain-economy | [src/server.js:3512](../../src/server.js#L3512) | `Chain.quoteBond` |
| GET | `/v1/bonds` | authenticated | platform-core | [src/server.js:3504](../../src/server.js#L3504) | `Bonds.bondBoard` |
| POST | `/v1/bonds/:id/claim` | authenticated | platform-core | [src/server.js:3505](../../src/server.js#L3505) | `Bonds.claimBond` |
| POST | `/v1/bonds/charter` | authenticated | platform-core | [src/server.js:3510](../../src/server.js#L3510) | `Bonds.commissionCharter` |
| POST | `/v1/bonds/pledge` | authenticated | platform-core | [src/server.js:3508](../../src/server.js#L3508) | `Bonds.pledgeTreasury` |
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
| POST | `/v1/broadcast/shared` | authenticated | platform-core | [src/server.js:1652](../../src/server.js#L1652) | `G.track` |
| GET | `/v1/brokers` | authenticated | platform-core | [src/server.js:2339](../../src/server.js#L2339) | `Brokers.brokerBoard` |
| POST | `/v1/brokers/activate` | authenticated | platform-core | [src/server.js:2341](../../src/server.js#L2341) | `Brokers.activate` |
| GET | `/v1/bulletin` | authenticated | engagement-growth | [src/server.js:3673](../../src/server.js#L3673) | `bulletinBoard` |
| POST | `/v1/bulletin/claim` | authenticated | platform-core | [src/server.js:3678](../../src/server.js#L3678) | `G.withCharacter` |
| GET | `/v1/business` | authenticated | enterprise-logistics | [src/server.js:2155](../../src/server.js#L2155) | `Business.businessesOf` |
| DELETE | `/v1/business/:id` | authenticated | enterprise-logistics | [src/server.js:2127](../../src/server.js#L2127) | `Business.shutterBusiness` |
| POST | `/v1/business/:id/launder` | authenticated | enterprise-logistics | [src/server.js:2129](../../src/server.js#L2129) | `Business.launderAtBusiness` |
| POST | `/v1/business/:id/rob` | authenticated | enterprise-logistics | [src/server.js:2140](../../src/server.js#L2140) | `Business.robBusiness` |
| POST | `/v1/business/:id/shakedown` | authenticated | enterprise-logistics | [src/server.js:2133](../../src/server.js#L2133) | `Business.shakedownBusiness` |
| POST | `/v1/business/:id/specialize` | authenticated | enterprise-logistics | [src/server.js:2147](../../src/server.js#L2147) | `Business.specializeBusiness` |
| POST | `/v1/business/:id/takeover` | authenticated | enterprise-logistics | [src/server.js:2149](../../src/server.js#L2149) | `Business.takeoverBusiness` |
| POST | `/v1/business/:id/upgrade` | authenticated | enterprise-logistics | [src/server.js:2122](../../src/server.js#L2122) | `Business.upgradeBusiness` |
| POST | `/v1/business/:kind/buy` | authenticated | enterprise-logistics | [src/server.js:2114](../../src/server.js#L2114) | `Business.buyBusiness` |
| POST | `/v1/business/collect` | authenticated | enterprise-logistics | [src/server.js:2116](../../src/server.js#L2116) | `Business.collectBusiness` |
| POST | `/v1/business/upkeep` | authenticated | enterprise-logistics | [src/server.js:2120](../../src/server.js#L2120) | `Business.payBusinessUpkeep` |
| POST | `/v1/call/fulfill` | authenticated | engagement-growth | [src/server.js:3183](../../src/server.js#L3183) | `Contacts.fulfillCall` |
| GET | `/v1/campaigns` | authenticated | platform-core | [src/server.js:3406](../../src/server.js#L3406) | `Campaigns.campaignBoard` |
| POST | `/v1/campaigns/:id/choose` | authenticated | platform-core | [src/server.js:3410](../../src/server.js#L3410) | `Campaigns.chooseCampaign` |
| POST | `/v1/campaigns/:id/claim` | authenticated | platform-core | [src/server.js:3412](../../src/server.js#L3412) | `Campaigns.claimCampaign` |
| POST | `/v1/campaigns/:id/start` | authenticated | platform-core | [src/server.js:3408](../../src/server.js#L3408) | `Campaigns.startCampaign` |
| GET | `/v1/capo` | authenticated | engagement-growth | [src/routes/leaderboards.js:88](../../src/routes/leaderboards.js#L88) | `W.capoBoard` |
| GET | `/v1/career` | authenticated | engagement-growth | [src/server.js:3386](../../src/server.js#L3386) | `Career.careerBoard` |
| POST | `/v1/career/:taskId` | authenticated | engagement-growth | [src/server.js:3388](../../src/server.js#L3388) | `Career.claimCareer` |
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
| GET | `/v1/catalog` | public | enterprise-logistics | [src/server.js:1835](../../src/server.js#L1835) | `Business.catalog` |
| POST | `/v1/character` | authenticated | platform-core | [src/server.js:1531](../../src/server.js#L1531) | `Store.claimPendingWire` |
| POST | `/v1/character/forge` | authenticated | chain-economy | [src/server.js:3571](../../src/server.js#L3571) | `Forge.forgeCharacter` |
| POST | `/v1/character/mint` | authenticated | economy-ledger | [src/server.js:3562](../../src/server.js#L3562) | `Fees.mintCharacter` |
| POST | `/v1/character/reroll` | authenticated | economy-ledger | [src/server.js:3565](../../src/server.js#L3565) | `Fees.rerollCharacter` |
| GET | `/v1/chat` | authenticated | platform-core | [src/server.js:3158](../../src/server.js#L3158) | `readChat` |
| POST | `/v1/chat` | authenticated | platform-core | [src/server.js:3157](../../src/server.js#L3157) | `postChat` |
| POST | `/v1/checkin` | authenticated | platform-core | [src/server.js:1648](../../src/server.js#L1648) | `G.withCharacter` |
| GET | `/v1/circle` | authenticated | engagement-growth | [src/server.js:3298](../../src/server.js#L3298) | `Circle.circleBoard` |
| GET | `/v1/city` | public | platform-core | [src/server.js:3628](../../src/server.js#L3628) | — |
| POST | `/v1/city/encounters/:actorId` | authenticated | platform-core | [src/routes/city.js:14](../../src/routes/city.js#L14) | `recordCityEncounter` |
| GET | `/v1/city/homes` | authenticated | platform-core | [src/routes/cityhomes.js:8](../../src/routes/cityhomes.js#L8) | `cityHomes` |
| GET | `/v1/city/intel` | authenticated | platform-core | [src/routes/city.js:10](../../src/routes/city.js#L10) | `cityIntel` |
| GET | `/v1/city/presence` | authenticated | platform-core | [src/routes/city.js:6](../../src/routes/city.js#L6) | `cityPresence` |
| GET | `/v1/citywide` | authenticated | world-progression | [src/server.js:2546](../../src/server.js#L2546) | `Citywide.citywideBoard` |
| POST | `/v1/claim-rewards` | authenticated | economy-ledger | [src/server.js:1756](../../src/server.js#L1756) | `E.claimRewards` |
| GET | `/v1/clues` | authenticated | platform-core | [src/server.js:3704](../../src/server.js#L3704) | `Clues.clueBoard` |
| POST | `/v1/clues/dig` | authenticated | platform-core | [src/server.js:3706](../../src/server.js#L3706) | `Clues.dig` |
| GET | `/v1/collection` | authenticated | law-intelligence | [src/server.js:3473](../../src/server.js#L3473) | `Collection.collectionBoard` |
| GET | `/v1/commands` | public | platform-core | [src/routes/commands.js:43](../../src/routes/commands.js#L43) | `traceAuthorizedCommand` |
| POST | `/v1/commands/execute` | public | platform-core | [src/routes/commands.js:55](../../src/routes/commands.js#L55) | `traceAuthorizedCommand` |
| POST | `/v1/commands/observations` | authenticated | platform-core | [src/routes/commands.js:50](../../src/routes/commands.js#L50) | — |
| GET | `/v1/commission` | public | platform-core | [src/server.js:2171](../../src/server.js#L2171) | `Commission.commissionBoard` |
| POST | `/v1/commission/override` | authenticated | platform-core | [src/server.js:2180](../../src/server.js#L2180) | `Commission.overrideVeto` |
| POST | `/v1/commission/propose` | authenticated | platform-core | [src/server.js:2177](../../src/server.js#L2177) | `Commission.proposeDecree` |
| GET | `/v1/commission/ticker` | public | platform-core | [src/server.js:2185](../../src/server.js#L2185) | `Commission.tickerBallotBoard` |
| POST | `/v1/commission/ticker` | authenticated | platform-core | [src/server.js:2186](../../src/server.js#L2186) | `Commission.castTickerVote` |
| POST | `/v1/commission/veto` | authenticated | platform-core | [src/server.js:2174](../../src/server.js#L2174) | `Commission.vetoDecree` |
| POST | `/v1/commission/vote` | authenticated | platform-core | [src/server.js:2172](../../src/server.js#L2172) | `Commission.castVote` |
| GET | `/v1/company-succession` | authenticated | platform-core | [src/routes/companysuccession.js:5](../../src/routes/companysuccession.js#L5) | `Succession.companySuccessionBoard` |
| POST | `/v1/company-succession` | authenticated | platform-core | [src/routes/companysuccession.js:7](../../src/routes/companysuccession.js#L7) | `Succession.resumeCompany` |
| GET | `/v1/company/operator` | authenticated | platform-core | [src/routes/companyoperators.js:8](../../src/routes/companyoperators.js#L8) | `Operators.companyOperatorBoard` |
| POST | `/v1/company/operator` | authenticated | platform-core | [src/routes/companyoperators.js:9](../../src/routes/companyoperators.js#L9) | `Operators.setCompanyOperator` |
| POST | `/v1/company/operator/run` | authenticated | platform-core | [src/routes/companyoperators.js:11](../../src/routes/companyoperators.js#L11) | `Operators.runCompanyOperator` |
| GET | `/v1/company/workflows` | authenticated | platform-core | [src/routes/companyworkflows.js:5](../../src/routes/companyworkflows.js#L5) | `Workflow.companyWorkflowBoard` |
| POST | `/v1/company/workflows` | authenticated | platform-core | [src/routes/companyworkflows.js:7](../../src/routes/companyworkflows.js#L7) | `Workflow.createCompanyWorkflow` |
| POST | `/v1/company/workflows/:id/advance` | authenticated | platform-core | [src/routes/companyworkflows.js:9](../../src/routes/companyworkflows.js#L9) | `Workflow.advanceCompanyWorkflow` |
| POST | `/v1/company/workflows/:id/cancel` | authenticated | platform-core | [src/routes/companyworkflows.js:11](../../src/routes/companyworkflows.js#L11) | `Workflow.cancelCompanyWorkflow` |
| GET | `/v1/contacts` | authenticated | engagement-growth | [src/server.js:3177](../../src/server.js#L3177) | `Contacts.contactsBoard` |
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
| GET | `/v1/contracts` | authenticated | social-combat | [src/server.js:2638](../../src/server.js#L2638) | `S.listContracts` |
| POST | `/v1/contracts/:targetId/:kind/cancel` | authenticated | social-combat | [src/server.js:2642](../../src/server.js#L2642) | `S.cancelBounty` |
| POST | `/v1/contracts/peek` | authenticated | social-combat | [src/server.js:2640](../../src/server.js#L2640) | `S.peekContracts` |
| POST | `/v1/convoy` | authenticated | enterprise-logistics | [src/routes/convoy.js:9](../../src/routes/convoy.js#L9) | `Convoy.openConvoy` |
| POST | `/v1/convoy/:id/ambush` | authenticated | enterprise-logistics | [src/routes/convoy.js:17](../../src/routes/convoy.js#L17) | `Convoy.ambushConvoy` |
| POST | `/v1/convoy/:id/collect` | authenticated | enterprise-logistics | [src/routes/convoy.js:19](../../src/routes/convoy.js#L19) | `Convoy.collectConvoy` |
| POST | `/v1/convoy/cancel` | authenticated | enterprise-logistics | [src/routes/convoy.js:15](../../src/routes/convoy.js#L15) | `Convoy.cancelConvoy` |
| POST | `/v1/convoy/depart` | authenticated | enterprise-logistics | [src/routes/convoy.js:13](../../src/routes/convoy.js#L13) | `Convoy.departConvoy` |
| POST | `/v1/convoy/load` | authenticated | enterprise-logistics | [src/routes/convoy.js:11](../../src/routes/convoy.js#L11) | `Convoy.loadConvoy` |
| POST | `/v1/convoy/rig/:kind` | authenticated | enterprise-logistics | [src/routes/convoy.js:22](../../src/routes/convoy.js#L22) | `Convoy.buyRig` |
| POST | `/v1/convoy/rig/upgrade` | authenticated | enterprise-logistics | [src/routes/convoy.js:24](../../src/routes/convoy.js#L24) | `Convoy.upgradeRig` |
| GET | `/v1/convoys` | authenticated | enterprise-logistics | [src/server.js:2390](../../src/server.js#L2390) | `Convoy.convoyBoard` |
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
| GET | `/v1/corner` | authenticated | platform-core | [src/server.js:1640](../../src/server.js#L1640) | `Corner.cornerBoard` |
| POST | `/v1/corner/:slot/accept` | authenticated | platform-core | [src/server.js:1642](../../src/server.js#L1642) | `Corner.acceptCorner` |
| POST | `/v1/corner/:slot/claim` | authenticated | platform-core | [src/server.js:1644](../../src/server.js#L1644) | `Corner.claimCorner` |
| GET | `/v1/crew` | authenticated | social-combat | [src/server.js:3205](../../src/server.js#L3205) | `Crew.crewBoard` |
| POST | `/v1/crew` | authenticated | social-combat | [src/server.js:3215](../../src/server.js#L3215) | `Crew.createCrew` |
| POST | `/v1/crew/accept/:crewId` | authenticated | social-combat | [src/server.js:3219](../../src/server.js#L3219) | `Crew.acceptInvite` |
| GET | `/v1/crew/chat` | authenticated | platform-core | [src/server.js:3162](../../src/server.js#L3162) | `readChat` |
| POST | `/v1/crew/chat` | authenticated | platform-core | [src/server.js:3161](../../src/server.js#L3161) | `postChat` |
| POST | `/v1/crew/decline/:crewId` | authenticated | social-combat | [src/server.js:3221](../../src/server.js#L3221) | `Crew.declineInvite` |
| POST | `/v1/crew/invite` | authenticated | social-combat | [src/server.js:3217](../../src/server.js#L3217) | `Crew.inviteToCrew` |
| POST | `/v1/crew/leave` | authenticated | social-combat | [src/server.js:3223](../../src/server.js#L3223) | `Crew.leaveCrew` |
| GET | `/v1/crew/logistics` | authenticated | platform-core | [src/routes/crewlogistics.js:6](../../src/routes/crewlogistics.js#L6) | `Logistics.crewLogisticsBoard` |
| POST | `/v1/crew/logistics-links` | authenticated | platform-core | [src/routes/crewlogistics.js:9](../../src/routes/crewlogistics.js#L9) | `Logistics.publishCrewLogisticsLink` |
| POST | `/v1/crew/logistics-links/:id/revoke` | authenticated | platform-core | [src/routes/crewlogistics.js:12](../../src/routes/crewlogistics.js#L12) | `Logistics.revokeCrewLogisticsLink` |
| DELETE | `/v1/crew/member/:characterId` | authenticated | social-combat | [src/server.js:3226](../../src/server.js#L3226) | `Crew.kickMember` |
| POST | `/v1/crew/objective/claim` | authenticated | social-combat | [src/server.js:3252](../../src/server.js#L3252) | `Crew.claimObjective` |
| POST | `/v1/crew/recruiting` | authenticated | social-combat | [src/server.js:3238](../../src/server.js#L3238) | `Crew.setRecruiting` |
| DELETE | `/v1/crew/request/:characterId` | authenticated | social-combat | [src/server.js:3248](../../src/server.js#L3248) | `Crew.declineRequest` |
| POST | `/v1/crew/request/:characterId/accept` | authenticated | social-combat | [src/server.js:3244](../../src/server.js#L3244) | `Crew.acceptRequest` |
| POST | `/v1/crew/request/:crewId` | authenticated | social-combat | [src/server.js:3242](../../src/server.js#L3242) | `Crew.requestJoin` |
| DELETE | `/v1/crew/target` | authenticated | social-combat | [src/server.js:3234](../../src/server.js#L3234) | `Crew.clearCrewTarget` |
| POST | `/v1/crew/target` | authenticated | social-combat | [src/server.js:3232](../../src/server.js#L3232) | `Crew.setCrewTarget` |
| POST | `/v1/crimes/:id` | authenticated | platform-core | [src/server.js:1622](../../src/server.js#L1622) | `G.withCharacter` |
| GET | `/v1/daily` | authenticated | engagement-growth | [src/server.js:3376](../../src/server.js#L3376) | `W.getDaily` |
| POST | `/v1/daily/:id/claim` | authenticated | engagement-growth | [src/server.js:3381](../../src/server.js#L3381) | `W.claimDaily` |
| GET | `/v1/day` | authenticated | world-progression | [src/server.js:2520](../../src/server.js#L2520) | `Day.dayBoard` |
| GET | `/v1/deeds` | authenticated | enterprise-logistics | [src/routes/deeds.js:9](../../src/routes/deeds.js#L9) | `Deeds.deedBoard` |
| POST | `/v1/deeds/buy/:sellerCharacterId` | authenticated | enterprise-logistics | [src/routes/deeds.js:25](../../src/routes/deeds.js#L25) | `Deeds.buyDeed` |
| POST | `/v1/deeds/claim` | authenticated | enterprise-logistics | [src/routes/deeds.js:11](../../src/routes/deeds.js#L11) | `Deeds.claimDeed` |
| POST | `/v1/deeds/corner` | authenticated | enterprise-logistics | [src/routes/deeds.js:15](../../src/routes/deeds.js#L15) | `Deeds.collectCorner` |
| POST | `/v1/deeds/extract` | authenticated | chain-economy | [src/server.js:3539](../../src/server.js#L3539) | `Chain.requestDeedWithdraw` |
| POST | `/v1/deeds/list` | authenticated | enterprise-logistics | [src/routes/deeds.js:21](../../src/routes/deeds.js#L21) | `Deeds.listDeed` |
| GET | `/v1/deeds/plate/:tokenId` | public | enterprise-logistics | [src/server.js:758](../../src/server.js#L758) | `Deeds.deedByToken` |
| POST | `/v1/deeds/shakedown/:targetCharacterId` | authenticated | enterprise-logistics | [src/routes/deeds.js:17](../../src/routes/deeds.js#L17) | `Deeds.shakedownCorner` |
| POST | `/v1/deeds/unlist` | authenticated | enterprise-logistics | [src/routes/deeds.js:23](../../src/routes/deeds.js#L23) | `Deeds.unlistDeed` |
| POST | `/v1/deeds/upgrade` | authenticated | platform-core | [src/server.js:3537](../../src/server.js#L3537) | `DeedUpgrades.upgradeDeed` |
| GET | `/v1/deeds/vault/:sellerCharacterId` | authenticated | enterprise-logistics | [src/routes/deeds.js:33](../../src/routes/deeds.js#L33) | `Deeds.deedVaultRecord` |
| GET | `/v1/defi` | public | platform-core | [src/routes/defi.js:29](../../src/routes/defi.js#L29) | — |
| POST | `/v1/defi/tx` | public | platform-core | [src/routes/defi.js:41](../../src/routes/defi.js#L41) | — |
| GET | `/v1/deliveries` | authenticated | platform-core | [src/routes/delivery.js:6](../../src/routes/delivery.js#L6) | `Delivery.deliveryBoard` |
| POST | `/v1/deliveries/:id/deliver` | authenticated | platform-core | [src/routes/delivery.js:13](../../src/routes/delivery.js#L13) | `deliverOwnedAdvance` |
| POST | `/v1/deliveries/:id/depot/:depotId/buy` | authenticated | platform-core | [src/routes/delivery.js:17](../../src/routes/delivery.js#L17) | `Delivery.buyCommittedFromDepot` |
| POST | `/v1/deliveries/:id/expire` | authenticated | platform-core | [src/routes/delivery.js:15](../../src/routes/delivery.js#L15) | `Delivery.expireCommitment` |
| GET | `/v1/delivery-finance` | authenticated | platform-core | [src/routes/deliveryfinance.js:36](../../src/routes/deliveryfinance.js#L36) | `Finance.deliveryFinanceBoard` |
| POST | `/v1/delivery-finance/:id/cancel` | authenticated | platform-core | [src/routes/deliveryfinance.js:63](../../src/routes/deliveryfinance.js#L63) | `Finance.cancelRequestedDeliveryAdvance` |
| POST | `/v1/delivery-finance/:id/offer` | authenticated | platform-core | [src/routes/deliveryfinance.js:46](../../src/routes/deliveryfinance.js#L46) | `Finance.offerDeliveryAdvance` |
| POST | `/v1/delivery-finance/:id/take` | authenticated | platform-core | [src/routes/deliveryfinance.js:53](../../src/routes/deliveryfinance.js#L53) | `Finance.takeDeliveryAdvance` |
| POST | `/v1/delivery-finance/requests` | authenticated | platform-core | [src/routes/deliveryfinance.js:40](../../src/routes/deliveryfinance.js#L40) | `Finance.requestDeliveryAdvance` |
| GET | `/v1/depot` | authenticated | platform-core | [src/routes/depot.js:19](../../src/routes/depot.js#L19) | `Depot.depotState` |
| POST | `/v1/depot` | authenticated | platform-core | [src/routes/depot.js:21](../../src/routes/depot.js#L21) | `Depot.openDepot` |
| POST | `/v1/depot/:id/buy` | authenticated | platform-core | [src/routes/depot.js:41](../../src/routes/depot.js#L41) | `Depot.buyFromDepot` |
| POST | `/v1/depot/:id/close` | authenticated | platform-core | [src/routes/depot.js:39](../../src/routes/depot.js#L39) | `controlled` |
| POST | `/v1/depot/:id/configure` | authenticated | platform-core | [src/routes/depot.js:23](../../src/routes/depot.js#L23) | `controlled` |
| POST | `/v1/depot/:id/external-costs` | authenticated | platform-core | [src/routes/depot.js:16](../../src/routes/depot.js#L16) | `G.withCharacter` |
| POST | `/v1/depot/:id/franchise-offers` | authenticated | platform-core | [src/routes/franchises.js:11](../../src/routes/franchises.js#L11) | `Franchise.offerFranchiseLicense` |
| POST | `/v1/depot/:id/fund` | authenticated | platform-core | [src/routes/depot.js:25](../../src/routes/depot.js#L25) | `controlled` |
| POST | `/v1/depot/:id/orders/:orderId/cancel` | authenticated | platform-core | [src/routes/depot.js:35](../../src/routes/depot.js#L35) | `controlled` |
| POST | `/v1/depot/:id/orders/:orderId/receive` | authenticated | platform-core | [src/routes/depot.js:32](../../src/routes/depot.js#L32) | `Depot.receiveDepot` |
| POST | `/v1/depot/:id/orders/:orderId/tender` | authenticated | platform-core | [src/routes/supplytenders.js:8](../../src/routes/supplytenders.js#L8) | `Tender.publishSupplyTender` |
| POST | `/v1/depot/:id/policy` | authenticated | platform-core | [src/routes/depot.js:12](../../src/routes/depot.js#L12) | `G.withCharacter` |
| POST | `/v1/depot/:id/restock` | authenticated | platform-core | [src/routes/depot.js:29](../../src/routes/depot.js#L29) | `Depot.restockDepot` |
| POST | `/v1/depot/:id/stock/withdraw` | authenticated | platform-core | [src/routes/depot.js:37](../../src/routes/depot.js#L37) | `controlled` |
| POST | `/v1/depot/:id/supply-contract` | authenticated | platform-core | [src/routes/depot.js:14](../../src/routes/depot.js#L14) | `G.withCharacter` |
| POST | `/v1/depot/:id/warehouse-offer` | authenticated | platform-core | [src/routes/warehouses.js:11](../../src/routes/warehouses.js#L11) | `Warehouse.configureWarehouseOffer` |
| POST | `/v1/depot/:id/withdraw` | authenticated | platform-core | [src/routes/depot.js:27](../../src/routes/depot.js#L27) | `controlled` |
| GET | `/v1/depots` | public | platform-core | [src/routes/depot.js:18](../../src/routes/depot.js#L18) | `Depot.depotPilotEnabled` |
| GET | `/v1/desk` | public | platform-core | [src/server.js:1739](../../src/server.js#L1739) | `Desk.deskBoard` |
| GET | `/v1/digest` | authenticated | engagement-growth | [src/server.js:3338](../../src/server.js#L3338) | `Dispatch.getDigestPrefs` |
| POST | `/v1/digest` | authenticated | engagement-growth | [src/server.js:3339](../../src/server.js#L3339) | `Dispatch.setDigestPrefs` |
| GET | `/v1/digest/confirm` | public | engagement-growth | [src/server.js:3343](../../src/server.js#L3343) | `Dispatch.confirmEmail` |
| GET | `/v1/digest/unsubscribe` | public | engagement-growth | [src/server.js:3353](../../src/server.js#L3353) | `Dispatch.unsubscribe` |
| GET | `/v1/diplomacy` | authenticated | platform-core | [src/routes/diplomacy.js:10](../../src/routes/diplomacy.js#L10) | `Diplomacy.diplomacyBoard` |
| POST | `/v1/diplomacy/coalition/:gangId` | authenticated | platform-core | [src/routes/diplomacy.js:18](../../src/routes/diplomacy.js#L18) | `Diplomacy.formCoalition` |
| DELETE | `/v1/diplomacy/coalition/:id` | authenticated | platform-core | [src/routes/diplomacy.js:22](../../src/routes/diplomacy.js#L22) | `Diplomacy.leaveCoalition` |
| POST | `/v1/diplomacy/coalition/:id/join` | authenticated | platform-core | [src/routes/diplomacy.js:20](../../src/routes/diplomacy.js#L20) | `Diplomacy.joinCoalition` |
| DELETE | `/v1/diplomacy/pact/:gangId` | authenticated | platform-core | [src/routes/diplomacy.js:16](../../src/routes/diplomacy.js#L16) | `Diplomacy.breakPact` |
| POST | `/v1/diplomacy/pact/:gangId` | authenticated | platform-core | [src/routes/diplomacy.js:12](../../src/routes/diplomacy.js#L12) | `Diplomacy.proposePact` |
| POST | `/v1/diplomacy/pact/:gangId/accept` | authenticated | platform-core | [src/routes/diplomacy.js:14](../../src/routes/diplomacy.js#L14) | `Diplomacy.acceptPact` |
| GET | `/v1/discovery` | authenticated | engagement-growth | [src/server.js:3257](../../src/server.js#L3257) | `Discovery.discoveryBoard` |
| POST | `/v1/discovery/lfg` | authenticated | engagement-growth | [src/server.js:3262](../../src/server.js#L3262) | `Discovery.setLfg` |
| GET | `/v1/districts` | public | social-combat | [src/server.js:2472](../../src/server.js#L2472) | `S.onWatch` |
| POST | `/v1/districts/:id/claim` | authenticated | social-combat | [src/server.js:1828](../../src/server.js#L1828) | `S.stakeClaim` |
| POST | `/v1/districts/:id/seize` | authenticated | social-combat | [src/server.js:1814](../../src/server.js#L1814) | `S.seizeDistrict` |
| POST | `/v1/districts/:id/watch` | authenticated | social-combat | [src/server.js:1817](../../src/server.js#L1817) | `S.setWatch` |
| GET | `/v1/drop` | authenticated | engagement-growth | [src/server.js:2552](../../src/server.js#L2552) | `Drop.dropBoard` |
| POST | `/v1/drop/claim` | authenticated | engagement-growth | [src/server.js:2554](../../src/server.js#L2554) | `Drop.claimDrop` |
| POST | `/v1/drop/solana` | authenticated | engagement-growth | [src/server.js:2561](../../src/server.js#L2561) | `Drop.claimDropSolana` |
| POST | `/v1/drop/solana/challenge` | authenticated | engagement-growth | [src/server.js:2559](../../src/server.js#L2559) | `Drop.solanaChallenge` |
| GET | `/v1/duels` | authenticated | social-combat | [src/server.js:3693](../../src/server.js#L3693) | `Duels.duelBoard` |
| POST | `/v1/duels/:targetId` | authenticated | social-combat | [src/server.js:3699](../../src/server.js#L3699) | `Duels.challenge` |
| POST | `/v1/duels/list` | authenticated | social-combat | [src/server.js:3695](../../src/server.js#L3695) | `Duels.listDuel` |
| POST | `/v1/duels/style` | authenticated | social-combat | [src/server.js:3697](../../src/server.js#L3697) | `Duels.pickStyle` |
| GET | `/v1/dynasty` | authenticated | chain-economy | [src/server.js:3416](../../src/server.js#L3416) | `Dynasty.dynastyBoard` |
| POST | `/v1/dynasty/accept/:accountId` | authenticated | chain-economy | [src/server.js:3420](../../src/server.js#L3420) | `Dynasty.acceptMarriage` |
| DELETE | `/v1/dynasty/consigliere` | authenticated | chain-economy | [src/server.js:3428](../../src/server.js#L3428) | `Dynasty.endConsigliere` |
| POST | `/v1/dynasty/consigliere/:characterId` | authenticated | chain-economy | [src/server.js:3424](../../src/server.js#L3424) | `Dynasty.nameConsigliere` |
| POST | `/v1/dynasty/consigliere/accept/:accountId` | authenticated | chain-economy | [src/server.js:3426](../../src/server.js#L3426) | `Dynasty.acceptConsigliere` |
| POST | `/v1/dynasty/divorce` | authenticated | chain-economy | [src/server.js:3422](../../src/server.js#L3422) | `Dynasty.divorceMarriage` |
| POST | `/v1/dynasty/name` | authenticated | economy-ledger | [src/server.js:2308](../../src/server.js#L2308) | `Portfolio.nameDynasty` |
| POST | `/v1/dynasty/propose/:characterId` | authenticated | chain-economy | [src/server.js:3418](../../src/server.js#L3418) | `Dynasty.proposeMarriage` |
| GET | `/v1/estate` | authenticated | enterprise-logistics | [src/routes/estate.js:18](../../src/routes/estate.js#L18) | `Estate.estateBoard` |
| POST | `/v1/estate/feature/:id` | authenticated | enterprise-logistics | [src/routes/estate.js:22](../../src/routes/estate.js#L22) | `Estate.unlockFeature` |
| POST | `/v1/estate/gala` | authenticated | enterprise-logistics | [src/routes/estate.js:33](../../src/routes/estate.js#L33) | `Estate.throwGala` |
| POST | `/v1/estate/gala/attend` | authenticated | enterprise-logistics | [src/routes/estate.js:35](../../src/routes/estate.js#L35) | `Estate.attendGala` |
| POST | `/v1/estate/name` | authenticated | enterprise-logistics | [src/routes/estate.js:24](../../src/routes/estate.js#L24) | `Estate.nameEstate` |
| DELETE | `/v1/estate/staff/:id` | authenticated | enterprise-logistics | [src/routes/estate.js:29](../../src/routes/estate.js#L29) | `Estate.dismissStaff` |
| POST | `/v1/estate/staff/:id` | authenticated | enterprise-logistics | [src/routes/estate.js:27](../../src/routes/estate.js#L27) | `Estate.hireStaff` |
| POST | `/v1/estate/upgrade` | authenticated | enterprise-logistics | [src/routes/estate.js:20](../../src/routes/estate.js#L20) | `Estate.upgradeEstate` |
| POST | `/v1/estate/wages` | authenticated | enterprise-logistics | [src/routes/estate.js:31](../../src/routes/estate.js#L31) | `Estate.payStaffWages` |
| GET | `/v1/events` | public | world-progression | [src/server.js:3267](../../src/server.js#L3267) | `cityEventBoard` |
| GET | `/v1/exchange` | public | platform-core | [src/server.js:2900](../../src/server.js#L2900) | — |
| DELETE | `/v1/exchange/:id` | authenticated | social-combat | [src/server.js:2907](../../src/server.js#L2907) | `S.cancelListing` |
| POST | `/v1/exchange/:id/buy` | authenticated | social-combat | [src/server.js:2909](../../src/server.js#L2909) | `S.buyListing` |
| POST | `/v1/exchange/list` | authenticated | social-combat | [src/server.js:2905](../../src/server.js#L2905) | `S.listItem` |
| GET | `/v1/explore` | authenticated | world-progression | [src/server.js:3308](../../src/server.js#L3308) | `Explore.exploreBoard` |
| GET | `/v1/fairness` | public | economy-ledger | [src/server.js:3275](../../src/server.js#L3275) | `fairnessBoard` |
| GET | `/v1/favors` | authenticated | engagement-growth | [src/server.js:3193](../../src/server.js#L3193) | `Favors.favorBoard` |
| POST | `/v1/favors` | authenticated | engagement-growth | [src/server.js:3195](../../src/server.js#L3195) | `Favors.postFavor` |
| DELETE | `/v1/favors/:id` | authenticated | engagement-growth | [src/server.js:3199](../../src/server.js#L3199) | `Favors.cancelFavor` |
| POST | `/v1/favors/:id/run` | authenticated | engagement-growth | [src/server.js:3197](../../src/server.js#L3197) | `Favors.runFavor` |
| GET | `/v1/fees/status` | authenticated | economy-ledger | [src/server.js:3566](../../src/server.js#L3566) | `Fees.feeStatus` |
| GET | `/v1/feud/:characterId` | authenticated | platform-core | [src/server.js:2824](../../src/server.js#L2824) | `G.GameError` |
| POST | `/v1/feud/:targetId/peace` | authenticated | social-combat | [src/server.js:2845](../../src/server.js#L2845) | `S.proposePeace` |
| POST | `/v1/feud/:targetId/peace/accept` | authenticated | social-combat | [src/server.js:2847](../../src/server.js#L2847) | `S.acceptPeace` |
| GET | `/v1/firsts` | authenticated | world-progression | [src/server.js:3476](../../src/server.js#L3476) | `Firsts.firstsBoard` |
| GET | `/v1/forge` | authenticated | chain-economy | [src/server.js:3570](../../src/server.js#L3570) | `Forge.forgeBoard` |
| GET | `/v1/franchise-licenses` | authenticated | platform-core | [src/routes/franchises.js:6](../../src/routes/franchises.js#L6) | `G.readCharacter` |
| POST | `/v1/franchise-licenses/:id/accept` | authenticated | platform-core | [src/routes/franchises.js:21](../../src/routes/franchises.js#L21) | `Franchise.acceptFranchiseLicense` |
| POST | `/v1/franchise-licenses/:id/end` | authenticated | platform-core | [src/routes/franchises.js:31](../../src/routes/franchises.js#L31) | `Franchise.endFranchiseLicense` |
| GET | `/v1/gangs` | public | platform-core | [src/server.js:2419](../../src/server.js#L2419) | — |
| POST | `/v1/gangs` | authenticated | social-combat | [src/server.js:1774](../../src/server.js#L1774) | `S.createGang` |
| GET | `/v1/gangs/:id` | public | social-combat | [src/server.js:2436](../../src/server.js#L2436) | `S.resolveWarIfDue` |
| POST | `/v1/gangs/:id/join` | authenticated | social-combat | [src/server.js:1776](../../src/server.js#L1776) | `S.joinGang` |
| POST | `/v1/gangs/charter/:id` | authenticated | social-combat | [src/server.js:2885](../../src/server.js#L2885) | `S.chooseCharter` |
| GET | `/v1/gangs/chat` | authenticated | platform-core | [src/server.js:3160](../../src/server.js#L3160) | `readChat` |
| POST | `/v1/gangs/chat` | authenticated | platform-core | [src/server.js:3159](../../src/server.js#L3159) | `postChat` |
| POST | `/v1/gangs/contract/:targetId` | authenticated | social-combat | [src/server.js:2860](../../src/server.js#L2860) | `S.postFamilyContract` |
| POST | `/v1/gangs/contract/:targetId/:kind/cancel` | authenticated | social-combat | [src/server.js:2863](../../src/server.js#L2863) | `S.cancelFamilyContract` |
| POST | `/v1/gangs/foundation` | authenticated | engagement-growth | [src/server.js:2883](../../src/server.js#L2883) | `V.buyFoundation` |
| POST | `/v1/gangs/kick` | authenticated | social-combat | [src/server.js:1787](../../src/server.js#L1787) | `S.kickMember` |
| POST | `/v1/gangs/leave` | authenticated | social-combat | [src/server.js:1778](../../src/server.js#L1778) | `S.leaveGang` |
| POST | `/v1/gangs/portfolio/dividend` | authenticated | economy-ledger | [src/server.js:2280](../../src/server.js#L2280) | `Portfolio.claimFamilyDividend` |
| POST | `/v1/gangs/portfolio/invest` | authenticated | economy-ledger | [src/server.js:2274](../../src/server.js#L2274) | `Portfolio.familyInvest` |
| POST | `/v1/gangs/portfolio/name` | authenticated | economy-ledger | [src/server.js:2306](../../src/server.js#L2306) | `Portfolio.nameFamilyDynasty` |
| POST | `/v1/gangs/promote` | authenticated | social-combat | [src/server.js:1805](../../src/server.js#L1805) | `S.promoteMember` |
| POST | `/v1/gangs/tribute` | authenticated | social-combat | [src/server.js:1807](../../src/server.js#L1807) | `S.tribute` |
| POST | `/v1/gangs/tribute/omr` | authenticated | social-combat | [src/server.js:1810](../../src/server.js#L1810) | `S.tributeOmr` |
| POST | `/v1/gangs/vanity/color` | authenticated | engagement-growth | [src/server.js:2877](../../src/server.js#L2877) | `V.recolorGang` |
| POST | `/v1/gangs/vanity/name` | authenticated | engagement-growth | [src/server.js:2879](../../src/server.js#L2879) | `V.renameGang` |
| POST | `/v1/gangs/vanity/seal` | authenticated | engagement-growth | [src/server.js:2881](../../src/server.js#L2881) | `V.buySeal` |
| POST | `/v1/gangs/war/:targetGangId` | authenticated | social-combat | [src/server.js:1812](../../src/server.js#L1812) | `S.declareWar` |
| POST | `/v1/garage/:carId/fence` | authenticated | economy-ledger | [src/server.js:1695](../../src/server.js#L1695) | `E.fenceCar` |
| POST | `/v1/garage/:carId/melt` | authenticated | economy-ledger | [src/server.js:1691](../../src/server.js#L1691) | `E.meltCar` |
| POST | `/v1/garage/:carId/repair` | authenticated | economy-ledger | [src/server.js:1693](../../src/server.js#L1693) | `E.repairCar` |
| POST | `/v1/garage/boost` | authenticated | economy-ledger | [src/server.js:1689](../../src/server.js#L1689) | `E.boostCar` |
| POST | `/v1/gear/:id/mint` | authenticated | chain-economy | [src/server.js:1758](../../src/server.js#L1758) | `E.mintGear` |
| POST | `/v1/gear/:id/withdraw` | authenticated | chain-economy | [src/server.js:3527](../../src/server.js#L3527) | `Chain.requestGearWithdraw` |
| GET | `/v1/genesis-auction` | public | platform-core | [src/routes/genesisauction.js:30](../../src/routes/genesisauction.js#L30) | `unavailable` |
| POST | `/v1/genesis-auction/tx` | public | platform-core | [src/routes/genesisauction.js:40](../../src/routes/genesisauction.js#L40) | `unavailable` |
| POST | `/v1/goods/buy` | authenticated | economy-ledger | [src/server.js:1707](../../src/server.js#L1707) | `E.buyGood` |
| POST | `/v1/goods/sell` | authenticated | economy-ledger | [src/server.js:1709](../../src/server.js#L1709) | `E.sellGood` |
| POST | `/v1/heal` | authenticated | platform-core | [src/server.js:1646](../../src/server.js#L1646) | `G.withCharacter` |
| POST | `/v1/heist` | authenticated | engagement-growth | [src/server.js:3372](../../src/server.js#L3372) | `W.heist` |
| GET | `/v1/heists` | authenticated | social-combat | [src/routes/heists.js:10](../../src/routes/heists.js#L10) | `Heists.heistBoard` |
| POST | `/v1/heists/:id/case` | authenticated | social-combat | [src/routes/heists.js:24](../../src/routes/heists.js#L24) | `Heists.caseJob` |
| POST | `/v1/heists/:id/execute` | authenticated | social-combat | [src/routes/heists.js:28](../../src/routes/heists.js#L28) | `Heists.executeHeist` |
| POST | `/v1/heists/:id/fill` | authenticated | social-combat | [src/routes/heists.js:22](../../src/routes/heists.js#L22) | `Heists.fillHeist` |
| POST | `/v1/heists/:id/join` | authenticated | social-combat | [src/routes/heists.js:18](../../src/routes/heists.js#L18) | `Heists.joinHeist` |
| POST | `/v1/heists/:id/leave` | authenticated | social-combat | [src/routes/heists.js:20](../../src/routes/heists.js#L20) | `Heists.leaveHeist` |
| POST | `/v1/heists/:id/rat` | authenticated | social-combat | [src/routes/heists.js:26](../../src/routes/heists.js#L26) | `Heists.ratHeist` |
| POST | `/v1/heists/fence` | authenticated | social-combat | [src/routes/heists.js:30](../../src/routes/heists.js#L30) | `Heists.fenceLoot` |
| POST | `/v1/heists/plan` | authenticated | social-combat | [src/routes/heists.js:15](../../src/routes/heists.js#L15) | `Heists.planHeist` |
| GET | `/v1/home` | authenticated | engagement-growth | [src/server.js:2534](../../src/server.js#L2534) | `Home.homeBoard` |
| GET | `/v1/hustle` | authenticated | platform-core | [src/server.js:1634](../../src/server.js#L1634) | `Hustle.hustleBoard` |
| POST | `/v1/hustle/advance` | authenticated | platform-core | [src/server.js:1636](../../src/server.js#L1636) | `Hustle.advanceHustle` |
| GET | `/v1/identity/:characterId` | public | platform-core | [src/server.js:726](../../src/server.js#L726) | — |
| GET | `/v1/identity/:characterId/portrait.svg` | public | platform-core | [src/server.js:713](../../src/server.js#L713) | — |
| POST | `/v1/identity/bio` | authenticated | engagement-growth | [src/server.js:3398](../../src/server.js#L3398) | `W.setBio` |
| POST | `/v1/identity/checkout` | authenticated | platform-core | [src/server.js:3547](../../src/server.js#L3547) | `characterCheckout` |
| POST | `/v1/identity/claim/calldata` | authenticated | platform-core | [src/server.js:3549](../../src/server.js#L3549) | `characterClaim` |
| POST | `/v1/identity/mint` | authenticated | chain-economy | [src/server.js:3545](../../src/server.js#L3545) | `Chain.requestDynastyMint` |
| GET | `/v1/identity/readiness` | authenticated | platform-core | [src/server.js:3548](../../src/server.js#L3548) | `characterReadiness` |
| GET | `/v1/intel-forecasts` | authenticated | platform-core | [src/routes/intelforecasts.js:5](../../src/routes/intelforecasts.js#L5) | `Intel.intelForecastJobBoard` |
| POST | `/v1/intel-forecasts/:id/cancel` | authenticated | platform-core | [src/routes/intelforecasts.js:27](../../src/routes/intelforecasts.js#L27) | `Intel.cancelIntelForecastJob` |
| POST | `/v1/intel-forecasts/:id/report` | authenticated | platform-core | [src/routes/intelforecasts.js:14](../../src/routes/intelforecasts.js#L14) | `Intel.replayIntelForecastReport` |
| POST | `/v1/intel-forecasts/:id/resolve` | authenticated | platform-core | [src/routes/intelforecasts.js:30](../../src/routes/intelforecasts.js#L30) | `Intel.resolveIntelForecastOutcome` |
| POST | `/v1/intel-forecasts/reporters/:id/jobs` | authenticated | platform-core | [src/routes/intelforecasts.js:11](../../src/routes/intelforecasts.js#L11) | `Intel.createIntelForecastJob` |
| GET | `/v1/invites` | authenticated | platform-core | [src/server.js:3207](../../src/server.js#L3207) | `Invites.inviteBoard` |
| POST | `/v1/invites` | authenticated | platform-core | [src/server.js:3211](../../src/server.js#L3211) | `Invites.issueCrewInvite` |
| POST | `/v1/items/:id/use` | authenticated | economy-ledger | [src/server.js:1703](../../src/server.js#L1703) | `E.useItem` |
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
| GET | `/v1/landmarks` | public | world-progression | [src/server.js:2331](../../src/server.js#L2331) | `Landmarks.landmarkBoard` |
| POST | `/v1/landmarks/:districtId` | authenticated | world-progression | [src/server.js:2332](../../src/server.js#L2332) | `Landmarks.dedicateLandmark` |
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
| GET | `/v1/leaderboard/contacts` | authenticated | engagement-growth | [src/server.js:3180](../../src/server.js#L3180) | `Contacts.contactsLeaderboard` |
| GET | `/v1/leaderboard/convoy` | authenticated | enterprise-logistics | [src/routes/leaderboards.js:65](../../src/routes/leaderboards.js#L65) | `Convoy.convoyLeaderboard` |
| GET | `/v1/leaderboard/crews` | authenticated | social-combat | [src/server.js:3250](../../src/server.js#L3250) | `Crew.crewLeaderboard` |
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
| GET | `/v1/leaderboard/mentors` | authenticated | social-combat | [src/server.js:3289](../../src/server.js#L3289) | `Mentor.mentorLeaderboard` |
| GET | `/v1/leaderboard/nightlife` | authenticated | vice-competition | [src/routes/leaderboards.js:45](../../src/routes/leaderboards.js#L45) | `Speakeasy.nightlifeLeaderboard` |
| GET | `/v1/leaderboard/patrons` | authenticated | platform-core | [src/routes/leaderboards.js:107](../../src/routes/leaderboards.js#L107) | `Store.benefactorLeaderboard` |
| GET | `/v1/leaderboard/port` | authenticated | enterprise-logistics | [src/routes/leaderboards.js:55](../../src/routes/leaderboards.js#L55) | `Port.portLeaderboard` |
| GET | `/v1/leaderboard/portfolio` | authenticated | economy-ledger | [src/routes/leaderboards.js:58](../../src/routes/leaderboards.js#L58) | `Portfolio.portfolioLeaderboard` |
| GET | `/v1/leaderboard/races` | authenticated | vice-competition | [src/routes/leaderboards.js:54](../../src/routes/leaderboards.js#L54) | `Races.raceLeaderboard` |
| GET | `/v1/leaderboard/recruiters` | authenticated | platform-core | [src/routes/leaderboards.js:83](../../src/routes/leaderboards.js#L83) | `recruitersBoard` |
| GET | `/v1/leaderboard/sov` | authenticated | world-progression | [src/routes/leaderboards.js:95](../../src/routes/leaderboards.js#L95) | `Sov.sovLeaderboard` |
| GET | `/v1/leaderboard/stable` | authenticated | vice-competition | [src/routes/leaderboards.js:53](../../src/routes/leaderboards.js#L53) | `Stable.stableLeaderboard` |
| GET | `/v1/leaderboard/statesmen` | authenticated | platform-core | [src/routes/leaderboards.js:56](../../src/routes/leaderboards.js#L56) | `Commission.statesmenLeaderboard` |
| GET | `/v1/leaderboard/streak` | authenticated | world-progression | [src/server.js:3296](../../src/server.js#L3296) | `Streak.streakLeaderboard` |
| GET | `/v1/leaderboard/streets` | authenticated | enterprise-logistics | [src/routes/leaderboards.js:62](../../src/routes/leaderboards.js#L62) | `Deeds.greatStreetsLeaderboard` |
| GET | `/v1/leaderboard/territory` | authenticated | enterprise-logistics | [src/routes/leaderboards.js:43](../../src/routes/leaderboards.js#L43) | `Territory.territoryLeaderboard` |
| GET | `/v1/leaderboard/trades` | authenticated | world-progression | [src/routes/leaderboards.js:94](../../src/routes/leaderboards.js#L94) | `Mastery.tradesLeaderboard` |
| GET | `/v1/leaderboard/tycoons` | authenticated | economy-ledger | [src/routes/leaderboards.js:42](../../src/routes/leaderboards.js#L42) | `E.tycoonLeaderboard` |
| GET | `/v1/leaderboard/underwriters` | authenticated | platform-core | [src/routes/leaderboards.js:102](../../src/routes/leaderboards.js#L102) | `Bonds.underwriterLeaderboard` |
| GET | `/v1/leaderboard/vouches` | authenticated | social-combat | [src/server.js:3329](../../src/server.js#L3329) | `Vouch.vouchLeaderboard` |
| GET | `/v1/leaderboard/wire` | authenticated | law-intelligence | [src/routes/leaderboards.js:63](../../src/routes/leaderboards.js#L63) | `Wire.wireLeaderboard` |
| GET | `/v1/leaderboard/world` | authenticated | world-progression | [src/routes/leaderboards.js:114](../../src/routes/leaderboards.js#L114) | `World.worldLeaderboard` |
| GET | `/v1/live` | authenticated | engagement-growth | [src/server.js:3303](../../src/server.js#L3303) | `Collision.collisionBoard` |
| GET | `/v1/loans` | authenticated | enterprise-logistics | [src/server.js:2212](../../src/server.js#L2212) | `Loans.loanBoard` |
| POST | `/v1/loans` | authenticated | enterprise-logistics | [src/server.js:2216](../../src/server.js#L2216) | `Loans.offerLoan` |
| POST | `/v1/loans/:id/buy` | authenticated | enterprise-logistics | [src/server.js:2259](../../src/server.js#L2259) | `Loans.buyPaper` |
| POST | `/v1/loans/:id/cancel` | authenticated | enterprise-logistics | [src/server.js:2220](../../src/server.js#L2220) | `Loans.cancelLoan` |
| POST | `/v1/loans/:id/collect` | authenticated | enterprise-logistics | [src/server.js:2229](../../src/server.js#L2229) | `Loans.collectLoan` |
| POST | `/v1/loans/:id/repay` | authenticated | enterprise-logistics | [src/server.js:2223](../../src/server.js#L2223) | `Loans.repayLoan` |
| POST | `/v1/loans/:id/sell` | authenticated | enterprise-logistics | [src/server.js:2235](../../src/server.js#L2235) | `Loans.sellPaper` |
| POST | `/v1/loans/:id/take` | authenticated | platform-core | [src/server.js:2218](../../src/server.js#L2218) | `takeOwnedAdvance` |
| POST | `/v1/loans/:id/unsell` | authenticated | enterprise-logistics | [src/server.js:2237](../../src/server.js#L2237) | `Loans.unsellPaper` |
| POST | `/v1/loans/house` | authenticated | enterprise-logistics | [src/server.js:2241](../../src/server.js#L2241) | `Loans.takeHouseLoan` |
| POST | `/v1/loans/house/repay` | authenticated | enterprise-logistics | [src/server.js:2243](../../src/server.js#L2243) | `Loans.repayHouseLoan` |
| POST | `/v1/loans/square` | authenticated | enterprise-logistics | [src/server.js:2256](../../src/server.js#L2256) | `Loans.squareWanted` |
| GET | `/v1/logistics-coverage` | authenticated | platform-core | [src/routes/logisticscoverage.js:10](../../src/routes/logisticscoverage.js#L10) | `Coverage.coverageBoard` |
| POST | `/v1/logistics-coverage/:id/accept` | authenticated | platform-core | [src/routes/logisticscoverage.js:18](../../src/routes/logisticscoverage.js#L18) | `Coverage.acceptCoverage` |
| POST | `/v1/logistics-coverage/offers` | authenticated | platform-core | [src/routes/logisticscoverage.js:12](../../src/routes/logisticscoverage.js#L12) | `Coverage.offerCoverage` |
| GET | `/v1/made` | authenticated | social-combat | [src/routes/estate.js:13](../../src/routes/estate.js#L13) | `Made.madeBoard` |
| POST | `/v1/made` | authenticated | social-combat | [src/routes/estate.js:15](../../src/routes/estate.js#L15) | `Made.payDues` |
| GET | `/v1/map` | authenticated | world-progression | [src/server.js:2516](../../src/server.js#L2516) | `CityMap.cityMap` |
| GET | `/v1/market` | public | economy-ledger | [src/server.js:2371](../../src/server.js#L2371) | `Market.marketBoard` |
| POST | `/v1/market` | authenticated | economy-ledger | [src/server.js:2372](../../src/server.js#L2372) | `Market.listItem` |
| POST | `/v1/market/:id/accept-delivery` | authenticated | platform-core | [src/routes/delivery.js:11](../../src/routes/delivery.js#L11) | `Delivery.acceptDelivery` |
| POST | `/v1/market/:id/bid` | authenticated | economy-ledger | [src/server.js:2374](../../src/server.js#L2374) | `Market.bidListing` |
| POST | `/v1/market/:id/buy` | authenticated | economy-ledger | [src/server.js:2376](../../src/server.js#L2376) | `Market.buyListing` |
| POST | `/v1/market/:id/cancel` | authenticated | economy-ledger | [src/server.js:2378](../../src/server.js#L2378) | `Market.cancelListing` |
| POST | `/v1/market/:id/claim` | authenticated | economy-ledger | [src/server.js:2386](../../src/server.js#L2386) | `Market.claimOrder` |
| POST | `/v1/market/:id/fill` | authenticated | economy-ledger | [src/server.js:2384](../../src/server.js#L2384) | `Market.fillOrder` |
| GET | `/v1/market/feed` | public | platform-core | [src/routes/marketfeed.js:4](../../src/routes/marketfeed.js#L4) | `publicMarketFeed` |
| POST | `/v1/market/order` | authenticated | economy-ledger | [src/server.js:2382](../../src/server.js#L2382) | `Market.postOrder` |
| GET | `/v1/market/prices` | public | social-combat | [src/server.js:3617](../../src/server.js#L3617) | `Block.marketPrices` |
| GET | `/v1/mastery` | authenticated | world-progression | [src/server.js:2193](../../src/server.js#L2193) | `Mastery.masteryBoard` |
| POST | `/v1/mastery/trait/:trackId` | authenticated | world-progression | [src/server.js:2195](../../src/server.js#L2195) | `Mastery.chooseTrait` |
| GET | `/v1/me` | authenticated | platform-core | [src/server.js:1604](../../src/server.js#L1604) | `G.readCharacter` |
| GET | `/v1/megaproject` | authenticated | enterprise-logistics | [src/server.js:3683](../../src/server.js#L3683) | `Mega.megaBoard` |
| POST | `/v1/megaproject/cash` | authenticated | enterprise-logistics | [src/server.js:3684](../../src/server.js#L3684) | `Mega.giveCash` |
| POST | `/v1/megaproject/goods` | authenticated | enterprise-logistics | [src/server.js:3686](../../src/server.js#L3686) | `Mega.giveGoods` |
| POST | `/v1/megaproject/omr` | authenticated | enterprise-logistics | [src/server.js:3688](../../src/server.js#L3688) | `Mega.giveOmr` |
| GET | `/v1/mentor` | authenticated | social-combat | [src/server.js:3277](../../src/server.js#L3277) | `Mentor.mentorBoard` |
| POST | `/v1/mentor/accept/:mentorCharId` | authenticated | social-combat | [src/server.js:3283](../../src/server.js#L3283) | `Mentor.acceptMentor` |
| POST | `/v1/mentor/claim` | authenticated | social-combat | [src/server.js:3285](../../src/server.js#L3285) | `Mentor.claimMentor` |
| POST | `/v1/mentor/gift/:protegeCharId` | authenticated | social-combat | [src/server.js:3287](../../src/server.js#L3287) | `Mentor.mentorGift` |
| POST | `/v1/mentor/offer/:characterId` | authenticated | social-combat | [src/server.js:3281](../../src/server.js#L3281) | `Mentor.offerMentor` |
| POST | `/v1/mentor/seeking` | authenticated | social-combat | [src/server.js:3279](../../src/server.js#L3279) | `Mentor.seekMentor` |
| POST | `/v1/missions/:id` | authenticated | engagement-growth | [src/server.js:3374](../../src/server.js#L3374) | `W.doMission` |
| GET | `/v1/mod/actions` | moderator | platform-core | [src/server.js:1085](../../src/server.js#L1085) | — |
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
| GET | `/v1/mod/brokers` | moderator | platform-core | [src/server.js:2343](../../src/server.js#L2343) | `Brokers.epochBoard` |
| POST | `/v1/mod/brokers/allocate` | moderator | platform-core | [src/server.js:2344](../../src/server.js#L2344) | `Brokers.allocateEpoch` |
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
| GET | `/v1/mod/exchange` | moderator | economy-ledger | [src/server.js:1740](../../src/server.js#L1740) | `Exchange.exchangePool` |
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
| POST | `/v1/mod/resources/auctions` | moderator | platform-core | [src/routes/resources.js:82](../../src/routes/resources.js#L82) | `createResourceRound` |
| POST | `/v1/mod/resources/auctions/:id/settle` | moderator | platform-core | [src/routes/resources.js:83](../../src/routes/resources.js#L83) | `settleResourceRound` |
| POST | `/v1/mod/resources/jobs/:id/adjudicate` | moderator | platform-core | [src/routes/resources.js:84](../../src/routes/resources.js#L84) | `adjudicateResourceJob` |
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
| GET | `/v1/nft` | authenticated | platform-core | [src/server.js:3530](../../src/server.js#L3530) | `G.readCharacter` |
| POST | `/v1/nft/:kind/:id/upgrade` | authenticated | platform-core | [src/server.js:3531](../../src/server.js#L3531) | `G.withCharacter` |
| POST | `/v1/nft/:kind/:id/withdraw` | authenticated | chain-economy | [src/server.js:3533](../../src/server.js#L3533) | `Chain.requestItemWithdraw` |
| GET | `/v1/notifications` | authenticated | platform-core | [src/server.js:2917](../../src/server.js#L2917) | — |
| GET | `/v1/npcfamily` | authenticated | world-progression | [src/server.js:3713](../../src/server.js#L3713) | `NpcWar.warBoard` |
| POST | `/v1/npcfamily/:gangId/raid` | authenticated | world-progression | [src/server.js:3715](../../src/server.js#L3715) | `NpcWar.raidFamily` |
| POST | `/v1/npcfamily/:gangId/war` | authenticated | world-progression | [src/server.js:3720](../../src/server.js#L3720) | `NpcWar.declareNpcWar` |
| POST | `/v1/npcfamily/collect` | authenticated | world-progression | [src/server.js:3717](../../src/server.js#L3717) | `NpcWar.collectFamilyTribute` |
| GET | `/v1/onboard` | authenticated | engagement-growth | [src/server.js:3383](../../src/server.js#L3383) | `W.onboardBoard` |
| POST | `/v1/onboard/:taskId/claim` | authenticated | engagement-growth | [src/server.js:3485](../../src/server.js#L3485) | `W.claimOnboard` |
| GET | `/v1/online` | public | platform-core | [src/server.js:3036](../../src/server.js#L3036) | — |
| GET | `/v1/opportunities` | authenticated | engagement-growth | [src/server.js:2644](../../src/server.js#L2644) | `opportunityBoard` |
| GET | `/v1/paper` | authenticated | engagement-growth | [src/server.js:2629](../../src/server.js#L2629) | `People.paperBoard` |
| POST | `/v1/paper/read` | authenticated | engagement-growth | [src/server.js:2631](../../src/server.js#L2631) | `People.foldPaper` |
| GET | `/v1/pass` | authenticated | platform-core | [src/server.js:3600](../../src/server.js#L3600) | `Pass.passBoard` |
| POST | `/v1/pass/claim` | authenticated | platform-core | [src/server.js:3601](../../src/server.js#L3601) | `Pass.claimPass` |
| POST | `/v1/path` | authenticated | engagement-growth | [src/server.js:3367](../../src/server.js#L3367) | `W.choosePath` |
| POST | `/v1/path-quiz` | public | platform-core | [src/server.js:1329](../../src/server.js#L1329) | `G.track` |
| GET | `/v1/payroll` | authenticated | enterprise-logistics | [src/server.js:2526](../../src/server.js#L2526) | `Payroll.payrollBoard` |
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
| GET | `/v1/people` | authenticated | engagement-growth | [src/server.js:2623](../../src/server.js#L2623) | `People.peopleBoard` |
| GET | `/v1/people/history/:characterId` | authenticated | engagement-growth | [src/server.js:2625](../../src/server.js#L2625) | `People.pairHistory` |
| GET | `/v1/phone` | authenticated | platform-core | [src/server.js:3167](../../src/server.js#L3167) | `Phone.phoneBoard` |
| DELETE | `/v1/phone/block/:characterId` | authenticated | platform-core | [src/server.js:3174](../../src/server.js#L3174) | `Phone.unblockLine` |
| POST | `/v1/phone/block/:characterId` | authenticated | platform-core | [src/server.js:3172](../../src/server.js#L3172) | `Phone.blockLine` |
| POST | `/v1/phone/dm/:characterId` | authenticated | platform-core | [src/server.js:3170](../../src/server.js#L3170) | `Phone.sendDm` |
| GET | `/v1/phone/thread/:characterId` | authenticated | platform-core | [src/server.js:3168](../../src/server.js#L3168) | `Phone.readThread` |
| POST | `/v1/plex/mint` | authenticated | economy-ledger | [src/server.js:3578](../../src/server.js#L3578) | `Vig.payPlex` |
| GET | `/v1/plex/price` | public | economy-ledger | [src/server.js:3585](../../src/server.js#L3585) | `Vig.plexQuote` |
| POST | `/v1/plex/respawn` | authenticated | economy-ledger | [src/server.js:3580](../../src/server.js#L3580) | `Vig.payPlex` |
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
| GET | `/v1/portfolio` | authenticated | economy-ledger | [src/server.js:2270](../../src/server.js#L2270) | `Portfolio.portfolioBoard` |
| POST | `/v1/portfolio/dividend` | authenticated | economy-ledger | [src/server.js:2277](../../src/server.js#L2277) | `Portfolio.claimDividend` |
| POST | `/v1/portfolio/invest` | authenticated | economy-ledger | [src/server.js:2272](../../src/server.js#L2272) | `Portfolio.invest` |
| GET | `/v1/primetime` | authenticated | engagement-growth | [src/server.js:3313](../../src/server.js#L3313) | `Prime.primeTimeBoard` |
| POST | `/v1/primetime/answer` | authenticated | engagement-growth | [src/server.js:3315](../../src/server.js#L3315) | `Prime.answerCall` |
| POST | `/v1/primetime/round` | authenticated | engagement-growth | [src/server.js:3317](../../src/server.js#L3317) | `Prime.buyRound` |
| POST | `/v1/primetime/siege` | authenticated | engagement-growth | [src/server.js:3319](../../src/server.js#L3319) | `Prime.joinSiege` |
| GET | `/v1/profile` | authenticated | engagement-growth | [src/server.js:3394](../../src/server.js#L3394) | `W.myProfile` |
| GET | `/v1/projections/player` | authenticated | platform-core | [src/routes/projections.js:58](../../src/routes/projections.js#L58) | — |
| GET | `/v1/projections/world` | authenticated | platform-core | [src/routes/projections.js:63](../../src/routes/projections.js#L63) | — |
| GET | `/v1/provenance` | authenticated | engagement-growth | [src/server.js:2567](../../src/server.js#L2567) | `Drop.colorsBoard` |
| POST | `/v1/provenance` | authenticated | engagement-growth | [src/server.js:2569](../../src/server.js#L2569) | `Drop.claimColors` |
| POST | `/v1/push/subscribe` | authenticated | engagement-growth | [src/server.js:3332](../../src/server.js#L3332) | `Push.saveSubscription` |
| POST | `/v1/push/unsubscribe` | authenticated | engagement-growth | [src/server.js:3334](../../src/server.js#L3334) | `Push.removeSubscription` |
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
| DELETE | `/v1/rackets/:id` | authenticated | economy-ledger | [src/server.js:1723](../../src/server.js#L1723) | `E.retireRacket` |
| POST | `/v1/rackets/:id/buy` | authenticated | economy-ledger | [src/server.js:1713](../../src/server.js#L1713) | `E.buyRacket` |
| POST | `/v1/rackets/:id/upgrade` | authenticated | economy-ledger | [src/server.js:1720](../../src/server.js#L1720) | `E.upgradeRacket` |
| POST | `/v1/referral/claim` | authenticated | engagement-growth | [src/server.js:3391](../../src/server.js#L3391) | `W.claimReferral` |
| GET | `/v1/regimen` | authenticated | platform-core | [src/server.js:1627](../../src/server.js#L1627) | `RG.regimenBoard` |
| POST | `/v1/regimen/:id` | authenticated | platform-core | [src/server.js:1629](../../src/server.js#L1629) | `RG.trainDiscipline` |
| POST | `/v1/regimen/drill/:npc` | authenticated | platform-core | [src/server.js:1631](../../src/server.js#L1631) | `RG.claimDrill` |
| GET | `/v1/resources` | authenticated | platform-core | [src/routes/resources.js:47](../../src/routes/resources.js#L47) | — |
| GET | `/v1/resources/auctions` | public | platform-core | [src/routes/resources.js:46](../../src/routes/resources.js#L46) | `resourceAuctionBoard` |
| POST | `/v1/resources/auctions/:id/commit` | authenticated | platform-core | [src/routes/resources.js:80](../../src/routes/resources.js#L80) | `commitResourceBid` |
| POST | `/v1/resources/auctions/:id/reveal` | authenticated | platform-core | [src/routes/resources.js:81](../../src/routes/resources.js#L81) | `revealResourceBid` |
| GET | `/v1/resources/auctions/mine` | authenticated | platform-core | [src/routes/resources.js:79](../../src/routes/resources.js#L79) | `resourceAuctionBoard` |
| POST | `/v1/resources/bounties` | authenticated | platform-core | [src/routes/resources.js:39](../../src/routes/resources.js#L39) | `createResourceBounty` |
| POST | `/v1/resources/bounties/:id/award` | authenticated | platform-core | [src/routes/resources.js:41](../../src/routes/resources.js#L41) | `awardResourceBounty` |
| POST | `/v1/resources/bounties/:id/bid` | authenticated | platform-core | [src/routes/resources.js:40](../../src/routes/resources.js#L40) | `bidResourceBounty` |
| POST | `/v1/resources/bounties/:id/cancel` | authenticated | platform-core | [src/routes/resources.js:42](../../src/routes/resources.js#L42) | `cancelResourceBounty` |
| GET | `/v1/resources/business` | authenticated | platform-core | [src/routes/resources.js:35](../../src/routes/resources.js#L35) | `businessSnapshot` |
| GET | `/v1/resources/catalog` | public | platform-core | [src/routes/resources.js:44](../../src/routes/resources.js#L44) | — |
| GET | `/v1/resources/companies/:id` | public | platform-core | [src/routes/resources.js:32](../../src/routes/resources.js#L32) | `getAgentCompany` |
| GET | `/v1/resources/company` | authenticated | platform-core | [src/routes/resources.js:19](../../src/routes/resources.js#L19) | `ownAgentCompany` |
| POST | `/v1/resources/company` | authenticated | platform-core | [src/routes/resources.js:20](../../src/routes/resources.js#L20) | `setAgentCompany` |
| GET | `/v1/resources/compute` | authenticated | platform-core | [src/routes/resources.js:60](../../src/routes/resources.js#L60) | `resourceComputeState` |
| POST | `/v1/resources/compute` | authenticated | platform-core | [src/routes/resources.js:61](../../src/routes/resources.js#L61) | `runResourceCompute` |
| POST | `/v1/resources/compute/:id/reconcile` | authenticated | platform-core | [src/routes/resources.js:65](../../src/routes/resources.js#L65) | `reconcileResourceCompute` |
| GET | `/v1/resources/earnings` | authenticated | platform-core | [src/routes/resources.js:36](../../src/routes/resources.js#L36) | `resourceEarnings` |
| GET | `/v1/resources/funding` | authenticated | platform-core | [src/routes/resources.js:55](../../src/routes/resources.js#L55) | — |
| POST | `/v1/resources/funding` | authenticated | platform-core | [src/routes/resources.js:58](../../src/routes/resources.js#L58) | `createResourceFunding` |
| GET | `/v1/resources/jobs` | authenticated | platform-core | [src/routes/resources.js:67](../../src/routes/resources.js#L67) | `listResourceJobs` |
| POST | `/v1/resources/jobs` | authenticated | platform-core | [src/routes/resources.js:69](../../src/routes/resources.js#L69) | `createResourceJob` |
| GET | `/v1/resources/jobs/:id` | authenticated | platform-core | [src/routes/resources.js:68](../../src/routes/resources.js#L68) | `getResourceJob` |
| POST | `/v1/resources/jobs/:id/accept` | authenticated | platform-core | [src/routes/resources.js:77](../../src/routes/resources.js#L77) | `acceptResourceJob` |
| POST | `/v1/resources/jobs/:id/claim` | authenticated | platform-core | [src/routes/resources.js:70](../../src/routes/resources.js#L70) | `claimResourceJob` |
| POST | `/v1/resources/jobs/:id/dispute` | authenticated | platform-core | [src/routes/resources.js:78](../../src/routes/resources.js#L78) | `disputeResourceJob` |
| POST | `/v1/resources/jobs/:id/renew` | authenticated | platform-core | [src/routes/resources.js:43](../../src/routes/resources.js#L43) | `renewResourceJob` |
| POST | `/v1/resources/jobs/:id/submit` | authenticated | platform-core | [src/routes/resources.js:72](../../src/routes/resources.js#L72) | `submitResourceJob` |
| POST | `/v1/resources/jobs/:id/work` | authenticated | platform-core | [src/routes/resources.js:71](../../src/routes/resources.js#L71) | `workResourceJob` |
| GET | `/v1/resources/labor` | authenticated | platform-core | [src/routes/resources.js:37](../../src/routes/resources.js#L37) | `resourceLaborBoard` |
| GET | `/v1/resources/labor/reputation/:id` | authenticated | platform-core | [src/routes/resources.js:38](../../src/routes/resources.js#L38) | `resourceLaborReputation` |
| GET | `/v1/resources/outcomes` | authenticated | platform-core | [src/routes/resources.js:33](../../src/routes/resources.js#L33) | `resourceOutcomes` |
| POST | `/v1/resources/payments/webhook` | public | platform-core | [src/routes/resources.js:90](../../src/routes/resources.js#L90) | — |
| GET | `/v1/resources/policy` | authenticated | platform-core | [src/routes/resources.js:51](../../src/routes/resources.js#L51) | — |
| POST | `/v1/resources/policy` | authenticated | platform-core | [src/routes/resources.js:54](../../src/routes/resources.js#L54) | `setResourcePolicy` |
| POST | `/v1/resources/service` | authenticated | platform-core | [src/routes/resources.js:59](../../src/routes/resources.js#L59) | `setResourceService` |
| GET | `/v1/resources/services` | public | platform-core | [src/routes/resources.js:45](../../src/routes/resources.js#L45) | — |
| GET | `/v1/resources/storefronts/:id` | public | platform-core | [src/routes/resources.js:34](../../src/routes/resources.js#L34) | `resourceStorefront` |
| POST | `/v1/respec` | authenticated | engagement-growth | [src/server.js:3370](../../src/server.js#L3370) | `W.respec` |
| GET | `/v1/results` | public | platform-core | [src/server.js:3270](../../src/server.js#L3270) | — |
| GET | `/v1/rivals` | authenticated | social-combat | [src/server.js:2619](../../src/server.js#L2619) | `Rivals.rivalsBoard` |
| GET | `/v1/roster` | authenticated | social-combat | [src/server.js:1820](../../src/server.js#L1820) | `S.rosterOf` |
| DELETE | `/v1/roster/:post` | authenticated | social-combat | [src/server.js:1824](../../src/server.js#L1824) | `S.vacatePost` |
| POST | `/v1/roster/:post` | authenticated | social-combat | [src/server.js:1822](../../src/server.js#L1822) | `S.assignPost` |
| GET | `/v1/rules` | public | platform-core | [src/server.js:1842](../../src/server.js#L1842) | `jsonEtag` |
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
| POST | `/v1/safehouse` | authenticated | social-combat | [src/server.js:2857](../../src/server.js#L2857) | `S.enterSafehouse` |
| POST | `/v1/screens` | authenticated | platform-core | [src/server.js:1670](../../src/server.js#L1670) | `G.track` |
| GET | `/v1/season/recap` | authenticated | world-progression | [src/server.js:3623](../../src/server.js#L3623) | `Season.seasonRecaps` |
| GET | `/v1/seasons` | public | world-progression | [src/server.js:3621](../../src/server.js#L3621) | `Season.seasonBoard` |
| GET | `/v1/secrets` | authenticated | law-intelligence | [src/server.js:3442](../../src/server.js#L3442) | `Secrets.secretsBoard` |
| POST | `/v1/secrets/:id/expose` | authenticated | law-intelligence | [src/server.js:3462](../../src/server.js#L3462) | `Secrets.exposeSecret` |
| POST | `/v1/secrets/:id/extort` | authenticated | law-intelligence | [src/server.js:3446](../../src/server.js#L3446) | `Secrets.extortSecret` |
| POST | `/v1/secrets/:id/pay` | authenticated | law-intelligence | [src/server.js:3450](../../src/server.js#L3450) | `Secrets.payHush` |
| GET | `/v1/session` | authenticated | platform-core | [src/server.js:1609](../../src/server.js#L1609) | — |
| GET | `/v1/shipment` | authenticated | enterprise-logistics | [src/server.js:3479](../../src/server.js#L3479) | `Shipment.shipmentBoard` |
| POST | `/v1/shipment/commission/:id` | authenticated | enterprise-logistics | [src/server.js:3483](../../src/server.js#L3483) | `Shipment.commissionPiece` |
| POST | `/v1/shipment/take` | authenticated | enterprise-logistics | [src/server.js:3481](../../src/server.js#L3481) | `Shipment.takeShipment` |
| GET | `/v1/skills` | authenticated | world-progression | [src/server.js:2190](../../src/server.js#L2190) | `Skills.skillsBoard` |
| POST | `/v1/skills/:id` | authenticated | world-progression | [src/server.js:2204](../../src/server.js#L2204) | `Skills.learnSkill` |
| POST | `/v1/skills/active/:ability` | authenticated | world-progression | [src/server.js:2200](../../src/server.js#L2200) | `Skills.useActive` |
| POST | `/v1/skills/respec` | authenticated | world-progression | [src/server.js:2197](../../src/server.js#L2197) | `Skills.respecSkills` |
| POST | `/v1/skills/respec/:id` | authenticated | world-progression | [src/server.js:2202](../../src/server.js#L2202) | `Skills.respecOne` |
| GET | `/v1/social` | authenticated | engagement-growth | [src/server.js:3488](../../src/server.js#L3488) | `W.socialBoard` |
| POST | `/v1/social/:taskId/claim` | authenticated | engagement-growth | [src/server.js:3492](../../src/server.js#L3492) | `W.claimSocial` |
| GET | `/v1/soldiers` | authenticated | social-combat | [src/server.js:3431](../../src/server.js#L3431) | `Soldiers.soldierBoard` |
| DELETE | `/v1/soldiers/:id` | authenticated | social-combat | [src/server.js:3439](../../src/server.js#L3439) | `Soldiers.dismissSoldier` |
| POST | `/v1/soldiers/:id/assign` | authenticated | social-combat | [src/server.js:3435](../../src/server.js#L3435) | `Soldiers.assignSoldier` |
| POST | `/v1/soldiers/hire` | authenticated | social-combat | [src/server.js:3433](../../src/server.js#L3433) | `Soldiers.hireSoldier` |
| POST | `/v1/soldiers/unassign` | authenticated | social-combat | [src/server.js:3437](../../src/server.js#L3437) | `Soldiers.unassignSoldier` |
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
| POST | `/v1/stake` | authenticated | economy-ledger | [src/server.js:1748](../../src/server.js#L1748) | `E.stake` |
| POST | `/v1/stake/lock` | authenticated | economy-ledger | [src/server.js:1754](../../src/server.js#L1754) | `E.lockStake` |
| GET | `/v1/store` | authenticated | platform-core | [src/server.js:3592](../../src/server.js#L3592) | `Store.storeBoard` |
| POST | `/v1/store/plex/:sku` | authenticated | platform-core | [src/server.js:3594](../../src/server.js#L3594) | `Store.payPackagePlex` |
| GET | `/v1/strategies` | public | platform-core | [src/routes/strategylicenses.js:10](../../src/routes/strategylicenses.js#L10) | `Strategy.strategyCatalog` |
| POST | `/v1/strategies` | authenticated | platform-core | [src/routes/strategylicenses.js:13](../../src/routes/strategylicenses.js#L13) | `Strategy.publishStrategy` |
| POST | `/v1/strategies/:id/buy` | authenticated | platform-core | [src/routes/strategylicenses.js:15](../../src/routes/strategylicenses.js#L15) | `Strategy.buyStrategy` |
| POST | `/v1/strategies/:id/resolve` | authenticated | platform-core | [src/routes/strategylicenses.js:25](../../src/routes/strategylicenses.js#L25) | `Strategy.resolveStrategyHoldout` |
| GET | `/v1/strategies/library` | authenticated | platform-core | [src/routes/strategylicenses.js:11](../../src/routes/strategylicenses.js#L11) | `Strategy.strategyLibrary` |
| GET | `/v1/strategy-leagues` | public | platform-core | [src/routes/strategyleagues.js:10](../../src/routes/strategyleagues.js#L10) | `League.strategyLeagueBoard` |
| POST | `/v1/strategy-leagues` | authenticated | platform-core | [src/routes/strategyleagues.js:13](../../src/routes/strategyleagues.js#L13) | `League.createStrategyLeague` |
| POST | `/v1/strategy-leagues/:id/join` | authenticated | platform-core | [src/routes/strategyleagues.js:15](../../src/routes/strategyleagues.js#L15) | `League.joinStrategyLeague` |
| GET | `/v1/strategy-leagues/own` | authenticated | platform-core | [src/routes/strategyleagues.js:11](../../src/routes/strategyleagues.js#L11) | `League.strategyLeagueBoard` |
| GET | `/v1/streak` | authenticated | world-progression | [src/server.js:3292](../../src/server.js#L3292) | `Streak.streakBoard` |
| POST | `/v1/streak/claim` | authenticated | world-progression | [src/server.js:3294](../../src/server.js#L3294) | `Streak.claimStreak` |
| GET | `/v1/streets` | authenticated | platform-core | [src/server.js:2574](../../src/server.js#L2574) | — |
| POST | `/v1/streets/:targetId/boat` | authenticated | social-combat | [src/server.js:2615](../../src/server.js#L2615) | `S.stealBoat` |
| POST | `/v1/streets/:targetId/bounty` | authenticated | social-combat | [src/server.js:2633](../../src/server.js#L2633) | `S.postBounty` |
| POST | `/v1/streets/:targetId/bust` | authenticated | social-combat | [src/server.js:2896](../../src/server.js#L2896) | `S.bust` |
| POST | `/v1/streets/:targetId/fire` | authenticated | social-combat | [src/server.js:2891](../../src/server.js#L2891) | `S.fire` |
| POST | `/v1/streets/:targetId/jump` | authenticated | social-combat | [src/server.js:2606](../../src/server.js#L2606) | `S.jump` |
| POST | `/v1/streets/:targetId/npchit` | authenticated | social-combat | [src/server.js:2849](../../src/server.js#L2849) | `S.npcHit` |
| POST | `/v1/streets/:targetId/sabotage` | authenticated | social-combat | [src/server.js:2617](../../src/server.js#L2617) | `S.sabotage` |
| POST | `/v1/streets/:targetId/search` | authenticated | social-combat | [src/server.js:2887](../../src/server.js#L2887) | `S.startSearch` |
| POST | `/v1/streets/:targetId/steal` | authenticated | social-combat | [src/server.js:2610](../../src/server.js#L2610) | `S.stealCar` |
| POST | `/v1/streets/:targetId/trunk` | authenticated | social-combat | [src/server.js:2613](../../src/server.js#L2613) | `S.robTrunk` |
| DELETE | `/v1/streets/search` | authenticated | social-combat | [src/server.js:2889](../../src/server.js#L2889) | `S.callOffSearch` |
| GET | `/v1/supply-tenders` | authenticated | platform-core | [src/routes/supplytenders.js:6](../../src/routes/supplytenders.js#L6) | `Tender.supplyTenderBoard` |
| POST | `/v1/supply-tenders/:id/cancel` | authenticated | platform-core | [src/routes/supplytenders.js:32](../../src/routes/supplytenders.js#L32) | `Tender.cancelSupplyTender` |
| POST | `/v1/supply-tenders/:id/offers` | authenticated | platform-core | [src/routes/supplytenders.js:13](../../src/routes/supplytenders.js#L13) | `Tender.offerSupplyTender` |
| POST | `/v1/supply-tenders/:id/offers/:offerId/award` | authenticated | platform-core | [src/routes/supplytenders.js:19](../../src/routes/supplytenders.js#L19) | `Tender.awardSupplyTender` |
| POST | `/v1/supply-tenders/:id/offers/withdraw` | authenticated | platform-core | [src/routes/supplytenders.js:30](../../src/routes/supplytenders.js#L30) | `Tender.withdrawSupplyOffer` |
| POST | `/v1/swap` | authenticated | economy-ledger | [src/server.js:1746](../../src/server.js#L1746) | `E.swap` |
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
| POST | `/v1/train/:stat` | authenticated | platform-core | [src/server.js:1624](../../src/server.js#L1624) | `G.withCharacter` |
| POST | `/v1/travel/:district` | authenticated | platform-core | [src/server.js:1685](../../src/server.js#L1685) | `G.withCharacter` |
| GET | `/v1/u/:name` | public | platform-core | [src/server.js:779](../../src/server.js#L779) | `Cards.publicDossier` |
| GET | `/v1/underworld` | authenticated | world-progression | [src/routes/underworld.js:10](../../src/routes/underworld.js#L10) | `Underworld.underworldBoard` |
| POST | `/v1/underworld/:npc/errand` | authenticated | world-progression | [src/routes/underworld.js:24](../../src/routes/underworld.js#L24) | `Underworld.startErrand` |
| POST | `/v1/underworld/:npc/favor` | authenticated | world-progression | [src/routes/underworld.js:21](../../src/routes/underworld.js#L21) | `Underworld.claimFavor` |
| POST | `/v1/underworld/:npc/gift` | authenticated | world-progression | [src/routes/underworld.js:16](../../src/routes/underworld.js#L16) | `Underworld.giftNpc` |
| POST | `/v1/underworld/:npc/penance` | authenticated | world-progression | [src/routes/underworld.js:19](../../src/routes/underworld.js#L19) | `Underworld.payPenance` |
| POST | `/v1/underworld/discharge` | authenticated | world-progression | [src/routes/underworld.js:12](../../src/routes/underworld.js#L12) | `Underworld.discharge` |
| POST | `/v1/underworld/gun/:gunId/sell` | authenticated | world-progression | [src/routes/underworld.js:14](../../src/routes/underworld.js#L14) | `Underworld.sellGunBack` |
| POST | `/v1/unstake` | authenticated | economy-ledger | [src/server.js:1750](../../src/server.js#L1750) | `E.unstake` |
| POST | `/v1/vanity/name` | authenticated | engagement-growth | [src/server.js:2871](../../src/server.js#L2871) | `V.changeName` |
| POST | `/v1/vanity/plate/:carId` | authenticated | engagement-growth | [src/server.js:2875](../../src/server.js#L2875) | `V.setPlate` |
| POST | `/v1/vanity/title` | authenticated | engagement-growth | [src/server.js:2873](../../src/server.js#L2873) | `V.setTitle` |
| GET | `/v1/vault` | authenticated | economy-ledger | [src/server.js:2289](../../src/server.js#L2289) | `Treasury.vaultBoard` |
| POST | `/v1/vault/claim` | authenticated | economy-ledger | [src/server.js:2303](../../src/server.js#L2303) | `Treasury.claimVaulted` |
| DELETE | `/v1/vouch/:characterId` | authenticated | social-combat | [src/server.js:3327](../../src/server.js#L3327) | `Vouch.revokeVouch` |
| POST | `/v1/vouch/:characterId` | authenticated | social-combat | [src/server.js:3325](../../src/server.js#L3325) | `Vouch.giveVouch` |
| GET | `/v1/vouches` | authenticated | social-combat | [src/server.js:3323](../../src/server.js#L3323) | `Vouch.vouchBoard` |
| GET | `/v1/wage` | authenticated | economy-ledger | [src/server.js:3401](../../src/server.js#L3401) | `Emission.wageBoard` |
| POST | `/v1/wallet` | authenticated | chain-economy | [src/server.js:3497](../../src/server.js#L3497) | `G.GameError` |
| POST | `/v1/wallet/challenge` | authenticated | chain-economy | [src/server.js:3518](../../src/server.js#L3518) | `Chain.walletChallenge` |
| POST | `/v1/wallet/verify` | authenticated | chain-economy | [src/server.js:3519](../../src/server.js#L3519) | `Chain.walletVerify` |
| POST | `/v1/warehouse-leases/:id/close` | authenticated | platform-core | [src/routes/warehouses.js:26](../../src/routes/warehouses.js#L26) | `Warehouse.closeWarehouseLease` |
| POST | `/v1/warehouse-leases/:id/deposit` | authenticated | platform-core | [src/routes/warehouses.js:22](../../src/routes/warehouses.js#L22) | `Warehouse.depositWarehouseCargo` |
| POST | `/v1/warehouse-leases/:id/withdraw` | authenticated | platform-core | [src/routes/warehouses.js:24](../../src/routes/warehouses.js#L24) | `Warehouse.withdrawWarehouseCargo` |
| GET | `/v1/warehouses` | authenticated | platform-core | [src/routes/warehouses.js:6](../../src/routes/warehouses.js#L6) | `Warehouse.warehouseOffers` |
| POST | `/v1/warehouses/:id/lease` | authenticated | platform-core | [src/routes/warehouses.js:16](../../src/routes/warehouses.js#L16) | `Warehouse.leaseWarehouse` |
| GET | `/v1/window` | authenticated | economy-ledger | [src/server.js:1734](../../src/server.js#L1734) | `Exchange.exchangeBoard` |
| POST | `/v1/window/redeem` | authenticated | economy-ledger | [src/server.js:1736](../../src/server.js#L1736) | `Exchange.redeem` |
| GET | `/v1/wire` | authenticated | law-intelligence | [src/server.js:2347](../../src/server.js#L2347) | `Wire.wireBoard` |
| POST | `/v1/wire/dig/:targetId` | authenticated | law-intelligence | [src/server.js:3444](../../src/server.js#L3444) | `Secrets.digSecret` |
| POST | `/v1/wire/disinfo` | authenticated | law-intelligence | [src/server.js:2365](../../src/server.js#L2365) | `Wire.plantDisinfo` |
| POST | `/v1/wire/dossier/:targetId` | authenticated | law-intelligence | [src/server.js:2363](../../src/server.js#L2363) | `Wire.pullDossier` |
| POST | `/v1/wire/informant/:targetId` | authenticated | law-intelligence | [src/server.js:2367](../../src/server.js#L2367) | `Wire.recruitInformant` |
| POST | `/v1/wire/subscribe` | authenticated | law-intelligence | [src/server.js:2353](../../src/server.js#L2353) | `Wire.subscribeWire` |
| POST | `/v1/wire/sweep` | authenticated | law-intelligence | [src/server.js:2351](../../src/server.js#L2351) | `Wire.sweepBugs` |
| POST | `/v1/wire/tap/:targetId` | authenticated | law-intelligence | [src/server.js:2349](../../src/server.js#L2349) | `Wire.placeTap` |
| POST | `/v1/wire/trace` | authenticated | law-intelligence | [src/server.js:2361](../../src/server.js#L2361) | `Wire.traceBugs` |
| DELETE | `/v1/wire/watch/:targetId` | authenticated | law-intelligence | [src/server.js:2358](../../src/server.js#L2358) | `Wire.cancelWatch` |
| POST | `/v1/wire/watch/:targetId` | authenticated | law-intelligence | [src/server.js:2356](../../src/server.js#L2356) | `Wire.enrollWatch` |
| POST | `/v1/withdraw` | authenticated | chain-economy | [src/server.js:3521](../../src/server.js#L3521) | `Chain.requestWithdraw` |
| POST | `/v1/withdraw/:id/cancel` | authenticated | chain-economy | [src/server.js:3525](../../src/server.js#L3525) | `Chain.cancelQueuedWithdraw` |
| GET | `/v1/withdraw/status` | authenticated | chain-economy | [src/server.js:3550](../../src/server.js#L3550) | `Chain.reserveStatus` |
| POST | `/v1/workshop/ammo` | authenticated | economy-ledger | [src/server.js:1701](../../src/server.js#L1701) | `E.craftAmmo` |
| POST | `/v1/workshop/craft/:id` | authenticated | economy-ledger | [src/server.js:1699](../../src/server.js#L1699) | `E.craft` |
| GET | `/v1/world` | authenticated | world-progression | [src/server.js:3708](../../src/server.js#L3708) | `World.worldBoard` |
| POST | `/v1/world/:npcId/invade` | authenticated | world-progression | [src/server.js:3738](../../src/server.js#L3738) | `World.invadeOutpost` |
| POST | `/v1/world/:npcId/plan` | authenticated | world-progression | [src/server.js:3724](../../src/server.js#L3724) | `World.planRaid` |
| POST | `/v1/world/:npcId/raid` | authenticated | world-progression | [src/server.js:3710](../../src/server.js#L3710) | `World.raidNpc` |
| POST | `/v1/world/:npcId/reinforce` | authenticated | world-progression | [src/server.js:3741](../../src/server.js#L3741) | `World.reinforceOutpost` |
| POST | `/v1/world/collect` | authenticated | world-progression | [src/server.js:3736](../../src/server.js#L3736) | `World.collectFrontier` |
| GET | `/v1/world/raids` | authenticated | world-progression | [src/server.js:3722](../../src/server.js#L3722) | `World.raidBoard` |
| POST | `/v1/world/raids/:id/dismiss` | authenticated | world-progression | [src/server.js:3730](../../src/server.js#L3730) | `World.dismissGun` |
| POST | `/v1/world/raids/:id/go` | authenticated | world-progression | [src/server.js:3734](../../src/server.js#L3734) | `World.executeRaid` |
| POST | `/v1/world/raids/:id/hire` | authenticated | world-progression | [src/server.js:3728](../../src/server.js#L3728) | `World.hireRaid` |
| POST | `/v1/world/raids/:id/join` | authenticated | world-progression | [src/server.js:3726](../../src/server.js#L3726) | `World.joinRaid` |
| POST | `/v1/world/raids/:id/leave` | authenticated | world-progression | [src/server.js:3732](../../src/server.js#L3732) | `World.leaveRaid` |
| GET | `/v1/worldgraph/inventory` | authenticated | world-graph | [src/routes/worldgraph.js:484](../../src/routes/worldgraph.js#L484) | — |
| POST | `/v1/worldgraph/items/:itemId/assign-current-character` | authenticated | world-graph | [src/routes/worldgraph.js:476](../../src/routes/worldgraph.js#L476) | — |
| GET | `/v1/worldgraph/kernel/recipes` | authenticated | platform-core | [src/routes/world-kernel.js:79](../../src/routes/world-kernel.js#L79) | — |
| POST | `/v1/worldgraph/kernel/recipes/:recipeId/craft` | authenticated | world-graph | [src/routes/world-kernel.js:81](../../src/routes/world-kernel.js#L81) | `withItemTransaction` |
| GET | `/v1/worldgraph/mysteries` | authenticated | world-graph | [src/routes/worldgraph.js:516](../../src/routes/worldgraph.js#L516) | — |
| GET | `/v1/worldgraph/mysteries/:graphId` | authenticated | world-graph | [src/routes/worldgraph.js:542](../../src/routes/worldgraph.js#L542) | — |
| POST | `/v1/worldgraph/mysteries/:graphId/cancel` | authenticated | world-graph | [src/routes/worldgraph.js:591](../../src/routes/worldgraph.js#L591) | — |
| POST | `/v1/worldgraph/mysteries/:graphId/choices/:nodeId` | authenticated | world-graph | [src/routes/worldgraph.js:580](../../src/routes/worldgraph.js#L580) | — |
| POST | `/v1/worldgraph/mysteries/:graphId/explore` | authenticated | world-graph | [src/routes/worldgraph.js:555](../../src/routes/worldgraph.js#L555) | — |
| POST | `/v1/worldgraph/mysteries/:graphId/nodes/:nodeId/complete` | authenticated | world-graph | [src/routes/worldgraph.js:570](../../src/routes/worldgraph.js#L570) | — |
| POST | `/v1/worldgraph/mysteries/:graphId/nodes/:nodeId/discover` | authenticated | world-graph | [src/routes/worldgraph.js:560](../../src/routes/worldgraph.js#L560) | — |
| POST | `/v1/worldgraph/mysteries/:graphId/start` | authenticated | world-graph | [src/routes/worldgraph.js:531](../../src/routes/worldgraph.js#L531) | — |
| GET | `/v1/worldgraph/objects` | authenticated | platform-core | [src/routes/world-kernel.js:75](../../src/routes/world-kernel.js#L75) | — |
| GET | `/v1/worldgraph/objects/:objectId` | authenticated | platform-core | [src/routes/world-kernel.js:76](../../src/routes/world-kernel.js#L76) | — |
| POST | `/v1/worldgraph/objects/:objectId/actions/:actionId` | authenticated | platform-core | [src/routes/world-kernel.js:77](../../src/routes/world-kernel.js#L77) | — |
| GET | `/v1/worldgraph/operations` | authenticated | world-graph | [src/routes/worldgraph.js:603](../../src/routes/worldgraph.js#L603) | — |
| POST | `/v1/worldgraph/operations/:graphId/:operationNodeId/open` | authenticated | world-graph | [src/routes/worldgraph.js:621](../../src/routes/worldgraph.js#L621) | — |
| GET | `/v1/worldgraph/operations/:operationId` | authenticated | world-graph | [src/routes/worldgraph.js:632](../../src/routes/worldgraph.js#L632) | — |
| POST | `/v1/worldgraph/operations/:operationId/cancel` | authenticated | world-graph | [src/routes/worldgraph.js:669](../../src/routes/worldgraph.js#L669) | — |
| POST | `/v1/worldgraph/operations/:operationId/complete` | authenticated | world-graph | [src/routes/worldgraph.js:663](../../src/routes/worldgraph.js#L663) | — |
| POST | `/v1/worldgraph/operations/:operationId/contributions/:nodeId` | authenticated | world-graph | [src/routes/worldgraph.js:656](../../src/routes/worldgraph.js#L656) | — |
| GET | `/v1/worldgraph/operations/:operationId/role` | authenticated | world-graph | [src/routes/worldgraph.js:641](../../src/routes/worldgraph.js#L641) | — |
| POST | `/v1/worldgraph/operations/:operationId/roles/:roleId` | authenticated | world-graph | [src/routes/worldgraph.js:650](../../src/routes/worldgraph.js#L650) | — |
| GET | `/v1/worldgraph/recipes` | authenticated | world-graph | [src/routes/worldgraph.js:492](../../src/routes/worldgraph.js#L492) | — |
| POST | `/v1/worldgraph/recipes/:recipeId/craft` | authenticated | world-graph | [src/routes/worldgraph.js:502](../../src/routes/worldgraph.js#L502) | — |
| POST | `/v1/worldgraph/recipes/:recipeId/salvage/:carId` | authenticated | world-graph | [src/routes/worldgraph.js:509](../../src/routes/worldgraph.js#L509) | — |
| GET | `/v1/worldgraph/state` | authenticated | platform-core | [src/routes/world-kernel.js:74](../../src/routes/world-kernel.js#L74) | — |
| GET | `/v1/ws` | token-query | platform-core | [src/server.js:2940](../../src/server.js#L2940) | — |
| GET | `/v1/yield` | public | economy-ledger | [src/server.js:1738](../../src/server.js#L1738) | `Exchange.yieldBoard` |
| GET | `/wiki` | public | client-experience | [src/server.js:518](../../src/server.js#L518) | `servePage` |
