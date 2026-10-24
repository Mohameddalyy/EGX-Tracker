import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,unlinkSync,rmdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {digest,taskIdentity,planRefresh,assessEvidence,WorkJournal} from './readiness.mjs';
const now='2026-10-23T10:00:00Z'; // Friday; expected completed session supplied, never guessed.
const calendar={verified:true,expectedCompletedSession:'2026-10-22'};
const request={instrumentId:'EXAMPLE-ISIN',component:'daily-history',kind:'session',dependencyKey:'adjustment-v1',obligation:'UNREVIEWED'};
const planned=(r=request)=>planRefresh({requests:[r],now,calendar}).components[0];
const cached=r=>({taskId:planned(r).id,verified:true,evidenceHash:digest('raw'),observedAt:'2026-10-22T15:00:00Z'});
test('previous valid completed session is reused on weekend and preopen without a new capture',()=>{
 for(const date of [now,'2026-10-25T05:00:00Z'])assert.equal(planRefresh({requests:[request],cache:[cached(request)],now:date,calendar}).counts.fetch,0);
});
test('next completed session invalidates history but a resume alone does not',()=>{
 assert.equal(planRefresh({requests:[request],cache:[cached(request)],now,calendar:{...calendar,expectedCompletedSession:'2026-10-21'}}).counts.fetch,1);
 assert.equal(planRefresh({requests:[request],cache:[cached(request)],now,calendar}).counts.reused,1);
});
test('unverified calendar blocks session-dependent work explicitly, not with guessed freshness',()=>{
 const p=planRefresh({requests:[request],now,calendar:{verified:false}});assert.equal(p.counts.blocked,1);assert.equal(p.components.length,1);
});
test('future or impossible expected-session dates cannot certify cached data',()=>{
 for(const day of ['2026-10-24','2026-02-30'])assert.equal(planRefresh({requests:[request],now,calendar:{verified:true,expectedCompletedSession:day}}).counts.blocked,1);
});
test('missing dependency contract cannot silently become a reusable cache key',()=>{
 assert.throws(()=>planRefresh({requests:[{...request,dependencyKey:undefined}],now,calendar}),/dependency/);
});
test('one changed component repairs only its instrument; unrelated histories and filings stay reusable',()=>{
 const reqs=Array.from({length:294},(_,i)=>({...request,instrumentId:'ID'+i}));
 const cache=reqs.map(r=>cached(r));reqs[17].eventIds=['official-split-notice'];
 const p=planRefresh({requests:reqs,cache,now,calendar});assert.equal(p.counts.reused,293);assert.equal(p.counts.fetch,1);assert.equal(p.components.length,294);
});
test('dependency revision invalidates previously verified work',()=>{
 const r={...request,dependencyKey:'corrected-action-v2'};assert.equal(planRefresh({requests:[r],cache:[cached(request)],now,calendar}).counts.fetch,1);
});
test('successful news coverage is required even when prices and scores are unchanged',()=>{
 const news={...request,component:'disclosures',kind:'interval',targetKey:'09:00-10:00',from:'2026-10-23T09:00:00Z',through:now};
 const p=planRefresh({requests:[request,news],cache:[cached(request),{...cached(news),coveredFrom:news.from,coveredThrough:now,coverageComplete:false}],now,calendar});assert.equal(p.counts.fetch,1);assert.equal(p.components.find(x=>x.component==='disclosures').status,'FETCH_DELTA');
});
test('future evidence and short coverage interval cannot certify freshness',()=>{
 assert.equal(planRefresh({requests:[request],cache:[{...cached(request),observedAt:'2026-10-24T00:00:00Z'}],now,calendar}).counts.fetch,1);
 const r={...request,kind:'interval',targetKey:'news',from:'2026-10-23T08:00:00Z',through:now};
 assert.equal(planRefresh({requests:[r],cache:[{...cached(r),coveredFrom:'2026-10-23T09:00:00Z',coveredThrough:now,coverageComplete:true}],now,calendar}).counts.fetch,1);
});
test('duplicate tasks coalesce with highest obligation priority and full coverage counts',()=>{
 const p=planRefresh({requests:[request,{...request,obligation:'HELD'}],now,calendar});assert.equal(p.counts.requested,2);assert.equal(p.counts.unique,1);assert.equal(p.components[0].priority,0);
});
const allRules=JSON.parse(readFileSync(new URL('./field-requirements.json',import.meta.url))).requirements;
const assess=(ids,observations={},opts={})=>assessEvidence({requirements:allRules.filter(x=>ids.includes(x.id)),observations,stage:'paper-entry',claims:[],now,...opts});
const good=value=>({status:'VERIFIED',value,evidenceHash:digest(value),observedAt:'2026-10-23T09:00:00Z',validThrough:'2026-10-23T12:00:00Z',equivalentQuality:true,sourceRoute:'verified primary equivalent'});
test('missing consensus is omitted without blocking stock research or entry data assessment',()=>{
 const r=assess(['analyst_consensus']);assert.deepEqual(r.blockedFields,[]);assert.equal(r.rows[0].outcome,'OMIT_OPTIONAL');assert.equal(r.authorizesTrading,false);
});
test('same missing P/E blocks only an explicitly relied-upon earnings valuation',()=>{
 assert.deepEqual(assess(['pe_ratio']).blockedFields,[]);assert.deepEqual(assess(['pe_ratio'],{},{claims:['earnings-valuation']}).blockedFields,['pe_ratio']);
});
test('sector-inapplicable ratio is N/A; unknown sector cannot invent N/A',()=>{
 assert.equal(assess(['current_ratio'],{},{sector:'Bank'}).rows[0].outcome,'NOT_APPLICABLE');assert.equal(assess(['current_ratio']).rows[0].outcome,'DEGRADED_REVIEW');
});
test('equivalent fallback resolves a critical field and retains false/zero as real values',()=>{
 for(const value of [0,false])assert.equal(assess(['material_control_dispute'],{material_control_dispute:good(value)}).rows[0].outcome,'VERIFIED');
 assert.equal(assess(['material_control_dispute'],{material_control_dispute:good(null)}).rows[0].outcome,'BLOCK_DEPENDENT_STEP');
});
test('important ownership gap differs from critical material control or solvency uncertainty',()=>{
 const r=assess(['ownership_detail','material_control_dispute','material_solvency_review']);assert.deepEqual(r.importantGaps,['ownership_detail']);assert.equal(r.blockedFields.length,2);assert.equal(r.canContinueIndependentResearch,true);
});
test('missing fill evidence blocks a fill, not the technical research stage',()=>{
 assert.equal(assess(['minute_fill_evidence'],{},{stage:'technical-screen'}).rows[0].outcome,'NOT_REQUIRED_FOR_STAGE');assert.equal(assess(['minute_fill_evidence'],{},{stage:'paper-fill'}).rows[0].outcome,'BLOCK_DEPENDENT_STEP');
});
test('stale, conflicted and proxy evidence never silently substitutes for critical verification',()=>{
 for(const patch of [{validThrough:'2026-10-23T08:00:00Z'},{status:'CONFLICTED'},{status:'PROXY'},{equivalentQuality:false}])assert.equal(assess(['identity_currency'],{identity_currency:{...good('EGP'),...patch}}).rows[0].outcome,'BLOCK_DEPENDENT_STEP');
});
function withJournal(fn){const db=new DatabaseSync(':memory:');try{fn(new WorkJournal(db),db);}finally{db.close();}}
const descriptor={instrumentId:'A',component:'daily',targetKey:'2026-10-22',dependencyKey:'v1'};
test('idempotent work identity and durable completed task survive process reopen',()=>{
 const dir=mkdtempSync(join(tmpdir(),'egx-readiness-')),path=join(dir,'isolated.sqlite');let db=new DatabaseSync(path);
 try{let j=new WorkJournal(db),id=j.register(descriptor);assert.equal(j.register({...descriptor}),id);const token=j.claim(id,'worker',now,60000);j.finish(token,{at:now,status:'VERIFIED',payload:{bars:[1,2,3]}});db.close();db=new DatabaseSync(path);j=new WorkJournal(db);assert.equal(j.list().length,1);assert.equal(j.list()[0].state,'DONE');assert.equal(j.claim(id,'worker2',now,60000),null);assert.equal(db.prepare('SELECT count(*) n FROM readiness_evidence').get().n,1);}finally{db.close();unlinkSync(path);rmdirSync(dir);}
});
test('expired lease needs explicit recovery and previous worker is fenced',()=>withJournal(j=>{
 const id=j.register(descriptor),old=j.claim(id,'first',now,1000),later='2026-10-23T10:00:02Z';assert.throws(()=>j.claim(id,'second',now,60000),/Active/);assert.throws(()=>j.claim(id,'second',later,60000),/reconciled/);const fresh=j.claim(id,'second',later,60000,{reconciledExpiredOwner:true});assert.throws(()=>j.finish(old,{at:later,status:'VERIFIED',payload:{a:1}}),/fenced/);j.finish(fresh,{at:later,status:'VERIFIED',payload:{a:1}});
}));
test('failed routes and partial data persist; repair backoff prevents immediate retry storms',()=>withJournal((j,db)=>{
 const id=j.register(descriptor),token=j.claim(id,'worker',now,60000);j.finish(token,{at:now,status:'PARTIAL',payload:{available:['one-page']},detail:'second route unavailable',nextAttempt:'2026-10-24T10:00:00Z'});assert.equal(j.list()[0].state,'REPAIR');assert.equal(j.claim(id,'worker',now,60000),null);assert.equal(db.prepare('SELECT count(*) n FROM readiness_evidence').get().n,1);assert.equal(db.prepare('SELECT detail FROM readiness_attempts').get().detail,'second route unavailable');
}));
test('failure between evidence insert and checkpoint rolls both back atomically',()=>withJournal((j,db)=>{
 const id=j.register(descriptor),token=j.claim(id,'worker',now,60000);db.exec("CREATE TRIGGER injected_failure BEFORE INSERT ON readiness_attempts BEGIN SELECT RAISE(ABORT,'injected crash boundary'); END");assert.throws(()=>j.finish(token,{at:now,status:'VERIFIED',payload:{a:1}}),/injected/);assert.equal(db.prepare('SELECT count(*) n FROM readiness_evidence').get().n,0);assert.equal(j.list()[0].state,'RUNNING');
}));
test('repaired task preserves earlier partial capture and failed route history',()=>withJournal((j,db)=>{
 const id=j.register(descriptor),a=j.claim(id,'worker',now,60000),later='2026-10-23T10:02:00Z';j.finish(a,{at:now,status:'PARTIAL',payload:{pages:[1]},detail:'page2 failed',nextAttempt:later});
 const b=j.claim(id,'worker',later,60000);j.finish(b,{at:later,status:'VERIFIED',payload:{pages:[1,2]}});assert.equal(j.list()[0].state,'DONE');assert.equal(db.prepare('SELECT count(*) n FROM readiness_evidence').get().n,2);assert.equal(db.prepare('SELECT count(*) n FROM readiness_attempts').get().n,2);
}));
