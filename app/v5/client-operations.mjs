import {DatabaseSync} from 'node:sqlite';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
export function clientOperations(root,now=new Date()){
 const path=join(root,'data/operations/workflow.sqlite');if(!existsSync(path))return {status:'NOT_STARTED',plannedAt:null,actualStart:null,obligations:[],unfinished:[],unfinishedCount:0,coverage:null,nextAction:'No incremental run recorded; schedules remain separately paused.'};
 const db=new DatabaseSync(path,{readOnly:true});try{
 const r=db.prepare('SELECT * FROM workflow_runs ORDER BY started_at DESC,rowid DESC LIMIT 1').get();const report=r?.report?JSON.parse(r.report):null;
 const unfinished=db.prepare("SELECT id,kind,target,status,owner,started_at,next_retry,result FROM workflow_jobs WHERE status!='succeeded' ORDER BY priority,created_at").all().map(j=>({...j,result:j.result?JSON.parse(j.result):null}));
 return {status:r?.status||'NOT_STARTED',runId:r?.id,plannedAt:r?.planned_at,actualStart:r?.started_at,finishedAt:r?.finished_at,deadlineAt:r?.deadline_at,snapshotAt:now.toISOString(),reportObservedAt:report?.observedAt||null,unfinishedCount:unfinished.length,unfinished,currentStage:unfinished.filter(j=>j.status==='running').map(j=>({kind:j.kind,target:j.target,owner:j.owner})),obligations:(report?.obligations||[]).map(o=>({...o,overdue:typeof o.dueAt==='string'&&Number.isFinite(Date.parse(o.dueAt))?Date.parse(o.dueAt)<+now:null})),coverage:report?.coverage||null,nextAction:unfinished.length?'Inspect unfinished work, owner and retry time. Do not take over a live owner.':'Review remaining research and monitoring obligations before any activation.',recovery:r?.status==='running'&&Date.parse(r.deadline_at)<+now?'OVERDUE_RUN_VERIFY_OWNER':'No overdue active run detected',limitation:'Saved run state only. Unknown review deadlines and substantive review counts are not inferred.'};
 }finally{db.close();}
}
