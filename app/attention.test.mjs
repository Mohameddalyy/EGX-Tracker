import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
import {attentionCandidates,initAttention,syncAttention,reviewAttention} from './attention.mjs';
const now=Date.parse('2026-10-08T12:00:00Z');
const stock=()=>({ticker:'COMI',active:1,retrieved_at:'2026-10-08T11:00:00Z',bars:[{day:'2026-10-07',low:94,high:111,close:100,captured_at:'2026-10-08T11:00:00Z'}],latest:{day:'2026-10-07',close:100,volume:200},unconfirmed:[],gaps:[],indicators:{atr14:2,rv20:2},levels:{support:[{low:98,high:99}],resistance:[]}});
const entry=()=>({id:1,ticker:'COMI',created_at:'2026-10-06T12:00:00Z',plan:{stop:95,target:110},reviews:[]});
test('thresholds are inclusive and paused/stale data suppress market flags',()=>{
 const s=stock();let a=attentionCandidates({stocks:[s],runs:[]},[],now);assert.equal(a.filter(x=>x.kind==='price').length,1);assert.equal(a.filter(x=>x.kind==='volume').length,1);
 s.active=0;assert.equal(attentionCandidates({stocks:[s],runs:[]},[],now).length,0);s.active=1;s.retrieved_at='2026-10-01T00:00:00Z';a=attentionCandidates({stocks:[s],runs:[]},[entry()],now);assert.deepEqual(a.map(x=>x.kind),['data']);
});
test('plan touches exclude pre-plan/same-day OHLC and closed plans; ambiguous touches are explicit',()=>{
 const s=stock(),e=entry();const get=()=>attentionCandidates({stocks:[s],runs:[]},[e],now).filter(x=>x.kind==='plan');assert.match(get()[0].title,/both levels/);
 s.unconfirmed=['2026-10-07'];assert.equal(get()[0].evidence.confirmed,false);
 e.created_at='2026-10-07T01:00:00Z';assert.equal(get().length,0);e.created_at='2026-10-06T12:00:00Z';e.reviews=[{status:'Cancelled'}];assert.equal(get().length,0);
});
test('review state persists for identical evidence, changed evidence reopens, history retained',()=>{
 const db=new DatabaseSync(':memory:');initAttention(db);const s=stock();const get=()=>attentionCandidates({stocks:[s],runs:[]},[],now);
 const first=syncAttention(db,get());reviewAttention(db,first[0].key,true);assert.ok(syncAttention(db,get()).find(a=>a.key===first[0].key).reviewedAt);
 s.latest.day='2026-10-08';const next=syncAttention(db,get());assert.ok(next.some(a=>!a.active&&a.reviewedAt));assert.ok(next.filter(a=>a.active).every(a=>!a.reviewedAt));
 assert.throws(()=>reviewAttention(db,'invalid',true));assert.throws(()=>reviewAttention(db,'a'.repeat(64),true));db.close();
});
test('unconfirmed dates, missing history, gaps and failed imports appear as data issues',()=>{
 const s=stock();s.bars=[];s.latest=null;s.unconfirmed=['2026-10-07'];s.gaps=['2026-10-04'];const a=attentionCandidates({stocks:[s],runs:[{id:2,status:'failed',at:'2026-10-08',message:'ETEL failed'}]},[],now);assert.equal(a.length,4);assert.equal(a.at(-1).kind,'import');
});
