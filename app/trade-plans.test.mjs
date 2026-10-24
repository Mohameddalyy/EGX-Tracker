import {test} from 'node:test';import assert from 'node:assert/strict';import {buildTradePlan,validateTradePlan,planProgress,tickRound} from './trade-plans.mjs';import {planStock,planOptions} from './trade-plan-fixture.mjs';
const now=new Date('2026-10-08T11:00:00Z');
test('prices, targets and risk derive from frozen levels, tick sizes and explicit costs; arbitrary edits fail',()=>{
 const s=planStock(),p=buildTradePlan(s,planOptions);assert(p.metrics.qualifies);assert.equal(p.targets.length,2);assert.equal(p.target,14.99);assert.equal(p.targets[1].price,19.99);assert(p.stop<p.entryZone.low);assert.equal(p.entry,p.entryZone.high);assert.equal(p.metrics.lossPerShareEGP,p.entry-p.stop+p.entry*.005);assert(validateTradePlan(p,s));
 for(const field of ['entry','stop','target','atr'])assert.throws(()=>validateTradePlan({...p,[field]:p[field]+.01},s),/do not match/);const fake=structuredClone(p);fake.anchor.low=1;assert.throws(()=>validateTradePlan(fake,s),/do not match/);
 assert.equal(tickRound(.9999,s.metadata.symbolInfo,'up'),1);assert.equal(tickRound(.9999,s.metadata.symbolInfo,'down'),.999);
});
test('breakout uses the next measured resistance; absent structure, unknown ticks and weak reward/risk cannot approve',()=>{
 const s=planStock(),b=buildTradePlan(s,{...planOptions,method:'breakout'});assert.equal(b.entryZone.low,15.01);assert.equal(b.target,19.99);assert(b.trigger.includes('15'));
 assert.throws(()=>buildTradePlan(s,{...planOptions,method:'breakout',zoneIndex:1}),/target/);assert.throws(()=>buildTradePlan({...s,metadata:{}},planOptions),/tick/);
 const expensive=buildTradePlan(s,{...planOptions,costScenarioFraction:.4});assert.equal(expensive.metrics.qualifies,false);assert.throws(()=>validateTradePlan(expensive,s),/2:1/);
});
test('monitor distinguishes entry condition, no-chase, expiry and ambiguous touches without making up fills',()=>{
 const s=planStock(),p=buildTradePlan(s,planOptions),d={action:'Watch',createdAt:now.toISOString(),riskPlan:p};
 const b=(day,fields)=>({day,open:p.entryZone.low,close:p.entryZone.high,low:p.entryZone.low,high:p.entryZone.high,volume:2000000,captured_at:'2026-10-13T11:00:00Z',...fields});
 const future=b('2026-10-11',{}),obs=new Date('2026-10-13T12:00:00Z');let progress=planProgress(d,[...s.bars,future],[],obs);assert(progress.events.some(e=>e.type==='trigger'));assert.match(progress.status,/Entry condition/);assert.equal(progress.quantity,undefined);assert.equal(planProgress({...d,action:'Wait'},s.bars,[],obs).status,'No approved entry plan');assert.match(planProgress({...d,supersededForEntry:true},s.bars,[],obs).status,/Superseded/);
 const stop=b('2026-10-12',{low:p.stop-1,high:p.target+1,close:p.entryZone.high});progress=planProgress(d,[...s.bars,future,stop],[],obs);assert.match(progress.status,/Invalidated/);assert(progress.events.some(e=>e.type==='ambiguous'));assert.equal(progress.events.filter(e=>e.type==='trigger').length,1);
 assert.match(planProgress(d,[...s.bars],[],new Date('2026-10-21')).status,/Expired/);assert.match(planProgress(d,[...s.bars],['Missing session'],obs).status,/Data review/);
 assert.equal(planProgress({createdAt:d.createdAt},s.bars,[],obs).status,'No approved entry plan');
});
