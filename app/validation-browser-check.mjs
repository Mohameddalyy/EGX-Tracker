import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.EGX_PLAYWRIGHT);
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1450,height:1050}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4317');
 await page.getByText('Support below price',{exact:true}).waitFor();
 for(const ticker of ['COMI','AMOC','SWDY']){
   await page.getByRole('button',{name:ticker,exact:true}).click();
   const replayText=await page.locator('#replay').innerText();if(!replayText.includes(ticker)||!replayText.includes('completed trades'))throw Error('Missing replay');const text=await page.locator('#levels').innerText();
   if(!text.includes(ticker)||!text.includes('Stop-loss candidates')||!text.includes('ATR buffer'))throw Error('Missing levels for '+ticker);
 }
 await page.getByRole('button',{name:'COMI',exact:true}).click();
 const evidence=page.locator('#levels summary').first();await evidence.click();
 await page.locator('#replay').screenshot({path:'verification/replay-desktop.png'});
 await page.setViewportSize({width:390,height:844});
 await page.locator('#replay').screenshot({path:'verification/replay-mobile.png'});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile overflow');
 if(errors.length)throw Error(errors.join('; '));
 console.log('PASS: all 3 stocks, stop candidates, evidence expansion, desktop/mobile layouts; no page errors.');
} finally {await browser.close();}

