import {appendRecord,records,getRecord,knownDocument,requireValue,finite,validTime} from './analysis-store.mjs';

export function saveMacro(db,m,now=new Date()){
 const document=knownDocument(db,m.documentId,'MACRO',now);
 requireValue(document.sourceType==='regulator'&&['policy-rate','inflation','egp-usd','energy-price'].includes(m.indicator),'Macro observations require an authoritative regulator source and supported indicator');
 requireValue(finite(m.value)&&m.value>=0&&typeof m.unit==='string'&&m.unit.trim()&&validTime(m.periodEnd)&&Date.parse(m.periodEnd)<=Date.parse(document.publishedAt),'Dated macro value and explicit units required');
 requireValue(typeof m.definition==='string'&&m.definition.trim()&&typeof m.quote==='string'&&m.quote.trim(),'Definition and exact source excerpt required');
 return appendRecord(db,'macro',{...m,ticker:'MACRO',publishedAt:document.publishedAt,firstKnownAt:now.toISOString()},now);
}
export function saveTransmission(db,t,now=new Date()){
 knownDocument(db,t.documentId,t.ticker,now);const macro=getRecord(db,t.macroId);
 requireValue(macro?.kind==='macro'&&Date.parse(macro.recordedAt)<=+now,'Known dated macro observation required');
 for(const k of ['channel','economicMechanism','counterargument','confirmation','invalidation'])requireValue(typeof t[k]==='string'&&t[k].trim(),'Company transmission requires '+k);
 requireValue(t.sensitivity===null||t.sensitivity&&finite(t.sensitivity.value)&&typeof t.sensitivity.unit==='string'&&typeof t.sensitivity.method==='string','Sensitivity is unknown or an explicit justified estimate');
 return appendRecord(db,'transmission',{...t,status:'Company-specific hypothesis, not an automatic macro buy signal'},now);
}
export function macroContext(db,ticker=null,now=new Date()){
 const all=records(db,'macro',null,now),latest=[...new Set(all.map(m=>m.indicator))].map(key=>all.filter(m=>m.indicator===key).sort((a,b)=>b.periodEnd.localeCompare(a.periodEnd)||b.recordedAt.localeCompare(a.recordedAt))[0]);
 return {observations:latest,companyHypotheses:ticker?records(db,'transmission',ticker,now):[],status:latest.length?'Dated authoritative observations; inspect publication and reference period':'No verified macro inputs saved',interpretation:'Rates, FX and inflation transmit differently through revenue, debt and costs. No direction, real return or FX conversion is inferred.'};
}
