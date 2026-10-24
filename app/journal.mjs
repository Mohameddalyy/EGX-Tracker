export function initJournal(db){
 db.exec(`CREATE TABLE IF NOT EXISTS journal(id INTEGER PRIMARY KEY,request_id TEXT UNIQUE NOT NULL,created_at TEXT NOT NULL,ticker TEXT NOT NULL,plan TEXT NOT NULL,evidence TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS journal_reviews(id INTEGER PRIMARY KEY,request_id TEXT UNIQUE NOT NULL,entry_id INTEGER NOT NULL REFERENCES journal(id),created_at TEXT NOT NULL,status TEXT NOT NULL,note TEXT NOT NULL);`);
}
const text=(s,max)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
const key=s=>typeof s==='string'&&/^[a-zA-Z0-9-]{16,80}$/.test(s);
export function saveDecision(db,p,stock){
 if(!key(p.requestId))throw Error('Invalid request identifier');
 const prior=db.prepare('SELECT id FROM journal WHERE request_id=?').get(p.requestId);if(prior)return prior;
 if(stock?.currency&&stock.currency!=='EGP')throw Error('Actual positions and journal plans currently support EGP shares only; USD shares can be researched separately');
 if(!stock||stock.ticker!==p.ticker||!stock.latest)throw Error('Confirmed stock history is required');
 if(p.capturedAt!==stock.retrieved_at||p.asOf!==stock.latest.day)throw Error('Source data changed. Reload the dashboard and review the plan again.');
 if(!text(p.thesis,4000)||!text(p.invalidation,2000)||!['Short term','Medium term','Long term'].includes(p.horizon))throw Error('Provide a thesis, invalidation condition and time horizon');
 if(![p.entry,p.stop,p.target].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>0)||!(p.stop<p.entry&&p.entry<p.target))throw Error('Long-position plan must satisfy 0 < stop < entry < target');
 const plan={horizon:p.horizon,thesis:p.thesis.trim(),invalidation:p.invalidation.trim(),entry:p.entry,stop:p.stop,target:p.target,rewardRisk:(p.target-p.entry)/(p.entry-p.stop)};
 const {replay,...evidence}=stock;
 const result=db.prepare('INSERT INTO journal(request_id,created_at,ticker,plan,evidence) VALUES(?,?,?,?,?)').run(p.requestId,new Date().toISOString(),p.ticker,JSON.stringify(plan),JSON.stringify(evidence));
 return {id:Number(result.lastInsertRowid)};
}
export function addReview(db,p){
 if(!key(p.requestId)||!Number.isSafeInteger(p.id)||!['Watching','Entered (reported)','Target reached (reported)','Stopped (reported)','Closed (reported)','Cancelled'].includes(p.status)||!text(p.note,4000))throw Error('Provide a valid journal entry, status and review note');
 const prior=db.prepare('SELECT id FROM journal_reviews WHERE request_id=?').get(p.requestId);if(prior)return prior;
 if(!db.prepare('SELECT id FROM journal WHERE id=?').get(p.id))throw Error('Journal entry not found');
 const result=db.prepare('INSERT INTO journal_reviews(request_id,entry_id,created_at,status,note) VALUES(?,?,?,?,?)').run(p.requestId,p.id,new Date().toISOString(),p.status,p.note.trim());return {id:Number(result.lastInsertRowid)};
}
export function journalEntries(db){return db.prepare('SELECT * FROM journal ORDER BY id DESC').all().map(r=>({...r,plan:JSON.parse(r.plan),evidence:JSON.parse(r.evidence),reviews:db.prepare('SELECT * FROM journal_reviews WHERE entry_id=? ORDER BY id DESC').all(r.id)}));}

