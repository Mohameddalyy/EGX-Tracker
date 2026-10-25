import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {hash,variants} from './v5/contract.mjs';
import {initialState,transition} from './v5/execution.mjs';
import {executionReleaseHash} from './v5/risk.mjs';
import {openExecutionStore} from './v5/execution-store.mjs';
import {executionFixture,acceptance,minuteFixture,fixtureSource,fullProposal} from './v5/execution-fixtures.mjs';
import {signalFixture} from './v5/fixtures.mjs';
import {readEvaluationLedger,ledgerMetrics,valuation,observedDrawdown,dailyEquity} from './v5/evaluation-ledger.mjs';
import {armIds,immutableWrite,readArtifact,registerTrial,rubricDimensions} from './v5/evaluation-contract.mjs';
import {opportunityCohort,forecastOutcomes,benchmarkComparison,operationalCoverage} from './v5/evaluation-cohorts.mjs';
import {blockDiagnostic,holm,comparisonFamily} from './v5/evaluation-statistics.mjs';
import {freezeCase,blindPacket,scoreModelCase,modelSuite} from './v5/evaluation-models.mjs';
import {comparisonMatrix} from './v5/evaluation-matrix.mjs';

const h='a'.repeat(64),at='2026-10-25T06:51:00Z';
function fixture({close=true,variant='B1',scenario='base',volume=1000000}={}) {
  const f=executionFixture(variant,scenario);let state=initialState(f.config);const events=[],trace=[{at:null,eventType:'INITIAL',state}];
  function add(type,time,data){const e={id:'event-'+events.length,type,at:time,data};state=transition(state,e).state;events.push(e);trace.push({at:time,eventType:type,state});}
  add('OPEN_DAY','2026-10-25T06:40:00Z',{book:f.book,marks:[]});
  add('SET_PAUSE','2026-10-25T06:45:00Z',{paused:false,reason:'Synthetic evaluation test'});
  add('SUBMIT',at,acceptance(f,state,variant==='FULL'?fullProposal:{}));
  add('MINUTE','2026-10-25T07:17:10Z',{book:f.book,bar:minuteFixture(f.isin,undefined,undefined,{low:68})});
  if(close)add('MINUTE','2026-10-27T07:17:10Z',{book:f.book,bar:minuteFixture(f.isin,'2026-10-27','07:01:00',{volume,open:69,low:68,high:70,close:69}),dailyVolume:{...fixtureSource,isin:f.isin,forDay:'2026-10-27',basis:'PRIOR_MEDIAN20_RAW_SHARES',value:1000000}});
  return {config:f.config,state,events,trace,transitionReplay:'VERIFIED',chainHead:'unit-test',stateHash:hash(state),book:f.book};
}
const completed=fixture(),open=fixture({close:false}),liquidity=fixture({variant:'FULL',volume:1000});

