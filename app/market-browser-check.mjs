import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.EGX_PLAYWRIGHT);
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1450,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4317/#market');await page.locator('#market-status').filter({hasText:'296 catalog stocks'}).waitFor();
 if(await page.locator('#market-rows tr').count()!==25)throw Error('Pagination failed');
 await page.locator('#market-search').fill('ABUK');await page.locator('#market-rows button[data-ticker="ABUK"]').waitFor();
 if(await page.locator('#market-rows tr').count()!==1)throw Error('Ticker search failed');
 if(!await page.locator('#market-rows button').isEnabled())throw Error('Adding stocks must stay enabled while importing');
 await page.locator('#market-search').fill('zzzz-nomatch');if(!await page.getByText('No stocks match.',{exact:true}).isVisible())throw Error('Missing empty state');
 await page.locator('#market-search').fill('');await page.locator('#market-filter').selectOption('watchlist');if(await page.locator('#market-rows tr').count()!==6)throw Error('Market import polluted personal watchlist');
 await page.locator('#market-filter').selectOption('all');await page.locator('#market-search').fill('ABUK');
 await page.locator('#market').screenshot({path:'verification/market-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.locator('#market').screenshot({path:'verification/market-mobile.png'});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile overflow');
 if(errors.length)throw Error(errors.join('; '));console.log('PASS: market catalog, pagination, search, add controls, watchlist separation, empty state and mobile width. No personal watchlist changes.');
}finally{await browser.close();}
