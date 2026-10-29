import {basketOverviews} from './basket-registry.mjs';
import {cairoDate} from '../finality.mjs';
import {clientOperations} from './client-operations.mjs';
import {DatabaseSync} from 'node:sqlite';
import {existsSync,readFileSync,mkdirSync,writeFileSync,renameSync,realpathSync} from 'node:fs';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {randomUUID} from 'node:crypto';
import {hash,required,nonempty,timestamp} from './contract.mjs';
import {readEvaluationLedger} from './evaluation-ledger.mjs';
import {transition} from './execution.mjs';
import {ledgerCards,candidateCard,checkpointSummary} from './client-cards.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const directory=root=>join(root,'data','v5-client');
export function registry(root){const p=join(directory(root),'registry.json');return existsSync(p)?read(p):{ledgers:[],candidates:[]};}
export function registeredLedger(root,id){const row=registry(root).ledgers.find(r=>r.id===id);required(row,'Unknown registered ledger');const base=realpathSync(root),p=realpathSync(resolve(root,row.path)),r=relative(base,p);required(r&&!r.startsWith('..')&&!isAbsolute(r),'Ledger must remain inside workspace');return {...row,path:p};}
export function clientOverview(root,at=new Date().toISOString()){
 const r=registry(root),ledgers=r.ledgers.map(entry=>{try{const target=registeredLedger(root,entry.id),audit=readEvaluationLedger(target.path);return {id:entry.id,label:entry.label||entry.id,paused:audit.state.paused,sequence:audit.state.sequence,stateHash:audit.stateHash,status:audit.transitionReplay,controlsEnabled:entry.allowControls===true,cards:ledgerCards(audit,at)};}catch(e){return {id:entry.id,status:'UNAVAILABLE',error:e.message,cards:[]};}});
 const reportsPath=join(directory(root),'latest-checkpoint.json'),baskets=basketOverviews(root,cairoDate(new Date(at)));
 return {at,baskets,operations:clientOperations(root,new Date(at)),schedules:'Not changed by this interface; scheduled reviews remain separately paused.',activation:false,realOrders:false,ledgers,candidates:[...(r.candidates||[]),...latestCandidates(root)].map(c=>candidateCard(c,at)),checkpoint:existsSync(reportsPath)?read(reportsPath):null,emptyReason:!r.ledgers.length&&!baskets.length?'No engineering ledger registered. Historical experiments are not automatically enrolled.':null};
}
// Read snapshot, then lock and compare it inside the same transaction that records the intervention.
// This preserves the execution engine's immutable event/hash semantics without changing that release.
export function controlLedger(path,{kind,actor,reason,expectedStateHash,orderId},now=new Date()){
 required(['PAUSE','CANCEL'].includes(kind),'Only pause or cancel is supported; no resume, force-fill or rule bypass');required(nonempty(actor)&&nonempty(reason)&&reason.length<=2000,'Actor and reason required');
 const audit=readEvaluationLedger(path);required(audit.transitionReplay==='VERIFIED'&&audit.stateHash===expectedStateHash,'Ledger changed; refresh before intervention');
 const event={id:'client-'+randomUUID(),type:kind==='PAUSE'?'SET_PAUSE':'CANCEL',at:now.toISOString(),data:{...(kind==='PAUSE'?{paused:true}:{orderId}),reason,clientIntervention:{actor,reason,kind,effect:kind==='PAUSE'?'Block new entries and cancel pending entry eligibility; keep exit/mark/reconciliation duties.':'Cancel future entry eligibility; reconcile delayed observations and retain any existing exposure.',attribution:'USER_INTERVENED_KEEP_SEPARATE'}}};
 const db=new DatabaseSync(path);try{db.exec('PRAGMA busy_timeout=5000; BEGIN IMMEDIATE');try{
  const before=JSON.parse(db.prepare('SELECT json FROM v5_state WHERE id=1').get().json);required(hash(before)===expectedStateHash,'Ledger changed during intervention');
  const previous=db.prepare('SELECT eventHash FROM v5_events ORDER BY sequence DESC LIMIT 1').get()?.eventHash||hash(audit.config),next=transition(before,event),stateHash=hash(next.state),eventHash=hash({previousHash:previous,event,stateHash});
  db.prepare('INSERT INTO v5_events VALUES(?,?,?,?,?,?,?)').run(next.state.sequence,event.id,JSON.stringify(event),previous,eventHash,stateHash,JSON.stringify(next.result));db.prepare('UPDATE v5_state SET json=? WHERE id=1').run(JSON.stringify(next.state));db.exec('COMMIT');return {event,result:next.result,stateHash,policyInputsChanged:false,activation:false};
 }catch(e){db.exec('ROLLBACK');throw e;}}finally{db.close();}
}
export function saveCheckpoint(root,report,now=new Date()){
 const dir=directory(root);mkdirSync(join(dir,'checkpoints'),{recursive:true});const latest=join(dir,'latest-checkpoint.json'),previous=existsSync(latest)?read(latest):null;
 const value=checkpointSummary(report,now.toISOString(),previous),id=hash({report,deliveredAt:value.deliveredAt}),full={...value,id,evidenceLink:'/api/client/checkpoint?id='+id};
 const output={summary:full,report};writeFileSync(join(dir,'checkpoints',id+'.json'),JSON.stringify(output,null,2)+'\n',{flag:'wx'});const temp=latest+'.'+randomUUID()+'.tmp';writeFileSync(temp,JSON.stringify(full,null,2)+'\n');renameSync(temp,latest);return full;
}
export function getCheckpoint(root,id){required(/^[a-f0-9]{64}$/.test(id),'Invalid checkpoint id');return read(join(directory(root),'checkpoints',id+'.json'));}
function clientDb(root){mkdirSync(directory(root),{recursive:true});const db=new DatabaseSync(join(directory(root),'client.sqlite'));db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS events(sequence INTEGER PRIMARY KEY, id TEXT UNIQUE, kind TEXT, at TEXT, payload TEXT, previousHash TEXT, eventHash TEXT)');return db;}
function append(db,kind,payload,now){const at=now.toISOString(),id=randomUUID(),previousHash=db.prepare('SELECT eventHash FROM events ORDER BY sequence DESC LIMIT 1').get()?.eventHash||'GENESIS',e={id,kind,at,payload,previousHash};const eventHash=hash(e);db.prepare('INSERT INTO events(id,kind,at,payload,previousHash,eventHash) VALUES(?,?,?,?,?,?)').run(id,kind,at,JSON.stringify(payload),previousHash,eventHash);return {...e,eventHash};}
export function clientHistory(root){const p=join(directory(root),'client.sqlite');if(!existsSync(p))return [];const db=new DatabaseSync(p,{readOnly:true});try{let previous='GENESIS';return db.prepare('SELECT * FROM events ORDER BY sequence').all().map(row=>{const e={id:row.id,kind:row.kind,at:row.at,payload:JSON.parse(row.payload),previousHash:row.previousHash};required(e.previousHash===previous&&hash(e)===row.eventHash,'Client history hash mismatch');previous=row.eventHash;return {...e,eventHash:row.eventHash};});}finally{db.close();}}
export function recordNote(root,{actor,reason,target,effect},now=new Date()){
 required([actor,reason,target].every(nonempty)&&['ANNOTATION_ONLY','DEFER_RESEARCH'].includes(effect),'Actor, reason, target and safe effect required');const db=clientDb(root);try{db.exec('BEGIN IMMEDIATE');const e=append(db,'USER_NOTE',{actor,reason,target,effect,entryAuthorization:false,policyMutation:false},now);db.exec('COMMIT');return e;}finally{db.close();}
}
export function acceptanceCases(root){const p=join(root,'verification','w8-client-20261026','acceptance-cases.json');return read(p);}
export function startComprehension(root,{participant,caseId},now=new Date()){
 required(nonempty(participant),'Human participant name required');const cases=acceptanceCases(root),c=cases.find(c=>c.id===caseId);required(c,'Unknown acceptance case');
 const db=clientDb(root);try{db.exec('BEGIN IMMEDIATE');const e=append(db,'COMPREHENSION_START',{participant,caseId,cardHash:hash(c.card),card:c.card,interfaceVersion:'W8-CLIENT-2',protocol:'Five original free-text fields; <=120 seconds per card; human answers required.'},now);db.exec('COMMIT');return {attemptId:e.id,startedAt:e.at,card:c.card,limitSeconds:120,fields:['action','timing','size','invalidation','uncertainty']};}finally{db.close();}
}
export function answerComprehension(root,{attemptId,answers},now=new Date()){
 const history=clientHistory(root),start=history.find(e=>e.id===attemptId&&e.kind==='COMPREHENSION_START');required(start,'Unknown attempt');required(['action','timing','size','invalidation','uncertainty'].every(k=>nonempty(answers?.[k])&&answers[k].length<=4000),'Answer all five fields in your own words');const elapsedMs=+now-Date.parse(start.at);required(elapsedMs>=0,'Clock precedes attempt');
 const db=clientDb(root);try{db.exec('BEGIN IMMEDIATE');const prior=db.prepare("SELECT payload FROM events WHERE kind='COMPREHENSION_ANSWER'").all();required(!prior.some(e=>JSON.parse(e.payload).attemptId===attemptId),'Answer already recorded; start a new attempt');const e=append(db,'COMPREHENSION_ANSWER',{attemptId,participant:start.payload.participant,caseId:start.payload.caseId,cardHash:start.payload.cardHash,answers,elapsedMs,withinLimit:elapsedMs<=120000,disposition:'AWAITING_REVIEW'},now);db.exec('COMMIT');return e;}finally{db.close();}
}
export function reviewComprehension(root,{answerId,reviewer,ratings,evidence},now=new Date()){
 const h=clientHistory(root),a=h.find(e=>e.id===answerId&&e.kind==='COMPREHENSION_ANSWER');required(!h.some(e=>e.kind==='COMPREHENSION_CLASSIFICATION'&&e.payload.answerId===answerId),'Form-only submissions cannot count as comprehension');required(a&&nonempty(reviewer)&&reviewer!==a.payload.participant&&nonempty(evidence),'Separate reviewer and answer-based evidence required');required(['action','timing','size','invalidation','uncertainty'].every(k=>typeof ratings?.[k]==='boolean'),'Explicit five-field ratings required');const db=clientDb(root);try{db.exec('BEGIN IMMEDIATE');required(!db.prepare("SELECT payload FROM events WHERE kind='COMPREHENSION_REVIEW'").all().some(e=>JSON.parse(e.payload).answerId===answerId),'Review already recorded');const e=append(db,'COMPREHENSION_REVIEW',{answerId,reviewer,ratings,evidence,passed:a.payload.withinLimit&&Object.values(ratings).every(x=>x===true)},now);db.exec('COMMIT');return e;}finally{db.close();}
}
export function comprehensionStatus(root){const history=clientHistory(root),cases=acceptanceCases(root),participants=[...new Set(history.filter(e=>e.kind==='COMPREHENSION_START').map(e=>e.payload.participant))];const results=participants.map(participant=>({participant,cases:cases.map(c=>{const answers=history.filter(e=>e.kind==='COMPREHENSION_ANSWER'&&!history.some(c=>c.kind==='COMPREHENSION_CLASSIFICATION'&&c.payload.answerId===e.id)&&e.payload.participant===participant&&e.payload.caseId===c.id&&e.payload.cardHash===hash(c.card));const reviewed=answers.map(a=>({answer:a,review:history.find(e=>e.kind==='COMPREHENSION_REVIEW'&&e.payload.answerId===a.id)}));return {caseId:c.id,attempts:reviewed.length,passed:reviewed.some(x=>x.review?.payload.passed===true)};})}));return {status:results.some(r=>r.cases.length===5&&r.cases.every(c=>c.passed))?'PASSED':'PENDING_CLIENT_ACCEPTANCE',results,activation:false};}

function latestCandidates(root){const latest=new Map();for(const e of clientHistory(root).filter(e=>e.kind==='CANDIDATE_PUBLICATION'))latest.set(e.payload.record.id,e.payload.record);return [...latest.values()];}
export function publishCandidates(root,records,now=new Date()){
 required(Array.isArray(records)&&records.length>0,'Nonempty candidate publication required');for(const r of records)candidateCard(r,now.toISOString());const db=clientDb(root);try{db.exec('BEGIN IMMEDIATE');const entries=records.map(record=>append(db,'CANDIDATE_PUBLICATION',{record,originalRecordHash:hash(record)},now));db.exec('COMMIT');return entries;}finally{db.close();}
}
export function registerClientLedger(root,record){
 required(/^[a-zA-Z0-9_-]+$/.test(record.id)&&nonempty(record.path)&&nonempty(record.label)&&typeof record.allowControls==='boolean','Explicit ID, path, label and controls flag required');const r=registry(root);required(!r.ledgers.some(e=>e.id===record.id),'Ledger ID already registered');
 const p=realpathSync(resolve(root,record.path)),rel=relative(realpathSync(root),p);required(rel&&!rel.startsWith('..')&&!isAbsolute(rel),'Ledger must remain inside workspace');const audit=readEvaluationLedger(p);required(audit.transitionReplay==='VERIFIED','Matching-release replay required');
 r.ledgers.push({id:record.id,label:record.label,path:rel,allowControls:record.allowControls,registeredAt:new Date().toISOString(),initialStateHash:audit.stateHash});mkdirSync(directory(root),{recursive:true});const target=join(directory(root),'registry.json'),temp=target+'.'+randomUUID()+'.tmp';writeFileSync(temp,JSON.stringify(r,null,2)+'\n');renameSync(temp,target);return {registered:record.id,activation:false};
}

export function classifyFormTest(root,{answerId,actor,reason},now=new Date()){
 const h=clientHistory(root);required(h.some(e=>e.id===answerId&&e.kind==='COMPREHENSION_ANSWER')&&nonempty(actor)&&nonempty(reason),'Original answer, actor and explicit user clarification required');required(!h.some(e=>e.kind==='COMPREHENSION_REVIEW'&&e.payload.answerId===answerId),'Cannot reclassify a scored review');const db=clientDb(root);try{db.exec('BEGIN IMMEDIATE');const e=append(db,'COMPREHENSION_CLASSIFICATION',{answerId,actor,reason,classification:'PLACEHOLDER_FORM_TEST_NOT_ACCEPTANCE'},now);db.exec('COMMIT');return e;}finally{db.close();}
}
