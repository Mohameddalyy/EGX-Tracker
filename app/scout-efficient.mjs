import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {join,dirname} from 'node:path';import {fileURLToPath} from 'node:url';
import {openDb} from './core.mjs';import {initMarket,marketBusy} from './market.mjs';import {initScout,runScout} from './scout.mjs';import {needsHistoryRefresh} from './refresh-selection.mjs';import {screenBrief} from './scout-brief.mjs';
import {readinessOverview} from './preparation-status.mjs';
import {pipelineProgress} from './pipeline-progress.mjs';
const root=dirname(dirname(fileURLToPath(import.meta.url))),db=openDb(join(root,'data','egx.sqlite'));initMarket(db);initScout(db);
try{const now=new Date(),mode=process.argv[2]||'plan',active=db.prepare("SELECT ticker,status FROM research_queue WHERE status IN ('pending','researching','awaiting_decision') ORDER BY created_at").all();
 if(mode==='plan'){
 const rows=db.prepare('SELECT s.ticker,s.retrieved_at,s.metadata,m.status FROM stocks s JOIN market_catalog m ON m.ticker=s.ticker').all();const due=rows.filter(s=>needsHistoryRefresh(s,db.prepare('SELECT b.*,c.captured_at,c.finality FROM bars b LEFT JOIN bar_captures c ON c.ticker=b.ticker AND c.day=b.day WHERE b.ticker=? ORDER BY b.day DESC LIMIT 1').get(s.ticker),now));
 const handoffs=pipelineProgress(db,root,now).items.filter(x=>['pending','researching','awaiting_decision'].includes(x.stage)).map(x=>({ticker:x.ticker,stage:x.stage,queueId:x.queueId,reportId:x.reportId,updatedAt:x.updatedAt,overdue:x.overdue,missing:x.unresolved.map(u=>u.area),nextAction:x.nextAction}));
 console.log(JSON.stringify({preparation:readinessOverview(db,{root}),at:now.toISOString(),importBusy:marketBusy(db),catalog:rows.length,historyDue:due.length,reusableToday:rows.length-due.length,unavailableHistory:due.filter(s=>s.status!=='success').length,activeQueue:active,handoffs,catalogCapturedAt:db.prepare('SELECT MAX(source_at) at FROM market_catalog').get().at,factsCapturedAt:db.prepare('SELECT MAX(captured_at) at FROM market_facts').get().at,commands:{facts:'node app/collect-facts.mjs',history:'node app/import-market.mjs --known --due',weeklyRetry:'node app/import-market.mjs --all --due',screen:'node app/scout-efficient.mjs screen'},note:'One bulk snapshot per evening; history once per confirmed session. Resume active queue before requesting new handoffs.'},null,2));
 }else if(mode==='screen'){
 if(marketBusy(db))throw Error('History importer is running; no partial-market screen published');
 const prior=db.prepare('SELECT payload FROM scout_runs ORDER BY at DESC LIMIT 1').get();const policy=JSON.parse(readFileSync(join(root,'research','screening-policy.json'),'utf8'));
 // Existing handoffs take priority. A screen may still update coverage without adding work.
 const run=runScout(db,policy,now,{enqueue:active.length===0}),saved=JSON.parse(db.prepare('SELECT payload FROM scout_runs WHERE id=?').get(run.id).payload),brief=screenBrief(saved.rows,prior?JSON.parse(prior.payload).rows||[]:[]);
 const report={...run,...brief,activeQueue:active,queued:run.queued};const dir=join(root,'data','market','briefs');mkdirSync(dir,{recursive:true});const path=join(dir,run.id+'.json');writeFileSync(path,JSON.stringify(report,null,2),{flag:'wx'});writeFileSync(join(root,'data','market','latest-screen-brief.json'),JSON.stringify({...report,evidencePath:path},null,2));
 console.log(JSON.stringify({...report,changes:brief.changes.slice(0,10),evidencePath:path,omittedChanges:Math.max(0,brief.changes.length-10)},null,2));
 }else throw Error('Use plan or screen');
}finally{db.close();}


