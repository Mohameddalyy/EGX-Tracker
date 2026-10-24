import {researchReports} from './research.mjs';
import {decisionState} from './decisions.mjs';
export function stockWorkflow(db,root,ticker,paper=null){
 const reports=researchReports(root).filter(r=>r.assessments?.some(a=>a.ticker===ticker)).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
 const report=reports[0],assessment=report?.assessments.find(a=>a.ticker===ticker);
 const decision=decisionState(db).decisions.find(d=>d.ticker===ticker&&!d.supersededBy)||null;
 const queue=db.prepare('SELECT id,status,created_at,note,report_id FROM research_queue WHERE ticker=? ORDER BY created_at DESC,rowid DESC LIMIT 5').all(ticker);
 return {queue,decision,report:report?{id:report.id,createdAt:report.createdAt,summary:report.summary,assessment,sources:report.sources,limitations:report.limitations}:null,
  newerResearchAwaitingDecision:!!(report&&decision&&report.id!==decision.report_id&&Date.parse(report.createdAt)>Date.parse(decision.created_at)),
  paper:paper?{experiment:{startDate:paper.config.startDate,endDate:paper.config.endDate},preflight:paper.events.filter(e=>e.kind==='preflight').at(-1)||null,orders:paper.orders.filter(o=>o.ticker===ticker),fills:paper.fills.filter(f=>f.ticker===ticker),events:paper.events.filter(e=>e.payload.ticker===ticker||paper.orders.some(o=>o.ticker===ticker&&(e.payload.orderId===o.id||e.payload.id===o.id)))}:null};
}

