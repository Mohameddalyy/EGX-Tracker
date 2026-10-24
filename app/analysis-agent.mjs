import {DatabaseSync} from 'node:sqlite';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {dirname,join} from 'node:path';import {fileURLToPath} from 'node:url';
import {openAnalysis,getRecord,records} from './analysis-store.mjs';import {analysisOverview,analysisDossier,refreshAnalysis} from './analysis.mjs';import {saveAnalysisInput,importAnalysisBundle} from './analysis-service.mjs';import {publicPacket} from './analysis-learning.mjs';
const root=dirname(dirname(fileURLToPath(import.meta.url))),source=new DatabaseSync(join(root,'data','egx.sqlite'),{readOnly:true}),db=openAnalysis(join(root,'data','analysis.sqlite'));
try{
 const [command='status',arg,file]=process.argv.slice(2);let result;
 if(command==='status'){const s=analysisOverview(source,db,root);result={mode:s.mode,coverage:s.coverage,market:s.market.coverage,marketState:s.market.state,recordCounts:s.recordCounts,models:s.models,trials:s.trials.length,forecasts:s.forecasts.length,evaluations:s.evaluations.length};}
 else if(command==='company')result=analysisDossier(source,db,root,arg);
 else if(command==='run')result=refreshAnalysis(source,db,root);
 else if(command==='import')result=importAnalysisBundle(source,db,root,JSON.parse(readFileSync(arg,'utf8')));
 else if(command==='save')result=saveAnalysisInput(source,db,root,arg,JSON.parse(readFileSync(file,'utf8')));
 else if(command==='packet'){const p=getRecord(db,arg);if(p?.kind!=='evaluation-packet')throw Error('Known evaluation packet required');result=publicPacket(p);}
 else if(command==='export'){const dir=join(root,'data','analysis');mkdirSync(dir,{recursive:true});const path=join(dir,'analysis-history-'+Date.now()+'.json');writeFileSync(path,JSON.stringify({exportedAt:new Date().toISOString(),records:db.prepare('SELECT * FROM analysis_records ORDER BY recorded_at,rowid').all()},null,2),{flag:'wx'});result={path};}
 else throw Error('Use status | company TICKER | run | import BUNDLE | save KIND FILE | packet ID | export');
 console.log(JSON.stringify(result,null,2));
}finally{source.close();db.close();}
