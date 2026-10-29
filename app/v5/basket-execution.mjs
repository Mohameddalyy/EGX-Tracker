import {verifyBasketActivation} from './basket-activation.mjs';
import {corporateAction} from './basket-actions.mjs';
import {readFileSync} from 'node:fs';
import {hash,required,finite} from './contract.mjs';
import {executionReleaseHash} from './risk.mjs';
import {admitSeries} from './signals.mjs';
import {cairoDate} from '../finality.mjs';
import {planBasket} from './basket-plan.mjs';
import {source,minuteValidity,ms,settlementDay,rulesFor,ruleBook} from './execution-rules.mjs';
import {roundTick} from './math.mjs';
import {productCents,feeCents,costs,cents} from './money.mjs';
export function basketReleaseHash(){return hash({base:executionReleaseHash(),files:['basket-execution.mjs','basket-actions.mjs','basket-activation.mjs','fresh-admission.mjs','../workflow-planner.mjs','../finality.mjs','../../research/session-policy.json','basket-plan.mjs','basket-store.mjs','execution-rules.mjs','money.mjs','math.mjs','signals.mjs','plan.json'].map(p=>[p,hash(readFileSync(new URL(p,import.meta.url),'utf8').replace(/\r\n/g,'\n'))])});}
export function initialState(config){
 required(['ENGINEERING_BASKET_ONLY','PROSPECTIVE_BASKET_PAPER'].includes(config.scope)&&typeof config.id==='string'&&config.id,'Isolated engineering basket config required');if(config.scope==='PROSPECTIVE_BASKET_PAPER')verifyBasketActivation(config,basketReleaseHash());const plan=planBasket(config.request);required(plan.status==='PLAN_READY','Unavailable basket cannot execute');
 const stockMap=new Map(config.request.input.universe.map(s=>[s.instrument.isin,s]));
 return {id:config.id,scope:config.scope,releaseHash:basketReleaseHash(),plan,book:config.request.book,sequence:0,lastAt:plan.at,cashCents:10000000,entrySpendCents:0,corporateCashCents:0,feesCents:0,orders:Object.fromEntries(plan.selection.map(x=>{const stock=stockMap.get(x.isin),delay=stock.delaySeconds;required(finite(delay)&&delay>=0,'Known observation delay required');return [x.isin,{...x,delaySeconds:delay,medianDailyShares:admitSeries(stock,config.request.input).slice(-20).map(b=>b.raw.volume).sort((a,b)=>a-b).slice(9,11).reduce((a,b)=>a+b)/2,status:x.quantity?'PENDING':'NO_ALLOCATION',reservationCents:x.commitmentCents,deadline:new Date(ms(plan.marketWindowEnd)+delay*1000+360000).toISOString(),attempts:[]}];})),positions:{},entitlements:{},actions:{},pendingActions:{},consumed:{},coverage:{},marks:{},endpoint:null};
}
const dayValid=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
const integer=n=>Number.isSafeInteger(n)&&n>=0;
function expire(s,at){for(const o of Object.values(s.orders))if(['PENDING','EXPIRED_PENDING_RECONCILIATION'].includes(o.status)){if(ms(at)>ms(o.deadline)){o.status='NO_FILL_EVIDENCE';o.reservationCents=0;}else if(ms(at)>=ms(s.plan.marketWindowEnd))o.status='EXPIRED_PENDING_RECONCILIATION';}}
function held(s,isin){const p=s.positions[isin];required(p,'Basket holding required');return p;}
function sourced(item,at){source(item,at);required(typeof item.id==='string'&&item.id,'Sourced event identity required');}
function quantityAt(p,day){return p.quantityHistory.filter(x=>x.day<=day).at(-1)?.quantity||0;}
export function valuation(s,day){
 const gaps=Object.values(s.pendingActions||{}).map(a=>a.isin+':UNRESOLVED_CORPORATE_ACTION:'+a.id),positions=[],liquidationSensitivity=[];let equity=s.cashCents,receivable=0;
 for(const p of Object.values(s.positions).filter(p=>p.quantity>0)){const mark=s.marks[p.isin],coverage=s.coverage[p.isin];if(!mark||mark.day!==day||mark.actionBasisId!==p.actionBasisId||!coverage||coverage.throughDay<day||coverage.actionBasisId!==p.actionBasisId){gaps.push(p.isin+':MARK_OR_ACTION_ENTITLEMENT_COVERAGE');continue;}
 const value=productCents(p.quantity,mark.price);equity+=value;positions.push({isin:p.isin,quantity:p.quantity,marketValueCents:value,costCents:p.costCents,unrealizedCents:value-p.costCents});try{const r=rulesFor(s.book,p.isin,day);required(r.actionBasisId===p.actionBasisId,'Liquidation basis changed');const price=roundTick(mark.price*(1-costs(s.plan.scenario).adverseSlippageFractionPerSide),r.ticks,'floor');liquidationSensitivity.push({isin:p.isin,price,netValueCents:productCents(p.quantity,price)-feeCents(p.quantity,price,s.plan.scenario),status:'COST_SENSITIVITY_ONLY',executable:false,capacity:'UNAVAILABLE; no terminal fill assumed',insideBands:price>=r.lowerBand&&price<=r.upperBand});}catch(e){liquidationSensitivity.push({isin:p.isin,status:'UNAVAILABLE',reason:e.message,executable:false});}}
 for(const e of Object.values(s.entitlements))if(!e.paid){equity+=e.amountCents;receivable+=e.amountCents;}
 const invested=Object.values(s.positions).reduce((n,p)=>n+p.costCents,0),paid=Object.values(s.entitlements).filter(x=>x.paid).reduce((n,e)=>n+e.amountCents,0);
 required(s.cashCents===10000000-s.entrySpendCents+paid+s.corporateCashCents,'Unexplained cash/accounting difference');
 return {status:gaps.length?'UNAVAILABLE':'VERIFIED_ENGINEERING',day,cashCents:s.cashCents,dividendReceivableCents:receivable,equityCents:gaps.length?null:equity,netReturn:gaps.length?null:equity/10000000-1,positions,liquidationSensitivity,gaps,feesCents:s.feesCents,claim:'Source assertions require separate admission; no prospective economic evidence'};
}
export function transition(before,event){
 required(before.releaseHash===basketReleaseHash(),'Basket release mismatch');required(ms(event.at)>=ms(before.lastAt),'Basket chronology reversal');const s=structuredClone(before);expire(s,event.at);let result={status:'RECORDED'};const d=event.data||{};
 if(event.type==='TICK'){}
 else if(event.type==='RULE_BOOK'){ruleBook(d.book,event.at);required(d.review?.status==='RECONCILED'&&d.review.reviewer&&d.preparedBy&&d.review.reviewer!==d.preparedBy&&d.review.payloadHash===hash(d.book)&&ms(d.review.at)<=ms(event.at),'Reviewed effective rule-book update required');for(const old of s.book.sessions.filter(x=>ms(x.closeAt)<ms(event.at)))required(d.book.sessions.some(n=>hash(n)===hash(old)),'Cannot rewrite completed sessions');for(const old of s.book.instruments.filter(x=>x.day<cairoDate(new Date(event.at))))required(d.book.instruments.some(n=>hash(n)===hash(old)),'Cannot rewrite past instrument rules');s.book=d.book;}
 else if(event.type==='ACTION_NOTICE'){source(d.notice,event.at);required(d.notice.id&&!['__proto__','constructor','prototype'].includes(d.notice.id)&&!Object.hasOwn(s.pendingActions,d.notice.id)&&s.positions[d.notice.isin],'Identified existing holding notice required');s.pendingActions[d.notice.id]=d.notice;delete s.coverage[d.notice.isin];}
 else if(event.type==='CORPORATE_ACTION'){const notice=d.action.noticeId;if(notice)required(s.pendingActions[notice]?.isin===d.action.isin,'Action notice identity mismatch');result=corporateAction(s,d.action,event.at);if(notice)delete s.pendingActions[notice];}
 else if(event.type==='MINUTE'){
  const o=s.orders[d.bar?.isin];required(o,'No replacement or unselected entry');const v=minuteValidity(d.bar,s.book,o.isin,event.at,o.delaySeconds,{entry:true}),key=o.isin+':'+d.bar.startAt;required(!s.consumed[key],'Minute already consumed');s.consumed[key]=hash(d.bar);
  let reason='NOT_PENDING';if(['PENDING','EXPIRED_PENDING_RECONCILIATION'].includes(o.status)){
   reason='OUTSIDE_FROZEN_WINDOW';if(v.start>ms(s.plan.at)&&v.start>=ms(s.plan.marketWindowStart)&&v.start<ms(s.plan.marketWindowEnd)&&ms(event.at)<=ms(o.deadline)){
    const r=v.rules;required(hash(r)===o.rulesHash&&r.actionBasisId===o.actionBasisId,'Changed entry rules/action basis');
    const price=roundTick(d.bar.open*(1+costs(s.plan.scenario).adverseSlippageFractionPerSide),r.ticks,'ceil');reason='PRICE_OR_CAPACITY';
    if(price<=o.limit&&price>=d.bar.low&&price<=d.bar.high&&o.quantity<=Math.floor(d.bar.volume*.01)&&o.quantity<=Math.floor(o.medianDailyShares*.01)){
     const spend=productCents(o.quantity,price)+feeCents(o.quantity,price,s.plan.scenario);required(spend+cents(costs(s.plan.scenario).fixedEGPPerFilledOrder)<=o.reservationCents,'Reservation insufficient');
     s.cashCents-=spend;s.entrySpendCents+=spend;s.feesCents+=feeCents(o.quantity,price,s.plan.scenario);o.status='FILLED';o.reservationCents=0;o.fill={price,quantity:o.quantity,marketAt:d.bar.startAt,observedAt:event.at,sourceHash:d.bar.sourceHash};
     const day=v.session.day;s.positions[o.isin]={isin:o.isin,quantity:o.quantity,costCents:spend,entryDay:day,sellableDay:settlementDay(s.book,day),actionBasisId:o.actionBasisId,quantityHistory:[{day,quantity:o.quantity}]};reason='FILLED';
    }
   }
  }o.attempts.push({at:event.at,minute:d.bar.startAt,reason});result={status:reason};
 }
 else if(event.type==='DIVIDEND'){
  const e=d.entitlement;sourced(e,event.at);const p=held(s,e.isin);required(!s.entitlements[e.id]&&e.currency==='EGP'&&e.basis==='VERIFIED_NET_PER_SHARE'&&e.eligibilityRule==='SETTLED_ON_RECORD_DATE','Unique sourced net entitlement required');required(dayValid(e.recordDay)&&dayValid(e.payDay)&&e.recordDay<=cairoDate(new Date(event.at))&&e.payDay>=e.recordDay&&finite(e.netPerShareEGP)&&e.netPerShareEGP>=0,'Entitlement dates/net value required');
  // Historical quantity is fixed by record-day holdings; later splits do not multiply a cash coupon.
  const q=p.sellableDay<=e.recordDay?quantityAt(p,e.recordDay):0;required(e.eligibleQuantity===q,'Entitlement quantity/settlement mismatch');s.entitlements[e.id]={...e,amountCents:productCents(q,e.netPerShareEGP),paid:false};
 }
 else if(event.type==='PAY_DIVIDEND'){
  sourced(d.receipt,event.at);const e=s.entitlements[d.entitlementId];required(e&&!e.paid&&d.receipt.entitlementId===e.id&&d.receipt.isin===e.isin&&cairoDate(new Date(event.at))>=e.payDay&&d.receipt.currency==='EGP'&&d.receipt.amountCents===e.amountCents,'Exact sourced unpaid entitlement receipt required');e.paid=true;e.paidAt=event.at;s.cashCents+=e.amountCents;
 }
 else if(event.type==='SPLIT'){
  const a=d.action;sourced(a,event.at);const p=held(s,a.isin);required(!s.actions[a.id]&&a.fromBasisId===p.actionBasisId&&typeof a.toBasisId==='string'&&a.toBasisId!==a.fromBasisId,'Unique coherent split basis required');required(integer(a.numerator)&&a.numerator>0&&integer(a.denominator)&&a.denominator>0&&dayValid(a.effectiveDay)&&a.effectiveDay>=p.quantityHistory.at(-1).day&&a.effectiveDay<=cairoDate(new Date(event.at)),'Split ratio/date invalid');required(!Object.values(s.entitlements).some(e=>e.isin===a.isin&&e.recordDay>=a.effectiveDay),'Previously booked entitlement requires explicit action reconciliation');const q=p.quantity*a.numerator/a.denominator;required(Number.isSafeInteger(q)&&q>0,'Fractional/cash-in-lieu action needs separate reconciled treatment');p.quantity=q;p.actionBasisId=a.toBasisId;p.quantityHistory.push({day:a.effectiveDay,quantity:q});s.actions[a.id]=a;delete s.marks[p.isin];delete s.coverage[p.isin];
 }
 else if(event.type==='COVERAGE'){
  const c=d.coverage;sourced(c,event.at);const p=held(s,c.isin);required(c.actionBasisId===p.actionBasisId&&c.fromDay===p.entryDay&&dayValid(c.throughDay)&&c.throughDay<=cairoDate(new Date(event.at))&&c.throughDay>=p.entryDay&&c.complete===true&&Array.isArray(c.entitlementIds)&&Array.isArray(c.actionIds),'Complete sourced coverage interval required');
  const knownE=Object.values(s.entitlements).filter(e=>e.isin===c.isin&&e.recordDay<=c.throughDay).map(e=>e.id).sort(),knownA=Object.values(s.actions).filter(a=>(a.isin===c.isin||a.affectedIsins?.includes(c.isin))&&a.effectiveDay<=c.throughDay).map(a=>a.id).sort();required(hash([...c.entitlementIds].sort())===hash(knownE)&&hash([...c.actionIds].sort())===hash(knownA),'Coverage omits/replaces known entitlements/actions');s.coverage[c.isin]=c;
 }
 else if(event.type==='MARK'){
  const m=d.mark;sourced(m,event.at);const p=held(s,m.isin);required(m.actionBasisId===p.actionBasisId&&m.currency==='EGP'&&m.basis==='RAW_CONFIRMED_CLOSE'&&finite(m.price)&&m.price>0,'Raw coherent close required');const session=s.book.sessions.find(x=>x.day===m.day);required(session&&ms(event.at)>=ms(session.closeAt)+s.orders[p.parentIsin||m.isin].delaySeconds*1000+1800000,'Close not final after observation delay');s.marks[m.isin]=m;
 }
 else if(event.type==='ENDPOINT'){
  required(!s.endpoint,'Endpoint immutable');const days=s.book.sessions.filter(x=>x.day>=s.plan.entryDay);required(days.length>=126&&d.day===days[125].day,'Fixed 126-session endpoint required');required(ms(event.at)>=ms(days[125].closeAt)+Math.max(...Object.values(s.orders).map(o=>o.delaySeconds))*1000+1800000,'Endpoint close is not final');s.endpoint=valuation(s,d.day);required(s.endpoint.status==='VERIFIED_ENGINEERING','Endpoint metrics unavailable: reconcile marks/entitlements first');
 }
 else throw Error('Unsupported basket event; no discretionary/technical exits or automatic action guesses');
 required(Number.isSafeInteger(s.cashCents)&&s.cashCents>=0&&Object.values(s.orders).reduce((n,o)=>n+o.reservationCents,0)+Object.values(s.positions).filter(p=>p.quantity>0&&p.kind!=='RIGHTS').length*cents(costs(s.plan.scenario).fixedEGPPerFilledOrder)<=s.cashCents,'Basket cash/reservation invariant');s.sequence++;s.lastAt=event.at;return {state:s,result};
}
