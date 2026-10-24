// Bounded capability probe; saves evidence without changing trading rules.
import {writeFileSync} from 'node:fs';
const fields=['Recommend.All','Recommend.MA','Recommend.Other','Recommend.All|1W','Recommend.MA|1W','Recommend.Other|1W','RSI','MACD.macd','MACD.signal','ADX','relative_volume_10d_calc','dividends_yield_current','net_margin','return_on_assets','current_ratio','total_revenue_ttm','net_income_ttm','price_target_average','AnalystRating'];
const results=[];
for(const field of fields){
 try {const r=await fetch('https://scanner.tradingview.com/egypt/scan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({symbols:{tickers:['EGX:COMI','EGX:CIRA','EGX:AMOC']},columns:['name',field]}),signal:AbortSignal.timeout(15000)});const body=await r.json();results.push({field,status:r.status,body});}
 catch(e){results.push({field,error:e.message});}
}
const capturedAt=new Date().toISOString(),path='verification/tradingview-fields-'+capturedAt.replace(/[:.]/g,'-')+'.json';writeFileSync(path,JSON.stringify({capturedAt,source:'https://scanner.tradingview.com/egypt/scan',results},null,2),{flag:'wx'});console.log(JSON.stringify({path,results}));
