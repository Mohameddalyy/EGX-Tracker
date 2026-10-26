import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {hash} from './v5/contract.mjs';
import {initialState,transition} from './v5/execution.mjs';
import {executionFixture,acceptance,minuteFixture,fixtureSource,fullProposal,riskExitFixture} from './v5/execution-fixtures.mjs';
import {fixedExitAttributionFromEvents,fixedExitAttribution} from './v5/fixed-exit-attribution.mjs';
import {openExecutionStore} from './v5/execution-store.mjs';
import {registerTrial,immutableWrite,armIds} from './v5/evaluation-contract.mjs';
import {executionReleaseHash} from './v5/risk.mjs';
import {boundComparisonInput} from './v5/evaluation-provenance.mjs';
import {readEvaluationLedger,ledgerMetrics} from './v5/evaluation-ledger.mjs';
import {readArtifact} from './v5/evaluation-contract.mjs';
import {comparisonMatrix} from './v5/evaluation-matrix.mjs';
import {freezeCase,modelSuite,caseTemporalContext,blindPacket,scoreModelCase} from './v5/evaluation-models.mjs';
import {caseCategories,rubricDimensions} from './v5/evaluation-contract.mjs';
import {researchEvidence,reviewFixture} from './v5/fixtures.mjs';
import {evaluateUniverse} from './v5/signals.mjs';
import {buildResearchPacket} from './v5/research.mjs';

