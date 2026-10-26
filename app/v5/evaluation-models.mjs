import {readFileSync} from 'node:fs';
import {hash,required,finite,nonempty,timestamp} from './contract.mjs';
import {rubricDimensions,caseCategories,sha} from './evaluation-contract.mjs';

export function freezeCase(input) {
  required(nonempty(input.id)&&timestamp(input.cutoffAt)&&timestamp(input.frozenAt)&&Date.parse(input.frozenAt)>=Date.parse(input.cutoffAt)&&nonempty(input.task),'Case identity, task and cutoff required');
  required(input.categories?.length&&input.categories.every(c=>caseCategories.includes(c)),'Registered case category required');
  required(input.evidence?.length&&new Set(input.evidence.map(e=>e.id)).size===input.evidence.length,'Unique evidence required');
  const policy=JSON.parse(readFileSync(new URL('../../research/source-policy.json',import.meta.url)));
  for(const e of input.evidence){required(nonempty(e.id)&&sha(e.contentHash)&&nonempty(e.source)&&timestamp(e.availableAt)&&Date.parse(e.availableAt)<=Date.parse(input.cutoffAt)&&nonempty(e.passage),'Blind evidence must be available at cutoff with retained passage and hash');required(!policy.excludedDomains.some(d=>e.source.toLowerCase().includes(d)),'Excluded source cannot enter a new evaluation case');}
  required(input.truth&&nonempty(input.truth.checkedBy)&&timestamp(input.truth.checkedAt)&&Date.parse(input.truth.checkedAt)<=Date.parse(input.frozenAt)&&input.truth.numbers?.length>0,'Independent numerical truth/adjudicator required');
  required(new Set(input.truth.numbers.map(n=>n.id)).size===input.truth.numbers.length,'Unique truth item IDs required');
  for(const n of input.truth.numbers)required(nonempty(n.id)&&finite(n.value)&&finite(n.absoluteTolerance)&&n.absoluteTolerance>=0&&nonempty(n.unit)&&nonempty(n.period)&&nonempty(n.entity)&&input.evidence.some(e=>e.id===n.evidenceId),'Truth numbers require finite tolerance, unit/period/entity and source passage');
  const content=structuredClone(input);return {...content,caseHash:hash(content),groundTruthStatus:'SUPPLIED_ADJUDICATION_REQUIRES_INDEPENDENT_REVIEW'};
}
export function caseTemporalContext(c) {
  verifyCase(c);
  return {caseId:c.id,cutoffAt:c.cutoffAt,evidence:c.evidence.map(e=>({id:e.id,availableAt:e.availableAt,availableAtCutoff:Date.parse(e.availableAt)<=Date.parse(c.cutoffAt),secondsBeforeCutoff:(Date.parse(c.cutoffAt)-Date.parse(e.availableAt))/1000})),meaning:'Capture availability versus this case cutoff only. Financial period, event date and hypothetical decision cutoff inside the task remain distinct.'};
}
export function blindPacket(c,format='LEGACY') {
  verifyCase(c);
  required(['LEGACY','CASE_CONTEXT_1'].includes(format),'Unknown blind packet format');
  const packet={id:c.id,caseHash:c.caseHash,task:c.task,cutoffAt:c.cutoffAt,evidence:structuredClone(c.evidence),instruction:'Use only the supplied evidence and permitted tools at cutoff. State missingness and counterevidence. Future outcomes, truth answers and other model answers are withheld.'};
  return format==='LEGACY'?packet:{...packet,packetFormat:format,caseContext:caseTemporalContext(c)};
}
function verifyCase(c){const {caseHash,groundTruthStatus,...content}=c;required(hash(content)===caseHash,'Frozen case hash mismatch');}
export function scoreModelCase(c,run,review) {
  verifyCase(c);
  required(run.caseHash===c.caseHash&&run.packetHash===hash(blindPacket(c,run.packetFormat||'LEGACY'))&&nonempty(run.actorId)&&nonempty(run.modelId)&&sha(run.configurationHash)&&sha(run.promptHash)&&sha(run.toolPermissionsHash),'Actual model/config/prompt/tools and identical blind packet binding required');
  if(run.packetFormat==='CASE_CONTEXT_1')required(hash(run.caseContext)===hash(caseTemporalContext(c)),'Model answer context differs from this case identity/cutoff/source availability');
  required(timestamp(run.startedAt)&&timestamp(run.finishedAt)&&Date.parse(run.startedAt)>=Date.parse(c.frozenAt)&&Date.parse(run.finishedAt)>=Date.parse(run.startedAt)&&Number.isInteger(run.toolCalls)&&run.toolCalls>=0&&nonempty(run.output)&&run.outputHash===hash(run.output),'Actual dated model output and telemetry required');
  required(run.synthetic!==true&&!/SYNTHETIC|NOT_A_MODEL/i.test(run.modelId),'Synthetic outputs cannot count as actual model evaluation');
  required(nonempty(review.actorId)&&review.actorId!==run.actorId&&c.truth.checkedBy!==run.actorId&&review.runHash===hash(run)&&review.caseHash===c.caseHash&&timestamp(review.at)&&Date.parse(review.at)>=Date.parse(run.finishedAt),'Separate reviewer and truth adjudicator with exact output binding required');
  required(rubricDimensions.every(d=>Number.isInteger(review.rubric?.[d]?.score)&&review.rubric[d].score>=0&&review.rubric[d].score<=4&&nonempty(review.rubric[d].reason)),'All five fixed rubric scores and reasons required');
  required(['criticalFabrications','criticalUnitPeriodIdentityErrors'].every(k=>Number.isInteger(review[k])&&review[k]>=0)&&Array.isArray(review.disagreements)&&Array.isArray(review.missingEvidence),'Critical errors, disagreements and missing evidence must be explicit');
  required(Array.isArray(run.extractedNumbers)&&new Set(run.extractedNumbers.map(n=>n.id)).size===run.extractedNumbers.length,'Unique extracted numbers required');
  required(run.extractedNumbers.every(n=>c.truth.numbers.some(t=>t.id===n.id)),'Unadjudicated extracted numbers must be resolved before scoring');
  const numbers=c.truth.numbers.map(n=>{
    const x=run.extractedNumbers.find(v=>v.id===n.id),correct=x&&finite(x.value)&&Math.abs(x.value-n.value)<=n.absoluteTolerance&&x.unit===n.unit&&x.period===n.period&&x.entity===n.entity&&x.evidenceId===n.evidenceId;
    return {id:n.id,status:!x?'MISSING':correct?'CORRECT':'INCORRECT'};
  });
  const correct=numbers.filter(n=>n.status==='CORRECT').length,accuracy=correct/numbers.length;
  return {caseId:c.id,caseHash:c.caseHash,modelId:run.modelId,configurationHash:run.configurationHash,promptHash:run.promptHash,toolPermissionsHash:run.toolPermissionsHash,actorId:run.actorId,reviewer:review.actorId,runHash:hash(run),reviewHash:hash(review),categories:c.categories,numbers,correct,denominator:numbers.length,accuracy,criticalFabrications:review.criticalFabrications,criticalUnitPeriodIdentityErrors:review.criticalUnitPeriodIdentityErrors,rubric:review.rubric,disagreements:review.disagreements,missingEvidence:review.missingEvidence,status:accuracy>=.95&&review.criticalFabrications===0&&review.criticalUnitPeriodIdentityErrors===0?'FACTUAL_GATE_PASS':'CASE_FAIL',analyticalQuality:'REVIEW_REQUIRED_NO_AGGREGATE_RUBRIC_PASS_THRESHOLD_FROZEN',durationSeconds:(Date.parse(run.finishedAt)-Date.parse(run.startedAt))/1000,toolCalls:run.toolCalls,independenceLimitation:'Distinct actor IDs are provenance, not proof of independent humans or uncorrelated errors. Source answers and factual-error adjudication remain review responsibilities.'};
}

