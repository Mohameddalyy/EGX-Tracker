import {hash,required,finite,plan} from './contract.mjs';
import {admitSeries,calendarAt} from './signals.mjs';
import {median,roundTick,metrics,tickSize} from './math.mjs';
import {ruleBook,rulesFor,nextSession,ms} from './execution-rules.mjs';
import {buyCommitment} from './money.mjs';
import {readComparisonAmendment} from './evaluation-contract.mjs';
// Planning only: this module cannot create an intent, reservation or fill.
export function planBasket({input,book,scenario,amendmentPath,at}){
 const amendment=readComparisonAmendment(amendmentPath);required(ms(input.cutoffAt)<=ms(at),'Cutoff after planning');
 ruleBook(book,at);const session=nextSession(book,input.signalDay);required(ms(at)<ms(session.openAt),'Basket must freeze before first entry session');
 required(input.universeComplete===true&&input.universe.length>0,'Complete prior-close universe required');calendarAt(input,input.signalDay);
 const identities=input.universe.map(s=>s.instrument?.isin);required(new Set(identities).size===identities.length,'Duplicate basket identity');
 const candidates=[],exclusions=[];
 for(const stock of input.universe){const i=stock.instrument;
  if(i?.verified===true&&(i.currency!=='EGP'||i.kind!=='PRIMARY_ORDINARY_COMMON'||i.tradable===false)){exclusions.push({isin:i.isin,status:'INELIGIBLE',reason:'Verified instrument scope'});continue;}
  try{const bars=admitSeries(stock,input),last=bars.slice(-20);required(last.every(b=>finite(b.turnoverEGP)&&b.turnoverEGP>=0&&b.turnoverSourceId),'Raw traded value required; proxy cannot rank approved basket');
   const value=median(last.map(b=>b.turnoverEGP)),m=metrics(bars),close=bars.at(-1).raw.close;
   if(value<plan.universe.minMedianTurnover20EGP||last.filter(b=>b.raw.volume>0).length<plan.universe.minActiveSessions20||m.atr14/m.close>plan.universe.maxAtr14ToClose||tickSize(close,stock.rules.bands)/close>plan.universe.maxTickToClose){exclusions.push({isin:i.isin,status:'INELIGIBLE',reason:'Frozen universe liquidity/volatility/grid gate'});continue;}
   const rules=rulesFor(book,i.isin,session.day);required(rules.tradable&&!rules.unresolvedAction&&rules.actionBasisId===stock.adjustment.basisId,'Next-session action/trading admission required');
   const limit=roundTick(close,rules.ticks,'floor');required(limit>=rules.lowerBand&&limit<=rules.upperBand,'Prior-close limit outside verified daily bands');
   let low=0,high=Math.floor(20000/limit);while(low<high){const q=Math.ceil((low+high)/2);if(buyCommitment(q,limit,scenario)<=2000000)low=q;else high=q-1;}
   candidates.push({isin:i.isin,ticker:i.ticker,medianRawTradedValue20EGP:value,limit,quantity:low,commitmentCents:buyCommitment(low,limit,scenario),rulesHash:hash(rules),actionBasisId:rules.actionBasisId});
  }catch(e){exclusions.push({isin:i?.isin??null,status:'UNRESOLVED',reason:e.message});}
 }
 candidates.sort((a,b)=>b.medianRawTradedValue20EGP-a.medianRawTradedValue20EGP||(a.isin<b.isin?-1:a.isin>b.isin?1:0));
 const available=candidates.length>=5&&!exclusions.some(e=>e.status==='UNRESOLVED'),selection=available?candidates.slice(0,5):[];
 const result={version:'approved-basket-plan-1',scope:'ENGINEERING_PLAN_ONLY',status:available?'PLAN_READY':'UNAVAILABLE',at,scenario,amendmentHash:amendment.contentHash,inputHash:hash(input),ruleBookHash:hash(book),signalDay:input.signalDay,entryDay:session.day,marketWindowStart:session.openAt,marketWindowEnd:new Date(ms(session.openAt)+1800000).toISOString(),endpointSessions:126,selection,exclusions,unresolvedCount:exclusions.filter(e=>e.status==='UNRESOLVED').length,uncommittedCashCents:10000000-selection.reduce((s,x)=>s+x.commitmentCents,0),replacementAllowed:false,entryAuthorization:false,limitations:['Plan only. Basket-specific execution, durable holdings, entitlements and endpoint reconciliation remain unimplemented; no economic comparison allowed.','Unknown candidate data can change top-five selection; provisional ranks are never certified.']};return {...result,contentHash:hash(result)};
}
