// Isolated conditional mechanical diagnostic. No order API, certificates or live authorization.
// Mechanical lifecycle copied from the frozen engineering release and differential-tested.
// Deliberately separate: altered portfolio snapshots must never be presented as new approvals.
import {hash,required,nonempty,finite} from './contract.mjs';
import {roundTick,validTick,metrics} from './math.mjs';
import {admitSeries} from './signals.mjs';
import {ms,source,ruleBook,rulesFor,settlementDay,minuteValidity} from './execution-rules.mjs';
import {cents,productCents,costs,feeCents,buyCommitment,plannedLoss} from './money.mjs';
import {prepareEntry,sizeEntry,portfolioSnapshot,executionReleaseHash} from './risk.mjs';
import {initialState,transition} from './execution.mjs';
import {readEvaluationLedger,valuation,observedDrawdown} from './evaluation-ledger.mjs';
function unresolved(state){return Object.values(state.orders).filter(o=>!o.resolved);}
function positions(state){return Object.values(state.positions).filter(p=>p.status!=='CLOSED');}
function cancel(order,at,reason) {
  if(order.resolved)return;
  if(!order.cancelAt){order.cancelAt=at;order.timeline.push({at,quantity:0,reason});}
  
  order.status='UNFILLED';order.pendingReason=reason;
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
      o.resolved=true;o.reservationCents=0;o.status='NO_FILL_EVIDENCE';o.censored=true;
      state.incidents.push({at,code:'ENTRY_COVERAGE_INCOMPLETE',orderId:o.id,reason:'Reconciliation deadline passed; later bars diagnostic only'});
    } else if(ms(at)>=ms(o.context.marketWindowEnd)) {o.status='EXPIRED_PENDING_RECONCILIATION';}
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
      const receipt={order:o.id,at,snapshotHash:hash(snapshot),quantity:q,calculationHash:calc.calculationHash};receipt.hash=hash(receipt);state.receipts.push(receipt);
    } catch(e){cancel(o,at,'REVALIDATION_BLOCKED: '+e.message);}
  }
}

function project(state,at) {
  return {valuation:valuation(state,at),cashCents:state.cashCents,feesCents:state.feesCents,realizedCents:state.realizedCents,
    orders:Object.values(state.orders).map(o=>({id:o.id,quantity:o.quantity,status:o.status,reservationCents:o.reservationCents,fill:o.fill??null,cancelAt:o.cancelAt,censored:!!o.censored})),
    positions:Object.values(state.positions).map(p=>({id:p.id,isin:p.isin,quantity:p.quantity,status:p.status,entry:p.entry,stop:p.stop,initialRiskCents:p.initialRiskCents,exit:p.exit,actionHold:p.actionHold??null})),settlements:state.settlements};
}

