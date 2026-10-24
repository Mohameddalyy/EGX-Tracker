import {test} from 'node:test';import assert from 'node:assert/strict';
import {openDb} from './core.mjs';import {initIntraday,syncIntradayRules,createManualRule,ingestIntradayEvent,intradayState,alertTemplate,relayRules} from './intraday.mjs';
import {researchContext} from './research-context-data.mjs';
const now=new Date('2026-10-09T10:00:00Z');
function fixture(){const db=openDb(':memory:');initIntraday(db);db.prepare("UPDATE stocks SET watched=1,active=1,metadata=? WHERE ticker='COMI'").run(JSON.stringify({symbolExt:{delay:900}}));return db;}
function manual(db,kind='resistance',threshold=100){return createManualRule(db,{ticker:'COMI',kind,threshold,expiresAt:'2026-10-10T10:00:00Z'},now).id;}
function event(id,extra={}){return {schema:1,ruleId:id,symbol:'EGX:COMI',price:101,volume:2000,triggeredAt:'2026-10-09T10:01:00Z',barTime:'2026-10-09T10:00:00Z',...extra};}
const later=new Date('2026-10-09T10:02:00Z'),options={now:later,receivedAt:later.toISOString()};
test('duplicate delivery creates one queue/notice, preserves fills/bars and never leaks a token',()=>{
 const db=fixture(),id=manual(db),e=event(id),first=ingestIntradayEvent(db,e,options);assert.equal(first.status,'review_queued');assert(ingestIntradayEvent(db,e,options).duplicate);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM research_queue').get().n,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM research_notifications').get().n,1);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM fills').get().n,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM bars').get().n,0);
 const secret=JSON.parse(alertTemplate(db,id).message).token;assert(!JSON.stringify(intradayState(db)).includes(secret));assert(!JSON.stringify(relayRules(db)).includes(secret));assert.match(intradayState(db).events[0].reason,/15 minutes/);
 const context=researchContext(db,{},['COMI']);assert.equal(context.intradayEvents.length,1);assert.equal(context.intradayEvents[0].candidate_id,first.candidateId);assert(!JSON.stringify(context).includes(secret));db.close();
});
test('symbol, future timestamp, empty price and threshold mismatches are rejected',()=>{
 const db=fixture(),id=manual(db);for(const extra of [{symbol:'NASDAQ:COMI'},{price:''},{price:99},{triggeredAt:'2030-01-01T00:00:00Z'},{barTime:'not-a-time'}])assert.throws(()=>ingestIntradayEvent(db,event(id,extra),options));assert.equal(intradayState(db).events.length,0);db.close();
});
test('paused, superseded/retired, out-of-order and old delivery remain audit-only',()=>{
 const db=fixture(),id=manual(db);ingestIntradayEvent(db,event(id),options);
 assert.equal(ingestIntradayEvent(db,event(id,{triggeredAt:'2026-10-09T10:00:30Z'}),options).status,'out_of_order');
 db.prepare('UPDATE intraday_rules SET enabled=0 WHERE id=?').run(id);assert.equal(ingestIntradayEvent(db,event(id,{price:102}),options).status,'inactive');
 db.prepare('UPDATE intraday_rules SET enabled=1,current=0 WHERE id=?').run(id);assert.equal(ingestIntradayEvent(db,event(id,{price:103}),options).status,'inactive');
 const id2=manual(db);assert.equal(ingestIntradayEvent(db,event(id2),{now:new Date('2026-10-11T10:00:00Z')}).status,'historical');db.close();
});
test('events coalesce during research, distinct risk event after completion queues new review',()=>{
 const db=fixture(),a=manual(db),b=manual(db,'support',90);const first=ingestIntradayEvent(db,event(a),options);
 assert.equal(ingestIntradayEvent(db,event(a,{price:102}),options).candidateId,first.candidateId);
 db.prepare("UPDATE research_queue SET status='decision_recorded' WHERE id=?").run(first.candidateId);
 const next=ingestIntradayEvent(db,event(b,{price:89}),options);assert.notEqual(next.candidateId,first.candidateId);assert.equal(db.prepare('SELECT COUNT(*) n FROM research_queue').get().n,2);db.close();
});
test('no entry rules from Wait, holdings survive expired/superseded setups and close with recorded sells',()=>{
 const db=fixture(),p={version:'priced-plan-1.0',currency:'EGP',entryZone:{low:100,high:102},stop:95,targets:[{label:'T1',price:115}],expiresAt:'2026-10-08T00:00:00Z'};
 db.prepare('INSERT INTO agent_decisions VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run('decision-test','q','COMI','r',now.toISOString(),'2026-10-09','Wait',null,JSON.stringify({riskPlan:p}),'{}','{}','x');
 db.prepare('INSERT INTO journal(request_id,created_at,ticker,plan,evidence) VALUES(?,?,?,?,?)').run('journal-test',now.toISOString(),'COMI',JSON.stringify({stop:95,target:115,agentDecisionId:'decision-test'}),'{}');
 db.prepare('INSERT INTO fills(request_id,entry_id,recorded_at,day,side,quantity,price,fees,note) VALUES(?,?,?,?,?,?,?,?,?)').run('fill-test',1,now.toISOString(),'2026-10-09','Buy',10,100,0,'Fixture');
 db.prepare("UPDATE stocks SET active=0 WHERE ticker='COMI'").run();syncIntradayRules(db,now);let rules=intradayState(db).rules;assert.equal(rules.length,2);assert(rules.every(r=>r.scope==='holding'&&r.expiresAt===null));assert(relayRules(db,now).every(r=>r.enabled));
 db.prepare('INSERT INTO fills(request_id,entry_id,recorded_at,day,side,quantity,price,fees,note) VALUES(?,?,?,?,?,?,?,?,?)').run('fill-sell',1,now.toISOString(),'2026-10-09','Sell',10,101,0,'Fixture');syncIntradayRules(db,now);assert.equal(intradayState(db).rules.length,0);db.close();
});
test('approved entry boundary outside zone cannot queue a buy review; stop event retires entry monitoring',()=>{
 const db=fixture(),p={version:'priced-plan-1.0',currency:'EGP',capturedAt:now.toISOString(),entryZone:{low:100,high:102},stop:95,targets:[{label:'T1',price:115}],expiresAt:'2026-10-10T00:00:00Z'};
 db.prepare('INSERT INTO agent_decisions VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run('decision-watch','q','COMI','r',now.toISOString(),'2026-10-09','Watch',null,JSON.stringify({riskPlan:p}),'{}','{}','x');
 syncIntradayRules(db,now);let rules=intradayState(db).rules;const entry=rules.find(r=>r.kind==='entry'&&r.direction==='above'),stop=rules.find(r=>r.kind==='stop');
 assert.equal(ingestIntradayEvent(db,event(entry.id,{price:110}),options).status,'outside_zone');assert.equal(db.prepare('SELECT COUNT(*) n FROM research_queue').get().n,0);
 ingestIntradayEvent(db,event(stop.id,{price:94}),options);syncIntradayRules(db,later);assert(!intradayState(db).rules.some(r=>r.kind==='entry'));db.close();
});
