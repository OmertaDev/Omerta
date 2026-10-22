// Actual immutable C input-union proposal; no native/final/physical admission.
export const ENTERPRISE_NATIVE_BASE_REVISION="181422abe5312e24be5bd76ec56fe87454bda664";
export const ENTERPRISE_NATIVE_FILES=Object.freeze([
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
  "tools/commerce-current-enterprise-source-data.js"
]);
export const ENTERPRISE_NATIVE_BASE_INPUTS=Object.freeze([
  {
    "file": ".github/workflows/ci.yml",
    "blob": "93697530172cae664b7554df63eb3d06595b8271",
    "sha256": "17df90e3724126eabf0215fe9e88d281ca8f9a2210aa8159c89abbf0a28ecdb3"
  },
  {
    "file": ".github/workflows/forge.yml",
    "blob": "828eae651e5c92596bc829fb3e1890ff63a6c098",
    "sha256": "f70fa7613f13d4f7e38d19abb30fd5fc65cb42c41dba2f366d083223a6914710"
  },
  {
    "file": ".github/workflows/knowledge-refresh.yml",
    "blob": "6da7207c1f317ad2acd29a800668c95ecb13646b",
    "sha256": "9f69a2bdcc367e79d94490ae344bc8d0d982d8e50c5717360759685ea38fcc9a"
  },
  {
    "file": ".github/workflows/liquidity-postgres.yml",
    "blob": "2d5e73429cb36cc04d7e7f689832ed85824d8c5c",
    "sha256": "99dfa0d41348f501ae37a50f8fda5dda508acc047f34d5009ac7190e2068aaba"
  },
  {
    "file": ".github/workflows/publish-mcp.yml",
    "blob": "10d8e88f099ad65ade7b476200e51a747078f92d",
    "sha256": "d01aa97b451cbcca23bd7914703de28e0d929135f93e016f75e6faa241a6bee5"
  },
  {
    "file": ".github/workflows/rc1-recovery.yml",
    "blob": "1d577ae7b345f805de6dd3ec01df02f852fb4fef",
    "sha256": "4ede05206ff26a361966cbbe411a970fc70694fc1cec318d8daa6ab795eaaa90"
  },
  {
    "file": "AGENTS.md",
    "blob": "9d7a3b61336d8950d164aec695cb3ac82cc221a7",
    "sha256": "1aa9290c76468c11ec0f41940d5589871fa9246d830e2be64ab9345c7ba80a24"
  },
  {
    "file": "content/README.md",
    "blob": "e9e53de6656f47c4cd36949fa1a1e7862e6c601a",
    "sha256": "541021e47170c07de3789b0fa564e4e47d3a567c6a5c291401edb7afa5eb9fe9"
  },
  {
    "file": "content/packs/bad-batch/pack.json",
    "blob": "7b274de6d31e01a0b75fcfba732c6d96fb235d0a",
    "sha256": "458f3153a31bad1470b43ae339713e6ad6954fa89fc7a342e61854a59499085b"
  },
  {
    "file": "content/packs/bellini-lockbox-v2/pack.json",
    "blob": "7c616ee1cfc0875af0b62fdea582d5ab8a1931b9",
    "sha256": "213bcfb35cd0e5b6b93f95b089ca95dd80c80c6fca54c10a7566ba7e2c33494d"
  },
  {
    "file": "content/packs/bellini-lockbox-v3/pack.json",
    "blob": "29209a94e43c3c787c2dc7f73467081770618d2f",
    "sha256": "e0470968f01a930b23a3c5b3e3e84f06f2f11a6d4295aa0eafbe797e960fa11c"
  },
  {
    "file": "content/packs/bellini-lockbox-v4/pack.json",
    "blob": "0f7d825275ee5dbe583301edf3cf144c7d59c328",
    "sha256": "d15f601fda4b91b605e16b5ad7257411470fef3989a2692bca727ddde0ffa2fa"
  },
  {
    "file": "content/packs/bellini-lockbox/pack.json",
    "blob": "0af4d609874b1dce591c6fa6dbcfd5fdab2fc720",
    "sha256": "6cd4b17d641c8860e13754b5098f5a7ac1b4ba1768bbf915ae86bac9b8a2f991"
  },
  {
    "file": "content/packs/black-ice/pack.json",
    "blob": "dcca9b58c417718b5729d138932acf033a4922ca",
    "sha256": "9b72e337d36abff3772e0ea2cebcd121c6b07807ce84ecf69650d776b677ef5f"
  },
  {
    "file": "content/packs/books-open-at-midnight/pack.json",
    "blob": "f1d70466bd600119f92db90b63f0d91a5971a1b9",
    "sha256": "53835640f71ddf880ccde2e99945927bcccf2f5cd15372fed2aab8bd78721f3f"
  },
  {
    "file": "content/packs/brick-last-kiln/pack.json",
    "blob": "1ec75a41b69847184f3ce1121b79661775dc0c99",
    "sha256": "2f710f4b6e2fa5555c40d8e5c43e8572e9b74fb38ea648ca0cc46e4e1d33a4b8"
  },
  {
    "file": "content/packs/canal-water-cellar/pack.json",
    "blob": "87efa850092bb4ae969d92ad3b056fbcb6f8f50f",
    "sha256": "3ee435cf708322c01645409d6be2b20695f8b121789b9edc9bac4ab43d842d9f"
  },
  {
    "file": "content/packs/cathedral-saints-account/pack.json",
    "blob": "034393d0d6d223ac801a4f6e6a3ef17d8c6e80eb",
    "sha256": "be453b600823b049ed68df6168f3c34a225695b59a655ee3448f83f26456aee1"
  },
  {
    "file": "content/packs/docks-missed-tide/pack.json",
    "blob": "16d31ba5c4a2a030e54f70f5768595d6f69f8632",
    "sha256": "7fd039373ed13a7e47aaf5490869dfa3db9f7c40558b2357b26d9ddd82515e2b"
  },
  {
    "file": "content/packs/don-of-the-city/pack.json",
    "blob": "0255924c27e31b33b688872881d11e9e306ff48c",
    "sha256": "37052360b8db415a47042ecf4326c5957f9a6e3465e9f7dfee8d45f06f57ddfc"
  },
  {
    "file": "content/packs/empty-seat/pack.json",
    "blob": "dd3400b1221719f4a9dfc36009e323ec7f30625b",
    "sha256": "8d4fd28d342de07a9534d7027121e2974947537ff881cfa2694b9fdf810df7ce"
  },
  {
    "file": "content/packs/federal-ledger/pack.json",
    "blob": "8162ce4dea7a0f319f58e4fa5473ae68f4f9b617",
    "sha256": "b3d19097b57096bf3340a944bafc133a6541bd746b181ac92799ba60e47f7315"
  },
  {
    "file": "content/packs/foundry-furnace-ledger/pack.json",
    "blob": "9d9a43684c725600d487dc62dea9c73f4498f69d",
    "sha256": "58a1b86124250f872cb63c8dad6c2e4f0d35676a969d816c03e45fdb15686218"
  },
  {
    "file": "content/packs/hostile-books/pack.json",
    "blob": "4c637775f63ab02c5a79ca36d3ae9460fdd63620",
    "sha256": "14f3d15cc8ad9b4c31ca5fbcd1e9f9ca4a3b37767cb825d661b2bee812bac1c3"
  },
  {
    "file": "content/packs/house-made-of-glass/pack.json",
    "blob": "bc6aae9566ec61dc7c8e1f13615bd0d3e800c77d",
    "sha256": "46695cb3fb3f366b978848bd934c4d6ef6bffc15c552f40ec7f23c49ecec2809"
  },
  {
    "file": "content/packs/iron-election/pack.json",
    "blob": "acaa210ec97140562e70d19512b589c5c22520ae",
    "sha256": "f9631f901edbe85a1e26dc18a3ada602c08a3f7ed8554ca87275d811719ef1e9"
  },
  {
    "file": "content/packs/last-clean-contract/pack.json",
    "blob": "8f0667d09b6356f0319c1c41e4ddc5a0820fed18",
    "sha256": "1a14b351864d0d2eeb12d5fddfd0ec461e9e71614a0daf828da29eb730fa74f0"
  },
  {
    "file": "content/packs/neon-house-lights/pack.json",
    "blob": "f961dcf2979ea1be2e99cffe8974dc0ef1b9079e",
    "sha256": "62a9a5b500ec0cb24c4a71b8f9f59d69a6f6aef7dee826ce22263920d7da6691"
  },
  {
    "file": "content/packs/nobody-saw-him-leave/pack.json",
    "blob": "ce2c2ca26306e35b9d65198cf9939c433cb5292e",
    "sha256": "adb0b785847776914c8e9adb9f5bbbf862d30808879b29fd7e9e3a43ab14a218"
  },
  {
    "file": "content/packs/port-no-return/pack.json",
    "blob": "906978d80f798b227a74c04115d15cc5fc236f12",
    "sha256": "2c39988978ccdc2143a3f9eeb8aa395185da987e82b6cc8a6ddae1c0f82c12a3"
  },
  {
    "file": "content/packs/sixth-chair-v2/pack.json",
    "blob": "347f44d2455da30c16150ea8fbaa0fd72121c48d",
    "sha256": "6f70740b8718521d4f0e876827d19b700b5feb1230bef0e0518ec92160d5baa7"
  },
  {
    "file": "content/packs/sixth-chair/pack.json",
    "blob": "3acbd85ef06ed8904be7c1c6779814a38ec4572f",
    "sha256": "513acb49bf3281168c14582c005caa639739c0c2cdcf961c7fad3b85c33c5dca"
  },
  {
    "file": "content/packs/twelve-rounds/pack.json",
    "blob": "c9b64490ecd5ef0a192faf6f36c1462df2c9eba5",
    "sha256": "86e5024ec3e51d3fd495416063fcf6db1cab6e3b854626ef42db4a8208ccdb4d"
  },
  {
    "file": "content/packs/two-funerals/pack.json",
    "blob": "bd04860589b8748aaaeef3ebaee13e6d9f79fcce",
    "sha256": "dd6d1629bcd273efdfda5e898f77af39b3f69facc38d9714df1297160fb57af1"
  },
  {
    "file": "content/packs/two-man-rule/pack.json",
    "blob": "162e22cca623a9f199d4d4a4cc4df2b95eb4afdd",
    "sha256": "7e22a37bad9685e10dac732bfc7f62ee1f7ec2a202e28e7e0848c1b118256b3c"
  },
  {
    "file": "docs/business-relocation-proposal.sql",
    "blob": "06727d4cd5edbf7a7ce5aff556071d75b15ca2f0",
    "sha256": "f91107cf2a844c6291a5ce67ad4c3d046e17ec50e8400dccdec1d6e29f2886c0"
  },
  {
    "file": "docs/cross-docking-proposal.sql",
    "blob": "3bb318e3e060b4ad719c9e1728009c06f1a9fcd1",
    "sha256": "154af471737f04f2c4eb9244bcb761f35e51905a51f1cc6bb952e4636067d1b4"
  },
  {
    "file": "docs/cross-docking-security-review.md",
    "blob": "06d875095dffc8d8ec79aa01e6dd98beb3ead926",
    "sha256": "0b898d6b32d3c38c52f9f76de9d8a5cb878c3b72a8dd26497a5ceac23da70391"
  },
  {
    "file": "docs/decision-replay-integration.json",
    "blob": "2316deafd2d4c4ee98506339c4e62a63f98ab62b",
    "sha256": "dc1d909de638efc5443d6c62f05de1be7364713e770f5a8d77d1536dcb4626d6"
  },
  {
    "file": "docs/economic-dependency-map-integration.json",
    "blob": "51d39d266301a44c823457e7b3234a4de5cc9c7c",
    "sha256": "043a7ff68b8c2b77246454d0cf594927ec6237e53ccd6fb4544fdfa435cbbde4"
  },
  {
    "file": "docs/equipment-recovery-authored-proposal.mjs",
    "blob": "c4b31f27205f33bb489bbb6a093e22dd6963cc50",
    "sha256": "b14cb81d66664839440c0ca378c12f1945f983187f727956101685710c0259d1"
  },
  {
    "file": "docs/manufacturing-license-proposal.sql",
    "blob": "3d49a91580a0e9c7eae5ec3762f6287c90848044",
    "sha256": "b7fe57aff25b8aad36208a664ee67074ffb7ff6f7aa24456b98cbab42376de43"
  },
  {
    "file": "docs/merchant-returns-security-review.md",
    "blob": "eee5d285565e7e1b06cf4c4c5103b433509ba326",
    "sha256": "35cbf6fc673b0679aa27914a1155932650ea0327f61af8af281efd02014fbf9f"
  },
  {
    "file": "docs/mobile-shops-proposal.sql",
    "blob": "672afdfdb2e5c27cc543b8b6a55caff3468dd621",
    "sha256": "9455223fcdf337787887774c0ef2de178183319df3af38c81e04d68626b20d98"
  },
  {
    "file": "docs/production-slot-proposal.sql",
    "blob": "fcec1da2693256bebead1cbd3a41f3f9d1564583",
    "sha256": "1a0c76298ce823329058b485259edc3ee1e7f32d8b6b7d40cf6c259db46208ef"
  },
  {
    "file": "docs/production-slot-security-review.md",
    "blob": "345e8ca1e25d6ff6272d49e23d1a4f4479d77926",
    "sha256": "a1e4ace4ac937fba5d3a5c8ad3a99737bbf31af9d85a1c0f6dec944a923014e6"
  },
  {
    "file": "docs/release/readiness-work/scenario-manifest.json",
    "blob": "1fa674884f867636daf2be1b04c7245636c6b841",
    "sha256": "b5d8ad091413ea7899da84b754224478eacf0f9d52c06185f2c388b48fd3a3dd"
  },
  {
    "file": "omerta-contracts/deployments/4663/manifest.json",
    "blob": "631f16150b71ec0d56584b109f2e81e76099383f",
    "sha256": "181a715e2ba706bbccc4d516204df0e34ca944caf27e2fd9ac501d823d4107aa"
  },
  {
    "file": "package-lock.json",
    "blob": "0169ae98b978bafd90d760c47cf0ff4ba05fbc04",
    "sha256": "b5f70104b109445d8fd0881c8e06863c04e6d1ed5b80ff5477780a8a783e2cf1"
  },
  {
    "file": "package.json",
    "blob": "493a6e8fc8d6987577d9d31973bf4d2287bbba94",
    "sha256": "8f017fa715916955f6ec51cd42516301608a365f91cec9402e837aaa5b6237cd"
  },
  {
    "file": "public/admin.html",
    "blob": "eb007603283dd7f45685d317ead3b1e7abb97893",
    "sha256": "32a03fd7f9af4485e872ff1405d02d55ba96a5957d7d16c6ff54580410f874fe"
  },
  {
    "file": "public/apple-touch-icon.png",
    "blob": "d0a2d146807ba9fcb40265abdc6669be5323f49f",
    "sha256": "07bd8a579ef3a4e9fdd2556f51e50c9b2b3a3833e391e5c5ce5c527326941ed3"
  },
  {
    "file": "public/arena.html",
    "blob": "bb54b36a0965f2724cb56c1ff55013719b4011d6",
    "sha256": "1f34dff7d3c52bd40493e080ee8d61a140db419296001ae6bf2502b8658431f2"
  },
  {
    "file": "public/art/agent-cover-1080.webp",
    "blob": "f933a2335796feecfb6fe7c6e17aa77f0c94dd8d",
    "sha256": "d49c63428f0b357b9caa650c978a01e7ac1240a700c339cedd734ace145dc065"
  },
  {
    "file": "public/art/agent-cover-480.webp",
    "blob": "51b5c4f4bf4b2088ea2f0b2f76e29b8e7812104c",
    "sha256": "9ddbaba62c2283381f0bb13a35351f1ae115005e8a3cd14df6e767f56b4da645"
  },
  {
    "file": "public/art/agent-cover-720.webp",
    "blob": "a827a9b9aef80fcb7ad87fc3f61c32db617c37b3",
    "sha256": "ef1445b3d1a1fb94f6193bb7f7ec91761bf4f20b3d3edfe1d97d3e16183fd0b9"
  },
  {
    "file": "public/art/agent-economy-1080.webp",
    "blob": "5fc9c012bd392a322bfa54ad032f449fb69be0e0",
    "sha256": "08dde3b0d61b75f0b66bb7bb0cd48a27f5ebd3150cc631b0e0c04361308bac9a"
  },
  {
    "file": "public/art/agent-economy-480.webp",
    "blob": "f8a8a163525579df75b5a68cd8a9f03b503b8fb9",
    "sha256": "d87eee57e801f0086ca75df4be8e36147ae1443f90ae49e2b7742e40f8040033"
  },
  {
    "file": "public/art/agent-economy-720.webp",
    "blob": "2a73fe63b9cec6d570f6cbe377ae1f50ee92b8dd",
    "sha256": "c84b518e600d7d67d0e02ab69dc9ad6bf83ea334e96f52d5103fd171d8f01090"
  },
  {
    "file": "public/art/agent-overview-1080.webp",
    "blob": "18ddb8f9f1d0ef00f872c86ed775c6fad47e4006",
    "sha256": "80883e13feec80417aa88a17c35c3fd27eb8b5ebe2f9b58666f7bc019e79ae50"
  },
  {
    "file": "public/art/agent-overview-1600.webp",
    "blob": "5cf4fec6e21abee733f8bc88dbb90833d5176554",
    "sha256": "041ce1bcbfb9cdbd32e4fa14ed326802e83bdc240ac52bdf389bbb1278c4d02a"
  },
  {
    "file": "public/art/agent-overview-640.webp",
    "blob": "cfccd134175ddc78e4e827037bdd039a459b93d5",
    "sha256": "0e9cc8bade94c66ee96ab326dd6c9efff0ebc1069dbba8788c629dda093a72bf"
  },
  {
    "file": "public/art/agent-turn-1080.webp",
    "blob": "1cfeef4b758f6b230762c8e34eb788f66559172f",
    "sha256": "b1c819e2b2339d3d6e07bdc711dcd9423531edeca3ba7821635342f4d6c9fc43"
  },
  {
    "file": "public/art/agent-turn-480.webp",
    "blob": "1d216dc640264beffe372c392e16bb9269d0ed5c",
    "sha256": "71b99686d63c90c07f5eb837a86d51733b5e0524eadcd9e3200165d5acf7636c"
  },
  {
    "file": "public/art/agent-turn-720.webp",
    "blob": "607f2e12d3cd486d5c2846d4d8a28f14b8e6c75a",
    "sha256": "7df1a1b29456bb882077f8ee44f1d00f35addedae4c00d466d6808347f5f47d8"
  },
  {
    "file": "public/art/boat-cigarette.jpg",
    "blob": "2fba725273ea4ea84ee9878079c87a589584a45d",
    "sha256": "6b60a33044a087dee2e09eb0308e7c1e59d3d788c870f995f559640b3b70adcc"
  },
  {
    "file": "public/art/boat-cutter.jpg",
    "blob": "f8192dcc635ac17919e8ac780c21a46d157ea75b",
    "sha256": "c08cec60e58bad15c5ca31003fb4f1fc9f37c6ae4ce7ad55574161f52641c4fc"
  },
  {
    "file": "public/art/boat-dinghy.jpg",
    "blob": "a4144b5edcc951353b45a6c988420768c9d94b9c",
    "sha256": "2c70d02416b872d619828472e118c3451628719da592de0032638cc14e232204"
  },
  {
    "file": "public/art/boat-freighter.jpg",
    "blob": "a5d96ce045d324d0d51bfc1da57d2989ebb1a928",
    "sha256": "79c3d32f867fe235f62262e43f23d3890b131eb0210aa01509fbedb21ecfdae9"
  },
  {
    "file": "public/art/boat-skiff.jpg",
    "blob": "5bdaf2034e65c0b54f0708bdd33bb817bf4bf76f",
    "sha256": "afc4a5722d254e37bbf07b9bea513d1df38711f794bfb9f42422b7fc4cb9fbff"
  },
  {
    "file": "public/art/boat-trawler.jpg",
    "blob": "17bd301c193945035dbcbba4f9b78464bca7a46d",
    "sha256": "ed676c6659915ad22e7b4ed908383be4deae9c42ebe914612e0665f40a040575"
  },
  {
    "file": "public/art/boxer-clubfighter.jpg",
    "blob": "d5045f4e6e57da997f3d8218ca720853de359f59",
    "sha256": "8deb2066efcb3ebaff157150cc2d6b5c0c17daedaecffd8095bb9c575a58717d"
  },
  {
    "file": "public/art/boxer-gatekeeper.jpg",
    "blob": "d47d058682d5e6ff60919fd2d50f5a9cb299b406",
    "sha256": "ab99eaa1702e2513285ebcbc5d92042315ac037484f644bce2a59dd1a6a1f10e"
  },
  {
    "file": "public/art/boxer-journeyman.jpg",
    "blob": "d870c534184303cb1012a17564219fd82ae4462b",
    "sha256": "e7b89fd0e26cea3dc46c650e4a8d07d581252e95eb5a3ea07ca59621db8fca01"
  },
  {
    "file": "public/art/business-casino.jpg",
    "blob": "40a335c8f4c441c114e47eaaef4ccb7905731e67",
    "sha256": "144afda118325dded910c4503ee70c30e9fbcebd43a292de09e765d59738cb6e"
  },
  {
    "file": "public/art/business-hotel.jpg",
    "blob": "0838ccd94691a929e7c3f0d44db5728e75b671d4",
    "sha256": "20362965da9a60c8d3ca01e0bc10039ff901cd991d7844ededaa93819c1c5178"
  },
  {
    "file": "public/art/business-laundromat.jpg",
    "blob": "e808aae559ff2b4ba76c155f7ee070b2606f81ca",
    "sha256": "bc286046322c4f343e4e11e5abfd56427b41972e271f14ee464b3555eebcfe0e"
  },
  {
    "file": "public/art/business-nightclub.jpg",
    "blob": "8322ee9c5e040fdd5e8fe242609693a57a805734",
    "sha256": "efee15e9824dfab505c4a600f0160899b44f43d7714bb36c1aa5910ff901d929"
  },
  {
    "file": "public/art/business-restaurant.jpg",
    "blob": "e225334b4223f196e6bf909069e0d732d335f025",
    "sha256": "ec3e0e4786f9ec525a01a9c9d75950ac919cb347829be65a6adb48d45fa45d83"
  },
  {
    "file": "public/art/car-ambassador.jpg",
    "blob": "84cbab0c114936de6b9ac7756951cabd3d741ae5",
    "sha256": "ed25cb8aa0c0440ddf83a42ba047cb14ebab07aed3954de522eac0f628462275"
  },
  {
    "file": "public/art/car-aurora.jpg",
    "blob": "b68c0b43b697baf79e14193c76a2ce83b1ae30c7",
    "sha256": "443295ec5380f633beb011f20b8b12442324d13423b95147c203df1d26b31790"
  },
  {
    "file": "public/art/car-blackout.jpg",
    "blob": "0dee7827c897585b962f4b9f6adcd63685475481",
    "sha256": "5e8e52be5be7e9835389425a03fcd739278f7b3138ab285cc62dbfaf1527fb27"
  },
  {
    "file": "public/art/car-boulevard.jpg",
    "blob": "6a95735acbbf02d3bc591e6baa1cfac70d8e8747",
    "sha256": "3e3fb0a26b53d929e784b04e252c1387b5175735c82f30616327c9256d212bf9"
  },
  {
    "file": "public/art/car-brougham.jpg",
    "blob": "90171125be253ed66133e11f23e3522e0f4d83bb",
    "sha256": "54f7c0012a60caf544360c0a7d6622435614b1902101341e1ce10ec802f52d87"
  },
  {
    "file": "public/art/car-bullion.jpg",
    "blob": "e3018845184f417285ec9db228cc579e753cef65",
    "sha256": "936acc558fadc0ba4fb949a2150804d8b69821483c4b953bf1e8dd4bb7de8e9c"
  },
  {
    "file": "public/art/car-cabaret.jpg",
    "blob": "182da4fcadbf42ba5deaf20d5e19d782bf324f82",
    "sha256": "ed8a222d7d62d5187fbce3aecd21ad372e2f3eb18226ea3ea23f5d523bb584db"
  },
  {
    "file": "public/art/car-cabbie.jpg",
    "blob": "e52255e34201a0c2e2857dbccaf28aa98a000fc2",
    "sha256": "acd287c3e0a7ef044a57c2c9364712becd92c9e97aa8de0772bd4019a5aa2eb9"
  },
  {
    "file": "public/art/car-cannery.jpg",
    "blob": "6f260c9d364e111a6aabbb9df317995f1ccc092e",
    "sha256": "2115ec79b66089aea114b0b8518dc02b82568a58c15fbba5b498a507e36db1a0"
  },
  {
    "file": "public/art/car-cascade.jpg",
    "blob": "b03acc96f6755707c475ee2cac8f8f4a5f816890",
    "sha256": "04323bb94662cb65acc6627205232dbc30f56f0db5ddcb77644ae25998249108"
  },
  {
    "file": "public/art/car-clubman.jpg",
    "blob": "bd47efd4431c3dc34a3c7d8aa5d577fab0900fc7",
    "sha256": "c28b58acf4bab161f2e7e64fcf780f24e0baaea23a22b51b183facdb64ff4c17"
  },
  {
    "file": "public/art/car-comet.jpg",
    "blob": "f383b2aa0cd06ee7ec80ccc05404ddde149ff180",
    "sha256": "c9b784580ea456284cb4ba646844329a8c03139971bd52e57c6d617e790f6e9b"
  },
  {
    "file": "public/art/car-conductor.jpg",
    "blob": "32a6cfe65601246b633c6ea03099878f03edfd5b",
    "sha256": "c071465a47744187c7706a46fe8ef94a6ac8ec4b0a316b130d0d3adde1a5ae21"
  },
  {
    "file": "public/art/car-consul.jpg",
    "blob": "3b81cb7381ebc2f832bafdd4b0670777c6560bfc",
    "sha256": "8c6194699b812a50c24a56306f037bb6ab47c726560a1b5fcf733cf3a225edd8"
  },
  {
    "file": "public/art/car-corsair.jpg",
    "blob": "3d226e4786f147db926c3bca7fc15b1f1dabfbcb",
    "sha256": "1b12e1355bc335cd48f9218a58c9255c44b0c9f0e116c9822ba1e26e44598e2c"
  },
  {
    "file": "public/art/car-coupe38.jpg",
    "blob": "aec0f9f80cb4090b28bcc661c6e426d0d1e5dcd8",
    "sha256": "d47166fc865989bef877130d212c2cc4cc1196b52ee484999541894d878c4d72"
  },
  {
    "file": "public/art/car-courier.jpg",
    "blob": "efb8f7ca98add44f03c2f910af72be29cbd0067f",
    "sha256": "c318093218dd5443084773d89f47f0ac3b9051ffe16394268af448c62b4e1fce"
  },
  {
    "file": "public/art/car-deuce.jpg",
    "blob": "ddac4cac1547811381a993e9f688fbda040ae489",
    "sha256": "51d1745ed94f9a74e6ecac577d1baf82638472ed997b15d135c5ec0c269a970c"
  },
  {
    "file": "public/art/car-diplomat.jpg",
    "blob": "4ba570fbaf8b02a2e197bfba2e40909799d9013d",
    "sha256": "44122657bee9251f35233d71db79b2d0d55179fee2fe4d4028cea745ed0dcaaf"
  },
  {
    "file": "public/art/car-dockmaster.jpg",
    "blob": "c81bb84b555a275d428981867cac2e41e79548df",
    "sha256": "c2b551d43811a6fa2cf5678038d4cd88a5b22afec9c404bde7f5a4ced83ffbc4"
  },
  {
    "file": "public/art/car-dray.jpg",
    "blob": "da758b07b35cdb99e526d6f6550818409180c85d",
    "sha256": "d7b9427a0a5ac307d5abff45f4a1e4888f832e8f2815064cf70a279cab40574d"
  },
  {
    "file": "public/art/car-duchess.jpg",
    "blob": "ab655d66ba15325205a2f9f02b25a536d7400565",
    "sha256": "544cacbc1a6be1dd176dabbaf336214c62514d5d4c50cfeb1683d266bd20ce72"
  },
  {
    "file": "public/art/car-errand.jpg",
    "blob": "0b31af0780d1931d01b6c20ef55fe456eb6511e6",
    "sha256": "fe646c2e609c6375d475ae5b060c9a9f18eddc89820176edd5f11dd3b8421a08"
  },
  {
    "file": "public/art/car-foreman.jpg",
    "blob": "2f181838a19cfa835eea954b4c4346494fc4dcf0",
    "sha256": "31b8c2a58b1129123343a5b6c9f78a243083062d915a90c0067bf0818af12fcd"
  },
  {
    "file": "public/art/car-garden.jpg",
    "blob": "b560ed0f635f2392837fa1916bab85c72f217de0",
    "sha256": "ef292a8a5fcb5299d4bd708e3409eb9385071d7d1c057ae7512009c2aa9dc9e9"
  },
  {
    "file": "public/art/car-harbor.jpg",
    "blob": "0c3aec84b4a0e167e244ad5c296850ca50c52a7a",
    "sha256": "3e8a6d23ba7a7f6e689386bdc233343e6cc6456f540c5dccb95c748aa4519fa6"
  },
  {
    "file": "public/art/car-iceman.jpg",
    "blob": "7e39f8610057d5d662abf11412f1189fa88e4408",
    "sha256": "aca811e74c9d0f1729e742de22ed0910a9d2f71eb54ff998b226159234e6a542"
  },
  {
    "file": "public/art/car-junker.jpg",
    "blob": "4970130fa4a47aab4eb3c754e37cf6c4925d9baf",
    "sha256": "2c248e0490b0ca070d445b20d57c1a3bb81f775108dc46a50de5a6c7ec75d555"
  },
  {
    "file": "public/art/car-ladder.jpg",
    "blob": "252420351411b0ccf12f1088c223a7a93f107d2b",
    "sha256": "56494baa043d907287edff440e6a99105fefb0ec1c1040364f05c9720fd5a463"
  },
  {
    "file": "public/art/car-leviathan.jpg",
    "blob": "d6170dc68a98ad92580e50f3eb015e19cfd60132",
    "sha256": "9c74461fe08770bbaf8dd2fac00fa1296d63bbb39ca0ad794d39de22acbf7c12"
  },
  {
    "file": "public/art/car-mercantile.jpg",
    "blob": "ddf6f565b07ec894769391cdd2f302d5615cf0b7",
    "sha256": "3a655fa74eb39649138c095bd828254c2abe22904af25af9b9206e4bef51fbf1"
  },
  {
    "file": "public/art/car-meridian.jpg",
    "blob": "c5192b1a850fdd1c469513e511b99834c884aa2a",
    "sha256": "733fe3e1229cf5c87f30bd5744b4e0bef7f5550540daeeb83516ad19f968d5f1"
  },
  {
    "file": "public/art/car-milk.jpg",
    "blob": "e19bc5983565e3a991ab496da84fc16dd92c668a",
    "sha256": "69e82db76f3ef3522dda73fba009a03c776462a3f2743ccb35bc1713eae0ff10"
  },
  {
    "file": "public/art/car-monarch.jpg",
    "blob": "3bd1b722cf300ff6b53c55a2dcf2856cc9c1c93d",
    "sha256": "95d4e0d415d9690b79d887859c29c8e0e8cef9dbfae95bb1c243f0315d54db3c"
  },
  {
    "file": "public/art/car-nocturne.jpg",
    "blob": "4badb6489a1b6ea06297d937e172c96408ef3f2e",
    "sha256": "db497ef89e1e5c92365cc2394a26eb3d562b75ad238267ec0956e233e856134b"
  },
  {
    "file": "public/art/car-notary.jpg",
    "blob": "443161bc62811dfada8efe2673096efbbe0267f5",
    "sha256": "401eb1e2acf00f2a4b457192ec7dfbe43af617104fc42cd66357095fb1f7892d"
  },
  {
    "file": "public/art/car-offduty.jpg",
    "blob": "3809c3e7d2df05ff2aded70bbb2c72e55b714d02",
    "sha256": "c7b2d28e366653edb3c24ac80f7b4fa76a8961c551bc1da8b9c3e7c2005ce832"
  },
  {
    "file": "public/art/car-olympia.jpg",
    "blob": "b8051f89440c81b047a44705ac2fdcf46ff1c303",
    "sha256": "3d5c22176be3ef7cf9da65f9178816c531d591e7a00dd3ee76877bcc26810526"
  },
  {
    "file": "public/art/car-phaeton.jpg",
    "blob": "9aa9987ac9d7a0c2695274f34f961b5857893ab9",
    "sha256": "4aee04026cc384cb697aad87ddf25bb7aed1c68ad5807638fe2d4ded0f926819"
  },
  {
    "file": "public/art/car-pigeon.jpg",
    "blob": "98c6820176818f58af5331de7ff8a9333eded245",
    "sha256": "134a0bdb03cb5ae75685e61975bf77bab303ec1dbfbaef638d8d8ad76bad5f9b"
  },
  {
    "file": "public/art/car-postal.jpg",
    "blob": "bfdb68a03ead6676b3468e9e64a2e8c650eaae33",
    "sha256": "c284840885830b52f03c179c490b3f512e0d809629fdeb6ade051a1d55ba44a1"
  },
  {
    "file": "public/art/car-prefect.jpg",
    "blob": "974963e97f46053ca213a181c41dd249665413f2",
    "sha256": "258e41947383f7e9ee19a2f0c195fd8acd628b8510c9d08a5f63d076e7f4ea74"
  },
  {
    "file": "public/art/car-regatta.jpg",
    "blob": "1d65fa4e95b7e2e019575085e480357b79b824ba",
    "sha256": "f0929d8cc37e61d3711fe291b7b39843ca1c99de16256bb27d75d7235a4a282e"
  },
  {
    "file": "public/art/car-regent.jpg",
    "blob": "42975eae2ab9823b009c003742549fa5d8a09b7e",
    "sha256": "ca22b9d238ba471ccb1ea8f56b2fd3d0682e17ad875cf1d10707dc3a8b12a895"
  },
  {
    "file": "public/art/car-rubicon.jpg",
    "blob": "04177c8fe9472ab15b4428225a320bbf4cb00a70",
    "sha256": "c29e81a751b6a3ac1ef6b3e20495bbcfbd6317d3f5396e1089b11e1d3372856f"
  },
  {
    "file": "public/art/car-sable.jpg",
    "blob": "5fd7df4d50289ff565670f913081827a7762c962",
    "sha256": "127dd7150dd9ba5e2f8b8b7a86d95350ca0be1490f612cd6b5225697fd3a956a"
  },
  {
    "file": "public/art/car-sedanette.jpg",
    "blob": "783535b364aca8c6faacc0fda8e766fa28ec0a72",
    "sha256": "9361402ce97c27ba28ed69fa45be2d6fbc96de49a230c021e493b25346fa1ccd"
  },
  {
    "file": "public/art/car-sovereign.jpg",
    "blob": "3d7387b48b087fb6a7e84f41e0a3d0878f47d406",
    "sha256": "9493c505217b4acc4aebaaa214d85d4740741a8bf14cad67a4c0536cd79d43fd"
  },
  {
    "file": "public/art/car-spectre.jpg",
    "blob": "9aa1162c95954bf5a3273d52dcdc2cab406d7486",
    "sha256": "10b84cdd1929bcc016a2e12a411d2e2a5ed191907a031e43c193f696cb9aafce"
  },
  {
    "file": "public/art/car-sportsman.jpg",
    "blob": "fca0bfc891bec67395170a264bd51b1635fc9194",
    "sha256": "f60d69ddd66db9a91ad457fc6415487151433998a671f43cde10604c08c38bfe"
  },
  {
    "file": "public/art/car-stag.jpg",
    "blob": "9758a670270b161e9847d27e2a0208941e00e734",
    "sha256": "92ce3687c79978739984b2b992aa5580d32c088844efcc03caca167110d18a67"
  },
  {
    "file": "public/art/car-tempest.jpg",
    "blob": "ca3ba1b54978bfaf4e3e4b0ae182a18d5d69cba5",
    "sha256": "91e3fed17032610c7454759da55b0da494b460396c1fd250d5678bcf3c9ce77f"
  },
  {
    "file": "public/art/car-touring.jpg",
    "blob": "9785c402ebd9cfbb50e883bebe74db430a798a0d",
    "sha256": "8059790a071143b7a6191fed22e3d1346011a480bcc81733a640b0d1bc9c0dd7"
  },
  {
    "file": "public/art/car-trolley.jpg",
    "blob": "6050eb8ddcc7171c7430cb59790bdd941d7a34ce",
    "sha256": "c0a418da55f55be289551f677e9ef549c8e2fbb4b09cf038f7777b04b0d39256"
  },
  {
    "file": "public/art/car-tsarina.jpg",
    "blob": "572ce05df5f34b92f23c202647fa4122868c6ab2",
    "sha256": "217b4bb7d68e522196c21e6d3d76992943441e8eec5111e3073db46812b0f41a"
  },
  {
    "file": "public/art/car-vesper.jpg",
    "blob": "87e09a61a4398dbede285555c333c62226f973b8",
    "sha256": "ba75d613a28fa08dcc1483dd09ab5322cbdc8c5b1f6619288dd2c1c2a152082a"
  },
  {
    "file": "public/art/car-volara.jpg",
    "blob": "b9e758588f5fbc4ef392f0423b5e4bf23680a06c",
    "sha256": "8baffc99cf99ca392a9f20d4e9f462ffb625e482d76fbdf50017aa7446b1edf7"
  },
  {
    "file": "public/art/car-vulcan.jpg",
    "blob": "6e85721bdc890bb0d9314a1b4a80f867454535b2",
    "sha256": "53116179f0d8126a3ad877dd3a7787ae342cfbc6d1f63fbda1c2e58053986c5b"
  },
  {
    "file": "public/art/car-wagoneer.jpg",
    "blob": "c854eb4bcce7135c21b26deda5647bbc1730c57b",
    "sha256": "f2eaa99cc8757ceeb8d700d1c48288106eeb069518b1bf0f1370be836ad3d896"
  },
  {
    "file": "public/art/car-warhawk.jpg",
    "blob": "48970d8855af357889d0da9f15cbef176e9e262e",
    "sha256": "8aeb8540d76d31135d270624fae3183cc1c6303c481bb9f6aa67667eadf2b4f1"
  },
  {
    "file": "public/art/card-join.jpg",
    "blob": "3633c80550c4655ca6bdf8fe1f5b7c9c2c886795",
    "sha256": "fa3a2262edf67dde3c2cc39ad53ea81dcce757c05809a6837a095386c8a2afcc"
  },
  {
    "file": "public/art/card-legend.jpg",
    "blob": "12b0a016d9a597080959aa9ebae6d729dcb9740c",
    "sha256": "3c83ca1ade51065923153bc9cdc166fb2e0776c47775d6c299e4d7f3132544b1"
  },
  {
    "file": "public/art/card-wanted.jpg",
    "blob": "0957c6feb84c75085d6a9e730e92383f4febe40a",
    "sha256": "6bf57a8170e8564d10758bb66dcf5c46877e6ac05987e6e335a8012d780f2d48"
  },
  {
    "file": "public/art/card-whacked.jpg",
    "blob": "6b81072375b9d0411150502a915a82dbb29f1b36",
    "sha256": "2792b52f2d2978e74aec1e02253323dbe3f223dbaf75badbcccf0eea849340ab"
  },
  {
    "file": "public/art/city-fixer-v1.png",
    "blob": "332dacd81b7608f3bea4f0dbd319343ffc7a63b6",
    "sha256": "7d42a326e9491dcee4327b9150d48b359065f7a70efb3977f105f894f30f6dad"
  },
  {
    "file": "public/art/city-fixer-v2.png",
    "blob": "0840661015f3f5d3f81d4e7d28d74fd46e40748c",
    "sha256": "435937febeea0973b06fdd2828548db543a9c919f3e3c271b2cb7e62e9bbbc26"
  },
  {
    "file": "public/art/city-neighbor-v1.png",
    "blob": "cd4b8c073263a0f96dad72154b537b63b776434f",
    "sha256": "e7e42b28cf5a0b22b549aa716a510b903c679e6d6bc9b2e7e08ac8f1fee0dd60"
  },
  {
    "file": "public/art/city-neighbor-v2.png",
    "blob": "16af09cbe69d7a06b57b35e79841d11c599c6557",
    "sha256": "fe26493ca6dcdf20eef2ad46709a65b7874cf3f4bb88e30b32bf54aa2c6c3b14"
  },
  {
    "file": "public/art/city-neighborhood-v1.png",
    "blob": "9a775a525d78362887e8e763b5d166f153decbbc",
    "sha256": "0a8ea803eda9b2be4684d0578ed27eee0d09a60ae0948de9326babe11b0769cd"
  },
  {
    "file": "public/art/city-neighborhood-v2.png",
    "blob": "7fee35b8fa69f690feac782f1674ade163ee545a",
    "sha256": "fc215c9d9e4b5c5259e2a8c7d913dc21398954dec71c9b9a2063481f36cd9ffd"
  },
  {
    "file": "public/art/city-player-down-v1.png",
    "blob": "d36b5fd44cedfd99db1e976a89cdb19f8df24936",
    "sha256": "aa396f0656c0d524c49d0b0151a3fd073644aeb333134827d844e1dbd25f976d"
  },
  {
    "file": "public/art/city-player-down-v2.png",
    "blob": "be283431f66eec27bd5c146f424bc2ca0fbc3caa",
    "sha256": "5bea444939ae0cba1f9958c867e6eb5dcaff333ba76af5ad22cb5dbd79bdda77"
  },
  {
    "file": "public/art/city-player-left-v1.png",
    "blob": "d7eeba1afd65978f4382fdc3efc9673fc7e108e5",
    "sha256": "7acb2988102ea987421861d3f13ab6c097d1af6913768f4fbda1ce71611d90f0"
  },
  {
    "file": "public/art/city-player-left-v2.png",
    "blob": "5f443cceaae3cb76cc06896a72c77c063848db05",
    "sha256": "bb6da62da4aab883ce0928d7cd7b0e4a3b67524a67744275984d9a3592b61e84"
  },
  {
    "file": "public/art/city-player-right-v1.png",
    "blob": "14b2ea1c0fda6f356c757b97e2092d5c9974a47b",
    "sha256": "ef9bfcac080bfea270a664da79d1330cb4db3b9236e972ffe3a885e00699e702"
  },
  {
    "file": "public/art/city-player-right-v2.png",
    "blob": "a8332fd0e89f313a5435914f3c53df25a6507565",
    "sha256": "d424069bf064ae9e34154fa99719cf2433d2bd762f5802a32cc4fc03c8b39326"
  },
  {
    "file": "public/art/city-player-step-v1.png",
    "blob": "be77881e15f9928ad7479adc624f3775d17af1b8",
    "sha256": "2e632c1e88ea4a7eacc5426908374b7ff9b2436d0e79adf183aa320c2656e9a4"
  },
  {
    "file": "public/art/city-player-step-v2.png",
    "blob": "5d9b73b93cfa2ded509880a1314753eebfdbd1f3",
    "sha256": "33476f9cd7c87dfff282bb562b249177f80675dc94fdb139f802515584410879"
  },
  {
    "file": "public/art/city-player-up-v1.png",
    "blob": "1b01fc7c248b4d9d65371773d62e28bba098bbc8",
    "sha256": "2019f7de5ae5a05d802714eebfe69684736ee41b6ea24bad79c526ef0b64bade"
  },
  {
    "file": "public/art/city-player-up-v2.png",
    "blob": "ad005e636b2091d5281f58e708877120d22ed6e8",
    "sha256": "108d74285036353408628c5b7b06ee42da3210111ad3ebcefd8c783547ccbad2"
  },
  {
    "file": "public/art/city-worker-v1.png",
    "blob": "7673c3646d70b2c1b5f4535df78c10c8d191dcc9",
    "sha256": "aa04486a7ca6025c3b55ed564578f6423956611d7d3806e1d6d117231c08b25b"
  },
  {
    "file": "public/art/city-worker-v2.png",
    "blob": "09a0b8917990fd74f87afa20bbb07d28d5abf368",
    "sha256": "53e4c63560aee54b1b8b4a4aa92622e255ef486c7adc420781df8aa8171d9a95"
  },
  {
    "file": "public/art/citymap.jpg",
    "blob": "43c05aea375a646756cda0d2d8b03d7689c2cc35",
    "sha256": "7688525d0a195972eab2e539b532eed9ba90c19689d17dd60d1d1707333ff384"
  },
  {
    "file": "public/art/club-0.jpg",
    "blob": "3245088665990dee32b54ba1a7aa16bf0de79ba4",
    "sha256": "ed7b2f8b0748eaa2b1b177d8086caa046b240517c93468a205f6f8906b654b98"
  },
  {
    "file": "public/art/club-1.jpg",
    "blob": "acbe482fa77e98d30f435dd8f7190a373cb078f2",
    "sha256": "d5e0911e2e52433dfa45c436d304a6b67474065c92b21b682d105e5be4fa37a3"
  },
  {
    "file": "public/art/club-2.jpg",
    "blob": "5dd50069336bd441b93a695c2b1dd840fdd262aa",
    "sha256": "d8741a1ab45df1d0c354897f84a17c65d0f878219de0684dfd4067a41596eec4"
  },
  {
    "file": "public/art/club-3.jpg",
    "blob": "432c33d374890b17726ba833ed2001e0d1d2e134",
    "sha256": "a2b636b0fcecf48183ce7a85e04e3335c093700c5992a4881a48b732edd82534"
  },
  {
    "file": "public/art/club-4.jpg",
    "blob": "2669655f4ca41172060e5c4b53e50e8c2d19c6aa",
    "sha256": "d94244e41775136c8c3f027ad5ae5d656e57a2dee638c997a913e58df63342c0"
  },
  {
    "file": "public/art/crest.jpg",
    "blob": "80d3d20bb0a0b15c07118072b574338ac5aa20a0",
    "sha256": "fba14bd26e58fe8971bb4d0886c6829f281fe2b3cdb0c0580fb7d12bb2a54098"
  },
  {
    "file": "public/art/crime-alderman.jpg",
    "blob": "a9391a871d931ab80dac391eb6bd7da50cd18d37",
    "sha256": "966d367107f58f88383e10fe93c60918dde5e36493dbeb3b67d81bfd4eb57206"
  },
  {
    "file": "public/art/crime-armored.jpg",
    "blob": "f1d3ba2d87230b998cf07d398aa0751b7da237de",
    "sha256": "691bc9a7fac9fd1b62a6c6b5ff27aa26560fbaddf380879b24ec62f81fa82953"
  },
  {
    "file": "public/art/crime-ballot.jpg",
    "blob": "8c1d0781fc1e2a1cb40900c9749b0414b9aaf06e",
    "sha256": "baed9cf66d172246275fcf68eb6e7f20687e69c2a24b074392604f64a83d7f2e"
  },
  {
    "file": "public/art/crime-bonds.jpg",
    "blob": "bc329d5691fe927aa66ea9ae41ed518736c29345",
    "sha256": "fabc1e5a20acc63baa1fdfdfc131edb74fe244a14eb08fafa38d0db403205d98"
  },
  {
    "file": "public/art/crime-bondsman.jpg",
    "blob": "5ff7ea13b748ec6ed9cd44f570096d2f1ea888df",
    "sha256": "6d0f7132a970d5a1c5a71d53cdb8cedf3d9b5364d0b2ef11daa6e0a9fe4b213b"
  },
  {
    "file": "public/art/crime-bookie.jpg",
    "blob": "6dc9883d3d693c66411ee8680a6839f09b7de8cf",
    "sha256": "f815b4b8835a1ff125920addd572a5d78d7c6420b871d7678a5e532745eb31b1"
  },
  {
    "file": "public/art/crime-booze.jpg",
    "blob": "31fc4eaeb7e40dcceef4a7f93f34ae8e4d10334c",
    "sha256": "26a3a318ea5d4dae1cab1798eb9bb6829f9c8401c10908fc29c4f757a067e851"
  },
  {
    "file": "public/art/crime-cardgame.jpg",
    "blob": "5bcd3780ef24153a0e972d64f179f2ceac441804",
    "sha256": "0d5eb4bcc2d70017372ac08912211f271a213e4cf0fbcb8a1e70d2e53976ec96"
  },
  {
    "file": "public/art/crime-cathouse.jpg",
    "blob": "e65fcf7ea457c7741d9c112a7474eb9cca49ba72",
    "sha256": "0036d9de87f51f9687a41783086c84802294cdd3da22e1bccdb4f175e358d4a8"
  },
  {
    "file": "public/art/crime-clearing.jpg",
    "blob": "efcbb22dd3334f666c750953f9213634c218d9b8",
    "sha256": "c937eddc9580c57b1a8933feeecfb213bd13fdbab35caa5841ea5d7a821883c2"
  },
  {
    "file": "public/art/crime-counting.jpg",
    "blob": "b646e1551cee95a41c9d21d46a2604243db460ca",
    "sha256": "6fad9a438b857d80271d0c0849674586218f2c271c4d5a3d81d6cb63ae54d08a"
  },
  {
    "file": "public/art/crime-customs.jpg",
    "blob": "7aed9c62adf1c6f05bf1653cf9d96ba3d8f080e2",
    "sha256": "47ffcf8c34b94ddd6b46509d4ad2a9c43a68a32f0e754235d478290ad1c32da1"
  },
  {
    "file": "public/art/crime-depository.jpg",
    "blob": "cc52c2eeb3ec3c8f32208b209cb3738ad45f1b60",
    "sha256": "7fe6ceab9e68f0c4ddfcefade2c50b423dcb8d29d0a9756e6336357ba990a1f6"
  },
  {
    "file": "public/art/crime-diamond.jpg",
    "blob": "85811a584d002a5e7da623204066006a1e5594d4",
    "sha256": "389675660a3843cd5447969518cdd73b7421314f7ff93f0f29f688f8ba692fcf"
  },
  {
    "file": "public/art/crime-distillery.jpg",
    "blob": "c8176e3a3700fd4e1eac5c082115752d9f96907d",
    "sha256": "a833aa5335dc8d8b0bb2fef2dfe202419466dbfd3498372bec63406807608cd4"
  },
  {
    "file": "public/art/crime-fedtrain.jpg",
    "blob": "e949b2da82517e582e061b087f3f5307f5052653",
    "sha256": "99adf6135a03b3ff0968b9da0865561903ef3f4b11e90a84e457c9143db7afb9"
  },
  {
    "file": "public/art/crime-fixfight.jpg",
    "blob": "99a42470990ddb29124c924132cf5c9a826be8ab",
    "sha256": "25dba828e04843beef7aabb02042dab369774441a693eb74b0ecc1973e4e8bf4"
  },
  {
    "file": "public/art/crime-furs.jpg",
    "blob": "669566f4fdcbd6d1ea20267f2650792a797d4d65",
    "sha256": "20f2642fbd556eebc54a60148e1df06d1736621d9465d07a64a5d6767a546ca6"
  },
  {
    "file": "public/art/crime-grandcasino.jpg",
    "blob": "e794e262df9944dc9eaeaf60950d5f9bd30e69b6",
    "sha256": "93e44266fef218b19e917f7976d28c469f158ebfb67ecaa831ab3dfb5dfe283f"
  },
  {
    "file": "public/art/crime-harbormaster.jpg",
    "blob": "5cc73fa6f485358d8c814c95bf42aec17cf40d55",
    "sha256": "b89b78b4504a5031bf03050f280056a2a5a646879063b8a81a9a7770de005a34"
  },
  {
    "file": "public/art/crime-highroll.jpg",
    "blob": "8d8dca8dd57d626c4b74dafc496ca3180b8f7abe",
    "sha256": "8fc8ec526589f5e6a34c2d0c87371a7f2c6303d5741d010bf698cd7780e353cb"
  },
  {
    "file": "public/art/crime-jewelry.jpg",
    "blob": "fcda1a170c68d7b6b89b5a3bcd5a4bb0573113d9",
    "sha256": "90f95b1814071ddf1f343720d0971423dd980a8d329bd74f6f52af5d15d430f1"
  },
  {
    "file": "public/art/crime-laundry.jpg",
    "blob": "91c71f96651aa3f151bcb918107bee9946915b15",
    "sha256": "7f26383ab8fe38f6f8d37ce88d357f9076fc4697974d6f6af2a2788c9f5683c5"
  },
  {
    "file": "public/art/crime-meter.jpg",
    "blob": "cbd57ef46f88ed5e61eb6ea2577afd65a63fe79e",
    "sha256": "e5c2f783784aeba6776d0e9d9d448a0d8b62372fadf9aaf7e95de74c023dcbd3"
  },
  {
    "file": "public/art/crime-mint.jpg",
    "blob": "40420d9f8157962bccf2a451c91594867569dc50",
    "sha256": "a464d04a3aa73c4f08afcd388712d4ca0fc6e64fde5ad55b0eb0653c600d7870"
  },
  {
    "file": "public/art/crime-museum.jpg",
    "blob": "042da7ded43c931e88a3bab8d5a0c9641d451c0b",
    "sha256": "a99c0fc520894f28882011baae20bd2bd1e732d6198fa92d8ddd074be96d34cf"
  },
  {
    "file": "public/art/crime-nightdeposit.jpg",
    "blob": "7c8fca2f87edbf92e5ec4bb927e5d7479ccdfb3c",
    "sha256": "c562de46ec4c69aad8defe78e1ec2935ff662a0814faf593cdef7b7404d4a425"
  },
  {
    "file": "public/art/crime-numbers.jpg",
    "blob": "ee6e9825fdfc994fcb021f55095b21e0254c33fe",
    "sha256": "e3e45befca6b64cc1874550b3e463a0fda16a0c6691aa9e7c6273ca4232c2d0f"
  },
  {
    "file": "public/art/crime-pawn.jpg",
    "blob": "5cb106810a3e8a3cad59089da07efe8968fe5882",
    "sha256": "6114e3b679878b0690f36b38d49b7e01fe2b450d6ef3c783057b42932d0c949c"
  },
  {
    "file": "public/art/crime-payoff.jpg",
    "blob": "bd95ba0bd494fdc9b5bc2ac91ec74c73e190f0ad",
    "sha256": "867c16f5bcad8e051b6885d7510e200e682cebeb67ed432c758cc76972f93417"
  },
  {
    "file": "public/art/crime-payroll.jpg",
    "blob": "c4901740d2609793b03440c90aced7a33f25816c",
    "sha256": "404ff256e763f9ff215c970dc6f2333d8ccfaff320c04e6627e0adfb30fa8ad2"
  },
  {
    "file": "public/art/crime-pick.jpg",
    "blob": "546a890fee87b9fc8b2cfa01ab1efde03ca6cb08",
    "sha256": "7407394a80355b3cec882f480023311c9064ea14d4801c47d51de5375706532d"
  },
  {
    "file": "public/art/crime-pigeon.jpg",
    "blob": "552d7bcc2083735e05aeac1946e906d21044f37c",
    "sha256": "8ea0218a573a40141dbc5849fca201d932293bb7fbe4a9280277469715f67a17"
  },
  {
    "file": "public/art/crime-poker.jpg",
    "blob": "073d3d38ebf03a51f2d97d92943e7e52f7ed4579",
    "sha256": "023a1d57441cd233815bc6807622bacc8c4640fd8f742e71b6f21d2a927347ac"
  },
  {
    "file": "public/art/crime-protection.jpg",
    "blob": "6b161d762ddaf164f71107789f91af0f606093f4",
    "sha256": "6ca54be7caf9d3aa3a051892235e0323e96e023e63663bf13cf42cedbf5432b2"
  },
  {
    "file": "public/art/crime-railfreight.jpg",
    "blob": "122d0b5b7201ab6671e0ed489c64f5fe521a123f",
    "sha256": "a1b279c721cb24f21a3fd439ef0bc17d7f607d43a96aed9d581679b058325160"
  },
  {
    "file": "public/art/crime-shake.jpg",
    "blob": "e892115c3c4895c77ada61b3f088a8ba702d0b30",
    "sha256": "7f4117dea13a98e7d480cba36ecb34c4fa424c0a3b13c1c6834527e2420e5d51"
  },
  {
    "file": "public/art/crime-stereo.jpg",
    "blob": "b4dc5dfb7dbe1d95194f443ab2ae199c762cfc9d",
    "sha256": "c389e6919719b54dd4fe43de8c648c55d868d08c82d778f7a832501f0b46287d"
  },
  {
    "file": "public/art/crime-switchbag.jpg",
    "blob": "5f94620d543b19fb72a91814a5fd9c1488376077",
    "sha256": "9fb7e51c8aa8ccaafa6a1cfdf5af36c1631c32f67368727d63ec50887e3bcc0c"
  },
  {
    "file": "public/art/crime-ticker.jpg",
    "blob": "3047c005c7eb34d8c9a40e24a058cd5b2a5c683f",
    "sha256": "2a8b96341b7dcb090e9b918e2570be9737b82af7418ef5db605855831bc6d3b1"
  },
  {
    "file": "public/art/crime-torch.jpg",
    "blob": "ac81b8a57ee8723e2ad0a7f50b32a178f4f5dc73",
    "sha256": "80cb316a99511f523fc877cb93537b6a0e0433230be0090e273f905baf3301ae"
  },
  {
    "file": "public/art/crime-truck.jpg",
    "blob": "198f38ad07d6ef0473f6aafb165e1bc2458b25e2",
    "sha256": "646eaa110f8f56a43828177a238c86e6dda8e4db61156139b48b92a0daf7733d"
  },
  {
    "file": "public/art/crime-vaultjob.jpg",
    "blob": "4c7b2e7d0e4422cca615120fcc0cb9b8a00a8f51",
    "sha256": "24a55c4781940887b00dff6e007b1e933a8e29c467df0259401a377849779c03"
  },
  {
    "file": "public/art/display.woff2",
    "blob": "b19a892ae3f81d8ac37c50363e12bb5218febcea",
    "sha256": "f6cb541f4d9794b86145c9c3e7d778ffb78c92f8180c577e245238991503da6f"
  },
  {
    "file": "public/art/district-brick.jpg",
    "blob": "8b4b06822cd6c838f653d79e4003315fe2309d69",
    "sha256": "ed0bfec01e8bf13317cc22829a47f9b9b0f171c28f2b8e039874ec4c74a4c3a8"
  },
  {
    "file": "public/art/district-canal.jpg",
    "blob": "1d743a784b90f50727be142e0ab723f1ddcc86dd",
    "sha256": "9402275a837b45259f50d68dac2a05713afd3b6f0400d3c2f40ce791fe850e26"
  },
  {
    "file": "public/art/district-cathedral-480.webp",
    "blob": "5f4d42d4db095494561fd821379dda0548d385db",
    "sha256": "92893301049decca643aad47d291411a23487b44113e679297a50454fb7e3a16"
  },
  {
    "file": "public/art/district-cathedral-960.webp",
    "blob": "80a14f7fa3d54dc2966ee27d100d221c864d5e51",
    "sha256": "8ad6104112ef2a3c2694f55cb0a63674f4591098fa138e4df064febc884f8c40"
  },
  {
    "file": "public/art/district-cathedral.jpg",
    "blob": "80461d9f690aefa0f2d8e77e2b547540ad936d1d",
    "sha256": "0b8742d148a775bc663c53fb90244122a9ed00fac02ed3b5904673a6b49747b8"
  },
  {
    "file": "public/art/district-docks.jpg",
    "blob": "57d025db2f1af09b62f9472fe9ed3dc3698fa0db",
    "sha256": "a0cac527769a2b477bc2fcc58e25c6218bcdfef757d9405f374993d8d468b196"
  },
  {
    "file": "public/art/district-foundry-480.webp",
    "blob": "9fc28588446200eefb1640a56d4d8ffa7d5cbf45",
    "sha256": "edeab45b7354fc1d4cf5e224c1e82c36554f7740fb0df7912d3b48d93955ce82"
  },
  {
    "file": "public/art/district-foundry-960.webp",
    "blob": "19aeaceffd48b54a58d19f363ed8be9bfe0eac26",
    "sha256": "5f04389cea7d498da1a80f54af7ec06d7b4b79989c8bea6f869d5012fe8b79f5"
  },
  {
    "file": "public/art/district-foundry.jpg",
    "blob": "463fd0fe145997a8fb783abd0666468ffd4822e7",
    "sha256": "43337a657fa214747b1e6acca0341e4932906a8b3243af8905865bee6d00562a"
  },
  {
    "file": "public/art/district-neon.jpg",
    "blob": "fcbe69333b494afabd0081689fa8736b728f7bcc",
    "sha256": "3c9db5a43f4e7ec61d38b68f34ebbbcede42dff1904f818213a21b25df0f4254"
  },
  {
    "file": "public/art/district-v2-docks-1280.webp",
    "blob": "56f6d029a51182f72a9672dbc47c8adfdf10e31e",
    "sha256": "f610b65a8f9275cf124514eb6f84a317440c3c02f600231811c4d91dd37f727a"
  },
  {
    "file": "public/art/district-v2-docks-480.webp",
    "blob": "68a8c10d062f77858c9f3352c27750c598216e81",
    "sha256": "0ec25edf268dd82dfe8ac87e3aa158b8bc93a13fed6ea13cd6481b6afec767ae"
  },
  {
    "file": "public/art/district-v2-docks-960.webp",
    "blob": "da857380e225c404c5d49ec813ad59db642da778",
    "sha256": "bca4a1d379a436a11ce7d9619b0e759807ed94c1e00abc9c560179a887cdac80"
  },
  {
    "file": "public/art/district-v2-docks.jpg",
    "blob": "4e58474f9aeff728a520fb90b6856d88198dfa6b",
    "sha256": "baee092255e5154833c704c2916f736d61f92c155f47a6a382c70b09f856ca74"
  },
  {
    "file": "public/art/district-v2-foundry-1280.webp",
    "blob": "5a05eab79fbedf9c55d2668118c7fd6b37af3a35",
    "sha256": "5afc0d1e54ec154bc0a012f91f1fd09e6801978afe2a738a488c88f4cad44e34"
  },
  {
    "file": "public/art/district-v2-foundry-480.webp",
    "blob": "a091ebad7c676f72c24d4fb79ca649eab8f02cf8",
    "sha256": "bf72b1ae5db4e91c0b7284491ca94b7c8dc40d98b9c37247cdf77031f5aa97bc"
  },
  {
    "file": "public/art/district-v2-foundry-960.webp",
    "blob": "a6ca5fe23310e640db8d03a073cd82c33875324a",
    "sha256": "e070cb13841f26baa2bb10b25e5d45eb234ec91e7385f3a3aee51365314172da"
  },
  {
    "file": "public/art/district-v2-foundry.jpg",
    "blob": "79b36bf697965c839a8208893fa4423d9ed1beba",
    "sha256": "9af7b8dd4d0be1effdda7054e22013e7d59134323d4c402916360f481be3173a"
  },
  {
    "file": "public/art/district-v2-neon-interior-1280.webp",
    "blob": "45c2d11495edecfcc8b38623df53aba2848f0a72",
    "sha256": "aefeef9d85582088d8a0ecc3c4ba652a0d585c6c8d92a8711e2e90f38a1a4b3d"
  },
  {
    "file": "public/art/district-v2-neon-interior-480.webp",
    "blob": "153ddd2e8530668d7f50677ebf96a8265113d613",
    "sha256": "c8e12b9aa9ea91073ac029629b9048364737b219f315a3f53bb125a6c8af4603"
  },
  {
    "file": "public/art/district-v2-neon-interior-960.webp",
    "blob": "8ae21b41a03ca8d6ee981030aa4fc83e01c7fbd0",
    "sha256": "9aa6f3cd743698d1afbce77ee80561c9b9286a91749a8c8085e8dbd7d5de813d"
  },
  {
    "file": "public/art/district-v2-neon-interior.jpg",
    "blob": "e4d464b34803733b13097bf8127ab984775df513",
    "sha256": "3555e0175de19827f615381fde1f57fd1cc1b25598aa3429d46d249bae74bdd7"
  },
  {
    "file": "public/art/drug-ambrosia.jpg",
    "blob": "08c6feafb3d6e69979f32c806444885b400cc8e2",
    "sha256": "c17cfdd307929dc1fdbe45f6ba0695fa86a457146c229680f46ff078ccc40dc1"
  },
  {
    "file": "public/art/drug-glass.jpg",
    "blob": "bce9b640b182fae03fa551e5d14d0e1e86211f18",
    "sha256": "2cea6b081be8b5e23349faf2958112ebe6e03b63950d7315c096f8e928bb181b"
  },
  {
    "file": "public/art/drug-halo.jpg",
    "blob": "4ebc012f42b3d5a3ac1d469e5dfb5052ca3d3321",
    "sha256": "061d999d6b205ead07a0e2600dfa10a7145b931c7be696edbe635c6601e6aa53"
  },
  {
    "file": "public/art/drug-lotus.jpg",
    "blob": "b9c212d90ec97b8d97be5ea3f2ef38c0e4b3d25e",
    "sha256": "2a97499a4ecf19996330d52a121d889c256b934c1ab3e8a1cd7103c313897935"
  },
  {
    "file": "public/art/drug-moonmilk.jpg",
    "blob": "fa68c3d5e9d0a6f70ee5a9ed25c065367976e55b",
    "sha256": "31904ed7d2ad2abee7bfa45b8855e639a9bf9e3482ad78e7450b8c91722430cf"
  },
  {
    "file": "public/art/drug-nocturne.jpg",
    "blob": "a2e91a108625fbf847eb5b2b2bbda239b77e4f5e",
    "sha256": "9b876b565f89abf916182dae2178aae9f77fe54d2ce9940fd1c5e8bd7df5b6b8"
  },
  {
    "file": "public/art/drug-static.jpg",
    "blob": "ff84dbee97fce6994e96d3550c291f036caaddce",
    "sha256": "7186d82d385bc37c60b3b85d6ca7f45c7d616dcc10476d9d2991d0891591f087"
  },
  {
    "file": "public/art/drug-vim.jpg",
    "blob": "5853df979d0c0a40593253498b9fe7a24f210a00",
    "sha256": "684269cb39c12f0664151511f83835486894d324b86e1bf8aa45538ac29b8e7e"
  },
  {
    "file": "public/art/estate-1.jpg",
    "blob": "508ea5a09982d853006d51a2867c7d1905d1f7c7",
    "sha256": "316b9d84677ac2a95753d0582e892e7e62083c14aabb64ac02caf538b247ea4e"
  },
  {
    "file": "public/art/estate-2.jpg",
    "blob": "7ba2cc820be772d4658868d8137a9956df91c151",
    "sha256": "77aa2107ba32757e0353c7439b01a523ef57855de1573dfcc3399121671808eb"
  },
  {
    "file": "public/art/estate-3.jpg",
    "blob": "b31edae5482797a7930d0543442cd8aa4b8c75f3",
    "sha256": "680f4ec72317899b7238862ef943a8c562882d69ddbc20a932a60210123ee296"
  },
  {
    "file": "public/art/estate-4.jpg",
    "blob": "9163ea13c9b1aede70e4c427cf4e497197db9bf4",
    "sha256": "2d9cb5a781b12b7bdb497c3989fb2911da2715bd874196584fba7b797e167fb5"
  },
  {
    "file": "public/art/estate-5.jpg",
    "blob": "723fce83c6aac0d2a70d78fba50e1969ada28879",
    "sha256": "24be5fd8c68aed231f3eb4ba8803e99d4c8699be9855ee001e9acd167762ace8"
  },
  {
    "file": "public/art/estate-6.jpg",
    "blob": "d50eac377bf1aafe6a8a764b55e2ebf86c8f625b",
    "sha256": "6ffd8d225e90a307d2a01a27eaaaa6dafac70a444609774448bbccbd0ad71aa5"
  },
  {
    "file": "public/art/game-blackjack.jpg",
    "blob": "012b53a00238ac5c69ee1c2563b5dc0363c9bf2b",
    "sha256": "bb48ee2eb1c1810dce971748b2c32fb542baba1eb4818da0a8afbafe0a039ba8"
  },
  {
    "file": "public/art/game-dice.jpg",
    "blob": "3ff529f6cd0238baad438fda52d2a417752cadd1",
    "sha256": "fb58071f88ea0e319cee0069ab6ba2df4e6be606c9f60a0c335b551096905f9b"
  },
  {
    "file": "public/art/game-fight.jpg",
    "blob": "065a4be614bff37531840cbfaf116f6533dcd80e",
    "sha256": "567a1653eba7bdb0dd26d2b7aca71e1137861da0da004168efbe342f7d48cee0"
  },
  {
    "file": "public/art/game-futurity.jpg",
    "blob": "6a665b744f647a2dd09784f52b997d6316e4384c",
    "sha256": "63ce2a70f8ddf47123b30a1be5a407fc1a4d9f1288ff882e81167cbf07ff8474"
  },
  {
    "file": "public/art/game-numbers.jpg",
    "blob": "c27eff83951e2b6a20d4c7d6998cca7a8500b0a7",
    "sha256": "75366990cce0a5ca00b6bf3ee5b83a61e5a13e354f69b9702e4e52a2282eab7f"
  },
  {
    "file": "public/art/game-poker.jpg",
    "blob": "bca77882be9f851faba4611fe6c04fbd15e360bb",
    "sha256": "5ad94da932ef532cdc38120e551c7f7edfca39542bd1bb8b4df990450f83598c"
  },
  {
    "file": "public/art/game-ring.jpg",
    "blob": "ccf01a3fbfdd15ef225b57346e67b408f6c4edc1",
    "sha256": "6f9eadb80b9ae3cd94388659cc63efb8624dede809c2cc8f2b602513ca27b75a"
  },
  {
    "file": "public/art/game-tournament.jpg",
    "blob": "c3e0f1d970cb3aac300c448195bc7b821c3aaaf0",
    "sha256": "65f9f0d72355019a4b1a7dd3b68b5e59a19b1449e644f4a7f74337be5464fc6f"
  },
  {
    "file": "public/art/game-track.jpg",
    "blob": "da32156a32817cc13d413aac88bd02f115c362e2",
    "sha256": "8bce50e71ec2b0a4a2b6a6bd22fef79f7110b37ecaf3cf321bb82f3093b5d92e"
  },
  {
    "file": "public/art/gameplay-01-choose-your-path-1080.webp",
    "blob": "746d6f9040081935498f2ce4d0e62d15d32ea7e1",
    "sha256": "30d326fdc5ea658c283f0aedebd5beaf2f2264bd3614bc11326832056e090b09"
  },
  {
    "file": "public/art/gameplay-01-choose-your-path-1600.webp",
    "blob": "8357ead5c8e05a2a00dce52a942ce0f1e7221718",
    "sha256": "fb26f49621c4a56e5215b516bbf71c2565c8190f917492f86e52b1beb621a620"
  },
  {
    "file": "public/art/gameplay-01-choose-your-path-640.webp",
    "blob": "9c17856ae43fdff3afd6c522165839024d0eef9d",
    "sha256": "ac35b983985b26a24d3856cd22893845978dfc5ab7fa72a74a88d276a267923e"
  },
  {
    "file": "public/art/gameplay-01-choose-your-path.png",
    "blob": "385e7480324dd7fa7f2cd914f1edfcf4a840bdf8",
    "sha256": "b56cedce0f70eda7c3ddc03985d5f896612ba32a91278dcd00eb1c1f409a926b"
  },
  {
    "file": "public/art/gameplay-02-the-gun.png",
    "blob": "ee96dcd363062ae8f945ca74c96a151e4d5a4b44",
    "sha256": "23daa219f30d8f68e3d74b622b08c0791687da14c9fba8f89c97c5a6703b2207"
  },
  {
    "file": "public/art/gameplay-03-the-ledger.png",
    "blob": "9aae0b4bc9aaf63e24d45bcd85f24236c5fd6c54",
    "sha256": "3e4259f905c2aa530651233c965ea1096f0fcb1e398d75d27c672e4f14e6bc43"
  },
  {
    "file": "public/art/gameplay-04-the-kitchen.png",
    "blob": "2563f33f7a662cf5bd261c4456842f8f53ecc2bb",
    "sha256": "06a91cbd9a5427acc612cdc1b3b410231a019c263ba6627ad1bee64227333520"
  },
  {
    "file": "public/art/gameplay-05-the-wheel.png",
    "blob": "8c7cd5c939031ecbeffe02e4a740d91e66a36f26",
    "sha256": "20b5b3719ab7403b1bf4cc64f0f748f59673bc15dd9b8d3ba534180e4c5bcb25"
  },
  {
    "file": "public/art/gameplay-06-the-shadow.png",
    "blob": "9d83b3a2ee28337c239be7e506c9fd2816d34ffb",
    "sha256": "d98e482bd5e278abb83b633f4418669f67a07a756ceadb8eeb319e8263e38ce0"
  },
  {
    "file": "public/art/gameplay-07-the-ring.png",
    "blob": "8ee4eff63691102317baa4f7f79d71c1da38e1a6",
    "sha256": "f3662833ee7f963e76b88cdf26f0e85d5c83a06ef0ba6eb66486fd375e655151"
  },
  {
    "file": "public/art/gameplay-08-character-blueprint.png",
    "blob": "ab35d113d4c47d4df0f934fab3d90f542bb05757",
    "sha256": "972a60e45d414845f1fafbb40c02e2445a21031a6e5b633fdf3ccddfe61c63a9"
  },
  {
    "file": "public/art/gameplay-09-road-to-don.png",
    "blob": "0ca4c6fb4a675bfb3c4309d73a35df3f5d7b46e8",
    "sha256": "a8eec12eed77d7ff373d70821d02b8be353c0edd8757270005e939eeb756bdcc"
  },
  {
    "file": "public/art/good-bearer.jpg",
    "blob": "aa5c28c946613da646b8ce3b022a73920d1fe30a",
    "sha256": "02a156d8edbceb9a1a2724c1967511e9927f05976c7ca2ad2247e4e185c2f721"
  },
  {
    "file": "public/art/good-cigars.jpg",
    "blob": "f99629083df1143a6e22722a622e0625f9c07902",
    "sha256": "838cb1827e9d8ba7f6f4bcf1b9018e4f822282e3a08ac98cb91e2fa3e82b0848"
  },
  {
    "file": "public/art/good-coffee.jpg",
    "blob": "ca0d0daa9ec72cca83d141eb95b3102b00091569",
    "sha256": "96bca659565e7a53dda9f6a1e72bbb50a4abf728f3c36e53540f1c661c1d8c98"
  },
  {
    "file": "public/art/good-gin.jpg",
    "blob": "ac2fafe0ca301e4be78182c850301016bf086439",
    "sha256": "1bcbaf41a2877c2880cc986fd916199f6a393de92c94427accf138e7e7fab0a1"
  },
  {
    "file": "public/art/good-ice.jpg",
    "blob": "7b031803e6951f7e6d908a67934cbc5eb2f27f59",
    "sha256": "7e6068a8d521476836df4c8ea8bf80b7514a2c818d120aa05ddbd810bf6b4209"
  },
  {
    "file": "public/art/good-nylons.jpg",
    "blob": "aba4d58c7256ea37fb44080d51514580cce2e9b4",
    "sha256": "3af2cb0787566f78fc460e52567102ca067840263acee64fc974e451117987cb"
  },
  {
    "file": "public/art/good-penicillin.jpg",
    "blob": "be924804055ed01099b7cca8267c4e4bb3e3cf5a",
    "sha256": "5ef8c1f995c491cfc01b40d40c13d2c832fe30308a498ac3e868acd75367953f"
  },
  {
    "file": "public/art/good-shine.jpg",
    "blob": "a1a632c11e758afe7eb6f03b7193816ba4584ef2",
    "sha256": "39181471dc95781a1f8fde588f0f2ad8244bd059f449117f17286446e1fe9f77"
  },
  {
    "file": "public/art/good-silk.jpg",
    "blob": "50a4dcf6dce3730df62f0573f9a9d740ba1e75f1",
    "sha256": "4ce5540cbd1e2083101dd9c501bc03afd87001c4b06cfe61325bb663a7c6c863"
  },
  {
    "file": "public/art/good-watches.jpg",
    "blob": "cadf689bbd698f7c1c7526072faedfb18bf68541",
    "sha256": "3c662395e7247418a672b45ed11d182c173190dfe66e254d7636e11a7eb49ae5"
  },
  {
    "file": "public/art/gun-alleycat.jpg",
    "blob": "fa7ae3674c2a376d00799709f66c1b7544c3c21c",
    "sha256": "66fc6042c4779dd481331830db89932c9a4474726452e7df7debc8efae3f7a73"
  },
  {
    "file": "public/art/gun-anniversary.jpg",
    "blob": "ec5fa05f7f34d17f29a988fa7b6bcd9a604ac6fb",
    "sha256": "deddd216f14fd785a814299a8853cf7eda3a8cff0b6b98639949e19e1437c598"
  },
  {
    "file": "public/art/gun-argument.jpg",
    "blob": "c9c466c35d45f5e1ee414f14f7c777bf6f1574dc",
    "sha256": "d4c20deca5e59cfafe98e1308b3e36780493b94dda2420866aa038c997826c41"
  },
  {
    "file": "public/art/gun-badge.jpg",
    "blob": "2f7424fdd3ea69b31c65c02b1ce56826c6b66286",
    "sha256": "bf1e862378ca9fdc78fbd46a038a3395d5a59c62cff6355fef5961d3bac9199e"
  },
  {
    "file": "public/art/gun-broom.jpg",
    "blob": "65bd5927b7a035dfe683c3917a4f8423ca6555a2",
    "sha256": "cf97d1914aa950802f6d7bd8d6c19ed86a7bb958c0d8294ab023c6304ff6b5fa"
  },
  {
    "file": "public/art/gun-brothers.jpg",
    "blob": "74264914f0bdc3df3d66a3e8088135326e882c08",
    "sha256": "4093d2088c402b7871c9a71b9f250ac12bc8fe1d5f8a35b1d4e429f732da4928"
  },
  {
    "file": "public/art/gun-chorusline.jpg",
    "blob": "ad09b11afb276c55d48edafd04599f0a1a579a15",
    "sha256": "d86a82f9192179da9acc4523158a1a0943a5b1f79b824286eaba0b2c7475285c"
  },
  {
    "file": "public/art/gun-doorbell.jpg",
    "blob": "27964a5d8b40a25361825bb54ba7890ae17bcd59",
    "sha256": "cc5bcb3aee2f1756e7994d5efafdd21f54067b25e8b2e923f319307a77c65d05"
  },
  {
    "file": "public/art/gun-lastresort.jpg",
    "blob": "a0d541c33d501a99d10b3e4f3f2ae04692357a71",
    "sha256": "4a667caffbe8258b013cc530e82c24efed3262258af1920283741226f7b897f0"
  },
  {
    "file": "public/art/gun-orchestra.jpg",
    "blob": "177889be0321557b0dede579914f3cd2064c77be",
    "sha256": "a1fb23deb447afc679e5ebc30cdeb1c30912f4dcaa96ffbfa5956362114ee256"
  },
  {
    "file": "public/art/gun-penny.jpg",
    "blob": "0a881c4871a71e3c30f37555d6a700aeac78a55c",
    "sha256": "846eaf52ca9a8fa1e15cbd2fac0fbcacfd70fb6d222c7781f13d0d8d07a8d1ad"
  },
  {
    "file": "public/art/gun-pocket22.jpg",
    "blob": "347f71f7884daac5281a9d9c1be7e334c14d2068",
    "sha256": "c082904c65cb9f9922f6f3ac3711b91dff13e26e4bedcbc31336e5a8e95fd29b"
  },
  {
    "file": "public/art/gun-rancher.jpg",
    "blob": "ff4a110f7e6a43737d617d6dbad9aa19b7613afc",
    "sha256": "0ba1a63e2f629812ec1cab48581a16785377fa9e3b99550307e2db9753047873"
  },
  {
    "file": "public/art/gun-undertaker.jpg",
    "blob": "71f5f09b13dfd33c6244dfc0391a8c6f0ff688af",
    "sha256": "1ff2e23dba34b8b300deeb649b36999430168d542a52b4c632723467b46df37b"
  },
  {
    "file": "public/art/gun-whisper.jpg",
    "blob": "1866f92bb1e9a451db6938bdd40937443ab56563",
    "sha256": "a65d90475d3ed69bcad3d1a8eb63d41c7d56fe5d4c71b1cd28ac28766f950325"
  },
  {
    "file": "public/art/heist-armored.jpg",
    "blob": "c597d60a6a701ede89bb33274bf39251bb1447ae",
    "sha256": "936f0e3d0a4945d336a2a0d36fefb258c42b294839d41296e1fdf400c6580037"
  },
  {
    "file": "public/art/heist-casino.jpg",
    "blob": "b4f3e3e2d1212ad5f976f772b12bdf3337d79588",
    "sha256": "15630cf3e985410ad733d8b084ff35066de3d4106d68f62281e383e16b35d80c"
  },
  {
    "file": "public/art/heist-corner.jpg",
    "blob": "5a3cc2c917c5f8f1e22f76b2244abbc49ae51297",
    "sha256": "feca5d08e0b7c504caa9df5e2c06ec03e3769faae7da66ed708d12a84ff6cd24"
  },
  {
    "file": "public/art/heist-diamond.jpg",
    "blob": "b42128364ef4a4ab672fd425f48140023a223d58",
    "sha256": "57e8121be35537fc2b786b8dd8efd0ad90e34014ccb046fa8c137d1062d3c583"
  },
  {
    "file": "public/art/heist-fedtrain.jpg",
    "blob": "f340e01a85ffcef4b4658684016fb9f06ce5be8f",
    "sha256": "a993180ba1068fb4a5d51bd620e3b9fe1141ea21f2459e22d6c3c7084d55a5c3"
  },
  {
    "file": "public/art/heist-goldvault.jpg",
    "blob": "3f2d0ede43ddd376e24ee16a76c946b161bf0afe",
    "sha256": "93fac1e85c99befd49fb369bd4c6ee351b71dea309051df7bc270217210cf0b0"
  },
  {
    "file": "public/art/heist-inside.jpg",
    "blob": "b0cad4318cbee12bcd6d960d1968ff5e99258642",
    "sha256": "dcfd6f7649c4337ba89ac43acf803307f7e6d078b65a14f224f2d8f4a0dc5415"
  },
  {
    "file": "public/art/heist-jewel.jpg",
    "blob": "995da617278c2f8b1e1c7160eed519abf01e3d75",
    "sha256": "fde49e832519d1247090831310785a456b41975d864344feb73c6c093c71ab40"
  },
  {
    "file": "public/art/heist-museum.jpg",
    "blob": "dec2b0e08fc1969cf7c5952b6cb46a5c5b0ffd01",
    "sha256": "2242360bce5fefcbeb4a33313d4fe2f03c63486db813d38fea7e9a9a2384e7cc"
  },
  {
    "file": "public/art/heist-payroll.jpg",
    "blob": "2d4c097bcc9cb7b8a0674d8c2e659c98001478cf",
    "sha256": "5a298b1e747f193391ed56c29144c2d879ce05b16a2504e6e5770ec1db9b031e"
  },
  {
    "file": "public/art/heist-thefed.jpg",
    "blob": "b1e4ea793a03a90d277e5dbc3760b5a8da8e4793",
    "sha256": "b8c988fd65dafec4f639ee7fe8608243fa4cd4355a6f150bc730b6a1e7f71281"
  },
  {
    "file": "public/art/heist-vault.jpg",
    "blob": "dda59764a75131f815755c1ba341366d4015f8eb",
    "sha256": "a910e5e3b6f43966c49dc0cf45c6a29e690e7ca744f03492e96ed1284740f481"
  },
  {
    "file": "public/art/hero-ambient-v2.mp4",
    "blob": "e9c0927d6bcae86ada0aa428eb4e77065c1e2481",
    "sha256": "fe9ba3602ed930ca87ec9ec407f743210db9f3b40d30100ad080602a50aedca1"
  },
  {
    "file": "public/art/hero-backdrop.jpg",
    "blob": "ce4ba055bf1ca00aa4668d534f85cbb1861cbbea",
    "sha256": "7e23bd41d3a1c4f40b107c7d2b8380a9a7d6d1b08b9f25729e281168084569d3"
  },
  {
    "file": "public/art/hero-poster-1440.webp",
    "blob": "34f2955b75c1f393da5b733d1b7a7b23a73f26b6",
    "sha256": "9b5033f57d306547a25b044581a37d0391cc697c04f6fc032e1672dcf4dceded"
  },
  {
    "file": "public/art/hero-poster-1920.webp",
    "blob": "420b0197195d0f25a4207bafe6931da022bf1bd8",
    "sha256": "2222cf21ce641667078cb7d5c13834c7df3a54167f82a79b7013bed96b520503"
  },
  {
    "file": "public/art/hero-poster-640.webp",
    "blob": "12b0511ca8b88118cd8cd4265771b8d9492bc24d",
    "sha256": "abb16ffab218a2fbeee8f75b5e3420dd3577a8398922b511346d61ed11cb9813"
  },
  {
    "file": "public/art/hero-poster-960.webp",
    "blob": "c1b08501213b488df08b8e461f6d06c22ff71b3b",
    "sha256": "afdd5c18fbacfba52fb11a02e184274d721281cc7375e4a034534bc416247ed0"
  },
  {
    "file": "public/art/hero-poster.jpg",
    "blob": "d68085914fb822dd2fed61a2f420e3bcb6466fde",
    "sha256": "41a490cdbd867d4ec97e01c55211b37419dd70f410cc4705da9226d689ee4868"
  },
  {
    "file": "public/art/hitman-journeyman.jpg",
    "blob": "33215d8a0cd63db9a55e3d41f39eaad20bb4b654",
    "sha256": "5b938b50638dd7c33906e8f33f6c420b3b923e510c009cc88dbcd323ef5bbc89"
  },
  {
    "file": "public/art/hitman-legbreaker.jpg",
    "blob": "a384261b80235e43a9127b4ee220620e1abd1bf7",
    "sha256": "38bb053046e4acc1343c3d06e7db1c0a941b39e15476997b8e128b68ed477046"
  },
  {
    "file": "public/art/hitman-professional.jpg",
    "blob": "870e9ec2baf24dfd9ade478b9b70ca58df898a30",
    "sha256": "24f62963543905d59c539b69b1cf4a52bc09277c676763cbfab35e7d8bb782fc"
  },
  {
    "file": "public/art/hype-flywheel-v3-720.mp4",
    "blob": "37dd8b332d5c798c91158d746ff6c008d07ab387",
    "sha256": "9caa233688fae83696fec480af8b7b707109790c8483dd4214ec48ce5d3cab16"
  },
  {
    "file": "public/art/hype-flywheel-v3-poster-640.webp",
    "blob": "f13a5362818423a07d0825960b0d6e9713bf65bc",
    "sha256": "b52e2f30a74ffea3afefead6f4441a47fa0455dbf78d7b131d2b794b78ab0e42"
  },
  {
    "file": "public/art/hype-flywheel-v3-poster-960.webp",
    "blob": "9dc2c85bbe08e6259783a3fabed7fd4c8b96384b",
    "sha256": "659582dcc8078ddee283ebbd2c170463b9561fed4defc839b1dbfdbfaf650149"
  },
  {
    "file": "public/art/hype-flywheel-v3.mp4",
    "blob": "5f87fd6aa4ab431f97627c507361c2282b38c7b0",
    "sha256": "b75df4c4ab6aa9ec1c30de9e5df38be2aae57a4de69b0171945cc39a52dd0039"
  },
  {
    "file": "public/art/hype-money-720.mp4",
    "blob": "4f529b82d5239bd764fbffb5ad79ac8aa16496a0",
    "sha256": "004cb6d722d6895a060691282034275c10a1f8f4a00b5f6e8de8d12601b12106"
  },
  {
    "file": "public/art/hype-money-poster-640.webp",
    "blob": "d90ca98a152d8932aba95d2e83ea9f6bc4b48229",
    "sha256": "72c3a7db9e97e95ba9106621d0c6a003cbf086f6fc9a2981b101f16a2b0ad3f3"
  },
  {
    "file": "public/art/hype-money-poster-960.webp",
    "blob": "21cd3c5e82d82eeaadfa44f1c0f3b51d97c56a16",
    "sha256": "8ce9b1418a8909957002820c2ad8d6cc2e72e9f8c55a9a20a7496778580f5699"
  },
  {
    "file": "public/art/hype-money-poster.jpg",
    "blob": "e650e9435770366b34021f3c0291d71980eaf26f",
    "sha256": "87285b42f93bb45efcee2a98d027746a1e5244953254b256bc201c0b7db4c892"
  },
  {
    "file": "public/art/hype-money.mp4",
    "blob": "9742f603b872fa7bf25f122e372af829f1a709eb",
    "sha256": "76276b0ad4553f112ecfba60c5f6d0c26bb524562b3cb2b94a4f56e2389d2f19"
  },
  {
    "file": "public/art/hype-short.mp4",
    "blob": "5de8a48d79d82fefb8b52792d23e656ab842144a",
    "sha256": "a08f98ba255adf2ec1f308a533ee9fabe617687e1537d7f01f34224484beaf76"
  },
  {
    "file": "public/art/hype-streets.mp4",
    "blob": "b623774174ac043545b6c696cc6598201505e790",
    "sha256": "717c7fb77ce0bdab3cd9756c24b04438f11eb736a7400b9de2f36d9127718153"
  },
  {
    "file": "public/art/hype.mp4",
    "blob": "d26fb8060f3c8c2595c2ee44d09f24b9e8cdec94",
    "sha256": "3031077a7f400aa832b134eb3afb38c5403785a8681ebd40a4ae19b464e84907"
  },
  {
    "file": "public/art/hype/bed-den.m4a",
    "blob": "8b6f6e70f22139b623f391ffe6bf46aff56c8afd",
    "sha256": "429a4622fafe0a3b330f32c68dbd66c73ed275c7aac87f42a617d62408ace178"
  },
  {
    "file": "public/art/hype/bed-docks.m4a",
    "blob": "e3954da6698d64ec5d60f6eed9a8ff62ac302443",
    "sha256": "c8b5e8cf557868d57045e584d5ba68c61897f7d16cdf8c134a87814f093af826"
  },
  {
    "file": "public/art/hype/bed-family.m4a",
    "blob": "ed64077bac65c47e6b71c45a582cbe3d41de9db6",
    "sha256": "0a3bdcc1572503f8efc04d58b7d43a70e1edf9d84f7cb83d5a7f3ac7abe94d64"
  },
  {
    "file": "public/art/hype/bed-law.m4a",
    "blob": "46fdbb694c1392f610f0d94f6f60d8f8a07bd691",
    "sha256": "005d58c58548120165599f4f012f17933575e504ff3a77347e601eca024a3610"
  },
  {
    "file": "public/art/hype/bed-legit.m4a",
    "blob": "9a4ce6cb4e2aa4ac6879f3a7b99f9ad65993cab8",
    "sha256": "36a93819734e2a91a42e9f738c14fbb1e857d14a13aa1b1051b4b25d34ece920"
  },
  {
    "file": "public/art/hype/bed-pen.m4a",
    "blob": "776f9885e22c17d95eb00d2af260c7364774887d",
    "sha256": "8522dceeb96c46ee36796ecdc32f3d5669f64b4417544fc4c051ede95842d419"
  },
  {
    "file": "public/art/hype/bed-speakeasy.m4a",
    "blob": "ab2ce00bb3547fd1532b5658dc19110d8db7dc14",
    "sha256": "69ff0bd18b0ff24b6a672c841e2a7e9aba30f6f5a2f94d1ab0f9289b23f9bb50"
  },
  {
    "file": "public/art/hype/bed-streets.m4a",
    "blob": "ecaf043396ffab31796c3e15a0695a382889143b",
    "sha256": "108474d980883f4afba9f170e6868ec175c170c7ff0401871e6da9e43169bb60"
  },
  {
    "file": "public/art/hype/boat-cigarette.mp4",
    "blob": "d673123757067feef1f36467c846aec83fe6afb0",
    "sha256": "9154df75a69fb21c407f848673a08b5334d5d810ccfa25feb93c614f4084fd42"
  },
  {
    "file": "public/art/hype/boat-cutter.mp4",
    "blob": "df60aff4d98175c8beb34e7ed9dda151e405e8d4",
    "sha256": "89235d7f896389d1c1d9cad5e214a268daf90d5fb5ae195c832bec4248ea4929"
  },
  {
    "file": "public/art/hype/boat-dinghy.mp4",
    "blob": "fad2165868eff97da3589c04f21801f366852959",
    "sha256": "f23d58e89f23e844fe1fdd706c4310780f78aec83e480961d23676d96e4dfe74"
  },
  {
    "file": "public/art/hype/boat-freighter.mp4",
    "blob": "abeab39bfa894d9accd299cb856cb9c6a215e858",
    "sha256": "04b2e725a00e139a905271e84bbbf63b179a710a3fee8b11be8896a465787fb8"
  },
  {
    "file": "public/art/hype/boat-skiff.mp4",
    "blob": "845e9a5ef5999ec90bb500a356c601bf49004761",
    "sha256": "3b4419777481afa8b7d9b55c113b1b6b2b3fb1ef8d06a2f5ba4902c29d4528e5"
  },
  {
    "file": "public/art/hype/boat-trawler.mp4",
    "blob": "f2e47cbd97ede1fc606dd4d3309357a95917681e",
    "sha256": "93bd966e73427d32a90336d4da61a5ecec7ca5f16d16f8e6e9d63231b9dacc84"
  },
  {
    "file": "public/art/hype/boxer-clubfighter.mp4",
    "blob": "fea64827a30a55b39d9a3dc37efb2d74e5c40452",
    "sha256": "c66643265578d9176bb92c7cf7de8295eb6ee7d49938524580715f9a1f56a01f"
  },
  {
    "file": "public/art/hype/boxer-gatekeeper.mp4",
    "blob": "cfbaab67dbc05afb666430f2db56bf468f7199e7",
    "sha256": "b5a099c03dec26c449885912ef2fcf3fb3941ce14f222ffbaa66d2f07f11af0f"
  },
  {
    "file": "public/art/hype/boxer-journeyman.mp4",
    "blob": "cb8d7d0e5f71aaf99c3f7a94e715a4c767b76f20",
    "sha256": "c06154ec2e0ec4df7eb21e41ec29e9526c7e5df1b16d07644aa5a255745a7384"
  },
  {
    "file": "public/art/hype/business-casino.mp4",
    "blob": "0748d8a60d801b5f0ec8d1c063022c7ec76092c0",
    "sha256": "5251463d9d0090360cebcd303556f1a1c655d7da18de1521db1a2b51467cf705"
  },
  {
    "file": "public/art/hype/business-hotel.mp4",
    "blob": "c00030f199dd93284980e451935aea6ba15a17d3",
    "sha256": "d8e35e130e843840c0a0f05b4377091f12090fa12d317b77adb31ece9c02c018"
  },
  {
    "file": "public/art/hype/business-laundromat.mp4",
    "blob": "520f592951673e227fc44bf62a87af9ace468ec1",
    "sha256": "ee137b61ebec58bc7098e7bbda695138734c6649ee4f8d995cc1a1b3228782aa"
  },
  {
    "file": "public/art/hype/business-nightclub.mp4",
    "blob": "5c8d0f2e2b3300a650f9fd93709fecfb8e57078f",
    "sha256": "7b2be0f846571c680c128219633e7de11dcc588db9b1898f3047cb7d10f379d3"
  },
  {
    "file": "public/art/hype/business-restaurant.mp4",
    "blob": "053f41130775f9a67c80515205501e78ec517274",
    "sha256": "0b9caaa03339bb0a1b0bb21d3e54c01f195896ce3a6ea679b6e2dddf354d88f6"
  },
  {
    "file": "public/art/hype/car-sovereign.mp4",
    "blob": "c84b3accd77c5e3df874851885870981822c5242",
    "sha256": "976eab3b1936377a68810c9c1db0eae1449c0ad297749674ff2d12dec2649aef"
  },
  {
    "file": "public/art/hype/car-spectre.mp4",
    "blob": "7ed32d05245fc19300a6a58f66dd34228e828756",
    "sha256": "c9a5fbc810d863876faf0a9b0c7c70df1ca6e40e64fbc98ea08af23e34ee574b"
  },
  {
    "file": "public/art/hype/cine-champion.mp4",
    "blob": "399e7705ff6daecff3eddca779b4edaed68ab930",
    "sha256": "520437538a043fbc1021b501f8820979f0e7f3b342a186b80e78d3a0813d2640"
  },
  {
    "file": "public/art/hype/cine-funeral.mp4",
    "blob": "2ac17b5ae01b0e719cff84101972b86afa6d8949",
    "sha256": "d3cd7deb2660acded01c7094502ed6515fdc130ea3ad3e62e110956cca5eb9d8"
  },
  {
    "file": "public/art/hype/cine-payday.mp4",
    "blob": "65ccd74e97d826de8bfbe441078e062a0ee5b76f",
    "sha256": "73267da10a57c0c4d4b20aab3dc870dabce866f1fa494acb182b6eaad4685021"
  },
  {
    "file": "public/art/hype/cine-war.mp4",
    "blob": "2ed8c2ae1f3646dfc1a0b7b2b00a60fcfdf5330e",
    "sha256": "2d37caefd79ad0491dfe7c7c89b4d794b7cbd7b8a913b11fae513f5b8e318bde"
  },
  {
    "file": "public/art/hype/cine-wedding.mp4",
    "blob": "47a420c716c76e495c2c44d810838f0a2431d019",
    "sha256": "e55e3253047f3376366cd74a7923a1a4e22ca1dad9254af8fb04967cbaad16af"
  },
  {
    "file": "public/art/hype/cine-whacked.mp4",
    "blob": "70d52bb51e971cf49edefb0264b1a34306957577",
    "sha256": "98a38f8d49a96824ac3011db39c03faec1a0c54dc84addf6d4b863319c9faf02"
  },
  {
    "file": "public/art/hype/citymap.mp4",
    "blob": "e281cef0aa4ed43af467be363d086ccd941f80f6",
    "sha256": "424b735587c523d86e09e6ca3f03623e3c7a52eb64acf203085163d378477d43"
  },
  {
    "file": "public/art/hype/club-0.mp4",
    "blob": "7bdccb484b2de106608042483952ab2db9ade569",
    "sha256": "d495fc1da1c5a7ae6909df0c06d55de00d527a0e139f3098dbaa01517bcb2654"
  },
  {
    "file": "public/art/hype/club-1.mp4",
    "blob": "6e0c9ffd7954b710f2bd4a45d389023d36ecb509",
    "sha256": "20adec0e90d394b0f75dc65305fadab578a529c24a1f3fb19f06000b34940f16"
  },
  {
    "file": "public/art/hype/club-2.mp4",
    "blob": "aa9e7c20a1faf99237806b4f7b34c3faa4fb2509",
    "sha256": "993ad170b9893f5a90f1bc297a736032d9b44f6c971de995cc464a08900b3589"
  },
  {
    "file": "public/art/hype/club-3.mp4",
    "blob": "28773ff5f9b8208ab30280aec54a169b55639e05",
    "sha256": "917155070a6dcd63a5e90e666b233958b27495d4ffd5765082f1b40f9ff6772b"
  },
  {
    "file": "public/art/hype/club-4.mp4",
    "blob": "21ca31539b270ec10aa3beb6a312f61c1a4a5e67",
    "sha256": "b96f3c27a34fd9e5a6116acc56d8a40a94b762d5c3ad2483a0529a25d9b21197"
  },
  {
    "file": "public/art/hype/crest.mp4",
    "blob": "3701a294582c5918e34995a0fccf0ae1d71e9985",
    "sha256": "48dd68eedaf77af1394985937b3000376731262a9c522903f4d80914b235e489"
  },
  {
    "file": "public/art/hype/crime-alderman.mp4",
    "blob": "d6b970292adaedfdc5705c1194acd87bd88300e6",
    "sha256": "803c6b24c1f6f40392e9090c3d7815cf1c80107aa5d239243b55922b54c05663"
  },
  {
    "file": "public/art/hype/crime-armored.mp4",
    "blob": "d6e96487f637e335f0a801c86dee82fdba1ffebb",
    "sha256": "6cd39a8355bc16b1c61c0be3ae6e42feb427c32046bcebdf52b7a4892203bb3c"
  },
  {
    "file": "public/art/hype/crime-ballot.mp4",
    "blob": "ea197eca7e3d3517f08c1c3716f6f1621518d163",
    "sha256": "8974f6c10cfbfa3d9357df446bae0a34aa296ab35138aa361713a657e9d5225c"
  },
  {
    "file": "public/art/hype/crime-bonds.mp4",
    "blob": "c88752d843b11e8dd0e22dfbab61de4347a301bd",
    "sha256": "3889d0aeaee68c340e423d419516444cb39793ae74b51dec199f8eb83c942008"
  },
  {
    "file": "public/art/hype/crime-bondsman.mp4",
    "blob": "ab6cdfc3d48f1f24f16e2138b3cf41e7243c76fe",
    "sha256": "1236fca84ccb29acc481c17facb3acb053f354273fb53c1f4b573545061d1b17"
  },
  {
    "file": "public/art/hype/crime-booze.mp4",
    "blob": "a788d9a6cdeed2de20e27e0eb75edf2aa6e0c2e7",
    "sha256": "2b33c39391241a8c2530831372038d82107ebf4206f20c21850f106efef43eaa"
  },
  {
    "file": "public/art/hype/crime-cardgame.mp4",
    "blob": "733e498fb3e9b3a0235dc573faf2d70dbf0c4795",
    "sha256": "0fb3bc9a772d38580ddb11a631fe10fadec2b9653b2e0c2ba057f6eb8111a46c"
  },
  {
    "file": "public/art/hype/crime-cathouse.mp4",
    "blob": "e5ca85ca558ca6b87d4bf1529fa08db4770c8315",
    "sha256": "10636256fb1d9c14b5433a2d10c012c19f767aa093e2280eaaaef9203c99c8a8"
  },
  {
    "file": "public/art/hype/crime-clearing.mp4",
    "blob": "20fc990d29f74f0aae77af369ecf13ffb53d921e",
    "sha256": "95ea36e5fbff984bbbcd038cbbeeaf74945f7d2361f754c049f55354b4872050"
  },
  {
    "file": "public/art/hype/crime-counting.mp4",
    "blob": "d649bbaf40d0fbc7a77b4e810ccc1d96e83daed0",
    "sha256": "963e6eb11387b627a84564ceefc291bbc518f4c645c24ba9af557d08cfc2eb2f"
  },
  {
    "file": "public/art/hype/crime-counting__9x16.mp4",
    "blob": "4e11a8b6ee6257c72f895a4a3a1327ebea94ed68",
    "sha256": "4aa58be46584d671ada83074ead4690c59d536fcf21868e290303b6b4e9f09a7"
  },
  {
    "file": "public/art/hype/crime-customs.mp4",
    "blob": "3e1735ac45ab1e61a6713ae04b4ed018ed3ae2a7",
    "sha256": "ff94fc0a19f76ee70ade39bc41eb56be3d4da9ec88c9868ca2d58312673c2c23"
  },
  {
    "file": "public/art/hype/crime-depository.mp4",
    "blob": "196f488ec711519260a85fda377d4edf4203e03b",
    "sha256": "b9ea1afc44c43dab9d8e21ee0d281c9226f4a1394b8b5a21a7a2b08840a5ffa0"
  },
  {
    "file": "public/art/hype/crime-diamond.mp4",
    "blob": "72aa7959182fe8fcb66499a5b610ca8b74741df4",
    "sha256": "1aa10ac6a4d2a1b1baf4b90c0d59d2ba864094d86fed4644cb99ecdacbb2e876"
  },
  {
    "file": "public/art/hype/crime-distillery.mp4",
    "blob": "e00b18440e9de2d80bc91861baf8648ae73d172e",
    "sha256": "d2eb90e6d04337bd0210011ce07aca166a927ea8b5c61a119618207fd4f24a6f"
  },
  {
    "file": "public/art/hype/crime-fedtrain.mp4",
    "blob": "423ad653dad402c3018ebe8ac2d8e01fb9152a88",
    "sha256": "6774ae01e888095312893bde2411e10b86d0587722eac6f4173d728c9f87909c"
  },
  {
    "file": "public/art/hype/crime-fixfight.mp4",
    "blob": "2e86e458ac1643e0adcb6ec0c28c5946a84013d2",
    "sha256": "6367568c009a068cac3c105def15165b4a7a5d7d2bfdc50c57b37d8f3e02ce4a"
  },
  {
    "file": "public/art/hype/crime-furs.mp4",
    "blob": "bc2e96b2cb10e9bfd4287303e06b2767830f8b14",
    "sha256": "180561d5820b806dfa8c4f0f4181e84b76bcc5cce1a588cf280d49912208f1c5"
  },
  {
    "file": "public/art/hype/crime-grandcasino.mp4",
    "blob": "9efdb8ef59401b375db5dabba89fa4cc14b7b6af",
    "sha256": "4ec5576ed05e5cfa9724b42c49e90be40ea7e12a0933fcac72c389aed72f033a"
  },
  {
    "file": "public/art/hype/crime-harbormaster.mp4",
    "blob": "641ec55638f90636fdc225c2065dc63731f29723",
    "sha256": "a1bf3f3e683a67a58343cc72f09917726e883f893698469df71bd2c1003fde87"
  },
  {
    "file": "public/art/hype/crime-highroll.mp4",
    "blob": "8291f726aa7b77f2118882f05208b8afbd1b4d65",
    "sha256": "8d63ac2474ba44f7f06b7485af9676db8f35bf6a145e9c35f3371bb16918eadf"
  },
  {
    "file": "public/art/hype/crime-jewelry.mp4",
    "blob": "0696604706dfe9cfac939ba03b313d62986b63a1",
    "sha256": "40833c45bbbd04960631de121d68d8023bab8156200fb24973150ef70622395d"
  },
  {
    "file": "public/art/hype/crime-laundry.mp4",
    "blob": "6bc292bb9d796b10e9e0fd457887ae16aa0b3967",
    "sha256": "68341a9c8441bedf78746ef0d321afbc98fa24c28939f5924937a7c68801744b"
  },
  {
    "file": "public/art/hype/crime-meter.mp4",
    "blob": "1a90bdcef8e2da0dc93dbbf0233cd02e9d05fb39",
    "sha256": "882f4c1617920f44cfc6ca227ba38c35594396795cf8c84626c7592aaa955f7a"
  },
  {
    "file": "public/art/hype/crime-mint.mp4",
    "blob": "885cafd6f2fc56b9db712385f71a3c6feaf8532a",
    "sha256": "1b053506e52ccffe6456e8c05eb386522950871f0a3549f9443d4b8fa5b8fc5f"
  },
  {
    "file": "public/art/hype/crime-museum.mp4",
    "blob": "9eeaccdd7655493f332dd63d0aba6630799f7c57",
    "sha256": "bafbd9df5a64a48bc27623081cba976eb556588c22ab32ecdb9d768990f8109b"
  },
  {
    "file": "public/art/hype/crime-nightdeposit.mp4",
    "blob": "b53990f9d2bbc935e9c130127fe7ed8d31d9a8fa",
    "sha256": "df17d6853efbfd2fef751f91b25ac9279dab65bdcab3beb77b9d0ed201035726"
  },
  {
    "file": "public/art/hype/crime-numbers.mp4",
    "blob": "65ac6ad4c76aca61a8f3a3196fd64a470f7b36e0",
    "sha256": "a19955456a3f3ccdd5d51e76b8d9f0fb75141beb3789d3a0ae0007fb8188097a"
  },
  {
    "file": "public/art/hype/crime-pawn.mp4",
    "blob": "6ac4adc1588265fadd377fdbb82d6599e9e47ccc",
    "sha256": "14dcb9c5ebc210e7337e1a521545455155d1ed4ad59b9d7293c00f2bca7ac4c0"
  },
  {
    "file": "public/art/hype/crime-payoff.mp4",
    "blob": "6f1d299e6e6fca9868792de83446fd0f1517eff2",
    "sha256": "9e22ba38658300eb4a72eed26cd388c98774cf603ed8dba9261bb74fc88f0409"
  },
  {
    "file": "public/art/hype/crime-payroll.mp4",
    "blob": "fdf433b706a633b232dcf4da691bb8dcd514f7fc",
    "sha256": "f552f68039534f475d09e62bb54facdeee77f6e433fce869aa8816556c43c0c9"
  },
  {
    "file": "public/art/hype/crime-pick.mp4",
    "blob": "6caad6b8a683b8bfddc82e4a11db02a363d5df07",
    "sha256": "696622f4568b5881f45d186d6d609df395195697c638e8c7b9d0a945c7016fd3"
  },
  {
    "file": "public/art/hype/crime-pigeon.mp4",
    "blob": "45923464e2f6d709e9e71257c81df38cf929ec96",
    "sha256": "27fc6810cc594ec8cd07bee875242a3475fccea149d3fae7658cfc563bb437c3"
  },
  {
    "file": "public/art/hype/crime-poker.mp4",
    "blob": "a54bdf87a664e7e22e967ae9655e4822597d265c",
    "sha256": "722c55c801cbefe74591bcde33abb6f1d697ef269ca742ff0200e50f54524a87"
  },
  {
    "file": "public/art/hype/crime-protection.mp4",
    "blob": "a9879ba9f0cc2d8db26ede64c5f212504ef3b83e",
    "sha256": "518548a2f229acd447b417e8e1f15ad7c82a935d5a95edb8ebb258cd008f27e1"
  },
  {
    "file": "public/art/hype/crime-railfreight.mp4",
    "blob": "f2422dbaee38e528385b9eb5aea762efd07fbd37",
    "sha256": "a8232f6a8299dac9c0888b1c0ca0c4f471866d835afeb6e51277b9ed9f94b6cf"
  },
  {
    "file": "public/art/hype/crime-shake.mp4",
    "blob": "02cf754075c6e83095676247fefb175e3cb0be6d",
    "sha256": "9e162faee0bc94829272e1885ed87ac4bec7043b05f0e43eb1cbdcbe2f60b110"
  },
  {
    "file": "public/art/hype/crime-stereo.mp4",
    "blob": "62db92d539b56fcfb7da949171a13226e0ab5fdc",
    "sha256": "6fd0c244c9f293034f9d0b2c77051c1ca1fa16a5fe3b942ea3eb529a558e4145"
  },
  {
    "file": "public/art/hype/crime-switchbag.mp4",
    "blob": "db742b272f3f37787f26df55fa517f7faef17f57",
    "sha256": "e489e69c9b6b2db1b14fbc4a9528c438e2b76d796b27e4e15079e56eee4ba6b1"
  },
  {
    "file": "public/art/hype/crime-ticker.mp4",
    "blob": "6c40122c25ea2bb30a724e2a0b8bb7b85f8ab65a",
    "sha256": "860c4065093a9479acf29285708ebce646e0b8cca69c59de35860ba8473b5ebd"
  },
  {
    "file": "public/art/hype/crime-torch.mp4",
    "blob": "e9408d0fd9691b1969b3e24919f4aae9c7965750",
    "sha256": "5478cd60a4e36571a8aae1248a41f09b7b30e7f7c6309acb5b6234955eef93f9"
  },
  {
    "file": "public/art/hype/crime-torch__9x16.mp4",
    "blob": "3555d12f951c7579b9559475aaddfb560271ff68",
    "sha256": "0b6b8aa40673c06dbb7ca331fd32316405e6b77d9a35bde9ce1a0f9d3fad3ac4"
  },
  {
    "file": "public/art/hype/crime-truck.mp4",
    "blob": "688f8c73dcaba2daa52dd1f20926704ed5ae7f51",
    "sha256": "1d452354a339a438b4d19e9b6662d05ea1b0aa537f1a66829e90c81eac237618"
  },
  {
    "file": "public/art/hype/crime-vaultjob.mp4",
    "blob": "3c4af615b0b5a78215f56c098ac2cececd78fc6b",
    "sha256": "0b21e1c66cee4e161a46b66c62eb3ad5e2f9a1fd47d2b264f3c4481ec9ead5d9"
  },
  {
    "file": "public/art/hype/district-brick.mp4",
    "blob": "3849a53d1f9d456b78b9327d90e5e44a1f9f4726",
    "sha256": "895cc1731aa67122ccd8bd3c930c21809a6bbadaecaf40ee98f92275e00e7829"
  },
  {
    "file": "public/art/hype/district-canal.mp4",
    "blob": "b4ac6386a48bbb9124e1cb22a100abc280e6c9e6",
    "sha256": "6a308a0f1fbd1637fd760c8b8c96db0eba4bd8cb4e3deaf4901f88e165c78bd1"
  },
  {
    "file": "public/art/hype/district-cathedral.mp4",
    "blob": "a2c95ffac77d8d750280ecedbb458a5b46116c90",
    "sha256": "78e8bbd02c634de0a6f86af71cca4061574d9c35153521194fb3f76a46a4b597"
  },
  {
    "file": "public/art/hype/district-docks.mp4",
    "blob": "3a02708faf63fb589ff691b78dd15fca410944d3",
    "sha256": "1601ce2337cfa0f063e978f9bcf2ff03f691d14aacfd393a4174666a37389274"
  },
  {
    "file": "public/art/hype/district-foundry.mp4",
    "blob": "ca0fa49222ec532b8f003b4b5308699df29ed046",
    "sha256": "c6603c22508e04e1959d4dafbe3a10d57df09477ce8028213133abd1aa6c8989"
  },
  {
    "file": "public/art/hype/district-neon.mp4",
    "blob": "476f8a3f02992ad742fa85789eb6ba5cd3790ffc",
    "sha256": "527f467e51938f6fe5f22ef5b0be7fdab6fd2fedf14121bdfb2cb34c662e061f"
  },
  {
    "file": "public/art/hype/drug-ambrosia.mp4",
    "blob": "7381a874c9b8e8b9da8dd4517d2be773db9ff170",
    "sha256": "4de6569b3260661d646d3cf5e12579c6deb421a1c8bcff1486439e405dbd69c8"
  },
  {
    "file": "public/art/hype/drug-glass.mp4",
    "blob": "142ba206bcb64ac5a368639e4d1e2f2e1483a438",
    "sha256": "dd2878a348376bd86242bb6892c8c4fbafcf35e43869cad7d4fbcf7eced6435e"
  },
  {
    "file": "public/art/hype/drug-halo.mp4",
    "blob": "a791874e4638207bdcce080907587a9e99f0ff6a",
    "sha256": "ba6dd4e59f6ceff20e4d4f24c2a8d10edefcb1c9e6e9b7a5a1a5906014105e7c"
  },
  {
    "file": "public/art/hype/drug-lotus.mp4",
    "blob": "2c9ca8e7ee2c378cdd8b811d078d0b716039092f",
    "sha256": "004b01aa2734128cd44c731141501f6cc23e70a32b0177ce671a743ae42fd831"
  },
  {
    "file": "public/art/hype/drug-moonmilk.mp4",
    "blob": "c367d5d8dbdb55c55e3eac200328b6f919ead10d",
    "sha256": "45ed328aaeca8b347aa836aee0550941c3a3e46d22eea981eed8bec46da9b073"
  },
  {
    "file": "public/art/hype/drug-nocturne.mp4",
    "blob": "d0f551010cbcece6b8ad7893b09d414cf23c8820",
    "sha256": "fb494b3db43ad76a70afac9ea5bade2ead421ec63967dcba425d6a76e02dc75c"
  },
  {
    "file": "public/art/hype/drug-static.mp4",
    "blob": "6c011b78cfb362906e837829e4dada2e3651932b",
    "sha256": "71c2200e3d1b081ee426fa088e3178b2ac5642337f7879b86788546234729efd"
  },
  {
    "file": "public/art/hype/drug-vim.mp4",
    "blob": "acfd9bc8353ba8b2b09ce53c54c04a7f7d6c65fb",
    "sha256": "e8b6a328fae53235babfb39201f3284cd465652d0a0ff5b884995a61d478ffbc"
  },
  {
    "file": "public/art/hype/estate-1.mp4",
    "blob": "8eaadb97b2fb9f5003aa555fa0e32bb71ac41c2c",
    "sha256": "948a0c1c1429a8382196ab996dd891a54b01cc07e90a8299d8d4a69379b0d1e7"
  },
  {
    "file": "public/art/hype/estate-2.mp4",
    "blob": "be778014f1b15c0bb960afd2ac6eada32c3475e8",
    "sha256": "8d29e3545097e141281a4ff411ec828fae110a1539a5b0ccdf444a9311bcc97f"
  },
  {
    "file": "public/art/hype/estate-3.mp4",
    "blob": "7ed5ec02b9d4de87fa39f7fed943d54bdd247882",
    "sha256": "15256ccd200f25e4bb75d070f65f160fb71f82d4cc01dcdc33a48096596085b0"
  },
  {
    "file": "public/art/hype/estate-4.mp4",
    "blob": "fc3a53800b342f63d60e1b7a0ae6e0485b1ed075",
    "sha256": "d3aa2d08d3770c97170ac3217dfb50758f17993a204ebb0101d8450ac78a5726"
  },
  {
    "file": "public/art/hype/estate-5.mp4",
    "blob": "eb35a7ee1ff1649cc065104f7f683ec43f71d32a",
    "sha256": "2457508b2972caf7f23cb431f127cf106a77e0bedc6fdd79a04b5047b7b65550"
  },
  {
    "file": "public/art/hype/estate-6.mp4",
    "blob": "11a2411cbb5a98bb0aae8c7b4eb40f6c440f0b94",
    "sha256": "2dc1d89a5c295be2cb46a8223f0d8d81a2ee3e648a451e36ac8802265d72733b"
  },
  {
    "file": "public/art/hype/flywheel-v3-deeds.mp4",
    "blob": "4cf8e630c657cadff41f732e23f78f1bdf904700",
    "sha256": "5c69c0e197796085efb5cf2c73bd6122b441d76343cce1da1a7874101da35251"
  },
  {
    "file": "public/art/hype/flywheel-v3-loop.mp4",
    "blob": "43d8d1fa5334326a3873abd8ebeedd58899607d2",
    "sha256": "f716f9fd773967d4a1366eba28524f0086a3c4006b9ef7e96fff1a15528773ed"
  },
  {
    "file": "public/art/hype/flywheel-v3-rwa.mp4",
    "blob": "8571467ea5a9b96e3fa3d934885e795744befbcc",
    "sha256": "764975fa3cb588e8a2cae5dbf608e9bbe2092e5b21c6714cbf2024d6eec69703"
  },
  {
    "file": "public/art/hype/game-blackjack.mp4",
    "blob": "fc0ece7fcd28a6488c79a6640d0c8f19d836c271",
    "sha256": "ba3aa74fea0da676bf4e5299eea9206ac3ee2038b8c8d2926482fa1f7ea9f326"
  },
  {
    "file": "public/art/hype/game-dice.mp4",
    "blob": "5f72311e08f326a726853fd7cc71b6d6f97435e5",
    "sha256": "b7a5e3175e1558d9d92967be730b08602b32c1f0cf62e044681305169fb5367f"
  },
  {
    "file": "public/art/hype/game-fight.mp4",
    "blob": "832a13bcc4f4ca0f7cddef00ee9fc942dc47e394",
    "sha256": "1f35031581b968e7bb8c0d66c56f3e738abda947512a0b7e6ecac4987c90894c"
  },
  {
    "file": "public/art/hype/game-futurity.mp4",
    "blob": "b1516c0a64edd26a922fff3c3c68237cf3aea585",
    "sha256": "093e139088963ca8b4d7d97e29dab98459692a63defc6756630276a5673645b7"
  },
  {
    "file": "public/art/hype/game-numbers.mp4",
    "blob": "0bd426dea782aebd9e766b1ec9513600ec264672",
    "sha256": "95d9021320a056bc0404686c2d95fe6e924e977330963ae773fb269422dffde3"
  },
  {
    "file": "public/art/hype/game-poker.mp4",
    "blob": "b730915e05b621fa018936b273c41812dc2c2597",
    "sha256": "bbaf34c0f787af9c2b417132df553592d9f5f0dbe78dfdf8efca2e3261a281c7"
  },
  {
    "file": "public/art/hype/game-ring.mp4",
    "blob": "62f781a614f10f7a3a2bd7b6f5a162fe59f470e9",
    "sha256": "c2e45292108e03283c283e21efa2ca74ac39218b688ef788b3a309df5ec8c429"
  },
  {
    "file": "public/art/hype/game-tournament.mp4",
    "blob": "802a775c5523efe2a8ddab330840f314bd7c6462",
    "sha256": "1c68e3ffe8da9aeaba53e3f8fdc41365b1b29613cc9fba37b8e67aada51e59f6"
  },
  {
    "file": "public/art/hype/game-track.mp4",
    "blob": "3a90d6f111bc721a48bb7742ba3750ba4e3689f3",
    "sha256": "cfc4cc912a692b5b44e1ac62ab36e4421b8058988683a5f33e301cd3bf58da1c"
  },
  {
    "file": "public/art/hype/gun-alleycat.mp4",
    "blob": "a2ca23da562986c539b94672486750ede820e0c5",
    "sha256": "7001a39540097e2031721c95853288de51d9455a631ae14b14993dee33de6c88"
  },
  {
    "file": "public/art/hype/gun-anniversary.mp4",
    "blob": "d0d522e226e1ef28abd912a6e952dc68632fdb08",
    "sha256": "3338e5afae3289cac640b005b9fede2feb70004a37377b2a7319d9bea56169c3"
  },
  {
    "file": "public/art/hype/gun-argument.mp4",
    "blob": "08cf541229c039a239f200cc2ac41bd43bf9d6e9",
    "sha256": "9dd67caac0ffdadd3764f05ebe6288aefd7666e8ff4c1c859617012ebb18a6e9"
  },
  {
    "file": "public/art/hype/gun-badge.mp4",
    "blob": "8bee575ecc2fe16846b6da179a9d5e594008ce82",
    "sha256": "8421c47b4ee8546c88c06e3832bec65f12bfef75c32c38e14420441d13eca693"
  },
  {
    "file": "public/art/hype/gun-broom.mp4",
    "blob": "3eb04de727b6ac412b57a01ff425ac780466f9a5",
    "sha256": "79eafa6d90cab26ca1902b0dc7cd1a29089f36d72655124489ceafa0b7b71f20"
  },
  {
    "file": "public/art/hype/gun-brothers.mp4",
    "blob": "15e7fd3065c2f2f4b410e259988a923a0d11409c",
    "sha256": "f7b586ee91537dbd1fd71421593e829ecce12578043d9d8564c9fd628f25e8e2"
  },
  {
    "file": "public/art/hype/gun-chorusline.mp4",
    "blob": "6f4863be4bd5e1b503f8665631756ffd3f095602",
    "sha256": "fcda2e9fb850683b5876c516d34edcc1a8895f148769f6439d8e248bbb1fa171"
  },
  {
    "file": "public/art/hype/gun-doorbell.mp4",
    "blob": "85ed0d2b270dd7770c97d6d98c0ae9a9bac8e15f",
    "sha256": "52aaeb5af850b242a0952df3027a420088faed7b2700c67422fa8fcde731b01c"
  },
  {
    "file": "public/art/hype/gun-lastresort.mp4",
    "blob": "6bf4c2eab5f494cc36784d42b40ebca6d31ad895",
    "sha256": "038df98144206b5c92e1ee72eb79ecc491af93b5141e8d8799017df659c74aa9"
  },
  {
    "file": "public/art/hype/gun-orchestra.mp4",
    "blob": "ceef63b5b755a73e3d3e797a910555c85e2b4ea7",
    "sha256": "1bc142e758912ac751992fd056222232674ce402cc64b7ac335adda343c41859"
  },
  {
    "file": "public/art/hype/gun-penny.mp4",
    "blob": "f37dcdb7cce26ec7fbe2da6ab4007e5e009e6964",
    "sha256": "20b34a6d8fb4aaf31b035fcb22041ca093495ff2c190bb43602a93472c5bec16"
  },
  {
    "file": "public/art/hype/gun-pocket22.mp4",
    "blob": "f1f9b9f99bcf000a5fd1b86bf760abd279833e24",
    "sha256": "0346d7b609e403b4975bc9cb7da5b85ca850f819c806451154ddcd9dc2a1fccf"
  },
  {
    "file": "public/art/hype/gun-rancher.mp4",
    "blob": "166c886f575eb5ede5a55987ad0667238b281e55",
    "sha256": "4e88f8e944ce005b4c396a5215fdf6bf9ffb43a5fd9ca2b4821fa1a6bd902b8a"
  },
  {
    "file": "public/art/hype/gun-undertaker.mp4",
    "blob": "8e626da12ee098642dc7c3f073ec306de355b454",
    "sha256": "a62aec01dd5b5d933a181c08c271c10f9a1427a040506b6698f1e540e0b5ff9b"
  },
  {
    "file": "public/art/hype/gun-whisper.mp4",
    "blob": "f79bf783c36a7f3843b7c42a25e8b6cfbca1f5dd",
    "sha256": "df221d931f7ad07e9b145d0b22a037e188fce615173d18d4f7f8c698a1110edf"
  },
  {
    "file": "public/art/hype/heist-armored.mp4",
    "blob": "d645e26c86dfb18140ebdc1a08c34617f2ae732e",
    "sha256": "2893785d8a786495c1bf637a385d773eb3088effec064382759940fca7cde904"
  },
  {
    "file": "public/art/hype/heist-casino.mp4",
    "blob": "6b179dd77b9c78280251a8b6b3c40ff663f27554",
    "sha256": "5865e657814ff588e15a5c3189668ee94aef6386a6c1ee0b4f1737a7625a4a80"
  },
  {
    "file": "public/art/hype/heist-corner.mp4",
    "blob": "ec65f7bdc5d4de50fe927df5c4e0c003c1d3d64a",
    "sha256": "8d4992eb01c4a02c6a84e70f4f12b7a16fe1bd7391fe84b59b7add947e7178bd"
  },
  {
    "file": "public/art/hype/heist-diamond.mp4",
    "blob": "f6c63c6c22ede82849f0f32aa3842d485aca55b0",
    "sha256": "b9d435c13c8fdfae9b26f3b3af305498bc1edbe9b950c9ac37b31f646a1f2163"
  },
  {
    "file": "public/art/hype/heist-fedtrain.mp4",
    "blob": "0a8e91f1b163c10c38ad9d1e4eafffa29b3a0261",
    "sha256": "13664bd2a2f1276116a52de47f9c17b6a2495d4b0424e996529e4041bb1950f5"
  },
  {
    "file": "public/art/hype/heist-goldvault.mp4",
    "blob": "e25849d2755b85d049797b3814c90d14193c58f5",
    "sha256": "22c3720f5c15d41dec2917fd3077238924e1c47cacc5aea836b92a2f72d8836a"
  },
  {
    "file": "public/art/hype/heist-jewel.mp4",
    "blob": "89ed367e93b181aa302d5247b34cf2dc3139b972",
    "sha256": "f943cae8fc97ad5e0422e541810eb3a8669a400a6f1d722ff25b21b42e0a90ef"
  },
  {
    "file": "public/art/hype/heist-museum.mp4",
    "blob": "361a84eac8fbe170da56f74b5baa80af5ff761bc",
    "sha256": "112c15e82b0846ac4f596a2e44a39ad4ae5400b88ac3050adb80ec40b6a0d921"
  },
  {
    "file": "public/art/hype/heist-payroll.mp4",
    "blob": "a2e615ee59b0f21b547fd0c4e76dea492a975fce",
    "sha256": "57e0e8f34937bd3b11fe3494b1d9c20d1ae87c8e5706d1c7229554fe8532c9a6"
  },
  {
    "file": "public/art/hype/heist-thefed.mp4",
    "blob": "9ce2b9b97cca5bb3fc966047e223a6a273571c45",
    "sha256": "2e5053e07a90103e5891cc4bacad4e0e792f33f1ade777be7b4b5423436b07f8"
  },
  {
    "file": "public/art/hype/heist-vault.mp4",
    "blob": "b3a570c62e90d6bc6c6bb10ab6d8eebf55f3ea7a",
    "sha256": "893fac6b99f43dd809ecea7272c4676c889af9d5061dec6870ed019316b356c6"
  },
  {
    "file": "public/art/hype/hero-backdrop.mp4",
    "blob": "25394c4421f4df68236f419dc6dacdcff18b0050",
    "sha256": "c1f680fa20d32131c7d3bedea1ad77e59b3dd24427e610a8ccadb36046605d81"
  },
  {
    "file": "public/art/hype/hero-backdrop__9x16.mp4",
    "blob": "22647795a3ab440c573793c7c17c929760379493",
    "sha256": "03068cf91ec0f88c92eec3ce93922541b2b14f69fa932f14e6ebbdc7118acd7d"
  },
  {
    "file": "public/art/hype/hero-poster.mp4",
    "blob": "97f3cffd444ee187a757c36e795766396f9ecfb5",
    "sha256": "170773b7450438f300b859abe71d797a76087a3ef198d29300a97b8f9f5597cc"
  },
  {
    "file": "public/art/hype/hitman-legbreaker.mp4",
    "blob": "2674bc0874e01eb7f33ef274b344a0f9ace85781",
    "sha256": "69dae59294262441f54bd17867144e5189ab3f5d502f929314a0321b30b89ed6"
  },
  {
    "file": "public/art/hype/hitman-professional.mp4",
    "blob": "cdc2ff59459576dc4243f6b1f18211bc5e91787f",
    "sha256": "8b3f002c872f08f965f7b460174e05ea34ef61c690688d6af766b80d2af72efc"
  },
  {
    "file": "public/art/hype/hitman-professional__9x16.mp4",
    "blob": "517824aee543e7e79112b3cb68992f915f3a8790",
    "sha256": "298398df962ebc14cb4b0ef7a9997df4f72e8f074631f74277cfdabbb9a6dfcb"
  },
  {
    "file": "public/art/hype/interior-den.mp4",
    "blob": "75d36eea6fbdd8b809fdf5a1b157bafa8c0d7950",
    "sha256": "fa8e373e92ecf250be87db2d0368de7bf110d20e07186e5bf3f16965ce3a7f71"
  },
  {
    "file": "public/art/hype/interior-empire.mp4",
    "blob": "3c97ab28e411783741565cd077dafeb19f857fc4",
    "sha256": "bd16d17d91e991e7b3984b25b546dd59dc6bfb4c4c464b141bce49fb6d0084c4"
  },
  {
    "file": "public/art/hype/interior-estate.mp4",
    "blob": "ff1124a898145f4eec69a21f4eb4f056251fb65c",
    "sha256": "8670d768035ae40a8d4b6e2dbd0c436433c3ed4a01db5580ccdc131dea0cb290"
  },
  {
    "file": "public/art/hype/interior-estate__9x16.mp4",
    "blob": "5b290f07dfc327882dd5ded948b7fe342b3aee49",
    "sha256": "c1f3fb7c64e747735238eca6f7495ffc69e027fa8027c04476d4aadc42a11e60"
  },
  {
    "file": "public/art/hype/interior-family.mp4",
    "blob": "5295323747fc38549499fe69a9002631a12a1ba2",
    "sha256": "b764c434e5ab6a324d70629a9ff3696863bfd4da0563a2c93078e9e29bae11d5"
  },
  {
    "file": "public/art/hype/interior-garage.mp4",
    "blob": "4964e97713e86a39ddebc07a30552375a80666bd",
    "sha256": "fe2c4fddb4d8efc4006dd62ecf6ca4fea1faaa990391c5d23601f24d8b34ecc5"
  },
  {
    "file": "public/art/hype/interior-gym.mp4",
    "blob": "032d951d9cd1b505293b4fb52e6951caaf49f868",
    "sha256": "0ff266e3429cb68e1f8c9beef1e00c89982073b152441b6598004693ae48641c"
  },
  {
    "file": "public/art/hype/interior-kitchen.mp4",
    "blob": "4ae65a2335addb7495bbe4685931e57bfc738ae5",
    "sha256": "3aa6e28bf795792b7b19f90f1a3f5cb7d9eac29b0bf2be94f9c7bd0bb22d5863"
  },
  {
    "file": "public/art/hype/interior-law.mp4",
    "blob": "8792ab105aaafc4f36412db4f52894441c2499dc",
    "sha256": "d3ef6fb779c838f6bbb310ded1937db791520858aa00ece835f2e773f0ade3de"
  },
  {
    "file": "public/art/hype/interior-legit.mp4",
    "blob": "645aa7f23def82e9deb887cbbac33b1c23b65351",
    "sha256": "3feec3a2ff6bb5084b8d05930e499ae73d8be41192194576128960099bdd6008"
  },
  {
    "file": "public/art/hype/interior-life.mp4",
    "blob": "0ac6ddf80224d618dc92061f5fb8493658aa8dbc",
    "sha256": "dae4d2aa31fd4e9678d8e3af1e749c04b21e142daa21a390b660dec2b01d6832"
  },
  {
    "file": "public/art/hype/interior-loans.mp4",
    "blob": "544b3f49460fab8f681b76fbdd20f88a9b98f04a",
    "sha256": "b5e4d0de6a9b1bc1a42c02e0a715c96cce54eca6d493668cb72e394d0e8facbb"
  },
  {
    "file": "public/art/hype/interior-market.mp4",
    "blob": "36e21ad4ee3c3e002c0c395584aee39c0d80d1de",
    "sha256": "d8dde09c86db9d3564f7a5e0c59e7b7c064bae0b0e42fffb03a5e620a6beabd5"
  },
  {
    "file": "public/art/hype/interior-pen.mp4",
    "blob": "6973d899703625a06ab2b2f750358baffb44e6ca",
    "sha256": "97724d5aa16c70443aadcda7be28ddf0f8c8c7b471d9c9f942c6f3da828ae639"
  },
  {
    "file": "public/art/hype/interior-port.mp4",
    "blob": "c6f1e02b7982e7c6c6f8e2978702997ab09911fc",
    "sha256": "011627c93b95c35a43061e8ff6a6c24bfa2952f5410142e1fb39add2daadac37"
  },
  {
    "file": "public/art/hype/interior-pvp.mp4",
    "blob": "1ae0bd3df956bbccd654d486dae4605969b92ba3",
    "sha256": "c76adab416d93e66f5a566a5ff99945a35dffef857e2496d16fdeb049844582c"
  },
  {
    "file": "public/art/hype/interior-races.mp4",
    "blob": "14e03952fc50dbb857622e67c6023252ab7f0cb9",
    "sha256": "ad9c25d62626e2d945624e0fc3e92ec2ba7275fc121b6ffe7bcf65296074d81e"
  },
  {
    "file": "public/art/hype/interior-scores.mp4",
    "blob": "241126bfcd158b28f816866fa67a417178851596",
    "sha256": "77053b64211d1cafe6818db59a90fcbd71be58e629829898f67b039a56ddd52b"
  },
  {
    "file": "public/art/hype/interior-speakeasy.mp4",
    "blob": "284ad464b15ddc3f18399d67571e50f1b34eb2da",
    "sha256": "61c9c833cb3f36309e273a1794b40feb33e812310cabe48e111626cb22b035eb"
  },
  {
    "file": "public/art/hype/interior-stable.mp4",
    "blob": "a61ee15ec685648c3bd60f3212a7fcb1582df53e",
    "sha256": "6ce426bba25e1e6bcd9333253655e334b053e82f8acb3cc55abb720941f133ee"
  },
  {
    "file": "public/art/hype/interior-start.mp4",
    "blob": "5e62f8a1bd885e99160c823c80df6b0e22529c85",
    "sha256": "1f438eaf130d953ee27f8efbb1fe74e09357901bd714c6d043f1ae4f0585e949"
  },
  {
    "file": "public/art/hype/interior-store.mp4",
    "blob": "1e92c3c50919fe15c668c218ace373c2a87bbdc9",
    "sha256": "89d5bf359da904896962148c2e86d7a1c27584923f70102710071525134d5ecf"
  },
  {
    "file": "public/art/hype/interior-streets.mp4",
    "blob": "8929b49630d28447c25966b9d4e8b61b7ad3dfb3",
    "sha256": "5fe0dc49f98798ed4f9fde243ccb9f6575bf193a7e05d5de99e1cfdd7b2e0c73"
  },
  {
    "file": "public/art/hype/interior-track.mp4",
    "blob": "201fe511aad62ecfd0b4b3d6885ae4b3e27a0a88",
    "sha256": "cb83c75e1994923816634223e4345a1f43ab5628ee8591d5d0b8567f180238c4"
  },
  {
    "file": "public/art/hype/interior-trade.mp4",
    "blob": "2413609d9c85d10bd2aab13dc1cfb4af31a0304f",
    "sha256": "c44f0fd527ad9ad0ecb0fc21a5a9552bfd39705de099f1350945eaef76f46fd5"
  },
  {
    "file": "public/art/hype/interior-wire.mp4",
    "blob": "c679e0ce860e69d3d0226e23d78ddb84bc712fc8",
    "sha256": "782f5b971eb9d9d7b5074fc90b3fce6d2fdd9f040a0dc5ee0817c95b9cbb3f06"
  },
  {
    "file": "public/art/hype/landing-break.mp4",
    "blob": "f69111b4e9e48946742379e370b5169efc73626f",
    "sha256": "088193df3090505ff1dc20d64dd1df0556f4cd061ef83b8689fa188e96619a7c"
  },
  {
    "file": "public/art/hype/mm-auction.mp4",
    "blob": "f3a58e8e63433ac90c8e5a32edb785a0f5855479",
    "sha256": "6ab8a85b378597620e5ab13f1ac01f028ed6001633f0b6daff0679cf5c864591"
  },
  {
    "file": "public/art/hype/mm-chase.mp4",
    "blob": "464fb3fe83b11be8581037e346123fa762c1c192",
    "sha256": "9675db6394860dc1044649d97fc6d9f1c52d847fb56026dbee0831c470d2df2a"
  },
  {
    "file": "public/art/hype/mm-crew.mp4",
    "blob": "0e3887e051c9d901ac6b7d28cb59bc2e8621c779",
    "sha256": "45db986893485a363426734af0bcdf066a1ab7cfcf12b5945685165991296f4b"
  },
  {
    "file": "public/art/hype/mm-family.mp4",
    "blob": "9a4ee2708fd9f094d108597d6c7133ec7c263187",
    "sha256": "46e31b05836c06d8104858858c1b825dc1d85873b176b88d36489a98c929f338"
  },
  {
    "file": "public/art/hype/mm-made.mp4",
    "blob": "0a428c0aceb01c050d843b1c0c1a8dcc58a50b64",
    "sha256": "849312a987b38e6967f76836b6fc6c89cf8eed19a33b1f18258f7d1375aae58e"
  },
  {
    "file": "public/art/hype/mm-noprint.mp4",
    "blob": "45c1d98391a3a750aed02d72b93a02f5a91057fb",
    "sha256": "59f8da78e32c31533526a4fb08d98fba86447470bb3db7ddd04f7660168f7ffd"
  },
  {
    "file": "public/art/hype/mm-pot.mp4",
    "blob": "8203b004b5f98f3cbe277e3dc5ae5967633265c0",
    "sha256": "a0d5dfd85708be10a3113bd6fa23d0611227cc0ca8ba4b30f7a2808c73a82ece"
  },
  {
    "file": "public/art/hype/mm-seats.mp4",
    "blob": "5b41fc4950cc677ec0662fcd27e8abf71559e5dc",
    "sha256": "32b78859dcf3531bd5bd7d949982b59a6a9067a2a3159c7144fe80ece3fb0016"
  },
  {
    "file": "public/art/hype/mm-slam.mp4",
    "blob": "6d5b640954a23ea3b080327c3522f6a7a2e58168",
    "sha256": "fda49b5abb93e3abb6ddb6c1c36a1d20361927d6025a3474372609e16aae0775"
  },
  {
    "file": "public/art/hype/mm-store.mp4",
    "blob": "7a6b5177ca50d427f977b813312dd3920bb9d3eb",
    "sha256": "6446518f138a5f2a095fc83f779182086f7698ac39864dbf3db287efcaa348c7"
  },
  {
    "file": "public/art/hype/mm-tax.mp4",
    "blob": "8ed6dc79ddde12a1ccd723cf9d5e3e5c2ea2c6d2",
    "sha256": "70ac9af2e03b46d1808e47879637c9366c31bbdfea42608e309c8c119121dfa1"
  },
  {
    "file": "public/art/hype/mm-toll.mp4",
    "blob": "398a9b745e7e7b8b98db9568f390b86e1434b18e",
    "sha256": "e0d3dd0b6434083a286b52a98d9383baec54d4e9bb8bfeda1cfb7d0a460ff532"
  },
  {
    "file": "public/art/hype/npc-armorer.mp4",
    "blob": "743ac36f59d6e91dfbd753acd14023d341f5cb90",
    "sha256": "da879155b44c5723d36c9e9b863b1a8f4a54aca7de7fdd82c5fa874ec3f53d29"
  },
  {
    "file": "public/art/hype/npc-cornerman.mp4",
    "blob": "3e079b8ac2910a2c4b0caa66b1fe6cc8968a4b5b",
    "sha256": "48570272073ac9679e972547c0076b40a4d2b94dbad86b2c2d471fa84f426296"
  },
  {
    "file": "public/art/hype/npc-doc.mp4",
    "blob": "feda12bd30f8530cea2f8a5db5618055a5ff364c",
    "sha256": "1655ada0bf1f2c8e1196f5119304072986e2258fd4d744c049d46b894daa44ff"
  },
  {
    "file": "public/art/hype/npc-fixer.mp4",
    "blob": "c9545b8f5052f8f57ed9e182475cd2649bdcbe5b",
    "sha256": "014812dc9566c1f168fb8db191903a5e66b421324f4b6b15e909989abcc801a1"
  },
  {
    "file": "public/art/hype/npc-harbor.mp4",
    "blob": "cf924a10128a2cfd4eb2a1ef8786099e7cf8d21d",
    "sha256": "dacb188a911afbec95bac24dabc6c3a7e9ac4903fc0dcfe546292aa2b5aea5df"
  },
  {
    "file": "public/art/hype/npc-madame.mp4",
    "blob": "1a34f4c37171651afb5674032e117c99f5596918",
    "sha256": "c0082f92b05ea3ab4f2449010e186f040c556453970e380d15b18bbd70d621c6"
  },
  {
    "file": "public/art/hype/outfit-dockrats.mp4",
    "blob": "2869f6a9be04439c59cd9be1dcc2f3c11fac21c8",
    "sha256": "07e323af8ffccb8a64b10a384b74508d06a296b5ae1c9b71d610025f8f45f3a0"
  },
  {
    "file": "public/art/hype/outfit-kryl.mp4",
    "blob": "b77f7d0b239b30ed3e8ae19172422c9fb6ce7db1",
    "sha256": "b7428035470f97ba820fbd9ebb9fcbc8936260b318570932c2558a11a733e084"
  },
  {
    "file": "public/art/hype/outfit-moreau.mp4",
    "blob": "892f6229e74ccbce986b779560e50962dd434693",
    "sha256": "0ecfd330b6b5c60fb3019aaa274005b8a3ff47a01c56838040ad0fb43400dd15"
  },
  {
    "file": "public/art/hype/outfit-volkov.mp4",
    "blob": "fa6411aa52912052ffaa4c11a046a4b2db2c66a4",
    "sha256": "97b007b35ee1a5d6c04950dd77b656db4d4b24e3b720142631031b69833bd039"
  },
  {
    "file": "public/art/hype/outfit-volkov__9x16.mp4",
    "blob": "fa6411aa52912052ffaa4c11a046a4b2db2c66a4",
    "sha256": "97b007b35ee1a5d6c04950dd77b656db4d4b24e3b720142631031b69833bd039"
  },
  {
    "file": "public/art/hype/outfit-zappa.mp4",
    "blob": "3775914558e63cc0a5409d5c08888cb46f141b8f",
    "sha256": "135147fb3a8ccd105745c16b6d53545ec770e0851d43edb3dd76d7e2aa12a990"
  },
  {
    "file": "public/art/hype/pill-agents.mp4",
    "blob": "77c0a0fe0d564c9528149506d1656412f041a802",
    "sha256": "8c9cef3192226b8a8a8d060a6330773a95c1c111b28e66a860a4edce797d5131"
  },
  {
    "file": "public/art/hype/pill-legacy.mp4",
    "blob": "0d5eb0e8fbd8a18063d0d64d971e70802ab50f7b",
    "sha256": "a55dca024e16c6068a609461d26b776c414ee83e20acec5c20eebdcf732f7ef3"
  },
  {
    "file": "public/art/hype/sting-death.m4a",
    "blob": "22d2552d4a8d2494cf0742170a00df82b6fb213f",
    "sha256": "d9db70c659ea5734acaaede0825f10f81e1eb41b31c2ed7ea3a831694b0a1d7b"
  },
  {
    "file": "public/art/hype/sting-win.m4a",
    "blob": "ba98cb705e1f08aa4d3e48d6db9f89b412bc8545",
    "sha256": "caf5e0d00567fc58d3d3a16f5c2eb45330d44a3a2fcdfef3478a18d9b7468202"
  },
  {
    "file": "public/art/icons.jpg",
    "blob": "a9df98fe7d371164388b52fa7a3b2f8790000bd4",
    "sha256": "5fe201089ef2c14be3b0728a02a8e15aec9b066e5906da6b86dae788c08fc3d4"
  },
  {
    "file": "public/art/interior-den.jpg",
    "blob": "1778f02884e6c25f52ef909ab9794d6838e16de1",
    "sha256": "85f199dfcfc082e0e7724b04d329298daf720a05019fe99f0feae8ffc8840615"
  },
  {
    "file": "public/art/interior-empire.jpg",
    "blob": "13b46d8b9f947113f06adce87073e1837a012f72",
    "sha256": "898de5a528e2e67019fffe19bfecc0a7c204024f2c273bffc99e4f31108c8bbd"
  },
  {
    "file": "public/art/interior-estate.jpg",
    "blob": "2fd87e1be9ea48411d8186fe88e2bdc1d7643317",
    "sha256": "9b97781a5dfd930ed4ba42c3749523d1c352675a56d77540fad822cd7eb1e127"
  },
  {
    "file": "public/art/interior-family.jpg",
    "blob": "fcb66cde7b8976d3b0c6e915a9bc288c40395723",
    "sha256": "f613080a80138d443e202b2bdadd33dc11e676a320b8d94e9dc16b44ba18d919"
  },
  {
    "file": "public/art/interior-garage.jpg",
    "blob": "49be4a52d7cbd8eca0e22cb279840e4518aecc3c",
    "sha256": "5cfff5c17959116a350dca18acb5db64759a8716e76ffd288190e423d3017eb3"
  },
  {
    "file": "public/art/interior-gym.jpg",
    "blob": "3d91e08fe69467f3446b9563e125038d55b5b126",
    "sha256": "5d7630ffc961d44662f55039093ce34e2a1d1c6d9cc447dfb694a202deae650f"
  },
  {
    "file": "public/art/interior-kitchen-480.webp",
    "blob": "49c5e5a1ab4256a1b675c4038f8ca87632231d42",
    "sha256": "dd88037f295a80b149c495e31357e569066bff0d4e98d59db86873621831c9bf"
  },
  {
    "file": "public/art/interior-kitchen-960.webp",
    "blob": "955580b3cfcbb0da38af94b1f1e0fa970dc8f0c7",
    "sha256": "24c365b6fdaa14d24ce619dc369233cdd611d2517bcdc0a0290f79f341e4d6da"
  },
  {
    "file": "public/art/interior-kitchen.jpg",
    "blob": "09d61cae45e2fba899db429fdeaf6bab515529ac",
    "sha256": "ff973bc312b9b494d21bd8078e8242004933b817e5fce237a9b21b5b3e2bec89"
  },
  {
    "file": "public/art/interior-law.jpg",
    "blob": "392c34dcbce52af07e3213da8d4fabe1cf0b783e",
    "sha256": "5ef346812dbce0d615c29831784310f39338984998516057338c0ab2d0abbad6"
  },
  {
    "file": "public/art/interior-legit.jpg",
    "blob": "92bc4013a1c95295a95d39b332967064473dfa65",
    "sha256": "0bd31202c1c7e9704f1f26d60bb4661cfb132e18f20b46edebcbbf10551b7b33"
  },
  {
    "file": "public/art/interior-life.jpg",
    "blob": "1ff983bdda864b4ba9a40eb2a8a6b0551901d535",
    "sha256": "d9bda3a882a8eb115eaa4756d311c886fa47679bb305508eb3d04785e6da04e2"
  },
  {
    "file": "public/art/interior-loans.jpg",
    "blob": "fd14958d7f50dfe114d608b71571e1cbbb037c93",
    "sha256": "14efe446bf8187177f103526f88c861e3f4d4e6172c613947e057fb45947fb53"
  },
  {
    "file": "public/art/interior-market.jpg",
    "blob": "6fd1f940eafa02c19ad33f1b8a173fb26b2f3d54",
    "sha256": "a1ce711006d00dd563608a92de22932264ff12ef1149c42b9c5d93263d148764"
  },
  {
    "file": "public/art/interior-pen.jpg",
    "blob": "a98931111a61cb6479b9f9192b18ebaa5b077b91",
    "sha256": "90b93d293a88bb9d1a848db5f268f66c903eb28596254b353c6dd9f709e2f94f"
  },
  {
    "file": "public/art/interior-port.jpg",
    "blob": "de203f14db2eb3668eba758a093a178b312dbf82",
    "sha256": "a96be0cd4fa701374fa9e562d2f92073d2c9cfd96315cc02de0889c7c3dc3905"
  },
  {
    "file": "public/art/interior-pvp.jpg",
    "blob": "b3dc5b6bfa52ba38dd3bfa1091e1aa8b3b9c0c3f",
    "sha256": "9c94d4178bb34f8437080850afbf707211e096418ff9e3bed0bbeec6e9114c9e"
  },
  {
    "file": "public/art/interior-races.jpg",
    "blob": "b8feb08daf01e276cbaf6a246984a24c903a057d",
    "sha256": "9dc311a808a7707f97406671c4ea271814aa4bf714d4796c1d5122753fb1d9cf"
  },
  {
    "file": "public/art/interior-scores-1024.webp",
    "blob": "6c57db58c6d6d1799e8c0338af8e9b384eef1ff9",
    "sha256": "305dacce6b50c717c57781bf01dbbf14c5ddec5ef1b85960cfef5a44f8905846"
  },
  {
    "file": "public/art/interior-scores-640.webp",
    "blob": "cd15d1712feaf9811656ab59ef59f46730761134",
    "sha256": "d94cd6b9e60359150388fbb5017d45ef649dfe6247b98976457fdb7dae25d42b"
  },
  {
    "file": "public/art/interior-scores.jpg",
    "blob": "4048fc458a26991652910b40ccfd5c1c063b4e8d",
    "sha256": "c1ece87a871699b3102750114146d405dbe06001d331291be513d3bbee8b682f"
  },
  {
    "file": "public/art/interior-speakeasy.jpg",
    "blob": "0b61f0124b1502dfd4dc0e11848978c4d17fb309",
    "sha256": "3dcd51586e33e6481d1f661556b3e1b00683dd4299b7e5270e06f42414b7fec0"
  },
  {
    "file": "public/art/interior-stable.jpg",
    "blob": "4767dc6b3406dd7aa17bfa32dca359be690d48dd",
    "sha256": "624cd76abf6a218a16212c8d0c9a42f656c1254f821469c6eb67eeace5fdf170"
  },
  {
    "file": "public/art/interior-start.jpg",
    "blob": "7d9c08ad26e0f4264d36910f68ec28999d370e8c",
    "sha256": "5c06cfb039c6e8fcc9d3c15073df590210c71d092eefe0e1ed37780cb8be7293"
  },
  {
    "file": "public/art/interior-store.jpg",
    "blob": "b21dab2f6c2fa6ed8767518c0a3a983b789ff388",
    "sha256": "53feb7490c8c09fa66906b42d0448c7927746fba0021673796adbe0a01252305"
  },
  {
    "file": "public/art/interior-streets.jpg",
    "blob": "2cd775e35079aa63be336fa07fe7c01cd9d9dcad",
    "sha256": "2621e3d54c9af80c02bf730c7d17f2068e47dbd535e26d78389791df4c727288"
  },
  {
    "file": "public/art/interior-track.jpg",
    "blob": "133166ef1ec55e956864f8b0aa6cb5ca44a2055c",
    "sha256": "bfeb9829cb25a2a58c60bdd5b8861626e40d7edf373677350f47fc6349417144"
  },
  {
    "file": "public/art/interior-trade.jpg",
    "blob": "5186f6ddac173700fb2370e2ca3d2ba3c73a4e94",
    "sha256": "6a8b22e81d3c665a1144896b316d21fed034dd1ce030203a5babce9d37cf0184"
  },
  {
    "file": "public/art/interior-wire.jpg",
    "blob": "f575487cd876a3081453c0334d4d484611eaba79",
    "sha256": "96cf652385d5e37d4d8c8cc03bbc72ea681226e0a2e0f31ab45ac6f33e11d0b1"
  },
  {
    "file": "public/art/landing-break-1440.webp",
    "blob": "d2be596cb1145fa32575168e8f745ca40a213e66",
    "sha256": "01204e428931ba52ba1681b60b5f7d61bcdb155b006b9d72b730933e45f528b1"
  },
  {
    "file": "public/art/landing-break-640.webp",
    "blob": "3e9284b13fff9d66a656fe6b95244111f46a53fb",
    "sha256": "b49e88dba9dbf8721d44846aae897e73424b924359b11d126abb49c14da22c9f"
  },
  {
    "file": "public/art/landing-break-960.webp",
    "blob": "2bc8ed414ef32613ccd10c6bc420d8bd925e9346",
    "sha256": "6642c96ae96a08b37027b461b527321441ca84ff621a5266db411bce19ca61b9"
  },
  {
    "file": "public/art/landing-break.jpg",
    "blob": "fd64b536f7fe01a04c11feadfc95eddd12b3b9f3",
    "sha256": "76fede5b59848b4175f9e472ff86100db8796aaa0d3e2da3ea520393afc5682e"
  },
  {
    "file": "public/art/npc-armorer.jpg",
    "blob": "fbd506c4d2992d2137ff30a46c7edbcce8ef0505",
    "sha256": "a785216ad191126cbc5f1a05da1871aabf05d26e407726732e732cb9cfbb6212"
  },
  {
    "file": "public/art/npc-cornerman.jpg",
    "blob": "7fe6e735580d005f88c586fce14cdc86dbcfc80d",
    "sha256": "b0960118fed80aeca83b1ea66eeb96313c67923cdb897e2bc89e3f14f087e85c"
  },
  {
    "file": "public/art/npc-doc.jpg",
    "blob": "b5bfaf4c85cd921111f63b57693daa852355e223",
    "sha256": "7ad026daf996a08a2c9a954270c9314f9196f45f6279e2f4d5a573e0331d972d"
  },
  {
    "file": "public/art/npc-fixer.jpg",
    "blob": "524478f05965b799a35a8ed38d1c718c97272bd1",
    "sha256": "a033b09070fa6d443f80a0c985f89e0d5af7cee7cef4d0c16141e1386f147dde"
  },
  {
    "file": "public/art/npc-harbor.jpg",
    "blob": "020b0d0b0f6bd8856d346e18d18f23449ce0def6",
    "sha256": "bdbf14c7ca6a3a59ce523a8ecb38f2b8184c0068f9f2f7489d484680e17c2d4b"
  },
  {
    "file": "public/art/npc-madame.jpg",
    "blob": "c1ebd604269fca89be69f04c9d1e17ac85828d9d",
    "sha256": "cc97df252bb9b386be4caa94f37a087cd79b8d6e1c64920667cdee24e45f6517"
  },
  {
    "file": "public/art/omr-01-severance.png",
    "blob": "2778c643caf603103f37383495021139243a2e93",
    "sha256": "7b50aea177a263a567f7800822e9fdef4b33a73bb5349c7a325c54e976c11547"
  },
  {
    "file": "public/art/omr-02-return-velocity.png",
    "blob": "20d0815301bbc838bb44a56488d86acce6caf9ce",
    "sha256": "cc8badf4b7049d03924a0c22ab01e8799fa68f08d68bf3377c1a5315fe2906ae"
  },
  {
    "file": "public/art/omr-03-money-router-1080.webp",
    "blob": "70a580ca727372f1b47a4a5a461b695a69d7ff9b",
    "sha256": "3e24e6b7c875eaf8d23dae22a0f04a2ed7a304ca41341c52a1fc8cd1ffa2010b"
  },
  {
    "file": "public/art/omr-03-money-router-1600.webp",
    "blob": "6fe89257590878269c966fd880d251fc09681ce7",
    "sha256": "bb46a9b457b85eae6f1029f52a70514dbe853b904ee4ff78c5e2977564a5a3ec"
  },
  {
    "file": "public/art/omr-03-money-router-640.webp",
    "blob": "d0fd5584f2b52a6a93472063e29235a6e4d8d49e",
    "sha256": "ffa0e42bf09ebeb91334e8ce9495bc54fcfbf7de071b51b90a71f2b75b4013fc"
  },
  {
    "file": "public/art/omr-03-money-router.png",
    "blob": "376e3c4fecc1283225bfef61daa503ae0ea0c8f4",
    "sha256": "b2bde1b36f447bab45ee0b8ee97e841a13c92915de88111391c85cb31fe0eff4"
  },
  {
    "file": "public/art/omr-04-reserve-rwa.png",
    "blob": "c614c56797f167ee179406a59627944af6b4a049",
    "sha256": "0b64dcd1f9f3b9add006fe8a6e110ff419879ac7ce712b526b1d7f524fe0b86e"
  },
  {
    "file": "public/art/omr-05-ohm-contrast.png",
    "blob": "b1f6e876d1f347ed4554265600a6a85da1fc0196",
    "sha256": "c7d637922bd1f715fdefd187fc54867075088d5b3715b6401209ee421c2a3da2"
  },
  {
    "file": "public/art/omr-06-the-omr-machine-1080x1350.png",
    "blob": "9fa2a4a0760ac4f771372eba06204bb308cf9540",
    "sha256": "f8d21f2a315f45ceadb9bfff613e3ded9bdd8596dc29b4ed3b10fd50a58067e8"
  },
  {
    "file": "public/art/omr-vs-ohm.png",
    "blob": "6346f9062b2fccf9cdf8d7de42694f2096d00233",
    "sha256": "a85a4e065e340bb64a900c41aef8414c804d7bbb64590fdf8dc90d38d1698350"
  },
  {
    "file": "public/art/outfit-dockrats.jpg",
    "blob": "a6f0645ea4cf8302a6a8dbd55edf74d3a3b11ee4",
    "sha256": "930e6d9660ef94d8ccc9ddd3e5ad09bd15f6fd3fcf92934c928de158a6e5c9b2"
  },
  {
    "file": "public/art/outfit-kryl.jpg",
    "blob": "f2240b4ad6f1cc25322a65e5ea9a02e9c8e47157",
    "sha256": "4aa3eeec3cf68e3166a7ec311be730bcd51185393dc5c459b610745283ed363b"
  },
  {
    "file": "public/art/outfit-moreau.jpg",
    "blob": "8f3f89743c24cf0aa4fe4dc9bddfab26ffbfbf0e",
    "sha256": "4242a972e8282e0711c4cf7c51389cffcc58870188423daa858e250f308c5f33"
  },
  {
    "file": "public/art/outfit-volkov.jpg",
    "blob": "413a69606b2fb46a209d00faa132e87cf5730d50",
    "sha256": "79ad42e96420e2c4b11605a4c31e8759fcae536e26a6f2e0d9f8775961e3bcc7"
  },
  {
    "file": "public/art/outfit-zappa.jpg",
    "blob": "e64f2f751f28ff420e09ca2074619293e013aced",
    "sha256": "e2ff851d96e82bb7bfd8356870a4399e1ce32bfd48e6ebbe95f7aff73671830e"
  },
  {
    "file": "public/art/path-gun-1080x1350.png",
    "blob": "fdcdfe9e866f8abf0c49001324347547f58426c8",
    "sha256": "c67bb87c2bb4820d6d2dd58cd9d905ca6c0b1457b1d3766ea5d2c55228ede33a"
  },
  {
    "file": "public/art/path-gun-1080x1920.png",
    "blob": "103cfadb2c8a4604272684178180a6b2954648e8",
    "sha256": "86096b6b05a53421c5325cc1b9276ffa8220561f612342811ef34ce6e280e63b"
  },
  {
    "file": "public/art/path-gun-1200x630.png",
    "blob": "ba7b75edd8675730064815518fd2928796e21650",
    "sha256": "5422339430cc5bc4fcbee6edce90f2d5581db3866f808834dbdd2c6ef33dbc3c"
  },
  {
    "file": "public/art/path-kitchen-1080x1350.png",
    "blob": "e8af4d947f87ea9984f3fbaea8b49e4917d21943",
    "sha256": "7adb66d08f8b12f6f8fd0b86f87c54ec90d93bbf8a981ede7700f99e52857ed5"
  },
  {
    "file": "public/art/path-kitchen-1080x1920.png",
    "blob": "222eb04a1ae8fde2450704d55b842a716046149d",
    "sha256": "4f2a72e0ce78f333eec768cdbc0bf36a5a4e50852ab6c20c0e0f6500a2ac1a09"
  },
  {
    "file": "public/art/path-kitchen-1200x630.png",
    "blob": "e58df5159178723060f02d533e3d8d7d73e59870",
    "sha256": "8d5a9ee075a1cc6f84da59ec7610c11c60e39eca078f031ec1f703aae63cebcc"
  },
  {
    "file": "public/art/path-ledger-1080x1350.png",
    "blob": "3ed6bc6c3607d6549cd21f488c63692ecb8e8e58",
    "sha256": "7477b66abac7cdaeefe697df03fbefc00d7ecb7f1537b97837813122cff432bf"
  },
  {
    "file": "public/art/path-ledger-1080x1920.png",
    "blob": "c84c1babf201f936e93fe082421551e6c96acaef",
    "sha256": "c245c51f5ff5d992d24a363d359ea91018599c55c21c15fcfb9221be9f7368c5"
  },
  {
    "file": "public/art/path-ledger-1200x630.png",
    "blob": "77b51adf1a7648a8afe37e5de51062b00fe86486",
    "sha256": "8ed287f841aa14ea1ae2be787c20abf39135f8f40ffee619984caf1da7aa7668"
  },
  {
    "file": "public/art/path-ring-1080x1350.png",
    "blob": "94e7aaa1f8072f404c6266315746636f24f063cd",
    "sha256": "4411cd4ad2af0647cc47938f3245d46c95913c337f9847015835fcd7b430f368"
  },
  {
    "file": "public/art/path-ring-1080x1920.png",
    "blob": "aee80514ff1d879beb4e195b36f2d9e297ced815",
    "sha256": "38ef5e2630658c08f93573c6307daf9fcd619eae24a1189bb3df2b786a77c71b"
  },
  {
    "file": "public/art/path-ring-1200x630.png",
    "blob": "f5134fb5d95621f470e1ff6a2f53e5166f59eb2d",
    "sha256": "4771d4accfef837eb1c74f8d4f6d5a05fb22027773b29d13602a59f3d0d8d2cd"
  },
  {
    "file": "public/art/path-shadow-1080x1350.png",
    "blob": "e636cda868bad43bb55e052d654c3dc954e429a9",
    "sha256": "ac651b07c9d3e841349f83f9d353b5600035bc085d7265b6f7c6410b20ff56e8"
  },
  {
    "file": "public/art/path-shadow-1080x1920.png",
    "blob": "c32a24607cc9237699ec4c137c79bb72ac3421b0",
    "sha256": "c15162f16ca409c823789408e66b3699de79e9e26496ba69720887bc9ee0881b"
  },
  {
    "file": "public/art/path-shadow-1200x630.png",
    "blob": "71297fd14cfe5b8d5916ae22d02fa0a1b360d543",
    "sha256": "f561a0eefa70c5db35f85fa40d417b1f6eb21f1a7f098b16712de85943d22be2"
  },
  {
    "file": "public/art/path-wheel-1080x1350.png",
    "blob": "f04d03d75d3ea85144f046ede81f2ed61949d7e1",
    "sha256": "5bb30d4b0d930a6a956f399007afb1de5df47e267fea9e3eba382448078344b6"
  },
  {
    "file": "public/art/path-wheel-1080x1920.png",
    "blob": "c2ce813257983904307479167a1f06b2249a6d4e",
    "sha256": "10cf9ad68b25810e08b7e92a114a9e27b45637a8c5913682bb3aa93a90786020"
  },
  {
    "file": "public/art/path-wheel-1200x630.png",
    "blob": "2d00a79860c7b6a3d9d8283a4b70e973bd9e206c",
    "sha256": "c8f8115203eec0f5f8463853130bf2d36ffe17c5a74a12dadccd22b3e2c12500"
  },
  {
    "file": "public/art/pill-agents.jpg",
    "blob": "1c34906298895b4377f74cfc071605c006d99f73",
    "sha256": "713db4f31c3d9b44b0fb9f258b308f93a2cd2e4cd1984a503625fcb4a38224d4"
  },
  {
    "file": "public/art/pill-legacy-480.webp",
    "blob": "94f2eb7cd8630c61184040d7e6bf25034959bc42",
    "sha256": "e5a7bf84a53d78e3b20b2a220fa052c7213aee6d798999452cf1b184ef777647"
  },
  {
    "file": "public/art/pill-legacy-960.webp",
    "blob": "076272ff4bb13094f23d185e385947703f96a34e",
    "sha256": "685f8fbd1217353c8718c60701291273fccfb3a086dc5e3c3f94fafc98145037"
  },
  {
    "file": "public/art/pill-legacy.jpg",
    "blob": "f82c474def4dd49151275458732d812ff49504c9",
    "sha256": "890fbd11e86883bae788fe7b6aeff1dd79fc0697a84ea9d8b760c430e4f3be72"
  },
  {
    "file": "public/art/vest-heavyv.jpg",
    "blob": "6c89682d56e732811a7d95b956e3175c9fbc7693",
    "sha256": "9607ac7aa7b6bf5b112943829d4ce3ab14ecf5ab15bd2c0e835bc4362881b57c"
  },
  {
    "file": "public/art/vest-lightv.jpg",
    "blob": "b2523db6d20ec2ce3784e673e58942080470e5d7",
    "sha256": "563e690e9348294af639ce6fb2c9040ef5056502e5873e802ffaea9aa82c2e50"
  },
  {
    "file": "public/art/vest-medv.jpg",
    "blob": "42ebb39b2a24134960a7be82a50514bcf35bcfe9",
    "sha256": "922789039309a0ba8d04faeb41c3a1149d25aefd5022df67b11f393f29904ef0"
  },
  {
    "file": "public/art/vest-tailorv.jpg",
    "blob": "b1f6da45ad21c101111b808cb8c04df0b0abdf3b",
    "sha256": "c1ce755da54a82ea05d5eec6248f2ee80479d72bb2d2f6942c3b61aa9f51de2e"
  },
  {
    "file": "public/art/vest-vaultv.jpg",
    "blob": "b97768c92d2fac662e9e651e769b2a380571d977",
    "sha256": "b7fe20b3fe130be9badf17c79752abf747db67f8dd35f2079b7d306cee5179cb"
  },
  {
    "file": "public/art/vest-woolv.jpg",
    "blob": "343cb16d8657fadf05a33384883e631d0faa1052",
    "sha256": "4f3b282ed027bc9f90beddba8b8448aa3077575930bcaaad8efe6250331cc41b"
  },
  {
    "file": "public/city-adventure-ui.js",
    "blob": "2bad2af9d460adc61c2f5ffb67d604b015cef458",
    "sha256": "8290c57bc2eb6ce32835e1652296e49d1c913b64a669e5de6414d4a4e43643b7"
  },
  {
    "file": "public/city-home-ui.js",
    "blob": "6e960d635bd75339a547a80116b0dcf289269270",
    "sha256": "08b841347f216a800eebc50763465aa6a92c098afd6156b1e453c2ff35f0a364"
  },
  {
    "file": "public/city-scene.css",
    "blob": "341290cbb100532810be4df24af896807dc44082",
    "sha256": "fc0f263abe4e15b9cba5b5b308f5953717b80617ae719987b71a6ca6d082bdef"
  },
  {
    "file": "public/city-scene.js",
    "blob": "1c0a43f0d3e9a67706ca5eec20f2d64baf259f7d",
    "sha256": "a6fab5d4faecc0b17b8c80f8a2d75b8bb1006dc65da92c0b0978d4e50cb99f34"
  },
  {
    "file": "public/city-world-ui.css",
    "blob": "b4de1210ef45c01972a3ba909c9f4c6a07f4954e",
    "sha256": "c7fb64fc92103baa0f654070ec0b61c72b2d81c3ac731563dff280e46a861cc4"
  },
  {
    "file": "public/city-world-ui.js",
    "blob": "76872f4a6a13576d2d9b631619021ce275a61c36",
    "sha256": "0dcbf85f36dc6961df9a9b6265a4833442dfa6feca50b0687f465a4fa1a49e2f"
  },
  {
    "file": "public/consigliere.html",
    "blob": "558836d13c8f6a0edbfec7e8b3c9a8bd4f3d4fcc",
    "sha256": "0a5e1c8ec92fdd464492856166d1da364686a4e9fd60c7782792867bb09bc0aa"
  },
  {
    "file": "public/consigliere.js",
    "blob": "85dcf79648b8751b9f5a2f83734e1aee5df62e7c",
    "sha256": "65e2c2ced6b9949e71c175e3c7617558c63eebce7527a6243f6e259cba8f062a"
  },
  {
    "file": "public/defi.html",
    "blob": "778524260321323fa8850802d063361873927fb4",
    "sha256": "26a2d48e515fb0f4db8700c2406a12c0da3224907bcb0049734a7f5df815807a"
  },
  {
    "file": "public/fee-flows.html",
    "blob": "2ad9da841ee8aa1b2d09417ab96e80ad1663e280",
    "sha256": "f2eecafe177b5bbf0e97c4e650b36870751f31aaae6579ea82d624adb8be0498"
  },
  {
    "file": "public/genesis-deploy-artifact.js",
    "blob": "4389f751c2bbb594d0aa8fee1a9127dfd8f4a78a",
    "sha256": "cf28ec010278929120aa74e1b064a62ad17649b2815f5a2ba5c1476e1b8567af"
  },
  {
    "file": "public/genesis-deploy-client.js",
    "blob": "0480de8ee58a3e83705f42d81c097f9b10d1a4d8",
    "sha256": "33bfae481ab143bc462c12b99c9ca51706f7b49b89e3785c9097c1f57e3a4272"
  },
  {
    "file": "public/genesis-deploy-vendor/_u64.js",
    "blob": "65193543fa83f2c88a38c250f1dad719564d4004",
    "sha256": "e48c0cfc10810439a4807b46db136ce603a3fa09b62584f513ef2f3ca496af54"
  },
  {
    "file": "public/genesis-deploy-vendor/crypto.js",
    "blob": "8d499a088aaab5bdf5b46ba4f4fbd2e91c083010",
    "sha256": "9211d026c5d21e60e0126dd6f01150d87da5ba7261b8f468215c1264372ff5a5"
  },
  {
    "file": "public/genesis-deploy-vendor/sha3.js",
    "blob": "ed813d18d695d86d2b03783f08532daf6c6a6a7c",
    "sha256": "0260b46f92a3a94c7179958600d7f92469ef2c8f5d2e966bd9a838ff815713e9"
  },
  {
    "file": "public/genesis-deploy-vendor/utils.js",
    "blob": "e0aabf22008c8e4f0f12e0f5fdf952706f0cf50a",
    "sha256": "6939d5778fbd4a10feb224e1b9158ea59fb160b59dcaa43ea2ebb49f85c3b4ce"
  },
  {
    "file": "public/genesis-deploy.html",
    "blob": "ff760c473dbfcaa3a28a6726ff5b490d49d444e8",
    "sha256": "68afba0cd0b8affc3858f4b243f84fee378493edfc6ff7f38bb8a3fe827a954b"
  },
  {
    "file": "public/genesis-snapshot-rpc.js",
    "blob": "dbd15e5cbb94f5283a994e186e1e6f22223b838f",
    "sha256": "d284be80c7df6231eaccb2da27a273448be767de6e62016d798d09f018b31667"
  },
  {
    "file": "public/icon-192.png",
    "blob": "d3c8ea50178cb848c9c33390a776ae997546b34f",
    "sha256": "e0e294fa058fad5ed8cdd691c9da2caeb1f2e5029c7c4b3acbae0f5744d7f2bc"
  },
  {
    "file": "public/icon-512.png",
    "blob": "286bcf11c2041839075a286d3938105ec2191052",
    "sha256": "934737d2fe792274730f437a18f34e8dcf6578ee1c6839af50b5c2084a2d6132"
  },
  {
    "file": "public/icon-maskable-512.png",
    "blob": "2d5c609df610e146fd40b81b18ed287718bcea91",
    "sha256": "f61468dcf88d08562542c0d368dcbc803b5aafa8fdec85fe31186c8740249ddf"
  },
  {
    "file": "public/index.html",
    "blob": "ab9b7253ece151c7fa13051f484fa20fe00211f1",
    "sha256": "9b963c0e87676a7464645268cb1c867b02fd0881a2023fc5f4bd9e0c3b733376"
  },
  {
    "file": "public/invite.html",
    "blob": "b07f1e538492b6968da759e893d45570173878bc",
    "sha256": "55b49c18eaeb928b0ce914b3d2e0617c2fcd7fd3dcfe853dbf78b801ea4247a3"
  },
  {
    "file": "public/manifest.json",
    "blob": "be0b67a274ef9d05f838af7e46ca0597c3afe50b",
    "sha256": "848c3a00c7f1f197f03b374447d60c7939cf39d8897b32fc94af73ece2a07c45"
  },
  {
    "file": "public/omerta-ui.css",
    "blob": "a6f3f6ca2c6fc0de7cbf23fec694f9643c7cdd2f",
    "sha256": "f707521d5fe5258867a881fbd3f3ae59bef00eb07ede60c59f7567067b799178"
  },
  {
    "file": "public/play.html",
    "blob": "eb75b489fbf58dda0c928697d7f7fb8e9b2e2230",
    "sha256": "2600cbec2c1569e0c14781e61c5e84eef8a050cc39beb7d6fece6da05cf984d0"
  },
  {
    "file": "public/sw.js",
    "blob": "0a8318e9a06af3afa4d6dcb9ebc453efa4532429",
    "sha256": "135560540557a483635bff4c9d0ba1fc017dfcceeaa5d77231439fff32959993"
  },
  {
    "file": "public/vendor/phaser.js",
    "blob": "eae45486b1e634facb1f65fc4ee40ad5695750fc",
    "sha256": "e92ddef111ba42e92d316979c732311757093688ea1810591cb7aa2858eba7a7"
  },
  {
    "file": "public/vendor/phaser.js.LICENSE.txt",
    "blob": "48792fed249c6ac1ef1b491f4b22dc8f30af7c12",
    "sha256": "c3123cd25de4eccf1fd5a5a0a6fc872299116d1dbbb48b00f2554a4c35220a65"
  },
  {
    "file": "public/wiki.html",
    "blob": "4367f127fb469ecb756e59f287a2a0e385eb04f4",
    "sha256": "e7a0011beb4a3511cd16ce805de0fa34856b8c293f7ab8878342d9d784f4a4af"
  },
  {
    "file": "public/world-fieldwork.css",
    "blob": "d6229d6f76cd366cd6e7fec5b3521d037b28e7a1",
    "sha256": "d0335dec5ad6a41a56bfe7674b863e485d3fd0bd6d9408281b29d69212625613"
  },
  {
    "file": "public/world-fieldwork.js",
    "blob": "a3fa1a2f384124c85e5484e1f6f40fd694806958",
    "sha256": "643c0844a77493a42ff80c3fb9c6df5ac6fbc1092e36b1da29167349f6593b7d"
  },
  {
    "file": "schema.sql",
    "blob": "e95c5fbfb0686e6ad4b7edc80d76cb04455a5bb1",
    "sha256": "833373245ddb1ce5a3c9ed386a9b3245d81ddb0bdb51e75d1e5ffee2a7684335"
  },
  {
    "file": "src/access.js",
    "blob": "ed904443aead0d4214ea5f9d05d417e16fb6dc1f",
    "sha256": "67375ddb9d5dbef2c1ba4c92ee70677fb8257f094dc1a4ccb816f33ac32f9988"
  },
  {
    "file": "src/accrual.js",
    "blob": "aa53fc3c5074d1281d693bf56573bc2ed6058570",
    "sha256": "0c6393ff9780dccda0eebd9f1533598f1bb2810443b210bfc84150f20fb0ef6e"
  },
  {
    "file": "src/age.js",
    "blob": "314806666a9f590e4755aa50707d40adcfbde0db",
    "sha256": "70aa08ad07eba867d8b4c0fd7ced892e7e1871869c03832295d60ee78331e0ff"
  },
  {
    "file": "src/agentcompany.js",
    "blob": "df06839eae6783c1525183170870c810672fdfb7",
    "sha256": "675f32dec2b9b06dc26dc895c0d2306b44a458883c8f6106321b18b215e5e4d8"
  },
  {
    "file": "src/agentgateway.js",
    "blob": "5fcdd3968495dcee9b038ca8a91672578be093bb",
    "sha256": "7ea1a1e0e572b3b717ed7130879d2bdc56916a2a163483996a0f0d555f6e428e"
  },
  {
    "file": "src/agentoperatingmemory.js",
    "blob": "2e112341b758d922a08d08ebb84b078def583d59",
    "sha256": "050e9ca4eb908b61b16a30361b6ea82eca305c610d21b2ebf58fe8e203b77b24"
  },
  {
    "file": "src/agentreferrals.js",
    "blob": "54d7674fde6c296cd3b931131717c1eedce300c4",
    "sha256": "af073ba04a9ec93fb3d8f9793fad103e7752195a7bdc6622204634200cc3320f"
  },
  {
    "file": "src/agentturn.js",
    "blob": "e36d854151f2eb7893ac951638298ffc4fb0af14",
    "sha256": "8b54b00192e0c191a81e8057a7b8f1ea3a8b697dbce06db438432dd3c4f96270"
  },
  {
    "file": "src/aggregate.js",
    "blob": "e2ca0c59e86121f52bd5bd4cd19579d2d25ae545",
    "sha256": "0c2893cf4f315d0de266f9019b8e8473a6f886a0bc440e839f251584648af218"
  },
  {
    "file": "src/arena.js",
    "blob": "3de611bf5869b752539d8b06307cb2402d1f78c1",
    "sha256": "7a9b3084b925b4a3dd8516e512c0d68497f75870d0eaf73c2b20b094b0f2e6ec"
  },
  {
    "file": "src/assets.js",
    "blob": "bcd7929013ac359df88e9157dd2e49f44d926707",
    "sha256": "799e251d81076c1c43ff1867b92a0fa887b9ae73f87d58d9b1d28388e2369d1e"
  },
  {
    "file": "src/atomic-barter-contracts.js",
    "blob": "0421a0961e44bf35f1f7082dd44b6054b80e35ef",
    "sha256": "47905170a4955efed504416c05f5b75f921f28b25b72c257282107235001a98f"
  },
  {
    "file": "src/atomicbarter-schema.sql",
    "blob": "05f1fd36e5afca89a574132a103dd9159639a654",
    "sha256": "69326a8246d2df9f4bac00f7698f6bef6a585a21b9d12256df17e27d36855326"
  },
  {
    "file": "src/atomicbarter.js",
    "blob": "814ebafcad181fe33c2d853b47d2783dd9c5a2f8",
    "sha256": "857198225b1cce0d19a9a14ec0c5663527ea084b2ed90d44ab5fcc8c59306672"
  },
  {
    "file": "src/atomicbarterinvariants.js",
    "blob": "fe52b79ffdeb305faf2d63495e9370ead3578898",
    "sha256": "9b85aa69ac3841f569957f60f9965964cdda8f22bab81b8f04bfe95ec218b18c"
  },
  {
    "file": "src/auction.js",
    "blob": "23acea8d667c28021717ba57f8a1042abad67396",
    "sha256": "aa5b1931188d7e8294e6c1518b36ea2664544fd218c431ea62cd4b435bfdf743"
  },
  {
    "file": "src/auth.js",
    "blob": "85d8367ef7a4db8d273096ddcbc2434a63c9e849",
    "sha256": "4214410b28d33159b95c4b3c2a203c99694653786a13bf33a835abb7d58a49ce"
  },
  {
    "file": "src/avatar.js",
    "blob": "5b66e2a48ebfa9df8be5bb2cd3a624e453db60a9",
    "sha256": "90304e9c8377ce10f2b30bf55e6fe256fb757802ccc0a9c1645d93f7cea2619b"
  },
  {
    "file": "src/bank.js",
    "blob": "a3951068d3e29576648b002d4edc012907f935d5",
    "sha256": "d27c0d36809fec7e3137e6c9062b889436212441d25ffc9c0cb5e8dfa738a590"
  },
  {
    "file": "src/bloodline.js",
    "blob": "413406b2cfa19250e8bf1221d67794e9730d437c",
    "sha256": "cc8aa7df2c0065e6fce43b6e6117203b2af66e4e3bd102a5052a3d7067c196d2"
  },
  {
    "file": "src/bondquoteexpiry.js",
    "blob": "939d3c544c8008bfbfcbe20cbf0f1e3f250391bf",
    "sha256": "93a280c04c0086449262055bb60c9831909d9d8bcfe967a451f74ffb0bb87633"
  },
  {
    "file": "src/bonds.js",
    "blob": "60e5c62c770a2c32070fef12e3b9fd9f8c8404a5",
    "sha256": "9b65ed3456878ae312f186e9d94c80c2fe194dacf4b426770f0b4355c55608a7"
  },
  {
    "file": "src/boxing.js",
    "blob": "f62a0f67d4e14239b6c9a16ec390228571074822",
    "sha256": "50c085afb038020c0a44651c4350df02f217c7d8cbc9004cf59167d7a3314243"
  },
  {
    "file": "src/brokers.js",
    "blob": "88e34aef59d205019211ef1e448909d549426659",
    "sha256": "7c7fbcdcec9e22f88edff54132a20eeed40564b1f15a083b89f83ae5aba2a33e"
  },
  {
    "file": "src/bulletin.js",
    "blob": "094514f56f811e103c14a3f519416881629f6055",
    "sha256": "fce52a585d7bfd009c1884b00ea61b50b4e9d3bc5625ccc7e104207d31ce38d9"
  },
  {
    "file": "src/business.js",
    "blob": "84d29c9b71ffeae2277bb54896942143937c2b75",
    "sha256": "ab4cb2d68d3442a8a1ec9587359020016888317e2afcb7835e769da8ad01587e"
  },
  {
    "file": "src/businesspartnerships.js",
    "blob": "25ff69b54ebea5284604ff2104b4c8c4d902bd66",
    "sha256": "c17202bf8ed42fc109873b13f4412e10857c454618f3e36ed272af19509c8e4a"
  },
  {
    "file": "src/businesspolicy.js",
    "blob": "6653cbf83b4adc1b8634b9949275ac60323ef22b",
    "sha256": "773012d9e65bbb7062d7e1428aa69e5e9014d84f1c60f11829e5044db5512def"
  },
  {
    "file": "src/businessrelocation-contracts.js",
    "blob": "69c7a058c4174851bfb221a6f2ac9af3ce570d3f",
    "sha256": "d7fb4cb0bbd34af21f0205b1406e9e5e38700320de2ac59963bcbcf7393a0b7f"
  },
  {
    "file": "src/businessrelocation.js",
    "blob": "61a1da507eaf840f7b72d2f4fa2f8dc3233f7000",
    "sha256": "20313c027e2e2adb33539f63af296347e2b415a16bca63440caf34d592e52dad"
  },
  {
    "file": "src/businessrelocationhistory.js",
    "blob": "5615c94dcd61c99ba993cdba1bc0d7cd11debe8d",
    "sha256": "4a3c0c9bc21f3c610f4f496bf21cf5f483277fb17f10f798728c2f7111646cd2"
  },
  {
    "file": "src/businessrelocationroutes.js",
    "blob": "e8cf9a1034e2810be5572a4f2eff2f6e6c532178",
    "sha256": "895a80212b045f46faf057bd773df3525629af848f55dbf752c0910dc31bef19"
  },
  {
    "file": "src/businessseasonrunner.js",
    "blob": "9682a5e765a42b8921636e42c1066e7503858577",
    "sha256": "2af1512b24c242befec51a35b62ac52991501cd991458e9277931b71932d3df4"
  },
  {
    "file": "src/businessseasons.js",
    "blob": "6a383e0c39ed956a79c85925f09f21f013dd152c",
    "sha256": "8687eb2313330e63e6c5d8bc1a09a96f4c9edf4f4b45f3f55070a3284781310b"
  },
  {
    "file": "src/buyercooperativecustody.js",
    "blob": "cb155b3be3b9446368b9a5d22540919b5fe3c833",
    "sha256": "de6098491331729bc4463846ac872d672370a7a0005c2fe97fee77526ca27f20"
  },
  {
    "file": "src/buyercooperativeinvariants.js",
    "blob": "bf57f0a402322eea15c964437099b32012e66baf",
    "sha256": "dea72c180240df1b823e1a6bda43290ad7e1dc23d2a1be37eee58902e20ba2c6"
  },
  {
    "file": "src/buyercooperativerunner.js",
    "blob": "82519b8f64894b7270ab25a8b901152b376ac6cd",
    "sha256": "274dd8ac2835e1549990f9d9daa64950a885c77a4bd57b9a8d473510c9e0d39d"
  },
  {
    "file": "src/buyercooperatives.js",
    "blob": "923e801e0c553248d073147b94b4c0fc0f07d172",
    "sha256": "b27c33bde5a7a289fdc1ffdcf497a3d0856d88a6a55c9f9c2be155c96c15f178"
  },
  {
    "file": "src/campaigns.js",
    "blob": "427c17ebb25d01fffb59d0cf0f47365654fdf726",
    "sha256": "58eb85e1d26a7506c75004e3e6adc802b3075ee224d58970893c53951b98e5e9"
  },
  {
    "file": "src/cardpng.js",
    "blob": "22c89d629978c14e87a8ee0a58978230d71e2571",
    "sha256": "7f48500778aee0a07f5266943c0ad5674b9b2c913d08362fc8d01b6d6dae213b"
  },
  {
    "file": "src/cards.js",
    "blob": "f4f5822c614ef8e5d35c40ce434625161daea65a",
    "sha256": "68290db71cd56b3f34f93cd01ad3e63555e9e7b812c369a2a384b364b78bf6dc"
  },
  {
    "file": "src/career.js",
    "blob": "ea3123ef9b5bd5a222dfeb57f9174fc8548e5710",
    "sha256": "0ba5780bc665fe02e86e074cf9738fa4c0e9dc5aa3523d6fd6530558fe3c0f76"
  },
  {
    "file": "src/casino.js",
    "blob": "f6f2fb65754f002d367ef67c9fb1bd6d4d834ed6",
    "sha256": "d3f4e7e9823a4d9767dc56251945116b4ed96b16dd23c831d4380881dedef284"
  },
  {
    "file": "src/chain.js",
    "blob": "dc022999473e6f659caa828cf664ca113a9ab1ec",
    "sha256": "ce07b1723a4657326ea37ab40010843b711aa04834b14950ffc0e2568eb15110"
  },
  {
    "file": "src/chainparams.js",
    "blob": "465255dfd80a2b50f6cf8b1ee40d846c3058b5b8",
    "sha256": "0a215feed9ffe1ec5b81e82ba4b586c1e7f645ecafc64ad009bf709680eb13b5"
  },
  {
    "file": "src/circle.js",
    "blob": "ed73d1a699ea3ec387911ee1dd09f6d74c3466bb",
    "sha256": "247e70927b65b6e9a2aad3148e788e78de28f7279681d0da7652268b89034fac"
  },
  {
    "file": "src/city-encounters-contract.js",
    "blob": "142b567655d26f750f70efc16293d5ae9194eda7",
    "sha256": "4de346149d9db9a691325b72857d14c7d5bd82907d1d31993258884336b66eb3"
  },
  {
    "file": "src/city-encounters.js",
    "blob": "ba952631f9acb6f70214e0e03604cd79f8530317",
    "sha256": "f239e29c5ac9ee5403b59bab1a6a36e821e3a0b3dd35f0f283605255956ea7ef"
  },
  {
    "file": "src/city-home-contract.js",
    "blob": "027ca49c716697b469ff656e272f0c3115bff823",
    "sha256": "69bd603460f9570b3b7b82057bf483174c99f2febf633b572b4dc8769949eaac"
  },
  {
    "file": "src/city-home-interiors.js",
    "blob": "a08ad32756d829209126dda0618c7c99a28ea867",
    "sha256": "57f65837192bc0def3708e074db63aa60c90b8198064fa73ab35c8523871e990"
  },
  {
    "file": "src/city-home-migration.js",
    "blob": "b7ba89b6f0f8baedb41a9f3b468637f20c5dadf0",
    "sha256": "0d9609c6d5fcff0aa2e64f91fdd7167376281b436e4fd62617fe7fe5a8c9c051"
  },
  {
    "file": "src/city-presence.js",
    "blob": "d04affe148c1e76a00908472431b76dc944a849b",
    "sha256": "b137ff07da84e23f20874379b26e0873f47fad2810c19bbdc909a88294e49e34"
  },
  {
    "file": "src/city-social-contract.js",
    "blob": "d1f57b8514ac69d9a4a02db9207aafd67aee44f6",
    "sha256": "2bce36dddc2c14ff04d52a1a02ed78ffcccb50811d4c814ff9c5e84e0f6f7452"
  },
  {
    "file": "src/city-social.js",
    "blob": "db8a77a27764c9dad05bd5967003eb97e88aac92",
    "sha256": "2ac9d8cad9b0e940f9ab177c4d6228566aff31e0a3f31e42bfc581048d748434"
  },
  {
    "file": "src/city-world-opportunities-contract.js",
    "blob": "b2ac33d345532a0815ec44a5843d7bf425ba24a8",
    "sha256": "eae923c3f1495f76b3b1e401acbb4d0c5b40f67e0821666b4846812e1b2c8207"
  },
  {
    "file": "src/city-world-opportunities.js",
    "blob": "d227eec8b92a0511b401f060e1abb429ba893d91",
    "sha256": "5ab3f626a5aa7ea4fbc150ca70739efa3ddc9dea152e79dcd021c26ec2b0792b"
  },
  {
    "file": "src/city-world-opportunity-adapters.js",
    "blob": "99cfcd1332721a75d45fd37d0da94195e2d6a59b",
    "sha256": "f4beb8f839103808790e05e2a6b4ff920b0df11d739623c050080d11a0a800c8"
  },
  {
    "file": "src/cityhomes.js",
    "blob": "3692679d2be059fee55313e61c831f4ee2f980ba",
    "sha256": "4748763673b2f1896459921c88bf4162dcc6f78bf3230388a1825ea062caba98"
  },
  {
    "file": "src/citymap.js",
    "blob": "06b3bb9b984f7e42791949beb076aa4c63d34eb8",
    "sha256": "7a20318ddf76569f17e64a8897095166e367449531e3e5a8d3b23b0dfa702279"
  },
  {
    "file": "src/citywide.js",
    "blob": "98ef162ec9b11c0cce98f15f321c443fc8af5d10",
    "sha256": "079b825af50904fc805b84b48b97620d5e86f1c52ee488270732b8fbf6beff7f"
  },
  {
    "file": "src/citywire.js",
    "blob": "e6e0d47d37d434a3c12be49d9ade6bdcfdbaa899",
    "sha256": "b0b15bb957a70ec547ad57069b797f81fe618b267dfeeaec4f3711d9d42623e6"
  },
  {
    "file": "src/clues.js",
    "blob": "cefef460aef45f20fe05dd5d188f93656ea205fe",
    "sha256": "c998dd63e1d99f6ab416036bab3ccbe213f70429bc67db66b79b02a3641fd28d"
  },
  {
    "file": "src/collection.js",
    "blob": "bd4dc5f3688313859040919b6c6d0da8f65ac76b",
    "sha256": "6251b95099c557b73d9c1d893e50ff14c0b6b7af575d605c005325c99164e054"
  },
  {
    "file": "src/collision.js",
    "blob": "d124daf143dd63535a9f1ee24d6fc2dae84ae5fb",
    "sha256": "f26937bad8d9cc5c1d79579ce3b587c1aaeb8b0ff9725806cf0a01f2d63336b9"
  },
  {
    "file": "src/command-diagnostics.js",
    "blob": "b8c1a37d68f57e2d24ccb82a946d73532455d96b",
    "sha256": "bcd1125843f95e378fc30b5de673d5e919ac423095ff38385cbcb7d48de8b8e5"
  },
  {
    "file": "src/commercialdisputes.js",
    "blob": "8d31b3c8c2737cb70b21014e7bf7822d24e03a51",
    "sha256": "6529aaaf9296fcdaa13a48c038bf551a0307b52f646f6ab7dab115ca202529f7"
  },
  {
    "file": "src/commercialnegotiation.js",
    "blob": "3c10523d976044dfc36c24d5ff9ce5e3bed23553",
    "sha256": "934f71dff5aa0b1593d322611df82bceb8bdf3c7b0f27bb61968907f4c3cb36a"
  },
  {
    "file": "src/commercialpremises.js",
    "blob": "832d20613506288c246a1e297752533f3e95c27e",
    "sha256": "b39282b8270986419141f830ab31404d63e507a841653fd9cea5b948697fcb28"
  },
  {
    "file": "src/commercialpremisesinvariants.js",
    "blob": "0773ae9a74173fbb33ab390f7025643fd833f671",
    "sha256": "678d8f58531280e3c94f08564b1935d521a3168b552ee5440b6400f26f00cc2d"
  },
  {
    "file": "src/commercialreputation.js",
    "blob": "1e18f49b493b09567e8059c3af37ae4e8f23993e",
    "sha256": "5aeec43fc221717b8197fd69e355474dd476dc96d0f59c9e24e41561d3a00d5b"
  },
  {
    "file": "src/commission.js",
    "blob": "f78caab0a3d50d8a0c95457a32bf666dab97480a",
    "sha256": "7e1aabd4aea45dc32ff68f3ba9307fd8e6a3794c74ad7e9387f308045da5445f"
  },
  {
    "file": "src/commissionedcrafting-contracts.js",
    "blob": "d11aa783c21f1f7ba6735163dcba8ee7f2bac871",
    "sha256": "6607aef15826b9c4c02a6f45e215d75f38d974bc7e8fff6771ebf6b5c4a2a6aa"
  },
  {
    "file": "src/commissionedcrafting.js",
    "blob": "7d9aa0b5b3c5770ee93c57f9f1ab63ee995fb7a2",
    "sha256": "f89a0f1ea30c9a1d299d36710e8d3e6b819ebe3449de1e1837be6213251b465c"
  },
  {
    "file": "src/community.js",
    "blob": "1ad76d1ea82abb2a42156cf8ecb722a16fa7fef5",
    "sha256": "ee646a90535e918d00423f46ab7a2c1a3c7e950641a2b8625833c5c122ac73e1"
  },
  {
    "file": "src/company-autonomy-contracts.js",
    "blob": "50d0e6b9d946016322a65d3c96fbc464be831260",
    "sha256": "f88996fba1060076d3ac0590d7d2578ab5097e1dfd826dcca2503d6944c1a467"
  },
  {
    "file": "src/company-commercial-contracts.js",
    "blob": "cc98b77b2664a60e94a8e7dcaa1ae59a689b912d",
    "sha256": "76a601c3929c223760889185af9fdb184070c6f712445e4804e79e96aad58340"
  },
  {
    "file": "src/company-commercial-invariants.js",
    "blob": "c7d9741cebc641b2afa2b023f4ba826ae9943a3d",
    "sha256": "d9e847ca45bb496f81e777fdb71895cc875a9838055fe65045e42154d4674935"
  },
  {
    "file": "src/company-economy-contracts.js",
    "blob": "7a342ec5c00cdcbf442230299e6e308724a7e4f2",
    "sha256": "2068deb17652c7c9ec4d546eb75b5a41333a9780e9e214a08545603ab9b78c95"
  },
  {
    "file": "src/company-middle-five-invariants.js",
    "blob": "76b11caed7f404fb129ce1f2c16c3b0c39fc3046",
    "sha256": "ca71e3a8d7928a99ca67f69b865f44f149f99349d16fc5dbf6a858e6b870540c"
  },
  {
    "file": "src/company-middle-five-runtime.js",
    "blob": "33ea61f5e842e53c6816f876be901688e69faf84",
    "sha256": "68d1f04fd01a2f33ba50b3747bc003ec7f0f1606dadcb276fbb883b3b523a005"
  },
  {
    "file": "src/company-workforce-contracts.js",
    "blob": "96c39b43e9183881841447552c1fb4957af05926",
    "sha256": "ef5417cf794904dc4d9417dc7e857ecca96b8a4e0e7b21699a20a943f98f001b"
  },
  {
    "file": "src/companyacquisitions-routes.js",
    "blob": "6c9661f506c3ab6116f58c63c0bf2e2e2e9bb065",
    "sha256": "fcb1b9ed9d37e3631aa58e1571d360606db1b832a7d26edf7f48544d7a33e08a"
  },
  {
    "file": "src/companyacquisitions.js",
    "blob": "b5473cefb5ff22503f65ffdf6c392b3a015c3b1c",
    "sha256": "660bba4bc4406379f429ba4245addda2e261d91cd93e2d30bd6f208676808a1f"
  },
  {
    "file": "src/companybankportfolioinvariants.js",
    "blob": "55a943613bcd8cc7f8808fa7e0612863623bae27",
    "sha256": "c85c00835c2a091c735a5e6c05f39de65aad48dd203c46c06216c491d2bdcc53"
  },
  {
    "file": "src/companybankportfoliorunner.js",
    "blob": "a9cd3444093c18d2dc8b0320355bc04b39596a9f",
    "sha256": "b561f66483db1520cabaa48f7ab0ce1b42028adcf4c1dba00e8f257c4e6e5c80"
  },
  {
    "file": "src/companybankportfolios.js",
    "blob": "6abeb4fcc8d41aaeb63c544d9ad4c162e3e572e1",
    "sha256": "7e09433aea45bb81f5443fa070941deb568dfb12f8a61c0772880654600246fc"
  },
  {
    "file": "src/companydemand.js",
    "blob": "36917b603ec4fe01561576c2a890fb7c3cdaa3d2",
    "sha256": "09b6b0fd68269e8ad5fb588a019482f0b275c36c9a902f72ff9fb8ba9a30e49a"
  },
  {
    "file": "src/companyforecast.js",
    "blob": "fe6bd086e151494850c13fcb5a4a0d3a4d3bf2a4",
    "sha256": "77fb60bdf1b3a7eccd33e9c7cdfaecc077441725da722d6faebb296b4e8d827a"
  },
  {
    "file": "src/companygovernance.js",
    "blob": "92214e513e65501186a92287219fd815036f0d32",
    "sha256": "4f8854eb6ea5f7ac53f2c95a49e7f42140add0e8de7ccc2b7ef226057a19a478"
  },
  {
    "file": "src/companylogisticshubs.js",
    "blob": "4392f52826a5d2c56a952e0f2fdb7c7411eb8b45",
    "sha256": "ae00084a30d3c14623d205cf1acc18b95f11d46d3bb5f9a17b03972d56ea1eb8"
  },
  {
    "file": "src/companylogisticshubsinvariants.js",
    "blob": "c34667648726dc2935433b979d5c578dd0fbdc3a",
    "sha256": "503b461dbd8336dd33adbc4dc411c2fbf04d6b1d755129aa6060e441ad8c91e7"
  },
  {
    "file": "src/companyoperatorrunner.js",
    "blob": "f308c771701f6b6b3d09eb001884fcde81968dff",
    "sha256": "435887cff8a69208d829688b4aacb6c418553fe5c402e2ef7f07313f88885a31"
  },
  {
    "file": "src/companyoperators.js",
    "blob": "41d385506cbb7a9d370e8d13bfad2d3fcf8c8147",
    "sha256": "28f5d7b95c397621cf7029c3496b60f26eb150b3587f9a3026e8ba537c880575"
  },
  {
    "file": "src/companyopportunities.js",
    "blob": "ba510d16c925c856b03d159ee7c7198935907bd3",
    "sha256": "7ff5c5f84356144a1d0038223f93eaab580d020d5b6cc359960b98bba772dd00"
  },
  {
    "file": "src/companyopportunityrunner.js",
    "blob": "09574fb07c36f15020e26f026faf72143a942591",
    "sha256": "ab95ff6f7e7714c68bdf970a822966b38f1a1577827f43e9133b9009e54b8a67"
  },
  {
    "file": "src/companyproduction.js",
    "blob": "b40aeee2ed3b0be26fdecb8a4bba7af215c89bed",
    "sha256": "bb24ca762f91fa5458d38820f5f9c8a70c453271fc102fb3ac057875c9e4c263"
  },
  {
    "file": "src/companyrestructuring.js",
    "blob": "24a11ebc6af9dd44f900b534b6be3474f5b2157d",
    "sha256": "86b31196d90bfd33c29d33b6b1b1c1bae5e17b2e266e690b8710c590420796c5"
  },
  {
    "file": "src/companyspecialization.js",
    "blob": "431d3abe7680f909f16cea59613d080ce2fc6b20",
    "sha256": "2357309a672ac180283ec87ce8895318095954dfd6aafc08e6f445ff9ee22abb"
  },
  {
    "file": "src/companysuccession.js",
    "blob": "942e406f13c9a1ee9a10ff092340e01d52bb2c64",
    "sha256": "b3a50efa484246883c4229d35af97901ea5910848744d46a248dfacef8ced757"
  },
  {
    "file": "src/companysuccessioninvariants.js",
    "blob": "ed26cfe9c7e2a49fbf838e294f3df569ecd6897c",
    "sha256": "85578ef8dac6632a88a9b462841acd514ebfe5c27fa79d307b80d99cadd91ec7"
  },
  {
    "file": "src/companyworkflowinvariants.js",
    "blob": "4b30c48feb0486ec09a06ce78caf074af0f03cd8",
    "sha256": "f328f653367eec7325842c42af36773e5017c9ed2858ba8889702d609393424f"
  },
  {
    "file": "src/companyworkflowrunner.js",
    "blob": "7afff2fd66ab3472c602c13ac2c039738d235d64",
    "sha256": "c764ccf8fc2955135de90b2b49471ce4e7d2d53b8c3e17246d6c2bccd6cd7a1f"
  },
  {
    "file": "src/companyworkflows.js",
    "blob": "a9416eb719b120c62ae244b2ed1da3889e27c7a2",
    "sha256": "4744c09b1d2775da77280873eb33eea5eecbe406ccc7fdc9d33f59fcba1e7352"
  },
  {
    "file": "src/computeexperiment.js",
    "blob": "a7444a51bb75261c13054e3e90d575bbc9e3fc5d",
    "sha256": "b9ffce0d68944667bcd6b6124bdafbe22dbe5215d9f1577bc20554e51b4db514"
  },
  {
    "file": "src/computerouting.js",
    "blob": "6859804c27a4b87348115fade236ff5ca84bbc0a",
    "sha256": "5dd8394c25677d96c8d289bf98f14a8622086ad219122335dcfb5c8f9de82793"
  },
  {
    "file": "src/consignment-contracts.js",
    "blob": "f0bbcc86df45f1477b09cb8961a5e1add46a8c22",
    "sha256": "6dd3d208fbb892d9d9b3bea75e542f3db48bb344b6673642f2465c53cf6f8b92"
  },
  {
    "file": "src/consignments.js",
    "blob": "e370a56237bd09b78e31b452d0d6e41c7de4d17a",
    "sha256": "f69d2a98288c6350930689a0106cd27163268ad88f2f58a400204ea6a7442362"
  },
  {
    "file": "src/contacts.js",
    "blob": "c62887a2e83bf3059562a7fb294f075f2cad48f8",
    "sha256": "6ca69f7922e8010eab4e9b31c64fbd046673db070f9256e65e7362676b712ae6"
  },
  {
    "file": "src/content/activation-policy.js",
    "blob": "66ce54ca21852aafb56ea2688b0ad22fa610f973",
    "sha256": "907a9bfee4d78c23df9f98719969a5c0db280bd205a1307d68e2848b760ff9aa"
  },
  {
    "file": "src/content/artifact-storage.js",
    "blob": "d12e2862d32e4b56269b333eceae0e87fcdb9782",
    "sha256": "e1ecd5d6df974e0d94fb552fcfda91db946edaa68d08f4d4d34f10a9a0d53153"
  },
  {
    "file": "src/content/artifacts.js",
    "blob": "0743c5aa478bec583bd70790264dec1d36175a56",
    "sha256": "2b47ec473567f29cd7adef436709c722f4e6c732da0947de7ad80f4470a8d426"
  },
  {
    "file": "src/content/automotive-salvage.js",
    "blob": "e18459456c96275d5766fca4399d79e0d960dcd0",
    "sha256": "bcaea48b77cdab85cb8cab3724ebfd2bc777c9f61e5df50de1086bf2c6b9a3ad"
  },
  {
    "file": "src/content/belladonna.js",
    "blob": "66ab223738a58df123ad882aa6aedcf846aa249f",
    "sha256": "60b29db9de2fe05d306ffa03ec7ac2a124d7ccc57fb8779f15e19db6f87a9f82"
  },
  {
    "file": "src/content/campaign-network.js",
    "blob": "971db0671cfb4737f00227f9466c9a72134d7d9c",
    "sha256": "9df353f3d4fefde32b44a410fd367cbd474fd2c23e3fbd2b4a9409789c00e1aa"
  },
  {
    "file": "src/content/canonical.js",
    "blob": "0368aa8216e10fbbf9086dfda231c86094e11cb3",
    "sha256": "25b33a562fc19d354ec8cb5693e90cdaab6374e909f16a39570647b432e46a62"
  },
  {
    "file": "src/content/city-quest-presentation.js",
    "blob": "3f1d2cfa796bc80e8a881210446fb5cf8f7f5742",
    "sha256": "12acd35f7ec91bc16e2b0e72ffeb17cf0448f7734342f770e123d55a5b17005e"
  },
  {
    "file": "src/content/city-world-opportunities.js",
    "blob": "a6fb9c2f32a16d23ec36b54204aa49549f3bbafc",
    "sha256": "fe4da647799d9838f2f223379ba28ad073c165471e845213c89e5d6a87832093"
  },
  {
    "file": "src/content/company-production-quality.js",
    "blob": "142d38b7ce77509850b4afec7a0f570315fdc711",
    "sha256": "5c7f3fb98a49fec52307948bc8a4bf1070307910a68c098e8145ad470189ebe0"
  },
  {
    "file": "src/content/compiler.js",
    "blob": "65b77668b9a669c72db528c7b43ad0c11d8a0da4",
    "sha256": "167fe1d662cb6f83d1deedf84e6b7636011cb1fafc88767d5a4124522a40e93a"
  },
  {
    "file": "src/content/coordination-operation-pilot.js",
    "blob": "ac03369ccba01f67706729cc30eba1dfed46cc92",
    "sha256": "77e96741b2b2f194b9b71bcf80f096153a9ee782ef6e5809f3534196031fe6ef"
  },
  {
    "file": "src/content/core-materials.js",
    "blob": "93880279d3490463d0fbeb0c7a0570fdfd37d85c",
    "sha256": "d3214dd64378addedcfb854275712d4696b309f156552f152616e5294129d728"
  },
  {
    "file": "src/content/core-progression.js",
    "blob": "9510d901656b481e1918d408098f72b1770a9ae1",
    "sha256": "7516f9b5cc0c9a249ac8b89d117b5397de4aa57175cfcd99c9409890a03a252e"
  },
  {
    "file": "src/content/corpus.js",
    "blob": "08bdbd3de46a44db036e982459359aeb15d9102c",
    "sha256": "70fcd33bc1d1074e00762c918fc5e9021ce46e5f19cd18d0075e085de70b5e60"
  },
  {
    "file": "src/content/crafting.js",
    "blob": "f77c2f051c33be107a55e9286826c3afc7475048",
    "sha256": "8907db19386e2a495e1d83cc80fd9d144f2657b33de4b64fe4d51a43b01ab78c"
  },
  {
    "file": "src/content/definition-invariants.js",
    "blob": "47e34eb9f23692153c90c4075fc399d3a7a3f814",
    "sha256": "f9107ea1f772b394e97104c33dbc1a6feb746c326dfa3ef2f48f648cb9303757"
  },
  {
    "file": "src/content/diagnostics.js",
    "blob": "ffb61fcd275dea4b308d1590fc424c686d81b513",
    "sha256": "9227c8aa4112d5d588af0e5e25896bbd18ec2dad3b3bb8bd116de0943061a06a"
  },
  {
    "file": "src/content/discovery.js",
    "blob": "cec21af338925cf1c22396cfad5d0d9f1b6f2f04",
    "sha256": "f76193bd137ddc86f0b8ef83c4a66435673eaed4983d263d943dd0cca4bd8f16"
  },
  {
    "file": "src/content/district-story-arcs.js",
    "blob": "9dd61b48a08cca127b7e49595a374451dae47991",
    "sha256": "e4724d251ae7a4acaa567b9645d52822d0628e9ef77ee9f2868705727b055b59"
  },
  {
    "file": "src/content/dock-war.js",
    "blob": "e3baf568f6ee0ab9cb67dec2478318c263a4b04d",
    "sha256": "a86140fb9bae13b7f4a92a49f22c4a530a45589180284c4fde05b5e28d7ba73f"
  },
  {
    "file": "src/content/economy-profile.js",
    "blob": "74e7b5d7bade62632e615037d866fed0685e2864",
    "sha256": "5b0118be26e80dd2acaa7673b805ddcdaf060eea0628361af9581f85b59fd72f"
  },
  {
    "file": "src/content/equipment-recovery.js",
    "blob": "8b9b6c8fb1ca0f599ce6cf5e693340cf06c349b0",
    "sha256": "e2b3fc18a7cc0336eb7a7b022c79425eed881e04d5fad4d153d1c1bed724e9f1"
  },
  {
    "file": "src/content/exchange.js",
    "blob": "d63094d89ae4c6c9aefeb075851643ab03c04374",
    "sha256": "afba835e473250a8a72c215eb9408ec3720848d1b06a501546e119e9cf3a9354"
  },
  {
    "file": "src/content/furnace-ledger.js",
    "blob": "551b520176491c46896318a56e46bd876401ac0e",
    "sha256": "86f578bf3ba1b78c76b847ab7840ea769fb0413b030fdabde9b97a20f2682cca"
  },
  {
    "file": "src/content/json-source.js",
    "blob": "2849449fc57adfee7baed434cd3dee86fa534733",
    "sha256": "f468a1694f577729cec224d182178f90c2b74a331c5b72ca67514e18c1446e0e"
  },
  {
    "file": "src/content/neighborhood-broadcast.js",
    "blob": "0bd85d11278dc2f3537b9895ea91dc1b9399e45b",
    "sha256": "814a320cee3668445de4cc47f8dc49eb4acc5c896d72cc58987734defee7a482"
  },
  {
    "file": "src/content/neighborhood-initiation.js",
    "blob": "0120fc014518edf66b047fc098ee543d288a700f",
    "sha256": "0647a219cd993b8885cfda3e19507b219845ed153cbb93485cf15155650fde6b"
  },
  {
    "file": "src/content/neighborhood-initiation.json",
    "blob": "bed7411c717be55cedb99412adc6485827a5c578",
    "sha256": "b91af199e40c197f7df71bb28517b0b961641380abaaf12fba0086dcfa64b267"
  },
  {
    "file": "src/content/phase1-policy.js",
    "blob": "9905ac9dcc65ca58073bc0bdfe412c8b4aa97601",
    "sha256": "54fcf367ee3234527faa608d0725fcd3f4b58c646f4164f2264ea79655443ecb"
  },
  {
    "file": "src/content/phase1-validation.js",
    "blob": "d63c95dc7a2aa780a342a70b47a9663a6541549e",
    "sha256": "cbbd8c6750d1bc15f839248f4ba41155401a50c7bc1249443479a239c44f06b9"
  },
  {
    "file": "src/content/phase1.js",
    "blob": "410973e7de00da7b7e703d4e0c137319a4bf39a2",
    "sha256": "6d3d5cccc4fbf99ca09ba13906536477651f64b3c8182d7d387cd9be08d8ffcb"
  },
  {
    "file": "src/content/phase2-transactions.js",
    "blob": "837138af20c13309b7ca039d54ccb036d11b2d2a",
    "sha256": "451a444b64e62fd52cf8c1978b91139776b17fe5cde59c8ed8c16c75e3aaceaa"
  },
  {
    "file": "src/content/progression-admission.js",
    "blob": "65b9d2d1930a7189da2023c26c936bfde118ee9c",
    "sha256": "6fe3b1e433eeaecf137769da0b84745c967698829372cc6836e3e628101bfb71"
  },
  {
    "file": "src/content/runtime.js",
    "blob": "409c63e4d5bf2c336add3cc064093ac40accbf93",
    "sha256": "753a7429a4447ea57c60ea450a3d5dc3dd33f6481c5ee50e64c651f73d73e901"
  },
  {
    "file": "src/content/staged-crew-missions.js",
    "blob": "f5e195c021ea9ceb80a1e421234212e09670b789",
    "sha256": "7a48e147514eda9bf0e0433c541758c1a767d31ea1bc22e7463276f473398987"
  },
  {
    "file": "src/content/world-kernel-pilot.js",
    "blob": "bf9ff07e86d93235008cdb8962d1984c95126cdd",
    "sha256": "fba26a24f29b05fea2d64717a733b58f6d5dee98cd059bbebe1f12d19d790ce3"
  },
  {
    "file": "src/contractauctions.js",
    "blob": "678fb9f81ccc7069608f5736b5f0d5ce8adb3bb8",
    "sha256": "26af232de61caf6ffee605e3c9484cdecf2c2aba6c18b26978838874586fd0d0"
  },
  {
    "file": "src/convoy.js",
    "blob": "6774957a0019980915fcba1e049eb4ea15ce951d",
    "sha256": "a4d98d41a3f265fd5743b7e46aa0b2ae351695cfb47cdd62f5e9caa5eac6ee7b"
  },
  {
    "file": "src/coordination/capital.js",
    "blob": "b0569beffc3da2e59a498e6e602de69946ebe7f2",
    "sha256": "4f1e03add9f8a60e156735a31e334b9192573576ebb3457b41be8c32638e5066"
  },
  {
    "file": "src/coordination/graph.js",
    "blob": "441e062eb6537612e320fbf23374147045ae2d02",
    "sha256": "4d5de1c54159048710b1b4695617710965074fd886f2b3b7fb87a08a0e8b545f"
  },
  {
    "file": "src/coordination/http-contract.js",
    "blob": "75dc29d439a5a570b0d5e0d9069b0b7986864db0",
    "sha256": "240c35eea47723af64d9f920940b80e3103c580fead031f7ca87f623e5fe760d"
  },
  {
    "file": "src/coordination/knowledge.js",
    "blob": "91756e763465f8a42bc0d06db6201873fefe29fc",
    "sha256": "f04c46c49545cb6e19e058bb4b7f96298dc9ce6e01fae8a1255f4717242e89e5"
  },
  {
    "file": "src/coordination/operation-definitions.js",
    "blob": "8255409119ac4584e9c5d2ae15728c304478d7ef",
    "sha256": "3c1ea0bccdb1dbcb2c087b350d2593719560b1c4db8e717e219de5c64c5eeab9"
  },
  {
    "file": "src/coordination/operation-invariants.js",
    "blob": "4b24fbf9383a09be6f1027430c6b2b600ca8c4e0",
    "sha256": "b0d8116a2e67db0909e8231d599db409c3f5e05c0dc1ecfd01cf29ee36b3f3b6"
  },
  {
    "file": "src/coordination/operations.js",
    "blob": "d9c9d783c47f9ab648564792ca38e43bfacc83e0",
    "sha256": "3b6cd3bc40386d96ef21d037366203832b6a1729d87b3a9fffe8dfea0e11a3f7"
  },
  {
    "file": "src/coordination/pilot.js",
    "blob": "56e810afdc6e64ca1297d400da4a4e14b87d6c16",
    "sha256": "1ce5d9516b1765dc8a871b95d6258df9566ee9a19b971729bf6f3357f2bc7b40"
  },
  {
    "file": "src/coordination/runtime.js",
    "blob": "2e950628b3d55c9d691c2847ca4ef572c444eed8",
    "sha256": "a965a4ec667f3faec243e19f90bd501d13981dd6abcf421f39b15b9c38a0eb0e"
  },
  {
    "file": "src/corner.js",
    "blob": "8def56ff4b1cbd8d7ab85f0d86594a69d29b39a7",
    "sha256": "e4658d478f719e5e169fea8e780f0bb8088f2589d6df8ae0fad07a260f28e2c2"
  },
  {
    "file": "src/courierjobs.js",
    "blob": "ac0bc66d93853b1155d2581df0b9c93a734c48d9",
    "sha256": "f4cb7494e06aa9e87700d99a9bcdcf8f1b73900a58e5a365d8695afa7cef8185"
  },
  {
    "file": "src/crafting.js",
    "blob": "8650362c6fede48862541686596ff31f90c98ae0",
    "sha256": "037a77c2cdd5723094c1550933b5b8ad424374acd6f0e3e2ff013a8365314b00"
  },
  {
    "file": "src/crew.js",
    "blob": "7d52c88cc1f24a754376d5e68c539f48c97a370b",
    "sha256": "3ed0798cc073457d504fd308c6c5c5a58fce9a03c7aac7aa168d203c6ce46bca"
  },
  {
    "file": "src/crewlogistics.js",
    "blob": "a0b75722cdf56714c278ea072502041d34f4c19c",
    "sha256": "650ef2eb9b1c7b9acab43bf3af0004647a7f483e6574bedd0324307d63bdefa8"
  },
  {
    "file": "src/crossdocking-contracts.js",
    "blob": "460d4c493d9b4ec959f09ba4dbdd5e0901df6956",
    "sha256": "f28f90e5c8b497fc20b62c53d4bb1ebc2732b016873b14f7704f6d1403ebbdb7"
  },
  {
    "file": "src/crossdocking.js",
    "blob": "9e96537a93680358d8ca06ed25be0a215e548ad3",
    "sha256": "35f78da0ca828ce87861a617cc9066008ab1a970512d1526ce63bf92094948f9"
  },
  {
    "file": "src/customerlayaway-contracts.js",
    "blob": "1c222c9578939cc2b0b91cb813399eda2c9596ca",
    "sha256": "cbb44dc9e7ad69153a5bc1463747d1138effa8dba710236d79fa557e89c91893"
  },
  {
    "file": "src/customerlayaway.js",
    "blob": "662f2725986b7610b6af13be022a798cabbf8811",
    "sha256": "e1291c68e1589ce99c7f33c22b7c44507a459235b45e1b1e94d1f0ead97c6ffc"
  },
  {
    "file": "src/customervaults-contracts.js",
    "blob": "7ba49e669a882e3f0820b5bb21983010f40f61c4",
    "sha256": "6cca87a1e2a9c97c51e3f4d372e36147669a3fd399c04dcfc62d65152cdd3c75"
  },
  {
    "file": "src/customervaults.js",
    "blob": "8210e09c412ab2ba01bf2f965bb1c9fab476079b",
    "sha256": "24d851143dd7ebc56f648d2f69788e435cf1ca33c8666b4f4d3eda8d6e1a7937"
  },
  {
    "file": "src/dailyreminder.js",
    "blob": "cab08080842f077099c58e65639f555cf8fede87",
    "sha256": "d8eb46ae41a5cabc52defcac6ad2bc1591f327ef623e0efcd2477f7f286e0a13"
  },
  {
    "file": "src/day.js",
    "blob": "03da2dd822ce341c625e4ed2789f83137dbdd889",
    "sha256": "51fd188b36d3eebd15fb6be14d21e99bb4e0f556868938d7e74bdc81e28dbf17"
  },
  {
    "file": "src/db-rls.js",
    "blob": "236f20a9be71b498cffc85eb279f6c8e5f8860cc",
    "sha256": "4ccfbe1888a462d05655bb05915d6072a2ad336582dc4869c6349962e84ca4de"
  },
  {
    "file": "src/db.js",
    "blob": "b9e90862d4165cc69916bf2ac09383aea00cae15",
    "sha256": "4401437538c468ce95dbdd4db927d82cae159991a3cdb60f9ce51ce9dbc307d6"
  },
  {
    "file": "src/dbhealth.js",
    "blob": "68ecfc734b8a473a91e600f965119ac50b20184e",
    "sha256": "2c8dfc3a56d98146d362e10a48f78b0e5858e004445ad4513e065decabca54e7"
  },
  {
    "file": "src/decision-dependency-contracts.js",
    "blob": "0f007eb7b91f55163bc9f3d5d8a39cb5466f5ea3",
    "sha256": "cdf8be2565693d843f1a23d3bed3f63f65967ed834343b162c0f486a6842bd63"
  },
  {
    "file": "src/decisionproofs.js",
    "blob": "440d790e21014b0c3e3609000bd1c9599e883fbb",
    "sha256": "4788fa228d1601f46cd6aee38e9881176de5b708cba5ac3301de8fc6d0cf127c"
  },
  {
    "file": "src/decisionreplay.js",
    "blob": "5dbe244baf71e245b026f54eb2ce4a755fdd4b0f",
    "sha256": "9cc659d7b17862eb5c0aab2c81ce568e8346efc95815bf3d279a56a12c2c44ce"
  },
  {
    "file": "src/deed-upgrades.js",
    "blob": "5d2f560bac0c57fd3f8f73c827c725727ebe2c56",
    "sha256": "0c5cdbc6ff7a7af0bcf8506f9271493846d8f98deb6a4bcc1e4f0e20c271c753"
  },
  {
    "file": "src/deeds.js",
    "blob": "9f7f1fab401d195fb192005d3164dcfd6c55a73c",
    "sha256": "edf542f5cfc596358964283cfcafc7eaa8f66fee2ed81edb901c53dcd4d0b0fa"
  },
  {
    "file": "src/defi.js",
    "blob": "710dc5c2dc6d4c641967dfb265f3cd7e736f5ad6",
    "sha256": "935ba1c82e9a7146b81d042b2b87366fc265a5ec992b78f5ff386a80ed27a648"
  },
  {
    "file": "src/delivery.js",
    "blob": "c7741c758c73f0b36df0f655637224b73a8f954b",
    "sha256": "1dedd96009625d66eb0c7dc8a9f03c002fc6b9c3faa4a5eb9f0c8849caa42807"
  },
  {
    "file": "src/deliverybook.js",
    "blob": "76be22b4efb9a2e84141eb7dbcb774c8b8e0d92c",
    "sha256": "69fc4612bac7bf0a5a05f3983766d2324344e7bf10f922298b51292632c3187b"
  },
  {
    "file": "src/deliveryfinance.js",
    "blob": "b2bc5a99e20c8d548357e738a8361bf561436506",
    "sha256": "bf04a9aa0aa1cb68351cefa5cc2a060d4796767e3d0efc017824d1eaaebf3ff1"
  },
  {
    "file": "src/deliveryfinanceterms.js",
    "blob": "a243530de1b4b7cb2b37098c28678f88d6d6b6d9",
    "sha256": "4063df9884a666d776109164726c47cc10e1f572b97429785d117434b412b66b"
  },
  {
    "file": "src/depot.js",
    "blob": "d1feda447cd428a4012c193b809b0c9f7c30f619",
    "sha256": "b50f29f51c14d211ae4a9929b754cf3a9113f17da6b1ffbe4a741b7bdc407d27"
  },
  {
    "file": "src/depotacquisitionruntime.js",
    "blob": "b0c51fb101801a8592ef2ce293cb8590a7ce8dcc",
    "sha256": "6643e99472f1c05bcc58b7ea32fc260010d1eadbab66117bd0e28fa915b7bda7"
  },
  {
    "file": "src/depotbook.js",
    "blob": "b49426bb0edb0d12b866099a703d929f370c2527",
    "sha256": "c832e2e6a26e173336e7fe1a02a29d8a11deef1f9bfa61254ea33182310ebe60"
  },
  {
    "file": "src/depotcontracts.js",
    "blob": "f4d33fc93cf48d11b9bb7e64470154b74217f9fc",
    "sha256": "0c846268a7a85932ab208be9a3ea2b142f7e9e61be1236f2e256e287a4b4ed76"
  },
  {
    "file": "src/depotrelocationruntime.js",
    "blob": "2f1acee1b905ea8d7ee4a15fe63a306c24e4f82f",
    "sha256": "cb586258ce83f9c5fd29e56dd273eae90bac3f5945d4de82d0b83d48d4d5cd36"
  },
  {
    "file": "src/desk.js",
    "blob": "47594c544af0ee5da4128e8352653195e8b7a22f",
    "sha256": "c3f93aab7cac98192f266dad21e6ec0e0687cb0a1c7541ae0710f822607157e9"
  },
  {
    "file": "src/dexbot.js",
    "blob": "af30f54a34e2f41517979fc2ee71792134a8e390",
    "sha256": "95836e096484ac27cce50f1331978c6ea5476da24e21c01864157aa8e75eed75"
  },
  {
    "file": "src/diplomacy.js",
    "blob": "df60c9425c0796d06c5b230f4fd84594a0a269e1",
    "sha256": "b6fbd0add3615773ac05c11a488c769af9d3f2ea695d5b6a4c7da0a3b7e56f9d"
  },
  {
    "file": "src/director/campaign-network.js",
    "blob": "c11c4ff7f5e6f59c22ca77cfac0a5ec3fc17260c",
    "sha256": "518b1779963179e67714e3391f5d2b6ebc88b4e6e94b7701ab55f8fde98f76a3"
  },
  {
    "file": "src/director/config.js",
    "blob": "b6ee1f9ea4495758b2aa1a54370eb6d16db229b1",
    "sha256": "cca4c34e6e1fa359d098a34b91312d54ecd025a4c0eeac0e6550ee9ff890b762"
  },
  {
    "file": "src/director/definitions.js",
    "blob": "a9d6ce827aa4c3750898a2faa1d249972620d671",
    "sha256": "bad84caa79aa08de292340d7d412a50c5c5e90b8cf11d6839d834c12b0578c00"
  },
  {
    "file": "src/director/dock-war.js",
    "blob": "b6308346ae52e90eea1da085b6113ccc629e42f0",
    "sha256": "d1cd5529e4a275eafd5ac2a9dd66f6bf5f40d0db029c5e09252ef87f084d17cf"
  },
  {
    "file": "src/director/memory.js",
    "blob": "aaca6abdbbf7aee93578f328bd1264c0ddd9711a",
    "sha256": "9b4827a7342aed209612da44c672c76eb00cb6b825fa8f864743c98d0260fc88"
  },
  {
    "file": "src/director/pressures.js",
    "blob": "77ea7faa4c9fc6d0435ec404a586f2e6b6f0c2d4",
    "sha256": "7460bde525a25c29f8710e858fe9b39bc20203e32ad49f186fcb87c46f65dfb5"
  },
  {
    "file": "src/director/runtime.js",
    "blob": "f1d4559cb23cb26d2b1056fa3e91965da2df4166",
    "sha256": "04ff17562903a3593725921a9ba3b2f90620a1c6e71b85a3ae053540bc49e0f8"
  },
  {
    "file": "src/director/selection.js",
    "blob": "ad4318c569430a25cdd10f707e0d3c2e6a5b7034",
    "sha256": "878fbe91a7f838a998ae4e21a1a509dbac43252dd97edb572f053412ccedcc62"
  },
  {
    "file": "src/director/storage.js",
    "blob": "5319567a2e14bd0fb0d30e1270f506ca3b7f6fc1",
    "sha256": "15586a5ab7884ce613c76cac73f8f1f9b6396a10f9f470fe964260b89dd9f606"
  },
  {
    "file": "src/discovery.js",
    "blob": "7f30f8d10ef6a3699db923b129d3f650bb7b202e",
    "sha256": "1c77893a3793d9235f89418a9a2a6d78fab13fc83068c9fa14313b6b15a37e8f"
  },
  {
    "file": "src/dispatch.js",
    "blob": "f572e2d25e0717f45fcecba24375739302bf0b52",
    "sha256": "29368c1af74017a484320c54edc18d2ac6824696a38bf00411a438638c45de10"
  },
  {
    "file": "src/drop.js",
    "blob": "3f119ea7ced96a54280097865b51c706864587ca",
    "sha256": "9c03319385a39449b0866acb8d00209c9eaea7a5b26a65823f2d8fd729e0ef50"
  },
  {
    "file": "src/duels.js",
    "blob": "522bf557ea82df7144478aff7c85e1c8e59a1817",
    "sha256": "ceacb76f0eba136e7891572dc0ce9ff7e35c6df347adb3ccda8b67efea18ec0b"
  },
  {
    "file": "src/dynasty.js",
    "blob": "4968f4937932e66e9751fb8ab2b351f024ae4686",
    "sha256": "f89d26204ebcbc581026864077965010cc5b37a18f46319d723bf7d1c6558197"
  },
  {
    "file": "src/earningreceipts.js",
    "blob": "69f442c038f432bf58690b1e227fd3efded9a929",
    "sha256": "796891bdf47497355035397e1913ac33ce789a04129c2c46a8ca278ad7a43a3f"
  },
  {
    "file": "src/economicdependencymap.js",
    "blob": "ced343a0676cf22756b6139244fa1f3e872adcb1",
    "sha256": "7957cf6bd309ab9260c723740b552c10505dcf58c1f6a40b088131bf78b1e6ab"
  },
  {
    "file": "src/economicintelligence.js",
    "blob": "dcba4e66b06752de6f07b1d452e4c8b84421fe73",
    "sha256": "6d93a9c38e7543fad2158a2939c832be21c043d4b5a6f7a0b7a61a5ab7a5571e"
  },
  {
    "file": "src/economy.js",
    "blob": "7ee2babf9f83d594a3de3f5e75a23bee3a5428bf",
    "sha256": "d934bd109bf4599d79e6dba9ead2240b3b4c036d3f676a428941de2ca326ae91"
  },
  {
    "file": "src/emission.js",
    "blob": "fe153376b437841bf84a7d4a8207e0bb92cb5409",
    "sha256": "c34b0f8083e1dddc485810cb22f1b4727f1db7c9bf65cece6d855b2f19e0d4ae"
  },
  {
    "file": "src/employmentorganizations.js",
    "blob": "dd13d078714572e1243dc45fd83aa680fc863eff",
    "sha256": "18b7d0ce48ff54adc628d56bb2bad326536a736ff074fb28da7b26480507adc2"
  },
  {
    "file": "src/engagement.js",
    "blob": "c7f1d2521ca4afc974aed7d5504c09b75a8c6270",
    "sha256": "d8166dc243fd0ff54322a4da048436566182fba76d098b865215d68db69c1356"
  },
  {
    "file": "src/equipment-economy-contracts.js",
    "blob": "0d8994306d452fc5c5ca9a727c5f1c7a55b919f2",
    "sha256": "5fdd662babf6869ea377a8932edbbf47e8a0da300e64c52e6c906ff63036c95d"
  },
  {
    "file": "src/equipmentinsurance.js",
    "blob": "540a849953ed1bf6d3c39c1a6d5cf59390b88486",
    "sha256": "42ac825bedacbbd080d0ca6431c545ba2c85629e7756c1b9aae2c66ce0aef0e7"
  },
  {
    "file": "src/equipmentmaintenance.js",
    "blob": "2b8148e10df2049319bd1aa9b33e0fcde5899a6f",
    "sha256": "5075427905283db60c957e055dad8916a22067614cb404082706cde8cceea0ae"
  },
  {
    "file": "src/equipmentrecovery-contracts.js",
    "blob": "a60319f112205dbdead416ec59a748609aacb9c2",
    "sha256": "1d727f2ee2846bc746f3618de95dee12626f24c5bc9441ea0641efadbdc0a4d3"
  },
  {
    "file": "src/equipmentrecovery.js",
    "blob": "d4b559e0569891c0ee16ab7fb9b3d3202ad72070",
    "sha256": "346033c43f7750a73d7d8bed4bda86e895748a26e6e74568430ce12bb368fb04"
  },
  {
    "file": "src/equipmentrecoveryhistory.js",
    "blob": "bef3ee4ea8a7a5b39d9b07fa588e240f061b3cde",
    "sha256": "0387463758f4f82e9fbddf5f5c10d4bdb5d2bfd3ca09a2ccfb4d80d9fa2fed88"
  },
  {
    "file": "src/equipmentrentals.js",
    "blob": "0ab7f392a5962e7d4a3032ef2df83ac772d9cd10",
    "sha256": "9ca47bd5cbeec7c11bb08688a6ba21b371ce9f155c9bd1cf144204fce7dcda65"
  },
  {
    "file": "src/estate.js",
    "blob": "8884b1bf9ea2409e09187afe06ace3ba486acef7",
    "sha256": "6f0f8b2c9125e7396c64e222a22182caf843e976b0e3ab4430b7cbf0842f2ed8"
  },
  {
    "file": "src/events.js",
    "blob": "5434454f7c70461d8ffa322015ad10cb01fa42e5",
    "sha256": "24d0101478264fa19a2800ae925bc787cf30dd884627299efa2792f9436f9324"
  },
  {
    "file": "src/exchange.js",
    "blob": "d391f9cd9f3b21930111c12cb78cda2740a423bf",
    "sha256": "ab28cdc4d722fce1699a486b66314b720bca93601b1b83e4fb88f2d542f4c956"
  },
  {
    "file": "src/explore.js",
    "blob": "da72029e8fa89de5de6e32c47b254f1ef7925193",
    "sha256": "2334dce9a5d33e4af74a5ad05bbedbbd27c35cf4b29d1cc4a70bbe1fa665fc45"
  },
  {
    "file": "src/fairness.js",
    "blob": "6d0d6d5519a050c0476f9092e400ac227967a126",
    "sha256": "b0fbca460a709b02a4da3043222fa5559ebdf248df67605a2ad955aa0ba96c9b"
  },
  {
    "file": "src/favors.js",
    "blob": "360ff754042e9e80979b3f39cab261d7de2748e5",
    "sha256": "9026bd6a0e76da70e8307bbca45b08982904e455cf1e2e46ac8a843f14bb4f87"
  },
  {
    "file": "src/fees.js",
    "blob": "afbd1b587b5663b757fe2ad64568a9299247fb05",
    "sha256": "134e6c5862199bf90952f94043288621e13eeb7249ba871ebd290dbe716e413a"
  },
  {
    "file": "src/finalizedobservation.js",
    "blob": "93d667c4ee5f7ed7443e46991d0f00d2c3cd5dfa",
    "sha256": "f56d3dc45fb1c2f4f7997bb5ea86ada68963e60f4906a0994dd164019b3f1cc0"
  },
  {
    "file": "src/firstblood.js",
    "blob": "7568de7f861f2453c4f163507b0f314e8a10689d",
    "sha256": "33be4793e498cec80ef115fb5667389251819e5295b44f5fbd8b8ebfe52912be"
  },
  {
    "file": "src/firsts.js",
    "blob": "c9a14b9e6be0cea51f4fbea032e0107371d7fa8a",
    "sha256": "7e47392e40a1619cd3c3fbec0ece68026c8a57a1e6dd04df41006e866b39e09d"
  },
  {
    "file": "src/franchiselicenses.js",
    "blob": "345495caedb8fa7bde8d08353b3f15ab058cfa70",
    "sha256": "7a1fcf730a40a79d17b2164ea5dd008910c341bf1a02976fe123706a12d7b3bf"
  },
  {
    "file": "src/freight-contracts.js",
    "blob": "3346e91286acd21e3eb9dce568ff34db4ca64f26",
    "sha256": "b5b4fc489b5dfd1ec9dc017e295d03309705a5bd327b74615d47a7bf0bd5b4b3"
  },
  {
    "file": "src/freight-history.js",
    "blob": "205f2f98ce241fc077e014afc33a9a6d84192a88",
    "sha256": "48193e9c4c999bc8ab076fc2d4871d3e1fe88b0b4fb761dcdf7d9dec64538643"
  },
  {
    "file": "src/freightconsolidation.js",
    "blob": "afd92fd3023907b3701e520243fd2b5b1e947750",
    "sha256": "1985930a416d133697697183c68a00747471b9c997868e8fda5b9e001346fa97"
  },
  {
    "file": "src/fundedexternalwork.js",
    "blob": "0c705d26215d8b524c51a41a7947395e4b2ff9f5",
    "sha256": "9bacc1bee591709656b3fe409912310285baa9ae5785df59558062e19e89ade6"
  },
  {
    "file": "src/fundedworkchainobservations.js",
    "blob": "17ad55d4e205715be402963962d4e8555f2aee2f",
    "sha256": "5cae8e836e9ee7e23d57a2f04cdc3d29bd0299d4b79dbff7774fcafd9526208b"
  },
  {
    "file": "src/fundedworkescrowadapter.js",
    "blob": "2cda9737ee2fd117156d0b83b6cbf0a5293a9a67",
    "sha256": "6d76b8e4dc5907cfbb261a93dedf11059d2fc58ffd259470b6384ca7998f0a2b"
  },
  {
    "file": "src/fundedworkescrowartifact.js",
    "blob": "25c4ee5b7d044f531539bad888e29d000291d758",
    "sha256": "182e5c7c36966d6de62368acc0de0d2779474c4beae81bbdf82a17f3261047e9"
  },
  {
    "file": "src/game.js",
    "blob": "0b9d2004d4a87bbbebdd2ec45c4b5123a7f50ca0",
    "sha256": "811c4b3e97d2ed391c541597dd82ea5b4c3b13aea4328beb2b3aa5da739c4ee7"
  },
  {
    "file": "src/gameemployment.js",
    "blob": "2b93bbf5735a9dda412316026528c0db4ae7fb5e",
    "sha256": "fa6cfc5ddb093cffc2c357ddbff9d60da2175c76423113a868f950c1e90abf2c"
  },
  {
    "file": "src/gameemploymentinvariants.js",
    "blob": "abe91239d78188972b626bc2c984a2810d9672fc",
    "sha256": "34d6183d7c8539b2c90c302bdeed43baa610834ade195a7fabdc94c74262303a"
  },
  {
    "file": "src/gateway/actions.js",
    "blob": "d4423034df50ae78a2a1ac7aa773dd8a6e30b13a",
    "sha256": "95c90c7aba09a0ee31be1db5d90566d9fcec308ff27366bf86083b30e3385cfb"
  },
  {
    "file": "src/gateway/capabilities.js",
    "blob": "f2fba8c9a6a2539cb39aa5a4a364ab5ea3c9adcf",
    "sha256": "c03823f43941d4f5875f8b53f6f620d9a947fdeaaa7a41cc688991674e28b0ea"
  },
  {
    "file": "src/gateway/context.js",
    "blob": "367c730900ec056c20073d240be66165f2d9b225",
    "sha256": "55bb314f045aee05e3434af7bb4457c8fc0b180cdb43daeb5703b8c7240fabbf"
  },
  {
    "file": "src/gateway/events.js",
    "blob": "520d923acedbe32be51d3f004a7f9d56871f8daf",
    "sha256": "bac1529b2beaf40bb085d8759424bfd2cf4cf4bc7212cfa3873aa3ccac66a8fb"
  },
  {
    "file": "src/gateway/http-contract.js",
    "blob": "a8061e324dc1cfff5ff97b422a2eae3d0dd441de",
    "sha256": "52a5c830e5cf29acb10a00dbdf191a41d568d6edf5f4af4fe0e9a6da3c882815"
  },
  {
    "file": "src/gateway/security.js",
    "blob": "8d075378142e97dfa3f0035e2605b1ad31ec727a",
    "sha256": "586225c8ecb0789c0257ee3a3e98ae0ca4411532857d1a6a76625361410efe8c"
  },
  {
    "file": "src/gateway/service.js",
    "blob": "2d9176256e34d4770dd8142e909e3484f80dc947",
    "sha256": "53cf398350bebf069404f32d08c14a93fc38b92706cee2272f0aea225245840e"
  },
  {
    "file": "src/genesisauction.js",
    "blob": "1e6934fc1f9a546ed475905f2ac61b7f389715c0",
    "sha256": "4383c630f8039ce5c4f45e20cb35afa5a8447da31d93c1376b934c22eb8efeaa"
  },
  {
    "file": "src/genesiscadence.js",
    "blob": "a087dfedf82a28239fdc5000e5d76e8900be5d5c",
    "sha256": "8bd49f7839a5ee07864e56721cf84147c1e494bd2701841aafad415c68eaef67"
  },
  {
    "file": "src/genesiscca.js",
    "blob": "0e7dc81ddd90797410e265697d82df4ee41a8b07",
    "sha256": "fc97b78e32762f1afa8c327c06cb2781d170da5e39585c12aafe01493d5a37be"
  },
  {
    "file": "src/genesiskeeper.js",
    "blob": "d509204b6955792979c714f65022b96fe74af7de",
    "sha256": "8c762da122a95be442db0c3d065be8470044201c4a40d3491bfbd23b136e2cba"
  },
  {
    "file": "src/genesislaunch.js",
    "blob": "699cd2cbc4431392377f29937bc7262741fab3ff",
    "sha256": "44ae2c98d09e4330b559beb7764d19c01f7a9e0d9f655a50633a22c434255b6e"
  },
  {
    "file": "src/genesisrelease.js",
    "blob": "466369dcb4a1837cfa927eb001e26683ee596d75",
    "sha256": "c9df16813f4bcb621975d3b41b16eb2574e93a15a154459bcecaacc8c200e262"
  },
  {
    "file": "src/genesisrpc.js",
    "blob": "85970b37cdd5983e60328356d760452955b15ff6",
    "sha256": "53d43570c74883449002df25921cc394cffb376e2ede6c1fbea292c775a6ac44"
  },
  {
    "file": "src/goodsmarket.js",
    "blob": "8f8bb4efb2e3d02dbea475f556d7a93814512327",
    "sha256": "74a2b325912116ea616cc74556a7b02e98793c31c3ffd85b62999c81065f0f5c"
  },
  {
    "file": "src/goodsquote.js",
    "blob": "24ccda7ca8d9336a752fd42bc0e0427db2e0f5ba",
    "sha256": "b191c83c4a3f254d6499fe8775025f9554d448151febb4a72573c5cbf5a44e50"
  },
  {
    "file": "src/growth.js",
    "blob": "5770a4ef7157630aae8ff9fd13cfd1efcb2a18af",
    "sha256": "16d08e25af66f0f522751009694dfc6161a7459552c4036622021390a5cf85a4"
  },
  {
    "file": "src/heists.js",
    "blob": "79bc7543f8ef07431c1e8f6cc6747b391efa3061",
    "sha256": "44031976626adacd64b56234bccc1d9a0067ec5bd63d1d44332597ecdb852b83"
  },
  {
    "file": "src/home.js",
    "blob": "ff5722942bb6ed5039cef3298d1a3f5b21cc9586",
    "sha256": "7d9a801c48cd6755f84ea099939992743584ac82a87ca0b7a2654f66e0d95b32"
  },
  {
    "file": "src/honor.js",
    "blob": "3d0e34d73b1d817913f9db77ee845346e7661f66",
    "sha256": "c46bb6291e1bba007fa254dc9265684c7007e604b753e674298a95487c7160a1"
  },
  {
    "file": "src/http-idempotency.js",
    "blob": "88a5cdb8573de2560190eee28d99a54efbeec057",
    "sha256": "2edeb237aa8c52c2655ac4821553d073fd6c90736600d0d34c092c4f567861fb"
  },
  {
    "file": "src/hustle.js",
    "blob": "7c770263d16805f83234f736449b54ec9990c6af",
    "sha256": "5f0e4b20031c0b40ce22d2652220ff75f4c8a8132c4203da41c06c2e91543fa7"
  },
  {
    "file": "src/identity-checkout.js",
    "blob": "b9c21fc92b94ff845ddca6a16837b6e377811781",
    "sha256": "c0327b29415768e5fa8e8eaa06f30be658cd7886ae2321f6a204c45f7709b6e0"
  },
  {
    "file": "src/infrastructureconcessions.js",
    "blob": "aa0228bba7afd8e41e9e1ac2e3b7d86bcea2ad77",
    "sha256": "b8de6477f48495c53585712ab77f8e77a7bc075e0f798cac100c121d8618f2ba"
  },
  {
    "file": "src/integrations/muse/index.js",
    "blob": "804d87b530c8a8008d89286fc5647e3a0c6b4ad0",
    "sha256": "a8691d019dbc6c769fedc5030364c6882bd16f75ba20f1c7e9a20f0f72990bb0"
  },
  {
    "file": "src/integrations/muse/manifest.js",
    "blob": "7845c371be92a07777151c69bde8e975cd0db299",
    "sha256": "061760f3159a998938242bb701c57f1b18514d6f766022fd44c38d7dc485d47d"
  },
  {
    "file": "src/integrations/muse/responses.js",
    "blob": "a1126dc2c54c5805f182acb40f426c95a4f59779",
    "sha256": "5e2a5c2212031a09e458dcfe828d302ba841f4728d2bd6813869e91532d44088"
  },
  {
    "file": "src/integrations/muse/schemas.js",
    "blob": "5437d0a31cff1152f565065981a7e2e7d3976457",
    "sha256": "074fc0cb0774409c6636147ed510e96f0164eda399da06a781b8399d079f2cdd"
  },
  {
    "file": "src/integrations/muse/tools.js",
    "blob": "9a210fa6446a2654a5f79c2235d7102219991c61",
    "sha256": "276e9b63d6a347489d3e2e0f8cc74cdb1c1f7947a74dd8a98c4078bf978c7e5c"
  },
  {
    "file": "src/intelforecastinvariants.js",
    "blob": "015ee744c3db8aa4805e22b8922b2a0825603a45",
    "sha256": "460f3310d6b4badbb3085e4f5cd285f549603f6a00481e37032a596729273b45"
  },
  {
    "file": "src/intelforecastjobs.js",
    "blob": "fb7920bda85466c172dbe1f4eb3866e731f3f094",
    "sha256": "98bad3dbdebe0921af9efa79da22079569e62106b52f9768fd08f3188cebb993"
  },
  {
    "file": "src/intelforecasts.js",
    "blob": "abc0b07a0a00af503ceb60c158c9691aede4f0fe",
    "sha256": "6a7b6aadae25cd9c0d4f32f726d7ab7df70733759bbd6e6a7ffe3d88a5f3378e"
  },
  {
    "file": "src/invariants.js",
    "blob": "7532fe24eae8663e2a1b8b04b6b209a9e075565b",
    "sha256": "3aaeec0f05c5fe40a13921d022471489341b3201da5368bb05119d3db73534c5"
  },
  {
    "file": "src/invites.js",
    "blob": "7cc091454d7e9b5fdde31122868e4f624ec24131",
    "sha256": "8f4483ae901f3a77a0ff0d88804e8ab6bbe60132e8910429404afa32a276029f"
  },
  {
    "file": "src/item-lock-trace.js",
    "blob": "182290aba17bcdc239e0ca04b6ee8b68c995face",
    "sha256": "147e4e11e93c1c58f326d19ee8adb4f7b3680edefa31305b9d90111ec00e0978"
  },
  {
    "file": "src/itemdefinitions.js",
    "blob": "ab0648fdb8c21b4902fd8a8745c1aaa0658432bb",
    "sha256": "4229cb9cd1a71a8a113a139fa627cf2f23e87de29bdc56d58255d22f5eb7edbd"
  },
  {
    "file": "src/itemdurability.js",
    "blob": "e040c527da384265ffda85eca2d924d63421dd8c",
    "sha256": "d115121e8b948ced3243ab767f762730f8f6bff20a7d68ffc420ad08cbc87713"
  },
  {
    "file": "src/itemlots.js",
    "blob": "1e6e7a44a246ce6d57c25eb6e2d6cbf7e5780b3c",
    "sha256": "c467be88ad6f43b31f98aa8c3644aa619f40c64ae3ffd14670ad645a4e7d5112"
  },
  {
    "file": "src/items.js",
    "blob": "a66f7e0adf7675993a4465508554fbfbb87c76f6",
    "sha256": "e7d0661997cd2fe9360ed93b62b3cd10bc4ef16bf2e5f9dfa93522857b8401f4"
  },
  {
    "file": "src/keepertransactions.js",
    "blob": "fb8463919dde9d60e4640aac0ad31c7d64913e37",
    "sha256": "b6fcee6ac2d6c892cfad46d44a477bf5bd5c7dcfad2cf4711ef6bf77c33d21aa"
  },
  {
    "file": "src/kitchen.js",
    "blob": "bdfa32bef714449eb65b0880ee9c5fb112c8129b",
    "sha256": "08fc2b7f0ed709528d4979712a9b717851f1063220e09b4df06a5cc8180145a1"
  },
  {
    "file": "src/landmarks.js",
    "blob": "aad2f23ebaf381e1e5b42df48580d23ad50844e6",
    "sha256": "55c0b6fbf655069b6cc05f7f0f27aab7fc27d6a9baa7b6f6872c7c4a4480009f"
  },
  {
    "file": "src/law.js",
    "blob": "0f698eecf3a35cb6b73571d4fa578f6d5b8ad1c0",
    "sha256": "24fef65ec00bf064bcd3db5513e047ff8339950e4c4ee80ad331747bf7510cca"
  },
  {
    "file": "src/legal.js",
    "blob": "70942fdd7dfd2848988280ffdfdd70a760197ec8",
    "sha256": "cc9d56d27c0630d67dc2cdc1d53a8ff3fc294d7e2faa86a49a1fe1d15b1fa9b6"
  },
  {
    "file": "src/liquidityaccounting.js",
    "blob": "4046beb05e70cfa6499be6cc55058393d7995fa3",
    "sha256": "c7dd052b74eb9d2f69e7c2c59f7ec595b6c350762459717054e3dc1aa79b6894"
  },
  {
    "file": "src/liquidityautomation.js",
    "blob": "5626f1a0f37181c9d50b664a9e6adf08266e8fbf",
    "sha256": "54a005e7cf2f6e6bb478829e14d9bb1625e70ce502f3dfd9d23058135461010e"
  },
  {
    "file": "src/liquidityindexer.js",
    "blob": "f5ff3267c794c861630d2d43d6b71a49b4d2880d",
    "sha256": "74c79035129b602e1705ad45766ff898ab80c38e3473bff63892211a1aeaa151"
  },
  {
    "file": "src/liquiditykeeper.js",
    "blob": "1c4ce3c328c8b326228dcad9f0812ad771250fc4",
    "sha256": "8ac3ff9ee150ff25f85d7da7817053155a06b072c26ba443c964571648026d6b"
  },
  {
    "file": "src/liquiditypolicy.js",
    "blob": "99734abb1ca36253b662ad37bf7ba44c77f09150",
    "sha256": "c8a2ab3bf5d418a213a1b16374b5e2f8e770a601e63f4e02f2b14b8293041532"
  },
  {
    "file": "src/liquidityqueue.js",
    "blob": "60a10ec6863440e16a887e709b38bc342752799c",
    "sha256": "4d6b7145d901a138c07be52c8c662330fd3472968cc683c351f24ee59cada012"
  },
  {
    "file": "src/liquiditystate.js",
    "blob": "1fbb4e926f191d7a1232305d792a4fe17fa6819a",
    "sha256": "4616298b9590909793c3fcd1f4efae72fbf17e69af5a6c69ad17f377e3d5233e"
  },
  {
    "file": "src/loans.js",
    "blob": "71963bb297c0dc7b3d745b48fc7a6fc49ab3ffd6",
    "sha256": "2393c2e961842b92d40b08b101e32b138f8cd4ff9e82d4c235bda2741f0f71e9"
  },
  {
    "file": "src/logisticscoverage.js",
    "blob": "30668f2bee8877040465544c3ad04f11968f5da5",
    "sha256": "123af309cf17b3b93bbbcb98139171cdbfc5ad7220a36158fc064c5452e57eb9"
  },
  {
    "file": "src/logisticscoverageinvariants.js",
    "blob": "84fb68ef14c5194d6f9c65440beecc9b16729962",
    "sha256": "cb66250a635b0d4606614afefe7a63f0690e3602cc6be0d04d375715e73efae6"
  },
  {
    "file": "src/logisticscoverageterms.js",
    "blob": "7fc53119745bcaa6a58ae08877af8da5bfe20e3f",
    "sha256": "ee127f66098f493e8c52dbafe76e34ddcb897ee519ceb2ca45820f5399ec427c"
  },
  {
    "file": "src/made.js",
    "blob": "cea5ee787cbdb4c87397e967cb821de771f079bd",
    "sha256": "89decd4437290888d81602171e6de006d26da6596985f150bc3caeebe2c210e5"
  },
  {
    "file": "src/managementteamautonomy.js",
    "blob": "6b638f867cb8f4b5eb2b832431b2a9381e50a108",
    "sha256": "dcb96c9ab8b4dab5ad57d3b3a369397fccb285340fb520ed800c734fe99d7038"
  },
  {
    "file": "src/managementteams.js",
    "blob": "6c0f8045c522fce314cc704e1f8012a16a6d1f44",
    "sha256": "6e4eafdc12fbb4717c739888af6cf30c3c28b5b5265f2c683f37f5b4c5b956d1"
  },
  {
    "file": "src/manufacturinglicenses-contracts.js",
    "blob": "f0b9b6be95dc32a0d7e076b9b8723b1911fe84ca",
    "sha256": "9e94cf0eb7db7a1166bfca3c4e56a0d8a47e3d80bba18cb7c27e1355f44be727"
  },
  {
    "file": "src/manufacturinglicenses.js",
    "blob": "d79f4e51fb305b6ded84cc80fd8a393231daec1a",
    "sha256": "2afaa704aa8bc816e277f125699f2c6af8f1b3335d6b9bbc4a548b3c40a7f181"
  },
  {
    "file": "src/manufacturinglicensesinvariants.js",
    "blob": "f468c041592c5ad77d5cf2cb39b3f4076dabca18",
    "sha256": "a44d7776aad7f4c2cee236a3db27416176656d7c9646f071db9d1febc9962fc8"
  },
  {
    "file": "src/manufacturinglicensesroutes.js",
    "blob": "12b39601f0f70664b597ec3e132d942600f5f8fd",
    "sha256": "ade9a51bfd0968d65355708bc76c40a45b896b93ff5e0a57cd325e08f9ba83c0"
  },
  {
    "file": "src/market.js",
    "blob": "389a1a9780827da3d8357888cefb3f4a195ccea8",
    "sha256": "dfffe1c30e084f60cd12773abee9f2fea7f462985a07b25a266177e7cd1f279e"
  },
  {
    "file": "src/marketfeed.js",
    "blob": "54c7fbde2d39df64beeedfb4eb0f970201e7a637",
    "sha256": "179646adb34914f1437caedb96884b973f8588b0ac974afd066a6962d7899468"
  },
  {
    "file": "src/marketv2keeper.js",
    "blob": "738caaa4758de2d9c353cf566aa7fa50de572de5",
    "sha256": "c655957520790aac1ea79c4db53c92aa5c10930f9096b25e97e9550dc8e29746"
  },
  {
    "file": "src/marketv2solver.js",
    "blob": "495828715c2f9f381466aa8e62839233d5d678cf",
    "sha256": "4f8a9965670fa510af851e7e57b5789a2ad25a74a5602f00460ea43bda0cc0ca"
  },
  {
    "file": "src/mastery.js",
    "blob": "fde8f1d894595673d4f43dbac8130fe46c9a4400",
    "sha256": "9444efb18df926b50d62decab4b6a1aeeacff7d55b19d0ed44b4627899147c1b"
  },
  {
    "file": "src/megaproject.js",
    "blob": "8a6132d3cf29d2963e8345af05bd4d3923b0ad9c",
    "sha256": "9254f17bf8af9f4d9d5248e80e78801e52c01411ee9497b212cadebe395a5540"
  },
  {
    "file": "src/memo.js",
    "blob": "09672af63ac59c09ca8fa67e7ff722c215bb3c18",
    "sha256": "c96b4ab21d5bd2e73a093a86bea85c4fb483427bcd441ae1f7845d35c0feab62"
  },
  {
    "file": "src/mentor.js",
    "blob": "9ad3809206d9ee481fc9d7d127f72ce6d8ac5e16",
    "sha256": "a67b993c55b9fb675306033462ac5be11e6c0aa0bf0fb163031a5030e728a506"
  },
  {
    "file": "src/merchantreturns-contracts.js",
    "blob": "ebf9316fc49abbabb460b54edd6d4d9801342078",
    "sha256": "1c90270068d308a53cabd5018eea04444bef18020bdd4cc2ac6599a85bd92e6e"
  },
  {
    "file": "src/merchantreturns-schema.sql",
    "blob": "9e6e7f0062a66efc02691aadcc5a5ad0e54c690d",
    "sha256": "b238e51620bc37825efb957256e4019f77aa9cc9a59443e0add406c1fa2bf7a9"
  },
  {
    "file": "src/merchantreturns.js",
    "blob": "f518de0208aaa611bd9f4d34a35a9cdb386348f1",
    "sha256": "0fbff46e3f29f882a99ba78d7a0fe987b85cf5f18809b479c5d2e2ba65d0ed29"
  },
  {
    "file": "src/merchantreturnsinvariants.js",
    "blob": "e2a1c44db254421e4be4577723db4d8740b21944",
    "sha256": "b708669fb1f58c303395d5126c2f7ee164969f5e03c5471874043ddfca51666b"
  },
  {
    "file": "src/mobileshops-contracts.js",
    "blob": "26c441683bfe078c4dcc12e408bd8c23ea6ec0d9",
    "sha256": "318caa2ce210577115db1e2644f51fbb8755090fcf7eb902156c0c81b476d5fc"
  },
  {
    "file": "src/mobileshops.js",
    "blob": "41347b97c38d5aaa4d31a58fbc27d88e81a7d3ae",
    "sha256": "7489f3710e4dc1e41de1f4d0280a348e47c6fea3036fe6405d7ef5a0af2f922d"
  },
  {
    "file": "src/multihopcourier-contracts.js",
    "blob": "c7c9635a94119794d63717fe9864936c3440bd18",
    "sha256": "6e7560b6100e789a13a756cd76b3c19999a4489be091cd6ad3529ebc763f8f37"
  },
  {
    "file": "src/multihopcourier.js",
    "blob": "505eaa27002120a2761ba0422b1bb78d1d43c9bf",
    "sha256": "dfbca26d67cbeaafd5cc4a69fa9c4b7cf0f819fa7de8d5dcb5423bbe005447e0"
  },
  {
    "file": "src/mysteries.js",
    "blob": "6c940cd0befca78eba167f444aebce4976a205fa",
    "sha256": "ee5c57d2b29e8a3dbcaaa3289636de8f68908c34652014b407c19ffe5a519a55"
  },
  {
    "file": "src/nft-art.js",
    "blob": "c2f937c024a6e5ca618d221463cf27ad17d53a6b",
    "sha256": "8d062c3c1e06300762a8999fee090597277899d4b958e61c184ad010b7318ca0"
  },
  {
    "file": "src/nft.js",
    "blob": "486b61bc71d4f962f5398b4d89b3da65eeef170a",
    "sha256": "6907312c88cc19bccafdfaf77c76f1be12ebfa3e67a498330181db8b05f95840"
  },
  {
    "file": "src/notoriety.js",
    "blob": "df53ea48f2e7958ab72db9a85497ebd552c30b95",
    "sha256": "abd86db02fd95e3aa6c7b4c31267ef745df846b31405aadb3dd2719f4284231a"
  },
  {
    "file": "src/npcwar.js",
    "blob": "125baf6cdcb2ee9e377dd9a0a51bcbc32480c782",
    "sha256": "4f8be69d632e188cc0400646fb5dbedce6dc1b77dcce2ef5f362380c936f22d6"
  },
  {
    "file": "src/operatingpolicy.js",
    "blob": "bfd3e6ba49f1b11fdeee0f33e524840e1094f264",
    "sha256": "80a1b429bccca329e2b5e269a6dc217ec02c1f5bef6571aae0b3df05252c0214"
  },
  {
    "file": "src/operations.js",
    "blob": "27df779d739f7d550558e50c8a412782a9e9290a",
    "sha256": "175882731792bfd24f2cb7ff0ecd62dc3bb7273b817a77b8bcd5cb7817fdf679"
  },
  {
    "file": "src/opportunities.js",
    "blob": "22a05c633376d01ad0d5640c61b0ddcc32467da9",
    "sha256": "9c6b9f62a01f1ca299ad4b76180121d462d7ec173791738efa0ec97c60f901c1"
  },
  {
    "file": "src/ops.js",
    "blob": "78be2971bae3eb35ce97836977e62aaf1002c74a",
    "sha256": "65369bf141920b2eecd0aeb963f68bdbccfd3f7bfbac8f28031fba3c5bcfe6de"
  },
  {
    "file": "src/pass.js",
    "blob": "03a55b48e9b3be8326d452202be68939111bf6b0",
    "sha256": "299a9465d324019a500b40f03d09a686d6b57b11498e5ff4a40543d75bde9997"
  },
  {
    "file": "src/path-funnel.js",
    "blob": "167b2cfce29d78a115ff977ed917136cc0385ef8",
    "sha256": "a5505acd93bb9483d91e807cb1e5034820a769b9ad7a2d533bbdcabe120a60fb"
  },
  {
    "file": "src/path-pages.js",
    "blob": "9c7b39010bb2ad574cc28efa1d2671c84b49d027",
    "sha256": "a550fb6b735db34531e22f7c8c8bfe91e75aebc1f1749b849db2640d3e618da5"
  },
  {
    "file": "src/payment-receipts.js",
    "blob": "bc80234595f97b3671d49cde11c35c143aad6b05",
    "sha256": "578ace9cf7bcbb850f8db6fbfb8d8a318c1fe3d40307b993f6667d70ea36b0a0"
  },
  {
    "file": "src/payroll.js",
    "blob": "cb76bc9e6dd2e9fbb39191f9ccb20e92056ad773",
    "sha256": "bd1e66ecfc23ce73f681de96356cf8855fd853458389165bd691254d12e842a0"
  },
  {
    "file": "src/pen.js",
    "blob": "b0c5e1f3d60eec07c5d4d80ba57577c0f271bc59",
    "sha256": "11f992b7e89796e050384ab1834f024ffad13f6489b932c90132dc6fbab02506"
  },
  {
    "file": "src/people.js",
    "blob": "4a3d7f4420e29b7a07bad3941061443dd031ff78",
    "sha256": "4489421c8366a50b7eef6c0e82aac998a359312bb8f5ac2f57237e1bc8afbeb8"
  },
  {
    "file": "src/phone.js",
    "blob": "8b3a302a4ad04ee5923f41ed27c42431cfd9ff6a",
    "sha256": "11c79cc444587a33bfe8580cf8693b2eb58636e8f3382203531fd32489136267"
  },
  {
    "file": "src/picking-packing-contracts.js",
    "blob": "a3f76b80c632e24c458e89a14ac46bf099abb250",
    "sha256": "54bfc5125a680c7b630423c8086c81dfcdc08319c713ebcb759e5677293dfc78"
  },
  {
    "file": "src/pickingpacking-schema.sql",
    "blob": "41b2b26953a2de3de1f1faefa01cdd8d49eff27b",
    "sha256": "ab47ff7be9d360d1f0036e95124df9e4cf91e7fe92d04a2ff6314f0aaaf697bd"
  },
  {
    "file": "src/pickingpacking.js",
    "blob": "e7729b983f826bc24c69d36d6a42b6268f65722f",
    "sha256": "719805ac8aaed0ebe5269b632e42c49909f11051f24248c41cb00b111294f74c"
  },
  {
    "file": "src/pickingpackinginvariants.js",
    "blob": "839331bb4ac7ab23dfcab9569ea5583c13d93403",
    "sha256": "0f6f6576f2de6403b7375d1d65ce12f1e7d740f59f75d4cbe5a793fe6acb1baa"
  },
  {
    "file": "src/player-commands.js",
    "blob": "66a5123c0dfa2adb5bdf868ecf5af2108f3d607c",
    "sha256": "79ead5d111f072b3e957ea4a5d0d154589f2677a8f22cfc6d2d95d2d7ad4aff6"
  },
  {
    "file": "src/player-opportunities.js",
    "blob": "765375f80beca9e6c632507b6f9fd6dc25ec86d3",
    "sha256": "1a077fca4f67bf5e80fcfe1d8b14cd67ee542027657195eaec1c6865ad192453"
  },
  {
    "file": "src/playerintel.js",
    "blob": "8a12f5ebaff1ffe4763a47054d069ea34c2665cb",
    "sha256": "2bc94b95470582fe042510905df825a027ff73454d658ac6f5abceb9b2709662"
  },
  {
    "file": "src/population.js",
    "blob": "c4118c150f9df6a645ba473b955d04cf30b0103c",
    "sha256": "7ca4cfe884b3b2f8acd44a9c34c88507c9c42e0730688cac1d4bd358a7d9cecb"
  },
  {
    "file": "src/port.js",
    "blob": "fa6255ffea636377f109f336a48e82e502e23869",
    "sha256": "932c349b12832c7071bfafeacf55b0939e51be881682bebbcc61a3e2ebf9fb82"
  },
  {
    "file": "src/portfolio.js",
    "blob": "02dfeb9c7f65eccd2fa64b0997985cdbe19abf5b",
    "sha256": "399c39e38a555006c2b03527d28159f688264bcbd0b4b7b74fd4110eefbf7e00"
  },
  {
    "file": "src/portrait-access.js",
    "blob": "9850e0ddb81580091da84d4f065b159fef6fc658",
    "sha256": "fb8132b4521dd286a1087afc9325699c132bb68dba88a3fd6c8ebe3f59b3eb47"
  },
  {
    "file": "src/portrait.js",
    "blob": "8e1b5c55acd30982a7553c1adea4966e0ad174a8",
    "sha256": "9d26d0103a43d2ad671f34324feebc63579042ca929c14eeff6dcfcf0967d914"
  },
  {
    "file": "src/preflight.js",
    "blob": "7d71bce56f2027138522c4a3e3eb1e4219357ffa",
    "sha256": "628b6319d49cf91202587fb59245495c05f92b03ec13e7766a50d7ceee879de2"
  },
  {
    "file": "src/primetime.js",
    "blob": "96f538b9f38980e50ca7d7348902907093260128",
    "sha256": "48c4def2e7a270ee79a00504b9a1f8fd1098989b2ba775534dc19f28feaeb41f"
  },
  {
    "file": "src/productionslots-contracts.js",
    "blob": "a652c9575b713b0d01524df3183652cb6252c9b4",
    "sha256": "25eb6a1f536bf616c2d626b1aea1151c06ffecd880cdb0f008bd075a203592a5"
  },
  {
    "file": "src/productionslots.js",
    "blob": "d4a3387328fa7ddc65194d2423613639901bf93e",
    "sha256": "8f6b1dc187f0ce6307a00c48d38f471cacdf8c8f325fba8306f18e7ae0a23493"
  },
  {
    "file": "src/projection-events.js",
    "blob": "d80c3dc7f006bc2af74a457465d2b1063de70fa1",
    "sha256": "1f94bfe212f4b9fc4436409df4b302809a83e49287cbf7cfe2789ff3add27596"
  },
  {
    "file": "src/push.js",
    "blob": "682054f196a090c3980bbed0c8f71375e48dcd57",
    "sha256": "7dd438834086cd332d066cd540ae7217ef029a9d0bf7dc84282c593c9a5f60a5"
  },
  {
    "file": "src/races.js",
    "blob": "b0799c52b46bb77891f4cd588679d74578ca764e",
    "sha256": "8b95cb8b22f22b67823cf4942b354d40e9c471f385d389003fe0f8ad2ac23644"
  },
  {
    "file": "src/ratelimit.js",
    "blob": "02dd02bc4728301adf91bb30114d72f880d72559",
    "sha256": "a430d7231b81f9dfb28ab6858d8175a0a258d735ac736077eb1fcb86a8dffd08"
  },
  {
    "file": "src/recipe-policy.js",
    "blob": "de69dfcb1db16d4b31529a4f95b1e4348146eb1b",
    "sha256": "c380dd0c71688891a7310b7a9d9f0245aaa2fafb010cd4bfe6d439dc41b0aa39"
  },
  {
    "file": "src/recipe-scarcity.js",
    "blob": "ccaa5ee97ce38345148312d8dcec426fae011b68",
    "sha256": "5fc404a872d946360dc9d523c34dadc5d96dff19d807be83bfe3d19855c7a7a9"
  },
  {
    "file": "src/regimen.js",
    "blob": "4e1f075f9174317221487fd840912f00f32a34c9",
    "sha256": "4f96dfbbcb7486af66a65c077d021d24041ac9c1d6ab55e6d29e59e04a49683e"
  },
  {
    "file": "src/resourceauction.js",
    "blob": "26ce0279e8ee56d28651ff77e16afb024914fba8",
    "sha256": "ba2d2d39a85527cbc818d54794b3ee93bbcf74e187b347139ea91cc766760bde"
  },
  {
    "file": "src/resourcebook.js",
    "blob": "e2f6bb0cbb067c70d730f4edfff067c6e2423b3f",
    "sha256": "7e9b7085661ae20e1a840c8e330617465c2fc7b83a1b31472408df89f32bdfb9"
  },
  {
    "file": "src/resourcebusiness.js",
    "blob": "f6c60875099e1e1179c6f5a5d698df3f9fc2038b",
    "sha256": "b0b15c3a66110f0af1d5c29da78bc73fae755af41fdfa2f8121b6eddce372280"
  },
  {
    "file": "src/resourcecompute.js",
    "blob": "4979c6acb5a9ded557d650cb54fb25a1e33c7cbc",
    "sha256": "95638d3c769e8b7702340618f58afa3321979953cfc3b1a0b9d8afb024e5955c"
  },
  {
    "file": "src/resourcecontracts.js",
    "blob": "68e0acb17c36eec36161e43c0a7ba8b74326a896",
    "sha256": "cc2f947d2106c1cb33af9069e6b5ba847ee58b3fa6b508b3a5d1a24b7d34e8f6"
  },
  {
    "file": "src/resourceearnings.js",
    "blob": "551d03c8a4a93e94bb56141f18378467d2102a17",
    "sha256": "5a05b49ede4652ed98962e2c886451f37609f937d299708404907e2f2cfb3a0e"
  },
  {
    "file": "src/resourcelabor.js",
    "blob": "e4bb9ecf072c4e145e4ff765a151d1496246e4d3",
    "sha256": "5b7c97ae52a64f1a528a45fb85875158ad3664fcbfff1da1bf06c463e6fccd01"
  },
  {
    "file": "src/resourceoutcomeobserver.js",
    "blob": "5d0ea5859f827ee9cb121af34f0a7b3105ef957d",
    "sha256": "fbcc33b9a7b1df4d190e49d1ca06e509f9c9cb2f0b347ab87be29d68075733f1"
  },
  {
    "file": "src/resourceoutcomes.js",
    "blob": "7d4b146627c8615372af5d4674a9bdb89592fcb2",
    "sha256": "f8a6f109e9ec7c0d6313c1e8dba6bd1ae0adbdc529b32137fcee5e839df97f57"
  },
  {
    "file": "src/resourcepayments.js",
    "blob": "dba416a5f8386376a96b837ddde0b291d19522a7",
    "sha256": "5380b240c388f67700851e0335127afc554fdf0e336898b0cb30ee0126029818"
  },
  {
    "file": "src/resourceproviders.js",
    "blob": "0228915891930c1bdbd799136cb777b68292b690",
    "sha256": "c4ce4ebbe78db8c8de4aec6cd108807aae2521ba495ff1a654db73a29aea7223"
  },
  {
    "file": "src/resourcestorefront.js",
    "blob": "73df3c44498ef94012cfc9d3b8af644ff9e463c3",
    "sha256": "577e0ed645ec58e0016691e5e929f7deb2dcd2f2fb4819e0da4b8da940dfee5b"
  },
  {
    "file": "src/resourcework.js",
    "blob": "12b3834eae8f1ff75edfb6f1edfd25f682c28d18",
    "sha256": "ba4fc8d5c62302f99c13ad4865c5ed2885b77fa7eda538e3c3e81b0590a37847"
  },
  {
    "file": "src/restock.js",
    "blob": "358aa1d76d05e570dd647ff95ccab5169fa982c5",
    "sha256": "eb1f9772974ce7186dd47a0e2a1064812cb9b2b6f7149a72b8b5c61b32a7b77e"
  },
  {
    "file": "src/ring.js",
    "blob": "e53563000c797714801d73dc2e9aa77b2847a6f2",
    "sha256": "542fcf34d1233972d9061461b0a433a4908fc177905bea291c32ffec137089c2"
  },
  {
    "file": "src/rivals.js",
    "blob": "530ae0b6c40e174aaa99a91c097f195795a1dd58",
    "sha256": "4cbb297d7e9ba089d8731d8d5a576fc6df99e7576814a6151922643415a436c4"
  },
  {
    "file": "src/roster.js",
    "blob": "e858643efbce00a9ff7ada51b9334c179955bd1f",
    "sha256": "04dab27d177edc08487ddab7a1e0f3b89b9b86be9cfa679d1bd0825f77f0cbd0"
  },
  {
    "file": "src/router.js",
    "blob": "85eb417788f563c3cad674082172327fa95a9f33",
    "sha256": "c72b9aeac7fa8247d73944dff15bb2b4aa8ee400c8080f3ac31d78c0ac894d94"
  },
  {
    "file": "src/routes/agentoperatingmemory.js",
    "blob": "dadea2d06167cfd2e7b309b8621f0b1935ee98f8",
    "sha256": "9052eed18ad7706effb7c992e40b9b5b7b73046e31cc6c9d46987b5e1d409374"
  },
  {
    "file": "src/routes/atomicbarter.js",
    "blob": "c1f54940e8fce733ff86a79deb6a63d09f10e3b1",
    "sha256": "131cd6dfa2c3487ebb6ec86a9b807189c224d325873bc4881af3fab8de69147a"
  },
  {
    "file": "src/routes/boxing.js",
    "blob": "d0dc5c95269185b95ac965795c1ed4b46093510a",
    "sha256": "86f6deff714344ac6677d40ba699206de4637d4779e7826d13795ce0332a04d6"
  },
  {
    "file": "src/routes/businesspartnerships.js",
    "blob": "26972a01d3267a378fcb0dba006ef0aa6ce3c525",
    "sha256": "53f4be979bc9b2c01f92d77c492bf7716a4e11f36377f6391b95d5c6d13c0385"
  },
  {
    "file": "src/routes/businessseasons.js",
    "blob": "355556d4b1349d5107ca8f8bca98b047c339df12",
    "sha256": "a6c79233e14d529a05af827eb082d752de71c5653cdf9ce09c7232a0e5009a83"
  },
  {
    "file": "src/routes/buyercooperatives.js",
    "blob": "7b406d24b4454d5ab0096acdb7ad1f6f7e63ecc1",
    "sha256": "8f292ffb6c25abf1dca892aabd2beb3c98b2b65a9d6eb66762d6a71de376813f"
  },
  {
    "file": "src/routes/casino.js",
    "blob": "8cf2fef5cf9cac2b4131b4d2d9cbde07969282f5",
    "sha256": "cfdc55e44443190b48e22e62064e00a118c9cc344c6249bdda40c05c4d02b088"
  },
  {
    "file": "src/routes/city-encounters.js",
    "blob": "0ee474f1530c705c3a2c2b30470facac42feb161",
    "sha256": "bca0fc1c1a5b03c72e72988c85866388dc93dc7a05b80cb89afe40eae5f26c35"
  },
  {
    "file": "src/routes/city-home-interiors.js",
    "blob": "364152d6f45f872a1e188acd4766e93889ef6234",
    "sha256": "838b033baa0ea855b2594d7e5e15c852685e52caaaf338b8c93d0963008e3617"
  },
  {
    "file": "src/routes/city-world-opportunities.js",
    "blob": "a26e3a5c8ed738d361224c2de631dc4f5400edb2",
    "sha256": "5e72322597003789436e0de58367d4268d8265b0a3e4a65eab33b802aba60803"
  },
  {
    "file": "src/routes/city.js",
    "blob": "c65a96b57f39d517948f9a0ad42c1e9ad98f9845",
    "sha256": "a6c9a13e75b1f3f4181c56435975fd5dec1062f2205462293b59f078db5025eb"
  },
  {
    "file": "src/routes/cityhomes.js",
    "blob": "0ec25b7b06f298a0286d587e19e56274b4ddc7ac",
    "sha256": "24c40a06a9a82a93cfbacca476b928544af5f03d1897a120d85be65786c3dd6d"
  },
  {
    "file": "src/routes/commands.js",
    "blob": "64073121e4ecfc604583911472b73c7adb5282d0",
    "sha256": "c893c9d0f05a7cce417ada2e6b1c8d4aa9911ff7aa0cc74fe79a31508769e2b4"
  },
  {
    "file": "src/routes/commercialdisputes.js",
    "blob": "96ea50fcd1d3ff77c6891c5434323d17413b9cc7",
    "sha256": "d5f28157333a9e435c36d34e71f6b9f85806e8b10f7fe33ee41f91dd14035a2b"
  },
  {
    "file": "src/routes/commercialnegotiation.js",
    "blob": "b5cd889d36eb8019c1d7c426c9b9f00b6199681a",
    "sha256": "d2dc40fc3c4fb60bad06deb3c67cf5e26e956dff098d9c15ebc6b49d148b0c3c"
  },
  {
    "file": "src/routes/commercialpremises.js",
    "blob": "e4b2cb28fcad15848ffa9723565e51ce4e2733fe",
    "sha256": "10c803db3bc326bcb95097eedc5b3e5e64378a92cf4162d0f72d677b4ff7b642"
  },
  {
    "file": "src/routes/commercialreputation.js",
    "blob": "eaec27adb6e0185459c0e7d735278de26a7076ac",
    "sha256": "9c011f19e0dd2c97ed68e3ca3aac8a325a2340b81829c4b42b7011c44ec4642d"
  },
  {
    "file": "src/routes/commissionedcrafting.js",
    "blob": "f75d0a00ca7489fdbc7fc04107304ee2a1a129fe",
    "sha256": "a2c1f2a0240d8143469f14b1b02071b63227f3ee7c90ff2f836ee483a5ba90dc"
  },
  {
    "file": "src/routes/companybankportfolios.js",
    "blob": "b2da44afeb9585ec02ce1b75f2f8433857b2bc6f",
    "sha256": "24ff70cd344ac1aece2d103a1dad5a678bd975cbfeefa56e866f427b0e8e92ce"
  },
  {
    "file": "src/routes/companydemand.js",
    "blob": "0c0bc943fa4e855ab5c6b6c045707ba6913c4845",
    "sha256": "649397a28bb6a28b5ce7684cb90f226fb4ae753cb4cdb41b67a1121f64c2bdae"
  },
  {
    "file": "src/routes/companyforecast.js",
    "blob": "c6a1d3175a2090601555e4056bb6ce29f1e90bd1",
    "sha256": "ac54816dac7a5d1359af336b56cb638228fdedba215805bbce0c86ba18d5b825"
  },
  {
    "file": "src/routes/companygovernance.js",
    "blob": "b89fb0e70abf440db70a3e6a1097f2934a3ec981",
    "sha256": "54550bbbb80a99074d7cfc8a5d6c11e59095a3f1e020e0b5162939aa6251fdbf"
  },
  {
    "file": "src/routes/companylogisticshubs.js",
    "blob": "fd3ac3cad62e3b665dfc7770d922d9ce6419e111",
    "sha256": "bf9cbc5206b55bcf8ba1887d3d27975b960d08d1b28a7730363ff7f4d156f9e6"
  },
  {
    "file": "src/routes/companyoperators.js",
    "blob": "8820e6afe6854aa9b2e5cb54a9f574f4d52798f7",
    "sha256": "6d13091fa776e0310a5126aed93c33082b871f874f60f0dfd6f276ebc6d69092"
  },
  {
    "file": "src/routes/companyopportunities.js",
    "blob": "44bb6da3ba018050b95a9d89f57eab162a565ddf",
    "sha256": "5f3047934e47a173567d7b37054f54e93e3dfe6bc4d742b476b7d52bdfc54a91"
  },
  {
    "file": "src/routes/companyproduction.js",
    "blob": "89bd7cfc9bb1478e137aa08eb0b1c2b0d5553e32",
    "sha256": "748f5d3656b7dc165f65b1c8a7d1e0817c7b60e9e5be21b12cc6da117228da96"
  },
  {
    "file": "src/routes/companyrestructuring.js",
    "blob": "1d09326bd41fe0edf0dc0a0d1e45fb2b97f7a946",
    "sha256": "21af0d3d2a58e1813400c0f18d96fd5644e3542f60d39cdd31d4551cdf0fb131"
  },
  {
    "file": "src/routes/companyspecialization.js",
    "blob": "95aeaff7537726563b6aae9d00b22792e75f1366",
    "sha256": "a6140b9676b0346b3f502dfa2b379252f855c55f55c7140964a621d9e78a8937"
  },
  {
    "file": "src/routes/companysuccession.js",
    "blob": "2f719eef79d165e8d4226a974c44a9d5b6b7b1fa",
    "sha256": "28c5a4b3254e5be5d5692a47bea5905a72c89d354005b2ab268888c66ee53f70"
  },
  {
    "file": "src/routes/companyworkflows.js",
    "blob": "6e8e74a9e1e4bac265cb351f787d401fdd72d0fe",
    "sha256": "dbbe44428a36be502ef0180add375497c9ffc054673060e7107a9b662515ed05"
  },
  {
    "file": "src/routes/consignments.js",
    "blob": "988111dad5e4f1a514630dfe0071d477ec7c73be",
    "sha256": "7be63ef7c5049fb49102987c8fd4189fb171166b635bb9eacb74fe55bc21f77f"
  },
  {
    "file": "src/routes/content.js",
    "blob": "5ccf992174400dcb506e94770e327dcfd83a10a2",
    "sha256": "0e82bcf4645e12e7a8d5c92cac32a6ff70cec848bef0302fcbdbcbfd325d131b"
  },
  {
    "file": "src/routes/contractauctions.js",
    "blob": "9eac6f1b3a9a743e8f89561cf411268f92e368aa",
    "sha256": "34d2f635f8ee35d61c0f2e24b0322a7df3a93cd69b94d29a64193749677b2f62"
  },
  {
    "file": "src/routes/convoy.js",
    "blob": "ee1ef3b536d3164cb71f25e3f865819dcf95b1ee",
    "sha256": "cc4e45cac29e43cb949c9d80deb97477b7e28e01d563adde3c1161593bcda327"
  },
  {
    "file": "src/routes/coordination.js",
    "blob": "d803eb4dfd59a8377720e9a3f381915bd120a166",
    "sha256": "14906ce7b480b8acd325c4967df6e6129d99c08e3f00bec798cacebe469895fd"
  },
  {
    "file": "src/routes/crewlogistics.js",
    "blob": "9abb709ce6fc88c1d417a66021ae04b6e8315861",
    "sha256": "b7b50b3ef1751d17597a88cccb9080f2dd31bf619e8b2e440dc81f6e3cb182ef"
  },
  {
    "file": "src/routes/crossdocking.js",
    "blob": "a176e9295964d950121b04fef34018824decf52b",
    "sha256": "0df3809821ab2ba5a9590383093fe73fae2bf5a2dffd7780ff66acd541190a7f"
  },
  {
    "file": "src/routes/customerlayaway.js",
    "blob": "dece29c54a60d25827a3a8030370730a01e93d87",
    "sha256": "89620f79d144a4cdb7845b5b05eaf4e6d75b176c3c59d3bfe01c03375dffcbb4"
  },
  {
    "file": "src/routes/customervaults.js",
    "blob": "fe5b0d976bcaca6677b4b646fad5c4d685f281c3",
    "sha256": "3c20bf672c746e040c84f1d1cea5ab9dea1b2000c7714693d6bceef35c2982d6"
  },
  {
    "file": "src/routes/decisionreplay.js",
    "blob": "4174725a7d0a2558f63d35993f61ac1058f4b52d",
    "sha256": "822f94d4ed3d07096994e10d22b9439c4c614de1b63f0613d7e53ce542cbd344"
  },
  {
    "file": "src/routes/deeds.js",
    "blob": "390fcb44fc0d657cc6ae6c5f68a6968d7b1d1078",
    "sha256": "841c0a8fff7d3466ba9b869cf404a23862d3f7927c6a707db9430e7e4238556b"
  },
  {
    "file": "src/routes/defi.js",
    "blob": "fe83f1f5103b550332da64a4cd17759209260c9a",
    "sha256": "11febf8b9758db1cf66adbef81058d44f60c7b244763722d49cbf5ab6bbf7e6d"
  },
  {
    "file": "src/routes/delivery.js",
    "blob": "395c4ec26f162c8e4caf2fc94c869fe52286f575",
    "sha256": "ac95352637a33e7836a1a69e1d7ad80cd0afff19fb08750392eddb08563a36ed"
  },
  {
    "file": "src/routes/deliveryfinance.js",
    "blob": "2f6be5c713cac180eb44afd41f1e407ad7e3eb48",
    "sha256": "98243b3247d595f54c637c99d1babe86475a06862d7094042684ffaa86574acd"
  },
  {
    "file": "src/routes/depot.js",
    "blob": "bf7e54ab2fd049d838f3ccaf59e297310560b430",
    "sha256": "9255aa995e269b2819d31bce6fe89e39d22e51216c5df4f80e42a3754df2b80b"
  },
  {
    "file": "src/routes/diplomacy.js",
    "blob": "3982becfac39c51ec65fe70dba1646c3b28765b3",
    "sha256": "ff9992e85fdef8c83b33de3324642a21feb1c2e8b25228ffe927a74262fc147a"
  },
  {
    "file": "src/routes/economicdependencymap.js",
    "blob": "c74f93544a9d5b3c286b9e18d1cb2fbaa83cc178",
    "sha256": "022d3e7bc1169bb86388942277dcc967d923422766235751088bf29e0dba8a35"
  },
  {
    "file": "src/routes/economicintelligence.js",
    "blob": "4501409e5ba627f8cac354a07de8f34316d09ea1",
    "sha256": "d44f209546527f114dc2f9114dcb3db7da1eb71938a6be9743c168cc3532fb63"
  },
  {
    "file": "src/routes/employmentorganizations.js",
    "blob": "237a613e0cabdbf5b90106f8c46bc81fab2ec19b",
    "sha256": "ace766008b40bb8dd089f44fed314d56b59b662a6b9305e6287ba1c51ef67960"
  },
  {
    "file": "src/routes/equipmentinsurance.js",
    "blob": "1300593f22088e50362b7fdc80928f1464facb33",
    "sha256": "88c405f870c6b689faf042f6b2c498311096051119f42bc45d349b8219eb3d86"
  },
  {
    "file": "src/routes/equipmentmaintenance.js",
    "blob": "bb033c808513b8f75423757eae729975e17e5180",
    "sha256": "51b22653112a2da29d4a8fac41d77b04b24015fe40de89e523910fc078181ebc"
  },
  {
    "file": "src/routes/equipmentrecovery.js",
    "blob": "95216fae443c977b863d15b20ab127e06bc29838",
    "sha256": "c8f849005b710b88d9cf84d7708d4d7a63fb7208e82751611f02aaec55ab7180"
  },
  {
    "file": "src/routes/equipmentrentals.js",
    "blob": "69b056626a57e1c763f0f35eae04083aeb884601",
    "sha256": "f2883b27302e3c56efb1f381b1865f43d43eff47ec8b4ab932f8c6d1e6c206f8"
  },
  {
    "file": "src/routes/estate.js",
    "blob": "768e9e0bc24a9395aaceb2e6e35e4880d77934df",
    "sha256": "e72723bad80d851d7cd70e1b55109414fbb263099f4e0c241cbc4a47382d4e4e"
  },
  {
    "file": "src/routes/family-operations.js",
    "blob": "ff6b6e17bb73abc7dab852111646d228a51c6634",
    "sha256": "558cf9a00a6e047cfc2cde7e0571b766871e9ebaa39a3e5e49d408734f7f36d0"
  },
  {
    "file": "src/routes/franchises.js",
    "blob": "e808d92b6c39339dbfe37d23cfe75e4bfa610d61",
    "sha256": "0451947fd89723fe151c592cae217b6ff51db22039ea7960999222b2f3de9cba"
  },
  {
    "file": "src/routes/freightconsolidation.js",
    "blob": "d519f6242f2ad94943bba58a2428e06a961021b6",
    "sha256": "b6563f9de75d28434c074bd28bd5b07b383b8774404f311df2c85acf2154150c"
  },
  {
    "file": "src/routes/fundedexternalwork.js",
    "blob": "363b0410dae80c2295c2d7f129367fcf10a0f518",
    "sha256": "b91c9a5939d9a119db528765d072cc7ca043fead3f2005a8563fa3a43d8309b3"
  },
  {
    "file": "src/routes/gameemployment.js",
    "blob": "0d683b93e650921d77a400c0ed8de0b6aadbdded",
    "sha256": "ec098fcffdb61910a93ae30ae12f139a93a20eeaabb4ce5cc7d684ca212c799b"
  },
  {
    "file": "src/routes/gateway.js",
    "blob": "41b7f4dbd848a364932f6b875f954ac8e64e0333",
    "sha256": "a609271351e826bec06d21669c1c6be65d9cafe960b524bb8f4688c7c1c885ba"
  },
  {
    "file": "src/routes/genesisauction.js",
    "blob": "ef7ea42ad490fdef30b843e749eff1f21e10b4b7",
    "sha256": "fd288a9fa75993f6cd31e3fda9f5de9102056b74d050272e9d70fe974cf5a212"
  },
  {
    "file": "src/routes/heists.js",
    "blob": "fd63f74e087ec4888d2c13a1b4cce137decff896",
    "sha256": "05b2fbb2b2ba403b3046d1396e24f2819a25d55f72687881a47ab163e7f0bcec"
  },
  {
    "file": "src/routes/infrastructureconcessions.js",
    "blob": "bae7cd8eb32a09ac2687a05065e9251052c62c15",
    "sha256": "81459269598cb4401f4c8cdc32fbedcc7ffbf40be19b3e30d9f3e1b9c291a35c"
  },
  {
    "file": "src/routes/intelforecasts.js",
    "blob": "6acf9359b9a0c017aae9eda707d5fd7ddbb37072",
    "sha256": "a2291d34c1bd36c678f8a0985e38fbd4663541eef91023573760fa03d46e0e60"
  },
  {
    "file": "src/routes/itemdurability.js",
    "blob": "6866dab54a97e3883c238bf44d6be7968c5c68e5",
    "sha256": "7e287178dc1843a897999722ee9506a70132a78d5499735ab036045aeceeac7f"
  },
  {
    "file": "src/routes/kitchen.js",
    "blob": "7d1a30e0ee9891b9d389dc9b7d9047527283feba",
    "sha256": "b07a275d147e1d56529dde6bee1f6c732e329dd6c7bd50a4b3bc3047c5750884"
  },
  {
    "file": "src/routes/law.js",
    "blob": "f4df972ba30c35adf7ff2f448b9d7715f3a0c3c7",
    "sha256": "e2159ec121dad8ab5889ffdc9fdb5facf1c8b3a5c8f4f02c4f3c4643f96b6545"
  },
  {
    "file": "src/routes/leaderboards.js",
    "blob": "477ea58a32d7ec16085abe3d566a8715bc712e20",
    "sha256": "c80f796b2da8f525aeead3e5b9f7d066d57aec3f11b007996da696aeba79530f"
  },
  {
    "file": "src/routes/logisticscoverage.js",
    "blob": "12cbd949701845f6bee93646f0e72bac8913daf8",
    "sha256": "ce56d8b8f057e8346a3dbea728e4d5c6b745cb7384aa0c8b71948cf074594bcd"
  },
  {
    "file": "src/routes/managementteams.js",
    "blob": "9c77ab122854458eebb8fd8a04a55b3ad6b4a722",
    "sha256": "8e68e7831fb95342c762e346b271b0257a59d919f5c8c7b86eb26be8a7ca6321"
  },
  {
    "file": "src/routes/marketfeed.js",
    "blob": "e07b5883e5a803dd451afb5cc81d7c799955086a",
    "sha256": "0b1c70f502f2ab775a93d3f00c1a1280a9ce48c13e2aabdf40147c4a185af167"
  },
  {
    "file": "src/routes/merchantreturns.js",
    "blob": "6c9a2dc8e7628e4b684fe3366787ad9e9e97a502",
    "sha256": "ad4b7e57ff50dab9c7d3ba9122853f2f39539f1b9b39e752df01e3b6478c2687"
  },
  {
    "file": "src/routes/mobileshops.js",
    "blob": "8b37f30d0773020146494c3b3acd9769952236a9",
    "sha256": "5eb8a79d24e49133e43740f492e872c8a8a5f2ff30ce96dbf6a1815f68433fbf"
  },
  {
    "file": "src/routes/modtools.js",
    "blob": "ef47f2fbadb3119cf9ffb7cbecaabccb23b11f58",
    "sha256": "0c168552617be43d7a6800c3f2ff33dce0d6186f3d9cd9bcdd76b3ca82d330dc"
  },
  {
    "file": "src/routes/multihopcourier.js",
    "blob": "a1d6bd0d27437d3d7e23008f1331e34ad865c42d",
    "sha256": "a01b2ca1f8dac0ba4effe2ccf9751bb97176b0c922bf76a68367c38d8d5e0e84"
  },
  {
    "file": "src/routes/pen.js",
    "blob": "1622f9b86aa68c0b0dfd5b63f9e298325a80f07c",
    "sha256": "141037d819c8a69c39e0ad68db17ac08f869c1427e4378f1e99d2a68faed315f"
  },
  {
    "file": "src/routes/pickingpacking.js",
    "blob": "84e0c3f1b64978aa952d7dbc11cfad0b9aa63251",
    "sha256": "2898bfbbb0aabbadf716429711bcd14ddabab2b60434d7d607095f427e0af943"
  },
  {
    "file": "src/routes/port.js",
    "blob": "12c3e44f1d891df79114081763b6de97e01e3ebe",
    "sha256": "5e1fdfad3594e9e504a16ebae92d985581b59b9030724968d40741577d02fe0b"
  },
  {
    "file": "src/routes/productionslots.js",
    "blob": "715a183ad141a4ab02c5b15100041ccec7990867",
    "sha256": "7dadac15569ba92ea93ac4b35d640ecb4f3f8fa303c4f6d6dffdbe4fec17d2ee"
  },
  {
    "file": "src/routes/projections.js",
    "blob": "31fce0944a53b0e0ead887a60971fb966447bc5a",
    "sha256": "fd9920aa5164b0de2d45815a2abc73c04da7b2896c6ea4053517d6bf14f7f1af"
  },
  {
    "file": "src/routes/races.js",
    "blob": "869e112c2cf8d2acbec60a63aafc15e1a0ee8c39",
    "sha256": "2ce2be228195754685cf7d8f47cfb73a712ece453216d67c415ea7f793cc89e5"
  },
  {
    "file": "src/routes/resources.js",
    "blob": "9ae1156dcdb5124e99c4ad7321dc472dee0c7c09",
    "sha256": "8c6656ed1377416de4326dc5a5cb0b48a908b64a2d2d10750054506e3fbef60b"
  },
  {
    "file": "src/routes/rwa.js",
    "blob": "291611ee94341c5d13a717d4e94b872c5b1c5044",
    "sha256": "6cf06952039bb9ba5cb20aadd5f127c25b2976d08220d6ffbe024cb35368692e"
  },
  {
    "file": "src/routes/servicesubscriptions.js",
    "blob": "7eacb6dc71580e4ef7a2b66d7c72bb02175dc3bc",
    "sha256": "c3033667574f9d7ecc01b1921830210042b7834efa120dd8b93e7c9e7baabaf1"
  },
  {
    "file": "src/routes/sov.js",
    "blob": "3bda964122746827c271ac8bef4d701e40bdcaf9",
    "sha256": "28d1ed11bd827c6e3323bb5e638a8081da8f494d60a13378c6d06b4405fa3ca4"
  },
  {
    "file": "src/routes/speakeasy.js",
    "blob": "67daea6c8de16b040f38b15781c47cc03cdbe674",
    "sha256": "2756c168299c87a2c18f107fb291cb96b938143d4dbdbddb6868290c1f5be3ff"
  },
  {
    "file": "src/routes/stable.js",
    "blob": "39473ac61b43cae6015d0e532ba350bc8670fb23",
    "sha256": "f3a63cd87a7a729f73f8112feb2a2fbde9b52113c5b1f780b5345efe3ec27c6c"
  },
  {
    "file": "src/routes/strategylaboratories.js",
    "blob": "3bb3b60b04a5617acc93514b47793ab90bb6b5dc",
    "sha256": "f10d2aebccfb8a9365d4ddf6976dc91ea62c3627b112f38fdeb5ec0d465c3e45"
  },
  {
    "file": "src/routes/strategyleagues.js",
    "blob": "c238319e18852ae822ea8c73bb998c06ee84ad1f",
    "sha256": "8de5359fdae7df10f1a03231bbb5f077705a35d4cb27f57400e46c737a4a152a"
  },
  {
    "file": "src/routes/strategylicenses.js",
    "blob": "4a22890b2eb24c44467932adfe8ab21fdff374ea",
    "sha256": "7af6bf83c303525e286350944002bfd40238b6eae3e180e9e435efa8d21b0020"
  },
  {
    "file": "src/routes/supplytenders.js",
    "blob": "e2e3a1371ac03b923b5271759b35602fcbd87b39",
    "sha256": "294d986df530e3f87ebd9ed82ca09ea02cb0184dee2f88eec2448a303b387c90"
  },
  {
    "file": "src/routes/territory.js",
    "blob": "6804a227c7903adab4a0197ef96463bee6e7ee79",
    "sha256": "6e40ebb9337bab8a63ae2819366b2d92b72eccf9ad12aa1c7cfcf2e262e16bf5"
  },
  {
    "file": "src/routes/territoryeconomics.js",
    "blob": "2ea4cd280962b7948d80f57e9ccacc6c93b02090",
    "sha256": "fdfb62c28008de81330c3f13e7d541ca73a6816ef265d7ee99bff75fdf847b94"
  },
  {
    "file": "src/routes/underworld.js",
    "blob": "ccc4ee7efc9e198fb42dafd29ee14c9528ad4274",
    "sha256": "a46bfdd5c0af226db7d2fc6dc8e9aa3cc2b1acb93d52b48a1e3550729f3c10a4"
  },
  {
    "file": "src/routes/warehouses.js",
    "blob": "576ac32ae2ce1778dffa401ccc036d4ae0ac2f18",
    "sha256": "029f55e6316095f1e8e1bd47ec58618745c00e1a95c8a2898824cc4448a04608"
  },
  {
    "file": "src/routes/workertraining.js",
    "blob": "af658fbcc0fc4ba7315b634ef27500812c8d52bd",
    "sha256": "7daefef5dae4e5a1b3b262e64558ad6be546d4ccf7dc354344a24de19ec23185"
  },
  {
    "file": "src/routes/world-kernel.js",
    "blob": "808ba44414857e4975ddbbc5dc43676987abe318",
    "sha256": "0381bb7451334db220959994d2683317d307191f892b9daa617230c97bbda9bb"
  },
  {
    "file": "src/routes/worldgraph.js",
    "blob": "8c0789f4575e2c4484c5b9e51abc0745a0c3926e",
    "sha256": "762bd5300203925bc3c58743f0e72c3b9eaf347c38b3d351cdc7b17ac662a377"
  },
  {
    "file": "src/rules.generated.js",
    "blob": "79e59ce682e6ada70082b4f522611e68550f0392",
    "sha256": "e322ec08219d4637eced874e6a558432a9d138e4ece8145c8a4f18f2a4880a0b"
  },
  {
    "file": "src/rules.js",
    "blob": "6d31ecfdee691f573d39061705cb1fcd893094a1",
    "sha256": "57c85fd727e1d21d51c19b71ee5860ff4d4f18e500dafd7eac4d6d73591254ae"
  },
  {
    "file": "src/rules.tail.js",
    "blob": "33db41906771f1594b004e916cdbdb031bfaf170",
    "sha256": "84eeb263dcfc13cc4ea13683a9460dc8429df126182562c5b6986654be6f9e05"
  },
  {
    "file": "src/rwahealth.js",
    "blob": "4ee768236fe624aa5e52473dfc43d2397be57a68",
    "sha256": "4d66ab1b39da28ba9ab21e96b7757876060a128c078815764352714c3d4017a7"
  },
  {
    "file": "src/rwahealthclearance.js",
    "blob": "02dfe84dfd5a84769a507aaaa6c51e2cf3b6da2b",
    "sha256": "403c65d0a01d05451ca3f9e55f176107db4e65dcadf913751aba11afa5085159"
  },
  {
    "file": "src/rwahealtherror.js",
    "blob": "cb6326e32b75ee34fd9be7f01e33a417f866bbde",
    "sha256": "533e73daa647517573826fb27a2faff70ed1aa6b50f2a32f57048ce1339826b1"
  },
  {
    "file": "src/rwahealthoverlay.js",
    "blob": "0d69dc1bb1adcb91cf2c84ec6e999e29d42b2045",
    "sha256": "efaab17d829e25ed87361176f23cf6338e0d6c6ce1e581b6666d1e0017965d20"
  },
  {
    "file": "src/rwahealthread.js",
    "blob": "a670abb9088edc9b86e4e08ce01ced03eef75a3a",
    "sha256": "79f668c31dfe819cc2367d38cecf1f51c10f941000f444a385b6b6c567b0083e"
  },
  {
    "file": "src/rwahealthreview.js",
    "blob": "be5e7d44347886cedd855d70f33ca70071fdbcd9",
    "sha256": "05c4adbd70318d80f27b68ef0afe2d686a9a00a506a12911fd7ca78888c2a821"
  },
  {
    "file": "src/rwahealthsweep.js",
    "blob": "821dcaba20de113fe376e249c4be593b174c37f5",
    "sha256": "55f9659ddbccc868dcfbc06800931d821c24ee6f95f21817d5bb3d5152b6d1ec"
  },
  {
    "file": "src/rwanominations.js",
    "blob": "26f5eb05149d28e356de99e9ebe6c3fd3483894c",
    "sha256": "9de302484b1b8e51948095a4d2c1d0a11f00fe065dd79b5e6ba4d3d6a66c7641"
  },
  {
    "file": "src/rwaregistrylifecycle.js",
    "blob": "170b524583179bbc18cdec4ad15e538305496df5",
    "sha256": "0fa1f23fadf8461877b6dd841d2deb35300e8c66fdfd4df1ab3afa36c84ab11d"
  },
  {
    "file": "src/rwastockkeeper.js",
    "blob": "be045924e35ed5f15df70e4f15286e6e588f74c4",
    "sha256": "f2b008d8f6b2a1b8f4a9278de5b5ed14d455016899d14846b5e0f08c9469e804"
  },
  {
    "file": "src/season.js",
    "blob": "c1af65abc1a05f18f4621f65ef9c6ddeaf9448b3",
    "sha256": "20898d156c93a84e8f969e79339e5af00f75ddce9aadc1ebd5ae50bd49c20907"
  },
  {
    "file": "src/secrets.js",
    "blob": "02064da17348165215587d1ee2fd1df02bb90731",
    "sha256": "e2f2b61dd9b32b0f6ffc6a4959479d9aacba42a92fa57daa04de307199e6a5eb"
  },
  {
    "file": "src/server.js",
    "blob": "ff9178037e2926ff19d93e20631f973426bd965e",
    "sha256": "246ec1740b622d8120d8a4f8c9b38abe105b5951f63c9e65359221962ab73f1d"
  },
  {
    "file": "src/servicesubscriptions.js",
    "blob": "18ef234591696c141758f3916ae3260d0c075109",
    "sha256": "ab0f96b1fbe361a220ebfe22e8c83de85eb5ca840c8bad15ba0db045706dbec1"
  },
  {
    "file": "src/shipment.js",
    "blob": "cc9bed043035fdd798190c21ea553b224c42eda4",
    "sha256": "9a82cc90d88e10465e7777b0a3982eed2c023bc444a17fc7f5844ff35a229339"
  },
  {
    "file": "src/skills.js",
    "blob": "457963b53e6d7efa10dca3f8fd69f86e58503b29",
    "sha256": "f5904bc2d5b11d7df82319c24509a87558fd403649cb24d095730f48dbf6cb48"
  },
  {
    "file": "src/social.js",
    "blob": "5dd21b806728c20e9cbe91a8bd970f03c8d89d64",
    "sha256": "94af54beec92f7292eb2da56a45976c9b4b8c075e8af1abbe69487dfec7b5ac9"
  },
  {
    "file": "src/social/combat.js",
    "blob": "55177c5827811a42fc09a4995a7f6bf07248ef05",
    "sha256": "c25f0e8ae1a8d426a4f503db89b3e1968bf00a162038d048fc18b790c3af4139"
  },
  {
    "file": "src/social/contracts.js",
    "blob": "5a26c5440062394a33d0c19c74a9841a2c98c883",
    "sha256": "46c2c5293f89dde7a2dda71f48f5e517e014a7097cf7a44109cd02682c9a5c8d"
  },
  {
    "file": "src/social/defense.js",
    "blob": "a9b3bd4a4fbd941313d297fa1de9ccd98ccb3614",
    "sha256": "0058edfdfaf25345307a3e5b7b9507c83d91c1ff5c5b9faec6fe6f38a80190b5"
  },
  {
    "file": "src/social/estate.js",
    "blob": "28aa6601f3e1218d8a7f6433e4e4b1fdb04223cf",
    "sha256": "9f7030bef3dce98ba1160385b20451224117674cc0cb17efac111e7c2025124d"
  },
  {
    "file": "src/social/exchange.js",
    "blob": "eef716424eb4c5cb9d0713e016c7dd2b6018a673",
    "sha256": "881b77dd8f20a4f77b6776a80f4942cd50b004fdddfa9c70e06a224a2c2115bd"
  },
  {
    "file": "src/social/gangs.js",
    "blob": "e28e896d07725c7d1fde21c21bd07477f15ddc0f",
    "sha256": "f8ac8bdd2ee2706619d2d5cfd5ef8901f05415703c67cdd08d4e6e5554f53ad7"
  },
  {
    "file": "src/social/shared.js",
    "blob": "907454c5d2ce083c50088412bf6b6027af2cc260",
    "sha256": "c36ff669eb5a9cd24a9128819dd86bdddf8ffd210f156c8f0fbea30abb643f1e"
  },
  {
    "file": "src/sol.js",
    "blob": "5be0376b8043c8f3363b8c043c282ab547c666aa",
    "sha256": "3a209607f1ef02eb8c58e50268ab3aa25838fafa8ca91c7ea6d27564927e2916"
  },
  {
    "file": "src/soldiers.js",
    "blob": "b900d67e713911e3267811db9f76a1318601b7fd",
    "sha256": "897fc2d89d5838e0d78823d4136d2f7b2bbf96157a2f58c337a777c951d9dbf5"
  },
  {
    "file": "src/sov.js",
    "blob": "7e8ce00a5fc3e32810b590ae2b618953cc4ab406",
    "sha256": "c6f60c981934b5a9f56605164afbc35db059167f04cb0c4c5233c27e4ad180e8"
  },
  {
    "file": "src/speakeasy.js",
    "blob": "971aad16b37b300ed5928e79be1d39957b8bfca7",
    "sha256": "b499a9ba1716b2b17de5b623f465b05dad05e3bf677684f7a2a2f96a794cfd44"
  },
  {
    "file": "src/stable.js",
    "blob": "29363899a8292e93c30ab44ba986c97d947e837b",
    "sha256": "28c7bb72e3e230e301dc429f522dcf1025c8a2f12e907fda62bc18cc75058dfb"
  },
  {
    "file": "src/standing.js",
    "blob": "0077d849b8b81a4ceea6c7d91429ab75d4415262",
    "sha256": "e86fdd2ee3a24a01f37c28714bc79466edfe31a1b1d39d3af6a35c7f899b164b"
  },
  {
    "file": "src/stockcatalog.js",
    "blob": "170f4003830b1b0f04f50cd3edc50d7afc7c3837",
    "sha256": "7ffedf1bc0667be0a46c7110e90c019ca0a22b537941502b2e4885f04600d596"
  },
  {
    "file": "src/stockcatalogv2.js",
    "blob": "88d7613c1d0abfed2a6f35c6ecf4def9b7654c59",
    "sha256": "25fa942dabc6738bfa44b0c6e4ee76f28d19170b1e1c83db2b2e2ba0d08fb945"
  },
  {
    "file": "src/stockdeliver.js",
    "blob": "0360a671d0c0cdd0e395923bb295e8981e758108",
    "sha256": "ee9fab018ecd70f8e5440b5bafc0f4edeb32ae618353413fc96a5736a94943a7"
  },
  {
    "file": "src/store.js",
    "blob": "321d4046301eacf214925c397768cb8f189468e1",
    "sha256": "514ad59c728d126e101cc1c495d7073fcea288c6d70754ba07bff73b520f0bc0"
  },
  {
    "file": "src/storefrontfulfillment.js",
    "blob": "665dc908f54e2dcccbd9568d6be8b67ef48ad24b",
    "sha256": "5462546dbb50906564fcac9ea4034d122e4d3884a8205a6b6b953a9f369d443a"
  },
  {
    "file": "src/strategylaboratories.js",
    "blob": "ccc998dcbeaf541d408e16a95de1c08f8aa86bf2",
    "sha256": "ab05631dfd519202317e099171449901add64b0ed83310b1a499eba2a60f61b9"
  },
  {
    "file": "src/strategyleagueinvariants.js",
    "blob": "f11c719b468e2a67c03d62f53516f2314a16dedb",
    "sha256": "ec5434c8a11b604348f7202ada7a8087030b54c550718e8c3b1ffbe392304653"
  },
  {
    "file": "src/strategyleagues.js",
    "blob": "8a41b4de00a37dc7707fb179d4f618c975897405",
    "sha256": "a6c64ced9df8468c59beec5cf205461db3f3e01869af0cd26ec6a0d9e98a2e75"
  },
  {
    "file": "src/strategylicenseinvariants.js",
    "blob": "cb7e2ddef7897004d7e108a817b0399477ecfa7d",
    "sha256": "0abdbe5a08bff4d00f9cadaa855032e3e927543482d85b35cb694c6f974f91d1"
  },
  {
    "file": "src/strategylicenses.js",
    "blob": "9283ec0c361091ad117599aefde722981c1ac225",
    "sha256": "c5d2a031b85ab55e4d4bae79f960daf401d06b308fd88a0a3b2394b4afa37523"
  },
  {
    "file": "src/streak.js",
    "blob": "ac03bcb2c87a2ed4250f48e35f5292a9ec0499ad",
    "sha256": "5cad765980ba3015eb8e61293e0b4b716f23306089f8da73fcc91ee29d6d7c7e"
  },
  {
    "file": "src/streets.js",
    "blob": "224f6c65c5bd8837ccbd9ee3ddb87fda06c595a4",
    "sha256": "b3bd812f9d42a8abfc1b50763f8bf284f67ac5c7b0f01fc4cd99d7bf40f3264f"
  },
  {
    "file": "src/supplierhistory.js",
    "blob": "6f5797b5e92efe7efaaea822df140c7067879d2e",
    "sha256": "c2020f8d0931ef8d3731fbc6ca374c4a17e038f3328d7520f925184f6863b649"
  },
  {
    "file": "src/supplycontracts.js",
    "blob": "9699db1a1fb693a786c5f95591d99749171deff6",
    "sha256": "288c10daa9919507f1cb8974168c5982d8440bbda122ad45a0bae3fe6ec00df8"
  },
  {
    "file": "src/supplytenders.js",
    "blob": "c9693306923ee93c71bdda163829f83d4fff780a",
    "sha256": "7091f9a3217df25f0c85f14571baf6a0296f0307936a18f38ff7624038a063a0"
  },
  {
    "file": "src/tax.js",
    "blob": "0e5b44510a2bbf9c31bb538db9f4c201e5bae662",
    "sha256": "4a929815f3a6f4e0cda61c420d9f9301452743d90664d537ca0e504249ade924"
  },
  {
    "file": "src/territory.js",
    "blob": "3c3c30ca0628e36fba60640fbff107524ac80cad",
    "sha256": "b1575b832b75c55fd14133055db11f427746556dc30b3719890d05e139406f9c"
  },
  {
    "file": "src/territoryeconomics.js",
    "blob": "1526650365d36b6d64bc742fd2f2187735a1b084",
    "sha256": "2df30357205184201fdaabbe3d27acfd1b8b81bd72658a880b9416de38d02e17"
  },
  {
    "file": "src/tokenhealth.js",
    "blob": "b1770d83320a5e0f316fd40fbfc8156bfdac8094",
    "sha256": "bf61d323673822ca93b942027aebb71377a937c84e55cbf345f34f14b8ddb416"
  },
  {
    "file": "src/treasury.js",
    "blob": "9f6119fb3561479126ab9d32b67a66303506a6fa",
    "sha256": "0e6d636f5d26d2ea89d0e75371dc21fe6de459ce026c6cb4f03f43bc84444d20"
  },
  {
    "file": "src/underworld.js",
    "blob": "25d155114323da9225b90d8eda3a8b3c16fbbb00",
    "sha256": "e2af211adc809ab2231e4783366b4198b55cc4fda1a727c65c53f49e24d05ffd"
  },
  {
    "file": "src/v4oraclekeeper.js",
    "blob": "ee8b6bd140e02f8367b756bd321215b8fa4f78e5",
    "sha256": "49310d3fc7a239b4d44e959b39b43be4557cb159609814d7bff906b499f49120"
  },
  {
    "file": "src/vanity.js",
    "blob": "1cd187b46e6ed6257f5a02aae8981f3713f8d128",
    "sha256": "92cd9524ff89442123b3389cc1cca7a7eb19f583ceff1a7acb3bd92acda55c8c"
  },
  {
    "file": "src/verify.js",
    "blob": "0fd2911ef3bff8fb9359ef545fd5266ae5e66871",
    "sha256": "77576ba4988f9f483ca939fd5199114920b81b2df198d9d0b2fcb324d67d9239"
  },
  {
    "file": "src/vig.js",
    "blob": "04c973c4ab48f1595a62353cf03c321ad5348b34",
    "sha256": "88569b07e402cb5a1062b2d2d14aa3e46a2d51efa3d83c7bcc2a57b2eae841b0"
  },
  {
    "file": "src/vouch.js",
    "blob": "95ac94829394b32d1662f2af1532cb3f2f8d9bcd",
    "sha256": "941439b6b268c2c1ae04590f232745511ad4509512c95109b29a9e98f5247808"
  },
  {
    "file": "src/walletforge.js",
    "blob": "3b2322b0cb65d237b0d53ffd4159d23427ce3d16",
    "sha256": "0cb649701a31442e1ec6088b52f1e7d1129bf54eb2eee2b1e5e5d3fde675a97c"
  },
  {
    "file": "src/warehouseleases.js",
    "blob": "78d95391796089b5cbf10d4ffc82a5f4f47fc4ca",
    "sha256": "11f547d8ade1342a26f2ab905bb86d6947f64ee2bc2661d9e67b11d3a10d935a"
  },
  {
    "file": "src/watcher.js",
    "blob": "bb39bd3482c13b1448a36d23a9fed0f489c36b9d",
    "sha256": "408e90bd12f137b551ec29974bb1acfa9ea2545fbe7d3ab0de842fa5d3d90099"
  },
  {
    "file": "src/wire.js",
    "blob": "f5d1028d85ed2a694b090a8955e097c7156069c1",
    "sha256": "fe9783c20b06257e12d47412eba2af54fb0395d57755b82c00ae3fe07ce3cf1f"
  },
  {
    "file": "src/worker.js",
    "blob": "84be99e513a7a66343f0652a55fdc6d885d8687a",
    "sha256": "2a07dc2ac6740ffa9495b08f807d4cae591e0e7c8cc50da3f2746f9b6eaf0329"
  },
  {
    "file": "src/workertraining.js",
    "blob": "277f74e9ee46b53a387677f893d845e290f2dc3f",
    "sha256": "847011a9cfb0138f226ab5cd7a42a2e6b7539fe2e9f0890ecf42a520f691efbb"
  },
  {
    "file": "src/workshopfloor-admission.js",
    "blob": "732061c7f15976866692485479cb8b3f2b56a118",
    "sha256": "004214592bb3afee092d5ebad40cda31fc480a06ab8094e5a173491f703e62a9"
  },
  {
    "file": "src/workshopfloor-api.js",
    "blob": "09e91fca311c2799613211c323e80c14cc99e87a",
    "sha256": "a54078ed86c7b6f856969c0c373aa0495901af02e8b2ddc6edcc05525ed323ad"
  },
  {
    "file": "src/workshopfloor-contracts.js",
    "blob": "9a0f9c04c91c1a0d74d863f6eb85256ed0581f63",
    "sha256": "3319116fe529964469579292efc38336033d49d66518e1dbd26db3e4cbd34964"
  },
  {
    "file": "src/workshopfloor-schema.js",
    "blob": "abc1ec50f762277a7f122ecd7587f51cdb3eb852",
    "sha256": "df63148a91ea831194f087f73a968182df533e5231fca31a37079c59bf1c790a"
  },
  {
    "file": "src/workshopfloor.js",
    "blob": "3e7cceb82b41484ba54f26b7e1845b899e4d588d",
    "sha256": "62fb85a7695fde3c0301030357aff8b799d71b35bfe8032df66bb4b75d7a568b"
  },
  {
    "file": "src/world-consequences.js",
    "blob": "35a242fa83171a5fc7c57d15ce649f7efad5eb25",
    "sha256": "8a68f290ed8379dcf2cdebd76f32306bc27928c5031301015fceee8da1efaf78"
  },
  {
    "file": "src/world-kernel-invariants.js",
    "blob": "ffa9c60fc010621ccbeeff6e4de7ff61e7487e27",
    "sha256": "6172956dc72f97d6612797c71c99b920010df9810b8082f34f29eeba89017bfc"
  },
  {
    "file": "src/world-kernel-query.js",
    "blob": "5701e7a0ab31e536bf02e453a76e4efcfae35053",
    "sha256": "1a4baaab9bf8985fd7f02e281483adb5c7cf624a983e390be030217a222c603f"
  },
  {
    "file": "src/world-kernel.js",
    "blob": "eea22c3047688f968aff02a796ff4ddf87c50831",
    "sha256": "141f71783dd1f9126b74c78123d1fccfd403dc4a87c2eb8b6536f9ad8190c810"
  },
  {
    "file": "src/world-knowledge.js",
    "blob": "193399606069e580f91b6e0664e2c777b17a4229",
    "sha256": "73a5f37738dcd73e2299643f5e23422b1770ee04a890142fafbca49f864daeda"
  },
  {
    "file": "src/world-prerequisites.js",
    "blob": "47a033cf8a33d5d53d370e69c222fe95b1f9596e",
    "sha256": "c6548363a93bb481b44e4528ea78e6b77c1f694546d6a6229784b40b1ea8587d"
  },
  {
    "file": "src/world-projection.js",
    "blob": "ee06d4ab86f1b035535604fef9c792e70ac72ccf",
    "sha256": "212fcd8530472f9b4748fdeb49fd8fd7752336d4cfacbff29002f6562d7baed3"
  },
  {
    "file": "src/world-telemetry.js",
    "blob": "12657a75d012d2803868fa56a54b878ed724a591",
    "sha256": "888b3695c2aef0b05c2414392885705bbab21b26898830cf2e017379a92f7335"
  },
  {
    "file": "src/world.js",
    "blob": "fe4860755e133390260ab3b7de6d90f48e9aceaf",
    "sha256": "4946a0b43aa2f456a4f6cffcf2049cb576fbeee9241dc3bc4955db57a889553a"
  },
  {
    "file": "src/worldgraph-ui.js",
    "blob": "9bf9f7ae2573efca5a0f8505b0a5da28d87a9675",
    "sha256": "b8bb33c5ec1e8f45a12eb9d68fbaeab6dd95e999e06ae8e481f99201d4759829"
  },
  {
    "file": "src/worldgraph-validate.js",
    "blob": "24a34d664356c2c6db50a61ee10d7e1b910a1e9c",
    "sha256": "9db7733efb5d989aa852965036f3a77b4bdc0f434d3a10aa468c483bc90d7482"
  },
  {
    "file": "src/worldgraph.js",
    "blob": "aaad5b103a496a00e255cfde794a07688d840a8c",
    "sha256": "6557a088235dd7bc8f765b4a6df58f199a00b3e5f2aa1b5a2c4aa4041b888217"
  },
  {
    "file": "test/agent-economy-next-layer-estate.js",
    "blob": "0b029492d660dd75c6917e5232e008a7c37436dc",
    "sha256": "c806a3ddfa84e1bf3b2730af980d1e51adaa2550648dae22071c9cb2972a10c4"
  },
  {
    "file": "test/auth-fixture.js",
    "blob": "1d4dad44930dfcaea2ec5025bd46fae2bf111449",
    "sha256": "5563c246cc7e679a122d52624a1180523f668d6bb9d181585a8b34d89166b995"
  },
  {
    "file": "test/businesspartnerships-fixture.js",
    "blob": "48050a74b5c01bbfa46c7f67adebd716454d2470",
    "sha256": "eba7955f4a2cded9e6c3bb1a3553c2fa29f7288080c5d5958e0f2188daa679d7"
  },
  {
    "file": "test/businessrelocation-acquisition-negative.js",
    "blob": "bf1f75ec61d1a6363bdb346c4d1b8e2b2483bf78",
    "sha256": "f13ba1c0dfaa87145e138dd3f54bc308e1a3085bf3087922387d54bc5e94608b"
  },
  {
    "file": "test/businessrelocation-api.js",
    "blob": "39bb5a3eb9d1b014f947de6d1838bd10ad84be7c",
    "sha256": "79af3b5bd229409323b798eae264223e9724a9d05823d1785f4d964cde5defa6"
  },
  {
    "file": "test/businessrelocation-current-api.js",
    "blob": "8bac43da932bbfe25cd7de654d99c14ef24a9709",
    "sha256": "f6a7f96f06473a1a753631a0eefdc048e31e3ee9fd607aa138013be1a69d0434"
  },
  {
    "file": "test/businessrelocation-floor-negative.js",
    "blob": "38b06072e24bb27531746a05b6bf22ebe964389f",
    "sha256": "3717dd50d6c3b2dff21b3b5c450e15a7bd7c5e6b0df7719078c643ee4ba0e189"
  },
  {
    "file": "test/businessrelocation-history-negative.js",
    "blob": "3f8127cc02ccfd5b842f2e2d68a2500c1a4401b2",
    "sha256": "978e2bc979433e05474b1097c7e39ce0e6a101dff70065018c0fcbf5139d6f18"
  },
  {
    "file": "test/businessrelocation-license-negative.js",
    "blob": "78bce95ccb945d2c8d5b57e0f87308c5f0eb9fa7",
    "sha256": "2c786bf1295ff37e69478013edc9cf4f193b744c468f9aa7c84824a9989ff8bf"
  },
  {
    "file": "test/businessrelocation-native.js",
    "blob": "78a211d41356744335b248598e2adbd7d89a4ac7",
    "sha256": "a20611eafdc299c75a19de064d27906028c4409bd5c39cc0cde846dff329a2f4"
  },
  {
    "file": "test/businessrelocation.js",
    "blob": "1690ec9fe240029a3effa886bc62605fb4076003",
    "sha256": "1ba21bd4efa2fcc3117464ac07695110f63dc8faf8010ce4ffa659b5e3829821"
  },
  {
    "file": "test/coldstart.js",
    "blob": "417399c685fbf07d9ddf8edee8675fffb0ff8056",
    "sha256": "c049fa9c5dd344f43d01cdf5e20d88b031388b3b896fad659d235cae781880b5"
  },
  {
    "file": "test/commercialnegotiation-fixture.js",
    "blob": "2535cf0f7a75fc89c0202e371f5f62ac28588757",
    "sha256": "5c97a71409eaf980a612c5b2635d215c329ec9799f418a0da0c2ddc8268430cc"
  },
  {
    "file": "test/commissionedcrafting-fixture.js",
    "blob": "a834de1fe0e36882195c387eb95c05f938cf6910",
    "sha256": "040e2aec9ee00017920fe8f6eb945ed81dc583ed80ab891c98264c9dd8838ced"
  },
  {
    "file": "test/company-autonomy-fixture-guards.js",
    "blob": "63ff7d2620148eea8a5716c4fbf688fd5383f5bd",
    "sha256": "e0f1e9c017642e28c53086df157006cb4edb49b52a81a18afb01dcd6d845d192"
  },
  {
    "file": "test/company-workforce-contracts.js",
    "blob": "dd6562f226c85cafc98e15a4e6dddad83f256038",
    "sha256": "8088fb99a46ee830a8d7d8506552e548631b16e0137a69b7fe95d23c022f1253"
  },
  {
    "file": "test/companyacquisitions-fixture.js",
    "blob": "9d9e134ecfcd17ac954ac20654501a0c73c1ca36",
    "sha256": "3000206d7c8af7f38af79126d9199b12bf7445365be2ebad8231524ade6447d3"
  },
  {
    "file": "test/companydemand-fixture.js",
    "blob": "ecf1ee99890c9b20b69587d6105a278755eaa001",
    "sha256": "8a326af1d1d6c5b24964197ca9d7e352added2dcc605592889f97da3e4e02311"
  },
  {
    "file": "test/companygovernance-fixture.js",
    "blob": "66e206bb58c0659fa445ab38c61cc5e7a437cc58",
    "sha256": "d8ee0ab32f51f52506d67a8b3d18dba47458bfe231fb689b7a17185c7d59711c"
  },
  {
    "file": "test/companyworkflows.js",
    "blob": "0784e59969f23d5be86a8e87196a23cea618cd6b",
    "sha256": "6d6a265517ab729a24ae7b5f7ff72164f030be74f1674308ba02b08b3eadbec6"
  },
  {
    "file": "test/crossdocking-actions.js",
    "blob": "2af5d0383c0edb1a3471e2fdf877e8baf542696a",
    "sha256": "2abaa934f3975644bc5a10beff525f0629c9784f0f04db3b983d32a3f2fb84b7"
  },
  {
    "file": "test/crossdocking-api.js",
    "blob": "bccb4e438ad80283bbed6a25cdcb369a5dda94af",
    "sha256": "80e46559d0d60f28bbde8bea33151aa62e93617e90dc6068323cc95e4af5c2a1"
  },
  {
    "file": "test/crossdocking-boundary.js",
    "blob": "c614eccb368e1f5de1a6551b7a3e8f0162031afc",
    "sha256": "4c3196eeabf104a09c1d3fa9b545ee98e2b85bb57fc56ae1c7c6b96be41d4986"
  },
  {
    "file": "test/crossdocking-estate.js",
    "blob": "eb5c1add36bf22d931fe88599efe693cce931f32",
    "sha256": "97f399b90d8fff9756370aebfc9bf22c08b419b359ff7a49a92bfc28bea54e16"
  },
  {
    "file": "test/crossdocking-fixture.js",
    "blob": "1d503a9e94b7bd5e021a00c4712a712fbaef707a",
    "sha256": "da1177f16c4a1292923d13d32941aabd87b6f4282228c149baa8f629db14d486"
  },
  {
    "file": "test/crossdocking-lifecycle.js",
    "blob": "a69999f6b507b828841795e1e2f5bd2bc7e6df15",
    "sha256": "365c0702deb51f96d2707858d1199b2e072f97eeb17342a7372c7a05faefff48"
  },
  {
    "file": "test/crossdocking-races.js",
    "blob": "1ac4f825de6cb10ce44e4aceebce821a5b470ded",
    "sha256": "4d3880cf382604475eff0992b2427332ccdb78dfbe2056ab116d7c8e690a9330"
  },
  {
    "file": "test/crossdocking.js",
    "blob": "ce0e124a6f59b55bd7f6388dc26d61765186f1bf",
    "sha256": "34ab2b7d2e390b53369d5fc906b4b6b2a210a0d8811a92310a6949982cd49b98"
  },
  {
    "file": "test/customerlayaway-api.js",
    "blob": "37663222736616eb8a6e43bfa6c839efb50ccf89",
    "sha256": "a7f704f857b4d29bf75c73da25161627f23765d8656d8017b41a20933620fd19"
  },
  {
    "file": "test/customerlayaway-fixture.js",
    "blob": "b70a8844e64c186ea9dd1a741339823c5c1a1f58",
    "sha256": "e9678270dc86e9a4b1d3b4e0188d9939d10851cdee93d7c5577a2966e5648b4d"
  },
  {
    "file": "test/customerlayaway-integration.js",
    "blob": "8b27939c13d0b56d82b5b65becf1ed186719ba9e",
    "sha256": "5bb691447d2b5e13b8fe94490bc3b0d30fe87ab5dcaa51f5da2abf30811d8175"
  },
  {
    "file": "test/customerlayaway.js",
    "blob": "3781ce531fff714f0e3ac7bc6881bb3c6f488434",
    "sha256": "c0bc036b7f50f462c20ade19b88a9961b209aba7eb501d776a34833b02629cd8"
  },
  {
    "file": "test/customervaults-estate.js",
    "blob": "bed9609803451b08c5a4521c425feabffeb61776",
    "sha256": "8a2d442dcbeed62b850c993c3775b784ff54491325a08a617214aa7be522780f"
  },
  {
    "file": "test/customervaults-fixture.js",
    "blob": "7416cea35c10b030513021274641c6fa66466d6c",
    "sha256": "dffbe30a894b529e3ebbe3515d6c849d47b40ed8a957761d86a7fdf09a05ff7b"
  },
  {
    "file": "test/customervaults-native.js",
    "blob": "566bb9a8f4c45633a7e9134c5f106feaa77bd7ac",
    "sha256": "dc7ea4fc95333b69216436b45245f6bff3aee8399c8bf5b560faa140dcb1ac1c"
  },
  {
    "file": "test/customervaults.js",
    "blob": "2a6b95299ee7c58bde306d0e92f7943ce4d82423",
    "sha256": "27ce1874d16249aa6995bcce15f5cd8e4d5ab9435da3a5426efa2237fb6cdf6d"
  },
  {
    "file": "test/decision-dependency-integration-fixture.js",
    "blob": "9a666c64597c405a2951e12cff53585dec0dc39b",
    "sha256": "17ade33b5f7e1bcd92b33db824a45d2110628b2a3e1fa79efcb41eb953a00c53"
  },
  {
    "file": "test/decisionreplay-fixture.js",
    "blob": "4f39ca4b66e29d7829c5550b6028e978cc732960",
    "sha256": "23d3887afb62075d535863d315a3914061aef293162333b1759f56d40298a772"
  },
  {
    "file": "test/decisionreplay-integration.js",
    "blob": "9a66fba24ea5129970a14c5fcc7023990652a42a",
    "sha256": "460ef66fe64ce8d68e6ea9c0bc8dfc7f5b4a6ce0e3cbad340b71ab84df8da8f6"
  },
  {
    "file": "test/depotacquisition-next-five.js",
    "blob": "1a834d51acd871eece1ee4ea7f87ebe99e31725b",
    "sha256": "8b9baed3c98002807f50933f55a35349359cb1acbabc6f997a9461aefcb1b424"
  },
  {
    "file": "test/depotacquisition-production-slots.js",
    "blob": "45c0d12d1a873bab2c8b881e8b4fefddf8d5d039",
    "sha256": "5ba206c89767b644ae754a5bf0e3c223fe9964de464e380db47ea5af03984f7b"
  },
  {
    "file": "test/depotacquisition-vaults.js",
    "blob": "065615d59885f628678ebd1777612832222dae14",
    "sha256": "9c326b4fb5f9f68078ed40c58c8f07bdc82599402212e37e3c83030860f58b59"
  },
  {
    "file": "test/director-migration.js",
    "blob": "beee063d52c4b817c655475204ea30e6807c823a",
    "sha256": "5174ae4d7f531d21520b3356d3dc0407fe465490e6f661fe0b2ae3eee068cddd"
  },
  {
    "file": "test/economicdependencymap-fixture.js",
    "blob": "b7f4f335a059007287e54e7304286e7d89317856",
    "sha256": "43b05a90c6151965609b69166a987425c75ddb9471a097704dbbba33dbfa3987"
  },
  {
    "file": "test/economicdependencymap-integration.js",
    "blob": "f6febd216cbb1618fb48e052dbebecfafd682b32",
    "sha256": "cae65189da54853d7f14d7a3acf337ebe3ec527d1668c0c73ba6a0e40e0d22e3"
  },
  {
    "file": "test/economicintelligence-fixture.js",
    "blob": "867227a37a38faba92fdd5bc0bacec2401dc8959",
    "sha256": "929509fb801a4aac65c3593af6e6d7a51b605ff8abc07c00bc121269f18e085e"
  },
  {
    "file": "test/enterprise-release-phase2-migration-catalog.js",
    "blob": "8db275cac3a74e2eee02b0674ac9426f27c71ca4",
    "sha256": "499748c0c688c3f40ec185cd8cf538a7e1dde717c1ed4a8f98b046982120741f"
  },
  {
    "file": "test/enterprise-source-compatibility.js",
    "blob": "04c0db53662c34ab8ab417c7b8402e114dd9ee73",
    "sha256": "52692f9d9af8fda81a555c8c91c3a78ad828d054e292227099ca5f1a4455c3b5"
  },
  {
    "file": "test/equipmentinsurance-fixture.js",
    "blob": "fdbf53137cde2849adcec75c31485c4a9f4746d5",
    "sha256": "0d9dd32d56996fdb38ae417982bd83a3c9135f547ef9291b17b353efd93bed91"
  },
  {
    "file": "test/equipmentrecovery-api.js",
    "blob": "2bddd33035b59d3a945ab7e0dc7812abc6b30e3a",
    "sha256": "7480557be496b009bd1d19d056fde1c90fc16afa3bda73757f25ce5e259b6578"
  },
  {
    "file": "test/equipmentrecovery-integration-fixture.js",
    "blob": "03381c80e41d440bcdb758ea44adee34a28d45e7",
    "sha256": "d7036c9adc416eb6ba31bf2facee820fbc5771de4f43fda7c54a95d5fcb43f08"
  },
  {
    "file": "test/equipmentrecovery-integration.js",
    "blob": "c103d56bd2f9b8df2aeb4f536ac47eda414c34b0",
    "sha256": "51aa1fe12faab1bc8aea9734b03fe31a7cb1bbf3408d7b319b66fb343901c26d"
  },
  {
    "file": "test/equipmentrecovery-native.js",
    "blob": "223dc8841e1b176cdf9f516d1a0ee4b7f9a81be3",
    "sha256": "e74d42c2841b6e1b9c4b81375d5c603324645d2a006387d4f659882ed7a17bb2"
  },
  {
    "file": "test/equipmentrecovery-wear.js",
    "blob": "f412e7642f68099d86cb6588a6ca0993a60ef420",
    "sha256": "5fe68cb5597994b6e8ff9c7479e5a827a1f53aff24ad9e232710a4ca38c5b388"
  },
  {
    "file": "test/equipmentrecovery.js",
    "blob": "2b167f7ce6d248728fdbfd7f2d54056d990b007b",
    "sha256": "f56e4d92875f6b45db7644f4b469e14fc2bda22d26b26999fa40c5e7425ae173"
  },
  {
    "file": "test/fixtures/content/runtime-minimal.json",
    "blob": "9e6e186d9799b8ac1df21913ee3b4308d6a0f651",
    "sha256": "bb29eb15e5ec17a1e4ccbc5e7247a0b2231ef267ffa7f70fc9825f651c0228a5"
  },
  {
    "file": "test/fixtures/content/valid-minimal.json",
    "blob": "46ab9a8df25fac053e183bc86e6b55a675a81d1d",
    "sha256": "720f34aced5a93cf4b58a642dd6af4617bc54380e718509c489f5dbc2e38c9de"
  },
  {
    "file": "test/fixtures/genesis-stack-runtime.json",
    "blob": "b82cce73483fb548760c529213bf285526b017af",
    "sha256": "13d73da90e402b41c9ec5aa21421dca8c56b7a660d4b2eba4c32fe5120134de8"
  },
  {
    "file": "test/fixtures/phase2/compiler/malicious-duplicate/pack.json",
    "blob": "9a7e8f806350828a5bd78e94171bcf35ab0f4f49",
    "sha256": "0b64d88c7b3ec67bb2d572a4ea88f8450b5b794c84e69f305e64b124cfcd3e4b"
  },
  {
    "file": "test/fixtures/phase2/compiler/valid-core/pack.json",
    "blob": "9a16198271540fbaf005b688cfa938acd8b7d290",
    "sha256": "1ad4cb2be130d17e59e2353ad0af15e69a0208141605a2552a6f83332cf87d54"
  },
  {
    "file": "test/fixtures/phase2/discovery/fixtures/adversarial/pack.json",
    "blob": "79110bcdc3a3551047109f3503760fa5f3f4a82d",
    "sha256": "152c2fc5e67ea1a68a53d4971f5cce5579dbe14374b3004c7c932be25c8b3337"
  },
  {
    "file": "test/fixtures/phase2/discovery/valid-experience/pack.json",
    "blob": "182a545de4e47e54d0fee2dfa952b6861c166412",
    "sha256": "a042fd0129a4685352b6bd6857f4701864bef0f7825376989bca973d9d83fd26"
  },
  {
    "file": "test/fixtures/phase2/discovery/valid-library/pack.json",
    "blob": "ce3cb706bf13d44c7deda9a9d0f6c7c4671bf797",
    "sha256": "a8cb595c22e5f395761da1a50e3c25a0781a1988b7b9daa49f2b4ed2c51c6c9d"
  },
  {
    "file": "test/fixtures/rwa-health-overlay-v2-vectors.json",
    "blob": "b523a3d1576a32eaeed7dfdec4bc3ba197a09846",
    "sha256": "90079af8d5fc3a4b6352b33561279eab0a5f8e4a3e6aef3a219c4c5ab9a302aa"
  },
  {
    "file": "test/fixtures/rwa-health-v2-vectors.json",
    "blob": "2c59c82545b5722c6cd9185ea5d640f29fe4a1c9",
    "sha256": "814657b2911a1dd514217324cd032878114c73478682de7b801d1001dbbce10a"
  },
  {
    "file": "test/freightconsolidation-fixture.js",
    "blob": "ff90d9140e9b5b411decf0a4da155afc64a44d24",
    "sha256": "3c9581d5447d4187964d94b8f5be3c1e047c7389de11525c5239d6ed0ef79f91"
  },
  {
    "file": "test/fundedexternalwork-fixture.js",
    "blob": "6e8aaec7a42ac6b2f280b78ba02568eb4e28b76b",
    "sha256": "bf355c20e382214b293649539c6330b9ea98e3503f76d4eb17db7890b7376bd4"
  },
  {
    "file": "test/gates.js",
    "blob": "9473879edc2899c704157fa7fd1e2f2982a9edaf",
    "sha256": "e5454cd2717678dbf8889551adeee59256b428ebd6df1479d986b1cea544cb57"
  },
  {
    "file": "test/graph.js",
    "blob": "6c3cd698f8f72f46c6a36309abf6d9f9dc7e11fa",
    "sha256": "ecc63b6ca017cfbb53cf35e43abca31cf14cfdb855d762ff3db0d9c7ebcf4133"
  },
  {
    "file": "test/lib/campaign-network-support.js",
    "blob": "728d3adaa8d2928e83bc97faca2934bee76e3796",
    "sha256": "6469eb0faf8a790d8c616e379a72d4c84027056fd082fd12e68b24e8c76ecf0e"
  },
  {
    "file": "test/lib/city-gameplay-migration-catalog.js",
    "blob": "911ee3e5cabb0d37ab5222e4e031f887b8c0fd5e",
    "sha256": "d7a40f688e3202ba693d38b39d39fb442d280caea3d87f79ec28c3c3eb247f82"
  },
  {
    "file": "test/lib/city-world-opportunity-controls.js",
    "blob": "c97239e0ca3ea06dd99ef7eed4c55e13575c7ce9",
    "sha256": "4af3010e83646e7587c09142254b5fbcbcc060e9b33564aa305e579bf7ee9edd"
  },
  {
    "file": "test/lib/company-autonomy-fixture-endpoint.js",
    "blob": "db598692ff62dff730483e6cad910847c4a5d748",
    "sha256": "21fb1980858a258b92175a2cf2a57f774d9c00df0a121abe71e288ba1073b54f"
  },
  {
    "file": "test/lib/company-commercial-dto.js",
    "blob": "b02928b3169eca75e392c8e3c9efcaab42f94185",
    "sha256": "6cb07e71a7252903db134d60f9857e7e251cca1c94eaf9c7039cbd72980b39ef"
  },
  {
    "file": "test/lib/company-middle-five-fixture-schema.js",
    "blob": "3da996942153d8774d50579c10d490af54f7a572",
    "sha256": "e551c1f704023cf0c4ac83cf5729dd921cfd8865acabc8f387e2dcdd16e91de7"
  },
  {
    "file": "test/lib/company-middle-five-native.js",
    "blob": "7ea1ba4981c4a64f5c6eb05e302b6eba86723792",
    "sha256": "bb80747b46e89e7aa72294f147f14c69f950419e5f33980858313ea490bae260"
  },
  {
    "file": "test/lib/consignments-fixture.js",
    "blob": "9ba70b05c8fd36e15a104e830e0053d0c7c2ea9f",
    "sha256": "a8d0154e636c23f81d6e56aaa8a591a5b41fda8ce4fa0d2468efa1b6946ad63e"
  },
  {
    "file": "test/lib/director-support.js",
    "blob": "694159d124c1670f5df9d7b19d488663a82cc98d",
    "sha256": "81cf16cb4a3367099805918be8570acfae9167777554949ab3da4f95e8b4b92e"
  },
  {
    "file": "test/lib/equipment-economy-migration-catalog.js",
    "blob": "08d61ad2adf9e62c73539d1be833cf3c764e693b",
    "sha256": "62409e33203536494a61a34c235a134799b7c46e3f50424244bb0c190bdc6be6"
  },
  {
    "file": "test/lib/phase2-architecture-upgrade-catalog.json",
    "blob": "ad01d33ca72695cb0e4f2fb6bc751b45eeeded86",
    "sha256": "44246d5b00b1a1bd7189211be6d9c36cc8680365fb0b9207394a5246f8ca7917"
  },
  {
    "file": "test/lib/phase2-definition-fixtures.js",
    "blob": "7e2d24c68cf92f1ffccf40f724e6a87abfa56c51",
    "sha256": "6a4caefad045583ec40f83b1dc7167a996d1f6d192dbf2fd5a48487dc5b45ff5"
  },
  {
    "file": "test/lib/phase2-item-fixtures.js",
    "blob": "40884292bd09a8442ee4949c91fd0f66eb874a92",
    "sha256": "fa963315d9e2c104bb0d052d7b4c821a0ff356c10369858aac8f13751aa9807c"
  },
  {
    "file": "test/lib/player-command-support.js",
    "blob": "64ea82dc7260db453a4ed25c8eca04deec33ae31",
    "sha256": "01ee09a0805a10ccc742e36b1e525d72a8c482940e1600e0a468c8ad749efdc5"
  },
  {
    "file": "test/lib/rc1-authority-probes.js",
    "blob": "dccc1bbd184395ae75aa9dcb8b92ce15d68f887b",
    "sha256": "7e2d03379da9403b6a7bdb5f84a4e2489a86d386a01fd00de66cad330f2399ae"
  },
  {
    "file": "test/lib/rc1-board-diagnostics.js",
    "blob": "8d2293696ad46922dd6237bb8f1dd672d169b58c",
    "sha256": "4191f3fcae70a1f484ad651beaa465f3ba0c2786dcc48c4a31eda9f825c103da"
  },
  {
    "file": "test/lib/rc1-browser-controls.js",
    "blob": "d460a0c7abddb2c1667131c2590508f719e20caf",
    "sha256": "7e8b3b0e0a2612b4e373547c29291f3efd2097efb26e2fabf9e18357009c6567"
  },
  {
    "file": "test/lib/rc1-choice-confirmation-probes.js",
    "blob": "3dc961ed41b6f9f48ae4afcc0443c59f4cceec50",
    "sha256": "1f1d80c442c6b11b0968df4276557705bb657498f487dc9cdff59752bcc0472a"
  },
  {
    "file": "test/lib/rc1-family-entry-controls.js",
    "blob": "fe9b3ba68149f7173aa1f905b8cd0e12c7080734",
    "sha256": "f02776273c23b41db318189b31c5263243714b8581223517ffbe24647feda905"
  },
  {
    "file": "test/lib/rc1-focus-diagnostics.js",
    "blob": "5355a059a7a3a9f52bea33c9859588d1ad207722",
    "sha256": "39b4e8a6c96d1ad4601cafb813261a98ad7d47a6ff9e8a1c2f0663ce88ebcbdc"
  },
  {
    "file": "test/lib/rc1-historical-source-fixture.js",
    "blob": "03c53f8fd02323718e5ad5f226e70cc20a1d5bf3",
    "sha256": "f62744c9f0cb55630bba46a169a091621badf1e3b8583418ea0287f9e6244146"
  },
  {
    "file": "test/lib/rc1-historical-worker-source.js",
    "blob": "0c902ddb458354800c01448923b9254c31b12a0f",
    "sha256": "054c3b3a95f9bd7549ba9a8941bd404523d53f5a12918ec2c68da3f8cdc86b9a"
  },
  {
    "file": "test/lib/rc1-npc-boat-controls.js",
    "blob": "4a6e2c8edd5293c34d28bcb370f5f09e4f589ad1",
    "sha256": "d2ba98dc1edc39d0eb1a45a4cc392ec8330012d240a403327130de5221b304fa"
  },
  {
    "file": "test/lib/rc1-npc-family-controls.js",
    "blob": "a99f34ea48072e8e8dfe48c43544116b90c237a6",
    "sha256": "2d7ac583a5b094684406767cce6e840aff7cab646814cc506bd03c2904d264a3"
  },
  {
    "file": "test/lib/srcfiles.js",
    "blob": "495839c5283492f5ff775c039fb2094491f9afb4",
    "sha256": "d57b79712752245839376321e1597ffa6c6abf536b9abfe9439d73c4b7124256"
  },
  {
    "file": "test/managementteams-fixture.js",
    "blob": "931ebb0f8a1a4e6b68857129b5c81e3578d53f19",
    "sha256": "cbe26d291fd2a60610e748d953a35ba6ddc69297911732e0f2a4929232949740"
  },
  {
    "file": "test/manufacturinglicenses-acquisition.js",
    "blob": "7ae9fbbcba9457f340f64c89476b03e2fb890153",
    "sha256": "91740bc9606004b6e6ac5522c6a853056a49d3d89d297d149802730e780c50b3"
  },
  {
    "file": "test/manufacturinglicenses-api.js",
    "blob": "aebc88832f284b846d10589911f390082364804e",
    "sha256": "88b2f249932c6282ea5976e403d853bccadda207315388193865a479c7cb8f60"
  },
  {
    "file": "test/manufacturinglicenses-contracts.js",
    "blob": "80e85290679efff502e61ea4afdf5affb1b691fa",
    "sha256": "20a678f103b6fa6d9c83a156e89da5e29fb227bfd1b295777de202e8ab39a339"
  },
  {
    "file": "test/manufacturinglicenses-estate.js",
    "blob": "e9b822ea79c5d28fd4a050ea3c5d7516f43f097a",
    "sha256": "a617084d1e8e7ddc2e2c536cf9c5dfe0f14836eb282530f238d0420375f818b9"
  },
  {
    "file": "test/manufacturinglicenses-fixture.js",
    "blob": "589ab9da58935956f883cf73062f11b5b894b490",
    "sha256": "dd8ce06d026293736068999a85d7cfeea5d7a3dd54c9c705ceaaa7ea1efe9aba"
  },
  {
    "file": "test/manufacturinglicenses-integration-fixture.js",
    "blob": "6accbdeb11b67720b7d59fd66d80190e18de03a3",
    "sha256": "6fbb1dd0ded6e3f785d6931d6056038e43718f26f3663714e287f563453244a0"
  },
  {
    "file": "test/manufacturinglicenses-invariants.js",
    "blob": "b1db305b4c0d61be2ff0835ceb8b58a42f1b13f2",
    "sha256": "5d6aa0df3aed577ecab1459df8ad518c7812e523d1c16083ce86d5814ecd3f1c"
  },
  {
    "file": "test/manufacturinglicenses-native-acquisition.js",
    "blob": "13978edba30e25ca50b303bcfe7e164c7c918fb8",
    "sha256": "c4f94005dc7d40a7f54f08822c191c3c873d1d9e831303ab8b00427c6299adfe"
  },
  {
    "file": "test/manufacturinglicenses-native-assertions.js",
    "blob": "d9b3e9ee2ad59b86c6c1e67621585128c1d6425f",
    "sha256": "1c82d0f42a9cd848290842eec24bbb19dee6ecd86e103477c138ea7d602a7d6f"
  },
  {
    "file": "test/manufacturinglicenses-native-estate.js",
    "blob": "914698d501aadc3894b4f27bb0e1dafb4319057b",
    "sha256": "21c33d37aa440d67b7de76ef24643341ec818e7fcdda4468a7cd7e78ab08f002"
  },
  {
    "file": "test/manufacturinglicenses-native-fixture.js",
    "blob": "19324f856c221865431ca9a88c6317843d8c510d",
    "sha256": "1a43c094b78dfa3d63e394cbc906efaef963f7e626b00534e6f863ad5fd622c0"
  },
  {
    "file": "test/manufacturinglicenses-native.js",
    "blob": "bac2bca938e419a9cabb931e6ef9d2710d9e1650",
    "sha256": "9cfd67cb6298332a08953bcd47a3b6701cd79eedf9b31995242e7e580d7fa1e0"
  },
  {
    "file": "test/manufacturinglicenses-production.js",
    "blob": "d1274105c479930409a777edd702fe652c146a50",
    "sha256": "398ead3e5dc83af4d2030b58403c5fc414cb124da2e465c093326dcbaf4ed9bc"
  },
  {
    "file": "test/manufacturinglicenses.js",
    "blob": "31cd3ca5bafb14650366da0c81f5eadbaa7028b9",
    "sha256": "27296ac1e58f37d1bf9acfe9bededc6a9d3ab6a03ba76e87c764dc5245f4f4b9"
  },
  {
    "file": "test/market-operations-director-catalog.js",
    "blob": "b4dea25cd378e8edc61ea974e932000c9ffeb163",
    "sha256": "e4bda0bc4efdb4db3b55af41d5b465510c73c76b4271c0becfd63701cfbdfe38"
  },
  {
    "file": "test/market-operations-graph-helpers.js",
    "blob": "1b032d0a8d847a5ee3efd72ebe05baecf9783724",
    "sha256": "fd1609b56b500cb4b97ec2e0bd485f59dd1eece71b16983462c53bfb600a0ae6"
  },
  {
    "file": "test/market-operations-native-guard.js",
    "blob": "3cdd8312ea1e68054671d34a030cb88a06c27ecf",
    "sha256": "8903c7abc9418c039510d6e73de7b4867afadba9ca817a5982b8bd343b8a99cc"
  },
  {
    "file": "test/market-operations-release-phase2-migration-catalog.js",
    "blob": "55129086c8ca7b00ba50b71d76ed2e8fc05f547c",
    "sha256": "2f5ec4a8cc01f4f5ec01d6681a5dd059b16d95105e233641d585ef4883e92354"
  },
  {
    "file": "test/market-operations-source-compatibility.js",
    "blob": "2fd1d0a71956beabaa65d84c8cc9491d62d863e6",
    "sha256": "2b4568bf1ee56b6ec00fd4bad30f99363dcc35ac7ad2f974325271b80905333b"
  },
  {
    "file": "test/merchantreturns-api.js",
    "blob": "4dc804cf4aec4cfdd632d44a4060c6eab2f98067",
    "sha256": "66d1245231edb933cbb34c821819339a47e138ff5a6e97279236f011df5aa62c"
  },
  {
    "file": "test/merchantreturns-fixture.js",
    "blob": "83e0976181b9927b3da1edde99780a5a1851922e",
    "sha256": "ddaa26a3107fef4504eabd5bd38192ca10d786822b7ccd78793b23620dbd6da2"
  },
  {
    "file": "test/merchantreturns.js",
    "blob": "3c59e38b7ea60f039db68de4f31c4bd99bc01e5f",
    "sha256": "9439b463efac98e4267722aa1e6773138eaca8aff5e1560a3d80c8c526f7be1f"
  },
  {
    "file": "test/migrate.js",
    "blob": "e7f1fa84d0cdb66581e85d764a34eaa41bcc03f0",
    "sha256": "f727e001fa28f587f9398ac1bdf4c9f4f171a090a36274185db5a3e211b3a05a"
  },
  {
    "file": "test/mobileshops-api.js",
    "blob": "b56d4c4587254d44afdb2e831c04306e315acb34",
    "sha256": "6bbbe8ddae34c4f357416b2ed5caeb83919aa9fb12eb3c18a3fdac9f3aab57d3"
  },
  {
    "file": "test/mobileshops-integration.js",
    "blob": "fad5d50091f8c596db54cbdd025e14b5b096380a",
    "sha256": "11037d7b1127efd57f04c62d7096858c2b77d50eae42c84a40870d8df7990b76"
  },
  {
    "file": "test/mobileshops.js",
    "blob": "5d0d53d3550f59a60c03f4d98b2f818e8a58333b",
    "sha256": "a1844a45e6198b5eba8810566a9c970d0294145f0db4473ed14e0190e23d65ff"
  },
  {
    "file": "test/multihopcourier-api.js",
    "blob": "62c1f1a1c2c29ff889d89b5b47be68c91eee6a88",
    "sha256": "43c55cae4a7cf35b09dccde9a14245dab8442ad55d67a2d48989563ea929d4f8"
  },
  {
    "file": "test/multihopcourier-boundary.js",
    "blob": "9315e11e7ca9d3571ff860e080462cfea5940314",
    "sha256": "36e37cb8082b2526cc649a42a28ae48afc33983272b22ecb9e91aa2d04ac41df"
  },
  {
    "file": "test/multihopcourier-estate.js",
    "blob": "55aff5bbffda02e3b311f027cc924ccef4d1d0e5",
    "sha256": "603c6aa5da46c7c2fcb7a98edbe46b94d2bbcc9bd9a62382c6fc37f2e583a425"
  },
  {
    "file": "test/multihopcourier-expired-owner.js",
    "blob": "27bec674b352d2568c6ad54baf0a40f8c6011f84",
    "sha256": "2135295f6261327904a26c2d2f93409f7bb73f942902dbc8498f49e2f6dfb927"
  },
  {
    "file": "test/multihopcourier-fixture.js",
    "blob": "6f808536254d341118af509c31731ffd56548a38",
    "sha256": "9a9e02d57b4eb918a1e00d071439d30e7d47e027f5fbbc7f7f2f8fadee3aad40"
  },
  {
    "file": "test/multihopcourier-idempotency.js",
    "blob": "daa11d592003e57c93a020a9f5a57c2ee3f6c31e",
    "sha256": "c69c3056cd721d2bf1a7e9ea9b0a51af16401c58bf094c189aa1509e37d8f6c9"
  },
  {
    "file": "test/multihopcourier-recovery.js",
    "blob": "2585772243f359afe56ebdbfa54ec72a30c18e0a",
    "sha256": "507fb44b5665087ba4a9d15821492a31a92ae1596c2a6341ab500dbcbc9075a2"
  },
  {
    "file": "test/multihopcourier.js",
    "blob": "546d1e6a888b9fc6699e42d3924d2ba625611a29",
    "sha256": "f4d22db904a15d6a5aeec4827fc255c82a5be0f6efc04e76094633766849df88"
  },
  {
    "file": "test/next-layer-graph-helpers.js",
    "blob": "f266a415f2214b33b8874f21217c51b64d93fbfa",
    "sha256": "38905e8d82f98552bfef1c9b2fefda9adfbc5687dd3badedfd544bf50b50e41b"
  },
  {
    "file": "test/next-layer-native-guard.js",
    "blob": "ef6136dd268c4ac2921a97fdf82cc9480d63829e",
    "sha256": "edfec6ed328b2605d788ad325d7255c0cf8d1ed4c9d30bdf67a01997502f1bce"
  },
  {
    "file": "test/next-layer-release-phase2-migration-catalog.js",
    "blob": "b7ad71058b6aa3199435123719019c52d68c40af",
    "sha256": "fe5f1b4290e97306cbeb87d238a80c02591dc1bb4da8f7469e8ed209bd55e351"
  },
  {
    "file": "test/next-layer-source-compatibility.js",
    "blob": "3c89a3558ae954a24520ad59681eb4ac5b77bc70",
    "sha256": "ea1f52c8311d35f1339610693a0794a689777687afa8e85e240463577c16954d"
  },
  {
    "file": "test/phase2-lot-boundary.js",
    "blob": "23611d9a957258cc5832187e77b179bf32d9a6fd",
    "sha256": "e190a4949e03681820e885a2e2db7e18e4b1e7f103eb979a186c17fdfb6abec4"
  },
  {
    "file": "test/phase2-lots.js",
    "blob": "a18613d86866e60c1d0854af1bd9ce6541f064fc",
    "sha256": "99a4134a76126ca315ac224a16cfc0d39dc7ab605529695dc7110bb1ab4af2d2"
  },
  {
    "file": "test/phase2-postgres.js",
    "blob": "084a3a46d61eba9748269ad0db9b131c417b1068",
    "sha256": "d611dfc5999a22580b653bfed1b7b1d6cd1c1416bc0661cfce23330afb840ff6"
  },
  {
    "file": "test/productionslots-api.js",
    "blob": "97aa257a4138c2aaec2dea0fa5cf0b8593b1799c",
    "sha256": "f9c472b33142d0652041edc4fdab7ef50a367b9d5192194141cfc46b1613f1c7"
  },
  {
    "file": "test/productionslots-boundary.js",
    "blob": "590450c81fcafa07ae2a6fdd11fbe2404f76ad2e",
    "sha256": "b9b5aa075f922cd123b701254ff75e35cc2a91586e0b8223a989e8e58b77646a"
  },
  {
    "file": "test/productionslots-estate.js",
    "blob": "e0d31a86445a381d0fd38dc3c6f633555451820c",
    "sha256": "318ed032d021cda9dbe457b8cef7871ab6fccfda6388b9213c0ce3a0104bd08a"
  },
  {
    "file": "test/productionslots-fixture.js",
    "blob": "9104fcc8be421ee4bd74e2dc386570f122f0a188",
    "sha256": "65337a223a7bb6d3e534a4b76cdc9ed410aca3ba5707b1dfdae33d3ac3c6860c"
  },
  {
    "file": "test/productionslots-races.js",
    "blob": "ee77680d6318136ea20e97d526580e6576fc5bb6",
    "sha256": "aec6f93172137ad0f3144a827d89d44519363f5aa24666a640568eb1c4aeebc9"
  },
  {
    "file": "test/productionslots-recovery.js",
    "blob": "5b210f17cce30be1b52e0fb393a8de4fa91cd0e5",
    "sha256": "33743ebeb6f8e2bfd078a9359c111f4ed130677b49159dff74d606091e19254d"
  },
  {
    "file": "test/productionslots.js",
    "blob": "aee383b00386ca40b2d7233119ef681c0a9da7b3",
    "sha256": "1d7a2fa4a4784bb12ac3d3b3b4bd7cd081f566be42fb171e60599f1e8cd888f7"
  },
  {
    "file": "test/rc1-city-gameplay-source-compatibility.js",
    "blob": "ad1f37112359d8c052c7069e1ecc668d4b01f64c",
    "sha256": "6588c3a441d4f762b5de23c91a8400eb7bc5091dc48e97bf1894a610ed4fa8d8"
  },
  {
    "file": "test/rc1-first-batch-source-compatibility.js",
    "blob": "02591fa15e41ec0c6b396905a1f30d5120a5cd0d",
    "sha256": "dd48de98ba7602940e0f22eab4d11f88a48839a0de653b55e434dbe0431ebe7e"
  },
  {
    "file": "test/rc1-native-world-workload.js",
    "blob": "6f505b2ece731ffa0890a1a0f916b2f08f8e6c53",
    "sha256": "9f5ae80f05baa991b38e5a0c34afa144e58f2159fc6df2cbb80ca55a8ecf3fa3"
  },
  {
    "file": "test/server-fixture.js",
    "blob": "565a699bd4f67a3d248f420a04fe81d41473ae96",
    "sha256": "4d12bb8a43b460e89a93046c31368316e795659879455d9198b5f0b071c478cf"
  },
  {
    "file": "test/workshopfloor-acquisition-compatibility.js",
    "blob": "ff89d8df5c6d2c72395a5d4897d33fac5962f76a",
    "sha256": "2de89112afadd3f741fab59d68d7b9f3775150b1ff0e595c82058b8a8bdcf3d7"
  },
  {
    "file": "test/workshopfloor-adversarial.js",
    "blob": "99930bfdd01097319e89295300996551a2ed2cca",
    "sha256": "b42c64921964679d60d686cf41385e416a1b5958e7d2497f15bc71b66b3ae4db"
  },
  {
    "file": "test/workshopfloor-api.js",
    "blob": "0938530a873d13ffe1899fe74433cb288f352671",
    "sha256": "70c337facd56017b1ea6c1fbb26a0548a6d621137450a03f058eb95bd80e6259"
  },
  {
    "file": "test/workshopfloor-capacity.js",
    "blob": "c4648157c4e8b3d6dfc9eea7f32e9f47bb38e3ae",
    "sha256": "0379d0be1dd508ea4faf06f314ae2ce285c96e09e90b5416b07f57c653a854e4"
  },
  {
    "file": "test/workshopfloor-estate.js",
    "blob": "1ace5f588ee6ef07e12036db1ac5a858541bab9a",
    "sha256": "3e9b082ba6e52f1af0a5bbc0976f61f33308e1c8cfc7c872d56e6f57b094cce5"
  },
  {
    "file": "test/workshopfloor-expiry.js",
    "blob": "b7b485489bbf182b416acc9a5ce9c2e33a347fbc",
    "sha256": "abbbc44b2930bb0974ae28967af73e361c4745d79fd094ad85b9c7acd2e38d79"
  },
  {
    "file": "test/workshopfloor-fixture.js",
    "blob": "402046fef234f4307d1fdd55500433b8655e3e7e",
    "sha256": "8a88dbab82cd96e0e94a1e615c7c8b8beffb3439df71a67abd50ab143e49835a"
  },
  {
    "file": "test/workshopfloor-recipes.js",
    "blob": "36320fef9b12c99ef3af6723f3c08e7b77fb373b",
    "sha256": "e9ff851a1f30e24d3c6b718a357f5ce1b2a3ad5bfb2c965a7bc38828cddd6173"
  },
  {
    "file": "test/workshopfloor.js",
    "blob": "765d03fd483722b37336af0545c4858cd831c0f1",
    "sha256": "84e803911bfe6b9fda4de9a89191db0496be7806425185230e44300dc00ce5ee"
  },
  {
    "file": "test/worldgraph-validation.js",
    "blob": "0f5272b41cb138775276a3bc25ad368cec7d8126",
    "sha256": "f6b5dc19d1b3b7beca45baa87e5a698dc8d958d5e93de3ac7e58de7fe48abe17"
  },
  {
    "file": "tools/city-play-source-transfer.js",
    "blob": "435bd439434ccd70900eb939c60283a5a612daf4",
    "sha256": "b0ee638f866bb45908e867c4f50427ccd5f65f50e35378ec1a588501b1f4cc5e"
  },
  {
    "file": "tools/combined-fifth-release-phase2-migration-catalog.js",
    "blob": "d7e5063f6c2466892c13205cfaea2db8bac2ad46",
    "sha256": "79f1f1b6109376a14c9193a1e81c89b2337624cdb15822f1bc9dcf326fd79ab8"
  },
  {
    "file": "tools/combined-release-phase2-migration-catalog.js",
    "blob": "d8f71ebdfc398c00ff726894f03db995334a11f7",
    "sha256": "e55da7c54a77c73da790625b9f62c1f43325f065ebdd63c40725b25722f1b85b"
  },
  {
    "file": "tools/economy-release-composition.js",
    "blob": "932d98999b8b3886b05b8d04b80e5230d34a0d97",
    "sha256": "677958ff8ac5113526d0b658a50959f38edeeae12b837bfaf0a8b43ee738ed4f"
  },
  {
    "file": "tools/enterprise-graph-helpers.js",
    "blob": "e539f482d08b3f08d8076dc834f245ba20bbee79",
    "sha256": "606aa57eb06c2d364fefa8e0c3ec6e584c7bd463aa48dccea7bff04384750c11"
  },
  {
    "file": "tools/enterprise-release-phase2-migration-catalog.js",
    "blob": "e6afd0b17111b56e8d0eb18a28e2dbbda99f6ae6",
    "sha256": "fc35f2b8770f3c7bd77347478c55eb944935fed019d40a43b101c70e5bc82570"
  },
  {
    "file": "tools/enterprise-source-compatibility.js",
    "blob": "df8dc5c3ab9809b2207a87386b36b9f7b8858202",
    "sha256": "d9a5d15242ae564d4b326dd6e65409451858f988a3567168b5ecf8c6c80b7195"
  },
  {
    "file": "tools/graph.js",
    "blob": "1cb57e5b8e84fba6399d0dd3ba056ad239347cf0",
    "sha256": "378d514638f7ea40a0c9b100cf3368ff93114e3c3f721df0307f18d459c0e4ca"
  },
  {
    "file": "tools/market-operations-graph-helpers.js",
    "blob": "470bf28bb8bccc65de76d7929043c3cb13750753",
    "sha256": "a899abd980dab2e9dedcf7656476c7718d3b807cbb73be5c4458da10500230e9"
  },
  {
    "file": "tools/market-operations-native.js",
    "blob": "aa9a8dabf351fd73b366ea6e9394c5539e4fb8ac",
    "sha256": "401ec887c5d9b260385c9048f8146557f90005ada6154a689d80066e7dd0255f"
  },
  {
    "file": "tools/market-operations-release-phase2-migration-catalog.js",
    "blob": "869c88ae2af2118680a683ee898b6af78d77a2fc",
    "sha256": "689d63b4273296c247fb130566a96d9c1beb049c8b0bde3169b988f66074acf1"
  },
  {
    "file": "tools/market-operations-source-compatibility.js",
    "blob": "9a76985d24b32e5adf4970a86dd202330ce24b7d",
    "sha256": "a64cace669b3b0dd219eeeeac3434189f42f38f73da6d6bc9f76ff087c2200be"
  },
  {
    "file": "tools/next-five-release-phase2-migration-catalog.js",
    "blob": "d1348bea0de8d43317b9f23f7afc05bbd7564d98",
    "sha256": "495da8b960594edf27274ed68142aaba3104b14dfa3d05aae26b1fdbc757b473"
  },
  {
    "file": "tools/next-five-source-compatibility.js",
    "blob": "e140d37582c69712382127e8e1d4d323bae8b140",
    "sha256": "1dd9d83066bd567cbcb6c4a2d34af5bf0458fea0097a3f8b5200ff5b5ecdc603"
  },
  {
    "file": "tools/next-layer-graph-helpers.js",
    "blob": "8aa4aa83feb76a26d5012535b1535d1b743914d5",
    "sha256": "c91f2975118600da9216758c6c5068c2e9a4dae5c2cd9b57d9bc337971e9ac29"
  },
  {
    "file": "tools/next-layer-native.js",
    "blob": "55863591c32111beb45a565b1079a8bf169bc8bd",
    "sha256": "3ab81f85430247c1ad2ba004e29fb6c9be5632101e345ee5bf6c97b769de26cc"
  },
  {
    "file": "tools/next-layer-release-phase2-migration-catalog.js",
    "blob": "a25405216cd5d9e861c7ed1480c270ee97224704",
    "sha256": "7cff213ecf5fcfb0800acce5e67a073b0abed3c7be3fc3721b4d815dc73d1fd5"
  },
  {
    "file": "tools/next-layer-source-compatibility.js",
    "blob": "2cb2a50766cce1ad33f8b13cdc3729b9309cebb1",
    "sha256": "7c25dd934243c256412b8a02e961ebe12a9a0319be0b847e7a58d2310165db4b"
  },
  {
    "file": "tools/player-intel-source-compatibility.js",
    "blob": "9af049b72001052403fc5940056777e9de440b43",
    "sha256": "bd6dbf8afbcd75a53d955133d0092ed032f23592242677fdd7c0fba641e313c4"
  },
  {
    "file": "tools/rc1-aggression-policy.js",
    "blob": "b9c4ab1b4d94204a8953fd1dec4407edf6ac08d6",
    "sha256": "b60a37432c761c7cef46960e4c94872b56416f214928ac57cf65d7d99823f070"
  },
  {
    "file": "tools/rc1-alliance-continuation.js",
    "blob": "b84136f67a189001d12e27f4cd1061d6d5e6bccf",
    "sha256": "723195aa18b996f2cbc9109ac5d1d447c1544c088ee0c7e6f478303594ec4326"
  },
  {
    "file": "tools/rc1-alliance-policy.js",
    "blob": "b335f7ac05f1058a772b8f611219f7cd5ca8a91b",
    "sha256": "0b0fd40959a0fb1e20d7c19a4cb9c67cfad0156a3b4d0703b6381d63db62f223"
  },
  {
    "file": "tools/rc1-alliance-world-adapter.js",
    "blob": "14bf5937a1c3400b4710248061f41368cfec64f1",
    "sha256": "628b718c2100f7d75e503a32b98230885feb912129f9e9b43b6d4e3cd007ca74"
  },
  {
    "file": "tools/rc1-business-season-source-compatibility.js",
    "blob": "2e3e0ec7aab8b3a24b0730d0740f195165e59849",
    "sha256": "2e07494de8aee9a15064bc895ba07d59cef9727c4d9e399aac43dd5bf5209ba1"
  },
  {
    "file": "tools/rc1-buyer-cooperative-source-compatibility.js",
    "blob": "bf1ad8b76064bc5e6ddbc6f6c86fa61d2c26a391",
    "sha256": "d2cb41a16fbedc2efd584d04edd8eda206b34602c7906eaf35ccd66686a184bf"
  },
  {
    "file": "tools/rc1-car-journal.js",
    "blob": "84a8a1eab4cb86d03416afa6d81b7259f5fa6d76",
    "sha256": "4c6ac66e2f5c8ea9c9ed73fdb489d0cb423cfd238a9d9b391dd3542ec926c79e"
  },
  {
    "file": "tools/rc1-car-melt-provenance.js",
    "blob": "aa809f6ab00bc9fbd25be571811399a33cd29c51",
    "sha256": "46382ec2d5c751ad7339897e41cbf9fdfb2ffd05247ce380372222c9be6fa8ad"
  },
  {
    "file": "tools/rc1-checkpoint-recovery-review.js",
    "blob": "3040bb9a6959e026310a26a5c20bfa5b0bfc75f5",
    "sha256": "bdeb9d06a13a0218694b659a59af017c5e4627c16056cf2b3c906e91b7a5a626"
  },
  {
    "file": "tools/rc1-churn-policy.js",
    "blob": "48e5998bc7e7ec8873d7b3457e682d6a6e3b1b4d",
    "sha256": "4c031fda23696e3fc6d681d35818c6e014b2c1a655d5807a4840248a3bf07b53"
  },
  {
    "file": "tools/rc1-city-gameplay-source-compatibility.js",
    "blob": "67e70bae2444da366d6b4cd8ac3de60030024a70",
    "sha256": "53752ee211f9128864dd944690798ea7e8f41f78f50896c6889867be96b1b634"
  },
  {
    "file": "tools/rc1-cohort-policy.js",
    "blob": "3cadf94d4013ff03d13831e3c1f3465656d25941",
    "sha256": "aad35a8a6e5cd594bc9de259d465eb472abe041a4f4e9c5e65686d6ad42a23df"
  },
  {
    "file": "tools/rc1-commercial-premises-source-compatibility.js",
    "blob": "68871df8e408a022f264eedba1ca17ef31e86ef8",
    "sha256": "4d5032feb347505a6b5fe3a7bb72ec45d47b4fc273c22dd4d3095e026a28e49f"
  },
  {
    "file": "tools/rc1-commercial-reputation-source-compatibility.js",
    "blob": "9c99828467642a58b89c476fa196d21640f38c97",
    "sha256": "86922d3d7da6be43092539499e9260e5ad37497bea942c3574f02b2eb9f5ee0a"
  },
  {
    "file": "tools/rc1-company-bank-source-compatibility.js",
    "blob": "6a7c630db26b1e024632815c718e473c6a402473",
    "sha256": "1d353845df3dddc3f83aca6e8938e31b43ad7d70132e72ccaa4ade686620424c"
  },
  {
    "file": "tools/rc1-company-logistics-hub-source-compatibility.js",
    "blob": "4f48c1d6467489786ee6f88422ec79b9e678d52f",
    "sha256": "936041da44691b02800687b1ff6b6f9d2fae45db3c6d3948dab65b12b0e88505"
  },
  {
    "file": "tools/rc1-company-operator-source-compatibility.js",
    "blob": "341edab6012a45f30443993577825166ccb935bc",
    "sha256": "1ff7b417ee8c038170090ee64806d74af25f4ed2e1063212fa7c1d509de84601"
  },
  {
    "file": "tools/rc1-company-opportunity-source-compatibility.js",
    "blob": "f4b1b3de1101e17858cb17041ff97e0257aef20f",
    "sha256": "5a4865da846a2d9af52504f0dc1655565dc7594ec6995881c61ab787b77acc6a"
  },
  {
    "file": "tools/rc1-company-succession-source-compatibility.js",
    "blob": "670c36433791334d3fd68e15ca4e793299c6331c",
    "sha256": "52917ad57879809de812af06757bc7a1bf59f23b9259186d8e1c2894e13e7e1f"
  },
  {
    "file": "tools/rc1-company-workflow-source-compatibility.js",
    "blob": "338eb2059b5f8f59a70b13d04d999caab6cf3261",
    "sha256": "5b1b4dca0b219bfcc3aa3b4d7f98df60003a11d2f0b618fc044f7f29f67f9d4a"
  },
  {
    "file": "tools/rc1-deed-source-compatibility.js",
    "blob": "f44bb4a8ee4cb461ecc4a76ab0930edd30419bff",
    "sha256": "deb2c8580b4293dfadab769daf65af9b150d9710fe665aa9aa27fcd30f3e4746"
  },
  {
    "file": "tools/rc1-duel-selection-provenance.js",
    "blob": "c11a1fa929787f9212e3678200306f1dd6d3e918",
    "sha256": "042e48e02b3ed99feaa482a88348b32a5e9f06d67e57768807de55c6c44774cb"
  },
  {
    "file": "tools/rc1-family-policy.js",
    "blob": "684d627788f1163924a6e2afb1fd4f43df2aec44",
    "sha256": "3b4672f22da8439981b9d0b93677cf9e68607e1a335d59ac4a7bada433a1d655"
  },
  {
    "file": "tools/rc1-family-world-adapter.js",
    "blob": "e906094b00542544f4f59436e33393dec719609d",
    "sha256": "da5a305a80ec13d826c2383bc0182499259333c564cf0cc4a0463f2be13ce3a7"
  },
  {
    "file": "tools/rc1-fifth-batch-source-compatibility.js",
    "blob": "8b16ec9c0236c2a003c21c7a2bda4e3171cd0d1b",
    "sha256": "c28b456e2039b1b69a563b9296afdd18d495313a426584cfec4a169316ec0fc6"
  },
  {
    "file": "tools/rc1-first-batch-source-compatibility.js",
    "blob": "562619d11db7f42397d577fc247695dc6b12b2e3",
    "sha256": "41ca8a1a01a1d1d456d0f19643e8634bdf5d6169b4d9acd91e391ca714c7b258"
  },
  {
    "file": "tools/rc1-fourth-batch-source-compatibility.js",
    "blob": "3898e2f1c35214e02df765a777643626a0012628",
    "sha256": "c32ade89e236ee4f1e1205d2e78fef2de56acd7039358c9e51ed3a674cc85518"
  },
  {
    "file": "tools/rc1-game-employment-source-compatibility.js",
    "blob": "d5c533c804f015ebf0122bfccfb6ed7167db4572",
    "sha256": "1c31ea6d6b87b5b54b524eb267489a46ec6ef7a17003dd986022a45036f3ca6b"
  },
  {
    "file": "tools/rc1-intel-source-compatibility.js",
    "blob": "45f8ec914fbb05788fa082bc6fb8a22c1f0558d8",
    "sha256": "33e7d00f130b8899810c9ff99938267902ba16ebba7150d25b88c42ce6f02ab7"
  },
  {
    "file": "tools/rc1-invoice-source-compatibility.js",
    "blob": "8b818e230cd6304de7ea0271e1ee829bbd8a7643",
    "sha256": "25abba4dd3880d444850b7a6853ab4065cad8ca740356501c5214ed57679aeaa"
  },
  {
    "file": "tools/rc1-knowledge-diagnostics.js",
    "blob": "da0bcfbbec7370112f1d3fbac80e110070f7b6cf",
    "sha256": "1dba8e0318404b07319e67874a0bdb44ec33b5d178d3e2016d7c14ba3d4d2fea"
  },
  {
    "file": "tools/rc1-law-policy.js",
    "blob": "dcff0160faf3111750a7d1f2004d14a1d365ecc1",
    "sha256": "bc50538e2ec734eba2acf14f8e29f5ff0cf2588cfc8b9bebbb8619e25726febf"
  },
  {
    "file": "tools/rc1-law-world-adapter.js",
    "blob": "adacc31c8d9d17970c765ddd3f3160d1738bf801",
    "sha256": "f9266fe66a22b3e0653097f500ab784846063d5c78b1c9a910946a0fe3583a20"
  },
  {
    "file": "tools/rc1-lifecycle-applicability.js",
    "blob": "fc58ad04a50e501da1da11e08aceb7a47424793e",
    "sha256": "3c55ffff054a50d6a3d7d2463230f5c7ffa4f8cad00fcf56a972b4f194f6913b"
  },
  {
    "file": "tools/rc1-loan-source-compatibility.js",
    "blob": "80897145983cabecf1e72a9cabb4fbef3d6bff9f",
    "sha256": "1375e4f477de482aa51d87351d184bcf50835fab0bf7e82c4717af1bc909bc80"
  },
  {
    "file": "tools/rc1-logistics-coverage-source-compatibility.js",
    "blob": "993b216fe81c8d86debc9b40cca5399aa599964b",
    "sha256": "dc61a5b6b5f620da4ee3dcbcfa47d6ab6d13db647f1789d1eb24a69e2b1c8533"
  },
  {
    "file": "tools/rc1-market-feed-source-compatibility.js",
    "blob": "5041a0c5b2a55cd71a600839d9d470b4005a7d2e",
    "sha256": "02080464771c329e68d30b11ebd32977b510042eaa34cb5f8dc1e1b515fefa13"
  },
  {
    "file": "tools/rc1-market-policy.js",
    "blob": "1950a5c82f5dfb04e486439b8059890adc327673",
    "sha256": "baab7dc451169b2795726a360c392c85c21d5b3f056a960f30f1db09bcf561ff"
  },
  {
    "file": "tools/rc1-market-world-adapter.js",
    "blob": "6270e1785a55ca90c7390bef749c039b31d38eeb",
    "sha256": "8c29846ba3a7cfae791312cf4b3dbc05f72d930020505edf7881861e0db9a77a"
  },
  {
    "file": "tools/rc1-mystery-policies.js",
    "blob": "7919ac9682c7ebc3053be62a28a6e91a2516a5b6",
    "sha256": "d2f7d63beccf9b9474b2b5fc3c7a3af12979ae6209166aea321a1de7b486e4a4"
  },
  {
    "file": "tools/rc1-native-actor-replay.js",
    "blob": "aad1a50cf14d63841489e3cf08127fe8f2d26b3d",
    "sha256": "11479825028448e7f8e3aba1a716613fa8a3a0c3a46705a5a25b5d3188b2f325"
  },
  {
    "file": "tools/rc1-native-commit-observer.js",
    "blob": "184f1440d3e900aab7d86a8b3cef08f04f343ab1",
    "sha256": "96e0a63479c8072762679356e9939c2e839f61bc460f9c3afa3467439dd0a276"
  },
  {
    "file": "tools/rc1-native-database.js",
    "blob": "205ce02fc594cdc4dd485f52d663ecc120de6694",
    "sha256": "9e07c0304d9a5c326d68cbb5f6898b2949b3fc8f87d3a3779b40277b3b0887c8"
  },
  {
    "file": "tools/rc1-native-determinism.js",
    "blob": "6dfd91fdd4c55cf39ecf81614a1f3b7a89526c7b",
    "sha256": "0d7f0a56816f14d4b63333f01433a0e89897e7c585d3a0b48509cc0d3cb380c0"
  },
  {
    "file": "tools/rc1-native-player-policy.js",
    "blob": "84189db9db4ce473ac00b79cf7324afffd56a9b2",
    "sha256": "1b4902704536b0cb96a038f17bd501e4687b137e48c93f015365ecf05da0c428"
  },
  {
    "file": "tools/rc1-native-proof-gzip.js",
    "blob": "0c4608b763890ff4a10253ee39186682687f92fe",
    "sha256": "af521a067ff1942a3d16dd0e7c315197267e1355bdd2e96a5d90e04e94ee9eef"
  },
  {
    "file": "tools/rc1-native-proof-stream.js",
    "blob": "5294009a90bd094d24d79e157d47130f2f5580a0",
    "sha256": "c921104c03d3d628187d86b0534c1f56546dec19a9ab0ced32c6980d4cbc8e96"
  },
  {
    "file": "tools/rc1-native-proof.js",
    "blob": "54a383e0903db8021dd3b6bc58afd7e7c6e0418c",
    "sha256": "dfd5f10465ebe2da155595b7f41dc2127b2bf1dfb5b59e3c58f607b885e6066c"
  },
  {
    "file": "tools/rc1-native-query-order.js",
    "blob": "06b44ca090b453b80103319bc2703db2982773f6",
    "sha256": "ae7791588ad61e28ad7bac37aa4fd374f85afd04ae3f44dd07fdf339e8caef0d"
  },
  {
    "file": "tools/rc1-native-query-tape.js",
    "blob": "1ff1ca5ee4190a88bcadd59f2b9e46d2702f4bee",
    "sha256": "de3cb21c5e68f09a797ed2834d81124dcc8c1d9924071780268267a59a0adb98"
  },
  {
    "file": "tools/rc1-native-quiescent-group.js",
    "blob": "1ed83234d22b5c88fc6a66d2f41729f356131108",
    "sha256": "05a3c12d3b729560648a212d88e7bd0deb93776791c9744a7b45a45e5bbd07bc"
  },
  {
    "file": "tools/rc1-native-run-guardrails.js",
    "blob": "90fc9d9a2dc68730130f178c35f49a60f8fa1bc0",
    "sha256": "80a42a1b68e8091027b9880baf23550b00bfaeca6b7674a9599a0b633e5bed6c"
  },
  {
    "file": "tools/rc1-native-worker.js",
    "blob": "93acdf3c2eb0192cb1ea4d5559ae47bfd339bd64",
    "sha256": "4b9207fb6b6f0d2d220031f117a591228bdad22ab6ece3ce76f00ff2e9591972"
  },
  {
    "file": "tools/rc1-npc-boat-fault.js",
    "blob": "86c2724e010781135165cbfc5d55758ce3c00bb1",
    "sha256": "c20ab0cb1119f038d95eb241093f105168c3d1a621e5dccb3978c4104581bc73"
  },
  {
    "file": "tools/rc1-npc-boat-journal.js",
    "blob": "435ee896d762f7033fc8d2745ad16a1b7d0f2a12",
    "sha256": "9205d1589743b4ad30beb40b52f31d62b705fbdfe63deb6e1cb2beccfb9a37de"
  },
  {
    "file": "tools/rc1-npc-car-acquisition.js",
    "blob": "2ce46ef5d4edb42a80c731ee28f4748a8853bd37",
    "sha256": "44e8a9a6cbc6895dcacae1a4118604bf829753f6e19493c3df794999f1873313"
  },
  {
    "file": "tools/rc1-npc-cargo-journal.js",
    "blob": "2213467f9a1381a90f17f2b5b6007ca5d7aed4d8",
    "sha256": "8c5bc86000719d76ff45813d4ba08ada955b2815d60def837cbebf8a933037a5"
  },
  {
    "file": "tools/rc1-npc-family-journal.js",
    "blob": "bb65e37bf7a689a6451f87fcdc1dc1a92578ddbd",
    "sha256": "f9ba32cc045824a0e8c2c1fe43302af80bba921f6517273323acdd3507132d16"
  },
  {
    "file": "tools/rc1-npc-family-provenance.js",
    "blob": "b95a5a97bd25716e84f5a9b194c3878b71445cab",
    "sha256": "fc7b4401e327973bbee1e5c12f26eb92ac12c09bbd4ecc361f7d3847c4e92ea7"
  },
  {
    "file": "tools/rc1-npc-family-recruitment.js",
    "blob": "8905cf5b3745d5c6176e5001e4c35d15b34d5fd3",
    "sha256": "4575f94f6e1b950d8bc942c91b6cac7c57fad5ae96ebb418b2ee8b113c12c693"
  },
  {
    "file": "tools/rc1-npc-market-order-journal.js",
    "blob": "ebfdd5981292737ea47f85a0627a87b73ff6fc25",
    "sha256": "9bba9d303e3dfbd6d513c25ae9ecb279bb3a30c8ec60e4854a31837944468bc5"
  },
  {
    "file": "tools/rc1-npc-retirement-journal.js",
    "blob": "b06c2de7c7b11b5b5950f6d87b8c6792e5262908",
    "sha256": "74d3c1720a6ccfaabade378f5df37d304eaa464d306b7ef36d51abedc82bfc0d"
  },
  {
    "file": "tools/rc1-omr-journal.js",
    "blob": "38f74befee7ecb2cb0891d3f059d51b8be12949e",
    "sha256": "d0f685bf754a1b5f44b5b68b99710041fe399fed279dbf0735c5ce053f5dea9d"
  },
  {
    "file": "tools/rc1-player-car-provenance.js",
    "blob": "3c554835c46b04e94f42e283596c846fdd7b22ca",
    "sha256": "88836f6f478a89376591c8617c42121c79861e547eab4311993095c69d88fd33"
  },
  {
    "file": "tools/rc1-pressure-world-adapter.js",
    "blob": "4cf9a8c571e4df3c6357b14a779274b80a8459fd",
    "sha256": "43cdc4dc4df35bc77458b4ebad43b6b15bd166063d73aea058fdb3c631f22dfd"
  },
  {
    "file": "tools/rc1-qualification.mjs",
    "blob": "7754025a75f527b834a5960418133cf8c85b24d6",
    "sha256": "e7f11977c033e7bcbcb4d3eadad9a1d1169708f85ab7cd3d2ef3f528e14f83ab"
  },
  {
    "file": "tools/rc1-resource-journal.js",
    "blob": "3a40df8b9c08cc4fd35d1ba443b66c6783994901",
    "sha256": "a7965549d5ef78fc2453b231cd8ae5862ce66cf7dfc47856b82d38034bf127ce"
  },
  {
    "file": "tools/rc1-resource-pressure-policy.js",
    "blob": "fbc8321a952c31102781890553332657ce36ed27",
    "sha256": "dc5b6400041612725da1548bc302424b3f147b9a96d0d65d836c06edf8366f71"
  },
  {
    "file": "tools/rc1-scarcity-initialization.js",
    "blob": "e48a96aab3016d224bf64fbd722a3ce64afd22c0",
    "sha256": "34a988381c1d84d7580ffb18f1c39a0cc4e139cda3ae22b088416de94fa63d62"
  },
  {
    "file": "tools/rc1-season-conversion-journal.js",
    "blob": "085f79a0d73bbeac9087bf887888197025b007f2",
    "sha256": "812769523c117910d3954858af9270f807ba1dc9de4de9c1e30306e1db2bb7a9"
  },
  {
    "file": "tools/rc1-season-crown-journal.js",
    "blob": "cc04a6ad92eadb354e5a3517c3a0f726a09b6144",
    "sha256": "51504432eea58b30279cc42201b2425487b890bbdb6d56957dd7a11720c6a80e"
  },
  {
    "file": "tools/rc1-season-election-provenance.js",
    "blob": "001f7d95ad1f01c05455e52d7c51744ee6bab97c",
    "sha256": "034201755cb42f469ba99d4dc670ff22bc4e77f0e203f2aac7b4bd09f122c808"
  },
  {
    "file": "tools/rc1-second-batch-source-compatibility.js",
    "blob": "8fda1bc4a43c0ce906a3e0b48986963e9eaba026",
    "sha256": "e8a81539af29d3f1c7662141bb32c61b211881ee954f900bf7bb03e173d5d2f8"
  },
  {
    "file": "tools/rc1-strategy-league-source-compatibility.js",
    "blob": "27879dfa76f85a5a5a6d584dbae9ec4e2cbd8dc3",
    "sha256": "a7e83dcf0d405e21306eb5f3598fe0495d5ba0798aa56f5583beaf721d961932"
  },
  {
    "file": "tools/rc1-strategy-source-compatibility.js",
    "blob": "e612c32cc424e8c18ce581c89aa63941a787616b",
    "sha256": "2222feaa84aa82b3657e2902125458b4cf2d16cbafb831687bb3798b5f900050"
  },
  {
    "file": "tools/rc1-third-batch-source-compatibility.js",
    "blob": "e46e3056591d37bf611727f834f06a4f603764e8",
    "sha256": "a2040f0c71187914b91c10826a026ba6ba2cc669bbe10d07b554966ce6daad47"
  },
  {
    "file": "tools/rc1-turf-policy.js",
    "blob": "8ce07ff03dfd56daff6ad4323cf269439a28432d",
    "sha256": "6f031dc9fa4043e7ea7dffbb7cd255054d3cfefd9c4f52a1a55ecebcc948cdf7"
  },
  {
    "file": "tools/rc1-war-world-adapter.js",
    "blob": "97ff812a95d9ddd04d4e905dd9275f8147202950",
    "sha256": "2accd7d2b8e3ba1e68bd5433c90b917a39d04413fea27fc02a73057a336f4e51"
  },
  {
    "file": "tools/rc1-world-backlog-review.js",
    "blob": "47aaf79b127f24fa15342fa8099190db01fc0399",
    "sha256": "f5b5d5d2bf05d4f23af68487c010f6e583029c3b435c5b742861d7214bc4d2b5"
  },
  {
    "file": "tools/rc1-world-checkpoint-series.js",
    "blob": "df3296b9aec02f929397c2a72e6f02e320d5b782",
    "sha256": "f82038d4754010f236aa12194b974b8257f6d61cd645c60c1eada987ff196e71"
  },
  {
    "file": "tools/rc1-world-diagnostics.js",
    "blob": "2c895fa5a209d1dac02e6e6879f269c02730477a",
    "sha256": "fe614c6a19c8dd01b8647b42a1607e765148c992510f9700a6cca889618c1c1f"
  },
  {
    "file": "tools/rc1-world-duration-evidence.js",
    "blob": "90148bf9e1da91378c14681c4939f9c14a3ae9fb",
    "sha256": "54767e22626f7f6f5bd268a67db9d511780f3c825ee2e5960b1639ccfc85c583"
  },
  {
    "file": "tools/rc1-world-economy-metrics.js",
    "blob": "af041e2162712e7fb7f3e2d729b99abf72bd764c",
    "sha256": "f47e56044b91080c458e56ef15ca8a557c09e9fcba109271f02d0ff3349fd408"
  },
  {
    "file": "tools/rc1-world-history-storage.js",
    "blob": "3845fb2354d1dae5d7d03ec3d83c3025e6ac2eff",
    "sha256": "9d403f0c20220ff2092c91541e84becac80d490bb7387d82f9c272ee0fca501e"
  },
  {
    "file": "tools/rc1-world-lifecycle-resources.js",
    "blob": "cb46bbbe21b542fc82dcc34ab5588791349ff357",
    "sha256": "a7d8f69afd7ed880e5ccf2f4d2cb00dfc0c0630e0cc423c7fd023063df9afc3c"
  },
  {
    "file": "tools/rc1-world-market-resources.js",
    "blob": "2ad41af4ca65fbded80125de51181c0c77dacc02",
    "sha256": "011bc5ca8c2b4e297d0db1f04e39d612821a65aebca7a02b2842cb8d57a27e1a"
  },
  {
    "file": "tools/rc1-world-order-resources.js",
    "blob": "624fa9b4c6692295777df02a5d4955cb880dbb40",
    "sha256": "44c36c3541a2763308f9f87b2fd9c6b8f511c1b3b3a948c2e9a168cbba6b2229"
  },
  {
    "file": "tools/rc1-world-qualification.js",
    "blob": "6a81639df0d4fae11be126f574197a8e924d426e",
    "sha256": "e677b7080fd37428d211254f5f042b7b0e0a9f18ed052bbb86da446a4a45f8d9"
  },
  {
    "file": "tools/rc1-world-resource-observer.js",
    "blob": "2d4c1c92dd7c486a290bf7fa94cead5bce3a27c3",
    "sha256": "3dbebdcccedf7a0a1ad06f5ab7fe1b182ce7ccf6f455bc011eb17e5dab40286e"
  },
  {
    "file": "tools/rc1-world-worker-transitions.js",
    "blob": "4cd3d335f44c525c0556f9e297b63877851608cf",
    "sha256": "b473f95b9143cae9498da75418e49c755f8c21bf1b4c5a1c35e7c0ec4a34210b"
  },
  {
    "file": "tools/release-phase2-migration-catalog.js",
    "blob": "893fa5bb218851abd143d2ce48d4fada9a890199",
    "sha256": "419a5de3238081b8e2b1ce566eae33cd30f88a8bfa19ef35441f309eec3e19c8"
  },
  {
    "file": "tools/release-source-transfer.js",
    "blob": "604f4334abd9a48bc165c4dbfce0f34838af326e",
    "sha256": "51d20baedc365269e201e0648e7e66e5b7e2dd3f252dc23588cc11d82eb7593d"
  },
  {
    "file": "tools/worldgraph-content.js",
    "blob": "1206cff86bd6ca828b451b8b9db5513141b270e6",
    "sha256": "49ad5108fd889a3cebfd9e0fcbd569ead7837b111934efa42af97392cf729cf1"
  },
  {
    "file": "src/content/city-rumors.js",
    "blob": "8b119e192e1feb25e4d516516b7423d346df521d",
    "sha256": "d02b1161079db2542aa699bfec1ad6de1cb0935358c75caffab1f0909cb8989f"
  },
  {
    "file": "src/content/property-investigation.js",
    "blob": "750a628171f322136d039f0fd357067dcdf51c96",
    "sha256": "d1dfa27c940589b2b306a809b9e8debd23710fb28a5e2d6310d36e56f98c6468"
  },
  {
    "file": "src/deedbuildings.js",
    "blob": "91ec9c496dd6afc9c83f6d0a5fd02b272eed6bb5",
    "sha256": "1184d5d65bd00733cb545bae6d6b3c7ad527eaa3910a5a9abe8de8227b8867ca"
  },
  {
    "file": "src/deeddiscovery.js",
    "blob": "d9fcb6eb5e79aeb3abb111bfad805539fc6c7c80",
    "sha256": "a01913ebe30b3fcf71be85de38cf712db726f479e64c7058a3f823ea1c1524f0"
  },
  {
    "file": "src/deedquesteligibility.js",
    "blob": "461f93c5d96f5d1ae74a9e80ff3efb2c15d6a904",
    "sha256": "2c62353fe712a9f75633629284a4b1c432655b56007628cea09859edf9f43273"
  },
  {
    "file": "tools/deed-discovery-migration-catalog.js",
    "blob": "34810e3bce00327867586a1c968e0c50cc64ce45",
    "sha256": "bd2da4747ab5a7fa41fe5630bb352e385184f73ecdadc716738b2532a845fd44"
  },
  {
    "file": "tools/deed-market-source-compatibility.js",
    "blob": "3ca89e7f6c59f6d760a8f3c60943c77e69c337ad",
    "sha256": "11c3683f55b6b960135c3d522c759f10e4e16b65b993546dc93dce899762dc26"
  },
  {
    "file": "tools/deed-quest-source-transfer.js",
    "blob": "3eea8c22f1cd3e8da65ce707c50db091d7ceca45",
    "sha256": "05bc98b2f26de7172675b0fb17d865ffa75d299a113807f4a5160beeb8fcfe9e"
  },
  {
    "file": "tools/sqlscan.js",
    "blob": "063e2c2c8df0e6af274e6ebbfcbb7bc6ccdd4efa",
    "sha256": "7f4cbd0f29e0a9bc8782972f8d99976973f379cfc0e0c474b550165aedec717d"
  },
  {
    "file": "tools/enterprise-deed-release-phase2-migration-catalog.js",
    "blob": "a893f1cf1df824dca6ba35874174a27337019a61",
    "sha256": "8ed9ee0e08e9bbbc25bc921ea5ec96e4de495121454b0e21857a7d318f31a49e"
  },
  {
    "file": "tools/enterprise-current-source-data.js",
    "blob": "0ead4d3b3b04e5d019397049829b35d81393a0a2",
    "sha256": "af7d94bb7f26ef7b3ccb63eab8c5f919e48198fa7cb374ed271ee19f69631101"
  },
  {
    "file": "tools/enterprise-current-source-compatibility.js",
    "blob": "e73b701485be75bf04e06508e1ad064174fe8588",
    "sha256": "9e2b7f97c0c92313208a3505446847b08b4673107fdd5eba0f759c2ed9e14820"
  },
  {
    "file": "test/enterprise-current-source-compatibility.js",
    "blob": "1af657454297f695f55fc41070b941e27931caa5",
    "sha256": "d8916125332f0e87bfa3af73b987a6f568d38935e49e80681db1aea419d90d78"
  },
  {
    "file": "tools/city-gameplay-native.js",
    "blob": "627c8d2ec10205d081373839e8dfee5d74668ede",
    "sha256": "249b23c1c196567fbe89963806dce47e9c0f845e5b621fd83825d82494c262d5"
  },
  {
    "file": "tools/company-autonomy-native.js",
    "blob": "9c0b465538dfae2af7caeb43375e6b50053691f5",
    "sha256": "b71df9135010d58e5c85822c9cc4c182bce749eeb7dbfb475a99eb79652cb766"
  },
  {
    "file": "tools/equipment-economy-native.js",
    "blob": "6008dfbd4e728c74d3fb0a4f2daaa235d4c69c90",
    "sha256": "1c91b5dadbf66443a93cc4beb1d7dd19e6633b4cda6478ec5a4bfa320e7b44ec"
  },
  {
    "file": "src/city-activity.js",
    "blob": "c15db4a3628040b23248589ee9b6ede673eba80c",
    "sha256": "ae264f0523208d6806a90d0d21fe2ff14683d30778af1db171bb26d16ff80d66"
  },
  {
    "file": "tools/rc1-city-activity-market-source-compatibility.js",
    "blob": "2dc4733f5753acb1a2c26c83eb118ba65e5ebcdb",
    "sha256": "af060a1c044e8b3e7d4ce0d9c2cf952597e835972fd95fcfbfede00e0aec2caa"
  },
  {
    "file": "tools/rc1-city-activity-source-compatibility.js",
    "blob": "bfb3c3813d5c9c0b77c3b04b1428eb97b162cbab",
    "sha256": "27752c326c43b94e3b8112d819cc62350f147e23e22966115932e5ac7025b00e"
  },
  {
    "file": "src/commercialcampaignruntime.js",
    "blob": "9046ea6bd131f32b838d2f86e0618393d70a82b1",
    "sha256": "74b5776f868528d0dd1617095613648dc7b4ad9823e6096b944b6101d51f5afb"
  },
  {
    "file": "src/commercialcampaigns-contracts.js",
    "blob": "4797acb9625f96f9a527d8b1b6578a22654f607d",
    "sha256": "27e6118da0f44d2075e34ea85343946a565fa0315ee5920cb3bd7994da0c0a67"
  },
  {
    "file": "src/commercialcampaigns-schema.js",
    "blob": "5dbd1c508be7391e14c859f56f32faa4d48c3ed7",
    "sha256": "c140514294a0b8da7970cc64af96f193e6d3b5b1b56367fe583094c19f6b86d4"
  },
  {
    "file": "src/commercialcampaigns.js",
    "blob": "dede492346c39d1146a7ca8e7f927f878a3cf91e",
    "sha256": "f2826c3c58539ae7c160c8302545d367e9d883e6ebf0e74a0f64957f0775511c"
  },
  {
    "file": "src/eventmarkets-contracts.js",
    "blob": "f1121e8397e9e18cfab259adfe4c5f14e228efa8",
    "sha256": "ae29920e488441cec33049145e54aefb10c91b386072c57adb04f687d51f43e1"
  },
  {
    "file": "src/eventmarkets-schema.js",
    "blob": "3a1f1203b2a3f9d1ba4b524065d80b286442410d",
    "sha256": "201aa209e7d20ad11a7de00d85a35b6f2a3a93900ef53853ffe89d8c5360652a"
  },
  {
    "file": "src/eventmarkets.js",
    "blob": "ddc5c8fbc38084a732d8a44b1542cd99c5d5778d",
    "sha256": "94ca7d9a06043c262519d6f4684c09056f05c1035d2f9896db3e68b436aa8816"
  },
  {
    "file": "src/merchantloyalty-api.js",
    "blob": "7e672805aa1d8a23a99d9bbb887f6947fa3e6dbe",
    "sha256": "6fcf5e451776b1b1790451b588ecedfe68cca2062b1912a343efae6b5fc9045c"
  },
  {
    "file": "src/merchantloyalty-contracts.js",
    "blob": "89a5bbbf006c9b077e0d16bc05c4325ca5284b25",
    "sha256": "89d4543cf9d3b3a578c445b6fa4a9416c74a08139477a9c780217f23a39d4724"
  },
  {
    "file": "src/merchantloyalty-schema.js",
    "blob": "fc692eef353b6c72c4de7085f8292b907c4417d1",
    "sha256": "d308b35bc3e40f617d22b152dd3e88fb59cc08bf1d9ad93003b27e47ce767145"
  },
  {
    "file": "src/merchantloyalty.js",
    "blob": "38f6d537d81e71b1c7ee55dfb53962a2b534dd41",
    "sha256": "8cf4b3e14f7f5f2ef0a798cd1e435bac4fdf50ea96c25a546b30032faf4bf700"
  },
  {
    "file": "src/routes/commercialcampaigns.js",
    "blob": "9fadacf57eb65c7ffb706fe070668c7687d4da6f",
    "sha256": "f776676eb450c57ff045a249d99ad708231d91b0b3a4789a9fda906e6fe13862"
  },
  {
    "file": "src/routes/eventmarkets.js",
    "blob": "3315f29291d2a2bba211fc609b206c98e63f1613",
    "sha256": "0d75356d1954e84c54c06bd17b26693d88ce136e298395c4c030492f889c316a"
  },
  {
    "file": "src/saleattribution-contracts.js",
    "blob": "76d485743912367e8eb7843a666638bfebeef311",
    "sha256": "6dd1037cd61b2539a442fb3b2d1505561caedabf86f3ef1794c3aa3f94b34f14"
  },
  {
    "file": "src/saleattribution-routes.js",
    "blob": "812f7fcc195c083433efcaa0b89b7eb7a96e0d21",
    "sha256": "17fc5c417b15521ea027c4d0e8667c3b85fe8631895e1851a63b2ecdfbdf719e"
  },
  {
    "file": "src/saleattribution.js",
    "blob": "a03e71ca3fd8780fc7d9e863c2c508419a7a7a18",
    "sha256": "6fe23fcc2ab1413eac75bf69776a0df1b7a6c7c27213f9758eadbb51839ccd13"
  },
  {
    "file": "src/shoppingbasket-api.js",
    "blob": "c50041bfff0272ddbfb697065ee742eee9ffde32",
    "sha256": "adb697191097ff5c82bac4bd57df6a61d97f52f62dfde4f1eb1681326261c3c4"
  },
  {
    "file": "src/shoppingbasket-contracts.js",
    "blob": "a0e74528c1f7f035a976adee6e7e558fd1a02d37",
    "sha256": "9c6157a797daa2b42cef54e73ade9606d3e6c7695d146ac663a24e0f3ad521b2"
  },
  {
    "file": "src/shoppingbasket-schema.js",
    "blob": "88d19bf58a62772e08dcca252f92c7ddbe2d3ee4",
    "sha256": "397eefe78eba764d04ab2541e8d6aaaa6766c310c836b453b43f38c89b561859"
  },
  {
    "file": "src/shoppingbasket.js",
    "blob": "6084e7af4f63e5328543ad86d046466a98129ec1",
    "sha256": "40a57a58f485354e31d5108252893aa122af6d97c73f3ae688f66f2bd0f903d6"
  },
  {
    "file": "test/atomicbarter.js",
    "blob": "2e4617b5e602501f27a0dac8d81dc1e14c5e0f35",
    "sha256": "e2b38a2fd938b84064c08382a8003238e8ecd1017ede15093ce3aa359aad0dde"
  },
  {
    "file": "test/city-gameplay-panels-browser.js",
    "blob": "b3d408697ad4041574f9588ae551cfe8d5ec1823",
    "sha256": "077f54b688c32cd3951bd87aa608681141dfecf2cf9f253cc38f85ec4bd5cf60"
  },
  {
    "file": "test/commerce-current-native-guard.js",
    "blob": "6ed15171a6d4467014c0db205e8409cfae134bc2",
    "sha256": "59b71be38666d373d7e6215ee250a58e857ca5ec18cd3eb1a150f06853e1d16b"
  },
  {
    "file": "test/commerce-release-phase2-migration-catalog.js",
    "blob": "3d4dee2acb59a0a8debeaaa74de2db135dbe08d3",
    "sha256": "e03cddfa2ee7ca467fcd81f5c5ffa23d1b121a87cb7b6f12e0c1573e5fa55150"
  },
  {
    "file": "test/commerce-source-compatibility.js",
    "blob": "22bad9e37c5559253a2ff9d3bcf8f23ed81c7e03",
    "sha256": "4cdc6734ff24182be698ac6adb5df707009f58213a645e7f15c0678cfbabf59a"
  },
  {
    "file": "test/commercialcampaigns-integration.js",
    "blob": "251031e3ef43c7230e04e094e6db93b34b2c8035",
    "sha256": "6a0f35168929b1129fb9a4f32ba4cca627f7f1e21d0d1c07ceaa0d5fec5ea4e0"
  },
  {
    "file": "test/commercialcampaigns-metadata-native.js",
    "blob": "33a0bfe014eacf1b6bdbc87c270ccd91f04a292a",
    "sha256": "048f36c4a34a789c3048696efec31ac1d20a28240d72ac10987bd6a4e2cd2283"
  },
  {
    "file": "test/consignments-api.js",
    "blob": "b12ea6589e7a2fd4bddc710bb83a3d4f1a4201bd",
    "sha256": "2900353b31ac374943144219d6726f8ffd10d1288821a575bbbaa86a2780886d"
  },
  {
    "file": "test/consignments.js",
    "blob": "7fa036812a009fa89907bc5d88f22431667d2d6f",
    "sha256": "9ad339fd74e7822ca7d66fe4adcec9a1bf58103318c9f98e1a901cf016b8e677"
  },
  {
    "file": "test/deed-discovery-fixture.js",
    "blob": "d42283113efafff67b782a278a9565d1fdf32237",
    "sha256": "b5c26b23995e49ddfbe46d933620f3b7f19b36eeae4390de869a7e81c7b6e2bd"
  },
  {
    "file": "test/eventmarkets-finite-fixture.js",
    "blob": "4b5b7ce319a069ace9c3d278724d7af04995a48b",
    "sha256": "78653825313733cc57779823e392ab94409b72a07149c5c41f88878b11d50662"
  },
  {
    "file": "test/eventmarkets-integration.js",
    "blob": "1dbb0a98571ed6987a4b0074753d977bae2f4f77",
    "sha256": "c10fce20983d37bf97e4ecae6979d0daa6f193bd463ecda91b5fe126093ddbf4"
  },
  {
    "file": "test/eventmarkets-recovery-fixture.js",
    "blob": "ebb81fcfa18bfdac85d509dc7294d8b0ec96a780",
    "sha256": "25c7055534faa033fff24f5d777e4e57998a1127fb907e70b8662163782e2ca4"
  },
  {
    "file": "test/merchantloyalty-accounting.js",
    "blob": "804e88ab7946941b6379b220320cce90cfab2c60",
    "sha256": "186a7aa5d6c62aa6e7907608d6b56805ec816526155dcb9dbc9e56be39d535e8"
  },
  {
    "file": "test/merchantloyalty-api.js",
    "blob": "21e92c5695147d8ae8c1398ce20ddf92e6cc901e",
    "sha256": "d30bc8c7caa3780be243341975bac918aa4e64d911b237591e620f6b0030709c"
  },
  {
    "file": "test/merchantloyalty-boundary.js",
    "blob": "5d5815505f3217f9df58bafd61806514129f659b",
    "sha256": "9d474b8009d423ee141569b979db15c90f12f546fff13ddebcbdc1f59be48bb0"
  },
  {
    "file": "test/merchantloyalty-current-native-fixture.js",
    "blob": "cf0b7fac69e33c99639450f439364c24e8f504b7",
    "sha256": "f067a9b3e2c9678cb1dec8e677bfe7d82377e64fcea35dcf74227a498052a490"
  },
  {
    "file": "test/merchantloyalty-estate.js",
    "blob": "3f890b31da3eb7c622740909f23a753fc70e8242",
    "sha256": "56a2189b1034ac571f3f87270f7152b506403bd1a69029cc853218bf0843fcff"
  },
  {
    "file": "test/merchantloyalty-expiry.js",
    "blob": "90f011d546cc1ad59520da1b6b52a7bbf2561ec2",
    "sha256": "042465f403f414759514ce8ed0ebef28c422504cf515b8e71c69a418b1dbc035"
  },
  {
    "file": "test/merchantloyalty-fixture.js",
    "blob": "c65eefb37d9745e4f6d6a598ef7baae3ce40fb10",
    "sha256": "12960e45fca65e10fcce7d85c1da5f2bedae0b46a4a6330171d3c7d9c045437f"
  },
  {
    "file": "test/merchantloyalty-native-estate.js",
    "blob": "8a7f68db1330ed13e637bc34cafafd8b679dcc5b",
    "sha256": "b817eaeced79e9a4fe7387febf3a2737f80e1335e24ccb5d03159781bd08fca9"
  },
  {
    "file": "test/merchantloyalty-native-expiry.js",
    "blob": "1a025732d990f81b88782fc82e89c2e68b0864b6",
    "sha256": "d4a2c526be93c0195136326348ac3b8b46edf6d5b5f9f7f132b9856fa530c27e"
  },
  {
    "file": "test/merchantloyalty-native-races.js",
    "blob": "bcf18dc203b8f661dc2e98460a9c90afaa41b5b5",
    "sha256": "0cc1a490934ed87c3555d8b4da25ac5bbab929d1058dac441451ad5b664dcd3f"
  },
  {
    "file": "test/merchantloyalty-native-rollback.js",
    "blob": "b4f112d9fc4fd91c8a9683e46a0c72aebf8f21ca",
    "sha256": "a13f730a54f7cc4b98622694948e00bd4350c07a259252fee13869f1f1c3e184"
  },
  {
    "file": "test/merchantloyalty.js",
    "blob": "82a4df2c09e07f0cdc10d1b5626e4312088df9ab",
    "sha256": "b72ad8fbb7d7ce3ee9e775a25d1c244aa5f56cc36b636c43713649087ae83800"
  },
  {
    "file": "test/saleattribution-api.js",
    "blob": "7c9408179a8eb88150ac817390966b6445bed01a",
    "sha256": "6b6b2a74464fb54c88b2f8b48aaa891609116d97aecad0b441de8abdb1f637af"
  },
  {
    "file": "test/saleattribution-current-native-fixture.js",
    "blob": "f30217e51e0d2ea43f3f333fc0de0a0f468610ec",
    "sha256": "73cc7701728d29a7c39dca6800a485cfb68501f9d26ff9808ce38a4033d5a65a"
  },
  {
    "file": "test/saleattribution-expiry.js",
    "blob": "ff178754c93a0681520b30d34c69dfe06e785c5d",
    "sha256": "a5faf3f352bfb111be4622cc5389b08ffd3d9584608ada439cc3205ab6d8830a"
  },
  {
    "file": "test/saleattribution-fixture.js",
    "blob": "2ebf2125b7646317808669e785889bece546fc5e",
    "sha256": "e54e6b0ca2bdb410001ea14a6e415dd1203754a0dc0046a9448fffbb98c6290b"
  },
  {
    "file": "test/saleattribution-native-estate.js",
    "blob": "99b6aba4ef563738839f5e888041d9c52ac067aa",
    "sha256": "d16648841589349c40c67e09951dd17ceefcaee4fa1374e31761e23fa753f23c"
  },
  {
    "file": "test/saleattribution-native-races.js",
    "blob": "f40866c1b6a42f6432f2d22a3602b9869b5238d4",
    "sha256": "f45496b920bd650af2012d9843ceddbd655ebde277e530dba3d0c6602da02188"
  },
  {
    "file": "test/saleattribution-native-rollback.js",
    "blob": "7d513efe2c9797333d51dc5a68ccb8016584475f",
    "sha256": "47605c85ed7fcb18868babd170c8e8d2aabedb7a2dd97742c8975ebe21a4a016"
  },
  {
    "file": "test/saleattribution-witness.js",
    "blob": "9ec1515e9c4ef056a78ad2c05b6eaa4a6819cdbe",
    "sha256": "22746221f6130cf455096399ec180b34e6d7a39d81d61cc121336b7c6e2340ec"
  },
  {
    "file": "test/saleattribution.js",
    "blob": "7f0cc23c99908b0634cd8cba5c948654b40b7a09",
    "sha256": "91c934622e88f293f336f352f5774322d6082448f2f19454e926621b0c3a3134"
  },
  {
    "file": "test/shoppingbasket-api.js",
    "blob": "3c4ab81a823874f0e059cda909554b40bc5c4f8c",
    "sha256": "897c10d9328fa4d0e94a30b46730ef474e20f1e43810b14b2d6e5534b11c0da0"
  },
  {
    "file": "test/shoppingbasket-atomicity.js",
    "blob": "c40ddbd9036ce0c9ceaf8dc2d36727f3431db1fd",
    "sha256": "315e144c6123620abaa94be05879b26a9351572d0539b4f1bfe90eaf881d0ad6"
  },
  {
    "file": "test/shoppingbasket-boundary.js",
    "blob": "2f4b54471bd9205f2d500bbbbc671a9dbcbd32c6",
    "sha256": "a64f7ca36396bfedc235cce4c4fab770b01177193665b318d15f54e1feb873ca"
  },
  {
    "file": "test/shoppingbasket-current-native-fixture.js",
    "blob": "f9cd35601a22dfbdcc9b0fbb56f8ddd2a6422244",
    "sha256": "f9bdcc81b86f389117aeef78a0cd7c28b16a0db0f3214dadb11bf4437efd757f"
  },
  {
    "file": "test/shoppingbasket-estate.js",
    "blob": "ae44fdb5572a2989e03f0e74e86316dd40d3fb0d",
    "sha256": "74912377263a28155534a56a0bb648e16e81189faa2e6308304bfcb21128c73c"
  },
  {
    "file": "test/shoppingbasket-expiry.js",
    "blob": "e9e948adf755ae7560ee6bdebe9dfe3c4a65af38",
    "sha256": "9d8ddbbb6785d724a3f4eb010013d85bc6c99027c31ed82e659105bc1c23b990"
  },
  {
    "file": "test/shoppingbasket-fixture.js",
    "blob": "579f61beb9730ff06a0290600e0f24308170e37f",
    "sha256": "d4c58f2b95754ced8723b82c5d000d39690022aca856390b079a19131eb146c6"
  },
  {
    "file": "test/shoppingbasket-native-estate.js",
    "blob": "96c01e14cea97649c2a97beb7ebc1ee74256e9b3",
    "sha256": "a5b23d82bb2fbf6cb2567bfb2231179b9043b8075c94cc3dec50c2faa3cd054c"
  },
  {
    "file": "test/shoppingbasket-native-expiry.js",
    "blob": "a7289f603de6b5a405d91a369d5ec3c88b34db12",
    "sha256": "9a5a7ccf1798b58ab41187aa627f267a978d2e5867c3181112032f9d54983c9c"
  },
  {
    "file": "test/shoppingbasket-native-races.js",
    "blob": "df5b637963fd13999d4bc1931e625af4ada51d52",
    "sha256": "f602684ab0dcdb22df5bcc8efa2cb0fbd9b420b1501bf89d20a346373c3a73e3"
  },
  {
    "file": "test/shoppingbasket-native-rollback.js",
    "blob": "2379362b176f5459034ffdd66e4e1f73b3cc7a8d",
    "sha256": "d3e61115781abb17060b861ed7e3129121502b92d13334c0eaf1626899fcff36"
  },
  {
    "file": "test/shoppingbasket.js",
    "blob": "d51b395d9ea763ec3be234d45dd02e8597260f24",
    "sha256": "ecffa144e7327fc0d4702165315744f67543b6f6895633705e31b561d5489b58"
  },
  {
    "file": "tools/commerce-current-native-data.js",
    "blob": "a5dc6588f2bec318629c02d3537beabf2853ef03",
    "sha256": "d3781dcde4b9c3454c4858fa5946d1fd852c62e9a296eec954b3f44ac68401dd"
  },
  {
    "file": "tools/commerce-current-native-guard.js",
    "blob": "7864e8407579d67db4c60e7a89dec2f569df02d3",
    "sha256": "df114c17bc1c172ed356c1d2c595eea31b42f4df378f797c93144fae89b7b305"
  },
  {
    "file": "tools/commerce-current-native.js",
    "blob": "3ab9401832a98a1422af0426ca4c2eaa947ed4f5",
    "sha256": "3605bfcf32f581ee62450dc1a32a5b6db3f51ffdaefc5c9c4886740c23401feb"
  },
  {
    "file": "tools/commerce-deed-release-phase2-native-catalog.js",
    "blob": "637c279ef537ec1c6a213a2f156235a6aeec62be",
    "sha256": "dc84df23e59ad3282fc16c556943150be1e9fcc219facd2e94b83f6b2c817f4b"
  },
  {
    "file": "tools/commerce-enterprise-source-compatibility.js",
    "blob": "3568959b04299221e439511de7f740190af7b15a",
    "sha256": "e0c99568d2bc36c12f172f440cf8632adc5d291a94d8b02ced87389e5f25cf1d"
  },
  {
    "file": "tools/commerce-enterprise-source-data.js",
    "blob": "000719bf8d16c77ba9ea34c408df2d6ec927bd11",
    "sha256": "e92746d80287907d86e72c0b2860259daf5774fad5a0fbb632fc0df693c62c6b"
  },
  {
    "file": "tools/commerce-graph-helpers.js",
    "blob": "57dca3dea43dc89ef72e076342ef21eefd9388cf",
    "sha256": "3581d5693483be9888f85356e951b579c3b7b2cb5dbe234632aa9c575a60d4bb"
  },
  {
    "file": "tools/commerce-native.js",
    "blob": "7bce19226d406d5132a644c8c7491216bf0f7195",
    "sha256": "18bd52ea2c84b0b4c964f853165d8b8178e91dba66cfaabe1a6bc52082061314"
  },
  {
    "file": "tools/commerce-release-phase2-migration-catalog.js",
    "blob": "7caae09a85cc205192ca2891ecc83817534ceefb",
    "sha256": "fad81787d2a45dd26bb2b482937879152d92feb77a811a20107490d6fd8d582c"
  },
  {
    "file": "tools/commerce-release-phase2-native-catalog.js",
    "blob": "557b79fa931da5f1201f085779c5701d44526087",
    "sha256": "be4307efac154a7e5f0c17c6bb020a7dc6ae96d053bfe2163e944a694d6db637"
  },
  {
    "file": "tools/commerce-source-compatibility.js",
    "blob": "930d917335182eca8cd3867f173936c440ce1f7a",
    "sha256": "9d38b52791e0ee3856b0c924c8ab95930eaab3c91d8c81fea0733ff5007c97bc"
  },
  {
    "file": "tools/commerce-current-enterprise-source-compatibility.js",
    "blob": "381698b3e3d2de28b1d2e1cb5e9258d9a2037dc6",
    "sha256": "a97e87e82e69350773425c2fc36ef49c97fa2eb1d5fe7a515b3a89b0d50754e2"
  },
  {
    "file": "tools/commerce-current-enterprise-source-data.js",
    "blob": "12a948e51b1f10afbab884f8fbceb8e7952c7b55",
    "sha256": "718377da3a928b42004fa8e56600573d85e472852f5a0cdb20a3edefa9334c54"
  }
].map(Object.freeze));
export const ENTERPRISE_NATIVE_BINARY_FILES=Object.freeze([
  "public/apple-touch-icon.png",
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
  "public/icon-192.png",
  "public/icon-512.png",
  "public/icon-maskable-512.png"
]);
export const ENTERPRISE_NATIVE_DIRECTORY_MEMBERSHIPS=Object.freeze([
  {
    "directory": "public/art",
    "eligibleNames": [
      "agent-cover-1080.webp",
      "agent-cover-480.webp",
      "agent-cover-720.webp",
      "agent-economy-1080.webp",
      "agent-economy-480.webp",
      "agent-economy-720.webp",
      "agent-overview-1080.webp",
      "agent-overview-1600.webp",
      "agent-overview-640.webp",
      "agent-turn-1080.webp",
      "agent-turn-480.webp",
      "agent-turn-720.webp",
      "boat-cigarette.jpg",
      "boat-cutter.jpg",
      "boat-dinghy.jpg",
      "boat-freighter.jpg",
      "boat-skiff.jpg",
      "boat-trawler.jpg",
      "boxer-clubfighter.jpg",
      "boxer-gatekeeper.jpg",
      "boxer-journeyman.jpg",
      "business-casino.jpg",
      "business-hotel.jpg",
      "business-laundromat.jpg",
      "business-nightclub.jpg",
      "business-restaurant.jpg",
      "car-ambassador.jpg",
      "car-aurora.jpg",
      "car-blackout.jpg",
      "car-boulevard.jpg",
      "car-brougham.jpg",
      "car-bullion.jpg",
      "car-cabaret.jpg",
      "car-cabbie.jpg",
      "car-cannery.jpg",
      "car-cascade.jpg",
      "car-clubman.jpg",
      "car-comet.jpg",
      "car-conductor.jpg",
      "car-consul.jpg",
      "car-corsair.jpg",
      "car-coupe38.jpg",
      "car-courier.jpg",
      "car-deuce.jpg",
      "car-diplomat.jpg",
      "car-dockmaster.jpg",
      "car-dray.jpg",
      "car-duchess.jpg",
      "car-errand.jpg",
      "car-foreman.jpg",
      "car-garden.jpg",
      "car-harbor.jpg",
      "car-iceman.jpg",
      "car-junker.jpg",
      "car-ladder.jpg",
      "car-leviathan.jpg",
      "car-mercantile.jpg",
      "car-meridian.jpg",
      "car-milk.jpg",
      "car-monarch.jpg",
      "car-nocturne.jpg",
      "car-notary.jpg",
      "car-offduty.jpg",
      "car-olympia.jpg",
      "car-phaeton.jpg",
      "car-pigeon.jpg",
      "car-postal.jpg",
      "car-prefect.jpg",
      "car-regatta.jpg",
      "car-regent.jpg",
      "car-rubicon.jpg",
      "car-sable.jpg",
      "car-sedanette.jpg",
      "car-sovereign.jpg",
      "car-spectre.jpg",
      "car-sportsman.jpg",
      "car-stag.jpg",
      "car-tempest.jpg",
      "car-touring.jpg",
      "car-trolley.jpg",
      "car-tsarina.jpg",
      "car-vesper.jpg",
      "car-volara.jpg",
      "car-vulcan.jpg",
      "car-wagoneer.jpg",
      "car-warhawk.jpg",
      "card-join.jpg",
      "card-legend.jpg",
      "card-wanted.jpg",
      "card-whacked.jpg",
      "city-fixer-v1.png",
      "city-fixer-v2.png",
      "city-neighbor-v1.png",
      "city-neighbor-v2.png",
      "city-neighborhood-v1.png",
      "city-neighborhood-v2.png",
      "city-player-down-v1.png",
      "city-player-down-v2.png",
      "city-player-left-v1.png",
      "city-player-left-v2.png",
      "city-player-right-v1.png",
      "city-player-right-v2.png",
      "city-player-step-v1.png",
      "city-player-step-v2.png",
      "city-player-up-v1.png",
      "city-player-up-v2.png",
      "city-worker-v1.png",
      "city-worker-v2.png",
      "citymap.jpg",
      "club-0.jpg",
      "club-1.jpg",
      "club-2.jpg",
      "club-3.jpg",
      "club-4.jpg",
      "crest.jpg",
      "crime-alderman.jpg",
      "crime-armored.jpg",
      "crime-ballot.jpg",
      "crime-bonds.jpg",
      "crime-bondsman.jpg",
      "crime-bookie.jpg",
      "crime-booze.jpg",
      "crime-cardgame.jpg",
      "crime-cathouse.jpg",
      "crime-clearing.jpg",
      "crime-counting.jpg",
      "crime-customs.jpg",
      "crime-depository.jpg",
      "crime-diamond.jpg",
      "crime-distillery.jpg",
      "crime-fedtrain.jpg",
      "crime-fixfight.jpg",
      "crime-furs.jpg",
      "crime-grandcasino.jpg",
      "crime-harbormaster.jpg",
      "crime-highroll.jpg",
      "crime-jewelry.jpg",
      "crime-laundry.jpg",
      "crime-meter.jpg",
      "crime-mint.jpg",
      "crime-museum.jpg",
      "crime-nightdeposit.jpg",
      "crime-numbers.jpg",
      "crime-pawn.jpg",
      "crime-payoff.jpg",
      "crime-payroll.jpg",
      "crime-pick.jpg",
      "crime-pigeon.jpg",
      "crime-poker.jpg",
      "crime-protection.jpg",
      "crime-railfreight.jpg",
      "crime-shake.jpg",
      "crime-stereo.jpg",
      "crime-switchbag.jpg",
      "crime-ticker.jpg",
      "crime-torch.jpg",
      "crime-truck.jpg",
      "crime-vaultjob.jpg",
      "display.woff2",
      "district-brick.jpg",
      "district-canal.jpg",
      "district-cathedral-480.webp",
      "district-cathedral-960.webp",
      "district-cathedral.jpg",
      "district-docks.jpg",
      "district-foundry-480.webp",
      "district-foundry-960.webp",
      "district-foundry.jpg",
      "district-neon.jpg",
      "district-v2-docks-1280.webp",
      "district-v2-docks-480.webp",
      "district-v2-docks-960.webp",
      "district-v2-docks.jpg",
      "district-v2-foundry-1280.webp",
      "district-v2-foundry-480.webp",
      "district-v2-foundry-960.webp",
      "district-v2-foundry.jpg",
      "district-v2-neon-interior-1280.webp",
      "district-v2-neon-interior-480.webp",
      "district-v2-neon-interior-960.webp",
      "district-v2-neon-interior.jpg",
      "drug-ambrosia.jpg",
      "drug-glass.jpg",
      "drug-halo.jpg",
      "drug-lotus.jpg",
      "drug-moonmilk.jpg",
      "drug-nocturne.jpg",
      "drug-static.jpg",
      "drug-vim.jpg",
      "estate-1.jpg",
      "estate-2.jpg",
      "estate-3.jpg",
      "estate-4.jpg",
      "estate-5.jpg",
      "estate-6.jpg",
      "game-blackjack.jpg",
      "game-dice.jpg",
      "game-fight.jpg",
      "game-futurity.jpg",
      "game-numbers.jpg",
      "game-poker.jpg",
      "game-ring.jpg",
      "game-tournament.jpg",
      "game-track.jpg",
      "gameplay-01-choose-your-path-1080.webp",
      "gameplay-01-choose-your-path-1600.webp",
      "gameplay-01-choose-your-path-640.webp",
      "gameplay-01-choose-your-path.png",
      "gameplay-02-the-gun.png",
      "gameplay-03-the-ledger.png",
      "gameplay-04-the-kitchen.png",
      "gameplay-05-the-wheel.png",
      "gameplay-06-the-shadow.png",
      "gameplay-07-the-ring.png",
      "gameplay-08-character-blueprint.png",
      "gameplay-09-road-to-don.png",
      "good-bearer.jpg",
      "good-cigars.jpg",
      "good-coffee.jpg",
      "good-gin.jpg",
      "good-ice.jpg",
      "good-nylons.jpg",
      "good-penicillin.jpg",
      "good-shine.jpg",
      "good-silk.jpg",
      "good-watches.jpg",
      "gun-alleycat.jpg",
      "gun-anniversary.jpg",
      "gun-argument.jpg",
      "gun-badge.jpg",
      "gun-broom.jpg",
      "gun-brothers.jpg",
      "gun-chorusline.jpg",
      "gun-doorbell.jpg",
      "gun-lastresort.jpg",
      "gun-orchestra.jpg",
      "gun-penny.jpg",
      "gun-pocket22.jpg",
      "gun-rancher.jpg",
      "gun-undertaker.jpg",
      "gun-whisper.jpg",
      "heist-armored.jpg",
      "heist-casino.jpg",
      "heist-corner.jpg",
      "heist-diamond.jpg",
      "heist-fedtrain.jpg",
      "heist-goldvault.jpg",
      "heist-inside.jpg",
      "heist-jewel.jpg",
      "heist-museum.jpg",
      "heist-payroll.jpg",
      "heist-thefed.jpg",
      "heist-vault.jpg",
      "hero-ambient-v2.mp4",
      "hero-backdrop.jpg",
      "hero-poster-1440.webp",
      "hero-poster-1920.webp",
      "hero-poster-640.webp",
      "hero-poster-960.webp",
      "hero-poster.jpg",
      "hitman-journeyman.jpg",
      "hitman-legbreaker.jpg",
      "hitman-professional.jpg",
      "hype-flywheel-v3-720.mp4",
      "hype-flywheel-v3-poster-640.webp",
      "hype-flywheel-v3-poster-960.webp",
      "hype-flywheel-v3.mp4",
      "hype-money-720.mp4",
      "hype-money-poster-640.webp",
      "hype-money-poster-960.webp",
      "hype-money-poster.jpg",
      "hype-money.mp4",
      "hype-short.mp4",
      "hype-streets.mp4",
      "hype.mp4",
      "icons.jpg",
      "interior-den.jpg",
      "interior-empire.jpg",
      "interior-estate.jpg",
      "interior-family.jpg",
      "interior-garage.jpg",
      "interior-gym.jpg",
      "interior-kitchen-480.webp",
      "interior-kitchen-960.webp",
      "interior-kitchen.jpg",
      "interior-law.jpg",
      "interior-legit.jpg",
      "interior-life.jpg",
      "interior-loans.jpg",
      "interior-market.jpg",
      "interior-pen.jpg",
      "interior-port.jpg",
      "interior-pvp.jpg",
      "interior-races.jpg",
      "interior-scores-1024.webp",
      "interior-scores-640.webp",
      "interior-scores.jpg",
      "interior-speakeasy.jpg",
      "interior-stable.jpg",
      "interior-start.jpg",
      "interior-store.jpg",
      "interior-streets.jpg",
      "interior-track.jpg",
      "interior-trade.jpg",
      "interior-wire.jpg",
      "landing-break-1440.webp",
      "landing-break-640.webp",
      "landing-break-960.webp",
      "landing-break.jpg",
      "npc-armorer.jpg",
      "npc-cornerman.jpg",
      "npc-doc.jpg",
      "npc-fixer.jpg",
      "npc-harbor.jpg",
      "npc-madame.jpg",
      "omr-01-severance.png",
      "omr-02-return-velocity.png",
      "omr-03-money-router-1080.webp",
      "omr-03-money-router-1600.webp",
      "omr-03-money-router-640.webp",
      "omr-03-money-router.png",
      "omr-04-reserve-rwa.png",
      "omr-05-ohm-contrast.png",
      "omr-06-the-omr-machine-1080x1350.png",
      "omr-vs-ohm.png",
      "outfit-dockrats.jpg",
      "outfit-kryl.jpg",
      "outfit-moreau.jpg",
      "outfit-volkov.jpg",
      "outfit-zappa.jpg",
      "path-gun-1080x1350.png",
      "path-gun-1080x1920.png",
      "path-gun-1200x630.png",
      "path-kitchen-1080x1350.png",
      "path-kitchen-1080x1920.png",
      "path-kitchen-1200x630.png",
      "path-ledger-1080x1350.png",
      "path-ledger-1080x1920.png",
      "path-ledger-1200x630.png",
      "path-ring-1080x1350.png",
      "path-ring-1080x1920.png",
      "path-ring-1200x630.png",
      "path-shadow-1080x1350.png",
      "path-shadow-1080x1920.png",
      "path-shadow-1200x630.png",
      "path-wheel-1080x1350.png",
      "path-wheel-1080x1920.png",
      "path-wheel-1200x630.png",
      "pill-agents.jpg",
      "pill-legacy-480.webp",
      "pill-legacy-960.webp",
      "pill-legacy.jpg",
      "vest-heavyv.jpg",
      "vest-lightv.jpg",
      "vest-medv.jpg",
      "vest-tailorv.jpg",
      "vest-vaultv.jpg",
      "vest-woolv.jpg"
    ]
  },
  {
    "directory": "public/art/hype",
    "eligibleNames": [
      "bed-den.m4a",
      "bed-docks.m4a",
      "bed-family.m4a",
      "bed-law.m4a",
      "bed-legit.m4a",
      "bed-pen.m4a",
      "bed-speakeasy.m4a",
      "bed-streets.m4a",
      "boat-cigarette.mp4",
      "boat-cutter.mp4",
      "boat-dinghy.mp4",
      "boat-freighter.mp4",
      "boat-skiff.mp4",
      "boat-trawler.mp4",
      "boxer-clubfighter.mp4",
      "boxer-gatekeeper.mp4",
      "boxer-journeyman.mp4",
      "business-casino.mp4",
      "business-hotel.mp4",
      "business-laundromat.mp4",
      "business-nightclub.mp4",
      "business-restaurant.mp4",
      "car-sovereign.mp4",
      "car-spectre.mp4",
      "cine-champion.mp4",
      "cine-funeral.mp4",
      "cine-payday.mp4",
      "cine-war.mp4",
      "cine-wedding.mp4",
      "cine-whacked.mp4",
      "citymap.mp4",
      "club-0.mp4",
      "club-1.mp4",
      "club-2.mp4",
      "club-3.mp4",
      "club-4.mp4",
      "crest.mp4",
      "crime-alderman.mp4",
      "crime-armored.mp4",
      "crime-ballot.mp4",
      "crime-bonds.mp4",
      "crime-bondsman.mp4",
      "crime-booze.mp4",
      "crime-cardgame.mp4",
      "crime-cathouse.mp4",
      "crime-clearing.mp4",
      "crime-counting.mp4",
      "crime-counting__9x16.mp4",
      "crime-customs.mp4",
      "crime-depository.mp4",
      "crime-diamond.mp4",
      "crime-distillery.mp4",
      "crime-fedtrain.mp4",
      "crime-fixfight.mp4",
      "crime-furs.mp4",
      "crime-grandcasino.mp4",
      "crime-harbormaster.mp4",
      "crime-highroll.mp4",
      "crime-jewelry.mp4",
      "crime-laundry.mp4",
      "crime-meter.mp4",
      "crime-mint.mp4",
      "crime-museum.mp4",
      "crime-nightdeposit.mp4",
      "crime-numbers.mp4",
      "crime-pawn.mp4",
      "crime-payoff.mp4",
      "crime-payroll.mp4",
      "crime-pick.mp4",
      "crime-pigeon.mp4",
      "crime-poker.mp4",
      "crime-protection.mp4",
      "crime-railfreight.mp4",
      "crime-shake.mp4",
      "crime-stereo.mp4",
      "crime-switchbag.mp4",
      "crime-ticker.mp4",
      "crime-torch.mp4",
      "crime-torch__9x16.mp4",
      "crime-truck.mp4",
      "crime-vaultjob.mp4",
      "district-brick.mp4",
      "district-canal.mp4",
      "district-cathedral.mp4",
      "district-docks.mp4",
      "district-foundry.mp4",
      "district-neon.mp4",
      "drug-ambrosia.mp4",
      "drug-glass.mp4",
      "drug-halo.mp4",
      "drug-lotus.mp4",
      "drug-moonmilk.mp4",
      "drug-nocturne.mp4",
      "drug-static.mp4",
      "drug-vim.mp4",
      "estate-1.mp4",
      "estate-2.mp4",
      "estate-3.mp4",
      "estate-4.mp4",
      "estate-5.mp4",
      "estate-6.mp4",
      "flywheel-v3-deeds.mp4",
      "flywheel-v3-loop.mp4",
      "flywheel-v3-rwa.mp4",
      "game-blackjack.mp4",
      "game-dice.mp4",
      "game-fight.mp4",
      "game-futurity.mp4",
      "game-numbers.mp4",
      "game-poker.mp4",
      "game-ring.mp4",
      "game-tournament.mp4",
      "game-track.mp4",
      "gun-alleycat.mp4",
      "gun-anniversary.mp4",
      "gun-argument.mp4",
      "gun-badge.mp4",
      "gun-broom.mp4",
      "gun-brothers.mp4",
      "gun-chorusline.mp4",
      "gun-doorbell.mp4",
      "gun-lastresort.mp4",
      "gun-orchestra.mp4",
      "gun-penny.mp4",
      "gun-pocket22.mp4",
      "gun-rancher.mp4",
      "gun-undertaker.mp4",
      "gun-whisper.mp4",
      "heist-armored.mp4",
      "heist-casino.mp4",
      "heist-corner.mp4",
      "heist-diamond.mp4",
      "heist-fedtrain.mp4",
      "heist-goldvault.mp4",
      "heist-jewel.mp4",
      "heist-museum.mp4",
      "heist-payroll.mp4",
      "heist-thefed.mp4",
      "heist-vault.mp4",
      "hero-backdrop.mp4",
      "hero-backdrop__9x16.mp4",
      "hero-poster.mp4",
      "hitman-legbreaker.mp4",
      "hitman-professional.mp4",
      "hitman-professional__9x16.mp4",
      "interior-den.mp4",
      "interior-empire.mp4",
      "interior-estate.mp4",
      "interior-estate__9x16.mp4",
      "interior-family.mp4",
      "interior-garage.mp4",
      "interior-gym.mp4",
      "interior-kitchen.mp4",
      "interior-law.mp4",
      "interior-legit.mp4",
      "interior-life.mp4",
      "interior-loans.mp4",
      "interior-market.mp4",
      "interior-pen.mp4",
      "interior-port.mp4",
      "interior-pvp.mp4",
      "interior-races.mp4",
      "interior-scores.mp4",
      "interior-speakeasy.mp4",
      "interior-stable.mp4",
      "interior-start.mp4",
      "interior-store.mp4",
      "interior-streets.mp4",
      "interior-track.mp4",
      "interior-trade.mp4",
      "interior-wire.mp4",
      "landing-break.mp4",
      "mm-auction.mp4",
      "mm-chase.mp4",
      "mm-crew.mp4",
      "mm-family.mp4",
      "mm-made.mp4",
      "mm-noprint.mp4",
      "mm-pot.mp4",
      "mm-seats.mp4",
      "mm-slam.mp4",
      "mm-store.mp4",
      "mm-tax.mp4",
      "mm-toll.mp4",
      "npc-armorer.mp4",
      "npc-cornerman.mp4",
      "npc-doc.mp4",
      "npc-fixer.mp4",
      "npc-harbor.mp4",
      "npc-madame.mp4",
      "outfit-dockrats.mp4",
      "outfit-kryl.mp4",
      "outfit-moreau.mp4",
      "outfit-volkov.mp4",
      "outfit-volkov__9x16.mp4",
      "outfit-zappa.mp4",
      "pill-agents.mp4",
      "pill-legacy.mp4",
      "sting-death.m4a",
      "sting-win.m4a"
    ]
  }
].map(r=>Object.freeze({directory:r.directory,eligibleNames:Object.freeze(r.eligibleNames)})));

// Separately reviewed combined-source definition; Root must compile actual authored inputs.
export const ENTERPRISE_NATIVE_COMMERCE_GUI_INPUTS=Object.freeze({"version":1,"status":"SEALED","revision":"aef11332a296149186fe6bf4dcaf41a4382d161b","commerceSource":"a7319058183ff6420745be685cf39e39cc091a7e","commerceDefinitionSHA256":"0b48fd7ba46c4b39f1dec0b61148236fa6f2b174a13518e6ce21d66267075447","guiSource":"59dbb6d99312fa44dba1fbec5bdf24948740e0dc","guiWitnessSHA256":"804f29d96f31767fb3447dc61ed01ca243d9770357923ded125493bb19e71f58","replacements":Object.freeze([Object.freeze({"file":".github/workflows/ci.yml","before":Object.freeze({"blob":"93697530172cae664b7554df63eb3d06595b8271","sha256":"17df90e3724126eabf0215fe9e88d281ca8f9a2210aa8159c89abbf0a28ecdb3"}),"after":Object.freeze({"mode":"100644","blob":"6cc7086ef7321c4d6a0b876d754dfee0354e2c4d","sha256":"fbf2022c72546bc49fc162aee228e2e7ab714891abaa09a1641e80c4cff31788"})}),Object.freeze({"file":"package.json","before":Object.freeze({"blob":"493a6e8fc8d6987577d9d31973bf4d2287bbba94","sha256":"8f017fa715916955f6ec51cd42516301608a365f91cec9402e837aaa5b6237cd"}),"after":Object.freeze({"mode":"100644","blob":"205d05bf6d64343a6ac10a17cf7c23005d0a0bb1","sha256":"471d04a3535643d9f86813820f959187671b238e02a62843e9c020f36400b463"})}),Object.freeze({"file":"public/city-scene.js","before":Object.freeze({"blob":"1c0a43f0d3e9a67706ca5eec20f2d64baf259f7d","sha256":"a6fab5d4faecc0b17b8c80f8a2d75b8bb1006dc65da92c0b0978d4e50cb99f34"}),"after":Object.freeze({"mode":"100644","blob":"f36232fc369260dfad56011699e866cb5a6b60ec","sha256":"e5aa087220e0ffddd01403dfe71a2672a3255a72e3ef6fdb4bf87ff5e347ce39"})}),Object.freeze({"file":"public/city-world-ui.css","before":Object.freeze({"blob":"b4de1210ef45c01972a3ba909c9f4c6a07f4954e","sha256":"c7fb64fc92103baa0f654070ec0b61c72b2d81c3ac731563dff280e46a861cc4"}),"after":Object.freeze({"mode":"100644","blob":"864b0fd044a8bf890d69879e80dceadeb3d9f06d","sha256":"1644bc26395c31cae7653c2cbcca245b54181f4e4b21422e850b48075f19f929"})}),Object.freeze({"file":"public/city-world-ui.js","before":Object.freeze({"blob":"76872f4a6a13576d2d9b631619021ce275a61c36","sha256":"0dcbf85f36dc6961df9a9b6265a4833442dfa6feca50b0687f465a4fa1a49e2f"}),"after":Object.freeze({"mode":"100644","blob":"57418025cde951835a69ef6be48543ff1b41672f","sha256":"03570ca46d0fb58ee0e27979747beb32c96107bb833f7dd3d80c0a83d243895f"})}),Object.freeze({"file":"public/index.html","before":Object.freeze({"blob":"ab9b7253ece151c7fa13051f484fa20fe00211f1","sha256":"9b963c0e87676a7464645268cb1c867b02fd0881a2023fc5f4bd9e0c3b733376"}),"after":Object.freeze({"mode":"100644","blob":"9e09306815a348b6cb5d88ef9013bb80b8a16893","sha256":"e9be5f21f3b25b19aceee9826008328e475beb94b7ef3fd3f9f208349c68b7d3"})}),Object.freeze({"file":"schema.sql","before":Object.freeze({"blob":"e95c5fbfb0686e6ad4b7edc80d76cb04455a5bb1","sha256":"833373245ddb1ce5a3c9ed386a9b3245d81ddb0bdb51e75d1e5ffee2a7684335"}),"after":Object.freeze({"mode":"100755","blob":"76a84fa4c4f398b9df9fad7ba96cd5229f2e6527","sha256":"0d9352d3cca554f51f3bbf5c3803f17534e31e8d14574ec82789a4718c232c3b"})}),Object.freeze({"file":"src/accrual.js","before":Object.freeze({"blob":"aa53fc3c5074d1281d693bf56573bc2ed6058570","sha256":"0c6393ff9780dccda0eebd9f1533598f1bb2810443b210bfc84150f20fb0ef6e"}),"after":Object.freeze({"mode":"100644","blob":"244e8ac95efe718278d0338876713e4083240312","sha256":"6d867d203e9479d80b7ce15e4758af519bb001604e7e4603dfb15e877514746b"})}),Object.freeze({"file":"src/agentgateway.js","before":Object.freeze({"blob":"5fcdd3968495dcee9b038ca8a91672578be093bb","sha256":"7ea1a1e0e572b3b717ed7130879d2bdc56916a2a163483996a0f0d555f6e428e"}),"after":Object.freeze({"mode":"100644","blob":"e0185998ed68e0604062aca2e23dfefdb1d79ea1","sha256":"337a77e151c17e55ea4055280d192d353cdd067d6069b4d001ce7bfbf9be4071"})}),Object.freeze({"file":"src/agentturn.js","before":Object.freeze({"blob":"e36d854151f2eb7893ac951638298ffc4fb0af14","sha256":"8b54b00192e0c191a81e8057a7b8f1ea3a8b697dbce06db438432dd3c4f96270"}),"after":Object.freeze({"mode":"100644","blob":"5294e1776283af79ffea8ba92c0d07d869cb6ec0","sha256":"c95dfae693e344b6d1a470013631f02f55291299442e9adf2fbbd8ecc0fe6455"})}),Object.freeze({"file":"src/boxing.js","before":Object.freeze({"blob":"f62a0f67d4e14239b6c9a16ec390228571074822","sha256":"50c085afb038020c0a44651c4350df02f217c7d8cbc9004cf59167d7a3314243"}),"after":Object.freeze({"mode":"100644","blob":"25fe7c1e92c38713e649f654926d8b92dddb4a23","sha256":"9b9cba076ddd02a4cc979bb7c8f7f2d1bfc82d681f75f869175fdd7d6535ee4d"})}),Object.freeze({"file":"src/business.js","before":Object.freeze({"blob":"84d29c9b71ffeae2277bb54896942143937c2b75","sha256":"ab4cb2d68d3442a8a1ec9587359020016888317e2afcb7835e769da8ad01587e"}),"after":Object.freeze({"mode":"100644","blob":"aca781b54ff0b503935120133eccf8651111f6ae","sha256":"ab21ead8eb57a92be0f23c3b68f2cf8e3babdae77ddda69bb64857f279a6f8ca"})}),Object.freeze({"file":"src/cityhomes.js","before":Object.freeze({"blob":"3692679d2be059fee55313e61c831f4ee2f980ba","sha256":"4748763673b2f1896459921c88bf4162dcc6f78bf3230388a1825ea062caba98"}),"after":Object.freeze({"mode":"100644","blob":"72b342b1850b458c2459aa21eb0ed47d8de7155b","sha256":"ee2c6a581cedfa28fe4779ea4333f7107a7674988a05de27b267e82e3c7fd67e"})}),Object.freeze({"file":"src/corner.js","before":Object.freeze({"blob":"8def56ff4b1cbd8d7ab85f0d86594a69d29b39a7","sha256":"e4658d478f719e5e169fea8e780f0bb8088f2589d6df8ae0fad07a260f28e2c2"}),"after":Object.freeze({"mode":"100644","blob":"7e75652bc1c444df238ca07bde92a54af8c01320","sha256":"6138a926e31701820678b098f62eafae5f115837dd51154de196d5440e08ce59"})}),Object.freeze({"file":"src/db.js","before":Object.freeze({"blob":"b9e90862d4165cc69916bf2ac09383aea00cae15","sha256":"4401437538c468ce95dbdd4db927d82cae159991a3cdb60f9ce51ce9dbc307d6"}),"after":Object.freeze({"mode":"100644","blob":"660e09180244fb724c84f6b23e715b48b0224fb1","sha256":"a549864cfd44143f614c727c9e9d575cbcbe2b6c58dfdd6cb8493b6480975b2d"})}),Object.freeze({"file":"src/economy.js","before":Object.freeze({"blob":"7ee2babf9f83d594a3de3f5e75a23bee3a5428bf","sha256":"d934bd109bf4599d79e6dba9ead2240b3b4c036d3f676a428941de2ca326ae91"}),"after":Object.freeze({"mode":"100644","blob":"f58c1657fc32d133b9cbf885dbb8ff72f193a725","sha256":"82796b87d7469df6016c3bb99e8875f5fc3f1c36876dc5f8f87ca5dffd8d9fc1"})}),Object.freeze({"file":"src/explore.js","before":Object.freeze({"blob":"da72029e8fa89de5de6e32c47b254f1ef7925193","sha256":"2334dce9a5d33e4af74a5ad05bbedbbd27c35cf4b29d1cc4a70bbe1fa665fc45"}),"after":Object.freeze({"mode":"100644","blob":"bfe21922ca3df0f50aed7aae9485d9fb8f5f7eda","sha256":"27af4bee3ac1194d8f5874215472e44e60c2c37c3685aa4cc1cd5a8cd29a5e8f"})}),Object.freeze({"file":"src/game.js","before":Object.freeze({"blob":"0b9d2004d4a87bbbebdd2ec45c4b5123a7f50ca0","sha256":"811c4b3e97d2ed391c541597dd82ea5b4c3b13aea4328beb2b3aa5da739c4ee7"}),"after":Object.freeze({"mode":"100644","blob":"8b252c19ff5f5881a1d5ba8ad41ab1b07767712d","sha256":"85ecd9acbd1dbee4a430fda44f70af4ee492e3cb593a3cf410602789a134764b"})}),Object.freeze({"file":"src/goodsmarket.js","before":Object.freeze({"blob":"8f8bb4efb2e3d02dbea475f556d7a93814512327","sha256":"74a2b325912116ea616cc74556a7b02e98793c31c3ffd85b62999c81065f0f5c"}),"after":Object.freeze({"mode":"100644","blob":"1565fb9c55fb37b0a58ff441e052587f9ade42ed","sha256":"53ae926ed2ac223ee65bc1383f7156801cf1cbab4204814cb16441059f4f3345"})}),Object.freeze({"file":"src/goodsquote.js","before":Object.freeze({"blob":"24ccda7ca8d9336a752fd42bc0e0427db2e0f5ba","sha256":"b191c83c4a3f254d6499fe8775025f9554d448151febb4a72573c5cbf5a44e50"}),"after":Object.freeze({"mode":"100644","blob":"c60626f545957d397d9226ab75f0c099ce954d8f","sha256":"2d801873a2a9d8897ec2a347fbe4f6e6820d65b976b581b0817e7bfa97544a30"})}),Object.freeze({"file":"src/growth.js","before":Object.freeze({"blob":"5770a4ef7157630aae8ff9fd13cfd1efcb2a18af","sha256":"16d08e25af66f0f522751009694dfc6161a7459552c4036622021390a5cf85a4"}),"after":Object.freeze({"mode":"100644","blob":"6d8230e04aa35fee8759e537c14e9bd2ee38e404","sha256":"6daad1508e16cb9e8398532b912e6694825247966114eb4f5d54fa7c6d879242"})}),Object.freeze({"file":"src/hustle.js","before":Object.freeze({"blob":"7c770263d16805f83234f736449b54ec9990c6af","sha256":"5f0e4b20031c0b40ce22d2652220ff75f4c8a8132c4203da41c06c2e91543fa7"}),"after":Object.freeze({"mode":"100644","blob":"9d2e89553aec80799bd0e4314ca7eaf15103d25c","sha256":"66b1853107b1e727e1fb4de4114133f9d4138af3ab629c3ae01666fde3db7833"})}),Object.freeze({"file":"src/invariants.js","before":Object.freeze({"blob":"7532fe24eae8663e2a1b8b04b6b209a9e075565b","sha256":"3aaeec0f05c5fe40a13921d022471489341b3201da5368bb05119d3db73534c5"}),"after":Object.freeze({"mode":"100644","blob":"b0dcabcd1589cb914860fc629f69aff856507e82","sha256":"e75cc63ff714f0bd9169fea5d4d8171a61b8812bdd82f24f648bdbbe9b09e168"})}),Object.freeze({"file":"src/kitchen.js","before":Object.freeze({"blob":"bdfa32bef714449eb65b0880ee9c5fb112c8129b","sha256":"08fc2b7f0ed709528d4979712a9b717851f1063220e09b4df06a5cc8180145a1"}),"after":Object.freeze({"mode":"100644","blob":"921d971a74cf09094f73de0b545c45b65c684f2f","sha256":"64c71b383b92adcde5be12522c36466af4d1d600814e02019e4bd3359f239b22"})}),Object.freeze({"file":"src/market.js","before":Object.freeze({"blob":"389a1a9780827da3d8357888cefb3f4a195ccea8","sha256":"dfffe1c30e084f60cd12773abee9f2fea7f462985a07b25a266177e7cd1f279e"}),"after":Object.freeze({"mode":"100644","blob":"f7f112e1f5419f8e226a2a65a5564b4cd5d5a1e7","sha256":"bf28b47d2ec420aa73536f1cee4f20c9527e4b3c58898a03b815ac5e1bef2b42"})}),Object.freeze({"file":"src/opportunities.js","before":Object.freeze({"blob":"22a05c633376d01ad0d5640c61b0ddcc32467da9","sha256":"9c6b9f62a01f1ca299ad4b76180121d462d7ec173791738efa0ec97c60f901c1"}),"after":Object.freeze({"mode":"100644","blob":"7fb843e54668eed6d96de6ba2fed3286bf2e1787","sha256":"14764e0caa0c513c21cf247d941c92ef97951f611a6cd0567bdb85596156d1ef"})}),Object.freeze({"file":"src/pen.js","before":Object.freeze({"blob":"b0c5e1f3d60eec07c5d4d80ba57577c0f271bc59","sha256":"11f992b7e89796e050384ab1834f024ffad13f6489b932c90132dc6fbab02506"}),"after":Object.freeze({"mode":"100644","blob":"d1895af4408e48bbda37b55c7838ed924c5cc365","sha256":"8303d038aee9d7bcd5438373ab368872d8f5dff0477eb311987816f4b64294de"})}),Object.freeze({"file":"src/population.js","before":Object.freeze({"blob":"c4118c150f9df6a645ba473b955d04cf30b0103c","sha256":"7ca4cfe884b3b2f8acd44a9c34c88507c9c42e0730688cac1d4bd358a7d9cecb"}),"after":Object.freeze({"mode":"100644","blob":"81e66e10d3d575f58fe62f486bfed307a7a71328","sha256":"86ea4b0d0b1b21869860f8d25065ad8800ef691c3ba8be461a4debbce55a9421"})}),Object.freeze({"file":"src/races.js","before":Object.freeze({"blob":"b0799c52b46bb77891f4cd588679d74578ca764e","sha256":"8b95cb8b22f22b67823cf4942b354d40e9c471f385d389003fe0f8ad2ac23644"}),"after":Object.freeze({"mode":"100644","blob":"d18563853e3c0ac1ca217494e34b1b5045b4e2d8","sha256":"48c120b08671b06f86c736d057d2fbfe6e93af8cdd953130093cfc948f2a8034"})}),Object.freeze({"file":"src/rules.tail.js","before":Object.freeze({"blob":"33db41906771f1594b004e916cdbdb031bfaf170","sha256":"84eeb263dcfc13cc4ea13683a9460dc8429df126182562c5b6986654be6f9e05"}),"after":Object.freeze({"mode":"100644","blob":"a2457435b5a4c025cb9c743bc1b58f3017fcd588","sha256":"ea0d80bf6dfc5819edacf14d5e3aa935a1b27dfc00df7f34a8e3cbe0500e66d4"})}),Object.freeze({"file":"src/server.js","before":Object.freeze({"blob":"ff9178037e2926ff19d93e20631f973426bd965e","sha256":"246ec1740b622d8120d8a4f8c9b38abe105b5951f63c9e65359221962ab73f1d"}),"after":Object.freeze({"mode":"100644","blob":"77cf1e67d61f75887cef42fc37bc7f13fa340471","sha256":"2473aaaf8c016ee881a674f532d9b22f951dd047fa88e0b859f1861fb2457686"})}),Object.freeze({"file":"src/social/estate.js","before":Object.freeze({"blob":"28aa6601f3e1218d8a7f6433e4e4b1fdb04223cf","sha256":"9f7030bef3dce98ba1160385b20451224117674cc0cb17efac111e7c2025124d"}),"after":Object.freeze({"mode":"100644","blob":"c988e5fed83be712c81aaffeacae97a68648df45","sha256":"5f9634aa6cb6ff046e689bf34c6e6e7e585fa4073af00609bb96c2aaac592d17"})}),Object.freeze({"file":"src/stable.js","before":Object.freeze({"blob":"29363899a8292e93c30ab44ba986c97d947e837b","sha256":"28c7bb72e3e230e301dc429f522dcf1025c8a2f12e907fda62bc18cc75058dfb"}),"after":Object.freeze({"mode":"100644","blob":"73979a8bac01c8ff2ca49b12bbbf1fa59ac25408","sha256":"b5e3984c3f69010f5e3458bf230acfabd87fb24c294af97bd1e02ce6c6ab1eff"})}),Object.freeze({"file":"src/streets.js","before":Object.freeze({"blob":"224f6c65c5bd8837ccbd9ee3ddb87fda06c595a4","sha256":"b3bd812f9d42a8abfc1b50763f8bf284f67ac5c7b0f01fc4cd99d7bf40f3264f"}),"after":Object.freeze({"mode":"100644","blob":"6b3672ea460450c2c3981fef3fa54d3731814a2f","sha256":"6a96356f86861eb01f602dea084a4a00abbab8278144a10ea607cc64ebbf5203"})}),Object.freeze({"file":"test/enterprise-release-phase2-migration-catalog.js","before":Object.freeze({"blob":"8db275cac3a74e2eee02b0674ac9426f27c71ca4","sha256":"499748c0c688c3f40ec185cd8cf538a7e1dde717c1ed4a8f98b046982120741f"}),"after":Object.freeze({"mode":"100644","blob":"660da3ad7436e67e649f11f067c40ba13da731af","sha256":"efd6a00f7ca0d2243d6761f13de73177a6f7ee69c96f657673d40db44b82182c"})}),Object.freeze({"file":"test/gates.js","before":Object.freeze({"blob":"9473879edc2899c704157fa7fd1e2f2982a9edaf","sha256":"e5454cd2717678dbf8889551adeee59256b428ebd6df1479d986b1cea544cb57"}),"after":Object.freeze({"mode":"100644","blob":"f085576b8f77cd01e788d91e3fadab7176923361","sha256":"98f73f521bc429f49755b6d2dcdc946f791bee2a9b165dc90ef89d82f60eca53"})}),Object.freeze({"file":"test/graph.js","before":Object.freeze({"blob":"6c3cd698f8f72f46c6a36309abf6d9f9dc7e11fa","sha256":"ecc63b6ca017cfbb53cf35e43abca31cf14cfdb855d762ff3db0d9c7ebcf4133"}),"after":Object.freeze({"mode":"100644","blob":"1ea4bc49b727e5f143cdff2e85e95588fcbc19f8","sha256":"7e7bf97bafc75dcd91e69afc8e3e26e648b5b1b924f67bbab76686a6c5048faf"})}),Object.freeze({"file":"test/lib/rc1-historical-source-fixture.js","before":Object.freeze({"blob":"03c53f8fd02323718e5ad5f226e70cc20a1d5bf3","sha256":"f62744c9f0cb55630bba46a169a091621badf1e3b8583418ea0287f9e6244146"}),"after":Object.freeze({"mode":"100644","blob":"f9fa450497d0e407e1cbd2bc524cd0db80ecebaf","sha256":"c8e7ea4fdfebb0fb4741726c72636260a54371b9457b9f874604973829488a0f"})}),Object.freeze({"file":"test/market-operations-source-compatibility.js","before":Object.freeze({"blob":"2fd1d0a71956beabaa65d84c8cc9491d62d863e6","sha256":"2b4568bf1ee56b6ec00fd4bad30f99363dcc35ac7ad2f974325271b80905333b"}),"after":Object.freeze({"mode":"100644","blob":"2117d500454e7289592c37f1c620f310e23aa676","sha256":"7c35963780c0e42c022797f02a32521d62453966d19e95ba61baba4cac14e8b5"})}),Object.freeze({"file":"test/next-layer-source-compatibility.js","before":Object.freeze({"blob":"3c89a3558ae954a24520ad59681eb4ac5b77bc70","sha256":"ea1f52c8311d35f1339610693a0794a689777687afa8e85e240463577c16954d"}),"after":Object.freeze({"mode":"100644","blob":"6110cea06fd269d8d7a2812873afc2af60db107a","sha256":"6bc01e843b5514d6a713619c2a7a67c148c5eee45848c684bc32e971509e5f5f"})}),Object.freeze({"file":"test/phase2-postgres.js","before":Object.freeze({"blob":"084a3a46d61eba9748269ad0db9b131c417b1068","sha256":"d611dfc5999a22580b653bfed1b7b1d6cd1c1416bc0661cfce23330afb840ff6"}),"after":Object.freeze({"mode":"100644","blob":"e7247eb8edbc56193b325494f22b37306ac2f5ae","sha256":"ccad77e47eec6de7b5b5d54c9b66ee6d1b3b7ce8484856fccaaaa245dcb68698"})}),Object.freeze({"file":"test/rc1-city-gameplay-source-compatibility.js","before":Object.freeze({"blob":"ad1f37112359d8c052c7069e1ecc668d4b01f64c","sha256":"6588c3a441d4f762b5de23c91a8400eb7bc5091dc48e97bf1894a610ed4fa8d8"}),"after":Object.freeze({"mode":"100644","blob":"f2bce0acef5b35a64fc13d21469989aed98ad9ea","sha256":"6a80ad4e21390d106d2d5c3fdc4fe134d8c211d87571829e763a97eae91578cc"})}),Object.freeze({"file":"test/rc1-first-batch-source-compatibility.js","before":Object.freeze({"blob":"02591fa15e41ec0c6b396905a1f30d5120a5cd0d","sha256":"dd48de98ba7602940e0f22eab4d11f88a48839a0de653b55e434dbe0431ebe7e"}),"after":Object.freeze({"mode":"100644","blob":"8cbbdd6688bdaf31de92c40c9e51622245701bbd","sha256":"4656ecf4c53c111dda77a376f3ce3824c91499c33d1a27fdcbcbe2bfd802f15a"})}),Object.freeze({"file":"tools/graph.js","before":Object.freeze({"blob":"1cb57e5b8e84fba6399d0dd3ba056ad239347cf0","sha256":"378d514638f7ea40a0c9b100cf3368ff93114e3c3f721df0307f18d459c0e4ca"}),"after":Object.freeze({"mode":"100644","blob":"799455c419f0205ace208217e3be8be94f572bc9","sha256":"ddde505ea6bff77468e01b276f5a00790cd251d93cff47eadaaee6d80a4cca23"})}),Object.freeze({"file":"tools/player-intel-source-compatibility.js","before":Object.freeze({"blob":"9af049b72001052403fc5940056777e9de440b43","sha256":"bd6dbf8afbcd75a53d955133d0092ed032f23592242677fdd7c0fba641e313c4"}),"after":Object.freeze({"mode":"100644","blob":"00fabfcc01874bb9162634343e6e97aa4e438535","sha256":"f8b3aeef813f57cef2ce803cbd8d1e43ba028e774bd85c9f1812feeaf0afb620"})}),Object.freeze({"file":"tools/rc1-company-operator-source-compatibility.js","before":Object.freeze({"blob":"341edab6012a45f30443993577825166ccb935bc","sha256":"1ff7b417ee8c038170090ee64806d74af25f4ed2e1063212fa7c1d509de84601"}),"after":Object.freeze({"mode":"100644","blob":"04c66b8945a5e8c7cd4c25b0e5ab72df37f71d09","sha256":"52e8432c792180f43be999559fe5e4744415562a89a633dc027fed7c719d978f"})}),Object.freeze({"file":"tools/rc1-deed-source-compatibility.js","before":Object.freeze({"blob":"f44bb4a8ee4cb461ecc4a76ab0930edd30419bff","sha256":"deb2c8580b4293dfadab769daf65af9b150d9710fe665aa9aa27fcd30f3e4746"}),"after":Object.freeze({"mode":"100644","blob":"316d8d4ae5e956050b83823a2786cdaef448d911","sha256":"916339f603be56be8a726bca0c73d48e975c24bcf981d4cc8956e18493bc41b4"})}),Object.freeze({"file":"tools/rc1-invoice-source-compatibility.js","before":Object.freeze({"blob":"8b818e230cd6304de7ea0271e1ee829bbd8a7643","sha256":"25abba4dd3880d444850b7a6853ab4065cad8ca740356501c5214ed57679aeaa"}),"after":Object.freeze({"mode":"100644","blob":"3eb02714243c10667db896c222c2b03a3c271f93","sha256":"e8993a705d736145bb0bbe8c1071a37d2b108efc150e8a4e204691b6dbf7d968"})}),Object.freeze({"file":"tools/rc1-world-qualification.js","before":Object.freeze({"blob":"6a81639df0d4fae11be126f574197a8e924d426e","sha256":"e677b7080fd37428d211254f5f042b7b0e0a9f18ed052bbb86da446a4a45f8d9"}),"after":Object.freeze({"mode":"100644","blob":"9e9e20ead704316f9e35d11e6adf80dc125cc6ea","sha256":"e720c5b39b8c6f70cc528a912d4c932f5e19f4c08207a221fee625de0c782d23"})}),Object.freeze({"file":"tools/deed-quest-source-transfer.js","before":Object.freeze({"blob":"3eea8c22f1cd3e8da65ce707c50db091d7ceca45","sha256":"05bc98b2f26de7172675b0fb17d865ffa75d299a113807f4a5160beeb8fcfe9e"}),"after":Object.freeze({"mode":"100644","blob":"5129b649ea2b4f1f6a706ff7aa229d22d04a85b2","sha256":"fff27845a14ff36311b7446bf2c640bdbe61d5950eac9441d0919d2b2799b31a"})}),Object.freeze({"file":"tools/enterprise-deed-release-phase2-migration-catalog.js","before":Object.freeze({"blob":"a893f1cf1df824dca6ba35874174a27337019a61","sha256":"8ed9ee0e08e9bbbc25bc921ea5ec96e4de495121454b0e21857a7d318f31a49e"}),"after":Object.freeze({"mode":"100644","blob":"f72928e9f6db7c23601bdffdfe842a8a82124962","sha256":"d9ce65cc618b419f7be1efca0c7926d7f72cd28a21abbdc4e7f86a0f14672ef7"})}),Object.freeze({"file":"test/enterprise-current-source-compatibility.js","before":Object.freeze({"blob":"1af657454297f695f55fc41070b941e27931caa5","sha256":"d8916125332f0e87bfa3af73b987a6f568d38935e49e80681db1aea419d90d78"}),"after":Object.freeze({"mode":"100644","blob":"60b17b4e52236b2422f1054207a3dbcf1f02e24b","sha256":"eccba26f1e38c7dacbdb58684f8cd8d86755fc9f4e970ea1db94287198672d74"})}),Object.freeze({"file":"test/commerce-current-native-guard.js","before":Object.freeze({"blob":"6ed15171a6d4467014c0db205e8409cfae134bc2","sha256":"59b71be38666d373d7e6215ee250a58e857ca5ec18cd3eb1a150f06853e1d16b"}),"after":Object.freeze({"mode":"100644","blob":"d65b113be14e50a542f65c0488c5147c6d39fa2c","sha256":"5bdcde68d956b588d66996a7a73f6f25deacaecf47c445676a3259d7275b71ba"})}),Object.freeze({"file":"test/commerce-release-phase2-migration-catalog.js","before":Object.freeze({"blob":"3d4dee2acb59a0a8debeaaa74de2db135dbe08d3","sha256":"e03cddfa2ee7ca467fcd81f5c5ffa23d1b121a87cb7b6f12e0c1573e5fa55150"}),"after":Object.freeze({"mode":"100644","blob":"992fcb741fb9a8096476805b1b3c1d9e3ff6157e","sha256":"51fde122f1e68852e56fb70664ca52a52026e711d7c893c30b51ab0456371ee7"})}),Object.freeze({"file":"test/commerce-source-compatibility.js","before":Object.freeze({"blob":"22bad9e37c5559253a2ff9d3bcf8f23ed81c7e03","sha256":"4cdc6734ff24182be698ac6adb5df707009f58213a645e7f15c0678cfbabf59a"}),"after":Object.freeze({"mode":"100644","blob":"cbfb3308dc30818d354d8c736f7b9d1297ce07d8","sha256":"519c80cfa24e447f7c5c014ac3e25f59f4c10db9ea755666e4ee1def3f91ea06"})}),Object.freeze({"file":"test/commercialcampaigns-integration.js","before":Object.freeze({"blob":"251031e3ef43c7230e04e094e6db93b34b2c8035","sha256":"6a0f35168929b1129fb9a4f32ba4cca627f7f1e21d0d1c07ceaa0d5fec5ea4e0"}),"after":Object.freeze({"mode":"100644","blob":"dab3d31219c6f5cbdc1b22e76f3d364b4e7b28e5","sha256":"706da88337f814672d6a19d6f38a3b009530e8c695c00f0e660aed7768cc44dd"})}),Object.freeze({"file":"tools/commerce-current-native-data.js","before":Object.freeze({"blob":"a5dc6588f2bec318629c02d3537beabf2853ef03","sha256":"d3781dcde4b9c3454c4858fa5946d1fd852c62e9a296eec954b3f44ac68401dd"}),"after":Object.freeze({"mode":"100644","blob":"b109737e6d1c7d4a764300da7a7dbe8279a0e760","sha256":"ca720363436c5485134767b434f2809890bb9ef487d787bd1b539f43b6d77dd3"})}),Object.freeze({"file":"tools/commerce-current-native.js","before":Object.freeze({"blob":"3ab9401832a98a1422af0426ca4c2eaa947ed4f5","sha256":"3605bfcf32f581ee62450dc1a32a5b6db3f51ffdaefc5c9c4886740c23401feb"}),"after":Object.freeze({"mode":"100644","blob":"0aa6571352ae4a77a4e1db59d5cc403c79d77d86","sha256":"f909ed1c9aae7419f0277d7da32ac67edb30b33d148963058ec30c037ee25270"})}),Object.freeze({"file":"tools/commerce-deed-release-phase2-native-catalog.js","before":Object.freeze({"blob":"637c279ef537ec1c6a213a2f156235a6aeec62be","sha256":"dc84df23e59ad3282fc16c556943150be1e9fcc219facd2e94b83f6b2c817f4b"}),"after":Object.freeze({"mode":"100644","blob":"ca681bd72a48e12fcf574c3a8f0982642b4293b5","sha256":"824ee43f3a4648577a80d7f4db537db3f420615adfa6af2335e6598d6b407d36"})}),Object.freeze({"file":"tools/commerce-enterprise-source-compatibility.js","before":Object.freeze({"blob":"3568959b04299221e439511de7f740190af7b15a","sha256":"e0c99568d2bc36c12f172f440cf8632adc5d291a94d8b02ced87389e5f25cf1d"}),"after":Object.freeze({"mode":"100644","blob":"5f2c74048bd6249798b0c7a8a4ebe873161a7e88","sha256":"6d546678852704494be4baf383cc3481d3f1b63f56eb7db42b2124418356085c"})}),Object.freeze({"file":"tools/commerce-enterprise-source-data.js","before":Object.freeze({"blob":"000719bf8d16c77ba9ea34c408df2d6ec927bd11","sha256":"e92746d80287907d86e72c0b2860259daf5774fad5a0fbb632fc0df693c62c6b"}),"after":Object.freeze({"mode":"100644","blob":"536bbb9f7bc35bbd2049082f52bc8f755fd467d9","sha256":"46b6319f9ab7efcad6ebdbe77860c97c0b267635313fb32339c6c37560e5b922"})}),Object.freeze({"file":"tools/commerce-native.js","before":Object.freeze({"blob":"7bce19226d406d5132a644c8c7491216bf0f7195","sha256":"18bd52ea2c84b0b4c964f853165d8b8178e91dba66cfaabe1a6bc52082061314"}),"after":Object.freeze({"mode":"100644","blob":"7eccb808b2879d5db1cb0c761174408a3d145c2a","sha256":"1a7d6c2cae79ea12a790cc6f54ccdfbadad8dcd6ec38852135937ce891d6a224"})}),Object.freeze({"file":"tools/commerce-current-enterprise-source-compatibility.js","before":Object.freeze({"blob":"381698b3e3d2de28b1d2e1cb5e9258d9a2037dc6","sha256":"a97e87e82e69350773425c2fc36ef49c97fa2eb1d5fe7a515b3a89b0d50754e2"}),"after":Object.freeze({"mode":"100644","blob":"a883c46b31c2c093c1dd5a7cdcc14ec0d01442e0","sha256":"2ec232ccf27cdbc4fd445898dd6a44a5f32786835eae5baae6edef3180638822"})}),Object.freeze({"file":"tools/commerce-current-enterprise-source-data.js","before":Object.freeze({"blob":"12a948e51b1f10afbab884f8fbceb8e7952c7b55","sha256":"718377da3a928b42004fa8e56600573d85e472852f5a0cdb20a3edefa9334c54"}),"after":Object.freeze({"mode":"100644","blob":"a7404646b6794993d410638cd69592c297535d78","sha256":"b8ccc4aa7696d7a00f9ec565a5ba39859fba04d944c9beca68a44645dc2baa62"})})]),"additions":Object.freeze([Object.freeze({"file":"public/city-world-layout.js","mode":"100644","blob":"bcf88a264e15fe4fec15aaeeb0c7a0f976b8ee1a","sha256":"f80ae0cdae8e28751823d5d8247a47c3570a574c30ed9d34aee3d1b615be412e"}),Object.freeze({"file":"test/city-connected-scene-browser.js","mode":"100644","blob":"12bdbd3ce78e1cdf55e6151ba9f346ffcea6b19f","sha256":"469e137f43bc113ee074efb9e10a3016ffeb40cfea49a36c25a12d34f9ac82a2"}),Object.freeze({"file":"test/city-homes-api.js","mode":"100644","blob":"60e8a4005d5c2263e6ce91568e2a0bef42cd3856","sha256":"ca7a5e67405a3959f373217b391c7f6db1631481e3749a791c39d9d13dfdd6e3"}),Object.freeze({"file":"test/city-scene-browser.js","mode":"100644","blob":"5e06fd4272892843b3586d4991ae8270a50d4d4a","sha256":"ab314531e76db3bd81731649f39259867fd7a92278a704d03a6295008f5d0637"}),Object.freeze({"file":"test/city-world-host-browser.js","mode":"100644","blob":"8ba4806fc138b06a0e4b0a5d2686c29245d913ce","sha256":"962208e525a06a2caad7d438d6c09c1681c52a0982749f68e2a5a3bc6729a3cf"}),Object.freeze({"file":"test/city-world-layout-ui-browser.js","mode":"100644","blob":"e5450529d0fd7da90f4d4c573e1ff56848d74ada","sha256":"87bd3c463866d7f69d5f8fb3570a5f7ecc43140a66cdb9d296ffccf4536941d7"}),Object.freeze({"file":"test/city-world-layout.js","mode":"100644","blob":"c1facc447a8d030e00e62041e3bbddf8bf3f9948","sha256":"38ac73f565375329d2a095477be1960a606d46cb1729a337f95e69bc883ea831"}),Object.freeze({"file":"test/continuous-city-host-contract.js","mode":"100644","blob":"3c598b977122aceb6581bdcd3f71201890cd840a","sha256":"6cd0d39259389b87c53e88ba2bfab662e1cfef0554dfdd0d214713a18a97b01a"}),Object.freeze({"file":"test/continuous-city-source-compatibility.js","mode":"100644","blob":"6145e019ea3e6cbbd57819870f74f214662512a0","sha256":"c8380b045a937488e8e9ee4cfe89aeafc868987bdc22206b1b29b1d70b30f605"}),Object.freeze({"file":"test/deed-quest-source-compatibility.js","mode":"100644","blob":"2c846f97633519c506c23f7260ae1ac7df94de5a","sha256":"f2556ecda8d8d1daea852e381232a2ea8ecbffd827b2b7a8df2870305de8df3b"}),Object.freeze({"file":"test/economy-release-composition.js","mode":"100644","blob":"1c60b386662f3cc06b95e2d483144870fbed0df0","sha256":"21bdda1de10aa1881076ba5824bb27628ab2919355b7a0076c3b0055ca0bb116"}),Object.freeze({"file":"test/next-five-source-compatibility.js","mode":"100644","blob":"99e4b8f86ed7ac88a679e33935f4a1de2a1ae838","sha256":"3a8796156bf323b194423bc90a10e32c1b5e74e85c993b5ee1a570df8a47cec4"}),Object.freeze({"file":"test/player-intel-source-compatibility.js","mode":"100644","blob":"f8a6f5a5d55384ac1837af757dc28a30ae581fc8","sha256":"1c337e7ba54775c461707e5b5317bd7fd7917ebd49796971b1d5cc651381f2ec"}),Object.freeze({"file":"test/rc1-business-season-source-compatibility.js","mode":"100644","blob":"bd2e384c6959d3566977f87320332c0956d43f04","sha256":"bc5eb6d655d1f74b8946e931a9a5c9f92cb9a78e1a74521c8f478d076b5b8981"}),Object.freeze({"file":"test/rc1-buyer-cooperative-source-compatibility.js","mode":"100644","blob":"da53725c5831e457a06af897b1fea6e108329b46","sha256":"0e09a73f32c4fc73724fcdcaa3615085b3e163f5cbedecf1aaf8c2a510adc631"}),Object.freeze({"file":"test/rc1-checkpoint-recovery-review.js","mode":"100644","blob":"a4c6e4b2a10eed65bfaa2b5d9fd5061bb25a3529","sha256":"85b1837c7bc16b96ccf6e77222a350a3eaf2d8c47bb58277515ec9a12a51ca3a"}),Object.freeze({"file":"test/rc1-commercial-premises-source-compatibility.js","mode":"100644","blob":"6f4539e0a5a772a3ff5a1613bd2f381b5301812a","sha256":"76ada8c31c9c7a07ef1cea6b7c205f35af8b728c6a122f0497336268ca04800c"}),Object.freeze({"file":"test/rc1-commercial-reputation-source-compatibility.js","mode":"100644","blob":"22681c71f927d8110f5acf064ddf0dbfc1407b41","sha256":"340e6cd14c0e9abc53277a27808c739c578b896e29cdd731e1753207f13ba065"}),Object.freeze({"file":"test/rc1-company-bank-source-compatibility.js","mode":"100644","blob":"11afa75f54d178e63c1527f7b0233711341e2224","sha256":"20682620f2582c573da3e6df2b8cd98c926202f14991fc2bb5c2665eb7fc49b2"}),Object.freeze({"file":"test/rc1-company-logistics-hub-source-compatibility.js","mode":"100644","blob":"634659f102b2398963660a84d391b404fe674ca5","sha256":"ca6029a5f4115d76137d9e279b363253bc445154b94822550a437491ff783846"}),Object.freeze({"file":"test/rc1-company-operator-source-compatibility.js","mode":"100644","blob":"5474870f60f419d07d1090ca6caa7dc679ce325c","sha256":"6198dc2ef1d8f67e9e731e5c4a2810a69c21bb8a98a8ecf2b1e9fe971e95fb6b"}),Object.freeze({"file":"test/rc1-company-opportunity-source-compatibility.js","mode":"100644","blob":"2d13d85d9c90ac2c47b3a43b790ad70ef5ac4950","sha256":"a21e875b5b6ade2425cb3bcbf040a667779ba2b681dc3ff8e7e845a66ae78c7a"}),Object.freeze({"file":"test/rc1-company-succession-source-compatibility.js","mode":"100644","blob":"fd3cc576f3be2fc93f62bc8127a10541c92101e7","sha256":"92155966b8719094e2966e7b5f20a8edf53222ffe9acb2b32b45aa78f87abd19"}),Object.freeze({"file":"test/rc1-company-workflow-source-compatibility.js","mode":"100644","blob":"53e858b1191ab4e5b24c279fbac01fb5a6a65516","sha256":"d7938c78fb823c94476b8bd8ea36cbd532cf76434f5223fb6deb5ef16c049808"}),Object.freeze({"file":"test/rc1-fifth-batch-source-compatibility.js","mode":"100644","blob":"4b7c35b2eccef147d4062096febbc199011d79ee","sha256":"24e5801239b9a5e41bf95f2b55127342c841301cc569ed0b6e381d21ce400d97"}),Object.freeze({"file":"test/rc1-fourth-batch-source-compatibility.js","mode":"100644","blob":"d57072c071ddbc1eeb00f7b5165055645922dba2","sha256":"66b2ae20b4088bcbd80c0e1db1c4f8bfe2582fd48ecd9963c37e540204420756"}),Object.freeze({"file":"test/rc1-game-employment-source-compatibility.js","mode":"100644","blob":"6e37ec6b3e187da4d948bf5428fa1bf946154731","sha256":"8558f19345f3b4449fecb2192c508a2925c4ff1f38199c4271adee10487e48be"}),Object.freeze({"file":"test/rc1-intel-source-compatibility.js","mode":"100644","blob":"57814341a22393ef6430ae98d7edafefd10d2e9e","sha256":"9cc28df1ba9a9a993526d6e5d9d4e19ec1389b0eb9e968b19b877b7e03467914"}),Object.freeze({"file":"test/rc1-invoice-source-compatibility.js","mode":"100644","blob":"b60f53c439f2a1ce12e027d6494c9179f9de54d5","sha256":"308786781760b9b6f6f8d0596ba21e98fb2864c6a90854a7ad307bf071238de2"}),Object.freeze({"file":"test/rc1-lifecycle-applicability.js","mode":"100644","blob":"157910858656bca600535d4795ca4f9525571415","sha256":"226580ebd1f392d0aec4a2d70f269b76613dde96f035fcd41c9b7cdb1f09cc54"}),Object.freeze({"file":"test/rc1-logistics-coverage-source-compatibility.js","mode":"100644","blob":"27b3d33ed51713d6939178c9b349f63725050757","sha256":"bab3ddba393c458cfc1f330588c3b6a4a24e16331c889ffcac175cd47208db1f"}),Object.freeze({"file":"test/rc1-market-feed-source-compatibility.js","mode":"100644","blob":"d6ed0350612b94884a3bf765a56bca8ee76bc9de","sha256":"0d2874590c7f108781436071b6ca04fe44ab23b4195ec25728708a9c4e9b7713"}),Object.freeze({"file":"test/rc1-second-batch-source-compatibility.js","mode":"100644","blob":"3950ed85d45a6d57caca4e3cf856b84781e84cfe","sha256":"fcd5044f0ca5f900d63a364f6159517c42539355d374c284faa8e72916b81d23"}),Object.freeze({"file":"test/rc1-strategy-league-source-compatibility.js","mode":"100644","blob":"8a0e5d9d736c0073fbccf50213257e50278d3a7c","sha256":"dcc342c8e430925ea8e7272ebb9445818b2473e577048202c62d4a8396c4713b"}),Object.freeze({"file":"test/rc1-strategy-source-compatibility.js","mode":"100644","blob":"de1f4d28e5d74f5faf7fa6ec39697aeae72c2a1b","sha256":"18dbebc4607f8252f708f9f09f2976385d10be2ec0ab24122224a1f06c244a7e"}),Object.freeze({"file":"test/rc1-third-batch-source-compatibility.js","mode":"100644","blob":"5d51673aec0b43df6fab427a45eef9e1a3c5d11d","sha256":"2301588e7b5dd6b7d9f42faac3d3738dd0f7d7e56613b3fa9fbbeba77dd32fad"}),Object.freeze({"file":"test/rc1-world-checkpoint-series.js","mode":"100644","blob":"36eac8cf48d1b4018dbc4ad764925ab6e2af65f6","sha256":"3cdc4398cfd65181384b28b1702c4778554ca070eebb2bf11f21d891aec38feb"}),Object.freeze({"file":"test/rc1-world-qualification.js","mode":"100644","blob":"81f70adb8d12b65446c11221a9beca15f8de75e3","sha256":"a0c2bbccbb9bc7cbded565eb0d8ada057cdb7519a5ca6374c41cc684f54742f0"}),Object.freeze({"file":"test/release-source-transfer.js","mode":"100644","blob":"613e4fe6c14a134cf78af61faed5c20bd717389c","sha256":"2f76e8dc02882fc8814d52e7338c112670f9f45b7169ce3ef4638634067f02b6"}),Object.freeze({"file":"tools/continuous-city-fixture-source-data.js","mode":"100644","blob":"5b2defe836cfd9f2605b0b698887c94f81e7782d","sha256":"b180170ffa75523524d8e36c333f4b74c25354833ce86321ed92732a0a32181c"}),Object.freeze({"file":"tools/continuous-city-source-compatibility.js","mode":"100644","blob":"648b9062857fc480a0f1ba191a68e36ad6d0b2c8","sha256":"0352ab2b3b5bf150c07dfe88337c077165429e242cfb955b5d65de1a110a1ac4"}),Object.freeze({"file":"tools/continuous-city-source-data.js","mode":"100644","blob":"3d8f2873beb6fcb0a072f8f9b8028d44e6255e6e","sha256":"9bdf4feffa2d8fe39188c9e5e80b0e38ce2f50279e38054ed9a04be396a3a079"}),Object.freeze({"file":"tools/genesis-auction-deployment-plan.js","mode":"100644","blob":"09cd9bb50a2ad3f0772d274be2df4f23c27e4f4d","sha256":"99482795456732aba622e3715448edf39ae50a38066d79c33e38382558174ca2"}),Object.freeze({"file":"tools/genesis-auction-preflight.js","mode":"100644","blob":"dd33b91629b545fd176cfba4cab673a9057bf7d6","sha256":"6e9b6ee51bd26bb5e4d4cce4deb7481c5994724d548ff49ee76390f0b1bd7bd7"}),Object.freeze({"file":"tools/market-v2-deployment-plan.js","mode":"100644","blob":"44d7016f3bf5b505732881026051fff1ce711564","sha256":"0d989d3c8cc6c650e9056aba8868b36b0b12a7ae38ef6e3a1ef87a5db1eb76d5"}),Object.freeze({"file":"tools/enterprise-native-continuous-city-inputs.js","mode":"100644","blob":"1af546bd54ac00f7dbc5db4d2c6e77ddefe1cf95","sha256":"804f29d96f31767fb3447dc61ed01ca243d9770357923ded125493bb19e71f58"}),Object.freeze({"file":"src/accountdaily.js","mode":"100644","blob":"a719c60f947b8baddc707fd4af835e76d5a65a80","sha256":"fb77ee72526fb6838f216cc3f96260b0636ee29b41d266f42df08a2e31180d44"}),Object.freeze({"file":"src/actioncooldown.js","mode":"100644","blob":"64bd5f17537147072cf5942b4022abcc14e95156","sha256":"aae0825d4d14b039f3c77065ed40e5f303482c054f42fb85613e0de4891076b8"}),Object.freeze({"file":"tools/economy-hardening-source-transfer.js","mode":"100644","blob":"c62d8771b028b62db55fad9289a5ece938f67eb8","sha256":"ea4c5b45997185760a144391ac9cc1810cb72019313e7c1238502fee64431f62"})])});
