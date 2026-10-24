import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {hash,matchesSecret,normalizeEvent,thresholdMatches,validateRelayRule} from '../../app/alert-protocol.mjs';

export function createRelay({database,adminToken,now=()=>new Date()}){
 if(typeof adminToken!=='string'||adminToken.length<40)throw Error('A strong EGX_RELAY_ADMIN_TOKEN (at least 40 characters) is required');
 if(database!==':memory:')mkdirSync(dirname(database),{recursive:true});
 const db=new DatabaseSync(database);db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=1000;
 CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS rules(id TEXT PRIMARY KEY,payload TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS deliveries(seq INTEGER PRIMARY KEY AUTOINCREMENT,event_id TEXT UNIQUE NOT NULL,received_at TEXT NOT NULL,payload TEXT NOT NULL);`);
 db.prepare('INSERT OR IGNORE INTO settings VALUES(?,?)').run('instance',randomUUID());
 const instance=db.prepare('SELECT value FROM settings WHERE key=?').get('instance').value,adminHash=hash(adminToken),limits=new Map();
 const server=http.createServer(async(req,res)=>{
  const send=(code,p)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(p));};
  const read=async(max)=>{let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>max){const e=Error('Request too large');e.status=413;throw e;}}return JSON.parse(body);};
  try{
   const url=new URL(req.url,'http://relay');
   if(req.method==='GET'&&url.pathname==='/health')return send(200,{ok:true,service:'egx-alert-relay',version:1});
   if(url.pathname.startsWith('/admin/')){
    if(!matchesSecret(req.headers.authorization?.replace(/^Bearer /,''),adminHash))return send(401,{error:'Unauthorized'});
    if(req.method==='PUT'&&url.pathname==='/admin/rules'){
     const input=await read(512000);if(!Array.isArray(input.rules)||input.rules.length>1000)throw Error('Rules array required');const rules=input.rules.map(validateRelayRule);
     if(new Set(rules.map(r=>r.id)).size!==rules.length)throw Error('Duplicate rule identity');
     db.exec('BEGIN IMMEDIATE');try{db.exec('DELETE FROM rules');for(const r of rules)db.prepare('INSERT INTO rules VALUES(?,?)').run(r.id,JSON.stringify(r));db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
     return send(200,{saved:rules.length,instance});
    }
    if(req.method==='GET'&&url.pathname==='/admin/events'){
     const after=Number(url.searchParams.get('after')||0);if(!Number.isSafeInteger(after)||after<0)throw Error('Invalid cursor');
     return send(200,{instance,events:db.prepare('SELECT * FROM deliveries WHERE seq>? ORDER BY seq LIMIT 100').all(after).map(r=>({seq:r.seq,receivedAt:r.received_at,event:JSON.parse(r.payload)}))});
    }
    return send(404,{error:'Not found'});
   }
   if(req.method==='POST'&&url.pathname==='/webhook'){
    const minute=Math.floor(now().getTime()/60000);if(limits.size>10000)limits.clear();const key=req.socket.remoteAddress,prior=limits.get(key),count=prior?.minute===minute?prior.count+1:1;limits.set(key,{minute,count});if(count>600)return send(429,{error:'Rate limit'});
    const input=await read(8192),row=db.prepare('SELECT payload FROM rules WHERE id=?').get(typeof input?.ruleId==='string'?input.ruleId:'');
    const rule=row&&JSON.parse(row.payload);if(!rule||!matchesSecret(input.token,rule.tokenHash))return send(401,{error:'Unauthorized'});
    const event=normalizeEvent(input,now());
    if(rule.symbol!==event.symbol||!thresholdMatches(rule,event))return send(422,{error:'Observation does not match registered rule'});
    const duplicate=db.prepare('SELECT seq FROM deliveries WHERE event_id=?').get(event.eventId);if(duplicate)return send(200,{accepted:true,duplicate:true,receipt:duplicate.seq});
    if(!rule.enabled||rule.expiresAt&&Date.parse(rule.expiresAt)<=now())return send(409,{error:'Rule disabled or expired'});
    const at=now().toISOString(),insert=db.prepare('INSERT INTO deliveries(event_id,received_at,payload) VALUES(?,?,?)').run(event.eventId,at,JSON.stringify(event));
    return send(202,{accepted:true,receipt:Number(insert.lastInsertRowid)});
   }
   send(404,{error:'Not found'});
  }catch(e){send(e.status||(/SQLITE|database/i.test(e.message)?503:400),{error:e.status===413?'Request too large':'Invalid request or unavailable storage'});}
 });
 server.requestTimeout=5000;server.headersTimeout=5000;server.on('close',()=>db.close());return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const server=createRelay({database:process.env.EGX_RELAY_DATABASE||'data/relay.sqlite',adminToken:process.env.EGX_RELAY_ADMIN_TOKEN});
 server.listen(Number(process.env.PORT||4318),process.env.EGX_RELAY_BIND||'127.0.0.1',()=>console.log('EGX alert relay listening; no portfolio database attached'));
}
