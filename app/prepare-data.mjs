import {writeFileSync,mkdirSync,existsSync} from 'node:fs';import {dirname,join} from 'node:path';import {fileURLToPath} from 'node:url';import {DatabaseSync} from 'node:sqlite';
import {openDb} from './core.mjs';import {initMarket} from './market.mjs';import {initFacts} from './market-facts.mjs';import {initPreparation,receipt} from './preparation-store.mjs';import {preparationManifest} from './preparation-status.mjs';
const root=dirname(dirname(fileURLToPath(import.meta.url))),db=openDb(process.env.EGX_DATABASE||join(root,'data','egx.sqlite'));
try{
 initMarket(db);initFacts(db);initPreparation(db);let savedAnalysis=[];const analysisPath=join(root,'data','analysis.sqlite');if(existsSync(analysisPath)){const a=new DatabaseSync(analysisPath,{readOnly:true});try{savedAnalysis=a.prepare("SELECT id,kind,ticker,recorded_at,digest FROM analysis_records WHERE kind IN ('document','statement','catalyst','thesis','valuation')").all();}finally{a.close();}}
 const manifest=preparationManifest(db,new Date(),{savedAnalysis}),dir=join(root,'data','market','preparation');mkdirSync(dir,{recursive:true});
 const path=join(dir,manifest.at.replace(/[:.]/g,'-')+'.json');writeFileSync(path,JSON.stringify(manifest),{flag:'wx'});
 const summary={at:manifest.at,universe:manifest.universe,fieldsPerInstrument:manifest.fieldsPerInstrument,...manifest.summary,complete:false,path,fieldCoverage:manifest.fieldCoverage};
 receipt(db,'baseline','latest',summary,new Date(),'partial');writeFileSync(join(dir,'latest.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify({...summary,fieldCoverage:undefined}));
}finally{db.close();}