test('closed ledger reconciles cash plus unsettled proceeds with integer P&L and costs',()=>{
  const m=ledgerMetrics(completed);assert.equal(m.netCents,-56839);assert.equal(m.feesCents,8423);assert.equal(m.realizedCents,-56839);assert.equal(m.unrealizedCents,0);assert.equal(m.counts.closedTrades,1);assert.equal(m.valuation.cashCents+m.valuation.unsettledCents,9943161);assert.equal(m.profitFactor,0);assert.equal(m.hitRate,0);assert.equal(m.grossBeforeFeesCents,-48416);assert.equal(m.modeledSlippageCents,12816);assert.equal(m.trades[0].rMultiple,-56839/84565);
});
test('open mark P&L includes entry fee but not a fabricated exit fee',()=>{
  const m=ledgerMetrics(open);assert.equal(m.counts.closedTrades,0);assert.equal(m.netCents,m.unrealizedCents);assert.equal(m.realizedCents,0);assert.equal(m.hitRate,null);assert.equal(m.expectancyCents,null);assert.equal(m.profitFactor,null);assert.equal(m.profitabilityStatus,'INCONCLUSIVE_NO_CLOSED_TRADES');
});
test('stale or action-held marks invalidate total return without erasing cash or realized P&L',()=>{
  const m=ledgerMetrics(open,{at:'2026-10-26T06:00:00Z'});assert.equal(m.netCents,null);assert.equal(m.unrealizedCents,null);assert.equal(m.realizedCents,0);assert.equal(m.valuation.unavailable.length,1);
  const s=structuredClone(open.state);Object.values(s.positions)[0].actionHold={reason:'split'};assert.equal(valuation(s).equityCents,null);
});
test('pending illiquid exits remain exposure and are not counted as completed trades',()=>{
  const m=ledgerMetrics(liquidity);assert.equal(m.counts.pendingExits,1);assert.equal(m.counts.closedTrades,0);assert.equal(m.pendingExits[0].attempts.at(-1).status,'FULL_QUANTITY_MINUTE_CAPACITY');assert.ok(m.exposureFraction>.99);
});
test('unfilled intents change counts without generating profit',()=>{
  const f=executionFixture('FULL','stress');let state=initialState(f.config);const trace=[],events=[];
  for(const [type,time,data] of [['OPEN_DAY','2026-10-25T06:40:00Z',{book:f.book,marks:[]}],['SET_PAUSE','2026-10-25T06:45:00Z',{paused:false,reason:'Synthetic evaluation test'}]]){const e={id:type,type,at:time,data};state=transition(state,e).state;trace.push({at:time,state});events.push(e);}
  const e={id:'submit',type:'SUBMIT',at,data:acceptance(f,state,fullProposal)};state=transition(state,e).state;trace.push({at,state});events.push(e);
  const m=ledgerMetrics({state,trace,events,transitionReplay:'VERIFIED'});assert.equal(m.counts.unfilled,1);assert.equal(m.netCents,0);assert.equal(m.hitRate,null);
});
test('inconsistent entry costs and fees fail reconciliation',()=>{
  const a=structuredClone(completed);a.state.feesCents++;assert.throws(()=>ledgerMetrics(a),/reconcile/);
  a.state.feesCents--;Object.values(a.state.positions)[0].entryCostCents++;assert.throws(()=>ledgerMetrics(a),/Entry cost/);
});
test('cash flow outside supported engine cannot silently become profit',()=>{
  const a=structuredClone(completed);a.state.cashCents+=100;assert.throws(()=>ledgerMetrics(a),/identity/);
});
test('missing fill reference is unavailable slippage, never zero',()=>{
  const a=structuredClone(completed);a.events=[];assert.equal(ledgerMetrics(a).modeledSlippageCents,null);
});
test('drawdown is snapshot-specific and gaps retain incomplete status',()=>{
  const d=observedDrawdown([{at:'a',equityCents:120},{at:'b',equityCents:null},{at:'c',equityCents:90}],100);assert.equal(d.fraction,.25);assert.equal(d.recoveryRequiredFraction,1/3);assert.equal(d.gaps,1);
});
test('no event-time marks are misrepresented as daily closing equity',()=>{
  const daily=dailyEquity(open,[open.book.sessions.find(s=>s.day==='2026-10-25')]);assert.equal(daily[0].equityCents,null);
});
test('read-only SQLite reader replays results and leaves database bytes unchanged',()=>{
  const dir=mkdtempSync(join(tmpdir(),'v5-eval-')),path=join(dir,'ledger.sqlite');
  try {const store=openExecutionStore(path,completed.config);for(const e of completed.events)store.append(e,{clock:new Date('2026-11-01')});store.close();const before=hash(readFileSync(path)),audit=readEvaluationLedger(path);assert.equal(audit.transitionReplay,'VERIFIED');assert.equal(hash(readFileSync(path)),before);assert.equal(ledgerMetrics(audit).netCents,-56839);
    const db=new DatabaseSync(path);db.prepare('UPDATE v5_events SET result=? WHERE sequence=1').run('{}');db.close();assert.throws(()=>readEvaluationLedger(path),/result replay/);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
test('hash-chain corruption is rejected before metrics',()=>{
  const dir=mkdtempSync(join(tmpdir(),'v5-eval-')),path=join(dir,'ledger.sqlite');try {const store=openExecutionStore(path,completed.config);store.append(completed.events[0],{clock:new Date('2026-11-01')});store.close();const db=new DatabaseSync(path);db.exec("UPDATE v5_events SET previousHash='invalid'");db.close();assert.throws(()=>readEvaluationLedger(path),/hash chain/);}finally{rmSync(dir,{recursive:true,force:true});}
});
test('nonisolated database is refused',()=>{
  const dir=mkdtempSync(join(tmpdir(),'v5-eval-')),path=join(dir,'other.sqlite');try{const db=new DatabaseSync(path);db.exec('CREATE TABLE trades(id)');db.close();assert.throws(()=>readEvaluationLedger(path),/isolated/);}finally{rmSync(dir,{recursive:true,force:true});}
});
function trial(){return {id:'engineering-evaluation',scope:'SYNTHETIC_ENGINEERING',registeredAt:'2026-10-26T08:00:00Z',codeDigest:h,codeRevision:'test',executionReleaseHash:executionReleaseHash(),admissionManifestHash:h,dataManifestHash:h,arms:armIds.map(id=>({id,status:'UNAVAILABLE',reason:'No prospective data'})),priorTrials:[]};}
test('trial retains all 18 arms and all 6 classes of unproven claims outside activation',()=>{
  const t=registerTrial(trial(),'2026-10-26T09:00:00Z');assert.equal(t.arms.length,18);assert.equal(t.capitalCentsPerArm,10000000);assert.equal(t.activation,'NOT_AUTHORIZED');assert.equal(t.statisticalProtocol.comparisons,16);
});
test('missing/duplicate comparison arms cannot be silently dropped',()=>{
  const t=trial();t.arms.pop();assert.throws(()=>registerTrial(t,'2026-10-26T09:00:00Z'),/18/);t.arms.push(t.arms[0]);assert.throws(()=>registerTrial(t,'2026-10-26T09:00:00Z'),/18/);
});
test('available research arm requires real actor/configuration bindings',()=>{
  const t=trial(),a=t.arms.find(a=>a.id==='FULL:base');a.status='AVAILABLE';a.inputManifestHash=h;assert.throws(()=>registerTrial(t,'2026-10-26T09:00:00Z'),/identities/);
});
test('immutable artifact refuses overwrite and detects edited payload',()=>{
  const dir=mkdtempSync(join(tmpdir(),'v5-eval-')),path=join(dir,'a.json');try{immutableWrite(path,'test',{a:1});assert.equal(readArtifact(path,'test').payload.a,1);assert.throws(()=>immutableWrite(path,'test',{a:2}),/EEXIST/);const a=JSON.parse(readFileSync(path));a.payload.a=2;writeFileSync(path,JSON.stringify(a));assert.throws(()=>readArtifact(path,'test'),/hash/);}finally{rmSync(dir,{recursive:true,force:true});}
});
test('cohort retains full catalog times variants, unanswered and waiting candidates',()=>{
  const input=signalFixture(),c=opportunityCohort(input);assert.equal(c.rows.length,input.universe.length*Object.keys(variants).length);const r=c.rows.find(r=>r.mechanicallyEligible),d={id:'wait',opportunityId:r.id,status:'WAIT',reason:'Needs financial reconciliation',at:input.cutoffAt,evidenceHash:h};const next=opportunityCohort(input,[d]);assert.equal(next.rows.length,c.rows.length);assert.equal(next.counts[r.variantId].mechanicallyEligible,c.counts[r.variantId].mechanicallyEligible);assert.equal(next.counts[r.variantId].unfinished,c.counts[r.variantId].unfinished-1);
});
test('unknown and retroactive cohort decisions fail',()=>{
  const input=signalFixture();assert.throws(()=>opportunityCohort(input,[{id:'a',opportunityId:'bad',at:input.cutoffAt}]),/Unknown/);
});
const days=Array.from({length:61},(_,i)=>new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10));
const point=(day,close=100)=>({day,close,verified:true,confirmed:true,sourceId:'fixture',sourceHash:h,availableAt:day+'T15:00:00Z',basis:'ADJUSTED_CLOSE',adjustmentBasisId:'vintage1',basisId:'index-v1'});
function forecasts(){return {anchor:{...point(days[0]),committedAt:days[0]+'T16:00:00Z'},sessions:days.map(day=>({day,verified:true})),points:days.map(day=>point(day,110)),cutoffAt:days.at(-1)+'T16:00:00Z'};}
test('forecast 5/20/60 anchors are original signal close with session denominators',()=>{const r=forecastOutcomes(forecasts());assert.deepEqual(r.map(x=>x.day),[days[5],days[20],days[60]]);assert.ok(r.every(x=>Math.abs(x.returnFraction-.1)<1e-12));});
test('immature, missing and incoherent forecast outcomes remain distinct',()=>{
  const f=forecasts();f.points=f.points.filter(p=>p.day!==days[5]);f.points.find(p=>p.day===days[20]).adjustmentBasisId='different';f.cutoffAt=days[30]+'T16:00:00Z';assert.deepEqual(forecastOutcomes(f).map(r=>r.status),['CENSORED_MISSING_OR_INCOHERENT_PRICE','CENSORED_MISSING_OR_INCOHERENT_PRICE','IMMATURE']);
});
function bench(){return {baselineDay:days[0],sessions:days.slice(0,3).map(day=>({day,verified:true})),portfolio:days.slice(1,3).map(day=>({day,status:'VERIFIED',equityCents:11000000,stateHash:h})),benchmarks:['EGX30','EGX70EWI'].map(symbol=>({symbol,basis:'PRICE_INDEX',points:[point(days[0],100),point(days[1],105),point(days[2],108)]})),cutoffAt:days[2]+'T16:00:00Z'};}
test('same-period index excess uses baseline close; no executable basket fiction',()=>{const b=benchmarkComparison(bench());assert.equal(b.indexes[0].status,'COMPLETE');assert.ok(Math.abs(b.indexes[0].aligned[1].excessReturnFraction-.02)<1e-12);assert.equal(b.buyAndHold.status,'BLOCKED_AMENDMENT_REQUIRED');});
test('benchmark gaps and missing portfolio marks cannot forward fill',()=>{const b=bench();b.benchmarks[0].points.splice(1,1);b.portfolio[1].equityCents=null;const r=benchmarkComparison(b);assert.equal(r.indexes[0].missingDays.length,2);assert.equal(r.indexes[1].missingDays.length,1);});
test('benchmark identity duplicates and mismatched return bases rejected or unavailable',()=>{const b=bench();b.benchmarks[0].basis='TOTAL_RETURN';assert.equal(benchmarkComparison(b).indexes[0].status,'INCOMPLETE');b.benchmarks[1].symbol='EGX30';assert.throws(()=>benchmarkComparison(b),/unique/);});
test('checkpoint denominator retains missing runs and actual lateness',()=>{const r=operationalCoverage([{id:'a',dueAt:at,hardDeadlineMinutes:8},{id:'b',dueAt:at,hardDeadlineMinutes:8}],[{id:'a',startedAt:'2026-10-25T07:00:00Z',finishedAt:'2026-10-25T07:02:00Z',reportDelivered:true}]);assert.equal(r.status,'FAIL');assert.equal(r.rows[1].status,'MISSING');});
test('bootstrap has deterministic seed and zero effects yield p=1',()=>{const d=Array(126).fill(0),a=blockDiagnostic(d);assert.deepEqual(a,blockDiagnostic(d));assert.equal(a.pValue,1);assert.deepEqual(a.confidenceInterval95,[0,0]);});
test('paired moving blocks detect constant mean effect without inventing variance',()=>{const r=blockDiagnostic(Array(126).fill(.001));assert.ok(r.confidenceInterval95[0]>.00099);assert.equal(r.pValue,1/10001);});
test('bootstrap rejects inadequate blocks/nonfinite values',()=>{assert.throws(()=>blockDiagnostic(Array(30).fill(0)),/blocks/);assert.throws(()=>blockDiagnostic([...Array(125).fill(0),NaN]),/finite/);});
test('Holm retains unavailable p=1 hypotheses in the denominator',()=>{const ps=[.001,.01,...Array(14).fill(1)],r=holm(ps);assert.equal(r[0].adjustedP,.016);assert.equal(r[1].adjustedP,.15);assert.equal(r[1].reject,false);});
test('no trades, history and missing arms never produce superiority claims',()=>{const r=comparisonFamily({scope:'HISTORICAL_FEASIBILITY',sessions:days,arms:[]});assert.equal(r.family.length,16);assert.ok(r.family.every(x=>x.pValue===1&&x.status==='INCONCLUSIVE'));assert.equal(r.superiorityClaim,'NOT_EMITTED');});
function modelCase(){return freezeCase({id:'case-1',task:'Reconcile revenue and explain the uncertainty',categories:['banks'],cutoffAt:'2026-10-22T16:00:00Z',frozenAt:'2026-10-23T10:00:00Z',evidence:[{id:'doc',contentHash:h,source:'fixture issuer',passage:'Revenue 100 EGP million',availableAt:'2026-10-22T15:00:00Z'}],truth:{checkedBy:'adjudicator',checkedAt:'2026-10-23T09:00:00Z',numbers:[{id:'revenue',value:100,absoluteTolerance:.01,unit:'EGP million',period:'2026H1',entity:'issuer',evidenceId:'doc'}]}});}
function modelRun(c){const run={caseHash:c.caseHash,packetHash:hash(blindPacket(c)),actorId:'test-output-actor',modelId:'test-recorded-model-id',configurationHash:h,promptHash:h,toolPermissionsHash:h,startedAt:'2026-10-23T11:00:00Z',finishedAt:'2026-10-23T11:01:00Z',toolCalls:2,output:'Revenue was 100 EGP million.',extractedNumbers:structuredClone(c.truth.numbers)};run.outputHash=hash(run.output);const review={actorId:'different-reviewer',caseHash:c.caseHash,runHash:hash(run),at:'2026-10-23T11:05:00Z',rubric:Object.fromEntries(rubricDimensions.map(d=>[d,{score:3,reason:'Contract test only'}])),criticalFabrications:0,criticalUnitPeriodIdentityErrors:0,disagreements:[],missingEvidence:[]};return {run,review};}
test('blind packet excludes truth, other answers and future outcomes',()=>{const c=modelCase(),p=blindPacket(c);assert.equal(p.truth,undefined);assert.equal(p.frozenAt,undefined);assert.equal(p.evidence.length,1);});
test('future evidence rejected before freezing blind case',()=>{const c=modelCase();c.evidence[0].availableAt='2026-10-23T15:00:00Z';assert.throws(()=>freezeCase(c),/cutoff/);});
test('separate bound review scores numerical extraction and fixed rubric',()=>{const c=modelCase(),{run,review}=modelRun(c),s=scoreModelCase(c,run,review);assert.equal(s.accuracy,1);assert.equal(s.status,'FACTUAL_GATE_PASS');assert.equal(modelSuite([c],[s]).status,'NOT_PASSED');});
test('missing extraction is in accuracy denominator',()=>{const c=modelCase(),{run,review}=modelRun(c);run.extractedNumbers=[];review.runHash=hash(run);const s=scoreModelCase(c,run,review);assert.equal(s.accuracy,0);assert.equal(s.numbers[0].status,'MISSING');});
test('critical fabricated fact fails despite correct numerical output',()=>{const c=modelCase(),{run,review}=modelRun(c);review.criticalFabrications=1;assert.equal(scoreModelCase(c,run,review).status,'CASE_FAIL');});
test('self-review, edited output and fictional synthetic runs cannot pass',()=>{const c=modelCase(),{run,review}=modelRun(c);review.actorId=run.actorId;assert.throws(()=>scoreModelCase(c,run,review),/Separate/);review.actorId='other';run.output+=' edit';assert.throws(()=>scoreModelCase(c,run,review),/output/);run.synthetic=true;run.outputHash=hash(run.output);assert.throws(()=>scoreModelCase(c,run,review),/Synthetic/);});
test('case-suite missing actual model work stays blocked',()=>{const s=modelSuite([modelCase()],[]);assert.equal(s.status,'BLOCKED_NO_ACTUAL_RUNS');assert.ok(s.coverageGaps.includes('thinLiquidity'));});
test('repeated case answers are not silently selected for best score',()=>{const c=modelCase(),{run,review}=modelRun(c),s=scoreModelCase(c,run,review);assert.throws(()=>modelSuite([c],[s,s]),/Repeated/);});

test('matrix keeps unavailable arms null and separates engineering from analytical value',()=>{
  const t=registerTrial(trial(),'2026-10-26T09:00:00Z'),m=ledgerMetrics(completed),r=comparisonMatrix(t,[{kind:'ledger',contentHash:h,payload:m}]);assert.equal(r.arms.length,18);assert.equal(r.arms.filter(a=>a.status==='UNAVAILABLE').length,17);assert.ok(r.arms.filter(a=>a.status==='UNAVAILABLE').every(a=>a.netReturnFraction===null));assert.equal(r.claimStates.analyticalValue,'INCONCLUSIVE');
});
test('matrix refuses duplicate-arm selection and different execution releases',()=>{
  const t=registerTrial(trial(),'2026-10-26T09:00:00Z'),r={kind:'ledger',contentHash:h,payload:ledgerMetrics(completed)};assert.throws(()=>comparisonMatrix(t,[r,r]),/Duplicate/);r.payload.releaseHash='wrong';assert.throws(()=>comparisonMatrix(t,[r]),/engine-bound/);
});
test('drawdown dates retain the maximum drawdown peak after a new high',()=>{
  const d=observedDrawdown([{at:'firstPeak',equityCents:120},{at:'trough',equityCents:90},{at:'newPeak',equityCents:140}],100);assert.equal(d.peakAt,'firstPeak');assert.equal(d.troughAt,'trough');assert.equal(d.currentFraction,0);assert.equal(observedDrawdown([],100).fraction,null);
});
test('forecast does not use a price claiming availability before its market date',()=>{const f=forecasts();f.points[5].availableAt=days[0]+'T16:00:00Z';assert.equal(forecastOutcomes(f)[0].status,'CENSORED_MISSING_OR_INCOHERENT_PRICE');});
test('new model case refuses excluded sources while history remains untouched',()=>{const c=modelCase();c.evidence[0].source='https://www.mubasher.info/example';assert.throws(()=>freezeCase(c),/Excluded/);});
test('critical units are checked even if the numerical value matches',()=>{const c=modelCase(),{run,review}=modelRun(c);run.extractedNumbers[0].unit='USD million';review.runHash=hash(run);assert.equal(scoreModelCase(c,run,review).status,'CASE_FAIL');});
test('changing the frozen case after seeing an answer invalidates its hash',()=>{const c=modelCase();c.truth.numbers[0].value=101;assert.throws(()=>blindPacket(c),/hash/);});
test('daily-only backtests cannot enter the minute-validated inference family',()=>{
  const sessions=Array.from({length:126},(_,i)=>new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10));
  const arms=['FULL:base','B1:base'].map(id=>({id,scenario:'base',appropriateClosedObservations:100,basis:'DAILY_PORTFOLIO_NET_RETURN',simulationResolution:'DAILY',returns:sessions.map(day=>({day,value:.001,status:'VERIFIED'}))}));
  const r=comparisonFamily({scope:'REGISTERED_PROSPECTIVE',sessions,arms});assert.ok(r.family.every(f=>f.pValue===1));
});
test('adequate aligned samples return the frozen diagnostic but never auto-promote',()=>{
  const sessions=Array.from({length:126},(_,i)=>new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10));
  const arms=['FULL:base','B1:base'].map(id=>({id,scenario:'base',appropriateClosedObservations:100,basis:'DAILY_PORTFOLIO_NET_RETURN',simulationResolution:'MINUTE',returns:sessions.map(day=>({day,value:id.startsWith('FULL')?.001:0,status:'VERIFIED'}))}));
  const r=comparisonFamily({scope:'REGISTERED_PROSPECTIVE',sessions,arms}),c=r.family.find(x=>x.id==='FULL-vs-B1:base');assert.equal(c.diagnostic.blockLength,20);assert.equal(c.diagnostic.replicates,10000);assert.equal(c.sensitivity.length,2);assert.equal(r.superiorityClaim,'NOT_EMITTED');assert.equal(r.family.filter(x=>x.status==='INCONCLUSIVE').length,15);
});
test('perfect extraction with poor reasoning cannot claim analytical validation',()=>{
  const c=modelCase(),{run,review}=modelRun(c);for(const d of rubricDimensions)review.rubric[d]={score:0,reason:'Unsupported reasoning'};const s=scoreModelCase(c,run,review);assert.equal(s.status,'FACTUAL_GATE_PASS');assert.match(s.analyticalQuality,/REVIEW_REQUIRED/);
});
