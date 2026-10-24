import {createHash,timingSafeEqual} from 'node:crypto';
export const hash = value => createHash('sha256').update(String(value)).digest('hex');
export function matchesSecret(secret,expectedHash){
 return typeof secret==='string'&&secret.length<=256&&typeof expectedHash==='string'&&/^[a-f0-9]{64}$/.test(expectedHash)&&timingSafeEqual(Buffer.from(hash(secret),'hex'),Buffer.from(expectedHash,'hex'));
}
export function normalizeEvent(input,now=new Date()){
 if(!input||input.schema!==1||!/^alert-[a-f0-9]{24}$/.test(input.ruleId))throw Error('Invalid alert identity');
 const symbol=String(input.symbol||'').replace(/^EGX_DLY:/,'EGX:');
 if(!/^EGX:[A-Z][A-Z0-9-]{1,23}$/.test(symbol))throw Error('EGX symbol required');
 const number=(v,optional=false)=>{if(optional&&(v==null||v==='n/a'))return null;if(typeof v!=='number'&&!(typeof v==='string'&&/^\d+(\.\d+)?$/.test(v)))throw Error('Invalid numeric observation');const n=Number(v);if(!Number.isFinite(n)||n<0||n>1e15)throw Error('Invalid numeric observation');return n;};
 const price=number(input.price),volume=number(input.volume,true);
 if(price<=0)throw Error('Positive price required');
 const date=v=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d\d:\d\d)$/.test(v)||!Number.isFinite(Date.parse(v)))throw Error('ISO timestamp with timezone required');return new Date(v).toISOString();};
 const triggeredAt=date(input.triggeredAt),barTime=date(input.barTime);
 if(Date.parse(triggeredAt)>now.getTime()+60000||Date.parse(barTime)>Date.parse(triggeredAt)+60000)throw Error('Future event timestamp');
 // No free-form message, credentials, OHLCV history or external instructions are persisted.
 const event={schema:1,ruleId:input.ruleId,symbol,price,volume,triggeredAt,barTime};
 return {...event,eventId:hash(JSON.stringify(event))};
}
export function thresholdMatches(rule,event){return rule.kind==='volume'?event.volume!==null&&event.volume>=rule.threshold:rule.direction==='below'?event.price<=rule.threshold:event.price>=rule.threshold;}
export function validateRelayRule(r){
 if(!r||!/^alert-[a-f0-9]{24}$/.test(r.id)||!/^EGX:[A-Z][A-Z0-9-]{1,23}$/.test(r.symbol)||!/^[a-f0-9]{64}$/.test(r.tokenHash)||!['above','below'].includes(r.direction)||!['entry','stop','target','support','resistance','volume'].includes(r.kind)||!Number.isFinite(r.threshold)||r.threshold<=0||typeof r.enabled!=='boolean'||r.expiresAt!==null&&!Number.isFinite(Date.parse(r.expiresAt)))throw Error('Invalid rule registration');
 return {id:r.id,symbol:r.symbol,tokenHash:r.tokenHash,direction:r.direction,kind:r.kind,threshold:r.threshold,enabled:r.enabled,expiresAt:r.expiresAt};
}
