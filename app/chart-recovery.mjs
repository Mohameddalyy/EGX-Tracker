export function initRecovery(db){db.exec(`CREATE TABLE IF NOT EXISTS chart_recovery(job_id INTEGER PRIMARY KEY,original TEXT NOT NULL,child_pid INTEGER,status TEXT NOT NULL,updated_at TEXT NOT NULL,detail TEXT);`);}
export function processAlive(pid){if(!Number.isSafeInteger(pid)||pid<=0)return false;try{process.kill(pid,0);return true;}catch(e){return e.code!=='ESRCH';}}
export function ownJob(db,id){return !!db.prepare("SELECT 1 FROM market_jobs WHERE id=? AND pid=? AND status='running'").get(id,process.pid);}
export function persistOriginal(db,id,childPid,original){
 if(!ownJob(db,id))throw Error('Cannot save chart recovery without importer ownership');
 if(typeof original?.symbol!=='string'||!original.symbol||typeof original.resolution!=='string'||!original.resolution)throw Error('Invalid original chart state');
 db.prepare("INSERT INTO chart_recovery VALUES(?,?,?,'pending',?,NULL) ON CONFLICT(job_id) DO UPDATE SET child_pid=excluded.child_pid,status='pending',updated_at=excluded.updated_at").run(id,JSON.stringify(original),childPid,new Date().toISOString());
}
export async function recoverChart(db,ownerId,restore){
 if(!ownJob(db,ownerId))throw Error('Cannot restore chart without importer ownership');
 const rows=db.prepare("SELECT * FROM chart_recovery WHERE status!='restored' ORDER BY job_id").all();
 for(const row of rows){
  if(processAlive(row.child_pid))throw Error('Collector still alive; chart restoration deferred');
  try{const result=await restore(JSON.parse(row.original));if(!result?.verified)throw Error('Chart restoration could not be verified');
   db.prepare("UPDATE chart_recovery SET status='restored',child_pid=NULL,updated_at=?,detail=? WHERE job_id=?").run(new Date().toISOString(),JSON.stringify(result),row.job_id);
  }catch(e){db.prepare("UPDATE chart_recovery SET status='failed',updated_at=?,detail=? WHERE job_id=?").run(new Date().toISOString(),e.message,row.job_id);throw e;}
 }
 return {restored:rows.length};
}
