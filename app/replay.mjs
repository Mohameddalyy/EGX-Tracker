import {priceLevels} from './levels.mjs';
// Fixed experimental entry rule. Each method has one position at a time.
export function replay(bars, indicators, gaps=[]) {
 const methods=[];
 for(const method of ['Below support','ATR buffer']) {
  const trades=[];let skipped=0;
  for(let i=49;i<bars.length-1;i++) {
   const past=bars.slice(0,i+1), a=priceLevels(past,indicators(past).atr14,bars[i+1].day);
   const stop=a.stops.find(s=>s.kind===method)?.price,target=a.resistance[0]?.low;
   if(stop==null||target==null)continue;
   const entry=bars[i+1].open;
   if(!(stop<entry&&entry<target)){skipped++;continue;}
   const end=Math.min(i+20,bars.length-1);
   if(gaps.some(d=>d>bars[i].day&&d<=bars[end].day)){skipped++;continue;}
   let exit=null,reason=null,j=i+1,ambiguous=false;
   for(;j<=end;j++) {
    const b=bars[j];
    if(b.open<=stop){exit=b.open;reason='Stop gap';break;}
    if(b.open>=target){exit=target;reason='Target gap (capped)';break;}
    if(b.low<=stop){exit=stop;ambiguous=b.high>=target;reason=ambiguous?'Both touched: stop first':'Stop';break;}
    if(b.high>=target){exit=target;reason='Target';break;}
   }
   if(exit===null&&end<i+20)break; // Incomplete horizon: never force a favourable exit.
   if(exit===null){j=end;exit=bars[j].close;reason='20-bar timeout';}
   const gross=(exit/entry-1)*100;
   // Illustrative 0.25% combined fee/slippage per side, not a broker quote.
   const net=(exit*(1-.0025)/(entry*(1+.0025))-1)*100;
   trades.push({signal:bars[i].day,entryDay:bars[i+1].day,exitDay:bars[j].day,entry,stop,target,exit,reason,ambiguous,gross,net});
   i=j; // Re-enter no earlier than the bar after the next signal.
  }
  let equity=1,peak=1,drawdown=0;
  for(const t of trades){equity*=1+t.net/100;peak=Math.max(peak,equity);drawdown=Math.max(drawdown,(peak-equity)/peak*100);}
  methods.push({method,trades,skipped,count:trades.length,winRate:trades.length?trades.filter(t=>t.net>0).length/trades.length*100:null,
   netReturn:trades.length?(equity-1)*100:null,closedTradeDrawdown:trades.length?drawdown:null});
 }
 return {version:'1.0',from:bars[0]?.day,to:bars.at(-1)?.day,methods};
}
