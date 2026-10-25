// Synthetic engineering inputs only: these are not exchange rules or actual agent reports.
import {signalFixture,researchEvidence,reviewFixture} from './fixtures.mjs';
import {evaluateUniverse} from './signals.mjs';
import {buildResearchPacket} from './research.mjs';
import {hash,plan,planHash,variant} from './contract.mjs';
import {prepareEntry,riskDossier,hardCheckIds,riskExitDossier} from './risk.mjs';
import {metrics} from './math.mjs';
import {admitSeries} from './signals.mjs';
import {egp} from './money.mjs';

export const fixtureSource={verified:true,sourceId:'SYNTHETIC',sourceHash:'b'.repeat(64),availableAt:'2026-10-22T14:15:00Z'};
export const prepareAt='2026-10-25T06:50:00.000Z',acceptAt='2026-10-25T06:51:00.000Z';
export function executionFixture(variantId='B1',scenario='base') {
  const signalInput=signalFixture(),evidence=researchEvidence(signalInput),evaluation=evaluateUniverse(signalInput),isin=signalInput.universe[0].instrument.isin;
  const days=[];for(let d=new Date('2026-10-22T00:00:00Z');days.length<30;d=new Date(+d+86400000))if(![5,6].includes(d.getUTCDay()))days.push(d.toISOString().slice(0,10));
  const sessions=days.map(day=>({...fixtureSource,day,openAt:day+'T07:00:00Z',closeAt:day+'T11:30:00Z'}));
  const instruments=days.flatMap(day=>signalInput.universe.map((s,i)=>({...fixtureSource,isin:s.instrument.isin,sector:'Industrials',issuerGroup:'GROUP'+i,currency:'EGP',kind:'PRIMARY_ORDINARY_COMMON',tradable:true,unresolvedAction:false,actionBasisId:'fixture-adjustment',day,lowerBand:50,upperBand:100,ticks:[{from:0,to:null,tick:.01}]})));
  const book={...fixtureSource,sessions,settlementDays:days,instruments},entryDays=days.slice(1,6),config={scope:'ENGINEERING_PAPER_ONLY',id:'SYNTHETIC-'+variantId+'-'+scenario,variantId,scenario,entryDays};
  const packet=buildResearchPacket(evaluation,isin,variantId,evidence),review=variant(variantId).research?reviewFixture(packet):undefined;
  const bundle={signalInput,isin,ruleBook:book,entryDays,delaySeconds:900,preflight:{...fixtureSource,availableAt:prepareAt,isin,day:entryDays[0],criticalGaps:[],materialChange:false},...(review?{researchEvidence:evidence,researchReview:review}:{})};
  return {config,bundle,book,isin,days};
}
export function acceptance(fixture,state,proposal={},id='synthetic-order',preparedAt=prepareAt,at=acceptAt) {
  const c=prepareEntry(fixture.bundle,state,preparedAt),dossier=riskDossier(c,proposal),calc=dossier.calculation,checks=hardCheckIds.map(id=>({id,passed:true,evidenceId:c.contextHash}));
  let certificate=null,riskReport=null;
  if(variant(c.variantId).discretionary){
    certificate={id:'risk-'+id,scope:'PAPER_ONLY',policyHash:planHash,portfolioSnapshotHash:c.snapshotHash,evidenceSnapshotHash:c.contextHash,instrumentId:c.isin,orderIntentId:id,createdAt:preparedAt,validUntil:c.marketWindowEnd,decision:calc.exceptions.length?'APPROVE_WITH_EXCEPTION':'APPROVE',equityBasisEGP:egp(c.snapshot.equityCents),approvedQuantity:calc.quantity,calculationArtifactHash:calc.calculationHash,cashAfterCommitmentsEGP:egp(calc.cashAfterCommitmentsCents),initialRiskEGP:egp(calc.initialRiskCents),forwardPortfolioRiskEGP:egp(calc.forwardPortfolioRiskCents),alternatives:dossier.alternatives.map(({label,quantity,plannedLossEGP})=>({label,quantity,plannedLossEGP,rationale:'Synthetic alternative; not an actual allocation opinion'})),lossMechanisms:['Synthetic gap and suspension risk'],scenarioResults:dossier.proposedScenarios,advisoryDeviations:calc.exceptions.map(ruleId=>({ruleId,defaultOutcome:'Synthetic default in bound dossier',proposedOutcome:'Synthetic exception stress case',support:'Synthetic source-bound fixture',contraryEvidence:'Full principal can be lost',compensatingConditions:'No change to funded cash or execution rules',expiresAt:c.session.closeAt})),rationale:'Synthetic contract positive case, no real approval',countercase:'Concentrated loss can consume funded capital',hardChecks:checks,revocationTriggers:['Material change','Critical gap','Drawdown review'],actionSide:'BUY',maxPlannedLossEGP:proposal.maxPlannedLossEGP??null,maxCashAllocationEGP:proposal.maxCashAllocationEGP??null,actorId:'SYNTHETIC_RISK',modelId:'SYNTHETIC_NOT_A_MODEL'};
    const contentHash=hash(certificate);certificate.independentChallenge={reviewId:'synthetic-challenge',actorId:'SYNTHETIC_CHALLENGER',modelId:'SYNTHETIC_NOT_A_MODEL',createdAt:at,objections:['Near-total loss possible'],response:'Fixture preserves this risk; no actual judgment',unresolvedCriticalDefect:false,remainingDissent:['Synthetic disagreement retained']};
    riskReport={dossierHash:dossier.dossierHash,certificateContentHash:contentHash,challengeHash:hash(certificate.independentChallenge),proposalHash:hash(proposal),evidenceHashes:[c.sourceHash,c.snapshotHash],...Object.fromEntries(['selectionRationale','marginalRisk','alternativeCandidate','fxRateRefinancing','liquidationFeasibility','unknownStressAcceptance','monitoringCapacity','changedEvidence'].map(k=>[k,'Synthetic '+k+' for engineering only']))};
  }
  const decision={schemaVersion:'decision-v5-1.0',scope:'PAPER_ONLY',runId:'SYNTHETIC',createdAt:at,policyHash:planHash,baselineHash:c.baselineHash,instrumentId:c.isin,positionState:'UNOWNED',action:'BUY',reasonCodes:['SYNTHETIC_TEST'],summary:'Synthetic decision contract, not a live recommendation',dataQuality:{status:c.importantGaps.length?'DEGRADED':'VERIFIED',gaps:c.importantGaps.map(field=>({field,criticality:'IMPORTANT',attempts:[{source:'Synthetic',at:preparedAt,result:'Unresolved noncritical gap'}],selectedFallback:null,consequence:'Uncertainty retained with one aggregate haircut unless explicitly overridden',beforeAfter:'No hidden replacement',nextAttempt:'Next sourced review'})),coverageWindow:'Synthetic confirmed 261 sessions and current preflight',observedAt:preparedAt},sourceEvidence:[{id:'preflight',origin:'synthetic',documentHash:c.sourceHash,capturedAt:preparedAt,availabilityStatus:'VERIFIED'}],research:{decision:c.disposition?'Watch':'UNREVIEWED',reportIds:c.researchHash?[c.researchHash]:[],thesis:'Synthetic or mechanical control',countercase:'No demonstrated edge',confidence:c.disposition?.confidence||'UNCERTAIN',forecast:{status:'EXPLICIT_UNCERTAINTY',horizonsSessions:[5,20,60],measurement:'Prospective observations only'}},execution:{status:'PROPOSED',planId:plan.version,orderIntentId:id,quantity:calc.quantity,calculationArtifactHash:calc.calculationHash,intentCommittedAt:at,fillId:null,limitations:['Synthetic delayed-minute full-fill simulation, no queue guarantee'],acceptedOrderReceiptHash:null,reservationReceiptHash:null,revalidationReceiptHashes:[],marketWindowEnd:c.marketWindowEnd,reconciliationDeadline:c.reconciliationDeadline,cancelCommittedAt:null,marketFillAt:null,fillObservedAt:null},riskCertificate:certificate,nextReview:{trigger:'Next eligible minute or material event',owner:'Engineering simulator',dueAt:c.marketWindowEnd},variantId:c.variantId,controlValidation:{id:'control-'+id,checks,calculationArtifactHash:calc.calculationHash,variantId:c.variantId}};
  return {preparedAt,bundle:fixture.bundle,proposal,decision,riskReport};
}
export function minuteFixture(isin,day='2026-10-25',time='07:01:00',overrides={}) {
  const start=Date.parse(day+'T'+time+'Z'),end=start+60000,received=end+900000;
  return {...fixtureSource,isin,basis:'RAW',confirmed:true,startAt:new Date(start).toISOString(),endAt:new Date(end).toISOString(),receivedAt:new Date(received).toISOString(),availableAt:new Date(received).toISOString(),halted:false,auction:false,limitLocked:false,open:70,high:71,low:69,close:70,volume:1000000,...overrides};
}
export const fullProposal={maxCashAllocationEGP:100000,maxPlannedLossEGP:null,exceptionIds:['POSITION_RISK','AGGREGATE_RISK','NAME_GROUP','SECTOR_CLUSTER','CASH_RESERVE','POSITION_COUNT','IMPORTANT_GAP']};

