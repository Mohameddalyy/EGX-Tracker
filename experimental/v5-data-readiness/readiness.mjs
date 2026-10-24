// Isolated pre-Phase4 component. No network, production database or trade access.
import {createHash} from 'node:crypto';
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
export const digest=x=>createHash('sha256').update(JSON.stringify(canonical(x))).digest('hex');
const time=x=>typeof x==='string'?Date.parse(x):NaN;
const validHash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const assert=(ok,message)=>{if(!ok)throw Error(message);};

export function taskIdentity(task){
 for(const k of ['instrumentId','component','targetKey','dependencyKey'])assert(typeof task[k]==='string'&&task[k].length,'Missing '+k);
 return digest({instrumentId:task.instrumentId,component:task.component,targetKey:task.targetKey,dependencyKey:task.dependencyKey});
}

// The caller supplies an authoritative expected session: no weekday/holiday guessing.
// Plans include every requested component; deferral never removes it from coverage.
export function planRefresh({requests,cache=[],now,calendar}){
 assert(Number.isFinite(time(now)),'Invalid planning time');
 const priorities={HELD:0,APPROVED:1,DECISION:2,CANDIDATE:3,UNREVIEWED:4};
 const rows=requests.map(request=>{
  const r={...request};
  assert(['session','interval','revision'].includes(r.kind),'Unsupported freshness kind');
  assert(typeof r.dependencyKey==='string'&&r.dependencyKey.length,'Explicit dependency version required');
  assert(!r.eventIds||Array.isArray(r.eventIds)&&r.eventIds.every(x=>typeof x==='string'&&x.length),'Invalid event IDs');
  if(r.kind==='session'){
   const day=calendar?.expectedCompletedSession;
   if(!calendar?.verified||!/^\d{4}-\d{2}-\d{2}$/.test(day||'')||!Number.isFinite(time(day))||new Date(day).toISOString().slice(0,10)!==day||time(day)>time(now))return {...r,status:'BLOCKED_CALENDAR',reason:'Expected completed session is unverified or invalid'};
   r.targetKey=calendar.expectedCompletedSession;
  }
  if(r.kind==='interval')assert(Number.isFinite(time(r.from))&&time(r.through)>=time(r.from)&&time(r.through)<=time(now),'Invalid requested coverage interval');
  r.eventIds=[...new Set(r.eventIds||[])].sort();
  r.dependencyKey=digest({inputs:r.dependencyKey,events:r.eventIds});
  const id=taskIdentity(r);
  const matching=cache.filter(c=>c.taskId===id&&c.verified===true&&validHash(c.evidenceHash)&&Number.isFinite(time(c.observedAt))&&time(c.observedAt)<=time(now));
  const reusable=matching.find(c=>r.kind!=='interval'||c.coverageComplete===true&&time(c.coveredFrom)<=time(r.from)&&time(c.coveredThrough)>=time(r.through));
  return {...r,id,status:reusable?'REUSE':'FETCH_DELTA',reason:reusable?'Verified matching component and dependency version':'Missing, invalidated or incomplete component',evidenceHash:reusable?.evidenceHash??null,priority:priorities[r.obligation]??4};
 });
 const unique=new Map();
 for(const row of rows){const key=row.id||digest(row);const old=unique.get(key);if(!old||row.priority<old.priority)unique.set(key,row);}
 const components=[...unique.values()].sort((a,b)=>(a.priority??4)-(b.priority??4)||String(a.id).localeCompare(String(b.id)));
 return {at:now,components,counts:{requested:requests.length,unique:components.length,reused:components.filter(x=>x.status==='REUSE').length,fetch:components.filter(x=>x.status==='FETCH_DELTA').length,blocked:components.filter(x=>x.status.startsWith('BLOCKED')).length},authorizesTrading:false};
}

// Field requirements must come from a reviewed strategy/stage contract, not an LLM
// reclassification during an opportunity. This function never approves a trade.
export function assessEvidence({requirements,observations={},stage,claims=[],sector,now}){
 assert(Number.isFinite(time(now)),'Invalid assessment time');
 const rows=requirements.map(r=>{
  assert(['critical','conditional','important','optional'].includes(r.importance),'Unknown field importance');
  assert(Array.isArray(r.stages)&&r.stages.length&&r.id,'Invalid field contract');
  const o=observations[r.id];
  const base={field:r.id,attempts:o?.attempts||[],evidenceHash:o?.evidenceHash??null};
  if(!r.stages.includes(stage))return {...base,outcome:'NOT_REQUIRED_FOR_STAGE',reason:'Requirement belongs to '+r.stages.join(', ')};
  if(r.notApplicableSectors?.includes(sector))return {...base,outcome:'NOT_APPLICABLE',reason:'Predeclared sector rule: '+sector};
  const reliedUpon=(r.requiredForClaims||[]).some(c=>claims.includes(c));
  const critical=r.importance==='critical'||r.importance==='conditional'&&reliedUpon;
  const valid=o?.status==='VERIFIED'&&o.value!==null&&o.value!==undefined&&validHash(o.evidenceHash)&&Number.isFinite(time(o.observedAt))&&time(o.observedAt)<=time(now)&&Number.isFinite(time(o.validThrough))&&time(o.validThrough)>=time(now)&&o.equivalentQuality===true;
  if(valid)return {...base,outcome:'VERIFIED',value:o.value,reason:'Admitted evidence; direct or verified equivalent fallback',sourceRoute:o.sourceRoute};
  // A proxy is explicitly degraded; it is never silently equivalent evidence.
  const reason=o?.status==='CONFLICTED'?'Unresolved conflicting evidence':o?.status==='PROXY'?'Proxy is not equivalent evidence':'Missing, invalid, stale or unverified evidence';
  const outcome=critical?'BLOCK_DEPENDENT_STEP':r.importance==='optional'||r.importance==='conditional'&&!reliedUpon?'OMIT_OPTIONAL':'DEGRADED_REVIEW';
  return {...base,outcome,reason,requiredClaim:reliedUpon,repair:{routes:r.fallbacks||[],nextAttempt:o?.nextAttempt??null},retainedValue:o?.value??null};
 });
 return {stage,rows,blockedFields:rows.filter(x=>x.outcome==='BLOCK_DEPENDENT_STEP').map(x=>x.field),importantGaps:rows.filter(x=>x.outcome==='DEGRADED_REVIEW').map(x=>x.field),canContinueIndependentResearch:true,authorizesTrading:false,rule:'No stock is deleted or rejected as an investment by this assessment; only the named dependent step is blocked.'};
}