export function modelSuite(cases,scores) {
  required(new Set(cases.map(c=>c.id)).size===cases.length,'Duplicate cases');cases.forEach(verifyCase);
  required(scores.every(s=>cases.some(c=>c.caseHash===s.caseHash)),'Score from unregistered case');
  const groups=new Map();for(const s of scores){const k=hash({modelId:s.modelId,configurationHash:s.configurationHash,promptHash:s.promptHash,toolPermissionsHash:s.toolPermissionsHash});if(!groups.has(k))groups.set(k,[]);groups.get(k).push(s);}
  const categories=[...new Set(cases.flatMap(c=>c.categories))],coverageGaps=caseCategories.filter(c=>!categories.includes(c));
  const models=[...groups.entries()].map(([configurationKey,ss])=>{
    required(new Set(ss.map(s=>s.caseHash)).size===ss.length,'Repeated attempt requires a separately registered suite, not best-answer selection');
    const missing=cases.filter(c=>!ss.some(s=>s.caseHash===c.caseHash)).map(c=>c.id),correct=ss.reduce((n,s)=>n+s.correct,0),denominator=ss.reduce((n,s)=>n+s.denominator,0),critical=ss.reduce((n,s)=>n+s.criticalFabrications+s.criticalUnitPeriodIdentityErrors,0);
    const incomplete=cases.length<20||coverageGaps.length||missing.length;
    return {configurationKey,modelId:ss[0].modelId,casesScored:ss.length,missing,accuracy:denominator?correct/denominator:null,correct,denominator,criticalErrors:critical,caseFailures:ss.filter(s=>s.status==='CASE_FAIL').map(s=>s.caseId),status:critical?'FAIL':incomplete?'BLOCKED':correct/denominator>=.95?'FACTUAL_GATE_PASS':'FAIL',analyticalQuality:'REVIEW_REQUIRED_NO_AGGREGATE_RUBRIC_PASS_THRESHOLD_FROZEN',rubricMeans:Object.fromEntries(rubricDimensions.map(d=>[d,ss.reduce((n,s)=>n+s.rubric[d].score,0)/ss.length]))};
  });
  return {registeredCases:cases.length,coverageGaps,models,status:!models.length?'BLOCKED_NO_ACTUAL_RUNS':models.every(m=>m.status==='FACTUAL_GATE_PASS')?'FACTUAL_GATE_PASS_QUALITY_REVIEW_REQUIRED':'NOT_PASSED',claim:'Case-suite factual accuracy only; low qualitative rubric scores cannot become analytical validation. No trading edge or universal model superiority. Unavailable models remain unavailable.'};
}
