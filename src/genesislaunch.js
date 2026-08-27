import { GameError } from './game.js';

export const GENESIS_PHASES = Object.freeze([
  'legacy',
  'prepare',
  'auction',
  'migration',
  'oracle_warmup',
  'live',
  'failed',
]);

const OPEN_PHASES = new Set(['legacy', 'live']);
const EXISTING_DESK_FILL_PHASES = new Set(['legacy', 'prepare', 'live']);

export function genesisLaunchPhase(env = process.env) {
  // Keep the live process read explicit so the repository's env-classification drift test can prove
  // this operational interlock is classified, while injected test/config environments remain usable.
  const configured = env === process.env ? process.env.GENESIS_LAUNCH_PHASE : env.GENESIS_LAUNCH_PHASE;
  const phase = String(configured || 'legacy').trim().toLowerCase();
  if (!GENESIS_PHASES.includes(phase)) {
    throw new GameError(
      'launch_config',
      `GENESIS_LAUNCH_PHASE must be one of: ${GENESIS_PHASES.join(', ')}.`,
    );
  }
  return phase;
}

export function genesisLaunchStatus(env = process.env) {
  const phase = genesisLaunchPhase(env);
  const open = OPEN_PHASES.has(phase);
  return {
    phase,
    genesisActive: !open,
    deskAuctionsOpen: open,
    existingDeskFillsOpen: EXISTING_DESK_FILL_PHASES.has(phase),
    bondOfferingsOpen: open,
    bondQuotesOpen: open,
    claimPolicy: phase === 'legacy'
      ? 'legacy'
      : 'CCA claims unlock at the published on-chain claimBlock; the server cannot accelerate it.',
    note: phase === 'legacy'
      ? 'Genesis lifecycle gates are not armed.'
      : phase === 'live'
        ? 'Canonical liquidity and its oracle are live; normal Desk and bond operations may resume.'
        : 'Genesis is isolated: no new Desk auction, bond offering, or bond quote may open.',
  };
}

export function assertGenesisBondsOpen(env = process.env) {
  const status = genesisLaunchStatus(env);
  if (!status.bondQuotesOpen) {
    throw new GameError(
      'genesis_launch',
      `Reserve bonds are closed during genesis phase "${status.phase}"; they reopen only after canonical-pool oracle warm-up.`,
    );
  }
  return status;
}

export function assertExistingDeskFillOpen(env = process.env) {
  const status = genesisLaunchStatus(env);
  if (!status.existingDeskFillsOpen) {
    throw new GameError(
      'genesis_launch',
      `The Desk is closed during genesis phase "${status.phase}".`,
    );
  }
  return status;
}
