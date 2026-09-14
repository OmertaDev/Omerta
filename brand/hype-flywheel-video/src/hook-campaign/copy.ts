export type Shot = {
  kind: 'hero' | 'ledger' | 'flow';
  tag: string;
  title: string;
  detail: string;
  items?: string[];
  note?: string;
  status?: string;
  art?: string;
};
export type Film = {id: string; title: string; art: string; shots: Shot[]; category?: string; status?: string};
export const films: Film[] = [
  {
    id: 'Hook-TheCut', title: 'Every cut has a job', art: 'city',
    shots: [
      {kind: 'hero', tag: '01 / THE HOOK', title: 'EVERY CUT\nHAS A JOB.', detail: 'Meet the new ETH / OMR market design.', note: 'Uniswap v4 · Market V2'},
      {kind: 'ledger', tag: 'SELL FEE / BASE', title: '9%.\nFOUR ORDERS.', detail: 'The canonical pool’s base sell fee.', items: ['2% → Developer', '1.6% → RWA recipient', '2.4% → Community', '3% → Protocol liquidity'], note: 'LP fees are additional. Other pools have their own policies.'},
      {kind: 'flow', tag: 'SELL PRESSURE', title: 'PRESSURE\nLEAVES A TRACE.', detail: 'An extra 0–1% sell charge goes to stability.', items: ['Tick pressure builds', 'Pressure decays over time', 'Buys cannot instantly reset it'], note: 'Surge is a hook charge, separate from LP fees.'},
      {kind: 'flow', tag: 'OPENING PROTECTION', title: 'THE OPENING\nHAS LIMITS.', detail: 'A fixed opening window with a bounded buy fee and optional quote-size cap.', items: ['Set at deployment', 'Window cannot be extended', 'No hook buy tax afterward'], note: 'Per-swap controls; splitting trades remains possible.'},
      {kind: 'ledger', tag: 'MARKET OBSERVATIONS', title: 'READ\nTHE ROOM.', detail: 'Completed epochs record the market’s behavior.', items: ['Mean tick + dispersion', 'ETH turnover + imbalance', 'Minimum active liquidity', 'Liquidity × elapsed time'], note: 'Historical pool measurements; not external fair value.'},
      {kind: 'flow', tag: 'SETTLEMENT', title: 'KEEP\nTHE LINE MOVING.', detail: 'Fees use actual settlement, including partial fills.', items: ['ETH / OMR tracked separately', 'Fixed recipients claim independently', 'Failed recipient ≠ blocked swaps'], note: 'Base rates, recipients and maximum surge are immutable.'},
      {kind: 'hero', tag: 'OMERTÀ / MARKET V2', title: 'THE CITY\nKEEPS ACCOUNTS.', detail: 'Explore Omertà. Follow the build.', note: 'omerta.fun · @OmertaOnRH'},
    ],
  },
  {
    id: 'Hook-TheReserve', title: 'Capital with orders', art: 'reserve',
    shots: [
      {kind: 'hero', tag: '02 / THE RESERVE', title: 'CAPITAL\nWITH ORDERS.', detail: 'Seven compartments. Defined responsibilities.', note: 'Hook-connected stability controller'},
      {kind: 'ledger', tag: 'SEVEN COMPARTMENTS', title: 'EVERY RESERVE\nHAS A ROLE.', detail: 'Separate budgets inside the controller.', items: ['Core', 'Lower Cushion · Garrison', 'Upper Cushion · Desk', 'War Chest · Turf'], note: 'Principal, returned assets and earned fees stay distinct.'},
      {kind: 'flow', tag: 'TWO SIDES', title: 'INVENTORY\nMEETS THE MARKET.', detail: 'Funded ranges respond on either side.', items: ['ETH ranges absorb OMR selling', 'OMR ranges supply into buying', 'Core holds two-sided liquidity'], note: 'Range inventory can reverse before liquidity is removed.'},
      {kind: 'flow', tag: 'BOUNDED RESPONSE', title: 'NO\nBOTTOMLESS VAULT.', detail: 'Finite capacity and cooldowns bound deployment.', items: ['Stress thresholds govern response', 'Spot + liquidity checked', 'Lifetime limits remain consumed'], note: 'A reserve mechanism cannot guarantee a price floor.'},
      {kind: 'flow', tag: 'RECOVERY', title: 'RECOVERY\nMUST BE FUNDED.', detail: 'Spaced healthy observations unlock partial regeneration.', items: ['X healthy samples within Y', 'Idle War Chest assets move', 'Only configured capacity returns'], note: 'A price recovery does not create ETH reserves.'},
      {kind: 'ledger', tag: 'FUNDING + UPKEEP', title: 'PUT FUNDS\nTO WORK.', detail: 'Actual receipts flow into fixed compartments.', items: ['3% POL bucket → Core', 'Surge + bond proceeds → War Chest', 'Arbitrage reserve share → War Chest', 'Keeper simulates bounded jobs'], note: 'At most one new transaction per keeper invocation; gas budgeted.'},
      {kind: 'hero', tag: 'OMERTÀ / MARKET V2', title: 'THE CITY\nHAS A TREASURY.', detail: 'Explore Omertà. Follow the build.', note: 'omerta.fun · @OmertaOnRH'},
    ],
  },
  {
    id: 'Hook-TheCapital', title: 'Terms before trust', art: 'reserve',
    shots: [
      {kind: 'hero', tag: '03 / CAPITAL ROUTES', title: 'TERMS\nBEFORE TRUST.', detail: 'Inventory bonds. Arbitrage. Liquidity commitments.', note: 'Companion contracts connected to the canonical market'},
      {kind: 'flow', tag: 'INVENTORY BONDS', title: 'FUNDED FIRST.\nVESTED OVER TIME.', detail: 'ETH buys existing OMR inventory at a bounded discount.', items: ['Full entitlement reserved', 'Purchase + epoch + lifetime caps', 'Nontransferable notes vest linearly'], note: 'No minting or sellback. Canonical sells still pay the sell fee.'},
      {kind: 'flow', tag: 'ARBITRAGE', title: 'TWO POOLS.\nONE ATOMIC CYCLE.', detail: 'The solver supplies capital for an ETH / OMR cycle.', items: ['Commit binds solver + plan', 'Reveal executes the same plan', 'Minimum realized profit checked'], note: 'Competition and failed-transaction gas costs remain.'},
      {kind: 'ledger', tag: 'ARBITRAGE ACCOUNTING', title: 'COUNT\nTHE ACTUAL CUT.', detail: 'A fixed share of realized trading profit funds the reserve.', items: ['Trading profit is after swap fees', 'Gas is budgeted separately', 'Collateral returns through claims'], note: 'No exclusive arbitrage or MEV-immunity claim.'},
      {kind: 'flow', tag: 'PLAYER COMMITMENTS', title: 'COMMIT\nREAL LIQUIDITY.', detail: 'The vault holds an actual canonical position NFT for a finite term.', items: ['Canonical pool positions only', 'Custody enforces the commitment', 'Independent maturity withdrawal'], note: 'Maturity exit does not require a healthy oracle or reward claim.'},
      {kind: 'flow', tag: 'USEFUL DEPTH', title: 'DEPTH\nHAS TO QUALIFY.', detail: 'Two fresh epochs sample useful liquidity around the reference band.', items: ['Smaller adjacent sample counts', 'Invalid samples break accrual', 'Campaign rewards are prefunded'], note: 'Fixed limits; first-come funds at checkpoint. No promised yield.'},
      {kind: 'hero', tag: 'OMERTÀ / MARKET V2', title: 'READ\nTHE TERMS.', detail: 'Explore Omertà. Follow the build.', note: 'omerta.fun · @OmertaOnRH'},
    ],
  },
  {
    id: 'Hook-TheTurf', title: 'The family has a claim', art: 'turf',
    shots: [
      {kind: 'hero', tag: '04 / FAMILY TURF', title: 'THE FAMILY\nHAS A CLAIM.', detail: 'Seasonal Turf connects family control to funded LP fees.', note: 'Market contracts implemented; production game integration pending'},
      {kind: 'flow', tag: 'SEASONAL TERRITORY', title: 'HOLD TURF.\nCLAIM FEES.', detail: 'Fixed seasonal price slabs define each lane.', items: ['Principal stays with the protocol', 'Families receive funded fee credits', 'New control affects future fees'], note: 'No family authority to withdraw liquidity principal.'},
      {kind: 'ledger', tag: 'SYNDICATES', title: 'FOUR FAMILIES.\nONE AGREEMENT.', detail: 'A Turf split can include up to four families.', items: ['Shares total exactly 100%', 'Treasuries resolve at deposit', 'Existing credits stay with recipients'], note: 'Changing a treasury does not move already credited balances.'},
      {kind: 'flow', tag: 'SIEGES', title: 'CONTEST\nTHE NEXT CHAPTER.', detail: 'Sieges use funded fee escrow and frozen treasury addresses.', items: ['Bounded duration + victory allocation', 'Typed game settlement', 'Replay + revision checks'], note: 'Combat adjudication remains a server responsibility.'},
      {kind: 'flow', tag: 'HISTORICAL OWNERSHIP', title: 'THE OLD CUT\nSTAYS ACCOUNTED.', detail: 'Fees are collected and forwarded before control transitions.', items: ['Ownership changes checkpoint', 'Sieges checkpoint', 'Treasury changes checkpoint'], note: 'Atomic accounting preserves the prior fee entitlement.'},
      {kind: 'ledger', tag: 'CITY STATUS', title: 'BUILD\nYOUR CONNECTIONS.', detail: 'Corridors connect touching ranges with matching owners.', items: ['Corridor status', 'Loyalty status', 'Fortification status'], note: 'Game status does not multiply monetary claims.'},
      {kind: 'hero', tag: 'OMERTÀ / MARKET V2', title: 'CONTROL\nTHE NEXT CHAPTER.', detail: 'Explore Omertà. Follow the build.', note: 'omerta.fun · @OmertaOnRH'},
    ],
  },
];

