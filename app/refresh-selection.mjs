import {cairoDate} from './core.mjs';
import {isConfirmedBar} from './finality.mjs';
// Preparation freshness, not an exchange-certified trading calendar.
export function expectedHistorySession(stock,now=new Date()){
 let metadata;try{metadata=typeof stock?.metadata==='string'?JSON.parse(stock.metadata):stock?.metadata;}catch{}
 const info=metadata?.symbolInfo,ext=metadata?.symbolExt,today=cairoDate(now),holidays=info?.session_holidays;
 if(info?.timezone!=='Africa/Cairo'||!/^EGX(?:_DLY)?$/.test(info.exchange||ext?.exchange||'')||typeof holidays!=='string'||!/^\d{8}(,\d{8})*$/.test(holidays)||!holidays.split(',').some(x=>x.startsWith(today.slice(0,4))))return {day:null,reason:'Provider session metadata unavailable; collection required, no guessed freshness'};
 if(typeof info.session!=='string'||!/^(?:1;)?\d{4}-\d{4}:12345(?:#\d{8}\/(?:1;)?\d{4}-\d{4}:12345)*$/.test(info.session))return {day:null,reason:'Unsupported provider session'};
 const end=[...info.session.matchAll(/\d{4}-(\d{2})(\d{2})/g)].map(m=>Number(m[1])*60+Number(m[2]));
 let close=Math.max(...end),delay=Math.max(info.delay??-1,ext?.delay??-1);
 if(!Number.isFinite(close)||close>=1440||!Number.isFinite(delay)||delay<0)return {day:null,reason:'Invalid session or delay'};
 const corrections=[info.corrections,...(info.subsessions||[]).map(x=>x['session-correction'])].filter(Boolean);
 for(const c of corrections){if(!/^\d{4}-\d{4}:\d{8}(,\d{8})*(;\d{4}-\d{4}:\d{8}(,\d{8})*)*$/.test(c))return {day:null,reason:'Unsupported session correction'};for(const item of c.split(';')){const [range,days]=item.split(':');if(days.split(',').includes(today.replaceAll('-','')))close=Math.max(close,Number(range.slice(5,7))*60+Number(range.slice(7,9)));}}
 const local=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Cairo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));
 const afterClose=Number(local.hour)*60+Number(local.minute)>=close+delay/60+30;
 const closed=new Set(holidays.split(','));
 for(let i=afterClose?0:1;i<15;i++){const d=new Date(Date.parse(today+'T12:00Z')-i*86400000),day=d.toISOString().slice(0,10);if(![5,6].includes(d.getUTCDay())&&!closed.has(day.replaceAll('-','')))return {day,reason:'Provider calendar and delayed-close cutoff; preparation only',source:'Saved TradingView symbol metadata',executionCertified:false};}
 return {day:null,reason:'No supported completed session'};
}
export function historyRefreshState(stock,bar,now=new Date()){
 const expected=expectedHistorySession(stock,now),captured=Date.parse(stock?.retrieved_at),age=+now-captured;
 if(!expected.day){const legacy=!!bar&&bar.day===cairoDate(now)&&isConfirmedBar(bar,now)&&Number.isFinite(captured)&&age>=0&&cairoDate(new Date(captured))===cairoDate(now);return {due:!legacy,expectedSession:null,reason:expected.reason};}
 const code=!bar?'NO_HISTORY':bar.day<expected.day?'EXPECTED_SESSION_ABSENT':bar.day>expected.day?'LATEST_BAR_NOT_COMPLETED_SESSION':!isConfirmedBar(bar,now)?'BAR_FINALITY_UNCONFIRMED':!Number.isFinite(captured)||age<0?'CAPTURE_TIMESTAMP_INVALID':age>7*86400000?'CAPTURE_OR_METADATA_TOO_OLD':'REUSABLE';
 const reasons={NO_HISTORY:'No retained daily bars',EXPECTED_SESSION_ABSENT:'Latest bar '+bar?.day+' precedes expected session '+expected.day+'; no-trade/suspension/provider cause unverified',LATEST_BAR_NOT_COMPLETED_SESSION:'Latest bar is beyond the last completed provider session',BAR_FINALITY_UNCONFIRMED:'Expected-session bar lacks confirmed capture finality',CAPTURE_TIMESTAMP_INVALID:'Capture timestamp missing or future-dated',CAPTURE_OR_METADATA_TOO_OLD:'Capture/session metadata older than seven days',REUSABLE:'Reuse confirmed expected-session capture'};
 return {due:code!=='REUSABLE',code,expectedSession:expected.day,latestDay:bar?.day??null,reason:reasons[code],calendar:expected};
}
export function needsHistoryRefresh(stock,bar,now=new Date()){
 return historyRefreshState(stock,bar,now).due;
}
