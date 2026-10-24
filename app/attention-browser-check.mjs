// Requires isolated EGX_DATABASE=:memory: server.
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.EGX_PLAYWRIGHT);
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1450,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4317');await page.locator('#attention-items button[data-key]').first().waitFor();
 const key=await page.locator('#attention-items button[data-key]').first().getAttribute('data-key');
 await page.locator(`#attention-items button[data-key="${key}"]`).click();
 await page.locator('#attention-filter').selectOption('active');
 await page.locator(`#attention-items button[data-key="${key}"][data-reviewed="false"]`).waitFor();
 await page.reload();await page.locator('#attention-filter').selectOption('active');
 await page.locator(`#attention-items button[data-key="${key}"][data-reviewed="false"]`).waitFor();
 await page.locator(`#attention-items button[data-key="${key}"]`).click();
 await page.locator(`#attention-items button[data-key="${key}"][data-reviewed="true"]`).waitFor();
 const stockButton=page.locator('#attention-items button[data-stock]').first(),ticker=await stockButton.getAttribute('data-stock');await stockButton.click();
 if(!(await page.locator('#stock-code').innerText()).includes(ticker))throw Error('Stock navigation failed');
 await page.locator('#attention-items summary').first().click();
 await page.locator('#attention').screenshot({path:'verification/attention-desktop.png'});await page.setViewportSize({width:390,height:844});await page.locator('#attention').screenshot({path:'verification/attention-mobile.png'});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile overflow');if(errors.length)throw Error(errors.join('; '));
 console.log('PASS: review/reopen persistence, stock navigation, evidence expansion, desktop/mobile layouts.');
}finally{await browser.close();}
