import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {feedRequest,validateFeed,disclosureRecord,exchangeWindow} from './exchange-feed.mjs';
import {exchangeEvidence} from './exchange-evidence.mjs';
import {saveDocumentReview,documentReviews} from './document-verification.mjs';
import {retainDocumentVersion} from './document-library.mjs';

test('exchange windows resume, reuse and then overlap rather than re-fetching the full month',()=>{
 const index={windows:{a:{from:'2026-10-01',to:'2026-10-22',complete:false}}};
 assert.deepEqual(exchangeWindow(index,'2026-10-24'),{from:'2026-10-01',to:'2026-10-22'});
 index.windows.a.complete=true;
 assert.deepEqual(exchangeWindow(index,'2026-10-23'),{from:'2026-10-01',to:'2026-10-22'});
 assert.deepEqual(exchangeWindow(index,'2026-10-25'),{from:'2026-10-21',to:'2026-10-24'});
 assert.deepEqual(exchangeWindow(index,'2026-10-25',{from:'2026-09-01',to:'2026-09-30'}),{from:'2026-09-01',to:'2026-09-30'});
});
test('exchange response errors and wrong pagination cannot certify a complete capture',()=>{
 assert.throws(()=>feedRequest('guessed-endpoint','2026-10-01','2026-10-22'),/Invalid/);
 assert.throws(()=>feedRequest('news-search','2026-10-22','2026-10-01'),/Invalid/);
 assert.equal(feedRequest('news-search','2026-10-01','2026-10-22',2).pageNumber,2);
 const response={success:true,data:[{code:1,dateStamp:'2026-10-22T14:00:00'}],totalPages:1,totalCount:1,pageNumber:1};
 assert.equal(validateFeed(response,1),response);
 assert.throws(()=>validateFeed(response,2),/pagination/);
 assert.throws(()=>validateFeed({...response,success:false},1),/pagination/);
 assert.throws(()=>validateFeed({...response,totalPages:null},1),/pagination/);
});
test('exchange records preserve original text, identity links, versions and unreviewed status',()=>{
 const raw={code:123,dateStamp:'2026-10-22T14:00:00',content:'PRDC.CA EGS21FW1C015 <a href="/downloads/Bulletins/345933_1.pdf">Attachment</a>'};
 const r=disclosureRecord(raw,{url:'https://beta.egx.com.eg/api/bff/egx/news-search'});
 assert.deepEqual(r.tickers,['PRDC']);assert.deepEqual(r.isins,['EGS21FW1C015']);
 assert.deepEqual(r.attachments,['https://www.egx.com.eg/downloads/Bulletins/345933_1.pdf']);assert.equal(r.tradeAuthorization,false);assert.deepEqual(r.raw,raw);
 assert.notEqual(disclosureRecord({...raw,content:raw.content+' corrected'},{}).contentDigest,r.contentDigest);
});
test('selected exchange context exposes exact ticker records and keeps unmatched records in the archive',()=>{
 const root=mkdtempSync(join(tmpdir(),'egx-feed-'));
 try{const dir=join(root,'data/research/evidence/exchange');mkdirSync(dir,{recursive:true});writeFileSync(join(dir,'index.json'),JSON.stringify({windows:{},records:{a:{code:1,tickers:['COMI']},b:{code:2,tickers:['COMIE']},c:{code:3,tickers:[]}}}));
 const selected=exchangeEvidence(root,['COMI']);assert.equal(selected.records.length,1);assert.equal(selected.uniqueAnnouncements,3);assert.equal(selected.tradeAuthorization,false);
 assert.equal(exchangeEvidence(root).records.length,0);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('reviewed facts require unchanged source bytes, page references, units and explicit limitations',()=>{
 const root=mkdtempSync(join(tmpdir(),'egx-doc-review-')),lib=join(root,'data/research/evidence/library'),url='https://issuer.example/report.pdf',body=Buffer.from('retained fixture'),sha=createHash('sha256').update(body).digest('hex');
 try{mkdirSync(join(lib,'extracted'),{recursive:true});mkdirSync(join(root,'research'));writeFileSync(join(root,'research/source-policy.json'),JSON.stringify({excludedDomains:['excluded.example']}));
 const bodyPath=join(lib,sha+'.bin');writeFileSync(bodyPath,body);writeFileSync(join(lib,'index.json'),JSON.stringify({items:{[url]:{bodyPath,sha256:sha,capturedAt:'2026-10-23T10:00Z'}}}));writeFileSync(join(lib,'extracted',sha+'.json'),JSON.stringify({pages:[{page:4}]}));
 const review={url,sha256:sha,ticker:'TEST',reviewer:'reviewer',identityEvidence:'Issuer name in document',period:'H1 2026',limitations:['Publication time unknown'],facts:[{metric:'net_profit',value:100,unit:'EGP',scale:1000,page:4,basis:'Consolidated',method:'Visual table review'}]};
 assert.throws(()=>saveDocumentReview(root,{...review,limitations:[]}),/limitations/);
 assert.throws(()=>saveDocumentReview(root,{...review,facts:[{...review.facts[0],page:5}]}),/page/);
 assert.throws(()=>saveDocumentReview(root,{...review,facts:[{...review.facts[0],unit:'unknown'}]}),/unit/);
 const saved=saveDocumentReview(root,review,new Date('2026-10-23T11:00Z')),record=JSON.parse(readFileSync(saved.path));assert.equal(record.tradeAuthorization,false);assert.equal(record.accessedAt,'2026-10-23T10:00Z');assert.equal(documentReviews(root,['TEST']).length,1);assert.equal(documentReviews(root,['OTHER']).length,0);
 writeFileSync(bodyPath,'changed');assert.throws(()=>saveDocumentReview(root,review),/source hash/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('document revisions retain the previous URL, hash and capture date without duplicating the same capture',()=>{
 const index={},old={url:'https://issuer.example/report.pdf',sha256:'old',capturedAt:'2026-10-22T12:00Z',bodyPath:'old.bin'};
 retainDocumentVersion(index,old);retainDocumentVersion(index,old);
 const newer={...old,sha256:'new',capturedAt:'2026-10-23T12:00Z',bodyPath:'new.bin'};retainDocumentVersion(index,newer);
 old.bodyPath='mutated';assert.equal(Object.values(index.versions).length,2);assert.equal(Object.values(index.versions)[0].bodyPath,'old.bin');
});
