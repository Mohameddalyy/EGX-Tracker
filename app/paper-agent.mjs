import {paperPerformance,performanceMarkdown,recordBenchmarkPoint,researchCoverage} from './paper-performance.mjs';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {join,dirname} from 'node:path';import {fileURLToPath} from 'node:url';import {randomUUID} from 'node:crypto';
import {openDb,cairoDate} from './core.mjs';import {initDecisions} from './decisions.mjs';
import {openPaper,checkPaperRisk,paperState,paperMarks,paperAudit,appendPaper,recordPreflight,preflightReady,proposePaperBuy,ingestPaperMinutes,settlePaper} from './paper.mjs';
const root=dirname(dirname(fileURLToPath(import.meta.url))),config=JSON.parse(readFileSync(join(root,'research','paper-experiment.json'),'utf8')),dir=join(root,'data','experiments',config.id),db=openPaper(join(dir,'paper.sqlite'),config),source=openDb(join(root,'data','egx.sqlite'));initDecisions(source);
try{
 const [command='state',arg]=process.argv.slice(2),now=new Date();
 if(command==='state'||command==='init')console.log(JSON.stringify({...paperState(db,paperMarks(db,source)),preflightReady:preflightReady(db),path:dir}));
 else if(command==='preflight')console.log(JSON.stringify({saved:recordPreflight(db,JSON.parse(readFileSync(arg,'utf8')))}));
 else if(command==='propose')console.log(JSON.stringify(proposePaperBuy(db,source,arg)));
 else if(command==='ingest')console.log(JSON.stringify({observations:ingestPaperMinutes(db,JSON.parse(readFileSync(arg,'utf8')))}));
 else if(command==='settle'){checkPaperRisk(db,paperMarks(db,source));const results=[...settlePaper(db),...settlePaper(db)];console.log(JSON.stringify({results,state:paperState(db,paperMarks(db,source))}));}
 else if(command==='amendment'){if(!arg?.trim())throw Error('Concrete proposal required');console.log(JSON.stringify({saved:appendPaper(db,'amendment',{proposal:arg,applied:false})}));}
 else if(command==='run'){
  if(!['morning','intraday','close','evening'].includes(arg))throw Error('Select a run phase');const day=cairoDate(),id='run-'+day+'-'+arg;if(day<config.startDate||day>config.endDate)throw Error('Outside the experiment week; state/export remain available');
  const prior=db.prepare('SELECT payload FROM ledger WHERE id=?').get(id);if(prior){console.log(JSON.stringify({duplicate:true,run:JSON.parse(prior.payload)}));}
  else{
   checkPaperRisk(db,paperMarks(db,source));settlePaper(db);settlePaper(db);checkPaperRisk(db,paperMarks(db,source));const marks=paperMarks(db,source);let state=paperState(db,marks);const decisions=[],stocks=source.prepare('SELECT s.ticker,s.currency,s.active,s.watched,m.sector FROM stocks s LEFT JOIN market_catalog m ON m.ticker=s.ticker ORDER BY s.ticker').all();
   const latestScreen=source.prepare('SELECT payload FROM scout_runs ORDER BY at DESC LIMIT 1').get();const screened=new Map((latestScreen?JSON.parse(latestScreen.payload).rows:[]).map(r=>[r.ticker,r]));const researchStatus=new Map(source.prepare('SELECT ticker,status FROM research_queue ORDER BY created_at,rowid').all().map(r=>[r.ticker,r.status]));
   const latest=new Map();for(const d of source.prepare('SELECT * FROM agent_decisions ORDER BY created_at,rowid').all())latest.set(d.ticker,d);
   // Rank only by saved screen evidence. The agent cannot invent a new numerical score.
   const score=d=>{try{return JSON.parse(d?.evidence||'{}').screen?.score||0;}catch{return 0;}};
   stocks.sort((a,b)=>score(latest.get(b.ticker))-score(latest.get(a.ticker))||a.ticker.localeCompare(b.ticker));
   for(const s of stocks){const d=latest.get(s.ticker),held=state.positions.some(p=>p.ticker===s.ticker);let action=held?'HOLD':'NO-TRADE',reason=held?'Keep recorded paper position; frozen stop/T1 monitored separately':'No qualifying final Watch decision',order=null;
    if(!held&&!d){const screen=screened.get(s.ticker);reason=researchStatus.has(s.ticker)?'Research pipeline: '+researchStatus.get(s.ticker):!screen?'Not yet screened':!screen.eligible?'Screen excluded: '+screen.exclusions.join('; '):screen.candidate?'Qualified screen; detailed research pending':'Screen reviewed; below current research threshold';}else if(!held&&d?.action!=='Watch')reason='Final decision '+d.action+': '+JSON.parse(d.payload).rationale;
    const existing=state.pending.find(o=>o.ticker===s.ticker);if(existing){action=existing.plan.side;reason='Previously recorded conditional order remains pending';order={id:existing.id,quantity:existing.plan.quantity};}
    else if(!held&&d?.action==='Watch'&&['morning','intraday'].includes(arg)){try{order=proposePaperBuy(db,source,d.id);action='BUY';reason='Conditional paper order pending future eligible minute; no fill assumed';}catch(e){reason=e.message;}}
    else if(!held&&d?.action==='Watch')reason='Closing/evening review: no new entries';
    state=paperState(db,marks);decisions.push({ticker:s.ticker,action,reason,decisionId:d?.id||null,screenScore:d?score(d):null,orderId:order?.id||null,quantity:order?.quantity||0,cashAfterDecision:state.cash,reservedCash:state.reservedCash});
   }
   const benchmark=source.prepare("SELECT * FROM market_benchmarks WHERE symbol='EGX:EGX30'").get();const run={id,phase:arg,startedAt:now.toISOString(),completedAt:new Date().toISOString(),preflightReady:preflightReady(db),decisions,portfolio:state,benchmarks:source.prepare('SELECT * FROM market_benchmarks ORDER BY symbol').all().map(b=>({...b,payload:JSON.parse(b.payload)})),benchmark:benchmark?{...benchmark,payload:JSON.parse(benchmark.payload)}:null,benchmarkStatus:'Store timestamped EGX30 observation; compare matched dates only. Missing matched baseline means unavailable.',ruleVersion:config.version};appendPaper(db,'run',run,id);mkdirSync(dir,{recursive:true});writeFileSync(join(dir,id+'.json'),JSON.stringify(run,null,2),{flag:'wx'});console.log(JSON.stringify({runId:id,decisions:decisions.length,buys:decisions.filter(d=>d.action==='BUY').length,holds:state.positions.length,cash:state.cash,preflightReady:run.preflightReady}));
  }
 }
 else if(command==='benchmark'){console.log(JSON.stringify({saved:recordBenchmarkPoint(db,JSON.parse(readFileSync(arg,'utf8')))}));}
 else if(command==='report'){
  const report={...paperPerformance(db,paperMarks(db,source)),researchCoverage:researchCoverage(source)},base=join(dir,'performance-'+Date.now());writeFileSync(base+'.json',JSON.stringify(report,null,2),{flag:'wx'});writeFileSync(base+'.md',performanceMarkdown(report),{flag:'wx'});console.log(JSON.stringify({json:base+'.json',markdown:base+'.md'}));
 }
 else if(command==='export'){
  mkdirSync(dir,{recursive:true});const path=join(dir,'audit-'+Date.now()+'-'+randomUUID().slice(0,8)+'.json');writeFileSync(path,JSON.stringify(paperAudit(db),null,2),{flag:'wx'});console.log(path);
 }else throw Error('Usage: paper-agent.mjs init | state | preflight FILE | propose DECISION_ID | ingest FILE | settle | run PHASE | amendment TEXT | export');
}finally{db.close();source.close();}
