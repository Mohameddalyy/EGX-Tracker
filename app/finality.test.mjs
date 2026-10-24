import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {captureFinality,isConfirmedBar,sessionPolicy} from './finality.mjs';import {openDb,ingest,snapshot} from './core.mjs';import {screenStocks} from './scout.mjs';import {evaluateDecision} from './decision-monitor.mjs';
const metadata=()=>({symbolExt:{symbol:'COMI',exchange:'EGX',delay:900},symbolInfo:{currency_code:'EGP',exchange:'EGX',timezone:'Africa/Cairo',has_extended_hours:false,session:'1;1000-1430:12345#20260222/1;1000-1330:12345#20260322/1;1000-1430:12345',session_holidays:'20260101,20261008',delay:900,corrections:'1000-1330:20260219'},properties:{dividendsAdjustment:false}});
const bar=(at,day='2026-10-07',meta=metadata())=>({day,captured_at:at,open:10,high:12,low:9,close:11,volume:1000000,finality:JSON.stringify(captureFinality(day,at,meta))});
test('post-close boundary includes feed delay and buffer, in Cairo summer and winter time',()=>{
 assert.equal(captureFinality('2026-10-07','2026-10-07T12:14:59Z',metadata()).confirmed,false);
 const yes=captureFinality('2026-10-07','2026-10-07T12:15:00Z',metadata());assert.equal(yes.confirmed,true);assert.equal(yes.cutoffLocal,'15:15:00');assert.equal(yes.delaySeconds,900);
 assert.equal(captureFinality('2026-01-05','2026-01-05T12:15:00Z',metadata()).confirmed,false);
 assert.equal(captureFinality('2026-01-05','2026-01-05T13:15:00Z',metadata()).confirmed,true);
});
test('waiting and midnight rollover cannot promote a pre-cutoff capture; future timestamps cannot pass',()=>{
 const early=bar('2026-10-07T11:00:00Z');assert.equal(isConfirmedBar(early,new Date('2026-10-07T19:00:00Z')),false);assert.equal(isConfirmedBar(early,new Date('2026-10-08T19:00:00Z')),false);
 const late=bar('2026-10-07T12:15:00Z');assert.equal(isConfirmedBar(late,new Date('2026-10-07T12:14:59Z')),false);assert(isConfirmedBar(late,new Date('2026-10-07T19:00:00Z')));assert.equal(isConfirmedBar({...late,finality:null},new Date('2026-10-07T19:00:00Z')),false);
 assert(isConfirmedBar({...early,captured_at:'2026-10-08T06:00:00Z',finality:null},new Date('2026-10-08T19:00:00Z')));
});
test('weekends, provider holidays and missing or unsupported metadata cannot qualify same-day bars',()=>{
 for(const day of ['2026-10-08','2026-10-09','2026-10-10'])assert.equal(captureFinality(day,day+'T19:00:00Z',metadata()).confirmed,false);
 for(const key of ['timezone','session_holidays','has_extended_hours','session']){const m=metadata();delete m.symbolInfo[key];assert.equal(captureFinality('2026-10-07','2026-10-07T19:00:00Z',m).confirmed,false);}
 const m=metadata();delete m.symbolExt.delay;delete m.symbolInfo.delay;assert.equal(captureFinality('2026-10-07','2026-10-07T19:00:00Z',m).confirmed,false);m.symbolInfo.session='2200-0200:12345';assert.equal(captureFinality('2026-10-07','2026-10-07T19:00:00Z',m).confirmed,false);
 assert.equal(captureFinality('2027-01-04','2027-01-04T20:00:00Z',metadata()).confirmed,false);
});
test('provider extensions and date overrides delay eligibility; shorter sessions do not lower the verified floor',()=>{
 const m=metadata();m.symbolInfo.corrections='1000-1600:20261007';assert.equal(captureFinality('2026-10-07','2026-10-07T12:15:00Z',m).confirmed,false);assert.equal(captureFinality('2026-10-07','2026-10-07T13:45:00Z',m).confirmed,true);
 m.symbolInfo.corrections='unsupported';assert.equal(captureFinality('2026-10-07','2026-10-07T19:00:00Z',m).confirmed,false);
 const policy={...sessionPolicy,dateOverrides:{'2026-10-07':{close:'18:00',source:'https://example.com/session-notice'}}};assert.equal(captureFinality('2026-10-07','2026-10-07T12:15:00Z',metadata(),policy).confirmed,false);
 assert.equal(captureFinality('2026-02-19','2026-02-19T12:30:00Z',metadata()).confirmed,false);
});
test('ingestion persists capture evidence; dashboard, levels, screening and monitoring accept the same post-close bar',()=>{
 const db=openDb(':memory:'),now=new Date('2026-10-07T19:00:00Z'),sourceBars=Array.from({length:200},(_,i)=>{const time=Date.parse('2026-10-07T07:00:00Z')/1000-(199-i)*86400;return {time,open:10,high:12,low:9,close:11,volume:1000000};});
 const p={retrieved_at:'2026-10-07T11:00:00Z',stocks:[{ticker:'COMI',adjustment:metadata(),history:{bars:sourceBars}}]};ingest(db,p);assert.equal(snapshot(db,['COMI'],now).stocks[0].latest.day,'2026-10-06');
 p.retrieved_at='2026-10-07T12:15:00Z';ingest(db,p);let s=snapshot(db,['COMI'],now).stocks[0];assert.equal(s.latest.day,'2026-10-07');assert.equal(s.latestFinality.method,'post-close');assert.equal(s.levels.asOf,s.latest.day);assert.equal(s.unconfirmed.length,0);
 const screening=JSON.parse(readFileSync('research/screening-policy.json','utf8'));assert.equal(screenStocks([s],screening,[],now)[0].asOf,s.latest.day);
 const record={id:'decision-test',decision_day:'2026-10-06',policy:JSON.parse(readFileSync('research/decision-policy.json','utf8')),payload:{action:'Wait',prediction:{horizonSessions:5,direction:'uncertain',hurdlePercent:0}}};const o=evaluateDecision(record,s.bars,s.metadata,now);assert.equal(o.observedSessions,1);assert.equal(o.latest.day,s.latest.day);assert.equal(o.quality.length,0);
 assert.equal(evaluateDecision({...record,decision_day:'2026-10-07'},s.bars,s.metadata,now).observedSessions,0);
 const changed=metadata();changed.symbolInfo.delay=10000;db.prepare('UPDATE stocks SET metadata=? WHERE ticker=?').run(JSON.stringify(changed),'COMI');s=snapshot(db,['COMI'],now).stocks[0];assert.equal(s.latestFinality.delaySeconds,900);assert.equal(s.latest.day,'2026-10-07');db.close();
});
test('missing current-session data is flagged after cutoff, not before; historical observations remain untouched',()=>{
 const record={id:'decision-test',decision_day:'2026-10-06',policy:JSON.parse(readFileSync('research/decision-policy.json','utf8')),payload:{action:'Avoid',prediction:{horizonSessions:5,direction:'uncertain',hurdlePercent:0}}};
 assert.equal(evaluateDecision(record,[],metadata(),new Date('2026-10-07T11:00:00Z')).quality.length,0);
 assert.match(evaluateDecision(record,[],metadata(),new Date('2026-10-07T19:00:00Z')).quality[0],/2026-10-07/);
});
