// Isolated scheduler scenarios. Adapters are fixtures, never external sources or models.
import {writeFileSync} from 'node:fs';
import {openWorkflow,beginWorkflow} from '../../app/workflow-store.mjs';
import {executeWorkflow} from '../../app/workflow-runner.mjs';
const db=openWorkflow(':memory:'),rows=[];
const jobs=Array.from({length:33},(_,i)=>({kind:'decision-monitor',target:'fixture-'+i,revision:'v1',resource:'local',priority:2,maxMs:1000}));
async function scenario(name,selected,execute=async()=>({status:'succeeded',fetched:0})){
 const now=new Date(),run=beginWorkflow(db,{workload:'checkpoint',plannedAt:now.toISOString(),deadlineMs:10000},now);let calls=0;
 const report=await executeWorkflow(db,run,{jobs:selected,obligations:jobs.map(j=>({decisionId:j.target})),sourceGaps:[],minuteTargets:[]},{execute:async j=>{calls++;return execute(j);}});
 rows.push({name,status:report.status,adapterCalls:calls,durationMs:report.durationMs,counts:report.counts,pending:report.jobs.filter(j=>j.status!=='succeeded').map(j=>({kind:j.kind,target:j.target,status:j.status,nextRetry:j.nextRetry}))});
}
try{
 await scenario('cold-receipts',jobs);
 await scenario('cached-receipts',jobs);
 await scenario('one-changed-decision',jobs.map((j,i)=>i===7?{...j,revision:'changed-content'}:j));
 const failures=Array.from({length:4},(_,i)=>({kind:'fixture-source',target:'source-'+i,revision:'day1',resource:'fixture-source-'+i,source:'fixture-only',priority:10,maxMs:1000}));
 await scenario('source-failures',failures,async()=>({status:'failed',retryMs:3600000}));
 await scenario('retry-heavy-next-window',failures.map(j=>({...j,revision:'day2'})),async()=>{throw Error('Backoff must prevent this adapter call');});
 await scenario('unresponsive-adapter', [{kind:'fixture-hang',target:'one',revision:'one',resource:'hang',priority:1,maxMs:20}],()=>new Promise(()=>{}));
 writeFileSync(new URL('./dispatcher-scenarios.json',import.meta.url),JSON.stringify({observedAt:new Date().toISOString(),scope:'In-memory scheduler/receipt fixtures. Durations exclude real collectors, model research, production databases and PC sleep. Not a live-session SLA or throughput certification.',rows},null,2));
 console.log(JSON.stringify(rows.map(r=>({name:r.name,status:r.status,calls:r.adapterCalls,reused:r.counts.reused,durationMs:r.durationMs}))));
}finally{db.close();}
