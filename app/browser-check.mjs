import {createRequire} from 'node:module';
import {mkdirSync} from 'node:fs';
const require=createRequire(import.meta.url);const {chromium}=require(process.env.EGX_PLAYWRIGHT);
const browser=await chromium.launch({channel:'msedge',headless:true});
try{const page=await browser.newPage({viewport:{width:1450,height:1050}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4317');await page.locator('#stocks tr').first().waitFor();
await page.getByRole('button',{name:'AMOC',exact:true}).click();if(!(await page.locator('#stock-name').innerText()).includes('Alexandria'))throw Error('Stock selection failed');await page.locator('#filter').selectOption('Long term');if(!(await page.locator('#stocks').innerText()).includes('No stocks'))throw Error('Horizon filter failed');await page.locator('#filter').selectOption('All horizons');await page.getByRole('button',{name:'COMI',exact:true}).click();
const start=await page.evaluate(()=>fetch('/api/state').then(r=>r.json()));const [response]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/refresh')&&r.request().method()==='POST'),page.getByRole('button',{name:'Refresh TradingView'}).click()]);if(response.status()!==202)throw Error('Refresh request rejected: '+await response.text());for(let i=0;i<125;i++){const current=await page.evaluate(()=>fetch('/api/state').then(r=>r.json()));if(!current.refreshing&&current.runs[0]?.id!==start.runs[0].id)break;await new Promise(resolve=>setTimeout(resolve,1000));}await new Promise(resolve=>setTimeout(resolve,2500));
const end=await page.evaluate(()=>fetch('/api/state').then(r=>r.json()));if(end.runs[0].id===start.runs[0].id||end.runs[0].status!=='success')throw Error('Refresh failed: '+end.runs[0]?.message);const barCount=end.stocks.reduce((n,s)=>n+s.bars.length,0);if(barCount<start.stocks.reduce((n,s)=>n+s.bars.length,0))throw Error('Refresh lost history');
const exportCheck=await page.request.get('http://127.0.0.1:4317/api/export');if(!(await exportCheck.text()).startsWith('ticker,day,time'))throw Error('CSV export failed');
mkdirSync('verification',{recursive:true});await page.screenshot({path:'verification/dashboard-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'verification/dashboard-mobile.png',fullPage:true});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);if(overflow)throw Error('Mobile page overflows');if(errors.length)throw Error(errors.join('; '));console.log(JSON.stringify({ui:'passed',refresh:end.runs[0],stocks:end.stocks.length,bars:barCount,mobileOverflow:overflow,pageErrors:errors}));
}finally{await browser.close();}



