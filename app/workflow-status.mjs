import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
export function workflowStatus(root){const path=join(root,'data/operations/workflow.sqlite');if(!existsSync(path))return {status:'NOT_STARTED',activation:false,note:'Incremental dispatcher installed; no run recorded. Scheduled reviews are controlled separately.'};
 const db=new DatabaseSync(path,{readOnly:true});try{const r=db.prepare('SELECT * FROM workflow_runs ORDER BY started_at DESC,rowid DESC LIMIT 1').get();return {status:r?.status||'NOT_STARTED',runId:r?.id||null,workload:r?.workload||null,startedAt:r?.started_at||null,finishedAt:r?.finished_at||null,report:r?.report?JSON.parse(r.report):null,unfinished:db.prepare("SELECT kind,target,status,next_retry FROM workflow_jobs WHERE status!='succeeded' ORDER BY priority,created_at LIMIT 100").all(),activation:false};}finally{db.close();}}