function counterTransition(previous,event,originalAfter,openingMarks=[]) {
  let state=structuredClone(previous);const {type,at,data={}}=event;
  required(!state.lastAt||ms(at)>=ms(state.lastAt),'Counterfactual events out of order');
  expire(state,at);let result;
  try {
    if(type==='SUBMIT') {
      const original=originalAfter.orders[data.decision.execution.orderIntentId];required(original,'Original accepted intent required');
      required(!state.paused,'Entries paused');
      // Recompute the changed portfolio context; use the ORIGINAL desired budgets and
      // allowlisted exceptions, never synthesize an approval for the changed state.
      const context=prepareEntry(data.bundle,state,data.preparedAt),calc=sizeEntry(context,data.proposal);
      const quantity=Math.min(original.quantity,calc.quantity);
      if(!quantity)result={status:'COUNTERFACTUAL_UNFUNDED_OR_CONSTRAINED',originalQuantity:original.quantity,quantity:0,reasons:calc.bindingConstraints};
      else {
        required(!state.orders[original.id],'Duplicate diagnostic intent');
        const reservationCents=buyCommitment(quantity,context.setup.limit,state.scenario);
        const calculation={...calc,quantity,reservationCents,initialRiskCents:plannedLoss(quantity,context.setup.limit,context.setup.stop,context.rules.ticks,state.scenario)};
        calculation.calculationHash=hash(calculation);
        state.orders[original.id]={id:original.id,status:'RESERVED',acceptedAt:at,context,calculation,proposal:structuredClone(data.proposal),quantity,reservationCents,resolved:false,cancelAt:null,certificateExpiry:original.certificateExpiry,timeline:[{at,quantity,reason:'CONDITIONAL_MECHANICAL_ALLOCATION'}],originalIntentHash:hash(event),originalDesiredQuantity:original.quantity};
        revalidateAll(state,at,{excludeOrderId:original.id});result={status:'CONDITIONAL_RESERVATION',originalQuantity:original.quantity,quantity,originalIntentHash:hash(event),desiredBudget:structuredClone(data.proposal)};
      }
    } else if(type==='RISK_EXIT')result={status:'SUPPRESSED_DISCRETIONARY_EXIT',positionId:data.positionId,originalEventHash:hash(event)};
    else if(type==='OPEN_DAY') {
      const marks=[...(data.marks||[])];
      for(const m of openingMarks){required(!marks.some(x=>x.isin===m.isin),'Supplement cannot replace an original mark');marks.push(m);}
      result=openDay(state,{...data,marks},at);
    } else if(type==='MINUTE')result=minute(state,data,at);
    else if(type==='DAILY_CLOSE')result=dailyClose(state,data,at);
    else if(type==='SET_PAUSE'){state.paused=data.paused;if(state.paused)for(const o of unresolved(state))cancel(o,at,'USER_PAUSE');result={paused:state.paused};}
    else if(type==='CANCEL'){const o=state.orders[data.orderId];if(o&&!o.resolved)cancel(o,at,data.reason);result={status:o?'CANCEL_RETAINED':'NO_COUNTERFACTUAL_ORDER'};}
    else if(type==='REVALIDATE'){revalidateAll(state,at,data);result={status:'REVALIDATED'};}
    else if(type==='THESIS_BREAK') {
      source(data,at);
      for(const o of unresolved(state).filter(o=>o.context.isin===data.isin))cancel(o,at,'THESIS_BREAK');
      for(const p of positions(state).filter(p=>p.isin===data.isin))exitIntent(p,at,'THESIS_BREAK');result={status:'MANDATORY_THESIS_EXIT_RETAINED'};
    } else if(type==='CORPORATE_ACTION_HOLD') {
      source(data,at);for(const o of unresolved(state).filter(o=>o.context.isin===data.isin))cancel(o,at,'CORPORATE_ACTION_HOLD');
      for(const p of positions(state).filter(p=>p.isin===data.isin)){p.actionHold={at,reason:data.reason,sourceHash:data.sourceHash};p.mark.verified=false;}
      result={status:'ACTION_HOLD_RETAINED'};
    } else if(type==='ASSESS')result={status:'NO_NEW_MODEL_DECISION_INFERRED',requestId:data.requestId};
    else if(type==='TICK')result={status:'CLOCK_RECONCILED'};
    else throw Error('Unsupported source event');
    if(['MINUTE','DAILY_CLOSE','OPEN_DAY'].includes(type)) {
      const held=positions(state);
      if(held.every(p=>!p.actionHold&&p.mark.verified&&ms(p.mark.availableAt)<=ms(at)&&ms(p.mark.validUntil)>=ms(at))) {
        const v=valuation(state,at);state.highWaterCents=Math.max(state.highWaterCents,v.equityCents);
      }
      revalidateAll(state,at);
    }
    const reserved=unresolved(state).reduce((n,o)=>n+o.reservationCents,0)+positions(state).reduce((n,p)=>n+p.exitFeeReserveCents,0);
    required(Number.isSafeInteger(state.cashCents)&&state.cashCents>=reserved&&reserved>=0,'Counterfactual funded-cash invariant failed');
  } catch(error) {
    // Missing observations for an additionally-held name cannot be filled with the
    // original portfolio's later cash. Retain the position and expose the gap.
    state=structuredClone(previous);expire(state,at);
    result={status:'COUNTERFACTUAL_BLOCKED',eventType:type,reason:error.message};
  }
  state.sequence++;state.lastAt=at;return {state,result};
}

