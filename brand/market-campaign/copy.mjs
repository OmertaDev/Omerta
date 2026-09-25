// Publication drafts. No post has been published by this package.
// Text includes thread numbering. Asset filenames resolve inside this campaign's png/ directory.
const threads = [
  {
    id: '01-city-treasury',
    title: 'The city has a treasury.',
    posts: [
      {
        text: '1/8 The city has a treasury.\n\nOMERTÀ Market puts liquidity, reserves, inventory bonds and family Turf around a new Uniswap v4 market.\n\nBuilt and tested locally. Not deployed or funded.\n\nHere is how the books work.',
        asset: '05-seven-compartments.png',
        alt: 'OMERTÀ Market. The city has a treasury. A diagram of the seven capital compartments. Built and tested; not deployed.'
      },
      {
        text: '2/8 Seven compartments. Seven jobs.\n\nCore. Lower Cushion. Garrison. Upper Cushion. Desk. War Chest. Turf.\n\nLiquidity, trading inventory and idle reserves each have a place in the books. Each operates within fixed limits.',
        asset: '05-seven-compartments.png',
        alt: 'The seven Market compartments: Core, Lower Cushion, Garrison, Upper Cushion, Desk, War Chest and Turf. Finite capital with distinct roles.'
      },
      {
        text: '3/8 The canonical ETH/OMR pool keeps a 9% base sell fee:\n\n2% developer\n1.6% RWA recipient\n2.4% community\n3% protocol-owned liquidity\n\nThe destination is part of the contract. LP fees are separate.',
        asset: '04-tax-map.png',
        alt: 'Canonical pool base sell fee: 2% developer, 1.6% RWA recipient, 2.4% community and 3% POL, totaling 9%. An additional 0 to 1% sell surge goes to stability. LP fees are separate.'
      },
      {
        text: '4/8 Sell-driven tick pressure can add a 0-1% surge, paid entirely to stability. Pressure decays over time.\n\nThe hook sell fee tops out at 10%, before separate LP fees.\n\nThis is canonical pool policy. It does not tax every OMR venue.'
      },
      {
        text: '5/8 Opening night has a clock.\n\nA finite anti-snipe window can apply a bounded temporary buy fee and an optional quote-size cap per swap.\n\nThe administrator cannot extend the window. Splitting trades remains possible.'
      },
      {
        text: '6/8 The hook settles swaps and records measurements.\n\nCompanion contracts hold capital, manage reserve positions, vest inventory bonds and account for family fees.\n\nEach authority has a defined job. Each balance has an owner.'
      },
      {
        text: '7/8 The city gets something to contest: future funded LP fee rights tied to seasonal Turf.\n\nFamilies can contest those rights. They cannot take the underlying liquidity principal.\n\nThe distinction is written into custody.',
        asset: '08-fee-rights.png',
        alt: 'Family Turf controls future funded LP fee entitlements. Protocol-owned liquidity principal remains outside family control. Historical fees stay with their recorded recipients.'
      },
      {
        text: '8/8 The city has a treasury. The contracts now have to earn their place in it.\n\nMarket is built and tested locally, not deployed or funded. Chain rehearsal, production integration and launch acceptance remain ahead.\n\nFollow the build. @OmertaOnRH'
      }
    ]
  },
  {
    id: '02-reserve-desk',
    title: 'Capital with orders.',
    posts: [
      {
        text: '1/8 Capital with orders.\n\nOMERTÀ Market gives the reserve a finite balance, separate compartments and rules for each move.\n\nThe contracts are built and tested locally. Not deployed or funded.\n\nInside the reserve desk:',
        asset: '05-seven-compartments.png',
        alt: 'OMERTÀ Market. Capital with orders. A diagram of seven ledger compartments. Seven compartments, finite budgets. Built and tested; not deployed.'
      },
      {
        text: '2/8 Core holds two-sided liquidity. Lower Cushion and Garrison commit ETH against OMR selling. Upper Cushion and Desk supply OMR into buying.\n\nWar Chest holds idle reserves. Turf holds a fixed seasonal range.',
        asset: '05-seven-compartments.png',
        alt: 'Seven distinct compartments organize two-sided liquidity, downside ETH inventory, upside OMR inventory, idle reserves and fixed seasonal Turf.'
      },
      {
        text: '3/8 An independent OMERTÀ implementation inspired by Olympus range-bound stability.\n\nSpending is capped. Recovery needs spaced observations and actual War Chest assets.\n\nCooldowns apply. Lifetime deployment limits stay consumed.'
      },
      {
        text: '4/8 A liquidity band has capacity. It can fill, reverse or be removed.\n\nCrossing it does not permanently retire its inventory. A violent market can outrun finite reserves.\n\nThese are trading positions, not a promised price floor.'
      },
      {
        text: '5/8 Inventory bonds sell OMR already held by the contract in exchange for ETH.\n\nDiscounts and sale sizes are bounded. The full OMR entitlement is reserved at purchase.\n\nNo mint authority. No promised sellback.',
        asset: '06-inventory-bonds.png',
        alt: 'Inventory bonds exchange ETH for already funded OMR inventory. The complete entitlement is reserved at purchase and vests over time. No mint authority or sellback guarantee.'
      },
      {
        text: '6/8 Bond notes vest linearly and cannot be transferred.\n\nAlready vested claims remain available if new sales pause, inventory runs out or the oracle becomes unavailable.\n\nThe sale desk can close. Existing claims keep their terms.'
      },
      {
        text: '7/8 Arbitrage uses the solver\'s ETH across two approved pools.\n\nThe atomic cycle must clear its profit threshold after swap fees, before gas. A fixed share goes to the reserve.\n\nThe solver budgets gas separately. Failed attempts can still cost gas.',
        asset: '07-arbitrage.png',
        alt: 'A solver-funded atomic ETH to OMR to ETH cycle through the canonical and an approved alternative pool. A fixed share of realized trading profit, before gas costs, funds the reserve. Failed attempts can cost gas.'
      },
      {
        text: '8/8 The reserve desk has rules for spending, selling inventory and receiving realized arbitrage proceeds.\n\nIt still needs a funded release.\n\nMarket: built and tested locally. Not deployed or funded. No incentives are live from this build. @OmertaOnRH'
      }
    ]
  },
  {
    id: '03-turf-city',
    title: 'Control the Turf.',
    posts: [
      {
        text: '1/8 Control the Turf. Know what comes with it.\n\nOMERTÀ Market gives families rights to future funded LP fees. The liquidity principal stays outside family control.\n\nBuilt and tested locally. Not deployed or funded.',
        asset: '08-fee-rights.png',
        alt: 'OMERTÀ Market. Control the Turf. A diagram of family fee rights and protocol principal. Family fee rights, protocol-owned principal. Built and tested; not deployed.'
      },
      {
        text: '2/8 Turf is a fixed price range for a defined season. Its fee source is bound before that season starts.\n\nThe contract records which family holds the future fee entitlement. A family holds the rights; the protocol retains the principal.',
        asset: '08-fee-rights.png',
        alt: 'Seasonal family fee entitlements are separate from liquidity principal. Families receive only their allocated funded LP fees and cannot remove the underlying capital.'
      },
      {
        text: '3/8 A takeover starts with the books.\n\nThe contracts collect and account for accrued fees before future rights change hands. Historical fees stay with their recorded recipients.\n\nA new flag does not rewrite an old ledger.'
      },
      {
        text: '4/8 A siege has a deadline. Funded fees enter escrow, and the settlement rules divide what is actually there.\n\nThe defender and attacker recipients are frozen for that siege.\n\nNo outcome can award fees the contract never received.'
      },
      {
        text: '5/8 Up to four families can share a Turf entitlement under predetermined shares.\n\nCorridors, fortification and loyalty carry bounded game state. They cannot multiply the fee balance.\n\nPolitics can change the split. It cannot change the sum.'
      },
      {
        text: '6/8 LP commitments put an actual canonical position NFT in custody for a finite term.\n\nThe original depositor can recover it at maturity even if rewards are exhausted, the oracle is stale or new commitments are paused.'
      },
      {
        text: '7/8 Commitment accounting measures sampled useful depth over time, using distinct fresh observations.\n\nRewards require a prefunded campaign and available budget. Raw liquidity alone earns no claim.\n\nA commitment creates no unfunded promise.'
      },
      {
        text: '8/8 The settlement and custody contracts are built and tested locally. Not deployed or funded.\n\nProduction game integration remains ahead; this build activates no new Turf map or incentives.\n\nThe city has a treasury. Every claim needs an entry. @OmertaOnRH'
      }
    ]
  }
];

