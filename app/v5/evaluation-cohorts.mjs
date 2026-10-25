import {hash,required,finite,timestamp,variants} from './contract.mjs';
import {evaluateUniverse} from './signals.mjs';

const dayPattern=/^\d{4}-\d{2}-\d{2}$/;
const validPoint=(p,cutoff)=>p&&dayPattern.test(p.day)&&p.verified===true&&p.confirmed===true&&p.sourceId&&/^[a-f0-9]{64}$/.test(p.sourceHash)&&timestamp(p.availableAt)&&Date.parse(p.availableAt)>=Date.parse(p.day)&&Date.parse(p.availableAt)<=Date.parse(cutoff)&&finite(p.close)&&p.close>0;
function uniqueDays(points){required(Array.isArray(points)&&new Set(points.map(p=>p.day)).size===points.length,'Duplicate/invalid dated observations');return new Map(points.map(p=>[p.day,p]));}

// Rebuild the admitted screen, not a caller-selected shortlist. Every row survives.
export function opportunityCohort(signalInput,dispositions=[]) {
  const evaluation=evaluateUniverse(signalInput),seen=new Set();
  const rows=evaluation.rows.map(row=>{
    const id=hash({inputHash:evaluation.inputHash,signalDay:evaluation.signalDay,isin:row.isin,variantId:row.variantId});
    return {id,isin:row.isin,variantId:row.variantId,signalDay:evaluation.signalDay,mechanicallyEligible:row.mechanicallyEligible===true,status:row.status,gates:row.gates,rank:row.rank??null,dispositions:[]};
  });
  const byId=new Map(rows.map(r=>[r.id,r]));
  for(const d of dispositions) {
    required(byId.has(d.opportunityId)&&typeof d.id==='string'&&!seen.has(d.id)&&timestamp(d.at)&&Date.parse(d.at)>=Date.parse(evaluation.cutoffAt),'Unknown opportunity, duplicate disposition or retroactive decision');
    required(['WAIT','AVOID','REJECTED','AWAITING_RESEARCH','BLOCKED','APPROVED','UNFILLED','EXPIRED','FILLED','SUPERSEDED'].includes(d.status)&&typeof d.reason==='string'&&d.reason.trim()&&typeof d.evidenceHash==='string'&&/^[a-f0-9]{64}$/.test(d.evidenceHash),'Sourced disposition/reason required');
    if(d.supersedes)required(byId.get(d.opportunityId).dispositions.some(x=>x.id===d.supersedes),'Superseding decision must reference retained same-opportunity history');
    const prior=byId.get(d.opportunityId).dispositions.at(-1);required(!prior||Date.parse(d.at)>=Date.parse(prior.at),'Disposition history must be chronological');
    seen.add(d.id);byId.get(d.opportunityId).dispositions.push(structuredClone(d));
  }
  const counts=Object.fromEntries(Object.keys(variants).map(v=>{
    const rs=rows.filter(r=>r.variantId===v),eligible=rs.filter(r=>r.mechanicallyEligible);
    return [v,{screened:rs.length,mechanicallyEligible:eligible.length,eligibleWithDisposition:eligible.filter(r=>r.dispositions.length).length,unfinished:eligible.filter(r=>!r.dispositions.length).length,firstFailingGate:rs.reduce((a,r)=>{const g=r.gates?.find(g=>['FAIL','BLOCKED'].includes(g.status));if(g)a[g.id]=(a[g.id]||0)+1;return a;},{}),latestDispositions:rs.reduce((a,r)=>{const s=r.dispositions.at(-1)?.status||'UNREVIEWED';a[s]=(a[s]||0)+1;return a;},{})}];
  }));
  return {inputHash:evaluation.inputHash,signalDay:evaluation.signalDay,cutoffAt:evaluation.cutoffAt,rows,counts,limitation:'Screen coverage is not substantive company research; no financial performance inferred from dispositions.'};
}

export function forecastOutcomes({anchor,sessions,points,cutoffAt}) {
  required(timestamp(cutoffAt)&&dayPattern.test(anchor?.day)&&validPoint(anchor,anchor.committedAt)&&anchor.basis==='ADJUSTED_CLOSE'&&anchor.adjustmentBasisId,'Original confirmed signal-close anchor with commit time required');
  required(Date.parse(anchor.committedAt)<=Date.parse(cutoffAt),'Outcome cutoff precedes forecast');
  required(sessions.every((s,i)=>s.verified===true&&dayPattern.test(s.day)&&(!i||s.day>sessions[i-1].day)),'Ordered unique verified exchange sessions required');
  const index=sessions.findIndex(s=>s.day===anchor.day);required(index>=0,'Anchor session absent');const map=uniqueDays(points);
  return [5,20,60].map(horizon=>{
    const day=sessions[index+horizon]?.day;
    if(!day||day>cutoffAt.slice(0,10))return {horizon,status:'IMMATURE',returnFraction:null};
    const point=map.get(day);
    if(!validPoint(point,cutoffAt)||point.basis!=='ADJUSTED_CLOSE'||point.adjustmentBasisId!==anchor.adjustmentBasisId)return {horizon,day,status:'CENSORED_MISSING_OR_INCOHERENT_PRICE',returnFraction:null};
    return {horizon,day,status:'MATURE',returnFraction:point.close/anchor.close-1,anchorHash:hash(anchor),outcomeHash:hash(point),basis:'Original forecast signal close, not trade fill'};
  });
}

