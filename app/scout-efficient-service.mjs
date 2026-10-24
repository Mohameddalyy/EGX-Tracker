import {runScout} from './scout.mjs';
import {screenBrief} from './scout-brief.mjs';
import {createStageTiming} from './stage-timing.mjs';
export function efficientScreen(db,policy,now=new Date()){
 const timing=createStageTiming();
 const activeQueue=db.prepare("SELECT ticker,status FROM research_queue WHERE status IN ('pending','researching','awaiting_decision') ORDER BY created_at").all();
 const prior=db.prepare('SELECT payload FROM scout_runs ORDER BY at DESC LIMIT 1').get();
 // Preserve existing owners. runScout fills only the remaining bounded capacity.
 const run=timing.measure('local-history-screen-and-bounded-enqueue',()=>runScout(db,policy,now,{enqueue:true}));
 const saved=JSON.parse(db.prepare('SELECT payload FROM scout_runs WHERE id=?').get(run.id).payload);
 const brief=timing.measure('compact-change-summary',()=>screenBrief(saved.rows,prior?JSON.parse(prior.payload).rows||[]:[]));
 return {...run,...brief,activeQueue,queued:run.queued,activeAfter:db.prepare("SELECT COUNT(*) n FROM research_queue WHERE status IN ('pending','researching','awaiting_decision')").get().n,timing:timing.snapshot()};
}
