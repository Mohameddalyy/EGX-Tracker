// Uses a temporary database and port. Never writes to the personal tracker database.
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawn} from 'node:child_process';import {createRequire} from 'node:module';
import {openDb} from './core.mjs';import {initMarket,importCatalog} from './market.mjs';import {researchContext} from './research-context-data.mjs';
const dir=mkdtempSync(join(tmpdir(),'egx-market-test-')),path=join(dir,'test.sqlite'),db=openDb(path);initMarket(db);
importCatalog(db,{totalCount:1,retrievedAt:new Date().toISOString(),stocks:[{name:'ABUK',symbol:'EGX:ABUK',description:'Abou Kir test fixture',exchange:'EGX',type:'stock',currency:'EGP'}]});
db.prepare("INSERT INTO market_jobs(status,pid,total) VALUES('running',?,1)").run(process.pid);db.close();
const child=spawn(process.execPath,['app/server.mjs'],{env:{...process.env,EGX_DATABASE:path,EGX_PORT:'4318'},windowsHide:true,stdio:'pipe'});let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
let browser;
try{
 let ready=false;for(let i=0;i<40;i++){try{if((await fetch('http://127.0.0.1:4318/api/market')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}if(!ready)throw Error(logs);
 const {chromium}=createRequire(import.meta.url)(process.env.EGX_PLAYWRIGHT);browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();
 await page.goto('http://127.0.0.1:4318');await page.locator('#stocks button[data-ticker="COMI"]').waitFor();
 await page.locator('#market-rows button[data-action="add"]').click();await page.locator('#stocks button[data-ticker="ABUK"]').waitFor();
 await page.locator('#research-scope').filter({hasText:'ABUK'}).waitFor();
 const verify=openDb(path);if(!researchContext(verify,{}).watchlist.includes('ABUK'))throw Error('Added stock missing from analyst context');verify.close();
 await page.getByText('Manage stocks · add, pause or resume',{exact:true}).click();await page.locator('#universe-list button[data-ticker="ABUK"]').click();
 await page.locator('#research-scope').filter({hasNotText:'ABUK'}).waitFor();await page.locator('#market-reload').click();await page.locator('#market-rows button[data-action="resume"]').click();await page.locator('#research-scope').filter({hasText:'ABUK'}).waitFor();
 const done=openDb(path);done.prepare("UPDATE market_jobs SET status='completed' WHERE status='running'").run();done.close();await page.locator('#market-reload').click();await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
 const result=await fetch('http://127.0.0.1:4318/api/market/import',{method:'POST'});if(result.status!==403)throw Error('Missing-token mutation was accepted');
 console.log('PASS: add during import, analyst context inclusion, pause/resume, refresh controls recover after import, and token protection using isolated database.');
}finally{if(browser)await browser.close();if(child.exitCode===null){const stopped=new Promise(r=>child.once('exit',r));child.kill();await stopped;}rmSync(dir,{recursive:true,force:true});}
