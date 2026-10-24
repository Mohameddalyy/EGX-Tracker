import {performance} from 'node:perf_hooks';
export function createStageTiming({clock=()=>new Date(),monotonic=()=>performance.now(),onUpdate=()=>{}}={}){
 const startedAt=clock().toISOString(),start=monotonic(),stages=[];
 const snapshot=()=>({version:'stage-timing-1',startedAt,observedAt:clock().toISOString(),elapsedMs:Math.max(0,monotonic()-start),stages:[...stages],modelTokens:null,tokenStatus:'Unavailable: no model-provider usage telemetry in these local stages'});
 function record(stage,status,details={}){stages.push({stage,status,observedAt:clock().toISOString(),durationMs:null,...details});onUpdate(snapshot());}
 function measure(stage,fn){const at=clock().toISOString(),began=monotonic();try{const result=fn();record(stage,'completed',{startedAt:at,durationMs:Math.max(0,monotonic()-began)});return result;}catch(error){record(stage,'failed',{startedAt:at,durationMs:Math.max(0,monotonic()-began),error:error.message});throw error;}}
 return {measure,record,snapshot};
}
