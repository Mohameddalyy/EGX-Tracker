import {readFileSync} from 'node:fs';
import {hash,required,finite,nonempty,plan,planHash,variant} from './contract.mjs';
import {evaluateUniverse,admitSeries} from './signals.mjs';
import {buildResearchPacket,validateResearchDisposition} from './research.mjs';
import {validTick,roundTick} from './math.mjs';
import {ms,iso,source,ruleBook,rulesFor,nextSession,settlementDay} from './execution-rules.mjs';
import {cents,egp,productCents,costs,buyCommitment,plannedLoss,forwardLoss,feeCents} from './money.mjs';
import {validateSchema} from './schema.mjs';

export const hardCheckIds=['PAPER_ONLY','IDENTITY_RULES','CRITICAL_EVIDENCE','CHRONOLOGY','SIGNAL_RESEARCH','FUNDED_CASH','WHOLE_SHARES','PARTICIPATION','FROZEN_EXITS','NO_DUPLICATE_POSITION','SETTLEMENT','RELEASE_BINDING'];
export const exceptionIds=['POSITION_RISK','AGGREGATE_RISK','NAME_GROUP','SECTOR_CLUSTER','CASH_RESERVE','POSITION_COUNT','IMPORTANT_GAP','DAILY_DRAWDOWN','EXPERIMENT_DRAWDOWN','ALLOCATION_PRIORITY'];
const calculationCache=new Map();
function cachedEvaluation(input) {
  const key=hash(input);let result=calculationCache.get(key);
  if(!result){result=evaluateUniverse(input);if(calculationCache.size>=2)calculationCache.delete(calculationCache.keys().next().value);calculationCache.set(key,result);}
  // Returning a clone prevents a caller from modifying a later candidate's calculation.
  return structuredClone(result);
}
export function executionReleaseHash(){return hash(['contract.mjs','plan.json','decision-schema.json','schema.mjs','money.mjs','execution-rules.mjs','risk.mjs','execution.mjs','execution-store.mjs','signals.mjs','research.mjs','math.mjs','../evidence-policy.mjs','../analysis-financials.mjs','../contracts/evidence-dictionary.json','../../research/source-policy.json','../../package.json','../../pnpm-lock.yaml'].map(file=>[file,hash(readFileSync(new URL(file,import.meta.url),'utf8').replace(/\r\n/g,'\n'))]));}
export function portfolioSnapshot(state,at) {
  required(state.scope==='ENGINEERING_PAPER_ONLY'&&state.startingCapitalCents===10000000,'Isolated EGP100000 ledger required');
  const held=Object.values(state.positions).filter(p=>p.status!=='CLOSED');
  for(const p of held){source(p.mark,at);required(ms(p.mark.validUntil)>=ms(at)&&finite(p.mark.price)&&p.mark.price>=0,'Unknown/stale portfolio mark blocks allocation');}
  const pending=Object.values(state.orders).filter(o=>!o.resolved);
  const reserved=pending.reduce((s,o)=>s+o.reservationCents,0)+held.reduce((s,p)=>s+p.exitFeeReserveCents,0);
  const unsettled=state.settlements.filter(s=>!s.settled).reduce((s,x)=>s+x.amountCents,0);
  const equity=state.cashCents+unsettled+held.reduce((s,p)=>s+productCents(p.quantity,p.mark.price),0);
  required(state.openingEquityCents>0&&state.highWaterCents>0&&state.valuationDay===at.slice(0,10),'Current session opening valuation required');
  const exposures=[...held.map(p=>({isin:p.isin,sector:p.sector,issuerGroup:p.issuerGroup,quantity:p.quantity,notionalCents:productCents(p.quantity,p.mark.price),forwardRiskCents:forwardLoss(p.quantity,p.mark.price,p.stop,p.ticks,state.scenario),state:'HELD'})),...pending.map(o=>({isin:o.context.isin,sector:o.context.rules.sector,issuerGroup:o.context.rules.issuerGroup,quantity:o.quantity,notionalCents:productCents(o.quantity,o.context.setup.limit),forwardRiskCents:o.calculation.initialRiskCents,state:'PENDING'}))];
  const snapshot={ledgerId:state.id,variantId:state.variantId,scenario:state.scenario,sequence:state.sequence,at,cashCents:state.cashCents,reservedCents:reserved,availableCents:state.cashCents-reserved,unsettledCents:unsettled,equityCents:equity,openingEquityCents:state.openingEquityCents,highWaterCents:Math.max(state.highWaterCents,equity),exposures,forwardRiskCents:exposures.reduce((s,p)=>s+p.forwardRiskCents,0),positionCount:exposures.length,dailyDrawdown:Math.max(0,1-equity/state.openingEquityCents),experimentDrawdown:Math.max(0,1-equity/Math.max(state.highWaterCents,equity))};
  required(snapshot.availableCents>=0&&equity>0,'Reconciled funded cash and positive equity required');return snapshot;
}
export function correlationContext(series,isin,exposures) {
  const names=[...new Set([isin,...exposures.map(p=>p.isin)])],parent=Object.fromEntries(names.map(n=>[n,n])),pairs=[],missing=[];
  const root=n=>parent[n]===n?n:parent[n]=root(parent[n]);
  for(let i=0;i<names.length;i++)for(let j=i+1;j<names.length;j++){
    const a=series?.[names[i]]||[],b=new Map((series?.[names[j]]||[]).map(x=>[x.day,x.value]));
    const aligned=a.filter(x=>finite(x.value)&&finite(b.get(x.day))).map(x=>[x.value,b.get(x.day)]).slice(-60);
    let corr=null;
    if(aligned.length===60){const ma=aligned.reduce((s,x)=>s+x[0],0)/60,mb=aligned.reduce((s,x)=>s+x[1],0)/60;let cov=0,va=0,vb=0;for(const [x,y] of aligned){cov+=(x-ma)*(y-mb);va+=(x-ma)**2;vb+=(y-mb)**2;}if(va>0&&vb>0)corr=cov/Math.sqrt(va*vb);}
    pairs.push({a:names[i],b:names[j],n:aligned.length,correlation:corr});if(corr===null)missing.push(names[i]+':'+names[j]);else if(corr>=.8)parent[root(names[j])]=root(names[i]);
  }
  return {pairs,missing,cluster:names.filter(n=>root(n)===root(isin)),limitation:'60 aligned returns; descriptive correlation, not a tail-loss guarantee. Missing is not zero.'};
}
export function prepareEntry(bundle,state,at) {
  const v=variant(state.variantId);required(!v.cashOnly,'B0 never creates orders');
  ruleBook(bundle.ruleBook,at);
  const evaluation=cachedEvaluation(bundle.signalInput),row=evaluation.rows.find(r=>r.isin===bundle.isin&&r.variantId===state.variantId);
  required(row?.mechanicallyEligible===true,'Frozen mechanical gates failed');
  const session=nextSession(bundle.ruleBook,evaluation.signalDay),rules=rulesFor(bundle.ruleBook,bundle.isin,session.day);
  required(ms(evaluation.cutoffAt)<=ms(at)&&ms(at)<ms(session.openAt)&&at.slice(0,10)===session.day,'Next-session pre-open commitment required');
  required(bundle.entryDays?.length===5&&new Set(bundle.entryDays).size===5&&bundle.entryDays.every((d,i)=>bundle.ruleBook.sessions.some(s=>s.day===d)&&(i===0||d>bundle.entryDays[i-1]))&&bundle.entryDays.includes(session.day),'Frozen five verified entry sessions required');
  required(hash(bundle.entryDays)===state.entryDaysHash,'Entry cohort amendment prohibited');
  required(rules.tradable&&!rules.unresolvedAction&&rules.sector===row.sector,'Tradability, action integrity and sector required');
  source(bundle.preflight,at);required(bundle.preflight.isin===bundle.isin&&bundle.preflight.day===session.day&&bundle.preflight.criticalGaps?.length===0&&bundle.preflight.materialChange===false&&ms(at)-ms(bundle.preflight.availableAt)<=1800000,'Fresh identified preflight and no unresolved critical/material change required');
  required(row.setup&&Object.values({lower:row.setup.lower,limit:row.setup.limit,stop:row.setup.stop}).every(p=>validTick(p,rules.ticks))&&row.setup.limit>row.setup.stop&&row.setup.limit>=rules.lowerBand&&row.setup.limit<=rules.upperBand,'Legal entry zone and positive costed price risk required');
  required(hash(rules.ticks)===hash(bundle.signalInput.universe.find(s=>s.instrument.isin===bundle.isin).rules.bands),'Signal tick rules changed; recompute setup');
  const snapshot=portfolioSnapshot(state,at);required(!snapshot.exposures.some(p=>p.isin===bundle.isin),'No pyramiding/averaging/duplicate pending entry');
  let disposition=null,packet=null;
  if(v.research){
    packet=buildResearchPacket(evaluation,bundle.isin,state.variantId,bundle.researchEvidence);
    const committed=bundle.researchReview?.challenge?.createdAt;required(ms(committed)<ms(session.openAt)&&ms(committed)<=ms(at),'Research must be committed before entry open');
    disposition=validateResearchDisposition(packet,bundle.researchReview,new Date(committed));required(disposition.decision==='Watch','Watch required for research variant');
  }
  const riskNames=new Set([bundle.isin,...snapshot.exposures.map(p=>p.isin)]),series={};for(const stock of bundle.signalInput.universe.filter(s=>riskNames.has(s.instrument.isin))){try{const bars=admitSeries(stock,bundle.signalInput);series[stock.instrument.isin]=bars.slice(1).map((b,i)=>({day:b.day,value:b.close/bars[i].close-1}));}catch{series[stock.instrument.isin]=[];}}
  const correlations=correlationContext(series,bundle.isin,snapshot.exposures);
  const importantGaps=[...new Set([...(disposition?.importantGaps||[]),...(correlations.missing.length?['correlation-history']:[])])];
  const signalStock=bundle.signalInput.universe.find(s=>s.instrument.isin===bundle.isin);
  const signalBar=signalStock.bars.find(b=>b.day===evaluation.signalDay);
  required(rules.actionBasisId===signalStock.adjustment.basisId,'Execution action basis must match admitted history');
  required(Number.isSafeInteger(bundle.delaySeconds)&&bundle.delaySeconds>=0&&bundle.delaySeconds===signalStock.delaySeconds,'Declared feed delay must match admitted source');
  const context={version:'v5-execution-context-1',releaseHash:executionReleaseHash(),policyHash:planHash,isin:bundle.isin,variantId:state.variantId,scenario:state.scenario,at,signalDay:evaluation.signalDay,inputHash:evaluation.inputHash,baselineHash:hash(bundle),snapshot,snapshotHash:hash(snapshot),session,rules,ruleBookHash:hash(bundle.ruleBook),settleDay:settlementDay(bundle.ruleBook,session.day),delaySeconds:bundle.delaySeconds,marketWindowEnd:iso(ms(session.openAt)+1800000),reconciliationDeadline:iso(ms(session.openAt)+1800000+bundle.delaySeconds*1000+360000),setup:row.setup,atr:row.metrics.atr14/signalBar.priceFactor,medianDailyShares:row.turnover.medianRawShares,rank:row.researchRank,importantGaps,correlations,disposition,packetHash:packet?.packetHash||null,researchHash:bundle.researchReview?hash(bundle.researchReview):null,sourceHash:hash(bundle.preflight)};
  context.atr=row.metrics.atr14/signalBar.priceFactor;
  context.actionBasisId=signalStock.adjustment.basisId;
  context.researchActors=bundle.researchReview?[bundle.researchReview.actorId,bundle.researchReview.challenge.actorId]:[];
  context.liquidityReference=null;
  if(bundle.riskInputs?.minuteVolume){const r=bundle.riskInputs.minuteVolume;source(r,at);required(r.isin===bundle.isin&&r.asOfDay<=evaluation.signalDay&&finite(r.value)&&r.value>0&&Number.isSafeInteger(r.sampleCount)&&r.sampleCount>0,'Prior sourced minute-volume reference required');context.liquidityReference=r;}
  context.sharedShocks=[];
  for(const shock of bundle.riskInputs?.sharedShocks||[]){source(shock,at);required(nonempty(shock.id)&&nonempty(shock.assumptions)&&Array.isArray(shock.moves)&&shock.moves.length>0,'Sourced factor scenario required');required(new Set(shock.moves.map(m=>m.isin)).size===shock.moves.length&&shock.moves.every(m=>finite(m.returnFraction)&&m.returnFraction>=-1&&m.returnFraction<=0&&[bundle.isin,...snapshot.exposures.map(p=>p.isin)].includes(m.isin)),'Supported downside sensitivity for identified exposure required');context.sharedShocks.push(shock);}
  context.rank=evaluation.rows.filter(r=>r.variantId===state.variantId&&r.mechanicallyEligible&&!snapshot.exposures.some(p=>p.isin===r.isin)).sort((a,b)=>a.researchRank-b.researchRank).findIndex(r=>r.isin===bundle.isin)+1;
  return {...context,contextHash:hash(context)};
}
function assertContext(c){const {contextHash,...body}=c;required(hash(body)===contextHash&&c.releaseHash===executionReleaseHash()&&c.policyHash===planHash,'Changed context/release');}
const cap=(equity,fraction)=>Math.floor(equity*fraction);
export function sizeEntry(c,proposal={}) {
  assertContext(c);const discretionary=variant(c.variantId).discretionary,s=c.snapshot,eq=s.equityCents;
  const overrides=discretionary?(proposal.exceptionIds||[]):[];
  required(Array.isArray(overrides)&&new Set(overrides).size===overrides.length&&overrides.every(x=>exceptionIds.includes(x)),'Unknown/duplicate override; immutable controls cannot be waived');
  if(!discretionary)required(!(proposal.exceptionIds?.length)&&proposal.maxCashAllocationEGP==null&&proposal.maxPlannedLossEGP==null,'Bounded control cannot accept discretionary budgets or exceptions');
  const budgetLoss=discretionary?proposal.maxPlannedLossEGP:null,budgetCash=discretionary?proposal.maxCashAllocationEGP:null;
  if(discretionary)required([budgetLoss,budgetCash].some(x=>finite(x)&&x>0)&&[budgetLoss,budgetCash].every(x=>x==null||finite(x)&&x>0),'At least one positive monetary budget; never a model quantity');
  required(proposal.quantity===undefined,'Model-edited quantity prohibited');
  const waived=id=>overrides.includes(id),gap=c.importantGaps.length&&!waived('IMPORTANT_GAP') ? .5 : 1;
  const otherGroup=s.exposures.filter(p=>p.issuerGroup===c.rules.issuerGroup).reduce((a,p)=>a+p.notionalCents,0);
  const otherSector=s.exposures.filter(p=>p.sector===c.rules.sector).reduce((a,p)=>a+p.notionalCents,0);
  const otherCluster=s.exposures.filter(p=>c.correlations.cluster.includes(p.isin)).reduce((a,p)=>a+p.notionalCents,0);
  const maxDaily=Math.floor(c.medianDailyShares*.01),fixedExit=cents(costs(c.scenario).fixedEGPPerFilledOrder);
  required(Number.isSafeInteger(maxDaily)&&maxDaily>=0,'Verified daily volume capacity required');
  const reasons=q=>{
    if(q===0)return [];
    const cash=buyCommitment(q,c.setup.limit,c.scenario),risk=plannedLoss(q,c.setup.limit,c.setup.stop,c.rules.ticks,c.scenario),value=productCents(q,c.setup.limit),r=[];
    if(cash>s.availableCents)r.push('FUNDED_CASH');if(q>maxDaily)r.push('DAILY_PARTICIPATION');
    if(budgetLoss!=null&&risk>Math.floor(cents(budgetLoss)*gap))r.push('LOSS_BUDGET');if(budgetCash!=null&&cash>Math.floor(cents(budgetCash)*gap))r.push('CASH_BUDGET');
    if(!waived('POSITION_RISK')&&risk>cap(eq,.01*gap))r.push('POSITION_RISK');
    if(!waived('AGGREGATE_RISK')&&risk+s.forwardRiskCents>cap(eq,.04))r.push('AGGREGATE_RISK');
    if(!waived('NAME_GROUP')&&value+otherGroup>cap(eq,.25))r.push('NAME_GROUP');
    if(!waived('SECTOR_CLUSTER')&&value+Math.max(otherSector,otherCluster)>cap(eq,.4))r.push('SECTOR_CLUSTER');
    if(!waived('CASH_RESERVE')&&s.availableCents-cash<cap(eq,.1))r.push('CASH_RESERVE');
    if(!waived('POSITION_COUNT')&&s.positionCount+1>6)r.push('POSITION_COUNT');
    if(!waived('DAILY_DRAWDOWN')&&s.dailyDrawdown>=.02-1e-12)r.push('DAILY_DRAWDOWN');
    if(!waived('EXPERIMENT_DRAWDOWN')&&s.experimentDrawdown>=.04-1e-12)r.push('EXPERIMENT_DRAWDOWN');
    if(!waived('ALLOCATION_PRIORITY')&&c.rank!==1)r.push('ALLOCATION_PRIORITY');
    return r;
  };
  let lo=0,hi=Math.min(maxDaily,Math.ceil(s.availableCents/(c.setup.limit*100))+1);
  while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(reasons(mid).length)hi=mid-1;else lo=mid;}
  const result={version:'v5-sizing-1',contextHash:c.contextHash,releaseHash:c.releaseHash,proposalHash:hash(proposal),quantity:lo,initialRiskCents:plannedLoss(lo,c.setup.limit,c.setup.stop,c.rules.ticks,c.scenario),reservationCents:buyCommitment(lo,c.setup.limit,c.scenario),exitFeeReserveCents:lo?fixedExit:0,gapMultiplier:gap,bindingConstraints:reasons(lo+1),cashAfterCommitmentsCents:s.availableCents-buyCommitment(lo,c.setup.limit,c.scenario),forwardPortfolioRiskCents:s.forwardRiskCents+plannedLoss(lo,c.setup.limit,c.setup.stop,c.rules.ticks,c.scenario),exceptions:overrides};
  return {...result,calculationHash:hash(result)};
}
export function riskDossier(c,proposal) {
  const chosen=sizeEntry(c,proposal),defaultProposal=variant(c.variantId).discretionary?{maxPlannedLossEGP:egp(cap(c.snapshot.equityCents,.01)),maxCashAllocationEGP:null,exceptionIds:[]}:{};
  const standard=sizeEntry(c,defaultProposal),reduced=Math.floor(chosen.quantity/2),s=c.snapshot;
  const alternatives=[['NO_TRADE',0],['REDUCED',reduced],['ADVISORY_DEFAULT',standard.quantity],['PROPOSED',chosen.quantity]].map(([label,quantity])=>({label,quantity,plannedLossEGP:egp(plannedLoss(quantity,c.setup.limit,c.setup.stop,c.rules.ticks,c.scenario)),cashEGP:egp(buyCommitment(quantity,c.setup.limit,c.scenario)),concentration:productCents(quantity,c.setup.limit)/s.equityCents}));
  const scenarios=q=>{
    const lossAt=price=>egp(Math.max(0,productCents(q,c.setup.limit)-productCents(q,price))+feeCents(q,c.setup.limit,c.scenario)+feeCents(q,price,c.scenario));
    const gap=Math.max(0,Math.min(c.setup.stop-2*c.atr,c.rules.lowerBand));
    const reference=c.rules.referencePrice,bandRatio=finite(reference)&&reference>0?c.rules.lowerBand/reference:null;
    const twoDay=bandRatio!==null&&bandRatio>0&&bandRatio<=1?lossAt(c.setup.limit*bandRatio**2):null;
    const shared=c.sharedShocks.length?Math.max(...c.sharedShocks.map(shock=>shock.moves.reduce((loss,m)=>loss+Math.max(0,-m.returnFraction)*(s.exposures.filter(p=>p.isin===m.isin).reduce((n,p)=>n+p.notionalCents,0)+(m.isin===c.isin?productCents(q,c.setup.limit):0)),0)))/100:null;
    return [
      {id:'STOP_BASE',assumptions:'Modeled adverse stop, base friction; not guaranteed fill',lossEGP:egp(plannedLoss(q,c.setup.limit,c.setup.stop,c.rules.ticks,'base')),status:'CALCULATED'},
      {id:'STOP_STRESS',assumptions:'Modeled adverse stop, stress friction; not guaranteed fill',lossEGP:egp(plannedLoss(q,c.setup.limit,c.setup.stop,c.rules.ticks,'stress')),status:'CALCULATED'},
      {id:'GAP',assumptions:'Worse of stop minus two ATR and current lower band; hypothetical, not legal future band',lossEGP:lossAt(gap),status:'CALCULATED'},
      {id:'TWO_SESSION_DELAY',assumptions:twoDay===null?'Future references/bands unknown; compare principal-loss case.':'Hypothetical two successive moves by current lowerBand/referencePrice ratio; future references assumed, not certified legal prices or fills.',lossEGP:twoDay,status:twoDay===null?'UNQUANTIFIABLE':'CALCULATED'},
      {id:'VOLUME_25',assumptions:'Capacity becomes floor(0.0025 * observed minute volume); all-or-none can deadlock indefinitely. No queue priority.',lossEGP:null,status:'UNQUANTIFIABLE'},
      {id:'SHARED_FACTOR',assumptions:shared===null?'FX, rates, sector and refinancing sensitivities unavailable; historical correlation is not causal. Compare all-principal loss.':'Worst supplied sourced shared-factor shock; specified exposures only, remaining sensitivities unquantifiable. Includes no probability estimate.',lossEGP:shared===null?null:egp(cents(shared)),status:shared===null?'UNQUANTIFIABLE':'CALCULATED'},
      {id:'ISSUER_WORTHLESS',assumptions:'New issuer principal lost plus entry charge and reserved exit fee; no mark mutation',lossEGP:egp(buyCommitment(q,c.setup.limit,c.scenario)),status:'CALCULATED'},
      {id:'ALL_INVESTED_PRINCIPAL',assumptions:'All held/pending issuer principal plus new commitment; funded cash remains cash',lossEGP:egp(s.exposures.reduce((n,p)=>n+p.notionalCents,0)+buyCommitment(q,c.setup.limit,c.scenario)),status:'CALCULATED'},
      {id:'EQUITY_100',assumptions:'100 percent equity loss illustration, no estimated probability or ledger mutation',lossEGP:egp(s.equityCents),status:'CALCULATED'}
    ];
  };
  const capacity=c.liquidityReference?Math.floor(c.liquidityReference.value*.0025):null;
  const liquidation=[['PROPOSED',chosen.quantity],['ADVISORY_DEFAULT',standard.quantity]].map(([label,quantity])=>({label,quantity,capacityAt25PercentVolume:capacity,fullFillPossibleAtReference:capacity===null?null:quantity<=capacity,counterfactualPartialIntervals:capacity>0?Math.ceil(quantity/capacity):null,limitation:'Interval count assumes partial fills, which are prohibited. Full-fill deadlock persists until one eligible minute can absorb the entire quantity.'}));
  const dossier={contextHash:c.contextHash,calculation:chosen,alternatives,proposedScenarios:scenarios(chosen.quantity),defaultScenarios:scenarios(standard.quantity),liquidation,correlations:c.correlations,portfolio:s,importantGaps:c.importantGaps,limitation:'Deterministic scenarios and alternatives are inputs to actual independent risk reasoning, not generated approval.'};
  return {...dossier,dossierHash:hash(dossier)};
}
function completeChecks(checks,c){required(checks?.length===hardCheckIds.length&&new Set(checks.map(x=>x.id)).size===hardCheckIds.length&&hardCheckIds.every(id=>checks.some(x=>x.id===id&&x.passed===true&&x.evidenceId===c.contextHash)),'Complete evidence-bound mandatory check IDs required');}
export function validateRiskCertificate(cert,c,proposal,report,at) {
  validateSchema(cert,'risk');const dossier=riskDossier(c,proposal),calc=dossier.calculation;
  required(cert.actionSide==='BUY'&&['APPROVE','APPROVE_WITH_EXCEPTION'].includes(cert.decision),'Entry risk approval required');
  required(cert.instrumentId===c.isin&&cert.policyHash===planHash&&cert.portfolioSnapshotHash===c.snapshotHash&&cert.evidenceSnapshotHash===c.contextHash&&cert.calculationArtifactHash===calc.calculationHash,'Certificate identity/snapshot/evidence/calculation mismatch');
  required(cert.approvedQuantity===calc.quantity&&cert.equityBasisEGP===egp(c.snapshot.equityCents)&&cert.initialRiskEGP===egp(calc.initialRiskCents)&&cert.forwardPortfolioRiskEGP===egp(calc.forwardPortfolioRiskCents)&&cert.cashAfterCommitmentsEGP===egp(calc.cashAfterCommitmentsCents),'Certificate monetary/quantity arithmetic mismatch');
  required(cert.maxPlannedLossEGP===(proposal.maxPlannedLossEGP??null)&&cert.maxCashAllocationEGP===(proposal.maxCashAllocationEGP??null),'Separate monetary budgets must match');
  required(ms(cert.createdAt)>=ms(c.at)&&ms(cert.createdAt)<=ms(at)&&ms(at)<ms(c.session.openAt)&&ms(cert.validUntil)>ms(c.session.openAt)&&ms(cert.validUntil)<=ms(c.marketWindowEnd),'Stale/late/out-of-window certificate');
  const challenge=cert.independentChallenge;
  required(!c.researchActors.includes(cert.actorId),'Risk allocation must be separate from analyst/final eligibility actors');
  required(nonempty(cert.actorId)&&challenge.actorId!==cert.actorId&&ms(challenge.createdAt)>=ms(cert.createdAt)&&ms(challenge.createdAt)<=ms(at)&&!challenge.unresolvedCriticalDefect&&challenge.objections.length>0,'Independent timely substantive risk challenge required');
  const {independentChallenge,...content}=cert;
  required(report?.dossierHash===dossier.dossierHash&&report.certificateContentHash===hash(content)&&report.challengeHash===hash(challenge)&&report.proposalHash===hash(proposal),'Risk report/challenge must bind exact certificate and dossier');
  for(const key of ['selectionRationale','marginalRisk','alternativeCandidate','fxRateRefinancing','liquidationFeasibility','unknownStressAcceptance','monitoringCapacity','changedEvidence'])required(nonempty(report[key]),'Substantive risk report required: '+key);
  required(Array.isArray(report.evidenceHashes)&&report.evidenceHashes.includes(c.sourceHash)&&report.evidenceHashes.includes(c.snapshotHash),'Risk reasoning must reference preflight and portfolio evidence');
  required(hash(cert.scenarioResults)===hash(dossier.proposedScenarios),'Scenario values/assumptions cannot be model-edited');
  required(cert.alternatives.length===4&&dossier.alternatives.every(a=>cert.alternatives.some(x=>x.label===a.label&&x.quantity===a.quantity&&x.plannedLossEGP===a.plannedLossEGP&&nonempty(x.rationale))),'No-trade/reduced/default/proposed alternatives must match calculations');
  required(new Set(cert.advisoryDeviations.map(x=>x.ruleId)).size===cert.advisoryDeviations.length&&hash([...cert.advisoryDeviations.map(x=>x.ruleId)].sort())===hash([...calc.exceptions].sort()),'Explicit allowlisted deviations must match sizing');
  for(const d of cert.advisoryDeviations)required(ms(d.expiresAt)>=ms(cert.validUntil)&&ms(d.expiresAt)<=ms(c.session.closeAt),'Exception expires by current close, cannot precede certificate');
  required((calc.exceptions.length>0)===(cert.decision==='APPROVE_WITH_EXCEPTION'),'Exception approval label mismatch');completeChecks(cert.hardChecks,c);
  return {dossier,independence:cert.modelId===challenge.modelId?'DIFFERENT_ACTORS_SAME_MODEL':'DIFFERENT_RECORDED_MODELS_NOT_AUTHENTICATED'};
}
export function validateEntryDecision(decision,c,proposal,report,at) {
  validateSchema(decision);assertContext(c);const calc=sizeEntry(c,proposal),v=variant(c.variantId);
  required(decision.action==='BUY'&&decision.positionState==='UNOWNED'&&decision.execution.status==='PROPOSED'&&decision.execution.quantity===calc.quantity&&calc.quantity>0,'Positive proposed unowned BUY required');
  required(decision.policyHash===planHash&&decision.baselineHash===c.baselineHash&&decision.variantId===c.variantId&&decision.instrumentId===c.isin,'Decision identity/policy/baseline mismatch');
  required(ms(decision.createdAt)===ms(at)&&ms(decision.execution.intentCommittedAt)===ms(at)&&ms(at)<ms(c.session.openAt),'Decision commit must be actual pre-open acceptance time');
  required(decision.execution.calculationArtifactHash===calc.calculationHash&&decision.execution.marketWindowEnd===c.marketWindowEnd&&decision.execution.reconciliationDeadline===c.reconciliationDeadline&&decision.execution.planId===plan.version,'Decision execution contract mismatch');
  for(const k of ['fillId','acceptedOrderReceiptHash','reservationReceiptHash','cancelCommittedAt','marketFillAt','fillObservedAt'])required(decision.execution[k]===null,'Uncommitted receipt/fill cannot be asserted');
  required(decision.execution.revalidationReceiptHashes.length===0,'New intent cannot claim revalidation');
  required(decision.controlValidation?.variantId===c.variantId&&decision.controlValidation.calculationArtifactHash===calc.calculationHash,'Bound deterministic control artifact required');completeChecks(decision.controlValidation.checks,c);
  required(!decision.dataQuality.gaps.some(g=>g.criticality==='CRITICAL')&&decision.sourceEvidence.length>0&&decision.sourceEvidence.every(s=>s.availabilityStatus==='VERIFIED'&&/^[a-f0-9]{64}$/.test(s.documentHash)&&ms(s.capturedAt)<=ms(at)&&(s.publishedAt==null||ms(s.publishedAt)<=ms(at))),'Available verified critical evidence required');
  required(decision.sourceEvidence.some(s=>s.documentHash===c.sourceHash)&&ms(decision.dataQuality.observedAt)<=ms(at),'Decision must bind preflight evidence');
  required(c.importantGaps.every(field=>decision.dataQuality.gaps.some(g=>g.field===field&&g.criticality==='IMPORTANT'&&g.attempts.length>0)),'Decision cannot omit material unresolved gaps');
  if(v.research)required(decision.research.decision==='Watch'&&decision.research.reportIds.includes(c.researchHash)&&decision.research.confidence===c.disposition.confidence,'Research disposition mismatch');
  let risk=null;
  if(v.discretionary){required(decision.riskCertificate?.orderIntentId===decision.execution.orderIntentId,'Certificate must bind order intent');risk=validateRiskCertificate(decision.riskCertificate,c,proposal,report,at);}
  else required(decision.riskCertificate===null,'Mechanical/bounded controls must not invent Risk Agent approvals');
  return {calculation:calc,risk};
}

