// Only against an isolated EGX_DATABASE=:memory: server.
import {createRequire} from 'node:module';const {chromium}=createRequire(import.meta.url)(process.env.EGX_PLAYWRIGHT);
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1450,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4317');
 await page.evaluate(async()=>{const s=await fetch('/api/state').then(r=>r.json()),stock=s.stocks.find(x=>x.ticker==='COMI');const r=await fetch('/api/journal',{method:'POST',headers:{'Content-Type':'application/json','X-EGX-Token':s.token},body:JSON.stringify({requestId:crypto.randomUUID(),ticker:'COMI',capturedAt:stock.retrieved_at,asOf:stock.latest.day,horizon:'Short term',thesis:'QA position',invalidation:'QA invalidation',entry:100,stop:90,target:130})});if(!r.ok)throw Error(await r.text());});
 await page.reload();await page.getByText('Record an actual fill',{exact:true}).click();
 async function fill(side,quantity,price,day){const f=page.locator('.fill-form');await f.locator('[name=side]').selectOption(side);await f.locator('[name=day]').fill(day);await f.locator('[name=quantity]').fill(String(quantity));await f.locator('[name=price]').fill(String(price));await f.locator('[name=fees]').fill('10');const response=page.waitForResponse(r=>r.url().endsWith('/api/fills')&&r.request().method()==='POST');await f.getByRole('button',{name:'Save actual fill'}).click();if((await response).status()!==201)throw Error('Fill rejected');}
 await fill('Buy',100,100,'2026-01-01');await page.getByText('100 shares held',{exact:true}).waitFor();await page.getByText('Record an actual fill',{exact:true}).click();await fill('Sell',40,110,'2026-01-02');await page.getByText('60 shares held',{exact:true}).waitFor();
 let e=await page.evaluate(()=>fetch('/api/journal').then(r=>r.json()));if(e[0].position.realized!==386||e[0].position.costBasis!==6006)throw Error('Accounting mismatch');
 await page.getByText('Fill history and corrections (2)',{exact:true}).click();await page.locator('.void-fill input').fill('QA correction');await page.getByRole('button',{name:'Void latest fill'}).click();await page.getByText('100 shares held',{exact:true}).waitFor();
 await page.reload();await page.getByText('100 shares held',{exact:true}).waitFor();
 await page.locator('.position-record').screenshot({path:'verification/positions-desktop.png'});await page.setViewportSize({width:390,height:844});await page.locator('.position-record').screenshot({path:'verification/positions-mobile.png'});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile overflow');if(errors.length)throw Error(errors.join('; '));console.log('PASS: buy, partial sell, cost/P&L, audited void, reload persistence and responsive position panel.');
}finally{await browser.close();}
