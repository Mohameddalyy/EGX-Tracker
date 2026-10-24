import test from 'node:test';import assert from 'node:assert/strict';
import {validatePromotion,requiredChecks} from './promotion-policy.mjs';
import {evidenceFixture} from './evidence-fixture.mjs';
import {planStock,planOptions} from './trade-plan-fixture.mjs';import {buildTradePlan} from './trade-plans.mjs';
import {reconcileStatement} from './analysis-financials.mjs';
import {historyRefreshState} from './refresh-selection.mjs';
import {evidenceDictionary,validateFieldEvidence} from './evidence-policy.mjs';
import {routeAnnouncement} from './exchange-evidence.mjs';
import {openDb,ingest,snapshot} from './core.mjs';import {initMarket,importCatalog} from './market.mjs';import {initScout} from './scout.mjs';
import {efficientScreen} from './scout-efficient-service.mjs';import {createStageTiming} from './stage-timing.mjs';
import {readFileSync} from 'node:fs';import {fixtureSession} from './trade-plan-fixture.mjs';
const now=new Date('2026-10-08T11:00:00Z');
function fixture(){
 const stock=planStock(),fieldEvidence=evidenceFixture(now),fact=fieldEvidence.fields.currency;
 const a={ticker:'TEST',verdict:'Watch',pipelineDecision:'approve',horizon:'Medium term',rationale:'Synthetic audit',sourceIds:['issuer'],fieldEvidence,evidenceChecks:Object.fromEntries(requiredChecks.map(k=>[k,{...fact}])),riskPlan:buildTradePlan(stock,planOptions)};
 for(const k of ['fundamentals','technicals','catalysts','risks','invalidation','positionReview','entryConditions'])a[k]='Synthetic audit fixture';
 return {a,context:{stocks:[stock]},report:{version:'1.0',id:'report-audit',createdAt:now.toISOString(),contextId:'context-audit',type:'research',summary:'Synthetic',limitations:[],sources:[{id:'issuer',url:'https://example.com/synthetic',title:'Synthetic only',accessedAt:now.toISOString()}],assessments:[a]}};
}
test('audit: full promotion rejects omitted value/quality claim dependencies',()=>{const {a,report,context}=fixture();a.fieldEvidence.claims=['value','quality'];assert.throws(()=>validatePromotion(report,a,context,now),/critical field/);});
test('audit: full promotion rejects old core evidence even in fresh report',()=>{const {a,report,context}=fixture();for(const f of Object.values(a.fieldEvidence.fields))f.asOf='2000-01-01';assert.throws(()=>validatePromotion(report,a,context,now),/evidence|coverage|field/i);});
test('audit: legacy omission cannot bypass the new promotion contract',()=>{const {a,report,context}=fixture();delete a.fieldEvidence;assert.throws(()=>validatePromotion(report,a,context,now),/field evidence/i);});
test('audit: unknown claim family cannot waive conditional dependencies',()=>{const {a,report,context}=fixture();a.fieldEvidence.claims=['value-but-not-declared'];assert.throws(()=>validatePromotion(report,a,context,now),/claim/i);});
test('audit: unavailable accounting checks are not a successful reconciliation',()=>{const r=reconcileStatement({scale:1,scope:'standalone',sectorModel:'industrial',values:{revenue:{value:100}}});assert.equal(r.consistent,false);assert.equal(r.status,'NOT_EVALUABLE');});
test('audit: recent metadata does not refresh old retained bar provenance',()=>{const stock={retrieved_at:'2026-10-23T08:00Z',metadata:{symbolInfo:{exchange:'EGX',timezone:'Africa/Cairo',session:'1000-1430:12345',session_holidays:'20260101',delay:900}}};const state=historyRefreshState(stock,{day:'2026-10-22',captured_at:'2026-10-23T07:00Z'},new Date('2026-10-23T10:00Z'));assert.equal(state.due,true);assert.equal(state.code,'RETAINED_TAIL_NOT_RECONFIRMED');});
test('valid technical and value reviews pass; old filing dates need current subsequent-event coverage',()=>{
 const {a,report,context}=fixture();assert.doesNotThrow(()=>validatePromotion(report,a,context,now));
 a.fieldEvidence.claims=['value','quality'];for(const f of evidenceDictionary.filter(r=>r.criticality.startsWith('conditional')))a.fieldEvidence.fields[f.id]={...a.fieldEvidence.fields.currency,asOf:'2025-12-31'};
 assert.doesNotThrow(()=>validatePromotion(report,a,context,now));
 a.fieldEvidence.fields.audited_statements.coverageThrough='2025-12-31';assert.throws(()=>validatePromotion(report,a,context,now),/coverage/);
});
test('old approval cutoff and future checks fail; missing optional features do not block research approval',()=>{
 const {a,report,context}=fixture();assert.doesNotThrow(()=>validatePromotion(report,a,context,now));
 assert.throws(()=>validateFieldEvidence(report,a,new Date(+now+31*60000)),/cutoff/);
 a.fieldEvidence.fields.currency.checkedAt=new Date(+now+1000).toISOString();assert.throws(()=>validatePromotion(report,a,context,now),/coverage/);
});
test('exact retained ISIN maps to research evidence, while shared and conflicting identities stay quarantined',()=>{
 const identities=[{ticker:'AAA',metadata:{symbolInfo:{isin:'EG0000000001'}}},{ticker:'BBB',metadata:JSON.stringify({symbolInfo:{isin:'EG0000000002'}})}],record={code:1,tickers:[],isins:['EG0000000001']};
 const routed=routeAnnouncement(record,identities);assert.deepEqual(routed.identityRouting.tickers,['AAA']);assert.equal(routed.tradeAuthorization,false);assert.equal(routed.identityRouting.status,'RETAINED_ISIN_MATCH_REQUIRES_REVIEW');assert.deepEqual(record.tickers,[]);
 const shared=routeAnnouncement(record,[...identities,{ticker:'OTHER',metadata:{symbolInfo:{isin:'EG0000000001'}}}]);assert.equal(shared.identityRouting.status,'IDENTITY_REVIEW_REQUIRED');assert.deepEqual(shared.identityRouting.tickers,[]);
 assert.equal(routeAnnouncement({...record,tickers:['BBB']},identities).identityRouting.status,'IDENTITY_REVIEW_REQUIRED');
 assert.equal(routeAnnouncement({...record,isins:['EG0000009999']},identities).identityRouting.status,'UNMAPPED');
});
test('partial recapture retains bars but snapshot and preparation quarantine the untouched latest tail',()=>{
 const db=openDb(':memory:');try{const at='2026-10-08T11:00:00Z',s=planStock();db.prepare("INSERT INTO stocks(ticker,name,currency) VALUES('TEST','Synthetic','EGP')").run();
 const adjustment={...s.metadata,symbolExt:{symbol:'TEST'},symbolInfo:{...s.metadata.symbolInfo,currency_code:'EGP'},properties:{dividendsAdjustment:false}};
 ingest(db,{retrieved_at:at,stocks:[{ticker:'TEST',adjustment,history:{bars:s.bars}}]});
 ingest(db,{retrieved_at:'2026-10-08T11:01:00Z',stocks:[{ticker:'TEST',adjustment,history:{bars:s.bars.slice(0,-1)}}]});
 const state=snapshot(db,['TEST'],new Date('2026-10-08T11:02Z')).stocks[0];assert.equal(state.bars.length,160);assert.equal(state.latest.captured_at,at);assert.equal(state.historyReadiness.code,'RETAINED_TAIL_NOT_RECONFIRMED');
 }finally{db.close();}
});
test('efficient service fills remaining handoff slots without taking over an existing owner',()=>{
 const db=openDb(':memory:');try{initMarket(db);initScout(db);const stocks=Array.from({length:8},(_,i)=>({name:'QA'+i,symbol:'EGX:QA'+i,type:'stock',exchange:'EGX',currency:'EGP',description:'Synthetic',sector:'Finance'}));importCatalog(db,{stocks,totalCount:8,retrievedAt:now.toISOString()});
 for(const s of stocks)ingest(db,{retrieved_at:now.toISOString(),stocks:[{ticker:s.name,history:{bars:planStock().bars},adjustment:{symbolExt:{symbol:s.name},symbolInfo:{...fixtureSession,currency_code:'EGP'},properties:{dividendsAdjustment:false}}}]});
 const policy={...JSON.parse(readFileSync('research/screening-policy.json')),minScore:0,maxAtrPercent:100};
 const first=efficientScreen(db,policy,now);assert.equal(first.queued.length,5);
 db.prepare("UPDATE research_queue SET status='decision_recorded' WHERE ticker IN ('QA1','QA2','QA3')").run();db.prepare("UPDATE research_queue SET status='researching',note='existing owner' WHERE ticker='QA0'").run();
 const next=efficientScreen(db,policy,now);assert.equal(next.queued.length,3);assert.equal(next.activeAfter,5);assert.equal(db.prepare("SELECT note FROM research_queue WHERE ticker='QA0'").get().note,'existing owner');assert.equal(efficientScreen(db,policy,now).queued.length,0);assert.equal(next.timing.modelTokens,null);
 }finally{db.close();}
});
test('stage metrics retain failure and reuse without inventing model token consumption',()=>{
 let ms=0;const updates=[],t=createStageTiming({clock:()=>now,monotonic:()=>ms,onUpdate:x=>updates.push(x)});
 t.measure('first',()=>{ms=10;});assert.throws(()=>t.measure('bad',()=>{ms=15;throw Error('fixture failure');}));t.record('cached','reused');
 const s=t.snapshot();assert.deepEqual(s.stages.map(x=>x.status),['completed','failed','reused']);assert.equal(s.stages[1].durationMs,5);assert.equal(s.stages[2].durationMs,null);assert.equal(s.modelTokens,null);assert.equal(updates.length,3);
});
