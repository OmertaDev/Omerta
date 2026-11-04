import { keccak_256 } from './genesis-deploy-vendor/sha3.js';

const ADDRESS = /^0x[0-9a-f]{40}$/i;
const HASH = /^0x[0-9a-f]{64}$/i;
const NETWORK = '0x1237';
const word = value => BigInt(value).toString(16).padStart(64, '0');
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();

function digest(hex) {
  if (!/^0x(?:[0-9a-f]{2})+$/i.test(hex)) throw Error('Missing bond runtime or invalid receipt data.');
  const bytes = Uint8Array.from(hex.slice(2).match(/../g), pair => parseInt(pair, 16));
  return '0x' + Array.from(keccak_256(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function verifyWallet(provider, pin, buyer) {
  const accounts = await provider.request({ method: 'eth_accounts' });
  const chain = await provider.request({ method: 'eth_chainId' });
  if (!ADDRESS.test(buyer) || !same(accounts?.[0], buyer) || BigInt(chain) !== 4663n)
    throw Error('Select your linked wallet on Robinhood Chain.');
  if (!ADDRESS.test(pin?.address) || !HASH.test(pin?.runtimeCodeHash)) throw Error('Missing reviewed bond deployment.');
  const code = await provider.request({method:'eth_getCode', params:[pin.address,'latest']});
  if (!same(digest(code), pin.runtimeCodeHash)) throw Error('Wallet RPC returned an unrecognized bond contract.');
}

export function validateBondQuote(quote, pin, buyer, principalEth) {
  const intent = quote?.intent;
  if (!pin || intent?.principalEth !== principalEth || !same(intent?.buyer,buyer) || !ADDRESS.test(buyer)
    || intent.chainId !== 4663 || !ADDRESS.test(intent.to) || !same(intent.to,pin.address)
    || !HASH.test(intent.nonce) || !/^([1-9][0-9]*)$/.test(intent.epoch) || !/^([1-9][0-9]*)$/.test(intent.minimumOmr)
    || !Number.isSafeInteger(intent.deadline) || intent.deadline <= Date.now()/1000
    || !/^(0|[1-9][0-9]*)(\.[0-9]{1,18})?$/.test(principalEth))
    throw Error('Wallet or purchase terms changed. Request a fresh quote.');
  const id = digest('0x'+word(4663)+word(pin.address)+word(buyer)+intent.nonce.slice(2));
  if (!same(id,quote.noteId)) throw Error('The note ID does not match the wallet and purchase nonce.');
}

const receiptKey = (pin,buyer) => 'omerta.inventory-bonds.4663.'+pin.address.toLowerCase()+'.'+buyer.toLowerCase();
export function savedBondIds(storage, pin, buyer) {
  const ids = JSON.parse(storage.getItem(receiptKey(pin,buyer)) || '[]');
  if (!Array.isArray(ids) || !ids.every(id => typeof id === 'string' && HASH.test(id))) throw Error('Unable to read saved bond IDs.');
  return ids;
}

export async function submitPurchase(provider, pin, quote, tx, buyer, storage) {
  const intent = quote.intent;
  validateBondQuote(quote,pin,buyer,intent.principalEth);
  const [whole, fraction=''] = intent.principalEth.split('.');
  const value = '0x'+(BigInt(whole)*10n**18n + BigInt(fraction.padEnd(18,'0'))).toString(16);
  const data = '0x811fcacc'+word(intent.epoch)+word(intent.minimumOmr)+word(intent.deadline)+intent.nonce.slice(2);
  if (Object.keys(intent).some(key => tx.intent?.[key] !== intent[key])
    || !same(tx.noteId,quote.noteId) || tx.value !== value || !same(data,tx.data))
    throw Error('The prepared payment differs from the displayed quote.');
  await verifyWallet(provider,pin,buyer);
  const call = { from:buyer, to:pin.address, data, value };
  const result = await provider.request({method:'eth_call',params:[call,'latest']});
  if (!/^0x[0-9a-f]{128}$/i.test(result) || !same(result.slice(0,66),quote.noteId)
    || BigInt('0x'+result.slice(66)) < BigInt(intent.minimumOmr)) throw Error('The wallet could not verify this purchase.');
  // Save before sending. A closed tab or lost wallet response must not lose the note ID.
  const ids = savedBondIds(storage,pin,buyer);
  if (!ids.includes(quote.noteId)) storage.setItem(receiptKey(pin,buyer), JSON.stringify([...ids,quote.noteId]));
  await verifyWallet(provider,pin,buyer);
  if (Date.now() >= intent.deadline*1000) throw Error('The quote expired. Request a new one.');
  return provider.request({method:'eth_sendTransaction',params:[{...call,chainId:NETWORK}]});
}

export async function readBondNote(provider, pin, buyer, id) {
  if (!HASH.test(id)) throw Error('Enter the 32-byte note ID from your purchase receipt.');
  await verifyWallet(provider,pin,buyer);
  const call = data => provider.request({method:'eth_call',params:[{to:pin.address,data:data+id.slice(2)},'latest']});
  const [note, claimable] = await Promise.all([call('0x85de26b7'),call('0x9b58e0a1')]);
  if (!/^0x[0-9a-f]{320}$/i.test(note) || !HASH.test(claimable) || !same('0x'+note.slice(26,66),buyer))
    throw Error('No confirmed note for this wallet and ID. Check the purchase receipt.');
  const words = note.slice(2).match(/.{64}/g).map(part => BigInt('0x'+part));
  return { end:Number(words[2]), amount:words[3], claimed:words[4], claimable:BigInt(claimable) };
}

export async function submitClaim(provider,pin,buyer,id) {
  const state = await readBondNote(provider,pin,buyer,id);
  if (!state.claimable) throw Error('There is no vested OMR to claim yet.');
  const call = {from:buyer,to:pin.address,data:'0xbd66528a'+id.slice(2),value:'0x0'};
  const simulated = await provider.request({method:'eth_call',params:[call,'latest']});
  if (!HASH.test(simulated) || !BigInt(simulated)) throw Error('The wallet could not verify a vested claim.');
  await verifyWallet(provider,pin,buyer);
  return provider.request({method:'eth_sendTransaction',params:[{...call,chainId:NETWORK}]});
}
