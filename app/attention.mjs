import {createHash} from 'node:crypto';
const cairoDay=t=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));
export function attentionCandidates(state,entries,now=Date.now()){
 const alerts=[];
 const add=(ticker,kind,title,detail,evidence,planId=null)=>{
  const key=createHash('sha256').update(JSON.stringify({ticker,kind,evidence,planId})).digest('hex');
  alerts.push({key,ticker,kind,title,detail,evidence,planId});
 };
 for(const s of state.stocks.filter(s=>s.active)){
  const age=s.retrieved_at?(now-Date.parse(s.retrieved_at))/3600000:Infinity;
  if(!s.bars.length)add(s.ticker,'data','History not loaded','Refresh TradingView to validate this symbol.',{capture:s.retrieved_at});
  else if(age>24)add(s.ticker,'data','Capture is stale','Capture is over 24 hours old. Price and volume flags are withheld until refreshed.',{capturedAt:s.retrieved_at});
  if(s.unconfirmed.length)add(s.ticker,'data','Bars awaiting confirmation','These dates need a fresh capture after the session cutoff, or on a later date, before they enter daily calculations.',{dates:s.unconfirmed});
  if(s.gaps.length)add(s.ticker,'data','History gaps need review','Dates outside the provider holiday calendar are missing.',{dates:s.gaps});
  if(age>24||!s.latest)continue;
  const b=s.latest,atr=s.indicators.atr14;
  for(const kind of ['support','resistance']){
   const z=s.levels[kind][0];if(!z||!(atr>0))continue;
   const distance=Math.max(z.low-b.close,b.close-z.high,0);
   if(distance<=.5*atr)add(s.ticker,'price',`Close near ${kind}`,'Confirmed daily close is within 0.5 ATR14 of the nearest zone; this is proximity, not a predicted reversal.',{day:b.day,close:b.close,zoneLow:z.low,zoneHigh:z.high,distance,threshold:.5*atr,atr14:atr});
  }
  if(s.indicators.rv20>=2)add(s.ticker,'volume','Unusually high daily volume','Confirmed daily volume is at least twice the median of the previous 20 observations.',{day:b.day,volume:b.volume,rv20:s.indicators.rv20,threshold:2});
  for(const e of entries.filter(e=>e.ticker===s.ticker)){
   if(['Cancelled','Closed (reported)','Stopped (reported)','Target reached (reported)'].includes(e.reviews[0]?.status))continue;
   // Same-session OHLC cannot establish whether a touch occurred after saving a plan.
   const after=s.bars.filter(b=>b.day>cairoDay(e.created_at)&&Date.parse(b.captured_at)>Date.parse(e.created_at));
   const hit=after.find(b=>b.low<=e.plan.stop||b.high>=e.plan.target);if(!hit)continue;
   const stop=hit.low<=e.plan.stop,target=hit.high>=e.plan.target;
   add(s.ticker,'plan',`Plan #${e.id}: ${stop&&target?'both levels touched':stop?'stop level touched':'target level touched'}`,
    'A session after plan creation touched the saved level. This is a price observation, not a verified fill. Same-day touches are excluded; when both levels are touched, order is unknown.',
    {day:hit.day,low:hit.low,high:hit.high,stop:e.plan.stop,target:e.plan.target,confirmed:!s.unconfirmed.includes(hit.day)},e.id);
  }
 }
 // Import failures remain discoverable even when later imports succeed for other stocks.
 for(const r of state.runs.filter(r=>r.status==='failed'))add(null,'import','Import failure recorded',r.message,{runId:r.id,at:r.at});
 return alerts;
}
export function initAttention(db){db.exec(`CREATE TABLE IF NOT EXISTS attention(key TEXT PRIMARY KEY,payload TEXT NOT NULL,first_seen TEXT NOT NULL,last_seen TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,reviewed_at TEXT);`);}
export function syncAttention(db,candidates,now=new Date().toISOString()){
 db.exec('BEGIN');try{
  db.exec('UPDATE attention SET active=0');
  const put=db.prepare('INSERT INTO attention(key,payload,first_seen,last_seen) VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,last_seen=excluded.last_seen,active=1');
  for(const a of candidates)put.run(a.key,JSON.stringify(a),now,now);
  db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
 return db.prepare('SELECT * FROM attention ORDER BY active DESC,first_seen DESC,key').all().map(r=>({...JSON.parse(r.payload),firstSeen:r.first_seen,lastSeen:r.last_seen,active:!!r.active,reviewedAt:r.reviewed_at}));
}
export function reviewAttention(db,key,reviewed){
 if(typeof key!=='string'||!/^[a-f0-9]{64}$/.test(key)||typeof reviewed!=='boolean')throw Error('Invalid attention item');
 const result=db.prepare('UPDATE attention SET reviewed_at=? WHERE key=?').run(reviewed?new Date().toISOString():null,key);if(!result.changes)throw Error('Attention item not found');
}