export function dailyFixture(f,day,close=74) {
  const input=structuredClone(f.bundle.signalInput),stock=input.universe.find(s=>s.instrument.isin===f.isin),future=f.book.sessions.filter(s=>s.day>input.signalDay&&s.day<=day);
  for(const session of future){input.sessions.push({day:session.day,closeAt:session.closeAt,verified:true,sourceId:'issuer'});const previous=structuredClone(stock.bars.at(-1)),prices={open:close,high:close+.2,low:close-.2,close};stock.bars.push({...previous,day:session.day,...prices,raw:{...prices,volume:1000000},volume:1000000,capturedAt:session.day+'T12:15:00Z'});}
  input.signalDay=day;input.cutoffAt=day+'T12:20:00Z';stock.adjustment.reviewedThrough=day;
  const m=metrics(admitSeries(stock,input));
  const daily={...fixtureSource,availableAt:input.cutoffAt,isin:f.isin,day,delaySeconds:900,confirmed:true,basis:'RAW_CURRENT_PRICE_UNITS',close,atr14:m.atr14,sma20:m.sma20,method:'V5_FIXED_WINDOW',calculationHash:hash({inputHash:hash(input),isin:f.isin,metrics:m})};
  return {book:f.book,daily,signalInput:input};
}
export function riskExitFixture(state,positionId,at) {
  const p=state.positions[positionId],changedEvidence={...fixtureSource,availableAt:at,isin:p.isin,reason:'Synthetic changed refinancing risk'},d=riskExitDossier(state,positionId,changedEvidence,at),calc=d.calculation;
  const decision=structuredClone(state.orders[positionId].decision),certificate=decision.riskCertificate;
  Object.assign(certificate,{id:'synthetic-risk-exit',orderIntentId:'synthetic-exit',decision:'REDUCE_BY_EXIT',actionSide:'SELL',createdAt:at,validUntil:new Date(Date.parse(at)+600000).toISOString(),portfolioSnapshotHash:hash(d.snapshot),evidenceSnapshotHash:d.evidenceHash,calculationArtifactHash:d.calculationHash,approvedQuantity:p.quantity,equityBasisEGP:egp(d.snapshot.equityCents),cashAfterCommitmentsEGP:egp(calc.cashAfterCommitmentsCents),initialRiskEGP:egp(p.initialRiskCents),forwardPortfolioRiskEGP:egp(d.snapshot.forwardRiskCents),maxCashAllocationEGP:null,maxPlannedLossEGP:null,advisoryDeviations:[],scenarioResults:d.scenarios,alternatives:['CONTINUE_HELD','FULL_EXIT'].map(label=>({label,quantity:p.quantity,plannedLossEGP:egp(d.snapshot.forwardRiskCents),rationale:'Synthetic comparison, no actual recommendation'})),hardChecks:hardCheckIds.map(id=>({id,passed:true,evidenceId:d.evidenceHash}))});
  certificate.independentChallenge.createdAt=at;
  Object.assign(decision,{createdAt:at,positionState:'HELD',action:'SELL',reasonCodes:['RISK_EXIT']});
  Object.assign(decision.execution,{status:'EXIT_PENDING',orderIntentId:'synthetic-exit',quantity:p.quantity,intentCommittedAt:at,calculationArtifactHash:d.calculationHash,fillId:null,marketFillAt:null,fillObservedAt:null});
  Object.assign(decision.execution,{acceptedOrderReceiptHash:null,reservationReceiptHash:null,cancelCommittedAt:null,revalidationReceiptHashes:[]});
  decision.controlValidation={id:'exit-control',variantId:state.variantId,calculationArtifactHash:d.calculationHash,checks:certificate.hardChecks};
  const {independentChallenge,...content}=certificate;
  return {positionId,decision,changedEvidence,report:{certificateContentHash:hash(content),challengeHash:hash(independentChallenge),releaseHash:state.releaseHash,changedRisk:'Synthetic source-backed deterioration',holdAlternative:'Hold retains mandatory exits',exitAlternative:'Full exit awaits eligible minute and settlement',unknownStressAcceptance:'Full principal scenario retained'}};
}
