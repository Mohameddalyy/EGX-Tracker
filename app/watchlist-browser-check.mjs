import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.EGX_PLAYWRIGHT);
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1450,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4317');await page.getByRole('button',{name:'TMGH',exact:true}).waitFor();
 for(const ticker of ['TMGH','HRHO','ETEL']){await page.getByRole('button',{name:ticker,exact:true}).click();if(!(await page.locator('#stock-code').innerText()).includes(ticker))throw Error('Selection failed');}
 await page.getByText('Manage stocks · add, pause or resume',{exact:true}).click();
 if(await page.locator('#universe-list .activity-row').count()!==6)throw Error('Missing watchlist controls');
 await page.locator('#watchlist').screenshot({path:'verification/watchlist-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.locator('#watchlist').screenshot({path:'verification/watchlist-mobile.png'});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile overflow');if(errors.length)throw Error(errors.join('; '));
 console.log('PASS: six stocks, new-stock detail views, management controls and desktop/mobile width.');
}finally{await browser.close();}