export function benchmarkComparison({baselineDay,sessions,portfolio,benchmarks,cutoffAt,startingCapitalCents=10000000,dividendsReconciled=false}) {
  required(dayPattern.test(baselineDay)&&timestamp(cutoffAt)&&startingCapitalCents===10000000,'Frozen capital, baseline and cutoff required');
  required(sessions.length>=2&&sessions[0].day===baselineDay&&sessions.every((s,i)=>s.verified&&dayPattern.test(s.day)&&(!i||s.day>sessions[i-1].day)),'Verified session sequence must start with previous-session close');
  const ps=uniqueDays(portfolio),days=sessions.slice(1).map(s=>s.day);
  required(new Set(benchmarks.map(b=>b.symbol)).size===benchmarks.length&&benchmarks.every(b=>['EGX30','EGX70EWI'].includes(b.symbol)),'Only unique registered benchmark identities accepted');
  const result=['EGX30','EGX70EWI'].map(symbol=>{
    const b=benchmarks.find(x=>x.symbol===symbol),map=uniqueDays(b?.points||[]),base=map.get(baselineDay);
    const aligned=days.map(day=>{
      const p=ps.get(day),end=map.get(day),valid=b?.basis==='PRICE_INDEX'&&validPoint(base,cutoffAt)&&validPoint(end,cutoffAt)&&base.basisId&&base.basisId===end.basisId&&p?.status==='VERIFIED'&&finite(p.equityCents)&&p.equityCents>=0&&day<=cutoffAt.slice(0,10);
      return {day,status:valid?'ALIGNED':'MISSING_OR_INCOMPARABLE',indexReturnFraction:valid?end.close/base.close-1:null,portfolioReturnFraction:valid?p.equityCents/startingCapitalCents-1:null,excessReturnFraction:valid?p.equityCents/startingCapitalCents-end.close/base.close:null,portfolioStateHash:p?.stateHash??null,indexEvidenceHash:valid?hash({base,end}):null};
    });
    return {symbol,basis:'PRICE_INDEX',baselineDay,aligned,missingDays:aligned.filter(p=>p.status!=='ALIGNED').map(p=>p.day),status:aligned.every(p=>p.status==='ALIGNED')?'COMPLETE':'INCOMPLETE',interpretation:'Index context, not an executable fee-free basket or risk-adjusted alpha',dividendComparability:dividendsReconciled?'Portfolio dividend contribution must be separately reported':'UNVERIFIED_ENTITLEMENTS_NO_TOTAL_RETURN_CLAIM'};
  });
  return {indexes:result,cash:{returnFraction:0,basis:'Idle EGP cash, zero interest; no inflation adjustment'},buyAndHold:{status:'BLOCKED_AMENDMENT_REQUIRED',reason:'No pre-outcome selected attainable basket registered'}};
}

export function operationalCoverage(expected,observed) {
  required(new Set(expected.map(x=>x.id)).size===expected.length&&new Set(observed.map(x=>x.id)).size===observed.length,'Unique checkpoint IDs required');
  required(observed.every(x=>expected.some(e=>e.id===x.id)),'Unregistered checkpoint');
  const rows=expected.map(e=>{
    required(timestamp(e.dueAt)&&finite(e.hardDeadlineMinutes)&&e.hardDeadlineMinutes>0,'Checkpoint deadline required');
    const o=observed.find(x=>x.id===e.id);
    if(!o)return {id:e.id,status:'MISSING'};
    required(timestamp(o.startedAt)&&timestamp(o.finishedAt)&&Date.parse(o.finishedAt)>=Date.parse(o.startedAt),'Invalid checkpoint timing');
    const minutesLate=(Date.parse(o.startedAt)-Date.parse(e.dueAt))/60000,durationMinutes=(Date.parse(o.finishedAt)-Date.parse(o.startedAt))/60000;
    return {id:e.id,status:minutesLate<=5&&durationMinutes<=e.hardDeadlineMinutes&&o.reportDelivered===true?'PASS':'FAIL',minutesLate,durationMinutes,reportDelivered:o.reportDelivered===true};
  });
  return {expected:expected.length,observed:observed.length,rows,status:!expected.length?'INCONCLUSIVE':rows.every(r=>r.status==='PASS')?'PASS':'FAIL'};
}
