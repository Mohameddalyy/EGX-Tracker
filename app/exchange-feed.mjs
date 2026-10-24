import {createHash} from 'node:crypto';
export const exchangeEndpoints=['news-search','financial-statements-filter'];
export function exchangeWindow(index,today,{from,to}={}){
 const end=to||new Date(Date.parse(today+'T12:00Z')-86400000).toISOString().slice(0,10);
 if(from)return {from,to:end};
 const previous=Object.values(index.windows||{}).filter(w=>w.to<=end).sort((a,b)=>b.to.localeCompare(a.to))[0];
 // Resume an unfinished window, or reuse today's already complete capture.
 if(previous&&(!previous.complete||previous.to===end))return {from:previous.from,to:previous.to};
 return {from:previous?new Date(Date.parse(previous.to+'T12:00Z')-86400000).toISOString().slice(0,10):end.slice(0,8)+'01',to:end};
}
export function feedRequest(endpoint,from,to,page=1){if(!exchangeEndpoints.includes(endpoint)||![from,to].every(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x)))||from>to||!Number.isInteger(page)||page<1)throw Error('Invalid exchange window');return {interval:50,pageNumber:page,pageSize:50,dateFrom:from,dateTo:to,...(endpoint==='news-search'?{marketSessionNews:false,secIds:[3,4,5,6,7,8,16,11,12,13],count:50}:{})};}
export function validateFeed(body,page){if(body?.success!==true||!Array.isArray(body.data)||!Number.isInteger(body.totalPages)||body.totalPages<0||!Number.isInteger(body.totalCount)||body.totalCount<0||body.pageNumber!==page||body.data.some(x=>!Number.isInteger(x.code)||typeof x.dateStamp!=='string'||!Number.isFinite(Date.parse(x.dateStamp))))throw Error('Invalid exchange feed or pagination');return body;}
export function disclosureRecord(item,source){
 const content=[item.content,item.contentArabic].filter(Boolean).join('\n'),isins=[...new Set([item.isin,...content.match(/EG[A-Z0-9]{10}/g)||[]].filter(Boolean))],tickers=[...new Set([...content.matchAll(/\b([A-Z][A-Z0-9-]{1,23})\.CA\b/g)].map(x=>x[1]))],attachments=[...new Set([...content.matchAll(/href=["']([^"']+)["']/gi)].map(m=>{try{return new URL(m[1],'https://www.egx.com.eg').href;}catch{return null;}}).filter(Boolean))];
 return {code:item.code,sourceDate:item.dateStamp,sourceTimeZone:'Not asserted by this collector',isins,tickers,attachments,heading:item.heading,headingArabic:item.headingArabic,content:item.content,contentArabic:item.contentArabic,section:item.section,source,raw:item,contentDigest:createHash('sha256').update(JSON.stringify(item)).digest('hex'),reviewStatus:'PRIMARY_ANNOUNCEMENT_RETAINED_UNREVIEWED',tradeAuthorization:false};
}
