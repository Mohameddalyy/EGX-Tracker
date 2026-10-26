import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {hash} from '../../../app/v5/contract.mjs';
import {scoreModelCase} from '../../../app/v5/evaluation-models.mjs';
const base=new URL('../',import.meta.url),out=new URL('source-reviews-v2/',import.meta.url);mkdirSync(out,{recursive:true});
// Both attempts were read in full. Shared rubric judgments remain only where the
// independently authored source response substantively supports the same reason.
const replacements={
1:{numericalInterpretation:'Correct income reconciliation and signed half-year ECL; the additionally derived first-quarter charge80,318 thousand is correct and clearly distinguished from the quarter-two release.',sectorReasoning:'Explains financing income/deposit costs and missing cost-of-risk denominator after visually inspecting the source table.'},
2:{numericalInterpretation:'Reconciles group, shareholder and NCI profit and explicitly distinguishes shareholder attribution from separate-bank scope.'},
3:{numericalInterpretation:'Full source cash bridge independently checks:127.8+72.8-249.6-5.5=-54.5 million; receivables remain a movement, not a balance or proven loss.',counterevidence:'Uses source cash, advances/billings and financing/investing flows to balance accrual profit and collection strain.'},
4:{counterevidence:'Uses original operational tables: falling normalized EBITDA, teacher growth exceeding student growth, and lower utilization challenge a simple turnaround.',numericalInterpretation:'Correct segment reallocation and unchanged total; correctly separates25.5 million G&A effect on EBITDA from345.3 million finance cost below EBITDA.'},
5:{uncertainty:'Acknowledges a possible intermediate-rounding explanation but explicitly says cause is unestablished; selected statement amount remains anchor.'},
6:{numericalInterpretation:'Correct source-page current-asset subtraction and net-debt distinction; positive accounting working capital is not free cash.'},
7:{numericalInterpretation:'Correct scale/scope arithmetic with consolidated rounding caveat; warns against assigning entire group-parent difference to subsidiaries and against parent/group EPS mixing.'},
8:{uncertainty:'Requires appropriate period FX convention rather than arbitrary current spot, alongside compatible ownership scope and capital bases.'},
9:{decisionUsefulness:'Excludes the later release from the original historical decision while retaining it as later audit evidence; archival contemporaneous proof is specified.'},
10:{decisionUsefulness:'Preserves dated historic revenue and rejects a hypothetical quote as a refresh of fundamentals or actual executable price.'},
11:{numericalInterpretation:'Requested multiplier/share arithmetic and date labels are correct, but the response substitutes22:55:55.225Z for actual case cutoff22:56:32.892Z, reversing admissibility.',decisionUsefulness:'Incorrectly flags original-source timing as ineligible and conditions research on a nonexistent packet mismatch.',uncertainty:'Price/adjustment missingness is handled well, but the confidently stated source-after-cutoff defect is false.'},
12:{numericalInterpretation:'Correct per-share dividend, gross entitlement and record/payment labels; wrong case cutoff reverses capture eligibility.',decisionUsefulness:'Requests temporal resolution despite available source evidence, although total-return withholding remains appropriate.',uncertainty:'Preserves price/tax/ownership uncertainties but adds a false source timing mismatch.'},
13:{sectorReasoning:'Discusses how transaction assets/liabilities/capital structure affect construction-investor risk without inventing synergies.'},
14:{decisionUsefulness:'Rejects the whole order at the binding minute limit and calls for a new permitted observation/proposal, not partial execution.'},
15:{decisionUsefulness:'Retains all800 shares and pending exit with no fabricated proceeds, monetary marks or rule relaxation.'},
16:{decisionUsefulness:'Names no-addition control independently of cap/headroom arithmetic and does not turn conditional EGP ceilings into an approval.'},
17:{sectorReasoning:'Explains common FX/input-cost and working-capital channels with inventory/pass-through/hedge contingencies, without assigning an invented sector.'},
18:{uncertainty:'Explicitly separates narrative confidence, funded arithmetic and actual approval; no borrowing permission is inferred.'},
19:{decisionUsefulness:'Preserves the one mechanical opportunity and separates research refusal from technical failure while prioritizing collections and missing entry checks.'},
20:{numericalInterpretation:'Correct source gross-margin ratio with rounded-input precision and KPI/cash-margin distinctions.',uncertainty:'Original CIRA page inspection does not clear issuer-link provenance; identity/actions remain critical rather than arithmetically recoverable.'},
21:{counterevidence:'Directly challenges customer dependence, termination, collection slippage and shared demand; notes company cash is not shareholder exit liquidity.',decisionUsefulness:'Conditionally defends funded initial concentration with permanent-impairment acceptance and quantified smaller/abstention alternatives, preserving no later additions.'},
22:{numericalInterpretation:'Correct shares, returns, adverse equity and opportunity count; extra80% two-outcome breakeven probability is mathematically correct and explicitly hypothetical, not a supplied likelihood.',counterevidence:'Positive EBITDA, funding and possible timing explanation are weighed against rumor, overdue receivables and concentrated renewal risk.'}
};
const scores=[];
for(let i=1;i<=22;i++){
 const id='W7-'+String(i).padStart(2,'0'),c=JSON.parse(readFileSync(new URL('frozen-cases/'+id+'.json',base))).payload,run=JSON.parse(readFileSync(new URL('source-runs-v2/'+id+'.json',base))).payload;
 const prior=JSON.parse(readFileSync(new URL('excerpt-reviews/'+id+'.json',import.meta.url))),rubric=structuredClone(prior.rubric);
 for(const [dimension,reason] of Object.entries(replacements[i]||{}))rubric[dimension].reason=reason;
 const temporal=[11,12].includes(i);
 const review={actorId:'/root/w7_independent_review',at:new Date().toISOString(),caseHash:c.caseHash,runHash:hash(run),rubric,criticalFabrications:0,criticalUnitPeriodIdentityErrors:temporal?1:0,disagreements:temporal?[{type:'CRITICAL_CASE_TEMPORAL_IDENTITY_ERROR',claimedCutoffAt:'2026-10-25T22:55:55.225Z',actualCutoffAt:c.cutoffAt,sourceAvailableAt:c.evidence.find(e=>e.id==='cib-dividends').availableAt,actualSecondsBeforeCutoff:19.906,impact:'Wrong case cutoff reverses evidence admissibility despite original-source access. Count once as critical temporal/period identity error, not also as fabrication.'}]:[],missingEvidence:['No current investment/market validation inferred; source inspection covers relevant selected pages rather than full issuer due diligence.']};
 writeFileSync(new URL(id+'.json',out),JSON.stringify(review,null,2)+'\n',{flag:'wx'});scores.push(scoreModelCase(c,run,review));
}
writeFileSync(new URL('source-score-check.json',import.meta.url),JSON.stringify({reviewedAt:new Date().toISOString(),actorId:'/root/w7_independent_review',cases:scores.length,correct:scores.reduce((n,s)=>n+s.correct,0),denominator:scores.reduce((n,s)=>n+s.denominator,0),criticalErrors:scores.reduce((n,s)=>n+s.criticalUnitPeriodIdentityErrors+s.criticalFabrications,0),originalSourceAccess:'Registered source access; source-inspection manifest and raw hashes inspected. Additional source-based reasoning independently checked.',scores},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({cases:22,correct:scores.reduce((n,s)=>n+s.correct,0),denominator:scores.reduce((n,s)=>n+s.denominator,0),criticalErrors:2}));
