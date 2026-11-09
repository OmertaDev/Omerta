# Generated HTTP route catalog

> 1077 literal registrations extracted from `src/server.js` and `src/routes/`. Runtime authority remains `GET /openapi.json`.

## Route groups

| Group | Routes |
|---|---:|
| mod | 79 |
| company | 70 |
| web | 55 |
| leaderboard | 46 |
| resources | 38 |
| casino | 28 |
| worldgraph | 27 |
| gangs | 22 |
| content | 19 |
| crew | 19 |
| pen | 19 |
| coordination | 18 |
| depot | 17 |
| gateway | 15 |
| deeds | 14 |
| streets | 14 |
| speakeasy | 13 |
| kitchen | 12 |
| rwa | 12 |
| loans | 12 |
| world | 12 |
| market | 11 |
| port | 11 |
| business | 11 |
| wire | 11 |
| boxing | 10 |
| city | 10 |
| races | 10 |
| territory | 10 |
| auth | 10 |
| estate | 9 |
| heists | 9 |
| law | 9 |
| convoy | 8 |
| stable | 8 |
| dynasty | 8 |
| diplomacy | 7 |
| underworld | 7 |
| identity | 7 |
| commission | 7 |
| quest-workshop | 6 |
| sov | 6 |
| mentor | 6 |
| delivery-finance | 5 |
| equipment | 5 |
| intel-forecasts | 5 |
| strategies | 5 |
| supply-tenders | 5 |
| armory | 5 |
| skills | 5 |
| auction | 5 |
| phone | 5 |
| soldiers | 5 |
| agent | 4 |
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
| buyer-cooperatives | 3 |
| commands | 3 |
| events | 3 |
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
| clues | 3 |
| company-succession | 2 |
| defi | 2 |
| equipment-recovery | 2 |
| made | 2 |
| eth-staking | 2 |
| genesis-auction | 2 |
| items | 2 |
| projections | 2 |
| questing | 2 |
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
| consignments | 1 |
| customer | 1 |
| depots | 1 |
| capo | 1 |
| mobile-shops | 1 |
| avatar | 1 |
| u | 1 |
| path-quiz | 1 |
| age-check | 1 |
| me | 1 |
| session | 1 |
| crimes | 1 |
| train | 1 |
| heal | 1 |
| checkin | 1 |
| broadcast | 1 |
| screens | 1 |
| travel | 1 |
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
| intel | 1 |
| rivals | 1 |
| opportunities | 1 |
| arena | 1 |
| safehouse | 1 |
| notifications | 1 |
| ws | 1 |
| online | 1 |
| contacts | 1 |
| call | 1 |
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
| GET | `/` | public | client-experience | [src/server.js:630](../../src/server.js#L630) | `serveLaunchPage` |
| GET | `/admin` | public | client-experience | [src/server.js:636](../../src/server.js#L636) | `servePage` |
| GET | `/agents` | public | client-experience | [src/server.js:1039](../../src/server.js#L1039) | — |
| GET | `/AGENTS.md` | public | client-experience | [src/server.js:1040](../../src/server.js#L1040) | — |
| GET | `/arena` | public | client-experience | [src/server.js:647](../../src/server.js#L647) | `servePage` |
| GET | `/art/:file` | public | client-experience | [src/server.js:831](../../src/server.js#L831) | `sendVideo` |
| GET | `/art/hype/:file` | public | client-experience | [src/server.js:837](../../src/server.js#L837) | `sendVideo` |
| GET | `/art/nft/:file` | public | client-experience | [src/server.js:838](../../src/server.js#L838) | — |
| GET | `/art/wiki-economy/:file` | public | client-experience | [src/server.js:870](../../src/server.js#L870) | `sendVideo` |
| GET | `/beef/:a/:b` | public | client-experience | [src/server.js:1029](../../src/server.js#L1029) | `Cards.beefDossier` |
| GET | `/card/:type/:name` | public | client-experience | [src/server.js:993](../../src/server.js#L993) | `Cards.publicDossier` |
| GET | `/card/beef/:a/:b` | public | client-experience | [src/server.js:1009](../../src/server.js#L1009) | `Cards.beefDossier` |
| GET | `/deed/:tokenId` | public | client-experience | [src/server.js:978](../../src/server.js#L978) | `Deeds.deedByToken` |
| GET | `/defi` | public | client-experience | [src/server.js:731](../../src/server.js#L731) | — |
| GET | `/defi.html` | public | client-experience | [src/server.js:732](../../src/server.js#L732) | — |
| GET | `/eth-staking.js` | public | client-experience | [src/server.js:750](../../src/server.js#L750) | `reviewedModule` |
| GET | `/favicon.ico` | public | client-experience | [src/server.js:772](../../src/server.js#L772) | — |
| GET | `/fee-flows` | public | client-experience | [src/server.js:734](../../src/server.js#L734) | — |
| GET | `/fee-flows.html` | public | client-experience | [src/server.js:735](../../src/server.js#L735) | — |
| GET | `/game-runtime.js` | public | client-experience | [src/server.js:602](../../src/server.js#L602) | `serveClientScript` |
| GET | `/genesis-deploy` | public | client-experience | [src/server.js:738](../../src/server.js#L738) | — |
| GET | `/genesis-deploy-artifact.js` | public | client-experience | [src/server.js:749](../../src/server.js#L749) | `reviewedModule` |
| GET | `/genesis-deploy-client.js` | public | client-experience | [src/server.js:745](../../src/server.js#L745) | `reviewedModule` |
| GET | `/genesis-deploy-vendor/_u64.js` | public | client-experience | [src/server.js:752](../../src/server.js#L752) | `reviewedModule` |
| GET | `/genesis-deploy-vendor/crypto.js` | public | client-experience | [src/server.js:754](../../src/server.js#L754) | `reviewedModule` |
| GET | `/genesis-deploy-vendor/sha3.js` | public | client-experience | [src/server.js:751](../../src/server.js#L751) | `reviewedModule` |
| GET | `/genesis-deploy-vendor/utils.js` | public | client-experience | [src/server.js:753](../../src/server.js#L753) | `reviewedModule` |
| GET | `/genesis-deploy.html` | public | client-experience | [src/server.js:739](../../src/server.js#L739) | — |
| GET | `/genesis-snapshot-rpc.js` | public | client-experience | [src/server.js:748](../../src/server.js#L748) | `reviewedModule` |
| GET | `/guides/getting-started` | public | client-experience | [src/server.js:654](../../src/server.js#L654) | `servePage` |
| GET | `/health` | public | client-experience | [src/server.js:1210](../../src/server.js#L1210) | — |
| GET | `/integrations/muse` | public | client-experience | [src/routes/gateway.js:145](../../src/routes/gateway.js#L145) | `respond` |
| POST | `/integrations/muse/call` | public | client-experience | [src/routes/gateway.js:147](../../src/routes/gateway.js#L147) | `respond` |
| GET | `/integrations/muse/tools` | public | client-experience | [src/routes/gateway.js:146](../../src/routes/gateway.js#L146) | `observed` |
| GET | `/inventory-bond-client.js` | public | client-experience | [src/server.js:746](../../src/server.js#L746) | `reviewedModule` |
| GET | `/landing-loader.js` | public | client-experience | [src/server.js:603](../../src/server.js#L603) | `serveClientScript` |
| GET | `/llms.txt` | public | client-experience | [src/server.js:1041](../../src/server.js#L1041) | — |
| GET | `/manifest.json` | public | client-experience | [src/server.js:757](../../src/server.js#L757) | — |
| GET | `/manifest.webmanifest` | public | client-experience | [src/server.js:758](../../src/server.js#L758) | — |
| GET | `/omerta-ui.css` | public | client-experience | [src/server.js:689](../../src/server.js#L689) | — |
| GET | `/openapi.json` | public | client-experience | [src/server.js:1051](../../src/server.js#L1051) | — |
| GET | `/path` | public | client-experience | [src/server.js:677](../../src/server.js#L677) | `servePage` |
| GET | `/path/:id` | public | client-experience | [src/server.js:679](../../src/server.js#L679) | — |
| GET | `/play` | public | client-experience | [src/server.js:652](../../src/server.js#L652) | `servePage` |
| GET | `/player-experience.js` | public | client-experience | [src/server.js:747](../../src/server.js#L747) | `reviewedModule` |
| GET | `/robots.txt` | public | client-experience | [src/server.js:1045](../../src/server.js#L1045) | — |
| GET | `/sale` | public | client-experience | [src/server.js:658](../../src/server.js#L658) | `servePage` |
| GET | `/site-entry.json` | public | client-experience | [src/server.js:604](../../src/server.js#L604) | `A.xOAuthConfigured` |
| GET | `/sitemap.xml` | public | client-experience | [src/server.js:1046](../../src/server.js#L1046) | — |
| GET | `/sw.js` | public | client-experience | [src/server.js:724](../../src/server.js#L724) | — |
| GET | `/u/:name` | public | client-experience | [src/server.js:1023](../../src/server.js#L1023) | `Cards.publicDossier` |
| POST | `/v1/access/logout` | public | platform-core | [src/server.js:1644](../../src/server.js#L1644) | — |
| POST | `/v1/access/redeem` | public | platform-core | [src/server.js:1628](../../src/server.js#L1628) | `G.GameError` |
| POST | `/v1/access/session` | authenticated | platform-core | [src/server.js:1637](../../src/server.js#L1637) | — |
| POST | `/v1/age-check` | public | platform-core | [src/server.js:1595](../../src/server.js#L1595) | — |
| POST | `/v1/agent/act` | authenticated | platform-core | [src/server.js:3037](../../src/server.js#L3037) | `executeAgentAction` |
| GET | `/v1/agent/decision-replay` | authenticated | platform-core | [src/routes/decisionreplay.js:6](../../src/routes/decisionreplay.js#L6) | `decisionReplayBoard` |
| GET | `/v1/agent/decision-replay/:kind/:id` | authenticated | platform-core | [src/routes/decisionreplay.js:7](../../src/routes/decisionreplay.js#L7) | `decisionReplay` |
| GET | `/v1/agent/turn` | authenticated | platform-core | [src/server.js:2951](../../src/server.js#L2951) | `readAgentTurn` |
| GET | `/v1/arena` | public | engagement-growth | [src/server.js:3111](../../src/server.js#L3111) | `arenaBoard` |
| POST | `/v1/armory/ammo` | authenticated | economy-ledger | [src/server.js:1993](../../src/server.js#L1993) | `E.buyAmmo` |
| POST | `/v1/armory/gun/:id/buy` | authenticated | economy-ledger | [src/server.js:1985](../../src/server.js#L1985) | `E.buyGun` |
| POST | `/v1/armory/gun/:id/equip` | authenticated | economy-ledger | [src/server.js:1987](../../src/server.js#L1987) | `E.equipGun` |
| POST | `/v1/armory/unequip` | authenticated | economy-ledger | [src/server.js:1989](../../src/server.js#L1989) | `E.equipGun` |
| POST | `/v1/armory/vest/:id` | authenticated | economy-ledger | [src/server.js:1991](../../src/server.js#L1991) | `E.buyVest` |
| GET | `/v1/art/:kind/:id` | public | platform-core | [src/server.js:896](../../src/server.js#L896) | — |
| GET | `/v1/art/motion` | public | platform-core | [src/server.js:885](../../src/server.js#L885) | — |
| POST | `/v1/assets/:id/buy` | authenticated | economy-ledger | [src/server.js:1938](../../src/server.js#L1938) | `E.buyAsset` |
| POST | `/v1/assets/:id/sell` | authenticated | economy-ledger | [src/server.js:1940](../../src/server.js#L1940) | `E.sellAsset` |
| GET | `/v1/auction` | authenticated | platform-core | [src/server.js:2555](../../src/server.js#L2555) | `Auction.auctionBoard` |
| POST | `/v1/auction/:lotId/bid` | authenticated | platform-core | [src/server.js:2557](../../src/server.js#L2557) | `Auction.bidAuction` |
| POST | `/v1/auction/consign` | authenticated | platform-core | [src/server.js:2560](../../src/server.js#L2560) | `Auction.consignTrophy` |
| POST | `/v1/auction/consign/:id/bid` | authenticated | platform-core | [src/server.js:2562](../../src/server.js#L2562) | `Auction.bidConsignment` |
| POST | `/v1/auction/consign/:id/cancel` | authenticated | platform-core | [src/server.js:2564](../../src/server.js#L2564) | `Auction.reclaimConsignment` |
| POST | `/v1/auth/agent` | public | platform-core | [src/server.js:1620](../../src/server.js#L1620) | `A.accountForAgentBootstrap` |
| POST | `/v1/auth/agent-key` | authenticated | platform-core | [src/server.js:1742](../../src/server.js#L1742) | `A.acknowledgeGuestBootstrap` |
| POST | `/v1/auth/guest` | public | platform-core | [src/server.js:1619](../../src/server.js#L1619) | — |
| POST | `/v1/auth/guest/bootstrap/ack` | authenticated | platform-core | [src/server.js:1648](../../src/server.js#L1648) | `A.acknowledgeGuestBootstrap` |
| POST | `/v1/auth/logout-all` | authenticated | platform-core | [src/server.js:1752](../../src/server.js#L1752) | — |
| POST | `/v1/auth/privy` | public | platform-core | [src/server.js:1661](../../src/server.js#L1661) | `providerLogin` |
| POST | `/v1/auth/upgrade` | authenticated | platform-core | [src/server.js:1733](../../src/server.js#L1733) | `A.upgradeAccount` |
| POST | `/v1/auth/x` | public | platform-core | [src/server.js:1660](../../src/server.js#L1660) | `providerLogin` |
| GET | `/v1/auth/x/callback` | public | platform-core | [src/server.js:1704](../../src/server.js#L1704) | `A.xOAuthCallback` |
| POST | `/v1/auth/x/start` | public | platform-core | [src/server.js:1671](../../src/server.js#L1671) | `A.upgradeAccount` |
| GET | `/v1/avatar/:seed` | public | platform-core | [src/server.js:911](../../src/server.js#L911) | — |
| GET | `/v1/bank` | authenticated | platform-core | [src/server.js:2535](../../src/server.js#L2535) | `Bank.bankBoard` |
| POST | `/v1/bank/:dir` | authenticated | platform-core | [src/server.js:1906](../../src/server.js#L1906) | `G.withCharacter` |
| GET | `/v1/block` | authenticated | social-combat | [src/server.js:2841](../../src/server.js#L2841) | `Block.streetsBoard` |
| GET | `/v1/bloodline` | authenticated | platform-core | [src/server.js:3730](../../src/server.js#L3730) | `Bloodline.bloodlineBoard` |
| POST | `/v1/bodyguard/hire/:guardId` | authenticated | social-combat | [src/server.js:3159](../../src/server.js#L3159) | `S.hireBodyguard` |
| POST | `/v1/bodyguard/offer` | authenticated | social-combat | [src/server.js:3157](../../src/server.js#L3157) | `S.offerBodyguard` |
| POST | `/v1/bond/calldata` | authenticated | platform-core | [src/server.js:3846](../../src/server.js#L3846) | `bondPurchase` |
| POST | `/v1/bond/quote` | authenticated | platform-core | [src/server.js:3845](../../src/server.js#L3845) | `bondPurchase` |
| GET | `/v1/bonds` | authenticated | platform-core | [src/server.js:3822](../../src/server.js#L3822) | `Bonds.bondBoard` |
| POST | `/v1/bonds/:id/claim` | authenticated | platform-core | [src/server.js:3829](../../src/server.js#L3829) | `Bonds.claimBond` |
| POST | `/v1/bonds/charter` | authenticated | platform-core | [src/server.js:3834](../../src/server.js#L3834) | `Bonds.commissionCharter` |
| POST | `/v1/bonds/pledge` | authenticated | platform-core | [src/server.js:3832](../../src/server.js#L3832) | `Bonds.pledgeTreasury` |
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
| POST | `/v1/broadcast/shared` | authenticated | platform-core | [src/server.js:1886](../../src/server.js#L1886) | `G.GameError` |
| GET | `/v1/brokers` | authenticated | platform-core | [src/server.js:2576](../../src/server.js#L2576) | `Brokers.brokerBoard` |
| POST | `/v1/brokers/activate` | authenticated | platform-core | [src/server.js:2578](../../src/server.js#L2578) | `Brokers.activate` |
| GET | `/v1/bulletin` | authenticated | engagement-growth | [src/server.js:4004](../../src/server.js#L4004) | `bulletinBoard` |
| POST | `/v1/bulletin/claim` | authenticated | platform-core | [src/server.js:4009](../../src/server.js#L4009) | `G.withCharacter` |
| GET | `/v1/business` | authenticated | enterprise-logistics | [src/server.js:2379](../../src/server.js#L2379) | `Business.businessesOf` |
| DELETE | `/v1/business/:id` | authenticated | enterprise-logistics | [src/server.js:2351](../../src/server.js#L2351) | `Business.shutterBusiness` |
| POST | `/v1/business/:id/launder` | authenticated | enterprise-logistics | [src/server.js:2353](../../src/server.js#L2353) | `Business.launderAtBusiness` |
| POST | `/v1/business/:id/rob` | authenticated | enterprise-logistics | [src/server.js:2364](../../src/server.js#L2364) | `Business.robBusiness` |
| POST | `/v1/business/:id/shakedown` | authenticated | enterprise-logistics | [src/server.js:2357](../../src/server.js#L2357) | `Business.shakedownBusiness` |
| POST | `/v1/business/:id/specialize` | authenticated | enterprise-logistics | [src/server.js:2371](../../src/server.js#L2371) | `Business.specializeBusiness` |
| POST | `/v1/business/:id/takeover` | authenticated | enterprise-logistics | [src/server.js:2373](../../src/server.js#L2373) | `Business.takeoverBusiness` |
| POST | `/v1/business/:id/upgrade` | authenticated | enterprise-logistics | [src/server.js:2346](../../src/server.js#L2346) | `Business.upgradeBusiness` |
| POST | `/v1/business/:kind/buy` | authenticated | enterprise-logistics | [src/server.js:2338](../../src/server.js#L2338) | `Business.buyBusiness` |
| POST | `/v1/business/collect` | authenticated | enterprise-logistics | [src/server.js:2340](../../src/server.js#L2340) | `Business.collectBusiness` |
| POST | `/v1/business/upkeep` | authenticated | enterprise-logistics | [src/server.js:2344](../../src/server.js#L2344) | `Business.payBusinessUpkeep` |
| GET | `/v1/buyer-cooperatives` | authenticated | platform-core | [src/routes/buyercooperatives.js:6](../../src/routes/buyercooperatives.js#L6) | `Cooperative.buyerCooperativeBoard` |
| POST | `/v1/buyer-cooperatives` | authenticated | platform-core | [src/routes/buyercooperatives.js:8](../../src/routes/buyercooperatives.js#L8) | `Cooperative.createBuyerCooperative` |
| GET | `/v1/buyer-cooperatives/public` | public | platform-core | [src/routes/buyercooperatives.js:5](../../src/routes/buyercooperatives.js#L5) | `Cooperative.publicBuyerCooperatives` |
| POST | `/v1/call/fulfill` | authenticated | engagement-growth | [src/server.js:3499](../../src/server.js#L3499) | `Contacts.fulfillCall` |
| GET | `/v1/campaigns` | authenticated | platform-core | [src/server.js:3722](../../src/server.js#L3722) | `Campaigns.campaignBoard` |
| POST | `/v1/campaigns/:id/choose` | authenticated | platform-core | [src/server.js:3726](../../src/server.js#L3726) | `Campaigns.chooseCampaign` |
| POST | `/v1/campaigns/:id/claim` | authenticated | platform-core | [src/server.js:3728](../../src/server.js#L3728) | `Campaigns.claimCampaign` |
| POST | `/v1/campaigns/:id/start` | authenticated | platform-core | [src/server.js:3724](../../src/server.js#L3724) | `Campaigns.startCampaign` |
| GET | `/v1/capo` | authenticated | engagement-growth | [src/routes/leaderboards.js:88](../../src/routes/leaderboards.js#L88) | `W.capoBoard` |
| GET | `/v1/career` | authenticated | engagement-growth | [src/server.js:3702](../../src/server.js#L3702) | `Career.careerBoard` |
| POST | `/v1/career/:taskId` | authenticated | engagement-growth | [src/server.js:3704](../../src/server.js#L3704) | `Career.claimCareer` |
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
| GET | `/v1/catalog` | public | enterprise-logistics | [src/server.js:2058](../../src/server.js#L2058) | `Business.catalog` |
| POST | `/v1/character` | authenticated | platform-core | [src/server.js:1766](../../src/server.js#L1766) | `Store.claimPendingWire` |
| POST | `/v1/character/forge` | authenticated | chain-economy | [src/server.js:3902](../../src/server.js#L3902) | `Forge.forgeCharacter` |
| POST | `/v1/character/mint` | authenticated | economy-ledger | [src/server.js:3893](../../src/server.js#L3893) | `Fees.mintCharacter` |
| POST | `/v1/character/reroll` | authenticated | economy-ledger | [src/server.js:3896](../../src/server.js#L3896) | `Fees.rerollCharacter` |
| GET | `/v1/chat` | authenticated | platform-core | [src/server.js:3474](../../src/server.js#L3474) | `readChat` |
| POST | `/v1/chat` | authenticated | platform-core | [src/server.js:3473](../../src/server.js#L3473) | `postChat` |
| POST | `/v1/checkin` | authenticated | platform-core | [src/server.js:1883](../../src/server.js#L1883) | `G.withCharacter` |
| GET | `/v1/circle` | authenticated | engagement-growth | [src/server.js:3614](../../src/server.js#L3614) | `Circle.circleBoard` |
| GET | `/v1/city` | public | platform-core | [src/server.js:3959](../../src/server.js#L3959) | — |
| GET | `/v1/city/encounters` | authenticated | platform-core | [src/routes/city-encounters.js:18](../../src/routes/city-encounters.js#L18) | `encounterBoard` |
| POST | `/v1/city/encounters/:actorId` | authenticated | platform-core | [src/routes/city.js:14](../../src/routes/city.js#L14) | `recordCityEncounter` |
| POST | `/v1/city/encounters/:id/turn` | public | platform-core | [src/routes/city-encounters.js:24](../../src/routes/city-encounters.js#L24) | `takeEncounterTurn` |
| POST | `/v1/city/encounters/start` | public | platform-core | [src/routes/city-encounters.js:22](../../src/routes/city-encounters.js#L22) | `startEncounter` |
| GET | `/v1/city/home/interior` | authenticated | platform-core | [src/routes/city-home-interiors.js:22](../../src/routes/city-home-interiors.js#L22) | `homeInteriorBoard` |
| GET | `/v1/city/homes` | authenticated | platform-core | [src/routes/cityhomes.js:8](../../src/routes/cityhomes.js#L8) | `cityHomes` |
| GET | `/v1/city/intel` | authenticated | platform-core | [src/routes/city.js:10](../../src/routes/city.js#L10) | `cityIntel` |
| GET | `/v1/city/opportunities` | authenticated | platform-core | [src/routes/city-world-opportunities.js:31](../../src/routes/city-world-opportunities.js#L31) | `execute` |
| GET | `/v1/city/presence` | authenticated | platform-core | [src/routes/city.js:6](../../src/routes/city.js#L6) | `cityPresence` |
| GET | `/v1/citywide` | authenticated | world-progression | [src/server.js:2845](../../src/server.js#L2845) | `Citywide.citywideBoard` |
| POST | `/v1/claim-rewards` | authenticated | economy-ledger | [src/server.js:1979](../../src/server.js#L1979) | `E.claimRewards` |
| GET | `/v1/clues` | authenticated | platform-core | [src/server.js:4035](../../src/server.js#L4035) | `Clues.clueBoard` |
| POST | `/v1/clues/answer` | authenticated | platform-core | [src/server.js:4039](../../src/server.js#L4039) | `Clues.answer` |
| POST | `/v1/clues/dig` | authenticated | platform-core | [src/server.js:4037](../../src/server.js#L4037) | `Clues.dig` |
| GET | `/v1/collection` | authenticated | law-intelligence | [src/server.js:3790](../../src/server.js#L3790) | `Collection.collectionBoard` |
| GET | `/v1/commands` | public | platform-core | [src/routes/commands.js:46](../../src/routes/commands.js#L46) | `traceAuthorizedCommand` |
| POST | `/v1/commands/execute` | public | platform-core | [src/routes/commands.js:58](../../src/routes/commands.js#L58) | `traceAuthorizedCommand` |
| POST | `/v1/commands/observations` | authenticated | platform-core | [src/routes/commands.js:53](../../src/routes/commands.js#L53) | — |
| GET | `/v1/commission` | public | platform-core | [src/server.js:2395](../../src/server.js#L2395) | `Commission.commissionBoard` |
| POST | `/v1/commission/override` | authenticated | platform-core | [src/server.js:2404](../../src/server.js#L2404) | `Commission.overrideVeto` |
| POST | `/v1/commission/propose` | authenticated | platform-core | [src/server.js:2401](../../src/server.js#L2401) | `Commission.proposeDecree` |
| GET | `/v1/commission/ticker` | public | platform-core | [src/server.js:2409](../../src/server.js#L2409) | `Commission.tickerBallotBoard` |
| POST | `/v1/commission/ticker` | authenticated | platform-core | [src/server.js:2410](../../src/server.js#L2410) | `Commission.castTickerVote` |
| POST | `/v1/commission/veto` | authenticated | platform-core | [src/server.js:2398](../../src/server.js#L2398) | `Commission.vetoDecree` |
| POST | `/v1/commission/vote` | authenticated | platform-core | [src/server.js:2396](../../src/server.js#L2396) | `Commission.castVote` |
| GET | `/v1/company-succession` | authenticated | platform-core | [src/routes/companysuccession.js:5](../../src/routes/companysuccession.js#L5) | `Succession.companySuccessionBoard` |
| POST | `/v1/company-succession` | authenticated | platform-core | [src/routes/companysuccession.js:7](../../src/routes/companysuccession.js#L7) | `Succession.resumeCompany` |
| GET | `/v1/company/bank` | authenticated | platform-core | [src/routes/companybankportfolios.js:6](../../src/routes/companybankportfolios.js#L6) | `Portfolio.companyBankPortfolioBoard` |
| POST | `/v1/company/bank/policy` | authenticated | platform-core | [src/routes/companybankportfolios.js:8](../../src/routes/companybankportfolios.js#L8) | `Portfolio.setCompanyBankPortfolioPolicy` |
| POST | `/v1/company/bank/run` | authenticated | platform-core | [src/routes/companybankportfolios.js:10](../../src/routes/companybankportfolios.js#L10) | `Portfolio.runCompanyBankPortfolio` |
| GET | `/v1/company/commissions` | authenticated | world-graph | [src/routes/commissionedcrafting.js:4](../../src/routes/commissionedcrafting.js#L4) | `withItemRead` |
| GET | `/v1/company/demand/:id` | authenticated | platform-core | [src/routes/companydemand.js:4](../../src/routes/companydemand.js#L4) | `G.readCharacter` |
| POST | `/v1/company/demand/:id/apply` | authenticated | platform-core | [src/routes/companydemand.js:6](../../src/routes/companydemand.js#L6) | `G.withCharacter` |
| POST | `/v1/company/demand/:id/scenario` | authenticated | platform-core | [src/routes/companydemand.js:5](../../src/routes/companydemand.js#L5) | `G.readCharacter` |
| GET | `/v1/company/dependency-map/:depotId` | public | platform-core | [src/routes/economicdependencymap.js:5](../../src/routes/economicdependencymap.js#L5) | `economicDependencyMap` |
| GET | `/v1/company/desk` | authenticated | platform-core | [src/routes/businessdesk.js:6](../../src/routes/businessdesk.js#L6) | `withCharacterReadLocked` |
| GET | `/v1/company/external-work` | authenticated | platform-core | [src/routes/fundedexternalwork.js:5](../../src/routes/fundedexternalwork.js#L5) | — |
| POST | `/v1/company/forecast/:id` | authenticated | platform-core | [src/routes/companyforecast.js:4](../../src/routes/companyforecast.js#L4) | `G.readCharacter` |
| POST | `/v1/company/forecast/:id/apply` | authenticated | platform-core | [src/routes/companyforecast.js:5](../../src/routes/companyforecast.js#L5) | `G.withCharacter` |
| GET | `/v1/company/governance` | authenticated | platform-core | [src/routes/companygovernance.js:5](../../src/routes/companygovernance.js#L5) | `C.companyGovernanceBoard` |
| POST | `/v1/company/governance/:id/execute` | authenticated | platform-core | [src/routes/companygovernance.js:10](../../src/routes/companygovernance.js#L10) | `pair` |
| POST | `/v1/company/governance/:id/vote` | authenticated | platform-core | [src/routes/companygovernance.js:9](../../src/routes/companygovernance.js#L9) | `pair` |
| POST | `/v1/company/intelligence/:depotId/preview` | authenticated | platform-core | [src/routes/economicintelligence.js:6](../../src/routes/economicintelligence.js#L6) | `E.previewEconomicIntelligence` |
| POST | `/v1/company/intelligence/:id/purchase` | authenticated | platform-core | [src/routes/economicintelligence.js:8](../../src/routes/economicintelligence.js#L8) | `E.economicIntelligencePurchaseReplay` |
| POST | `/v1/company/intelligence/:id/withdraw` | authenticated | platform-core | [src/routes/economicintelligence.js:9](../../src/routes/economicintelligence.js#L9) | `E.withdrawEconomicIntelligence` |
| GET | `/v1/company/intelligence/market` | authenticated | platform-core | [src/routes/economicintelligence.js:4](../../src/routes/economicintelligence.js#L4) | `E.economicIntelligenceMarket` |
| GET | `/v1/company/intelligence/mine` | authenticated | platform-core | [src/routes/economicintelligence.js:5](../../src/routes/economicintelligence.js#L5) | `E.economicIntelligenceEntitlements` |
| POST | `/v1/company/intelligence/publish` | authenticated | platform-core | [src/routes/economicintelligence.js:7](../../src/routes/economicintelligence.js#L7) | `E.publishEconomicIntelligence` |
| GET | `/v1/company/management-teams` | authenticated | world-graph | [src/routes/managementteams.js:7](../../src/routes/managementteams.js#L7) | `withItemRead` |
| POST | `/v1/company/management-teams/plans/:id/autonomy` | authenticated | platform-core | [src/routes/managementteams.js:12](../../src/routes/managementteams.js#L12) | — |
| POST | `/v1/company/management-teams/plans/:id/execute` | authenticated | platform-core | [src/routes/managementteams.js:11](../../src/routes/managementteams.js#L11) | — |
| GET | `/v1/company/negotiations` | authenticated | platform-core | [src/routes/commercialnegotiation.js:4](../../src/routes/commercialnegotiation.js#L4) | `N.commercialNegotiationBoard` |
| POST | `/v1/company/negotiations` | authenticated | platform-core | [src/routes/commercialnegotiation.js:5](../../src/routes/commercialnegotiation.js#L5) | `N.commercialNegotiationCreateTarget` |
| POST | `/v1/company/negotiations/:id/act` | authenticated | platform-core | [src/routes/commercialnegotiation.js:6](../../src/routes/commercialnegotiation.js#L6) | `N.commercialNegotiationParty` |
| POST | `/v1/company/negotiations/:id/expire` | authenticated | platform-core | [src/routes/commercialnegotiation.js:7](../../src/routes/commercialnegotiation.js#L7) | `N.expireCommercialNegotiation` |
| GET | `/v1/company/operator` | authenticated | platform-core | [src/routes/companyoperators.js:8](../../src/routes/companyoperators.js#L8) | `Operators.companyOperatorBoard` |
| POST | `/v1/company/operator` | authenticated | platform-core | [src/routes/companyoperators.js:9](../../src/routes/companyoperators.js#L9) | `Operators.setCompanyOperator` |
| POST | `/v1/company/operator/run` | authenticated | platform-core | [src/routes/companyoperators.js:11](../../src/routes/companyoperators.js#L11) | `Operators.runCompanyOperator` |
| GET | `/v1/company/opportunities` | authenticated | platform-core | [src/routes/companyopportunities.js:5](../../src/routes/companyopportunities.js#L5) | `Opportunities.companyOpportunityInbox` |
| POST | `/v1/company/opportunities/acknowledge` | authenticated | platform-core | [src/routes/companyopportunities.js:13](../../src/routes/companyopportunities.js#L13) | `Opportunities.acknowledgeCompanyOpportunity` |
| POST | `/v1/company/opportunities/refresh` | authenticated | platform-core | [src/routes/companyopportunities.js:9](../../src/routes/companyopportunities.js#L9) | `Opportunities.refreshCompanyOpportunities` |
| POST | `/v1/company/opportunities/subscription` | authenticated | platform-core | [src/routes/companyopportunities.js:7](../../src/routes/companyopportunities.js#L7) | `Opportunities.setCompanyOpportunitySubscription` |
| GET | `/v1/company/partnerships` | authenticated | platform-core | [src/routes/businesspartnerships.js:4](../../src/routes/businesspartnerships.js#L4) | `P.businessPartnershipBoard` |
| POST | `/v1/company/partnerships` | authenticated | platform-core | [src/routes/businesspartnerships.js:5](../../src/routes/businesspartnerships.js#L5) | `P.businessPartnershipTerms` |
| POST | `/v1/company/partnerships/:id/accept` | authenticated | platform-core | [src/routes/businesspartnerships.js:7](../../src/routes/businesspartnerships.js#L7) | `pair` |
| POST | `/v1/company/partnerships/:id/close` | authenticated | platform-core | [src/routes/businesspartnerships.js:11](../../src/routes/businesspartnerships.js#L11) | `P.closeBusinessPartnership` |
| POST | `/v1/company/partnerships/:id/contribute` | authenticated | platform-core | [src/routes/businesspartnerships.js:8](../../src/routes/businesspartnerships.js#L8) | `pair` |
| POST | `/v1/company/partnerships/:id/distribute` | authenticated | platform-core | [src/routes/businesspartnerships.js:10](../../src/routes/businesspartnerships.js#L10) | `pair` |
| POST | `/v1/company/partnerships/:id/governance/optin` | authenticated | platform-core | [src/routes/companygovernance.js:6](../../src/routes/companygovernance.js#L6) | `pair` |
| POST | `/v1/company/partnerships/:id/governance/proposals` | authenticated | platform-core | [src/routes/companygovernance.js:8](../../src/routes/companygovernance.js#L8) | `pair` |
| GET | `/v1/company/partnerships/:id/governance/snapshot` | authenticated | platform-core | [src/routes/companygovernance.js:7](../../src/routes/companygovernance.js#L7) | `pair` |
| GET | `/v1/company/partnerships/:id/quote` | authenticated | platform-core | [src/routes/businesspartnerships.js:9](../../src/routes/businesspartnerships.js#L9) | `pair` |
| POST | `/v1/company/partnerships/:id/team/optin` | authenticated | platform-core | [src/routes/managementteams.js:8](../../src/routes/managementteams.js#L8) | — |
| POST | `/v1/company/partnerships/:id/team/plans` | authenticated | platform-core | [src/routes/managementteams.js:10](../../src/routes/managementteams.js#L10) | — |
| GET | `/v1/company/partnerships/:id/team/snapshot` | authenticated | platform-core | [src/routes/managementteams.js:9](../../src/routes/managementteams.js#L9) | `G.GameError` |
| POST | `/v1/company/partnerships/:id/team/withdraw` | authenticated | platform-core | [src/routes/managementteams.js:13](../../src/routes/managementteams.js#L13) | — |
| GET | `/v1/company/production` | authenticated | world-graph | [src/routes/companyproduction.js:7](../../src/routes/companyproduction.js#L7) | `withItemTransaction` |
| POST | `/v1/company/production/run` | authenticated | world-graph | [src/routes/companyproduction.js:11](../../src/routes/companyproduction.js#L11) | `withItemTransaction` |
| GET | `/v1/company/reputation` | authenticated | platform-core | [src/routes/commercialreputation.js:5](../../src/routes/commercialreputation.js#L5) | `Reputation.ownCommercialReputation` |
| POST | `/v1/company/reputation` | authenticated | platform-core | [src/routes/commercialreputation.js:7](../../src/routes/commercialreputation.js#L7) | `Reputation.setCommercialReputation` |
| GET | `/v1/company/reputation/public/:accountId` | public | platform-core | [src/routes/commercialreputation.js:13](../../src/routes/commercialreputation.js#L13) | `Reputation.publicCommercialReputation` |
| POST | `/v1/company/reputation/refresh` | authenticated | platform-core | [src/routes/commercialreputation.js:9](../../src/routes/commercialreputation.js#L9) | `Reputation.refreshCommercialReputation` |
| GET | `/v1/company/seasons` | authenticated | platform-core | [src/routes/businessseasons.js:4](../../src/routes/businessseasons.js#L4) | `Seasons.businessSeasonBoard` |
| POST | `/v1/company/seasons` | authenticated | platform-core | [src/routes/businessseasons.js:5](../../src/routes/businessseasons.js#L5) | `Seasons.createBusinessSeason` |
| POST | `/v1/company/seasons/:id/observe` | authenticated | platform-core | [src/routes/businessseasons.js:8](../../src/routes/businessseasons.js#L8) | `Seasons.observeBusinessSeason` |
| POST | `/v1/company/seasons/enroll` | authenticated | platform-core | [src/routes/businessseasons.js:6](../../src/routes/businessseasons.js#L6) | `Seasons.enrollBusinessSeason` |
| GET | `/v1/company/seasons/public/:id` | public | platform-core | [src/routes/businessseasons.js:12](../../src/routes/businessseasons.js#L12) | `Seasons.publicBusinessSeason` |
| POST | `/v1/company/seasons/visibility` | authenticated | platform-core | [src/routes/businessseasons.js:7](../../src/routes/businessseasons.js#L7) | `Seasons.setBusinessSeasonVisibility` |
| GET | `/v1/company/specializations` | authenticated | platform-core | [src/routes/companyspecialization.js:4](../../src/routes/companyspecialization.js#L4) | `ownCompanySpecializations` |
| POST | `/v1/company/specializations` | authenticated | world-graph | [src/routes/companyspecialization.js:5](../../src/routes/companyspecialization.js#L5) | `withItemTransaction` |
| GET | `/v1/company/vaults` | authenticated | platform-core | [src/routes/customervaults.js:9](../../src/routes/customervaults.js#L9) | `V.customerVaultBoard` |
| GET | `/v1/company/vaults/availability` | authenticated | platform-core | [src/routes/customervaults.js:8](../../src/routes/customervaults.js#L8) | — |
| GET | `/v1/company/vaults/offers` | authenticated | platform-core | [src/routes/customervaults.js:10](../../src/routes/customervaults.js#L10) | `V.customerVaultOffers` |
| GET | `/v1/company/workflows` | authenticated | platform-core | [src/routes/companyworkflows.js:5](../../src/routes/companyworkflows.js#L5) | `Workflow.companyWorkflowBoard` |
| POST | `/v1/company/workflows` | authenticated | platform-core | [src/routes/companyworkflows.js:7](../../src/routes/companyworkflows.js#L7) | `Workflow.createCompanyWorkflow` |
| POST | `/v1/company/workflows/:id/advance` | authenticated | platform-core | [src/routes/companyworkflows.js:9](../../src/routes/companyworkflows.js#L9) | `Workflow.advanceCompanyWorkflow` |
| POST | `/v1/company/workflows/:id/cancel` | authenticated | platform-core | [src/routes/companyworkflows.js:11](../../src/routes/companyworkflows.js#L11) | `Workflow.cancelCompanyWorkflow` |
| GET | `/v1/consignments` | authenticated | world-graph | [src/routes/consignments.js:6](../../src/routes/consignments.js#L6) | `withItemRead` |
| GET | `/v1/contacts` | authenticated | engagement-growth | [src/server.js:3493](../../src/server.js#L3493) | `Contacts.contactsBoard` |
| GET | `/v1/content` | authenticated | platform-core | [src/routes/content.js:171](../../src/routes/content.js#L171) | `contentBoard` |
| POST | `/v1/content/:namespace/exchange/:listingId/cancel` | authenticated | platform-core | [src/routes/content.js:193](../../src/routes/content.js#L193) | `G.withCharacter` |
| POST | `/v1/content/:namespace/exchange/:listingId/fill` | authenticated | platform-core | [src/routes/content.js:201](../../src/routes/content.js#L201) | `G.GameError` |
| POST | `/v1/content/:namespace/exchange/list` | authenticated | platform-core | [src/routes/content.js:180](../../src/routes/content.js#L180) | `G.withCharacter` |
| POST | `/v1/content/:namespace/instances` | authenticated | platform-core | [src/routes/content.js:262](../../src/routes/content.js#L262) | `createContentInstance` |
| POST | `/v1/content/:namespace/jobs/:jobId/collect` | authenticated | platform-core | [src/routes/content.js:238](../../src/routes/content.js#L238) | `G.withCharacter` |
| POST | `/v1/content/:namespace/jobs/:jobId/start` | authenticated | platform-core | [src/routes/content.js:230](../../src/routes/content.js#L230) | `G.withCharacter` |
| POST | `/v1/content/:namespace/recipes/:recipeId/craft` | authenticated | platform-core | [src/routes/content.js:246](../../src/routes/content.js#L246) | `G.withCharacter` |
| POST | `/v1/content/:namespace/sources/:sourceId/collect` | authenticated | platform-core | [src/routes/content.js:222](../../src/routes/content.js#L222) | `G.withCharacter` |
| POST | `/v1/content/:namespace/tools/:toolId/repair` | authenticated | platform-core | [src/routes/content.js:254](../../src/routes/content.js#L254) | `G.withCharacter` |
| GET | `/v1/content/instances/:instanceId` | authenticated | platform-core | [src/routes/content.js:272](../../src/routes/content.js#L272) | `contentInstanceBoard` |
| POST | `/v1/content/instances/:instanceId/act` | authenticated | platform-core | [src/routes/content.js:292](../../src/routes/content.js#L292) | `actOnContentInstance` |
| POST | `/v1/content/instances/:instanceId/claim` | authenticated | platform-core | [src/routes/content.js:323](../../src/routes/content.js#L323) | `claimContentRewards` |
| POST | `/v1/content/instances/:instanceId/consent` | authenticated | platform-core | [src/routes/content.js:285](../../src/routes/content.js#L285) | `setContentConsent` |
| POST | `/v1/content/instances/:instanceId/join` | authenticated | platform-core | [src/routes/content.js:276](../../src/routes/content.js#L276) | `joinContentInstance` |
| POST | `/v1/content/instances/:instanceId/leave` | authenticated | platform-core | [src/routes/content.js:307](../../src/routes/content.js#L307) | `leaveContentInstance` |
| POST | `/v1/content/instances/:instanceId/notes` | authenticated | platform-core | [src/routes/content.js:313](../../src/routes/content.js#L313) | `addContentCaseNote` |
| POST | `/v1/content/instances/:instanceId/quality` | authenticated | platform-core | [src/routes/content.js:303](../../src/routes/content.js#L303) | `actOnContentQuality` |
| POST | `/v1/content/instances/:instanceId/release` | authenticated | platform-core | [src/routes/content.js:319](../../src/routes/content.js#L319) | `releaseContentRole` |
| GET | `/v1/contracts` | authenticated | social-combat | [src/server.js:2921](../../src/server.js#L2921) | `S.listContracts` |
| POST | `/v1/contracts/:targetId/:kind/cancel` | authenticated | social-combat | [src/server.js:2925](../../src/server.js#L2925) | `S.cancelBounty` |
| POST | `/v1/contracts/peek` | authenticated | social-combat | [src/server.js:2923](../../src/server.js#L2923) | `S.peekContracts` |
| POST | `/v1/convoy` | authenticated | enterprise-logistics | [src/routes/convoy.js:9](../../src/routes/convoy.js#L9) | `Convoy.openConvoy` |
| POST | `/v1/convoy/:id/ambush` | authenticated | enterprise-logistics | [src/routes/convoy.js:17](../../src/routes/convoy.js#L17) | `Convoy.ambushConvoy` |
| POST | `/v1/convoy/:id/collect` | authenticated | enterprise-logistics | [src/routes/convoy.js:19](../../src/routes/convoy.js#L19) | `Convoy.collectConvoy` |
| POST | `/v1/convoy/cancel` | authenticated | enterprise-logistics | [src/routes/convoy.js:15](../../src/routes/convoy.js#L15) | `Convoy.cancelConvoy` |
| POST | `/v1/convoy/depart` | authenticated | enterprise-logistics | [src/routes/convoy.js:13](../../src/routes/convoy.js#L13) | `Convoy.departConvoy` |
| POST | `/v1/convoy/load` | authenticated | enterprise-logistics | [src/routes/convoy.js:11](../../src/routes/convoy.js#L11) | `Convoy.loadConvoy` |
| POST | `/v1/convoy/rig/:kind` | authenticated | enterprise-logistics | [src/routes/convoy.js:22](../../src/routes/convoy.js#L22) | `Convoy.buyRig` |
| POST | `/v1/convoy/rig/upgrade` | authenticated | enterprise-logistics | [src/routes/convoy.js:24](../../src/routes/convoy.js#L24) | `Convoy.upgradeRig` |
| GET | `/v1/convoys` | authenticated | enterprise-logistics | [src/server.js:2633](../../src/server.js#L2633) | `Convoy.convoyBoard` |
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
| GET | `/v1/corner` | authenticated | platform-core | [src/server.js:1875](../../src/server.js#L1875) | `Corner.cornerBoard` |
| POST | `/v1/corner/:slot/accept` | authenticated | platform-core | [src/server.js:1877](../../src/server.js#L1877) | `Corner.acceptCorner` |
| POST | `/v1/corner/:slot/claim` | authenticated | platform-core | [src/server.js:1879](../../src/server.js#L1879) | `Corner.claimCorner` |
| GET | `/v1/crew` | authenticated | social-combat | [src/server.js:3521](../../src/server.js#L3521) | `Crew.crewBoard` |
| POST | `/v1/crew` | authenticated | social-combat | [src/server.js:3531](../../src/server.js#L3531) | `Crew.createCrew` |
| POST | `/v1/crew/accept/:crewId` | authenticated | social-combat | [src/server.js:3535](../../src/server.js#L3535) | `Crew.acceptInvite` |
| GET | `/v1/crew/chat` | authenticated | platform-core | [src/server.js:3478](../../src/server.js#L3478) | `readChat` |
| POST | `/v1/crew/chat` | authenticated | platform-core | [src/server.js:3477](../../src/server.js#L3477) | `postChat` |
| POST | `/v1/crew/decline/:crewId` | authenticated | social-combat | [src/server.js:3537](../../src/server.js#L3537) | `Crew.declineInvite` |
| POST | `/v1/crew/invite` | authenticated | social-combat | [src/server.js:3533](../../src/server.js#L3533) | `Crew.inviteToCrew` |
| POST | `/v1/crew/leave` | authenticated | social-combat | [src/server.js:3539](../../src/server.js#L3539) | `Crew.leaveCrew` |
| GET | `/v1/crew/logistics` | authenticated | platform-core | [src/routes/crewlogistics.js:6](../../src/routes/crewlogistics.js#L6) | `Logistics.crewLogisticsBoard` |
| POST | `/v1/crew/logistics-links` | authenticated | platform-core | [src/routes/crewlogistics.js:9](../../src/routes/crewlogistics.js#L9) | `Logistics.publishCrewLogisticsLink` |
| POST | `/v1/crew/logistics-links/:id/revoke` | authenticated | platform-core | [src/routes/crewlogistics.js:12](../../src/routes/crewlogistics.js#L12) | `Logistics.revokeCrewLogisticsLink` |
| DELETE | `/v1/crew/member/:characterId` | authenticated | social-combat | [src/server.js:3542](../../src/server.js#L3542) | `Crew.kickMember` |
| POST | `/v1/crew/objective/claim` | authenticated | social-combat | [src/server.js:3568](../../src/server.js#L3568) | `Crew.claimObjective` |
| POST | `/v1/crew/recruiting` | authenticated | social-combat | [src/server.js:3554](../../src/server.js#L3554) | `Crew.setRecruiting` |
| DELETE | `/v1/crew/request/:characterId` | authenticated | social-combat | [src/server.js:3564](../../src/server.js#L3564) | `Crew.declineRequest` |
| POST | `/v1/crew/request/:characterId/accept` | authenticated | social-combat | [src/server.js:3560](../../src/server.js#L3560) | `Crew.acceptRequest` |
| POST | `/v1/crew/request/:crewId` | authenticated | social-combat | [src/server.js:3558](../../src/server.js#L3558) | `Crew.requestJoin` |
| DELETE | `/v1/crew/target` | authenticated | social-combat | [src/server.js:3550](../../src/server.js#L3550) | `Crew.clearCrewTarget` |
| POST | `/v1/crew/target` | authenticated | social-combat | [src/server.js:3548](../../src/server.js#L3548) | `Crew.setCrewTarget` |
| POST | `/v1/crimes/:id` | authenticated | platform-core | [src/server.js:1857](../../src/server.js#L1857) | `G.withCharacter` |
| GET | `/v1/customer/layaway` | authenticated | world-graph | [src/routes/customerlayaway.js:4](../../src/routes/customerlayaway.js#L4) | `withItemRead` |
| GET | `/v1/daily` | authenticated | engagement-growth | [src/server.js:3692](../../src/server.js#L3692) | `W.getDaily` |
| POST | `/v1/daily/:id/claim` | authenticated | engagement-growth | [src/server.js:3697](../../src/server.js#L3697) | `W.claimDaily` |
| GET | `/v1/day` | authenticated | world-progression | [src/server.js:2819](../../src/server.js#L2819) | `Day.dayBoard` |
| GET | `/v1/deeds` | authenticated | enterprise-logistics | [src/routes/deeds.js:19](../../src/routes/deeds.js#L19) | `Deeds.deedBoard` |
| GET | `/v1/deeds/buildings` | authenticated | platform-core | [src/routes/deeds.js:11](../../src/routes/deeds.js#L11) | `buildingAtlas` |
| POST | `/v1/deeds/buy/:sellerCharacterId` | authenticated | enterprise-logistics | [src/routes/deeds.js:35](../../src/routes/deeds.js#L35) | `Deeds.buyDeed` |
| POST | `/v1/deeds/claim` | authenticated | enterprise-logistics | [src/routes/deeds.js:21](../../src/routes/deeds.js#L21) | `Deeds.claimDeed` |
| POST | `/v1/deeds/corner` | authenticated | enterprise-logistics | [src/routes/deeds.js:25](../../src/routes/deeds.js#L25) | `Deeds.collectCorner` |
| GET | `/v1/deeds/discovery` | authenticated | platform-core | [src/routes/deeds.js:13](../../src/routes/deeds.js#L13) | `G.readCharacter` |
| POST | `/v1/deeds/extract` | authenticated | chain-economy | [src/server.js:3870](../../src/server.js#L3870) | `Chain.requestDeedWithdraw` |
| POST | `/v1/deeds/investigate` | authenticated | platform-core | [src/routes/deeds.js:16](../../src/routes/deeds.js#L16) | `G.withCharacter` |
| POST | `/v1/deeds/list` | authenticated | enterprise-logistics | [src/routes/deeds.js:31](../../src/routes/deeds.js#L31) | `Deeds.listDeed` |
| GET | `/v1/deeds/plate/:tokenId` | public | enterprise-logistics | [src/server.js:970](../../src/server.js#L970) | `Deeds.deedByToken` |
| POST | `/v1/deeds/shakedown/:targetCharacterId` | authenticated | enterprise-logistics | [src/routes/deeds.js:27](../../src/routes/deeds.js#L27) | `Deeds.shakedownCorner` |
| POST | `/v1/deeds/unlist` | authenticated | enterprise-logistics | [src/routes/deeds.js:33](../../src/routes/deeds.js#L33) | `Deeds.unlistDeed` |
| POST | `/v1/deeds/upgrade` | authenticated | platform-core | [src/server.js:3868](../../src/server.js#L3868) | `DeedUpgrades.upgradeDeed` |
| GET | `/v1/deeds/vault/:sellerCharacterId` | authenticated | enterprise-logistics | [src/routes/deeds.js:43](../../src/routes/deeds.js#L43) | `Deeds.deedVaultRecord` |
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
| GET | `/v1/desk` | public | platform-core | [src/server.js:1962](../../src/server.js#L1962) | `Desk.deskBoard` |
| GET | `/v1/digest` | authenticated | engagement-growth | [src/server.js:3654](../../src/server.js#L3654) | `Dispatch.getDigestPrefs` |
| POST | `/v1/digest` | authenticated | engagement-growth | [src/server.js:3655](../../src/server.js#L3655) | `Dispatch.setDigestPrefs` |
| GET | `/v1/digest/confirm` | public | engagement-growth | [src/server.js:3659](../../src/server.js#L3659) | `Dispatch.confirmEmail` |
| GET | `/v1/digest/unsubscribe` | public | engagement-growth | [src/server.js:3669](../../src/server.js#L3669) | `Dispatch.unsubscribe` |
| GET | `/v1/diplomacy` | authenticated | platform-core | [src/routes/diplomacy.js:10](../../src/routes/diplomacy.js#L10) | `Diplomacy.diplomacyBoard` |
| POST | `/v1/diplomacy/coalition/:gangId` | authenticated | platform-core | [src/routes/diplomacy.js:18](../../src/routes/diplomacy.js#L18) | `Diplomacy.formCoalition` |
| DELETE | `/v1/diplomacy/coalition/:id` | authenticated | platform-core | [src/routes/diplomacy.js:22](../../src/routes/diplomacy.js#L22) | `Diplomacy.leaveCoalition` |
| POST | `/v1/diplomacy/coalition/:id/join` | authenticated | platform-core | [src/routes/diplomacy.js:20](../../src/routes/diplomacy.js#L20) | `Diplomacy.joinCoalition` |
| DELETE | `/v1/diplomacy/pact/:gangId` | authenticated | platform-core | [src/routes/diplomacy.js:16](../../src/routes/diplomacy.js#L16) | `Diplomacy.breakPact` |
| POST | `/v1/diplomacy/pact/:gangId` | authenticated | platform-core | [src/routes/diplomacy.js:12](../../src/routes/diplomacy.js#L12) | `Diplomacy.proposePact` |
| POST | `/v1/diplomacy/pact/:gangId/accept` | authenticated | platform-core | [src/routes/diplomacy.js:14](../../src/routes/diplomacy.js#L14) | `Diplomacy.acceptPact` |
| GET | `/v1/discovery` | authenticated | engagement-growth | [src/server.js:3573](../../src/server.js#L3573) | `Discovery.discoveryBoard` |
| POST | `/v1/discovery/lfg` | authenticated | engagement-growth | [src/server.js:3578](../../src/server.js#L3578) | `Discovery.setLfg` |
| GET | `/v1/districts` | public | social-combat | [src/server.js:2771](../../src/server.js#L2771) | `S.onWatch` |
| POST | `/v1/districts/:id/claim` | authenticated | social-combat | [src/server.js:2051](../../src/server.js#L2051) | `S.stakeClaim` |
| POST | `/v1/districts/:id/seize` | authenticated | social-combat | [src/server.js:2037](../../src/server.js#L2037) | `S.seizeDistrict` |
| POST | `/v1/districts/:id/watch` | authenticated | social-combat | [src/server.js:2040](../../src/server.js#L2040) | `S.setWatch` |
| GET | `/v1/drop` | authenticated | engagement-growth | [src/server.js:2851](../../src/server.js#L2851) | `Drop.dropBoard` |
| POST | `/v1/drop/claim` | authenticated | engagement-growth | [src/server.js:2853](../../src/server.js#L2853) | `Drop.claimDrop` |
| POST | `/v1/drop/solana` | authenticated | engagement-growth | [src/server.js:2860](../../src/server.js#L2860) | `Drop.claimDropSolana` |
| POST | `/v1/drop/solana/challenge` | authenticated | engagement-growth | [src/server.js:2858](../../src/server.js#L2858) | `Drop.solanaChallenge` |
| GET | `/v1/duels` | authenticated | social-combat | [src/server.js:4024](../../src/server.js#L4024) | `Duels.duelBoard` |
| POST | `/v1/duels/:targetId` | authenticated | social-combat | [src/server.js:4030](../../src/server.js#L4030) | `Duels.challenge` |
| POST | `/v1/duels/list` | authenticated | social-combat | [src/server.js:4026](../../src/server.js#L4026) | `Duels.listDuel` |
| POST | `/v1/duels/style` | authenticated | social-combat | [src/server.js:4028](../../src/server.js#L4028) | `Duels.pickStyle` |
| GET | `/v1/dynasty` | authenticated | chain-economy | [src/server.js:3732](../../src/server.js#L3732) | `Dynasty.dynastyBoard` |
| POST | `/v1/dynasty/accept/:accountId` | authenticated | chain-economy | [src/server.js:3736](../../src/server.js#L3736) | `Dynasty.acceptMarriage` |
| DELETE | `/v1/dynasty/consigliere` | authenticated | chain-economy | [src/server.js:3744](../../src/server.js#L3744) | `Dynasty.endConsigliere` |
| POST | `/v1/dynasty/consigliere/:characterId` | authenticated | chain-economy | [src/server.js:3740](../../src/server.js#L3740) | `Dynasty.nameConsigliere` |
| POST | `/v1/dynasty/consigliere/accept/:accountId` | authenticated | chain-economy | [src/server.js:3742](../../src/server.js#L3742) | `Dynasty.acceptConsigliere` |
| POST | `/v1/dynasty/divorce` | authenticated | chain-economy | [src/server.js:3738](../../src/server.js#L3738) | `Dynasty.divorceMarriage` |
| POST | `/v1/dynasty/name` | authenticated | economy-ledger | [src/server.js:2545](../../src/server.js#L2545) | `Portfolio.nameDynasty` |
| POST | `/v1/dynasty/propose/:characterId` | authenticated | chain-economy | [src/server.js:3734](../../src/server.js#L3734) | `Dynasty.proposeMarriage` |
| GET | `/v1/equipment-recovery` | authenticated | world-graph | [src/routes/equipmentrecovery.js:6](../../src/routes/equipmentrecovery.js#L6) | `withItemRead` |
| POST | `/v1/equipment-recovery` | authenticated | world-graph | [src/routes/equipmentrecovery.js:10](../../src/routes/equipmentrecovery.js#L10) | `withItemTransaction` |
| GET | `/v1/equipment/rentals` | authenticated | platform-core | [src/routes/equipmentrentals.js:5](../../src/routes/equipmentrentals.js#L5) | `Rentals.equipmentRentalBoard` |
| POST | `/v1/equipment/rentals/accept` | authenticated | world-graph | [src/routes/equipmentrentals.js:8](../../src/routes/equipmentrentals.js#L8) | `withItemTransaction` |
| POST | `/v1/equipment/rentals/end` | authenticated | world-graph | [src/routes/equipmentrentals.js:9](../../src/routes/equipmentrentals.js#L9) | `withItemTransaction` |
| POST | `/v1/equipment/rentals/offers` | authenticated | world-graph | [src/routes/equipmentrentals.js:6](../../src/routes/equipmentrentals.js#L6) | `withItemTransaction` |
| POST | `/v1/equipment/rentals/offers/cancel` | authenticated | world-graph | [src/routes/equipmentrentals.js:7](../../src/routes/equipmentrentals.js#L7) | `withItemTransaction` |
| GET | `/v1/estate` | authenticated | enterprise-logistics | [src/routes/estate.js:18](../../src/routes/estate.js#L18) | `Estate.estateBoard` |
| POST | `/v1/estate/feature/:id` | authenticated | enterprise-logistics | [src/routes/estate.js:22](../../src/routes/estate.js#L22) | `Estate.unlockFeature` |
| POST | `/v1/estate/gala` | authenticated | enterprise-logistics | [src/routes/estate.js:33](../../src/routes/estate.js#L33) | `Estate.throwGala` |
| POST | `/v1/estate/gala/attend` | authenticated | enterprise-logistics | [src/routes/estate.js:35](../../src/routes/estate.js#L35) | `Estate.attendGala` |
| POST | `/v1/estate/name` | authenticated | enterprise-logistics | [src/routes/estate.js:24](../../src/routes/estate.js#L24) | `Estate.nameEstate` |
| DELETE | `/v1/estate/staff/:id` | authenticated | enterprise-logistics | [src/routes/estate.js:29](../../src/routes/estate.js#L29) | `Estate.dismissStaff` |
| POST | `/v1/estate/staff/:id` | authenticated | enterprise-logistics | [src/routes/estate.js:27](../../src/routes/estate.js#L27) | `Estate.hireStaff` |
| POST | `/v1/estate/upgrade` | authenticated | enterprise-logistics | [src/routes/estate.js:20](../../src/routes/estate.js#L20) | `Estate.upgradeEstate` |
| POST | `/v1/estate/wages` | authenticated | enterprise-logistics | [src/routes/estate.js:31](../../src/routes/estate.js#L31) | `Estate.payStaffWages` |
| GET | `/v1/eth-staking` | authenticated | platform-core | [src/routes/ethstaking.js:4](../../src/routes/ethstaking.js#L4) | `ethStakingBoard` |
| POST | `/v1/eth-staking/transaction` | authenticated | platform-core | [src/routes/ethstaking.js:5](../../src/routes/ethstaking.js#L5) | `prepareEthStakingTransaction` |
| GET | `/v1/events` | public | world-progression | [src/server.js:3583](../../src/server.js#L3583) | `cityEventBoard` |
| GET | `/v1/events/markets` | authenticated | platform-core | [src/routes/eventmarkets.js:5](../../src/routes/eventmarkets.js#L5) | `E.eventMarketBoard` |
| GET | `/v1/events/markets/availability` | authenticated | platform-core | [src/routes/eventmarkets.js:4](../../src/routes/eventmarkets.js#L4) | `E.eventMarketReady` |
| GET | `/v1/exchange` | public | platform-core | [src/server.js:3191](../../src/server.js#L3191) | — |
| DELETE | `/v1/exchange/:id` | authenticated | social-combat | [src/server.js:3198](../../src/server.js#L3198) | `S.cancelListing` |
| POST | `/v1/exchange/:id/buy` | authenticated | social-combat | [src/server.js:3200](../../src/server.js#L3200) | `S.buyListing` |
| POST | `/v1/exchange/list` | authenticated | social-combat | [src/server.js:3196](../../src/server.js#L3196) | `S.listItem` |
| GET | `/v1/explore` | authenticated | world-progression | [src/server.js:3624](../../src/server.js#L3624) | `Explore.exploreBoard` |
| GET | `/v1/fairness` | public | economy-ledger | [src/server.js:3591](../../src/server.js#L3591) | `fairnessBoard` |
| GET | `/v1/favors` | authenticated | engagement-growth | [src/server.js:3509](../../src/server.js#L3509) | `Favors.favorBoard` |
| POST | `/v1/favors` | authenticated | engagement-growth | [src/server.js:3511](../../src/server.js#L3511) | `Favors.postFavor` |
| DELETE | `/v1/favors/:id` | authenticated | engagement-growth | [src/server.js:3515](../../src/server.js#L3515) | `Favors.cancelFavor` |
| POST | `/v1/favors/:id/run` | authenticated | engagement-growth | [src/server.js:3513](../../src/server.js#L3513) | `Favors.runFavor` |
| GET | `/v1/fees/status` | authenticated | economy-ledger | [src/server.js:3897](../../src/server.js#L3897) | `Fees.feeStatus` |
| GET | `/v1/feud/:characterId` | authenticated | platform-core | [src/server.js:3115](../../src/server.js#L3115) | `G.GameError` |
| POST | `/v1/feud/:targetId/peace` | authenticated | social-combat | [src/server.js:3136](../../src/server.js#L3136) | `S.proposePeace` |
| POST | `/v1/feud/:targetId/peace/accept` | authenticated | social-combat | [src/server.js:3138](../../src/server.js#L3138) | `S.acceptPeace` |
| GET | `/v1/firsts` | authenticated | world-progression | [src/server.js:3793](../../src/server.js#L3793) | `Firsts.firstsBoard` |
| GET | `/v1/forge` | authenticated | chain-economy | [src/server.js:3901](../../src/server.js#L3901) | `Forge.forgeBoard` |
| GET | `/v1/franchise-licenses` | authenticated | platform-core | [src/routes/franchises.js:6](../../src/routes/franchises.js#L6) | `G.readCharacter` |
| POST | `/v1/franchise-licenses/:id/accept` | authenticated | platform-core | [src/routes/franchises.js:21](../../src/routes/franchises.js#L21) | `Franchise.acceptFranchiseLicense` |
| POST | `/v1/franchise-licenses/:id/end` | authenticated | platform-core | [src/routes/franchises.js:31](../../src/routes/franchises.js#L31) | `Franchise.endFranchiseLicense` |
| GET | `/v1/gangs` | public | platform-core | [src/server.js:2718](../../src/server.js#L2718) | — |
| POST | `/v1/gangs` | authenticated | social-combat | [src/server.js:1997](../../src/server.js#L1997) | `S.createGang` |
| GET | `/v1/gangs/:id` | public | social-combat | [src/server.js:2735](../../src/server.js#L2735) | `S.resolveWarIfDue` |
| POST | `/v1/gangs/:id/join` | authenticated | social-combat | [src/server.js:1999](../../src/server.js#L1999) | `S.joinGang` |
| POST | `/v1/gangs/charter/:id` | authenticated | social-combat | [src/server.js:3176](../../src/server.js#L3176) | `S.chooseCharter` |
| GET | `/v1/gangs/chat` | authenticated | platform-core | [src/server.js:3476](../../src/server.js#L3476) | `readChat` |
| POST | `/v1/gangs/chat` | authenticated | platform-core | [src/server.js:3475](../../src/server.js#L3475) | `postChat` |
| POST | `/v1/gangs/contract/:targetId` | authenticated | social-combat | [src/server.js:3151](../../src/server.js#L3151) | `S.postFamilyContract` |
| POST | `/v1/gangs/contract/:targetId/:kind/cancel` | authenticated | social-combat | [src/server.js:3154](../../src/server.js#L3154) | `S.cancelFamilyContract` |
| POST | `/v1/gangs/foundation` | authenticated | engagement-growth | [src/server.js:3174](../../src/server.js#L3174) | `V.buyFoundation` |
| POST | `/v1/gangs/kick` | authenticated | social-combat | [src/server.js:2010](../../src/server.js#L2010) | `S.kickMember` |
| POST | `/v1/gangs/leave` | authenticated | social-combat | [src/server.js:2001](../../src/server.js#L2001) | `S.leaveGang` |
| POST | `/v1/gangs/portfolio/dividend` | authenticated | economy-ledger | [src/server.js:2517](../../src/server.js#L2517) | `Portfolio.claimFamilyDividend` |
| POST | `/v1/gangs/portfolio/invest` | authenticated | economy-ledger | [src/server.js:2511](../../src/server.js#L2511) | `Portfolio.familyInvest` |
| POST | `/v1/gangs/portfolio/name` | authenticated | economy-ledger | [src/server.js:2543](../../src/server.js#L2543) | `Portfolio.nameFamilyDynasty` |
| POST | `/v1/gangs/promote` | authenticated | social-combat | [src/server.js:2028](../../src/server.js#L2028) | `S.promoteMember` |
| POST | `/v1/gangs/tribute` | authenticated | social-combat | [src/server.js:2030](../../src/server.js#L2030) | `S.tribute` |
| POST | `/v1/gangs/tribute/omr` | authenticated | social-combat | [src/server.js:2033](../../src/server.js#L2033) | `S.tributeOmr` |
| POST | `/v1/gangs/vanity/color` | authenticated | engagement-growth | [src/server.js:3168](../../src/server.js#L3168) | `V.recolorGang` |
| POST | `/v1/gangs/vanity/name` | authenticated | engagement-growth | [src/server.js:3170](../../src/server.js#L3170) | `V.renameGang` |
| POST | `/v1/gangs/vanity/seal` | authenticated | engagement-growth | [src/server.js:3172](../../src/server.js#L3172) | `V.buySeal` |
| POST | `/v1/gangs/war/:targetGangId` | authenticated | social-combat | [src/server.js:2035](../../src/server.js#L2035) | `S.declareWar` |
| POST | `/v1/garage/:carId/fence` | authenticated | economy-ledger | [src/server.js:1918](../../src/server.js#L1918) | `E.fenceCar` |
| POST | `/v1/garage/:carId/melt` | authenticated | economy-ledger | [src/server.js:1914](../../src/server.js#L1914) | `E.meltCar` |
| POST | `/v1/garage/:carId/repair` | authenticated | economy-ledger | [src/server.js:1916](../../src/server.js#L1916) | `E.repairCar` |
| POST | `/v1/garage/boost` | authenticated | economy-ledger | [src/server.js:1912](../../src/server.js#L1912) | `E.boostCar` |
| GET | `/v1/gateway/activity` | public | platform-core | [src/routes/gateway.js:95](../../src/routes/gateway.js#L95) | `respond` |
| POST | `/v1/gateway/call` | public | platform-core | [src/routes/gateway.js:102](../../src/routes/gateway.js#L102) | `respond` |
| GET | `/v1/gateway/capabilities` | public | platform-core | [src/routes/gateway.js:98](../../src/routes/gateway.js#L98) | `observed` |
| GET | `/v1/gateway/connections` | public | platform-core | [src/routes/gateway.js:88](../../src/routes/gateway.js#L88) | `respond` |
| POST | `/v1/gateway/connections` | public | platform-core | [src/routes/gateway.js:89](../../src/routes/gateway.js#L89) | `respond` |
| DELETE | `/v1/gateway/connections/:id` | public | platform-core | [src/routes/gateway.js:94](../../src/routes/gateway.js#L94) | `respond` |
| GET | `/v1/gateway/events` | public | platform-core | [src/routes/gateway.js:114](../../src/routes/gateway.js#L114) | `observed` |
| GET | `/v1/gateway/events/catalog` | public | platform-core | [src/routes/gateway.js:106](../../src/routes/gateway.js#L106) | `observed` |
| GET | `/v1/gateway/events/stream` | public | platform-core | [src/routes/gateway.js:115](../../src/routes/gateway.js#L115) | `respond` |
| GET | `/v1/gateway/preparations/:id` | public | platform-core | [src/routes/gateway.js:96](../../src/routes/gateway.js#L96) | `respond` |
| POST | `/v1/gateway/preparations/:id/confirm` | public | platform-core | [src/routes/gateway.js:97](../../src/routes/gateway.js#L97) | `respond` |
| GET | `/v1/gateway/scopes` | public | platform-core | [src/routes/gateway.js:87](../../src/routes/gateway.js#L87) | `respond` |
| GET | `/v1/gateway/subscriptions` | public | platform-core | [src/routes/gateway.js:107](../../src/routes/gateway.js#L107) | `observed` |
| POST | `/v1/gateway/subscriptions` | public | platform-core | [src/routes/gateway.js:108](../../src/routes/gateway.js#L108) | `observed` |
| DELETE | `/v1/gateway/subscriptions/:id` | public | platform-core | [src/routes/gateway.js:113](../../src/routes/gateway.js#L113) | `observed` |
| POST | `/v1/gear/:id/mint` | authenticated | chain-economy | [src/server.js:1981](../../src/server.js#L1981) | `E.mintGear` |
| POST | `/v1/gear/:id/withdraw` | authenticated | chain-economy | [src/server.js:3858](../../src/server.js#L3858) | `Chain.requestGearWithdraw` |
| GET | `/v1/genesis-auction` | public | platform-core | [src/routes/genesisauction.js:30](../../src/routes/genesisauction.js#L30) | `unavailable` |
| POST | `/v1/genesis-auction/tx` | public | platform-core | [src/routes/genesisauction.js:40](../../src/routes/genesisauction.js#L40) | `unavailable` |
| POST | `/v1/goods/buy` | authenticated | economy-ledger | [src/server.js:1930](../../src/server.js#L1930) | `E.buyGood` |
| POST | `/v1/goods/sell` | authenticated | economy-ledger | [src/server.js:1932](../../src/server.js#L1932) | `E.sellGood` |
| POST | `/v1/heal` | authenticated | platform-core | [src/server.js:1881](../../src/server.js#L1881) | `G.withCharacter` |
| POST | `/v1/heist` | authenticated | engagement-growth | [src/server.js:3688](../../src/server.js#L3688) | `W.heist` |
| GET | `/v1/heists` | authenticated | social-combat | [src/routes/heists.js:10](../../src/routes/heists.js#L10) | `Heists.heistBoard` |
| POST | `/v1/heists/:id/case` | authenticated | social-combat | [src/routes/heists.js:24](../../src/routes/heists.js#L24) | `Heists.caseJob` |
| POST | `/v1/heists/:id/execute` | authenticated | social-combat | [src/routes/heists.js:28](../../src/routes/heists.js#L28) | `Heists.executeHeist` |
| POST | `/v1/heists/:id/fill` | authenticated | social-combat | [src/routes/heists.js:22](../../src/routes/heists.js#L22) | `Heists.fillHeist` |
| POST | `/v1/heists/:id/join` | authenticated | social-combat | [src/routes/heists.js:18](../../src/routes/heists.js#L18) | `Heists.joinHeist` |
| POST | `/v1/heists/:id/leave` | authenticated | social-combat | [src/routes/heists.js:20](../../src/routes/heists.js#L20) | `Heists.leaveHeist` |
| POST | `/v1/heists/:id/rat` | authenticated | social-combat | [src/routes/heists.js:26](../../src/routes/heists.js#L26) | `Heists.ratHeist` |
| POST | `/v1/heists/fence` | authenticated | social-combat | [src/routes/heists.js:30](../../src/routes/heists.js#L30) | `Heists.fenceLoot` |
| POST | `/v1/heists/plan` | authenticated | social-combat | [src/routes/heists.js:15](../../src/routes/heists.js#L15) | `Heists.planHeist` |
| GET | `/v1/home` | authenticated | engagement-growth | [src/server.js:2833](../../src/server.js#L2833) | `Home.homeBoard` |
| GET | `/v1/hustle` | authenticated | platform-core | [src/server.js:1869](../../src/server.js#L1869) | `Hustle.hustleBoard` |
| POST | `/v1/hustle/advance` | authenticated | platform-core | [src/server.js:1871](../../src/server.js#L1871) | `Hustle.advanceHustle` |
| GET | `/v1/identity/:characterId` | public | platform-core | [src/server.js:938](../../src/server.js#L938) | — |
| GET | `/v1/identity/:characterId/portrait.svg` | public | platform-core | [src/server.js:925](../../src/server.js#L925) | — |
| POST | `/v1/identity/bio` | authenticated | engagement-growth | [src/server.js:3714](../../src/server.js#L3714) | `W.setBio` |
| POST | `/v1/identity/checkout` | authenticated | platform-core | [src/server.js:3878](../../src/server.js#L3878) | `characterCheckout` |
| POST | `/v1/identity/claim/calldata` | authenticated | platform-core | [src/server.js:3880](../../src/server.js#L3880) | `characterClaim` |
| POST | `/v1/identity/mint` | authenticated | chain-economy | [src/server.js:3876](../../src/server.js#L3876) | `Chain.requestDynastyMint` |
| GET | `/v1/identity/readiness` | authenticated | platform-core | [src/server.js:3879](../../src/server.js#L3879) | `characterReadiness` |
| GET | `/v1/intel-forecasts` | authenticated | platform-core | [src/routes/intelforecasts.js:5](../../src/routes/intelforecasts.js#L5) | `Intel.intelForecastJobBoard` |
| POST | `/v1/intel-forecasts/:id/cancel` | authenticated | platform-core | [src/routes/intelforecasts.js:27](../../src/routes/intelforecasts.js#L27) | `Intel.cancelIntelForecastJob` |
| POST | `/v1/intel-forecasts/:id/report` | authenticated | platform-core | [src/routes/intelforecasts.js:14](../../src/routes/intelforecasts.js#L14) | `Intel.replayIntelForecastReport` |
| POST | `/v1/intel-forecasts/:id/resolve` | authenticated | platform-core | [src/routes/intelforecasts.js:30](../../src/routes/intelforecasts.js#L30) | `Intel.resolveIntelForecastOutcome` |
| POST | `/v1/intel-forecasts/reporters/:id/jobs` | authenticated | platform-core | [src/routes/intelforecasts.js:11](../../src/routes/intelforecasts.js#L11) | `Intel.createIntelForecastJob` |
| POST | `/v1/intel/share/:recipientId` | authenticated | platform-core | [src/server.js:2886](../../src/server.js#L2886) | `PlayerIntel.sharePlayerIntel` |
| GET | `/v1/invites` | authenticated | platform-core | [src/server.js:3523](../../src/server.js#L3523) | `Invites.inviteBoard` |
| POST | `/v1/invites` | authenticated | platform-core | [src/server.js:3527](../../src/server.js#L3527) | `Invites.issueCrewInvite` |
| POST | `/v1/items/:id/use` | authenticated | economy-ledger | [src/server.js:1926](../../src/server.js#L1926) | `E.useItem` |
| GET | `/v1/items/durability` | authenticated | platform-core | [src/routes/itemdurability.js:4](../../src/routes/itemdurability.js#L4) | `readCharacter` |
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
| GET | `/v1/landmarks` | public | world-progression | [src/server.js:2568](../../src/server.js#L2568) | `Landmarks.landmarkBoard` |
| POST | `/v1/landmarks/:districtId` | authenticated | world-progression | [src/server.js:2569](../../src/server.js#L2569) | `Landmarks.dedicateLandmark` |
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
| GET | `/v1/leaderboard/blood-wars` | authenticated | world-progression | [src/routes/leaderboards.js:112](../../src/routes/leaderboards.js#L112) | `NpcWar.bloodWarLeaderboard` |
| GET | `/v1/leaderboard/bloodline` | authenticated | platform-core | [src/routes/leaderboards.js:96](../../src/routes/leaderboards.js#L96) | `Bloodline.bloodlineLeaderboard` |
| GET | `/v1/leaderboard/boxing` | authenticated | vice-competition | [src/routes/leaderboards.js:49](../../src/routes/leaderboards.js#L49) | `Boxing.boxingLeaderboard` |
| GET | `/v1/leaderboard/builders` | authenticated | enterprise-logistics | [src/routes/leaderboards.js:106](../../src/routes/leaderboards.js#L106) | `Mega.builderLeaderboard` |
| GET | `/v1/leaderboard/city` | authenticated | world-progression | [src/routes/leaderboards.js:71](../../src/routes/leaderboards.js#L71) | `Standing.cityStanding` |
| GET | `/v1/leaderboard/clues` | authenticated | platform-core | [src/routes/leaderboards.js:109](../../src/routes/leaderboards.js#L109) | `Clues.clueLeaderboard` |
| GET | `/v1/leaderboard/collection` | authenticated | law-intelligence | [src/routes/leaderboards.js:101](../../src/routes/leaderboards.js#L101) | `Collection.collectionLeaderboard` |
| GET | `/v1/leaderboard/collectors` | authenticated | enterprise-logistics | [src/routes/leaderboards.js:61](../../src/routes/leaderboards.js#L61) | `Estate.collectorLeaderboard` |
| GET | `/v1/leaderboard/commanders` | authenticated | social-combat | [src/routes/leaderboards.js:100](../../src/routes/leaderboards.js#L100) | `Soldiers.commanderLeaderboard` |
| GET | `/v1/leaderboard/conquest` | authenticated | world-progression | [src/routes/leaderboards.js:113](../../src/routes/leaderboards.js#L113) | `NpcWar.conquestLeaderboard` |
| GET | `/v1/leaderboard/contacts` | authenticated | engagement-growth | [src/server.js:3496](../../src/server.js#L3496) | `Contacts.contactsLeaderboard` |
| GET | `/v1/leaderboard/convoy` | authenticated | enterprise-logistics | [src/routes/leaderboards.js:65](../../src/routes/leaderboards.js#L65) | `Convoy.convoyLeaderboard` |
| GET | `/v1/leaderboard/crews` | authenticated | social-combat | [src/server.js:3566](../../src/server.js#L3566) | `Crew.crewLeaderboard` |
| GET | `/v1/leaderboard/duels` | authenticated | social-combat | [src/routes/leaderboards.js:108](../../src/routes/leaderboards.js#L108) | `Duels.duelLeaderboard` |
| GET | `/v1/leaderboard/estates` | authenticated | enterprise-logistics | [src/routes/leaderboards.js:60](../../src/routes/leaderboards.js#L60) | `Estate.estateLeaderboard` |
| GET | `/v1/leaderboard/family-build` | authenticated | enterprise-logistics | [src/routes/leaderboards.js:107](../../src/routes/leaderboards.js#L107) | `Mega.familyBuildLeaderboard` |
| GET | `/v1/leaderboard/family-portfolio` | authenticated | economy-ledger | [src/routes/leaderboards.js:57](../../src/routes/leaderboards.js#L57) | `Portfolio.familyPortfolioLeaderboard` |
| GET | `/v1/leaderboard/family-wars` | authenticated | world-progression | [src/routes/leaderboards.js:114](../../src/routes/leaderboards.js#L114) | `NpcWar.familyWarWinsLeaderboard` |
| GET | `/v1/leaderboard/feuds` | authenticated | social-combat | [src/routes/leaderboards.js:91](../../src/routes/leaderboards.js#L91) | `S.feudLeaderboard` |
| GET | `/v1/leaderboard/foundation` | authenticated | engagement-growth | [src/routes/leaderboards.js:59](../../src/routes/leaderboards.js#L59) | `V.foundationLeaderboard` |
| GET | `/v1/leaderboard/frontier` | authenticated | world-progression | [src/routes/leaderboards.js:116](../../src/routes/leaderboards.js#L116) | `World.frontierLeaderboard` |
| GET | `/v1/leaderboard/heists` | authenticated | social-combat | [src/routes/leaderboards.js:66](../../src/routes/leaderboards.js#L66) | `Heists.heistLeaderboard` |
| GET | `/v1/leaderboard/hitmen` | authenticated | social-combat | [src/routes/leaderboards.js:68](../../src/routes/leaderboards.js#L68) | `S.hitmanLeaderboard` |
| GET | `/v1/leaderboard/honor` | authenticated | social-combat | [src/routes/leaderboards.js:98](../../src/routes/leaderboards.js#L98) | `Honor.honorLeaderboard` |
| GET | `/v1/leaderboard/kingpins` | authenticated | platform-core | [src/routes/leaderboards.js:93](../../src/routes/leaderboards.js#L93) | `K.kingpinLeaderboard` |
| GET | `/v1/leaderboard/launderers` | authenticated | enterprise-logistics | [src/routes/leaderboards.js:44](../../src/routes/leaderboards.js#L44) | `Business.laundererLeaderboard` |
| GET | `/v1/leaderboard/mentors` | authenticated | social-combat | [src/server.js:3605](../../src/server.js#L3605) | `Mentor.mentorLeaderboard` |
| GET | `/v1/leaderboard/nightlife` | authenticated | vice-competition | [src/routes/leaderboards.js:45](../../src/routes/leaderboards.js#L45) | `Speakeasy.nightlifeLeaderboard` |
| GET | `/v1/leaderboard/patrons` | authenticated | platform-core | [src/routes/leaderboards.js:104](../../src/routes/leaderboards.js#L104) | `Store.benefactorLeaderboard` |
| GET | `/v1/leaderboard/port` | authenticated | enterprise-logistics | [src/routes/leaderboards.js:55](../../src/routes/leaderboards.js#L55) | `Port.portLeaderboard` |
| GET | `/v1/leaderboard/portfolio` | authenticated | economy-ledger | [src/routes/leaderboards.js:58](../../src/routes/leaderboards.js#L58) | `Portfolio.portfolioLeaderboard` |
| GET | `/v1/leaderboard/races` | authenticated | vice-competition | [src/routes/leaderboards.js:54](../../src/routes/leaderboards.js#L54) | `Races.raceLeaderboard` |
| GET | `/v1/leaderboard/recruiters` | authenticated | platform-core | [src/routes/leaderboards.js:83](../../src/routes/leaderboards.js#L83) | `recruitersBoard` |
| GET | `/v1/leaderboard/sov` | authenticated | world-progression | [src/routes/leaderboards.js:95](../../src/routes/leaderboards.js#L95) | `Sov.sovLeaderboard` |
| GET | `/v1/leaderboard/stable` | authenticated | vice-competition | [src/routes/leaderboards.js:53](../../src/routes/leaderboards.js#L53) | `Stable.stableLeaderboard` |
| GET | `/v1/leaderboard/statesmen` | authenticated | platform-core | [src/routes/leaderboards.js:56](../../src/routes/leaderboards.js#L56) | `Commission.statesmenLeaderboard` |
| GET | `/v1/leaderboard/streak` | authenticated | world-progression | [src/server.js:3612](../../src/server.js#L3612) | `Streak.streakLeaderboard` |
| GET | `/v1/leaderboard/streets` | authenticated | enterprise-logistics | [src/routes/leaderboards.js:62](../../src/routes/leaderboards.js#L62) | `Deeds.greatStreetsLeaderboard` |
| GET | `/v1/leaderboard/territory` | authenticated | enterprise-logistics | [src/routes/leaderboards.js:43](../../src/routes/leaderboards.js#L43) | `Territory.territoryLeaderboard` |
| GET | `/v1/leaderboard/trades` | authenticated | world-progression | [src/routes/leaderboards.js:94](../../src/routes/leaderboards.js#L94) | `Mastery.tradesLeaderboard` |
| GET | `/v1/leaderboard/tycoons` | authenticated | economy-ledger | [src/routes/leaderboards.js:42](../../src/routes/leaderboards.js#L42) | `E.tycoonLeaderboard` |
| GET | `/v1/leaderboard/underwriters` | authenticated | platform-core | [src/routes/leaderboards.js:102](../../src/routes/leaderboards.js#L102) | `Bonds.underwriterLeaderboard` |
| GET | `/v1/leaderboard/vouches` | authenticated | social-combat | [src/server.js:3645](../../src/server.js#L3645) | `Vouch.vouchLeaderboard` |
| GET | `/v1/leaderboard/wire` | authenticated | law-intelligence | [src/routes/leaderboards.js:63](../../src/routes/leaderboards.js#L63) | `Wire.wireLeaderboard` |
| GET | `/v1/leaderboard/world` | authenticated | world-progression | [src/routes/leaderboards.js:111](../../src/routes/leaderboards.js#L111) | `World.worldLeaderboard` |
| GET | `/v1/live` | authenticated | engagement-growth | [src/server.js:3619](../../src/server.js#L3619) | `Collision.collisionBoard` |
| GET | `/v1/loans` | authenticated | enterprise-logistics | [src/server.js:2436](../../src/server.js#L2436) | `Loans.loanBoard` |
| POST | `/v1/loans` | authenticated | enterprise-logistics | [src/server.js:2440](../../src/server.js#L2440) | `Loans.offerLoan` |
| POST | `/v1/loans/:id/buy` | authenticated | enterprise-logistics | [src/server.js:2496](../../src/server.js#L2496) | `Loans.buyPaper` |
| POST | `/v1/loans/:id/cancel` | authenticated | enterprise-logistics | [src/server.js:2444](../../src/server.js#L2444) | `Loans.cancelLoan` |
| POST | `/v1/loans/:id/collect` | authenticated | enterprise-logistics | [src/server.js:2453](../../src/server.js#L2453) | `Loans.collectLoan` |
| POST | `/v1/loans/:id/repay` | authenticated | enterprise-logistics | [src/server.js:2447](../../src/server.js#L2447) | `Loans.repayLoan` |
| POST | `/v1/loans/:id/sell` | authenticated | enterprise-logistics | [src/server.js:2459](../../src/server.js#L2459) | `Loans.sellPaper` |
| POST | `/v1/loans/:id/take` | authenticated | platform-core | [src/server.js:2442](../../src/server.js#L2442) | `takeOwnedAdvance` |
| POST | `/v1/loans/:id/unsell` | authenticated | enterprise-logistics | [src/server.js:2461](../../src/server.js#L2461) | `Loans.unsellPaper` |
| POST | `/v1/loans/house` | authenticated | enterprise-logistics | [src/server.js:2465](../../src/server.js#L2465) | `Loans.takeHouseLoan` |
| POST | `/v1/loans/house/repay` | authenticated | enterprise-logistics | [src/server.js:2467](../../src/server.js#L2467) | `Loans.repayHouseLoan` |
| POST | `/v1/loans/square` | authenticated | enterprise-logistics | [src/server.js:2493](../../src/server.js#L2493) | `Loans.squareWanted` |
| GET | `/v1/logistics-coverage` | authenticated | platform-core | [src/routes/logisticscoverage.js:10](../../src/routes/logisticscoverage.js#L10) | `Coverage.coverageBoard` |
| POST | `/v1/logistics-coverage/:id/accept` | authenticated | platform-core | [src/routes/logisticscoverage.js:18](../../src/routes/logisticscoverage.js#L18) | `Coverage.acceptCoverage` |
| POST | `/v1/logistics-coverage/offers` | authenticated | platform-core | [src/routes/logisticscoverage.js:12](../../src/routes/logisticscoverage.js#L12) | `Coverage.offerCoverage` |
| GET | `/v1/made` | authenticated | social-combat | [src/routes/estate.js:13](../../src/routes/estate.js#L13) | `Made.madeBoard` |
| POST | `/v1/made` | authenticated | social-combat | [src/routes/estate.js:15](../../src/routes/estate.js#L15) | `Made.payDues` |
| GET | `/v1/map` | authenticated | world-progression | [src/server.js:2815](../../src/server.js#L2815) | `CityMap.cityMap` |
| GET | `/v1/market` | public | economy-ledger | [src/server.js:2608](../../src/server.js#L2608) | `Market.marketBoard` |
| POST | `/v1/market` | authenticated | economy-ledger | [src/server.js:2609](../../src/server.js#L2609) | `Market.listItem` |
| POST | `/v1/market/:id/accept-delivery` | authenticated | platform-core | [src/routes/delivery.js:11](../../src/routes/delivery.js#L11) | `Delivery.acceptDelivery` |
| POST | `/v1/market/:id/bid` | authenticated | economy-ledger | [src/server.js:2611](../../src/server.js#L2611) | `Market.bidListing` |
| POST | `/v1/market/:id/buy` | authenticated | economy-ledger | [src/server.js:2613](../../src/server.js#L2613) | `Market.buyListing` |
| POST | `/v1/market/:id/cancel` | authenticated | economy-ledger | [src/server.js:2618](../../src/server.js#L2618) | `Market.cancelListing` |
| POST | `/v1/market/:id/claim` | authenticated | economy-ledger | [src/server.js:2629](../../src/server.js#L2629) | `Market.claimOrder` |
| POST | `/v1/market/:id/fill` | authenticated | economy-ledger | [src/server.js:2627](../../src/server.js#L2627) | `Market.fillOrder` |
| GET | `/v1/market/feed` | public | platform-core | [src/routes/marketfeed.js:4](../../src/routes/marketfeed.js#L4) | `publicMarketFeed` |
| POST | `/v1/market/order` | authenticated | economy-ledger | [src/server.js:2625](../../src/server.js#L2625) | `Market.postOrder` |
| GET | `/v1/market/prices` | public | social-combat | [src/server.js:3948](../../src/server.js#L3948) | `Block.marketPrices` |
| GET | `/v1/mastery` | authenticated | world-progression | [src/server.js:2417](../../src/server.js#L2417) | `Mastery.masteryBoard` |
| POST | `/v1/mastery/trait/:trackId` | authenticated | world-progression | [src/server.js:2419](../../src/server.js#L2419) | `Mastery.chooseTrait` |
| GET | `/v1/me` | authenticated | platform-core | [src/server.js:1839](../../src/server.js#L1839) | `G.readCharacter` |
| GET | `/v1/megaproject` | authenticated | enterprise-logistics | [src/server.js:4014](../../src/server.js#L4014) | `Mega.megaBoard` |
| POST | `/v1/megaproject/cash` | authenticated | enterprise-logistics | [src/server.js:4015](../../src/server.js#L4015) | `Mega.giveCash` |
| POST | `/v1/megaproject/goods` | authenticated | enterprise-logistics | [src/server.js:4017](../../src/server.js#L4017) | `Mega.giveGoods` |
| POST | `/v1/megaproject/omr` | authenticated | enterprise-logistics | [src/server.js:4019](../../src/server.js#L4019) | `Mega.giveOmr` |
| GET | `/v1/mentor` | authenticated | social-combat | [src/server.js:3593](../../src/server.js#L3593) | `Mentor.mentorBoard` |
| POST | `/v1/mentor/accept/:mentorCharId` | authenticated | social-combat | [src/server.js:3599](../../src/server.js#L3599) | `Mentor.acceptMentor` |
| POST | `/v1/mentor/claim` | authenticated | social-combat | [src/server.js:3601](../../src/server.js#L3601) | `Mentor.claimMentor` |
| POST | `/v1/mentor/gift/:protegeCharId` | authenticated | social-combat | [src/server.js:3603](../../src/server.js#L3603) | `Mentor.mentorGift` |
| POST | `/v1/mentor/offer/:characterId` | authenticated | social-combat | [src/server.js:3597](../../src/server.js#L3597) | `Mentor.offerMentor` |
| POST | `/v1/mentor/seeking` | authenticated | social-combat | [src/server.js:3595](../../src/server.js#L3595) | `Mentor.seekMentor` |
| POST | `/v1/missions/:id` | authenticated | engagement-growth | [src/server.js:3690](../../src/server.js#L3690) | `W.doMission` |
| GET | `/v1/mobile-shops` | authenticated | world-graph | [src/routes/mobileshops.js:6](../../src/routes/mobileshops.js#L6) | `withItemRead` |
| GET | `/v1/mod/actions` | moderator | platform-core | [src/server.js:1305](../../src/server.js#L1305) | — |
| GET | `/v1/mod/activity` | moderator | platform-core | [src/routes/modtools.js:152](../../src/routes/modtools.js#L152) | `Ops.opsActivity` |
| POST | `/v1/mod/alert/test` | moderator | platform-core | [src/routes/modtools.js:140](../../src/routes/modtools.js#L140) | — |
| GET | `/v1/mod/audit` | moderator | platform-core | [src/routes/modtools.js:169](../../src/routes/modtools.js#L169) | — |
| POST | `/v1/mod/ban` | moderator | platform-core | [src/routes/modtools.js:44](../../src/routes/modtools.js#L44) | `G.GameError` |
| GET | `/v1/mod/bank` | moderator | platform-core | [src/routes/modtools.js:255](../../src/routes/modtools.js#L255) | `Bank.runBankInvariants` |
| POST | `/v1/mod/bank/buy` | moderator | platform-core | [src/routes/modtools.js:256](../../src/routes/modtools.js#L256) | `Bank.recordBankBuy` |
| POST | `/v1/mod/bank/epoch` | moderator | platform-core | [src/routes/modtools.js:260](../../src/routes/modtools.js#L260) | `Bank.runCityLeg` |
| POST | `/v1/mod/bank/harvest` | moderator | economy-ledger | [src/routes/modtools.js:236](../../src/routes/modtools.js#L236) | `Treasury.recordHarvestFee` |
| POST | `/v1/mod/bond/fund` | moderator | platform-core | [src/routes/modtools.js:296](../../src/routes/modtools.js#L296) | `Bonds.fundBondTranche` |
| POST | `/v1/mod/bond/offer` | moderator | platform-core | [src/routes/modtools.js:299](../../src/routes/modtools.js#L299) | `Bonds.setBondOffering` |
| POST | `/v1/mod/bond/simulate` | moderator | platform-core | [src/routes/modtools.js:300](../../src/routes/modtools.js#L300) | `Bonds.recordBond` |
| GET | `/v1/mod/bonds` | moderator | platform-core | [src/routes/modtools.js:177](../../src/routes/modtools.js#L177) | `Bonds.bondStatus` |
| GET | `/v1/mod/brokers` | moderator | platform-core | [src/server.js:2580](../../src/server.js#L2580) | `Brokers.epochBoard` |
| POST | `/v1/mod/brokers/allocate` | moderator | platform-core | [src/server.js:2581](../../src/server.js#L2581) | `Brokers.allocateEpoch` |
| GET | `/v1/mod/chain/params` | moderator | platform-core | [src/routes/modtools.js:159](../../src/routes/modtools.js#L159) | `ChainParams.readChainParams` |
| POST | `/v1/mod/chain/tx` | moderator | platform-core | [src/routes/modtools.js:160](../../src/routes/modtools.js#L160) | `ChainParams.buildParamTx` |
| GET | `/v1/mod/coach` | moderator | platform-core | [src/routes/modtools.js:153](../../src/routes/modtools.js#L153) | `Ops.opsCoach` |
| GET | `/v1/mod/community` | moderator | engagement-growth | [src/routes/modtools.js:268](../../src/routes/modtools.js#L268) | `Community.runFamilyBuybackInvariants` |
| POST | `/v1/mod/community/buy` | moderator | engagement-growth | [src/routes/modtools.js:272](../../src/routes/modtools.js#L272) | `Community.runFamilyBuyback` |
| POST | `/v1/mod/confiscate` | moderator | platform-core | [src/routes/modtools.js:93](../../src/routes/modtools.js#L93) | `G.GameError` |
| POST | `/v1/mod/content/activate` | moderator | platform-core | [src/routes/content.js:329](../../src/routes/content.js#L329) | `activateContentBundle` |
| GET | `/v1/mod/coordination/metrics` | public | platform-core | [src/routes/coordination.js:123](../../src/routes/coordination.js#L123) | — |
| POST | `/v1/mod/deeds/recover` | moderator | chain-economy | [src/routes/modtools.js:323](../../src/routes/modtools.js#L323) | `Chain.recoverStrandedDeed` |
| GET | `/v1/mod/deeds/stranded` | moderator | chain-economy | [src/routes/modtools.js:318](../../src/routes/modtools.js#L318) | `Chain.strandedDeeds` |
| GET | `/v1/mod/defi` | moderator | platform-core | [src/routes/defi.js:76](../../src/routes/defi.js#L76) | — |
| POST | `/v1/mod/defi/tx` | moderator | platform-core | [src/routes/defi.js:97](../../src/routes/defi.js#L97) | — |
| GET | `/v1/mod/desk` | moderator | platform-core | [src/routes/modtools.js:282](../../src/routes/modtools.js#L282) | `Desk.runDeskInvariants` |
| POST | `/v1/mod/desk/buy` | moderator | platform-core | [src/routes/modtools.js:293](../../src/routes/modtools.js#L293) | `Desk.runDeskBuyback` |
| POST | `/v1/mod/desk/fees` | moderator | platform-core | [src/routes/modtools.js:291](../../src/routes/modtools.js#L291) | `Desk.recordPolFees` |
| POST | `/v1/mod/desk/fill` | moderator | platform-core | [src/routes/modtools.js:284](../../src/routes/modtools.js#L284) | `Desk.recordAuctionBuy` |
| POST | `/v1/mod/desk/open` | moderator | platform-core | [src/routes/modtools.js:283](../../src/routes/modtools.js#L283) | `Desk.openAuction` |
| GET | `/v1/mod/dev` | moderator | platform-core | [src/routes/modtools.js:376](../../src/routes/modtools.js#L376) | — |
| POST | `/v1/mod/dev/claim` | moderator | platform-core | [src/routes/modtools.js:382](../../src/routes/modtools.js#L382) | — |
| GET | `/v1/mod/dexbot` | moderator | economy-ledger | [src/routes/modtools.js:343](../../src/routes/modtools.js#L343) | `DexBot.dexBotBoard` |
| POST | `/v1/mod/dexbot/buyback` | moderator | economy-ledger | [src/routes/modtools.js:345](../../src/routes/modtools.js#L345) | `DexBot.runDexBuyback` |
| POST | `/v1/mod/dexbot/pol` | moderator | economy-ledger | [src/routes/modtools.js:347](../../src/routes/modtools.js#L347) | `DexBot.runPolPairing` |
| GET | `/v1/mod/drop` | moderator | engagement-growth | [src/routes/modtools.js:364](../../src/routes/modtools.js#L364) | `Drop.dropStatus` |
| POST | `/v1/mod/drop/load` | moderator | engagement-growth | [src/routes/modtools.js:360](../../src/routes/modtools.js#L360) | `Drop.loadAllocations` |
| POST | `/v1/mod/drop/window` | moderator | engagement-growth | [src/routes/modtools.js:362](../../src/routes/modtools.js#L362) | `Drop.setDropWindow` |
| GET | `/v1/mod/emission` | moderator | platform-core | [src/routes/modtools.js:402](../../src/routes/modtools.js#L402) | — |
| POST | `/v1/mod/emission/fund` | moderator | platform-core | [src/routes/modtools.js:413](../../src/routes/modtools.js#L413) | `G.GameError` |
| GET | `/v1/mod/engagement` | moderator | engagement-growth | [src/routes/modtools.js:167](../../src/routes/modtools.js#L167) | `opsEngagement` |
| GET | `/v1/mod/exchange` | moderator | economy-ledger | [src/server.js:1963](../../src/server.js#L1963) | `Exchange.exchangePool` |
| POST | `/v1/mod/fees/record` | moderator | economy-ledger | [src/routes/modtools.js:327](../../src/routes/modtools.js#L327) | `Fees.recordFeePayment` |
| GET | `/v1/mod/funnel` | moderator | engagement-growth | [src/routes/modtools.js:150](../../src/routes/modtools.js#L150) | `W.funnelStats` |
| GET | `/v1/mod/integrations` | moderator | platform-core | [src/routes/modtools.js:154](../../src/routes/modtools.js#L154) | `Ops.integrationsStatus` |
| GET | `/v1/mod/invariants` | moderator | economy-ledger | [src/routes/modtools.js:133](../../src/routes/modtools.js#L133) | `runLedgerInvariants` |
| POST | `/v1/mod/invites` | moderator | platform-core | [src/routes/modtools.js:118](../../src/routes/modtools.js#L118) | — |
| GET | `/v1/mod/items/stranded` | moderator | chain-economy | [src/routes/modtools.js:322](../../src/routes/modtools.js#L322) | `Chain.strandedItems` |
| POST | `/v1/mod/kill` | moderator | social-combat | [src/routes/modtools.js:67](../../src/routes/modtools.js#L67) | `S.runEstate` |
| POST | `/v1/mod/loanhouse/fund` | moderator | enterprise-logistics | [src/routes/modtools.js:42](../../src/routes/modtools.js#L42) | `Loans.fundLoanHouse` |
| GET | `/v1/mod/overview` | moderator | platform-core | [src/routes/modtools.js:151](../../src/routes/modtools.js#L151) | `Ops.opsOverview` |
| GET | `/v1/mod/referral/push` | moderator | platform-core | [src/routes/modtools.js:132](../../src/routes/modtools.js#L132) | `G.referralPushStatus` |
| POST | `/v1/mod/referral/push` | moderator | platform-core | [src/routes/modtools.js:130](../../src/routes/modtools.js#L130) | `G.startReferralPush` |
| GET | `/v1/mod/release-funnel` | moderator | platform-core | [src/routes/modtools.js:168](../../src/routes/modtools.js#L168) | `worldReleaseMetrics` |
| GET | `/v1/mod/reserve` | moderator | chain-economy | [src/routes/modtools.js:311](../../src/routes/modtools.js#L311) | `Chain.reserveStatus` |
| POST | `/v1/mod/reserve/claimed` | moderator | chain-economy | [src/routes/modtools.js:312](../../src/routes/modtools.js#L312) | `Chain.markClaimed` |
| POST | `/v1/mod/reserve/fund` | moderator | chain-economy | [src/routes/modtools.js:310](../../src/routes/modtools.js#L310) | `Chain.fundReserve` |
| POST | `/v1/mod/resources/auctions` | moderator | platform-core | [src/routes/resources.js:82](../../src/routes/resources.js#L82) | `createResourceRound` |
| POST | `/v1/mod/resources/auctions/:id/settle` | moderator | platform-core | [src/routes/resources.js:83](../../src/routes/resources.js#L83) | `settleResourceRound` |
| POST | `/v1/mod/resources/jobs/:id/adjudicate` | moderator | platform-core | [src/routes/resources.js:84](../../src/routes/resources.js#L84) | `adjudicateResourceJob` |
| GET | `/v1/mod/revenue` | moderator | platform-core | [src/routes/modtools.js:366](../../src/routes/modtools.js#L366) | `Store.revenueStatus` |
| POST | `/v1/mod/revoke` | moderator | platform-core | [src/routes/modtools.js:56](../../src/routes/modtools.js#L56) | `G.GameError` |
| GET | `/v1/mod/router` | moderator | platform-core | [src/routes/modtools.js:370](../../src/routes/modtools.js#L370) | `Router.routerBoard` |
| POST | `/v1/mod/store/grant` | moderator | platform-core | [src/routes/modtools.js:371](../../src/routes/modtools.js#L371) | `Store.recordStorePurchase` |
| GET | `/v1/mod/tokenhealth` | moderator | economy-ledger | [src/routes/modtools.js:280](../../src/routes/modtools.js#L280) | `TokenHealth.tokenHealth` |
| GET | `/v1/mod/treasury` | moderator | economy-ledger | [src/routes/modtools.js:184](../../src/routes/modtools.js#L184) | `Treasury.runTreasuryInvariants` |
| GET | `/v1/mod/treasury/budget` | moderator | economy-ledger | [src/routes/modtools.js:187](../../src/routes/modtools.js#L187) | `Treasury.stockBudget` |
| POST | `/v1/mod/treasury/buy` | moderator | economy-ledger | [src/routes/modtools.js:200](../../src/routes/modtools.js#L200) | `Treasury.recordStockBuy` |
| POST | `/v1/mod/treasury/deliver` | moderator | economy-ledger | [src/routes/modtools.js:220](../../src/routes/modtools.js#L220) | `StockDeliver.deliverStock` |
| GET | `/v1/mod/treasury/deliveries` | moderator | economy-ledger | [src/routes/modtools.js:218](../../src/routes/modtools.js#L218) | `StockDeliver.stockDeliveryBoard` |
| POST | `/v1/mod/treasury/deliveries/run` | moderator | economy-ledger | [src/routes/modtools.js:226](../../src/routes/modtools.js#L226) | `StockDeliver.runStockDeliveryKeeper` |
| POST | `/v1/mod/treasury/distribute` | moderator | platform-core | [src/routes/modtools.js:209](../../src/routes/modtools.js#L209) | `Brokers.distributeBuy` |
| POST | `/v1/mod/treasury/keeper` | moderator | economy-ledger | [src/routes/modtools.js:193](../../src/routes/modtools.js#L193) | `Treasury.runStockBuyback` |
| POST | `/v1/mod/treasury/tax` | moderator | economy-ledger | [src/routes/modtools.js:231](../../src/routes/modtools.js#L231) | `Treasury.recordSellTax` |
| GET | `/v1/mod/vig` | moderator | economy-ledger | [src/routes/modtools.js:332](../../src/routes/modtools.js#L332) | `Vig.vigStatus` |
| POST | `/v1/mod/vig/buyback` | moderator | economy-ledger | [src/routes/modtools.js:334](../../src/routes/modtools.js#L334) | `Vig.runVigBuyback` |
| POST | `/v1/mod/vig/prizes` | moderator | economy-ledger | [src/routes/modtools.js:337](../../src/routes/modtools.js#L337) | `Vig.payPrizes` |
| GET | `/v1/nft` | authenticated | platform-core | [src/server.js:3861](../../src/server.js#L3861) | `G.readCharacter` |
| POST | `/v1/nft/:kind/:id/upgrade` | authenticated | platform-core | [src/server.js:3862](../../src/server.js#L3862) | `G.withCharacter` |
| POST | `/v1/nft/:kind/:id/withdraw` | authenticated | chain-economy | [src/server.js:3864](../../src/server.js#L3864) | `Chain.requestItemWithdraw` |
| GET | `/v1/notifications` | authenticated | platform-core | [src/server.js:3208](../../src/server.js#L3208) | — |
| GET | `/v1/npcfamily` | authenticated | world-progression | [src/server.js:4046](../../src/server.js#L4046) | `NpcWar.warBoard` |
| POST | `/v1/npcfamily/:gangId/raid` | authenticated | world-progression | [src/server.js:4048](../../src/server.js#L4048) | `NpcWar.raidFamily` |
| POST | `/v1/npcfamily/:gangId/war` | authenticated | world-progression | [src/server.js:4053](../../src/server.js#L4053) | `NpcWar.declareNpcWar` |
| POST | `/v1/npcfamily/collect` | authenticated | world-progression | [src/server.js:4050](../../src/server.js#L4050) | `NpcWar.collectFamilyTribute` |
| GET | `/v1/onboard` | authenticated | engagement-growth | [src/server.js:3699](../../src/server.js#L3699) | `W.onboardBoard` |
| POST | `/v1/onboard/:taskId/claim` | authenticated | engagement-growth | [src/server.js:3802](../../src/server.js#L3802) | `W.claimOnboard` |
| GET | `/v1/online` | public | platform-core | [src/server.js:3327](../../src/server.js#L3327) | — |
| GET | `/v1/opportunities` | authenticated | engagement-growth | [src/server.js:2927](../../src/server.js#L2927) | `opportunityBoard` |
| GET | `/v1/paper` | authenticated | engagement-growth | [src/server.js:2912](../../src/server.js#L2912) | `People.paperBoard` |
| POST | `/v1/paper/read` | authenticated | engagement-growth | [src/server.js:2914](../../src/server.js#L2914) | `People.foldPaper` |
| GET | `/v1/pass` | authenticated | platform-core | [src/server.js:3931](../../src/server.js#L3931) | `Pass.passBoard` |
| POST | `/v1/pass/claim` | authenticated | platform-core | [src/server.js:3932](../../src/server.js#L3932) | `Pass.claimPass` |
| POST | `/v1/path` | authenticated | engagement-growth | [src/server.js:3683](../../src/server.js#L3683) | `W.choosePath` |
| POST | `/v1/path-quiz` | public | platform-core | [src/server.js:1545](../../src/server.js#L1545) | — |
| GET | `/v1/payroll` | authenticated | enterprise-logistics | [src/server.js:2825](../../src/server.js#L2825) | `Payroll.payrollBoard` |
| GET | `/v1/pen` | authenticated | law-intelligence | [src/routes/pen.js:10](../../src/routes/pen.js#L10) | `Pen.penBoard` |
| POST | `/v1/pen/break` | authenticated | law-intelligence | [src/routes/pen.js:20](../../src/routes/pen.js#L20) | `Pen.attemptBreak` |
| POST | `/v1/pen/break/:id/go` | authenticated | law-intelligence | [src/routes/pen.js:34](../../src/routes/pen.js#L34) | `Pen.executeBreak` |
| POST | `/v1/pen/break/:id/join` | authenticated | law-intelligence | [src/routes/pen.js:30](../../src/routes/pen.js#L30) | `Pen.joinBreak` |
| POST | `/v1/pen/break/:id/leave` | authenticated | law-intelligence | [src/routes/pen.js:32](../../src/routes/pen.js#L32) | `Pen.leaveBreak` |
| POST | `/v1/pen/break/:id/rat` | authenticated | law-intelligence | [src/routes/pen.js:51](../../src/routes/pen.js#L51) | `Pen.ratBreak` |
| POST | `/v1/pen/break/plan` | authenticated | law-intelligence | [src/routes/pen.js:28](../../src/routes/pen.js#L28) | `Pen.planBreak` |
| GET | `/v1/pen/breaks` | authenticated | law-intelligence | [src/routes/pen.js:23](../../src/routes/pen.js#L23) | `Pen.breakBoard` |
| POST | `/v1/pen/bribe` | authenticated | law-intelligence | [src/routes/pen.js:18](../../src/routes/pen.js#L18) | `Pen.bribeGuard` |
| POST | `/v1/pen/burner/:targetId` | authenticated | law-intelligence | [src/routes/pen.js:44](../../src/routes/pen.js#L44) | `Pen.burnerHit` |
| POST | `/v1/pen/buy/:item` | authenticated | law-intelligence | [src/routes/pen.js:14](../../src/routes/pen.js#L14) | `Pen.buyContraband` |
| POST | `/v1/pen/cards` | authenticated | law-intelligence | [src/routes/pen.js:56](../../src/routes/pen.js#L56) | `Pen.yardCards` |
| POST | `/v1/pen/faction` | authenticated | law-intelligence | [src/routes/pen.js:49](../../src/routes/pen.js#L49) | `Pen.leaveFaction` |
| POST | `/v1/pen/faction/:id` | authenticated | law-intelligence | [src/routes/pen.js:47](../../src/routes/pen.js#L47) | `Pen.joinFaction` |
| POST | `/v1/pen/protection` | authenticated | law-intelligence | [src/routes/pen.js:16](../../src/routes/pen.js#L16) | `Pen.payProtection` |
| POST | `/v1/pen/shank/:targetId` | authenticated | law-intelligence | [src/routes/pen.js:36](../../src/routes/pen.js#L36) | `Pen.shank` |
| POST | `/v1/pen/talk` | authenticated | law-intelligence | [src/routes/pen.js:58](../../src/routes/pen.js#L58) | `Pen.yardTalk` |
| POST | `/v1/pen/work` | authenticated | law-intelligence | [src/routes/pen.js:12](../../src/routes/pen.js#L12) | `Pen.workYard` |
| POST | `/v1/pen/workout/:id` | authenticated | law-intelligence | [src/routes/pen.js:54](../../src/routes/pen.js#L54) | `Pen.yardWorkout` |
| GET | `/v1/people` | authenticated | engagement-growth | [src/server.js:2906](../../src/server.js#L2906) | `People.peopleBoard` |
| GET | `/v1/people/history/:characterId` | authenticated | engagement-growth | [src/server.js:2908](../../src/server.js#L2908) | `People.pairHistory` |
| GET | `/v1/phone` | authenticated | platform-core | [src/server.js:3483](../../src/server.js#L3483) | `Phone.phoneBoard` |
| DELETE | `/v1/phone/block/:characterId` | authenticated | platform-core | [src/server.js:3490](../../src/server.js#L3490) | `Phone.unblockLine` |
| POST | `/v1/phone/block/:characterId` | authenticated | platform-core | [src/server.js:3488](../../src/server.js#L3488) | `Phone.blockLine` |
| POST | `/v1/phone/dm/:characterId` | authenticated | platform-core | [src/server.js:3486](../../src/server.js#L3486) | `Phone.sendDm` |
| GET | `/v1/phone/thread/:characterId` | authenticated | platform-core | [src/server.js:3484](../../src/server.js#L3484) | `Phone.readThread` |
| POST | `/v1/plex/mint` | authenticated | economy-ledger | [src/server.js:3909](../../src/server.js#L3909) | `Vig.payPlex` |
| GET | `/v1/plex/price` | public | economy-ledger | [src/server.js:3916](../../src/server.js#L3916) | `Vig.plexQuote` |
| POST | `/v1/plex/respawn` | authenticated | economy-ledger | [src/server.js:3911](../../src/server.js#L3911) | `Vig.payPlex` |
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
| GET | `/v1/portfolio` | authenticated | economy-ledger | [src/server.js:2507](../../src/server.js#L2507) | `Portfolio.portfolioBoard` |
| POST | `/v1/portfolio/dividend` | authenticated | economy-ledger | [src/server.js:2514](../../src/server.js#L2514) | `Portfolio.claimDividend` |
| POST | `/v1/portfolio/invest` | authenticated | economy-ledger | [src/server.js:2509](../../src/server.js#L2509) | `Portfolio.invest` |
| GET | `/v1/primetime` | authenticated | engagement-growth | [src/server.js:3629](../../src/server.js#L3629) | `Prime.primeTimeBoard` |
| POST | `/v1/primetime/answer` | authenticated | engagement-growth | [src/server.js:3631](../../src/server.js#L3631) | `Prime.answerCall` |
| POST | `/v1/primetime/round` | authenticated | engagement-growth | [src/server.js:3633](../../src/server.js#L3633) | `Prime.buyRound` |
| POST | `/v1/primetime/siege` | authenticated | engagement-growth | [src/server.js:3635](../../src/server.js#L3635) | `Prime.joinSiege` |
| GET | `/v1/profile` | authenticated | engagement-growth | [src/server.js:3710](../../src/server.js#L3710) | `W.myProfile` |
| GET | `/v1/projections/player` | authenticated | platform-core | [src/routes/projections.js:58](../../src/routes/projections.js#L58) | — |
| GET | `/v1/projections/world` | authenticated | platform-core | [src/routes/projections.js:63](../../src/routes/projections.js#L63) | — |
| GET | `/v1/provenance` | authenticated | engagement-growth | [src/server.js:2866](../../src/server.js#L2866) | `Drop.colorsBoard` |
| POST | `/v1/provenance` | authenticated | engagement-growth | [src/server.js:2868](../../src/server.js#L2868) | `Drop.claimColors` |
| POST | `/v1/push/subscribe` | authenticated | engagement-growth | [src/server.js:3648](../../src/server.js#L3648) | `Push.saveSubscription` |
| POST | `/v1/push/unsubscribe` | authenticated | engagement-growth | [src/server.js:3650](../../src/server.js#L3650) | `Push.removeSubscription` |
| GET | `/v1/quest-workshop` | public | platform-core | [src/routes/quest-workshop.js:19](../../src/routes/quest-workshop.js#L19) | — |
| POST | `/v1/quest-workshop` | public | platform-core | [src/routes/quest-workshop.js:20](../../src/routes/quest-workshop.js#L20) | — |
| GET | `/v1/quest-workshop/:id` | public | platform-core | [src/routes/quest-workshop.js:21](../../src/routes/quest-workshop.js#L21) | — |
| POST | `/v1/quest-workshop/:id/publish` | public | platform-core | [src/routes/quest-workshop.js:22](../../src/routes/quest-workshop.js#L22) | — |
| POST | `/v1/quest-workshop/:id/rate` | public | platform-core | [src/routes/quest-workshop.js:24](../../src/routes/quest-workshop.js#L24) | — |
| POST | `/v1/quest-workshop/:id/solve` | public | platform-core | [src/routes/quest-workshop.js:23](../../src/routes/quest-workshop.js#L23) | — |
| GET | `/v1/questing` | authenticated | platform-core | [src/routes/questing.js:5](../../src/routes/questing.js#L5) | `G.readCharacter` |
| POST | `/v1/questing/practice` | authenticated | platform-core | [src/routes/questing.js:7](../../src/routes/questing.js#L7) | `G.withCharacter` |
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
| DELETE | `/v1/rackets/:id` | authenticated | economy-ledger | [src/server.js:1946](../../src/server.js#L1946) | `E.retireRacket` |
| POST | `/v1/rackets/:id/buy` | authenticated | economy-ledger | [src/server.js:1936](../../src/server.js#L1936) | `E.buyRacket` |
| POST | `/v1/rackets/:id/upgrade` | authenticated | economy-ledger | [src/server.js:1943](../../src/server.js#L1943) | `E.upgradeRacket` |
| POST | `/v1/referral/claim` | authenticated | engagement-growth | [src/server.js:3707](../../src/server.js#L3707) | `W.claimReferral` |
| GET | `/v1/regimen` | authenticated | platform-core | [src/server.js:1862](../../src/server.js#L1862) | `RG.regimenBoard` |
| POST | `/v1/regimen/:id` | authenticated | platform-core | [src/server.js:1864](../../src/server.js#L1864) | `RG.trainDiscipline` |
| POST | `/v1/regimen/drill/:npc` | authenticated | platform-core | [src/server.js:1866](../../src/server.js#L1866) | `RG.claimDrill` |
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
| POST | `/v1/respec` | authenticated | engagement-growth | [src/server.js:3686](../../src/server.js#L3686) | `W.respec` |
| GET | `/v1/results` | public | platform-core | [src/server.js:3586](../../src/server.js#L3586) | — |
| GET | `/v1/rivals` | authenticated | social-combat | [src/server.js:2902](../../src/server.js#L2902) | `Rivals.rivalsBoard` |
| GET | `/v1/roster` | authenticated | social-combat | [src/server.js:2043](../../src/server.js#L2043) | `S.rosterOf` |
| DELETE | `/v1/roster/:post` | authenticated | social-combat | [src/server.js:2047](../../src/server.js#L2047) | `S.vacatePost` |
| POST | `/v1/roster/:post` | authenticated | social-combat | [src/server.js:2045](../../src/server.js#L2045) | `S.assignPost` |
| GET | `/v1/rules` | public | platform-core | [src/server.js:2065](../../src/server.js#L2065) | `jsonEtag` |
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
| POST | `/v1/safehouse` | authenticated | social-combat | [src/server.js:3148](../../src/server.js#L3148) | `S.enterSafehouse` |
| POST | `/v1/screens` | authenticated | platform-core | [src/server.js:1893](../../src/server.js#L1893) | — |
| GET | `/v1/season/recap` | authenticated | world-progression | [src/server.js:3954](../../src/server.js#L3954) | `Season.seasonRecaps` |
| GET | `/v1/seasons` | public | world-progression | [src/server.js:3952](../../src/server.js#L3952) | `Season.seasonBoard` |
| GET | `/v1/secrets` | authenticated | law-intelligence | [src/server.js:3758](../../src/server.js#L3758) | `Secrets.secretsBoard` |
| POST | `/v1/secrets/:id/expose` | authenticated | law-intelligence | [src/server.js:3779](../../src/server.js#L3779) | `Secrets.exposeSecret` |
| POST | `/v1/secrets/:id/extort` | authenticated | law-intelligence | [src/server.js:3762](../../src/server.js#L3762) | `Secrets.extortSecret` |
| POST | `/v1/secrets/:id/pay` | authenticated | law-intelligence | [src/server.js:3766](../../src/server.js#L3766) | `Secrets.payHush` |
| GET | `/v1/session` | authenticated | platform-core | [src/server.js:1844](../../src/server.js#L1844) | — |
| GET | `/v1/shipment` | authenticated | enterprise-logistics | [src/server.js:3796](../../src/server.js#L3796) | `Shipment.shipmentBoard` |
| POST | `/v1/shipment/commission/:id` | authenticated | enterprise-logistics | [src/server.js:3800](../../src/server.js#L3800) | `Shipment.commissionPiece` |
| POST | `/v1/shipment/take` | authenticated | enterprise-logistics | [src/server.js:3798](../../src/server.js#L3798) | `Shipment.takeShipment` |
| GET | `/v1/skills` | authenticated | world-progression | [src/server.js:2414](../../src/server.js#L2414) | `Skills.skillsBoard` |
| POST | `/v1/skills/:id` | authenticated | world-progression | [src/server.js:2428](../../src/server.js#L2428) | `Skills.learnSkill` |
| POST | `/v1/skills/active/:ability` | authenticated | world-progression | [src/server.js:2424](../../src/server.js#L2424) | `Skills.useActive` |
| POST | `/v1/skills/respec` | authenticated | world-progression | [src/server.js:2421](../../src/server.js#L2421) | `Skills.respecSkills` |
| POST | `/v1/skills/respec/:id` | authenticated | world-progression | [src/server.js:2426](../../src/server.js#L2426) | `Skills.respecOne` |
| GET | `/v1/social` | authenticated | engagement-growth | [src/server.js:3805](../../src/server.js#L3805) | `W.socialBoard` |
| POST | `/v1/social/:taskId/claim` | authenticated | engagement-growth | [src/server.js:3809](../../src/server.js#L3809) | `W.claimSocial` |
| GET | `/v1/soldiers` | authenticated | social-combat | [src/server.js:3747](../../src/server.js#L3747) | `Soldiers.soldierBoard` |
| DELETE | `/v1/soldiers/:id` | authenticated | social-combat | [src/server.js:3755](../../src/server.js#L3755) | `Soldiers.dismissSoldier` |
| POST | `/v1/soldiers/:id/assign` | authenticated | social-combat | [src/server.js:3751](../../src/server.js#L3751) | `Soldiers.assignSoldier` |
| POST | `/v1/soldiers/hire` | authenticated | social-combat | [src/server.js:3749](../../src/server.js#L3749) | `Soldiers.hireSoldier` |
| POST | `/v1/soldiers/unassign` | authenticated | social-combat | [src/server.js:3753](../../src/server.js#L3753) | `Soldiers.unassignSoldier` |
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
| POST | `/v1/stake` | authenticated | economy-ledger | [src/server.js:1971](../../src/server.js#L1971) | `E.stake` |
| POST | `/v1/stake/lock` | authenticated | economy-ledger | [src/server.js:1977](../../src/server.js#L1977) | `E.lockStake` |
| GET | `/v1/store` | authenticated | platform-core | [src/server.js:3923](../../src/server.js#L3923) | `Store.storeBoard` |
| POST | `/v1/store/plex/:sku` | authenticated | platform-core | [src/server.js:3925](../../src/server.js#L3925) | `Store.payPackagePlex` |
| GET | `/v1/strategies` | public | platform-core | [src/routes/strategylicenses.js:10](../../src/routes/strategylicenses.js#L10) | `Strategy.strategyCatalog` |
| POST | `/v1/strategies` | authenticated | platform-core | [src/routes/strategylicenses.js:13](../../src/routes/strategylicenses.js#L13) | `Strategy.publishStrategy` |
| POST | `/v1/strategies/:id/buy` | authenticated | platform-core | [src/routes/strategylicenses.js:15](../../src/routes/strategylicenses.js#L15) | `Strategy.buyStrategy` |
| POST | `/v1/strategies/:id/resolve` | authenticated | platform-core | [src/routes/strategylicenses.js:25](../../src/routes/strategylicenses.js#L25) | `Strategy.resolveStrategyHoldout` |
| GET | `/v1/strategies/library` | authenticated | platform-core | [src/routes/strategylicenses.js:11](../../src/routes/strategylicenses.js#L11) | `Strategy.strategyLibrary` |
| GET | `/v1/strategy-leagues` | public | platform-core | [src/routes/strategyleagues.js:10](../../src/routes/strategyleagues.js#L10) | `League.strategyLeagueBoard` |
| POST | `/v1/strategy-leagues` | authenticated | platform-core | [src/routes/strategyleagues.js:13](../../src/routes/strategyleagues.js#L13) | `League.createStrategyLeague` |
| POST | `/v1/strategy-leagues/:id/join` | authenticated | platform-core | [src/routes/strategyleagues.js:15](../../src/routes/strategyleagues.js#L15) | `League.joinStrategyLeague` |
| GET | `/v1/strategy-leagues/own` | authenticated | platform-core | [src/routes/strategyleagues.js:11](../../src/routes/strategyleagues.js#L11) | `League.strategyLeagueBoard` |
| GET | `/v1/streak` | authenticated | world-progression | [src/server.js:3608](../../src/server.js#L3608) | `Streak.streakBoard` |
| POST | `/v1/streak/claim` | authenticated | world-progression | [src/server.js:3610](../../src/server.js#L3610) | `Streak.claimStreak` |
| GET | `/v1/streets` | authenticated | platform-core | [src/server.js:2873](../../src/server.js#L2873) | `PlayerIntel.playerIntelBoard` |
| POST | `/v1/streets/:targetId/boat` | authenticated | social-combat | [src/server.js:2898](../../src/server.js#L2898) | `S.stealBoat` |
| POST | `/v1/streets/:targetId/bounty` | authenticated | social-combat | [src/server.js:2916](../../src/server.js#L2916) | `S.postBounty` |
| POST | `/v1/streets/:targetId/bust` | authenticated | social-combat | [src/server.js:3187](../../src/server.js#L3187) | `S.bust` |
| POST | `/v1/streets/:targetId/fire` | authenticated | social-combat | [src/server.js:3182](../../src/server.js#L3182) | `S.fire` |
| POST | `/v1/streets/:targetId/jump` | authenticated | social-combat | [src/server.js:2889](../../src/server.js#L2889) | `S.jump` |
| POST | `/v1/streets/:targetId/meet` | authenticated | platform-core | [src/server.js:2884](../../src/server.js#L2884) | `G.withTwoCharacters` |
| POST | `/v1/streets/:targetId/npchit` | authenticated | social-combat | [src/server.js:3140](../../src/server.js#L3140) | `S.npcHit` |
| GET | `/v1/streets/:targetId/rescue-quote` | authenticated | platform-core | [src/server.js:2877](../../src/server.js#L2877) | `PlayerIntel.requireKnownPlayer` |
| POST | `/v1/streets/:targetId/sabotage` | authenticated | social-combat | [src/server.js:2900](../../src/server.js#L2900) | `S.sabotage` |
| POST | `/v1/streets/:targetId/search` | authenticated | social-combat | [src/server.js:3178](../../src/server.js#L3178) | `S.startSearch` |
| POST | `/v1/streets/:targetId/steal` | authenticated | social-combat | [src/server.js:2893](../../src/server.js#L2893) | `S.stealCar` |
| POST | `/v1/streets/:targetId/trunk` | authenticated | social-combat | [src/server.js:2896](../../src/server.js#L2896) | `S.robTrunk` |
| DELETE | `/v1/streets/search` | authenticated | social-combat | [src/server.js:3180](../../src/server.js#L3180) | `S.callOffSearch` |
| GET | `/v1/supply-tenders` | authenticated | platform-core | [src/routes/supplytenders.js:6](../../src/routes/supplytenders.js#L6) | `Tender.supplyTenderBoard` |
| POST | `/v1/supply-tenders/:id/cancel` | authenticated | platform-core | [src/routes/supplytenders.js:32](../../src/routes/supplytenders.js#L32) | `Tender.cancelSupplyTender` |
| POST | `/v1/supply-tenders/:id/offers` | authenticated | platform-core | [src/routes/supplytenders.js:13](../../src/routes/supplytenders.js#L13) | `Tender.offerSupplyTender` |
| POST | `/v1/supply-tenders/:id/offers/:offerId/award` | authenticated | platform-core | [src/routes/supplytenders.js:19](../../src/routes/supplytenders.js#L19) | `Tender.awardSupplyTender` |
| POST | `/v1/supply-tenders/:id/offers/withdraw` | authenticated | platform-core | [src/routes/supplytenders.js:30](../../src/routes/supplytenders.js#L30) | `Tender.withdrawSupplyOffer` |
| POST | `/v1/swap` | authenticated | economy-ledger | [src/server.js:1969](../../src/server.js#L1969) | `E.swap` |
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
| POST | `/v1/train/:stat` | authenticated | platform-core | [src/server.js:1859](../../src/server.js#L1859) | `G.withCharacter` |
| POST | `/v1/travel/:district` | authenticated | platform-core | [src/server.js:1908](../../src/server.js#L1908) | `G.withCharacter` |
| GET | `/v1/u/:name` | public | platform-core | [src/server.js:991](../../src/server.js#L991) | `Cards.publicDossier` |
| GET | `/v1/underworld` | authenticated | world-progression | [src/routes/underworld.js:10](../../src/routes/underworld.js#L10) | `Underworld.underworldBoard` |
| POST | `/v1/underworld/:npc/errand` | authenticated | world-progression | [src/routes/underworld.js:24](../../src/routes/underworld.js#L24) | `Underworld.startErrand` |
| POST | `/v1/underworld/:npc/favor` | authenticated | world-progression | [src/routes/underworld.js:21](../../src/routes/underworld.js#L21) | `Underworld.claimFavor` |
| POST | `/v1/underworld/:npc/gift` | authenticated | world-progression | [src/routes/underworld.js:16](../../src/routes/underworld.js#L16) | `Underworld.giftNpc` |
| POST | `/v1/underworld/:npc/penance` | authenticated | world-progression | [src/routes/underworld.js:19](../../src/routes/underworld.js#L19) | `Underworld.payPenance` |
| POST | `/v1/underworld/discharge` | authenticated | world-progression | [src/routes/underworld.js:12](../../src/routes/underworld.js#L12) | `Underworld.discharge` |
| POST | `/v1/underworld/gun/:gunId/sell` | authenticated | world-progression | [src/routes/underworld.js:14](../../src/routes/underworld.js#L14) | `Underworld.sellGunBack` |
| POST | `/v1/unstake` | authenticated | economy-ledger | [src/server.js:1973](../../src/server.js#L1973) | `E.unstake` |
| POST | `/v1/vanity/name` | authenticated | engagement-growth | [src/server.js:3162](../../src/server.js#L3162) | `V.changeName` |
| POST | `/v1/vanity/plate/:carId` | authenticated | engagement-growth | [src/server.js:3166](../../src/server.js#L3166) | `V.setPlate` |
| POST | `/v1/vanity/title` | authenticated | engagement-growth | [src/server.js:3164](../../src/server.js#L3164) | `V.setTitle` |
| GET | `/v1/vault` | authenticated | economy-ledger | [src/server.js:2526](../../src/server.js#L2526) | `Treasury.vaultBoard` |
| POST | `/v1/vault/claim` | authenticated | economy-ledger | [src/server.js:2540](../../src/server.js#L2540) | `Treasury.claimVaulted` |
| DELETE | `/v1/vouch/:characterId` | authenticated | social-combat | [src/server.js:3643](../../src/server.js#L3643) | `Vouch.revokeVouch` |
| POST | `/v1/vouch/:characterId` | authenticated | social-combat | [src/server.js:3641](../../src/server.js#L3641) | `Vouch.giveVouch` |
| GET | `/v1/vouches` | authenticated | social-combat | [src/server.js:3639](../../src/server.js#L3639) | `Vouch.vouchBoard` |
| GET | `/v1/wage` | authenticated | economy-ledger | [src/server.js:3717](../../src/server.js#L3717) | `Emission.wageBoard` |
| POST | `/v1/wallet` | authenticated | chain-economy | [src/server.js:3814](../../src/server.js#L3814) | `G.GameError` |
| POST | `/v1/wallet/challenge` | authenticated | chain-economy | [src/server.js:3849](../../src/server.js#L3849) | `Chain.walletChallenge` |
| POST | `/v1/wallet/verify` | authenticated | chain-economy | [src/server.js:3850](../../src/server.js#L3850) | `Chain.walletVerify` |
| POST | `/v1/warehouse-leases/:id/close` | authenticated | platform-core | [src/routes/warehouses.js:26](../../src/routes/warehouses.js#L26) | `Warehouse.closeWarehouseLease` |
| POST | `/v1/warehouse-leases/:id/deposit` | authenticated | platform-core | [src/routes/warehouses.js:22](../../src/routes/warehouses.js#L22) | `Warehouse.depositWarehouseCargo` |
| POST | `/v1/warehouse-leases/:id/withdraw` | authenticated | platform-core | [src/routes/warehouses.js:24](../../src/routes/warehouses.js#L24) | `Warehouse.withdrawWarehouseCargo` |
| GET | `/v1/warehouses` | authenticated | platform-core | [src/routes/warehouses.js:6](../../src/routes/warehouses.js#L6) | `Warehouse.warehouseOffers` |
| POST | `/v1/warehouses/:id/lease` | authenticated | platform-core | [src/routes/warehouses.js:16](../../src/routes/warehouses.js#L16) | `Warehouse.leaseWarehouse` |
| GET | `/v1/window` | authenticated | economy-ledger | [src/server.js:1957](../../src/server.js#L1957) | `Exchange.exchangeBoard` |
| POST | `/v1/window/redeem` | authenticated | economy-ledger | [src/server.js:1959](../../src/server.js#L1959) | `Exchange.redeem` |
| GET | `/v1/wire` | authenticated | law-intelligence | [src/server.js:2584](../../src/server.js#L2584) | `Wire.wireBoard` |
| POST | `/v1/wire/dig/:targetId` | authenticated | law-intelligence | [src/server.js:3760](../../src/server.js#L3760) | `Secrets.digSecret` |
| POST | `/v1/wire/disinfo` | authenticated | law-intelligence | [src/server.js:2602](../../src/server.js#L2602) | `Wire.plantDisinfo` |
| POST | `/v1/wire/dossier/:targetId` | authenticated | law-intelligence | [src/server.js:2600](../../src/server.js#L2600) | `Wire.pullDossier` |
| POST | `/v1/wire/informant/:targetId` | authenticated | law-intelligence | [src/server.js:2604](../../src/server.js#L2604) | `Wire.recruitInformant` |
| POST | `/v1/wire/subscribe` | authenticated | law-intelligence | [src/server.js:2590](../../src/server.js#L2590) | `Wire.subscribeWire` |
| POST | `/v1/wire/sweep` | authenticated | law-intelligence | [src/server.js:2588](../../src/server.js#L2588) | `Wire.sweepBugs` |
| POST | `/v1/wire/tap/:targetId` | authenticated | law-intelligence | [src/server.js:2586](../../src/server.js#L2586) | `Wire.placeTap` |
| POST | `/v1/wire/trace` | authenticated | law-intelligence | [src/server.js:2598](../../src/server.js#L2598) | `Wire.traceBugs` |
| DELETE | `/v1/wire/watch/:targetId` | authenticated | law-intelligence | [src/server.js:2595](../../src/server.js#L2595) | `Wire.cancelWatch` |
| POST | `/v1/wire/watch/:targetId` | authenticated | law-intelligence | [src/server.js:2593](../../src/server.js#L2593) | `Wire.enrollWatch` |
| POST | `/v1/withdraw` | authenticated | chain-economy | [src/server.js:3852](../../src/server.js#L3852) | `Chain.requestWithdraw` |
| POST | `/v1/withdraw/:id/cancel` | authenticated | chain-economy | [src/server.js:3856](../../src/server.js#L3856) | `Chain.cancelQueuedWithdraw` |
| GET | `/v1/withdraw/status` | authenticated | chain-economy | [src/server.js:3881](../../src/server.js#L3881) | `Chain.reserveStatus` |
| POST | `/v1/workshop/ammo` | authenticated | economy-ledger | [src/server.js:1924](../../src/server.js#L1924) | `E.craftAmmo` |
| POST | `/v1/workshop/craft/:id` | authenticated | economy-ledger | [src/server.js:1922](../../src/server.js#L1922) | `E.craft` |
| GET | `/v1/world` | authenticated | world-progression | [src/server.js:4041](../../src/server.js#L4041) | `World.worldBoard` |
| POST | `/v1/world/:npcId/invade` | authenticated | world-progression | [src/server.js:4071](../../src/server.js#L4071) | `World.invadeOutpost` |
| POST | `/v1/world/:npcId/plan` | authenticated | world-progression | [src/server.js:4057](../../src/server.js#L4057) | `World.planRaid` |
| POST | `/v1/world/:npcId/raid` | authenticated | world-progression | [src/server.js:4043](../../src/server.js#L4043) | `World.raidNpc` |
| POST | `/v1/world/:npcId/reinforce` | authenticated | world-progression | [src/server.js:4074](../../src/server.js#L4074) | `World.reinforceOutpost` |
| POST | `/v1/world/collect` | authenticated | world-progression | [src/server.js:4069](../../src/server.js#L4069) | `World.collectFrontier` |
| GET | `/v1/world/raids` | authenticated | world-progression | [src/server.js:4055](../../src/server.js#L4055) | `World.raidBoard` |
| POST | `/v1/world/raids/:id/dismiss` | authenticated | world-progression | [src/server.js:4063](../../src/server.js#L4063) | `World.dismissGun` |
| POST | `/v1/world/raids/:id/go` | authenticated | world-progression | [src/server.js:4067](../../src/server.js#L4067) | `World.executeRaid` |
| POST | `/v1/world/raids/:id/hire` | authenticated | world-progression | [src/server.js:4061](../../src/server.js#L4061) | `World.hireRaid` |
| POST | `/v1/world/raids/:id/join` | authenticated | world-progression | [src/server.js:4059](../../src/server.js#L4059) | `World.joinRaid` |
| POST | `/v1/world/raids/:id/leave` | authenticated | world-progression | [src/server.js:4065](../../src/server.js#L4065) | `World.leaveRaid` |
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
| GET | `/v1/ws` | token-query | platform-core | [src/server.js:3231](../../src/server.js#L3231) | — |
| GET | `/v1/yield` | public | economy-ledger | [src/server.js:1961](../../src/server.js#L1961) | `Exchange.yieldBoard` |
| GET | `/vendor/walletconnect-manifest.json` | public | client-experience | [src/server.js:670](../../src/server.js#L670) | — |
| GET | `/vendor/walletconnect.js` | public | client-experience | [src/server.js:668](../../src/server.js#L668) | — |
| GET | `/vendor/walletconnect.js.LEGAL.txt` | public | client-experience | [src/server.js:672](../../src/server.js#L672) | — |
| GET | `/wiki` | public | client-experience | [src/server.js:641](../../src/server.js#L641) | `servePage` |
