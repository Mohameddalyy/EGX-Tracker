import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
export function entryRisk({entry,stop,target,roundTripCostFraction=0}){
 if(![entry,stop,target,roundTripCostFraction].every(Number.isFinite)||!(0<stop&&stop<entry&&entry<target)||roundTripCostFraction<0||roundTripCostFraction>1)throw Error('Invalid entry-risk scenario');
 const cost=entry*roundTripCostFraction,loss=entry-stop+cost,gain=target-entry-cost;
 return {entry,stop,target,roundTripCostFraction,lossPerShareEGP:loss,lossPercent:loss/entry*100,gainPerShareEGP:gain,rewardRisk:gain/loss,assumption:'Stop/target execution scenario; gaps can exceed this loss. Zero cost is a gross scenario, not a broker fee estimate.'};
}
export function researchReports(root){const dir=join(root,'data','research');mkdirSync(dir,{recursive:true});return readdirSync(dir).filter(n=>/^report-[a-zA-Z0-9-]+\.json$/.test(n)).sort().reverse().map(n=>{try{return JSON.parse(readFileSync(join(dir,n),'utf8'));}catch{return null;}}).filter(Boolean);}
export function sizeCandidate(p,{entry,stop,medianDailyVolume,existingExposureEGP=0,existingPortfolioRiskEGP=0}){
 const fields=['capitalEGP','availableCashEGP','riskPerTradeFraction','maxPositionFraction','maxPortfolioRiskFraction','maxDailyVolumeParticipation','estimatedRoundTripCostFraction'];
 if(fields.some(k=>!Number.isFinite(p[k])||p[k]<0)||p.capitalEGP<=0)return {shares:null,reason:'Portfolio value, cash, costs and user-approved risk limits are required.'};
 if(fields.filter(k=>k.endsWith('Fraction')||k==='maxDailyVolumeParticipation').some(k=>p[k]>1)||!Number.isFinite(entry)||!Number.isFinite(stop)||!(0<stop&&stop<entry)||!Number.isFinite(medianDailyVolume)||medianDailyVolume<=0||![existingExposureEGP,existingPortfolioRiskEGP].every(n=>Number.isFinite(n)&&n>=0))throw Error('Invalid sizing inputs');
 const riskPerShare=entry-stop+entry*p.estimatedRoundTripCostFraction;
 const budget=Math.max(0,Math.min(p.capitalEGP*p.riskPerTradeFraction,p.capitalEGP*p.maxPortfolioRiskFraction-existingPortfolioRiskEGP));
 const caps={risk:Math.floor(budget/riskPerShare),cash:Math.floor(p.availableCashEGP/(entry*(1+p.estimatedRoundTripCostFraction))),concentration:Math.floor(Math.max(0,p.capitalEGP*p.maxPositionFraction-existingExposureEGP)/(entry*(1+p.estimatedRoundTripCostFraction))),liquidity:Math.floor(medianDailyVolume*p.maxDailyVolumeParticipation)};
 const shares=Math.max(0,Math.min(...Object.values(caps)));return {shares,caps,estimatedRiskEGP:shares*riskPerShare,estimatedOutlayEGP:shares*entry*(1+p.estimatedRoundTripCostFraction),reason:'Scenario only; full round-trip cost reserved at entry. Gap losses may exceed the stop budget. Sector/correlation and simultaneous proposals require separate portfolio review.'};
}
export function validateReport(r){
 if(!r||r.version!=='1.0'||!['readiness','research'].includes(r.type)||typeof r.id!=='string'||!/^report-[a-zA-Z0-9-]+$/.test(r.id)||!Number.isFinite(Date.parse(r.createdAt))||typeof r.summary!=='string'||!r.summary.trim()||!Array.isArray(r.sources)||!Array.isArray(r.assessments)||!Array.isArray(r.limitations))throw Error('Invalid research report');
 const ids=new Set();for(const s of r.sources){if(!s.id||ids.has(s.id)||typeof s.title!=='string'||!Number.isFinite(Date.parse(s.accessedAt)))throw Error('Invalid source');const url=new URL(s.url);if(!['https:','http:'].includes(url.protocol))throw Error('Invalid source URL');ids.add(s.id);}
 for(const a of r.assessments){if(!/^[A-Z][A-Z0-9-]{1,23}$/.test(a.ticker)||!['Insufficient evidence','Watch','Conditional setup','Review holding','Avoid setup'].includes(a.verdict)||typeof a.rationale!=='string'||!Array.isArray(a.sourceIds)||!a.sourceIds.length||a.sourceIds.some(x=>!ids.has(x)))throw Error('Assessment requires known sources and a valid verdict');
  for(const k of ['fundamentals','technicals','catalysts','risks','invalidation','positionReview','entryConditions'])if(typeof a[k]!=='string'||!a[k].trim())throw Error('Missing analysis section: '+k);
  if(a.sizing?.shares!=null)throw Error('Store numerical sizing separately using the deterministic sizeCandidate function and approved inputs, not model-written report fields');
 }
 if(r.type==='research'&&(!r.assessments.length||!r.contextId))throw Error('Research report requires a context snapshot');return r;
}
export function saveReport(root,r){validateReport(r);const dir=join(root,'data','research');mkdirSync(dir,{recursive:true});
 if(r.type==='research'){
  if(!/^context-[a-zA-Z0-9-]+$/.test(r.contextId))throw Error('Invalid context ID');
  const context=JSON.parse(readFileSync(join(dir,r.contextId+'.json'),'utf8'));
  for(const a of r.assessments){const s=context.stocks.find(s=>s.ticker===a.ticker);if(!s)throw Error('Ticker not in captured context');if(a.verdict==='Conditional setup'&&(!s.latest||!s.retrieved_at||Date.parse(r.createdAt)-Date.parse(s.retrieved_at)>86400000))throw Error('Stale or missing history cannot support a timely conditional setup');}
 }
 writeFileSync(join(dir,r.id+'.json'),JSON.stringify(r,null,2),{flag:'wx'});}
