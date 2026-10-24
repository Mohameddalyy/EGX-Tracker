import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
function identityRegistry(identities){
 const registry=new Map();
 for(const stock of identities){let m;try{m=typeof stock.metadata==='string'?JSON.parse(stock.metadata):stock.metadata;}catch{continue;}
  for(const isin of new Set([m?.symbolInfo?.isin,m?.symbolExt?.isin].filter(x=>typeof x==='string'&&/^EG[A-Z0-9]{10}$/.test(x)))){const names=registry.get(isin)||new Set();names.add(stock.ticker);registry.set(isin,names);}}
 return registry;
}
export function routeAnnouncement(record,identities=[]){return routeWithRegistry(record,identityRegistry(identities));}
export function routeAnnouncements(records,identities=[]){const registry=identityRegistry(identities);return records.map(record=>routeWithRegistry(record,registry));}
function routeWithRegistry(record,registry){
 const exact=[...new Set(record.tickers||[])],matches=(record.isins||[]).flatMap(i=>[...(registry.get(i)||[])]),resolved=[...new Set(matches)];
 const ambiguous=(record.isins||[]).some(i=>registry.get(i)?.size>1),conflict=exact.length&&resolved.some(t=>!exact.includes(t));
 const status=ambiguous||conflict?'IDENTITY_REVIEW_REQUIRED':exact.length?'EXACT_TICKER':resolved.length?'RETAINED_ISIN_MATCH_REQUIRES_REVIEW':'UNMAPPED';
 return {...record,identityRouting:{status,tickers:ambiguous||conflict?[]:[...new Set([...exact,...resolved])],possibleTickers:[...new Set([...exact,...resolved])],basis:'Retained ticker/metadata association only; not independent listing or action clearance'},tradeAuthorization:false};
}
export function exchangeEvidence(root,tickers=null,identities=[]){
 const path=join(root,'data','research','evidence','exchange','index.json');
 if(!existsSync(path))return {status:'NOT_COLLECTED',records:[],windows:[]};
 const index=JSON.parse(readFileSync(path,'utf8')),registry=identityRegistry(identities),all=Object.values(index.records).map(r=>routeWithRegistry(r,registry));
 const windows=Object.values(index.windows).map(w=>({from:w.from,to:w.to,complete:w.complete,checkedAt:w.checkedAt||Object.values(w.endpoints).flatMap(s=>Object.values(s.pages)).map(p=>p.at).sort().at(-1),endpoints:Object.fromEntries(Object.entries(w.endpoints).map(([k,s])=>[k,{complete:s.complete,pages:Object.keys(s.pages).length,totalPages:s.totalPages,totalCount:s.totalCount,error:s.error}]))}));
 const routingCounts={};for(const r of all)routingCounts[r.identityRouting.status]=(routingCounts[r.identityRouting.status]||0)+1;
 return {status:'RETAINED_REQUIRES_REVIEW',indexPath:path,uniqueAnnouncements:new Set(all.map(x=>x.code)).size,recordVersions:all.length,windows,routingCounts,records:tickers?all.filter(r=>r.identityRouting.tickers.some(t=>tickers.includes(t))):[],identityReview:tickers?all.filter(r=>r.identityRouting.status==='IDENTITY_REVIEW_REQUIRED'&&r.identityRouting.possibleTickers.some(t=>tickers.includes(t))):[],note:'Ticker and unambiguous retained ISIN matches are routed as unreviewed evidence. Conflicts are quarantined. Unmapped records remain in the index; endpoint completeness and identity routing are not corporate-action clearance.',tradeAuthorization:false};
}
