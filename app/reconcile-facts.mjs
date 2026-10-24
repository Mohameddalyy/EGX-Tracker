import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {openDb,cairoDate} from './core.mjs';
import {initFacts,storeFacts,factColumns} from './market-facts.mjs';
import {initPreparation,receipt,receiptFor,attempt} from './preparation-store.mjs';
const root=dirname(dirname(fileURLToPath(import.meta.url))),db=openDb(join(root,'data','egx.sqlite'));
const tickers=[...new Set((process.argv.find(x=>x.startsWith('--tickers='))?.slice(10)||'').split(',').filter(Boolean))].sort();
const today=cairoDate(new Date()),component='facts-reconciliation',target=today+':'+tickers.join(',');
try{
 initFacts(db);initPreparation(db);
 if(!tickers.length||tickers.some(t=>!db.prepare('SELECT ticker FROM stocks WHERE ticker=?').get(t)))throw Error('Explicit known tickers required');
 const previous=receiptFor(db,component,target);
 if(previous?.status==='completed'&&!process.argv.includes('--force'))console.log(JSON.stringify({status:'reused',...previous.payload}));
 else{
  const source='https://scanner.tradingview.com/egypt/scan',at=new Date().toISOString(),request={symbols:{tickers:tickers.map(t=>'EGX:'+t)},columns:factColumns};
  const response=await fetch(source,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(30000)}),body=await response.text();
  const dir=join(root,'data','market','facts');mkdirSync(dir,{recursive:true});const path=join(dir,at.replace(/[:.]/g,'-')+'-reconciliation.json');writeFileSync(path,JSON.stringify({source,capturedAt:at,status:response.status,request,body}),{flag:'wx'});
  if(!response.ok)throw Error('Targeted scanner HTTP '+response.status);
  const raw=JSON.parse(body);
  if(!Array.isArray(raw.data)||raw.totalCount!==raw.data.length||raw.data.some(r=>!request.symbols.tickers.includes(r.s)))throw Error('Unexpected targeted scanner response');
  if(raw.data.length)storeFacts(db,raw,factColumns,at);
  const found=tickers.filter(t=>raw.data.some(r=>r.s==='EGX:'+t)),missing=tickers.filter(t=>!found.includes(t));
  for(const ticker of tickers)attempt(db,{ticker,component,target:today,at,status:found.includes(ticker)?'verified':'unavailable',rawPath:path,detail:found.includes(ticker)?'Exact identity/currency validated; provider fundamentals still require primary-source review':'Exact symbol omitted by targeted scanner. Existing snapshots retained with original timestamps; no delisting inference.'});
  const payload={requested:tickers,found,missing,rawPath:path,at,primaryFactsVerified:false};receipt(db,component,target,payload);console.log(JSON.stringify({status:'captured',...payload}));
 }
}catch(e){receipt(db,component,target,{error:e.message},new Date(),'failed');console.error(e.message);process.exitCode=1;}finally{db.close();}
