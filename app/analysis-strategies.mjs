import {finite,requireValue,appendRecord,records,hash} from './analysis-store.mjs';
import {priceFeatures,mean,deviation} from './analysis-market.mjs';
import {tickRound} from './trade-plans.mjs';
import {readFileSync} from 'node:fs';
const implementationFiles=['analysis-strategies.mjs','analysis-market.mjs','analysis-financials.mjs','analysis-risk.mjs','analysis-store.mjs','analysis-events.mjs','analysis-macro.mjs','analysis-learning.mjs','trade-plans.mjs','finality.mjs'];
export const strategyImplementation=Object.fromEntries(implementationFiles.map(file=>[file,readFileSync(new URL(file,import.meta.url),'utf8')]));
strategyImplementation['session-policy.json']=readFileSync(new URL('../research/session-policy.json',import.meta.url),'utf8');
export const implementationDigest=hash(strategyImplementation);
export const strategyModels=[
 {id:'champion-priced-plan-1.0',family:'current',status:'frozen champion',description:'Existing analyst-approved resistance-targeted pullback/breakout; unchanged guard and execution policy'},
 {id:'baseline-momentum-1.0',family:'momentum',status:'research challenger',description:'Code-only 60-observation positive momentum with next-session entry and precommitted 5/20/60-session time exit (20 default)'},
 {id:'challenger-pullback-1.0',family:'pullback',status:'research challenger',description:'Positive 60-return, close above SMA50 and pullback within one ATR of SMA20; two-ATR stop, precommitted 5/20/60-session time exit (20 default)'},
 {id:'challenger-breakout-1.0',family:'breakout-retest',status:'research challenger',description:'Close through previous 20-observation high with volume above prior median; retest trigger, two-ATR initial stop, two-ATR trailing/time exit'},
 {id:'challenger-catalyst-1.0',family:'catalyst',status:'research challenger',description:'Explicit sourced economic catalyst plus verified thesis, sector context and liquidity; precommitted 5/20/60-session time exit (20 default) or thesis invalidation'}
];
export function researchSetups(stock,events=[],thesis=null){
 const bars=stock.bars,features=priceFeatures(bars),last=bars.at(-1),prior=bars.slice(-21,-1),sma20=bars.length>=20?mean(bars.slice(-20).map(b=>b.close)):null;
 const common=features.observations>=61&&features.atr14>0&&features.medianVolume20>0&&features.activeSessions20>=18;
 const high=prior.length?Math.max(...prior.map(b=>b.high)):null,volumeMedian=prior.map(x=>x.volume).sort((a,b)=>a-b)[Math.floor(prior.length/2)];
 const methods=strategyModels.filter(m=>m.family!=='current').map(m=>{
  const reasons=[];if(stock.currency&&stock.currency!=='EGP')reasons.push('Native USD hypothesis needs separately verified FX support');if(stock.usableForCurrentResearch===false)reasons.push('Historical conditions only; refresh confirmed evidence before a current hypothesis');if(!common)reasons.push('Insufficient history/volatility/liquidity');
  if(m.family==='momentum'&&!(features.return60>0))reasons.push('Nonpositive 60-observation momentum');
  if(m.family==='pullback'&&!(features.return60>0&&last?.close>features.sma50&&Math.abs(last.close-sma20)<=features.atr14))reasons.push('Trend/pullback conditions not observed');
  if(m.family==='breakout-retest'&&!(last?.close>high&&last.volume>volumeMedian))reasons.push('Breakout and participation not confirmed');
  if(m.family==='catalyst'&&(!events.length||!thesis||thesis.family!=='catalyst'))reasons.push('No saved sourced catalyst thesis');
  let geometry=null;if(common&&last){try{const info=stock.metadata?.symbolInfo,entryLow=tickRound(m.family==='breakout-retest'?high:last.close,info,'up'),entryHigh=tickRound(entryLow+.25*features.atr14,info,'down'),stop=tickRound(entryLow-2*features.atr14,info,'down');if(stop>0&&stop<entryLow&&entryHigh>=entryLow)geometry={entryZone:{low:entryLow,high:entryHigh},stop,stopRiskPercent:(entryHigh-stop)/entryHigh*100,target:null,exitPolicy:m.family==='breakout-retest'?'After entry: never lower the initial stop; trail at the greatest previously confirmed close since entry minus two ATR. Maximum holding period is precommitted at registration: 5, 20 or 60 sessions; default 20.':'Initial stop or precommitted holding-session close (5, 20 or 60; default 20). Catalyst thesis invalidation also triggers review.',trigger:m.family==='breakout-retest'?'Next observed session opens inside the retest zone. This is an opening-retest shadow assumption, not an intraday confirmation or execution.':'Review next-session executable quote inside the zone; no historical fill is assumed.'};else reasons.push('Invalid positive price geometry');}catch(e){reasons.push(e.message);}}
  return {...m,eligibleHypothesis:reasons.length===0,reasons,geometry,asOf:features.asOf,featureSnapshot:features,approval:'Research challenger only; cannot pass the existing Watch guard or open an experiment order'};
 });return methods;
}
export function calibration(samples,{asOf,horizonSessions,strategyId,minClusters=30}){
 const usable=samples.filter(s=>s.strategyId===strategyId&&s.horizonSessions===horizonSessions&&s.maturedAt<asOf&&s.registeredAt<=s.signalAt&&finite(s.netReturn)&&!s.quality?.length),clusters=new Map();
 for(const s of usable){const a=clusters.get(s.signalAt.slice(0,10))||[];a.push(s.netReturn);clusters.set(s.signalAt.slice(0,10),a);}
 const daily=[...clusters.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([,x])=>mean(x));if(daily.length<minClusters)return {status:'Uncalibrated: insufficient distinct decision dates',sampleSize:usable.length,clusters:daily.length,meanNetReturn:null,confidenceInterval95:null,probabilityOfProfit:null};
 const center=mean(daily),n=daily.length,lag=Math.min(horizonSessions-1,n-2);let longRun=daily.reduce((sum,x)=>sum+(x-center)**2,0)/n;
 for(let k=1;k<=lag;k++){const gamma=daily.slice(k).reduce((sum,x,i)=>sum+(x-center)*(daily[i]-center),0)/n;longRun+=2*(1-k/(lag+1))*gamma;}
 const se=Math.sqrt(Math.max(0,longRun)/n);return {status:'Exploratory date-cluster estimate; not a calibrated causal edge',sampleSize:usable.length,clusters:daily.length,meanNetReturn:center,confidenceInterval95:[center-1.96*se,center+1.96*se],probabilityOfProfit:usable.filter(s=>s.netReturn>0).length/usable.length,method:'Equal-weight decision-date clusters; Newey–West overlap adjustment through horizon minus one and normal approximation. Sparse dates, regimes and multiple testing still require separate validation; historical hit frequency is not a calibrated future probability.'};
}
export function purgedWalkForward(days,{trainSessions=120,testSessions=20,horizonSessions=20}={}){
 requireValue([trainSessions,testSessions,horizonSessions].every(n=>Number.isInteger(n)&&n>0),'Positive training/test/purge lengths required');const folds=[];
 for(let start=trainSessions+horizonSessions;start+testSessions<=days.length;start+=testSessions){folds.push({train:days.slice(start-horizonSessions-trainSessions,start-horizonSessions),purged:days.slice(start-horizonSessions,start),test:days.slice(start,start+testSessions),reason:'Training labels must finish strictly before the test decision window'});}return folds;
}
export function registerTrial(db,t,now=new Date()){
 requireValue(typeof t.name==='string'&&t.name.trim()&&Array.isArray(t.tickers)&&t.tickers.length>0&&new Set(t.tickers).size===t.tickers.length&&t.tickers.every(x=>/^[A-Z][A-Z0-9-]{1,23}$/.test(x)),'Named point-in-time universe required');
 requireValue(t.capitalEGP===20000&&t.feePerOrderEGP===5&&finite(t.slippageFraction)&&t.slippageFraction>=0&&t.slippageFraction<1,'Explicit authorized hypothetical capital, fee and slippage assumptions required');
 requireValue(typeof t.hypothesis==='string'&&t.hypothesis.trim()&&typeof t.informationCutoff==='string'&&Date.parse(t.informationCutoff)<=+now&&typeof t.universeEvidence==='string'&&t.universeEvidence.trim(),'Hypothesis, cutoff and universe provenance required');
 const ids=t.modelIds||strategyModels.map(m=>m.id);requireValue(ids.length>=2&&new Set(ids).size===ids.length&&ids.every(id=>strategyModels.some(m=>m.id===id)),'Known champion/challenger versions required');
 const implementation=appendRecord(db,'implementation',{implementationDigest,sources:strategyImplementation,scope:'Strategy evaluation, market feature and tick/finality calculation source snapshot; original input dossier is frozen separately'},now);
 return appendRecord(db,'trial',{...t,implementationId:implementation.id,implementationDigest,modelIds:ids,registeredAt:now.toISOString(),rules:strategyModels.filter(m=>ids.includes(m.id)),status:'Prospective shadow comparison; no order authority',rulesDigest:hash([t,ids,strategyModels,implementationDigest])},now);
}
export function registerForecast(db,f,now=new Date()){
 const trial=records(db,'trial',null,now).find(t=>t.recordId===f.trialId);
 requireValue(!records(db,'forecast',f.ticker,now).some(x=>x.trialId===f.trialId&&x.modelId===f.modelId&&x.horizonSessions===f.horizonSessions),'One immutable forecast per trial/ticker/model/horizon; retries cannot select a different result');
 requireValue(trial&&trial.tickers.includes(f.ticker)&&trial.modelIds.includes(f.modelId)&&[5,20,60].includes(f.horizonSessions),'Forecast must match a frozen trial/model/universe');
 requireValue(f.action==='observe'||f.action==='conditional-long','Known research action required');
 requireValue(f.registeredAt===undefined&&typeof f.rationale==='string'&&f.rationale.trim()&&f.currency==='EGP'&&f.evidenceDigest&&Date.parse(f.informationCutoff)<=Date.parse(trial.informationCutoff)&&Date.parse(f.informationCutoff)<=+now,'Forecast needs dated matching evidence and rationale; registration time is assigned by the system');
 requireValue(f.action!=='conditional-long'||f.entryZone&&f.entryZone.low>0&&f.entryZone.high>=f.entryZone.low&&f.stop>0&&f.stop<f.entryZone.low&&['time','trailing','target'].includes(f.exitMethod),'Precommitted entry/stop/exit required');
 if(f.exitMethod==='target')requireValue(f.target>f.entryZone.high,'Target must exceed the entry zone');
 if(f.exitMethod==='trailing')requireValue(f.atrAtDecision>0,'Trailing exit requires precommitted volatility');
 return appendRecord(db,'forecast',{...f,registeredAt:now.toISOString(),status:'Shadow hypothesis; original retained',modelRulesDigest:trial.rulesDigest},now);
}
export function evaluateForecast(f,bars,trial){
 if(trial.implementationDigest&&trial.implementationDigest!==implementationDigest)return {status:'Blocked: registered calculation version differs; review the archived implementation',netReturn:null};
 const signalDay=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(f.registeredAt));
 const future=bars.filter(b=>b.day>signalDay&&Date.parse(b.captured_at)>=Date.parse(f.registeredAt));
 if(f.action==='observe')return {status:'Observation only',observedSessions:future.length,netReturn:null};
 if(!future.length)return {status:'Awaiting a future observed session',netReturn:null};
 const entry=future[0];if(entry.open<f.entryZone.low||entry.open>f.entryZone.high)return {status:'Unfilled: next observed open outside precommitted zone',netReturn:null};
 const buy=entry.open*(1+trial.slippageFraction);if(buy>f.entryZone.high||buy<=f.stop)return {status:'Unfilled after adverse entry friction',netReturn:null};
 const quantity=Math.floor((trial.capitalEGP-trial.feePerOrderEGP)/buy);if(quantity<=0)return {status:'Insufficient hypothetical cash',netReturn:null};
 let stop=f.stop,peak=buy,exit=null,reason=null,quality=[],exitIndex=-1;
 for(let i=0;i<Math.min(f.horizonSessions,future.length);i++){const b=future[i];exitIndex=i;if(b.low<=stop){exit=Math.min(b.open,stop)*(1-trial.slippageFraction);reason='Initial/trailing stop scenario';if(f.exitMethod==='target'&&b.high>=f.target)quality.push('Stop and target touched on one daily bar; stop-first assumption');break;}if(f.exitMethod==='target'&&b.high>=f.target){exit=f.target*(1-trial.slippageFraction);reason='Precommitted target scenario';break;}peak=Math.max(peak,b.close);if(f.exitMethod==='trailing'&&f.atrAtDecision>0)stop=Math.max(stop,peak-2*f.atrAtDecision);if(i===f.horizonSessions-1){exit=b.close*(1-trial.slippageFraction);reason='Precommitted time exit';}}
 if(exit===null)return {status:'Immature horizon',observedSessions:future.length,netReturn:null};
 const used=future.slice(0,exitIndex+1),holidays=new Set(f.holidays||[]),dates=[signalDay,...used.map(b=>b.day)];
 for(let i=1;i<dates.length;i++)for(let day=Date.parse(dates[i-1])+86400000;day<Date.parse(dates[i]);day+=86400000){const date=new Date(day);if(![5,6].includes(date.getUTCDay())&&!holidays.has(date.toISOString().slice(0,10)))quality.push('Unexplained session gap '+date.toISOString().slice(0,10));}
 // Daily bars cannot prove participation/fills; score this only as a distinct daily shadow scenario.
 if(used.some(b=>!(b.volume>0)))quality.push('Zero/missing volume');
 const pnl=quantity*(exit-buy)-2*trial.feePerOrderEGP,mae=Math.min(0,...used.map(b=>b.low/buy-1)),mfe=Math.max(0,...used.map(b=>b.high/buy-1));
 return {status:'Daily shadow scenario observed',netReturn:pnl/trial.capitalEGP,netPnl:pnl,maxAdverseExcursion:mae,maxFavourableExcursion:mfe,entryGapFraction:entry.open/f.entryZone.low-1,holdingSessions:used.length,quantity,entry:buy,exit,exitDay:used.at(-1)?.day||null,reason,fees:2*trial.feePerOrderEGP,quality,observedSessions:used.length,interpretation:'Full-capital isolated signal comparison, not the risk-sized paper execution engine. Daily stop assumptions and revised histories are limitations; no actual fill inferred.'};
}