films.push(
  {
    id: 'Omerta-WorldGraph', title: 'Everything has a history', art: 'city', category: 'WORLD GRAPH',
    status: 'PHASE 1 IMPLEMENTED\nPhase 2A expansion in development.',
    shots: [
      {kind: 'hero', tag: '05 / WORLD GRAPH', title: 'EVERYTHING\nHAS A HISTORY.', detail: 'Materials. Machines. Mysteries. Connected by one graph.', note: 'CORE · AUTOMOTIVE · BELLADONNA'},
      {kind: 'flow', tag: 'CONNECTED CONTENT', title: 'FOLLOW\nTHE CONNECTIONS.', detail: 'A canonical manifest connects materials, recipes, evidence and social gates.', items: ['Sources define what enters', 'Recipes define what changes', 'Dependencies define what opens'], note: 'Graph-defined content; server-validated actions.'},
      {kind: 'flow', tag: 'SALVAGE + CRAFT', title: 'THE WRECK\nIS A BEGINNING.', detail: 'Car salvage feeds conserved materials into declared crafting chains.', items: ['Salvage consumes the car once', 'Crafting consumes required inputs', 'Quality stays in the item ledger'], note: 'Phase 1 is OMR-neutral. Hardened steel has a $300 game-cash sink.'},
      {kind: 'ledger', tag: 'ITEM PROVENANCE', title: 'OBJECTS\nKEEP THEIR STORY.', detail: 'Unique items retain identity and ordered custody history.', items: ['Actual inventory is authoritative', 'Collection status stays separate', 'Retries do not duplicate claims'], note: 'Default inventory is off-chain; NFT export is not live.'},
      {kind: 'flow', tag: 'MYSTERY + CREW', title: 'SOME DOORS\nTAKE A CREW.', detail: 'A character-scoped mystery meets a four-account Crew operation.', items: ['Evidence unlocks dependencies', 'Distinct accounts fill social gates', 'Contributions use operation escrow'], note: 'An heir cannot claim the old character’s active instance.'},
      {kind: 'ledger', tag: 'NEXT / PHASE 2A', title: 'A DEEPER\nMATERIAL WORLD.', detail: 'The expansion is in development.', items: ['Immutable item definitions', 'Provenance-preserving material lots', 'Expanded salvage profiles'], note: 'Planned expansion; not a completed or activated release.'},
      {kind: 'hero', tag: 'OMERTÀ / WORLD GRAPH', title: 'LEAVE\nA TRAIL.', detail: 'Explore Omertà. Follow the build.', note: 'omerta.fun · @OmertaOnRH'},
    ],
  },
  {
    id: 'Omerta-Coordination', title: 'No one has the whole story', art: 'turf', category: 'COORDINATION',
    status: 'PHASES 00–01 IMPLEMENTED\nOpt-in API pilots. Default off.',
    shots: [
      {kind: 'hero', tag: '06 / COORDINATION ENGINE', title: 'NO ONE HAS\nTHE WHOLE STORY.', detail: 'Private progress. Shared evidence. Real dependencies.', note: 'Omerta Coordination Engine'},
      {kind: 'flow', tag: 'THE DEAD LETTER', title: 'TWO LEADS.\nONE CONCLUSION.', detail: 'A private graph runner tracks a bounded investigation.', items: ['Discover the first lead', 'Discover an independent lead', 'Both unlock the conclusion'], note: 'Value-neutral pilot: no inventory, stat or economy changes.'},
      {kind: 'flow', tag: 'THE SPLIT LEDGER', title: 'THE DOCKS\nNEEDS THE FOUNDRY.', detail: 'Two investigators discover original sources in different districts.', items: ['Docks manifest', 'Foundry impression', 'Two accounts unlock the conclusion'], note: 'One account collecting both sources is not independent evidence.'},
      {kind: 'ledger', tag: 'KNOWLEDGE PROVENANCE', title: 'A COPY\nIS NOT A SOURCE.', detail: 'Discoveries retain their original evidence identity.', items: ['Immutable discoveries', 'Player assertions stay distinct', 'Personal reference archives'], note: 'Copies, assertions and archives do not add independent sources.'},
      {kind: 'flow', tag: 'LIVE SHARING PERMISSIONS', title: 'CHOOSE WHO\nKNOWS WHAT.', detail: 'Share deliberately with an account, Crew or Family.', items: ['Current membership checked', 'Permissions rechecked on use', 'Revocation blocks future access'], note: 'The pilots expose JSON APIs; a dedicated graphical console is outside scope.'},
      {kind: 'ledger', tag: 'BUILT / NEXT', title: 'THE FOUNDATION\nCOMES FIRST.', detail: 'Phases 00–01 are implemented for scoped review.', items: ['Private graph progress + safe retries', 'Independent-evidence gates', 'Later: delegation + economic adapters'], note: 'AI generation and mass operations are also planned, not implemented.'},
      {kind: 'hero', tag: 'OMERTÀ / COORDINATION', title: 'CONNECT\nTHE EVIDENCE.', detail: 'Explore Omertà. Follow the build.', note: 'omerta.fun · @OmertaOnRH'},
    ],
  },
);

