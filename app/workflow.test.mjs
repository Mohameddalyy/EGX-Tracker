import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,existsSync,mkdirSync,writeFileSync,cpSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openWorkflow,beginWorkflow,registerJobs,claimJob,finishJob,runJobs,recoverJob,invalidateRetry,workflowHash,recordChild} from './workflow-store.mjs';
import {executeWorkflow} from './workflow-runner.mjs';
import {planWorkflow,sourcePermission} from './workflow-planner.mjs';
import {openDb} from './core.mjs';
import {initDecisions,requestReassessment} from './decisions.mjs';
import {claimResearch,waitResearch,resumeResearch,recoverResearch,activeResearchCount} from './research-queue-state.mjs';
import {runWorkflowProcess,workflowAdapter} from './workflow-adapters.mjs';
import {initMarket,importCatalog} from './market.mjs';
import {initJournal} from './journal.mjs';
import {initPositions} from './positions.mjs';
import {openPaper,paperAudit} from './paper.mjs';
import {readWorkflowInputs} from './workflow-inputs.mjs';
import {renderWorkflowStatus} from './public/workflow-status.js';
import {minuteObservationQuality} from './minute-observation.mjs';
import {recoverSourceLock} from './workflow-recovery.mjs';
import {reportInventory,discoverReportRoutes} from './workflow-documents.mjs';
const at=new Date('2026-10-26T10:00:00Z'),hash=workflowHash;
const makeRun=(db,ms=1000)=>beginWorkflow(db,{workload:'checkpoint',plannedAt:at.toISOString(),deadlineMs:ms,pid:999999},at);
const job=(kind='fixture',target='A',revision='one',extra={})=>({kind,target,revision,resource:kind,priority:10,maxMs:200,...extra});
const plan=jobs=>({jobs,obligations:[],sourceGaps:[],minuteTargets:[]});
function inputs(){return {observedAt:at.toISOString(),stocks:[{ticker:'AAA',fingerprint:'price1',readiness:{due:false}},{ticker:'BBB',fingerprint:'price2',readiness:{due:false}}],decisions:[{id:'d1',ticker:'AAA',action:'Wait',payload:{reviewConditions:'New filing'},source_hash:'d1'},{id:'d2',ticker:'BBB',action:'Avoid',payload:{},source_hash:'d2'},{id:'d3',ticker:'AAA',action:'Watch',supersedes:'d1',payload:{riskPlan:{expiresAt:'2026-10-25T00:00:00Z'}},source_hash:'d3'}],queue:[],documents:[],evidenceFingerprints:{AAA:'doc1',BBB:'doc2'},unmappedEvents:{count:0,fingerprint:'none'},exchangeWindows:[],catalogCapturedAt:at.toISOString(),receipts:['facts-stocks','facts-benchmarks'].map(component=>({component,target:'2026-10-26',status:'completed',payload:{}})),attempts:[],positions:[],livePositions:[],intents:[],ledgerStatus:'READABLE',ledgerFingerprint:'ledger',sourceAccess:{}};}

