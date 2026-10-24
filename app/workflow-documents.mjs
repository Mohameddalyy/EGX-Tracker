import {readFileSync,writeFileSync,existsSync,mkdirSync,renameSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {allowedDocumentUrl} from './document-library.mjs';
import {acquirePreparationLock} from './preparation-lock.mjs';
export function reportInventory(root,ids){return [...new Set(ids)].sort().map(id=>{if(!/^report-[a-zA-Z0-9-]+$/.test(id))return {id,status:'INVALID_ID'};const path=join(root,'data/research',id+'.json');if(!existsSync(path))return {id,status:'MISSING'};const s=statSync(path);return {id,size:s.size,mtimeMs:s.mtimeMs};});}
export function discoverReportRoutes(root,refs){
 const dir=join(root,'data/research/evidence/library');mkdirSync(dir,{recursive:true});const release=acquirePreparationLock(join(dir,'inventory.lock'));
 try{const path=join(dir,'route-inventory.json'),inventory=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{reports:{}},policy=JSON.parse(readFileSync(join(root,'research/source-policy.json'),'utf8'));let inspected=0,reused=0;const errors=[];
 for(const ref of refs){const old=inventory.reports[ref.id];if(ref.status){errors.push(ref);continue;}if(old?.size===ref.size&&old?.mtimeMs===ref.mtimeMs){reused++;continue;}
 try{const report=JSON.parse(readFileSync(join(root,'data/research',ref.id+'.json'),'utf8'));if(report.id!==ref.id||!Array.isArray(report.sources))throw Error('Report identity/source inventory invalid');
 inventory.reports[ref.id]={...ref,checkedAt:new Date().toISOString(),routes:report.sources.filter(s=>allowedDocumentUrl(s.url,policy.excludedDomains)).map(s=>({url:s.url,reportIds:[ref.id],tickers:(report.assessments||[]).map(a=>a.ticker),title:s.title,sourceAuthority:'UNREVIEWED_ROUTE'}))};inspected++;
 }catch(e){errors.push({id:ref.id,message:e.message});}
 }
 inventory.at=new Date().toISOString();inventory.errors=errors;writeFileSync(path+'.tmp',JSON.stringify(inventory,null,2));renameSync(path+'.tmp',path);return {status:errors.length?'partial':'succeeded',inspected,reused,path,errors,fetched:0,note:'Cited URL discovery only; no page fetched, source verified or recursive crawl performed'};
 }finally{release();}
}
