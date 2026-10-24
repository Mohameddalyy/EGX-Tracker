import {evidenceFixture} from './evidence-fixture.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,unlinkSync,rmdirSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {openDb} from './core.mjs';import {initMarket} from './market.mjs';import {initFacts} from './market-facts.mjs';
import {historyRefreshState,expectedHistorySession} from './refresh-selection.mjs';
import {initPreparation,attempt,repairDue,receipt,receiptFor} from './preparation-store.mjs';
import {validateFieldEvidence,fieldConsequence,entryCoreFields,evidenceContractVersion,evidenceDictionary} from './evidence-policy.mjs';
import {preparationManifest,readinessOverview} from './preparation-status.mjs';
import {allowedDocumentUrl,captureDocument} from './document-library.mjs';
import {acquirePreparationLock} from './preparation-lock.mjs';
test('document index has a single owner; an old release cannot remove a new lock',()=>{
 const dir=mkdtempSync(join(tmpdir(),'egx-lock-test-')),path=join(dir,'collector.lock');
 try{const release=acquirePreparationLock(path);assert.throws(()=>acquirePreparationLock(path),/owner exists/);release();const next=acquirePreparationLock(path);release();assert.throws(()=>acquirePreparationLock(path),/owner exists/);next();}finally{for(const name of readdirSync(dir))unlinkSync(join(dir,name));rmdirSync(dir);}
});
const friday=new Date('2026-10-23T10:00:00Z'),metadata={symbolInfo:{exchange:'EGX',timezone:'Africa/Cairo',session:'1000-1430:12345',session_holidays:'20260101,20261008',delay:900},symbolExt:{exchange:'EGX',delay:900}},stock={metadata:JSON.stringify(metadata),retrieved_at:'2026-10-23T08:00:00Z'},bar={day:'2026-10-22',captured_at:'2026-10-23T08:00:00Z'};
test('running selector reuses Thursday on Friday/weekend/preopen and advances after next close',()=>{
 for(const now of [friday,new Date('2026-10-24T10:00Z'),new Date('2026-10-25T05:00Z')])assert.equal(historyRefreshState(stock,bar,now).due,false);
 assert.equal(expectedHistorySession(stock,new Date('2026-10-25T17:00Z')).day,'2026-10-25');assert.equal(historyRefreshState(stock,bar,new Date('2026-10-25T17:00Z')).due,true);
});
test('provider holiday and unknown metadata do not create a fabricated current session',()=>{
 assert.equal(expectedHistorySession(stock,new Date('2026-10-08T17:00Z')).day,'2026-10-07');assert.equal(expectedHistorySession({},friday).day,null);assert.equal(historyRefreshState({},bar,friday).due,true);
});
test('stale metadata capture and unsupported session cannot certify reuse',()=>{
 assert.equal(historyRefreshState({...stock,retrieved_at:'2026-10-01T00:00Z'},bar,friday).due,true);assert.equal(expectedHistorySession({metadata:{symbolInfo:{...metadata.symbolInfo,session:'unknown'}}},friday).day,null);
});
test('repair attempts are retained, target scoped and honor retry timestamps',()=>{
 const db=openDb(':memory:');try{initPreparation(db);attempt(db,{ticker:'TEST',target:'2026-10-22',at:friday.toISOString(),status:'partial',detail:'Missing current bar',rawPath:'fixture.json'});assert.equal(repairDue(db,'TEST','2026-10-22',friday),false);assert.equal(repairDue(db,'TEST','2026-10-25',friday),true);attempt(db,{ticker:'TEST',target:'2026-10-22',at:friday.toISOString(),status:'verified'});assert.equal(db.prepare('SELECT COUNT(*) n FROM preparation_attempts').get().n,2);assert.equal(readinessOverview(db).repairs.length,0);}finally{db.close();}
});
test('bulk receipts retain missing symbols without repeating successful component',()=>{const db=openDb(':memory:');try{initPreparation(db);receipt(db,'facts-stocks','2026-10-23',{missingFromResponse:['HALN']},friday);assert.equal(receiptFor(db,'facts-stocks','2026-10-23').status,'completed');assert.deepEqual(receiptFor(db,'facts-stocks','2026-10-23').payload.missingFromResponse,['HALN']);assert.equal(receiptFor(db,'facts-benchmarks','2026-10-23'),null);}finally{db.close();}});
function review(){const fact={status:'verified',asOf:'2026-10-22',sourceIds:['primary'],note:'Synthetic verified fact'},a={evidenceChecks:Object.fromEntries(['financials','ownership','news','corporateActions','technicals','liquidity'].map(x=>[x,{...fact}])),fieldEvidence:evidenceFixture(friday,'primary')};return {a,report:{sources:[{id:'primary'}]}};}
test('new live promotion contract permits explicit noncritical ownership gap with independent treatment',()=>{
 const {a,report}=review();a.evidenceChecks.ownership.status='partial';a.fieldEvidence.gaps=[{field:'ownership_control',area:'ownership',attempts:['issuer register unavailable'],consequence:'Ownership percentages unresolved',nextReview:'Next issuer disclosure',materialityRationale:'Control events separately verified',riskTreatment:'Conservative scenario pending new risk sizing',independentReview:{reviewer:'challenger',rationale:'Control risk checked separately'}}];assert.equal(validateFieldEvidence(report,a,friday).gaps.length,1);
});
test('missing corporate action or solvency evidence cannot use degraded route',()=>{
 for(const field of ['corporate_actions','solvency_bank_metrics','ownership_control_events']){const {a,report}=review();delete a.fieldEvidence.fields[field];assert.throws(()=>validateFieldEvidence(report,a,friday),/critical field/);}
});
test('value-thesis input declared as relied upon cannot be omitted',()=>{
 const {a,report}=review();a.fieldEvidence.reliedUponFields=['price_earnings_ttm'];assert.throws(()=>validateFieldEvidence(report,a,friday),/price_earnings/);
});
test('unexplained partial sections cannot slip through new contract',()=>{
 const {a,report}=review();a.evidenceChecks.financials.status='partial';assert.throws(()=>validateFieldEvidence(report,a,friday),/explicit field gaps/);
});
test('optional verified claims still require sources and cannot contradict a gap',()=>{
 const {a,report}=review();a.fieldEvidence.fields.AnalystRating={status:'verified',note:'No actual source'};assert.throws(()=>validateFieldEvidence(report,a,friday),/Unsourced verified field/);
 a.fieldEvidence.fields.AnalystRating={...a.fieldEvidence.fields.currency};a.fieldEvidence.gaps=[{field:'AnalystRating'}];assert.throws(()=>validateFieldEvidence(report,a,friday),/also declared unresolved/);
});
test('field levels distinguish optional, conditional and sector inapplicability',()=>{
 assert.equal(fieldConsequence('AnalystRating').level,'optional');assert.equal(fieldConsequence('current_ratio',{sector:'Major Banks'}).level,'not-applicable');assert.equal(fieldConsequence('price_earnings_ttm').level,'claim-dependent');assert.equal(fieldConsequence('price_earnings_ttm',{claims:['value']}).level,'critical');
});
test('all dictionary fields persist for missing stock without deletion or invented trade readiness',()=>{
 const db=openDb(':memory:');try{initMarket(db);initFacts(db);db.prepare("INSERT INTO market_catalog(ticker,status) VALUES('COMI','pending')").run();const p=preparationManifest(db,friday);assert.equal(p.universe,1);assert.equal(p.instruments[0].fields.length,evidenceDictionary.length);assert.equal(p.instruments[0].fields.length,78);assert.equal(p.summary.tradeReady,0);assert.equal(p.instruments[0].status,'RESEARCH_RETAINED');}finally{db.close();}
});
test('excluded and local document routes rejected including redirect destinations',async()=>{
 for(const url of ['https://mubasher.info/x','https://a.stockanalysis.com/x','http://issuer.com','https://127.0.0.1/x','https://localhost/x'])assert.equal(allowedDocumentUrl(url,['mubasher.info','stockanalysis.com']),false);
 await assert.rejects(captureDocument('https://issuer.example/report',{excluded:['mubasher.info'],fetcher:async()=>new Response(null,{status:302,headers:{location:'https://mubasher.info/x'}})}),/Redirect/);
});
test('document capture deduplicates content and conditional validation retains original evidence',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'egx-doc-test-'));try{const first=await captureDocument('https://issuer.example/report',{directory:dir,excluded:[],fetcher:async()=>new Response('fixture',{headers:{etag:'v1','content-type':'application/pdf'}})});const next=await captureDocument(first.url,{directory:dir,excluded:[],previous:first,fetcher:async(url,opts)=>{assert.equal(opts.headers['If-None-Match'],'v1');return new Response(null,{status:304});}});assert.equal(next.sha256,first.sha256);assert.equal(next.publicationVerified,false);assert.equal(readdirSync(dir).length,1);}finally{for(const name of readdirSync(dir))unlinkSync(join(dir,name));rmdirSync(dir);}
});
