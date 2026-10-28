import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {openWorkflow,beginWorkflow} from './workflow-store.mjs';
import {executeWorkflow} from './workflow-runner.mjs';
import {workflowAdapter} from './workflow-adapters.mjs';
import {readEvaluationLedger} from './v5/evaluation-ledger.mjs';
import {hash} from './v5/contract.mjs';
export async function faultCases(rootPath){
 const root=resolve(rootPath),out=join(root,'w9-faults');mkdirSync(out);const collector=join(root,'app/collect-paper-minutes.mjs'),original=readFileSync(collector),rows=[],before=readEvaluationLedger(join(root,'v5.sqlite')).stateHash;
 mkdirSync(join(root,'agent'),{recursive:true});writeFileSync(join(root,'agent/synthetic-source-proof.json'),JSON.stringify({scope:'LOCAL_STUB_ONLY_NO_NETWORK',authorization:'Engineering fault injection; not external-source rights'}),{flag:'wx'});
 const at=new Date();writeFileSync(join(root,'agent/source-access.json'),JSON.stringify({tradingview:{status:'approved',evidencePath:'agent/synthetic-source-proof.json',purpose:'personal-automated-analysis',effectiveAt:new Date(+at-60000).toISOString(),expiresAt:new Date(+at+3600000).toISOString()}}));
 const scripts={
  source_outage:"console.error('SYNTHETIC provider connection refused');process.exit(1)",
  corrupt_response:"import {writeFileSync} from 'node:fs';writeFileSync(process.env.EGX_WORKFLOW_RESULT,'{broken');",
  omitted_response:"import {writeFileSync} from 'node:fs';writeFileSync(process.env.EGX_WORKFLOW_RESULT,JSON.stringify({status:'succeeded',tickers:[],observationOnly:true,accepted:null,tradeAuthorization:false,restored:true}));",
  hanging_source:"setInterval(()=>{},1000)",
 };
 try{
  for(const [name,script] of Object.entries(scripts)){
   writeFileSync(collector,script);writeFileSync(join(out,name+'-stub.mjs'),script,{flag:'wx'});
   const db=openWorkflow(join(out,name+'.sqlite'));try{const now=new Date(),run=beginWorkflow(db,{workload:'W9-'+name,plannedAt:now.toISOString(),deadlineMs:15000},now);const plan={obligations:[{ticker:'TEST0',reason:'Held exposure'}],sourceGaps:[],minuteTargets:['TEST0'],jobs:[{kind:'minutes',target:'TEST0',tickers:['TEST0'],revision:name,source:'tradingview',resource:'tradingview',priority:0,critical:true,maxMs:name==='hanging_source'?100:5000},{kind:'positions',target:'all',revision:name,resource:'local',priority:1,critical:true,maxMs:5000}]};
    const report=await executeWorkflow(db,run,plan,{execute:workflowAdapter(db,root),checkpoint:r=>writeFileSync(join(out,name+'-checkpoint.json'),JSON.stringify(r,null,2))});assert.equal(report.status,'partial');assert.notEqual(report.jobs.find(j=>j.kind==='minutes').status,'succeeded');
    if(name!=='hanging_source')assert(report.jobs.find(j=>j.kind==='positions').result.holdings.some(p=>p.account==='v5-paper'));
    else assert(report.jobs.find(j=>j.kind==='positions').status==='pending'||report.jobs.find(j=>j.kind==='positions').result.holdings.some(p=>p.account==='v5-paper'));
    assert.equal(readEvaluationLedger(join(root,'v5.sqlite')).stateHash,before);rows.push({name,status:'PASS',sourceJob:report.jobs.find(j=>j.kind==='minutes'),knownHeldExposureRetained:true,monitoringDeferred:name==='hanging_source',runStatus:report.status,checkpoint:join(out,name+'-checkpoint.json')});
   }finally{db.close();}
  }
 }finally{writeFileSync(collector,original);}
 const result={scope:'LOCAL_PROVIDER_STUB_FAULTS_NO_NETWORK_NO_MARKET_OBSERVATIONS',rows,ledgerBefore:before,ledgerAfter:readEvaluationLedger(join(root,'v5.sqlite')).stateHash,sourceRestored:hash(readFileSync(collector))===hash(original),activation:false};writeFileSync(join(out,'fault-results.json'),JSON.stringify(result,null,2),{flag:'wx'});return result;
}
