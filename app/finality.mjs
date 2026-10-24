import {readFileSync} from 'node:fs';
export const sessionPolicy=JSON.parse(readFileSync(new URL('../research/session-policy.json',import.meta.url),'utf8'));
const dateFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'});
const clockFormat=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Cairo',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
export const cairoDate=(time=new Date())=>dateFormat.format(time);
const minutes=s=>{if(!/^\d{2}:?\d{2}$/.test(s))return NaN;const v=s.replace(':',''),h=Number(v.slice(0,2)),m=Number(v.slice(2));return h<24&&m<60?h*60+m:NaN;};
const localSeconds=t=>{const p=Object.fromEntries(clockFormat.formatToParts(t).map(x=>[x.type,x.value]));return Number(p.hour)*3600+Number(p.minute)*60+Number(p.second);};
export function captureFinality(day,capturedAt,metadata={},policy=sessionPolicy){
 const base={version:policy.version,day,capturedAt,confirmed:false,method:'provisional'};
 const reject=reason=>({...base,reason});
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day))||!Number.isFinite(Date.parse(capturedAt)))return reject('Invalid session date or capture timestamp');
 const at=new Date(capturedAt),captureDay=cairoDate(at);
 if(day<captureDay)return {...base,confirmed:true,method:'later-date',reason:'Recaptured on a later Cairo date'};
 if(day>captureDay)return reject('Session is later than capture');
 const info=metadata.symbolInfo||{},ext=metadata.symbolExt||{};
 if(!/^EGX(?:_DLY)?$/.test(info.exchange||ext.exchange||'')||info.timezone!==policy.timezone||info.has_extended_hours!==false)return reject('EGX timezone/session metadata is missing or unsupported');
 if(typeof info.session_holidays!=='string'||!/^\d{8}(,\d{8})*$/.test(info.session_holidays)||!info.session_holidays.split(',').some(d=>d.startsWith(day.slice(0,4))))return reject('Current-year provider holiday metadata unavailable');
 const override=policy.dateOverrides?.[day];
 if([5,6].includes(new Date(day).getUTCDay())||info.session_holidays.split(',').includes(day.replaceAll('-',''))||override?.closed)return reject('Weekend or known market holiday');
 const session=info.session;
 // Support observed single daytime EGX sessions with dated historical segments.
 // Taking the maximum end is conservative; no inference about undocumented segment boundaries.
 if(typeof session!=='string'||!/^(?:1;)?\d{4}-\d{4}:12345(?:#\d{8}\/(?:1;)?\d{4}-\d{4}:12345)*$/.test(session))return reject('Unsupported provider session format');
 const ranges=[...session.matchAll(/(\d{4})-(\d{4})/g)];
 let close=minutes(policy.regularClose);
 for(const [,start,end] of ranges){const a=minutes(start),b=minutes(end);if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a)return reject('Unsupported overnight/invalid session');close=Math.max(close,b);}
 const corrections=[info.corrections,...(info.subsessions||[]).map(s=>s['session-correction'])].filter(Boolean);
 for(const correction of corrections){if(typeof correction!=='string'||!/^\d{4}-\d{4}:\d{8}(,\d{8})*(;\d{4}-\d{4}:\d{8}(,\d{8})*)*$/.test(correction))return reject('Unsupported session correction');for(const item of correction.split(';')){const [range,dates]=item.split(':');if(dates.split(',').includes(day.replaceAll('-',''))){const [start,end]=range.split('-'),a=minutes(start),b=minutes(end);if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a)return reject('Invalid session correction');close=Math.max(close,b);}}}
 if(override){if(typeof override.source!=='string'||!override.source.startsWith('https://')||!Number.isFinite(minutes(override.close)))return reject('Invalid dated session override');close=Math.max(close,minutes(override.close));}
 const delays=[ext.delay,info.delay].filter(v=>v!==undefined);
 if(!delays.length||delays.some(v=>!Number.isFinite(v)||v<0))return reject('Feed delay unavailable');
 const delaySeconds=Math.max(...delays),cutoffSeconds=close*60+delaySeconds+policy.bufferMinutes*60;
 if(!Number.isFinite(cutoffSeconds)||cutoffSeconds>=86400)return reject('Unsupported cutoff');
 const cutoffLocal=String(Math.floor(cutoffSeconds/3600)).padStart(2,'0')+':'+String(Math.floor(cutoffSeconds%3600/60)).padStart(2,'0')+':'+String(cutoffSeconds%60).padStart(2,'0');
 const evidence={closeMinutes:close,delaySeconds,bufferMinutes:policy.bufferMinutes,cutoffLocal,timezone:policy.timezone,source:policy.source,verifiedOn:policy.verifiedOn,session,corrections,holidayCalendar:info.session_holidays,override:override||null};
 return {...base,...evidence,confirmed:localSeconds(at)>=cutoffSeconds,method:localSeconds(at)>=cutoffSeconds?'post-close':'provisional',reason:localSeconds(at)>=cutoffSeconds?'Captured after session close, feed delay and safety buffer':'Capture precedes '+cutoffLocal+' Cairo cutoff; refresh after cutoff'};
}
export function barFinality(bar,now=new Date()){
 if(!bar)return {confirmed:false,reason:'No daily bar'};
 const time=Date.parse(bar.captured_at);
 if(!Number.isFinite(time)||time>now.getTime()||bar.day>cairoDate(now))return {confirmed:false,reason:'Missing or future capture/session'};
 // Legacy later-date captures remain eligible. Same-date captures need persisted proof.
 if(bar.day<cairoDate(new Date(time)))return {confirmed:true,method:'later-date',reason:'Recaptured on a later Cairo date'};
 let proof;try{proof=typeof bar.finality==='string'?JSON.parse(bar.finality):bar.finality;}catch{return {confirmed:false,reason:'Invalid saved finality evidence'};}
 if(proof?.day===bar.day&&proof.capturedAt===bar.captured_at&&proof.version==='egx-post-close-1.0'&&proof.confirmed===true&&proof.method==='post-close')return proof;
 return {confirmed:false,reason:proof?.reason||'Needs a new post-close or later-date capture'};
}
export const isConfirmedBar=(bar,now=new Date())=>barFinality(bar,now).confirmed;
