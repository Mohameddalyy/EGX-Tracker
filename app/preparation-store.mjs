import {createHash} from 'node:crypto';
export const contentHash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
export function initPreparation(db){db.exec(`CREATE TABLE IF NOT EXISTS preparation_attempts(id INTEGER PRIMARY KEY,ticker TEXT NOT NULL,component TEXT NOT NULL,target TEXT NOT NULL,at TEXT NOT NULL,status TEXT NOT NULL,next_retry TEXT,detail TEXT NOT NULL,raw_path TEXT);
 CREATE INDEX IF NOT EXISTS preparation_attempt_lookup ON preparation_attempts(ticker,component,target,id);
 CREATE TABLE IF NOT EXISTS preparation_receipts(component TEXT NOT NULL,target TEXT NOT NULL,at TEXT NOT NULL,status TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(component,target));`);}
export function attempt(db,{ticker,component='history',target,at,status,detail='',rawPath=null,retryMs=86400000}){
 db.prepare('INSERT INTO preparation_attempts(ticker,component,target,at,status,next_retry,detail,raw_path) VALUES(?,?,?,?,?,?,?,?)').run(ticker,component,target,at,status,status==='verified'?null:new Date(Date.parse(at)+retryMs).toISOString(),detail,rawPath);
}
export function repairDue(db,ticker,target,now=new Date()){
 const a=db.prepare("SELECT * FROM preparation_attempts WHERE ticker=? AND component='history' AND target=? ORDER BY id DESC LIMIT 1").get(ticker,target);
 return !a||a.status==='verified'||!a.next_retry||Date.parse(a.next_retry)<=+now;
}
export function receipt(db,component,target,payload,now=new Date(),status='completed'){
 db.prepare('INSERT INTO preparation_receipts VALUES(?,?,?,?,?) ON CONFLICT(component,target) DO UPDATE SET at=excluded.at,status=excluded.status,payload=excluded.payload').run(component,target,now.toISOString(),status,JSON.stringify(payload));
}
export function receiptFor(db,component,target){const r=db.prepare('SELECT * FROM preparation_receipts WHERE component=? AND target=?').get(component,target);return r?{...r,payload:JSON.parse(r.payload)}:null;}
