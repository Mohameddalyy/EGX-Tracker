import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {paperAudit} from './paper.mjs';
import {paperPerformance} from './paper-performance.mjs';
import {pipelineProgress} from './pipeline-progress.mjs';
import {experimentReview} from './experiment-review.mjs';
import {cairoDue} from './operations.mjs';

const root=dirname(dirname(fileURLToPath(import.meta.url))),config=JSON.parse(readFileSync(join(root,'research','paper-experiment.json'),'utf8'));
const dir=join(root,'data','experiments',config.id),paper=new DatabaseSync(join(dir,'paper.sqlite'),{readOnly:true}),source=new DatabaseSync(join(root,'data','egx.sqlite'),{readOnly:true});
try{
 const now=new Date(),cutoff=new Date(Date.parse(cairoDue(config.endDate))+2*3600000-1).toISOString();
 if(now.toISOString()<=cutoff)throw Error('Final review requires the completed entry week');
 const audit=paperAudit(paper);
 if(audit.fills.some(f=>f.recorded_at>cutoff)||audit.events.some(e=>e.kind==='run'&&e.at>cutoff))throw Error('Post-week activity requires a separate as-of ledger reconstruction; do not mislabel current equity as week-end equity');
 // No current stock marks enter this retrospective report. Open holdings stay unpriced.
 const performance=paperPerformance(paper,{},now),pipeline=pipelineProgress(source,root,now);
 const decisions=source.prepare('SELECT * FROM agent_decisions WHERE created_at<=? ORDER BY created_at,rowid').all(cutoff);
 const outcomes=source.prepare('SELECT * FROM decision_outcomes WHERE observed_at<=? ORDER BY observed_at,rowid').all(cutoff);
 const historyJobs=source.prepare('SELECT * FROM market_jobs WHERE started_at<=? ORDER BY id DESC LIMIT 8').all(cutoff);
 const stamp=now.toISOString().replace(/[^a-zA-Z0-9]/g,'-'),file='final-review-'+stamp+'.md',snapshot='final-review-'+stamp+'.json';
 const evidencePaths=[join(dir,snapshot),join(root,'verification','wait-decision-audit-20261015.md'),join(root,'verification','research-paper-workflow-20261015.md'),join(root,'verification','efficient-market-workflow-20261015.md'),join(root,'data','market','resume-detached.log')];
 const content={generatedAt:now.toISOString(),experimentCutoff:cutoff,performance,audit,pipeline,decisions,outcomes,historyJobs,evidencePaths,ledgerDigest:createHash('sha256').update(JSON.stringify(audit)).digest('hex')};
 mkdirSync(dir,{recursive:true});writeFileSync(join(dir,snapshot),JSON.stringify(content,null,2),{flag:'wx'});writeFileSync(join(dir,file),experimentReview(content),{flag:'wx'});
 writeFileSync(join(root,'data','experiments','latest-final-review.json'),JSON.stringify({experimentId:config.id,file,snapshot,generatedAt:content.generatedAt},null,2));
 console.log(JSON.stringify({report:join(dir,file),snapshot:join(dir,snapshot),ledgerDigest:content.ledgerDigest,orders:audit.orders.length,fills:audit.fills.length,checkpoints:performance.operations.completedCheckpoints,blocked:performance.operations.blockedCheckpoints,missing:performance.operations.missing.length,late:performance.operations.late.length}));
}finally{paper.close();source.close();}
