import {ready,chartObservation} from './chart-readiness.mjs';
import {getState,setSymbol,setTimeframe} from '../integrations/tradingview-mcp/src/core/chart.js';
import {evaluate} from '../integrations/tradingview-mcp/src/connection.js';
const tickers=JSON.parse(process.env.EGX_TICKERS||'["COMI","AMOC","SWDY"]');
if(!Array.isArray(tickers)||!tickers.length||tickers.length>20||tickers.some(t=>typeof t!=='string'||!/^[A-Z][A-Z0-9-]{1,23}$/.test(t))||new Set(tickers).size!==tickers.length)throw Error('Invalid ticker list');
const streaming=process.env.EGX_STREAM_PROGRESS==='1'; const emit=x=>{if(streaming)process.stdout.write(JSON.stringify(x)+'\n');}; const original=await getState();const result={retrieved_at:new Date().toISOString(),stocks:[],errors:[]};
if(streaming&&process.send){await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Original chart checkpoint was not acknowledged')),5000);process.once('message',m=>{clearTimeout(timer);m?.type==='original-saved'?resolve():reject(Error('Invalid checkpoint acknowledgement'));});process.send({type:'original',original});});}
const deps={waitForChartReady:ready};let failed=false;
try{for(const ticker of tickers){try{const sw=await setSymbol({symbol:'EGX:'+ticker,_deps:deps});if(!sw.chart_ready)throw Error('Chart symbol did not become ready '+ticker);const tf=await setTimeframe({timeframe:'1D',_deps:deps});if(!sw.chart_ready||!tf.chart_ready)throw Error('Chart did not load '+ticker);
 const capture=await evaluate(`(()=>{const c=window.TradingViewApi._activeChartWidgetWV.value(),m=c._chartWidget.model().mainSeries(),b=m.bars(),p=m.properties().childs();let bars=[];for(let i=Math.max(b.firstIndex(),b.lastIndex()-499);i<=b.lastIndex();i++){const v=b.valueAt(i);if(v)bars.push({time:v[0],open:v[1],high:v[2],low:v[3],close:v[4],volume:v[5]??null});}return {adjustment:{symbolExt:c.symbolExt(),symbolInfo:m.symbolInfo(),properties:{dividendsAdjustment:p.dividendsAdjustment?.value(),backAdjustment:p.backAdjustment?.value()}},history:{bars},resolution:c.resolution(),chartType:c.chartType()};})()`);
 if(capture.resolution!=='1D'||capture.adjustment.symbolExt.symbol!==ticker||capture.chartType!==1||!/^EGX(?:_DLY)?$/.test(capture.adjustment.symbolExt.exchange||capture.adjustment.symbolInfo.exchange||''))throw Error('Unexpected exchange, chart series or chart type for '+ticker);const capturedAt=new Date().toISOString(); const stock={ticker,...capture}; result.stocks.push(stock); emit({type:'stock',retrieved_at:capturedAt,stock});}catch(e){result.errors.push({ticker,error:e.message}); let diagnostic;try{diagnostic=await chartObservation();}catch{}emit({type:'error',ticker,error:e.message,diagnostic});}}
}catch(e){result.error=e.message;failed=true;}
finally{try{const a=await setSymbol({symbol:original.symbol,_deps:deps}),b=await setTimeframe({timeframe:original.resolution,_deps:deps}),state=await getState();const verified=a.chart_ready&&b.chart_ready&&state.symbol===original.symbol&&state.resolution===original.resolution&&state.chartType===original.chartType;result.restore={symbol:a.chart_ready,timeframe:b.chart_ready,verified};if(!verified){result.error='Chart restoration did not complete';failed=true;}}catch(e){result.error='Restore failed: '+e.message;failed=true;}}
console.log(JSON.stringify(streaming?{type:'summary',retrieved_at:result.retrieved_at,restore:result.restore,error:result.error}:result));process.exit(failed?1:0);




