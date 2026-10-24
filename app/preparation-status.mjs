import {evidenceDictionary,evidenceContractVersion,fieldConsequence} from './evidence-policy.mjs';
import {historyRefreshState} from './refresh-selection.mjs';
import {exchangeEvidence} from './exchange-evidence.mjs';
import {documentReviews} from './document-verification.mjs';
import {readFileSync,existsSync} from 'node:fs';import {join} from 'node:path';
const has=(db,name)=>!!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
export function readinessOverview(db,{root}={}){
 const receipts=has(db,'preparation_receipts')?db.prepare('SELECT * FROM preparation_receipts ORDER BY at DESC').all().map(x=>({...x,payload:JSON.parse(x.payload)})):[];
 let library=null;if(root){const path=join(root,'data','research','evidence','library','index.json');if(existsSync(path)){const index=JSON.parse(readFileSync(path,'utf8')),items=Object.values(index.items);library={updatedAt:index.updatedAt,routes:items.length,responsesRetained:items.filter(x=>x.bodyPath).length,unavailable:items.filter(x=>x.status==='UNAVAILABLE').length,lastPass:index.coverage,indexPath:path,verifiedByDownload:false};}}
 if(root&&library){const path=join(root,'data','research','evidence','library','inspection.json');if(existsSync(path)){const inspected=JSON.parse(readFileSync(path,'utf8'));library.inspection={at:inspected.at,counts:inspected.counts};}const reviewed=documentReviews(root);library.reviewedDocuments=reviewed.length;library.reviewedFacts=reviewed.reduce((n,r)=>n+r.facts.length,0);}
 return {contract:evidenceContractVersion,exchange:root?exchangeEvidence(root,null,db.prepare('SELECT ticker,metadata FROM stocks').all()):null,library,baseline:receipts.find(x=>x.component==='baseline')||null,components:receipts.filter(x=>x.component!=='baseline').slice(0,8),repairs:has(db,'preparation_attempts')?db.prepare("SELECT ticker,component,target,at,status,next_retry,detail FROM preparation_attempts WHERE id IN (SELECT MAX(id) FROM preparation_attempts GROUP BY ticker,component) AND status!='verified' ORDER BY at DESC").all():[],note:'Missing optional fields do not reject a stock. Critical gaps block only dependent steps. Provider values still need source validation.'};
}
export function preparationManifest(db,now=new Date(),{savedAnalysis=[]}={}){
 const stats=db.prepare('SELECT ticker,COUNT(*) n,MIN(day) first,MAX(day) last FROM bars GROUP BY ticker').all();
 const last=db.prepare('SELECT b.*,c.captured_at,c.finality FROM bars b LEFT JOIN bar_captures c ON c.ticker=b.ticker AND c.day=b.day WHERE b.ticker=? ORDER BY b.day DESC LIMIT 1');
 const fields={},instruments=[];
 for(const s of db.prepare('SELECT s.*,m.catalog_json,m.status catalogStatus FROM stocks s JOIN market_catalog m ON m.ticker=s.ticker ORDER BY s.ticker').all()){
  const row=db.prepare('SELECT * FROM market_facts WHERE ticker=?').get(s.ticker),v=row?JSON.parse(row.payload):{},history=stats.find(x=>x.ticker===s.ticker),fresh=historyRefreshState(s,last.get(s.ticker),now);
  const components=evidenceDictionary.map(r=>{
   const rule=fieldConsequence(r.id,{sector:v.industry||v.sector});let value=v[r.id],state=value===null||value===undefined||value==='NoRating'?'MISSING':'AVAILABLE_UNVERIFIED';
   if(state==='AVAILABLE_UNVERIFIED'&&(!Number.isFinite(Date.parse(row?.captured_at))||+now-Date.parse(row.captured_at)>36*3600000||Date.parse(row.captured_at)>+now))state='STALE_OR_PARTIAL';
   if(r.id==='historical_ohlcv'&&history){value=history;state=fresh.due?'STALE_OR_PARTIAL':'CONFIRMED_SESSION_COMPONENT';}
   if(rule.level==='not-applicable'){state='NOT_APPLICABLE';value=null;}
   if(['price_earnings_ttm','price_book_fq'].includes(r.id)&&typeof value==='number'&&value<=0)state='NOT_MEANINGFUL_MULTIPLE';
   fields[r.id]??={available:0,missing:0,notApplicable:0,invalid:0,stale:0};fields[r.id][state==='MISSING'?'missing':state==='STALE_OR_PARTIAL'?'stale':state==='NOT_APPLICABLE'?'notApplicable':state==='NOT_MEANINGFUL_MULTIPLE'?'invalid':'available']++;
   return {field:r.id,state,criticality:rule.level,value:value??null,consequence:rule.consequence,fallbacks:r.fallback,capturedAt:r.id==='historical_ohlcv'?s.retrieved_at:row?.captured_at??null};
  });
  const decisions=has(db,'agent_decisions')?db.prepare('SELECT id,action,created_at FROM agent_decisions WHERE ticker=? ORDER BY created_at').all(s.ticker):[];
  instruments.push({ticker:s.ticker,name:s.name,currency:s.currency,history:fresh,recordedDecisions:decisions,savedAnalyticalEvidence:savedAnalysis.filter(x=>x.ticker===s.ticker),fields:components,sourceCoverage:{financials:'Retained analytical records below; reconcile periods, revisions and missing fields before claiming current coverage',news:'No complete current disclosure watermark certified',actions:'No current corporate-action clearance certified'},status:'RESEARCH_RETAINED'});
 }
 return {version:'preparation-baseline-1',at:now.toISOString(),universe:instruments.length,fieldsPerInstrument:evidenceDictionary.length,fieldCoverage:fields,summary:{historiesReusable:instruments.filter(x=>!x.history.due).length,historiesDue:instruments.filter(x=>x.history.due).length,recordedDecisions:instruments.reduce((n,x)=>n+x.recordedDecisions.length,0),tradeReady:0},instruments,complete:false,limitations:['All available local/provider components and explicit gaps retained; not a completed primary-source review.','Primary documents, event coverage and execution rules require independent verification. No paper test activated.']};
}
