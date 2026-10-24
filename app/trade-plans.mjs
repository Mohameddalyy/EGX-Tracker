import {indicators} from './core.mjs';import {isConfirmedBar,cairoDate} from './finality.mjs';import {priceLevels} from './levels.mjs';import {entryRisk} from './research.mjs';import {isDeepStrictEqual} from 'node:util';
export const planPolicy={version:'priced-plan-1.0',stopBufferATR:.5,entryWidthATR:.25,minRewardRisk:2,minRelativeVolume:1,methodNote:'Experimental local geometry and filters, not a validated strategy or a probability of profit.'};
export function tickRound(price,info,direction){
 let tiers;
 if(info?.variable_tick_size){const parts=info.variable_tick_size.split(/\s+/).map(Number);if(parts.length%2!==1||parts.some(n=>!Number.isFinite(n)||n<=0))throw Error('Unsupported tick-size metadata');tiers=[{from:0,step:parts[0]}];for(let i=1;i<parts.length;i+=2){if(parts[i]<=tiers.at(-1).from)throw Error('Unordered tick tiers');tiers.push({from:parts[i],step:parts[i+1]});}}
 else {const step=info?.minmov/info?.pricescale;if(!Number.isFinite(step)||step<=0)throw Error('Verified tick-size metadata required');tiers=[{from:0,step}];}
 let value=price;for(let i=0;i<3;i++){const step=tiers.filter(t=>value>=t.from-1e-10).at(-1)?.step;if(!step||value<=0)throw Error('Nonpositive plan price');value=Number(((direction==='up'?Math.ceil(value/step-1e-9):Math.floor(value/step+1e-9))*step).toFixed(8));}return value;
}
export function buildTradePlan(stock,options){
 const {method,zoneIndex=0,expiresAt,costScenarioFraction,costAssumption}=options||{};
 if(!['pullback','breakout'].includes(method)||!Number.isInteger(zoneIndex)||zoneIndex<0||zoneIndex>2)throw Error('Choose a supported setup and evidence zone');
 if(stock.currency!=='EGP'||!Number.isFinite(Date.parse(stock.retrieved_at))||!Number.isFinite(Date.parse(expiresAt))||Date.parse(expiresAt)<=Date.parse(stock.retrieved_at)||typeof costAssumption!=='string'||!costAssumption.trim()||!Number.isFinite(costScenarioFraction)||costScenarioFraction<0||costScenarioFraction>1)throw Error('Fresh EGP context, expiry and explicit cost scenario required');
 const at=new Date(stock.retrieved_at),bars=stock.bars.filter(b=>isConfirmedBar(b,at)),i=indicators(bars),levels=priceLevels(bars,i.atr14,cairoDate(at),at),info=stock.metadata?.symbolInfo;
 const atr=i.atr14,z=levels[method==='pullback'?'support':'resistance'][zoneIndex];if(!z||!Number.isFinite(atr)||atr<=0)throw Error('No confirmed price structure for this setup; keep Wait');
 const up=x=>tickRound(x,info,'up'),down=x=>tickRound(x,info,'down');
 const stepAt=x=>{const next=up(x+Math.max(1e-8,x*1e-10));return next-x;};
 const low=method==='pullback'?up(z.high):up(z.high+stepAt(up(z.high))),high=down(low+planPolicy.entryWidthATR*atr),stop=down(z.low-planPolicy.stopBufferATR*atr);
 if(!(stop>0&&stop<low&&low<=high))throw Error('Price structure cannot produce a valid tick-aligned entry/stop');
 const resistance=levels.resistance.filter(r=>r.low>low);
 if(!resistance.length||resistance[0].low<=high)throw Error('Entry zone overlaps resistance or no measured target is available; keep Wait');
 const targets=resistance.slice(0,2).map((r,index)=>({label:'T'+(index+1),price:down(r.low-Math.max(1e-8,r.low*1e-10)),resistance:r}));
 if(targets.some(t=>t.price<=high))throw Error('Insufficient room below resistance');
 const target=targets[0].price,risk=entryRisk({entry:high,stop,target,roundTripCostFraction:costScenarioFraction}),gross=entryRisk({entry:high,stop,target});
 const trigger=method==='pullback'?`A later confirmed bullish daily candle must touch ${high} or lower, close within ${low}–${high}, remain above stop ${stop}, and have RV20 ≥ ${planPolicy.minRelativeVolume}.`:`A later confirmed daily candle must cross from at/below ${z.high} to a close within ${low}–${high}, remain above stop ${stop}, and have RV20 ≥ ${planPolicy.minRelativeVolume}.`;
 return {version:planPolicy.version,currency:'EGP',method,zoneIndex,asOf:levels.asOf,capturedAt:stock.retrieved_at,entry:high,entryZone:{low,high},stop,target,targets,expiresAt,costScenarioFraction,costAssumption,trigger,execution:'After confirmation, review the next session quote. Enter only within the saved zone; do not chase a gap above it. No automatic order or assumed fill.',invalidation:`Any post-decision daily low at/below ${stop} invalidates this entry setup. Cancel new entry after expiry, a target touch before entry, or material new evidence. Stops can gap.`,anchor:z,support:levels.support,resistance:levels.resistance,atr,formulas:{entry:'Anchor upper edge (plus one tick for breakout); zone extends 0.25 ATR, rounded down',stop:'Anchor lower edge minus 0.5 ATR, rounded down',targets:'One valid tick below each next resistance lower edge',risk:'Worst entry-zone price minus stop, plus entry × round-trip cost scenario',rewardRisk:'(Target minus worst entry minus cost) / (worst entry minus stop plus cost)'},metrics:{grossRiskPerShare:high-stop,grossRiskPercent:100*(high-stop)/high,grossRewardRisk:gross.rewardRisk,...risk,targets:targets.map(t=>({label:t.label,...entryRisk({entry:high,stop,target:t.price,roundTripCostFraction:costScenarioFraction})})),minimumRewardRisk:planPolicy.minRewardRisk,qualifies:risk.rewardRisk>=planPolicy.minRewardRisk},policy:planPolicy};
}
export function validateTradePlan(plan,stock){
 if(plan?.version!==planPolicy.version)throw Error('Approved setup requires a calculated priced plan');
 const computed=buildTradePlan(stock,plan);if(!isDeepStrictEqual(plan,computed))throw Error('Plan prices/evidence/calculations do not match the frozen context');
 if(!computed.metrics.qualifies)throw Error('Cost-adjusted T1 reward/risk is below the explicit 2:1 research gate; keep Wait');return computed;
}
export function planProgress(decision,bars,quality=[],now=new Date()){
 const p=decision.riskPlan;if(decision.action!=='Watch'||p?.version!==planPolicy.version)return {status:'No approved entry plan',events:[],note:'Wait/Avoid is not an instruction to buy. Missing levels are not invented.'};
 const day=cairoDate(new Date(decision.createdAt)),expiry=cairoDate(new Date(p.expiresAt)),history=bars.filter(b=>isConfirmedBar(b,now)).sort((a,b)=>a.day.localeCompare(b.day)),events=[];
 // Expiry is an instant; a daily bar on its date cannot establish intraday ordering.
 const future=history.filter(b=>b.day>day&&b.day<expiry);let invalidated=false,targetSeen=false;
 for(const b of future){const hitStop=b.low<=p.stop,hitTargets=p.targets.filter(t=>b.high>=t.price);if(hitStop){events.push({day:b.day,type:'stop',text:'Stop level touched; setup invalidated. No exit fill assumed.'});invalidated=true;}for(const t of hitTargets){events.push({day:b.day,type:t.label,text:t.label+' level touched; no exit fill assumed.'});targetSeen=true;}if(hitStop&&hitTargets.length)events.push({day:b.day,type:'ambiguous',text:'Stop and target touched on the same day; ordering unknown.'});
  const index=history.indexOf(b),rv=indicators(history.slice(0,index+1)).rv20,previous=history[index-1],inZone=b.close>=p.entryZone.low&&b.close<=p.entryZone.high;
  const trigger=inZone&&rv>=p.policy.minRelativeVolume&&(p.method==='pullback'?b.low<=p.entryZone.high&&b.close>b.open:previous&&previous.close<=p.anchor.high&&b.close>p.anchor.high);
  if(trigger&&!invalidated&&!targetSeen)events.push({day:b.day,type:'trigger',text:'Saved daily entry conditions observed. Review the next session quote; no fill assumed.'});
 }
 const latest=history.at(-1),price=latest?.close,trigger=events.filter(e=>e.type==='trigger').at(-1),expired=now.getTime()>=Date.parse(p.expiresAt);
 const position=price==null?'Unavailable':price<p.entryZone.low?'Below entry zone':price>p.entryZone.high?'Above entry zone — do not chase':'Within entry zone';
 let status=invalidated?'Invalidated — stop touched':targetSeen?'Target observed — reassess before new entry':expired?'Expired for new entry':trigger&&trigger.day===latest?.day?'Entry condition observed — next-session review':'Waiting for entry condition';
 if(quality.length)status='Data review required';if(decision.supersededForEntry)status='Superseded — no new entry';
 return {status,events,latest:latest?{day:latest.day,price,position,capturedAt:latest.captured_at,distanceToStopPercent:100*(price-p.stop)/price,targets:p.targets.map(t=>({label:t.label,price:t.price,distancePercent:100*(t.price-price)/price}))}:null,triggerDay:trigger?.day||null,expiry:p.expiresAt,note:'Daily delayed observations only. Entered/closed and P&L require your actual fills. Entry expiry does not close an existing position.'};
}
