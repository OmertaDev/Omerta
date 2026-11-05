// Exact current source-provenance data only. Native admission executes actual untransformed source.
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const BUSINESS_DESK_COMBINED_NATIVE=freeze({
  "version": 1,
  "status": "SEALED",
  "phase": "EXACT_MONITOR_WIKI_DESK_NATIVE_PROVENANCE_ONLY",
  "sourceRevision": "84532d5d08248d533b573f621fada39d83e0ac3f",
  "sourceTree": "c495f28621ff0c796400c31b5c9e630ddb844302",
  "topSourceDefinitionSha256": "1be5eafba45d5b2c2b859fc2e0fb6aaf9792c7588a82da19f0dcbeac7f606cfb",
  "parentRegistryDefinitionSha256": "d38d8283d7b29eff2a80cefb43f68e768f6df294ed5e8d297b3219bc36622516",
  "nativeClosure": [
    ".github/workflows/ci.yml",
    ".github/workflows/forge.yml",
    ".github/workflows/knowledge-refresh.yml",
    ".github/workflows/liquidity-postgres.yml",
    ".github/workflows/publish-mcp.yml",
    ".github/workflows/rc1-recovery.yml",
    "AGENTS.md",
    "content/README.md",
    "content/packs/bad-batch/pack.json",
    "content/packs/bellini-lockbox-v2/pack.json",
    "content/packs/bellini-lockbox-v3/pack.json",
    "content/packs/bellini-lockbox-v4/pack.json",
    "content/packs/bellini-lockbox/pack.json",
    "content/packs/black-ice/pack.json",
    "content/packs/books-open-at-midnight/pack.json",
    "content/packs/brick-last-kiln/pack.json",
    "content/packs/canal-water-cellar/pack.json",
    "content/packs/cathedral-saints-account/pack.json",
    "content/packs/docks-missed-tide/pack.json",
    "content/packs/don-of-the-city/pack.json",
    "content/packs/empty-seat/pack.json",
    "content/packs/federal-ledger/pack.json",
    "content/packs/foundry-furnace-ledger/pack.json",
    "content/packs/hostile-books/pack.json",
    "content/packs/house-made-of-glass/pack.json",
    "content/packs/iron-election/pack.json",
    "content/packs/last-clean-contract/pack.json",
    "content/packs/neon-house-lights/pack.json",
    "content/packs/nobody-saw-him-leave/pack.json",
    "content/packs/port-no-return/pack.json",
    "content/packs/sixth-chair-v2/pack.json",
    "content/packs/sixth-chair/pack.json",
    "content/packs/twelve-rounds/pack.json",
    "content/packs/two-funerals/pack.json",
    "content/packs/two-man-rule/pack.json",
    "docs/business-relocation-proposal.sql",
    "docs/cross-docking-proposal.sql",
    "docs/cross-docking-security-review.md",
    "docs/decision-replay-integration.json",
    "docs/economic-dependency-map-integration.json",
    "docs/equipment-recovery-authored-proposal.mjs",
    "docs/manufacturing-license-proposal.sql",
    "docs/merchant-returns-security-review.md",
    "docs/mobile-shops-proposal.sql",
    "docs/production-slot-proposal.sql",
    "docs/production-slot-security-review.md",
    "docs/release/readiness-work/scenario-manifest.json",
    "omerta-contracts/deployments/4663/manifest.json",
    "package-lock.json",
    "package.json",
    "public/admin.html",
    "public/apple-touch-icon.png",
    "public/arena.html",
    "public/art/agent-cover-1080.webp",
    "public/art/agent-cover-480.webp",
    "public/art/agent-cover-720.webp",
    "public/art/agent-economy-1080.webp",
    "public/art/agent-economy-480.webp",
    "public/art/agent-economy-720.webp",
    "public/art/agent-overview-1080.webp",
    "public/art/agent-overview-1600.webp",
    "public/art/agent-overview-640.webp",
    "public/art/agent-turn-1080.webp",
    "public/art/agent-turn-480.webp",
    "public/art/agent-turn-720.webp",
    "public/art/boat-cigarette.jpg",
    "public/art/boat-cutter.jpg",
    "public/art/boat-dinghy.jpg",
    "public/art/boat-freighter.jpg",
    "public/art/boat-skiff.jpg",
    "public/art/boat-trawler.jpg",
    "public/art/boxer-clubfighter.jpg",
    "public/art/boxer-gatekeeper.jpg",
    "public/art/boxer-journeyman.jpg",
    "public/art/business-casino.jpg",
    "public/art/business-hotel.jpg",
    "public/art/business-laundromat.jpg",
    "public/art/business-nightclub.jpg",
    "public/art/business-restaurant.jpg",
    "public/art/car-ambassador.jpg",
    "public/art/car-aurora.jpg",
    "public/art/car-blackout.jpg",
    "public/art/car-boulevard.jpg",
    "public/art/car-brougham.jpg",
    "public/art/car-bullion.jpg",
    "public/art/car-cabaret.jpg",
    "public/art/car-cabbie.jpg",
    "public/art/car-cannery.jpg",
    "public/art/car-cascade.jpg",
    "public/art/car-clubman.jpg",
    "public/art/car-comet.jpg",
    "public/art/car-conductor.jpg",
    "public/art/car-consul.jpg",
    "public/art/car-corsair.jpg",
    "public/art/car-coupe38.jpg",
    "public/art/car-courier.jpg",
    "public/art/car-deuce.jpg",
    "public/art/car-diplomat.jpg",
    "public/art/car-dockmaster.jpg",
    "public/art/car-dray.jpg",
    "public/art/car-duchess.jpg",
    "public/art/car-errand.jpg",
    "public/art/car-foreman.jpg",
    "public/art/car-garden.jpg",
    "public/art/car-harbor.jpg",
    "public/art/car-iceman.jpg",
    "public/art/car-junker.jpg",
    "public/art/car-ladder.jpg",
    "public/art/car-leviathan.jpg",
    "public/art/car-mercantile.jpg",
    "public/art/car-meridian.jpg",
    "public/art/car-milk.jpg",
    "public/art/car-monarch.jpg",
    "public/art/car-nocturne.jpg",
    "public/art/car-notary.jpg",
    "public/art/car-offduty.jpg",
    "public/art/car-olympia.jpg",
    "public/art/car-phaeton.jpg",
    "public/art/car-pigeon.jpg",
    "public/art/car-postal.jpg",
    "public/art/car-prefect.jpg",
    "public/art/car-regatta.jpg",
    "public/art/car-regent.jpg",
    "public/art/car-rubicon.jpg",
    "public/art/car-sable.jpg",
    "public/art/car-sedanette.jpg",
    "public/art/car-sovereign.jpg",
    "public/art/car-spectre.jpg",
    "public/art/car-sportsman.jpg",
    "public/art/car-stag.jpg",
    "public/art/car-tempest.jpg",
    "public/art/car-touring.jpg",
    "public/art/car-trolley.jpg",
    "public/art/car-tsarina.jpg",
    "public/art/car-vesper.jpg",
    "public/art/car-volara.jpg",
    "public/art/car-vulcan.jpg",
    "public/art/car-wagoneer.jpg",
    "public/art/car-warhawk.jpg",
    "public/art/card-join.jpg",
    "public/art/card-legend.jpg",
    "public/art/card-wanted.jpg",
    "public/art/card-whacked.jpg",
    "public/art/city-fixer-v1.png",
    "public/art/city-fixer-v2.png",
    "public/art/city-neighbor-v1.png",
    "public/art/city-neighbor-v2.png",
    "public/art/city-neighborhood-v1.png",
    "public/art/city-neighborhood-v2.png",
    "public/art/city-player-down-v1.png",
    "public/art/city-player-down-v2.png",
    "public/art/city-player-left-v1.png",
    "public/art/city-player-left-v2.png",
    "public/art/city-player-right-v1.png",
    "public/art/city-player-right-v2.png",
    "public/art/city-player-step-v1.png",
    "public/art/city-player-step-v2.png",
    "public/art/city-player-up-v1.png",
    "public/art/city-player-up-v2.png",
    "public/art/city-worker-v1.png",
    "public/art/city-worker-v2.png",
    "public/art/citymap.jpg",
    "public/art/club-0.jpg",
    "public/art/club-1.jpg",
    "public/art/club-2.jpg",
    "public/art/club-3.jpg",
    "public/art/club-4.jpg",
    "public/art/crest.jpg",
    "public/art/crime-alderman.jpg",
    "public/art/crime-armored.jpg",
    "public/art/crime-ballot.jpg",
    "public/art/crime-bonds.jpg",
    "public/art/crime-bondsman.jpg",
    "public/art/crime-bookie.jpg",
    "public/art/crime-booze.jpg",
    "public/art/crime-cardgame.jpg",
    "public/art/crime-cathouse.jpg",
    "public/art/crime-clearing.jpg",
    "public/art/crime-counting.jpg",
    "public/art/crime-customs.jpg",
    "public/art/crime-depository.jpg",
    "public/art/crime-diamond.jpg",
    "public/art/crime-distillery.jpg",
    "public/art/crime-fedtrain.jpg",
    "public/art/crime-fixfight.jpg",
    "public/art/crime-furs.jpg",
    "public/art/crime-grandcasino.jpg",
    "public/art/crime-harbormaster.jpg",
    "public/art/crime-highroll.jpg",
    "public/art/crime-jewelry.jpg",
    "public/art/crime-laundry.jpg",
    "public/art/crime-meter.jpg",
    "public/art/crime-mint.jpg",
    "public/art/crime-museum.jpg",
    "public/art/crime-nightdeposit.jpg",
    "public/art/crime-numbers.jpg",
    "public/art/crime-pawn.jpg",
    "public/art/crime-payoff.jpg",
    "public/art/crime-payroll.jpg",
    "public/art/crime-pick.jpg",
    "public/art/crime-pigeon.jpg",
    "public/art/crime-poker.jpg",
    "public/art/crime-protection.jpg",
    "public/art/crime-railfreight.jpg",
    "public/art/crime-shake.jpg",
    "public/art/crime-stereo.jpg",
    "public/art/crime-switchbag.jpg",
    "public/art/crime-ticker.jpg",
    "public/art/crime-torch.jpg",
    "public/art/crime-truck.jpg",
    "public/art/crime-vaultjob.jpg",
    "public/art/display.woff2",
    "public/art/district-brick.jpg",
    "public/art/district-canal.jpg",
    "public/art/district-cathedral-480.webp",
    "public/art/district-cathedral-960.webp",
    "public/art/district-cathedral.jpg",
    "public/art/district-docks.jpg",
    "public/art/district-foundry-480.webp",
    "public/art/district-foundry-960.webp",
    "public/art/district-foundry.jpg",
    "public/art/district-neon.jpg",
    "public/art/district-v2-docks-1280.webp",
    "public/art/district-v2-docks-480.webp",
    "public/art/district-v2-docks-960.webp",
    "public/art/district-v2-docks.jpg",
    "public/art/district-v2-foundry-1280.webp",
    "public/art/district-v2-foundry-480.webp",
    "public/art/district-v2-foundry-960.webp",
    "public/art/district-v2-foundry.jpg",
    "public/art/district-v2-neon-interior-1280.webp",
    "public/art/district-v2-neon-interior-480.webp",
    "public/art/district-v2-neon-interior-960.webp",
    "public/art/district-v2-neon-interior.jpg",
    "public/art/drug-ambrosia.jpg",
    "public/art/drug-glass.jpg",
    "public/art/drug-halo.jpg",
    "public/art/drug-lotus.jpg",
    "public/art/drug-moonmilk.jpg",
    "public/art/drug-nocturne.jpg",
    "public/art/drug-static.jpg",
    "public/art/drug-vim.jpg",
    "public/art/estate-1.jpg",
    "public/art/estate-2.jpg",
    "public/art/estate-3.jpg",
    "public/art/estate-4.jpg",
    "public/art/estate-5.jpg",
    "public/art/estate-6.jpg",
    "public/art/game-blackjack.jpg",
    "public/art/game-dice.jpg",
    "public/art/game-fight.jpg",
    "public/art/game-futurity.jpg",
    "public/art/game-numbers.jpg",
    "public/art/game-poker.jpg",
    "public/art/game-ring.jpg",
    "public/art/game-tournament.jpg",
    "public/art/game-track.jpg",
    "public/art/gameplay-01-choose-your-path-1080.webp",
    "public/art/gameplay-01-choose-your-path-1600.webp",
    "public/art/gameplay-01-choose-your-path-640.webp",
    "public/art/gameplay-01-choose-your-path.png",
    "public/art/gameplay-02-the-gun.png",
    "public/art/gameplay-03-the-ledger.png",
    "public/art/gameplay-04-the-kitchen.png",
    "public/art/gameplay-05-the-wheel.png",
    "public/art/gameplay-06-the-shadow.png",
    "public/art/gameplay-07-the-ring.png",
    "public/art/gameplay-08-character-blueprint.png",
    "public/art/gameplay-09-road-to-don.png",
    "public/art/good-bearer.jpg",
    "public/art/good-cigars.jpg",
    "public/art/good-coffee.jpg",
    "public/art/good-gin.jpg",
    "public/art/good-ice.jpg",
    "public/art/good-nylons.jpg",
    "public/art/good-penicillin.jpg",
    "public/art/good-shine.jpg",
    "public/art/good-silk.jpg",
    "public/art/good-watches.jpg",
    "public/art/gun-alleycat.jpg",
    "public/art/gun-anniversary.jpg",
    "public/art/gun-argument.jpg",
    "public/art/gun-badge.jpg",
    "public/art/gun-broom.jpg",
    "public/art/gun-brothers.jpg",
    "public/art/gun-chorusline.jpg",
    "public/art/gun-doorbell.jpg",
    "public/art/gun-lastresort.jpg",
    "public/art/gun-orchestra.jpg",
    "public/art/gun-penny.jpg",
    "public/art/gun-pocket22.jpg",
    "public/art/gun-rancher.jpg",
    "public/art/gun-undertaker.jpg",
    "public/art/gun-whisper.jpg",
    "public/art/heist-armored.jpg",
    "public/art/heist-casino.jpg",
    "public/art/heist-corner.jpg",
    "public/art/heist-diamond.jpg",
    "public/art/heist-fedtrain.jpg",
    "public/art/heist-goldvault.jpg",
    "public/art/heist-inside.jpg",
    "public/art/heist-jewel.jpg",
    "public/art/heist-museum.jpg",
    "public/art/heist-payroll.jpg",
    "public/art/heist-thefed.jpg",
    "public/art/heist-vault.jpg",
    "public/art/hero-ambient-v2.mp4",
    "public/art/hero-backdrop.jpg",
    "public/art/hero-poster-1440.webp",
    "public/art/hero-poster-1920.webp",
    "public/art/hero-poster-640.webp",
    "public/art/hero-poster-960.webp",
    "public/art/hero-poster.jpg",
    "public/art/hitman-journeyman.jpg",
    "public/art/hitman-legbreaker.jpg",
    "public/art/hitman-professional.jpg",
    "public/art/hype-flywheel-v3-720.mp4",
    "public/art/hype-flywheel-v3-poster-640.webp",
    "public/art/hype-flywheel-v3-poster-960.webp",
    "public/art/hype-flywheel-v3.mp4",
    "public/art/hype-money-720.mp4",
    "public/art/hype-money-poster-640.webp",
    "public/art/hype-money-poster-960.webp",
    "public/art/hype-money-poster.jpg",
    "public/art/hype-money.mp4",
    "public/art/hype-short.mp4",
    "public/art/hype-streets.mp4",
    "public/art/hype.mp4",
    "public/art/hype/bed-den.m4a",
    "public/art/hype/bed-docks.m4a",
    "public/art/hype/bed-family.m4a",
    "public/art/hype/bed-law.m4a",
    "public/art/hype/bed-legit.m4a",
    "public/art/hype/bed-pen.m4a",
    "public/art/hype/bed-speakeasy.m4a",
    "public/art/hype/bed-streets.m4a",
    "public/art/hype/boat-cigarette.mp4",
    "public/art/hype/boat-cutter.mp4",
    "public/art/hype/boat-dinghy.mp4",
    "public/art/hype/boat-freighter.mp4",
    "public/art/hype/boat-skiff.mp4",
    "public/art/hype/boat-trawler.mp4",
    "public/art/hype/boxer-clubfighter.mp4",
    "public/art/hype/boxer-gatekeeper.mp4",
    "public/art/hype/boxer-journeyman.mp4",
    "public/art/hype/business-casino.mp4",
    "public/art/hype/business-hotel.mp4",
    "public/art/hype/business-laundromat.mp4",
    "public/art/hype/business-nightclub.mp4",
    "public/art/hype/business-restaurant.mp4",
    "public/art/hype/car-sovereign.mp4",
    "public/art/hype/car-spectre.mp4",
    "public/art/hype/cine-champion.mp4",
    "public/art/hype/cine-funeral.mp4",
    "public/art/hype/cine-payday.mp4",
    "public/art/hype/cine-war.mp4",
    "public/art/hype/cine-wedding.mp4",
    "public/art/hype/cine-whacked.mp4",
    "public/art/hype/citymap.mp4",
    "public/art/hype/club-0.mp4",
    "public/art/hype/club-1.mp4",
    "public/art/hype/club-2.mp4",
    "public/art/hype/club-3.mp4",
    "public/art/hype/club-4.mp4",
    "public/art/hype/crest.mp4",
    "public/art/hype/crime-alderman.mp4",
    "public/art/hype/crime-armored.mp4",
    "public/art/hype/crime-ballot.mp4",
    "public/art/hype/crime-bonds.mp4",
    "public/art/hype/crime-bondsman.mp4",
    "public/art/hype/crime-booze.mp4",
    "public/art/hype/crime-cardgame.mp4",
    "public/art/hype/crime-cathouse.mp4",
    "public/art/hype/crime-clearing.mp4",
    "public/art/hype/crime-counting.mp4",
    "public/art/hype/crime-counting__9x16.mp4",
    "public/art/hype/crime-customs.mp4",
    "public/art/hype/crime-depository.mp4",
    "public/art/hype/crime-diamond.mp4",
    "public/art/hype/crime-distillery.mp4",
    "public/art/hype/crime-fedtrain.mp4",
    "public/art/hype/crime-fixfight.mp4",
    "public/art/hype/crime-furs.mp4",
    "public/art/hype/crime-grandcasino.mp4",
    "public/art/hype/crime-harbormaster.mp4",
    "public/art/hype/crime-highroll.mp4",
    "public/art/hype/crime-jewelry.mp4",
    "public/art/hype/crime-laundry.mp4",
    "public/art/hype/crime-meter.mp4",
    "public/art/hype/crime-mint.mp4",
    "public/art/hype/crime-museum.mp4",
    "public/art/hype/crime-nightdeposit.mp4",
    "public/art/hype/crime-numbers.mp4",
    "public/art/hype/crime-pawn.mp4",
    "public/art/hype/crime-payoff.mp4",
    "public/art/hype/crime-payroll.mp4",
    "public/art/hype/crime-pick.mp4",
    "public/art/hype/crime-pigeon.mp4",
    "public/art/hype/crime-poker.mp4",
    "public/art/hype/crime-protection.mp4",
    "public/art/hype/crime-railfreight.mp4",
    "public/art/hype/crime-shake.mp4",
    "public/art/hype/crime-stereo.mp4",
    "public/art/hype/crime-switchbag.mp4",
    "public/art/hype/crime-ticker.mp4",
    "public/art/hype/crime-torch.mp4",
    "public/art/hype/crime-torch__9x16.mp4",
    "public/art/hype/crime-truck.mp4",
    "public/art/hype/crime-vaultjob.mp4",
    "public/art/hype/district-brick.mp4",
    "public/art/hype/district-canal.mp4",
    "public/art/hype/district-cathedral.mp4",
    "public/art/hype/district-docks.mp4",
    "public/art/hype/district-foundry.mp4",
    "public/art/hype/district-neon.mp4",
    "public/art/hype/drug-ambrosia.mp4",
    "public/art/hype/drug-glass.mp4",
    "public/art/hype/drug-halo.mp4",
    "public/art/hype/drug-lotus.mp4",
    "public/art/hype/drug-moonmilk.mp4",
    "public/art/hype/drug-nocturne.mp4",
    "public/art/hype/drug-static.mp4",
    "public/art/hype/drug-vim.mp4",
    "public/art/hype/estate-1.mp4",
    "public/art/hype/estate-2.mp4",
    "public/art/hype/estate-3.mp4",
    "public/art/hype/estate-4.mp4",
    "public/art/hype/estate-5.mp4",
    "public/art/hype/estate-6.mp4",
    "public/art/hype/flywheel-v3-deeds.mp4",
    "public/art/hype/flywheel-v3-loop.mp4",
    "public/art/hype/flywheel-v3-rwa.mp4",
    "public/art/hype/game-blackjack.mp4",
    "public/art/hype/game-dice.mp4",
    "public/art/hype/game-fight.mp4",
    "public/art/hype/game-futurity.mp4",
    "public/art/hype/game-numbers.mp4",
    "public/art/hype/game-poker.mp4",
    "public/art/hype/game-ring.mp4",
    "public/art/hype/game-tournament.mp4",
    "public/art/hype/game-track.mp4",
    "public/art/hype/gun-alleycat.mp4",
    "public/art/hype/gun-anniversary.mp4",
    "public/art/hype/gun-argument.mp4",
    "public/art/hype/gun-badge.mp4",
    "public/art/hype/gun-broom.mp4",
    "public/art/hype/gun-brothers.mp4",
    "public/art/hype/gun-chorusline.mp4",
    "public/art/hype/gun-doorbell.mp4",
    "public/art/hype/gun-lastresort.mp4",
    "public/art/hype/gun-orchestra.mp4",
    "public/art/hype/gun-penny.mp4",
    "public/art/hype/gun-pocket22.mp4",
    "public/art/hype/gun-rancher.mp4",
    "public/art/hype/gun-undertaker.mp4",
    "public/art/hype/gun-whisper.mp4",
    "public/art/hype/heist-armored.mp4",
    "public/art/hype/heist-casino.mp4",
    "public/art/hype/heist-corner.mp4",
    "public/art/hype/heist-diamond.mp4",
    "public/art/hype/heist-fedtrain.mp4",
    "public/art/hype/heist-goldvault.mp4",
    "public/art/hype/heist-jewel.mp4",
    "public/art/hype/heist-museum.mp4",
    "public/art/hype/heist-payroll.mp4",
    "public/art/hype/heist-thefed.mp4",
    "public/art/hype/heist-vault.mp4",
    "public/art/hype/hero-backdrop.mp4",
    "public/art/hype/hero-backdrop__9x16.mp4",
    "public/art/hype/hero-poster.mp4",
    "public/art/hype/hitman-legbreaker.mp4",
    "public/art/hype/hitman-professional.mp4",
    "public/art/hype/hitman-professional__9x16.mp4",
    "public/art/hype/interior-den.mp4",
    "public/art/hype/interior-empire.mp4",
    "public/art/hype/interior-estate.mp4",
    "public/art/hype/interior-estate__9x16.mp4",
    "public/art/hype/interior-family.mp4",
    "public/art/hype/interior-garage.mp4",
    "public/art/hype/interior-gym.mp4",
    "public/art/hype/interior-kitchen.mp4",
    "public/art/hype/interior-law.mp4",
    "public/art/hype/interior-legit.mp4",
    "public/art/hype/interior-life.mp4",
    "public/art/hype/interior-loans.mp4",
    "public/art/hype/interior-market.mp4",
    "public/art/hype/interior-pen.mp4",
    "public/art/hype/interior-port.mp4",
    "public/art/hype/interior-pvp.mp4",
    "public/art/hype/interior-races.mp4",
    "public/art/hype/interior-scores.mp4",
    "public/art/hype/interior-speakeasy.mp4",
    "public/art/hype/interior-stable.mp4",
    "public/art/hype/interior-start.mp4",
    "public/art/hype/interior-store.mp4",
    "public/art/hype/interior-streets.mp4",
    "public/art/hype/interior-track.mp4",
    "public/art/hype/interior-trade.mp4",
    "public/art/hype/interior-wire.mp4",
    "public/art/hype/landing-break.mp4",
    "public/art/hype/mm-auction.mp4",
    "public/art/hype/mm-chase.mp4",
    "public/art/hype/mm-crew.mp4",
    "public/art/hype/mm-family.mp4",
    "public/art/hype/mm-made.mp4",
    "public/art/hype/mm-noprint.mp4",
    "public/art/hype/mm-pot.mp4",
    "public/art/hype/mm-seats.mp4",
    "public/art/hype/mm-slam.mp4",
    "public/art/hype/mm-store.mp4",
    "public/art/hype/mm-tax.mp4",
    "public/art/hype/mm-toll.mp4",
    "public/art/hype/npc-armorer.mp4",
    "public/art/hype/npc-cornerman.mp4",
    "public/art/hype/npc-doc.mp4",
    "public/art/hype/npc-fixer.mp4",
    "public/art/hype/npc-harbor.mp4",
    "public/art/hype/npc-madame.mp4",
    "public/art/hype/outfit-dockrats.mp4",
    "public/art/hype/outfit-kryl.mp4",
    "public/art/hype/outfit-moreau.mp4",
    "public/art/hype/outfit-volkov.mp4",
    "public/art/hype/outfit-volkov__9x16.mp4",
    "public/art/hype/outfit-zappa.mp4",
    "public/art/hype/pill-agents.mp4",
    "public/art/hype/pill-legacy.mp4",
    "public/art/hype/sting-death.m4a",
    "public/art/hype/sting-win.m4a",
    "public/art/icons.jpg",
    "public/art/interior-den.jpg",
    "public/art/interior-empire.jpg",
    "public/art/interior-estate.jpg",
    "public/art/interior-family.jpg",
    "public/art/interior-garage.jpg",
    "public/art/interior-gym.jpg",
    "public/art/interior-kitchen-480.webp",
    "public/art/interior-kitchen-960.webp",
    "public/art/interior-kitchen.jpg",
    "public/art/interior-law.jpg",
    "public/art/interior-legit.jpg",
    "public/art/interior-life.jpg",
    "public/art/interior-loans.jpg",
    "public/art/interior-market.jpg",
    "public/art/interior-pen.jpg",
    "public/art/interior-port.jpg",
    "public/art/interior-pvp.jpg",
    "public/art/interior-races.jpg",
    "public/art/interior-scores-1024.webp",
    "public/art/interior-scores-640.webp",
    "public/art/interior-scores.jpg",
    "public/art/interior-speakeasy.jpg",
    "public/art/interior-stable.jpg",
    "public/art/interior-start.jpg",
    "public/art/interior-store.jpg",
    "public/art/interior-streets.jpg",
    "public/art/interior-track.jpg",
    "public/art/interior-trade.jpg",
    "public/art/interior-wire.jpg",
    "public/art/landing-break-1440.webp",
    "public/art/landing-break-640.webp",
    "public/art/landing-break-960.webp",
    "public/art/landing-break.jpg",
    "public/art/npc-armorer.jpg",
    "public/art/npc-cornerman.jpg",
    "public/art/npc-doc.jpg",
    "public/art/npc-fixer.jpg",
    "public/art/npc-harbor.jpg",
    "public/art/npc-madame.jpg",
    "public/art/omr-01-severance.png",
    "public/art/omr-02-return-velocity.png",
    "public/art/omr-03-money-router-1080.webp",
    "public/art/omr-03-money-router-1600.webp",
    "public/art/omr-03-money-router-640.webp",
    "public/art/omr-03-money-router.png",
    "public/art/omr-04-reserve-rwa.png",
    "public/art/omr-05-ohm-contrast.png",
    "public/art/omr-06-the-omr-machine-1080x1350.png",
    "public/art/omr-vs-ohm.png",
    "public/art/outfit-dockrats.jpg",
    "public/art/outfit-kryl.jpg",
    "public/art/outfit-moreau.jpg",
    "public/art/outfit-volkov.jpg",
    "public/art/outfit-zappa.jpg",
    "public/art/path-gun-1080x1350.png",
    "public/art/path-gun-1080x1920.png",
    "public/art/path-gun-1200x630.png",
    "public/art/path-kitchen-1080x1350.png",
    "public/art/path-kitchen-1080x1920.png",
    "public/art/path-kitchen-1200x630.png",
    "public/art/path-ledger-1080x1350.png",
    "public/art/path-ledger-1080x1920.png",
    "public/art/path-ledger-1200x630.png",
    "public/art/path-ring-1080x1350.png",
    "public/art/path-ring-1080x1920.png",
    "public/art/path-ring-1200x630.png",
    "public/art/path-shadow-1080x1350.png",
    "public/art/path-shadow-1080x1920.png",
    "public/art/path-shadow-1200x630.png",
    "public/art/path-wheel-1080x1350.png",
    "public/art/path-wheel-1080x1920.png",
    "public/art/path-wheel-1200x630.png",
    "public/art/pill-agents.jpg",
    "public/art/pill-legacy-480.webp",
    "public/art/pill-legacy-960.webp",
    "public/art/pill-legacy.jpg",
    "public/art/vest-heavyv.jpg",
    "public/art/vest-lightv.jpg",
    "public/art/vest-medv.jpg",
    "public/art/vest-tailorv.jpg",
    "public/art/vest-vaultv.jpg",
    "public/art/vest-woolv.jpg",
    "public/city-adventure-ui.js",
    "public/city-home-ui.js",
    "public/city-scene.css",
    "public/city-scene.js",
    "public/city-world-ui.css",
    "public/city-world-ui.js",
    "public/consigliere.html",
    "public/consigliere.js",
    "public/defi.html",
    "public/fee-flows.html",
    "public/genesis-deploy-artifact.js",
    "public/genesis-deploy-client.js",
    "public/genesis-deploy-vendor/_u64.js",
    "public/genesis-deploy-vendor/crypto.js",
    "public/genesis-deploy-vendor/sha3.js",
    "public/genesis-deploy-vendor/utils.js",
    "public/genesis-deploy.html",
    "public/genesis-snapshot-rpc.js",
    "public/icon-192.png",
    "public/icon-512.png",
    "public/icon-maskable-512.png",
    "public/index.html",
    "public/invite.html",
    "public/manifest.json",
    "public/omerta-ui.css",
    "public/play.html",
    "public/sw.js",
    "public/vendor/phaser.js",
    "public/vendor/phaser.js.LICENSE.txt",
    "public/wiki.html",
    "public/world-fieldwork.css",
    "public/world-fieldwork.js",
    "schema.sql",
    "src/access.js",
    "src/accrual.js",
    "src/age.js",
    "src/agentcompany.js",
    "src/agentgateway.js",
    "src/agentoperatingmemory.js",
    "src/agentreferrals.js",
    "src/agentturn.js",
    "src/aggregate.js",
    "src/arena.js",
    "src/assets.js",
    "src/atomic-barter-contracts.js",
    "src/atomicbarter-schema.sql",
    "src/atomicbarter.js",
    "src/atomicbarterinvariants.js",
    "src/auction.js",
    "src/auth.js",
    "src/avatar.js",
    "src/bank.js",
    "src/bloodline.js",
    "src/bondquoteexpiry.js",
    "src/bonds.js",
    "src/boxing.js",
    "src/brokers.js",
    "src/bulletin.js",
    "src/business.js",
    "src/businesspartnerships.js",
    "src/businesspolicy.js",
    "src/businessrelocation-contracts.js",
    "src/businessrelocation.js",
    "src/businessrelocationhistory.js",
    "src/businessrelocationroutes.js",
    "src/businessseasonrunner.js",
    "src/businessseasons.js",
    "src/buyercooperativecustody.js",
    "src/buyercooperativeinvariants.js",
    "src/buyercooperativerunner.js",
    "src/buyercooperatives.js",
    "src/campaigns.js",
    "src/cardpng.js",
    "src/cards.js",
    "src/career.js",
    "src/casino.js",
    "src/chain.js",
    "src/chainparams.js",
    "src/circle.js",
    "src/city-encounters-contract.js",
    "src/city-encounters.js",
    "src/city-home-contract.js",
    "src/city-home-interiors.js",
    "src/city-home-migration.js",
    "src/city-presence.js",
    "src/city-social-contract.js",
    "src/city-social.js",
    "src/city-world-opportunities-contract.js",
    "src/city-world-opportunities.js",
    "src/city-world-opportunity-adapters.js",
    "src/cityhomes.js",
    "src/citymap.js",
    "src/citywide.js",
    "src/citywire.js",
    "src/clues.js",
    "src/collection.js",
    "src/collision.js",
    "src/command-diagnostics.js",
    "src/commercialdisputes.js",
    "src/commercialnegotiation.js",
    "src/commercialpremises.js",
    "src/commercialpremisesinvariants.js",
    "src/commercialreputation.js",
    "src/commission.js",
    "src/commissionedcrafting-contracts.js",
    "src/commissionedcrafting.js",
    "src/community.js",
    "src/company-autonomy-contracts.js",
    "src/company-commercial-contracts.js",
    "src/company-commercial-invariants.js",
    "src/company-economy-contracts.js",
    "src/company-middle-five-invariants.js",
    "src/company-middle-five-runtime.js",
    "src/company-workforce-contracts.js",
    "src/companyacquisitions-routes.js",
    "src/companyacquisitions.js",
    "src/companybankportfolioinvariants.js",
    "src/companybankportfoliorunner.js",
    "src/companybankportfolios.js",
    "src/companydemand.js",
    "src/companyforecast.js",
    "src/companygovernance.js",
    "src/companylogisticshubs.js",
    "src/companylogisticshubsinvariants.js",
    "src/companyoperatorrunner.js",
    "src/companyoperators.js",
    "src/companyopportunities.js",
    "src/companyopportunityrunner.js",
    "src/companyproduction.js",
    "src/companyrestructuring.js",
    "src/companyspecialization.js",
    "src/companysuccession.js",
    "src/companysuccessioninvariants.js",
    "src/companyworkflowinvariants.js",
    "src/companyworkflowrunner.js",
    "src/companyworkflows.js",
    "src/computeexperiment.js",
    "src/computerouting.js",
    "src/consignment-contracts.js",
    "src/consignments.js",
    "src/contacts.js",
    "src/content/activation-policy.js",
    "src/content/artifact-storage.js",
    "src/content/artifacts.js",
    "src/content/automotive-salvage.js",
    "src/content/belladonna.js",
    "src/content/campaign-network.js",
    "src/content/canonical.js",
    "src/content/city-quest-presentation.js",
    "src/content/city-world-opportunities.js",
    "src/content/company-production-quality.js",
    "src/content/compiler.js",
    "src/content/coordination-operation-pilot.js",
    "src/content/core-materials.js",
    "src/content/core-progression.js",
    "src/content/corpus.js",
    "src/content/crafting.js",
    "src/content/definition-invariants.js",
    "src/content/diagnostics.js",
    "src/content/discovery.js",
    "src/content/district-story-arcs.js",
    "src/content/dock-war.js",
    "src/content/economy-profile.js",
    "src/content/equipment-recovery.js",
    "src/content/exchange.js",
    "src/content/furnace-ledger.js",
    "src/content/json-source.js",
    "src/content/neighborhood-broadcast.js",
    "src/content/neighborhood-initiation.js",
    "src/content/neighborhood-initiation.json",
    "src/content/phase1-policy.js",
    "src/content/phase1-validation.js",
    "src/content/phase1.js",
    "src/content/phase2-transactions.js",
    "src/content/progression-admission.js",
    "src/content/runtime.js",
    "src/content/staged-crew-missions.js",
    "src/content/world-kernel-pilot.js",
    "src/contractauctions.js",
    "src/convoy.js",
    "src/coordination/capital.js",
    "src/coordination/graph.js",
    "src/coordination/http-contract.js",
    "src/coordination/knowledge.js",
    "src/coordination/operation-definitions.js",
    "src/coordination/operation-invariants.js",
    "src/coordination/operations.js",
    "src/coordination/pilot.js",
    "src/coordination/runtime.js",
    "src/corner.js",
    "src/courierjobs.js",
    "src/crafting.js",
    "src/crew.js",
    "src/crewlogistics.js",
    "src/crossdocking-contracts.js",
    "src/crossdocking.js",
    "src/customerlayaway-contracts.js",
    "src/customerlayaway.js",
    "src/customervaults-contracts.js",
    "src/customervaults.js",
    "src/dailyreminder.js",
    "src/day.js",
    "src/db-rls.js",
    "src/db.js",
    "src/dbhealth.js",
    "src/decision-dependency-contracts.js",
    "src/decisionproofs.js",
    "src/decisionreplay.js",
    "src/deed-upgrades.js",
    "src/deeds.js",
    "src/defi.js",
    "src/delivery.js",
    "src/deliverybook.js",
    "src/deliveryfinance.js",
    "src/deliveryfinanceterms.js",
    "src/depot.js",
    "src/depotacquisitionruntime.js",
    "src/depotbook.js",
    "src/depotcontracts.js",
    "src/depotrelocationruntime.js",
    "src/desk.js",
    "src/dexbot.js",
    "src/diplomacy.js",
    "src/director/campaign-network.js",
    "src/director/config.js",
    "src/director/definitions.js",
    "src/director/dock-war.js",
    "src/director/memory.js",
    "src/director/pressures.js",
    "src/director/runtime.js",
    "src/director/selection.js",
    "src/director/storage.js",
    "src/discovery.js",
    "src/dispatch.js",
    "src/drop.js",
    "src/duels.js",
    "src/dynasty.js",
    "src/earningreceipts.js",
    "src/economicdependencymap.js",
    "src/economicintelligence.js",
    "src/economy.js",
    "src/emission.js",
    "src/employmentorganizations.js",
    "src/engagement.js",
    "src/equipment-economy-contracts.js",
    "src/equipmentinsurance.js",
    "src/equipmentmaintenance.js",
    "src/equipmentrecovery-contracts.js",
    "src/equipmentrecovery.js",
    "src/equipmentrecoveryhistory.js",
    "src/equipmentrentals.js",
    "src/estate.js",
    "src/events.js",
    "src/exchange.js",
    "src/explore.js",
    "src/fairness.js",
    "src/favors.js",
    "src/fees.js",
    "src/finalizedobservation.js",
    "src/firstblood.js",
    "src/firsts.js",
    "src/franchiselicenses.js",
    "src/freight-contracts.js",
    "src/freight-history.js",
    "src/freightconsolidation.js",
    "src/fundedexternalwork.js",
    "src/fundedworkchainobservations.js",
    "src/fundedworkescrowadapter.js",
    "src/fundedworkescrowartifact.js",
    "src/game.js",
    "src/gameemployment.js",
    "src/gameemploymentinvariants.js",
    "src/gateway/actions.js",
    "src/gateway/capabilities.js",
    "src/gateway/context.js",
    "src/gateway/events.js",
    "src/gateway/http-contract.js",
    "src/gateway/security.js",
    "src/gateway/service.js",
    "src/genesisauction.js",
    "src/genesiscadence.js",
    "src/genesiscca.js",
    "src/genesiskeeper.js",
    "src/genesislaunch.js",
    "src/genesisrelease.js",
    "src/genesisrpc.js",
    "src/goodsmarket.js",
    "src/goodsquote.js",
    "src/growth.js",
    "src/heists.js",
    "src/home.js",
    "src/honor.js",
    "src/http-idempotency.js",
    "src/hustle.js",
    "src/identity-checkout.js",
    "src/infrastructureconcessions.js",
    "src/integrations/muse/index.js",
    "src/integrations/muse/manifest.js",
    "src/integrations/muse/responses.js",
    "src/integrations/muse/schemas.js",
    "src/integrations/muse/tools.js",
    "src/intelforecastinvariants.js",
    "src/intelforecastjobs.js",
    "src/intelforecasts.js",
    "src/invariants.js",
    "src/invites.js",
    "src/item-lock-trace.js",
    "src/itemdefinitions.js",
    "src/itemdurability.js",
    "src/itemlots.js",
    "src/items.js",
    "src/keepertransactions.js",
    "src/kitchen.js",
    "src/landmarks.js",
    "src/law.js",
    "src/legal.js",
    "src/liquidityaccounting.js",
    "src/liquidityautomation.js",
    "src/liquidityindexer.js",
    "src/liquiditykeeper.js",
    "src/liquiditypolicy.js",
    "src/liquidityqueue.js",
    "src/liquiditystate.js",
    "src/loans.js",
    "src/logisticscoverage.js",
    "src/logisticscoverageinvariants.js",
    "src/logisticscoverageterms.js",
    "src/made.js",
    "src/managementteamautonomy.js",
    "src/managementteams.js",
    "src/manufacturinglicenses-contracts.js",
    "src/manufacturinglicenses.js",
    "src/manufacturinglicensesinvariants.js",
    "src/manufacturinglicensesroutes.js",
    "src/market.js",
    "src/marketfeed.js",
    "src/marketv2keeper.js",
    "src/marketv2solver.js",
    "src/mastery.js",
    "src/megaproject.js",
    "src/memo.js",
    "src/mentor.js",
    "src/merchantreturns-contracts.js",
    "src/merchantreturns-schema.sql",
    "src/merchantreturns.js",
    "src/merchantreturnsinvariants.js",
    "src/mobileshops-contracts.js",
    "src/mobileshops.js",
    "src/multihopcourier-contracts.js",
    "src/multihopcourier.js",
    "src/mysteries.js",
    "src/nft-art.js",
    "src/nft.js",
    "src/notoriety.js",
    "src/npcwar.js",
    "src/operatingpolicy.js",
    "src/operations.js",
    "src/opportunities.js",
    "src/ops.js",
    "src/pass.js",
    "src/path-funnel.js",
    "src/path-pages.js",
    "src/payment-receipts.js",
    "src/payroll.js",
    "src/pen.js",
    "src/people.js",
    "src/phone.js",
    "src/picking-packing-contracts.js",
    "src/pickingpacking-schema.sql",
    "src/pickingpacking.js",
    "src/pickingpackinginvariants.js",
    "src/player-commands.js",
    "src/player-opportunities.js",
    "src/playerintel.js",
    "src/population.js",
    "src/port.js",
    "src/portfolio.js",
    "src/portrait-access.js",
    "src/portrait.js",
    "src/preflight.js",
    "src/primetime.js",
    "src/productionslots-contracts.js",
    "src/productionslots.js",
    "src/projection-events.js",
    "src/push.js",
    "src/races.js",
    "src/ratelimit.js",
    "src/recipe-policy.js",
    "src/recipe-scarcity.js",
    "src/regimen.js",
    "src/resourceauction.js",
    "src/resourcebook.js",
    "src/resourcebusiness.js",
    "src/resourcecompute.js",
    "src/resourcecontracts.js",
    "src/resourceearnings.js",
    "src/resourcelabor.js",
    "src/resourceoutcomeobserver.js",
    "src/resourceoutcomes.js",
    "src/resourcepayments.js",
    "src/resourceproviders.js",
    "src/resourcestorefront.js",
    "src/resourcework.js",
    "src/restock.js",
    "src/ring.js",
    "src/rivals.js",
    "src/roster.js",
    "src/router.js",
    "src/routes/agentoperatingmemory.js",
    "src/routes/atomicbarter.js",
    "src/routes/boxing.js",
    "src/routes/businesspartnerships.js",
    "src/routes/businessseasons.js",
    "src/routes/buyercooperatives.js",
    "src/routes/casino.js",
    "src/routes/city-encounters.js",
    "src/routes/city-home-interiors.js",
    "src/routes/city-world-opportunities.js",
    "src/routes/city.js",
    "src/routes/cityhomes.js",
    "src/routes/commands.js",
    "src/routes/commercialdisputes.js",
    "src/routes/commercialnegotiation.js",
    "src/routes/commercialpremises.js",
    "src/routes/commercialreputation.js",
    "src/routes/commissionedcrafting.js",
    "src/routes/companybankportfolios.js",
    "src/routes/companydemand.js",
    "src/routes/companyforecast.js",
    "src/routes/companygovernance.js",
    "src/routes/companylogisticshubs.js",
    "src/routes/companyoperators.js",
    "src/routes/companyopportunities.js",
    "src/routes/companyproduction.js",
    "src/routes/companyrestructuring.js",
    "src/routes/companyspecialization.js",
    "src/routes/companysuccession.js",
    "src/routes/companyworkflows.js",
    "src/routes/consignments.js",
    "src/routes/content.js",
    "src/routes/contractauctions.js",
    "src/routes/convoy.js",
    "src/routes/coordination.js",
    "src/routes/crewlogistics.js",
    "src/routes/crossdocking.js",
    "src/routes/customerlayaway.js",
    "src/routes/customervaults.js",
    "src/routes/decisionreplay.js",
    "src/routes/deeds.js",
    "src/routes/defi.js",
    "src/routes/delivery.js",
    "src/routes/deliveryfinance.js",
    "src/routes/depot.js",
    "src/routes/diplomacy.js",
    "src/routes/economicdependencymap.js",
    "src/routes/economicintelligence.js",
    "src/routes/employmentorganizations.js",
    "src/routes/equipmentinsurance.js",
    "src/routes/equipmentmaintenance.js",
    "src/routes/equipmentrecovery.js",
    "src/routes/equipmentrentals.js",
    "src/routes/estate.js",
    "src/routes/family-operations.js",
    "src/routes/franchises.js",
    "src/routes/freightconsolidation.js",
    "src/routes/fundedexternalwork.js",
    "src/routes/gameemployment.js",
    "src/routes/gateway.js",
    "src/routes/genesisauction.js",
    "src/routes/heists.js",
    "src/routes/infrastructureconcessions.js",
    "src/routes/intelforecasts.js",
    "src/routes/itemdurability.js",
    "src/routes/kitchen.js",
    "src/routes/law.js",
    "src/routes/leaderboards.js",
    "src/routes/logisticscoverage.js",
    "src/routes/managementteams.js",
    "src/routes/marketfeed.js",
    "src/routes/merchantreturns.js",
    "src/routes/mobileshops.js",
    "src/routes/modtools.js",
    "src/routes/multihopcourier.js",
    "src/routes/pen.js",
    "src/routes/pickingpacking.js",
    "src/routes/port.js",
    "src/routes/productionslots.js",
    "src/routes/projections.js",
    "src/routes/races.js",
    "src/routes/resources.js",
    "src/routes/rwa.js",
    "src/routes/servicesubscriptions.js",
    "src/routes/sov.js",
    "src/routes/speakeasy.js",
    "src/routes/stable.js",
    "src/routes/strategylaboratories.js",
    "src/routes/strategyleagues.js",
    "src/routes/strategylicenses.js",
    "src/routes/supplytenders.js",
    "src/routes/territory.js",
    "src/routes/territoryeconomics.js",
    "src/routes/underworld.js",
    "src/routes/warehouses.js",
    "src/routes/workertraining.js",
    "src/routes/world-kernel.js",
    "src/routes/worldgraph.js",
    "src/rules.generated.js",
    "src/rules.js",
    "src/rules.tail.js",
    "src/rwahealth.js",
    "src/rwahealthclearance.js",
    "src/rwahealtherror.js",
    "src/rwahealthoverlay.js",
    "src/rwahealthread.js",
    "src/rwahealthreview.js",
    "src/rwahealthsweep.js",
    "src/rwanominations.js",
    "src/rwaregistrylifecycle.js",
    "src/rwastockkeeper.js",
    "src/season.js",
    "src/secrets.js",
    "src/server.js",
    "src/servicesubscriptions.js",
    "src/shipment.js",
    "src/skills.js",
    "src/social.js",
    "src/social/combat.js",
    "src/social/contracts.js",
    "src/social/defense.js",
    "src/social/estate.js",
    "src/social/exchange.js",
    "src/social/gangs.js",
    "src/social/shared.js",
    "src/sol.js",
    "src/soldiers.js",
    "src/sov.js",
    "src/speakeasy.js",
    "src/stable.js",
    "src/standing.js",
    "src/stockcatalog.js",
    "src/stockcatalogv2.js",
    "src/stockdeliver.js",
    "src/store.js",
    "src/storefrontfulfillment.js",
    "src/strategylaboratories.js",
    "src/strategyleagueinvariants.js",
    "src/strategyleagues.js",
    "src/strategylicenseinvariants.js",
    "src/strategylicenses.js",
    "src/streak.js",
    "src/streets.js",
    "src/supplierhistory.js",
    "src/supplycontracts.js",
    "src/supplytenders.js",
    "src/tax.js",
    "src/territory.js",
    "src/territoryeconomics.js",
    "src/tokenhealth.js",
    "src/treasury.js",
    "src/underworld.js",
    "src/v4oraclekeeper.js",
    "src/vanity.js",
    "src/verify.js",
    "src/vig.js",
    "src/vouch.js",
    "src/walletforge.js",
    "src/warehouseleases.js",
    "src/watcher.js",
    "src/wire.js",
    "src/worker.js",
    "src/workertraining.js",
    "src/workshopfloor-admission.js",
    "src/workshopfloor-api.js",
    "src/workshopfloor-contracts.js",
    "src/workshopfloor-schema.js",
    "src/workshopfloor.js",
    "src/world-consequences.js",
    "src/world-kernel-invariants.js",
    "src/world-kernel-query.js",
    "src/world-kernel.js",
    "src/world-knowledge.js",
    "src/world-prerequisites.js",
    "src/world-projection.js",
    "src/world-telemetry.js",
    "src/world.js",
    "src/worldgraph-ui.js",
    "src/worldgraph-validate.js",
    "src/worldgraph.js",
    "test/agent-economy-next-layer-estate.js",
    "test/auth-fixture.js",
    "test/businesspartnerships-fixture.js",
    "test/businessrelocation-acquisition-negative.js",
    "test/businessrelocation-api.js",
    "test/businessrelocation-current-api.js",
    "test/businessrelocation-floor-negative.js",
    "test/businessrelocation-history-negative.js",
    "test/businessrelocation-license-negative.js",
    "test/businessrelocation-native.js",
    "test/businessrelocation.js",
    "test/coldstart.js",
    "test/commercialnegotiation-fixture.js",
    "test/commissionedcrafting-fixture.js",
    "test/company-autonomy-fixture-guards.js",
    "test/company-workforce-contracts.js",
    "test/companyacquisitions-fixture.js",
    "test/companydemand-fixture.js",
    "test/companygovernance-fixture.js",
    "test/companyworkflows.js",
    "test/crossdocking-actions.js",
    "test/crossdocking-api.js",
    "test/crossdocking-boundary.js",
    "test/crossdocking-estate.js",
    "test/crossdocking-fixture.js",
    "test/crossdocking-lifecycle.js",
    "test/crossdocking-races.js",
    "test/crossdocking.js",
    "test/customerlayaway-api.js",
    "test/customerlayaway-fixture.js",
    "test/customerlayaway-integration.js",
    "test/customerlayaway.js",
    "test/customervaults-estate.js",
    "test/customervaults-fixture.js",
    "test/customervaults-native.js",
    "test/customervaults.js",
    "test/decision-dependency-integration-fixture.js",
    "test/decisionreplay-fixture.js",
    "test/decisionreplay-integration.js",
    "test/depotacquisition-next-five.js",
    "test/depotacquisition-production-slots.js",
    "test/depotacquisition-vaults.js",
    "test/director-migration.js",
    "test/economicdependencymap-fixture.js",
    "test/economicdependencymap-integration.js",
    "test/economicintelligence-fixture.js",
    "test/enterprise-native-guard.js",
    "test/enterprise-release-phase2-migration-catalog.js",
    "test/enterprise-source-compatibility.js",
    "test/equipmentinsurance-fixture.js",
    "test/equipmentrecovery-api.js",
    "test/equipmentrecovery-integration-fixture.js",
    "test/equipmentrecovery-integration.js",
    "test/equipmentrecovery-native.js",
    "test/equipmentrecovery-wear.js",
    "test/equipmentrecovery.js",
    "test/fixtures/content/runtime-minimal.json",
    "test/fixtures/content/valid-minimal.json",
    "test/fixtures/genesis-stack-runtime.json",
    "test/fixtures/phase2/compiler/malicious-duplicate/pack.json",
    "test/fixtures/phase2/compiler/valid-core/pack.json",
    "test/fixtures/phase2/discovery/fixtures/adversarial/pack.json",
    "test/fixtures/phase2/discovery/valid-experience/pack.json",
    "test/fixtures/phase2/discovery/valid-library/pack.json",
    "test/fixtures/rwa-health-overlay-v2-vectors.json",
    "test/fixtures/rwa-health-v2-vectors.json",
    "test/freightconsolidation-fixture.js",
    "test/fundedexternalwork-fixture.js",
    "test/gates.js",
    "test/graph.js",
    "test/lib/campaign-network-support.js",
    "test/lib/city-gameplay-migration-catalog.js",
    "test/lib/city-world-opportunity-controls.js",
    "test/lib/company-autonomy-fixture-endpoint.js",
    "test/lib/company-commercial-dto.js",
    "test/lib/company-middle-five-fixture-schema.js",
    "test/lib/company-middle-five-native.js",
    "test/lib/consignments-fixture.js",
    "test/lib/director-support.js",
    "test/lib/equipment-economy-migration-catalog.js",
    "test/lib/phase2-architecture-upgrade-catalog.json",
    "test/lib/phase2-definition-fixtures.js",
    "test/lib/phase2-item-fixtures.js",
    "test/lib/player-command-support.js",
    "test/lib/rc1-authority-probes.js",
    "test/lib/rc1-board-diagnostics.js",
    "test/lib/rc1-browser-controls.js",
    "test/lib/rc1-choice-confirmation-probes.js",
    "test/lib/rc1-family-entry-controls.js",
    "test/lib/rc1-focus-diagnostics.js",
    "test/lib/rc1-historical-source-fixture.js",
    "test/lib/rc1-historical-worker-source.js",
    "test/lib/rc1-npc-boat-controls.js",
    "test/lib/rc1-npc-family-controls.js",
    "test/lib/srcfiles.js",
    "test/managementteams-fixture.js",
    "test/manufacturinglicenses-acquisition.js",
    "test/manufacturinglicenses-api.js",
    "test/manufacturinglicenses-contracts.js",
    "test/manufacturinglicenses-estate.js",
    "test/manufacturinglicenses-fixture.js",
    "test/manufacturinglicenses-integration-fixture.js",
    "test/manufacturinglicenses-invariants.js",
    "test/manufacturinglicenses-native-acquisition.js",
    "test/manufacturinglicenses-native-assertions.js",
    "test/manufacturinglicenses-native-estate.js",
    "test/manufacturinglicenses-native-fixture.js",
    "test/manufacturinglicenses-native.js",
    "test/manufacturinglicenses-production.js",
    "test/manufacturinglicenses.js",
    "test/market-operations-director-catalog.js",
    "test/market-operations-graph-helpers.js",
    "test/market-operations-native-guard.js",
    "test/market-operations-release-phase2-migration-catalog.js",
    "test/market-operations-source-compatibility.js",
    "test/merchantreturns-api.js",
    "test/merchantreturns-fixture.js",
    "test/merchantreturns.js",
    "test/migrate.js",
    "test/mobileshops-api.js",
    "test/mobileshops-integration.js",
    "test/mobileshops.js",
    "test/multihopcourier-api.js",
    "test/multihopcourier-boundary.js",
    "test/multihopcourier-estate.js",
    "test/multihopcourier-expired-owner.js",
    "test/multihopcourier-fixture.js",
    "test/multihopcourier-idempotency.js",
    "test/multihopcourier-recovery.js",
    "test/multihopcourier.js",
    "test/next-layer-graph-helpers.js",
    "test/next-layer-native-guard.js",
    "test/next-layer-release-phase2-migration-catalog.js",
    "test/next-layer-source-compatibility.js",
    "test/phase2-lot-boundary.js",
    "test/phase2-lots.js",
    "test/phase2-postgres.js",
    "test/productionslots-api.js",
    "test/productionslots-boundary.js",
    "test/productionslots-estate.js",
    "test/productionslots-fixture.js",
    "test/productionslots-races.js",
    "test/productionslots-recovery.js",
    "test/productionslots.js",
    "test/rc1-city-gameplay-source-compatibility.js",
    "test/rc1-first-batch-source-compatibility.js",
    "test/rc1-native-world-workload.js",
    "test/server-fixture.js",
    "test/workshopfloor-acquisition-compatibility.js",
    "test/workshopfloor-adversarial.js",
    "test/workshopfloor-api.js",
    "test/workshopfloor-capacity.js",
    "test/workshopfloor-estate.js",
    "test/workshopfloor-expiry.js",
    "test/workshopfloor-fixture.js",
    "test/workshopfloor-recipes.js",
    "test/workshopfloor.js",
    "test/worldgraph-validation.js",
    "tools/city-play-source-transfer.js",
    "tools/combined-fifth-release-phase2-migration-catalog.js",
    "tools/combined-release-phase2-migration-catalog.js",
    "tools/economy-release-composition.js",
    "tools/enterprise-graph-helpers.js",
    "tools/enterprise-native-inputs.js",
    "tools/enterprise-native.js",
    "tools/enterprise-release-phase2-migration-catalog.js",
    "tools/enterprise-source-compatibility.js",
    "tools/graph.js",
    "tools/market-operations-graph-helpers.js",
    "tools/market-operations-native.js",
    "tools/market-operations-release-phase2-migration-catalog.js",
    "tools/market-operations-source-compatibility.js",
    "tools/next-five-release-phase2-migration-catalog.js",
    "tools/next-five-source-compatibility.js",
    "tools/next-layer-graph-helpers.js",
    "tools/next-layer-native.js",
    "tools/next-layer-release-phase2-migration-catalog.js",
    "tools/next-layer-source-compatibility.js",
    "tools/player-intel-source-compatibility.js",
    "tools/rc1-aggression-policy.js",
    "tools/rc1-alliance-continuation.js",
    "tools/rc1-alliance-policy.js",
    "tools/rc1-alliance-world-adapter.js",
    "tools/rc1-business-season-source-compatibility.js",
    "tools/rc1-buyer-cooperative-source-compatibility.js",
    "tools/rc1-car-journal.js",
    "tools/rc1-car-melt-provenance.js",
    "tools/rc1-checkpoint-recovery-review.js",
    "tools/rc1-churn-policy.js",
    "tools/rc1-city-gameplay-source-compatibility.js",
    "tools/rc1-cohort-policy.js",
    "tools/rc1-commercial-premises-source-compatibility.js",
    "tools/rc1-commercial-reputation-source-compatibility.js",
    "tools/rc1-company-bank-source-compatibility.js",
    "tools/rc1-company-logistics-hub-source-compatibility.js",
    "tools/rc1-company-operator-source-compatibility.js",
    "tools/rc1-company-opportunity-source-compatibility.js",
    "tools/rc1-company-succession-source-compatibility.js",
    "tools/rc1-company-workflow-source-compatibility.js",
    "tools/rc1-deed-source-compatibility.js",
    "tools/rc1-duel-selection-provenance.js",
    "tools/rc1-family-policy.js",
    "tools/rc1-family-world-adapter.js",
    "tools/rc1-fifth-batch-source-compatibility.js",
    "tools/rc1-first-batch-source-compatibility.js",
    "tools/rc1-fourth-batch-source-compatibility.js",
    "tools/rc1-game-employment-source-compatibility.js",
    "tools/rc1-intel-source-compatibility.js",
    "tools/rc1-invoice-source-compatibility.js",
    "tools/rc1-knowledge-diagnostics.js",
    "tools/rc1-law-policy.js",
    "tools/rc1-law-world-adapter.js",
    "tools/rc1-lifecycle-applicability.js",
    "tools/rc1-loan-source-compatibility.js",
    "tools/rc1-logistics-coverage-source-compatibility.js",
    "tools/rc1-market-feed-source-compatibility.js",
    "tools/rc1-market-policy.js",
    "tools/rc1-market-world-adapter.js",
    "tools/rc1-mystery-policies.js",
    "tools/rc1-native-actor-replay.js",
    "tools/rc1-native-commit-observer.js",
    "tools/rc1-native-database.js",
    "tools/rc1-native-determinism.js",
    "tools/rc1-native-player-policy.js",
    "tools/rc1-native-proof-gzip.js",
    "tools/rc1-native-proof-stream.js",
    "tools/rc1-native-proof.js",
    "tools/rc1-native-query-order.js",
    "tools/rc1-native-query-tape.js",
    "tools/rc1-native-quiescent-group.js",
    "tools/rc1-native-run-guardrails.js",
    "tools/rc1-native-worker.js",
    "tools/rc1-npc-boat-fault.js",
    "tools/rc1-npc-boat-journal.js",
    "tools/rc1-npc-car-acquisition.js",
    "tools/rc1-npc-cargo-journal.js",
    "tools/rc1-npc-family-journal.js",
    "tools/rc1-npc-family-provenance.js",
    "tools/rc1-npc-family-recruitment.js",
    "tools/rc1-npc-market-order-journal.js",
    "tools/rc1-npc-retirement-journal.js",
    "tools/rc1-omr-journal.js",
    "tools/rc1-player-car-provenance.js",
    "tools/rc1-pressure-world-adapter.js",
    "tools/rc1-qualification.mjs",
    "tools/rc1-resource-journal.js",
    "tools/rc1-resource-pressure-policy.js",
    "tools/rc1-scarcity-initialization.js",
    "tools/rc1-season-conversion-journal.js",
    "tools/rc1-season-crown-journal.js",
    "tools/rc1-season-election-provenance.js",
    "tools/rc1-second-batch-source-compatibility.js",
    "tools/rc1-strategy-league-source-compatibility.js",
    "tools/rc1-strategy-source-compatibility.js",
    "tools/rc1-third-batch-source-compatibility.js",
    "tools/rc1-turf-policy.js",
    "tools/rc1-war-world-adapter.js",
    "tools/rc1-world-backlog-review.js",
    "tools/rc1-world-checkpoint-series.js",
    "tools/rc1-world-diagnostics.js",
    "tools/rc1-world-duration-evidence.js",
    "tools/rc1-world-economy-metrics.js",
    "tools/rc1-world-history-storage.js",
    "tools/rc1-world-lifecycle-resources.js",
    "tools/rc1-world-market-resources.js",
    "tools/rc1-world-order-resources.js",
    "tools/rc1-world-qualification.js",
    "tools/rc1-world-resource-observer.js",
    "tools/rc1-world-worker-transitions.js",
    "tools/release-phase2-migration-catalog.js",
    "tools/release-source-transfer.js",
    "tools/worldgraph-content.js",
    "src/content/city-rumors.js",
    "src/content/property-investigation.js",
    "src/deedbuildings.js",
    "src/deeddiscovery.js",
    "src/deedquesteligibility.js",
    "tools/deed-discovery-migration-catalog.js",
    "tools/deed-market-source-compatibility.js",
    "tools/deed-quest-source-transfer.js",
    "tools/sqlscan.js",
    "tools/enterprise-deed-release-phase2-migration-catalog.js",
    "tools/enterprise-current-source-data.js",
    "tools/enterprise-current-source-compatibility.js",
    "test/enterprise-current-source-compatibility.js",
    "tools/city-gameplay-native.js",
    "tools/company-autonomy-native.js",
    "tools/equipment-economy-native.js",
    "src/city-activity.js",
    "tools/rc1-city-activity-market-source-compatibility.js",
    "tools/rc1-city-activity-source-compatibility.js",
    "src/commercialcampaignruntime.js",
    "src/commercialcampaigns-contracts.js",
    "src/commercialcampaigns-schema.js",
    "src/commercialcampaigns.js",
    "src/eventmarkets-contracts.js",
    "src/eventmarkets-schema.js",
    "src/eventmarkets.js",
    "src/merchantloyalty-api.js",
    "src/merchantloyalty-contracts.js",
    "src/merchantloyalty-schema.js",
    "src/merchantloyalty.js",
    "src/routes/commercialcampaigns.js",
    "src/routes/eventmarkets.js",
    "src/saleattribution-contracts.js",
    "src/saleattribution-routes.js",
    "src/saleattribution.js",
    "src/shoppingbasket-api.js",
    "src/shoppingbasket-contracts.js",
    "src/shoppingbasket-schema.js",
    "src/shoppingbasket.js",
    "test/atomicbarter.js",
    "test/city-gameplay-panels-browser.js",
    "test/commerce-current-native-guard.js",
    "test/commerce-release-phase2-migration-catalog.js",
    "test/commerce-source-compatibility.js",
    "test/commercialcampaigns-integration.js",
    "test/commercialcampaigns-metadata-native.js",
    "test/consignments-api.js",
    "test/consignments.js",
    "test/deed-discovery-fixture.js",
    "test/eventmarkets-finite-fixture.js",
    "test/eventmarkets-integration.js",
    "test/eventmarkets-recovery-fixture.js",
    "test/merchantloyalty-accounting.js",
    "test/merchantloyalty-api.js",
    "test/merchantloyalty-boundary.js",
    "test/merchantloyalty-current-native-fixture.js",
    "test/merchantloyalty-estate.js",
    "test/merchantloyalty-expiry.js",
    "test/merchantloyalty-fixture.js",
    "test/merchantloyalty-native-estate.js",
    "test/merchantloyalty-native-expiry.js",
    "test/merchantloyalty-native-races.js",
    "test/merchantloyalty-native-rollback.js",
    "test/merchantloyalty.js",
    "test/saleattribution-api.js",
    "test/saleattribution-current-native-fixture.js",
    "test/saleattribution-expiry.js",
    "test/saleattribution-fixture.js",
    "test/saleattribution-native-estate.js",
    "test/saleattribution-native-races.js",
    "test/saleattribution-native-rollback.js",
    "test/saleattribution-witness.js",
    "test/saleattribution.js",
    "test/shoppingbasket-api.js",
    "test/shoppingbasket-atomicity.js",
    "test/shoppingbasket-boundary.js",
    "test/shoppingbasket-current-native-fixture.js",
    "test/shoppingbasket-estate.js",
    "test/shoppingbasket-expiry.js",
    "test/shoppingbasket-fixture.js",
    "test/shoppingbasket-native-estate.js",
    "test/shoppingbasket-native-expiry.js",
    "test/shoppingbasket-native-races.js",
    "test/shoppingbasket-native-rollback.js",
    "test/shoppingbasket.js",
    "tools/commerce-current-native-data.js",
    "tools/commerce-current-native-guard.js",
    "tools/commerce-current-native.js",
    "tools/commerce-deed-release-phase2-native-catalog.js",
    "tools/commerce-enterprise-source-compatibility.js",
    "tools/commerce-enterprise-source-data.js",
    "tools/commerce-graph-helpers.js",
    "tools/commerce-native.js",
    "tools/commerce-release-phase2-migration-catalog.js",
    "tools/commerce-release-phase2-native-catalog.js",
    "tools/commerce-source-compatibility.js",
    "tools/commerce-current-enterprise-source-compatibility.js",
    "tools/commerce-current-enterprise-source-data.js",
    "public/city-world-layout.js",
    "public/player-experience.js",
    "src/accountdaily.js",
    "src/actioncooldown.js",
    "src/car-choices.js",
    "src/client-ip.js",
    "src/heist-readiness.js",
    "src/rescue-quote.js",
    "src/socialproof.js",
    "test/city-connected-scene-browser.js",
    "test/city-homes-api.js",
    "test/city-scene-browser.js",
    "test/city-world-host-browser.js",
    "test/city-world-layout-ui-browser.js",
    "test/city-world-layout.js",
    "test/classic-interface-source-compatibility.js",
    "test/client-ip.js",
    "test/client.js",
    "test/continuous-city-host-contract.js",
    "test/continuous-city-source-compatibility.js",
    "test/decision-guide-api.js",
    "test/decision-guide-client.js",
    "test/decision-guide.js",
    "test/deed-quest-source-compatibility.js",
    "test/economy-release-composition.js",
    "test/next-five-source-compatibility.js",
    "test/player-experience-api.js",
    "test/player-experience-client.js",
    "test/player-experience.js",
    "test/player-intel-source-compatibility.js",
    "test/rc1-browser-board-refresh.js",
    "test/rc1-business-season-source-compatibility.js",
    "test/rc1-buyer-cooperative-source-compatibility.js",
    "test/rc1-checkpoint-recovery-review.js",
    "test/rc1-commercial-premises-source-compatibility.js",
    "test/rc1-commercial-reputation-source-compatibility.js",
    "test/rc1-company-bank-source-compatibility.js",
    "test/rc1-company-logistics-hub-source-compatibility.js",
    "test/rc1-company-operator-source-compatibility.js",
    "test/rc1-company-opportunity-source-compatibility.js",
    "test/rc1-company-succession-source-compatibility.js",
    "test/rc1-company-workflow-source-compatibility.js",
    "test/rc1-fifth-batch-source-compatibility.js",
    "test/rc1-fourth-batch-source-compatibility.js",
    "test/rc1-game-employment-source-compatibility.js",
    "test/rc1-intel-source-compatibility.js",
    "test/rc1-invoice-source-compatibility.js",
    "test/rc1-lifecycle-applicability.js",
    "test/rc1-logistics-coverage-source-compatibility.js",
    "test/rc1-market-feed-source-compatibility.js",
    "test/rc1-npc-family-recruitment.js",
    "test/rc1-player-car-provenance.js",
    "test/rc1-second-batch-source-compatibility.js",
    "test/rc1-strategy-league-source-compatibility.js",
    "test/rc1-strategy-source-compatibility.js",
    "test/rc1-third-batch-source-compatibility.js",
    "test/rc1-world-backlog-review.js",
    "test/rc1-world-checkpoint-series.js",
    "test/rc1-world-lifecycle-resources.js",
    "test/rc1-world-market-resources.js",
    "test/rc1-world-npc-family-lineage.js",
    "test/rc1-world-qualification.js",
    "test/release-source-transfer.js",
    "tools/classic-interface-source-compatibility.js",
    "tools/classic-interface-source-data.js",
    "tools/continuous-city-fixture-source-data.js",
    "tools/continuous-city-source-compatibility.js",
    "tools/continuous-city-source-data.js",
    "tools/economy-hardening-source-transfer.js",
    "tools/economy-release-tail-source-transfer.js",
    "tools/enterprise-native-continuous-city-inputs.js",
    "tools/genesis-auction-deployment-plan.js",
    "tools/genesis-auction-preflight.js",
    "tools/market-v2-deployment-plan.js",
    ".github/workflows/economy-hardening.yml",
    "public/art/nft/deed-brick.jpg",
    "public/art/nft/deed-canal.jpg",
    "public/art/nft/deed-cathedral.jpg",
    "public/art/nft/deed-docks.jpg",
    "public/art/nft/deed-foundry.jpg",
    "public/art/nft/deed-neon.jpg",
    "public/business-control-desk.css",
    "public/business-control-desk.js",
    "public/sale.html",
    "public/ux-community.css",
    "public/ux-community.js",
    "public/ux-coordination.css",
    "public/ux-coordination.js",
    "public/ux-feedback.css",
    "public/ux-feedback.js",
    "public/ux-feel.css",
    "public/ux-feel.js",
    "public/ux-identity.css",
    "public/ux-identity.js",
    "public/ux-investigation.css",
    "public/ux-investigation.js",
    "public/ux-navigation.css",
    "public/ux-navigation.js",
    "public/ux-progression.css",
    "public/ux-progression.js",
    "public/ux-social.css",
    "public/ux-social.js",
    "public/ux-story.css",
    "public/ux-story.js",
    "public/ux-tactics.css",
    "public/ux-tactics.js",
    "public/ux-tools.css",
    "public/ux-tools.js",
    "public/ux-workspace.js",
    "public/ux-world.css",
    "public/ux-world.js",
    "src/businessdesk.js",
    "src/circle-highlights.js",
    "src/content/neighborhood-afterword.js",
    "src/deedbenefits.js",
    "src/economy-monitor.js",
    "src/routes/businessdesk.js",
    "src/ux-community.js",
    "src/ux-coordination.js",
    "src/ux-investigation.js",
    "src/ux-story.js",
    "src/ux-tactics.js",
    "src/ux-workspace.js",
    "test/age-eligibility-source-compatibility.js",
    "test/age.js",
    "test/business-control-desk-browser.js",
    "test/business-control-desk-loop.js",
    "test/businessdesk-api.js",
    "test/businessdesk-combined-native-provenance.js",
    "test/businessdesk-combined-source-compatibility.js",
    "test/businessdesk-consent-browser.js",
    "test/businessdesk-native-provenance.js",
    "test/businessdesk-source-compatibility.js",
    "test/businessdesk.js",
    "test/db-boot-lock-postgres.js",
    "test/economy-composition-restart.js",
    "test/economy-composition.js",
    "test/economy-deed-merge-source-compatibility.js",
    "test/economy-monitor-source-compatibility.js",
    "test/economy-monitor.js",
    "test/launch-invites-browser.js",
    "test/legal-security.js",
    "test/lib/business-control-desk-fixture.js",
    "test/lib/enterprise-ux-native-guard.js",
    "test/lib/ux-director-reader-source-compatibility.js",
    "test/lib/ux-enterprise-reader-source-compatibility.js",
    "test/lib/ux-native-director-guard.js",
    "test/lib/ux-native-reader-source-compatibility.js",
    "test/noir-ui-source-compatibility.js",
    "test/sale-source-compatibility.js",
    "test/social-receipt-postgres.js",
    "test/ux-expanded-browser.js",
    "test/ux-source-compatibility.js",
    "test/wallet-connect-browser.js",
    "tools/action-readiness-source-compatibility.js",
    "tools/action-readiness-source-data.js",
    "tools/age-eligibility-source-transfer.js",
    "tools/age21-source-data.js",
    "tools/age21-source-transfer.js",
    "tools/businessdesk-combined-native-data.js",
    "tools/businessdesk-combined-native-parents.js",
    "tools/businessdesk-combined-native-provenance.js",
    "tools/businessdesk-combined-source-data.js",
    "tools/businessdesk-combined-source-transfer.js",
    "tools/businessdesk-deed-native-inputs.js",
    "tools/businessdesk-desk-parent-native-inputs.js",
    "tools/businessdesk-monitor-parent-native-inputs.js",
    "tools/businessdesk-native-provenance.js",
    "tools/businessdesk-noir-native-provenance.js",
    "tools/businessdesk-noir-source-data.js",
    "tools/businessdesk-noir-source-transfer.js",
    "tools/businessdesk-source-transfer.js",
    "tools/businessdesk-wiki-parent-native-inputs.js",
    "tools/deed-allocation-source-data.js",
    "tools/deed-allocation-source-transfer.js",
    "tools/deed-benefit-native-catalog.js",
    "tools/economy-bank-interest-source-transfer.js",
    "tools/economy-deed-merge-source-compatibility.js",
    "tools/economy-deed-merge-source-data.js",
    "tools/economy-monitor-source-transfer.js",
    "tools/economy-readiness-merge-source-compatibility.js",
    "tools/economy-readiness-merge-source-data.js",
    "tools/economy-social-proof-cutover-source-transfer.js",
    "tools/economy-social-proof-receipt-safety-source-transfer.js",
    "tools/economy-social-proof-receipt-source-transfer.js",
    "tools/economy-ux-merge-source-compatibility.js",
    "tools/economy-ux-merge-source-data.js",
    "tools/enterprise-native-ux-b35-inputs.js",
    "tools/enterprise-native-ux-inputs.js",
    "tools/enterprise-native-ux-seal.js",
    "tools/enterprise-native-ux.js",
    "tools/generate-age-eligibility-source-transfer.js",
    "tools/generate-businessdesk-combined-native.js",
    "tools/generate-businessdesk-combined-source.js",
    "tools/generate-businessdesk-source-transfer.js",
    "tools/generate-economy-bank-interest-source-transfer.js",
    "tools/generate-economy-deed-merge-source.js",
    "tools/generate-economy-monitor-source-transfer.js",
    "tools/generate-economy-social-proof-cutover-source-transfer.js",
    "tools/generate-economy-social-proof-receipt-safety-source-transfer.js",
    "tools/generate-economy-social-proof-receipt-source-transfer.js",
    "tools/generate-noir-ui-source-transfer.js",
    "tools/mobile.js",
    "tools/noir-ui-source-data.js",
    "tools/noir-ui-source-transfer.js",
    "tools/pgquery.js",
    "tools/public-ui.js",
    "tools/sale-source-compatibility.js",
    "tools/sale-source-data.js",
    "tools/sale-source-seal.js",
    "tools/ux-afterword-source-compatibility.js",
    "tools/ux-afterword-source-data.js",
    "tools/ux-director-reader-source-compatibility.js",
    "tools/ux-director-reader-source-data.js",
    "tools/ux-director-reader-source-seal.js",
    "tools/ux-enterprise-reader-source-compatibility.js",
    "tools/ux-enterprise-reader-source-data.js",
    "tools/ux-native-reader-source-compatibility.js",
    "tools/ux-native-reader-source-data.js",
    "tools/ux-phase2-upgrade-bound-source-data.js",
    "tools/ux-phase2-upgrade-bound-source-seal.js",
    "tools/ux-release-phase2-native-catalog.js",
    "tools/ux-source-compatibility.js",
    "tools/ux-source-data.js",
    "tools/ux-suites-gate-source-data.js",
    "tools/ux-suites-gate-source-seal.js",
    "tools/ux-workflow-bound-source-data.js",
    "tools/ux-workflow-bound-source-seal.js",
    "tools/walletconnect-privacy.mjs",
    "tools/wiki-media-source-data.js",
    "tools/wiki-media-source-transfer.js"
  ],
  "reviewedFiles": [
    ".github/workflows/ci.yml",
    "AGENTS.md",
    "package.json",
    "public/index.html",
    "public/omerta-ui.css",
    "public/sale.html",
    "public/ux-coordination.css",
    "public/ux-coordination.js",
    "public/ux-feedback.js",
    "public/ux-identity.js",
    "public/ux-navigation.css",
    "public/ux-navigation.js",
    "public/ux-progression.css",
    "public/ux-progression.js",
    "public/ux-tactics.css",
    "public/ux-tactics.js",
    "public/ux-world.js",
    "public/wiki.html",
    "schema.sql",
    "src/accrual.js",
    "src/age.js",
    "src/content/city-quest-presentation.js",
    "src/content/phase1-policy.js",
    "src/content/phase1.js",
    "src/db.js",
    "src/deedbuildings.js",
    "src/deeddiscovery.js",
    "src/deeds.js",
    "src/engagement.js",
    "src/game.js",
    "src/invariants.js",
    "src/legal.js",
    "src/preflight.js",
    "src/server.js",
    "src/ux-story.js",
    "src/ux-tactics.js",
    "src/worker.js",
    "src/worldgraph-ui.js",
    "test/client.js",
    "test/commerce-current-native-guard.js",
    "test/companyworkflows.js",
    "test/decision-guide-client.js",
    "test/director-migration.js",
    "test/gates.js",
    "test/lib/enterprise-ux-native-guard.js",
    "test/lib/phase2-definition-fixtures.js",
    "test/lib/player-command-support.js",
    "test/lib/ux-native-director-guard.js",
    "test/lib/ux-native-reader-source-compatibility.js",
    "test/sale-source-compatibility.js",
    "test/ux-source-compatibility.js",
    "test/worldgraph-validation.js",
    "tools/commerce-current-native-guard.js",
    "tools/economy-social-proof-cutover-source-transfer.js",
    "tools/economy-ux-merge-source-compatibility.js",
    "tools/enterprise-native-ux-seal.js",
    "tools/enterprise-native-ux.js",
    "tools/enterprise-native.js",
    "tools/pgquery.js",
    "tools/ux-release-phase2-native-catalog.js",
    "tools/ux-source-compatibility.js"
  ],
  "files": [
    {
      "file": ".github/workflows/ci.yml",
      "current": {
        "file": ".github/workflows/ci.yml",
        "mode": "100644",
        "blob": "c9de23a56b9e1334507d62a0657637e1a558c841",
        "sha256": "6e8485d145c7afa2d293c701cdc726010e88837c1a67a67a2a99e3e28ded4876"
      },
      "profile": "desk",
      "parent": {
        "file": ".github/workflows/ci.yml",
        "mode": "100644",
        "blob": "c9de23a56b9e1334507d62a0657637e1a558c841",
        "sha256": "6e8485d145c7afa2d293c701cdc726010e88837c1a67a67a2a99e3e28ded4876"
      },
      "path": [
        {
          "kind": "business",
          "from": {
            "file": ".github/workflows/ci.yml",
            "mode": "100644",
            "blob": "c9de23a56b9e1334507d62a0657637e1a558c841",
            "sha256": "6e8485d145c7afa2d293c701cdc726010e88837c1a67a67a2a99e3e28ded4876"
          },
          "to": {
            "file": ".github/workflows/ci.yml",
            "mode": "100644",
            "blob": "e699a70d52fd8c792889696d3c51af175cae9b51",
            "sha256": "cc5b01c918ceb57441b03fffe7e53ca6c2477515f3f42f40c5dbf66a4ac79d32"
          }
        }
      ]
    },
    {
      "file": "AGENTS.md",
      "current": {
        "file": "AGENTS.md",
        "mode": "100644",
        "blob": "40a764e3fc39a7c93d2c0d8797913f6f9e9d4444",
        "sha256": "ffd42e51acb2b06b12b4ac7132f5fd4c4ae2f29f63720b9e7d3931d3fe7b79b4"
      },
      "profile": "desk",
      "parent": {
        "file": "AGENTS.md",
        "mode": "100644",
        "blob": "40a764e3fc39a7c93d2c0d8797913f6f9e9d4444",
        "sha256": "ffd42e51acb2b06b12b4ac7132f5fd4c4ae2f29f63720b9e7d3931d3fe7b79b4"
      },
      "path": [
        {
          "kind": "deed",
          "from": {
            "file": "AGENTS.md",
            "mode": "100644",
            "blob": "40a764e3fc39a7c93d2c0d8797913f6f9e9d4444",
            "sha256": "ffd42e51acb2b06b12b4ac7132f5fd4c4ae2f29f63720b9e7d3931d3fe7b79b4"
          },
          "to": {
            "file": "AGENTS.md",
            "mode": "100644",
            "blob": "9d7a3b61336d8950d164aec695cb3ac82cc221a7",
            "sha256": "1aa9290c76468c11ec0f41940d5589871fa9246d830e2be64ab9345c7ba80a24"
          }
        }
      ]
    },
    {
      "file": "package.json",
      "current": {
        "file": "package.json",
        "mode": "100644",
        "blob": "e0a1a7c22a923009ed8147244a0065dda012228d",
        "sha256": "1d62d7cdfaf75c44ecd896eea8aedeea679befbc6f78360c86bb766a857371a1"
      },
      "profile": "desk",
      "parent": {
        "file": "package.json",
        "mode": "100644",
        "blob": "d694c1e13e588375f33e3db937db78ef0b1b33bd",
        "sha256": "ec1cc4fae1524167f589904b873adfee7fdaadc5def3ebc889f2f3bb80526a35"
      },
      "path": [
        {
          "kind": "combined-source",
          "from": {
            "file": "package.json",
            "mode": "100644",
            "blob": "e0a1a7c22a923009ed8147244a0065dda012228d",
            "sha256": "1d62d7cdfaf75c44ecd896eea8aedeea679befbc6f78360c86bb766a857371a1"
          },
          "to": {
            "file": "package.json",
            "mode": "100644",
            "blob": "d694c1e13e588375f33e3db937db78ef0b1b33bd",
            "sha256": "ec1cc4fae1524167f589904b873adfee7fdaadc5def3ebc889f2f3bb80526a35"
          }
        },
        {
          "kind": "desk-noir-combined",
          "from": {
            "file": "package.json",
            "mode": "100644",
            "blob": "d694c1e13e588375f33e3db937db78ef0b1b33bd",
            "sha256": "ec1cc4fae1524167f589904b873adfee7fdaadc5def3ebc889f2f3bb80526a35"
          },
          "to": {
            "file": "package.json",
            "mode": "100644",
            "blob": "d374512314ba44dd523014b50debfadfd314c87e",
            "sha256": "581ce4e8744d266c01f083863adcd1f0c5849b7fb32ce40628da707124e0059c"
          }
        },
        {
          "kind": "noir",
          "from": {
            "file": "package.json",
            "mode": "100644",
            "blob": "d374512314ba44dd523014b50debfadfd314c87e",
            "sha256": "581ce4e8744d266c01f083863adcd1f0c5849b7fb32ce40628da707124e0059c"
          },
          "to": {
            "file": "package.json",
            "mode": "100644",
            "blob": "02a624dc1659581ee688c22e5442712552ca9170",
            "sha256": "44a450b15010487b9c2916c9d0a29a583dfe95f9c9b12033afbb25620560ab56"
          }
        },
        {
          "kind": "deed",
          "from": {
            "file": "package.json",
            "mode": "100644",
            "blob": "02a624dc1659581ee688c22e5442712552ca9170",
            "sha256": "44a450b15010487b9c2916c9d0a29a583dfe95f9c9b12033afbb25620560ab56"
          },
          "to": {
            "file": "package.json",
            "mode": "100644",
            "blob": "531e67d793e7758751f1734fe6dd96b7520268d4",
            "sha256": "25a5a2cb4f5c8bc5ce9538495716d60fad3c67e995a2db36daca01505c92e2fc"
          }
        }
      ]
    },
    {
      "file": "public/index.html",
      "current": {
        "file": "public/index.html",
        "mode": "100644",
        "blob": "cb87163f7b87389596a737e18be397ce6a1af02a",
        "sha256": "e2795f78d407109a4b2e8e12f09b3eedd5d640fa6d7f3cecc435c0dd273e5f28"
      },
      "profile": "desk",
      "parent": {
        "file": "public/index.html",
        "mode": "100644",
        "blob": "d1c7308c239b67272afe7dab303a921120ef3db3",
        "sha256": "f346529cc0dcb5008d6def2cbd47bac89f0767875319927822f91df11ba4943b"
      },
      "path": [
        {
          "kind": "combined-source",
          "from": {
            "file": "public/index.html",
            "mode": "100644",
            "blob": "cb87163f7b87389596a737e18be397ce6a1af02a",
            "sha256": "e2795f78d407109a4b2e8e12f09b3eedd5d640fa6d7f3cecc435c0dd273e5f28"
          },
          "to": {
            "file": "public/index.html",
            "mode": "100644",
            "blob": "d1c7308c239b67272afe7dab303a921120ef3db3",
            "sha256": "f346529cc0dcb5008d6def2cbd47bac89f0767875319927822f91df11ba4943b"
          }
        },
        {
          "kind": "desk-noir-combined",
          "from": {
            "file": "public/index.html",
            "mode": "100644",
            "blob": "d1c7308c239b67272afe7dab303a921120ef3db3",
            "sha256": "f346529cc0dcb5008d6def2cbd47bac89f0767875319927822f91df11ba4943b"
          },
          "to": {
            "file": "public/index.html",
            "mode": "100644",
            "blob": "36d900d027a7ffbfe598036adb1b2635a32fe1ea",
            "sha256": "13c2cc9b99b9fbde817718741e05e3a1f2f8615107ce1de98d1c7fdd4c04fb28"
          }
        },
        {
          "kind": "noir",
          "from": {
            "file": "public/index.html",
            "mode": "100644",
            "blob": "36d900d027a7ffbfe598036adb1b2635a32fe1ea",
            "sha256": "13c2cc9b99b9fbde817718741e05e3a1f2f8615107ce1de98d1c7fdd4c04fb28"
          },
          "to": {
            "file": "public/index.html",
            "mode": "100644",
            "blob": "96b2921c67993953909847604016491481e64919",
            "sha256": "ff1924deb41952c9be01a1064f0696d18eb21948e762a60144050c74b7d81344"
          }
        },
        {
          "kind": "deed",
          "from": {
            "file": "public/index.html",
            "mode": "100644",
            "blob": "96b2921c67993953909847604016491481e64919",
            "sha256": "ff1924deb41952c9be01a1064f0696d18eb21948e762a60144050c74b7d81344"
          },
          "to": {
            "file": "public/index.html",
            "mode": "100644",
            "blob": "0b187d5f921800af383e612025d1c635dc89c442",
            "sha256": "e123908ed56e87ec55a8cb5ab0922f94b6a9651b01c039591d3652ac1e3c8750"
          }
        }
      ]
    },
    {
      "file": "public/omerta-ui.css",
      "current": {
        "file": "public/omerta-ui.css",
        "mode": "100644",
        "blob": "e2b45e3b8fa9b261a60f3dbe84d91abea362b926",
        "sha256": "4daa6519dfb0b6eaf327e6442a35af74fe7b6d127fdebd04f3a66924ad46841e"
      },
      "profile": "wiki",
      "parent": {
        "file": "public/omerta-ui.css",
        "mode": "100644",
        "blob": "e2b45e3b8fa9b261a60f3dbe84d91abea362b926",
        "sha256": "4daa6519dfb0b6eaf327e6442a35af74fe7b6d127fdebd04f3a66924ad46841e"
      },
      "path": [
        {
          "kind": "wiki-noir-merge",
          "from": {
            "file": "public/omerta-ui.css",
            "mode": "100644",
            "blob": "e2b45e3b8fa9b261a60f3dbe84d91abea362b926",
            "sha256": "4daa6519dfb0b6eaf327e6442a35af74fe7b6d127fdebd04f3a66924ad46841e"
          },
          "to": {
            "file": "public/omerta-ui.css",
            "mode": "100644",
            "blob": "83b5fc76ec9ffd151192e7f3a619c4fe5a9e3578",
            "sha256": "0c706ab6e86876c34afdf78392aaa42bd7122f7b38fb4485265e059ed01c809a"
          }
        }
      ]
    },
    {
      "file": "public/sale.html",
      "current": {
        "file": "public/sale.html",
        "mode": "100644",
        "blob": "6e24725980377c963619bc00c813da0819e564e8",
        "sha256": "639d41062a3f6b0744ae6553b4b6ae03cd31d7c9625204841cd51ac8993378ce"
      },
      "profile": "desk",
      "parent": {
        "file": "public/sale.html",
        "mode": "100644",
        "blob": "6e24725980377c963619bc00c813da0819e564e8",
        "sha256": "639d41062a3f6b0744ae6553b4b6ae03cd31d7c9625204841cd51ac8993378ce"
      },
      "path": [
        {
          "kind": "deed",
          "from": {
            "file": "public/sale.html",
            "mode": "100644",
            "blob": "6e24725980377c963619bc00c813da0819e564e8",
            "sha256": "639d41062a3f6b0744ae6553b4b6ae03cd31d7c9625204841cd51ac8993378ce"
          },
          "to": {
            "file": "public/sale.html",
            "mode": "100644",
            "blob": "d6c60cb31e849a988364e0d2e347717c3c17bc41",
            "sha256": "87817dbd2e4f716a0933c1c58ac7d32b0135a56049185538403d90e48ffac857"
          }
        }
      ]
    },
    {
      "file": "public/ux-coordination.css",
      "current": {
        "file": "public/ux-coordination.css",
        "mode": "100644",
        "blob": "36a963c6b495e5c87c5d8e110f57808e19ee4732",
        "sha256": "8044d107e1a0a9a790ecbe8591eeb436f08ceda4d46f350f37302dd22334aa7e"
      },
      "profile": "desk",
      "parent": {
        "file": "public/ux-coordination.css",
        "mode": "100644",
        "blob": "36a963c6b495e5c87c5d8e110f57808e19ee4732",
        "sha256": "8044d107e1a0a9a790ecbe8591eeb436f08ceda4d46f350f37302dd22334aa7e"
      },
      "path": [
        {
          "kind": "deed",
          "from": {
            "file": "public/ux-coordination.css",
            "mode": "100644",
            "blob": "36a963c6b495e5c87c5d8e110f57808e19ee4732",
            "sha256": "8044d107e1a0a9a790ecbe8591eeb436f08ceda4d46f350f37302dd22334aa7e"
          },
          "to": {
            "file": "public/ux-coordination.css",
            "mode": "100644",
            "blob": "981d76247b0b6301b0a4fe6652841a4ef2dc9a39",
            "sha256": "9b79f34286e6829ba03202511686fdaa9398e57d8bbb76fe0f2c9ad8511c021b"
          }
        }
      ]
    },
    {
      "file": "public/ux-coordination.js",
      "current": {
        "file": "public/ux-coordination.js",
        "mode": "100644",
        "blob": "b793c95fdaf2dd129196cc4a09ce9a49d2744779",
        "sha256": "4868b786546015d7a9137432db177dd5468bbccb1088565fe8190e2ad9d8b64e"
      },
      "profile": "desk",
      "parent": {
        "file": "public/ux-coordination.js",
        "mode": "100644",
        "blob": "b793c95fdaf2dd129196cc4a09ce9a49d2744779",
        "sha256": "4868b786546015d7a9137432db177dd5468bbccb1088565fe8190e2ad9d8b64e"
      },
      "path": [
        {
          "kind": "deed",
          "from": {
            "file": "public/ux-coordination.js",
            "mode": "100644",
            "blob": "b793c95fdaf2dd129196cc4a09ce9a49d2744779",
            "sha256": "4868b786546015d7a9137432db177dd5468bbccb1088565fe8190e2ad9d8b64e"
          },
          "to": {
            "file": "public/ux-coordination.js",
            "mode": "100644",
            "blob": "ad35b284f2ba7f425ba15391410a6f4b0cce51db",
            "sha256": "7e74509012c977a5a9438942883ffa6168ada4cb187bac97f8d72bcc21bfe1f1"
          }
        }
      ]
    },
    {
      "file": "public/ux-feedback.js",
      "current": {
        "file": "public/ux-feedback.js",
        "mode": "100644",
        "blob": "700733489760e5a6b9a241691edcdf0026d366a4",
        "sha256": "a7e6580754161123aa6f9fd75fa41bde92ae8ac8c2d96963a6cd1c0fc1121e88"
      },
      "profile": "wiki",
      "parent": {
        "file": "public/ux-feedback.js",
        "mode": "100644",
        "blob": "700733489760e5a6b9a241691edcdf0026d366a4",
        "sha256": "a7e6580754161123aa6f9fd75fa41bde92ae8ac8c2d96963a6cd1c0fc1121e88"
      },
      "path": [
        {
          "kind": "wiki-noir-merge",
          "from": {
            "file": "public/ux-feedback.js",
            "mode": "100644",
            "blob": "700733489760e5a6b9a241691edcdf0026d366a4",
            "sha256": "a7e6580754161123aa6f9fd75fa41bde92ae8ac8c2d96963a6cd1c0fc1121e88"
          },
          "to": {
            "file": "public/ux-feedback.js",
            "mode": "100644",
            "blob": "53436f2a26e5ba680ca2ab8d165a6d4b32503f4d",
            "sha256": "7e793f9cff793b4e40378473fb7733f7b2802b3d65215cd68e896af09187a1ac"
          }
        },
        {
          "kind": "wiki-merge",
          "from": {
            "file": "public/ux-feedback.js",
            "mode": "100644",
            "blob": "53436f2a26e5ba680ca2ab8d165a6d4b32503f4d",
            "sha256": "7e793f9cff793b4e40378473fb7733f7b2802b3d65215cd68e896af09187a1ac"
          },
          "to": {
            "file": "public/ux-feedback.js",
            "mode": "100644",
            "blob": "edd1a6bcfaa690852bf753349fff1046da3a36de",
            "sha256": "002d872bc67a440a512bd1903418ae6acd28940e84b0499af42eba3a34700b97"
          }
        }
      ]
    },
    {
      "file": "public/ux-identity.js",
      "current": {
        "file": "public/ux-identity.js",
        "mode": "100644",
        "blob": "86fece90a1c9af09ae766193033cef678ecd988b",
        "sha256": "6c95d5de538d710b5d506dbe1ad42baf5d55edb91bd42688c402ce5bd4cb644a"
      },
      "profile": "monitor",
      "parent": {
        "file": "public/ux-identity.js",
        "mode": "100644",
        "blob": "86fece90a1c9af09ae766193033cef678ecd988b",
        "sha256": "6c95d5de538d710b5d506dbe1ad42baf5d55edb91bd42688c402ce5bd4cb644a"
      },
      "path": [
        {
          "kind": "monitor56",
          "from": {
            "file": "public/ux-identity.js",
            "mode": "100644",
            "blob": "86fece90a1c9af09ae766193033cef678ecd988b",
            "sha256": "6c95d5de538d710b5d506dbe1ad42baf5d55edb91bd42688c402ce5bd4cb644a"
          },
          "to": {
            "file": "public/ux-identity.js",
            "mode": "100644",
            "blob": "faba4e7e26204df0f877414859b81a7c53fc97f5",
            "sha256": "ae7505a1022130eacfd885124d3f59d375b463ae023ffaea87f51ecf90c3aeaa"
          }
        }
      ]
    },
    {
      "file": "public/ux-navigation.css",
      "current": {
        "file": "public/ux-navigation.css",
        "mode": "100644",
        "blob": "7c42357e601b6a9d5093d30bef159d8628cc8539",
        "sha256": "712ebf19faf5303e45d82c55cfc9cda4b3d4156fc0ab759a115a849dbe2efbd6"
      },
      "profile": "desk",
      "parent": {
        "file": "public/ux-navigation.css",
        "mode": "100644",
        "blob": "7c42357e601b6a9d5093d30bef159d8628cc8539",
        "sha256": "712ebf19faf5303e45d82c55cfc9cda4b3d4156fc0ab759a115a849dbe2efbd6"
      },
      "path": [
        {
          "kind": "deed",
          "from": {
            "file": "public/ux-navigation.css",
            "mode": "100644",
            "blob": "7c42357e601b6a9d5093d30bef159d8628cc8539",
            "sha256": "712ebf19faf5303e45d82c55cfc9cda4b3d4156fc0ab759a115a849dbe2efbd6"
          },
          "to": {
            "file": "public/ux-navigation.css",
            "mode": "100644",
            "blob": "3d893dd6ba661e409fc206bda1d8602c9eedc135",
            "sha256": "b47aa884a0bc7d5536ff5741f0678e559d9836fdef3b595607d11416144dc5eb"
          }
        }
      ]
    },
    {
      "file": "public/ux-navigation.js",
      "current": {
        "file": "public/ux-navigation.js",
        "mode": "100644",
        "blob": "26bc7966bdef16f99ae12cf1286e94736c08d8f2",
        "sha256": "1295c1e3bed266ec992726815fe3eae194535cb428904e7b1b993ad2b6af3293"
      },
      "profile": "desk",
      "parent": {
        "file": "public/ux-navigation.js",
        "mode": "100644",
        "blob": "26bc7966bdef16f99ae12cf1286e94736c08d8f2",
        "sha256": "1295c1e3bed266ec992726815fe3eae194535cb428904e7b1b993ad2b6af3293"
      },
      "path": [
        {
          "kind": "noir",
          "from": {
            "file": "public/ux-navigation.js",
            "mode": "100644",
            "blob": "26bc7966bdef16f99ae12cf1286e94736c08d8f2",
            "sha256": "1295c1e3bed266ec992726815fe3eae194535cb428904e7b1b993ad2b6af3293"
          },
          "to": {
            "file": "public/ux-navigation.js",
            "mode": "100644",
            "blob": "4799cee8f4224ca54fd6a7353ac9524d3fae4c31",
            "sha256": "dc3bb19447298cfce5dd2ad471e14cce708df163be0fe4d85dc1d0a76fee748c"
          }
        },
        {
          "kind": "deed",
          "from": {
            "file": "public/ux-navigation.js",
            "mode": "100644",
            "blob": "4799cee8f4224ca54fd6a7353ac9524d3fae4c31",
            "sha256": "dc3bb19447298cfce5dd2ad471e14cce708df163be0fe4d85dc1d0a76fee748c"
          },
          "to": {
            "file": "public/ux-navigation.js",
            "mode": "100644",
            "blob": "023df70d5afcae806c13b025b8af2f06dc0f7601",
            "sha256": "f0a6d8103c77fceb9a2812152cf1df70911577618a199cc87beacafffe35bd3a"
          }
        }
      ]
    },
    {
      "file": "public/ux-progression.css",
      "current": {
        "file": "public/ux-progression.css",
        "mode": "100644",
        "blob": "417b260ee7272b36cf4b01a2d096af2df517b6fc",
        "sha256": "d5e3d1c28b3e8ee60e2a964bb843fdc3c82356955e2fc6f2a9cb2def6066a1ba"
      },
      "profile": "desk",
      "parent": {
        "file": "public/ux-progression.css",
        "mode": "100644",
        "blob": "417b260ee7272b36cf4b01a2d096af2df517b6fc",
        "sha256": "d5e3d1c28b3e8ee60e2a964bb843fdc3c82356955e2fc6f2a9cb2def6066a1ba"
      },
      "path": [
        {
          "kind": "deed",
          "from": {
            "file": "public/ux-progression.css",
            "mode": "100644",
            "blob": "417b260ee7272b36cf4b01a2d096af2df517b6fc",
            "sha256": "d5e3d1c28b3e8ee60e2a964bb843fdc3c82356955e2fc6f2a9cb2def6066a1ba"
          },
          "to": {
            "file": "public/ux-progression.css",
            "mode": "100644",
            "blob": "1a487d3ab5cc5380270fdb94812e7435799a99b2",
            "sha256": "b3f8ddb1bbc31fb2820a5bbc3aea07b0cdc2399f4e0193dfb6105f6a204c1f9d"
          }
        }
      ]
    },
    {
      "file": "public/ux-progression.js",
      "current": {
        "file": "public/ux-progression.js",
        "mode": "100644",
        "blob": "3edc29b7a3ffad2aa721f50cf9725212c04a1e30",
        "sha256": "afa7aea0a043975ec7c8f55639a089196e8abe054d6324aa5bd5ed1654062ec6"
      },
      "profile": "desk",
      "parent": {
        "file": "public/ux-progression.js",
        "mode": "100644",
        "blob": "3edc29b7a3ffad2aa721f50cf9725212c04a1e30",
        "sha256": "afa7aea0a043975ec7c8f55639a089196e8abe054d6324aa5bd5ed1654062ec6"
      },
      "path": [
        {
          "kind": "deed",
          "from": {
            "file": "public/ux-progression.js",
            "mode": "100644",
            "blob": "3edc29b7a3ffad2aa721f50cf9725212c04a1e30",
            "sha256": "afa7aea0a043975ec7c8f55639a089196e8abe054d6324aa5bd5ed1654062ec6"
          },
          "to": {
            "file": "public/ux-progression.js",
            "mode": "100644",
            "blob": "d231ec582491d0deaa6629fb32a75e9c6fc86501",
            "sha256": "4b016e1f713b94e6914b55f8b8da88323b76ce0750bfa90bd17de944636de46b"
          }
        }
      ]
    },
    {
      "file": "public/ux-tactics.css",
      "current": {
        "file": "public/ux-tactics.css",
        "mode": "100644",
        "blob": "ecf50ff3e58aaed57bc7b4da0d1b6eb82dc4604d",
        "sha256": "d4894c313b391e37a65948a1314e0cc44f6db5bcd4f23106da3150d5da2fff6a"
      },
      "profile": "desk",
      "parent": {
        "file": "public/ux-tactics.css",
        "mode": "100644",
        "blob": "ecf50ff3e58aaed57bc7b4da0d1b6eb82dc4604d",
        "sha256": "d4894c313b391e37a65948a1314e0cc44f6db5bcd4f23106da3150d5da2fff6a"
      },
      "path": [
        {
          "kind": "deed",
          "from": {
            "file": "public/ux-tactics.css",
            "mode": "100644",
            "blob": "ecf50ff3e58aaed57bc7b4da0d1b6eb82dc4604d",
            "sha256": "d4894c313b391e37a65948a1314e0cc44f6db5bcd4f23106da3150d5da2fff6a"
          },
          "to": {
            "file": "public/ux-tactics.css",
            "mode": "100644",
            "blob": "09774a4598a055dd3807562cbcc7bd9ffbce0066",
            "sha256": "3dd675c2c1e3f53b22e19d2e9d80e94915f849b56bdd85089995e1452c7544ff"
          }
        }
      ]
    },
    {
      "file": "public/ux-tactics.js",
      "current": {
        "file": "public/ux-tactics.js",
        "mode": "100644",
        "blob": "d68342da70d384a9ce077527c9260a0096f50082",
        "sha256": "a9d9c24792f17dd4e733a238c9b18d0bd83d052975f18e9ec029fcaa1e148bc5"
      },
      "profile": "desk",
      "parent": {
        "file": "public/ux-tactics.js",
        "mode": "100644",
        "blob": "d68342da70d384a9ce077527c9260a0096f50082",
        "sha256": "a9d9c24792f17dd4e733a238c9b18d0bd83d052975f18e9ec029fcaa1e148bc5"
      },
      "path": [
        {
          "kind": "noir",
          "from": {
            "file": "public/ux-tactics.js",
            "mode": "100644",
            "blob": "d68342da70d384a9ce077527c9260a0096f50082",
            "sha256": "a9d9c24792f17dd4e733a238c9b18d0bd83d052975f18e9ec029fcaa1e148bc5"
          },
          "to": {
            "file": "public/ux-tactics.js",
            "mode": "100644",
            "blob": "518d03651cbfa63105dfed2698c1c11d493d8c5d",
            "sha256": "23ee8040bd87b1e1a101d1a5d44193b1486307afbbaa8ff76f04609d9d7683c9"
          }
        },
        {
          "kind": "deed",
          "from": {
            "file": "public/ux-tactics.js",
            "mode": "100644",
            "blob": "518d03651cbfa63105dfed2698c1c11d493d8c5d",
            "sha256": "23ee8040bd87b1e1a101d1a5d44193b1486307afbbaa8ff76f04609d9d7683c9"
          },
          "to": {
            "file": "public/ux-tactics.js",
            "mode": "100644",
            "blob": "a9705b769947558f18be5dfe30d5c05258da9ff8",
            "sha256": "b42132fa716af3649910e3052bb7dc33348dbe31426f3085a38957938cc056ba"
          }
        }
      ]
    },
    {
      "file": "public/ux-world.js",
      "current": {
        "file": "public/ux-world.js",
        "mode": "100644",
        "blob": "cf716e138b196940649fc47a67b73093766246d9",
        "sha256": "e7cd7674ecbf91bfbb7ea012aa59d6b733757de0ad4541276a022b2dbca107ff"
      },
      "profile": "desk",
      "parent": {
        "file": "public/ux-world.js",
        "mode": "100644",
        "blob": "cf716e138b196940649fc47a67b73093766246d9",
        "sha256": "e7cd7674ecbf91bfbb7ea012aa59d6b733757de0ad4541276a022b2dbca107ff"
      },
      "path": [
        {
          "kind": "noir",
          "from": {
            "file": "public/ux-world.js",
            "mode": "100644",
            "blob": "cf716e138b196940649fc47a67b73093766246d9",
            "sha256": "e7cd7674ecbf91bfbb7ea012aa59d6b733757de0ad4541276a022b2dbca107ff"
          },
          "to": {
            "file": "public/ux-world.js",
            "mode": "100644",
            "blob": "b028b333c2a027d371c2126620c00b9664e1cb9d",
            "sha256": "fd3b021e1c8a0e8edb4148a59fc876526eed876922ce22984e1702f6546bb3ee"
          }
        }
      ]
    },
    {
      "file": "public/wiki.html",
      "current": {
        "file": "public/wiki.html",
        "mode": "100644",
        "blob": "5ed291081afb35338a55656fbf7664b4affaae9e",
        "sha256": "2c434d438d9f65e7cdaf27ba4d1526096757ad3a6a63dd8d4df5c6e1d202643b"
      },
      "profile": "wiki",
      "parent": {
        "file": "public/wiki.html",
        "mode": "100644",
        "blob": "5ed291081afb35338a55656fbf7664b4affaae9e",
        "sha256": "2c434d438d9f65e7cdaf27ba4d1526096757ad3a6a63dd8d4df5c6e1d202643b"
      },
      "path": [
        {
          "kind": "wiki-noir-merge",
          "from": {
            "file": "public/wiki.html",
            "mode": "100644",
            "blob": "5ed291081afb35338a55656fbf7664b4affaae9e",
            "sha256": "2c434d438d9f65e7cdaf27ba4d1526096757ad3a6a63dd8d4df5c6e1d202643b"
          },
          "to": {
            "file": "public/wiki.html",
            "mode": "100644",
            "blob": "5ed291081afb35338a55656fbf7664b4affaae9e",
            "sha256": "2c434d438d9f65e7cdaf27ba4d1526096757ad3a6a63dd8d4df5c6e1d202643b"
          }
        },
        {
          "kind": "wiki-merge",
          "from": {
            "file": "public/wiki.html",
            "mode": "100644",
            "blob": "5ed291081afb35338a55656fbf7664b4affaae9e",
            "sha256": "2c434d438d9f65e7cdaf27ba4d1526096757ad3a6a63dd8d4df5c6e1d202643b"
          },
          "to": {
            "file": "public/wiki.html",
            "mode": "100644",
            "blob": "ea7614150f73b9cce28e8d7a8b3330ed922ecf2f",
            "sha256": "9499045fd0c275b439445598b5c009c33fc69a6bbff1a3a5d0f4fea4f2d8890b"
          }
        }
      ]
    },
    {
      "file": "schema.sql",
      "current": {
        "file": "schema.sql",
        "mode": "100755",
        "blob": "a0659f7908061802b87d1c40aa22d4de7e7632c5",
        "sha256": "d8131ea84e1eb6eb186ee42fa722ce13fd0b8b6dd1b056395037d471d09c7fda"
      },
      "profile": "monitor",
      "parent": {
        "file": "schema.sql",
        "mode": "100755",
        "blob": "a0659f7908061802b87d1c40aa22d4de7e7632c5",
        "sha256": "d8131ea84e1eb6eb186ee42fa722ce13fd0b8b6dd1b056395037d471d09c7fda"
      },
      "path": [
        {
          "kind": "monitor56",
          "from": {
            "file": "schema.sql",
            "mode": "100755",
            "blob": "a0659f7908061802b87d1c40aa22d4de7e7632c5",
            "sha256": "d8131ea84e1eb6eb186ee42fa722ce13fd0b8b6dd1b056395037d471d09c7fda"
          },
          "to": {
            "file": "schema.sql",
            "mode": "100755",
            "blob": "9a2605d3d4c6fdcb382184ccc1e1ce12180c3a42",
            "sha256": "b2a337dfaddd06f670774c9bbf2ddebb09c5857a769be598aa54376ea29fa5f7"
          }
        }
      ]
    },
    {
      "file": "src/accrual.js",
      "current": {
        "file": "src/accrual.js",
        "mode": "100644",
        "blob": "86c2bfb96e037455a49643d2dc0a2d3b846f2088",
        "sha256": "9d71503578beaac62e0ae1bcddebf8946f86c949e7ad259ea1fed298646b8d51"
      },
      "profile": "desk",
      "parent": {
        "file": "src/accrual.js",
        "mode": "100644",
        "blob": "86c2bfb96e037455a49643d2dc0a2d3b846f2088",
        "sha256": "9d71503578beaac62e0ae1bcddebf8946f86c949e7ad259ea1fed298646b8d51"
      },
      "path": [
        {
          "kind": "deed",
          "from": {
            "file": "src/accrual.js",
            "mode": "100644",
            "blob": "86c2bfb96e037455a49643d2dc0a2d3b846f2088",
            "sha256": "9d71503578beaac62e0ae1bcddebf8946f86c949e7ad259ea1fed298646b8d51"
          },
          "to": {
            "file": "src/accrual.js",
            "mode": "100644",
            "blob": "46e33a86e875eecc148ae7418923edc00f143f15",
            "sha256": "ff99ed4d9194ce09c32aa5f8811665db13e58703bd7d27210761d96701dcc2cd"
          }
        }
      ]
    },
    {
      "file": "src/age.js",
      "current": {
        "file": "src/age.js",
        "mode": "100644",
        "blob": "94a8b0e92dbb559e79e4d169ac238eaddafca663",
        "sha256": "b3aea51a8cb6b537fdb45ec2fa44aebeb1a0af39bc248c4e2afaee57eb9cf3dd"
      },
      "profile": "desk",
      "parent": {
        "file": "src/age.js",
        "mode": "100644",
        "blob": "94a8b0e92dbb559e79e4d169ac238eaddafca663",
        "sha256": "b3aea51a8cb6b537fdb45ec2fa44aebeb1a0af39bc248c4e2afaee57eb9cf3dd"
      },
      "path": [
        {
          "kind": "deed",
          "from": {
            "file": "src/age.js",
            "mode": "100644",
            "blob": "94a8b0e92dbb559e79e4d169ac238eaddafca663",
            "sha256": "b3aea51a8cb6b537fdb45ec2fa44aebeb1a0af39bc248c4e2afaee57eb9cf3dd"
          },
          "to": {
            "file": "src/age.js",
            "mode": "100644",
            "blob": "314806666a9f590e4755aa50707d40adcfbde0db",
            "sha256": "70aa08ad07eba867d8b4c0fd7ced892e7e1871869c03832295d60ee78331e0ff"
          }
        }
      ]
    },
    {
      "file": "src/content/city-quest-presentation.js",
      "current": {
        "file": "src/content/city-quest-presentation.js",
        "mode": "100644",
        "blob": "57e3fb9dcfd3e9067546feb3ba36b360071ec148",
        "sha256": "7abe9758e99a68dda3f00bd54ad8f4d0b61af3bae844977a69e9dbba58f64515"
      },
      "profile": "desk",
      "parent": {
        "file": "src/content/city-quest-presentation.js",
        "mode": "100644",
        "blob": "57e3fb9dcfd3e9067546feb3ba36b360071ec148",
        "sha256": "7abe9758e99a68dda3f00bd54ad8f4d0b61af3bae844977a69e9dbba58f64515"
      },
      "path": [
        {
          "kind": "deed",
          "from": {
            "file": "src/content/city-quest-presentation.js",
            "mode": "100644",
            "blob": "57e3fb9dcfd3e9067546feb3ba36b360071ec148",
            "sha256": "7abe9758e99a68dda3f00bd54ad8f4d0b61af3bae844977a69e9dbba58f64515"
          },
          "to": {
            "file": "src/content/city-quest-presentation.js",
            "mode": "100644",
            "blob": "3f1d2cfa796bc80e8a881210446fb5cf8f7f5742",
            "sha256": "12acd35f7ec91bc16e2b0e72ffeb17cf0448f7734342f770e123d55a5b17005e"
          }
        }
      ]
    },
    {
      "file": "src/content/phase1-policy.js",
      "current": {
        "file": "src/content/phase1-policy.js",
        "mode": "100644",
        "blob": "31f67a4aa71a61688873d615d08d73dfd0e58895",
        "sha256": "f5d2339a39d856551ddd91dd1ca86a08e00e861348cc70c7f834f8a18f5bc837"
      },
      "profile": "desk",
      "parent": {
        "file": "src/content/phase1-policy.js",
        "mode": "100644",
        "blob": "31f67a4aa71a61688873d615d08d73dfd0e58895",
        "sha256": "f5d2339a39d856551ddd91dd1ca86a08e00e861348cc70c7f834f8a18f5bc837"
      },
      "path": [
        {
          "kind": "deed",
          "from": {
            "file": "src/content/phase1-policy.js",
            "mode": "100644",
            "blob": "31f67a4aa71a61688873d615d08d73dfd0e58895",
            "sha256": "f5d2339a39d856551ddd91dd1ca86a08e00e861348cc70c7f834f8a18f5bc837"
          },
          "to": {
            "file": "src/content/phase1-policy.js",
            "mode": "100644",
            "blob": "9905ac9dcc65ca58073bc0bdfe412c8b4aa97601",
            "sha256": "54fcf367ee3234527faa608d0725fcd3f4b58c646f4164f2264ea79655443ecb"
          }
        }
      ]
    },
    {
      "file": "src/content/phase1.js",
      "current": {
        "file": "src/content/phase1.js",
        "mode": "100644",
        "blob": "90f295bd33959e574bfc835301380e46e6cfb2e7",
        "sha256": "6d8ca127ad60b3e1b2672e5f015568b4b7712488c3ac8be9100f260404cc6c04"
      },
      "profile": "desk",
      "parent": {
        "file": "src/content/phase1.js",
        "mode": "100644",
        "blob": "90f295bd33959e574bfc835301380e46e6cfb2e7",
        "sha256": "6d8ca127ad60b3e1b2672e5f015568b4b7712488c3ac8be9100f260404cc6c04"
      },
      "path": [
        {
          "kind": "deed",
          "from": {
            "file": "src/content/phase1.js",
            "mode": "100644",
            "blob": "90f295bd33959e574bfc835301380e46e6cfb2e7",
            "sha256": "6d8ca127ad60b3e1b2672e5f015568b4b7712488c3ac8be9100f260404cc6c04"
          },
          "to": {
            "file": "src/content/phase1.js",
            "mode": "100644",
            "blob": "410973e7de00da7b7e703d4e0c137319a4bf39a2",
            "sha256": "6d3d5cccc4fbf99ca09ba13906536477651f64b3c8182d7d387cd9be08d8ffcb"
          }
        }
      ]
    },
    {
      "file": "src/db.js",
      "current": {
        "file": "src/db.js",
        "mode": "100644",
        "blob": "71e6a1a28c0347c78296d871f8102f987c85a4d5",
        "sha256": "9d8ef3f15ed9141792679808d791b51dd679daf28f9f70768ba9472d3b84cae4"
      },
      "profile": "desk",
      "parent": {
        "file": "src/db.js",
        "mode": "100644",
        "blob": "71e6a1a28c0347c78296d871f8102f987c85a4d5",
        "sha256": "9d8ef3f15ed9141792679808d791b51dd679daf28f9f70768ba9472d3b84cae4"
      },
      "path": [
        {
          "kind": "deed",
          "from": {
            "file": "src/db.js",
            "mode": "100644",
            "blob": "71e6a1a28c0347c78296d871f8102f987c85a4d5",
            "sha256": "9d8ef3f15ed9141792679808d791b51dd679daf28f9f70768ba9472d3b84cae4"
          },
          "to": {
            "file": "src/db.js",
            "mode": "100644",
            "blob": "5abcd1c874c8b5d9b7cc6739ff7e59f29a808610",
            "sha256": "b81f2db08de8ac9ec4975cb653fd89cbc50e8aeb966726b4ac259f961447ca8c"
          }
        }
      ]
    },
    {
      "file": "src/deedbuildings.js",
      "current": {
        "file": "src/deedbuildings.js",
        "mode": "100644",
        "blob": "17e5cdea02b729a06c637ab88c597b33e2c7fccf",
        "sha256": "0b2218069df93d0b9920ead93d3b92b46534b4b650ad2e4fc28dc0b64ca48206"
      },
      "profile": "desk",
      "parent": {
        "file": "src/deedbuildings.js",
        "mode": "100644",
        "blob": "17e5cdea02b729a06c637ab88c597b33e2c7fccf",
        "sha256": "0b2218069df93d0b9920ead93d3b92b46534b4b650ad2e4fc28dc0b64ca48206"
      },
      "path": [
        {
          "kind": "deed",
          "from": {
            "file": "src/deedbuildings.js",
            "mode": "100644",
            "blob": "17e5cdea02b729a06c637ab88c597b33e2c7fccf",
            "sha256": "0b2218069df93d0b9920ead93d3b92b46534b4b650ad2e4fc28dc0b64ca48206"
          },
          "to": {
            "file": "src/deedbuildings.js",
            "mode": "100644",
            "blob": "91ec9c496dd6afc9c83f6d0a5fd02b272eed6bb5",
            "sha256": "1184d5d65bd00733cb545bae6d6b3c7ad527eaa3910a5a9abe8de8227b8867ca"
          }
        }
      ]
    },
    {
      "file": "src/deeddiscovery.js",
      "current": {
        "file": "src/deeddiscovery.js",
        "mode": "100644",
        "blob": "fdcd944422cf3ea24b107d9efc0e17974c60fa6c",
        "sha256": "88638a873d6dc482011a3aa626047f9b416e7b035dcd456d99f1aa32aa80909c"
      },
      "profile": "desk",
      "parent": {
        "file": "src/deeddiscovery.js",
        "mode": "100644",
        "blob": "fdcd944422cf3ea24b107d9efc0e17974c60fa6c",
        "sha256": "88638a873d6dc482011a3aa626047f9b416e7b035dcd456d99f1aa32aa80909c"
      },
      "path": [
        {
          "kind": "deed",
          "from": {
            "file": "src/deeddiscovery.js",
            "mode": "100644",
            "blob": "fdcd944422cf3ea24b107d9efc0e17974c60fa6c",
            "sha256": "88638a873d6dc482011a3aa626047f9b416e7b035dcd456d99f1aa32aa80909c"
          },
          "to": {
            "file": "src/deeddiscovery.js",
            "mode": "100644",
            "blob": "d9fcb6eb5e79aeb3abb111bfad805539fc6c7c80",
            "sha256": "a01913ebe30b3fcf71be85de38cf712db726f479e64c7058a3f823ea1c1524f0"
          }
        }
      ]
    },
    {
      "file": "src/deeds.js",
      "current": {
        "file": "src/deeds.js",
        "mode": "100644",
        "blob": "3bef65b9bc4245f65646895559a4e0cbd0ebe3c7",
        "sha256": "cc773c26fdb76d98223c272221a7ada8da384ab2e22e5ec1664f405470ed2011"
      },
      "profile": "desk",
      "parent": {
        "file": "src/deeds.js",
        "mode": "100644",
        "blob": "3bef65b9bc4245f65646895559a4e0cbd0ebe3c7",
        "sha256": "cc773c26fdb76d98223c272221a7ada8da384ab2e22e5ec1664f405470ed2011"
      },
      "path": [
        {
          "kind": "deed",
          "from": {
            "file": "src/deeds.js",
            "mode": "100644",
            "blob": "3bef65b9bc4245f65646895559a4e0cbd0ebe3c7",
            "sha256": "cc773c26fdb76d98223c272221a7ada8da384ab2e22e5ec1664f405470ed2011"
          },
          "to": {
            "file": "src/deeds.js",
            "mode": "100644",
            "blob": "9f7f1fab401d195fb192005d3164dcfd6c55a73c",
            "sha256": "edf542f5cfc596358964283cfcafc7eaa8f66fee2ed81edb901c53dcd4d0b0fa"
          }
        }
      ]
    },
    {
      "file": "src/engagement.js",
      "current": {
        "file": "src/engagement.js",
        "mode": "100644",
        "blob": "3fc2773c44cd32dcd970c470fcfcc941dcd73b00",
        "sha256": "9dd0e49b49bc2403ed7dca6b5bb6dffb953c36fcb056dadcf6207219ef725b63"
      },
      "profile": "monitor",
      "parent": {
        "file": "src/engagement.js",
        "mode": "100644",
        "blob": "3fc2773c44cd32dcd970c470fcfcc941dcd73b00",
        "sha256": "9dd0e49b49bc2403ed7dca6b5bb6dffb953c36fcb056dadcf6207219ef725b63"
      },
      "path": [
        {
          "kind": "monitor56",
          "from": {
            "file": "src/engagement.js",
            "mode": "100644",
            "blob": "3fc2773c44cd32dcd970c470fcfcc941dcd73b00",
            "sha256": "9dd0e49b49bc2403ed7dca6b5bb6dffb953c36fcb056dadcf6207219ef725b63"
          },
          "to": {
            "file": "src/engagement.js",
            "mode": "100644",
            "blob": "c7f1d2521ca4afc974aed7d5504c09b75a8c6270",
            "sha256": "d8166dc243fd0ff54322a4da048436566182fba76d098b865215d68db69c1356"
          }
        }
      ]
    },
    {
      "file": "src/game.js",
      "current": {
        "file": "src/game.js",
        "mode": "100644",
        "blob": "b879627d63b592354183384a161e8ddcb670830e",
        "sha256": "9bde6b2f4213cc034a0dbb02fd05fb49cda106f006aab629214442fee0439e5d"
      },
      "profile": "monitor",
      "parent": {
        "file": "src/game.js",
        "mode": "100644",
        "blob": "b879627d63b592354183384a161e8ddcb670830e",
        "sha256": "9bde6b2f4213cc034a0dbb02fd05fb49cda106f006aab629214442fee0439e5d"
      },
      "path": [
        {
          "kind": "monitor56",
          "from": {
            "file": "src/game.js",
            "mode": "100644",
            "blob": "b879627d63b592354183384a161e8ddcb670830e",
            "sha256": "9bde6b2f4213cc034a0dbb02fd05fb49cda106f006aab629214442fee0439e5d"
          },
          "to": {
            "file": "src/game.js",
            "mode": "100644",
            "blob": "947046030354529e41b509cb5229147ce466bee5",
            "sha256": "7b2d6a8feaebbf77988afde846565b0a01b0e7a7f11dd83403b73841f1c246f2"
          }
        }
      ]
    },
    {
      "file": "src/invariants.js",
      "current": {
        "file": "src/invariants.js",
        "mode": "100644",
        "blob": "42715dd4c1f23a0a57a1b8567249968cdd2a6aec",
        "sha256": "c800b02d492e9068ad68c50607061685a6d2b00e5850b733239eee0549264a67"
      },
      "profile": "monitor",
      "parent": {
        "file": "src/invariants.js",
        "mode": "100644",
        "blob": "42715dd4c1f23a0a57a1b8567249968cdd2a6aec",
        "sha256": "c800b02d492e9068ad68c50607061685a6d2b00e5850b733239eee0549264a67"
      },
      "path": [
        {
          "kind": "monitor56",
          "from": {
            "file": "src/invariants.js",
            "mode": "100644",
            "blob": "42715dd4c1f23a0a57a1b8567249968cdd2a6aec",
            "sha256": "c800b02d492e9068ad68c50607061685a6d2b00e5850b733239eee0549264a67"
          },
          "to": {
            "file": "src/invariants.js",
            "mode": "100644",
            "blob": "b0dcabcd1589cb914860fc629f69aff856507e82",
            "sha256": "e75cc63ff714f0bd9169fea5d4d8171a61b8812bdd82f24f648bdbbe9b09e168"
          }
        }
      ]
    },
    {
      "file": "src/legal.js",
      "current": {
        "file": "src/legal.js",
        "mode": "100644",
        "blob": "1f9241475697b532c572bdd1ca21e20e4e1f788a",
        "sha256": "a9d8138f0efe8deb268468af19c8c92e82b5401dc9975ab988ddae3a320b487c"
      },
      "profile": "desk",
      "parent": {
        "file": "src/legal.js",
        "mode": "100644",
        "blob": "1f9241475697b532c572bdd1ca21e20e4e1f788a",
        "sha256": "a9d8138f0efe8deb268468af19c8c92e82b5401dc9975ab988ddae3a320b487c"
      },
      "path": [
        {
          "kind": "deed",
          "from": {
            "file": "src/legal.js",
            "mode": "100644",
            "blob": "1f9241475697b532c572bdd1ca21e20e4e1f788a",
            "sha256": "a9d8138f0efe8deb268468af19c8c92e82b5401dc9975ab988ddae3a320b487c"
          },
          "to": {
            "file": "src/legal.js",
            "mode": "100644",
            "blob": "70942fdd7dfd2848988280ffdfdd70a760197ec8",
            "sha256": "cc9d56d27c0630d67dc2cdc1d53a8ff3fc294d7e2faa86a49a1fe1d15b1fa9b6"
          }
        }
      ]
    },
    {
      "file": "src/preflight.js",
      "current": {
        "file": "src/preflight.js",
        "mode": "100644",
        "blob": "3f020b59416c6edd9f63ac5753510377088105fa",
        "sha256": "ec03b2586d2a816b02a66a8128ca396ec4dae829fbeadb8557d29c364e892a80"
      },
      "profile": "monitor",
      "parent": {
        "file": "src/preflight.js",
        "mode": "100644",
        "blob": "3f020b59416c6edd9f63ac5753510377088105fa",
        "sha256": "ec03b2586d2a816b02a66a8128ca396ec4dae829fbeadb8557d29c364e892a80"
      },
      "path": [
        {
          "kind": "monitor56",
          "from": {
            "file": "src/preflight.js",
            "mode": "100644",
            "blob": "3f020b59416c6edd9f63ac5753510377088105fa",
            "sha256": "ec03b2586d2a816b02a66a8128ca396ec4dae829fbeadb8557d29c364e892a80"
          },
          "to": {
            "file": "src/preflight.js",
            "mode": "100644",
            "blob": "ac3ba92249dbcebe7cfde910d2276373b15eb845",
            "sha256": "4901dca23d457a6c0dc56c6ca72371162200235de7287ec449363584f74286ea"
          }
        }
      ]
    },
    {
      "file": "src/server.js",
      "current": {
        "file": "src/server.js",
        "mode": "100644",
        "blob": "29f49b5fe55e976590ebd536bccdcf80c8e59462",
        "sha256": "10bdc7c9188178b2244cac50832f7c57413905577da678cc12a30bc95948d030"
      },
      "profile": "desk",
      "parent": {
        "file": "src/server.js",
        "mode": "100644",
        "blob": "281c1f4613eb8605db791bbecccb49779cdfa5dc",
        "sha256": "3a3b9dcf20f73e8cb4585661c5993b05c27e35d8e1ecf4072fcc972f9d19923e"
      },
      "path": [
        {
          "kind": "combined-source",
          "from": {
            "file": "src/server.js",
            "mode": "100644",
            "blob": "29f49b5fe55e976590ebd536bccdcf80c8e59462",
            "sha256": "10bdc7c9188178b2244cac50832f7c57413905577da678cc12a30bc95948d030"
          },
          "to": {
            "file": "src/server.js",
            "mode": "100644",
            "blob": "281c1f4613eb8605db791bbecccb49779cdfa5dc",
            "sha256": "3a3b9dcf20f73e8cb4585661c5993b05c27e35d8e1ecf4072fcc972f9d19923e"
          }
        },
        {
          "kind": "business",
          "from": {
            "file": "src/server.js",
            "mode": "100644",
            "blob": "281c1f4613eb8605db791bbecccb49779cdfa5dc",
            "sha256": "3a3b9dcf20f73e8cb4585661c5993b05c27e35d8e1ecf4072fcc972f9d19923e"
          },
          "to": {
            "file": "src/server.js",
            "mode": "100644",
            "blob": "9ac86b5b025e3a40f0142f8adf855471e8a21e77",
            "sha256": "eae571fecd106622365194b2fd862f54635a9488ea9784d660defa292da28b5a"
          }
        },
        {
          "kind": "deed",
          "from": {
            "file": "src/server.js",
            "mode": "100644",
            "blob": "9ac86b5b025e3a40f0142f8adf855471e8a21e77",
            "sha256": "eae571fecd106622365194b2fd862f54635a9488ea9784d660defa292da28b5a"
          },
          "to": {
            "file": "src/server.js",
            "mode": "100644",
            "blob": "98be176eb2d676e3eaa1992da787c76cb15acb00",
            "sha256": "f0fba7a89de112aa2c85e61955cd2b36eb6387605f46696ef1290d442d14615e"
          }
        }
      ]
    },
    {
      "file": "src/ux-story.js",
      "current": {
        "file": "src/ux-story.js",
        "mode": "100644",
        "blob": "d8f3e023d4aa929f918540ee2e36afa2b95b7b70",
        "sha256": "5b91648482dd363abfa4adfb32e622f272f0efe668ad294c19ec4058d4a3c2fc"
      },
      "profile": "desk",
      "parent": {
        "file": "src/ux-story.js",
        "mode": "100644",
        "blob": "d8f3e023d4aa929f918540ee2e36afa2b95b7b70",
        "sha256": "5b91648482dd363abfa4adfb32e622f272f0efe668ad294c19ec4058d4a3c2fc"
      },
      "path": [
        {
          "kind": "deed",
          "from": {
            "file": "src/ux-story.js",
            "mode": "100644",
            "blob": "d8f3e023d4aa929f918540ee2e36afa2b95b7b70",
            "sha256": "5b91648482dd363abfa4adfb32e622f272f0efe668ad294c19ec4058d4a3c2fc"
          },
          "to": {
            "file": "src/ux-story.js",
            "mode": "100644",
            "blob": "120c6413d8700f6d6f2fdbd59235e4a9096a6c1a",
            "sha256": "a7becb7b78c09e03524f81472e2ce36bcff3e5795748aa51f6e6594fe85e7a69"
          }
        }
      ]
    },
    {
      "file": "src/ux-tactics.js",
      "current": {
        "file": "src/ux-tactics.js",
        "mode": "100644",
        "blob": "84f8a92eff7c02e071041016c13b9c1ef2cd13bd",
        "sha256": "c92cfabb6f5786aa4e8656afbe9e3b51a8ce30ca67546ca2c71ffef7d9d44850"
      },
      "profile": "desk",
      "parent": {
        "file": "src/ux-tactics.js",
        "mode": "100644",
        "blob": "84f8a92eff7c02e071041016c13b9c1ef2cd13bd",
        "sha256": "c92cfabb6f5786aa4e8656afbe9e3b51a8ce30ca67546ca2c71ffef7d9d44850"
      },
      "path": [
        {
          "kind": "deed",
          "from": {
            "file": "src/ux-tactics.js",
            "mode": "100644",
            "blob": "84f8a92eff7c02e071041016c13b9c1ef2cd13bd",
            "sha256": "c92cfabb6f5786aa4e8656afbe9e3b51a8ce30ca67546ca2c71ffef7d9d44850"
          },
          "to": {
            "file": "src/ux-tactics.js",
            "mode": "100644",
            "blob": "386bb613e49c788cbffb7330181cbbe94e97b9b1",
            "sha256": "1d15b503c1fffe911b34cab76bf99a34b5dcf9b7332ee505775dd792eed57917"
          }
        }
      ]
    },
    {
      "file": "src/worker.js",
      "current": {
        "file": "src/worker.js",
        "mode": "100644",
        "blob": "6e0eb2656fb6c815908ddf722a4e8a89dc75f3d2",
        "sha256": "8461ccc60c86ccadcda3c2820a9026f8eadacebdd201355f23b09e4b646f38f9"
      },
      "profile": "monitor",
      "parent": {
        "file": "src/worker.js",
        "mode": "100644",
        "blob": "6e0eb2656fb6c815908ddf722a4e8a89dc75f3d2",
        "sha256": "8461ccc60c86ccadcda3c2820a9026f8eadacebdd201355f23b09e4b646f38f9"
      },
      "path": [
        {
          "kind": "monitor56",
          "from": {
            "file": "src/worker.js",
            "mode": "100644",
            "blob": "6e0eb2656fb6c815908ddf722a4e8a89dc75f3d2",
            "sha256": "8461ccc60c86ccadcda3c2820a9026f8eadacebdd201355f23b09e4b646f38f9"
          },
          "to": {
            "file": "src/worker.js",
            "mode": "100644",
            "blob": "84be99e513a7a66343f0652a55fdc6d885d8687a",
            "sha256": "2a07dc2ac6740ffa9495b08f807d4cae591e0e7c8cc50da3f2746f9b6eaf0329"
          }
        }
      ]
    },
    {
      "file": "src/worldgraph-ui.js",
      "current": {
        "file": "src/worldgraph-ui.js",
        "mode": "100644",
        "blob": "e3cd96e43401fc571d5dd63baf55a4514c9b5519",
        "sha256": "b4d09ff8d26efe2d4871f4eaacdf720571de609ea71d48f3f675059790e0975f"
      },
      "profile": "desk",
      "parent": {
        "file": "src/worldgraph-ui.js",
        "mode": "100644",
        "blob": "e3cd96e43401fc571d5dd63baf55a4514c9b5519",
        "sha256": "b4d09ff8d26efe2d4871f4eaacdf720571de609ea71d48f3f675059790e0975f"
      },
      "path": [
        {
          "kind": "deed",
          "from": {
            "file": "src/worldgraph-ui.js",
            "mode": "100644",
            "blob": "e3cd96e43401fc571d5dd63baf55a4514c9b5519",
            "sha256": "b4d09ff8d26efe2d4871f4eaacdf720571de609ea71d48f3f675059790e0975f"
          },
          "to": {
            "file": "src/worldgraph-ui.js",
            "mode": "100644",
            "blob": "9bf9f7ae2573efca5a0f8505b0a5da28d87a9675",
            "sha256": "b8bb33c5ec1e8f45a12eb9d68fbaeab6dd95e999e06ae8e481f99201d4759829"
          }
        }
      ]
    },
    {
      "file": "test/client.js",
      "current": {
        "file": "test/client.js",
        "mode": "100644",
        "blob": "dd27c8809894ed3f68545db1a334f46a64eb207b",
        "sha256": "b815589854b57a62565bec7a565a6b434d85e9d0e295c48fdab97b26dd46e54b"
      },
      "profile": "monitor",
      "parent": {
        "file": "test/client.js",
        "mode": "100644",
        "blob": "ad69814b477d75266455a7948af2709ffc9ff960",
        "sha256": "cdc566ec4b3878894f48995589549668fcb5bc5d31328f630a83236549a685ac"
      },
      "path": [
        {
          "kind": "combined-source",
          "from": {
            "file": "test/client.js",
            "mode": "100644",
            "blob": "dd27c8809894ed3f68545db1a334f46a64eb207b",
            "sha256": "b815589854b57a62565bec7a565a6b434d85e9d0e295c48fdab97b26dd46e54b"
          },
          "to": {
            "file": "test/client.js",
            "mode": "100644",
            "blob": "ad69814b477d75266455a7948af2709ffc9ff960",
            "sha256": "cdc566ec4b3878894f48995589549668fcb5bc5d31328f630a83236549a685ac"
          }
        },
        {
          "kind": "monitor56",
          "from": {
            "file": "test/client.js",
            "mode": "100644",
            "blob": "ad69814b477d75266455a7948af2709ffc9ff960",
            "sha256": "cdc566ec4b3878894f48995589549668fcb5bc5d31328f630a83236549a685ac"
          },
          "to": {
            "file": "test/client.js",
            "mode": "100644",
            "blob": "9042c603a35b5f6c3dd82f54fae03f64c3bd42ff",
            "sha256": "fe807783ec2f55b263e4a7d72a65aaed28c2216e6dd05a9177cdb1e25cc2a5aa"
          }
        }
      ]
    },
    {
      "file": "test/commerce-current-native-guard.js",
      "current": {
        "file": "test/commerce-current-native-guard.js",
        "mode": "100644",
        "blob": "66e2d720b9ab85a8adb9d6db01f5603315080e48",
        "sha256": "b5e9bf5a3c503efd14bd9a217aff4738ec1153003c4ddb204a8d8ff62e0eeb1d"
      },
      "profile": "desk",
      "parent": {
        "file": "test/commerce-current-native-guard.js",
        "mode": "100644",
        "blob": "66e2d720b9ab85a8adb9d6db01f5603315080e48",
        "sha256": "b5e9bf5a3c503efd14bd9a217aff4738ec1153003c4ddb204a8d8ff62e0eeb1d"
      },
      "path": [
        {
          "kind": "deed",
          "from": {
            "file": "test/commerce-current-native-guard.js",
            "mode": "100644",
            "blob": "66e2d720b9ab85a8adb9d6db01f5603315080e48",
            "sha256": "b5e9bf5a3c503efd14bd9a217aff4738ec1153003c4ddb204a8d8ff62e0eeb1d"
          },
          "to": {
            "file": "test/commerce-current-native-guard.js",
            "mode": "100644",
            "blob": "d65b113be14e50a542f65c0488c5147c6d39fa2c",
            "sha256": "5bdcde68d956b588d66996a7a73f6f25deacaecf47c445676a3259d7275b71ba"
          }
        }
      ]
    },
    {
      "file": "test/companyworkflows.js",
      "current": {
        "file": "test/companyworkflows.js",
        "mode": "100644",
        "blob": "baa76230ebab75e8163e7701358c3f2f24fad4eb",
        "sha256": "f5d377b7abbbb5155515df198113849ee333f316e55acdd36e84f53b83273121"
      },
      "profile": "desk",
      "parent": {
        "file": "test/companyworkflows.js",
        "mode": "100644",
        "blob": "baa76230ebab75e8163e7701358c3f2f24fad4eb",
        "sha256": "f5d377b7abbbb5155515df198113849ee333f316e55acdd36e84f53b83273121"
      },
      "path": [
        {
          "kind": "deed",
          "from": {
            "file": "test/companyworkflows.js",
            "mode": "100644",
            "blob": "baa76230ebab75e8163e7701358c3f2f24fad4eb",
            "sha256": "f5d377b7abbbb5155515df198113849ee333f316e55acdd36e84f53b83273121"
          },
          "to": {
            "file": "test/companyworkflows.js",
            "mode": "100644",
            "blob": "0784e59969f23d5be86a8e87196a23cea618cd6b",
            "sha256": "6d6a265517ab729a24ae7b5f7ff72164f030be74f1674308ba02b08b3eadbec6"
          }
        }
      ]
    },
    {
      "file": "test/decision-guide-client.js",
      "current": {
        "file": "test/decision-guide-client.js",
        "mode": "100644",
        "blob": "ce8a155c44a155d44ab0083eeb72dfb8dd1b9334",
        "sha256": "c0fd97f43f32661e74a2101f5858b866cc236f4d288c7f5c849ef03e268b5e01"
      },
      "profile": "monitor",
      "parent": {
        "file": "test/decision-guide-client.js",
        "mode": "100644",
        "blob": "ce8a155c44a155d44ab0083eeb72dfb8dd1b9334",
        "sha256": "c0fd97f43f32661e74a2101f5858b866cc236f4d288c7f5c849ef03e268b5e01"
      },
      "path": [
        {
          "kind": "monitor56",
          "from": {
            "file": "test/decision-guide-client.js",
            "mode": "100644",
            "blob": "ce8a155c44a155d44ab0083eeb72dfb8dd1b9334",
            "sha256": "c0fd97f43f32661e74a2101f5858b866cc236f4d288c7f5c849ef03e268b5e01"
          },
          "to": {
            "file": "test/decision-guide-client.js",
            "mode": "100644",
            "blob": "a54d80d37241834e29f793169e694f329bf179c3",
            "sha256": "b540d98b574eb60807be621feeb72564c3df8a51a2fc545703a306ddf47a7001"
          }
        }
      ]
    },
    {
      "file": "test/director-migration.js",
      "current": {
        "file": "test/director-migration.js",
        "mode": "100644",
        "blob": "f7280d01e195f14d82c63972b16a26880ac367de",
        "sha256": "5ce0b994c9a0e6f2eec4b39964136bbba4af11a72d1e943a6af2830be23548cd"
      },
      "profile": "desk",
      "parent": {
        "file": "test/director-migration.js",
        "mode": "100644",
        "blob": "f7280d01e195f14d82c63972b16a26880ac367de",
        "sha256": "5ce0b994c9a0e6f2eec4b39964136bbba4af11a72d1e943a6af2830be23548cd"
      },
      "path": [
        {
          "kind": "deed",
          "from": {
            "file": "test/director-migration.js",
            "mode": "100644",
            "blob": "f7280d01e195f14d82c63972b16a26880ac367de",
            "sha256": "5ce0b994c9a0e6f2eec4b39964136bbba4af11a72d1e943a6af2830be23548cd"
          },
          "to": {
            "file": "test/director-migration.js",
            "mode": "100644",
            "blob": "d614abcc16118a444e3d6835c6bd72fa9256bf69",
            "sha256": "b250fe40588ac1c6e6fc3bec727694c526af71654410974ebe728bbd5b65cc36"
          }
        }
      ]
    },
    {
      "file": "test/gates.js",
      "current": {
        "file": "test/gates.js",
        "mode": "100644",
        "blob": "32efa3f2b7b6162558c097d97a656bcc1382dce4",
        "sha256": "6e7cb10cd85f776bc814dca12e68b70ccebe3b5bba4a0ea39b3ba2c9aa58814a"
      },
      "profile": "desk",
      "parent": {
        "file": "test/gates.js",
        "mode": "100644",
        "blob": "e888027098cf347e101ce4cad66f0e2687ecbbda",
        "sha256": "f6bc6f1c2a6a4e8d6d4cef09fa4b23a122d52a41e6f727dc7e59343b587d40dc"
      },
      "path": [
        {
          "kind": "combined-source",
          "from": {
            "file": "test/gates.js",
            "mode": "100644",
            "blob": "32efa3f2b7b6162558c097d97a656bcc1382dce4",
            "sha256": "6e7cb10cd85f776bc814dca12e68b70ccebe3b5bba4a0ea39b3ba2c9aa58814a"
          },
          "to": {
            "file": "test/gates.js",
            "mode": "100644",
            "blob": "e888027098cf347e101ce4cad66f0e2687ecbbda",
            "sha256": "f6bc6f1c2a6a4e8d6d4cef09fa4b23a122d52a41e6f727dc7e59343b587d40dc"
          }
        },
        {
          "kind": "business",
          "from": {
            "file": "test/gates.js",
            "mode": "100644",
            "blob": "e888027098cf347e101ce4cad66f0e2687ecbbda",
            "sha256": "f6bc6f1c2a6a4e8d6d4cef09fa4b23a122d52a41e6f727dc7e59343b587d40dc"
          },
          "to": {
            "file": "test/gates.js",
            "mode": "100644",
            "blob": "238e7a38313f54fd09d82df4dedb9a574f04243d",
            "sha256": "727b8cfba27ab2b1a69dedaa43aa5d289a09d91aeb27be5f66e87d744f1f4a12"
          }
        }
      ]
    },
    {
      "file": "test/lib/enterprise-ux-native-guard.js",
      "current": {
        "file": "test/lib/enterprise-ux-native-guard.js",
        "mode": "100644",
        "blob": "f4a6c3232a9332b0803d13926b6ac54026f34776",
        "sha256": "189fba3ce57bae50e2365d953a32781856c063b27e10267586d76e04fe30e8a1"
      },
      "profile": "desk",
      "parent": {
        "file": "test/lib/enterprise-ux-native-guard.js",
        "mode": "100644",
        "blob": "315556816a37a7580955752d9d39bf23439e7709",
        "sha256": "9e81dc83ad060c9dd8b520467a5498563d90e1774621bbad63424281f967d798"
      },
      "path": [
        {
          "kind": "combined-source",
          "from": {
            "file": "test/lib/enterprise-ux-native-guard.js",
            "mode": "100644",
            "blob": "f4a6c3232a9332b0803d13926b6ac54026f34776",
            "sha256": "189fba3ce57bae50e2365d953a32781856c063b27e10267586d76e04fe30e8a1"
          },
          "to": {
            "file": "test/lib/enterprise-ux-native-guard.js",
            "mode": "100644",
            "blob": "315556816a37a7580955752d9d39bf23439e7709",
            "sha256": "9e81dc83ad060c9dd8b520467a5498563d90e1774621bbad63424281f967d798"
          }
        },
        {
          "kind": "business",
          "from": {
            "file": "test/lib/enterprise-ux-native-guard.js",
            "mode": "100644",
            "blob": "315556816a37a7580955752d9d39bf23439e7709",
            "sha256": "9e81dc83ad060c9dd8b520467a5498563d90e1774621bbad63424281f967d798"
          },
          "to": {
            "file": "test/lib/enterprise-ux-native-guard.js",
            "mode": "100644",
            "blob": "dca55c5abc1c733552c9177b3dfc9c17c3d55887",
            "sha256": "82c978c98c833a44dd5250f64e0d3fe09992c9806690e14f812a229992ce2b97"
          }
        },
        {
          "kind": "deed",
          "from": {
            "file": "test/lib/enterprise-ux-native-guard.js",
            "mode": "100644",
            "blob": "dca55c5abc1c733552c9177b3dfc9c17c3d55887",
            "sha256": "82c978c98c833a44dd5250f64e0d3fe09992c9806690e14f812a229992ce2b97"
          },
          "to": {
            "file": "test/lib/enterprise-ux-native-guard.js",
            "mode": "100644",
            "blob": "94e4ecab922b3e867d1f045b06bbaf660f184f2e",
            "sha256": "0f56601338664284990e833531c55467cd5871cfa2df7063a74c9ec64f35eb67"
          }
        }
      ]
    },
    {
      "file": "test/lib/phase2-definition-fixtures.js",
      "current": {
        "file": "test/lib/phase2-definition-fixtures.js",
        "mode": "100644",
        "blob": "d7f1009811df95cd640c40d8ca6734fecc188300",
        "sha256": "5cebc42f838dc74d967da17c17842d90c26857ada505fd59f75d08517d5c7fa3"
      },
      "profile": "desk",
      "parent": {
        "file": "test/lib/phase2-definition-fixtures.js",
        "mode": "100644",
        "blob": "d7f1009811df95cd640c40d8ca6734fecc188300",
        "sha256": "5cebc42f838dc74d967da17c17842d90c26857ada505fd59f75d08517d5c7fa3"
      },
      "path": [
        {
          "kind": "deed",
          "from": {
            "file": "test/lib/phase2-definition-fixtures.js",
            "mode": "100644",
            "blob": "d7f1009811df95cd640c40d8ca6734fecc188300",
            "sha256": "5cebc42f838dc74d967da17c17842d90c26857ada505fd59f75d08517d5c7fa3"
          },
          "to": {
            "file": "test/lib/phase2-definition-fixtures.js",
            "mode": "100644",
            "blob": "7e2d24c68cf92f1ffccf40f724e6a87abfa56c51",
            "sha256": "6a4caefad045583ec40f83b1dc7167a996d1f6d192dbf2fd5a48487dc5b45ff5"
          }
        }
      ]
    },
    {
      "file": "test/lib/player-command-support.js",
      "current": {
        "file": "test/lib/player-command-support.js",
        "mode": "100644",
        "blob": "b2a797622dd08345ded80885dfaadceb7d91155e",
        "sha256": "a8ef16abc4e2cec361e44acbe79ca4f4ef6fd51bf7a0b7773a63e39c7b149e0f"
      },
      "profile": "desk",
      "parent": {
        "file": "test/lib/player-command-support.js",
        "mode": "100644",
        "blob": "b2a797622dd08345ded80885dfaadceb7d91155e",
        "sha256": "a8ef16abc4e2cec361e44acbe79ca4f4ef6fd51bf7a0b7773a63e39c7b149e0f"
      },
      "path": [
        {
          "kind": "deed",
          "from": {
            "file": "test/lib/player-command-support.js",
            "mode": "100644",
            "blob": "b2a797622dd08345ded80885dfaadceb7d91155e",
            "sha256": "a8ef16abc4e2cec361e44acbe79ca4f4ef6fd51bf7a0b7773a63e39c7b149e0f"
          },
          "to": {
            "file": "test/lib/player-command-support.js",
            "mode": "100644",
            "blob": "64ea82dc7260db453a4ed25c8eca04deec33ae31",
            "sha256": "01ee09a0805a10ccc742e36b1e525d72a8c482940e1600e0a468c8ad749efdc5"
          }
        }
      ]
    },
    {
      "file": "test/lib/ux-native-director-guard.js",
      "current": {
        "file": "test/lib/ux-native-director-guard.js",
        "mode": "100644",
        "blob": "e8b55aef3a18d32dd217d5b06656c5a9df5af066",
        "sha256": "1cce2f6aaf303737644338f0220dccfb6276c62747023b758cb34fa37774f952"
      },
      "profile": "monitor",
      "parent": {
        "file": "test/lib/ux-native-director-guard.js",
        "mode": "100644",
        "blob": "e8b55aef3a18d32dd217d5b06656c5a9df5af066",
        "sha256": "1cce2f6aaf303737644338f0220dccfb6276c62747023b758cb34fa37774f952"
      },
      "path": [
        {
          "kind": "monitor56",
          "from": {
            "file": "test/lib/ux-native-director-guard.js",
            "mode": "100644",
            "blob": "e8b55aef3a18d32dd217d5b06656c5a9df5af066",
            "sha256": "1cce2f6aaf303737644338f0220dccfb6276c62747023b758cb34fa37774f952"
          },
          "to": {
            "file": "test/lib/ux-native-director-guard.js",
            "mode": "100644",
            "blob": "374bdf171b7555225b6e777c05af16331f7e38e4",
            "sha256": "9c61586bea0737dbfc3f55f2577e432fdbe8fc1448c59c47f982ac523efd2dde"
          }
        }
      ]
    },
    {
      "file": "test/lib/ux-native-reader-source-compatibility.js",
      "current": {
        "file": "test/lib/ux-native-reader-source-compatibility.js",
        "mode": "100644",
        "blob": "038a24c8b576d48c6488cb3b1a82b657f4b06eb5",
        "sha256": "adcb7b00b41486e4cccb5f58424558c7f4313becdb47da519d95385e2ba9bbea"
      },
      "profile": "wiki",
      "parent": {
        "file": "test/lib/ux-native-reader-source-compatibility.js",
        "mode": "100644",
        "blob": "d7b4359feff515ed5595508b180e7afc018c4fb8",
        "sha256": "8b64f2af3bf9c5019f517728f30205c006a112412f2bd3be70059ba1d81f543d"
      },
      "path": [
        {
          "kind": "combined-source",
          "from": {
            "file": "test/lib/ux-native-reader-source-compatibility.js",
            "mode": "100644",
            "blob": "038a24c8b576d48c6488cb3b1a82b657f4b06eb5",
            "sha256": "adcb7b00b41486e4cccb5f58424558c7f4313becdb47da519d95385e2ba9bbea"
          },
          "to": {
            "file": "test/lib/ux-native-reader-source-compatibility.js",
            "mode": "100644",
            "blob": "d7b4359feff515ed5595508b180e7afc018c4fb8",
            "sha256": "8b64f2af3bf9c5019f517728f30205c006a112412f2bd3be70059ba1d81f543d"
          }
        },
        {
          "kind": "wiki-noir-merge",
          "from": {
            "file": "test/lib/ux-native-reader-source-compatibility.js",
            "mode": "100644",
            "blob": "d7b4359feff515ed5595508b180e7afc018c4fb8",
            "sha256": "8b64f2af3bf9c5019f517728f30205c006a112412f2bd3be70059ba1d81f543d"
          },
          "to": {
            "file": "test/lib/ux-native-reader-source-compatibility.js",
            "mode": "100644",
            "blob": "388aa65e5bab0a0798d4e46a11a015a49a5177b7",
            "sha256": "0b11683de7e4b63f5cea12976890e8bb98fe574f14cdc6c8356ef9a3fb5da2ba"
          }
        },
        {
          "kind": "wiki-merge",
          "from": {
            "file": "test/lib/ux-native-reader-source-compatibility.js",
            "mode": "100644",
            "blob": "388aa65e5bab0a0798d4e46a11a015a49a5177b7",
            "sha256": "0b11683de7e4b63f5cea12976890e8bb98fe574f14cdc6c8356ef9a3fb5da2ba"
          },
          "to": {
            "file": "test/lib/ux-native-reader-source-compatibility.js",
            "mode": "100644",
            "blob": "d2154925f5de67b0bc06e0c25f132140cb1d025e",
            "sha256": "907a349ae898c7b7b6541cf06eb68f50de54d2474c883ced62f5e6919a2d0f1d"
          }
        },
        {
          "kind": "deed",
          "from": {
            "file": "test/lib/ux-native-reader-source-compatibility.js",
            "mode": "100644",
            "blob": "d2154925f5de67b0bc06e0c25f132140cb1d025e",
            "sha256": "907a349ae898c7b7b6541cf06eb68f50de54d2474c883ced62f5e6919a2d0f1d"
          },
          "to": {
            "file": "test/lib/ux-native-reader-source-compatibility.js",
            "mode": "100644",
            "blob": "a983314da61b23e61a8f2263e3c338201a1f572d",
            "sha256": "bfeb64c42f056a2c7e556fb9e079faded5a5cb8f9785e428e8dd40a4194bce61"
          }
        }
      ]
    },
    {
      "file": "test/sale-source-compatibility.js",
      "current": {
        "file": "test/sale-source-compatibility.js",
        "mode": "100644",
        "blob": "9d3de35cedac17863c7e80589f68f73936d23131",
        "sha256": "9eb278519625e3ff8bc91e7b43ad3948f9dcffea56227021a8ae6949f4c36808"
      },
      "profile": "wiki",
      "parent": {
        "file": "test/sale-source-compatibility.js",
        "mode": "100644",
        "blob": "5488c9390de8302880b13c2b5e3978b181984b8d",
        "sha256": "48ff5b31a4f7a15f8cb17afe135950803f482baad2a839ad775c38085cb2c986"
      },
      "path": [
        {
          "kind": "combined-source",
          "from": {
            "file": "test/sale-source-compatibility.js",
            "mode": "100644",
            "blob": "9d3de35cedac17863c7e80589f68f73936d23131",
            "sha256": "9eb278519625e3ff8bc91e7b43ad3948f9dcffea56227021a8ae6949f4c36808"
          },
          "to": {
            "file": "test/sale-source-compatibility.js",
            "mode": "100644",
            "blob": "5488c9390de8302880b13c2b5e3978b181984b8d",
            "sha256": "48ff5b31a4f7a15f8cb17afe135950803f482baad2a839ad775c38085cb2c986"
          }
        },
        {
          "kind": "wiki-noir-merge",
          "from": {
            "file": "test/sale-source-compatibility.js",
            "mode": "100644",
            "blob": "5488c9390de8302880b13c2b5e3978b181984b8d",
            "sha256": "48ff5b31a4f7a15f8cb17afe135950803f482baad2a839ad775c38085cb2c986"
          },
          "to": {
            "file": "test/sale-source-compatibility.js",
            "mode": "100644",
            "blob": "5488c9390de8302880b13c2b5e3978b181984b8d",
            "sha256": "48ff5b31a4f7a15f8cb17afe135950803f482baad2a839ad775c38085cb2c986"
          }
        },
        {
          "kind": "wiki-merge",
          "from": {
            "file": "test/sale-source-compatibility.js",
            "mode": "100644",
            "blob": "5488c9390de8302880b13c2b5e3978b181984b8d",
            "sha256": "48ff5b31a4f7a15f8cb17afe135950803f482baad2a839ad775c38085cb2c986"
          },
          "to": {
            "file": "test/sale-source-compatibility.js",
            "mode": "100644",
            "blob": "b0f0c53d6d15d95ac3a2c27966c8aa23c5fc466a",
            "sha256": "30ab4aeee8d601dc44928d80321b7f9b757b94e4674e35342d6e2f44aa030eed"
          }
        },
        {
          "kind": "deed",
          "from": {
            "file": "test/sale-source-compatibility.js",
            "mode": "100644",
            "blob": "b0f0c53d6d15d95ac3a2c27966c8aa23c5fc466a",
            "sha256": "30ab4aeee8d601dc44928d80321b7f9b757b94e4674e35342d6e2f44aa030eed"
          },
          "to": {
            "file": "test/sale-source-compatibility.js",
            "mode": "100644",
            "blob": "6b8e9c0d281ded00ce4833d346189145ec25967f",
            "sha256": "219cd4e6682ec5d0340e15effb6f207722b002d20bfb504be4175e6049264525"
          }
        }
      ]
    },
    {
      "file": "test/ux-source-compatibility.js",
      "current": {
        "file": "test/ux-source-compatibility.js",
        "mode": "100644",
        "blob": "0e0ace196c4845a2b5a5c57dd5e215932ecc6654",
        "sha256": "144648a26a9126e899a8cebd6f04419492538ab39b572f16dfa3caa6305db42d"
      },
      "profile": "desk",
      "parent": {
        "file": "test/ux-source-compatibility.js",
        "mode": "100644",
        "blob": "0e0ace196c4845a2b5a5c57dd5e215932ecc6654",
        "sha256": "144648a26a9126e899a8cebd6f04419492538ab39b572f16dfa3caa6305db42d"
      },
      "path": [
        {
          "kind": "deed",
          "from": {
            "file": "test/ux-source-compatibility.js",
            "mode": "100644",
            "blob": "0e0ace196c4845a2b5a5c57dd5e215932ecc6654",
            "sha256": "144648a26a9126e899a8cebd6f04419492538ab39b572f16dfa3caa6305db42d"
          },
          "to": {
            "file": "test/ux-source-compatibility.js",
            "mode": "100644",
            "blob": "d37ee22044e7314521df4f0b327e922084fa217f",
            "sha256": "9c64ace981c024f013f9328f8d41608d35dedc80cd00275c603f073a03bf728d"
          }
        }
      ]
    },
    {
      "file": "test/worldgraph-validation.js",
      "current": {
        "file": "test/worldgraph-validation.js",
        "mode": "100644",
        "blob": "c73f08efbd515a6dbb4037de18a1b63defb6be4e",
        "sha256": "3c5db55fc8f1cb0fe42e2750661ff1084d42e96aa21efe0cace570b825aa7f8f"
      },
      "profile": "desk",
      "parent": {
        "file": "test/worldgraph-validation.js",
        "mode": "100644",
        "blob": "c73f08efbd515a6dbb4037de18a1b63defb6be4e",
        "sha256": "3c5db55fc8f1cb0fe42e2750661ff1084d42e96aa21efe0cace570b825aa7f8f"
      },
      "path": [
        {
          "kind": "deed",
          "from": {
            "file": "test/worldgraph-validation.js",
            "mode": "100644",
            "blob": "c73f08efbd515a6dbb4037de18a1b63defb6be4e",
            "sha256": "3c5db55fc8f1cb0fe42e2750661ff1084d42e96aa21efe0cace570b825aa7f8f"
          },
          "to": {
            "file": "test/worldgraph-validation.js",
            "mode": "100644",
            "blob": "0f5272b41cb138775276a3bc25ad368cec7d8126",
            "sha256": "f6b5dc19d1b3b7beca45baa87e5a698dc8d958d5e93de3ac7e58de7fe48abe17"
          }
        }
      ]
    },
    {
      "file": "tools/commerce-current-native-guard.js",
      "current": {
        "file": "tools/commerce-current-native-guard.js",
        "mode": "100644",
        "blob": "8efe89f46026e25746402bd22a860583b46a7b83",
        "sha256": "657998557ad14fec8ec120db4f5943c99f68ab16c27022a64d604cb82304e213"
      },
      "profile": "desk",
      "parent": {
        "file": "tools/commerce-current-native-guard.js",
        "mode": "100644",
        "blob": "8efe89f46026e25746402bd22a860583b46a7b83",
        "sha256": "657998557ad14fec8ec120db4f5943c99f68ab16c27022a64d604cb82304e213"
      },
      "path": [
        {
          "kind": "deed",
          "from": {
            "file": "tools/commerce-current-native-guard.js",
            "mode": "100644",
            "blob": "8efe89f46026e25746402bd22a860583b46a7b83",
            "sha256": "657998557ad14fec8ec120db4f5943c99f68ab16c27022a64d604cb82304e213"
          },
          "to": {
            "file": "tools/commerce-current-native-guard.js",
            "mode": "100644",
            "blob": "7864e8407579d67db4c60e7a89dec2f569df02d3",
            "sha256": "df114c17bc1c172ed356c1d2c595eea31b42f4df378f797c93144fae89b7b305"
          }
        }
      ]
    },
    {
      "file": "tools/economy-social-proof-cutover-source-transfer.js",
      "current": {
        "file": "tools/economy-social-proof-cutover-source-transfer.js",
        "mode": "100644",
        "blob": "eda6b7ddd8b98ea9128c2366e951fd61594ce685",
        "sha256": "ced0f7e2d85330965e548921fa8a75985b7160dc095ba3720a05a2ec10afee89"
      },
      "profile": "wiki",
      "parent": {
        "file": "tools/economy-social-proof-cutover-source-transfer.js",
        "mode": "100644",
        "blob": "eda6b7ddd8b98ea9128c2366e951fd61594ce685",
        "sha256": "ced0f7e2d85330965e548921fa8a75985b7160dc095ba3720a05a2ec10afee89"
      },
      "path": [
        {
          "kind": "wiki-noir-merge",
          "from": {
            "file": "tools/economy-social-proof-cutover-source-transfer.js",
            "mode": "100644",
            "blob": "eda6b7ddd8b98ea9128c2366e951fd61594ce685",
            "sha256": "ced0f7e2d85330965e548921fa8a75985b7160dc095ba3720a05a2ec10afee89"
          },
          "to": {
            "file": "tools/economy-social-proof-cutover-source-transfer.js",
            "mode": "100644",
            "blob": "eda6b7ddd8b98ea9128c2366e951fd61594ce685",
            "sha256": "ced0f7e2d85330965e548921fa8a75985b7160dc095ba3720a05a2ec10afee89"
          }
        },
        {
          "kind": "wiki-merge",
          "from": {
            "file": "tools/economy-social-proof-cutover-source-transfer.js",
            "mode": "100644",
            "blob": "eda6b7ddd8b98ea9128c2366e951fd61594ce685",
            "sha256": "ced0f7e2d85330965e548921fa8a75985b7160dc095ba3720a05a2ec10afee89"
          },
          "to": {
            "file": "tools/economy-social-proof-cutover-source-transfer.js",
            "mode": "100644",
            "blob": "52a30c077f91e457cfda2841db138dc7228efff7",
            "sha256": "9bab44afc155bc8ae98722a69fecc5fedff3b37d585fce1dc6b9c19fb3bde94c"
          }
        }
      ]
    },
    {
      "file": "tools/economy-ux-merge-source-compatibility.js",
      "current": {
        "file": "tools/economy-ux-merge-source-compatibility.js",
        "mode": "100644",
        "blob": "4c1aef1eb0e7cc54c5d13f7677d3d108ead329d1",
        "sha256": "4a42f8a56fb4944849061579390f5f8f835be54ecec1281b59f51037f6f687e7"
      },
      "profile": "monitor",
      "parent": {
        "file": "tools/economy-ux-merge-source-compatibility.js",
        "mode": "100644",
        "blob": "3e51216a70882421a3ae93553dd10befbd5b453c",
        "sha256": "42698fc0941bff85d18a2ba6618582d51d87dd45ea5d308b0a7b91421f5e0d2e"
      },
      "path": [
        {
          "kind": "combined-source",
          "from": {
            "file": "tools/economy-ux-merge-source-compatibility.js",
            "mode": "100644",
            "blob": "4c1aef1eb0e7cc54c5d13f7677d3d108ead329d1",
            "sha256": "4a42f8a56fb4944849061579390f5f8f835be54ecec1281b59f51037f6f687e7"
          },
          "to": {
            "file": "tools/economy-ux-merge-source-compatibility.js",
            "mode": "100644",
            "blob": "3e51216a70882421a3ae93553dd10befbd5b453c",
            "sha256": "42698fc0941bff85d18a2ba6618582d51d87dd45ea5d308b0a7b91421f5e0d2e"
          }
        },
        {
          "kind": "monitor56",
          "from": {
            "file": "tools/economy-ux-merge-source-compatibility.js",
            "mode": "100644",
            "blob": "3e51216a70882421a3ae93553dd10befbd5b453c",
            "sha256": "42698fc0941bff85d18a2ba6618582d51d87dd45ea5d308b0a7b91421f5e0d2e"
          },
          "to": {
            "file": "tools/economy-ux-merge-source-compatibility.js",
            "mode": "100644",
            "blob": "3771af6b4e45f589a7838d33ea90dcf5cbc9c52d",
            "sha256": "c027cdf11599511a20ebca0ae57eb5c65f523e4b79df2a0ac8f7b185bef5d60e"
          }
        }
      ]
    },
    {
      "file": "tools/enterprise-native-ux-seal.js",
      "current": {
        "file": "tools/enterprise-native-ux-seal.js",
        "mode": "100644",
        "blob": "e0f8aacab1014963b15ecd3d6cab45babb1caeee",
        "sha256": "a5d0ef6841f72a517d91f52b5aeb5ed361b596d862c52825c0407c2fe4e22dff"
      },
      "profile": "desk",
      "parent": {
        "file": "tools/enterprise-native-ux-seal.js",
        "mode": "100644",
        "blob": "0b6cfd6b5b9c83de0032075b8e1b45f097e5d839",
        "sha256": "ac8f9e926584226b2b9a3b8b884787860917d1940a1f7fadb18b62d2b1bba014"
      },
      "path": [
        {
          "kind": "combined-source",
          "from": {
            "file": "tools/enterprise-native-ux-seal.js",
            "mode": "100644",
            "blob": "e0f8aacab1014963b15ecd3d6cab45babb1caeee",
            "sha256": "a5d0ef6841f72a517d91f52b5aeb5ed361b596d862c52825c0407c2fe4e22dff"
          },
          "to": {
            "file": "tools/enterprise-native-ux-seal.js",
            "mode": "100644",
            "blob": "0b6cfd6b5b9c83de0032075b8e1b45f097e5d839",
            "sha256": "ac8f9e926584226b2b9a3b8b884787860917d1940a1f7fadb18b62d2b1bba014"
          }
        },
        {
          "kind": "business",
          "from": {
            "file": "tools/enterprise-native-ux-seal.js",
            "mode": "100644",
            "blob": "0b6cfd6b5b9c83de0032075b8e1b45f097e5d839",
            "sha256": "ac8f9e926584226b2b9a3b8b884787860917d1940a1f7fadb18b62d2b1bba014"
          },
          "to": {
            "file": "tools/enterprise-native-ux-seal.js",
            "mode": "100644",
            "blob": "e92bc4c2f7b57a28be315e760ef5ec199b9172ef",
            "sha256": "2a96e83125ce88e884165ef6672d9d175b6e8e092c41a078a6a256776b959b4b"
          }
        },
        {
          "kind": "deed",
          "from": {
            "file": "tools/enterprise-native-ux-seal.js",
            "mode": "100644",
            "blob": "e92bc4c2f7b57a28be315e760ef5ec199b9172ef",
            "sha256": "2a96e83125ce88e884165ef6672d9d175b6e8e092c41a078a6a256776b959b4b"
          },
          "to": {
            "file": "tools/enterprise-native-ux-seal.js",
            "mode": "100644",
            "blob": "5bdf43a3c48e98557ac6eb49487b56e20130ce2b",
            "sha256": "68019afc0554efaa273c9a008d06dd353b670d88adb6d45fc79c90ed611295c4"
          }
        }
      ]
    },
    {
      "file": "tools/enterprise-native-ux.js",
      "current": {
        "file": "tools/enterprise-native-ux.js",
        "mode": "100644",
        "blob": "0ad8d9cdfc247f7df7e0feb63fa6c5ae258924f5",
        "sha256": "af3cc87d05c9053ada09ef4957f547639dd1536b5dbb55eee64096c1807048ea"
      },
      "profile": "desk",
      "parent": {
        "file": "tools/enterprise-native-ux.js",
        "mode": "100644",
        "blob": "59d9e3b9e36470442502dfd45ef3dc67336e7aeb",
        "sha256": "c8cf7be2363e23dcd2eb4d9aa75327700ce5c2a4f228ccd2a695de6c02cd038e"
      },
      "path": [
        {
          "kind": "combined-source",
          "from": {
            "file": "tools/enterprise-native-ux.js",
            "mode": "100644",
            "blob": "0ad8d9cdfc247f7df7e0feb63fa6c5ae258924f5",
            "sha256": "af3cc87d05c9053ada09ef4957f547639dd1536b5dbb55eee64096c1807048ea"
          },
          "to": {
            "file": "tools/enterprise-native-ux.js",
            "mode": "100644",
            "blob": "59d9e3b9e36470442502dfd45ef3dc67336e7aeb",
            "sha256": "c8cf7be2363e23dcd2eb4d9aa75327700ce5c2a4f228ccd2a695de6c02cd038e"
          }
        },
        {
          "kind": "business",
          "from": {
            "file": "tools/enterprise-native-ux.js",
            "mode": "100644",
            "blob": "59d9e3b9e36470442502dfd45ef3dc67336e7aeb",
            "sha256": "c8cf7be2363e23dcd2eb4d9aa75327700ce5c2a4f228ccd2a695de6c02cd038e"
          },
          "to": {
            "file": "tools/enterprise-native-ux.js",
            "mode": "100644",
            "blob": "cfc8df57c2f6afe1dde3b02a5ec63191baea469a",
            "sha256": "ac538474d4fa502d69f5abd3a202deef1ae13b7f435082deda514b7f0fd5cd49"
          }
        },
        {
          "kind": "deed",
          "from": {
            "file": "tools/enterprise-native-ux.js",
            "mode": "100644",
            "blob": "cfc8df57c2f6afe1dde3b02a5ec63191baea469a",
            "sha256": "ac538474d4fa502d69f5abd3a202deef1ae13b7f435082deda514b7f0fd5cd49"
          },
          "to": {
            "file": "tools/enterprise-native-ux.js",
            "mode": "100644",
            "blob": "c86362d86bcd653428a83ab3c3e4d6df27d5c69d",
            "sha256": "7c4912e7c713e2f920447233f4e51d5d57706eb00a5b520c597725b55c1666f3"
          }
        }
      ]
    },
    {
      "file": "tools/enterprise-native.js",
      "current": {
        "file": "tools/enterprise-native.js",
        "mode": "100644",
        "blob": "c2c4d0393840d7048046989dec643c4f07746c6e",
        "sha256": "e75e51b8f04badbecf819c15f50f4b0c36dcfd52e3710e851acd962014818868"
      },
      "profile": "monitor",
      "parent": {
        "file": "tools/enterprise-native.js",
        "mode": "100644",
        "blob": "c2c4d0393840d7048046989dec643c4f07746c6e",
        "sha256": "e75e51b8f04badbecf819c15f50f4b0c36dcfd52e3710e851acd962014818868"
      },
      "path": [
        {
          "kind": "monitor56",
          "from": {
            "file": "tools/enterprise-native.js",
            "mode": "100644",
            "blob": "c2c4d0393840d7048046989dec643c4f07746c6e",
            "sha256": "e75e51b8f04badbecf819c15f50f4b0c36dcfd52e3710e851acd962014818868"
          },
          "to": {
            "file": "tools/enterprise-native.js",
            "mode": "100644",
            "blob": "5eb580ee6c27e3b1d9938b4829f97da1221dcca2",
            "sha256": "12b218541f988366ae91c570ec4a05bf18e5a717d9afcda7e8bc1f825e7888d4"
          }
        }
      ]
    },
    {
      "file": "tools/pgquery.js",
      "current": {
        "file": "tools/pgquery.js",
        "mode": "100644",
        "blob": "40f24c96132606a3ffa4986790ed00606a702089",
        "sha256": "9d5ced1d591ab0d5328b686a0f1f0b5937148c721b626c73b6cebf5833a861c6"
      },
      "profile": "monitor",
      "parent": {
        "file": "tools/pgquery.js",
        "mode": "100644",
        "blob": "40f24c96132606a3ffa4986790ed00606a702089",
        "sha256": "9d5ced1d591ab0d5328b686a0f1f0b5937148c721b626c73b6cebf5833a861c6"
      },
      "path": [
        {
          "kind": "monitor56",
          "from": {
            "file": "tools/pgquery.js",
            "mode": "100644",
            "blob": "40f24c96132606a3ffa4986790ed00606a702089",
            "sha256": "9d5ced1d591ab0d5328b686a0f1f0b5937148c721b626c73b6cebf5833a861c6"
          },
          "to": {
            "file": "tools/pgquery.js",
            "mode": "100644",
            "blob": "db503b17b08439bcbd36aacc4deae0b8a1907c53",
            "sha256": "ed8d93ce2c634c861af924270ea77b26ab77d3e5e34a3d7cb24e84d06540d311"
          }
        }
      ]
    },
    {
      "file": "tools/ux-release-phase2-native-catalog.js",
      "current": {
        "file": "tools/ux-release-phase2-native-catalog.js",
        "mode": "100644",
        "blob": "9627018aedc2700e1cd4a9dc06a3a9c0c100d87d",
        "sha256": "d59e8b81c8ce0ac2caeb3301d164914a4d7a452b3a2b1103060017c08878eb7b"
      },
      "profile": "monitor",
      "parent": {
        "file": "tools/ux-release-phase2-native-catalog.js",
        "mode": "100644",
        "blob": "9627018aedc2700e1cd4a9dc06a3a9c0c100d87d",
        "sha256": "d59e8b81c8ce0ac2caeb3301d164914a4d7a452b3a2b1103060017c08878eb7b"
      },
      "path": [
        {
          "kind": "monitor56",
          "from": {
            "file": "tools/ux-release-phase2-native-catalog.js",
            "mode": "100644",
            "blob": "9627018aedc2700e1cd4a9dc06a3a9c0c100d87d",
            "sha256": "d59e8b81c8ce0ac2caeb3301d164914a4d7a452b3a2b1103060017c08878eb7b"
          },
          "to": {
            "file": "tools/ux-release-phase2-native-catalog.js",
            "mode": "100644",
            "blob": "38dc31de8b9d30cdfd359b6bf8f5cfa02ad1925e",
            "sha256": "4c122b2439ef19868259a0b6dbc7cb29d4539c6098ef7e5289703c32d1687fd9"
          }
        }
      ]
    },
    {
      "file": "tools/ux-source-compatibility.js",
      "current": {
        "file": "tools/ux-source-compatibility.js",
        "mode": "100644",
        "blob": "064bc4f3bbb8933f7a4d152d371711c45a68ad90",
        "sha256": "cf9ea1c334631561259caf857c16847146a76d225e8641b17d9e19e04158bd68"
      },
      "profile": "desk",
      "parent": {
        "file": "tools/ux-source-compatibility.js",
        "mode": "100644",
        "blob": "064bc4f3bbb8933f7a4d152d371711c45a68ad90",
        "sha256": "cf9ea1c334631561259caf857c16847146a76d225e8641b17d9e19e04158bd68"
      },
      "path": [
        {
          "kind": "deed",
          "from": {
            "file": "tools/ux-source-compatibility.js",
            "mode": "100644",
            "blob": "064bc4f3bbb8933f7a4d152d371711c45a68ad90",
            "sha256": "cf9ea1c334631561259caf857c16847146a76d225e8641b17d9e19e04158bd68"
          },
          "to": {
            "file": "tools/ux-source-compatibility.js",
            "mode": "100644",
            "blob": "510ec979b9e83221cf6a7dd2045b08e2f0419d6a",
            "sha256": "7d4652ef370a10daf52c59a40d5e9435bf4b3aeb71f717da9a21371bcab37096"
          }
        }
      ]
    }
  ],
  "sourceOnly": true,
  "nativeAdmission": false,
  "priorResultsTransferred": false
});
export const BUSINESS_DESK_COMBINED_NATIVE_SHA256="5b16acf1f90ab60f64f6441f3544a418cd66f36a70fa0acf1daae86d6012288a";
