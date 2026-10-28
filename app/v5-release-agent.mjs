// Offline W9 verification entry point. Never starts schedules, collectors or orders.
import {spawnSync} from 'node:child_process';
import {readdirSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {hash,planHash,decisionSchemaHash} from './v5/contract.mjs';
import {executionReleaseHash} from './v5/risk.mjs';
import {evaluationReleaseHash} from './v5/evaluation-contract.mjs';
import {generatedCases} from './v5-release-generated.mjs';
import {sessionCases} from './v5-release-sessions.mjs';
import {faultCases} from './v5-release-faults.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const save=(path,data)=>writeFileSync(path,JSON.stringify(data,null,2)+'\n',{flag:'wx'});
export async function releaseCommand(command,outPath){
 const out=resolve(outPath);mkdirSync(out,{recursive:true});const start=performance.now(),binding={at:new Date().toISOString(),node:process.version,executionReleaseHash:executionReleaseHash(),evaluationReleaseHash:evaluationReleaseHash(),planHash,decisionSchemaHash,scope:'OFFLINE_ENGINEERING_ONLY',activation:false};
 save(join(out,'invocation.json'),{...binding,command});let result;
 try{
  if(command==='tests'){
   const files=readdirSync(join(root,'app')).filter(n=>n.endsWith('.test.mjs')).sort().map(n=>'app/'+n),sources=files.map(path=>({path,sha256:hash(readFileSync(join(root,path),'utf8').replace(/\r\n/g,'\n'))}));
   const run=spawnSync(process.execPath,['--test','--test-reporter=tap',...files],{cwd:root,encoding:'utf8',windowsHide:true,timeout:300000,maxBuffer:30*1024*1024});const log=(run.stdout||'')+(run.stderr||'');writeFileSync(join(out,'suite.tap'),log,{flag:'wx'});
   const number=k=>Number(log.match(new RegExp('^# '+k+' (\\d+)$','m'))?.[1]??NaN),names=[...log.matchAll(/^(ok|not ok) \d+ - (.+)$/gm)].map(m=>({status:m[1]==='ok'?'PASS':'FAIL',name:m[2],skipped:/# SKIP/.test(m[2])}));
   result={status:run.status===0&&number('fail')===0&&number('skipped')===0&&number('cancelled')===0&&number('todo')===0&&number('tests')===names.length?'PASS':'BLOCKED',exitCode:run.status,error:run.error?.message??null,counts:Object.fromEntries(['tests','pass','fail','skipped','cancelled','todo'].map(k=>[k,number(k)])),files:sources,logHash:hash(log),tests:names,legacyNpmTest:'Not authoritative: package script omits newer suites; unchanged because package is frozen execution-release input.'};
  }else if(command==='generated'){result={status:'PASS',...generatedCases(1000,20261023)};}
  else if(command==='sessions'){const s=await sessionCases(join(out,'sessions')),f=await faultCases(join(s.directory,'session-2-outage-blocked-exit-dispatcher'));result={status:'PASS',sessionScenarios:s.scenarios,sessionResultPath:join(s.directory,'session-results.json'),faultResultPath:join(s.directory,'session-2-outage-blocked-exit-dispatcher/w9-faults/fault-results.json'),faults:f.rows.map(x=>({name:x.name,status:x.status}))};}
  else throw Error('Use tests|generated|sessions NEW_OUTPUT_DIRECTORY');
 }catch(e){result={status:'BLOCKED',error:e.stack};}
 result={...binding,...result,durationMs:performance.now()-start};save(join(out,'result.json'),result);console.log(JSON.stringify({status:result.status,counts:result.counts,count:result.count,path:join(out,'result.json'),durationMs:result.durationMs,activation:false}));return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const [command,out]=process.argv.slice(2);if(!out)throw Error('Explicit new isolated output directory required');const result=await releaseCommand(command,out);if(result.status!=='PASS')process.exitCode=1;}
