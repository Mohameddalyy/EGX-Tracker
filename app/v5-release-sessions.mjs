// Three isolated synthetic session-equivalent pipelines through production CLI/store/worker interfaces.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,cpSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {spawnSync,spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {initialState,transition} from './v5/execution.mjs';
import {executionFixture,acceptance,minuteFixture,fullProposal,fixtureSource,acceptAt} from './v5/execution-fixtures.mjs';
import {researchEvidence,reviewFixture} from './v5/fixtures.mjs';
import {readEvaluationLedger,ledgerMetrics} from './v5/evaluation-ledger.mjs';
import {openExecutionStore} from './v5/execution-store.mjs';
import {registerClientLedger,saveCheckpoint,clientOverview} from './v5/client-service.mjs';
import {readWorkflowInputs} from './workflow-inputs.mjs';
import {planWorkflow} from './workflow-planner.mjs';
import {openWorkflow,beginWorkflow} from './workflow-store.mjs';
import {executeWorkflow} from './workflow-runner.mjs';
import {workflowAdapter} from './workflow-adapters.mjs';
import {openDb} from './core.mjs';
import {initMarket} from './market.mjs';
import {initDecisions} from './decisions.mjs';
import {initJournal} from './journal.mjs';
import {initPositions} from './positions.mjs';
import {openPaper} from './paper.mjs';
import {hash} from './v5/contract.mjs';
const repo=fileURLToPath(new URL('../',import.meta.url));
const json=p=>JSON.parse(readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
export async function sessionCases(directory){
 const out=resolve(directory);mkdirSync(out,{recursive:true});const commands=[],results=[];
 function cli(file,args,label,expected=0){const start=performance.now(),r=spawnSync(process.execPath,[join(repo,'app',file),...args],{cwd:repo,windowsHide:true,encoding:'utf8',timeout:30000});writeFileSync(join(out,label+'.log'),(r.stdout||'')+(r.stderr||''),{flag:'wx'});commands.push({label,file,args,status:r.status,durationMs:performance.now()-start});assert.equal(r.status,expected,label+': '+r.stderr);return r;}
 function scenario(name,variant='B1',cost='base'){
  const f=executionFixture(variant,cost),dir=join(out,name);mkdirSync(dir);let state=initialState(f.config);const events=[];
  const add=(type,data,at)=>{const event={id:name+'-'+events.length,type,data,at};state=transition(state,event).state;events.push(event);};
  add('OPEN_DAY',{book:f.book},'2026-10-25T06:40:00Z');add('SET_PAUSE',{paused:false,reason:'Synthetic engineering, never activation'},'2026-10-25T06:41:00Z');
  const bad=structuredClone(f.bundle);bad.preflight.criticalGaps=['Synthetic unresolved action'];add('ASSESS',{requestId:'rejection',bundle:bad,proposal:{}},'2026-10-25T06:45:00Z');assert.equal(state.assessments.rejection.status,'BLOCKED');
  add('SUBMIT',acceptance(f,state,variant==='FULL'?fullProposal:{},'order'),acceptAt);
  const observe=(bar)=>add('MINUTE',{bar,book:f.book,dailyVolume:{...fixtureSource,isin:f.isin,forDay:bar.startAt.slice(0,10),basis:'PRIOR_MEDIAN20_RAW_SHARES',value:1000000}},bar.receivedAt);
  const simulate=(label,subset=events)=>{const input=join(dir,label+'-input.json'),output=join(dir,label+'-output.json');save(input,{label:'SYNTHETIC_ENGINEERING_NOT_MARKET_PERFORMANCE',config:f.config,events:subset});cli('v5-execution-agent.mjs',['simulate',join(dir,'ledger.sqlite'),input,output],name+'-'+label);return json(output);};
  return {name,dir,f,add,observe,simulate,events,get state(){return state;}};
 }
 const a=scenario('session-1-entry-exit');a.observe(minuteFixture(a.f.isin,undefined,undefined,{low:68}));assert.equal(a.state.positions.order.status,'EXIT_PENDING');a.observe(minuteFixture(a.f.isin,'2026-10-27','07:01:00',{open:69,high:70,low:68,close:69}));a.add('OPEN_DAY',{book:a.f.book},'2026-10-29T06:40:00Z');assert.equal(a.state.positions.order.status,'CLOSED');assert(a.state.settlements.every(s=>s.settled));a.simulate('complete');
 const b=scenario('session-2-outage-blocked-exit','FULL');b.observe(minuteFixture(b.f.isin,undefined,undefined,{low:68}));b.observe(minuteFixture(b.f.isin,'2026-10-27','07:01:00',{volume:1000}));assert.equal(b.state.positions.order.status,'EXIT_PENDING');assert.equal(b.state.positions.order.exit.attempts.at(-1).status,'FULL_QUANTITY_MINUTE_CAPACITY');b.simulate('complete');
 const nofill=scenario('session-2-no-fill','FULL','stress');nofill.observe(minuteFixture(nofill.f.isin));nofill.add('TICK',{},'2026-10-25T07:51:01Z');assert.equal(nofill.state.orders.order.status,'NO_FILL_EVIDENCE');nofill.simulate('complete');
 const c=scenario('session-3-crash-restart');c.simulate('before-crash');const tick={id:'crash-after-commit',type:'TICK',data:{},at:'2026-10-25T07:30:00Z'};
 const childScript=join(out,'crash-child.mjs');writeFileSync(childScript,`import {openExecutionStore} from ${JSON.stringify(new URL('./v5/execution-store.mjs',import.meta.url).href)};import {DatabaseSync} from 'node:sqlite';const [path,mode,event]=process.argv.slice(2);if(mode==='after'){const db=openExecutionStore(path);const e=JSON.parse(event);db.append(e,{clock:new Date(e.at)});}else{const db=new DatabaseSync(path);db.exec('BEGIN IMMEDIATE');db.prepare('UPDATE v5_state SET json=? WHERE id=1').run('{"uncommitted":true}');}process.send({ready:true});setInterval(()=>{},1000);`,{flag:'wx'});
 async function crash(mode,event){return new Promise((resolveDone,reject)=>{const child=spawn(process.execPath,[childScript,join(c.dir,'ledger.sqlite'),mode,JSON.stringify(event)],{windowsHide:true,stdio:['ignore','ignore','pipe','ipc']});let message=false,stderr='';child.stderr.on('data',x=>stderr+=x);const timer=setTimeout(()=>{child.kill();reject(Error('Crash fixture timeout '+stderr));},10000);child.on('message',()=>{message=true;child.kill();});child.on('error',reject);child.on('exit',(code,signal)=>{clearTimeout(timer);message?resolveDone({mode,code,signal,confirmedReady:true}):reject(Error(stderr));});});}
 const before=hash(readEvaluationLedger(join(c.dir,'ledger.sqlite')).state);const beforeCrash=await crash('before',tick);assert.equal(hash(readEvaluationLedger(join(c.dir,'ledger.sqlite')).state),before);const afterCrash=await crash('after',tick);let audit=readEvaluationLedger(join(c.dir,'ledger.sqlite'));assert.equal(audit.state.orders.order.status,'EXPIRED_PENDING_RECONCILIATION');assert(audit.state.orders.order.reservationCents>0);
 // Resume by repeating the exact committed event: no duplicate reservation/event.
 const st=openExecutionStore(join(c.dir,'ledger.sqlite'));assert(st.append(tick,{clock:new Date(tick.at)}).idempotent);st.close();c.add('TICK',{},tick.at);c.events[c.events.length-1].id=tick.id;c.observe(minuteFixture(c.f.isin,'2026-10-25','07:29:00',{low:68}));c.observe(minuteFixture(c.f.isin,'2026-10-27','07:01:00',{open:69,high:70,low:68,close:69}));c.add('OPEN_DAY',{book:c.f.book},'2026-10-29T06:40:00Z');c.simulate('resumed');assert.equal(readEvaluationLedger(join(c.dir,'ledger.sqlite')).events.filter(e=>e.id===tick.id).length,1);save(join(out,'crash-recovery.json'),{beforeCrash,afterCrash,precommitRollback:true,afterCommitReplayIdempotent:true});
 // Real signal/research CLI handoff. Reports are synthetic fixtures, not real model evaluation.
 const signal=join(out,'signal.json'),evaluation=join(out,'evaluation.json'),evidence=join(out,'evidence.json'),packet=join(out,'packet.json'),review=join(out,'review.json');save(signal,b.f.bundle.signalInput);save(evidence,researchEvidence(b.f.bundle.signalInput));cli('v5-agent.mjs',['evaluate',signal,evaluation],'signal');cli('v5-agent.mjs',['packet',evaluation,b.f.isin,'FULL',evidence,packet],'packet');save(review,reviewFixture(json(packet)));const reviewResult=cli('v5-agent.mjs',['review',packet,review,join(out,'disposition.json')],'review-expired',1);assert.match(reviewResult.stderr,/coverage expired/);save(join(out,'review-expired.json'),{expectedRejection:true,reason:reviewResult.stderr,meaning:'Actual-clock CLI correctly rejects historical synthetic research; positive historical bound review is exercised by the labeled execution fixtures.'});
 for(const x of [a,b,nofill,c]){const ledger=join(x.dir,'ledger.sqlite');cli('v5-execution-agent.mjs',['replay',ledger],x.name+'-replay');cli('v5-evaluation-agent.mjs',['ledger',ledger,join(x.dir,'metrics.json')],x.name+'-metrics');const m=ledgerMetrics(readEvaluationLedger(ledger));results.push({name:x.name,stateHash:m.stateHash,counts:m.counts,netCents:m.netCents,cashCents:m.valuation.cashCents,attribution:m.attribution,accountingReconciled:true});}
 // A real fixed worker and real planner see the v5 holding even when the old ledger is broken.
 for(const x of [a,b,c]){
 const root=join(out,x.name+'-dispatcher');mkdirSync(root);for(const p of ['app','research'])cpSync(join(repo,p),join(root,p),{recursive:true});for(const p of ['package.json','pnpm-lock.yaml'])cpSync(join(repo,p),join(root,p));mkdirSync(join(root,'data'));const db=openDb(join(root,'data/egx.sqlite'));initMarket(db);initDecisions(db);initJournal(db);initPositions(db);db.prepare('INSERT INTO stocks(ticker,name,metadata) VALUES(?,?,?)').run('TEST0','Synthetic',JSON.stringify({symbolInfo:{isin:x.f.isin}}));db.close();
 const config=json(join(root,'research/paper-experiment.json')),paperPath=join(root,'data/experiments',config.id,'paper.sqlite');mkdirSync(join(root,'data/experiments',config.id),{recursive:true});openPaper(paperPath,config).close();cpSync(join(x.dir,'ledger.sqlite'),join(root,'v5.sqlite'));registerClientLedger(root,{id:'v5',label:'Synthetic held risk',path:'v5.sqlite',allowControls:false});
 const inputs=readWorkflowInputs(root,new Date('2026-10-27T07:20:00Z')),plan=planWorkflow(inputs,{now:new Date('2026-10-27T07:20:00Z')});if(x===b)assert(plan.minuteTargets.includes('TEST0'));else assert.equal(inputs.positions.length,0);
 const si=join(x.dir,'signal.json');save(si,x.f.bundle.signalInput);cli('v5-agent.mjs',['evaluate',si,join(x.dir,'signal-result.json')],x.name+'-signal');
 mkdirSync(join(root,'data/operations'),{recursive:true});const ops=openWorkflow(join(root,'data/operations/workflow.sqlite')),actual=new Date(),run=beginWorkflow(ops,{workload:'W9-isolated-checkpoint',plannedAt:actual.toISOString(),deadlineMs:30000},actual);
 const selected={...plan,jobs:plan.jobs.filter(j=>['positions','minute-obligations','health','learning-export','minutes'].includes(j.kind))};
 const report=await executeWorkflow(ops,run,selected,{execute:workflowAdapter(ops,root),checkpoint:r=>saveCheckpoint(root,r)});assert.equal(report.jobs.find(j=>j.kind==='positions').result.holdings.filter(p=>p.account==='v5-paper').length,x===b?1:0);if(x===b)assert(report.jobs.find(j=>j.kind==='minutes').result.incident==='PERMISSION_UNRESOLVED');assert.equal(report.status,'partial');ops.close();save(join(x.dir,'dispatcher-result.json'),report);const actualClient=clientOverview(root);save(join(x.dir,'client-overview-actual-clock.json'),actualClient);const simulatedAt=readEvaluationLedger(join(root,'v5.sqlite')).state.lastAt,client=clientOverview(root,simulatedAt);assert(client.ledgers.every(l=>l.status==='VERIFIED'&&l.cards.length>0));save(join(x.dir,'client-overview.json'),{...client,scope:'EXPLICIT_SYNTHETIC_LEDGER_TIME_NOT_ACTUAL_OBSERVATION',actualCheckAt:new Date().toISOString()});
 }
 save(join(out,'session-results.json'),{scope:'SYNTHETIC_ENGINEERING_NOT_ACTUAL_SESSION_OR_MODEL_PERFORMANCE',threeSessionScenarios:3,additionalNoFillArm:1,results,commands,activation:false});return {directory:out,scenarios:3,results};
}