const standalone = [
  {
    id: 's01-city-treasury',
    text: 'The city has a treasury.\n\nOMERTÀ Market: seven capital compartments, funded inventory bonds and seasonal family fee rights.\n\nBuilt and tested locally. Not deployed or funded.\n\nThe next chapter has a ledger.',
    asset: '05-seven-compartments.png',
    alt: 'The city has a treasury. OMERTÀ Market announcement, with a diagram of the seven capital compartments. Built and tested; not deployed.'
  },
  {
    id: 's02-tax-map',
    text: 'The canonical pool keeps its 9% base sell fee:\n2% developer\n1.6% RWA recipient\n2.4% community\n3% POL\n\nA 0-1% extra sell surge funds stability. LP fees are separate.\n\nOMERTÀ Market is built and tested. Not deployed or funded.',
    asset: '04-tax-map.png',
    alt: 'The 9% canonical base sell fee is split 2% developer, 1.6% RWA recipient, 2.4% community and 3% POL. An additional 0 to 1% sell surge goes to stability. LP fees are separate.'
  },
  {
    id: 's03-reserve-desk',
    text: 'An empty War Chest cannot place an order.\n\nOMERTÀ Market gives reserve operations finite inventory, fixed limits and cooldowns. Recovery requires actual funding.\n\nBuilt and tested locally. Not deployed or funded.',
    asset: '05-seven-compartments.png',
    alt: 'Capital with orders. A diagram representing seven distinct capital compartments and finite budgets. OMERTÀ Market is built and tested, not deployed.'
  },
  {
    id: 's04-inventory-bonds',
    text: 'The bond desk sells what is already in the vault.\n\nETH buys a reserved claim on funded OMR inventory, vesting over time. No mint authority. No promised sellback.\n\nOMERTÀ Market: built and tested locally. Not deployed or funded.',
    asset: '06-inventory-bonds.png',
    alt: 'Inventory bonds sell already funded OMR for ETH, reserve the full entitlement at purchase and release it through linear vesting. No minting or sellback guarantee.'
  },
  {
    id: 's05-arbitrage',
    text: 'Two pools. The solver\'s ETH. One atomic cycle.\n\nOMERTÀ Market routes a fixed share of realized trading profit, before gas, to the reserve. Competition still applies.\n\nBuilt and tested locally. Not deployed or funded.',
    asset: '07-arbitrage.png',
    alt: 'Solver-funded ETH to OMR to ETH arbitrage through two approved pools, with a fixed reserve share of realized trading profit before gas and an on-chain profit threshold.'
  },
  {
    id: 's06-family-turf',
    text: 'A new flag does not rewrite an old ledger.\n\nIn OMERTÀ Market, a Turf takeover changes future funded LP fee rights. Historical fees stay with recorded recipients. Families cannot remove principal.\n\nBuilt and tested. Not deployed or funded.',
    asset: '08-fee-rights.png',
    alt: 'Control the Turf. A diagram of family fee rights and protocol-owned principal. Family fee rights are separate from protocol-owned liquidity principal. Built and tested; not deployed.'
  }
];

export default { threads, standalone };
