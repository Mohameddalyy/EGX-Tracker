// SQLite is the durable fallback. External delivery is separately acknowledged.
export function checkpointWriter(db,run,checkpoint,{timeoutMs=5000}={}) {
 let failed=null;
 return async report=>{
  const persist=()=>db.prepare("UPDATE workflow_runs SET report=? WHERE id=? AND owner=? AND status='running'").run(JSON.stringify(report),run.id,run.owner);
  report.delivery={status:failed?'FAILED':'PENDING',fallback:'workflow_runs.report',error:failed};persist();
  if(!failed){let timer;const controller=new AbortController();
   try{await Promise.race([Promise.resolve().then(()=>checkpoint(report,{signal:controller.signal})),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Checkpoint delivery timeout; late sink result cannot count as delivered'));},timeoutMs);})]);report.delivery={status:'DELIVERED',fallback:'workflow_runs.report',error:null};}
   catch(e){failed=e.message;report.delivery={status:'FAILED',fallback:'workflow_runs.report',error:failed};}
   finally{clearTimeout(timer);}
  }
  if(failed){report.incidents=[...(report.incidents||[]),{code:'REPORT_DELIVERY_FAILED',message:failed}];if(report.status==='completed')report.status='partial';}
  persist();return report;
 };
}
