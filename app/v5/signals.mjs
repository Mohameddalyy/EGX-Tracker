import {plan,planHash,engineVersion,variant,hash,required,finite,timestamp,nonempty} from './contract.mjs';
import {metrics,turnover,percentile,median,roundTick,tickSize,validTick} from './math.mjs';

function sourceIndex(sources,cutoff){
 const map=new Map();for(const s of sources||[]){required(nonempty(s.id)&&!map.has(s.id)&&/^[a-f0-9]{64}$/.test(s.sha256)&&timestamp(s.availableAt),'Unique dated, hashed source evidence required');map.set(s.id,s);}
 return id=>{const s=map.get(id);required(s&&Date.parse(s.availableAt)<=Date.parse(cutoff),'Source unavailable at cutoff: '+id);return s;};
}
export function calendarAt(input,day){
 required(timestamp(input.cutoffAt)&&/^\d{4}-\d{2}-\d{2}$/.test(day),'Explicit cutoff and signal day required');const getSource=sourceIndex(input.sources,input.cutoffAt),all=input.sessions;
 required(Array.isArray(all)&&all.length>0,'Verified exchange session calendar required');let previous='';
 for(const s of all){required(s.day>previous&&/^\d{4}-\d{2}-\d{2}$/.test(s.day)&&timestamp(s.closeAt)&&s.closeAt.startsWith(s.day)&&s.verified===true,'Ordered verified session closes required');previous=s.day;getSource(s.sourceId);}
 const sessions=all.filter(s=>s.day<=day);required(sessions.at(-1)?.day===day,'Signal day absent from verified calendar');return {sessions,getSource};
}
function instrumentAdmission(stock,input,day,getSource){
 const i=stock.instrument;required(nonempty(i?.ticker)&&/^EG[A-Z0-9]{10}$/.test(i.isin||'')&&nonempty(i.sector),'Ticker, ISIN and sector identity required');
 required(i.verified===true&&i.exchange==='EGX'&&i.currency==='EGP'&&i.kind==='PRIMARY_ORDINARY_COMMON'&&i.tradable===true,'Verified tradable EGP ordinary equity required');
 required(i.effectiveFrom<=day&&(!i.effectiveThrough||i.effectiveThrough>=day),'Identity/trading status outside effective dates');getSource(i.sourceId);
 const r=stock.rules;required(r?.verified===true&&r.effectiveFrom<=day&&(!r.effectiveThrough||r.effectiveThrough>=day),'Effective verified tick rules required');getSource(r.sourceId);tickSize(1,r.bands);
 const a=stock.adjustment;required(a?.verified===true&&nonempty(a.basisId)&&a.reviewedThrough>=day&&a.unresolvedActions===false,'Coherent reviewed action basis required');getSource(a.sourceId);
 required(finite(stock.delaySeconds)&&stock.delaySeconds>=0,'Actual feed delay required');
}
export function admitSeries(stock,input,day=input.signalDay,{benchmark=false,window=261}={}){
 const {sessions,getSource}=calendarAt(input,day);if(!benchmark)instrumentAdmission(stock,input,day,getSource);
 else{required(stock?.symbol==='EGX:EGX30'&&stock.verified===true&&nonempty(stock.basisId),'Verified EGX30 series identity/basis required');getSource(stock.sourceId);required(finite(stock.delaySeconds)&&stock.delaySeconds>=0,'Benchmark delay required');}
 required(Number.isInteger(window)&&window>=261,'At least 261 sessions in requested window');const expected=sessions.slice(-window);required(expected.length===window,'261 verified exchange sessions required');const map=new Map();
 for(const b of stock.bars||[]){if(b.day>day)continue;required(!map.has(b.day),'Duplicate selected daily vintage '+b.day);map.set(b.day,b);}
 const bars=expected.map(s=>{const b=map.get(s.day);required(!!b,'Missing required session '+s.day);required(timestamp(b.capturedAt)&&Date.parse(b.capturedAt)<=Date.parse(input.cutoffAt)&&Date.parse(b.capturedAt)>=Date.parse(s.closeAt)+(stock.delaySeconds+1800)*1000,'Unavailable/provisional daily capture '+s.day);getSource(b.sourceId);
 required(b.confirmed===true&&['open','high','low','close'].every(k=>finite(b[k])&&b[k]>0)&&b.low<=Math.min(b.open,b.close)&&b.high>=Math.max(b.open,b.close),'Invalid daily OHLC '+s.day);
 required(b.basisId===(benchmark?stock.basisId:stock.adjustment.basisId),'Action basis discontinuity '+s.day);
 if(!benchmark){const raw=b.raw;required(finite(b.volume)&&b.volume>=0&&raw&&['open','high','low','close'].every(k=>finite(raw[k])&&raw[k]>0)&&finite(raw.volume)&&raw.volume>=0&&raw.low<=Math.min(raw.open,raw.close)&&raw.high>=Math.max(raw.open,raw.close),'Missing/invalid raw or adjusted volume/price '+s.day);
 required(finite(b.priceFactor)&&b.priceFactor>0&&finite(b.volumeFactor)&&b.volumeFactor>0,'Verified raw/action-adjusted conversion required');
 for(const k of ['open','high','low','close'])required(Math.abs(b[k]-raw[k]*b.priceFactor)<=1e-9*Math.max(1,b[k]),'Price conversion mismatch '+s.day);
 required(Math.abs(b.volume-raw.volume*b.volumeFactor)<=1e-9*Math.max(1,b.volume),'Share conversion mismatch '+s.day);
 if(b.volume===0)required(b.officialNoTrade===true&&b.noTradeSourceId,'Zero volume requires official no-trade evidence');if(b.noTradeSourceId)getSource(b.noTradeSourceId);
 if(b.turnoverEGP!==undefined){required(finite(b.turnoverEGP)&&b.turnoverEGP>=0,'Invalid actual turnover');getSource(b.turnoverSourceId);}
 }
 return b;});
 if(!benchmark)for(let i=1;i<bars.length;i++)if(bars[i].volume===0)required(bars[i].close===bars[i-1].close,'Official no-trade close must be unchanged on coherent basis');
 return bars;
}
const gate=(id,status,reason,value=null)=>({id,status,reason,value});
function base(stock,input,day){
 const gates=[];let bars=null,m=null,t=null;
 try{bars=admitSeries(stock,input,day);m=metrics(bars);if(m.priorRV126.length<126){try{const days=input.sessions.filter(s=>s.day<=day&&s.day>=stock.bars[0]?.day);m.priorRV126=metrics(admitSeries(stock,input,day,{window:days.length})).priorRV126;}catch(error){m.priorRVGap=error.message;}}t=turnover(bars.slice(-20));gates.push(gate('DATA_ADMISSION','PASS','261 verified sessions, cutoff provenance and coherent price/share basis'));
 const floor=plan.universe.minMedianTurnover20EGP,lower=t.method==='VERIFIED_TRADED_VALUE'?t.value:t.lower;
 gates.push(gate('TURNOVER',lower>=floor?'PASS':t.method!=='VERIFIED_TRADED_VALUE'&&t.upper>=floor?'BLOCKED':'FAIL',lower>=floor?'Conservative liquidity floor clears':t.upper>=floor?'Proxy bounds straddle floor: review actual traded value':'Turnover below frozen floor',t));
 gates.push(gate('ACTIVE_SESSIONS',m.positiveVolume20>=18?'PASS':'FAIL','At least 18 positive-volume sessions of latest 20',m.positiveVolume20));
 gates.push(gate('ATR_FRACTION',m.atr14/m.close<=.08?'PASS':'FAIL','Fixed-window Wilder ATR / close <= 8%',m.atr14/m.close));
 const last=bars.at(-1),tick=tickSize(last.raw.close,stock.rules.bands);gates.push(gate('TICK_FRACTION',tick/last.raw.close<=.01&&validTick(last.raw.close,stock.rules.bands)?'PASS':'FAIL','Current raw close must be legal; tick / close <= 1%',tick/last.raw.close));
 }catch(e){gates.push(gate('DATA_ADMISSION','BLOCKED',e.message));}
 return {stock,bars,metrics:m,turnover:t,gates,eligible:gates.every(g=>g.status==='PASS')};
}
export function assignTiers(rows){
 required(rows.every(r=>nonempty(r.isin)&&finite(r.turnover)&&r.turnover>=0)&&new Set(rows.map(r=>r.isin)).size===rows.length,'Unique prior eligible ISINs and turnover required');
 const sorted=[...rows].sort((a,b)=>b.turnover-a.turnover||(a.isin<b.isin?-1:a.isin>b.isin?1:0));return new Map(sorted.map((r,i)=>[r.isin,{tier:Math.min(3,Math.ceil(3*(i+1)/sorted.length)),rank:i+1,population:sorted.length,turnover:r.turnover}]));
}
function identityExcluded(stock){return stock.instrument?.verified===true&&stock.instrument.currency&&stock.instrument.kind&&(stock.instrument.currency!=='EGP'||stock.instrument.kind!=='PRIMARY_ORDINARY_COMMON');}
export function evaluateUniverse(input){
 required(input?.version==='v5-signal-input-1'&&Array.isArray(input.universe),'Versioned full cohort input required');const variants=input.variantIds||plan.variants.map(v=>v.id);variants.forEach(variant);required(new Set(variants).size===variants.length,'Duplicate variant');
 let sessions;try{({sessions}=calendarAt(input,input.signalDay));}catch(error){return {version:engineVersion,policyHash:planHash,inputHash:hash(input),signalDay:input.signalDay,cutoffAt:input.cutoffAt,cohortCount:input.universe.length,variantCount:variants.length,rows:input.universe.flatMap(s=>variants.map(id=>({variantId:id,ticker:s.instrument?.ticker,isin:s.instrument?.isin,status:id==='B0'?'CASH_CONTROL':'DATA_BLOCKED',mechanicallyEligible:false,gates:[gate('GLOBAL_DATA_ADMISSION','BLOCKED',error.message)],entryAuthorization:false}))),noOpportunity:null,opportunityConclusion:'UNDETERMINED_DATA_GAPS',globalError:error.message,entryAuthorization:false};}const priorDay=sessions.at(-2)?.day;const ids=input.universe.map(s=>s.instrument?.isin),duplicateIdentity=new Set(ids).size!==ids.length;
 const current=input.universe.map(s=>identityExcluded(s)?{stock:s,eligible:false,gates:[gate('INSTRUMENT_SCOPE','FAIL','Outside frozen ordinary-EGP universe')]}:base(s,input,input.signalDay));
 const prior=input.universe.map(s=>identityExcluded(s)?{stock:s,eligible:false,gates:[]}:base(s,input,priorDay));
 const completePrior=input.universeComplete===true&&!duplicateIdentity&&prior.every(r=>!r.gates.some(g=>g.status==='BLOCKED'));
 const tiers=assignTiers(duplicateIdentity?[]:prior.filter(r=>r.eligible).map(r=>({isin:r.stock.instrument.isin,turnover:r.turnover.value})));
 let bench=null,benchmarkError=null;try{const bars=admitSeries(input.benchmark,input,input.signalDay,{benchmark:true});bench=metrics(bars.map(b=>({...b,volume:0})));}catch(e){benchmarkError=e.message;}
 const rows=[];
 for(const item of current)for(const id of variants){const v=variant(id),instrument=item.stock.instrument||{},gates=structuredClone(item.gates),m=item.metrics,b=item.bars?.at(-1);let setup=null,volumeThreshold=null;
 if(v.cashOnly){rows.push({variantId:id,ticker:instrument.ticker,isin:instrument.isin,status:'CASH_CONTROL',gates:[gate('CASH_ONLY','NOT_APPLICABLE','B0 produces no orders')],entryAuthorization:false});continue;}
 if(duplicateIdentity)gates.push(gate('COHORT_IDENTITY','BLOCKED','Duplicate or missing ISIN in supplied universe'));
 if(!input.universeComplete)gates.push(gate('COHORT_COVERAGE','BLOCKED','Full catalog accounting not certified by input manifest'));
 if(m){
 gates.push(gate('BENCHMARK',bench?'PASS':'BLOCKED',benchmarkError||'EGX30 uses identical verified sessions and cutoff'));
 const bands=item.stock.rules.bands,factor=b.priceFactor,hRaw=m.h20/factor;
 try{const breakout=roundTick(hRaw,bands,'next');gates.push(gate('BREAKOUT',b.raw.close>=breakout?'PASS':'FAIL','Close >= first legal raw tick strictly above prior 20 highs',{h20Raw:hRaw,threshold:breakout}));
 setup={lower:roundTick(hRaw,bands,'ceil'),limit:roundTick((m.close+.25*m.atr14)/factor,bands,'floor'),stop:roundTick((m.close-2*m.atr14)/factor,bands,'floor'),takeProfit:null,mechanism:'NEXT_SESSION_FIRST_30_MINUTE_LIMIT',expiry:'Next verified session first-30-minute window; W6 must bind actual open/deadline',quantity:null,executionState:'AWAITING_W6_CONTROLS',basis:'RAW_CURRENT_PRICE_UNITS'};
 gates.push(gate('PRICE_ZONE',setup.stop>0&&setup.lower<=setup.limit?'PASS':'FAIL','Positive stop and rounded lower <= limit; W6 must require actual fill above stop',setup));
 }catch(e){gates.push(gate('PRICE_ZONE','BLOCKED',e.message));}
 gates.push(gate('TREND',m.close>m.sma50&&m.sma50>m.sma200&&m.sma50>m.sma50Prior10?'PASS':'FAIL','C > SMA50 > SMA200 and SMA50 rising over 10 sessions'));
 gates.push(gate('RELATIVE_MOMENTUM',!bench?'BLOCKED':m.r63>0&&m.r63>=bench.r63?'PASS':'FAIL','Positive aligned R63 >= EGX30 R63',bench?m.r63-bench.r63:null));
 gates.push(gate('MARKET_TREND',!bench?'BLOCKED':bench.close>bench.sma200?'PASS':'FAIL','EGX30 close above SMA200'));
 if(v.volume!=='none'){
 const tier=tiers.get(instrument.isin),sample=m.priorRV126;
 if(v.volume==='fixed')volumeThreshold=1.5;
 else if(completePrior&&tier&&sample.length===126)volumeThreshold=Math.max(1.5,percentile(sample,plan.volume.percentileByTier[tier.tier-1]));
 gates.push(gate('VOLUME',volumeThreshold===null||m.rv20===null?'BLOCKED':m.rv20>=volumeThreshold?'PASS':'FAIL',v.volume==='fixed'?'RV20 >= 1.5':'Prior eligible cohort tiers and 126 prior valid RV20 observations; no fallback',{rv20:m.rv20,threshold:volumeThreshold,tier:tier||null,priorCohortComplete:completePrior,priorSample:sample.length}));
 }
 }
 const mechanics=gates.every(g=>g.status==='PASS'),blocked=gates.some(g=>g.status==='BLOCKED');
 rows.push({variantId:id,ticker:instrument.ticker,isin:instrument.isin,sector:instrument.sector,companyModel:instrument.companyModel||null,status:blocked?'DATA_BLOCKED':!mechanics?'THRESHOLD_REJECTED':v.research?'RESEARCH_PENDING':'CONTROL_VALIDATION_PENDING',mechanicallyEligible:mechanics,gates,metrics:m?{...m,priorRV126:undefined}:null,turnover:item.turnover||null,relativeR63:m&&bench?m.r63-bench.r63:null,setup:mechanics?setup:null,entryAuthorization:false,featureFamilies:{momentum:['BREAKOUT','TREND','RELATIVE_MOMENTUM','MARKET_TREND'],liquidity:['TURNOVER','ACTIVE_SESSIONS','VOLUME'],riskQuality:['ATR_FRACTION','TICK_FRACTION']},forecast:'UNCALIBRATED: descriptive conditions, not a probability'});
 }
 for(const row of rows){const population=current.filter(p=>p.stock.instrument?.sector===row.sector&&p.stock.instrument?.isin!==row.isin&&!identityExcluded(p.stock));row.sectorStrength=sectorStrength({target:row.isin,eligiblePeerCount:population.length,peers:population.filter(p=>p.eligible).map(p=>({isin:p.stock.instrument.isin,signalDay:input.signalDay,eligible:true,r20:p.metrics.r20})),benchmarkR20:bench?.r20,signalDay:input.signalDay});}
 for(const id of variants){const ranked=rows.filter(r=>r.variantId===id&&r.mechanicallyEligible).sort((a,b)=>b.relativeR63-a.relativeR63||b.turnover.value-a.turnover.value||a.isin.localeCompare(b.isin));ranked.forEach((r,i)=>r.researchRank=i+1);}
 const candidates=rows.some(r=>r.mechanicallyEligible),unknown=rows.some(r=>r.status==='DATA_BLOCKED');
 return {version:engineVersion,capability:'Daily trend-confirmation; early-warning lead time untested',policyHash:planHash,inputHash:hash(input),signalDay:input.signalDay,cutoffAt:input.cutoffAt,rows,priorTierPopulation:tiers.size,priorCohortComplete:completePrior,cohortCount:input.universe.length,variantCount:variants.length,noOpportunity:candidates?false:unknown?null:true,opportunityConclusion:candidates?'CANDIDATES_PRESENT':unknown?'UNDETERMINED_DATA_GAPS':'NONE_PASSED_MECHANICAL_GATES',entryAuthorization:false,limitations:['Supplied official/effective evidence assertions require independent W3 verification; this parser cannot authenticate a source.','No analyst decision, risk sizing, order, reservation or fill is created.','Tier calculation needs prior-session eligibility (262 sessions including the signal day), not signal-day liquidity ranking.']};
}
export function sectorStrength({target,peers,eligiblePeerCount,benchmarkR20,signalDay}){
 const valid=peers.filter(p=>p.isin!==target&&p.signalDay===signalDay&&p.eligible===true&&finite(p.r20));
 required(Number.isInteger(eligiblePeerCount)&&eligiblePeerCount>=0&&new Set(valid.map(p=>p.isin)).size===valid.length&&valid.length<=eligiblePeerCount,'Valid peer denominator and unique peers required');
 const coverage=eligiblePeerCount?valid.length/eligiblePeerCount:0;
 return valid.length>=5&&coverage>=.8&&finite(benchmarkR20)?{status:'AVAILABLE',relativeStrength:median(valid.map(p=>p.r20))-benchmarkR20,peers:valid.length,coverage}:{status:'IMPORTANT_GAP',relativeStrength:null,peers:valid.length,coverage,reason:'Need five aligned eligible peers and 80% eligible sector coverage'};
}
