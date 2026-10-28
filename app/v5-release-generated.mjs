// Fixed-seed invariant tests, not return optimization or market-performance evidence.
import assert from 'node:assert/strict';
import {initialState,transition} from './v5/execution.mjs';
import {hash} from './v5/contract.mjs';
import {executionFixture,acceptance,minuteFixture,fullProposal,fixtureSource,acceptAt} from './v5/execution-fixtures.mjs';
import {roundTick} from './v5/math.mjs';
import {feeCents,productCents} from './v5/money.mjs';
export function generatedCases(count=1000,seed=20261023){
 let random=seed>>>0;const next=()=>{random^=random<<13;random^=random>>>17;random^=random<<5;return random>>>0;};
 const fixtures=new Map(),cases=[];for(const v of ['B1','FULL'])for(const scenario of ['base','stress'])fixtures.set(v+scenario,executionFixture(v,scenario));
 for(let i=0;i<count;i++){
  const draw=next(),variant=next()%2?'FULL':'B1',scenario=next()%2?'base':'stress',f=fixtures.get(variant+scenario),kind=i%10,events=[],price=(6900+next()%80)/100,delayExtraSeconds=next()%302,processingSeconds=next()%62;
  // Independent integer-cent oracle across seeded piecewise tick boundaries.
  const boundary=1000+(next()%5)*100,step=[5,10,25][next()%3],rawMills=boundary*10-30+next()%61,bands=[{from:0,to:boundary/100,tick:.01},{from:boundary/100,to:null,tick:step/100}];
  const legal=c=>c<boundary||c%step===0;let lo=Math.floor(rawMills/10),hi=Math.ceil(rawMills/10);while(!legal(lo))lo--;while(!legal(hi))hi++;assert.equal(roundTick(rawMills/1000,bands,'floor'),lo/100);assert.equal(roundTick(rawMills/1000,bands,'ceil'),hi/100);let state=initialState(f.config);
  const run=(type,data,at)=>{const e={id:'case-'+i+'-'+events.length,type,data,at},out=transition(state,e);events.push(e);state=out.state;return out;};
  run('OPEN_DAY',{book:f.book},'2026-10-25T06:40:00Z');run('SET_PAUSE',{paused:false,reason:'Synthetic generated case'},'2026-10-25T06:41:00Z');
  const proposal=variant==='FULL'?{...fullProposal,maxCashAllocationEGP:1000+draw%99001}:{};
  const accepted=acceptance(f,state,proposal,'generated');let rejected=false,reason=null;
  if(kind===1)accepted.decision.execution.quantity+=1+draw%5;
  if(kind===2)accepted.bundle={...f.bundle,preflight:{...f.bundle.preflight,isin:'EG9999999999'}};
  if(kind===3)accepted.decision.controlValidation.checks[draw%accepted.decision.controlValidation.checks.length].passed=false;
  if([1,2,3].includes(kind)){const before=hash(state);assert.throws(()=>transition(state,{id:'bad',type:'SUBMIT',data:accepted,at:acceptAt}));assert.equal(hash(state),before);rejected=true;reason=['','quantity','identity','immutable-control'][kind];}
  else {
   run('SUBMIT',accepted,acceptAt);const q=state.orders.generated.quantity;assert(Number.isInteger(q)&&q>0);assert(state.orders.generated.reservationCents<=state.cashCents);
   if(kind===4){assert.throws(()=>transition(state,{id:'backdated',type:'TICK',data:{},at:'2026-10-25T06:40:00Z'}));reason='chronology';}
   else if(kind===5){run('TICK',{},'2026-10-25T07:30:00Z');assert.equal(state.orders.generated.status,'EXPIRED_PENDING_RECONCILIATION');assert(state.orders.generated.reservationCents>0);run('TICK',{},'2026-10-25T07:51:01Z');assert.equal(state.orders.generated.status,'NO_FILL_EVIDENCE');assert.equal(state.orders.generated.reservationCents,0);reason='reconciliation';}
   else {
    const change=kind===6?{halted:true}:kind===7?{volume:1+draw%50}:kind===8?{confirmed:false}:kind===9?{isin:'EG9999999999'}:{low:68,volume:1000000+draw%100000};
    const bar=minuteFixture(f.isin,'2026-10-25','07:'+String(1+next()%29).padStart(2,'0')+':00',{open:price,close:price,high:71,low:68,...change});if(kind===0){bar.receivedAt=new Date(Date.parse(bar.receivedAt)+delayExtraSeconds*1000).toISOString();bar.availableAt=bar.receivedAt;}const observedAt=new Date(Date.parse(bar.receivedAt)+processingSeconds*1000).toISOString();run('MINUTE',{bar,book:f.book,dailyVolume:{...fixtureSource,isin:f.isin,forDay:'2026-10-25',basis:'PRIOR_MEDIAN20_RAW_SHARES',value:1000000}},observedAt);
    if(kind!==0||delayExtraSeconds>300||processingSeconds>60){assert.equal(Object.keys(state.positions).length,0);assert.equal(state.cashCents,10000000);}
    for(const p of Object.values(state.positions)){assert.equal(p.quantity,q);assert.equal(state.cashCents,10000000-productCents(q,p.entry)-feeCents(q,p.entry,scenario));assert(Math.abs(Math.round(p.entry*100)-p.entry*100)<1e-8);assert.equal(state.orders.generated.reservationCents,0);}
   }
  }
  let replay=initialState(f.config);for(const e of events)replay=transition(replay,e).state;assert.equal(hash(replay),hash(state));assert(state.cashCents>=0);const reserved=Object.values(state.orders).filter(o=>!o.resolved).reduce((n,o)=>n+o.reservationCents,0)+Object.values(state.positions).filter(p=>p.status!=='CLOSED').reduce((n,p)=>n+p.exitFeeReserveCents,0);assert(reserved<=state.cashCents);
  cases.push({id:i+1,draw,kind,variant,scenario,proposal,price,delayExtraSeconds,processingSeconds,tickOracle:{boundary,step,rawMills,lo,hi},filled:Object.keys(state.positions).length,quantity:state.orders.generated?.quantity??null,materialInputHash:hash({variant,scenario,kind,proposal,price,delayExtraSeconds,processingSeconds,rawMills,boundary,step}),rejected,reason,stateHash:hash(state),eventsHash:hash(events),eventCount:events.length,cashCents:state.cashCents,reservedCents:reserved,status:'PASS'});
 }
 const coverage={};for(const c of cases){const k=c.kind+':'+c.variant+':'+c.scenario;coverage[k]=(coverage[k]||0)+1;}if(count===1000){assert.equal(Object.keys(coverage).length,40);assert(cases.some(c=>c.variant==='FULL'&&c.filled));assert(cases.some(c=>c.variant==='B1'&&c.filled));assert.equal(new Set(cases.map(c=>c.materialInputHash)).size,1000);}
 return {coverage,materialInputUniqueness:new Set(cases.map(c=>c.materialInputHash)).size,scope:'SYNTHETIC_INVARIANTS_NOT_PERFORMANCE',seed,count,passed:cases.length,failed:0,selection:'Fixed index categories and PRNG draws, no selection on returns',cases};
}
