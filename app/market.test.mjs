import {test} from 'node:test';import assert from 'node:assert/strict';
import {openDb,ingest,snapshot} from './core.mjs';import {initMarket,importCatalog,marketState,marketBusy} from './market.mjs';import {changeWatchlist} from './watchlist.mjs';import {researchContext} from './research-context-data.mjs';import {initJournal,saveDecision} from './journal.mjs';
const item=(name='ABUK',currency='EGP')=>({name,symbol:'EGX:'+name,type:'stock',exchange:'EGX',currency,description:'Company '+name,sector:'Finance'});
const catalog=stocks=>({stocks,totalCount:stocks.length,retrievedAt:'2026-10-08T08:00:00Z'});
const setup=()=>{const db=openDb(':memory:');initMarket(db);return db;};
test('catalog separates market coverage from watchlist; adding and reimport preserve user notes',()=>{
 const db=setup();importCatalog(db,catalog([item(),item('EGS30AJ1C016-EGP')]));
 assert.equal(marketState(db).total,2);assert.equal(snapshot(db).stocks.length,3);
 changeWatchlist(db,{action:'add',ticker:'ABUK'});db.prepare("UPDATE stocks SET notes='Research debt',horizon='Medium term' WHERE ticker='ABUK'").run();
 importCatalog(db,catalog([item()]));const stock=snapshot(db).stocks.find(s=>s.ticker==='ABUK');assert.equal(stock.name,'Company ABUK');assert.equal(stock.notes,'Research debt');assert.equal(stock.horizon,'Medium term');
 const context=researchContext(db,{});assert(context.watchlist.includes('ABUK'));assert(context.stocks.some(s=>s.ticker==='ABUK'));assert(!context.stocks.some(s=>s.ticker==='EGS30AJ1C016-EGP'));
 assert.equal(researchContext(db,{},['EGS30AJ1C016-EGP']).stocks[0].ticker,'EGS30AJ1C016-EGP');assert.throws(()=>researchContext(db,{},['UNKNOWN']));
 changeWatchlist(db,{action:'pause',ticker:'ABUK'});assert(!researchContext(db,{}).stocks.some(s=>s.ticker==='ABUK'));
 db.prepare('INSERT INTO journal(request_id,created_at,ticker,plan,evidence) VALUES(?,?,?,?,?)').run('test-paused-record-1','2026-10-08T08:00:00Z','ABUK',JSON.stringify({entry:10,stop:9,target:12}),'{}');
 assert(researchContext(db,{}).stocks.some(s=>s.ticker==='ABUK'));assert.equal(researchContext(db,{}).positions.length,1);db.close();
});
test('catalog validation and currency changes are atomic; USD prices never become EGP',()=>{
 const db=setup();assert.throws(()=>importCatalog(db,{...catalog([item()]),totalCount:2}));assert.equal(marketState(db).total,0);
 importCatalog(db,catalog([item('USDSTK','USD')]));assert.throws(()=>importCatalog(db,catalog([item(),item('USDSTK','EGP')])));assert.equal(marketState(db).total,1);
 const payload={retrieved_at:'2026-10-08T08:00:00Z',stocks:[{ticker:'USDSTK',history:{bars:[{time:1700000000,open:10,high:12,low:9,close:11,volume:100}]},adjustment:{symbolExt:{symbol:'USDSTK'},symbolInfo:{currency_code:'USD'},properties:{dividendsAdjustment:false}}}]};
 ingest(db,payload);assert.equal(marketState(db).withHistory,1);assert.equal(snapshot(db,['USDSTK']).stocks[0].currency,'USD');payload.stocks[0].adjustment.symbolInfo.currency_code='EGP';assert.throws(()=>ingest(db,payload),/currency/);
 initJournal(db);assert.throws(()=>saveDecision(db,{requestId:'test-usd-block-00001'},snapshot(db,['USDSTK']).stocks[0]),/EGP/);db.close();
});
test('an import lock prevents chart jobs, but adding a watchlist stock stays available',()=>{
 const db=setup();importCatalog(db,catalog([item()]));db.prepare("INSERT INTO market_jobs(status,pid) VALUES('running',?)").run(process.pid);assert(marketBusy(db));assert.throws(()=>db.prepare("INSERT INTO market_jobs(status) VALUES('running')").run());changeWatchlist(db,{action:'add',ticker:'ABUK'});assert(researchContext(db,{}).watchlist.includes('ABUK'));db.close();
});
test('dead importer locks recover and preserve stored progress',()=>{
 const db=setup();db.prepare("INSERT INTO market_jobs(status,pid,total,done) VALUES('running',2147483647,20,8)").run();assert.equal(marketBusy(db),false);const job=marketState(db).job;assert.equal(job.status,'interrupted');assert.equal(job.done,8);db.close();
});
