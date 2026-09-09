import fs from 'node:fs';
import crypto from 'node:crypto';
const names = ['OMR','OMRStaking','OmertaFees','VoucherClaim','GearVault','StreetDeed','DynastyNFT','StockVault','GenesisOracle','OmertaBond','GenesisProceedsSplitter'];
const decisions = {
  'divide-before-multiply': 'Reviewed arithmetic: OMR splits the rounded tax and assigns the residual to LP, preserving total balance. Bond floors market OMR and discount payout; zero payout is refused and a hard absolute rate plus daily cap bounds issuance. Bounded token-wei rounding does not create an unbacked claim.',
  'missing-zero-check': 'Intentional disabled role: zero OMR minter/StockVault keeper disables that role. Zero allocationSigner enables legacy keeper-only delivery by explicit design; mainnet activation must choose and verify authorization mode.',
  'pragma': 'The executed build uses native Solidity 0.8.26; compatible dependency source ranges are not multiple selected compiler versions.',
  'timestamp': 'Intended deadline, vesting, APY, oracle-expiry and UTC daily-cap boundaries. No randomness is derived; sequencer time and availability remain network assumptions.',
  'low-level-calls': 'Checked native forwarding: failures revert atomic fee/bond accounting under nonReentrant; owner sweep destinations are deliberate. Immutable splitter recipients can permanently reject, retained as a concrete recipient-validation requirement.',
  'reentrancy-benign': 'False positive in GearVault.redeem: OpenZeppelin ERC1155._burn calls _updateWithAcceptanceCheck with to=address(0), whose to != address(0) guard prevents both receiver callbacks. Actual safe-mint callbacks and immediate burns are separately tested.',
  'reentrancy-events': 'Same unreachable burn callback as the GearVault reentrancy-benign diagnostic. _burn cannot call a receiver; the subsequent Redeemed event follows the balance burn.',
  'too-many-digits': 'Fixed metadata/color literals, not arithmetic authority or asset movement.',
  'shadowing-local': 'StreetDeed.tokenIdFor parameter name shadows the ERC721 name() function lexically; keccak256(bytes(name)) uses the supplied string intentionally.',
  'incorrect-equality': 'Zero claimable amount or zero complete token/native balance means no work; unsolicited funds cannot block a positive fixed-balance equality. Pool initialization is the deliberate zero/nonzero discriminator and its upstream authorization/atomicity is reviewed separately.',
  'cyclomatic-complexity': 'Complexity in metadata generation is retained as maintenance cost; signed issuance and custody do not branch on generated JSON.',
  'unused-return': 'Splitter only needs sqrtPriceX96 to distinguish initialized pool; tick, protocol fee and LP fee are unused by that discriminator. It is not a price or liquidity-quality check.'
};
const result = { date:'2026-09-08', inputs:[], diagnostics:[] };
for (const name of names) {
  const input = `output/comprehensive-audit/slither-${name}-full.json`;
  const raw = fs.readFileSync(input), p = JSON.parse(raw);
  if (!p.success) throw Error(`Unsuccessful scan: ${name}`);
  result.inputs.push({path:input,sha256:crypto.createHash('sha256').update(raw).digest('hex')});
  for (const d of p.results.detectors) {
    if (!d.elements.some(e=>e.source_mapping?.filename_relative?.replaceAll('\\','/')===`src/${name}.sol`)) continue;
    if (!decisions[d.check]) throw Error(`Untriaged ${name}: ${d.check}`);
    result.diagnostics.push({sourceRun:name,id:d.id,check:d.check,reportedImpact:d.impact,description:d.description,disposition:decisions[d.check]});
  }
}
const dest='omerta-contracts/audits/2026-09-08-comprehensive/core-static-triage.json';
fs.writeFileSync(dest,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({dest,diagnostics:result.diagnostics.length}));
