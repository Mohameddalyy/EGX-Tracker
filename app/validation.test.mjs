import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openDb,ingest,snapshot} from './core.mjs';
import {replay} from './replay.mjs';
test('an intraday capture stays unconfirmed after rollover; later recapture confirms it',()=>{
 const db=openDb(':memory:');
 const p={retrieved_at:'2026-10-05T10:00:00Z',stocks:[{ticker:'COMI',history:{bars:[{time:Date.parse('2026-10-05T09:00:00Z')/1000,open:10,high:12,low:9,close:11,volume:100}]},adjustment:{symbolExt:{symbol:'COMI'},symbolInfo:{currency_code:'EGP'},properties:{dividendsAdjustment:false}}}]};
 ingest(db,p);assert.equal(snapshot(db).stocks.find(s=>s.ticker==='COMI').latest,undefined);
 p.retrieved_at='2026-10-06T10:00:00Z';ingest(db,p);
 assert.equal(snapshot(db).stocks.find(s=>s.ticker==='COMI').latest.close,11);db.close();
});
const history=()=>Array.from({length:90},(_,i)=>({day:new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10),open:100,close:100,low:98,high:102}));
test('replay uses next open, stop first for ambiguous candles and subtracts costs',()=>{
 const b=history();b[40].low=95;b[42].high=110;b[50]={...b[50],low:90,high:115};
 const r=replay(b,()=>({atr14:2})).methods[0].trades[0];
 assert.equal(r.signal,b[49].day);assert.equal(r.entryDay,b[50].day);
 assert.equal(r.exit,94);assert.equal(r.ambiguous,true);assert.ok(r.net<r.gross);
});
test('future bars do not change a closed trade; entry beyond target is skipped',()=>{
 const b=history();b[40].low=95;b[42].high=110;b[50].low=90;
 const a=replay(b,()=>({atr14:2})).methods[0].trades[0];
 b[80].high=999;assert.deepEqual(replay(b,()=>({atr14:2})).methods[0].trades[0],a);
 b[50].open=115;assert.ok(replay(b,()=>({atr14:2})).methods[0].skipped>0);
});
test('unfinished horizons are not counted and missing sessions suppress affected trades',()=>{
 const b=history().slice(0,55);b[40].low=95;b[42].high=110;
 assert.equal(replay(b,()=>({atr14:2})).methods[0].count,0);
 b[50].low=90;assert.equal(replay(b,()=>({atr14:2}),[b[50].day]).methods[0].count,0);
});