test('planner checks all actions and superseded decisions; unchanged history does not create downloads',()=>{
 const i=inputs(),p=planWorkflow(i,{workload:'baseline',now:at});assert.equal(p.obligations.length,3);assert.equal(p.obligations.find(x=>x.decisionId==='d1').superseded,true);assert.equal(p.obligations.find(x=>x.decisionId==='d3').entryExpired,true);assert.equal(p.jobs.filter(j=>j.kind==='history').length,0);assert.equal(p.jobs.filter(j=>j.kind==='facts').length,0);assert.equal(p.jobs.filter(j=>j.kind==='catalog').length,0);assert.equal(p.jobs.find(j=>j.kind==='exchange').critical,true);assert(p.sourceGaps.some(x=>x.code==='PERMISSION_UNRESOLVED'));assert.deepEqual(p.minuteTargets,[]);
});
test('changed filing/new news invalidates only affected company review despite unchanged price scores',()=>{
 const i=inputs(),before=planWorkflow(i,{now:at});i.evidenceFingerprints.AAA='new-version';const after=planWorkflow(i,{now:at});
 assert.notEqual(before.obligations[0].revision,after.obligations[0].revision);assert.equal(before.obligations[1].revision,after.obligations[1].revision);assert.notEqual(before.obligations[2].revision,after.obligations[2].revision);
});
test('same-day news refresh is independent of daily facts and detects stale first page in mixed window',()=>{
 const i=inputs();i.exchangeWindows=[{to:'2026-10-26',complete:true,checkedAt:at.toISOString(),endpoints:{news:{pages:{1:{at:'2026-10-26T09:00Z'},2:{at:at.toISOString()}}}}}];
 assert(planWorkflow(i,{now:at}).jobs.some(j=>j.kind==='exchange'));
 i.exchangeWindows[0].endpoints.news.pages[1].at=at.toISOString();assert(!planWorkflow(i,{now:at}).jobs.some(j=>j.kind==='exchange'));
 assert(planWorkflow(i,{now:new Date(+at+31*60000)}).jobs.some(j=>j.kind==='exchange'));
});
test('minute targets use held positions, sell obligations, candidates and valid setups; expired entry stays excluded',()=>{
 const i=inputs();i.positions=[{ticker:'HELD'}];i.livePositions=[{ticker:'JOURNAL'}];i.intents=[{ticker:'EXIT',plan:{side:'SELL',expiresAt:'2000-01-01'}},{ticker:'EXPIRED',plan:{side:'BUY',expiresAt:'2000-01-01'}}];i.queue=[{id:'q',ticker:'CAND',status:'researching'}];
 assert.deepEqual(planWorkflow(i,{now:at}).minuteTargets,['CAND','EXIT','HELD','JOURNAL']);
});
test('future source backoff preserves overdue critical coverage; unavailable baseline names defer to Sunday',()=>{
 const i=inputs();i.positions=[{ticker:'AAA'}];i.stocks[0].readiness={due:true,expectedSession:'2026-10-25'};i.attempts=[{ticker:'AAA',component:'history',target:'2026-10-25',next_retry:new Date(+at+3600000).toISOString()}];i.stocks.push({ticker:'UNAVAILABLE',catalogStatus:'failed',readiness:{due:true}});
 const p=planWorkflow(i,{workload:'baseline',now:at});assert(p.sourceGaps.some(g=>g.target==='AAA'&&g.critical&&g.overdueCoverage&&g.code==='RETRY_NOT_DUE'));assert(p.sourceGaps.some(g=>g.target==='UNAVAILABLE'&&g.code==='SUNDAY_REPAIR'));
});
test('durable receipt survives database close/reopen and completed work is not repeated',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'egx-workflow-'));let db=openWorkflow(join(dir,'state.sqlite'));try{let calls=0;const j=job(),first=makeRun(db);await executeWorkflow(db,first,plan([j]),{execute:async()=>{calls++;return {status:'succeeded',watermark:'retained-v1'};},clock:()=>at});db.close();db=openWorkflow(join(dir,'state.sqlite'));const second=makeRun(db),r=await executeWorkflow(db,second,plan([j]),{execute:async()=>{calls++;return {status:'succeeded'};},clock:()=>at});assert.equal(calls,1);assert.equal(r.counts.reused,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM workflow_receipts').get().n,1);}finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
test('restart requires exact recorded recovery; live owner/child cannot be stolen and prior success stays saved',()=>{
 const db=openWorkflow(':memory:');try{const r=makeRun(db),j=job();registerJobs(db,r,[j],at);const id=runJobs(db,r.id)[0].id;claimJob(db,id,r,at);recordChild(db,id,r.owner,123);
 assert.equal(claimJob(db,id,makeRun(db),new Date(+at+86400000)),null);assert.throws(()=>recoverJob(db,id,{owner:r.owner,actor:'tester',reason:'verified stopped',isAlive:pid=>pid===123}),/alive/);
 recoverJob(db,id,{owner:r.owner,actor:'tester',reason:'both processes verified stopped',isAlive:()=>false},at);assert.equal(db.prepare('SELECT status FROM workflow_jobs').get().status,'pending');assert.equal(db.prepare('SELECT status FROM workflow_runs WHERE id=?').get(r.id).status,'interrupted');
 }finally{db.close();}
});
test('source failure does not discard successes or block independent mandatory monitoring; retries are due only',async()=>{
 const db=openWorkflow(':memory:');try{const r=makeRun(db),seen=[],p=plan([job('health','all','v1',{priority:0}),job('bad','AAA','v1',{priority:10}),job('monitor','d1','v1',{priority:2,critical:true}),job('documents','BBB','v1',{priority:20})]);
 const out=await executeWorkflow(db,r,p,{clock:()=>at,execute:async j=>{seen.push(j.kind);return j.kind==='bad'?{status:'failed',retryMs:3600000}:{status:'succeeded'};}});assert.deepEqual(seen,['health','monitor','bad','documents']);assert.equal(out.status,'partial');assert.equal(db.prepare('SELECT COUNT(*) n FROM workflow_receipts').get().n,3);
 const bad=runJobs(db,r.id).find(j=>j.kind==='bad');assert.equal(claimJob(db,bad.id,makeRun(db),at),null);assert.throws(()=>invalidateRetry(db,bad.id,{actor:'x',reason:'retry'}),/evidence/);invalidateRetry(db,bad.id,{actor:'x',reason:'new source available',evidenceId:'e2'},at);assert(claimJob(db,bad.id,makeRun(db),at));
 }finally{db.close();}
});
test('timeout writes truthful checkpoint, preserves position status and leaves unresponsive ownership for recovery',async()=>{
 const db=openWorkflow(':memory:');try{const r=makeRun(db),saved=[];const out=await executeWorkflow(db,r,plan([job('positions','held','v1',{priority:0}),job('deep-review','AAA','v1',{maxMs:20})]),{clock:()=>at,checkpoint:x=>saved.push(x),execute:async j=>j.kind==='positions'?{status:'succeeded',holdings:[{ticker:'AAA',exitPending:true}]}:new Promise(()=>{})});
 assert.equal(out.status,'partial');assert.equal(out.entryAuthorization,false);assert.equal(out.modelTokens,null);assert(saved.length>=2);assert.equal(out.jobs.find(j=>j.kind==='positions').result.holdings[0].exitPending,true);assert.equal(out.jobs.find(j=>j.kind==='deep-review').status,'running');assert(db.prepare("SELECT 1 FROM workflow_events WHERE kind='deadline-cancellation'").get());
 }finally{db.close();}
});
test('source permission is explicit and unresolved adapters launch no process',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'egx-workflow-permission-')),db=openWorkflow(':memory:');try{assert.equal(sourcePermission({},'tradingview',at),false);const r=makeRun(db),j=job('history','AAA','session',{source:'tradingview'});registerJobs(db,r,[j],at);const stored=claimJob(db,runJobs(db,r.id)[0].id,r,at);const out=await workflowAdapter(db,dir)(stored,{owner:r.owner,budgetMs:1000,signal:new AbortController().signal});assert.equal(out.incident,'PERMISSION_UNRESOLVED');assert.equal(db.prepare('SELECT child_pid FROM workflow_jobs').get().child_pid,null);}finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
function queued(db,id,ticker,status='pending'){db.prepare('INSERT INTO research_queue(id,run_id,ticker,as_of,policy_version,status,created_at,updated_at,evidence) VALUES(?,?,?,?,?,?,?,?,?)').run(id,'fixture',ticker,'2026-10-26','test',status,at.toISOString(),at.toISOString(),'{}');}
test('owned claim voluntarily waits; event/time resume is capacity bounded, with legacy owner recovery explicit',()=>{
 const db=openDb(':memory:');try{initDecisions(db);queued(db,'q','AAA');const c=claimResearch(db,'q','analyst',at);assert.throws(()=>waitResearch(db,'q',{actor:'other',reason:'wait',eventFingerprint:'old'}),/owner/);
 waitResearch(db,'q',{actor:'analyst',token:c.token,reason:'new filing required',eventFingerprint:'old'},at);assert.equal(activeResearchCount(db),0);assert.deepEqual(resumeResearch(db,{AAA:'old'},at),[]);assert.deepEqual(resumeResearch(db,{AAA:'new'},at),['q']);
 const newOwner=claimResearch(db,'q','new-analyst',at);assert.throws(()=>recoverResearch(db,'q',{actor:'operator',reason:'recover',previousOwner:newOwner.owner,abandonedConfirmed:true},at),/lease/);
 recoverResearch(db,'q',{actor:'operator',reason:'owner confirmed abandoned',previousOwner:newOwner.owner,abandonedConfirmed:true},new Date(+at+25*3600000));assert.equal(db.prepare('SELECT status FROM research_queue').get().status,'pending');
 }finally{db.close();}
});
test('reassessment overflow remains waiting and resumes before new candidates without exceeding five',()=>{
 const db=openDb(':memory:');try{initDecisions(db);for(let i=0;i<5;i++)queued(db,'q'+i,'T'+i);
 db.prepare('INSERT INTO agent_decisions VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run('d','old','OTHER','r',at.toISOString(),'2026-10-25','Avoid',null,'{}','{}','{}','hash');const review=requestReassessment(db,'d','new filing',at);assert.equal(review.status,'waiting_capacity');assert.equal(activeResearchCount(db),5);assert.equal(requestReassessment(db,'d','new filing',at).id,review.id);assert.deepEqual(resumeResearch(db,{},at),[]);db.prepare("UPDATE research_queue SET status='decision_recorded' WHERE id='q0'").run();assert.deepEqual(resumeResearch(db,{},at),[review.id]);assert.equal(activeResearchCount(db),5);
 }finally{db.close();}
});
test('actual child timeout is terminated and awaited; stderr stays in local log',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'egx-workflow-child-'));try{const script=join(dir,'wait.mjs');writeFileSync(script,"console.error('fixture waiting');setInterval(()=>{},1000)");const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),100);let pid;const r=await runWorkflowProcess(script,[],{cwd:dir,signal:controller.signal,logPath:join(dir,'child.log'),onChild:x=>{pid=x;}});clearTimeout(timer);assert.equal(r.status,'timeout');assert(pid>0);assert.throws(()=>process.kill(pid,0));assert(existsSync(join(dir,'child.log')));}finally{rmSync(dir,{recursive:true,force:true});}
});
function fixtureRoot(){
 const root=mkdtempSync(join(tmpdir(),'egx-workflow-integration-'));cpSync('app',join(root,'app'),{recursive:true});cpSync('research',join(root,'research'),{recursive:true});cpSync('package.json',join(root,'package.json'));mkdirSync(join(root,'data'),{recursive:true});
 const source=openDb(join(root,'data/egx.sqlite'));initMarket(source);initDecisions(source);initJournal(source);initPositions(source);
 importCatalog(source,{retrievedAt:at.toISOString(),totalCount:2,stocks:['AAA','BBB'].map(name=>({name,symbol:'EGX:'+name,type:'stock',exchange:'EGX',currency:'EGP',description:'Fixture',sector:'Industrials'}))});
 const config=JSON.parse(readFileSync('research/paper-experiment.json','utf8')),paperPath=join(root,'data/experiments',config.id,'paper.sqlite');mkdirSync(join(root,'data/experiments',config.id),{recursive:true});const paper=openPaper(paperPath,config);return {root,source,paper,paperPath};
}
test('real local worker commands checkpoint positions and export history without changing paper ledger',async()=>{
 const f=fixtureRoot(),state=openWorkflow(':memory:');try{const before=hash(paperAudit(f.paper)),r=makeRun(state,10000),jobs=[job('health','all','one'),job('positions','all','one'),job('learning-export','all','one')];
 for(const j of jobs){registerJobs(state,r,[j],at);const stored=claimJob(state,runJobs(state,r.id).find(x=>x.kind===j.kind).id,r,at),out=await workflowAdapter(state,f.root)(stored,{owner:r.owner,budgetMs:10000,signal:new AbortController().signal});assert.equal(out.status,'succeeded',JSON.stringify(out));finishJob(state,stored.id,r.owner,out,at);}
 assert.equal(hash(paperAudit(f.paper)),before);assert.equal(state.prepare('SELECT COUNT(*) n FROM workflow_receipts').get().n,3);
 const input=readWorkflowInputs(f.root,at);assert(input.stocks.some(s=>s.ticker==='AAA'));assert(input.stocks.some(s=>s.ticker==='BBB'));assert.equal(input.ledgerStatus,'READABLE');
 }finally{state.close();f.source.close();f.paper.close();rmSync(f.root,{recursive:true,force:true});}
});
test('real observation-only minute command retains exact targets and never mutates paper ledger',async()=>{
 const f=fixtureRoot();try{
 const core=join(f.root,'integrations/tradingview-mcp/src/core');mkdirSync(core,{recursive:true});
 writeFileSync(join(core,'chart.js'),"globalThis.chartState={symbol:'EGX:ORIGINAL',resolution:'1D',chartType:1};export const getState=async()=>({...globalThis.chartState});export const setSymbol=async x=>{globalThis.chartState.symbol=x.symbol;return {chart_ready:true}};export const setTimeframe=async x=>{globalThis.chartState.resolution=x.timeframe;return {chart_ready:true}};");
 writeFileSync(join(core,'../connection.js'),"export const evaluate=async()=>({...globalThis.chartState,ticker:globalThis.chartState.symbol.split(':')[1],timezone:'Africa/Cairo',exchange:'EGX',currency:'EGP',delaySeconds:0,bars:[{time:Math.floor(Date.now()/60000)*60-120,open:10,high:11,low:9,close:10,volume:1000}]});export const disconnect=async()=>{};");
 const before=hash(paperAudit(f.paper)),outPath=join(f.root,'result.json');const result=await runWorkflowProcess(join(f.root,'app/collect-paper-minutes.mjs'),['--observation-only','AAA'],{cwd:f.root,logPath:join(f.root,'minute.log'),env:{EGX_WORKFLOW_RESULT:outPath,EGX_SOURCE_DEADLINE_MS:'5000'}});
 assert.equal(result.status,'succeeded',readFileSync(join(f.root,'minute.log'),'utf8'));const out=JSON.parse(readFileSync(outPath,'utf8'));assert.equal(out.observationOnly,true);assert.equal(out.accepted,null);assert.deepEqual(out.tickers,['AAA']);assert.equal(out.restored,true);assert.equal(hash(paperAudit(f.paper)),before);assert(existsSync(out.path));assert.equal(f.source.prepare("SELECT COUNT(*) n FROM chart_recovery WHERE status='restored'").get().n,1);
 }finally{f.source.close();f.paper.close();rmSync(f.root,{recursive:true,force:true});}
});
test('real decision worker records changed evidence as a bounded reassessment without changing original decision',async()=>{
 const f=fixtureRoot(),state=openWorkflow(':memory:');try{const policy=JSON.parse(readFileSync('research/decision-policy.json','utf8')),payload={action:'Avoid',prediction:{horizonSessions:5,direction:'uncertain',hurdlePercent:0},reviewConditions:'New filing'};
 f.source.prepare('INSERT INTO agent_decisions VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run('d1','old','AAA','r1','2026-10-08T10:00:00Z','2026-10-08','Avoid',null,JSON.stringify(payload),'{}',JSON.stringify(policy),'original');const original=f.source.prepare('SELECT * FROM agent_decisions').get();
 for(const [revision,evidenceFingerprint] of [['old','e1'],['new','e2']]){const r=makeRun(state,10000);registerJobs(state,r,[job('decision-monitor','d1',revision,{evidenceFingerprint})],at);const j=claimJob(state,runJobs(state,r.id)[0].id,r,at),out=await workflowAdapter(state,f.root)(j,{owner:r.owner,budgetMs:10000,signal:new AbortController().signal});assert.equal(out.status,'succeeded',JSON.stringify(out));finishJob(state,j.id,r.owner,out,at);}
 assert.equal(f.source.prepare('SELECT COUNT(*) n FROM research_queue').get().n,1);assert.deepEqual(f.source.prepare('SELECT * FROM agent_decisions').get(),original);
 }finally{state.close();f.source.close();f.paper.close();rmSync(f.root,{recursive:true,force:true});}
});
test('client checkpoint renders unfinished work safely without presenting it as approval',()=>{const html=renderWorkflowStatus({status:'partial',unfinished:[{kind:'documents',target:'<script>',status:'blocked'}],report:{counts:{reused:2,deferred:1,failed:1},durationMs:100,obligations:[{}],minuteTargets:[],observedAt:at.toISOString(),deadlineMissed:true}});assert(html.includes('&lt;script&gt;'));assert(html.includes('not a trade approval'));assert(html.includes('Deadline missed'));});
test('old/invalid minute observations are retained with explicit quality; no observation grants execution',()=>{
 const c={capturedAt:at.toISOString(),delaySeconds:0,timezone:'Africa/Cairo',currency:'EGP',exchange:'EGX',bars:[{time:+at/1000-120,open:10,high:11,low:9,close:10,volume:100}]};assert.equal(minuteObservationQuality(c).status,'RECENT_CLOSED_OBSERVATION');assert.equal(minuteObservationQuality(c).usableForExecution,false);c.bars[0].time-=86400;assert.equal(minuteObservationQuality(c).status,'OLDER_CLOSED_OBSERVATION');c.bars[0].volume=null;assert.equal(minuteObservationQuality(c).status,'INVALID_OR_EMPTY_OBSERVATIONS');
});
test('broken optional document index leaves position and all-decision obligation work runnable',()=>{
 const f=fixtureRoot();try{const dir=join(f.root,'data/research/evidence/library');mkdirSync(dir,{recursive:true});writeFileSync(join(dir,'index.json'),'{bad json');const input=readWorkflowInputs(f.root,at),p=planWorkflow(input,{now:at});assert.equal(input.ledgerStatus,'READABLE');assert(p.jobs.some(j=>j.kind==='positions'));assert(p.sourceGaps.some(g=>g.code==='RETAINED_SOURCE_UNREADABLE'));}finally{f.source.close();f.paper.close();rmSync(f.root,{recursive:true,force:true});}
});
test('source lock recovery needs exact dead owner and leaves an audit event',()=>{
 const root=mkdtempSync(join(tmpdir(),'egx-lock-recovery-')),db=openWorkflow(':memory:');try{const dir=join(root,'data/research/evidence/library');mkdirSync(dir,{recursive:true});const path=join(dir,'collector.lock');writeFileSync(path,JSON.stringify({token:'owner',pid:123}));
 assert.throws(()=>recoverSourceLock(db,root,{source:'library',token:'owner',actor:'test',reason:'check',isAlive:()=>true}),/alive/);assert(existsSync(path));recoverSourceLock(db,root,{source:'library',token:'owner',actor:'test',reason:'verified stopped',isAlive:()=>false},at);assert(!existsSync(path));assert.equal(db.prepare("SELECT COUNT(*) n FROM workflow_events WHERE kind='source-lock-recovery'").get().n,1);
 }finally{db.close();rmSync(root,{recursive:true,force:true});}
});
test('clock jump or PC sleep ends work with actual late timestamps rather than backfilled observations',async()=>{
 const db=openWorkflow(':memory:');try{let wall=at;const r=makeRun(db,1000),out=await executeWorkflow(db,r,plan([job('positions','all','v1',{priority:0}),job('later')]),{clock:()=>wall,execute:async()=>{wall=new Date(+at+60000);return {status:'succeeded'};}});assert.equal(out.deadlineMissed,true);assert.equal(out.latenessMs,59000);assert.equal(out.jobs.find(j=>j.kind==='later').status,'pending');assert.equal(out.status,'partial');}finally{db.close();}
});
test('new cited report routes are discovered once; unchanged reports reuse inventory and excluded sources stay excluded',()=>{
 const f=fixtureRoot();try{const dir=join(f.root,'data/research');mkdirSync(dir,{recursive:true});const path=join(dir,'report-new.json');writeFileSync(path,JSON.stringify({id:'report-new',sources:[{url:'https://issuer.example/report.pdf'},{url:'https://stockanalysis.com/quote/egx/TEST/'}],assessments:[{ticker:'AAA'}]}));
 const refs=reportInventory(f.root,['report-new']),first=discoverReportRoutes(f.root,refs),second=discoverReportRoutes(f.root,refs);assert.equal(first.inspected,1);assert.equal(second.inspected,0);assert.equal(second.reused,1);const inventory=JSON.parse(readFileSync(first.path,'utf8'));assert.equal(inventory.reports['report-new'].routes.length,1);assert.equal(inventory.reports['report-new'].routes[0].url,'https://issuer.example/report.pdf');
 }finally{f.source.close();f.paper.close();rmSync(f.root,{recursive:true,force:true});}
});
test('screen workload keeps expensive sources separate while reporting their missing coverage',()=>{const i=inputs();i.stocks[0].readiness={due:true};i.documents=[{url:'https://issuer.example/new.pdf'}];const p=planWorkflow(i,{workload:'screen',now:at});assert(p.jobs.some(j=>j.kind==='screen'));assert(!p.jobs.some(j=>['documents','history','exchange','minutes'].includes(j.kind)));assert(p.sourceGaps.some(g=>g.code==='SOURCE_REFRESH_SEPARATE_WORKLOAD'));});

test('changing news window cannot bypass source backoff; explicit new evidence invalidation is recorded',()=>{
 const db=openWorkflow(':memory:');try{
 const r=makeRun(db);registerJobs(db,r,[job('exchange','day1','bucket1',{source:'egx-exchange'})],at);const first=runJobs(db,r.id)[0];claimJob(db,first.id,r,at);finishJob(db,first.id,r.owner,{status:'failed',retryMs:3600000},at);
 const later=makeRun(db);registerJobs(db,later,[job('exchange','day2','bucket2',{source:'egx-exchange'})],at);const next=runJobs(db,later.id)[0];assert.equal(next.next_retry,new Date(+at+3600000).toISOString());assert.equal(claimJob(db,next.id,later,at),null);
 for(let n=1;n<=2;n++){const t=new Date(+at+n*3600000);claimJob(db,next.id,later,t);const out=finishJob(db,next.id,later.owner,{status:'failed',retryMs:3600000},t);assert.equal(out.consecutiveScopeFailures,n+1);if(n===2)assert.equal(out.persistentUnavailable,true);}
 invalidateRetry(db,next.id,{actor:'tester',reason:'source recovery independently verified',evidenceId:'recovery-proof'},new Date(+at+2*3600000));assert(claimJob(db,next.id,later,new Date(+at+2*3600000)));assert.equal(db.prepare("SELECT COUNT(*) n FROM workflow_events WHERE kind='backoff-invalidated'").get().n,1);
 }finally{db.close();}
});

test('real catalog import worker applies a retained new version without fetching or changing paper ledger',async()=>{
 const f=fixtureRoot(),state=openWorkflow(':memory:');try{
 const before=hash(paperAudit(f.paper));mkdirSync(join(f.root,'data/market'),{recursive:true});writeFileSync(join(f.root,'data/market/catalog.json'),JSON.stringify({retrievedAt:at.toISOString(),totalCount:1,stocks:[{name:'CCC',symbol:'EGX:CCC',type:'stock',exchange:'EGX',currency:'EGP',description:'New catalog fixture'}]}));
 const r=makeRun(state,10000);registerJobs(state,r,[job('catalog-import','EGX',at.toISOString())],at);const j=claimJob(state,runJobs(state,r.id)[0].id,r,at),out=await workflowAdapter(state,f.root)(j,{owner:r.owner,budgetMs:10000,signal:new AbortController().signal});assert.equal(out.status,'succeeded',JSON.stringify(out));assert(f.source.prepare("SELECT 1 FROM market_catalog WHERE ticker='CCC'").get());assert.equal(hash(paperAudit(f.paper)),before);
 }finally{state.close();f.source.close();f.paper.close();rmSync(f.root,{recursive:true,force:true});}
});

test('new source content replans urgent monitoring within the same run without repeating unchanged work',async()=>{
 const db=openWorkflow(':memory:');try{let changed=false;const seen=[],old=job('decision-monitor','d1','old',{priority:2}),source=job('exchange','day','bucket',{priority:10}),r=makeRun(db);const out=await executeWorkflow(db,r,plan([old,source]),{clock:()=>at,replan:()=>plan([changed?{...old,revision:'new'}:old,source]),execute:async j=>{seen.push(j.kind+':'+j.revision);if(j.kind==='exchange')changed=true;return {status:'succeeded'};}});assert.deepEqual(seen,['decision-monitor:old','exchange:bucket','decision-monitor:new']);assert.equal(out.status,'completed');assert.equal(db.prepare('SELECT COUNT(*) n FROM workflow_receipts').get().n,3);}finally{db.close();}
});

test('in-run replanning reuses invocation health and unchanged positions; progress survives before completion',async()=>{
 const i=inputs(),first=planWorkflow(i,{now:at,invocationAt:at.toISOString()});i.observedAt=new Date(+at+10000).toISOString();const second=planWorkflow(i,{now:new Date(+at+10000),invocationAt:at.toISOString()});for(const kind of ['health','positions'])assert.equal(first.jobs.find(j=>j.kind===kind).revision,second.jobs.find(j=>j.kind===kind).revision);
 const db=openWorkflow(':memory:');try{const r=makeRun(db);let checkpointCount=0;await executeWorkflow(db,r,plan([job('positions')]),{clock:()=>at,execute:async()=>({status:'succeeded'}),checkpoint:report=>{checkpointCount++;const saved=JSON.parse(db.prepare('SELECT report FROM workflow_runs WHERE id=?').get(r.id).report);assert.equal(saved.status,report.status);assert.equal(saved.jobs[0].status,'succeeded');}});assert(checkpointCount>=2);}finally{db.close();}
});