export function fixedExitAttributionFromEvents({config,events,openingMarks={},supplementalEvents=[]}) {
  required(events.length>0,'Original committed event stream required');
  // Validate the entire original path FIRST, including every original certificate.
  // This function neither accepts fabricated decisions nor changes original records.
  let original=initialState(config);const originals=new Map();
  for(const event of events){required(!originals.has(event.id),'Duplicate original event');original=transition(original,event).state;originals.set(event.id,original);}
  required(Object.keys(openingMarks).every(id=>events.some(e=>e.id===id&&e.type==='OPEN_DAY')),'Opening supplement must bind an original opening event');
  const ids=new Set(events.map(e=>e.id));
  for(const e of supplementalEvents){required(['MINUTE','DAILY_CLOSE'].includes(e.type)&&!ids.has(e.id),'Only distinct exogenous market observations may supplement attribution');ids.add(e.id);required(ms(e.at)>=ms(events[0].at)&&ms(e.at)<=ms(events.at(-1).at),'Supplement outside original observed period');}
  const stream=[...events.map((e,i)=>({e,i,original:true})),...supplementalEvents.map((e,i)=>({e,i:events.length+i,original:false}))].sort((a,b)=>ms(a.e.at)-ms(b.e.at)||a.i-b.i);
  let state=initialState(config),priorOriginal=initialState(config);const trace=[],divergences=[];
  for(const item of stream) {
    if(item.original)priorOriginal=originals.get(item.e.id);
    if(!item.original) {
      const isin=item.e.data?.bar?.isin||item.e.data?.daily?.isin;
      required(positions(state).some(p=>p.isin===isin)&&!positions(priorOriginal).some(p=>p.isin===isin)&&!unresolved(priorOriginal).some(o=>o.context.isin===isin),'Supplement may cover only additionally-held counterfactual exposure; asymmetric original-path evidence prohibited');
    }
    const step=counterTransition(state,item.e,priorOriginal,openingMarks[item.e.id]);state=step.state;
    const actual=project(priorOriginal,item.e.at),counterfactual=project(state,item.e.at),diverged=hash(actual)!==hash(counterfactual);
    const row={eventId:item.e.id,at:item.e.at,type:item.e.type,supplemental:!item.original,result:step.result,actual,counterfactual,diverged};
    trace.push(row);if(diverged||step.result.status==='SUPPRESSED_DISCRETIONARY_EXIT'||step.result.status==='COUNTERFACTUAL_BLOCKED')divergences.push({eventId:item.e.id,type:item.e.type,result:step.result,actualEquityCents:actual.valuation.equityCents,counterfactualEquityCents:counterfactual.valuation.equityCents});
  }
  const actual=project(original,events.at(-1).at),counterfactual=project(state,events.at(-1).at),a=actual.valuation.equityCents,c=counterfactual.valuation.equityCents;
  return {scope:'FIXED-EXIT-ATTRIBUTION',conditional:true,notACompetingStrategy:true,entryAuthorization:false,originalScope:config.scope,variantId:config.variantId,scenario:config.scenario,executionReleaseHash:executionReleaseHash(),originalInputHash:hash({config,events}),supplementHash:hash({openingMarks,supplementalEvents}),originalFinalStateHash:hash(original),actual,counterfactual,actualMinusFixedExitEquityCents:a===null||c===null?null:a-c,drawdown:observedDrawdown(trace.map(t=>t.counterfactual.valuation),state.startingCapitalCents),suppressedRiskExits:trace.filter(t=>t.result.status==='SUPPRESSED_DISCRETIONARY_EXIT').length,blockedEvents:trace.filter(t=>t.result.status==='COUNTERFACTUAL_BLOCKED').length,divergences,trace,limitation:'Recorded desired accepted intents only. No new research/risk decision is inferred for altered states. Missing market coverage, marks and corporate-action entitlements remain gaps. Counterfactual reservations are calculations, not broker orders or new Risk Agent approvals.'};
}

export function fixedExitAttribution(path,options={}) {
  const audit=readEvaluationLedger(path);required(audit.transitionReplay==='VERIFIED','Matching-release original semantic replay required');
  required(Object.keys(options).every(k=>['openingMarks','supplementalEvents'].includes(k)),'Attribution options cannot replace original ledger inputs');
  return fixedExitAttributionFromEvents({config:audit.config,events:audit.events,openingMarks:options.openingMarks,supplementalEvents:options.supplementalEvents});
}
