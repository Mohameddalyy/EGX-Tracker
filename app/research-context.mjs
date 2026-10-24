import {openAnalysis} from './analysis-store.mjs';
import {openDb} from './core.mjs';import {researchContext} from './research-context-data.mjs';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';import {dirname,join} from 'node:path';import {fileURLToPath} from 'node:url';import {randomUUID} from 'node:crypto';
const root=dirname(dirname(fileURLToPath(import.meta.url))),db=openDb(process.env.EGX_DATABASE||join(root,'data','egx.sqlite'));
const analysisDb=openAnalysis(join(root,'data','analysis.sqlite'));
try{
 const args=process.argv.slice(2);if(args.some(a=>a.startsWith('-')&&a!=='--all')||(args.includes('--all')&&args.length!==1))throw Error('Usage: research-context.mjs [TICKER ... | --all]');
 const tickers=args.includes('--all')?db.prepare('SELECT ticker FROM stocks ORDER BY ticker').all().map(s=>s.ticker):args.length?args.flatMap(a=>a.toUpperCase().split(',')):null;
 const id='context-'+randomUUID(),profile=JSON.parse(readFileSync(join(root,'research','profile.json'),'utf8'));
 const payload={id,createdAt:new Date().toISOString(),...researchContext(db,profile,tickers,{analysisDb,root})};
 const dir=join(root,'data','research');mkdirSync(dir,{recursive:true});const path=join(dir,id+'.json');writeFileSync(path,JSON.stringify(payload,null,2),{flag:'wx'});
 console.log(JSON.stringify({contextId:id,path,scope:payload.scope,stocks:payload.stocks.length,positions:payload.positions.length,marketStocks:payload.market.total,importStatus:payload.market.job?.status,unconfiguredSizing:profile.capitalEGP===null}));
}finally{analysisDb.close();db.close();}