// Pass a separate SQLite database. There is deliberately no production DB opener.
// Evidence+checkpoint commit together; original attempts and captures are retained.
export class WorkJournal {
 constructor(db){
  this.db=db;
  db.exec(`CREATE TABLE IF NOT EXISTS readiness_tasks(id TEXT PRIMARY KEY,descriptor TEXT NOT NULL,state TEXT NOT NULL,owner TEXT,generation INTEGER NOT NULL DEFAULT 0,lease_until TEXT,next_attempt TEXT);
   CREATE TABLE IF NOT EXISTS readiness_attempts(id INTEGER PRIMARY KEY,task_id TEXT NOT NULL,at TEXT NOT NULL,generation INTEGER NOT NULL,status TEXT NOT NULL,detail TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS readiness_evidence(task_id TEXT NOT NULL,evidence_hash TEXT NOT NULL,observed_at TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(task_id,evidence_hash));`);
 }
 register(task){const id=taskIdentity(task);this.db.prepare("INSERT OR IGNORE INTO readiness_tasks(id,descriptor,state) VALUES(?,?,'PENDING')").run(id,JSON.stringify(task));return id;}
 list(){return this.db.prepare('SELECT * FROM readiness_tasks ORDER BY id').all();}
 transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const out=fn();this.db.exec('COMMIT');return out;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 claim(id,owner,now,leaseMs,{reconciledExpiredOwner=false}={}){
  assert(owner&&Number.isFinite(time(now))&&Number.isFinite(leaseMs)&&leaseMs>0,'Invalid claim');
  return this.transaction(()=>{
   const r=this.db.prepare('SELECT * FROM readiness_tasks WHERE id=?').get(id);assert(r,'Unknown task');
   if(r.state==='DONE')return null;
   if(r.next_attempt&&time(r.next_attempt)>time(now))return null;
   if(r.state==='RUNNING'){
    assert(time(r.lease_until)<=time(now),'Active owner retains claim');
    assert(reconciledExpiredOwner,'Expired owner must be explicitly reconciled before recovery');
   }
   const token={id,owner,generation:r.generation+1};
   this.db.prepare("UPDATE readiness_tasks SET state='RUNNING',owner=?,generation=?,lease_until=?,next_attempt=NULL WHERE id=?").run(owner,token.generation,new Date(time(now)+leaseMs).toISOString(),id);
   return token;
  });
 }
 finish(token,{at,status,payload,detail='',nextAttempt=null}){
  assert(['VERIFIED','UNAVAILABLE','PARTIAL','FAILED'].includes(status),'Invalid completion');
  assert(Number.isFinite(time(at)),'Invalid completion time');
  if(status==='VERIFIED'){assert(payload!==undefined&&payload!==null,'Verified evidence payload required');assert(nextAttempt===null,'Completed work cannot silently schedule repair');}
  if(status!=='VERIFIED')assert(Number.isFinite(time(nextAttempt))&&time(nextAttempt)>time(at),'Unfinished work needs a future repair time');
  return this.transaction(()=>{
   const r=this.db.prepare('SELECT * FROM readiness_tasks WHERE id=?').get(token.id);
   assert(r?.state==='RUNNING'&&r.owner===token.owner&&r.generation===token.generation&&time(r.lease_until)>=time(at),'Expired or fenced worker cannot commit');
   let evidenceHash=null;
   if(payload!==undefined&&payload!==null){evidenceHash=digest(payload);this.db.prepare('INSERT OR IGNORE INTO readiness_evidence VALUES(?,?,?,?)').run(token.id,evidenceHash,at,JSON.stringify(payload));}
   this.db.prepare('INSERT INTO readiness_attempts(task_id,at,generation,status,detail) VALUES(?,?,?,?,?)').run(token.id,at,token.generation,status,detail);
   this.db.prepare('UPDATE readiness_tasks SET state=?,owner=NULL,lease_until=NULL,next_attempt=? WHERE id=?').run(status==='VERIFIED'?'DONE':'REPAIR',nextAttempt,token.id);
   return {evidenceHash,state:status==='VERIFIED'?'DONE':'REPAIR'};
  });
 }
}
