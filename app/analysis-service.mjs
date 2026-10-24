import {saveMacro,saveTransmission} from './analysis-macro.mjs';
import {saveDocument,getRecord,records,requireValue,hash,appendRecord} from './analysis-store.mjs';
import {saveStatement,saveValuation,extractStatementLines} from './analysis-financials.mjs';
import {saveCatalyst,saveThesis} from './analysis-events.mjs';
import {portfolioRisk} from './analysis-risk.mjs';
import {registerTrial,registerForecast} from './analysis-strategies.mjs';
import {historicalCases,researchCases,saveErrorReview,createEvaluationPacket,publicPacket,saveEvaluationOutput,saveEvaluationScore} from './analysis-learning.mjs';
import {analysisDossier,refreshAnalysis} from './analysis.mjs';
import {isConfirmedBar} from './finality.mjs';
export function saveAnalysisInput(source,db,root,kind,p,now=new Date()){
 if(p.ticker&&!(p.ticker==='MACRO'&&['document','macro'].includes(kind)))requireValue(source.prepare('SELECT 1 FROM stocks WHERE ticker=?').get(p.ticker),'Unknown tracker stock; import catalog first');
 if(kind==='document')return saveDocument(db,root,p,now);
 if(kind==='statement')return saveStatement(db,p,now);
 if(kind==='valuation')return saveValuation(db,p,now);
 if(kind==='macro')return saveMacro(db,p,now);
 if(kind==='transmission')return saveTransmission(db,p,now);
 if(kind==='catalyst')return saveCatalyst(db,p,now);
 if(kind==='thesis'){requireValue(source.prepare('SELECT 1 FROM stocks WHERE ticker=?').get(p.alternativeTicker),'Thesis alternative must be a known catalog company');return saveThesis(db,p,now);}
 if(kind==='trial'){
  const cutoff=new Date(p.informationCutoff);requireValue(Number.isFinite(+cutoff)&&+now-+cutoff>=0&&+now-+cutoff<=3600000,'Trial cutoff must be within the last hour');
  const frozenDossiers=Object.fromEntries((p.tickers||[]).map(ticker=>{const d=analysisDossier(source,db,root,ticker,cutoff);requireValue(d.stock.usableForCurrentResearch,'Trial needs fresh point-in-time EGP captures for '+ticker);return [ticker,d];}));
  return registerTrial(db,{...p,frozenDossiers},now);
 }
 if(kind==='forecast'){
  const trial=getRecord(db,p.trialId);requireValue(trial?.kind==='trial','Known trial required');
  const dossier=trial.frozenDossiers?.[p.ticker];requireValue(dossier?.stock.usableForCurrentResearch,'Forecast needs the fresh immutable dossier frozen at trial registration');
  const age=+now-Date.parse(trial.informationCutoff);requireValue(age>=0&&age<=3600000,'Register forecasts within one hour of the frozen trial cutoff; create a new trial for new information');
  if(p.modelId==='champion-priced-plan-1.0'&&p.action==='conditional-long'){
   const d=source.prepare('SELECT * FROM agent_decisions WHERE id=?').get(p.championDecisionId),plan=d?JSON.parse(d.payload).riskPlan:null;
   requireValue(d?.action==='Watch'&&d.ticker===p.ticker&&d.created_at<=trial.informationCutoff&&plan&&Date.parse(plan.expiresAt)>+now&&hash(p.entryZone)===hash(plan.entryZone)&&p.stop===plan.stop&&p.target===plan.target&&!source.prepare('SELECT 1 FROM agent_decisions WHERE supersedes=?').get(d.id),'Champion shadow entry must match a current approved plan known at the trial cutoff');
  }
  if(p.action==='conditional-long'&&p.modelId!=='champion-priced-plan-1.0'){
   const setup=dossier.setups.find(s=>s.id===p.modelId),trailing=p.modelId==='challenger-breakout-1.0';
   requireValue(setup?.eligibleHypothesis&&setup.geometry&&hash(p.entryZone)===hash(setup.geometry.entryZone)&&p.stop===setup.geometry.stop&&p.exitMethod===(trailing?'trailing':'time')&&(!trailing||p.atrAtDecision===setup.featureSnapshot.atr14)&&p.target==null,'Challenger forecast must match the eligible frozen hypothesis, geometry and exit policy');
  }
  return registerForecast(db,{...p,holidays:dossier.sessionCalendar.holidays,evidenceDigest:dossier.digest,informationCutoff:trial.informationCutoff},now);
 }
 if(kind==='error-review')return saveErrorReview(db,p,researchCases(source,db,now),now);
 if(kind==='evaluation-packet'){
  const dossier=analysisDossier(source,db,root,p.ticker,now),expectedFacts=dossier.financials.statements.filter(s=>s.verification==='verified').flatMap(s=>Object.entries(s.values).map(([key,v])=>({key:s.recordId+':'+key,value:v.value*(key==='regulatoryCapitalRatio'?1:s.scale),sourceId:s.documentId})));
  const saved=createEvaluationPacket(db,{...p,dossier,expectedFacts},now);return {...saved,packet:publicPacket(getRecord(db,saved.id))};
 }
 if(kind==='evaluation-output')return saveEvaluationOutput(db,p,now);
 if(kind==='evaluation-score')return saveEvaluationScore(db,p,now);
 if(kind==='extract-text')return extractStatementLines(p.text||'');
 if(kind==='portfolio'){
  const series={};for(const position of p.positions||[])series[position.ticker]=source.prepare('SELECT b.*,c.captured_at,c.finality FROM bars b LEFT JOIN bar_captures c ON c.ticker=b.ticker AND c.day=b.day WHERE b.ticker=? ORDER BY b.day').all(position.ticker).filter(b=>isConfirmedBar(b,now));
  const result=portfolioRisk(p,series,p.limits||{},now),saved=appendRecord(db,'portfolio-scenario',{asOf:now.toISOString(),input:p,series,result,authority:'Explicit supplied scenario; not a verified live-account balance or order'},now);
  return {...result,recordId:saved.id};
 }
 if(kind==='refresh')return refreshAnalysis(source,db,root,now);
 if(kind==='prepare-trial')return prepareShadowComparison(source,db,root,p,now);
 throw Error('Unsupported analytical operation');
}
export function prepareShadowComparison(source,db,root,p,now=new Date()){
 // One frozen information set, including observe decisions for ineligible models.
 db.exec('BEGIN IMMEDIATE');try{
  const trial=saveAnalysisInput(source,db,root,'trial',{...p,informationCutoff:now.toISOString(),capitalEGP:20000,feePerOrderEGP:5},now),saved=getRecord(db,trial.id),forecasts=[];
  for(const ticker of saved.tickers)for(const modelId of saved.modelIds){
   const d=saved.frozenDossiers[ticker],setup=d.setups.find(s=>s.id===modelId),eligible=!!setup?.eligibleHypothesis;
   const f={trialId:trial.id,ticker,modelId,horizonSessions:p.horizonSessions||20,currency:'EGP',action:eligible?'conditional-long':'observe',rationale:eligible?setup.description:setup?.reasons.join('; ')||'Champion requires a separately approved current priced plan; observation only'};
   if(eligible)Object.assign(f,setup.geometry,{exitMethod:modelId==='challenger-breakout-1.0'?'trailing':'time',atrAtDecision:setup.featureSnapshot.atr14});
   forecasts.push(saveAnalysisInput(source,db,root,'forecast',f,now));
  }
  db.exec('COMMIT');return {trialId:trial.id,forecasts,authority:'Prospective shadow hypotheses only; no orders or model promotion'};
 }catch(e){db.exec('ROLLBACK');throw e;}
}
export function importAnalysisBundle(source,db,root,bundle,now=new Date()){
 requireValue(Array.isArray(bundle.records)&&bundle.records.length>0&&bundle.records.length<=100,'One to 100 document/fact records per transactional bundle');
 const ids={},results=[];db.exec('BEGIN IMMEDIATE');try{for(const r of bundle.records){requireValue(['document','statement','valuation','catalyst','thesis','macro','transmission'].includes(r.kind),'Bundles contain evidence/research only');const p=structuredClone(r.payload);for(const key of ['documentId','statementId','macroId'])if(typeof p[key]==='string'&&p[key].startsWith('$')){requireValue(ids[p[key].slice(1)],'Unresolved evidence alias');p[key]=ids[p[key].slice(1)];}if(p.documentIds)p.documentIds=p.documentIds.map(x=>x.startsWith('$')?ids[x.slice(1)]:x);const result=saveAnalysisInput(source,db,root,r.kind,p,now);if(r.alias)ids[r.alias]=result.id;results.push({kind:r.kind,...result});}db.exec('COMMIT');return {results,aliases:ids};}catch(e){db.exec('ROLLBACK');throw e;}
}
