import {saveCheckpoint} from './v5/client-service.mjs';
import {existsSync,mkdirSync,writeFileSync,renameSync,readFileSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readWorkflowInputs} from './workflow-inputs.mjs';
import {planWorkflow,workflowLimits} from './workflow-planner.mjs';
import {openWorkflow,beginWorkflow,recoverJob,recoverWorkflow,invalidateRetry,finishWorkflow} from './workflow-store.mjs';
import {recoverSourceLock} from './workflow-recovery.mjs';
import {executeWorkflow} from './workflow-runner.mjs';
import {workflowAdapter} from './workflow-adapters.mjs';
import {processAlive} from './chart-recovery.mjs';
export async function workflowCommand(args=process.argv.slice(2),root=dirname(dirname(fileURLToPath(import.meta.url)))){
 const [command='plan',workload='checkpoint',recordPath]=args,dir=join(root,'data/operations'),path=join(dir,'workflow.sqlite');
 if(command==='plan'){const plan=planWorkflow(readWorkflowInputs(root),{workload});console.log(JSON.stringify({...plan,jobs:plan.jobs.map(j=>({kind:j.kind,target:j.target,priority:j.priority,critical:j.critical,source:j.source||'local'}))},null,2));return plan;}
 if(!['run','status','recover','recover-run','recover-lock','invalidate-retry'].includes(command))throw Error('Use plan|run baseline|screen|checkpoint; status; recover|recover-run|recover-lock|invalidate-retry ID RECORD.json');
 if(command==='status'&&!existsSync(path)){const result={status:'NOT_STARTED',schedules:'Not activated by this command'};console.log(JSON.stringify(result));return result;}
 mkdirSync(dir,{recursive:true});const db=openWorkflow(path);
 try{
 if(command==='status'){const result={runs:db.prepare('SELECT id,workload,planned_at,started_at,deadline_at,finished_at,status,owner,pid FROM workflow_runs ORDER BY started_at DESC LIMIT 10').all(),unfinished:db.prepare("SELECT id,kind,target,status,owner,pid,child_pid,next_retry,result FROM workflow_jobs WHERE status!='succeeded' ORDER BY priority,created_at").all()};console.log(JSON.stringify(result,null,2));return result;}
 if(['recover','recover-run','recover-lock','invalidate-retry'].includes(command)){const record=JSON.parse(readFileSync(recordPath,'utf8'));if(command==='recover')recoverJob(db,workload,{...record,isAlive:processAlive});else if(command==='recover-run')recoverWorkflow(db,workload,{...record,isAlive:processAlive});else if(command==='recover-lock')recoverSourceLock(db,root,{...record,source:workload,isAlive:processAlive});else invalidateRetry(db,workload,record);console.log(JSON.stringify({recorded:command,id:workload}));return;}
 if(!workflowLimits[workload])throw Error('Unknown workload');
 const now=new Date(),plannedAt=args.find(x=>x.startsWith('--planned-at='))?.slice(13)||now.toISOString(),run=beginWorkflow(db,{workload,plannedAt,deadlineMs:workflowLimits[workload].hardMs},now);
 const reports=join(dir,'workflow-reports');mkdirSync(reports,{recursive:true});const reportPath=join(reports,run.id+'.json');
 const checkpoint=report=>{writeFileSync(reportPath+'.tmp',JSON.stringify(report,null,2));renameSync(reportPath+'.tmp',reportPath);saveCheckpoint(root,report);};
 const makePlan=()=>planWorkflow(readWorkflowInputs(root),{workload,invocationAt:run.startedAt});let report;
 try{report=await executeWorkflow(db,run,makePlan(),{execute:workflowAdapter(db,root),checkpoint,replan:makePlan});}catch(error){const prior=existsSync(reportPath)?JSON.parse(readFileSync(reportPath,'utf8')):{runId:run.id,startedAt:run.startedAt,deadlineAt:run.deadlineAt,counts:null,jobs:[],obligations:[],positionStatus:'UNKNOWN: input failure is not zero holdings'};report={...prior,status:'failed',observedAt:new Date().toISOString(),message:error.message,incident:'DISPATCHER_OR_INPUT_FAILURE',entryAuthorization:false};checkpoint(report);finishWorkflow(db,run,report);}
 console.log(JSON.stringify({runId:run.id,status:report.status,counts:report.counts,durationMs:report.durationMs,obligations:report.obligations.length,pending:report.jobs.filter(j=>j.status!=='succeeded').map(j=>({kind:j.kind,target:j.target,status:j.status,critical:j.critical})),reportPath,activation:false}));return report;
 }finally{db.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))workflowCommand().catch(e=>{console.error(e.message);process.exitCode=1;});