function scenario({risk=false,variant='FULL',cost='base',fill=true}={}) {
  const f=executionFixture(variant,cost),events=[];let state=initialState(f.config);
  const add=(type,at,data={})=>{const e={id:'e'+events.length,type,at,data};state=transition(state,e).state;events.push(e);return e;};
  add('OPEN_DAY','2026-10-25T06:40:00Z',{book:f.book,marks:[]});
  add('SET_PAUSE','2026-10-25T06:45:00Z',{paused:false,reason:'Synthetic W7 regression'});
  add('SUBMIT','2026-10-25T06:51:00.000Z',acceptance(f,state,variant==='FULL'?fullProposal:{}));
  if(fill)add('MINUTE','2026-10-25T07:17:10Z',{book:f.book,bar:minuteFixture(f.isin)});
  if(risk){add('RISK_EXIT','2026-10-25T07:18:00Z',riskExitFixture(state,'synthetic-order','2026-10-25T07:18:00Z'));add('MINUTE','2026-10-27T07:17:10Z',{book:f.book,bar:minuteFixture(f.isin,'2026-10-27'),dailyVolume:{...fixtureSource,isin:f.isin,forDay:'2026-10-27',basis:'PRIOR_MEDIAN20_RAW_SHARES',value:1000000}});}
  return {f,events,add,get state(){return state;},run(options={}){return fixedExitAttributionFromEvents({config:f.config,events,...options});}};
}
for(const variant of ['B1','FULL'])for(const cost of ['base','stress'])test(`unchanged exits reproduce original economics: ${variant}/${cost}`,()=>{
  const x=scenario({variant,cost}),before=hash(x.events),r=x.run();assert.deepEqual(r.actual,r.counterfactual);assert.equal(r.actualMinusFixedExitEquityCents,0);assert.equal(r.blockedEvents,0);assert.equal(hash(x.events),before);
});
test('discretionary exit suppressed; cash and shares remain in the alternate portfolio',()=>{
  const x=scenario({risk:true}),r=x.run();assert.equal(r.suppressedRiskExits,1);assert.equal(r.actual.positions[0].status,'CLOSED');assert.equal(r.counterfactual.positions[0].status,'HELD');assert.equal(r.counterfactual.settlements.length,0);assert.ok(r.actual.feesCents>r.counterfactual.feesCents);assert.equal(r.entryAuthorization,false);
});
test('missing later mark stays blocked, does not borrow original sale proceeds',()=>{
  const x=scenario({risk:true});x.add('OPEN_DAY','2026-10-29T06:40:00Z',{book:x.f.book,marks:[]});const r=x.run();assert.equal(r.blockedEvents,1);assert.equal(r.counterfactual.valuation.equityCents,null);assert.equal(r.actualMinusFixedExitEquityCents,null);assert.ok(r.actual.cashCents>r.counterfactual.cashCents);
});
test('additional held-name prior-close mark is verified and bound to original open',()=>{
  const x=scenario({risk:true}),e=x.add('OPEN_DAY','2026-10-29T06:40:00Z',{book:x.f.book,marks:[]}),mark={...fixtureSource,isin:x.f.isin,price:70,asOfDay:'2026-10-28',availableAt:'2026-10-28T12:20:00Z',validUntil:'2026-10-29T11:30:00Z'};
  const r=x.run({openingMarks:{[e.id]:[mark]}});assert.equal(r.blockedEvents,0);assert.ok(r.counterfactual.valuation.equityCents>0);assert.equal(r.counterfactual.positions[0].status,'HELD');assert.equal(r.counterfactual.settlements.length,0);
  assert.throws(()=>x.run({openingMarks:{unknown:[mark]}}),/original opening/);
});
test('mandatory stop still needs a later eligible minute and full liquidity',()=>{
  const x=scenario({risk:true});x.add('MINUTE','2026-10-27T07:18:10Z',{book:x.f.book,bar:minuteFixture(x.f.isin,'2026-10-27','07:02:00',{low:68})});
  let r=x.run();assert.equal(r.counterfactual.positions[0].status,'EXIT_PENDING');assert.equal(r.counterfactual.positions[0].exit.reason,'STOP_BREACH');
  x.add('MINUTE','2026-10-27T07:35:10Z',{book:x.f.book,bar:minuteFixture(x.f.isin,'2026-10-27','07:19:00',{low:68,open:69,high:70,close:69}),dailyVolume:{...fixtureSource,isin:x.f.isin,forDay:'2026-10-27',basis:'PRIOR_MEDIAN20_RAW_SHARES',value:1000000}});
  r=x.run();assert.equal(r.counterfactual.positions[0].status,'CLOSED');assert.equal(r.counterfactual.settlements.length,1);
});
test('supplement cannot create exposure on only one side with no discretionary exit',()=>{
  const x=scenario({variant:'B1',fill:false});x.add('TICK','2026-10-25T07:20:00Z');assert.throws(()=>x.run({supplementalEvents:[{id:'extra',type:'MINUTE',at:'2026-10-25T07:17:10Z',data:{book:x.f.book,bar:minuteFixture(x.f.isin)}}]}),/asymmetric/);
});
test('supplements cannot change decisions or extend the period',()=>{
  const x=scenario({risk:true});assert.throws(()=>x.run({supplementalEvents:[{id:'extra',type:'SUBMIT',at:'2026-10-26T08:00:00Z'}]}),/exogenous/);assert.throws(()=>x.run({supplementalEvents:[{id:'extra',type:'MINUTE',at:'2026-10-30T08:00:00Z'}]}),/outside/);
});
test('tampered original approval fails before attribution',()=>{
  const x=scenario({risk:true});x.events.find(e=>e.type==='SUBMIT').data.decision.execution.quantity++;assert.throws(()=>x.run());
});
test('mandatory corporate-action hold cannot be erased by discretionary attribution',()=>{
  const x=scenario({risk:true});x.add('CORPORATE_ACTION_HOLD','2026-10-27T07:20:00Z',{...fixtureSource,isin:x.f.isin,reason:'Synthetic unresolved split'});const r=x.run();assert.ok(r.counterfactual.positions[0].actionHold);assert.equal(r.counterfactual.valuation.equityCents,null);
});
test('later desired entry recomputes funded cash after the original sale is suppressed',()=>{
  const x=scenario({risk:true}),open=x.add('OPEN_DAY','2026-10-29T06:40:00Z',{book:x.f.book,marks:[]});
  // A separately generated synthetic signal vintage, not a historical price claim.
  const input=JSON.parse(JSON.stringify(x.f.bundle.signalInput).replace(/202\d-\d{2}-\d{2}/g,d=>new Date(Date.parse(d+'T00:00:00Z')+6*86400000).toISOString().slice(0,10)));
  const isin=input.universe[1].instrument.isin,evidence=researchEvidence(input),packet=buildResearchPacket(evaluateUniverse(input),isin,'FULL',evidence);
  const review=JSON.parse(JSON.stringify(reviewFixture(packet)).replaceAll('2026-10-22','2026-10-28'));
  review.challenge.reviewHash=hash(Object.fromEntries(Object.entries(review).filter(([k])=>k!=='challenge')));
  const f={...x.f,bundle:{...x.f.bundle,isin,signalInput:input,researchEvidence:evidence,researchReview:review,preflight:{...fixtureSource,isin,day:'2026-10-29',availableAt:'2026-10-29T06:50:00Z',criticalGaps:[],materialChange:false}}};
  const proposal={...fullProposal,exceptionIds:[...fullProposal.exceptionIds,'ALLOCATION_PRIORITY']};
  x.add('SUBMIT','2026-10-29T06:51:00Z',acceptance(f,x.state,proposal,'second','2026-10-29T06:50:00Z','2026-10-29T06:51:00Z'));
  const r=x.run({openingMarks:{[open.id]:[{...fixtureSource,isin:x.f.isin,price:70,asOfDay:'2026-10-28',availableAt:'2026-10-28T12:20:00Z',validUntil:'2026-10-29T11:30:00Z'}]}});
  const row=r.trace.at(-1);assert.equal(row.result.status,'CONDITIONAL_RESERVATION');assert.ok(row.result.quantity<row.result.originalQuantity);assert.ok(row.result.quantity>0);assert.ok(row.counterfactual.valuation.availableCashCents>=0);assert.equal(row.result.desiredBudget.maxCashAllocationEGP,100000);assert.equal(r.counterfactual.positions[0].status,'HELD');
});

