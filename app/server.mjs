import {workflowStatus} from './workflow-status.mjs';
import {readinessOverview} from './preparation-status.mjs';
import {openAnalysis,getRecord} from './analysis-store.mjs';
import {analysisOverview,analysisDossier} from './analysis.mjs';
import {saveAnalysisInput,importAnalysisBundle} from './analysis-service.mjs';
import {publicPacket} from './analysis-learning.mjs';
import {operationsState} from './operations.mjs';
import {pipelineProgress} from './pipeline-progress.mjs';
import {researchCard} from './research-card.mjs';
import {stockWorkflow} from './stock-workflow.mjs';
import {paperPerformance,researchCoverage} from './paper-performance.mjs';
import {openPaper,paperState,paperMarks,paperAudit,preflightReady} from './paper.mjs';
import {linkDecisionJournal} from './decision-execution.mjs';
import {intradayState,intradayAudit,createManualRule,alertTemplate,syncIntradayRules} from './intraday.mjs';
import {startIntradayService,saveIntradayConfig} from './intraday-service.mjs';
import {tradingViewPlan} from './tradingview-plan.mjs';
import http from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {openDb,ingest,snapshot,names} from './core.mjs';
import {initMarket,marketState,marketBusy} from './market.mjs';
import {changeWatchlist} from './watchlist.mjs';
import {researchReports} from './research.mjs';
import {initScout,scoutState,runScout} from './scout.mjs';
import {factsFor} from './market-facts.mjs';
import {initDecisions,decisionState} from './decisions.mjs';
import {monitorDecisions} from './decision-monitor.mjs';
import {initPositions,position,entryFills,addFill,voidLastFill} from './positions.mjs';
import {initAttention,attentionCandidates,syncAttention,reviewAttention} from './attention.mjs';
import {initJournal,saveDecision,addReview,journalEntries} from './journal.mjs';
const root=dirname(dirname(fileURLToPath(import.meta.url))),db=openDb(process.env.EGX_DATABASE||join(root,'data','egx.sqlite'));const token=randomUUID();let refreshing=false;
initJournal(db);
initPositions(db);
initAttention(db);initMarket(db);initScout(db);initDecisions(db);
const intradayService=startIntradayService(db,root);
const analysisDb=openAnalysis(join(root,'data','analysis.sqlite'));
const seed=join(root,'verification','egx-three-stock-verification.json');if(!db.prepare('SELECT COUNT(*) n FROM bars').get().n&&existsSync(seed))ingest(db,JSON.parse(readFileSync(seed,'utf8')));
function refresh(mode='watchlist'){
 if(refreshing||marketBusy(db))throw Error('A market import is already using TradingView');
 refreshing=true;
 const args=[join(root,'app','import-market.mjs'),...(mode==='watchlist'?['--watchlist','--due']:mode==='all'?['--all','--due']:['--due'])];
 const child=spawn(process.execPath,args,{cwd:root,windowsHide:true,env:process.env});let errors='';child.stderr.on('data',d=>errors+=d);child.stdout.resume();
 const finish=error=>{refreshing=false;if(error)db.prepare('INSERT INTO runs(at,status,message) VALUES(?,?,?)').run(new Date().toISOString(),'failed',String(error).slice(-1000));};child.on('error',e=>finish(e.message));child.on('close',code=>finish(code?errors||'Importer interrupted':null));
}
const port=Number(process.env.EGX_PORT||4317);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid local port');
const origins=[`http://127.0.0.1:${port}`,`http://localhost:${port}`];
const server=http.createServer(async(req,res)=>{const send=(code,data,type='application/json')=>{res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(type==='application/json'?JSON.stringify(data):data);};try{
 const allowed=new Set([`127.0.0.1:${port}`,`localhost:${port}`]);if(!allowed.has(req.headers.host))return send(403,{error:'Local access only'});
 const url=new URL(req.url,origins[0]);
 if(req.method==='GET'&&url.pathname==='/api/preparation'){
  const pointer=join(root,'data','market','preparation','latest.json');if(!existsSync(pointer))return send(404,{error:'Preparation baseline not built'});
  const summary=JSON.parse(readFileSync(pointer,'utf8')),file=summary.path?.split(/[\\/]/).at(-1);if(!/^\d{4}-\d{2}-\d{2}T[\dTZ.-]+\.json$/.test(file||''))throw Error('Invalid baseline artifact');
  const manifest=JSON.parse(readFileSync(join(root,'data','market','preparation',file),'utf8')),ticker=url.searchParams.get('ticker');
  if(ticker){const stock=manifest.instruments.find(x=>x.ticker===ticker);return stock?send(200,{at:manifest.at,...stock}):send(404,{error:'Unknown preparation ticker'});}
  return send(200,manifest);
 }
 if(req.method==='GET'&&['/api/paper','/api/paper/export','/api/paper/performance'].includes(url.pathname)){const c=JSON.parse(readFileSync(join(root,'research','paper-experiment.json'),'utf8')),p=openPaper(join(root,'data','experiments',c.id,'paper.sqlite'),c);try{const audit=paperAudit(p);if(url.pathname.endsWith('/performance'))return send(200,{...paperPerformance(p,paperMarks(p,db)),researchCoverage:researchCoverage(db)});if(url.pathname.endsWith('/export')){res.setHeader('Content-Disposition','attachment; filename=egx-paper-audit.json');return send(200,audit);}return send(200,{...paperState(p,paperMarks(p,db)),preflightReady:preflightReady(p),events:audit.events.slice(-30)});}finally{p.close();}}
 if(req.method==='GET'&&url.pathname==='/api/research-card'){const ticker=url.searchParams.get('ticker'),card=researchCard(db,ticker);if(!card)return send(404,{error:'Unknown ticker'});const c=JSON.parse(readFileSync(join(root,'research','paper-experiment.json'),'utf8')),p=openPaper(join(root,'data','experiments',c.id,'paper.sqlite'),c);try{card.workflow=stockWorkflow(db,root,ticker,paperAudit(p));}finally{p.close();}return send(200,card);}
 if(req.method==='GET'&&url.pathname==='/api/operations'){const auditPath=join(root,'verification','wait-decision-audit-20261015.json'),briefPath=join(root,'data','market','latest-screen-brief.json');const audit=existsSync(auditPath)?JSON.parse(readFileSync(auditPath,'utf8')):null;return send(200,{...operationsState(db),workflow:workflowStatus(root),preparation:readinessOverview(db,{root}),pipeline:pipelineProgress(db,root),marketBrief:existsSync(briefPath)?JSON.parse(readFileSync(briefPath,'utf8')):null,waitAudit:audit?{generatedAt:audit.generatedAt,summary:audit.summary,items:audit.items.map(x=>({ticker:x.ticker,priority:x.researchPriority,nextAction:x.nextAction,decisionId:x.decisionId}))}:null});}
 if(req.method==='GET'&&url.pathname==='/api/paper/final-review'){const pointer=join(root,'data','experiments','latest-final-review.json');if(!existsSync(pointer))return send(404,{error:'Final review has not been generated'});const review=JSON.parse(readFileSync(pointer,'utf8'));if(!/^[a-zA-Z0-9-]+$/.test(review.experimentId)||!/^final-review-[a-zA-Z0-9-]+\.md$/.test(review.file))throw Error('Invalid saved review path');return send(200,readFileSync(join(root,'data','experiments',review.experimentId,review.file),'utf8'),'text/plain; charset=utf-8');}
 if(req.method==='GET'&&url.pathname==='/api/analysis')return send(200,analysisOverview(db,analysisDb,root));
 if(req.method==='GET'&&url.pathname==='/api/analysis/company')return send(200,analysisDossier(db,analysisDb,root,url.searchParams.get('ticker')));
 if(req.method==='GET'&&url.pathname==='/api/analysis/packet'){const packet=getRecord(analysisDb,url.searchParams.get('id'));if(packet?.kind!=='evaluation-packet')return send(404,{error:'Unknown comparison packet'});return send(200,publicPacket(packet));}
 if(req.method==='GET'&&url.pathname==='/api/analysis/record'){const record=getRecord(analysisDb,url.searchParams.get('id'));if(!record)return send(404,{error:'Unknown analytical record'});return send(200,record.kind==='evaluation-packet'?publicPacket(record):record);}
 if(req.method==='GET'&&url.pathname==='/api/market')return send(200,marketState(db));
 if(req.method==='GET'&&url.pathname==='/api/intraday')return send(200,{...intradayState(db),plan:tradingViewPlan(root)});
 if(req.method==='GET'&&url.pathname==='/api/research')return send(200,researchReports(root));
 if(req.method==='GET'&&url.pathname==='/api/decisions')return send(200,decisionState(db));
 if(req.method==='GET'&&url.pathname==='/api/decisions/export'){res.setHeader('Content-Disposition','attachment; filename="egx-agent-decision-history.json"');return send(200,{exportedAt:new Date().toISOString(),intraday:intradayAudit(db),decisions:db.prepare('SELECT * FROM agent_decisions ORDER BY created_at').all(),outcomes:db.prepare('SELECT * FROM decision_outcomes ORDER BY observed_at').all(),notes:db.prepare('SELECT * FROM decision_notes ORDER BY created_at').all()});}
 if(req.method==='GET'&&url.pathname==='/api/scout'){const schedulePath=join(root,'research','scout-schedule.json');return send(200,{...scoutState(db),schedule:existsSync(schedulePath)?JSON.parse(readFileSync(schedulePath,'utf8')):null});}
 if(req.method==='GET'&&url.pathname==='/api/state'){const state=snapshot(db);for(const s of state.stocks)s.fundamentals=factsFor(db,s.ticker);return send(200,{...state,attention:syncAttention(db,attentionCandidates(state,journalEntries(db))),refreshing:refreshing||marketBusy(db),token});}
 if(req.method==='GET'&&url.pathname==='/api/journal'){if(url.searchParams.has('download'))res.setHeader('Content-Disposition','attachment; filename="egx-decision-journal.json"');const state=snapshot(db);return send(200,journalEntries(db).map(e=>{const fills=entryFills(db,e.id),s=state.stocks.find(s=>s.ticker===e.ticker);return {...e,fills,position:position(fills,e.plan,s?.latest),capture:s?.retrieved_at,stale:!s?.retrieved_at||s.captureAgeHours>24};}));}
 if(req.method==='GET'&&url.pathname==='/api/export'){const rows=db.prepare('SELECT * FROM bars ORDER BY ticker,day').all();res.setHeader('Content-Disposition','attachment; filename="egx-daily-bars.csv"');return send(200,'ticker,day,time,open,high,low,close,volume\n'+rows.map(r=>Object.values(r).join(',')).join('\n'),'text/csv');}
 if(req.method==='POST'){if(req.headers['x-egx-token']!==token)return send(403,{error:'Refresh the dashboard and retry'});if(req.headers.origin&&!origins.includes(req.headers.origin))return send(403,{error:'Invalid origin'});
 if(url.pathname.startsWith('/api/analysis/')){let body='';for await(const c of req){body+=c;if(body.length>3000000)return send(413,{error:'Evidence bundle too large; use local artifacts'});}try{const payload=JSON.parse(body),kind=url.pathname.slice('/api/analysis/'.length);return send(200,kind==='import'?importAnalysisBundle(db,analysisDb,root,payload):saveAnalysisInput(db,analysisDb,root,kind,payload));}catch(e){return send(400,{error:e.message});}}
 if(url.pathname.startsWith('/api/intraday/')){let body='';for await(const c of req){body+=c;if(body.length>5000)return send(413,{error:'Submission too large'});}try{const p=JSON.parse(body);let result;
  if(url.pathname==='/api/intraday/rules')result=createManualRule(db,p);
  else if(url.pathname==='/api/intraday/template'){if(tradingViewPlan(root)?.webhooks===false)throw Error('TradingView Basic has no webhook support. These local rules are not active TradingView alerts; local monitoring is being investigated.');return send(200,alertTemplate(db,p.id));}
  else if(url.pathname==='/api/intraday/toggle'){if(typeof p.enabled!=='boolean')throw Error('Enabled must be boolean');const changed=db.prepare('UPDATE intraday_rules SET enabled=? WHERE id=?').run(Number(p.enabled),p.id);if(!changed.changes)throw Error('Unknown rule');result={saved:true};}
  else if(url.pathname==='/api/intraday/config')result=saveIntradayConfig(root,p);
  else if(url.pathname==='/api/intraday/sync'){syncIntradayRules(db);result={saved:true};}
  else return send(404,{error:'Not found'});
  void intradayService.tick();return send(200,result);
 }catch(e){return send(400,{error:e.message});}}
 if(url.pathname==='/api/decisions/journal'){let body='';for await(const c of req){body+=c;if(body.length>1000)return send(413,{error:'Submission too large'});}try{return send(200,linkDecisionJournal(db,JSON.parse(body).decisionId));}catch(e){return send(400,{error:e.message});}}
 if(url.pathname==='/api/decisions/monitor'){if(refreshing||marketBusy(db))return send(409,{error:'Wait for the current TradingView import'});return send(200,monitorDecisions(db));}
 if(url.pathname==='/api/scout/run'){if(refreshing||marketBusy(db))return send(409,{error:'Wait for the current TradingView import'});return send(200,runScout(db,JSON.parse(readFileSync(join(root,'research','screening-policy.json'),'utf8'))));}
 if(url.pathname==='/api/scout/notification/read'){let body='';for await(const c of req){body+=c;if(body.length>1000)return send(413,{error:'Submission too large'});}const p=JSON.parse(body);if(typeof p.id!=='string')return send(400,{error:'Notification ID required'});db.prepare('UPDATE research_notifications SET read_at=COALESCE(read_at,?) WHERE id=?').run(new Date().toISOString(),p.id);return send(200,{saved:true});}
 if(url.pathname==='/api/market/import'){if(refreshing||marketBusy(db))return send(409,{error:'An import is already running'});refresh(url.searchParams.get('all')==='1'?'all':'missing');return send(202,{started:true});}
 if(url.pathname==='/api/refresh'){if(refreshing||marketBusy(db))return send(409,{error:'A refresh is already running'});refresh();return send(202,{started:true});}
 if(['/api/fills','/api/fills/void'].includes(url.pathname)){let body='';for await(const c of req){body+=c;if(body.length>5000)return send(413,{error:'Submission too large'});}try{const p=JSON.parse(body);return send(201,url.pathname.endsWith('/void')?voidLastFill(db,p):addFill(db,p));}catch(e){return send(400,{error:e.message});}}
 if(url.pathname==='/api/attention/review'){let body='';for await(const c of req){body+=c;if(body.length>1000)return send(413,{error:'Submission too large'});}try{const p=JSON.parse(body);reviewAttention(db,p.key,p.reviewed);return send(200,{saved:true});}catch(e){return send(400,{error:e.message});}}
 if(url.pathname==='/api/universe'){
  let body='';for await(const c of req){body+=c;if(body.length>2000)return send(413,{error:'Submission too large'});}
  try{return send(200,changeWatchlist(db,JSON.parse(body)));}catch(e){return send(400,{error:e.message});}
 }
 if(['/api/journal','/api/journal/review'].includes(url.pathname)){
  let body='';for await(const c of req){body+=c;if(body.length>12000)return send(413,{error:'Journal submission too large'});}
  try{const p=JSON.parse(body);if(!p||typeof p!=='object')throw Error('Invalid submission');const result=url.pathname.endsWith('/review')?addReview(db,p):saveDecision(db,p,snapshot(db).stocks.find(s=>s.ticker===p.ticker));return send(201,result);}catch(e){return send(400,{error:e.message});}
 }
 if(url.pathname==='/api/watch'){let body='';for await(const c of req){body+=c;if(body.length>10000)return send(413,{error:'Notes too long'});}const p=JSON.parse(body);if(!db.prepare('SELECT ticker FROM stocks WHERE ticker=?').get(p.ticker)||!['Unassigned','Short term','Medium term','Long term'].includes(p.horizon)||typeof p.notes!=='string'||p.notes.length>4000)return send(400,{error:'Invalid watchlist entry'});db.exec('BEGIN');try{db.prepare('UPDATE stocks SET horizon=?,notes=? WHERE ticker=?').run(p.horizon,p.notes,p.ticker);db.prepare('INSERT INTO events(at,ticker,kind,detail) VALUES(?,?,?,?)').run(new Date().toISOString(),p.ticker,'Watchlist edited',JSON.stringify({horizon:p.horizon,notes:p.notes}));db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return send(200,{saved:true});}}
 const files={'/workflow-status.js':'workflow-status.js','/analysis.js':'analysis.js','/pipeline-progress.js':'pipeline-progress.js','/operations.js':'operations.js','/stock-workflow.js':'stock-workflow.js','/research-card.js':'research-card.js','/paper-operations.js':'paper-operations.js','/':'index.html','/app.js':'app.js','/journal.js':'journal.js','/universe.js':'universe.js','/attention.js':'attention.js','/positions.js':'positions.js','/research.js':'research.js','/market.js':'market.js','/scout.js':'scout.js','/decisions.js':'decisions.js','/trade-plans.js':'trade-plans.js','/paper.js':'paper.js','/intraday.js':'intraday.js','/style.css':'style.css'};if(req.method==='GET'&&files[url.pathname])return send(200,readFileSync(join(root,'app','public',files[url.pathname])),url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'text/html');send(404,{error:'Not found'});
 }catch(e){send(500,{error:e.message});}});
server.listen(port,'127.0.0.1',()=>console.log('EGX Tracker: '+origins[0]));











