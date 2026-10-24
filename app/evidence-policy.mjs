import {readFileSync} from 'node:fs';
export const evidenceContractVersion='egx-field-evidence-1';
const dictionary=JSON.parse(readFileSync(new URL('../verification/v5-phase2-20261023/data-dictionary.json',import.meta.url),'utf8'));
export const evidenceDictionary=dictionary.rows;
export const entryCoreFields=['isin_alias_segment','currency','historical_ohlcv','adjustment_basis','solvency_bank_metrics','news_disclosure_coverage','corporate_actions','median_turnover20','ownership_control_events'];
const optional=new Set(dictionary.rows.filter(x=>x.criticality==='nice-to-have').map(x=>x.id));
const important=new Set(dictionary.rows.filter(x=>x.criticality==='important').map(x=>x.id));
export function fieldConsequence(id,{sector,claims=[]}={}){
 if(id==='current_ratio'&&/bank/i.test(sector||''))return {level:'not-applicable',consequence:'Use bank capital, credit and funding measures; no current-ratio penalty.'};
 if(optional.has(id))return {level:'optional',consequence:'Omit unavailable feature; no penalty or redistribution of weights.'};
 if(id==='ownership_control_events'||entryCoreFields.includes(id))return {level:'critical',consequence:'Resolve required fact before the dependent approval; continue independent research.'};
 const rule=dictionary.rows.find(x=>x.id===id);if(!rule)return {level:'critical',consequence:'Unknown contract field requires explicit review; cannot be waived.'};
 if(rule.criticality.startsWith('conditional'))return {level:claims.includes('value')||claims.includes('quality')?'critical':'claim-dependent',consequence:'Required when the thesis relies on this measure; no automatic change of strategy.'};
 if(important.has(id))return {level:'important',consequence:'Document fallback, uncertainty and risk treatment; do not discard the stock.'};
 return {level:'critical',consequence:rule.consequence};
}
function checked(c,sources,now){return c?.status==='verified'&&typeof c.note==='string'&&c.note.trim()&&Number.isFinite(Date.parse(c.asOf))&&Date.parse(c.asOf)<=+now&&Array.isArray(c.sourceIds)&&c.sourceIds.length&&c.sourceIds.every(id=>sources.has(id));}
export function validateFieldEvidence(report,a,now=new Date()){
 const review=a.fieldEvidence;if(review?.version!==evidenceContractVersion||!review.fields||Array.isArray(review.fields)||!Array.isArray(review.claims)||!Array.isArray(review.reliedUponFields)||!Array.isArray(review.gaps)||typeof review.analyst!=='string'||!review.analyst.trim())throw Error('Versioned field evidence, analyst and declared gaps required');
 const ids=new Set(report.sources.map(x=>x.id)),required=[...new Set([...entryCoreFields,...review.reliedUponFields])];
 for(const id of review.reliedUponFields)if(!dictionary.rows.some(x=>x.id===id)&&id!=='ownership_control_events')throw Error('Unknown relied-upon field '+id);
 for(const id of required)if(!checked(review.fields[id],ids,now))throw Error('Incomplete critical field: '+id);
 // All six areas still get substantive analysis; a partial area is not silently verified.
 for(const area of ['financials','ownership','news','corporateActions','technicals','liquidity']){const c=a.evidenceChecks?.[area];if(!c||!['verified','partial'].includes(c.status)||typeof c.note!=='string'||!c.note.trim())throw Error('Missing substantive area review: '+area);if(c.status==='verified'&&!checked(c,ids,now))throw Error('Unsourced verified area: '+area);if(c.status==='partial'&&!review.gaps.some(g=>g.area===area))throw Error('Partial area needs explicit field gaps: '+area);}
 for(const [id,c] of Object.entries(review.fields)){
  if(!dictionary.rows.some(x=>x.id===id)&&id!=='ownership_control_events')throw Error('Unknown evidence field '+id);
  if(c?.status==='verified'&&!checked(c,ids,now))throw Error('Unsourced verified field: '+id);
  if(c?.status!=='verified'&&!review.gaps.some(g=>g.field===id))throw Error('Unresolved field omitted from gap ledger: '+id);
 }
 for(const g of review.gaps){
  const rule=fieldConsequence(g.field,{sector:review.sector,claims:review.claims||[]});
  if(review.fields[g.field]?.status==='verified')throw Error('Verified field also declared unresolved: '+g.field);
  if(required.includes(g.field)||rule.level==='critical')throw Error('Critical gap cannot be waived: '+g.field);
  if(!Array.isArray(g.attempts)||!g.attempts.length||!g.consequence||!g.nextReview||!g.materialityRationale)throw Error('Gap needs attempted fallbacks, consequence, materiality and next review');
  if(rule.level==='important'||rule.level==='claim-dependent'){if(!g.riskTreatment||!g.independentReview?.reviewer||!g.independentReview?.rationale||g.independentReview.reviewer===review.analyst)throw Error('Noncritical gap needs explicit independent treatment');}
 }
 return {version:evidenceContractVersion,requiredFields:required,gaps:review.gaps,scope:'Research promotion only; no execution or sizing authorization'};
}
