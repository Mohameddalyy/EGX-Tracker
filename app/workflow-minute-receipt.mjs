import {readFileSync,realpathSync} from 'node:fs';
import {resolve,relative,isAbsolute} from 'node:path';
import {minuteObservationQuality} from './minute-observation.mjs';
// Child exit/status alone never establishes complete requested observation coverage.
export function verifyMinuteReceipt(root,result,requested,startedAt){
 const fail=message=>({...result,status:'partial',incident:'INCOMPLETE_MINUTE_RECEIPT',message,fetched:0,tradeAuthorization:false});
 try{
  if(!Array.isArray(requested)||!requested.length||new Set(requested).size!==requested.length)throw Error('Unique explicit minute targets required');
  if(result.observationOnly!==true||result.tradeAuthorization!==false||result.restored!==true||result.accepted!==null)throw Error('Observation-only restored receipt required');
  if(!Array.isArray(result.tickers)||result.tickers.length!==requested.length||new Set(result.tickers).size!==requested.length||requested.some(t=>!result.tickers.includes(t)))throw Error('Receipt omits or substitutes requested tickers');
  const path=realpathSync(resolve(root,result.path)),rel=relative(realpathSync(resolve(root,'data/operations/minute-observations')),path);if(!rel||rel.startsWith('..')||isAbsolute(rel))throw Error('Capture outside observation store');
  const capture=JSON.parse(readFileSync(path,'utf8'));
  if(capture.restored!==true||!Array.isArray(capture.errors)||capture.errors.length||!Array.isArray(capture.stocks)||capture.stocks.length!==requested.length||new Set(capture.stocks.map(s=>s.ticker)).size!==requested.length)throw Error('Missing/duplicate capture or provider errors');
  const quality=capture.stocks.map(s=>{
   if(!requested.includes(s.ticker)||!/^EGX(?:_DLY)?:/.test(s.symbol||'')||s.symbol?.split(':').at(-1)!==s.ticker||s.resolution!=='1'||s.chartType!==1||s.loading===true||!Number.isFinite(Date.parse(startedAt))||Date.parse(s.capturedAt)<Date.parse(startedAt)||Date.parse(s.capturedAt)>Date.now())throw Error('Capture identity, type or invocation time mismatch');
   return {ticker:s.ticker,...minuteObservationQuality(s)};
  });
  if(quality.some(q=>q.status!=='RECENT_CLOSED_OBSERVATION'))return fail('Requested observations are incomplete, stale or unverified');
  return {...result,status:'succeeded',observationQuality:quality,fetched:requested.length,tradeAuthorization:false};
 }catch(e){return fail(e.message);}
}
