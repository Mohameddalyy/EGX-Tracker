import {discoverReportRoutes} from './workflow-documents.mjs';
// Fixed local operations only. Never accepts arbitrary commands or creates orders/fills.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {openDb} from './core.mjs';
import {initMarket,importCatalog} from './market.mjs';
import {monitorDecisions} from './decision-monitor.mjs';
import {requestReassessment} from './decisions.mjs';
import {resumeResearch} from './research-queue-state.mjs';
import {efficientScreen} from './scout-efficient-service.mjs';
import {paperState} from './paper.mjs';
import {historyRefreshState} from './refresh-selection.mjs';
const [root,inputPath,outputPath]=process.argv.slice(2),job=JSON.parse(readFileSync(inputPath,'utf8')),now=new Date();
const readonly=['health','positions','minute-obligations','learning-export','document-discovery'].includes(job.kind),db=readonly?new DatabaseSync(join(root,'data/egx.sqlite'),{readOnly:true}):openDb(join(root,'data/egx.sqlite'));
let result;
try{
 if(job.kind==='health'){
  const integrity=db.prepare('PRAGMA quick_check').all(),active=db.prepare("SELECT id,pid FROM market_jobs WHERE status='running'").all();
  result={status:integrity.every(x=>Object.values(x)[0]==='ok')?'succeeded':'failed',integrity,activeCollectors:active,clockObservedAt:now.toISOString(),clockSynchronization:'UNKNOWN: operating system UTC is observed, not externally certified',providerDelay:'UNKNOWN',fetched:0};
 }else if(job.kind==='positions'){
  const v5=existsSync(join(root,'data/v5-client/registry.json'))?(await import('./workflow-v5.mjs')).v5Obligations(root,db.prepare('SELECT * FROM stocks').all()):{positions:[],intents:[],errors:[],status:'VERIFIED',ledgers:[]};
  let state={positions:[],pending:[]},integrity=[],legacyError=null;
  try{const config=JSON.parse(readFileSync(join(root,'research/paper-experiment.json'),'utf8')),path=join(root,'data/experiments',config.id,'paper.sqlite');if(!existsSync(path))throw Error('Legacy paper ledger unavailable');const paper=new DatabaseSync(path,{readOnly:true});try{integrity=paper.prepare('PRAGMA quick_check').all();state=paperState(paper);}finally{paper.close();}}catch(e){legacyError=e.message;}
  let live=[],liveError=null;try{live=db.prepare("SELECT j.ticker,SUM(CASE WHEN f.side='Buy' THEN f.quantity ELSE -f.quantity END) quantity FROM fills f JOIN journal j ON j.id=f.entry_id WHERE f.voided_at IS NULL GROUP BY j.ticker HAVING quantity>0").all();}catch(e){liveError=e.message;}
  const holdings=[...state.positions.map(p=>({...p,account:'paper'})),...live.map(p=>({...p,account:'user-journal'})),...v5.positions].map(p=>{let history;try{const s=db.prepare('SELECT * FROM stocks WHERE ticker=?').get(p.ticker),bar=db.prepare('SELECT b.*,c.captured_at,c.finality FROM bars b LEFT JOIN bar_captures c ON c.ticker=b.ticker AND c.day=b.day WHERE b.ticker=? ORDER BY b.day DESC LIMIT 1').get(p.ticker);history=historyRefreshState(s,bar,now);}catch(e){history={due:true,status:'UNAVAILABLE',reason:e.message};}return {...p,history,minuteEvidence:'Due observation must be checked; no exit/fill inferred from daily bars'};});
  const incomplete=legacyError||liveError||v5.errors.length||!integrity.every(x=>Object.values(x)[0]==='ok');
  result={v5,legacyError,liveError,positionStatus:incomplete?'INCOMPLETE_NOT_ZERO_HOLDINGS':v5.status,status:incomplete?'partial':'succeeded',holdings,pending:[...v5.intents,...state.pending.map(o=>({id:o.id,ticker:o.ticker,side:o.plan.side,expired:Date.parse(o.plan.expiresAt)<=+now,exitObligation:o.plan.side==='SELL'}))],integrity,settlement:'Not performed by dispatcher; precommitted exits require verified execution-engine events',fetched:0};
 }else if(job.kind==='minute-obligations')result={status:'succeeded',observationRequired:true,tickers:job.tickers,reason:'Obligation inventory complete; separate minute jobs report actual observation coverage. No settlement performed.',fetched:0};
 else if(job.kind==='decision-monitor'){
  const observations=monitorDecisions(db,now,{decisionIds:[job.target]});if(!observations.length)throw Error('Recorded decision disappeared');
  let reassessment=null;if(job.previousEvidenceFingerprint&&job.previousEvidenceFingerprint!==job.evidenceFingerprint)reassessment=requestReassessment(db,job.target,'New retained source content requires independent review: '+job.evidenceFingerprint,now);
  result={status:'succeeded',observations,evidenceFingerprint:job.evidenceFingerprint,reassessment,reviewStatus:reassessment?'NEW_EVIDENCE_REVIEW_REQUIRED':job.previousEvidenceFingerprint?'No retained content change; current source coverage still required':'BASELINE_REVIEW_NOT_ASSERTED',fetched:0};
 }else if(job.kind==='catalog-import'){initMarket(db);const catalog=JSON.parse(readFileSync(join(root,'data/market/catalog.json'),'utf8'));if(catalog.retrievedAt!==job.revision)throw Error('Catalog version changed; replan before importing');result={status:'succeeded',catalog:importCatalog(db,catalog),capturedAt:catalog.retrievedAt,fetched:0};}
 else if(job.kind==='document-discovery')result=discoverReportRoutes(root,job.reportRefs);
 else if(job.kind==='queue-resume')result={status:'succeeded',resumed:resumeResearch(db,job.fingerprints||{},now),fetched:0};
 else if(job.kind==='screen')result={status:'succeeded',screen:efficientScreen(db,JSON.parse(readFileSync(join(root,'research/screening-policy.json'),'utf8')),now),fetched:0};
 else if(job.kind==='learning-export'){
  const dir=join(root,'data/learning');mkdirSync(dir,{recursive:true});const path=join(dir,'workflow-'+job.revision+'.json');
  const value={exportedAt:now.toISOString(),decisions:db.prepare('SELECT * FROM agent_decisions ORDER BY created_at').all(),outcomes:db.prepare('SELECT * FROM decision_outcomes ORDER BY observed_at').all(),notes:db.prepare('SELECT * FROM decision_notes ORDER BY created_at').all(),scope:'All recorded actions and superseded decisions; append-only history export, not a model-training run'};
  if(!existsSync(path))writeFileSync(path,JSON.stringify(value,null,2),{flag:'wx'});result={status:'succeeded',path,fetched:0};
 }else throw Error('Unsupported local workflow operation '+job.kind);
}catch(error){result={...error.partialResult,status:'failed',incident:error.partialResult?.incident||'LOCAL_TOOL_FAILURE',message:error.message};process.exitCode=1;}finally{db.close();}
writeFileSync(outputPath,JSON.stringify(result,null,2),{flag:'wx'});
