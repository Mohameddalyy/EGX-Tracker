import {randomUUID} from 'node:crypto';
import {researchCoverage} from './paper-performance.mjs';
export const operationsStart='2026-10-15';
export function cairoParts(now){return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));}
export function cairoDue(day){
 const target=Date.parse(day+'T22:00:00Z');let utc=target;
 for(let i=0;i<3;i++){const p=cairoParts(new Date(utc));utc+=target-Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);}
 return new Date(utc).toISOString();
}
export function eveningSlots(now=new Date()){
 const p=cairoParts(now),day=`${p.year}-${p.month}-${p.day}`,slots=[];
 for(let i=-7;i<=7;i++){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+i);const date=d.toISOString().slice(0,10);if(date>=operationsStart&&![5,6].includes(d.getUTCDay()))slots.push({day:date,dueAt:cairoDue(date)});}
 return slots;
}
export function initOperations(db){db.exec(`CREATE TABLE IF NOT EXISTS operations_runs(id TEXT PRIMARY KEY,slot TEXT NOT NULL,started_at TEXT NOT NULL,updated_at TEXT NOT NULL,finished_at TEXT,status TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',report_path TEXT); CREATE UNIQUE INDEX IF NOT EXISTS operations_one_running ON operations_runs(status) WHERE status='running'; CREATE TABLE IF NOT EXISTS operations_checks(id INTEGER PRIMARY KEY,at TEXT NOT NULL,service TEXT NOT NULL,status TEXT NOT NULL,note TEXT NOT NULL);`);}
export function operationSchedule(db,now=new Date()){
 const runs=db.prepare('SELECT * FROM operations_runs ORDER BY started_at DESC').all();
 const slots=eveningSlots(now).map(s=>{const attempts=runs.filter(r=>r.slot===s.day),last=attempts[0],due=Date.parse(s.dueAt)<=+now;return {...s,last,attempts:attempts.length,status:last?(last.status==='running'&&+now-Date.parse(last.updated_at)>30*60000?'stalled':last.status):due?(+now-Date.parse(s.dueAt)>15*60000?'missed':'due'):'scheduled',minutesLate:last?Math.max(0,(Date.parse(last.started_at)-Date.parse(s.dueAt))/60000):null};});
 return {timezone:'Africa/Cairo',target:'22:00 Sunday–Thursday',trackingSince:operationsStart,slots,next:slots.find(s=>Date.parse(s.dueAt)>+now)??null};
}
export function beginOperation(db,now=new Date()){
 initOperations(db);db.exec('BEGIN IMMEDIATE');try{
 const active=db.prepare("SELECT * FROM operations_runs WHERE status='running'").get();
 if(active){db.exec('COMMIT');return {started:false,reason:'An existing run owns the workflow; inspect it before recovery',active};}
 const latest=operationSchedule(db,now).slots.filter(s=>Date.parse(s.dueAt)<=+now).at(-1);
 if(!latest||+now-Date.parse(latest.dueAt)>12*3600000||['completed','skipped'].includes(latest.status)){db.exec('COMMIT');return {started:false,reason:'No recoverable evening review due; old missed runs remain visible'};}
 if(latest.last&&+now-Date.parse(latest.last.finished_at)<30*60000){db.exec('COMMIT');return {started:false,reason:'Blocked-run retry cooldown (30 minutes)'};}
 const id=randomUUID(),at=now.toISOString();db.prepare("INSERT INTO operations_runs(id,slot,started_at,updated_at,status) VALUES(?,?,?,?,'running')").run(id,latest.day,at,at);db.exec('COMMIT');return {started:true,id,slot:latest.day,dueAt:latest.dueAt,actualStartedAt:at,minutesLate:Math.max(0,(+now-Date.parse(latest.dueAt))/60000)};
 }catch(e){db.exec('ROLLBACK');throw e;}
}
export function updateOperation(db,id,status,note='',reportPath=null,now=new Date()){
 if(!['running','completed','blocked','interrupted','skipped'].includes(status))throw Error('Invalid status');
 if(status!=='running'&&!note.trim())throw Error('An outcome explanation is required');
 if(status==='completed'&&!reportPath)throw Error('Completed reviews require a report path');
 const at=now.toISOString(),result=db.prepare("UPDATE operations_runs SET updated_at=?,finished_at=?,status=?,note=?,report_path=? WHERE id=? AND status='running'").run(at,status==='running'?null:at,status,note,reportPath,id);
 if(!result.changes)throw Error('Run is not active; original outcomes cannot be rewritten');return {id,status,at};
}
export function operationsState(db,now=new Date()){
 initOperations(db);const coverage=researchCoverage(db);
 return {generatedAt:now.toISOString(),schedule:operationSchedule(db,now),coverage,collections:{catalog:db.prepare('SELECT MAX(source_at) at FROM market_catalog').get().at,history:db.prepare('SELECT MAX(retrieved_at) at FROM stocks').get().at,facts:db.prepare('SELECT MAX(captured_at) at FROM market_facts').get().at},checks:db.prepare('SELECT * FROM operations_checks ORDER BY id DESC LIMIT 12').all(),recentRuns:db.prepare('SELECT * FROM operations_runs ORDER BY started_at DESC LIMIT 12').all(),importer:db.prepare('SELECT * FROM market_jobs ORDER BY id DESC LIMIT 1').get()??null,waiting:db.prepare("SELECT ticker,status,updated_at,note FROM research_queue WHERE status NOT IN ('completed','dismissed','decision_recorded') ORDER BY updated_at DESC LIMIT 20").all(),limitation:'Collection timestamps are not proof of complete or valid market data. Chart connectivity does not pass preflight. Local PC and Codex must be running.'};
}
