import {isConfirmedBar} from './finality.mjs';
// Daily research heuristics, not TradingView-generated signals.
export function priceLevels(history, atr, today, now=null) {
  const bars = history.filter(b => b.day < today || (now && b.day === today && isConfirmedBar(b,now))).slice(-120);
  const reference = bars.at(-1)?.close ?? null;
  const result = {version:'1.1', asOf:bars.at(-1)?.day ?? null, reference, atr,
    observations:bars.length, support:[], resistance:[], stops:[], reason:null};
  if (bars.length < 20 || !Number.isFinite(atr) || atr <= 0) {
    result.reason = 'At least 20 accepted daily observations and a positive ATR14 are required.';
    return result;
  }
  const tolerance = atr * .5;
  for (const [kind, field] of [['support','low'],['resistance','high']]) {
    const pivots = [];
    for (let i=2; i<bars.length-2; i++) {
      const price = bars[i][field];
      const neighbours = [bars[i-2],bars[i-1],bars[i+1],bars[i+2]];
      if (!neighbours.every(b => kind==='support' ? price < b[field] : price > b[field])) continue;
      // A later close through the pivot invalidates it; no automatic role reversal.
      if (bars.slice(i+3).some(b => kind==='support' ? b.close < price : b.close > price)) continue;
      pivots.push({price,day:bars[i].day,confirmedOn:bars[i+2].day});
    }
    const groups=[];
    for (const p of pivots.sort((a,b)=>a.price-b.price)) {
      const last=groups.at(-1);
      if (last && p.price-last[0].price<=tolerance) last.push(p); else groups.push([p]);
    }
    result[kind]=groups.map(evidence=>({low:evidence[0].price,high:evidence.at(-1).price,
      price:evidence.reduce((n,p)=>n+p.price,0)/evidence.length,touches:evidence.length,evidence}))
      .filter(z=>kind==='support'?z.high<reference:z.low>reference)
      .sort((a,b)=>kind==='support'?b.high-a.high:a.low-b.low).slice(0,3);
  }
  const support=result.support[0];
  const candidates=[{kind:'ATR buffer',price:reference-2*atr,formula:'Accepted close − 2 × ATR14'}];
  if (support) candidates.unshift({kind:'Below support',price:support.low-.5*atr,
    formula:'Nearest support lower edge − 0.5 × ATR14'});
  result.stops=candidates.filter(s=>s.price>0&&s.price<reference).map(s=>({...s,
    distancePercent:(reference-s.price)/reference*100,
    rewardRisk:result.resistance.length?(result.resistance[0].low-reference)/(reference-s.price):null}));
  return result;
}
