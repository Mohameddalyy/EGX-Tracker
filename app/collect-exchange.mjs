import{readFileSync,writeFileSync,mkdirSync,existsSync,renameSync}from'node:fs';import{dirname,join}from'node:path';import{fileURLToPath}from'node:url';import{cairoDate}from'./core.mjs';import{acquirePreparationLock}from'./preparation-lock.mjs';import{exchangeEndpoints,feedRequest,validateFeed,disclosureRecord,exchangeWindow}from'./exchange-feed.mjs';
const root=dirname(dirname(fileURLToPath(import.meta.url))),dir=join(root,'data','research','evidence','exchange');mkdirSync(dir,{recursive:true});mkdirSync(join(dir,'pages'),{recursive:true});mkdirSync(join(dir,'records'),{recursive:true});
const release=acquirePreparationLock(join(dir,'collector.lock'));
try{
 const arg=name=>process.argv.find(x=>x.startsWith('--'+name+'='))?.split('=')[1],today=cairoDate(new Date());
 const indexPath=join(dir,'index.json'),index=existsSync(indexPath)?JSON.parse(readFileSync(indexPath,'utf8')):{version:'egx-exchange-feed-1',windows:{},records:{},failures:[]};
 const {from,to}=exchangeWindow(index,today,{from:arg('from'),to:arg('to')}),key=from+'_'+to;
 feedRequest(exchangeEndpoints[0],from,to);
 if(process.argv.includes('--refresh')&&index.windows[key]){index.windowHistory??=[];index.windowHistory.push({...index.windows[key],archivedAt:new Date().toISOString()});delete index.windows[key];}
 const window=index.windows[key]||{from,to,endpoints:{}},deadline=Date.now()+5*60000;index.windows[key]=window;
 const save=()=>{index.updatedAt=new Date().toISOString();writeFileSync(indexPath+'.tmp',JSON.stringify(index,null,2));renameSync(indexPath+'.tmp',indexPath);};let fetched=0,reused=0;
 for(const endpoint of exchangeEndpoints){const state=window.endpoints[endpoint]||{pages:{},complete:false};window.endpoints[endpoint]=state;let page=1;
  while(Date.now()<deadline){if(state.totalPages!==undefined&&page>Math.max(1,state.totalPages))break;if(state.pages[page]){reused++;page++;continue;}
   const payload=feedRequest(endpoint,from,to,page),url='https://beta.egx.com.eg/api/bff/egx/'+endpoint,at=new Date().toISOString();
   try{const r=await fetch(url,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json','x-egx-bff-request':'1',Origin:'https://beta.egx.com.eg',Referer:'https://beta.egx.com.eg/en/media-center?tab=disclosure'},body:JSON.stringify(payload),signal:AbortSignal.timeout(30000)}),raw=await r.text(),path=join(dir,'pages',endpoint+'-'+at.replace(/[:.]/g,'-')+'-p'+page+'.json');writeFileSync(path,JSON.stringify({url,at,status:r.status,request:payload,body:raw}),{flag:'wx'});if(!r.ok)throw Error('HTTP '+r.status);const body=validateFeed(JSON.parse(raw),page);
    if(state.totalCount!==undefined&&body.totalCount!==state.totalCount)throw Error('Exchange result count changed during pagination; explicit window restart required');
    state.totalPages=body.totalPages;state.totalCount=body.totalCount;
    for(const item of body.data){const record=disclosureRecord(item,{url,capturedAt:at,pagePath:path}),id=record.code+'-'+record.contentDigest,recordPath=join(dir,'records',id+'.json');if(!existsSync(recordPath))writeFileSync(recordPath,JSON.stringify(record,null,2),{flag:'wx'});index.records[id]={code:record.code,tickers:record.tickers,isins:record.isins,date:record.sourceDate,path:recordPath};}
    state.pages[page]={path,count:body.data.length,at,codes:body.data.map(x=>x.code)};delete state.error;window.checkedAt=at;fetched++;save();page++;
   }catch(e){index.failures.push({endpoint,page,from,to,at,error:e.message});state.error=e.message;save();break;}
  }
  const pages=Object.values(state.pages),unique=new Set(pages.flatMap(x=>x.codes));state.complete=state.totalPages!==undefined&&pages.length>=Math.max(1,state.totalPages)&&unique.size===state.totalCount;save();
 }
 window.complete=exchangeEndpoints.every(e=>window.endpoints[e]?.complete);window.limitations=['Completeness applies only to the requested public endpoint categories and date window, not all corporate events or all financial periods.','Retained announcements and PDF links require substantive review; no trade clearance.'];save();
 console.log(JSON.stringify({from,to,fetched,reused,records:Object.keys(index.records).length,complete:window.complete,endpoints:Object.fromEntries(Object.entries(window.endpoints).map(([e,s])=>[e,{pages:Object.keys(s.pages).length,totalPages:s.totalPages,totalCount:s.totalCount,complete:s.complete,error:s.error}])),path:indexPath}));
 if(!window.complete)process.exitCode=1;
}finally{release();}
