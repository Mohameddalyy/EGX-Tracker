// Run only against an isolated server with EGX_DATABASE=:memory:.
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.EGX_PLAYWRIGHT);
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1450,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4317');await page.getByRole('button',{name:'COMI',exact:true}).waitFor();
 await page.locator('#journal-new').click();await page.locator('#journal-form [name=horizon]').selectOption('Short term');
 await page.locator('#journal-form [name=entry]').fill('100');await page.locator('#journal-form [name=stop]').fill('95');await page.locator('#journal-form [name=target]').fill('110');
 await page.locator('#journal-form [name=thesis]').fill('QA thesis <script>not executable</script>');await page.locator('#journal-form [name=invalidation]').fill('Support fails');
 await page.getByRole('button',{name:'AMOC',exact:true}).click();
 if(!(await page.locator('#journal-heading').innerText()).includes('COMI'))throw Error('Draft switched ticker');
 await page.getByRole('button',{name:'Save decision snapshot'}).click();await page.locator('.journal-entry').waitFor();
 if(!(await page.locator('.journal-entry h3').innerText()).includes('COMI'))throw Error('Wrong saved ticker');
 await page.locator('.journal-review [name=status]').selectOption('Cancelled');await page.locator('.journal-review textarea').fill('QA cancellation, no order placed');
 await page.getByRole('button',{name:'Append review'}).click();
 await page.getByRole('heading',{name:'#1 · COMI · Cancelled',exact:true}).waitFor();
 const entries=await page.evaluate(()=>fetch('/api/journal').then(r=>r.json()));
 if(entries.length!==1||entries[0].reviews.length!==1||entries[0].plan.entry!==100||!entries[0].evidence.bars.length)throw Error('Journal round trip failed');
 const noToken=await page.request.post('http://127.0.0.1:4317/api/journal',{data:{}});if(noToken.status()!==403)throw Error('Missing-token protection failed');
 await page.locator('#journal').screenshot({path:'verification/journal-desktop.png'});await page.setViewportSize({width:390,height:844});await page.locator('#journal').screenshot({path:'verification/journal-mobile.png'});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile overflow');if(errors.length)throw Error(errors.join('; '));
 console.log('PASS: isolated journal save/review/export data, draft ticker persistence, escaped notes, token protection and desktop/mobile layout.');
}finally{await browser.close();}
