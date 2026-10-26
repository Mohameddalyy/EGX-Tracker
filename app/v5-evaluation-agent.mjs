// Offline evaluation only. No collectors, scheduler calls, ledger mutations or activation.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {required,hash} from './v5/contract.mjs';
import {readEvaluationLedger,ledgerMetrics,dailyEquity} from './v5/evaluation-ledger.mjs';
import {immutableWrite,readArtifact,registerTrial,evaluationReleaseHash} from './v5/evaluation-contract.mjs';
import {opportunityCohort,forecastOutcomes,benchmarkComparison,operationalCoverage} from './v5/evaluation-cohorts.mjs';
import {comparisonFamily} from './v5/evaluation-statistics.mjs';
import {freezeCase,blindPacket,scoreModelCase,modelSuite} from './v5/evaluation-models.mjs';
import {comparisonMatrix} from './v5/evaluation-matrix.mjs';
import {fixedExitAttribution} from './v5/fixed-exit-attribution.mjs';
import {boundStatisticalReport} from './v5/evaluation-provenance.mjs';

const json=path=>JSON.parse(readFileSync(path,'utf8').replace(/^\uFEFF/,''));
export function execute(command,inputPath) {
  if(command==='ledger') {
    const audit=readEvaluationLedger(inputPath);
    return audit.transitionReplay==='VERIFIED'?ledgerMetrics(audit):{status:'BLOCKED_RELEASE_MISMATCH',chainVerified:audit.chainVerified,stateHash:audit.stateHash,releaseHash:audit.state.releaseHash,reason:'Run the original pinned execution release to reproduce historical transitions. No current-code reinterpretation of old results.'};
  }
  const input=json(inputPath);
  if(command==='daily')return dailyEquity(readEvaluationLedger(input.ledgerPath),input.sessions);
  if(command==='fixed-exit')return fixedExitAttribution(input.ledgerPath,input.options||{});
  if(command==='trial')return registerTrial(input);
  if(command==='matrix')return comparisonMatrix(readArtifact(input.trialPath,'trial').payload,input.reportPaths.map(p=>readArtifact(p,'ledger')),(input.attributionPaths||[]).map(p=>readArtifact(p,'fixed-exit')));
  if(command==='cohort')return opportunityCohort(input.signalInput,input.dispositions);
  if(command==='forecast')return forecastOutcomes(input);
  if(command==='benchmarks')return benchmarkComparison(input);
  if(command==='operations')return operationalCoverage(input.expected,input.observed);
  if(command==='statistics')return boundStatisticalReport(input);
  if(command==='diagnostic-statistics')return {...comparisonFamily({...input,scope:'SYNTHETIC_ENGINEERING'}),scope:'UNVERIFIED_DIAGNOSTIC_INPUT_ONLY'};
  if(command==='case')return freezeCase(input);
  if(command==='blind')return blindPacket(readArtifact(inputPath,'case').payload);
  if(command==='blind-context')return blindPacket(readArtifact(inputPath,'case').payload,'CASE_CONTEXT_1');
  if(command==='score')return scoreModelCase(readArtifact(input.casePath,'case').payload,input.run,input.review);
  if(command==='suite') {
    const cases=input.casePaths.map(p=>readArtifact(p,'case').payload),scores=input.attempts.map(a=>scoreModelCase(cases.find(c=>c.id===a.caseId),a.run,a.review));
    return modelSuite(cases,scores);
  }
  throw Error('Commands: ledger, daily, fixed-exit, trial, matrix, cohort, forecast, benchmarks, operations, statistics, diagnostic-statistics, case, blind, blind-context, score, suite');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const [command,input,output]=process.argv.slice(2);required(command&&input&&output,'Usage: node app/v5-evaluation-agent.mjs COMMAND INPUT NEW_OUTPUT.json');
    required(resolve(input)!==resolve(output),'Input and output must differ');
    const payload=execute(command,input),artifact=immutableWrite(output,command,payload);
    console.log(JSON.stringify({command,output:resolve(output),contentHash:artifact.contentHash,evaluationReleaseHash:evaluationReleaseHash(),status:payload.status??payload.profitabilityStatus??'SAVED',activation:false,sourceHash:hash(readFileSync(input))}));
  } catch(e){console.error(e.message);process.exitCode=1;}
}
