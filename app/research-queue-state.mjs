import {randomUUID} from 'node:crypto';
export const activeResearchStates=['pending','researching','awaiting_decision'];
export const waitingResearchStates=['waiting_event','retry_not_due','waiting_capacity'];
export function initResearchQueueState(db){db.exec(`CREATE TABLE IF NOT EXISTS research_claims(queue_id TEXT PRIMARY KEY,owner TEXT NOT NULL,token TEXT NOT NULL,claimed_at TEXT NOT NULL,expires_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS research_waits(queue_id TEXT PRIMARY KEY,previous_status TEXT NOT NULL,reason TEXT NOT NULL,resume_at TEXT,event_fingerprint TEXT); CREATE TABLE IF NOT EXISTS research_queue_events(id INTEGER PRIMARY KEY,queue_id TEXT NOT NULL,at TEXT NOT NULL,actor TEXT NOT NULL,kind TEXT NOT NULL,detail TEXT NOT NULL);`);}
export const activeResearchCount=db=>db.prepare("SELECT COUNT(*) n FROM research_queue WHERE status IN ('pending','researching','awaiting_decision')").get().n;
function log(db,id,actor,kind,detail,now){db.prepare('INSERT INTO research_queue_events(queue_id,at,actor,kind,detail) VALUES(?,?,?,?,?)').run(id,now.toISOString(),actor,kind,JSON.stringify(detail));}
export function claimResearch(db,id,owner,now=new Date()){
 if(!owner?.trim())throw Error('Named claim owner required');initResearchQueueState(db);db.exec('BEGIN IMMEDIATE');try{
 const q=db.prepare('SELECT * FROM research_queue WHERE id=?').get(id);if(q?.status!=='pending')throw Error('Candidate not pending; existing claim needs explicit recovery');
 const token=randomUUID(),expiry=new Date(+now+24*3600000).toISOString();db.prepare('INSERT OR REPLACE INTO research_claims VALUES(?,?,?,?,?)').run(id,owner,token,now.toISOString(),expiry);db.prepare("UPDATE research_queue SET status='researching',updated_at=? WHERE id=?").run(now.toISOString(),id);log(db,id,owner,'claimed',{expiresAt:expiry},now);db.exec('COMMIT');return {claimed:id,owner,token,expiresAt:expiry};
 }catch(e){db.exec('ROLLBACK');throw e;}
}
export function waitResearch(db,id,{actor,token,reason,resumeAt=null,eventFingerprint=null},now=new Date()){
 if(!actor?.trim()||!reason?.trim()||(!resumeAt&&!eventFingerprint)||resumeAt&&!Number.isFinite(Date.parse(resumeAt)))throw Error('Explicit wait reason and valid time or evidence fingerprint required');initResearchQueueState(db);db.exec('BEGIN IMMEDIATE');try{
 const q=db.prepare('SELECT * FROM research_queue WHERE id=?').get(id),claim=db.prepare('SELECT * FROM research_claims WHERE queue_id=?').get(id);
 if(!q||!activeResearchStates.includes(q.status)||q.status==='researching'&&(!claim||claim.token!==token))throw Error('Only the recorded owner may release a research claim');
 const status=eventFingerprint?'waiting_event':'retry_not_due';db.prepare('INSERT OR REPLACE INTO research_waits VALUES(?,?,?,?,?)').run(id,q.status==='researching'?'pending':q.status,reason,resumeAt,eventFingerprint);db.prepare('UPDATE research_queue SET status=?,updated_at=? WHERE id=?').run(status,now.toISOString(),id);db.prepare('DELETE FROM research_claims WHERE queue_id=?').run(id);log(db,id,actor,status,{reason,resumeAt,eventFingerprint},now);db.exec('COMMIT');return {id,status};
 }catch(e){db.exec('ROLLBACK');throw e;}
}
export function recoverResearch(db,id,{actor,reason,previousOwner,abandonedConfirmed},now=new Date()){
 initResearchQueueState(db);db.exec('BEGIN IMMEDIATE');try{const q=db.prepare('SELECT * FROM research_queue WHERE id=?').get(id),c=db.prepare('SELECT * FROM research_claims WHERE queue_id=?').get(id);
 if(q?.status!=='researching'||!actor?.trim()||!reason?.trim()||abandonedConfirmed!==true||previousOwner!==(c?.owner||'legacy-unrecorded-owner'))throw Error('Exact previous owner and explicit abandoned-owner confirmation required');
 if(c&&Date.parse(c.expires_at)>+now)throw Error('Claim lease remains current; use the owner release instead');
 // Expiry is an attention signal, never an automatic takeover. The operator explicitly verifies abandonment.
 db.prepare("UPDATE research_queue SET status='pending',updated_at=? WHERE id=?").run(now.toISOString(),id);db.prepare('DELETE FROM research_claims WHERE queue_id=?').run(id);log(db,id,actor,'explicit-recovery',{reason,previousOwner},now);db.exec('COMMIT');return {id,status:'pending'};
 }catch(e){db.exec('ROLLBACK');throw e;}
}
export function resumeResearch(db,fingerprints={},now=new Date()){
 initResearchQueueState(db);db.exec('BEGIN IMMEDIATE');try{const resumed=[];
 for(const q of db.prepare("SELECT q.*,w.previous_status,w.resume_at,w.event_fingerprint FROM research_queue q LEFT JOIN research_waits w ON w.queue_id=q.id WHERE q.status IN ('waiting_event','retry_not_due','waiting_capacity') ORDER BY q.created_at,q.id").all()){
 if(activeResearchCount(db)>=5)break;
 const due=q.status==='waiting_capacity'||q.resume_at&&Date.parse(q.resume_at)<=+now||q.event_fingerprint&&fingerprints[q.ticker]&&q.event_fingerprint!==fingerprints[q.ticker];if(!due)continue;
 const status=q.previous_status==='awaiting_decision'?'awaiting_decision':'pending';db.prepare('UPDATE research_queue SET status=?,updated_at=? WHERE id=?').run(status,now.toISOString(),q.id);log(db,q.id,'dispatcher','wait-resumed',{previousStatus:q.status,fingerprint:fingerprints[q.ticker]||null},now);db.prepare('DELETE FROM research_waits WHERE queue_id=?').run(q.id);resumed.push(q.id);
 }db.exec('COMMIT');return resumed;}catch(e){db.exec('ROLLBACK');throw e;}
}
