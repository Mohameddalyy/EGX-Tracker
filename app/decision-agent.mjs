import {intradayAudit} from './intraday.mjs';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {dirname,join} from 'node:path';import {fileURLToPath} from 'node:url';import {randomUUID} from 'node:crypto';import {openDb} from './core.mjs';import {initDecisions,handoffDecision,saveDecisionRecord,decisionState,requestReassessment} from './decisions.mjs';import {monitorDecisions} from './decision-monitor.mjs';
const root=dirname(dirname(fileURLToPath(import.meta.url))),db=openDb(process.env.EGX_DATABASE||join(root,'data','egx.sqlite'));try{
 initDecisions(db);const [command='queue',arg,kind,note]=process.argv.slice(2);
 if(command==='queue')console.log(JSON.stringify(decisionState(db).inbox));
 else if(command==='import-reviewed'){const results=[];for(const q of db.prepare('SELECT * FROM research_queue WHERE report_id IS NOT NULL').all())results.push(handoffDecision(db,root,q.id,q.report_id));console.log(JSON.stringify(results));}
 else if(command==='save')console.log(JSON.stringify(saveDecisionRecord(db,root,JSON.parse(readFileSync(arg,'utf8')))));
 else if(command==='recheck')console.log(JSON.stringify(requestReassessment(db,arg,kind)));
 else if(command==='monitor')console.log(JSON.stringify(monitorDecisions(db)));
 else if(command==='note'){if(!db.prepare('SELECT id FROM agent_decisions WHERE id=?').get(arg)||!['process','outcome','data','review-trigger'].includes(kind)||!note?.trim()||note.length>5000)throw Error('Valid decision, note kind and text required');db.prepare('INSERT INTO decision_notes VALUES(?,?,?,?,?)').run('note-'+randomUUID(),arg,new Date().toISOString(),kind,note);console.log(JSON.stringify({noted:arg}));}
 else if(command==='export'){const dir=join(root,'data','learning');mkdirSync(dir,{recursive:true});const path=join(dir,'decision-history-'+Date.now()+'.json');writeFileSync(path,JSON.stringify({exportedAt:new Date().toISOString(),intraday:intradayAudit(db),decisions:db.prepare('SELECT * FROM agent_decisions ORDER BY created_at').all(),outcomes:db.prepare('SELECT * FROM decision_outcomes ORDER BY observed_at').all(),notes:db.prepare('SELECT * FROM decision_notes ORDER BY created_at').all(),scope:'All recorded actions, including Wait/Avoid. Not a model-training run or unbiased full-market trial.'},null,2),{flag:'wx'});console.log(path);}
 else throw Error('Usage: decision-agent.mjs queue | import-reviewed | save FILE | monitor | recheck ID REASON | note ID KIND TEXT | export');
}finally{db.close();}