function withLedger(fn){const x=scenario({risk:true}),dir=mkdtempSync(join(tmpdir(),'w7-')),path=join(dir,'ledger.sqlite');try{const s=openExecutionStore(path,x.f.config);for(const e of x.events)s.append(e,{clock:new Date('2026-11-01')});s.close();return fn(x,dir,path);}finally{rmSync(dir,{recursive:true,force:true});}}
test('ledger wrapper is read-only and forbids event/config substitution',()=>withLedger((x,dir,path)=>{const before=hash(readFileSync(path));assert.equal(fixedExitAttribution(path).suppressedRiskExits,1);assert.equal(hash(readFileSync(path)),before);assert.throws(()=>fixedExitAttribution(path,{events:[]}),/cannot replace/);}));
function trialFile(dir,overrides={}) {const h='a'.repeat(64),t=registerTrial({id:'W7-test',scope:'SYNTHETIC_ENGINEERING',registeredAt:'2026-10-25T00:00:00Z',codeDigest:h,codeRevision:'test',executionReleaseHash:executionReleaseHash(),admissionManifestHash:h,dataManifestHash:h,arms:armIds.map(id=>({id,status:'UNAVAILABLE',reason:'Engineering only'})),priorTrials:[]},'2026-10-26T00:00:00Z');Object.assign(t.bindings,overrides);const path=join(dir,'trial.json');immutableWrite(path,'trial',t);return path;}
function boundInput(x,trialPath,path){return {trialPath,ledgers:[{id:'FULL:base',path}],baselineDay:'2026-10-22',sessions:x.f.book.sessions.filter(s=>s.day<='2026-10-27')};}
test('source-bound reporting retains gaps and cannot upgrade engineering scope',()=>withLedger((x,d,p)=>{const r=boundComparisonInput(boundInput(x,trialFile(d),p));assert.equal(r.scope,'SOURCE_BOUND_ENGINEERING');assert.ok(r.arms[0].returns.some(r=>r.value===null));assert.equal(r.arms[0].appropriateClosedObservations,1);}));
test('late baseline cannot attach earlier P&L to a later period',()=>withLedger((x,d,p)=>{const i=boundInput(x,trialFile(d),p);i.baselineDay='2026-10-25';i.sessions=i.sessions.filter(s=>s.day>=i.baselineDay);assert.throws(()=>boundComparisonInput(i),/Baseline must precede/);}));
test('missing registered entry session fails, not a compressed return horizon',()=>withLedger((x,d,p)=>{const i=boundInput(x,trialFile(d),p);i.sessions=i.sessions.filter(s=>s.day!=='2026-10-26');assert.throws(()=>boundComparisonInput(i),/omits/);}));
test('changed scoring release cannot reuse an old trial silently',()=>withLedger((x,d,p)=>{assert.throws(()=>boundComparisonInput(boundInput(x,trialFile(d,{evaluationReleaseHash:'a'.repeat(64)}),p)),/evaluation release/);}));
test('omitted post-entry session cannot compress the daily calendar',()=>withLedger((x,d,p)=>{const i=boundInput(x,trialFile(d),p);i.sessions=x.f.book.sessions.filter(s=>s.day<='2026-11-02'&&s.day!=='2026-11-01');assert.throws(()=>boundComparisonInput(i),/Full reporting calendar/);}));
test('matrix refuses attribution from another ledger state',()=>withLedger((x,d,p)=>{const trial=readArtifact(trialFile(d),'trial').payload,report={kind:'ledger',contentHash:'a'.repeat(64),payload:ledgerMetrics(readEvaluationLedger(p))},attribution={kind:'fixed-exit',contentHash:'b'.repeat(64),payload:fixedExitAttribution(p)};assert.equal(comparisonMatrix(trial,[report],[attribution]).fixedExitAttribution.status,'CONDITIONAL_REPLAYS_ATTACHED');attribution.payload.originalFinalStateHash='c'.repeat(64);assert.throws(()=>comparisonMatrix(trial,[report],[attribution]),/same original ledger/);}));
test('approved amendment binds exact document and adds no activation',()=>{
  const p='verification/w7-completion-20261026/approved-comparison-amendment.json',a=readArtifact(p,'comparison-amendment'),h='a'.repeat(64);
  const input={id:'amended-test',scope:'PROSPECTIVE_DRAFT',registeredAt:a.createdAt,codeDigest:h,codeRevision:'test',executionReleaseHash:executionReleaseHash(),admissionManifestHash:h,dataManifestHash:h,arms:armIds.map(id=>({id,status:'UNAVAILABLE',reason:'No prospective evidence'})),priorTrials:[],amendmentPath:p};
  const t=registerTrial(input,a.createdAt);assert.equal(t.bindings.comparisonAmendmentHash,a.contentHash);assert.equal(t.statisticalProtocol.minimumAdditionalNetWealthCents,100000);assert.equal(t.activation,'NOT_AUTHORIZED');assert.match(t.statisticalProtocol.riskAcceptance,/no added FULL cap/);input.registeredAt='2026-10-01T00:00:00Z';assert.throws(()=>registerTrial(input,a.createdAt),/precede trial/);
});
test('suite uses registered aggregate95% floor while retaining noncritical case failures',()=>{
  const h='a'.repeat(64),at='2026-10-25T00:00:00Z',cases=Array.from({length:20},(_,i)=>freezeCase({id:'contract-'+i,task:'Synthetic scoring boundary',categories:[caseCategories[i%10]],cutoffAt:at,frozenAt:at,evidence:[{id:'e',contentHash:h,source:'https://example.com/test',availableAt:at,passage:'Synthetic value1'}],truth:{checkedBy:'test-adjudicator',checkedAt:at,numbers:[{id:'n',value:1,absoluteTolerance:0,unit:'EGP',period:'test',entity:'test',evidenceId:'e'}]}}));
  const scores=cases.map((c,i)=>({caseId:c.id,caseHash:c.caseHash,modelId:'unit-test-only',configurationHash:h,promptHash:h,toolPermissionsHash:h,correct:i?1:0,denominator:1,criticalFabrications:0,criticalUnitPeriodIdentityErrors:0,status:i?'FACTUAL_GATE_PASS':'CASE_FAIL',rubric:Object.fromEntries(rubricDimensions.map(d=>[d,{score:3,reason:'Test fixture'}]))}));
  let result=modelSuite(cases,scores).models[0];assert.equal(result.status,'FACTUAL_GATE_PASS');assert.equal(result.accuracy,.95);assert.deepEqual(result.caseFailures,['contract-0']);scores[1].correct=0;assert.equal(modelSuite(cases,scores).models[0].status,'FAIL');scores[1].correct=1;scores[0].criticalUnitPeriodIdentityErrors=1;assert.equal(modelSuite(cases,scores).models[0].status,'FAIL');
});
test('case context distinguishes heterogeneous cutoffs and preserves legacy packet bindings',()=>{
  const root='verification/w7-completion-20261026',c=readArtifact(root+'/frozen-cases/W7-11.json','case').payload,run=readArtifact(root+'/runs/W7-11.json','actual-model-run').payload;
  assert.equal(hash(blindPacket(c)),run.packetHash);const context=caseTemporalContext(c);assert.equal(context.cutoffAt,'2026-10-25T22:56:32.892Z');assert.equal(context.evidence[0].secondsBeforeCutoff,19.906);assert.equal(context.evidence[0].availableAtCutoff,true);
  const corrected={...run,packetFormat:'CASE_CONTEXT_1',packetHash:hash(blindPacket(c,'CASE_CONTEXT_1')),caseContext:context},review=JSON.parse(readFileSync(root+'/independent-review/excerpt-reviews/W7-11.json','utf8'));review.runHash=hash(corrected);
  // Correct context cannot erase independently found errors in the original prose.
  assert.equal(scoreModelCase(c,corrected,review).status,'CASE_FAIL');corrected.caseContext={...context,cutoffAt:'2026-10-25T22:55:55.225Z'};review.runHash=hash(corrected);assert.throws(()=>scoreModelCase(c,corrected,review),/answer context differs/);
});

