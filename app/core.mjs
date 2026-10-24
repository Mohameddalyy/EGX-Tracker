import {cairoDate,captureFinality,isConfirmedBar,barFinality,sessionPolicy} from './finality.mjs';
export {cairoDate};
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {priceLevels} from './levels.mjs';
import {replay} from './replay.mjs';
import {initWatchlist} from './watchlist.mjs';
export const names={COMI:'Commercial International Bank',AMOC:'Alexandria Mineral Oils',SWDY:'Elsewedy Electric'};

export function validateBars(bars){
 if(!Array.isArray(bars)||!bars.length)throw Error('No daily bars returned');
 let previous=-Infinity;
 for(const b of bars){if(!['time','open','high','low','close','volume'].every(k=>Number.isFinite(b[k])))throw Error('Missing or nonnumeric OHLCV');if(b.time<=previous)throw Error('Duplicate or unordered bar timestamps');previous=b.time;if(b.low<=0||b.low>Math.min(b.open,b.close)||b.high<Math.max(b.open,b.close)||b.high<b.low||b.volume<0)throw Error('Invalid price range or volume');}
}
export function indicators(bars){
 const avg=a=>a.reduce((s,x)=>s+x,0)/a.length;
 const sma=n=>bars.length>=n?avg(bars.slice(-n).map(b=>b.close)):null;
 let rv=null,atr=null;
 if(bars.length>=21){const a=bars.slice(-21,-1).map(b=>b.volume).sort((a,b)=>a-b);const median=(a[9]+a[10])/2;if(median>0)rv=bars.at(-1).volume/median;}
 if(bars.length>=15){const tr=bars.slice(1).map((b,i)=>Math.max(b.high-b.low,Math.abs(b.high-bars[i].close),Math.abs(b.low-bars[i].close)));atr=avg(tr.slice(0,14));for(const x of tr.slice(14))atr=(atr*13+x)/14;}
 return {sma20:sma(20),sma50:sma(50),rv20:rv,atr14:atr,version:'1.0',method:'RV20: latest volume / median of 20 previous observations. ATR14: Wilder smoothing, seeded with first 14 true ranges. History gaps must be reviewed.'};
}
export function openDb(path){
 if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});const db=new DatabaseSync(path);db.exec(`PRAGMA busy_timeout=5000;PRAGMA journal_mode=WAL;PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS stocks(ticker TEXT PRIMARY KEY,name TEXT NOT NULL,horizon TEXT NOT NULL DEFAULT 'Unassigned',notes TEXT NOT NULL DEFAULT '',metadata TEXT NOT NULL DEFAULT '{}',retrieved_at TEXT);
 CREATE TABLE IF NOT EXISTS bars(ticker TEXT NOT NULL,day TEXT NOT NULL,time INTEGER NOT NULL,open REAL,high REAL,low REAL,close REAL,volume REAL,PRIMARY KEY(ticker,day),FOREIGN KEY(ticker) REFERENCES stocks(ticker));
 CREATE TABLE IF NOT EXISTS runs(id INTEGER PRIMARY KEY,at TEXT,status TEXT,message TEXT,payload TEXT);
 CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,at TEXT,ticker TEXT,kind TEXT,detail TEXT);`);
 for(const [t,n]of Object.entries(names))db.prepare('INSERT OR IGNORE INTO stocks(ticker,name) VALUES(?,?)').run(t,n);
 initWatchlist(db);
 db.exec('CREATE TABLE IF NOT EXISTS bar_captures(ticker TEXT,day TEXT,captured_at TEXT,PRIMARY KEY(ticker,day)); CREATE TABLE IF NOT EXISTS migrations(name TEXT PRIMARY KEY)');
 if(!db.prepare('PRAGMA table_info(bar_captures)').all().some(c=>c.name==='finality'))db.exec('ALTER TABLE bar_captures ADD COLUMN finality TEXT');
 if(!db.prepare("SELECT name FROM migrations WHERE name='capture-finality-v1'").get()){
  db.exec('BEGIN');try{
   const put=db.prepare('INSERT INTO bar_captures(ticker,day,captured_at) VALUES(?,?,?) ON CONFLICT(ticker,day) DO UPDATE SET captured_at=excluded.captured_at');
   for(const run of db.prepare("SELECT payload FROM runs WHERE status='success' AND payload IS NOT NULL ORDER BY id").all()){
    const p=JSON.parse(run.payload);
    for(const s of p.stocks)for(const b of s.history.bars){
     const day=cairoDate(new Date(b.time*1000)), current=db.prepare('SELECT * FROM bars WHERE ticker=? AND day=?').get(s.ticker,day);
     if(current&&['time','open','high','low','close','volume'].every(k=>current[k]===b[k]))put.run(s.ticker,day,p.retrieved_at);
    }
   }
   db.prepare("INSERT INTO migrations VALUES('capture-finality-v1')").run();db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
 }
 return db;
}
export function ingest(db,payload){
 const at=payload.retrieved_at;if(!at||!Number.isFinite(Date.parse(at)))throw Error('Missing valid capture time');
 if(!Array.isArray(payload.stocks)||!payload.stocks.length)throw Error('No stocks received');
 const seen=new Set();for(const s of payload.stocks){if(!db.prepare('SELECT ticker FROM stocks WHERE ticker=?').get(s.ticker)||seen.has(s.ticker))throw Error('Unexpected or duplicate ticker');seen.add(s.ticker);validateBars(s.history?.bars);if(s.missingRawVolume?.length)throw Error('Raw volume is missing');const meta=s.adjustment;const symbol=meta?.symbolExt?.symbol;if(symbol!==s.ticker)throw Error('Series identity mismatch');if(meta?.properties?.dividendsAdjustment!==false)throw Error('Dividend adjustment changed; review before importing');if(meta?.symbolInfo?.currency_code!==db.prepare('SELECT currency FROM stocks WHERE ticker=?').get(s.ticker).currency)throw Error('Unexpected currency');const old=db.prepare('SELECT metadata,retrieved_at FROM stocks WHERE ticker=?').get(s.ticker);if(old.retrieved_at&&Date.parse(at)<Date.parse(old.retrieved_at))throw Error('Older capture cannot overwrite newer data');}
 db.exec('BEGIN IMMEDIATE');let count=0;
 try{const put=db.prepare('INSERT INTO bars VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(ticker,day) DO UPDATE SET time=excluded.time,open=excluded.open,high=excluded.high,low=excluded.low,close=excluded.close,volume=excluded.volume');
 for(const s of payload.stocks){const dates=new Set();for(const b of s.history.bars){const day=cairoDate(new Date(b.time*1000));if(dates.has(day))throw Error('Duplicate session date');dates.add(day);put.run(s.ticker,day,b.time,b.open,b.high,b.low,b.close,b.volume);db.prepare('INSERT INTO bar_captures(ticker,day,captured_at,finality) VALUES(?,?,?,?) ON CONFLICT(ticker,day) DO UPDATE SET captured_at=excluded.captured_at,finality=excluded.finality').run(s.ticker,day,at,JSON.stringify(captureFinality(day,at,s.adjustment)));count++;}db.prepare('UPDATE stocks SET metadata=?,retrieved_at=? WHERE ticker=?').run(JSON.stringify(s.adjustment),at,s.ticker);}
 db.prepare('INSERT INTO runs(at,status,message,payload) VALUES(?,?,?,?)').run(new Date().toISOString(),'success',`${count} observations upserted; source capture ${at}`,JSON.stringify(payload));db.exec('COMMIT');return count;
 }catch(e){db.exec('ROLLBACK');throw e;}
}
export function snapshot(db,tickers=null,now=new Date()){
 const today=cairoDate(now);return {now:now.toISOString(),today,finalityPolicy:sessionPolicy,stocks:db.prepare('SELECT * FROM stocks ORDER BY ticker').all().filter(s=>tickers?tickers.includes(s.ticker):s.watched).map(s=>{const metadata=JSON.parse(s.metadata);const bars=db.prepare('SELECT b.*,c.captured_at,c.finality FROM bars b LEFT JOIN bar_captures c ON b.ticker=c.ticker AND b.day=c.day WHERE b.ticker=? ORDER BY b.day').all(s.ticker);const complete=bars.filter(b=>isConfirmedBar(b,now));const holidays=new Set((metadata.symbolInfo?.session_holidays||'').split(','));let gaps=[];for(let i=1;i<bars.length;i++){for(let t=Date.parse(bars[i-1].day)+86400000;t<Date.parse(bars[i].day);t+=86400000){const d=new Date(t),day=d.toISOString().slice(0,10);if(![5,6].includes(d.getUTCDay())&&!holidays.has(day.replaceAll('-','')))gaps.push(day);}}
 const last=complete.at(-1),previous=complete.at(-2);return {...s,metadata,bars,latest:last,latestFinality:barFinality(last,now),provisional:complete.length!==bars.length,unconfirmed:bars.filter(b=>!complete.includes(b)).map(b=>b.day),change:last&&previous?(last.close/previous.close-1)*100:null,indicators:indicators(complete),levels:priceLevels(complete,indicators(complete).atr14,today,now),replay:replay(complete,indicators,[...gaps,...bars.filter(b=>!complete.includes(b)).map(b=>b.day)]),gaps,captureAgeHours:s.retrieved_at?(now.getTime()-Date.parse(s.retrieved_at))/3600000:null};}),runs:db.prepare('SELECT id,at,status,message FROM runs ORDER BY id DESC LIMIT 12').all(),events:db.prepare('SELECT * FROM events ORDER BY id DESC LIMIT 20').all()};
}




