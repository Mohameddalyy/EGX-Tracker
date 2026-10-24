import {spawn} from 'node:child_process';
import {mkdirSync,appendFileSync,openSync,closeSync,readFileSync,unlinkSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';import {dirname,join} from 'node:path';import net from 'node:net';
const root=dirname(dirname(fileURLToPath(import.meta.url))),logs=join(root,'data','operations');mkdirSync(logs,{recursive:true});
const lock=join(logs,'supervisor.lock');
try{const pid=Number(readFileSync(lock,'utf8'));try{process.kill(pid,0);process.exit(0);}catch(e){if(e.code!=='ESRCH')process.exit(1);}unlinkSync(lock);}catch(e){if(e.code!=='ENOENT')throw e;}
const fd=openSync(lock,'wx');writeFileSync(fd,String(process.pid));closeSync(fd);
process.on('exit',()=>{try{if(readFileSync(lock,'utf8')===String(process.pid))unlinkSync(lock);}catch{}});
const log=message=>appendFileSync(join(logs,'supervisor.log'),new Date().toISOString()+' '+message+'\n');
const occupied=()=>new Promise(resolve=>{const socket=net.connect({host:'127.0.0.1',port:4317});const done=value=>{socket.destroy();resolve(value);};socket.once('connect',()=>done(true));socket.once('error',()=>done(false));socket.setTimeout(2000,()=>done(true));});
let working=false,previous='';
async function tick(){if(working)return;working=true;try{
 let healthy=false;try{const r=await fetch('http://127.0.0.1:4317/api/operations',{signal:AbortSignal.timeout(8000)});healthy=r.ok&&!!(await r.json()).generatedAt;}catch{}
 if(healthy){if(previous!=='healthy')log('Dashboard operations endpoint verified healthy.');previous='healthy';return;}
 if(await occupied()){if(previous!=='occupied')log('Port occupied but dashboard unhealthy; existing process untouched.');previous='occupied';return;}
 const stamp=Date.now(),out=openSync(join(logs,stamp+'.stdout.log'),'a'),err=openSync(join(logs,stamp+'.stderr.log'),'a');
 const child=spawn(process.execPath,['app/server.mjs'],{cwd:root,windowsHide:true,detached:true,stdio:['ignore',out,err],env:process.env});child.on('error',e=>log('Start failed: '+e.message));child.unref();closeSync(out);closeSync(err);log('Started dashboard; awaiting health verification.');previous='starting';
 }catch(e){log('Supervisor failure: '+e.message);}finally{working=false;}}
await tick();setInterval(tick,30000);
