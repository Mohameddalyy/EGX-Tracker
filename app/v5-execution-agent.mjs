import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {required,hash} from './v5/contract.mjs';
import {openExecutionStore} from './v5/execution-store.mjs';
import {prepareEntry,riskDossier,executionReleaseHash} from './v5/risk.mjs';

const read=path=>JSON.parse(readFileSync(path,'utf8').replace(/^\uFEFF/,''));
const save=(path,value)=>{required(path,'Explicit immutable output path required');writeFileSync(path,JSON.stringify(value,null,2)+'\n',{flag:'wx'});return {path:resolve(path),sha256:hash(value)};};
export function executionCommand(args=process.argv.slice(2)) {
  const [command,...a]=args;let store,result;
  try {
    if(command==='init'){store=openExecutionStore(a[0],read(a[1]));result={scope:store.read().scope,ledgerId:store.read().id,paused:store.read().paused,realOrders:false};}
    else if(command==='status'||command==='replay'){store=openExecutionStore(a[0]);result=command==='replay'?store.replay():{...store.read(),realOrders:false,activated:false};if(a[1])result=save(a[1],result);}
    else if(command==='prepare'){store=openExecutionStore(a[0]);const context=prepareEntry(read(a[1]),store.read(),new Date().toISOString());result=save(a[3],{context,dossier:riskDossier(context,read(a[2]))});}
    else if(command==='event'){
      store=openExecutionStore(a[0]);const event=read(a[1]),now=new Date();
      required(Math.abs(+now-Date.parse(event.at))<=60000,'Manual event must use actual wall-clock time; use labeled engineering replay for historical fixtures');
      result=store.append(event,{clock:now});
    }
    else if(command==='simulate'){
      const input=read(a[1]);required(input.label==='SYNTHETIC_ENGINEERING_NOT_MARKET_PERFORMANCE','Explicit synthetic engineering label required');
      store=openExecutionStore(a[0],input.config);for(const event of input.events)store.append(event,{clock:new Date(event.at)});
      result=save(a[2],{label:input.label,releaseHash:executionReleaseHash(),replay:store.replay(),state:store.read(),realOrders:false,activated:false});
    }
    else throw Error('Use init DB CONFIG | status DB [OUTPUT] | prepare DB BUNDLE PROPOSAL OUTPUT | event DB EVENT | replay DB | simulate DB SYNTHETIC_INPUT OUTPUT');
    console.log(JSON.stringify(result));return result;
  }finally{store?.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))try{executionCommand();}catch(e){console.error(e.message);process.exitCode=1;}
