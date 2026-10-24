import {planProgress} from './trade-plans.mjs';
import {isConfirmedBar,captureFinality,sessionPolicy} from './finality.mjs';
import {cairoDate} from './core.mjs';import {initDecisions,digest} from './decisions.mjs';
const returnPct=(p,base)=>100*(p/base-1);
export function evaluateDecision(record,allBars,metadata={},now=new Date()){
 const d=record.payload,policy=record.policy,today=cairoDate(now),decisionDay=record.decision_day;
 const bars=allBars.filter(b=>b.day>decisionDay&&isConfirmedBar(b,now)).sort((a,b)=>a.day.localeCompare(b.day));
 const first=bars[0],last=bars.at(-1),holidays=new Set((metadata.symbolInfo?.session_holidays||'').split(',')),gaps=[];
 for(let t=Date.parse(decisionDay)+86400000;t<Date.parse(today)+(captureFinality(today,now.toISOString(),metadata).confirmed?86400000:0);t+=86400000){const day=new Date(t).toISOString().slice(0,10);if(![5,6].includes(new Date(t).getUTCDay())&&!holidays.has(day.replaceAll('-',''))&&!bars.some(b=>b.day===day))gaps.push(day);}
 const quality=[];if(gaps.length)quality.push('Missing expected sessions: '+gaps.join(', '));
 if(first&&(!Number.isFinite(first.open)||first.open<=0))quality.push('Invalid baseline price');
 if(bars.some(b=>![b.open,b.high,b.low,b.close].every(v=>Number.isFinite(v)&&v>0)))quality.push('Invalid observed price');
 const capture=last?.captured_at,captureAge=(now.getTime()-Date.parse(capture))/3600000;if(last&&captureAge>policy.maxCaptureAgeHours)quality.push('Latest outcome capture is stale');
 const base=first?.open,valid=base>0&&!quality.some(x=>x.startsWith('Invalid')),horizons=policy.outcomeHorizons.map(n=>{
  if(!valid&&bars.length)return {sessions:n,status:'Needs data review',observedSessions:Math.min(bars.length,n)};
  if(bars.length<n)return {sessions:n,status:'Pending',observedSessions:Math.min(bars.length,n)};
  const path=bars.slice(0,n),end=path.at(-1),ret=returnPct(end.close,base),problem=gaps.some(day=>day<=end.day),prediction=d.prediction;
  let forecast='Not scored';if(n===prediction.horizonSessions&&prediction.direction!=='uncertain'&&!problem)forecast=(prediction.direction==='up'?ret>=prediction.hurdlePercent:ret<=-prediction.hurdlePercent)?'Met stated price forecast':'Missed stated price forecast';
  return {sessions:n,status:problem?'Needs data review':'Observed',from:first.day,through:end.day,priceReturnPercent:ret,bestHighPercent:returnPct(Math.max(...path.map(b=>b.high)),base),worstLowPercent:returnPct(Math.min(...path.map(b=>b.low)),base),forecast,decisionQuality:'Requires process review; price outcome alone is not correctness'};
 });
 const plan=d.riskPlan,levels=[];if(plan&&bars.length){const through=Number.isFinite(Date.parse(plan.expiresAt))?cairoDate(new Date(plan.expiresAt)):null;for(const b of bars.filter(b=>!through||b.day<=through)){const stop=b.low<=plan.stop,target=b.high>=plan.target;if(stop||target)levels.push({day:b.day,observation:stop&&target?'Both stop and target touched; ordering unknown':stop?'Stop level touched':'Target level touched'});}}
 const latestReturn=valid&&last?returnPct(last.close,base):null;
 return {method:policy.trackingMethod,finalityVersion:sessionPolicy.version,decisionId:record.id,action:d.action,status:quality.length?'Needs data review':!bars.length?'Awaiting future confirmed sessions':bars.length<Math.max(...policy.outcomeHorizons)?'Tracking':'Horizons observed; continuing monitoring',checkedOn:today,observedSessions:bars.length,baseline:first?{day:first.day,open:base,rule:policy.baseline}:null,latest:last?{day:last.day,close:last.close,capturedAt:capture,priceReturnPercent:latestReturn}:null,horizons,levelObservations:levels,quality,benchmarkStatus:'Matched-period EGX benchmark unavailable; no alpha claim',interpretation:latestReturn===null?'No forward outcome yet':d.action==='Watch'?'Observed price path, not an assumed entry or realized trade':latestReturn>0?'Price rose after the decision: review missed upside alongside the original evidence gaps':'Price did not rise after the decision: review downside avoided alongside the original reasoning',tradePlan:planProgress({...d,supersededForEntry:record.supersededForEntry},allBars,quality,now),limitations:policy.limitations,inputBars:bars};
}
export function monitorDecisions(db,now=new Date(),{decisionIds=null}={}){
 initDecisions(db);const result=[];
 for(const raw of db.prepare('SELECT * FROM agent_decisions ORDER BY created_at').all()){
  if(decisionIds&&!decisionIds.includes(raw.id))continue;
  const record={...raw,supersededForEntry:!!db.prepare('SELECT id FROM agent_decisions WHERE supersedes=?').get(raw.id),payload:JSON.parse(raw.payload),policy:JSON.parse(raw.policy)},stock=db.prepare('SELECT metadata FROM stocks WHERE ticker=?').get(raw.ticker),bars=db.prepare('SELECT b.*,c.captured_at,c.finality FROM bars b LEFT JOIN bar_captures c ON c.ticker=b.ticker AND c.day=b.day WHERE b.ticker=? ORDER BY b.day').all(raw.ticker);
  const outcome=evaluateDecision(record,bars,JSON.parse(stock?.metadata||'{}'),now),hash=digest(outcome),id='outcome-'+digest({decisionId:raw.id,hash});const previous=db.prepare('SELECT payload FROM decision_outcomes WHERE decision_id=? ORDER BY observed_at DESC,rowid DESC LIMIT 1').get(raw.id);
  const inserted=db.prepare('INSERT OR IGNORE INTO decision_outcomes VALUES(?,?,?,?,?)').run(id,raw.id,now.toISOString(),hash,JSON.stringify(outcome)).changes;
  if(inserted&&previous){const before=JSON.parse(previous.payload),newLevel=outcome.levelObservations.length>before.levelObservations.length,newHorizon=outcome.horizons.some((h,i)=>h.status==='Observed'&&before.horizons[i]?.status!=='Observed');if(newLevel||newHorizon||outcome.tradePlan.events.length>(before.tradePlan?.events?.length||0))db.prepare('INSERT OR IGNORE INTO research_notifications(id,created_at,ticker,queue_id,report_id,message) VALUES(?,?,?,?,?,?)').run('notification-'+id,now.toISOString(),raw.ticker,raw.queue_id,raw.report_id,`${raw.ticker}: new forward outcome for ${raw.action}. ${newLevel?'A saved level was touched; daily ordering/entry are not assumed.':newHorizon?'A planned evaluation horizon has matured.':'A saved entry/level condition was observed; no fill is assumed.'} ${outcome.tradePlan.status}. Review decision ${raw.id}.`);}
  result.push({decisionId:raw.id,ticker:raw.ticker,status:outcome.status,sessions:outcome.observedSessions,newObservation:!!inserted});
 }return result;
}

