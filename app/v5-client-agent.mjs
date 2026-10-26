import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {registerClientLedger,publishCandidates,clientOverview,clientHistory,reviewComprehension,comprehensionStatus,saveCheckpoint} from './v5/client-service.mjs';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const [command,input]=process.argv.slice(2),read=()=>JSON.parse(readFileSync(resolve(input),'utf8').replace(/^\uFEFF/,''));
try{let result;if(command==='register-ledger')result=registerClientLedger(root,read());else if(command==='publish-candidates')result=publishCandidates(root,read());else if(command==='status')result=clientOverview(root);else if(command==='history')result=clientHistory(root);else if(command==='acceptance-status')result=comprehensionStatus(root);else if(command==='review-answer')result=reviewComprehension(root,read());else if(command==='checkpoint')result=saveCheckpoint(root,read());else throw Error('Use register-ledger FILE | publish-candidates FILE | status | history | acceptance-status | review-answer FILE | checkpoint FILE');console.log(JSON.stringify(result,null,2));}catch(e){console.error(e.message);process.exitCode=1;}
