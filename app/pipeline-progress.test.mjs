import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {openDb} from './core.mjs';import {initDecisions} from './decisions.mjs';import {pipelineProgress} from './pipeline-progress.mjs';import {renderPipelineProgress} from './public/pipeline-progress.js';
test('live progress prioritizes unfinished final review and preserves the older decision without certifying fresh evidence',()=>{
 const db=openDb(':memory:'),root=mkdtempSync(join(tmpdir(),'egx-progress-'));
 try{
 initDecisions(db);const at='2026-10-15T18:00:00Z',now=new Date('2026-10-18T08:00:00Z');
 db.prepare('INSERT INTO research_queue(id,run_id,ticker,as_of,policy_version,status,created_at,updated_at,report_id,evidence) VALUES(?,?,?,?,?,?,?,?,?,?)').run('candidate-1','run','TEST','2026-10-15','test','awaiting_decision',at,at,'report-new','{}');
 const old={id:'report-old',createdAt:at,assessments:[{ticker:'TEST',evidenceChecks:{}}]},payload={action:'Wait',rationale:'Old rationale',reviewConditions:'Resolve actions'};
 db.prepare('INSERT INTO agent_decisions VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run('decision-1','older','TEST',old.id,at,'2026-10-15','Wait',null,JSON.stringify(payload),JSON.stringify({report:old}),'{}','hash');
 mkdirSync(join(root,'data','research'),{recursive:true});const report={id:'report-new',createdAt:at,assessments:[{ticker:'TEST',evidenceChecks:{ownership:{status:'verified',asOf:'2026-09-30',note:'Dated register'},corporateActions:{status:'unavailable',note:'<script>unsafe</script>'}}}]};writeFileSync(join(root,'data','research','report-new.json'),JSON.stringify(report));
 const p=pipelineProgress(db,root,now),x=p.items[0];assert.equal(x.stage,'awaiting_decision');assert.equal(x.decisionAction,'Wait');assert.equal(x.reportId,'report-new');assert.equal(x.verifiedChecks,1);assert.equal(x.overdue,true);assert(x.nextAction.includes('Independent final reviewer'));assert(x.unresolved.some(u=>u.area==='corporateActions'));assert(!renderPipelineProgress(p).includes('<script>'));assert(renderPipelineProgress(p).includes('&lt;script&gt;'));
 assert.equal(db.prepare('SELECT COUNT(*) n FROM agent_decisions').get().n,1);
 }finally{db.close();rmSync(root,{recursive:true,force:true});}
});
test('missing saved report is a visible blocker and does not disappear as an empty queue',()=>{
 const db=openDb(':memory:');initDecisions(db);
 try{db.prepare('INSERT INTO research_queue(id,run_id,ticker,as_of,policy_version,status,created_at,updated_at,report_id,evidence) VALUES(?,?,?,?,?,?,?,?,?,?)').run('q','run','TEST','2026-10-15','test','awaiting_decision','2026-10-15T18:00:00Z','2026-10-15T18:00:00Z','report-missing','{}');const p=pipelineProgress(db,'missing-test-root',new Date('2026-10-18'));assert.equal(p.active,1);assert.equal(p.items[0].reportError,'Saved analyst report unavailable');assert.equal(p.items[0].verifiedChecks,0);}finally{db.close();}
});
