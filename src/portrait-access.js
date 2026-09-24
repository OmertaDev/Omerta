// A revealed portrait needs the character-creation payment, not a free mint entitlement.
// Only the confirmed fee watcher (or the privileged QA path) writes these receipts.
export async function hasPaidPortraitFee(pool, accountId) {
  if (!accountId) return false;
  const receipts = (await pool.query(
    `SELECT amount_wei, tx_hash FROM fee_payments
      WHERE account_id=$1 AND kind='mint' AND credited=true AND tx_hash IS NOT NULL`,
    [accountId])).rows;
  return receipts.some((r) => /^0x[0-9a-fA-F]{64}$/.test(String(r.tx_hash || ''))
    && /^[1-9][0-9]{0,77}$/.test(String(r.amount_wei || '')) && BigInt(r.amount_wei) > 0n);
}

export async function canRevealPortrait(pool, { row, token }) {
  if (!row) return false;
  // Token provenance wins over the snapshot character and the buyer's wallet. Free-credit NFTs
  // and legacy snapshots cannot bypass payment, nor can a paid buyer unlock an unpaid minter.
  const accountId = token ? token.account_id : (await pool.query(
    'SELECT account_id FROM characters WHERE id=$1', [row.id])).rows[0]?.account_id;
  return hasPaidPortraitFee(pool, accountId);
}

// One neutral image for every locked character. No seed, face, hidden image or trait is sent.
export function unrevealedPortraitSvg() {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="300" height="400" role="img" aria-label="Artwork sealed until the character-creation fee is confirmed">'
    + '<rect width="600" height="800" fill="#0c1112"/><rect x="24" y="24" width="552" height="752" fill="none" stroke="#b69b67" stroke-width="2"/>'
    + '<rect x="35" y="35" width="530" height="730" fill="none" stroke="#534b3b"/>'
    + '<path d="M264 363v-28a36 36 0 0 1 72 0v28m-87 0h102v80H249z" fill="none" stroke="#b69b67" stroke-width="5"/>'
    + '<circle cx="300" cy="395" r="6" fill="#b69b67"/><path d="M300 401v16" stroke="#b69b67" stroke-width="4"/>'
    + '<g text-anchor="middle"><text x="300" y="110" fill="#b69b67" font-family="Georgia,serif" font-size="28" letter-spacing="6">OMERTA</text>'
    + '<text x="300" y="516" fill="#eee4d4" font-family="Georgia,serif" font-size="25" letter-spacing="3">ARTWORK SEALED</text>'
    + '<text x="300" y="555" fill="#bcb4a3" font-family="sans-serif" font-size="16">Revealed after the character-creation</text>'
    + '<text x="300" y="580" fill="#bcb4a3" font-family="sans-serif" font-size="16">fee is confirmed.</text></g></svg>';
}
