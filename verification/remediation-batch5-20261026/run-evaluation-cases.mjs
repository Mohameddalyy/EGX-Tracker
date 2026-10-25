// Historical synthetic ledger inputs remain unchanged. All new outputs are exclusive-create.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {hash} from '../../app/v5/contract.mjs';
import {executionReleaseHash} from '../../app/v5/risk.mjs';
import {armIds,immutableWrite,registerTrial,evaluationReleaseHash} from '../../app/v5/evaluation-contract.mjs';
import {readEvaluationLedger,ledgerMetrics} from '../../app/v5/evaluation-ledger.mjs';
import {comparisonMatrix} from '../../app/v5/evaluation-matrix.mjs';
import {opportunityCohort,benchmarkComparison} from '../../app/v5/evaluation-cohorts.mjs';
import {comparisonFamily} from '../../app/v5/evaluation-statistics.mjs';
import {modelSuite} from '../../app/v5/evaluation-models.mjs';
import {signalFixture} from '../../app/v5/fixtures.mjs';

const name=process.argv[2]||'evidence';if(!/^[a-z0-9-]+$/.test(name))throw Error('New simple output-directory name required');
const root=resolve('verification/remediation-batch5-20261026',name);mkdirSync(root);
const start=performance.now(),now=new Date().toISOString(),reports=[],checks=[];
const names=['complete-lifecycle','full-liquidity-deadlock','stress-zone-no-fill'];
const files=names.map(n=>resolve('verification/remediation-batch4-20261025/release-ledgers',n,'engineering.sqlite'));
const dataManifest=files.map(path=>({path,sha256:hash(readFileSync(path))}));
const sourceFiles=['app/v5-evaluation-agent.mjs',...['contract','ledger','cohorts','statistics','models','matrix'].map(n=>'app/v5/evaluation-'+n+'.mjs')];
const sourceManifest=sourceFiles.map(path=>({path,sha256:hash(readFileSync(path,'utf8').replace(/\r\n/g,'\n'))}));
const input=signalFixture(),trialInput={id:'batch5-retained-engineering-ledgers',registeredAt:now,scope:'SYNTHETIC_ENGINEERING',codeRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()+' + evaluation source manifest',codeDigest:hash(sourceManifest),executionReleaseHash:executionReleaseHash(),admissionManifestHash:hash(input),dataManifestHash:hash(dataManifest),arms:armIds.map(id=>({id,status:'UNAVAILABLE',reason:'No prospective or actual-model experiment run; any supplied ledger is only a synthetic accounting example'})),priorTrials:[{artifactHash:hash(readFileSync('verification/remediation-batch4-20261025/release-ledgers-results.json')),disposition:'Prior synthetic engineering cases retained; outcomes already inspected; not OOS'}]};
const trial=registerTrial(trialInput,now);immutableWrite(join(root,'trial.json'),'trial',trial,now);
for(let i=0;i<files.length;i++){
  const audit=readEvaluationLedger(files[i]),metrics=ledgerMetrics(audit);
  checks.push({name:names[i],semanticReplay:audit.transitionReplay,sourceUnchanged:hash(readFileSync(files[i]))===dataManifest[i].sha256,netCents:metrics.netCents,feesCents:metrics.feesCents,closedTrades:metrics.counts.closedTrades,pendingExits:metrics.counts.pendingExits,unfilled:metrics.counts.unfilled,profitability:metrics.profitabilityStatus});
  reports.push(immutableWrite(join(root,names[i]+'.json'),'ledger',metrics));
}
immutableWrite(join(root,'matrix.json'),'matrix',comparisonMatrix(trial,reports));
const cohort=opportunityCohort(input);immutableWrite(join(root,'cohort.json'),'cohort',cohort);
const comparisons=comparisonFamily({scope:'SYNTHETIC_ENGINEERING',sessions:[],arms:[]});immutableWrite(join(root,'statistics.json'),'statistics',comparisons);
immutableWrite(join(root,'actual-model-suite.json'),'suite',modelSuite([],[]));
const benchmark=benchmarkComparison({baselineDay:'2026-10-22',sessions:[{day:'2026-10-22',verified:true},{day:'2026-10-25',verified:true}],portfolio:[],benchmarks:[],cutoffAt:'2026-10-25T16:00:00Z'});immutableWrite(join(root,'benchmarks-unavailable.json'),'benchmarks',benchmark);
const summary={observedAt:new Date().toISOString(),scope:'SYNTHETIC_ENGINEERING_NOT_PROSPECTIVE_RESULTS',executionReleaseHash:executionReleaseHash(),evaluationReleaseHash:evaluationReleaseHash(),sourceManifest,dataManifest,checks,allSourceLedgersUnchanged:checks.every(c=>c.sourceUnchanged),semanticReplays:checks.filter(c=>c.semanticReplay==='VERIFIED').length,matrixArms:18,syntheticArmExamples:3,unavailableArms:15,cohortRows:cohort.rows.length,unavailableStatisticalHypotheses:comparisons.family.filter(x=>x.status==='INCONCLUSIVE').length,actualModelsEvaluated:0,durationMs:performance.now()-start,schedulesResumed:false,activation:false};
writeFileSync(join(root,'summary.json'),JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output:root,replays:summary.semanticReplays,sourceLedgersUnchanged:summary.allSourceLedgersUnchanged,cohortRows:summary.cohortRows,statisticalHypothesesRetained:16,durationMs:summary.durationMs,actualModelsEvaluated:0}));
