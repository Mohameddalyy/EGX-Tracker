import http from 'node:http';
import {readFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {clientRoute} from './client-routes.mjs';
export function createClientServer(root=dirname(dirname(fileURLToPath(import.meta.url)))){
 const token=randomUUID();return http.createServer(async(req,res)=>{const send=(code,value,type='application/json')=>{res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; frame-ancestors 'none'"});res.end(type==='application/json'?JSON.stringify(value):value);};
 try{const port=req.socket.localPort;if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host))return send(403,{error:'Local access only'});const url=new URL(req.url,'http://'+req.headers.host);if(await clientRoute({root,url,req,send,token}))return;
 const files={'/':'client.html','/actions':'client.html','/client.js':'client.js','/client-render.js':'client-render.js','/client.css':'client.css'};if(req.method==='GET'&&files[url.pathname])return send(200,readFileSync(join(dirname(fileURLToPath(import.meta.url)),'public',files[url.pathname])),url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'text/html');send(404,{error:'Not found'});
 }catch(e){send(500,{error:e.message});}});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const port=Number(process.env.EGX_CLIENT_PORT||4318);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid client port');createClientServer().listen(port,'127.0.0.1',()=>console.log('W8 action desk: http://127.0.0.1:'+port+'/actions; no collectors or schedules started.'));}
