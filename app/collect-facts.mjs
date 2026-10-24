import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {dirname,join} from 'node:path';import {fileURLToPath} from 'node:url';
import {openDb,cairoDate} from './core.mjs';import {initMarket,importCatalog} from './market.mjs';import {initFacts,storeFacts,factColumns} from './market-facts.mjs';
import {initPreparation,receipt,receiptFor} from './preparation-store.mjs';
const root=dirname(dirname(fileURLToPath(import.meta.url))),db=openDb(process.env.EGX_DATABASE||join(root,'data','egx.sqlite'));initMarket(db);initFacts(db);initPreparation(db);
const source='https://scanner.tradingview.com/egypt/scan',today=cairoDate(new Date()),dir=join(root,'data','market','facts');mkdirSync(dir,{recursive:true});
async function scan(body){const r=await fetch(source,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('TradingView facts HTTP '+r.status);return r.json();}
try{
 importCatalog(db,JSON.parse(readFileSync(join(root,'data','market','catalog.json'),'utf8')));
 const steps=[];for(const kind of ['stocks','benchmarks']){
 const previous=receiptFor(db,'facts-'+kind,today);if(previous?.status==='completed'&&!process.argv.includes('--force')){steps.push({kind,status:'reused',...previous.payload});continue;}
 const columns=kind==='stocks'?factColumns:['name','type','close','Perf.1M','Perf.3M','Perf.6M','Perf.Y'],at=new Date().toISOString();
 try{const raw=await scan(kind==='stocks'?{filter:[{left:'exchange',operation:'equal',right:'EGX'},{left:'type',operation:'equal',right:'stock'}],columns,range:[0,2000]}:{symbols:{tickers:['EGX:EGX30','EGX:EGX70EWI']},columns});
 const path=join(dir,at.replace(/[:.]/g,'-')+'-'+kind+'.json');writeFileSync(path,JSON.stringify({source,capturedAt:at,columns,raw}),{flag:'wx'});
 const count=storeFacts(db,raw,columns,at,{benchmarks:kind==='benchmarks'});
 const missing=kind==='stocks'?db.prepare('SELECT ticker FROM market_catalog').all().filter(x=>!raw.data.some(r=>r.s==='EGX:'+x.ticker)).map(x=>x.ticker):[];
 const payload={count,capturedAt:at,missingFromResponse:missing,rawPath:path};receipt(db,'facts-'+kind,today,payload);steps.push({kind,status:'captured',...payload});
 }catch(e){receipt(db,'facts-'+kind,today,{error:e.message},new Date(),'failed');steps.push({kind,status:'failed',error:e.message});process.exitCode=1;}
 }console.log(JSON.stringify({status:process.exitCode?'partial':'completed',steps,note:'Missing symbols retained. Provider snapshot is not primary financial or news verification.'}));
}finally{db.close();}

