// One-shot diagnostic only. Never writes prices, events, candidates or fills.
import {openDb,cairoDate} from './core.mjs';import {initMarket,marketBusy} from './market.mjs';
import {getState,setSymbol,setTimeframe} from '../integrations/tradingview-mcp/src/core/chart.js';
import {evaluate,disconnect} from '../integrations/tradingview-mcp/src/connection.js';
import {writeFileSync,mkdirSync} from 'node:fs';
const db=openDb('data/egx.sqlite');initMarket(db);
if(marketBusy(db)||db.prepare("SELECT 1 FROM research_queue WHERE status='researching'").get())throw Error('Another collector/analyst is active; retry later');
const started=new Date().toISOString(),job=Number(db.prepare("INSERT INTO market_jobs(started_at,status,pid,total,message) VALUES(?,'running',?,2,'One-shot local intraday feasibility probe; no history import')").run(started,process.pid).lastInsertRowid);
let original,result={startedAt:started,diagnosticOnly:true,samples:[],errors:[]};
const read=()=>evaluate(`(()=>{const c=window.TradingViewApi._activeChartWidgetWV.value(),m=c._chartWidget.model().mainSeries(),b=m.bars(),i=m.symbolInfo(),e=c.symbolExt();return {symbol:c.symbol(),series:i?.ticker||i?.name,resolution:c.resolution(),chartType:c.chartType(),loading:typeof m.isLoading==='function'?m.isLoading():null,currency:i?.currency_code,exchange:i?.exchange,delaySeconds:e?.delay??i?.delay??null,timezone:i?.timezone,bars:[-2,-1,0].map(n=>b.valueAt(b.lastIndex()+n)).filter(Boolean).map(v=>({time:v[0],open:v[1],high:v[2],low:v[3],close:v[4],volume:v[5]??null}))};})()`);
async function ready(symbol,tf){let last='',stable=0;for(let n=0;n<35;n++){const s=await read(),bare=x=>String(x||'').split(':').at(-1);const ok=(!symbol||bare(s.symbol)===bare(symbol)&&bare(s.series)===bare(symbol))&&(!tf||s.resolution===tf)&&s.bars.length&&s.loading!==true;const sig=JSON.stringify(s);stable=ok&&last===sig?stable+1:0;last=sig;if(stable>=2)return true;await new Promise(r=>setTimeout(r,300));}return false;}
const deps={waitForChartReady:ready};
try{
 original=await getState();result.original=original;
 for(const ticker of ['COMI','AMOC']){
  if(!(await setSymbol({symbol:'EGX:'+ticker,_deps:deps})).chart_ready||!(await setTimeframe({timeframe:'1',_deps:deps})).chart_ready)throw Error('One-minute chart did not load for '+ticker);
  const sample=await read(),at=new Date(),last=sample.bars.at(-1);
  if(sample.symbol.split(':').at(-1)!==ticker||sample.resolution!=='1'||sample.currency!=='EGP'||!/^EGX(?:_DLY)?$/.test(sample.exchange)||sample.chartType!==1)throw Error('Unexpected chart identity or currency');
  result.samples.push({...sample,capturedAt:at.toISOString(),latestBarCairoDate:cairoDate(new Date(last.time*1000)),captureCairoDate:cairoDate(at),latestBarAgeMinutes:(at.getTime()-last.time*1000)/60000,rawVolumePresent:sample.bars.every(b=>Number.isFinite(b.volume)),note:'Bar timestamp is the one-minute bar start, not a certified exchange tick timestamp. Closed-market data is not a current-session signal.'});
 }
}catch(e){result.errors.push(e.message);}
finally{
 if(original)try{await setSymbol({symbol:original.symbol,_deps:deps});await setTimeframe({timeframe:original.resolution,_deps:deps});const restored=await getState();result.restored=restored.symbol===original.symbol&&restored.resolution===original.resolution&&restored.chartType===original.chartType;if(!result.restored)result.errors.push('Chart restoration not confirmed');}catch(e){result.errors.push('Restore: '+e.message);}
 result.finishedAt=new Date().toISOString();mkdirSync('verification',{recursive:true});writeFileSync('verification/free-plan-local-probe.json',JSON.stringify(result,null,2));
 db.prepare('UPDATE market_jobs SET status=?,finished_at=?,done=?,success=?,failed=?,message=? WHERE id=?').run(result.errors.length?'failed':'completed',result.finishedAt,result.samples.length,result.samples.length,result.errors.length,'Diagnostic only: '+(result.errors.join('; ')||'one-minute samples read; original chart restored; no history or signals imported'),job);db.close();await disconnect();
 console.log(JSON.stringify(result));if(result.errors.length)process.exitCode=1;
}
