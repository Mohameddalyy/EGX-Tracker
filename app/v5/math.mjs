import {finite,required} from './contract.mjs';
export const mean=a=>a.length&&a.every(finite)?a.reduce((s,x)=>s+x,0)/a.length:null;
export function median(a){if(!a.length||!a.every(finite))return null;const x=[...a].sort((a,b)=>a-b),n=x.length;return n%2?x[(n-1)/2]:(x[n/2-1]+x[n/2])/2;}
export function percentile(a,p){required(a.length>0&&a.every(finite)&&p>0&&p<=1,'Complete finite percentile sample required');return [...a].sort((a,b)=>a-b)[Math.ceil(p*a.length)-1];}
export function rvAt(bars,index){if(index<20)return null;const previous=bars.slice(index-20,index).map(b=>b.volume),den=mean(previous);return den>0&&previous.every(v=>v>=0)&&finite(bars[index].volume)&&bars[index].volume>=0?bars[index].volume/den:null;}
export function metrics(bars){
 required(bars.length>=261,'261 observations required for fixed-window ATR');
 const b=bars.slice(-261),end=b.length-1,sma=(n,offset=0)=>mean(b.slice(b.length-offset-n,b.length-offset).map(x=>x.close));
 const tr=b.slice(1).map((x,i)=>Math.max(x.high-x.low,Math.abs(x.high-b[i].close),Math.abs(x.low-b[i].close)));
 let atr14=mean(tr.slice(0,14));for(const x of tr.slice(14))atr14=(13*atr14+x)/14;
 const priorRV=[];for(let i=bars.length-2;i>=20&&priorRV.length<126;i--){const value=rvAt(bars,i);if(value!==null)priorRV.unshift(value);}
 return {close:b[end].close,sma20:sma(20),sma50:sma(50),sma200:sma(200),sma50Prior10:sma(50,10),atr14,h20:Math.max(...b.slice(-21,-1).map(x=>x.high)),r63:b[end].close/b[end-63].close-1,r20:b[end].close/b[end-20].close-1,rv20:rvAt(b,end),priorRV126:priorRV,positiveVolume20:b.slice(-20).filter(x=>x.volume>0).length};
}
// Rational decimal grids avoid binary rounding at piecewise tick boundaries.
function rational(x){required(finite(x)&&x>=0&&x<=1e12,'Nonnegative finite price/tick required');const [a,e='0']=String(x).toLowerCase().split('e'),[whole,fraction='']=a.split('.'),power=Number(e)-fraction.length;let n=BigInt(whole+fraction),d=1n;if(power>=0)n*=10n**BigInt(power);else d=10n**BigInt(-power);return {n,d};}
export function tickBands(bands){
 required(Array.isArray(bands)&&bands.length>0,'Verified tick bands required');let boundary=0;
 for(const b of bands){required(b.from===boundary&&finite(b.tick)&&b.tick>0&&(b.to===null||finite(b.to)&&b.to>b.from),'Tick bands must be positive, contiguous, zero-origin grids');rational(b.from);rational(b.tick);if(b.to!==null)rational(b.to);boundary=b.to;}
 required(boundary===null&&bands.slice(0,-1).every(b=>b.to!==null),'Tick grid must cover every positive price');return bands;
}
export function tickSize(price,bands){tickBands(bands);const b=bands.find(b=>price>=b.from&&(b.to===null||price<b.to));required(!!b,'Price outside tick grid');return b.tick;}
export function roundTick(price,bands,mode='floor'){
 required(['floor','ceil','next'].includes(mode),'Unknown tick rounding mode');tickBands(bands);const x=rational(price),candidates=[];
 for(const b of bands){const t=rational(b.tick),from=rational(b.from),to=b.to===null?null:rational(b.to);let k;
 if(mode==='floor'){k=x.n*t.d/(x.d*t.n);if(to){const ceiling=(to.n*t.d+to.d*t.n-1n)/(to.d*t.n)-1n;if(k>ceiling)k=ceiling;}}
 else{const numerator=x.n*t.d,denominator=x.d*t.n;k=mode==='next'?numerator/denominator+1n:(numerator+denominator-1n)/denominator;const minimum=(from.n*t.d+from.d*t.n-1n)/(from.d*t.n);if(k<minimum)k=minimum;}
 if(k<0n||k*t.n*from.d<from.n*t.d||to&&k*t.n*to.d>=to.n*t.d)continue;
 const p=Number(k*t.n)/Number(t.d);if(mode==='floor'&&p>price||mode==='ceil'&&p<price||mode==='next'&&p<=price)continue;candidates.push(p);
 }
 required(candidates.length>0,'No legal price on supplied grid');return mode==='floor'?Math.max(...candidates):Math.min(...candidates);
}
export const validTick=(price,bands)=>finite(price)&&price>0&&roundTick(price,bands,'floor')===price;
export function turnover(bars){
 required(bars.length===20,'Exactly 20 sessions required for turnover');const raw=bars.map(b=>b.raw);
 const actual=bars.every(b=>finite(b.turnoverEGP)&&b.turnoverEGP>=0&&b.turnoverSourceId);
 const lower=median(raw.map(b=>b.low*b.volume)),upper=median(raw.map(b=>b.high*b.volume));
 return {method:actual?'VERIFIED_TRADED_VALUE':'TYPICAL_PRICE_VOLUME_PROXY',value:actual?median(bars.map(b=>b.turnoverEGP)):median(raw.map(b=>(b.high+b.low+b.close)/3*b.volume)),lower,upper,medianRawShares:median(raw.map(b=>b.volume))};
}
