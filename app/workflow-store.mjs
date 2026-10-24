import {DatabaseSync} from 'node:sqlite';
import {randomUUID,createHash} from 'node:crypto';
export const workflowHash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function openWorkflow(path){const db=new DatabaseSync(path);db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL');initWorkflow(db);return db;}
export function initWorkflow(db){db.exec(`
 CREATE TABLE IF NOT EXISTS workflow_runs(id TEXT PRIMARY KEY,workload TEXT NOT NULL,planned_at TEXT NOT NULL,started_at TEXT NOT NULL,deadline_at TEXT NOT NULL,finished_at TEXT,status TEXT NOT NULL,owner TEXT NOT NULL,pid INTEGER NOT NULL,report TEXT);
 CREATE TABLE IF NOT EXISTS workflow_jobs(id TEXT PRIMARY KEY,kind TEXT NOT NULL,target TEXT NOT NULL,revision TEXT NOT NULL,resource TEXT NOT NULL,priority INTEGER NOT NULL,status TEXT NOT NULL,payload TEXT NOT NULL,created_at TEXT NOT NULL,started_at TEXT,finished_at TEXT,owner TEXT,pid INTEGER,child_pid INTEGER,attempts INTEGER NOT NULL DEFAULT 0,next_retry TEXT,result TEXT);
 CREATE UNIQUE INDEX IF NOT EXISTS workflow_resource_owner ON workflow_jobs(resource) WHERE status='running';
 CREATE TABLE IF NOT EXISTS workflow_run_jobs(run_id TEXT NOT NULL,job_id TEXT NOT NULL,PRIMARY KEY(run_id,job_id));
 CREATE TABLE IF NOT EXISTS workflow_receipts(job_id TEXT PRIMARY KEY,at TEXT NOT NULL,result TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS workflow_events(id INTEGER PRIMARY KEY,at TEXT NOT NULL,job_id TEXT,kind TEXT NOT NULL,detail TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS workflow_retry_scopes(scope TEXT PRIMARY KEY,failures INTEGER NOT NULL,next_retry TEXT NOT NULL);
`);}
function retryScope(job){const p=typeof job.payload==='string'?JSON.parse(job.payload):job.payload;return p?.source?workflowHash([job.kind,job.kind==='exchange'?'all-windows':job.kind==='documents'?(p.routes||[]).map(r=>r.url).sort():job.target]):job.id;}
export function workflowEvent(db,jobId,kind,detail,now=new Date()){db.prepare('INSERT INTO workflow_events(at,job_id,kind,detail) VALUES(?,?,?,?)').run(now.toISOString(),jobId,kind,JSON.stringify(detail));}
export function beginWorkflow(db,{workload,plannedAt,deadlineMs,pid=process.pid},now=new Date()){
 if(!Number.isFinite(deadlineMs)||deadlineMs<=0||!Number.isFinite(Date.parse(plannedAt))||Date.parse(plannedAt)>+now)throw Error('Valid actual schedule and deadline required');
 const run={id:'workflow-'+randomUUID(),owner:randomUUID(),pid,workload,plannedAt,startedAt:now.toISOString(),deadlineAt:new Date(+now+deadlineMs).toISOString()};
 db.prepare("INSERT INTO workflow_runs VALUES(?,?,?,?,?,NULL,'running',?,?,NULL)").run(run.id,workload,plannedAt,run.startedAt,run.deadlineAt,run.owner,pid);return run;
}
export function registerJobs(db,run,jobs,now=new Date()){
 db.exec('BEGIN IMMEDIATE');try{for(const job of jobs){const id=workflowHash([job.kind,job.target,job.revision]);
 db.prepare("INSERT OR IGNORE INTO workflow_jobs(id,kind,target,revision,resource,priority,status,payload,created_at) VALUES(?,?,?,?,?,?,'pending',?,?)").run(id,job.kind,job.target,job.revision,job.resource,job.priority,JSON.stringify(job),now.toISOString());
 db.prepare('INSERT OR IGNORE INTO workflow_run_jobs VALUES(?,?)').run(run.id,id);
 }db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
}
export function claimJob(db,id,run,now=new Date()){
 db.exec('BEGIN IMMEDIATE');try{const job=db.prepare('SELECT * FROM workflow_jobs WHERE id=?').get(id);
 if(!job||['succeeded','running'].includes(job.status)||Date.parse(job.next_retry)>+now||Date.parse(db.prepare('SELECT next_retry FROM workflow_retry_scopes WHERE scope=?').get(retryScope(job))?.next_retry)>+now||db.prepare("SELECT 1 FROM workflow_jobs WHERE resource=? AND status='running'").get(job.resource)){db.exec('COMMIT');return null;}
 db.prepare("UPDATE workflow_jobs SET status='running',owner=?,pid=?,child_pid=NULL,started_at=?,finished_at=NULL,attempts=attempts+1 WHERE id=?").run(run.owner,run.pid,now.toISOString(),id);workflowEvent(db,id,'claimed',{runId:run.id,owner:run.owner},now);db.exec('COMMIT');return {...job,started_at:now.toISOString(),payload:JSON.parse(job.payload),attempts:job.attempts+1};
 }catch(e){db.exec('ROLLBACK');throw e;}
}
export function recordChild(db,id,owner,pid){if(!db.prepare("UPDATE workflow_jobs SET child_pid=? WHERE id=? AND status='running' AND owner=?").run(pid,id,owner).changes)throw Error('Job ownership lost');}
export function finishJob(db,id,owner,result,now=new Date()){
 if(!['succeeded','partial','failed','blocked','timeout'].includes(result.status))throw Error('Explicit job disposition required');
 db.exec('BEGIN IMMEDIATE');try{const job=db.prepare("SELECT * FROM workflow_jobs WHERE id=? AND status='running' AND owner=?").get(id,owner);if(!job)throw Error('Job ownership lost');
 const scope=retryScope(job),failures=(db.prepare('SELECT failures FROM workflow_retry_scopes WHERE scope=?').get(scope)?.failures||0)+1;
 const retry=result.status==='succeeded'?null:new Date(+now+(result.retryMs??Math.min(86400000,60000*2**Math.min(failures-1,10)))).toISOString();
 const saved={...result,attempt:job.attempts,consecutiveScopeFailures:result.status==='succeeded'?0:failures,persistentUnavailable:failures>=3&&result.status!=='succeeded'};
 if(retry)db.prepare('INSERT OR REPLACE INTO workflow_retry_scopes VALUES(?,?,?)').run(scope,failures,retry);else db.prepare('DELETE FROM workflow_retry_scopes WHERE scope=?').run(scope);
 db.prepare('UPDATE workflow_jobs SET status=?,finished_at=?,child_pid=NULL,next_retry=?,result=? WHERE id=?').run(result.status,now.toISOString(),retry,JSON.stringify(saved),id);
 if(result.status==='succeeded')db.prepare('INSERT OR REPLACE INTO workflow_receipts VALUES(?,?,?)').run(id,now.toISOString(),JSON.stringify(saved));
 workflowEvent(db,id,result.status,saved,now);db.exec('COMMIT');return saved;
 }catch(e){db.exec('ROLLBACK');throw e;}
}
export function invalidateRetry(db,id,{actor,reason,evidenceId},now=new Date()){
 if(!actor?.trim()||!reason?.trim()||!evidenceId?.trim())throw Error('Actor, reason and new evidence identifier required');
 const job=db.prepare('SELECT * FROM workflow_jobs WHERE id=?').get(id);if(!job||['running','succeeded'].includes(job.status))throw Error('Only unowned unsuccessful jobs can invalidate backoff');
 db.exec('BEGIN IMMEDIATE');try{db.prepare("UPDATE workflow_jobs SET status='pending',next_retry=NULL WHERE id=?").run(id);db.prepare('DELETE FROM workflow_retry_scopes WHERE scope=?').run(retryScope(job));workflowEvent(db,id,'backoff-invalidated',{actor,reason,evidenceId},now);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
}
export function recoverJob(db,id,{owner,actor,reason,isAlive},now=new Date()){
 const job=db.prepare('SELECT * FROM workflow_jobs WHERE id=?').get(id);
 if(!job||job.status!=='running'||job.owner!==owner||!actor?.trim()||!reason?.trim())throw Error('Exact owner and explicit recovery record required');
 if(isAlive(job.pid)||job.child_pid&&isAlive(job.child_pid))throw Error('Existing owner or child is alive; no takeover');
 db.exec('BEGIN IMMEDIATE');try{db.prepare("UPDATE workflow_jobs SET status='pending',owner=NULL,pid=NULL,child_pid=NULL,next_retry=NULL WHERE id=? AND owner=?").run(id,owner);workflowEvent(db,id,'explicit-recovery',{actor,reason,previousOwner:owner,previousStartedAt:job.started_at},now);
 db.prepare("UPDATE workflow_runs SET status='interrupted',finished_at=? WHERE owner=? AND status='running'").run(now.toISOString(),owner);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
}
export function runJobs(db,runId){return db.prepare('SELECT j.* FROM workflow_jobs j JOIN workflow_run_jobs r ON r.job_id=j.id WHERE r.run_id=? ORDER BY j.priority,j.created_at,j.id').all(runId).map(j=>({...j,next_retry:j.status==='succeeded'?null:[j.next_retry,db.prepare('SELECT next_retry FROM workflow_retry_scopes WHERE scope=?').get(retryScope(j))?.next_retry].filter(Boolean).sort().at(-1)||null,payload:JSON.parse(j.payload),result:j.result?JSON.parse(j.result):null}));}
export function recoverWorkflow(db,id,{owner,actor,reason,isAlive},now=new Date()){
 const run=db.prepare('SELECT * FROM workflow_runs WHERE id=?').get(id);if(!run||run.owner!==owner||run.status!=='running'||!actor?.trim()||!reason?.trim())throw Error('Exact run owner, actor and recovery reason required');
 if(isAlive(run.pid)||db.prepare("SELECT child_pid FROM workflow_jobs WHERE owner=? AND status='running'").all(owner).some(j=>j.child_pid&&isAlive(j.child_pid)))throw Error('Run owner or child still alive');
 db.prepare("UPDATE workflow_runs SET status='interrupted',finished_at=? WHERE id=? AND owner=?").run(now.toISOString(),id,owner);workflowEvent(db,null,'run-recovery',{runId:id,owner,actor,reason},now);
 // Jobs retain their own recovery obligations; successful receipts are never erased.
}
export function finishWorkflow(db,run,report,now=new Date()){db.prepare("UPDATE workflow_runs SET status=?,finished_at=?,report=? WHERE id=? AND owner=? AND status='running'").run(report.status,now.toISOString(),JSON.stringify(report),run.id,run.owner);}
