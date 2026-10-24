import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {openDb} from './core.mjs';import {initMarket} from './market.mjs';import {initDecisions} from './decisions.mjs';
import {openAnalysis,records,getRecord,saveDocument,appendRecord} from './analysis-store.mjs';
import {saveStatement,reconcileStatement,extractStatementLines,calculateValuation,saveValuation,companyFinancials} from './analysis-financials.mjs';
import {buildMarketContext,rankValues} from './analysis-market.mjs';import {portfolioRisk} from './analysis-risk.mjs';
import {saveCatalyst,saveThesis} from './analysis-events.mjs';import {researchSetups,calibration,purgedWalkForward,registerTrial,registerForecast,evaluateForecast} from './analysis-strategies.mjs';
import {createEvaluationPacket,publicPacket,saveEvaluationOutput,saveEvaluationScore,saveErrorReview} from './analysis-learning.mjs';
import {importAnalysisBundle} from './analysis-service.mjs';import {renderAnalysisOverview,renderDossier} from './public/analysis.js';
import {saveMacro,saveTransmission,macroContext} from './analysis-macro.mjs';
import {ingest} from './core.mjs';import {importCatalog} from './market.mjs';import {saveAnalysisInput,prepareShadowComparison} from './analysis-service.mjs';
import {analysisDossier,analysisOverview,refreshAnalysis,trialComparisons} from './analysis.mjs';
const root=process.cwd(),now=new Date('2026-10-18T18:00:00Z');
const doc=()=>({ticker:'TEST',title:'Synthetic source only',url:'https://issuer.example/synthetic',sourceType:'issuer',publishedAt:'2026-10-01T09:00:00Z',accessedAt:'2026-10-18T17:00:00Z',text:'Synthetic financial statements for isolated unit tests'});
const fact=(value,extra={})=>({value,page:'Synthetic page 1',quote:'Synthetic labelled fact',...extra});
function statement(documentId,extra={}){return {ticker:'TEST',documentId,sectorModel:'industrial',scope:'standalone',assurance:'audited',currency:'EGP',scale:1,periodStart:'2025-01-01',periodEnd:'2025-12-31',verification:'verified',verifiedBy:'Synthetic reviewer',values:{revenue:fact(100),netIncome:fact(20),assets:fact(150),liabilities:fact(50),equity:fact(100),openingEquity:fact(100),debt:fact(20),cash:fact(10),shares:fact(10,{basis:'period-end outstanding'})},...extra};}
function setup(){const db=openAnalysis(':memory:'),id=saveDocument(db,root,doc(),now).id;return {db,id};}
function history(n=100){const dates=[];for(let t=Date.parse('2026-10-14');dates.length<n;t-=86400000){if(![5,6].includes(new Date(t).getUTCDay()))dates.unshift(new Date(t).toISOString().slice(0,10));}return dates.map((day,i)=>({day,time:Date.parse(day+'T07:00Z')/1000,open:100+i,high:102+i,low:99+i,close:101+i,volume:100000,captured_at:'2026-10-15T18:00:00Z'}));}