export function riskExitDossier(state,positionId,changedEvidence,at) {
  const p=state.positions[positionId];required(p&&p.status!=='CLOSED'&&variant(state.variantId).discretionary,'Discretionary full held exit only');
  source(changedEvidence,at);required(changedEvidence.isin===p.isin&&nonempty(changedEvidence.reason),'Identified changed risk evidence required');
  const snapshot=portfolioSnapshot(state,at),snapshotHash=hash(snapshot),positionHash=hash(p),releaseHash=executionReleaseHash();
  const evidenceHash=hash({snapshotHash,positionHash,changedEvidence,releaseHash});
  const calculation={snapshotHash,positionHash,evidenceHash,releaseHash,quantity:p.quantity,action:'SELL',initialRiskCents:p.initialRiskCents,forwardPortfolioRiskCents:snapshot.forwardRiskCents,cashAfterCommitmentsCents:snapshot.availableCents};
  const scenarios=[
    {id:'STOP_BASE',assumptions:'Current forward stop risk, base friction, not guaranteed',lossEGP:egp(forwardLoss(p.quantity,p.mark.price,p.stop,p.ticks,'base')),status:'CALCULATED'},
    {id:'STOP_STRESS',assumptions:'Current forward stop risk, stress friction, not guaranteed',lossEGP:egp(forwardLoss(p.quantity,p.mark.price,p.stop,p.ticks,'stress')),status:'CALCULATED'},
    ...['GAP','TWO_SESSION_DELAY','VOLUME_25','SHARED_FACTOR'].map(id=>({id,assumptions:'Unquantifiable economics/capacity; full-principal scenario remains visible; mandatory exit is never delayed',lossEGP:null,status:'UNQUANTIFIABLE'})),
    {id:'ISSUER_WORTHLESS',assumptions:'Held marked principal lost, hypothetical only',lossEGP:egp(productCents(p.quantity,p.mark.price)),status:'CALCULATED'},
    {id:'ALL_INVESTED_PRINCIPAL',assumptions:'Held and pending marked principal, funded cash remains cash',lossEGP:egp(snapshot.exposures.reduce((n,x)=>n+x.notionalCents,0)),status:'CALCULATED'},
    {id:'EQUITY_100',assumptions:'Survivability illustration, not a probability',lossEGP:egp(snapshot.equityCents),status:'CALCULATED'}
  ];
  return {calculation,calculationHash:hash(calculation),snapshot,evidenceHash,scenarios};
}
export function validateRiskExit(decision,state,positionId,report,changedEvidence,at) {
  validateSchema(decision);const p=state.positions[positionId],dossier=riskExitDossier(state,positionId,changedEvidence,at),c=decision.riskCertificate,s=dossier.snapshot;
  required(decision.action==='SELL'&&decision.reasonCodes.includes('RISK_EXIT')&&decision.variantId===state.variantId&&decision.instrumentId===p.isin&&decision.policyHash===planHash&&decision.execution.quantity===p.quantity&&decision.execution.calculationArtifactHash===dossier.calculationHash&&ms(decision.createdAt)===ms(at)&&ms(decision.execution.intentCommittedAt)===ms(at),'Bound full held SELL required');
  required(decision.execution.status==='EXIT_PENDING'&&['fillId','marketFillAt','fillObservedAt','acceptedOrderReceiptHash','reservationReceiptHash','cancelCommittedAt'].every(k=>decision.execution[k]===null)&&decision.execution.revalidationReceiptHashes.length===0,'New risk exit cannot claim entry receipts or a fill');
  required(c.decision==='REDUCE_BY_EXIT'&&c.instrumentId===p.isin&&c.policyHash===planHash&&c.orderIntentId===decision.execution.orderIntentId&&c.approvedQuantity===p.quantity&&c.portfolioSnapshotHash===hash(s)&&c.evidenceSnapshotHash===dossier.evidenceHash&&c.calculationArtifactHash===dossier.calculationHash,'Risk exit certificate identity/arithmetic binding');
  required(c.equityBasisEGP===egp(s.equityCents)&&c.initialRiskEGP===egp(p.initialRiskCents)&&c.forwardPortfolioRiskEGP===egp(s.forwardRiskCents)&&c.cashAfterCommitmentsEGP===egp(s.availableCents)&&c.maxCashAllocationEGP===null&&c.maxPlannedLossEGP===null,'Risk exit monetary fields mismatch');
  required(c.advisoryDeviations.length===0&&ms(c.createdAt)<=ms(at)&&ms(at)-ms(c.createdAt)<=1800000&&ms(c.validUntil)>ms(at)&&ms(c.validUntil)-ms(at)<=1800000,'Exit approval expired or claims entry exceptions');
  const challenge=c.independentChallenge,{independentChallenge,...content}=c;
  required(challenge.actorId!==c.actorId&&ms(challenge.createdAt)>=ms(c.createdAt)&&ms(challenge.createdAt)<=ms(at)&&!challenge.unresolvedCriticalDefect&&challenge.objections.length>0,'Independent substantive exit challenge required');
  required(report?.certificateContentHash===hash(content)&&report.challengeHash===hash(challenge)&&report.releaseHash===state.releaseHash,'Changed exit report/challenge');
  for(const key of ['changedRisk','holdAlternative','exitAlternative','unknownStressAcceptance'])required(nonempty(report[key]),'Risk exit comparison required: '+key);
  required(c.alternatives.length===2&&['CONTINUE_HELD','FULL_EXIT'].every(label=>c.alternatives.some(a=>a.label===label&&a.quantity===p.quantity&&a.plannedLossEGP===egp(s.forwardRiskCents)))&&hash(c.scenarioResults)===hash(dossier.scenarios),'Risk exit alternative/scenario mismatch; existing risk remains until a fill');
  completeChecks(c.hardChecks,{contextHash:dossier.evidenceHash});completeChecks(decision.controlValidation?.checks,{contextHash:dossier.evidenceHash});
  required(decision.controlValidation.variantId===state.variantId&&decision.controlValidation.calculationArtifactHash===dossier.calculationHash,'Bound exit control validation required');
  return dossier;
}
