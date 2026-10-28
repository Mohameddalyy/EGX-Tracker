import {readFileSync,writeFileSync} from 'node:fs';
import {planBasket} from './v5/basket-plan.mjs';
const [inputPath,outputPath]=process.argv.slice(2);if(!inputPath||!outputPath)throw Error('Supply basket request JSON and NEW output JSON');
const input=JSON.parse(readFileSync(inputPath,'utf8'));const result=planBasket(input);writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:result.status,selection:result.selection.map(x=>x.isin),outputPath,entryAuthorization:false}));
