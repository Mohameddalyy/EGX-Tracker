import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
export function exchangeEvidence(root,tickers=null){
 const path=join(root,'data','research','evidence','exchange','index.json');
 if(!existsSync(path))return {status:'NOT_COLLECTED',records:[],windows:[]};
 const index=JSON.parse(readFileSync(path,'utf8')),all=Object.values(index.records);
 const windows=Object.values(index.windows).map(w=>({from:w.from,to:w.to,complete:w.complete,checkedAt:w.checkedAt||Object.values(w.endpoints).flatMap(s=>Object.values(s.pages)).map(p=>p.at).sort().at(-1),endpoints:Object.fromEntries(Object.entries(w.endpoints).map(([k,s])=>[k,{complete:s.complete,pages:Object.keys(s.pages).length,totalPages:s.totalPages,totalCount:s.totalCount,error:s.error}]))}));
 return {status:'RETAINED_REQUIRES_REVIEW',indexPath:path,uniqueAnnouncements:new Set(all.map(x=>x.code)).size,recordVersions:all.length,windows,records:tickers?all.filter(r=>r.tickers.some(t=>tickers.includes(t))):[],note:'Exact ticker matches only. Unmapped announcements remain in the full index for identity review. Endpoint completeness is not corporate-action clearance; timestamps and retained content require review.',tradeAuthorization:false};
}
