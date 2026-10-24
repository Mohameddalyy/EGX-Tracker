import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.EGX_PLAYWRIGHT),browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1450,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4317/#intraday');await page.locator('#intraday-health').filter({hasText:/Not connected|Basic plan/}).waitFor();
 assert.match(await page.locator('#intraday').innerText(),/10 PM Cairo/);assert.match(await page.locator('#intraday').innerText(),/No events received/);assert.match(await page.locator('#intraday-free-info').innerText(),/3 active price alerts/);assert.equal(await page.locator('#intraday-cloud-settings').isVisible(),false);
 await page.locator('#intraday').screenshot({path:'verification/intraday-desktop.png'});
 const rule={id:'alert-'+'c'.repeat(24),ticker:'COMI',scope:'manual',kind:'resistance',threshold:100,direction:'above',label:'SYNTHETIC UI FIXTURE',delaySeconds:900,expiresAt:new Date(Date.now()+86400000).toISOString(),enabled:true,current:true};
 const state={rules:[rule],events:[],jobs:[],watchlist:['COMI','AMOC'],config:{configured:false,autoResearch:false},transport:{status:'Not connected',message:'SYNTHETIC UI FIXTURE; no real alerts registered'}};let added=false,toggled=false;
 await page.route('**/api/intraday',r=>r.fulfill({json:state}));
 await page.route('**/api/intraday/template',r=>r.fulfill({json:{rule,message:'{"fixture":"no real credentials"}',condition:'Price above 100 EGP',note:'Isolated UI fixture'}}));
 await page.route('**/api/intraday/toggle',r=>{assert.equal(r.request().postDataJSON().enabled,false);rule.enabled=false;toggled=true;return r.fulfill({json:{saved:true}});});
 await page.route('**/api/intraday/rules',r=>{const p=r.request().postDataJSON();assert.equal(p.ticker,'COMI');assert.equal(p.threshold,103);added=true;return r.fulfill({json:{id:rule.id}});});
 await page.reload();await page.getByRole('button',{name:'Setup instructions',exact:true}).click();assert.match(await page.locator('#intraday-template').innerText(),/Pending cloud deployment/);assert.equal(await page.getByLabel('TradingView alert message').inputValue(),'{"fixture":"no real credentials"}');
 await page.getByRole('button',{name:'Hide message'}).click();assert.equal(await page.locator('#intraday-template').isVisible(),false);
 await page.getByRole('button',{name:'Pause',exact:true}).click();await page.getByRole('button',{name:'Enable',exact:true}).waitFor();assert(toggled);
 await page.getByText('Add a watchlist research alert',{exact:true}).click();await page.locator('#intraday-rule-form [name=threshold]').fill('103');await page.getByRole('button',{name:'Add research rule',exact:true}).click();assert(added);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.locator('#intraday').screenshot({path:'verification/intraday-mobile.png'});
 assert.deepEqual(errors,[]);console.log('PASS: local disconnected status, isolated rule template/hide/pause/create flows, desktop/mobile, no JS errors. No real rules, events, fills, credentials or notifications changed by browser fixtures.');
}finally{await browser.close();}
