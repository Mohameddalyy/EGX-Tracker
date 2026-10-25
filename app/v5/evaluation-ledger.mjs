// Read-only evaluation of isolated engineering ledgers. Never opens the tracker database.
import {DatabaseSync} from 'node:sqlite';
import {hash,required,finite,timestamp} from './contract.mjs';
import {initialState,transition} from './execution.mjs';
import {executionReleaseHash} from './risk.mjs';
import {productCents,feeCents} from './money.mjs';

export function readEvaluationLedger(path) {
  const db=new DatabaseSync(path,{readOnly:true});
  try {
    db.exec('BEGIN'); // One consistent WAL snapshot, no migration or checkpoint.
    const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(x=>x.name).sort();
    required(JSON.stringify(tables)===JSON.stringify(['v5_config','v5_events','v5_state']),'Not an isolated v5 ledger');
    const config=JSON.parse(db.prepare('SELECT json FROM v5_config WHERE id=1').get().json);
    const stored=JSON.parse(db.prepare('SELECT json FROM v5_state WHERE id=1').get().json);
    const rows=db.prepare('SELECT * FROM v5_events ORDER BY sequence').all();
    let previousHash=hash(config),sequence=0,lastAt=null;
    const events=rows.map(row=>{
      const event=JSON.parse(row.event);
      required(row.sequence===++sequence&&row.id===event.id&&timestamp(event.at)&&(!lastAt||Date.parse(event.at)>=Date.parse(lastAt)),'Ledger sequence/time mismatch');
      required(row.previousHash===previousHash&&row.eventHash===hash({previousHash,event,stateHash:row.stateHash}),'Ledger hash chain mismatch');
      previousHash=row.eventHash;lastAt=event.at;return event;
    });
    required(stored.sequence===sequence&&(!rows.length||rows.at(-1).stateHash===hash(stored)),'Final state hash mismatch');
    const audit={scope:config.scope,config,state:stored,events,chainVerified:true,chainHead:previousHash,stateHash:hash(stored),transitionReplay:'BLOCKED_RELEASE_MISMATCH',trace:[]};
    // Chain validation alone is not a semantic replay or proof of authentic market evidence.
    if(stored.releaseHash===executionReleaseHash()) {
      let state=initialState(config);
      audit.trace.push({at:null,eventType:'INITIAL',state});
      for(let i=0;i<events.length;i++) {
        const next=transition(state,events[i]);state=next.state;
        required(hash(state)===rows[i].stateHash&&JSON.stringify(next.result)===rows[i].result,'Transition/result replay mismatch');
        audit.trace.push({at:events[i].at,eventType:events[i].type,state});
      }
      required(hash(state)===hash(stored),'Replayed final state mismatch');audit.transitionReplay='VERIFIED';
    }
    db.exec('COMMIT');return audit;
  } finally {db.close();}
}

export function valuation(state,at=state.lastAt) {
  required(timestamp(at),'Explicit valuation time required');
  const held=Object.values(state.positions).filter(p=>p.status!=='CLOSED');
  const unavailable=held.filter(p=>p.actionHold||!p.mark?.verified||!p.mark.sourceId||!p.mark.sourceHash||!timestamp(p.mark.availableAt)||Date.parse(p.mark.availableAt)>Date.parse(at)||!timestamp(p.mark.validUntil)||Date.parse(p.mark.validUntil)<Date.parse(at)||!finite(p.mark.price)||p.mark.price<0).map(p=>p.id);
  const unsettledCents=state.settlements.filter(s=>!s.settled).reduce((n,s)=>n+s.amountCents,0);
  const reservedCents=Object.values(state.orders).filter(o=>!o.resolved).reduce((n,o)=>n+o.reservationCents,0)+held.reduce((n,p)=>n+p.exitFeeReserveCents,0);
  const investedCents=unavailable.length?null:held.reduce((n,p)=>n+productCents(p.quantity,p.mark.price),0);
  return {at,status:unavailable.length?'UNAVAILABLE_MARKS':'VALUED',unavailable,cashCents:state.cashCents,unsettledCents,reservedCents,availableCashCents:state.cashCents-reservedCents,investedCents,equityCents:investedCents===null?null:state.cashCents+unsettledCents+investedCents};
}

