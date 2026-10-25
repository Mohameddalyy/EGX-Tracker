import {hash,required,nonempty,finite,variant,planHash,plan} from './contract.mjs';
import {roundTick,validTick,metrics} from './math.mjs';
import {admitSeries} from './signals.mjs';
import {ms,iso,source,ruleBook,rulesFor,settlementDay,minuteValidity} from './execution-rules.mjs';
import {cents,egp,productCents,costs,feeCents,buyCommitment,plannedLoss} from './money.mjs';
import {prepareEntry,sizeEntry,validateEntryDecision,portfolioSnapshot,executionReleaseHash,validateRiskExit} from './risk.mjs';
import {validateSchema} from './schema.mjs';

export function initialState(config) {
  required(config.scope==='ENGINEERING_PAPER_ONLY'&&nonempty(config.id),'Only isolated engineering ledgers supported; no activation path');
  variant(config.variantId);costs(config.scenario);
  required(config.entryDays?.length===5&&new Set(config.entryDays).size===5&&config.entryDays.every((d,i)=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&(i===0||d>config.entryDays[i-1])),'Five ordered explicit entry dates required');
  return {version:'v5-execution-state-1',scope:config.scope,id:config.id,variantId:config.variantId,scenario:config.scenario,releaseHash:executionReleaseHash(),policyHash:planHash,entryDaysHash:hash(config.entryDays),startingCapitalCents:10000000,cashCents:10000000,openingEquityCents:10000000,highWaterCents:10000000,valuationDay:null,orders:{},positions:{},settlements:[],feesCents:0,realizedCents:0,sequence:0,lastAt:null,paused:true,incidents:[],diagnostics:[],receipts:[],consumedMinutes:{},dailyParticipation:{}};
}
function unresolved(state){return Object.values(state.orders).filter(o=>!o.resolved);}
function positions(state){return Object.values(state.positions).filter(p=>p.status!=='CLOSED');}
function cancel(order,at,reason) {
  if(order.resolved)return;
  if(!order.cancelAt){order.cancelAt=at;order.timeline.push({at,quantity:0,reason});}
  order.decision.execution.cancelCommittedAt=order.cancelAt;
  order.status='UNFILLED';order.decision.execution.status='UNFILLED';order.pendingReason=reason;
  // Do not release until delayed historical authorized events have been reconciled.
}
function exitIntent(position,at,reason,notBefore=null) {
  if(position.status==='CLOSED')return;
  if(!position.exit){position.exit={committedAt:at,reason,notBefore,status:'EXIT_PENDING',attempts:[]};position.status='EXIT_PENDING';}
  else position.exit.additionalReasons=[...new Set([...(position.exit.additionalReasons||[]),reason])];
}
function expire(state,at) {
  for(const o of unresolved(state)) {
    if(ms(at)>ms(o.context.reconciliationDeadline)) {
      o.resolved=true;o.reservationCents=0;o.status='NO_FILL_EVIDENCE';o.decision.execution.status=o.status;o.censored=true;
      state.incidents.push({at,code:'ENTRY_COVERAGE_INCOMPLETE',orderId:o.id,reason:'Reconciliation deadline passed; later bars diagnostic only'});
    } else if(ms(at)>=ms(o.context.marketWindowEnd)) {o.status='EXPIRED_PENDING_RECONCILIATION';o.decision.execution.status=o.status;}
  }
}
function fillEntry(state,o,bar,book,at) {
  const c=o.context,valid=minuteValidity(bar,book,c.isin,at,c.delaySeconds,{entry:true}),start=valid.start;
  required(valid.rules.actionBasisId===c.actionBasisId&&hash(valid.rules.ticks)===hash(c.rules.ticks),'Action/tick change requires fresh entry approval');
  if(start<=ms(o.acceptedAt)||start<ms(c.session.openAt)||start>=ms(c.marketWindowEnd)||start>=ms(o.certificateExpiry))return 'OUTSIDE_AUTHORIZED_WINDOW';
  const applicable=o.timeline.filter(t=>ms(t.at)<=start).at(-1),q=applicable?.quantity||0;
  if(!q)return 'CANCELLED_AT_MARKET_EVENT';
  const price=roundTick(bar.open*(1+costs(state.scenario).adverseSlippageFractionPerSide),valid.rules.ticks,'ceil');
  if(price<c.setup.lower||price>c.setup.limit||price<=c.setup.stop||price<bar.low||price>bar.high||price<valid.rules.lowerBand||price>valid.rules.upperBand)return 'PRICE_RANGE_ZONE';
  if(q>Math.floor(bar.volume*.01)||q>Math.floor(c.medianDailyShares*.01))return 'FULL_QUANTITY_CAPACITY';
  const dailyKey=c.isin+':'+valid.session.day,used=state.dailyParticipation[dailyKey]||0;
  if(q+used>Math.floor(c.medianDailyShares*.01))return 'DAILY_PARTICIPATION';
  const spend=productCents(q,price)+feeCents(q,price,state.scenario),commit=spend+cents(costs(state.scenario).fixedEGPPerFilledOrder);
  required(commit<=o.reservationCents,'Reserved cash cannot fund historic quantity');
  state.cashCents-=spend;state.feesCents+=feeCents(q,price,state.scenario);state.dailyParticipation[dailyKey]=used+q;
  const fillId=hash({order:o.id,start:bar.startAt,price,q,at});
  o.resolved=true;o.reservationCents=0;o.quantity=q;o.status='FILLED';o.fill={id:fillId,quantity:q,price,marketAt:bar.startAt,observedAt:at,sourceHash:bar.sourceHash};
  Object.assign(o.decision.execution,{status:'FILLED',quantity:q,fillId,marketFillAt:bar.startAt,fillObservedAt:at});
  const p={id:o.id,isin:c.isin,sector:c.rules.sector,issuerGroup:c.rules.issuerGroup,quantity:q,entry:price,entryDay:valid.session.day,entryMarketAt:bar.startAt,entryObservedAt:at,initialStop:c.setup.stop,stop:c.setup.stop,initialRiskCents:plannedLoss(q,price,c.setup.stop,c.rules.ticks,state.scenario),entryCostCents:spend,exitFeeReserveCents:cents(costs(state.scenario).fixedEGPPerFilledOrder),sellableDay:settlementDay(book,valid.session.day),ticks:c.rules.ticks,delaySeconds:c.delaySeconds,highestClose:price,trailing:false,pendingStop:null,status:'HELD',exit:null,mark:{verified:true,sourceId:bar.sourceId,sourceHash:bar.sourceHash,availableAt:bar.receivedAt,price:bar.close,validUntil:valid.session.closeAt},dailyFinalizations:[],lastDailyDay:null};
  state.positions[p.id]=p;
  p.actionBasisId=c.actionBasisId;
  if(bar.low<=p.stop)exitIntent(p,at,'STOP_BREACH');
  return 'FILLED';
}
function fillExit(state,p,bar,book,at,dailyVolume) {
  const valid=minuteValidity(bar,book,p.isin,at,p.delaySeconds),start=valid.start;
  if(start<=ms(p.exit.committedAt)||p.exit.notBefore&&start<ms(p.exit.notBefore))return 'EXIT_BAR_PRECEDES_INTENT';
  if(valid.session.day<p.sellableDay)return 'UNSETTLED_SHARES';
  source(dailyVolume,at);required(dailyVolume.isin===p.isin&&dailyVolume.forDay===valid.session.day&&dailyVolume.basis==='PRIOR_MEDIAN20_RAW_SHARES'&&finite(dailyVolume.value)&&dailyVolume.value>0&&ms(dailyVolume.availableAt)<ms(valid.session.openAt),'Verified prior daily capacity required');
  if(p.quantity>Math.floor(bar.volume*.01))return 'FULL_QUANTITY_MINUTE_CAPACITY';
  const key=p.isin+':'+valid.session.day,used=state.dailyParticipation[key]||0;
  if(p.quantity+used>Math.floor(dailyVolume.value*.01))return 'FULL_QUANTITY_DAILY_CAPACITY';
  const price=roundTick(bar.open*(1-costs(state.scenario).adverseSlippageFractionPerSide),valid.rules.ticks,'floor');
  if(price<bar.low||price>bar.high||price<valid.rules.lowerBand||price>valid.rules.upperBand)return 'EXIT_PRICE_RANGE';
  const fixed=cents(costs(state.scenario).fixedEGPPerFilledOrder),fee=feeCents(p.quantity,price,state.scenario),netBeforeFixed=productCents(p.quantity,price)-(fee-fixed);
  required(p.exitFeeReserveCents===fixed&&state.cashCents>=fixed,'Exit fixed fee must remain funded');
  const settle=settlementDay(book,valid.session.day);
  state.cashCents-=fixed;state.feesCents+=fee;state.realizedCents+=netBeforeFixed-fixed-p.entryCostCents;state.dailyParticipation[key]=used+p.quantity;
  state.settlements.push({id:hash({position:p.id,at,price}),amountCents:netBeforeFixed,dueDay:settle,settled:false,marketAt:bar.startAt,observedAt:at});
  p.status='CLOSED';p.exitFeeReserveCents=0;p.exit.status='FILLED';p.exit.fill={price,quantity:p.quantity,marketAt:bar.startAt,observedAt:at,sourceHash:bar.sourceHash,settleDay:settle};
  return 'EXIT_FILLED';
}
function minute(state,data,at) {
  const {bar,book}=data;ruleBook(book,at);
  // A second event ID cannot spend the same source minute again.
  const key=bar.isin+':'+bar.startAt;
  if(state.consumedMinutes[key]){required(state.consumedMinutes[key]===hash(bar),'Conflicting replacement minute requires explicit reconciliation');return {status:'DUPLICATE_MINUTE'};}
  const relevantOrders=unresolved(state).filter(o=>o.context.isin===bar.isin),held=positions(state).filter(p=>p.isin===bar.isin),results=[];
  // Invalid observations remain diagnostics. They do not erase positions or create fills.
  for(const p of held) {
    try {
      const v=minuteValidity(bar,book,p.isin,at,p.delaySeconds);
      required(v.rules.actionBasisId===p.actionBasisId&&!p.actionHold,'Corporate action requires position/entitlement reconciliation');
      if(v.start<=ms(p.entryMarketAt)){results.push({position:p.id,status:'BEFORE_ENTRY'});continue;}
      if(p.lastMinuteStart&&v.start<=ms(p.lastMinuteStart)){results.push({position:p.id,status:'OUT_OF_ORDER_DIAGNOSTIC'});continue;}
      p.lastMinuteStart=bar.startAt;
      if(p.pendingStop&&v.session.day>=p.pendingStop.effectiveDay){p.stop=Math.max(p.stop,p.pendingStop.price);p.pendingStop=null;}
      p.mark={verified:true,sourceId:bar.sourceId,sourceHash:bar.sourceHash,availableAt:bar.receivedAt,price:bar.close,validUntil:v.session.closeAt};
      if(!p.exit&&bar.low<=p.stop)exitIntent(p,at,'STOP_BREACH');
      const status=p.exit?fillExit(state,p,bar,book,at,data.dailyVolume):'MARKED';results.push({position:p.id,status});
      if(p.exit)p.exit.attempts.push({at,barStart:bar.startAt,status});
    } catch(e){results.push({position:p.id,status:'EXIT_DATA_BLOCKED',reason:e.message});if(p.exit)p.exit.attempts.push({at,status:'DATA_BLOCKED',reason:e.message});}
  }
  for(const o of relevantOrders) {
    try {results.push({order:o.id,status:fillEntry(state,o,bar,book,at)});}catch(e){results.push({order:o.id,status:'ENTRY_DATA_BLOCKED',reason:e.message});}
  }
  state.consumedMinutes[key]=hash(bar);state.diagnostics.push({at,barStart:bar.startAt,results});return {results};
}
function openDay(state,data,at) {
  ruleBook(data.book,at);const day=at.slice(0,10),session=data.book.sessions.find(s=>s.day===day);
  required(session&&ms(at)<ms(session.openAt),'Opening valuation must be committed before verified open');
  required(state.valuationDay!==day,'Opening equity cannot be reset during same session');
  for(const p of positions(state)){
    const mark=data.marks?.find(m=>m.isin===p.isin);source(mark,at);required(finite(mark.price)&&mark.price>=0&&ms(mark.validUntil)>=ms(session.closeAt)&&mark.asOfDay===data.book.sessions.filter(s=>s.day<day).at(-1)?.day,'Complete verified prior-close marks required');p.mark=structuredClone(mark);
    required(!p.actionHold&&rulesFor(data.book,p.isin,day).actionBasisId===p.actionBasisId,'Corporate-action valuation remains provisional until reconciliation');
    if(p.pendingStop&&day>=p.pendingStop.effectiveDay){p.stop=Math.max(p.stop,p.pendingStop.price);p.pendingStop=null;}
  }
  // Calendar explicitly covers intervening settlement days; no weekday arithmetic.
  for(const s of state.settlements.filter(s=>!s.settled&&s.dueDay<=day)){required(data.book.settlementDays.includes(s.dueDay),'Settlement date no longer verified');state.cashCents+=s.amountCents;s.settled=true;s.settledAt=at;}
  const equity=state.cashCents+state.settlements.filter(s=>!s.settled).reduce((n,s)=>n+s.amountCents,0)+positions(state).reduce((n,p)=>n+productCents(p.quantity,p.mark.price),0);
  state.openingEquityCents=equity;state.highWaterCents=Math.max(state.highWaterCents,equity);state.valuationDay=day;
  return {status:'OPENING_VALUATION_RECORDED',equityCents:equity};
}
function dailyClose(state,data,at) {
  ruleBook(data.book,at);const d=data.daily;source(d,at);
  const session=data.book.sessions.find(s=>s.day===d.day);required(session&&ms(d.availableAt)>=ms(session.closeAt)+d.delaySeconds*1000+1800000,'Daily finalization before close/delay/buffer');
  required(d.confirmed===true&&d.basis==='RAW_CURRENT_PRICE_UNITS'&&finite(d.close)&&d.close>0&&finite(d.atr14)&&d.atr14>0&&finite(d.sma20)&&d.sma20>0&&d.method==='V5_FIXED_WINDOW'&&/^[a-f0-9]{64}$/.test(d.calculationHash),'Bound completed v5 daily calculation required');
  const input=data.signalInput,stock=input?.universe?.find(s=>s.instrument.isin===d.isin);
  required(stock&&input.signalDay===d.day&&ms(input.cutoffAt)<=ms(at)&&d.delaySeconds===stock.delaySeconds,'Daily exit calculation needs admitted same-session input');
  const bars=admitSeries(stock,input),m=metrics(bars),factor=bars.at(-1).priceFactor;
  required(d.calculationHash===hash({inputHash:hash(input),isin:d.isin,metrics:m})&&d.close===bars.at(-1).raw.close&&Math.abs(d.atr14-m.atr14/factor)<1e-10&&Math.abs(d.sma20-m.sma20/factor)<1e-10,'Daily ATR/SMA/close must equal deterministic v5 calculation');
  const next=data.book.sessions.find(s=>s.day>d.day);required(next,'Next session unavailable; cannot date trailing/time exit');
  for(const p of positions(state).filter(p=>p.isin===d.isin)) {
    required(!p.lastDailyDay||d.day>p.lastDailyDay,'Duplicate/out-of-order daily close');required(d.day>=p.entryDay,'Daily close precedes position');
    const r=rulesFor(data.book,p.isin,d.day);required(validTick(d.close,r.ticks),'Invalid daily close tick');
    required(!p.actionHold&&r.actionBasisId===p.actionBasisId,'Corporate-action daily valuation remains blocked');
    p.lastDailyDay=d.day;p.highestClose=Math.max(p.highestClose,d.close);
    if(d.close>=p.entry+(p.entry-p.initialStop))p.trailing=true;
    if(p.trailing){const price=Math.max(p.stop,roundTick(Math.max(0,p.highestClose-2*d.atr14),r.ticks,'floor'));p.pendingStop={price,effectiveDay:next.day};if(price>=d.close)exitIntent(p,at,'TRAIL_ABOVE_MARKET',next.openAt);}
    if(d.close<d.sma20)exitIntent(p,at,'TREND_FAILURE',next.openAt);
    const count=data.book.sessions.filter(s=>s.day>=p.entryDay&&s.day<=d.day).length;
    if(count>=20)exitIntent(p,at,'TIME_EXIT',next.openAt);
    p.dailyFinalizations.push({at,day:d.day,count,calculationHash:d.calculationHash});
    p.mark={verified:true,sourceId:d.sourceId,sourceHash:d.sourceHash,availableAt:d.availableAt,price:d.close,validUntil:next.closeAt};
  }
  return {status:'DAILY_FINALIZED'};
}
function revalidateAll(state,at,{material=false,reason='PORTFOLIO_CHANGE',excludeOrderId=null}={}) {
  for(const o of unresolved(state)) {
    if(o.id===excludeOrderId)continue;
    if(o.cancelAt)continue;
    if(material){cancel(o,at,reason);continue;}
    try {
      const snapshot=portfolioSnapshot(state,at),c=structuredClone(o.context);
      // Remove own reserved commitment/exposure before assessing retained eligibility.
      snapshot.availableCents+=o.reservationCents;snapshot.reservedCents-=o.reservationCents;
      snapshot.exposures=snapshot.exposures.filter(x=>!(x.isin===c.isin&&x.state==='PENDING'));snapshot.positionCount=snapshot.exposures.length;snapshot.forwardRiskCents=snapshot.exposures.reduce((n,p)=>n+p.forwardRiskCents,0);
      if(snapshot.dailyDrawdown>=.02&&c.snapshot.dailyDrawdown<.02||snapshot.experimentDrawdown>=.04&&Math.floor((snapshot.experimentDrawdown-.04+1e-10)/.02)>Math.floor((Math.max(.039999,c.snapshot.experimentDrawdown)-.04+1e-10)/.02)){cancel(o,at,'DRAWDOWN_REVIEW_DUE');continue;}
      c.snapshot=snapshot;c.snapshotHash=hash(snapshot);delete c.contextHash;c.contextHash=hash(c);
      const calc=sizeEntry(c,o.proposal),q=Math.min(o.quantity,calc.quantity);
      if(!q){cancel(o,at,'REVALIDATION_ZERO');continue;}
      o.quantity=q;o.timeline.push({at,quantity:q,reason:'DETERMINISTIC_REVALIDATION'});
      // Keep original reservation until old larger authorized events can no longer arrive.
      const receipt={order:o.id,at,snapshotHash:hash(snapshot),quantity:q,calculationHash:calc.calculationHash};receipt.hash=hash(receipt);state.receipts.push(receipt);o.decision.execution.revalidationReceiptHashes.push(receipt.hash);
    } catch(e){cancel(o,at,'REVALIDATION_BLOCKED: '+e.message);}
  }
}
export function transition(previous,event) {
  const state=structuredClone(previous),{type,data={},at}=event;
  required(state.releaseHash===executionReleaseHash(),'Execution release changed; explicit migration/replay review required');
  ms(at);required(!state.lastAt||ms(at)>=ms(state.lastAt),'Events cannot backdate committed ledger time');
  expire(state,at);let result;
  if(type==='OPEN_DAY')result=openDay(state,data,at);
  else if(type==='ASSESS') {
    required(nonempty(data.requestId),'Persisted preparation request ID required');state.assessments??={};required(!state.assessments[data.requestId],'Assessment is immutable; append a new request');
    try {
      const context=prepareEntry(data.bundle,state,at),calculation=sizeEntry(context,data.proposal||{});
      result={status:calculation.quantity>0?'PROPOSED':'BLOCKED',requestId:data.requestId,at,contextHash:context.contextHash,calculationHash:calculation.calculationHash,quantity:calculation.quantity,reasonCodes:calculation.quantity>0?['AWAITING_REQUIRED_APPROVALS']:calculation.bindingConstraints,nextReview:calculation.quantity>0?'Complete bound decision and independent reviews before verified open':'Resolve named constraints before next valid opportunity',entryAuthorization:false};
    }catch(e){result={status:'BLOCKED',requestId:data.requestId,at,quantity:0,reasonCodes:['ENTRY_PREPARATION_BLOCKED'],reason:e.message,nextReview:'Resolve missing evidence or failed prerequisite; do not backdate approval',entryAuthorization:false};}
    state.assessments[data.requestId]=result;
  }
  else if(type==='SET_PAUSE'){required(typeof data.paused==='boolean'&&nonempty(data.reason),'Explicit engineering pause reason required');state.paused=data.paused;if(data.paused)for(const o of unresolved(state))cancel(o,at,'USER_PAUSE');result={paused:state.paused};}
  else if(type==='SUBMIT') {
    required(!state.paused,'New entry acceptance paused');required(ms(data.preparedAt)<=ms(at)&&ms(at)-ms(data.preparedAt)<=1800000&&(!state.lastAt||ms(data.preparedAt)>=ms(state.lastAt)),'Prepared snapshot expired or superseded');
    const c=prepareEntry(data.bundle,state,data.preparedAt),check=validateEntryDecision(data.decision,c,data.proposal,data.riskReport,at),id=data.decision.execution.orderIntentId;
    required(nonempty(id)&&!state.orders[id],'Duplicate order intent');const calc=check.calculation;
    const accepted={orderId:id,at,releaseHash:state.releaseHash,contextHash:c.contextHash,decisionHash:hash(data.decision),preSnapshotHash:c.snapshotHash,quantity:calc.quantity};
    const reservation={orderId:id,at,amountCents:calc.reservationCents,acceptedHash:hash(accepted)};
    const decision=structuredClone(data.decision);Object.assign(decision.execution,{status:'RESERVED',acceptedOrderReceiptHash:hash(accepted),reservationReceiptHash:hash(reservation)});
    state.orders[id]={id,status:'RESERVED',acceptedAt:at,context:c,calculation:calc,proposal:structuredClone(data.proposal),quantity:calc.quantity,reservationCents:calc.reservationCents,decision,resolved:false,cancelAt:null,certificateExpiry:decision.riskCertificate?.validUntil||c.marketWindowEnd,timeline:[{at,quantity:calc.quantity,reason:'ATOMIC_ACCEPTANCE'}]};state.receipts.push(accepted,reservation);
    revalidateAll(state,at,{excludeOrderId:id});
    result={status:'RESERVED',orderId:id,quantity:calc.quantity,acceptedHash:hash(accepted),reservationHash:hash(reservation)};
  }
  else if(type==='MINUTE')result=minute(state,data,at);
  else if(type==='DAILY_CLOSE')result=dailyClose(state,data,at);
  else if(type==='CANCEL'){const o=state.orders[data.orderId];required(o&&!o.resolved&&nonempty(data.reason),'Active order and cancellation reason required');cancel(o,at,data.reason);result={status:'CANCELLED_PENDING_RECONCILIATION'};}
  else if(type==='REVALIDATE'){revalidateAll(state,at,data);result={status:'REVALIDATED'};}
  else if(type==='THESIS_BREAK') {
    source(data,at);required(nonempty(data.reason)&&nonempty(data.actorId)&&nonempty(data.reviewerId)&&data.actorId!==data.reviewerId&&data.unresolvedCriticalDefect===false,'Independent source-backed thesis-break review required');
    for(const o of unresolved(state).filter(o=>o.context.isin===data.isin))cancel(o,at,'THESIS_BREAK');
    for(const p of positions(state).filter(p=>p.isin===data.isin))exitIntent(p,at,'THESIS_BREAK');result={status:'THESIS_BREAK_RECORDED'};
  }
  else if(type==='CORPORATE_ACTION_HOLD') {
    source(data,at);required(nonempty(data.reason),'Action hold reason required');
    for(const o of unresolved(state).filter(o=>o.context.isin===data.isin))cancel(o,at,'CORPORATE_ACTION_HOLD');
    for(const p of positions(state).filter(p=>p.isin===data.isin)){p.actionHold={at,reason:data.reason,sourceHash:data.sourceHash};p.mark.verified=false;}
    state.incidents.push({at,code:'CORPORATE_ACTION_RECONCILIATION_REQUIRED',isin:data.isin});result={status:'AFFECTED_POSITION_PROVISIONAL'};
  }
  else if(type==='RISK_EXIT') {
    validateRiskExit(data.decision,state,data.positionId,data.report,data.changedEvidence,at);const p=state.positions[data.positionId];
    exitIntent(p,at,'RISK_EXIT');result={status:'EXIT_PENDING'};
  }
  else if(type==='TICK')result={status:'CLOCK_RECONCILED'};
  else throw Error('Unknown engineering event');
  if(['MINUTE','DAILY_CLOSE','OPEN_DAY'].includes(type)) {
    const held=positions(state);
    if(held.every(p=>p.mark.verified&&ms(p.mark.availableAt)<=ms(at)&&ms(p.mark.validUntil)>=ms(at))) {
      const equity=state.cashCents+state.settlements.filter(s=>!s.settled).reduce((n,s)=>n+s.amountCents,0)+held.reduce((n,p)=>n+productCents(p.quantity,p.mark.price),0);
      state.highWaterCents=Math.max(state.highWaterCents,equity);
    }
    revalidateAll(state,at);
  }
  state.sequence++;state.lastAt=at;
  const reserved=unresolved(state).reduce((s,o)=>s+o.reservationCents,0)+positions(state).reduce((s,p)=>s+p.exitFeeReserveCents,0);
  required(Number.isSafeInteger(state.cashCents)&&state.cashCents>=reserved&&reserved>=0,'Funded cash invariant violated');
  for(const o of Object.values(state.orders))validateSchema(o.decision);
  return {state,result};
}
