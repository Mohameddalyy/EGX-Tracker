import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {evaluateDecision,monitorDecisions} from './decision-monitor.mjs';import {initDecisions} from './decisions.mjs';import {openDb} from './core.mjs';
const policy=JSON.parse(readFileSync('research/decision-policy.json','utf8'));
const record=action=>({id:'decision-fixture',ticker:'COMI',decision_day:'2026-10-08',policy,payload:{action,prediction:{horizonSessions:5,direction:'up',hurdlePercent:2},riskPlan:{stop:9,target:12,expiresAt:'2026-11-01T00:00:00Z'}}});
const now=new Date('2026-10-18T08:00:00Z'),days=['11','12','13','14','15'],bars=()=>days.map((d,i)=>({day:'2026-10-'+d,open:10,high:11+i,low:9.5,close:10+i,captured_at:now.toISOString()}));
test('all actions use only forward confirmed observations; forecasts do not imply correctness',()=>{
 for(const action of ['Watch','Wait','Avoid']){const input=[{...bars()[0],day:'2026-10-08',close:99},...bars(),{...bars()[0],day:'2026-10-18',close:99}];const o=evaluateDecision(record(action),input,{},now);assert.equal(o.observedSessions,5);assert.equal(o.baseline.day,'2026-10-11');assert.equal(o.horizons[0].status,'Observed');assert(Math.abs(o.horizons[0].priceReturnPercent-40)<1e-8);assert.equal(o.horizons[0].forecast,'Met stated price forecast');assert.match(o.horizons[0].decisionQuality,/process review/);assert.equal(o.horizons[1].status,'Pending');}
 const uncertain=record('Wait');uncertain.payload.prediction.direction='uncertain';assert.equal(evaluateDecision(uncertain,bars(),{},now).horizons[0].forecast,'Not scored');
});
test('elapsed time alone does not finalize old intraday captures and no future data is invented',()=>{
 const o=evaluateDecision(record('Wait'),bars().map(b=>({...b,captured_at:b.day+'T18:00:00Z'})),{},now);assert.equal(o.observedSessions,0);assert.equal(o.latest,null);assert.equal(o.status,'Needs data review');
 assert.equal(evaluateDecision(record('Avoid'),bars(),{},new Date('2026-10-08T18:00:00Z')).status,'Awaiting future confirmed sessions');
});
test('missing sessions block forecast scoring, while known holidays are excluded',()=>{
 const r={...record('Wait'),decision_day:'2026-10-07'},o=evaluateDecision(r,bars(),{},now);assert.equal(o.horizons[0].status,'Needs data review');assert.equal(o.horizons[0].forecast,'Not scored');assert.match(o.quality[0],/2026-10-08/);
 assert.equal(evaluateDecision(r,bars(),{symbolInfo:{session_holidays:'20261008'}},now).horizons[0].status,'Observed');
});
test('invalid prices and stale captures are explicit; same-bar touches never assume ordering',()=>{
 const input=bars();input[0].low=8;input[0].high=13;assert.match(evaluateDecision(record('Watch'),input,{},now).levelObservations[0].observation,/ordering unknown/);input[0].open=0;assert.equal(evaluateDecision(record('Watch'),input,{},now).latest.priceReturnPercent,null);assert.equal(evaluateDecision(record('Watch'),input,{},now).horizons[0].status,'Needs data review');
 const stale=evaluateDecision(record('Watch'),bars().map(b=>({...b,captured_at:'2026-10-16T01:00:00Z'})),{},now);assert(stale.quality.some(x=>x.includes('stale')));
});
test('monitor appends revised evidence, deduplicates identical observations, and includes Avoid',()=>{
 const db=openDb(':memory:');initDecisions(db);const r=record('Avoid');db.prepare('INSERT INTO agent_decisions VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(r.id,'candidate-fixture','COMI','report-fixture','2026-10-08T11:00:00Z',r.decision_day,'Avoid',null,JSON.stringify(r.payload),'{}',JSON.stringify(policy),'fixture');
 for(const b of bars()){db.prepare('INSERT INTO bars VALUES(?,?,?,?,?,?,?,?)').run('COMI',b.day,Date.parse(b.day)/1000,b.open,b.high,b.low,b.close,100);db.prepare('INSERT INTO bar_captures(ticker,day,captured_at) VALUES(?,?,?)').run('COMI',b.day,b.captured_at);}
 assert.equal(monitorDecisions(db,now)[0].sessions,5);assert.equal(monitorDecisions(db,now)[0].newObservation,false);const before=db.prepare('SELECT payload FROM decision_outcomes').get().payload;db.prepare("UPDATE bars SET close=13.5 WHERE day='2026-10-15'").run();assert(monitorDecisions(db,now)[0].newObservation);assert.equal(db.prepare('SELECT COUNT(*) n FROM decision_outcomes').get().n,2);assert.equal(db.prepare('SELECT payload FROM decision_outcomes ORDER BY rowid LIMIT 1').get().payload,before);db.close();
});
import {requestReassessment} from './decisions.mjs';
test('new same-day evidence gets a fresh handoff while identical triggers remain idempotent',()=>{
 const db=openDb(':memory:');initDecisions(db);const now=new Date('2026-10-15T18:00:00Z');
 db.prepare('INSERT INTO agent_decisions VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run('decision-recheck-test','old','COMI','report-old',now.toISOString(),'2026-10-15','Wait',null,'{}','{}','{}','test');
 const a=requestReassessment(db,'decision-recheck-test','First evidence',now);
 assert.equal(requestReassessment(db,'decision-recheck-test','First evidence',now).id,a.id);
 db.prepare("UPDATE research_queue SET status='decision_recorded' WHERE id=?").run(a.id);
 assert.equal(requestReassessment(db,'decision-recheck-test','First evidence',now).id,a.id);
 const b=requestReassessment(db,'decision-recheck-test','New filing and pullback assessment',now);assert.notEqual(a.id,b.id);assert.equal(b.status,'pending');
 assert.equal(db.prepare('SELECT COUNT(*) n FROM research_queue').get().n,2);db.close();
});
