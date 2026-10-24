import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {randomUUID} from 'node:crypto';

// Atomic creation prevents simultaneous index writers. A crash leaves an explicit
// recovery marker; it must not be mistaken for permission to replace an owner.
export function acquirePreparationLock(path){
 const token=randomUUID(),owner={token,pid:process.pid,startedAt:new Date().toISOString()};
 try{writeFileSync(path,JSON.stringify(owner),{flag:'wx'});}
 catch(error){if(error.code==='EEXIST')throw Error('Document preparation owner exists. Verify the recorded process has exited before explicitly removing its lock.');throw error;}
 return ()=>{try{if(JSON.parse(readFileSync(path,'utf8')).token===token)unlinkSync(path);}catch(e){if(e.code!=='ENOENT')throw e;}};
}
