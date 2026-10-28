// The reporting boundary derives returns/counts from replayed ledgers instead of
// trusting user-supplied return vectors or an asserted prospective scope.
import {hash,required,finite} from './contract.mjs';
import {readArtifact,evaluationReleaseHash} from './evaluation-contract.mjs';
import {readEvaluationLedger,dailyEquity,interventionAttribution} from './evaluation-ledger.mjs';
import {comparisonFamily} from './evaluation-statistics.mjs';

export function boundComparisonInput({trialPath,ledgers,sessions,baselineDay}) {
  const trial=readArtifact(trialPath,'trial'),t=trial.payload;
  required(t.bindings.evaluationReleaseHash===evaluationReleaseHash(),'Registered matching evaluation release required');
  required(Array.isArray(ledgers)&&new Set(ledgers.map(x=>x.id)).size===ledgers.length,'Unique source ledger arm bindings required');
  required(sessions.length&&sessions[0].day===baselineDay&&sessions.every((s,i)=>s.verified===true&&s.sourceId&&/^[a-f0-9]{64}$/.test(s.sourceHash)&&(!i||s.day>sessions[i-1].day)),'Source-bound full calendar and previous-session baseline required');
  const arms=[],provenance=[];
  for(const binding of ledgers) {
    required(t.arms.some(a=>a.id===binding.id),'Unregistered ledger arm');
    const audit=readEvaluationLedger(binding.path);
    required(interventionAttribution(audit).policyComparisonEligible,'User-intervened ledger must remain separate from policy comparisons');
    required(audit.transitionReplay==='VERIFIED'&&audit.state.releaseHash===t.bindings.executionReleaseHash,'Registered matching execution release required');
    required(audit.state.variantId+':'+audit.state.scenario===binding.id,'Ledger variant/scenario substitution');
    required(baselineDay<audit.config.entryDays[0]&&audit.events.every(e=>e.at.slice(0,10)>baselineDay),'Baseline must precede all ledger activity and the registered entry window');
    const calendarDays=new Set(sessions.map(s=>s.day));
    required(audit.config.entryDays.filter(day=>day<=sessions.at(-1).day).every(day=>calendarDays.has(day)),'Reporting calendar omits a registered entry session');
    const bookDays=new Set(audit.events.flatMap(e=>(e.data?.book||e.data?.bundle?.ruleBook)?.sessions||[]).filter(s=>s.verified).map(s=>s.day));
    const admittedDays=[...bookDays].filter(day=>day>=baselineDay&&day<=sessions.at(-1).day).sort();
    required(hash(admittedDays)===hash(sessions.map(s=>s.day)),'Full reporting calendar must match admitted rule-book sessions, including after entries close');
    const curve=dailyEquity(audit,sessions.slice(1));let previous=10000000;
    const returns=curve.map(p=>{
      const value=p.status==='VERIFIED'&&finite(p.equityCents)&&previous>0?p.equityCents/previous-1:null;
      previous=p.status==='VERIFIED'?p.equityCents:null;
      return {day:p.day,value,status:value===null?'MISSING_OR_PROVISIONAL':'VERIFIED',stateHash:p.stateHash};
    });
    const end=sessions.at(-1).day,closed=Object.values(audit.state.positions).filter(p=>p.status==='CLOSED'&&p.entryDay>baselineDay&&p.exit.fill.marketAt.slice(0,10)<=end);
    arms.push({id:binding.id,scenario:audit.state.scenario,basis:'DAILY_PORTFOLIO_NET_RETURN',simulationResolution:'MINUTE',appropriateClosedObservations:closed.length,returns});
    provenance.push({id:binding.id,stateHash:audit.stateHash,chainHead:audit.chainHead,sourceScope:audit.scope,closedPositionIds:closed.map(p=>p.id),calendarHash:hash(sessions)});
  }
  // Current execution engine supports engineering ledgers only. A signed/asserted
  // string cannot upgrade these to prospectively observed trading evidence.
  return {scope:'SOURCE_BOUND_ENGINEERING',sessions:sessions.slice(1).map(s=>s.day),arms,provenance,trialHash:trial.contentHash,claim:'Engineering provenance verified. Prospective engine/admission and authorized observations remain W10 dependencies.'};
}
export function boundStatisticalReport(input) {
  const bound=boundComparisonInput(input);return {inputHash:hash(bound),provenance:bound.provenance,trialHash:bound.trialHash,sourceScope:bound.scope,...comparisonFamily(bound)};
}
