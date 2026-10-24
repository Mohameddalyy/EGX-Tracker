import {appendRecord,records,getRecord,hash,finite,requireValue} from './analysis-store.mjs';
export const reviewCategories=['data','extraction','valuation','thesis','timing','portfolio','execution','coverage'];
export function historicalCases(source,analysis,ticker=null,now=new Date()){
 const decisions=source.prepare('SELECT d.*,m.sector FROM agent_decisions d LEFT JOIN market_catalog m ON m.ticker=d.ticker WHERE d.created_at<=? ORDER BY d.created_at DESC').all(now.toISOString()).filter(d=>!ticker||d.ticker===ticker);
 return decisions.map(d=>{const p=JSON.parse(d.payload),row=source.prepare('SELECT observed_at,payload FROM decision_outcomes WHERE decision_id=? AND observed_at<=? ORDER BY observed_at DESC,rowid DESC LIMIT 1').get(d.id,now.toISOString()),o=row?JSON.parse(row.payload):null;if(o)delete o.inputBars;return {caseId:d.id,ticker:d.ticker,sector:d.sector||null,action:d.action,decisionAt:d.created_at,prediction:p.prediction,rationale:p.rationale,counterargument:p.counterargument,reviewConditions:p.reviewConditions,setupFamily:p.riskPlan?.method||'not recorded',regime:'not recorded',outcome:o,outcomeObservedAt:row?.observed_at||null,supersededBy:decisions.find(n=>n.supersedes===d.id)?.id||null,reviews:records(analysis,'error-review',d.ticker,now).filter(r=>r.caseId===d.id),interpretation:'All actions and superseded decisions retained; rising after Wait is not automatically a mistake'};});
}
export function retrieveCases(cases,{ticker,sector,family,regime}={}){
 return cases.map(c=>({...c,relevance:(c.ticker===ticker?4:0)+(sector&&c.sector===sector?2:0)+(family&&c.setupFamily===family?2:0)+(regime&&c.regime===regime?1:0)})).filter(c=>c.relevance>0).sort((a,b)=>b.relevance-a.relevance||b.decisionAt.localeCompare(a.decisionAt));
}
export function researchCases(source,db,now=new Date()){
 const shadows=records(db,'forecast',null,now).map(f=>{const outcomes=records(db,'shadow-outcome',f.ticker,now).filter(o=>o.forecastId===f.recordId),o=outcomes.at(-1),trial=getRecord(db,f.trialId),d=trial?.frozenDossiers?.[f.ticker];return {caseId:f.recordId,ticker:f.ticker,sector:d?.stock.sector||null,action:f.action,decisionAt:f.registeredAt,prediction:{horizonSessions:f.horizonSessions,model:f.modelId},rationale:f.rationale,counterargument:d?.thesis?.bearCase||'Not recorded',reviewConditions:d?.thesis?.invalidation||'Follow the precommitted exit policy',setupFamily:trial?.rules?.find(r=>r.id===f.modelId)?.family||'not recorded',regime:d?.marketState||'not recorded',outcome:o?.result||null,outcomeObservedAt:o?.recordedAt||null,reviews:records(db,'error-review',f.ticker,now).filter(r=>r.caseId===f.recordId),interpretation:'Prospective daily shadow case, not an executed trade or validated edge'};});
 return [...historicalCases(source,db,null,now),...shadows];
}
export function saveErrorReview(db,r,knownCases,now=new Date()){
 requireValue(knownCases.some(c=>c.caseId===r.caseId&&c.ticker===r.ticker)&&reviewCategories.includes(r.category),'Review must link a saved case and known error category');
 for(const k of ['reviewer','finding','originalEvidence','alternativeExplanation','proposedChange','validationTest','regressionRisk'])requireValue(typeof r[k]==='string'&&r[k].trim(),'Review requires '+k);
 requireValue(['error-supported','uncertain','process-sound-outcome-adverse','missed-opportunity-to-investigate'].includes(r.assessment),'Distinguish process errors from outcomes');
 return appendRecord(db,'error-review',{...r,status:'Proposal only; no strategy/risk mutation',reviewedAt:now.toISOString()},now);
}
export function createEvaluationPacket(db,p,now=new Date()){
 requireValue(typeof p.name==='string'&&p.name.trim()&&Array.isArray(p.modelNames)&&p.modelNames.length>=2&&new Set(p.modelNames).size===p.modelNames.length,'At least two distinct named model candidates required');
 requireValue(p.dossier&&p.dossier.ticker&&p.dossier.asOf&&typeof p.task==='string'&&p.task.trim()&&Array.isArray(p.expectedFacts),'Frozen dated dossier, task and ground truth required');
 for(const f of p.expectedFacts)requireValue(typeof f.key==='string'&&finite(f.value)&&typeof f.sourceId==='string'&&f.sourceId.trim(),'Ground truth requires a numerical fact with source');
 const shuffled=p.modelNames.slice().sort((a,b)=>hash([p.name,a,now.toISOString()]).localeCompare(hash([p.name,b,now.toISOString()]))),assignments=shuffled.map((model,i)=>({alias:'Candidate '+String.fromCharCode(65+i),model}));
 const dossierDigest=hash(p.dossier);return appendRecord(db,'evaluation-packet',{name:p.name,ticker:p.dossier.ticker,createdAt:now.toISOString(),task:p.task,dossier:p.dossier,dossierDigest,toolPolicy:p.toolPolicy||'Identical frozen dossier and cited source access; no future material',expectedFacts:p.expectedFacts,assignments,qualityPolicy:'No token cap or weakened evidence requirements. Record completeness, factual accuracy, reasoning quality and latency separately.'},now);
}
export function publicPacket(p){const {assignments,expectedFacts,...packet}=p;return {...packet,aliases:assignments.map(a=>a.alias),objectiveFactCount:expectedFacts.length};}
export function saveEvaluationOutput(db,o,now=new Date()){
 const packet=getRecord(db,o.packetId);requireValue(packet?.kind==='evaluation-packet'&&packet.assignments.some(a=>a.alias===o.alias)&&o.dossierDigest===packet.dossierDigest,'Output must match frozen dossier and blind model slot');
 requireValue(typeof o.analysis==='string'&&o.analysis.trim()&&Array.isArray(o.extractedFacts)&&Array.isArray(o.citedSourceIds)&&finite(o.durationMs)&&o.durationMs>=0,'Complete model analysis, citations, extracted facts and duration required');
 const existing=records(db,'evaluation-output',packet.ticker,now).find(x=>x.packetId===o.packetId&&x.alias===o.alias);requireValue(!existing,'Each model slot has one immutable response; create a new packet for a retry');
 const objective=packet.expectedFacts.map(f=>{const a=o.extractedFacts.find(a=>a.key===f.key),tolerance=Math.max(Math.abs(f.value)*1e-6,1e-8);return {key:f.key,correct:finite(a?.value)&&Math.abs(a.value-f.value)<=tolerance&&a.sourceId===f.sourceId,expectedSourceId:f.sourceId};});
 const known=new Set(packet.dossier.sourceIds||[]),unsupported=o.citedSourceIds.filter(s=>!known.has(s));
 return appendRecord(db,'evaluation-output',{...o,ticker:packet.ticker,objective:{tested:objective.length,correct:objective.filter(f=>f.correct).length,facts:objective,unsupportedCitationIds:unsupported},status:'Objective extraction scored; judgement rubric still requires a blinded reviewer'},now);
}
export function saveEvaluationScore(db,s,now=new Date()){
 const output=getRecord(db,s.outputId);requireValue(output?.kind==='evaluation-output'&&typeof s.reviewer==='string'&&s.reviewer.trim(),'Existing blind output and reviewer required');
 const dimensions=['sectorReasoning','counterEvidence','numericalInterpretation','decisionUsefulness','uncertaintyHandling'];
 for(const k of dimensions)requireValue(Number.isInteger(s.scores?.[k])&&s.scores[k]>=0&&s.scores[k]<=4&&typeof s.evidence?.[k]==='string'&&s.evidence[k].trim(),'Blinded rubric score 0–4 and supporting evidence required: '+k);
 return appendRecord(db,'evaluation-score',{...s,ticker:output.ticker,status:'Reviewer judgement; not automatically a performance ranking or model promotion'},now);
}
export function evaluationSummary(db,now=new Date()){
 return records(db,'evaluation-packet',null,now).map(p=>({packetId:p.recordId,name:p.name,createdAt:p.createdAt,ticker:p.ticker,dossierDigest:p.dossierDigest,aliases:p.assignments.map(a=>a.alias),objectiveFactCount:p.expectedFacts.length,outputs:records(db,'evaluation-output',p.ticker,now).filter(o=>o.packetId===p.recordId).map(o=>({id:o.recordId,alias:o.alias,durationMs:o.durationMs,objective:o.objective,scores:records(db,'evaluation-score',p.ticker,now).filter(s=>s.outputId===o.recordId)})),status:'No automated model winner; compare full quality and prospective investment value'}));
}