const fromFilm = (filmIndex: number, shotIndex: number): Shot => ({...films[filmIndex].shots[shotIndex], art: films[filmIndex].art, status: films[filmIndex].status ?? 'IMPLEMENTATION CANDIDATE\nV2 is not deployed or funded.'});
films.unshift({
  id: 'Omerta-ConnectedCity', title: 'The city is connected', art: 'city', category: 'THE CONNECTED CITY',
  status: 'DEVELOPMENT PREVIEW\nAvailability differs by system.',
  shots: [
    {kind: 'hero', tag: 'OMERTÀ / THE NEXT CHAPTER', title: 'THE CITY\nIS CONNECTED.', detail: 'The Hook. The World Graph. The Coordination Engine.', note: 'Three systems. One evolving noir world.'},
    fromFilm(0, 1),
    fromFilm(1, 3),
    {kind: 'ledger', tag: 'MARKET V2 / CAPITAL', title: 'CAPITAL\nHAS TERMS.', detail: 'Funded mechanisms around the canonical market.', items: ['Inventory bonds vest existing OMR', 'Solver-funded arbitrage shares profit', 'NFT commitments measure useful depth'], note: 'Finite inventory and prefunded rewards. No promised yield.', status: 'IMPLEMENTATION CANDIDATE\nV2 is not deployed or funded.'},
    fromFilm(3, 1),
    fromFilm(4, 1),
    fromFilm(4, 2),
    fromFilm(4, 4),
    fromFilm(5, 2),
    fromFilm(5, 3),
    fromFilm(5, 4),
    {kind: 'hero', tag: 'OMERTÀ / FOLLOW THE BUILD', title: 'EVERY ACTION.\nA CONNECTION.', detail: 'Explore the city. Follow its next chapter.', note: 'omerta.fun · @OmertaOnRH'},
  ],
});
