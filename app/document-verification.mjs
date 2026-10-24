import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';import {join} from 'node:path';import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
export function saveDocumentReview(root,review,now=new Date()){
 const lib=join(root,'data','research','evidence','library'),index=JSON.parse(readFileSync(join(lib,'index.json'),'utf8')),source=[index.items[review.url],...Object.values(index.versions||{})].find(x=>x?.url===review.url&&x?.sha256===review.sha256)||index.items[review.url];
 if(!source?.bodyPath||source.sha256!==review.sha256||hash(readFileSync(source.bodyPath))!==review.sha256)throw Error('Review requires matching retained source hash');
 const policy=JSON.parse(readFileSync(join(root,'research','source-policy.json'),'utf8')),host=new URL(review.url).hostname;
 if(policy.excludedDomains.some(x=>host===x||host.endsWith('.'+x)))throw Error('Excluded review source');
 if(!/^[A-Z][A-Z0-9-]{1,23}$/.test(review.ticker)||!review.reviewer||!review.identityEvidence||!review.period||!Array.isArray(review.limitations)||!review.limitations.length)throw Error('Explicit identity, period, reviewer and limitations required');
 const extracted=JSON.parse(readFileSync(join(lib,'extracted',review.sha256+'.json'),'utf8'));
 if(!extracted.pages||!Array.isArray(review.facts)||!review.facts.length)throw Error('Page-addressable document and reviewed facts required');
 for(const f of review.facts)if(!Number.isFinite(f.value)||!f.metric||!['EGP','USD','percent','shares'].includes(f.unit)||!Number.isFinite(f.scale)||f.scale<=0||!Number.isInteger(f.page)||!extracted.pages.some(p=>p.page===f.page)||!f.basis||!f.method)throw Error('Fact requires page, basis, unit/scale and extraction method');
 if(review.documentDate&&(!Number.isFinite(Date.parse(review.documentDate))||Date.parse(review.documentDate)>+now))throw Error('Invalid document date');
 const payload={...review,scope:'Reviewed document content only; publication availability, subsequent events and investment approval are separate',reviewedAt:now.toISOString(),accessedAt:source.capturedAt,tradeAuthorization:false};
 const dir=join(lib,'reviews');mkdirSync(dir,{recursive:true});const path=join(dir,hash(JSON.stringify(payload))+'.json');writeFileSync(path,JSON.stringify(payload,null,2),{flag:'wx'});return {path,facts:review.facts.length};
}
export function documentReviews(root,tickers=null){const dir=join(root,'data','research','evidence','library','reviews');if(!existsSync(dir))return [];return readdirSync(dir).filter(n=>/^[a-f0-9]{64}\.json$/.test(n)).map(n=>({...JSON.parse(readFileSync(join(dir,n),'utf8')),path:join(dir,n)})).filter(r=>!tickers||tickers.includes(r.ticker));}
