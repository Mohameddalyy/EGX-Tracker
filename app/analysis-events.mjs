import {appendRecord,records,knownDocument,requireValue,validTime,finite,hash} from './analysis-store.mjs';
export function saveCatalyst(db,e,now=new Date()){
 const d=knownDocument(db,e.documentId,e.ticker,now);
 requireValue(['earnings','capital-action','ownership','contract','regulatory','macro','operational'].includes(e.type)&&typeof e.title==='string'&&e.title.trim(),'Known catalyst type and title required');
 requireValue(validTime(e.publicAt)&&validTime(e.effectiveAt)&&Date.parse(e.publicAt)<=+now&&Date.parse(e.publicAt)>=Date.parse(d.publishedAt),'Verified public/effective timestamps required; effective dates may be future');
 for(const k of ['driver','economicMechanism','counterargument','confirmation','invalidation','pricedInEvidence'])requireValue(typeof e[k]==='string'&&e[k].trim(),'Catalyst requires '+k);
 requireValue(e.impactEstimate===null||e.impactEstimate&&finite(e.impactEstimate.value)&&typeof e.impactEstimate.unit==='string'&&typeof e.impactEstimate.method==='string','Impact is explicitly unknown or a sourced estimate');
 const eventKey=e.canonicalEventKey||hash([e.ticker,e.type,e.publicAt,e.effectiveAt,e.title.trim().toLowerCase()]);
 requireValue(typeof eventKey==='string'&&eventKey.length<=200,'Bounded canonical event identity required');
 const prior=records(db,'catalyst',e.ticker,now).find(x=>x.eventKey===eventKey);
 if(prior){if(prior.documentId===e.documentId)return {id:prior.recordId,duplicate:true};return appendRecord(db,'event-evidence',{ticker:e.ticker,eventId:prior.recordId,documentId:e.documentId,note:e.economicMechanism},now);}
 return appendRecord(db,'catalyst',{...e,eventKey,firstKnownAt:now.toISOString(),publishedAt:d.publishedAt,expectationBaseline:e.expectationBaseline||null,status:'Research hypothesis, not a causal attribution or clearance'},now);
}
export function eventAnalysis(db,ticker,now=new Date()){
 const events=records(db,'catalyst',ticker,now),documents=records(db,'document',ticker,now),last=documents.map(d=>d.accessedAt).sort().at(-1)||null;
 return {events,extraEvidence:records(db,'event-evidence',ticker,now),lastDocumentAccess:last,coverage:'Recorded primary events only; an empty ledger is not proof that no events or actions occurred',unresolved:events.filter(e=>!e.expectationBaseline).map(e=>({eventId:e.recordId,reason:'No verified expectations baseline; surprise and priced-in magnitude remain uncalibrated'}))};
}
export function saveThesis(db,t,now=new Date()){
 requireValue([5,20,60].includes(t.horizonSessions)&&['pullback','breakout-retest','catalyst','medium-value'].includes(t.family),'Explicit setup family and horizon required');
 for(const k of ['whyThisStock','whyNow','mispricingMechanism','bullCase','bearCase','alternativeExplanation','pricedIn','invalidation','whatWouldChangeMyMind','whyBetterThanAlternative','disagreementResolution'])requireValue(typeof t[k]==='string'&&t[k].trim(),'Thesis requires '+k);
 requireValue(Array.isArray(t.documentIds)&&t.documentIds.length>0,'Thesis needs source documents');for(const id of t.documentIds)knownDocument(db,id,t.ticker,now);
 requireValue(t.alternativeTicker&&t.alternativeTicker!==t.ticker&&typeof t.evidenceQuality==='string'&&t.evidenceQuality.trim()&&typeof t.uncertainties==='string'&&t.uncertainties.trim(),'Distinct alternative, evidence assessment and uncertainties required');
 requireValue(!('probabilityOfProfit' in t),'Probabilities require an empirical calibration record, not a model-written confidence number');
 return appendRecord(db,'thesis',{...t,asOf:now.toISOString(),status:'Analytical research; final guarded approval remains separate'},now);
}
