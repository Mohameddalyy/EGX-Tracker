import {required,finite,timestamp,nonempty,hash} from './contract.mjs';
import {tickBands,validTick} from './math.mjs';

export const ms=value=>{required(timestamp(value),'Explicit timezone timestamp required');return Date.parse(value);};
export const iso=value=>new Date(value).toISOString();
export function source(item,at) {
  required(item?.verified===true&&nonempty(item.sourceId)&&/^[a-f0-9]{64}$/.test(item.sourceHash)&&ms(item.availableAt)<=ms(at),'Verified available source/hash required');
}
export function ruleBook(book,at) {
  source(book,at);required(Array.isArray(book.sessions)&&book.sessions.length>0,'Verified session list required');
  let last='';
  for(const s of book.sessions){
    source(s,at);required(/^\d{4}-\d{2}-\d{2}$/.test(s.day)&&s.day>last&&ms(s.openAt)<ms(s.closeAt)&&s.day===s.openAt.slice(0,10),'Ordered verified session required');last=s.day;
  }
  required(Array.isArray(book.settlementDays)&&book.settlementDays.length>0,'Verified settlement calendar required');last='';
  for(const day of book.settlementDays){required(/^\d{4}-\d{2}-\d{2}$/.test(day)&&day>last,'Ordered settlement business days required');last=day;}
  required(Array.isArray(book.instruments)&&book.instruments.length>0,'Effective instrument rules required');
  const keys=new Set();
  for(const r of book.instruments){
    source(r,at);const key=r.isin+':'+r.day;required(!keys.has(key),'Duplicate instrument rule');keys.add(key);
    required(/^EG[A-Z0-9]{10}$/.test(r.isin)&&nonempty(r.sector)&&nonempty(r.issuerGroup)&&r.currency==='EGP'&&r.kind==='PRIMARY_ORDINARY_COMMON'&&book.sessions.some(s=>s.day===r.day),'Verified identity/sector/group required');
    required(nonempty(r.actionBasisId)&&typeof r.tradable==='boolean'&&typeof r.unresolvedAction==='boolean'&&finite(r.lowerBand)&&finite(r.upperBand)&&r.lowerBand>0&&r.upperBand>r.lowerBand,'Verified daily bands/action status required');
    tickBands(r.ticks);required(validTick(r.lowerBand,r.ticks)&&validTick(r.upperBand,r.ticks),'Daily bands must be on tick grid');
  }
  return hash(book);
}
export function rulesFor(book,isin,day){const r=book.instruments.find(r=>r.isin===isin&&r.day===day);required(!!r,'Missing effective instrument rules');return r;}
export function settlementDay(book,day){const days=book.settlementDays.filter(d=>d>day);required(days.length>=2,'Two subsequent verified settlement days required');return days[1];}
export function nextSession(book,signalDay){const s=book.sessions.find(s=>s.day>signalDay);required(!!s,'Next verified session unavailable');return s;}
export function minuteValidity(bar,book,isin,at,delaySeconds,{entry=false}={}) {
  source(bar,at);required(bar.isin===isin&&bar.basis==='RAW'&&bar.confirmed===true,'Confirmed raw identified minute required');
  const start=ms(bar.startAt),end=ms(bar.endAt),received=ms(bar.receivedAt),now=ms(at);
  required(end-start===60000&&start%60000===0&&received>=end+delaySeconds*1000&&now>=received,'Completed minute and declared delay required');
  required(ms(bar.availableAt)<=received,'Source cannot become available after receipt');
  const s=book.sessions.find(s=>start>=ms(s.openAt)&&end<=ms(s.closeAt));required(!!s,'Minute outside verified continuous session');
  const r=rulesFor(book,isin,s.day);source(r,at);required(ms(r.availableAt)<=start,'Rules unavailable at market event');
  required(r.tradable&&!r.unresolvedAction&&bar.halted===false&&bar.auction===false&&bar.limitLocked===false,'Suspension/action/auction/limit ambiguity');
  required(['open','high','low','close'].every(k=>validTick(bar[k],r.ticks)&&bar[k]>=r.lowerBand&&bar[k]<=r.upperBand)&&bar.low<=Math.min(bar.open,bar.close)&&bar.high>=Math.max(bar.open,bar.close),'Invalid raw OHLC/tick/band');
  required(Number.isSafeInteger(bar.volume)&&bar.volume>0,'Positive verified whole-share volume required');
  if(entry)required(received-end-delaySeconds*1000<=300000&&now-received<=60000,'Stale capture/processing cannot fill entry');
  return {session:s,rules:r,start,end,received};
}
