import {test} from 'node:test';import assert from 'node:assert/strict';
import {openDb,ingest} from './core.mjs';import {changeWatchlist} from './watchlist.mjs';
test('new tickers ingest; pause and resume preserve history and notes',()=>{
 const db=openDb(':memory:');changeWatchlist(db,{action:'add',ticker:'tmgh',name:'Test label'});
 ingest(db,{retrieved_at:'2026-10-07T01:00:00Z',stocks:[{ticker:'TMGH',history:{bars:[{time:1700000000,open:10,high:12,low:9,close:11,volume:100}]},adjustment:{symbolExt:{symbol:'TMGH'},symbolInfo:{currency_code:'EGP'},properties:{dividendsAdjustment:false}}}]});
 db.prepare("UPDATE stocks SET notes='Preserve' WHERE ticker='TMGH'").run();changeWatchlist(db,{action:'pause',ticker:'TMGH'});
 assert.equal(db.prepare("SELECT active FROM stocks WHERE ticker='TMGH'").get().active,0);
 changeWatchlist(db,{action:'resume',ticker:'TMGH'});assert.equal(db.prepare("SELECT notes FROM stocks WHERE ticker='TMGH'").get().notes,'Preserve');assert.equal(db.prepare('SELECT COUNT(*) n FROM bars').get().n,1);db.close();
});
test('reject invalid symbols and duplicates; support more than twenty watched stocks',()=>{
 const db=openDb(':memory:');for(const ticker of ['EGX:COMI','COMI','../ABC',"A';DROP"] )assert.throws(()=>changeWatchlist(db,{action:'add',ticker,name:'Test'}));
 for(let i=0;i<25;i++)changeWatchlist(db,{action:'add',ticker:'X'+i,name:'Test'});
 changeWatchlist(db,{action:'pause',ticker:'COMI'});changeWatchlist(db,{action:'resume',ticker:'COMI'});assert.equal(db.prepare('SELECT COUNT(*) n FROM stocks WHERE watched=1 AND active=1').get().n,28);db.close();
});