export function observedDrawdown(points,startingCapitalCents) {
  let peak=startingCapitalCents,max=0,current=null,currentPeakAt=null,peakAt=null,troughAt=null;
  for(const p of points)if(finite(p.equityCents)){
    if(p.equityCents>peak){peak=p.equityCents;currentPeakAt=p.at;}
    current=peak?1-p.equityCents/peak:null;
    if(current>max){max=current;peakAt=currentPeakAt;troughAt=p.at;}
  }
  const observations=points.filter(p=>finite(p.equityCents)).length;
  return {fraction:observations?max:null,currentFraction:points.length&&finite(points.at(-1).equityCents)?current:null,recoveryRequiredFraction:observations&&max<1?max/(1-max):null,peakAt,troughAt,observations,gaps:points.filter(p=>!finite(p.equityCents)).length,basis:'Observed event snapshots only; gaps may hide larger losses. Stress loss is separate.'};
}

export function ledgerMetrics(audit,{at=audit.state.lastAt||new Date().toISOString()}={}) {
  required(audit.transitionReplay==='VERIFIED','Metrics require matching-release semantic replay, not just a hash chain');
  const s=audit.state;required(timestamp(at)&&(!s.lastAt||Date.parse(at)>=Date.parse(s.lastAt)),'Cannot value final state before its last event');
  const positions=Object.values(s.positions),closed=positions.filter(p=>p.status==='CLOSED'),held=positions.filter(p=>p.status!=='CLOSED');
  const fills=[],trades=[];let realizedCents=0,feesCents=0,tradedNotionalCents=0;
  for(const p of positions) {
    const entryNotional=productCents(p.quantity,p.entry),entryFee=feeCents(p.quantity,p.entry,s.scenario);
    required(p.entryCostCents===entryNotional+entryFee,'Entry cost reconciliation failed');
    feesCents+=entryFee;tradedNotionalCents+=entryNotional;
    fills.push({id:p.id,isin:p.isin,side:'BUY',quantity:p.quantity,price:p.entry,marketAt:p.entryMarketAt,observedAt:p.entryObservedAt,feeCents:entryFee,sourceHash:s.orders[p.id].fill.sourceHash});
    if(p.status==='CLOSED') {
      const f=p.exit.fill,exitNotional=productCents(p.quantity,f.price),exitFee=feeCents(p.quantity,f.price,s.scenario),netCents=exitNotional-exitFee-p.entryCostCents;
      required(f.quantity===p.quantity,'Unsupported partial lot');realizedCents+=netCents;feesCents+=exitFee;tradedNotionalCents+=exitNotional;
      fills.push({id:p.id,isin:p.isin,side:'SELL',...f,feeCents:exitFee});
      trades.push({id:p.id,isin:p.isin,quantity:p.quantity,netCents,grossBeforeFeesCents:exitNotional-entryNotional,initialRiskCents:p.initialRiskCents,rMultiple:p.initialRiskCents>0?netCents/p.initialRiskCents:null,entryAt:p.entryMarketAt,exitAt:f.marketAt,exitReason:p.exit.reason,exitDelayHours:(Date.parse(f.marketAt)-Date.parse(p.exit.committedAt))/3600000,settleDay:f.settleDay});
    }
  }
  required(realizedCents===s.realizedCents&&feesCents===s.feesCents,'Realized P&L/fees do not reconcile');
  const v=valuation(s,at),unrealizedCents=v.investedCents===null?null:v.investedCents-held.reduce((n,p)=>n+p.entryCostCents,0),netCents=v.equityCents===null?null:v.equityCents-s.startingCapitalCents;
  required(netCents===null||netCents===realizedCents+unrealizedCents,'Equity/P&L identity failed (unsupported cashflow or entitlement)');
  const curve=audit.trace.filter(t=>t.at).map(t=>({...valuation(t.state,t.at),sequence:t.state.sequence}));
  if(curve.at(-1)?.at!==at)curve.push({...v,sequence:s.sequence});
  const winners=trades.filter(t=>t.netCents>0),losers=trades.filter(t=>t.netCents<0),sum=a=>a.reduce((n,t)=>n+t.netCents,0);
  const execution=fills.map(f=>{
    const event=audit.events.find(e=>e.type==='MINUTE'&&e.data?.bar?.isin===f.isin&&e.data.bar.startAt===f.marketAt&&e.data.bar.sourceHash===f.sourceHash&&e.at===f.observedAt),reference=event?.data.bar.open;
    return {...f,referencePrice:reference??null,referenceBasis:'Matched raw minute open; modeled slippage, not observed broker execution',adverseSlippageCents:finite(reference)?(f.side==='BUY'?1:-1)*(productCents(f.quantity,f.price)-productCents(f.quantity,reference)):null};
  });
  const completeSlippage=execution.every(f=>f.adverseSlippageCents!==null),slippageCents=completeSlippage?execution.reduce((n,f)=>n+f.adverseSlippageCents,0):null;
  const concentrations={};if(v.investedCents!==null)for(const p of held){for(const [type,key] of [['isin',p.isin],['sector',p.sector],['issuerGroup',p.issuerGroup]]){const k=type+':'+key;concentrations[k]=(concentrations[k]||0)+productCents(p.quantity,p.mark.price);}}
  const orders=Object.values(s.orders),counts={orders:orders.length,filled:orders.filter(o=>o.fill).length,unfilled:orders.filter(o=>!o.fill).length,censored:orders.filter(o=>o.censored).length,closedTrades:closed.length,held:held.length,pendingExits:held.filter(p=>p.exit).length};
  const settlements=s.settlements.map(x=>({...x,status:x.settled?'SETTLED':x.dueDay<at.slice(0,10)?'OVERDUE_OBSERVATION':'UNSETTLED',observationDelayHours:x.settled?(Date.parse(x.settledAt)-Date.parse(x.observedAt))/3600000:null}));
  return {scope:'SYNTHETIC_OR_ENGINEERING_ONLY_NOT_PROSPECTIVE_PERFORMANCE',ledgerId:s.id,variantId:s.variantId,scenario:s.scenario,releaseHash:s.releaseHash,chainHead:audit.chainHead,stateHash:audit.stateHash,valuation:v,counts,settlements,netCents,netReturnFraction:netCents===null?null:netCents/s.startingCapitalCents,realizedCents,unrealizedCents,feesCents,grossBeforeFeesCents:netCents===null?null:netCents+feesCents,modeledSlippageCents:slippageCents,hitRate:trades.length?winners.length/trades.length:null,expectancyCents:trades.length?realizedCents/trades.length:null,profitFactor:losers.length?sum(winners)/-sum(losers):null,profitabilityStatus:trades.length?'DESCRIPTIVE_ONLY':'INCONCLUSIVE_NO_CLOSED_TRADES',turnover:{tradedNotionalCents,fractionOfInitialCapital:tradedNotionalCents/s.startingCapitalCents,basis:'Two-sided traded notional / fixed starting capital, not annualized'},exposureFraction:v.equityCents>0?v.investedCents/v.equityCents:null,concentrationsCents:v.investedCents===null?null:concentrations,drawdown:observedDrawdown(curve,s.startingCapitalCents),curve,trades,execution,pendingExits:held.filter(p=>p.exit).map(p=>({id:p.id,reason:p.exit.reason,committedAt:p.exit.committedAt,ageHours:(Date.parse(at)-Date.parse(p.exit.committedAt))/3600000,attempts:p.exit.attempts})),orders:orders.map(o=>({id:o.id,status:o.status,censored:!!o.censored,reason:o.pendingReason??null})),sharpe:{value:null,reason:'No registered adequate daily-return/risk-free sample'},sortino:{value:null,reason:'No registered adequate daily-return/downside-hurdle sample'},dividends:{value:null,reason:'Entitlement reconciliation not implemented; action holds make affected valuation unavailable'},implementationShortfall:{value:null,reason:'Decision-price and unfilled-opportunity reference series not registered; minute-open slippage is reported separately'},fixedExitAttribution:{status:'BLOCKED',reason:'Requires separately replayed funded portfolio and entry-budget ceilings; cannot remove discretionary exits from already filled results'},analyticalValue:'INCONCLUSIVE',investablePerformance:'NOT_ESTABLISHED'};
}

