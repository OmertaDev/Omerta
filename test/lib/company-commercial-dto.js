import assert from 'node:assert/strict';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { COMPANY_COMMERCIAL_CONTRACTS as contracts, COMPANY_COMMERCIAL_SCHEMAS as schemas } from '../../src/company-commercial-contracts.js';
const ajv=new Ajv({strict:false,allErrors:true});addFormats(ajv);
const compile=s=>ajv.compile({...s,components:{schemas}});
const response=Object.fromEntries(Object.entries(contracts).map(([k,v])=>[k,compile(v.responseSchema)]));
const request=Object.fromEntries(Object.entries(contracts).filter(([,v])=>v.requestSchema).map(([k,v])=>[k,compile(v.requestSchema)]));
export function installCommercialContractProof(app){
 const seen=new Set(),inject=app.inject.bind(app),close=app.close.bind(app);
 app.inject=async options=>{const r=await inject(options),method=(options.method||'GET').toUpperCase(),url=(options.url||'/').split('?')[0],route=Object.keys(contracts).find(k=>new RegExp('^'+k.replace(/:[A-Za-z]+/g,'[^/]+')+'$').test(method+' '+url));
  if(route&&r.statusCode===200){if(options.payload!==undefined&&request[route])assert(request[route](options.payload),route+' request '+JSON.stringify(request[route].errors));assert(response[route](r.json()),route+' response '+JSON.stringify(response[route].errors));seen.add(route);}return r;
 };
 app.close=async()=>{console.log(JSON.stringify({commercialDtoSuccesses:[...seen].sort()}));return close();};return {seen,response,request};
}
