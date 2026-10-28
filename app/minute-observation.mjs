// Observation quality only. A retained bar is not an executable quote or a fill.
export function minuteObservationQuality(capture){
 const at=Date.parse(capture.capturedAt),delay=capture.delaySeconds;
 if(!Number.isFinite(at)||!Number.isFinite(delay)||delay<0||capture.timezone!=='Africa/Cairo'||capture.currency!=='EGP'||!/^EGX(?:_DLY)?$/.test(capture.exchange||''))return {status:'METADATA_UNVERIFIED',usableForExecution:false};
 const bars=capture.bars||[];
 if(!bars.length||bars.some((b,i)=>!Number.isInteger(b.time)||b.time<=0||b.time%60!==0||i>0&&b.time<=bars[i-1].time||![b.open,b.high,b.low,b.close].every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(b.volume)||b.volume<0||b.low>Math.min(b.open,b.close)||b.high<Math.max(b.open,b.close)||b.low>b.high))return {status:'INVALID_OR_EMPTY_OBSERVATIONS',usableForExecution:false};
 const confirmed=bars.filter(b=>(b.time+60)*1000<=at-delay*1000).sort((a,b)=>a.time-b.time),last=confirmed.at(-1);
 if(!last)return {status:'NO_CLOSED_OBSERVATION',usableForExecution:false};
 const ageMs=at-delay*1000-(last.time+60)*1000;
 return {status:ageMs<=120000?'RECENT_CLOSED_OBSERVATION':'OLDER_CLOSED_OBSERVATION',latestMarketAt:new Date((last.time+60)*1000).toISOString(),capturedAt:capture.capturedAt,providerDelaySeconds:delay,ageAfterDelayMs:ageMs,usableForExecution:false,reason:'Observed freshness only; session, action, order and fill rules remain separate. Older observations cannot be silently treated as current quotes.'};
}
