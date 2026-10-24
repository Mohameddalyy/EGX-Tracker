import {join} from 'node:path';
import {readFileSync,unlinkSync} from 'node:fs';
import {workflowEvent} from './workflow-store.mjs';
export function recoverSourceLock(db,root,{source,token,actor,reason,isAlive},now=new Date()){
 if(!['exchange','library','library-inventory'].includes(source)||!token||!actor?.trim()||!reason?.trim())throw Error('Named source, exact lock token and recovery reason required');
 const path=join(root,'data/research/evidence',source==='library-inventory'?'library':source,source==='library-inventory'?'inventory.lock':'collector.lock');db.exec('BEGIN IMMEDIATE');try{const lock=JSON.parse(readFileSync(path,'utf8'));
 if(lock.token!==token||isAlive(lock.pid))throw Error('Source lock changed or owner remains alive');
 workflowEvent(db,null,'source-lock-recovery',{source,actor,reason,previousOwner:lock},now);unlinkSync(path);db.exec('COMMIT');return {source,recovered:true};
 }catch(e){db.exec('ROLLBACK');throw e;}
}
