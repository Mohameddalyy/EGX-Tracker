import {required} from './contract.mjs';
import {armIds} from './evaluation-contract.mjs';

// Report an engineering inventory; an absent arm stays absent, never a zero-return substitute.
export function comparisonMatrix(trial,reports,attributions=[]) {
  required(trial.arms?.length===18&&new Set(trial.arms.map(a=>a.id)).size===18&&trial.arms.every(a=>armIds.includes(a.id)),'Complete registered trial matrix required');
  const ids=reports.map(r=>r.payload.variantId+':'+r.payload.scenario);
  required(new Set(ids).size===ids.length&&ids.every(id=>armIds.includes(id)),'Duplicate or unknown report arm');
  for(const r of reports)required(r.kind==='ledger'&&r.payload.releaseHash===trial.bindings.executionReleaseHash&&r.payload.scope==='SYNTHETIC_OR_ENGINEERING_ONLY_NOT_PROSPECTIVE_PERFORMANCE','Matching engine-bound engineering report required');
  required(new Set(attributions.map(a=>a.payload.variantId+':'+a.payload.scenario)).size===attributions.length,'Duplicate attribution arm');
  for(const a of attributions){const p=a.payload,r=reports.find(r=>r.payload.variantId===p.variantId&&r.payload.scenario===p.scenario);required(a.kind==='fixed-exit'&&p.scope==='FIXED-EXIT-ATTRIBUTION'&&p.conditional===true&&p.entryAuthorization===false&&r&&p.originalFinalStateHash===r.payload.stateHash&&p.executionReleaseHash===trial.bindings.executionReleaseHash,'Attribution must bind the same original ledger state and release');}
  return {trialId:trial.id,scope:trial.scope,arms:trial.arms.map(a=>{
    const r=reports.find(r=>r.payload.variantId+':'+r.payload.scenario===a.id),m=r?.payload;
    return {id:a.id,registeredAvailability:a.status,registeredReason:a.reason,reportHash:r?.contentHash??null,status:m?'ENGINEERING_OBSERVATION':'UNAVAILABLE',netReturnFraction:m?.netReturnFraction??null,closedTrades:m?.counts.closedTrades??null,unfilledIntents:m?.counts.unfilled??null,pendingExits:m?.counts.pendingExits??null,observedDrawdownFraction:m?.drawdown.fraction??null,reason:m?'Synthetic accounting example; not evidence of signal or analytical value':a.reason};
  }),claimStates:{specificationIntegrity:'See frozen-file preservation check',softwareCorrectness:'See version-bound test and replay evidence',operationalReadiness:'NOT_ESTABLISHED',paperObservations:'NO_PROSPECTIVE_OBSERVATIONS',analyticalValue:'INCONCLUSIVE',investablePerformance:'NOT_ESTABLISHED'},fixedExitAttribution:{status:attributions.length?'CONDITIONAL_REPLAYS_ATTACHED':'NOT_REQUESTED',reports:attributions.map(a=>({arm:a.payload.variantId+':'+a.payload.scenario,artifactHash:a.contentHash,originalStateHash:a.payload.originalFinalStateHash,equityDeltaCents:a.payload.actualMinusFixedExitEquityCents,blockedEvents:a.payload.blockedEvents,conditional:true}))},promotion:false};
}
