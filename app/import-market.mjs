import {historyRefreshState} from './refresh-selection.mjs';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawn,spawnSync} from 'node:child_process';
import {initRecovery,persistOriginal,recoverChart,processAlive} from './chart-recovery.mjs';
import {dirname,join} from 'node:path';import {fileURLToPath} from 'node:url';
import {initDecisions} from './decisions.mjs';
import {openDb,ingest,cairoDate} from './core.mjs';
import {initMarket,importCatalog,marketBusy} from './market.mjs';
import {initPreparation,attempt,repairDue} from './preparation-store.mjs';
const root=dirname(dirname(fileURLToPath(import.meta.url))),db=openDb(process.env.EGX_DATABASE||join(root,'data','egx.sqlite'));
initMarket(db);initDecisions(db);initPreparation(db);initRecovery(db);
async function restoreSaved(){return recoverChart(db,id,async original=>{const r=spawnSync(process.execPath,[join(root,'app','restore-chart.mjs')],{cwd:root,windowsHide:true,encoding:'utf8',timeout:60000,env:{...process.env,EGX_RESTORE_CHART:JSON.stringify(original)}});if(r.error||r.status!==0)throw Error('Recovery helper failed: '+(r.error?.message||r.stderr));return JSON.parse(r.stdout.trim());});}
let id,done=0,success=0,failed=0;const start=Date.now(),deadlineMs=Number(process.env.EGX_IMPORT_DEADLINE_MS||1800000);
try{
 if(!Number.isFinite(deadlineMs)||deadlineMs<1000||deadlineMs>3600000)throw Error('Invalid import deadline');
 if(marketBusy(db))throw Error('A market import is already running; its owner retains the chart');
 if(db.prepare("SELECT child_pid FROM chart_recovery WHERE status!='restored'").all().some(x=>processAlive(x.child_pid)))throw Error('Orphan collector is still alive; wait before recovery');
 importCatalog(db,JSON.parse(readFileSync(join(root,'data','market','catalog.json'),'utf8')));
 const args=process.argv.slice(2),all=args.includes('--all'),known=args.includes('--known'),watchlist=args.includes('--watchlist');
 let rows=db.prepare("SELECT s.*,m.status FROM stocks s JOIN market_catalog m ON m.ticker=s.ticker ORDER BY CASE WHEN EXISTS(SELECT 1 FROM agent_decisions d WHERE d.ticker=s.ticker) THEN 0 WHEN s.watched=1 THEN 1 ELSE 2 END,s.ticker").all();
 if(watchlist)rows=rows.filter(x=>x.watched&&x.active);
 else if(known)rows=rows.filter(x=>x.status==='success'||x.watched&&x.active||db.prepare('SELECT 1 FROM agent_decisions WHERE ticker=?').get(x.ticker));
 else if(!all)rows=rows.filter(x=>x.status!=='success');
 if(args.includes('--failed'))rows=rows.filter(x=>x.status==='failed');
 const selected=args.find(x=>x.startsWith('--tickers='));if(selected){const ts=selected.slice(10).split(',');if(!ts.length||ts.length>20||ts.some(t=>!/^[A-Z][A-Z0-9-]{1,23}$/.test(t)||!db.prepare('SELECT 1 FROM market_catalog WHERE ticker=?').get(t)))throw Error('Select 1 to20 known tickers');rows=db.prepare('SELECT s.*,m.status FROM stocks s JOIN market_catalog m ON m.ticker=s.ticker').all().filter(x=>ts.includes(x.ticker));}
 const now=new Date(),bar=db.prepare('SELECT b.*,c.captured_at,c.finality FROM bars b LEFT JOIN bar_captures c ON c.ticker=b.ticker AND c.day=b.day WHERE b.ticker=? ORDER BY b.day DESC LIMIT 1');
 rows=rows.map(s=>({...s,refresh:historyRefreshState(s,bar.get(s.ticker),now)}));
 const considered=rows.length,reused=args.includes('--due')?rows.filter(s=>!s.refresh.due).length:0;
 if(args.includes('--due'))rows=rows.filter(s=>s.refresh.due);
 const target=s=>s.refresh.expectedSession||cairoDate(now);
 const deferred=rows.filter(s=>!repairDue(db,s.ticker,target(s),now));
 if(!args.includes('--retry-unavailable'))rows=rows.filter(s=>repairDue(db,s.ticker,target(s),now));
 id=Number(db.prepare("INSERT INTO market_jobs(started_at,status,pid,total,message) VALUES(?,'running',?,?,?)").run(now.toISOString(),process.pid,rows.length,reused+' reusable; '+deferred.length+' repair backoffs; '+considered+' considered').lastInsertRowid);
 await restoreSaved();
 const rawDir=join(root,'data','market','history-captures');mkdirSync(rawDir,{recursive:true});
 function record(s,message){
  if(!db.prepare("SELECT 1 FROM market_jobs WHERE id=? AND pid=? AND status='running'").get(id,process.pid))throw Error('Importer lost ownership');
  const at=new Date().toISOString(),path=join(rawDir,id+'-'+s.ticker+'-'+Date.now()+'.json');writeFileSync(path,JSON.stringify(message),{flag:'wx'});
  let error=message.error;
  if(message.type==='stock')try{ingest(db,{retrieved_at:message.retrieved_at,stocks:[message.stock]});}catch(e){error=e.message;}
  const stored=db.prepare('SELECT * FROM stocks WHERE ticker=?').get(s.ticker),state=historyRefreshState(stored,bar.get(s.ticker),new Date());
  const verified=!error&&!state.due;
  if(error){failed++;db.prepare("UPDATE market_catalog SET status='failed',last_error=? WHERE ticker=?").run(error,s.ticker);}else{success++;db.prepare("UPDATE market_catalog SET status='success',last_error=NULL WHERE ticker=?").run(s.ticker);}
  attempt(db,{ticker:s.ticker,target:state.expectedSession||target(s),at,status:verified?'verified':error?'failed':'partial',detail:error||state.reason,rawPath:path,retryMs:state.expectedSession?86400000:3600000});
  done++;db.prepare('UPDATE market_jobs SET done=?,success=?,failed=?,message=? WHERE id=?').run(done,success,failed,s.ticker+': '+(verified?'verified':error?'failed':'partial; retained for repair'),id);
 }
 async function collect(batch){
  const remaining=deadlineMs-(Date.now()-start);if(remaining<1000)throw Error('Whole-job deadline reached; remaining work persisted by due selection');
  await new Promise((resolve,reject)=>{
   const child=spawn(process.execPath,[join(root,'app','collect.mjs')],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe','ipc'],env:{...process.env,EGX_STREAM_PROGRESS:'1',EGX_TICKERS:JSON.stringify(batch.map(x=>x.ticker)),TV_MCP_NO_UPDATE_CHECK:'1'}});
   let buffer='',err='',summary=null,problem=null;const received=new Set();
   child.on('message',m=>{try{if(m.type!=='original')throw Error('Unexpected collector handshake');persistOriginal(db,id,child.pid,m.original);child.send({type:'original-saved'});}catch(e){problem=e;child.kill();}});
   const timer=setTimeout(()=>{problem=Error('Collector deadline; earlier stock checkpoints retained; chart recovery required');child.kill();},Math.min(remaining,Math.max(90000,batch.length*45000)));
   child.stdout.on('data',bytes=>{buffer+=bytes;let n;while((n=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,n).trim();buffer=buffer.slice(n+1);if(!line)continue;try{const m=JSON.parse(line);if(m.type==='summary'){summary=m;continue;}const ticker=m.stock?.ticker||m.ticker,s=batch.find(x=>x.ticker===ticker);if(!s||received.has(ticker))throw Error('Duplicate/unexpected collector stock');record(s,m);received.add(ticker);}catch(e){problem=e;child.kill();}}});
   child.stderr.on('data',b=>{err=(err+b).slice(-2000);});
   child.on('error',e=>{clearTimeout(timer);reject(e);});child.on('close',code=>{clearTimeout(timer);if(problem)return reject(problem);if(code||summary?.error||!summary?.restore?.verified||!summary?.restore?.symbol||!summary?.restore?.timeframe)return reject(Error(summary?.error||err||'Collector/restoration incomplete; saved stocks retained'));if(received.size!==batch.length)return reject(Error('Missing collector results; resume remaining stocks'));db.prepare("UPDATE chart_recovery SET status='restored',child_pid=NULL,updated_at=?,detail='Collector restored original chart' WHERE job_id=?").run(new Date().toISOString(),id);resolve();});
  });
 }
 for(let i=0;i<rows.length;i+=4){await collect(rows.slice(i,i+4));console.log(JSON.stringify({done,total:rows.length,success,failed,reused,deferred:deferred.length}));}
 const partial=db.prepare("SELECT COUNT(*) n FROM preparation_attempts WHERE id IN (SELECT MAX(id) FROM preparation_attempts WHERE component='history' GROUP BY ticker) AND status!='verified'").get().n;
 db.prepare('UPDATE market_jobs SET status=?,finished_at=?,message=? WHERE id=?').run(failed||partial?'completed_with_errors':'completed',new Date().toISOString(),reused+' reused; '+deferred.length+' deferred; '+partial+' unresolved history components',id);
 console.log(JSON.stringify({status:failed||partial?'partial':'completed',done,total:rows.length,success,failed,reused,deferred:deferred.length,unresolved:partial}));
}catch(e){if(id)try{const recovery=await restoreSaved();if(recovery.restored)e.message+='; original chart automatically restored and verified';}catch(recoveryError){e.message+='; '+recoveryError.message;}if(id)db.prepare("UPDATE market_jobs SET status='interrupted',finished_at=?,message=? WHERE id=? AND pid=?").run(new Date().toISOString(),e.message,id,process.pid);console.error(e.message);process.exitCode=1;}finally{db.close();}



