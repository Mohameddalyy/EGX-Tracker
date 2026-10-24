import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {requiredChecks} from './promotion-policy.mjs';

// Read compact queue/decision records, not every company's history or report.
export function pipelineProgress(db,root,now=new Date()){
 const latest=db.prepare('SELECT id,at,payload FROM scout_runs ORDER BY at DESC,rowid DESC LIMIT 1').get();
 const screen=latest?JSON.parse(latest.payload).rows:[],matches=screen.filter(x=>x.candidate);
 const queues=db.prepare('SELECT * FROM research_queue ORDER BY created_at DESC,rowid DESC').all();
 const decisions=db.prepare('SELECT d.* FROM agent_decisions d WHERE NOT EXISTS(SELECT 1 FROM agent_decisions n WHERE n.supersedes=d.id)').all();
 const waits=db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='research_waits'").get()?new Map(db.prepare('SELECT * FROM research_waits').all().map(w=>[w.queue_id,w])):new Map();
 const byQueue=new Map(),byDecision=new Map(decisions.map(d=>[d.ticker,d]));
 for(const q of queues)if(!byQueue.has(q.ticker))byQueue.set(q.ticker,q);
 const tickers=new Set([...matches.map(x=>x.ticker),...queues.map(x=>x.ticker),...decisions.map(x=>x.ticker)]);
 const active=new Set(['pending','researching','awaiting_decision']);
 const items=[...tickers].sort().map(ticker=>{
  const q=byQueue.get(ticker),d=byDecision.get(ticker),payload=d?JSON.parse(d.payload):null;
  let report=d?JSON.parse(d.evidence).report:null,reportError=null;
  if(q?.report_id&&q.report_id!==report?.id){
   if(!/^report-[a-zA-Z0-9-]+$/.test(q.report_id))reportError='Invalid report identifier';
   else try{const loaded=JSON.parse(readFileSync(join(root,'data','research',q.report_id+'.json'),'utf8'));if(loaded.id!==q.report_id)throw Error('Report identity mismatch');report=loaded;}catch{reportError='Saved analyst report unavailable';}
  }
  const a=report?.assessments?.find(x=>x.ticker===ticker),checks=a?.evidenceChecks||{};
  const unresolved=requiredChecks.filter(k=>checks[k]?.status!=='verified').map(area=>({area,status:checks[area]?.status||'not reviewed',asOf:checks[area]?.asOf||null,reason:checks[area]?.note||'Analyst evidence has not been recorded'}));
  const queued=active.has(q?.status),waiting=['waiting_event','retry_not_due','waiting_capacity'].includes(q?.status),stage=queued||waiting?q.status:d?d.action:'screen_match';
  const update=q?.updated_at||d?.created_at||latest?.at,age=Number.isFinite(Date.parse(update))?Math.max(0,(+now-Date.parse(update))/3600000):null;
  const overdue=queued&&age!==null&&age>=24;
  let nextAction=stage==='pending'?'Analyst must claim and research this candidate.':stage==='researching'?'Resume the existing analyst claim; save its sourced report.':stage==='awaiting_decision'?'Independent final reviewer must challenge the saved report and record Watch, Wait or Avoid.':stage==='screen_match'?'Screen match only: complete sourced analyst research before a final decision.':payload?.reviewConditions||'Review the recorded thesis and reassessment conditions.';
  if(waiting){const wait=waits.get(q.id);nextAction='Retained waiting work: '+q.status+'. '+(wait?.reason||'Awaiting available handoff capacity')+(wait?.resume_at?' Next retry '+wait.resume_at:'')+'. No automatic owner takeover.';}
  if(reportError)nextAction=reportError+'. Repair the report handoff before final review.';
  return {ticker,stage,queueId:q?.id||null,reportId:report?.id||q?.report_id||null,decisionId:d?.id||null,decisionAction:d?.action||null,updatedAt:update,ageHours:age,overdue,unresolved,verifiedChecks:requiredChecks.length-unresolved.length,totalChecks:requiredChecks.length,evidenceAsOf:report?.createdAt||null,reportError,reason:payload?.rationale||a?.rationale||'Numerical screen priority; no completed company assessment.',nextAction,approvedPlan:payload?.action==='Watch'&&!!payload.riskPlan,analystPlan:!!a?.riskPlan,screenAsOf:screen.find(x=>x.ticker===ticker)?.asOf||null};
 });
 items.sort((a,b)=>Number(b.overdue)-Number(a.overdue)||Number(active.has(b.stage))-Number(active.has(a.stage))||a.ticker.localeCompare(b.ticker));
 const missingEvidence={};for(const x of items)for(const u of x.unresolved)missingEvidence[u.area]=(missingEvidence[u.area]||0)+1;
 return {generatedAt:now.toISOString(),lastScreenAt:latest?.at||null,screenId:latest?.id||null,evaluated:screen.length,eligible:screen.filter(x=>x.eligible).length,screenMatches:matches.length,items,active:items.filter(x=>active.has(x.stage)).length,overdue:items.filter(x=>x.overdue).length,missingEvidence,limitation:'Evidence checks describe saved research, not current clearance. Overdue means 24 hours without a queue update, not permission to steal an active claim. Screen matches are not approvals; all recorded decisions remain monitored separately.'};
}