test('source provenance rejects excluded domains, future publication and unsafe artifacts; immutable identities survive retries',()=>{
 const {db,id}=setup();try{assert.equal(saveDocument(db,root,doc(),now).id,id);assert.equal(records(db,'document',null,now).length,1);assert.throws(()=>saveDocument(db,root,{...doc(),url:'https://www.mubasher.info/news'},now),/excluded/);assert.throws(()=>saveDocument(db,root,{...doc(),publishedAt:'2027-01-01'},now),/timestamps/);assert.throws(()=>saveDocument(db,root,{...doc(),artifactPath:'package.json'},now),/inside/);assert.throws(()=>saveDocument(db,root,{...doc(),id,title:'Changed immutable source'},now),/conflicts/);}finally{db.close();}
});
test('verified statements reconcile scale, owners equity and cash-flow bridges, and reject weighted-average shares',()=>{
 const {db,id}=setup();try{const s=statement(id),saved=saveStatement(db,s,now);assert.equal(companyFinancials(db,'TEST',now).latest.recordId,saved.id);const precision=statement(id,{values:{...s.values,assets:fact(1500005),liabilities:fact(500000),equity:fact(1000000)}});assert.equal(reconcileStatement(precision).checks[0].status,'FAIL');const bad=statement(id);bad.values.assets=fact(500);assert.throws(()=>saveStatement(db,bad,now),/Contradictory/);assert.doesNotThrow(()=>saveStatement(db,{...bad,verification:'extracted'},now));const distressed=statement(id,{values:{...s.values,assets:fact(50),liabilities:fact(70),equity:fact(-20),openingEquity:fact(-30)}});assert.doesNotThrow(()=>saveStatement(db,distressed,now));assert.equal(reconcileStatement(distressed).ratios.periodROE,null);const shares=statement(id);shares.values.shares=fact(10,{basis:'weighted average'});assert.throws(()=>saveStatement(db,shares,now),/period-end/);const nci=statement(id,{scope:'consolidated',values:{...s.values,ownersEquity:fact(80),openingOwnersEquity:fact(80),netIncomeToOwners:fact(12),noncontrollingInterests:fact(20)}});const r=reconcileStatement(nci);assert.equal(r.ratios.bookValuePerShare,8);assert.equal(r.ratios.periodROE,.15);assert.equal(r.ratios.periodGroupROE,.2);const cash={...s,values:{...s.values,openingCash:fact(20),closingCash:fact(30),operatingCashFlow:fact(15),investingCashFlow:fact(-8),financingCashFlow:fact(2),fxCashEffect:fact(1)}};assert.equal(reconcileStatement(cash).checks[1].status,'PASS');}finally{db.close();}
});
test('conservative bilingual extraction preserves negative values and flags multi-column ambiguity without verifying anything',()=>{const e=extractStatementLines('Revenue 1,234\nNet profit (500)\nالإيرادات ١٢٬٣٤٥\nTotal assets 100 200');assert.equal(e.facts[0].value,1234);assert.equal(e.facts[1].value,-500);assert.equal(e.facts[2].value,12345);assert(e.ambiguous.some(x=>x.field==='assets'));assert(e.facts.every(x=>x.status==='unverified extraction'));});
test('sector models reproduce simple analytical identities and keep minority interests distinct',()=>{
 const bank=calculateValuation('bank-residual-income',{name:'base',rationale:'Synthetic stable economics',discountRate:.15,bookEquity:100,shares:10,terminalGrowth:0,terminalROE:.15,years:[{roe:.15,payout:1}]});assert.equal(bank.valuePerShare,10);
 const c={name:'base',rationale:'Synthetic perpetual free cash flow',discountRate:.1,revenue:100,shares:10,netDebt:10,terminalGrowth:0,terminalROIC:.1,minorityInterestValue:5,years:[{growth:0,ebitMargin:.2,taxRate:0,depreciationFraction:0,capexFraction:0,workingCapitalFraction:0}]};assert(Math.abs(calculateValuation('industrial-dcf',c).valuePerShare-18.5)<1e-9);
 const nav=calculateValuation('property-nav',{name:'base',rationale:'Synthetic one-year project',discountRate:.1,shares:10,netDebt:10,cashFlowBasis:'unlevered-after-project-costs',projects:[{name:'Synthetic project',cashFlows:[110]}]});assert(Math.abs(nav.valuePerShare-9)<1e-9);assert.throws(()=>calculateValuation('industrial-dcf',{...c,terminalGrowth:.1}),/terminal/);
});
test('valuation links a verified dated statement, guards sector/currency and consolidated minority adjustment',()=>{
 const {db,id}=setup();try{const s=statement(id),statementId=saveStatement(db,s,now).id;const scenario=name=>({name,nonOperatingAssetsValue:0,operatingBoundary:'Synthetic: no nonoperating investments',rationale:'Synthetic operating assumptions',discountRate:.15,revenue:100,shares:10,netDebt:10,terminalGrowth:0,terminalROIC:.15,years:[{growth:0,ebitMargin:.2,taxRate:0,depreciationFraction:0,capexFraction:0,workingCapitalFraction:0}]});const v={reportingLagAssessment:'Synthetic reporting-date basis; no later balances inferred',ticker:'TEST',statementId,method:'industrial-dcf',currency:'EGP',asOf:now.toISOString(),cases:['bear','base','bull'].map(name=>({...scenario(name),assumptionEvidence:[{documentId:id,justification:'Synthetic no-growth test assumption, not a forecast'}]}))};assert(saveValuation(db,v,now).id);assert.throws(()=>saveValuation(db,{...v,currency:'USD'},now),/EGP/);assert.throws(()=>saveValuation(db,{...v,asOf:'2026-10-17'},now),/point-in-time/);const consolidated=saveStatement(db,{...s,scope:'consolidated',values:{...s.values,noncontrollingInterests:fact(20)}},now).id;assert.throws(()=>saveValuation(db,{...v,statementId:consolidated},now),/minority/);}finally{db.close();}
});
test('all-company market analysis exposes stale/FX coverage and separates momentum, quality, value and liquidity',()=>{
 const stocks=['AA','BB','CC'].map((ticker,i)=>({ticker,name:ticker,currency:i===2?'USD':'EGP',sector:'Synthetic',retrieved_at:'2026-10-15T18:00:00Z',factsCapturedAt:'2026-10-15T18:00:00Z',facts:{price_earnings_ttm:null,return_on_equity:null},bars:history()}));
 const current=buildMarketContext(stocks,new Date('2026-10-15T19:00Z'));assert.equal(current.coverage.catalog,3);assert.equal(current.coverage.alignedEGP,2);assert.equal(current.stocks[0].factors.quality.value,null);assert.equal(current.stocks[0].factors.value.earningsYield,null);assert.equal(rankValues([{ticker:'AA',v:1},{ticker:'BB',v:1}],'v').get('AA'),50);const stale=buildMarketContext(stocks,now);assert.equal(stale.coverage.freshAlignedEGP,0);assert.equal(stale.state,'insufficient fresh coverage');assert(stale.stocks.every(s=>!s.usableForCurrentResearch));
});
test('portfolio historical VaR/CVaR use the entire aligned supplied portfolio and never impute absent holdings',()=>{
 const series={AA:history(),BB:history().map((b,i)=>({...b,close:b.close*(1+(i%5===0?-.03:0))}))},p={cash:1000,positions:[{ticker:'AA',quantity:10,currency:'EGP',sector:'A',stop:150},{ticker:'BB',quantity:5,currency:'EGP',sector:'A',stop:150}],stresses:[{name:'Explicit -10% scenario',returns:{AA:-.1,BB:-.1}}]};
 const r=portfolioRisk(p,series,{maxPositionFraction:.9,maxSectorFraction:.5,maxTotalExposureFraction:.9,minCashFraction:.1,maxPortfolioRiskFraction:.5,maxDailyVolumeParticipation:.01},new Date('2026-10-15T19:00Z'));assert(r.observations>=60);assert(r.historicalCVaR95>=r.historicalVaR95);assert.equal(r.correlations.length,1);assert(r.checks.some(c=>c.name==='Sector A'&&c.status==='FAIL'));assert.equal(r.entryBlocked,true);assert(r.stresses[0].loss>0);const crossed=portfolioRisk({...p,positions:p.positions.map(x=>({...x,stop:999}))},series,{maxPositionFraction:1,maxSectorFraction:1,maxTotalExposureFraction:1,minCashFraction:0,maxPortfolioRiskFraction:1,maxDailyVolumeParticipation:1},new Date('2026-10-15T19:00Z'));assert(crossed.checks.some(c=>c.name.startsWith('Stop not already touched')&&c.status==='FAIL'));assert.equal(crossed.entryBlocked,true);const missing=portfolioRisk(p,{AA:series.AA},{},now);assert.equal(missing.equity,null);assert.equal(missing.historicalVaR95,null);assert.throws(()=>portfolioRisk({...p,positions:[{...p.positions[0],currency:'USD'}]},series),/EGP/);assert.equal(portfolioRisk({cash:20000,positions:[]},{}).historicalVaR95,0);
});
test('events deduplicate canonical evidence, retain unknown expectations and require an economic hypothesis',()=>{
 const {db,id}=setup();try{const e={ticker:'TEST',documentId:id,type:'earnings',title:'Synthetic event',publicAt:'2026-10-01T10:00:00Z',effectiveAt:'2026-10-01T10:00:00Z',driver:'margin',economicMechanism:'Synthetic margin change',counterargument:'Already expected',confirmation:'Next filing',invalidation:'Margin reversal',pricedInEvidence:'Unknown',impactEstimate:null};const first=saveCatalyst(db,e,now);assert.equal(saveCatalyst(db,e,now).id,first.id);assert.equal(records(db,'catalyst','TEST',now).length,1);assert.throws(()=>saveCatalyst(db,{...e,economicMechanism:''},now),/economicMechanism/);assert.throws(()=>saveThesis(db,{ticker:'TEST',family:'catalyst',horizonSessions:20},now),/whyThisStock/);}finally{db.close();}
});
test('price-discovery challenger emits a precommitted exit policy without fabricating a resistance target',()=>{
 const bars=history(),last=bars.at(-1);last.close=last.high+5;last.high=last.close+1;last.volume=1000000;const hypotheses=researchSetups({bars,metadata:{symbolInfo:{minmov:1,pricescale:100}}}),b=hypotheses.find(x=>x.family==='breakout-retest');assert.equal(b.eligibleHypothesis,true);assert.equal(b.geometry.target,null);assert(b.geometry.exitPolicy.includes('never lower'));assert(b.approval.includes('cannot pass'));
});
test('expectancy uses only earlier mature quality-controlled samples and uncertainty stays explicit for small date clusters',()=>{
 const samples=Array.from({length:40},(_,i)=>({strategyId:'x',horizonSessions:20,registeredAt:'2025-01-01',signalAt:new Date(Date.parse('2025-01-02')+i*86400000).toISOString(),maturedAt:'2025-06-01',netReturn:i%2?.02:-.01,quality:[]}));const result=calibration(samples,{strategyId:'x',horizonSessions:20,asOf:'2026-01-01'});assert(result.meanNetReturn>0);assert.equal(result.clusters,40);assert.equal(calibration(samples,{strategyId:'x',horizonSessions:20,asOf:'2025-05-01'}).meanNetReturn,null);assert.equal(calibration(samples.slice(0,5),{strategyId:'x',horizonSessions:20,asOf:'2026-01-01'}).probabilityOfProfit,null);const folds=purgedWalkForward(Array.from({length:200},(_,i)=>i),{trainSessions:100,testSessions:20,horizonSessions:20});assert(folds[0].train.at(-1)+20<folds[0].test[0]);
});
test('shadow forecasts freeze model/rules, require future sessions and never create fills',()=>{
 const db=openAnalysis(':memory:');try{const trialId=registerTrial(db,{name:'Synthetic forward comparison',tickers:['TEST'],capitalEGP:20000,feePerOrderEGP:5,slippageFraction:0,hypothesis:'Synthetic test',informationCutoff:now.toISOString(),universeEvidence:'Synthetic universe'},now).id,trial=getRecord(db,trialId),f={ticker:'TEST',trialId,modelId:'baseline-momentum-1.0',horizonSessions:5,action:'conditional-long',currency:'EGP',informationCutoff:now.toISOString(),evidenceDigest:'fixture',rationale:'Synthetic',entryZone:{low:9,high:11},stop:8,exitMethod:'time'};const id=registerForecast(db,f,now).id,stored=getRecord(db,id);assert.equal(evaluateForecast(stored,history(),trial).netReturn,null);assert.equal(records(db,'forecast',null,now).length,1);assert.equal(db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='fills'").get().n,0);assert.throws(()=>registerForecast(db,{...f,horizonSessions:20,registeredAt:'2020-01-01'},now),/assigned/);}finally{db.close();}
});
test('blinded model packets share the same dossier, score numeric/citation errors and retain reviewer evidence',()=>{
 const db=openAnalysis(':memory:');try{const packet=createEvaluationPacket(db,{name:'Synthetic comparison',modelNames:['Model one','Model two'],task:'Synthetic full-depth task',dossier:{ticker:'TEST',asOf:now.toISOString(),sourceIds:['source']},expectedFacts:[{key:'profit',value:100,sourceId:'source'}]},now),p=getRecord(db,packet.id),publicData=publicPacket(p);assert.equal(publicData.assignments,undefined);assert.equal(publicData.expectedFacts,undefined);const out=saveEvaluationOutput(db,{packetId:p.recordId,alias:p.assignments[0].alias,dossierDigest:p.dossierDigest,analysis:'Synthetic reasoning',extractedFacts:[{key:'profit',value:99,sourceId:'source'}],citedSourceIds:['invented'],durationMs:100},now),o=getRecord(db,out.id);assert.equal(o.objective.correct,0);assert.deepEqual(o.objective.unsupportedCitationIds,['invented']);assert.throws(()=>saveEvaluationScore(db,{outputId:out.id,reviewer:'Synthetic'},now),/rubric/);assert.throws(()=>saveErrorReview(db,{caseId:'missing',ticker:'TEST',category:'thesis'},[],now),/saved case/);}finally{db.close();}
});
test('evidence bundles roll back atomically when a statement is inconsistent',()=>{
 const source=openDb(':memory:'),db=openAnalysis(':memory:');try{initMarket(source);initDecisions(source);source.prepare('INSERT INTO stocks(ticker,name,currency,watched,active) VALUES(?,?,?,?,?)').run('TEST','Synthetic','EGP',0,1);const s=statement('$doc');s.values.assets=fact(1000);assert.throws(()=>importAnalysisBundle(source,db,root,{records:[{kind:'document',alias:'doc',payload:doc()},{kind:'statement',payload:s}]},now),/Contradictory/);assert.equal(records(db,'document',null,now).length,0);}finally{source.close();db.close();}
});

test('interim DCF rejects annualization and overlapping TTM periods, but accepts a contiguous comparable bridge',()=>{
 const {db,id}=setup();try{
  const make=(start,end,revenue)=>saveStatement(db,statement(id,{periodStart:start,periodEnd:end,values:{...statement(id).values,revenue:fact(revenue)}}),now).id;
  const interim=make('2026-01-01','2026-06-30',60),annual=make('2025-01-01','2025-12-31',100),prior=make('2025-01-01','2025-06-30',40),overlap=make('2025-07-01','2026-06-30',100);
  const cases=['bear','base','bull'].map(name=>({name,rationale:'Synthetic TTM assumptions',assumptionEvidence:[{documentId:id,justification:'Synthetic test'}],discountRate:.15,revenue:120,shares:10,netDebt:10,nonOperatingAssetsValue:0,operatingBoundary:'No investments',terminalGrowth:0,terminalROIC:.15,years:[{growth:0,ebitMargin:.2,taxRate:0,depreciationFraction:0,capexFraction:0,workingCapitalFraction:0}]}));
  const v={ticker:'TEST',statementId:interim,method:'industrial-dcf',currency:'EGP',asOf:now.toISOString(),reportingLagAssessment:'Historical interim base, no roll-forward inferred',cases};
  assert.throws(()=>saveValuation(db,v,now),/TTM bridge/);
  assert.throws(()=>saveValuation(db,{...v,ttmBridge:{annualStatementId:overlap,priorComparableInterimId:prior}},now),/TTM bridge periods/);
  assert(saveValuation(db,{...v,ttmBridge:{annualStatementId:annual,priorComparableInterimId:prior}},now).id);
  assert.throws(()=>calculateValuation('bank-residual-income',{name:'bad',rationale:'Synthetic',discountRate:.2,shares:1,bookEquity:100,terminalGrowth:.1,terminalROE:.05,years:[{roe:.1,payout:.5}]}),/terminal/);
 }finally{db.close();}
});

test('property NAV discounts dated cash flows and saved models cannot silently use undated annual slots',()=>{
 const c={name:'base',rationale:'Synthetic two-year timing',shares:10,netDebt:0,discountRate:.1,cashFlowBasis:'unlevered-after-project-costs',valuationDate:'2026-01-01',projects:[{name:'P',cashFlows:[121],dates:['2028-01-01']}]};
 assert(Math.abs(calculateValuation('property-nav',c).valuePerShare-10)<1e-9);
 assert.throws(()=>calculateValuation('property-nav',{...c,projects:[{name:'P',cashFlows:[121],dates:['2025-01-01']}]}),/dates/);
 const {db,id}=setup();try{const statementId=saveStatement(db,statement(id,{sectorModel:'property'}),now).id;
 assert.throws(()=>saveValuation(db,{ticker:'TEST',statementId,method:'property-nav',currency:'EGP',asOf:now.toISOString(),reportingLagAssessment:'Synthetic',cases:['bear','base','bull'].map(name=>({...c,name,assumptionEvidence:[{documentId:id,justification:'Synthetic'}]}))},now),/Saved NAV/);
 }finally{db.close();}
});

test('macro observations require authoritative dates and company-specific transmission never fabricates sensitivity',()=>{
 const {db,id}=setup();try{const macroDoc=saveDocument(db,root,{...doc(),ticker:'MACRO',sourceType:'regulator'},now).id;
 const macroId=saveMacro(db,{documentId:macroDoc,indicator:'policy-rate',periodEnd:'2026-09-30',value:.2,unit:'annual fraction',definition:'Synthetic policy instrument',quote:'Synthetic rate'},now).id;
 saveTransmission(db,{ticker:'TEST',documentId:id,macroId,channel:'Funding costs',economicMechanism:'Only floating debt reprices',counterargument:'Deposits and demand may offset',confirmation:'Next filing',invalidation:'No floating debt',sensitivity:null},now);
 assert.equal(macroContext(db,'TEST',now).companyHypotheses[0].sensitivity,null);
 assert.throws(()=>saveMacro(db,{documentId:id,indicator:'policy-rate'},now),/source document/);
 }finally{db.close();}
});

test('shadow exits use only the precommitted path; later prices cannot alter a completed outcome and gaps are explicit',()=>{
 const f={registeredAt:'2026-10-18T17:00Z',action:'conditional-long',entryZone:{low:9,high:11},stop:8,exitMethod:'time',horizonSessions:5},t={capitalEGP:20000,feePerOrderEGP:5,slippageFraction:0};
 const bars=[{day:'2026-10-19',open:10,high:11,low:7,close:9,volume:10000,captured_at:'2026-10-20T10:00Z'}];
 const first=evaluateForecast(f,bars,t),later=evaluateForecast(f,[...bars,{day:'2026-11-30',open:999,high:1000,low:998,close:999,volume:0,captured_at:'2026-12-01'}],t);
 assert.deepEqual(first,later);assert.equal(first.exit,8);assert.equal(first.holdingSessions,1);assert(first.maxAdverseExcursion<0);assert.equal(first.fees,10);
 const gap=evaluateForecast(f,[{...bars[0],day:'2026-10-21',captured_at:'2026-10-22'}],t);assert(gap.quality.some(q=>q.includes('session gap')));
});

test('integrated dossier, frozen comparison and complete-universe panel preserve the original database and reject changed geometry',()=>{
 const source=openDb(':memory:'),db=openAnalysis(':memory:'),at=new Date('2026-10-15T19:00Z');
 try{initMarket(source);initDecisions(source);importCatalog(source,{stocks:[{name:'TEST',symbol:'EGX:TEST',type:'stock',exchange:'EGX',currency:'EGP',description:'Synthetic company',sector:'Industrial'}],totalCount:1,retrievedAt:at.toISOString()});
 const bars=history();ingest(source,{retrieved_at:'2026-10-15T18:00Z',stocks:[{ticker:'TEST',history:{bars},adjustment:{symbolExt:{symbol:'TEST'},symbolInfo:{currency_code:'EGP',minmov:1,pricescale:100},properties:{dividendsAdjustment:false}}}]});
 const before=source.prepare('SELECT COUNT(*) n FROM agent_decisions').get().n;
 const dossier=analysisDossier(source,db,root,'TEST',at);assert.equal(dossier.stock.usableForCurrentResearch,true);
 const comparison=prepareShadowComparison(source,db,root,{name:'Synthetic prospective comparison',tickers:['TEST'],hypothesis:'Does pullback improve momentum?',universeEvidence:'Synthetic catalog',slippageFraction:.003},at);
 assert.equal(comparison.forecasts.length,5);assert.equal(records(db,'trial',null,at).length,1);assert.equal(source.prepare('SELECT COUNT(*) n FROM agent_decisions').get().n,before);
 const trialId=comparison.trialId;
 assert.throws(()=>saveAnalysisInput(source,db,root,'forecast',{trialId,ticker:'TEST',modelId:'baseline-momentum-1.0',horizonSessions:5,action:'conditional-long',currency:'EGP',rationale:'Changed after seeing data',entryZone:{low:1,high:2},stop:.5,exitMethod:'time'},at),/frozen hypothesis/);
 appendRecord(db,'model-inventory',{id:'baseline-momentum-1.0',description:'Earlier immutable build snapshot'},at);refreshAnalysis(source,db,root,at);assert.equal(records(db,'feature-panel',null,at)[0].universe.length,1);
 const overview=analysisOverview(source,db,root,at);assert.equal(overview.coverage.catalog,1);assert.equal(overview.trials[0].frozenDossiers,undefined);assert.equal(trialComparisons(db,at)[0].commonMaturedCases,0);
 assert(renderDossier(dossier).includes('No sourced sector valuation is available')); // Missing model inputs must remain visible.
 assert(renderAnalysisOverview({...overview,companies:overview.companies.map(c=>({...c,name:'<script>unsafe</script>'}))}).includes('&lt;script&gt;unsafe'));
 assert.throws(()=>saveAnalysisInput(source,db,root,'trial',{name:'Too old',tickers:['TEST'],informationCutoff:'2026-10-14'},at),/last hour/);
 }finally{source.close();db.close();}
});
