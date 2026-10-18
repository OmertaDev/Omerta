import crypto from 'node:crypto';
const normalize=text=>text.replace(/\r\n?/g,'\n');
const freeze=p=>Object.freeze({...p,extraBindings:Object.freeze(p.extraBindings),recordCheck:p.recordCheck?Object.freeze(p.recordCheck):null,terms:Object.freeze(p.terms.map(Object.freeze)),sections:Object.freeze(p.sections.map(s=>Object.freeze({...s,queries:Object.freeze(s.queries),anchors:Object.freeze(s.anchors)})))});
export const FINAL_SERVICES_STRUCTURAL_CHECKS=Object.freeze([
  {
    "check": "syndicated loan canonical facility provenance",
    "file": "src/syndicatedloans.js",
    "fn": "collectSyndicatedLoanIssues",
    "why": "original facility, account consent and canonical loan/journal provenance; ordinary loan cash is reconciled separately",
    "push": "push('syndicated loan canonical facility provenance',syndicatedIssues.length,0,0,{issues:syndicatedIssues});",
    "sha256": "11d8d7a58e86a0de1881c42cd1b055e07f31dd9dd70ea5995c6b8235e5e6a7ff",
    "revision": "84499ed6242ab569667802dacb2d5c17612e3c33",
    "blob": "3a63de501ec553bb10d1904018cf2d7d643dce63"
  },
  {
    "check": "equipment collateral canonical loan and custody history",
    "file": "src/collaterallending-invariants.js",
    "fn": "collectCollateralLendingIssues",
    "why": "original canonical debt terminal receipt and existing UID escrow custody; no independent reserve cash",
    "push": "push('equipment collateral canonical loan and custody history', collateralIssues.length, 0, 0, { issues: collateralIssues });",
    "sha256": "9891e8296d511061b13f6a3dd9d4590ba2d7313e61c529af8b1f5a002c8a2b2a",
    "revision": "84499ed6242ab569667802dacb2d5c17612e3c33",
    "blob": "31cd26baac0f4b307977fd3534567866db3c1e93"
  },
  {
    "check": "production booking canonical history",
    "file": "src/productionbooking-invariants.js",
    "fn": "productionBookingAccounting",
    "why": "original commission, slot, source, ACK and outcome history; dedicated booking reserve cash remains reconciled",
    "push": "push('production booking canonical history',bookingBooks.issues.length,0,0,{issues:bookingBooks.issues});",
    "sha256": "02e525e9e6b98a41e702ba402863067d7a2df1f8d63663d0697a7317029908d4",
    "revision": "84499ed6242ab569667802dacb2d5c17612e3c33",
    "blob": "e089570990a656e9adf448b72751c12bbde5471b"
  },
  {
    "check": "protection contracts canonical history",
    "file": "src/protectioncontracts.js",
    "fn": "protectionContractAccounting",
    "why": "original protection source, UID handoff and complete reserve/release/refund references; dedicated protection reserve cash remains reconciled",
    "push": "push('protection contracts canonical history', protectionBooks.issues.length, 0, 0, { issues: protectionBooks.issues });",
    "sha256": "2be99b463811db9ce2349ff9ffb5d1670e8df5e81d34565561dd04e4c375ca9f",
    "revision": "84499ed6242ab569667802dacb2d5c17612e3c33",
    "blob": "7625de6b3630b3696e7d32bf5315946b8950207b"
  }
].map(Object.freeze));
export const FINAL_SERVICES_HELPER_PROFILES=Object.freeze([
  {
    "file": "src/performanceemployment.js",
    "fn": "performanceEmploymentInvariant",
    "check": "performance employment funded bonus escrow",
    "import": "import {performanceEmploymentInvariant} from './performanceemployment.js';",
    "call": "const performance=await performanceEmploymentInvariant(pool);",
    "push": "push('performance employment funded bonus escrow',performance.actual,performance.expected,0);",
    "extraBindings": [],
    "sections": [
      {
        "start": "export async function performanceEmploymentInvariant(c){",
        "end": "export async function inspectPerformanceEmploymentDepotHistory(c,depotId){",
        "queries": [
          "SELECT COALESCE(SUM(escrow_cash),0) AS n FROM performance_employment_contracts",
          "SELECT COALESCE(SUM(amount),0) AS n FROM transactions WHERE currency='cash' AND character_id IS NOT NULL AND reason IN ('performance_employment:reserve','performance_employment:bonus','performance_employment:refund')",
          "SELECT COALESCE(SUM(amount),0) AS n FROM transactions WHERE currency='cash' AND character_id IS NULL AND reason IN ('death:performance_employment','performance_employment:estate:loot')"
        ],
        "anchors": [
          "s('performance_employment:bonus')!==paid",
          "s('performance_employment:refund')!==Number(r.refunded_cash)",
          "-s('death:performance_employment')!==Number(r.burned_cash)",
          "-s('performance_employment:estate:loot')!==Number(r.looted_cash)",
          "Number(r.total_cash)!==Number(r.escrow_cash)+paid+Number(r.refunded_cash)+Number(r.burned_cash)+Number(r.looted_cash)",
          "return{actual:reserve,expected:-transfers+losses,issues,ok:reserve===-transfers+losses&&!issues.length};"
        ]
      }
    ],
    "terms": [
      [
        "performance_employment:reserve",
        0,
        1
      ],
      [
        "performance_employment:bonus",
        0,
        1
      ],
      [
        "performance_employment:refund",
        0,
        1
      ],
      [
        "death:performance_employment",
        0,
        2
      ],
      [
        "performance_employment:estate:loot",
        0,
        2
      ]
    ],
    "sha256": "b0e7fdbeb0fd518869a04fb66d1f50e652127e7dbd1470a87d86bd2cbbd98328",
    "revision": "84499ed6242ab569667802dacb2d5c17612e3c33",
    "blob": "3009c70ab014de6fe7e021a22f55269cd9428dfc"
  },
  {
    "file": "src/performanceemployment.js",
    "fn": "performanceEmploymentInvariant",
    "check": "performance employment actual outcome provenance",
    "import": "import {performanceEmploymentInvariant} from './performanceemployment.js';",
    "call": "const performance=await performanceEmploymentInvariant(pool);",
    "push": "push('performance employment actual outcome provenance',performance.issues.length,0,0,{issues:performance.issues});",
    "extraBindings": [
      "push('performance employment funded bonus escrow',performance.actual,performance.expected,0);"
    ],
    "sections": [
      {
        "start": "export async function performanceEmploymentInvariant(c){",
        "end": "export async function inspectPerformanceEmploymentDepotHistory(c,depotId){",
        "queries": [
          "SELECT COALESCE(SUM(escrow_cash),0) AS n FROM performance_employment_contracts",
          "SELECT COALESCE(SUM(amount),0) AS n FROM transactions WHERE currency='cash' AND character_id IS NOT NULL AND reason IN ('performance_employment:reserve','performance_employment:bonus','performance_employment:refund')",
          "SELECT COALESCE(SUM(amount),0) AS n FROM transactions WHERE currency='cash' AND character_id IS NULL AND reason IN ('death:performance_employment','performance_employment:estate:loot')"
        ],
        "anchors": [
          "s('performance_employment:bonus')!==paid",
          "s('performance_employment:refund')!==Number(r.refunded_cash)",
          "-s('death:performance_employment')!==Number(r.burned_cash)",
          "-s('performance_employment:estate:loot')!==Number(r.looted_cash)",
          "Number(r.total_cash)!==Number(r.escrow_cash)+paid+Number(r.refunded_cash)+Number(r.burned_cash)+Number(r.looted_cash)",
          "return{actual:reserve,expected:-transfers+losses,issues,ok:reserve===-transfers+losses&&!issues.length};"
        ]
      }
    ],
    "terms": [
      [
        "performance_employment:reserve",
        0,
        1
      ],
      [
        "performance_employment:bonus",
        0,
        1
      ],
      [
        "performance_employment:refund",
        0,
        1
      ],
      [
        "death:performance_employment",
        0,
        2
      ],
      [
        "performance_employment:estate:loot",
        0,
        2
      ]
    ],
    "sha256": "b0e7fdbeb0fd518869a04fb66d1f50e652127e7dbd1470a87d86bd2cbbd98328",
    "revision": "84499ed6242ab569667802dacb2d5c17612e3c33",
    "blob": "3009c70ab014de6fe7e021a22f55269cd9428dfc"
  },
  {
    "file": "src/coverage-mutual-invariants.js",
    "fn": "coverageMutualAccounting",
    "check": "coverage mutual original reserves",
    "import": "import { coverageMutualAccounting } from './coverage-mutual-invariants.js';",
    "call": "const mutual = await coverageMutualAccounting(pool);",
    "push": "push('coverage mutual original reserves', mutual.reserve, -mutual.ledgerDelta, 0);",
    "extraBindings": [],
    "sections": [
      {
        "start": "export async function coverageMutualAccounting(c) {",
        "end": null,
        "queries": [
          "SELECT id,character_id,account_id,currency,amount,reason,counterparty FROM transactions WHERE reason LIKE 'coverage_mutual:%' ORDER BY id"
        ],
        "anchors": [
          "&& Number(tx.amount) === amount && tx.reason === reason && tx.counterparty === poolId, 'mutual_journal_source'); bound.add(txId);",
          "journal(position.contribution_id, originals[at], accounts[at], -Number(position.contribution_cash), 'coverage_mutual:contribute', p.id);",
          "journal(claim.payout_id, claim.member_character, claim.member_account, Number(claim.payout_cash), 'coverage_mutual:payout', p.id);",
          "journal(position.refund_id, originals[at], accounts[at], Number(position.refunded_cash), 'coverage_mutual:refund', p.id);",
          "for (const t of journals) if (!bound.has(t.id)) issues.push({ reason: 'mutual_unbound_journal', transactionId: t.id });",
          "reserve + ledgerDelta !== 0",
          "return { reserve, ledgerDelta, issues };"
        ]
      }
    ],
    "terms": [
      [
        "coverage_mutual:contribute",
        0,
        0
      ],
      [
        "coverage_mutual:payout",
        0,
        0
      ],
      [
        "coverage_mutual:refund",
        0,
        0
      ]
    ],
    "sha256": "a9f4e974b85c42cecc258ad22429097a4204d5cf19d6cf834c953cfcbd64e1d5",
    "revision": "84499ed6242ab569667802dacb2d5c17612e3c33",
    "blob": "bba0be5e1d083af95f1778af586d91ff49379cbd"
  },
  {
    "file": "src/coverage-mutual-invariants.js",
    "fn": "coverageMutualAccounting",
    "check": "coverage mutual canonical equipment losses",
    "import": "import { coverageMutualAccounting } from './coverage-mutual-invariants.js';",
    "call": "const mutual = await coverageMutualAccounting(pool);",
    "push": "push('coverage mutual canonical equipment losses', mutual.issues.length, 0, 0, { issues: mutual.issues });",
    "extraBindings": [
      "push('coverage mutual original reserves', mutual.reserve, -mutual.ledgerDelta, 0);"
    ],
    "sections": [
      {
        "start": "export async function coverageMutualAccounting(c) {",
        "end": null,
        "queries": [
          "SELECT id,character_id,account_id,currency,amount,reason,counterparty FROM transactions WHERE reason LIKE 'coverage_mutual:%' ORDER BY id"
        ],
        "anchors": [
          "&& Number(tx.amount) === amount && tx.reason === reason && tx.counterparty === poolId, 'mutual_journal_source'); bound.add(txId);",
          "journal(position.contribution_id, originals[at], accounts[at], -Number(position.contribution_cash), 'coverage_mutual:contribute', p.id);",
          "journal(claim.payout_id, claim.member_character, claim.member_account, Number(claim.payout_cash), 'coverage_mutual:payout', p.id);",
          "journal(position.refund_id, originals[at], accounts[at], Number(position.refunded_cash), 'coverage_mutual:refund', p.id);",
          "for (const t of journals) if (!bound.has(t.id)) issues.push({ reason: 'mutual_unbound_journal', transactionId: t.id });",
          "reserve + ledgerDelta !== 0",
          "return { reserve, ledgerDelta, issues };"
        ]
      }
    ],
    "terms": [
      [
        "coverage_mutual:contribute",
        0,
        0
      ],
      [
        "coverage_mutual:payout",
        0,
        0
      ],
      [
        "coverage_mutual:refund",
        0,
        0
      ]
    ],
    "sha256": "a9f4e974b85c42cecc258ad22429097a4204d5cf19d6cf834c953cfcbd64e1d5",
    "revision": "84499ed6242ab569667802dacb2d5c17612e3c33",
    "blob": "bba0be5e1d083af95f1778af586d91ff49379cbd"
  },
  {
    "file": "src/collateralauction-invariants.js",
    "fn": "collectCollateralAuctionIssues",
    "check": "collateral auction original consents and custody",
    "import": "import { collectCollateralAuctionIssues } from './collateralauction-invariants.js';",
    "call": "const collateralAuctionIssues = await collectCollateralAuctionIssues(pool);",
    "push": "push('collateral auction original consents and custody', collateralAuctionIssues.length, 0, 0, { issues: collateralAuctionIssues });",
    "extraBindings": [],
    "sections": [
      {
        "start": "export async function collectCollateralAuctionIssues(client) {",
        "end": null,
        "queries": [
          "SELECT reason,amount FROM transactions WHERE currency='cash' AND reason IN ('collateral-auction:bid','collateral-auction:refund','collateral-auction:proceeds')"
        ],
        "anchors": [
          "const expected = bids.reduce((sum, b) => sum + (b.state === 'held' ? Number(b.amount) : 0), 0);",
          "const drift = expected + journals.reduce((sum, row) => sum + Number(row.amount), 0);",
          "if (drift !== 0) issues.push({ id: 'cash', reason: 'escrow_conservation', drift });",
          "await journal(client, bid.debit_journal, bid.bidder_character, -Number(bid.amount), 'collateral-auction:bid', auction.id);",
          "await journal(client, bid.refund_journal, bid.bidder_character, Number(bid.amount), 'collateral-auction:refund', auction.id);",
          "await journal(client, auction.proceeds_journal, a.borrower_character, Number(winner.amount), 'collateral-auction:proceeds', auction.id);"
        ]
      },
      {
        "start": "async function journal(client, journalId, character, amount, reason, counterparty) {",
        "end": "export async function collectCollateralAuctionIssues(client) {",
        "queries": [
          "SELECT * FROM transactions WHERE id=$1"
        ],
        "anchors": [
          "if (!row || row.currency !== 'cash' || row.character_id !== character || row.account_id !== null",
          "|| Number(row.amount) !== amount || row.reason !== reason || row.counterparty !== counterparty) fail('cash_journal');"
        ]
      }
    ],
    "terms": [
      [
        "collateral-auction:bid",
        0,
        0
      ],
      [
        "collateral-auction:refund",
        0,
        0
      ],
      [
        "collateral-auction:proceeds",
        0,
        0
      ]
    ],
    "sha256": "d73843137ca2ac83804eed8e772f8269eb8070bf176f83ed21752c2b3f3b277f",
    "revision": "84499ed6242ab569667802dacb2d5c17612e3c33",
    "blob": "818acae1bcacc5c2a9a4280692a45185c3ff0b64"
  }
].map(freeze));
export function extractFinalServicesHelperReconciliations(invariants,helpers){
 if(typeof invariants!=='string'||!helpers||typeof helpers!=='object'||Array.isArray(helpers)||Object.keys(helpers).some(file=>!FINAL_SERVICES_HELPER_PROFILES.some(p=>p.file===file)))return [];
 const lines=normalize(invariants).split('\n'),exact=literal=>lines.flatMap((line,i)=>line.trim()===literal?[i]:[]),terms=[];
 for(const p of FINAL_SERVICES_HELPER_PROFILES){const raw=helpers[p.file];if(typeof raw!=='string')continue;const helper=normalize(raw);if(crypto.createHash('sha256').update(helper).digest('hex')!==p.sha256)continue;
 const imports=exact(p.import),calls=exact(p.call),pushes=exact(p.push);if(imports.length!==1||calls.length!==1||pushes.length!==1||imports[0]>=calls[0]||calls[0]>=pushes[0]||p.extraBindings.some(s=>{const rows=exact(s);return rows.length!==1||rows[0]<=calls[0]||rows[0]>=pushes[0];}))continue;
 const sections=p.sections.map(s=>{const start=helper.indexOf(s.start);if(start<0||helper.indexOf(s.start,start+1)!==-1)return null;const end=s.end===null?helper.length:helper.indexOf(s.end,start+s.start.length);if(end<0)return null;const body=helper.slice(start,end);if(s.anchors.some(a=>!body.includes(a))||s.queries.some(q=>{const n=body.indexOf(q);return n<0||body.indexOf(q,n+1)!==-1;}))return null;return {start,body};});if(sections.some(s=>!s))continue;
 for(const [reason,section,query]of p.terms){const s=sections[section],offset=s.start+s.body.indexOf(p.sections[section].queries[query]);terms.push({check:p.check,reason,file:p.file,line:helper.slice(0,offset).split('\n').length,bindingLine:pushes[0]+1,sourceSha256:p.sha256});}
 if(p.recordCheck){const r=p.recordCheck,s=sections[r.section],offset=s.start+s.body.indexOf(p.sections[r.section].queries[r.query]);for(const [reason]of p.terms)terms.push({check:r.check,reason,file:p.file,line:helper.slice(0,offset).split('\n').length,bindingLine:exact(r.push)[0]+1,sourceSha256:p.sha256});}
 }return terms;
}