// No forward filling: an event-time mark is not automatically a daily closing valuation.
export function dailyEquity(audit,sessions) {
  required(audit.transitionReplay==='VERIFIED','Daily equity requires semantic replay');
  required(sessions.every((s,i)=>/^\d{4}-\d{2}-\d{2}$/.test(s.day)&&(!i||s.day>sessions[i-1].day)),'Ordered unique daily valuation sessions required');
  return sessions.map((session,i)=>{
    required(timestamp(session.closeAt)&&timestamp(session.openAt)&&session.verified===true,'Verified session required');
    const nextOpen=sessions[i+1]?.openAt;
    const traces=audit.trace.filter(t=>t.at&&Date.parse(t.at)>=Date.parse(session.closeAt)&&(!nextOpen||Date.parse(t.at)<Date.parse(nextOpen))&&t.at.slice(0,10)===session.day);
    const t=traces.at(-1),held=t?Object.values(t.state.positions).filter(p=>p.status!=='CLOSED'):[];
    const complete=t&&held.every(p=>p.lastDailyDay===session.day)&&!held.some(p=>p.actionHold);
    const v=complete?valuation(t.state,t.at):null;
    return {day:session.day,equityCents:v?.equityCents??null,status:v?.equityCents!==null&&v?'VERIFIED':'MISSING_DAILY_CLOSE',stateHash:t?hash(t.state):null};
  });
}
