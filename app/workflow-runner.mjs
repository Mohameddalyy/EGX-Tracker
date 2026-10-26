import {performance} from 'node:perf_hooks';
import {claimJob,registerJobs,finishJob,runJobs,finishWorkflow,workflowEvent} from './workflow-store.mjs';
// Child adapters must honor cancellation and return only after child termination.
// A nonresponsive adapter remains owned/running for explicit recovery; the report still closes.
export async function executeWorkflow(db,run,plan,{execute,clock=()=>new Date(),monotonic=()=>performance.now(),checkpoint=()=>{},replan=null}={}){
 const start=monotonic(),budget=Date.parse(run.deadlineAt)-Date.parse(run.startedAt),counts={fetched:0,reused:0,deferred:0,failed:0};
 registerJobs(db,run,plan.jobs,clock());let refreshed=false;const visited=new Set();
 async function flush(status){const jobs=runJobs(db,run.id),observedAt=clock().toISOString(),latenessMs=Math.max(0,Date.parse(observedAt)-Date.parse(run.deadlineAt)),report={version:'incremental-workflow-1',runId:run.id,workload:run.workload,status,plannedAt:run.plannedAt,startedAt:run.startedAt,observedAt,deadlineAt:run.deadlineAt,deadlineMissed:latenessMs>0,latenessMs,startDelayMs:Math.max(0,Date.parse(run.startedAt)-Date.parse(run.plannedAt)),durationMs:monotonic()-start,counts:{...counts},coverage:plan.counts||null,obligations:plan.obligations,sourceGaps:plan.sourceGaps,minuteTargets:plan.minuteTargets,jobs:jobs.map(j=>({id:j.id,kind:j.kind,target:j.target,status:j.status,startedAt:j.started_at,finishedAt:j.finished_at,nextRetry:j.next_retry,critical:j.payload.critical,blockedBy:(j.payload.dependsOn||[]).filter(id=>!db.prepare("SELECT 1 FROM workflow_receipts WHERE job_id=?").get(id)),result:j.result,owner:j.status==='running'?j.owner:null,childPid:j.child_pid})),model:null,provider:null,modelTokens:null,telemetry:'No model invocation in this dispatcher; provider/model usage unmeasured, not zero',entryAuthorization:false,limitation:'Checkpoint completion is not research completion, event clearance, execution or an investment disposition.'};db.prepare("UPDATE workflow_runs SET report=? WHERE id=? AND owner=? AND status='running'").run(JSON.stringify(report),run.id,run.owner);await checkpoint(report);return report;}
 try{
 while(true){
  const remaining=Math.min(budget-(monotonic()-start),Date.parse(run.deadlineAt)-+clock());if(remaining<=0)break;
  const next=runJobs(db,run.id).find(j=>!visited.has(j.id));
  if(!next){if(replan&&!refreshed){refreshed=true;const updated=await replan();plan=updated;registerJobs(db,run,updated.jobs,clock());continue;}break;}
  visited.add(next.id);
  if(next.status==='succeeded'){counts.reused++;continue;}
  if(next.payload.dependsOn?.some(key=>!db.prepare("SELECT 1 FROM workflow_jobs WHERE id=? AND status='succeeded'").get(key))){counts.deferred++;continue;}
  const job=claimJob(db,next.id,run,clock());if(!job){counts.deferred++;continue;}
  const controller=new AbortController(),stageStart=monotonic();let timer;
  const allowed=Math.min(remaining,job.payload.maxMs??remaining);
  const task=Promise.resolve().then(()=>execute(job,{signal:controller.signal,budgetMs:allowed,owner:run.owner}));
  // Always observe the adapter rejection even after its checkpoint deadline.
  task.catch(()=>{});
  const timeout=new Promise(resolve=>{timer=setTimeout(()=>{controller.abort();resolve({status:'timeout',incident:'COMPUTATIONAL_OVERRUN',message:'Stage deadline; cancellation requested, ownership retained until child termination',unsettled:true});},allowed);});
  let result;
  try{result=await Promise.race([task,timeout]);}catch(e){result={status:'failed',incident:e.incident||'TOOL_OR_PROVIDER_FAILURE',message:e.message};}finally{clearTimeout(timer);}
  result={...result,durationMs:Math.max(0,monotonic()-stageStart)};
  if(result.unsettled){workflowEvent(db,job.id,'deadline-cancellation',result,clock());counts.failed++;await flush('partial');break;}
  finishJob(db,job.id,run.owner,result,clock());
  if(result.status==='succeeded')counts.fetched+=result.fetched??1;else counts.failed++;
  await flush('running');
  if(replan&&['document-discovery','exchange','documents','history','facts','facts-repair','catalog','catalog-import'].includes(job.kind)&&['succeeded','partial'].includes(result.status)){plan=await replan();registerJobs(db,run,plan.jobs,clock());}
 }
 const pending=runJobs(db,run.id).filter(j=>j.status!=='succeeded');counts.deferred=Math.max(counts.deferred,pending.length);
 const report=await flush(pending.length||plan.sourceGaps?.length?'partial':'completed');finishWorkflow(db,run,report,clock());return report;
 }catch(error){workflowEvent(db,null,'dispatcher-failure',{runId:run.id,message:error.message},clock());const report=await flush('failed');finishWorkflow(db,run,report,clock());throw error;}
}
