import {factColumns} from '../../app/market-facts.mjs';
import {writeFileSync} from 'node:fs';
const started=Date.now(),capturedAt=new Date().toISOString(),url='https://scanner.tradingview.com/egypt/scan';
async function scan(body){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('HTTP '+r.status+': '+await r.text());return r.json();}
const raw=await scan({filter:[{left:'exchange',operation:'equal',right:'EGX'},{left:'type',operation:'equal',right:'stock'}],columns:factColumns,range:[0,2000]});
const coverage=Object.fromEntries(factColumns.map((c,i)=>[c,{nonNull:raw.data.filter(r=>r.d[i]!=null).length,usable:raw.data.filter(r=>r.d[i]!=null&&r.d[i]!=='NoRating').length}]));
const benchmarkColumns=['name','type','close','Perf.1M','Perf.3M','Perf.6M','Perf.Y'];
const benchmarks=await scan({symbols:{tickers:['EGX:EGX30','EGX:EGX70EWI']},columns:benchmarkColumns});
const result={capturedAt,completedAt:new Date().toISOString(),elapsedMs:Date.now()-started,url,columns:factColumns,totalCount:raw.totalCount,rows:raw.data.length,coverage,raw,benchmarkColumns,benchmarks,limits:'Read-only isolated capability probe. Retrieval time is not market or publication time. No production DB writes.'};
writeFileSync(new URL('./scanner-evidence.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify({capturedAt,elapsedMs:result.elapsedMs,total:raw.totalCount,rows:raw.data.length,coverage,benchmarks:benchmarks.totalCount}));
