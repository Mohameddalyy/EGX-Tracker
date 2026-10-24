import {test} from 'node:test';import assert from 'node:assert/strict';import {once} from 'node:events';
import {createRelay} from '../cloud/alert-relay/server.mjs';import {hash} from './alert-protocol.mjs';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
const admin='a'.repeat(64),token='b'.repeat(64),id='alert-'+'c'.repeat(24),now=new Date('2026-10-09T10:00:00Z');
test('HTTP relay authenticates rules/webhooks, rejects malformed events, deduplicates retries and protects inbox',async()=>{
 const server=createRelay({database:':memory:',adminToken:admin,now:()=>now});server.listen(0,'127.0.0.1');await once(server,'listening');
 const base='http://127.0.0.1:'+server.address().port;
 const request=(path,body,method='POST',auth=null)=>fetch(base+path,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{})},...(body?{body:JSON.stringify(body)}:{})});
 try{
  const rule={id,symbol:'EGX:COMI',tokenHash:hash(token),kind:'resistance',direction:'above',threshold:100,enabled:true,expiresAt:null};
  assert.equal((await request('/admin/rules',{rules:[rule]},'PUT')).status,401);
  assert.equal((await request('/admin/rules',{rules:[rule]},'PUT',admin)).status,200);
  const e={schema:1,ruleId:id,token,symbol:'EGX:COMI',price:'101',volume:'2000',triggeredAt:now.toISOString(),barTime:now.toISOString()};
  assert.equal((await request('/webhook',{...e,token:'wrong'})).status,401);assert.equal((await request('/webhook',{...e,price:99})).status,422);
  assert.equal((await request('/webhook',{...e,symbol:'NASDAQ:COMI'})).status,400);
  assert.equal((await request('/webhook',e)).status,202);assert.equal((await(await request('/webhook',e)).json()).duplicate,true);
  assert.equal((await request('/admin/events',null,'GET')).status,401);const data=await(await request('/admin/events',null,'GET',admin)).json();assert.equal(data.events.length,1);assert(!JSON.stringify(data).includes(token));assert(!JSON.stringify(data).includes(admin));
  assert.equal((await request('/webhook',{...e,unexpected:'x'.repeat(9000)})).status,413);
  await request('/admin/rules',{rules:[{...rule,enabled:false}]},'PUT',admin);assert.equal((await request('/webhook',{...e,price:102})).status,409);
  assert.equal((await request('/webhook',e)).status,200); // accepted retries remain idempotent after a pause
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('accepted deliveries and deduplication survive receiver restart while the local PC is offline',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'egx-relay-')),database=join(dir,'relay.sqlite');let server,base;
 const start=async()=>{server=createRelay({database,adminToken:admin,now:()=>now});server.listen(0,'127.0.0.1');await once(server,'listening');base='http://127.0.0.1:'+server.address().port;};
 const stop=async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));};
 const call=(path,body,method='POST')=>fetch(base+path,{method,headers:{Authorization:'Bearer '+admin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 try{await start();await call('/admin/rules',{rules:[{id,symbol:'EGX:COMI',tokenHash:hash(token),kind:'resistance',direction:'above',threshold:100,enabled:true,expiresAt:null}]},'PUT');
  const e={schema:1,ruleId:id,token,symbol:'EGX:COMI',price:101,volume:2000,triggeredAt:now.toISOString(),barTime:now.toISOString()};assert.equal((await call('/webhook',e)).status,202);
  const first=await(await call('/admin/events',null,'GET')).json();await stop();await start();
  const next=await(await call('/admin/events',null,'GET')).json();assert.equal(next.instance,first.instance);assert.deepEqual(next.events,first.events);assert.equal((await(await call('/webhook',e)).json()).duplicate,true);
 }finally{if(server?.listening)await stop();rmSync(dir,{recursive:true,force:true});}
});
