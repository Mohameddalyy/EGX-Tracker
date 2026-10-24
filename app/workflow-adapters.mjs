import {spawn} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync,mkdirSync,openSync,closeSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {recordChild} from './workflow-store.mjs';
import {readWorkflowInputs,readJson} from './workflow-inputs.mjs';
import {sourcePermission} from './workflow-planner.mjs';
export function runWorkflowProcess(file,args,{cwd,env={},signal,logPath,onChild=()=>{},spawnImpl=spawn}={}){
 return new Promise((resolveResult,reject)=>{
  const fd=openSync(logPath,'a');let child,aborted=false,ownerError=null;
  try{child=spawnImpl(process.execPath,[file,...args],{cwd,windowsHide:true,stdio:['ignore',fd,fd],env:{...process.env,...env}});}catch(e){closeSync(fd);reject(e);return;}
  closeSync(fd);
  const abort=()=>{aborted=true;child.kill();};signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  child.once('error',e=>{signal?.removeEventListener('abort',abort);reject(e);});child.once('close',(code,exitSignal)=>{signal?.removeEventListener('abort',abort);if(ownerError)return reject(ownerError);resolveResult({status:aborted?'timeout':code===0?'succeeded':'failed',exitCode:code,exitSignal,logPath,incident:aborted?'COMPUTATIONAL_OVERRUN':code===0?null:'TOOL_OR_PROVIDER_FAILURE'});});
  if(child.pid)try{onChild(child.pid);}catch(e){ownerError=e;child.kill();}
 });
}
export function workflowAdapter(db,root){
 return async(job,{signal,budgetMs,owner})=>{
 const p={...job.payload},dir=join(root,'data/operations/workflow-artifacts');mkdirSync(dir,{recursive:true});const prefix=join(dir,job.id+'-'+job.attempts),logPath=prefix+'.log',inputPath=prefix+'.input.json',outputPath=prefix+'.result.json';
 const external=['catalog','facts','facts-repair','history','exchange','documents','minutes'].includes(p.kind);
 if(external){const access=readJson(join(root,'agent/source-access.json'),{}),permission=access[p.source];
  if(!sourcePermission(access,p.source,new Date())||!existsSync(resolve(root,permission?.evidencePath||'__missing__')))return {status:'blocked',incident:'PERMISSION_UNRESOLVED',source:p.source,retryMs:86400000,message:'Applicable recorded source permission/capability evidence required; no collection attempted'};
  if(p.kind==='documents'&&p.routes.some(r=>!permission.allowedHosts?.includes(new URL(r.url).hostname)))return {status:'blocked',incident:'PERMISSION_UNRESOLVED',retryMs:86400000,message:'Document permission must explicitly cover every selected hostname; generic issuer access does not authorize other providers'};
 }
 const options={cwd:root,signal,logPath,onChild:pid=>recordChild(db,job.id,owner,pid)};
 if(p.kind==='decision-monitor'){const previous=db.prepare("SELECT result FROM workflow_jobs WHERE kind=? AND target=? AND id!=? AND status='succeeded' ORDER BY finished_at DESC LIMIT 1").get(p.kind,p.target,job.id);p.previousEvidenceFingerprint=previous?JSON.parse(previous.result).evidenceFingerprint:null;}
 if(p.kind==='queue-resume')p.fingerprints=readWorkflowInputs(root).evidenceFingerprints;
 writeFileSync(inputPath,JSON.stringify(p),{flag:'wx'});
 if(['health','positions','minute-obligations','decision-monitor','queue-resume','learning-export','screen','document-discovery','catalog-import'].includes(p.kind)){
  const processResult=await runWorkflowProcess(join(root,'app/workflow-worker.mjs'),[root,inputPath,outputPath],options);
  if(processResult.status!=='succeeded')return {...readJson(outputPath,{}),...processResult,logPath};
  return {...readJson(outputPath,{status:'failed',message:'Worker did not save its result'}),logPath};
 }
 let file,args=[],env={};
 switch(p.kind){
 case 'catalog':file='discover-market.mjs';break;
 case 'facts':file='collect-facts.mjs';break;
 case 'facts-repair':file='reconcile-facts.mjs';args=['--tickers='+p.tickers.join(',')];break;
 case 'history':file='import-market.mjs';args=['--tickers='+p.target,'--due'];env.EGX_IMPORT_DEADLINE_MS=String(Math.max(1000,budgetMs-70000));break;
 case 'minutes':file='collect-paper-minutes.mjs';args=['--observation-only',...p.tickers];env.EGX_SOURCE_DEADLINE_MS=String(Math.max(1000,budgetMs-45000));env.EGX_WORKFLOW_RESULT=outputPath;break;
 case 'exchange':file='collect-exchange.mjs';args=['--from='+p.from,'--to='+p.to,'--coverage-cutoff='+p.coverageCutoff];env.EGX_SOURCE_DEADLINE_MS=String(Math.max(1000,budgetMs-35000));break;
 case 'documents':{file='collect-documents.mjs';const routes=prefix+'.routes.json';writeFileSync(routes,JSON.stringify(p.routes),{flag:'wx'});args=['--only-routes','--routes='+routes];env.EGX_SOURCE_DEADLINE_MS=String(Math.max(1000,budgetMs-25000));break;}
 case 'preparation':file='prepare-data.mjs';break;
 default:throw Error('Unsupported workflow adapter '+p.kind);
 }
 const processResult=await runWorkflowProcess(join(root,'app',file),args,{...options,env});if(processResult.status!=='succeeded')return processResult;
 if(p.kind==='minutes'){const result=readJson(outputPath,{status:'failed',message:'Minute receipt missing'});return {...result,logPath,fetched:result.status==='succeeded'?result.tickers.length:0};}
 // Validate component receipts after process success; exit zero alone is not data completeness.
 const input=readWorkflowInputs(root),now=new Date();let complete=true,watermark=null;
 if(p.kind==='history'){const s=input.stocks.find(s=>s.ticker===p.target);complete=!!s&&!s.readiness.due;watermark=s?.latest?.day||null;}
 if(p.kind==='exchange'){const w=input.exchangeWindows.find(w=>w.from===p.from&&w.to===p.to);complete=!!w?.complete&&Object.values(w.endpoints||{}).flatMap(e=>Object.values(e.pages||{})).every(page=>Date.parse(page.at)>=Date.parse(p.coverageCutoff));watermark=w?{throughDay:w.to,checkedAt:w.checkedAt,scope:'Requested public categories only; no substantive event clearance'}:null;}
 if(p.kind==='documents'){const selected=input.documents.filter(d=>p.routes.some(r=>r.url===d.url));complete=selected.length===p.routes.length&&selected.every(d=>d.status!=='UNAVAILABLE'&&Date.parse(d.checkedAt)>=Date.parse(job.started_at||job.created_at));watermark=selected.map(d=>({url:d.url,sha256:d.sha256,checkedAt:d.checkedAt}));}
 if(p.kind==='facts')complete=['facts-stocks','facts-benchmarks'].every(c=>input.receipts.some(r=>r.component===c&&r.target===p.revision&&r.status==='completed'));
 if(p.kind==='facts-repair'){const receipt=input.receipts.find(r=>r.component==='facts-reconciliation'&&r.target===p.receiptTarget);complete=receipt?.status==='completed'&&p.tickers.every(t=>receipt.payload.found?.includes(t));watermark=receipt?.payload||null;}
 if(p.kind==='catalog'){complete=Date.parse(input.catalogCapturedAt)>=Date.parse(job.started_at);watermark={capturedAt:input.catalogCapturedAt,scope:'Provider catalog snapshot; local catalog-import job applies it. Not official listing clearance.'};}
 if(p.kind==='preparation'){const receipt=input.receipts.find(r=>r.component==='baseline'&&r.target==='latest');complete=Date.parse(receipt?.at)>=Date.parse(job.started_at);watermark={at:receipt?.at,path:receipt?.payload?.path,scope:'Field availability manifest published; missing fields remain unresolved.'};}
 return {status:complete?'succeeded':'partial',incident:complete?null:'INCOMPLETE_SOURCE_COMPONENT',source:p.source||'local',watermark,observedAt:now.toISOString(),logPath,fetched:1};
 };
}
