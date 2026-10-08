import { genesisSnapshotRequest } from '../public/genesis-snapshot-rpc.js';

// Only genesis callers opt in; other chain and liquidity transports are unchanged.
export function genesisSnapshotTransport(transport) {
  return options => {
    const resolved = transport(options);
    return { ...resolved, request: genesisSnapshotRequest((args, ...rest) => resolved.request(args, ...rest)) };
  };
}
