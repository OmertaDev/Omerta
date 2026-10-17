// Closed payment profiles. Selecting one grants no wallet authority and performs no I/O.
import {base, robinhood} from 'viem/chains';

export const WALLET_COMPUTE_BASE_PROFILE = 'base-usdc-v2';
export const WALLET_COMPUTE_ROBINHOOD_PROFILE = 'robinhood-usdg-v1';
const PROFILES = Object.freeze([
  Object.freeze({id:WALLET_COMPUTE_BASE_PROFILE,network:'eip155:8453',chainId:base.id,
    asset:'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',symbol:'USDC',decimals:6,
    name:'USD Coin',version:'2',x402Version:2,signatureHeader:'PAYMENT-SIGNATURE',responseHeader:'PAYMENT-RESPONSE',backdateSeconds:5}),
  // Canonical identity: https://docs.robinhood.com/chain/contracts/ . This is not HOOD.
  Object.freeze({id:WALLET_COMPUTE_ROBINHOOD_PROFILE,network:'eip155:4663',chainId:robinhood.id,
    asset:'0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',symbol:'USDG',decimals:6,
    name:'Global Dollar',version:'1',x402Version:1,signatureHeader:'X-PAYMENT',responseHeader:'X-PAYMENT-RESPONSE',backdateSeconds:60}),
]);

export function walletComputeProfile(id=WALLET_COMPUTE_BASE_PROFILE){
  const profile=PROFILES.find(p=>p.id===id);
  if(!profile){const e=new Error('PAYMENT_PROFILE_UNSUPPORTED');e.code='PAYMENT_PROFILE_UNSUPPORTED';throw e;}
  return profile;
}

export function walletComputeScopeSupported(scope){
  return PROFILES.some(p=>scope.network===p.network&&scope.asset===p.asset.toLowerCase());
}
