import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,realpathSync} from 'node:fs';
import {dirname,resolve,relative,isAbsolute} from 'node:path';
export const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
export const finite=x=>typeof x==='number'&&Number.isFinite(x);
export function requireValue(ok,message){if(!ok)throw Error(message);}
export function validTime(x){return typeof x==='string'&&Number.isFinite(Date.parse(x));}
export function openAnalysis(path){
 if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});const db=new DatabaseSync(path);
 db.exec(`PRAGMA journal_mode=WAL;PRAGMA busy_timeout=5000;CREATE TABLE IF NOT EXISTS analysis_records(id TEXT PRIMARY KEY,kind TEXT NOT NULL,ticker TEXT,recorded_at TEXT NOT NULL,payload TEXT NOT NULL,digest TEXT NOT NULL,UNIQUE(kind,digest));CREATE INDEX IF NOT EXISTS analysis_kind_ticker ON analysis_records(kind,ticker,recorded_at);`);return db;
}
export function appendRecord(db,kind,payload,now=new Date()){
 const digest=hash(payload),id=payload.id||kind+'-'+digest.slice(0,24),old=db.prepare('SELECT * FROM analysis_records WHERE id=? OR (kind=? AND digest=?)').get(id,kind,digest);
 if(old){requireValue(old.kind===kind&&old.digest===digest,'Immutable record identity conflicts with saved evidence');return {id:old.id,duplicate:true};}
 db.prepare('INSERT INTO analysis_records VALUES(?,?,?,?,?,?)').run(id,kind,payload.ticker||null,now.toISOString(),JSON.stringify(payload),digest);return {id,duplicate:false};
}
export function records(db,kind,ticker=null,asOf=new Date()){
 return db.prepare('SELECT * FROM analysis_records WHERE kind=? AND recorded_at<=? ORDER BY recorded_at,rowid').all(kind,asOf.toISOString()).filter(r=>!ticker||r.ticker===ticker).map(r=>({...JSON.parse(r.payload),recordId:r.id,recordedAt:r.recorded_at,digest:r.digest}));
}
export function getRecord(db,id){const r=db.prepare('SELECT * FROM analysis_records WHERE id=?').get(id);return r?{...JSON.parse(r.payload),recordId:r.id,recordedAt:r.recorded_at,digest:r.digest,kind:r.kind}:null;}
export function safeArtifact(root,path){
 const base=realpathSync(resolve(root,'data','research','evidence')),target=realpathSync(resolve(root,path)),rel=relative(base,target);
 requireValue(!rel.startsWith('..')&&!isAbsolute(rel),'Source artifacts must stay inside data/research/evidence');return target;
}
export function saveDocument(db,root,d,now=new Date()){
 requireValue(/^[A-Z][A-Z0-9-]{1,23}$/.test(d.ticker)&&typeof d.title==='string'&&d.title.trim(),'Document requires ticker and title');
 const u=new URL(d.url),policy=JSON.parse(readFileSync(resolve(root,'research','source-policy.json'),'utf8'));
 requireValue(['http:','https:'].includes(u.protocol)&&!u.username&&!u.password&&!policy.excludedDomains.some(h=>u.hostname===h||u.hostname.endsWith('.'+h)),'Document source is excluded or invalid');
 requireValue(validTime(d.publishedAt)&&validTime(d.accessedAt)&&Date.parse(d.publishedAt)<=Date.parse(d.accessedAt)&&Date.parse(d.accessedAt)<=+now,'Publication/access timestamps must be verified and not future');
 requireValue(['issuer','exchange','regulator','TradingView','primary-research'].includes(d.sourceType),'Explicit authoritative source type required');
 requireValue(typeof d.text==='string'&&d.text.trim()||typeof d.artifactPath==='string','Saved document text or local evidence artifact required');
 let artifactDigest=null;if(d.artifactPath)artifactDigest=hash(readFileSync(safeArtifact(root,d.artifactPath)).toString('base64'));
 return appendRecord(db,'document',{...d,artifactDigest,textDigest:d.text?hash(d.text):null},now);
}
export function knownDocument(db,id,ticker,now=new Date()){
 const d=getRecord(db,id);requireValue(d?.kind==='document'&&d.ticker===ticker&&Date.parse(d.recordedAt)<=+now&&Date.parse(d.publishedAt)<=+now,'Matching point-in-time source document required');return d;
}
