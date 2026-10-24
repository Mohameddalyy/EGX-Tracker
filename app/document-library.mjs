import {readFileSync,writeFileSync,mkdirSync,existsSync,renameSync} from 'node:fs';
import {join} from 'node:path';import {createHash} from 'node:crypto';
export function retainDocumentVersion(index,item){
 if(!item?.url||!item?.sha256||!item.bodyPath)return;
 index.versions??={};
 const id=createHash('sha256').update(JSON.stringify([item.url,item.sha256,item.capturedAt])).digest('hex');
 index.versions[id]??=structuredClone(item);
}
export function allowedDocumentUrl(value,excluded=[]){try{const u=new URL(value),h=u.hostname.toLowerCase();return u.protocol==='https:'&&!u.username&&!u.password&&!/^\[|^[\d.]+$/.test(h)&&h.includes('.')&&h!=='localhost'&&!h.endsWith('.local')&&!excluded.some(x=>h===x||h.endsWith('.'+x));}catch{return false;}}
export async function captureDocument(url,{directory,excluded,previous=null,fetcher=fetch,now=new Date(),maxBytes=20000000}={}){
 if(!allowedDocumentUrl(url,excluded))throw Error('Excluded or invalid document URL');
 const headers={};if(previous?.bodyPath&&existsSync(previous.bodyPath)){if(previous.etag)headers['If-None-Match']=previous.etag;if(previous.lastModified)headers['If-Modified-Since']=previous.lastModified;}
 let target=url,response;
 for(let hop=0;hop<6;hop++){
  response=await fetcher(target,{headers,redirect:'manual',signal:AbortSignal.timeout(20000)});
  if([301,302,303,307,308].includes(response.status)){target=new URL(response.headers.get('location'),target).href;if(!allowedDocumentUrl(target,excluded))throw Error('Redirect reached excluded/invalid domain');continue;}break;
 }
 if(response.status===304){if(!previous?.bodyPath||!existsSync(previous.bodyPath)||previous.finalUrl!==target)throw Error('304 without matching retained resource');return {...previous,checkedAt:now.toISOString(),status:'REVALIDATED',publicationVerified:false};}
 if(!response.ok)throw Error('HTTP '+response.status);
 if(Number(response.headers.get('content-length'))>maxBytes)throw Error('Document exceeds size limit; manual retrieval required');
 const chunks=[];let n=0;for await(const chunk of response.body){n+=chunk.length;if(n>maxBytes)throw Error('Document exceeds size limit; manual retrieval required');chunks.push(chunk);}
 const body=Buffer.concat(chunks);if(!body.length)throw Error('Empty document');const hash=createHash('sha256').update(body).digest('hex');mkdirSync(directory,{recursive:true});const path=join(directory,hash+'.bin');if(!existsSync(path))writeFileSync(path,body,{flag:'wx'});
 return {url,finalUrl:target,status:'CAPTURED_UNREVIEWED',checkedAt:now.toISOString(),capturedAt:now.toISOString(),bodyPath:path,sha256:hash,bytes:n,contentType:response.headers.get('content-type'),etag:response.headers.get('etag'),lastModified:response.headers.get('last-modified'),publicationVerified:false,note:'Saved response only; verify document identity, completeness, publication, and whether it is a challenge/summary page before extracting facts.'};
}
