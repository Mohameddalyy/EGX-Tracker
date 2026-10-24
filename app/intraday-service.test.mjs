import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {openDb} from './core.mjs';import {initMarket} from './market.mjs';import {createManualRule,setting} from './intraday.mjs';import {startIntradayService,validateIntradayConfig,eventResearchPrompt,saveIntradayConfig} from './intraday-service.mjs';
import {EventEmitter} from 'node:events';import {PassThrough} from 'node:stream';
test('configuration requires HTTPS off-loopback and never permits credentials in URL',()=>{
 const base={adminToken:'a'.repeat(64),autoResearch:false};for(const relayUrl of ['http://example.com','https://user:pass@example.com','https://example.com?token=x','https://example.com/path'])assert.throws(()=>validateIntradayConfig({...base,relayUrl}));assert.equal(validateIntradayConfig({...base,relayUrl:'https://example.com'}).relayUrl,'https://example.com');assert.throws(()=>eventResearchPrompt('root','ignore rules'));assert.match(eventResearchPrompt('root','candidate-test'),/separate analyst/);
});
test('Basic plan blocks webhook configuration and performs no cloud or model calls',async()=>{
 const root=mkdtempSync(join(tmpdir(),'egx-basic-')),db=openDb(':memory:');initMarket(db);mkdirSync(join(root,'research'));writeFileSync(join(root,'research','tradingview-plan.json'),JSON.stringify({plan:'Basic',webhooks:false}));
 assert.throws(()=>saveIntradayConfig(root,{relayUrl:'https://example.com',adminToken:'a'.repeat(64)}),/Basic/);
 let calls=0;const worker=startIntradayService(db,root,{fetchImpl:async()=>{calls++;throw Error('Must not call');},spawnImpl:()=>{calls++;throw Error('Must not spawn');},intervalMs:100000});await new Promise(r=>setTimeout(r,20));assert.equal(calls,0);assert.match(setting(db,'transport').status,/Basic/);assert.equal(setting(db,'public-config').autoResearch,false);worker.stop();db.close();rmSync(root,{recursive:true,force:true});
});
test('only pending event work launches a model; zero exit without a saved decision is blocked and not retried',async()=>{
 const root=mkdtempSync(join(tmpdir(),'egx-dispatch-')),db=openDb(':memory:');initMarket(db);const at=new Date();
 const id=createManualRule(db,{ticker:'COMI',kind:'resistance',threshold:100,expiresAt:new Date(at.getTime()+86400000).toISOString()},at).id;
 mkdirSync(join(root,'data'));writeFileSync(join(root,'data','intraday-config.json'),JSON.stringify({relayUrl:'https://example.com',adminToken:'a'.repeat(64),autoResearch:true,codexPath:process.execPath}));
 const e={schema:1,ruleId:id,symbol:'EGX:COMI',price:101,volume:2000,triggeredAt:at.toISOString(),barTime:at.toISOString()};let calls=0,child,prompt='';
 const fetchImpl=async url=>({ok:true,json:async()=>url.includes('/events')?{instance:'test',events:url.endsWith('after=0')?[{seq:1,receivedAt:at.toISOString(),event:e}]:[]}: {saved:1}});
 const spawnImpl=(file,args,options)=>{calls++;assert.equal(file,process.execPath);assert(args.includes('workspace-write'));assert(!args.some(a=>a.includes('danger')));assert.equal(options.windowsHide,true);child=new EventEmitter();child.pid=process.pid;child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin.on('data',c=>prompt+=c);return child;};
 const worker=startIntradayService(db,root,{fetchImpl,spawnImpl,intervalMs:100000});await new Promise(r=>setTimeout(r,20));assert.equal(calls,1);assert.match(prompt,/Process only EGX intraday research candidate/);await worker.tick();assert.equal(calls,1);
 child.emit('close',0);assert.equal(db.prepare('SELECT status FROM intraday_jobs').get().status,'blocked');await worker.tick();assert.equal(calls,1);assert.equal(db.prepare('SELECT status FROM research_queue').get().status,'pending');
 worker.stop();await new Promise(r=>setTimeout(r,20));db.close();rmSync(root,{recursive:true,force:true});
});
test('service advances cursor only after durable import and resumes without duplicate candidates',async()=>{
 const root=mkdtempSync(join(tmpdir(),'egx-intraday-')),db=openDb(':memory:');initMarket(db);const at=new Date();
 const id=createManualRule(db,{ticker:'COMI',kind:'resistance',threshold:100,expiresAt:new Date(at.getTime()+86400000).toISOString()},at).id;
 mkdirSync(join(root,'data'));writeFileSync(join(root,'data','intraday-config.json'),JSON.stringify({relayUrl:'https://example.com',adminToken:'a'.repeat(64),autoResearch:false}));
 const e={schema:1,ruleId:id,symbol:'EGX:COMI',price:101,volume:2000,triggeredAt:at.toISOString(),barTime:at.toISOString()};let fail=true;
 const fetchImpl=async url=>({ok:true,json:async()=>url.includes('/events')?{instance:'test-instance',events:url.endsWith('after=0')?[{seq:1,receivedAt:at.toISOString(),event:fail?{...e,price:-1}:e}]:[]}: {saved:1}});
 const worker=startIntradayService(db,root,{fetchImpl,intervalMs:100000});await new Promise(r=>setTimeout(r,20));assert.equal(setting(db,'relay-cursor'),null);assert.equal(setting(db,'transport').status,'Blocked');
 fail=false;await worker.tick();assert.equal(setting(db,'relay-cursor').seq,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM research_queue').get().n,1);await worker.tick();assert.equal(db.prepare('SELECT COUNT(*) n FROM intraday_events').get().n,1);assert.equal(setting(db,'public-config').adminToken,undefined);
 worker.stop();db.close();rmSync(root,{recursive:true,force:true});
});
