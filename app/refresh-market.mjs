// Bulk data work stays outside model context. Logs remain local; stdout is compact.
import {spawnSync} from 'node:child_process';import {readFileSync,mkdirSync,openSync,closeSync} from 'node:fs';import {join,dirname} from 'node:path';import {fileURLToPath} from 'node:url';import {openDb,cairoDate} from './core.mjs';import {marketBusy} from './market.mjs';
import {initPreparation,receiptFor} from './preparation-store.mjs';
const root=dirname(dirname(fileURLToPath(import.meta.url))),db=openDb(join(root,'data','egx.sqlite')),now=new Date(),today=cairoDate(now),dir=join(root,'data','market','refreshes');mkdirSync(dir,{recursive:true});
const logPath=join(dir,now.toISOString().replace(/[:.]/g,'-')+'.log'),fd=openSync(logPath,'a'),steps=[];
initPreparation(db);
function run(file,args=[]){const r=spawnSync(process.execPath,[join(root,'app',file),...args],{cwd:root,windowsHide:true,stdio:['ignore',fd,fd],env:process.env});steps.push({step:file,status:r.status===0?'completed':'failed'});if(r.error||r.status!==0)throw Error(file+' failed; inspect '+logPath);}
try{
 if(marketBusy(db))throw Error('Existing chart importer owns the refresh; resume after it finishes');
 let catalog;try{catalog=JSON.parse(readFileSync(join(root,'data','market','catalog.json'),'utf8'));}catch{}
 const sunday=new Date(today+'T12:00Z').getUTCDay()===0;
 if(!catalog||!Number.isFinite(Date.parse(catalog.retrievedAt))||+now-Date.parse(catalog.retrievedAt)>7*86400000||(sunday&&cairoDate(new Date(catalog.retrievedAt))!==today))run('discover-market.mjs');else steps.push({step:'catalog',status:'reused',capturedAt:catalog.retrievedAt});
 const facts=['facts-stocks','facts-benchmarks'].map(c=>receiptFor(db,c,today));
 if(facts.some(x=>x?.status!=='completed'))run('collect-facts.mjs');else steps.push({step:'facts',status:'reused',note:'Successful component receipts; absent symbols remain reconciliation gaps, not a repeat-download trigger'});
 const missing=receiptFor(db,'facts-stocks',today)?.payload?.missingFromResponse||[];
 if(missing.length)run('reconcile-facts.mjs',['--tickers='+missing.join(',')]);
 run('import-market.mjs',[sunday?'--all':'--known','--due']);
 run('prepare-data.mjs');
 const history=db.prepare('SELECT total,done,success,failed,status FROM market_jobs ORDER BY id DESC LIMIT 1').get();
 console.log(JSON.stringify({status:history?.status==='completed'?'completed':'partial',steps,history,logPath,note:'Preparation preserves all fields and gaps. Completion is not investment eligibility, news clearance or paper activation.'}));
}catch(e){console.log(JSON.stringify({status:'blocked',reason:e.message,steps,logPath}));process.exitCode=1;}finally{closeSync(fd);db.close();}
