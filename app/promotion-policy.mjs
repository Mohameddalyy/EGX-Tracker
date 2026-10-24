import {validateReport,entryRisk} from './research.mjs';
import {validateTradePlan} from './trade-plans.mjs';
import {validateFieldEvidence} from './evidence-policy.mjs';
import {historyRefreshState} from './refresh-selection.mjs';
export const requiredChecks=['financials','ownership','news','corporateActions','technicals','liquidity'];
export function validatePromotion(report,assessment,context,now=new Date()){
 validateReport(report);if(report.type!=='research'||!['Watch','Conditional setup'].includes(assessment.verdict)||assessment.pipelineDecision!=='approve')throw Error('Analyst approval with a qualifying research verdict required');
 const age=now.getTime()-Date.parse(report.createdAt);if(age<0||age>86400000)throw Error('Research report is stale or future-dated');
 const stock=context.stocks.find(s=>s.ticker===assessment.ticker),captureAge=now.getTime()-Date.parse(stock?.retrieved_at);
 if(!stock?.latest||stock.currency!=='EGP'||!Number.isFinite(captureAge)||captureAge<0||captureAge>36*3600000||now.getTime()-Date.parse(stock.latest.day)>8*86400000)throw Error('Fresh confirmed EGP context required');
 validateFieldEvidence(report,assessment,now);
 const readiness=historyRefreshState(stock,stock.latest,now);if(readiness.due)throw Error('Fresh confirmed EGP context required: '+readiness.reason);
 if(!['Short term','Medium term'].includes(assessment.horizon))throw Error('Swing/medium-term horizon required');const p=assessment.riskPlan;if(!p||p.currency!=='EGP'||!Number.isFinite(Date.parse(p.expiresAt))||Date.parse(p.expiresAt)<=now.getTime()||typeof p.costAssumption!=='string'||!p.costAssumption.trim())throw Error('Dated entry/stop/target and cost scenario required');
 validateTradePlan(p,stock);return entryRisk({entry:p.entry,stop:p.stop,target:p.target,roundTripCostFraction:p.costScenarioFraction});
}
