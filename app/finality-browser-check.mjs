import {createRequire} from 'node:module';import assert from 'node:assert/strict';import {openDb,ingest,snapshot} from './core.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.EGX_PLAYWRIGHT),browser=await chromium.launch({channel:'msedge',headless:true});
const db=openDb(':memory:'),now=new Date('2026-10-07T19:00:00Z');
const adjustment={symbolExt:{symbol:'COMI',exchange:'EGX',delay:900},symbolInfo:{exchange:'EGX',timezone:'Africa/Cairo',has_extended_hours:false,session:'1000-1430:12345',session_holidays:'20260101,20261008',delay:900,currency_code:'EGP'},properties:{dividendsAdjustment:false}};
const p={retrieved_at:'2026-10-07T11:00:00Z',stocks:[{ticker:'COMI',adjustment,history:{bars:Array.from({length:160},(_,i)=>({time:Date.parse('2026-10-07T07:00:00Z')/1000-(159-i)*86400,open:10,high:12,low:9,close:11,volume:1000}))}}]};
try{const page=await browser.newPage({viewport:{width:1450,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4317/#detail');await page.locator('#chart-date').filter({hasText:'Latest accepted close'}).waitFor();assert.match(await page.locator('#quality').innerText(),/30-minute buffer/);
 // Synthetic data is isolated in memory and intercepted only in this test browser.
 ingest(db,p);let fixture={...snapshot(db,['COMI'],now),attention:[],refreshing:false,token:'fixture'};
 await page.route('**/api/state',route=>route.fulfill({json:fixture}));await page.reload();await page.locator('#chart-date').filter({hasText:'2026-10-06'}).waitFor();assert.match(await page.locator('#quality').innerText(),/Some bars still need a fresh/);
 p.retrieved_at='2026-10-07T12:15:00Z';ingest(db,p);fixture={...snapshot(db,['COMI'],now),attention:[],refreshing:false,token:'fixture'};await page.reload();await page.locator('#chart-date').filter({hasText:'2026-10-07'}).waitFor();assert.match(await page.locator('#quality').innerText(),/cutoff 15:15:00 Cairo/);assert.match(await page.locator('#levels').innerText(),/2026-10-07/);
 await page.locator('#detail').screenshot({path:'verification/finality-fixture-desktop.png'});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);console.log('PASS: live timing copy; isolated pre/post-close UI, same-day levels, 15:15 cutoff, mobile layout and no page errors. No synthetic data saved to the real tracker.');
}finally{db.close();await browser.close();}
