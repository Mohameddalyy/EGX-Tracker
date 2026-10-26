import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {hash} from '../../app/v5/contract.mjs';
import {executionReleaseHash} from '../../app/v5/risk.mjs';
import {fixedExitAttribution} from '../../app/v5/fixed-exit-attribution.mjs';
import {readEvaluationLedger,ledgerMetrics} from '../../app/v5/evaluation-ledger.mjs';
import {registerTrial,armIds,immutableWrite,evaluationReleaseHash} from '../../app/v5/evaluation-contract.mjs';
import {comparisonMatrix} from '../../app/v5/evaluation-matrix.mjs';
const root='verification/w7-completion-20261026',folder=root+'/'+(process.argv[2]||'engineering');mkdirSync(folder,{recursive:true});
const sources=['app/v5/fixed-exit-attribution.mjs','app/v5/evaluation-provenance.mjs','app/v5/evaluation-contract.mjs','app/v5/evaluation-models.mjs','app/v5/evaluation-ledger.mjs','app/v5/evaluation-matrix.mjs','app/v5-evaluation-agent.mjs','app/v5-w7.test.mjs'].map(path=>({path,hash:hash(readFileSync(path))}));
const names=['complete-lifecycle','full-liquidity-deadlock','stress-zone-no-fill'],reports=[],attributions=[],summary=[];
for(const name of names){const path=`verification/remediation-batch4-20261025/release-ledgers/${name}/engineering.sqlite`,before=hash(readFileSync(path)),audit=readEvaluationLedger(path),r=ledgerMetrics(audit),a=fixedExitAttribution(path);
  const report=immutableWrite(folder+'/'+name+'-ledger.json','ledger',r),attribution=immutableWrite(folder+'/'+name+'-fixed-exit.json','fixed-exit',a);reports.push(report);attributions.push(attribution);
  summary.push({name,path,ledgerBytesUnchanged:before===hash(readFileSync(path)),stateHash:audit.stateHash,transitionReplay:audit.transitionReplay,blockedEvents:a.blockedEvents,suppressedRiskExits:a.suppressedRiskExits,equityDeltaCents:a.actualMinusFixedExitEquityCents,reportHash:report.contentHash,attributionHash:attribution.contentHash});}
const at=new Date().toISOString(),trial=registerTrial({id:'w7-completion-engineering',scope:'SYNTHETIC_ENGINEERING',registeredAt:at,codeRevision:'d0a1256 plus exact source manifest in this evidence pack',codeDigest:hash(sources),executionReleaseHash:executionReleaseHash(),admissionManifestHash:hash(summary),dataManifestHash:hash(summary),arms:armIds.map(id=>({id,status:'UNAVAILABLE',reason:'No authorized prospective arm observations; retained ledger fixtures are accounting evidence only'})),priorTrials:[{artifactHash:hash(readFileSync('verification/remediation-batch5-20261026/RESULTS.md')),disposition:'Earlier partial W7 implementation retained, not economic evidence'}],amendmentPath:root+'/approved-comparison-amendment.json'},at);
immutableWrite(folder+'/trial.json','trial',trial);immutableWrite(folder+'/matrix.json','matrix',comparisonMatrix(trial,reports,attributions));
const result={createdAt:at,executionReleaseHash:executionReleaseHash(),evaluationReleaseHash:evaluationReleaseHash(),sources,summary,claim:'Independent accounting replay of retained engineering fixtures, not prospective observations. Additional discretionary exit and changed funded entry tests are in v5-w7.test.mjs.'};immutableWrite(folder+'/summary.json','engineering-summary',result);console.log(JSON.stringify(summary));
