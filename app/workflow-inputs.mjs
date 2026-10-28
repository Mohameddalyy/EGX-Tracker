import {v5Obligations} from './workflow-v5.mjs';
import {reportInventory} from './workflow-documents.mjs';
import {DatabaseSync} from 'node:sqlite';
import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {historyRefreshState} from './refresh-selection.mjs';
import {routeAnnouncements} from './exchange-evidence.mjs';
import {paperState} from './paper.mjs';
import {workflowHash} from './workflow-store.mjs';
export function readJson(path,fallback=null){return existsSync(path)?JSON.parse(readFileSync(path,'utf8').replace(/^\uFEFF/,'')):fallback;}
const has=(db,t)=>!!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(t);
const rows=(db,t,sql)=>has(db,t)?db.prepare(sql||('SELECT * FROM '+t)).all():[];
// Read-only compact inputs: latest observations and saved decision payloads, not all histories/reports.
export function readWorkflowInputs(root,now=new Date()){
 const db=new DatabaseSync(join(root,'data','egx.sqlite'),{readOnly:true});
 try{
 const inputErrors=[],optionalJson=(path,fallback)=>{try{const value=readJson(path,fallback);if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(fallback).some(k=>!value[k]||typeof value[k]!=='object'||Array.isArray(value[k])))throw Error('Invalid retained source index shape');return value;}catch(e){inputErrors.push({path,code:'RETAINED_SOURCE_UNREADABLE',message:e.message});return fallback;}};
 const stockRows=rows(db,'stocks','SELECT s.*,m.status catalog_status FROM stocks s LEFT JOIN market_catalog m ON m.ticker=s.ticker'),stocks=stockRows.map(s=>{const bar=db.prepare('SELECT b.*,c.captured_at,c.finality FROM bars b LEFT JOIN bar_captures c ON c.ticker=b.ticker AND c.day=b.day WHERE b.ticker=? ORDER BY b.day DESC LIMIT 1').get(s.ticker);return {ticker:s.ticker,catalogStatus:s.catalog_status,retrievedAt:s.retrieved_at,latest:bar||null,readiness:historyRefreshState(s,bar,now),fingerprint:workflowHash([s.retrieved_at,s.metadata,bar])};});
 const decisions=rows(db,'agent_decisions').map(d=>{try{return {...d,payload:JSON.parse(d.payload)};}catch(e){inputErrors.push({decisionId:d.id,code:'DECISION_PAYLOAD_UNREADABLE',message:e.message});return {...d,payload:{reviewConditions:'Repair unreadable original decision; do not infer a disposition'}};}}),queue=rows(db,'research_queue'),catalog=optionalJson(join(root,'data/market/catalog.json'),{});
 const exchange=optionalJson(join(root,'data/research/evidence/exchange/index.json'),{records:{},windows:{}}),library=optionalJson(join(root,'data/research/evidence/library/index.json'),{items:{}});
 const evidence=Object.fromEntries(stocks.map(s=>[s.ticker,[]])),unmapped=[];
 const recordIds=Object.keys(exchange.records),routed=routeAnnouncements(Object.values(exchange.records),stockRows);
 for(let i=0;i<routed.length;i++){const id=recordIds[i],route=routed[i].identityRouting;for(const t of route.possibleTickers)if(evidence[t])evidence[t].push('event:'+id+':'+route.status);if(!route.possibleTickers.length)unmapped.push(id);}
 const reportTickers=new Map();for(const q of [...queue,...decisions])if(q.report_id){const ts=reportTickers.get(q.report_id)||new Set();ts.add(q.ticker);reportTickers.set(q.report_id,ts);}
 const inventory=optionalJson(join(root,'data/research/evidence/library/route-inventory.json'),{reports:{}}),documentItems={...library.items};for(const r of Object.values(inventory.reports))for(const route of r.routes||[])documentItems[route.url]={...route,...documentItems[route.url],reportIds:[...new Set([...(route.reportIds||[]),...(documentItems[route.url]?.reportIds||[])])]};
 const reportRefs=reportInventory(root,[...reportTickers.keys()]);
 const documents=Object.values(documentItems).map(d=>{const tickers=[...new Set([...(d.tickers||[]),...(d.reportIds||[]).flatMap(id=>[...(reportTickers.get(id)||[])])])];for(const t of tickers)if(evidence[t]&&d.sha256)evidence[t].push('document:'+d.url+':'+d.sha256);return {url:d.url,tickers,sha256:d.sha256||null,status:d.status,nextAttempt:d.nextAttempt,checkedAt:d.checkedAt};});
 const fingerprints=Object.fromEntries(Object.entries(evidence).map(([t,v])=>[t,workflowHash(v.sort())]));
 const receipts=rows(db,'preparation_receipts').map(r=>({...r,payload:JSON.parse(r.payload)})),attempts=rows(db,'preparation_attempts','SELECT * FROM preparation_attempts WHERE id IN (SELECT MAX(id) FROM preparation_attempts GROUP BY ticker,component)');
 const livePositions=has(db,'fills')&&has(db,'journal')?db.prepare("SELECT j.ticker,SUM(CASE WHEN f.side='Buy' THEN f.quantity ELSE -f.quantity END) quantity FROM fills f JOIN journal j ON j.id=f.entry_id WHERE f.voided_at IS NULL GROUP BY j.ticker HAVING quantity>0").all():[];
 let positions=[],intents=[],ledgerStatus='UNAVAILABLE',ledgerFingerprint=null;
 let config={};try{config=readJson(join(root,'research/paper-experiment.json'),{});}catch(e){inputErrors.push({code:'LEGACY_CONFIG_UNREADABLE',critical:true,message:e.message});}
 const paperPath=join(root,'data/experiments',config.id||'missing','paper.sqlite');
 try{if(existsSync(paperPath)){const paper=new DatabaseSync(paperPath,{readOnly:true});try{const state=paperState(paper);positions=state.positions;intents=state.pending;ledgerStatus='READABLE';ledgerFingerprint=workflowHash([paper.prepare('SELECT COUNT(*) n,MAX(rowid) last FROM ledger').get(),state.cash,state.reservedCash,positions,intents]);}finally{paper.close();}}}catch(e){inputErrors.push({code:'LEGACY_LEDGER_UNREADABLE',critical:true,message:e.message});}
 const v5=v5Obligations(root,stockRows);inputErrors.push(...v5.errors);positions.push(...v5.positions);intents.push(...v5.intents);ledgerFingerprint=workflowHash([ledgerFingerprint,v5.fingerprint]);
 const minuteObservations=rows(db,'intraday_events','SELECT ticker,MAX(received_at) last FROM intraday_events GROUP BY ticker');
 const learningFingerprint=workflowHash(['agent_decisions','decision_outcomes','decision_notes'].map(t=>has(db,t)?db.prepare('SELECT COUNT(*) n,MAX(rowid) last FROM '+t).get():null));
 return {v5,observedAt:now.toISOString(),learningFingerprint,reportRefs,inputErrors,stocks,decisions,queue,documents,evidenceFingerprints:fingerprints,unmappedEvents:{count:unmapped.length,fingerprint:workflowHash(unmapped.sort())},exchangeWindows:Object.values(exchange.windows),catalogCapturedAt:catalog.retrievedAt||null,receipts,attempts,positions,intents,livePositions,ledgerStatus,ledgerFingerprint,minuteObservations,sourceAccess:optionalJson(join(root,'agent/source-access.json'),{}),activeCollectors:rows(db,'market_jobs',"SELECT id,pid,message FROM market_jobs WHERE status='running'"),preparationLocks:['exchange','library'].flatMap(name=>{const p=join(root,'data/research/evidence',name,'collector.lock');return existsSync(p)?[{source:name,...optionalJson(p,{status:'OWNER_UNREADABLE'})}]:[];}),entryWeekEnded:config.endDate?now>new Date(config.endDate+'T23:59:59+03:00'):true};
 }finally{db.close();}
}
