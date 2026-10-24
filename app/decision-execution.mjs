import {initJournal} from './journal.mjs';import {initPositions,entryFills,position} from './positions.mjs';import {isConfirmedBar} from './finality.mjs';
function init(db){initJournal(db);initPositions(db);db.exec('CREATE TABLE IF NOT EXISTS decision_journal(decision_id TEXT PRIMARY KEY REFERENCES agent_decisions(id),journal_id INTEGER NOT NULL UNIQUE REFERENCES journal(id),created_at TEXT NOT NULL)');}
export function linkDecisionJournal(db,id,now=new Date()){
 init(db);const prior=db.prepare('SELECT journal_id FROM decision_journal WHERE decision_id=?').get(id);if(prior)return {journalId:prior.journal_id,duplicate:true};
 const row=db.prepare('SELECT * FROM agent_decisions WHERE id=?').get(id);if(!row||row.action!=='Watch')throw Error('Only an approved conditional setup can create a linked trade journal');
 const d=JSON.parse(row.payload),evidence=JSON.parse(row.evidence),p=d.riskPlan;if(p?.version!=='priced-plan-1.0')throw Error('A calculated plan is required');
 const plan={horizon:d.horizon,thesis:d.thesis,invalidation:d.invalidation,entry:p.entry,stop:p.stop,target:p.target,rewardRisk:p.metrics.grossRewardRisk,agentDecisionId:id,pricedPlan:p};
 db.exec('BEGIN IMMEDIATE');try{const result=db.prepare('INSERT INTO journal(request_id,created_at,ticker,plan,evidence) VALUES(?,?,?,?,?)').run('agent-'+id,now.toISOString(),row.ticker,JSON.stringify(plan),JSON.stringify(evidence.stock));const journalId=Number(result.lastInsertRowid);db.prepare('INSERT INTO decision_journal VALUES(?,?,?)').run(id,journalId,now.toISOString());db.exec('COMMIT');return {journalId,recordedFills:0};}catch(e){db.exec('ROLLBACK');throw e;}
}
export function decisionExecution(db,id,now=new Date()){
 init(db);const link=db.prepare('SELECT j.* FROM decision_journal d JOIN journal j ON j.id=d.journal_id WHERE d.decision_id=?').get(id);if(!link)return null;
 const bars=db.prepare('SELECT b.*,c.captured_at,c.finality FROM bars b LEFT JOIN bar_captures c ON b.ticker=c.ticker AND b.day=c.day WHERE b.ticker=? ORDER BY b.day').all(link.ticker),mark=bars.filter(b=>isConfirmedBar(b,now)).at(-1),fills=entryFills(db,link.id),p=position(fills,JSON.parse(link.plan),mark);
 return {journalId:link.id,position:p,activeFills:fills.filter(f=>!f.voided_at).length,status:!fills.some(f=>!f.voided_at)?'No actual fills recorded':p.quantity>0?'Entered — recorded fills':'Closed — recorded fills',stale:!mark||now-Date.parse(mark.captured_at)>86400000,note:'Actual P&L uses your entered fills and fees, marked to the latest accepted daily close. Stop execution is not guaranteed.'};
}
