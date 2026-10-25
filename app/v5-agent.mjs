import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {plan,planHash,engineVersion,hash} from './v5/contract.mjs';
import {evaluateUniverse} from './v5/signals.mjs';
import {buildResearchPacket,validateResearchDisposition} from './v5/research.mjs';
const read=path=>JSON.parse(readFileSync(path,'utf8').replace(/^\uFEFF/,''));
export function v5Command(args=process.argv.slice(2)){
 const [command='status',...a]=args;let result,path;
 if(command==='status')result={version:engineVersion,policyHash:planHash,capitalEGP:plan.capitalRisk.capitalEGP,variants:plan.variants.map(v=>v.id),capability:'Daily trend-confirmation and typed research review',executionEngine:'ENGINEERING_ONLY_NOT_ACTIVATED',activated:false,realOrders:false,schedules:'Unchanged; no scheduler calls in this command'};
 else if(command==='evaluate'){result=evaluateUniverse(read(a[0]));path=a[1];}
 else if(command==='packet'){result=buildResearchPacket(read(a[0]),a[1],a[2],read(a[3]));path=a[4];}
 else if(command==='review'){result=validateResearchDisposition(read(a[0]),read(a[1]));path=a[2];}
 else throw Error('Use status | evaluate INPUT OUTPUT | packet EVALUATION ISIN VARIANT EVIDENCE OUTPUT | review PACKET REVIEW OUTPUT');
 if(command!=='status'){if(!path)throw Error('Explicit new immutable output path required');writeFileSync(path,JSON.stringify(result,null,2)+'\n',{flag:'wx'});}
 const summary=path?{path:resolve(path),sha256:hash(result),version:result.version,rows:result.rows?.length,mechanicallyEligible:result.rows?.filter(r=>r.mechanicallyEligible).length,status:result.status||'ARTIFACT_WRITTEN',noOpportunity:result.noOpportunity,entryAuthorization:false}:result;console.log(JSON.stringify(summary));return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))try{v5Command();}catch(e){console.error(e.message);process.exitCode=1;}
