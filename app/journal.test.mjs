import {test} from 'node:test';import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {initJournal,saveDecision,addReview,journalEntries} from './journal.mjs';
const stock=()=>({ticker:'COMI',latest:{day:'2026-10-05',close:100},retrieved_at:'2026-10-06T12:00:00Z',bars:[{close:100}],levels:{version:'1.0'}});
const plan=()=>({requestId:'test-decision-000001',ticker:'COMI',capturedAt:'2026-10-06T12:00:00Z',asOf:'2026-10-05',horizon:'Short term',thesis:'Test thesis',invalidation:'Loss of support',entry:100,stop:95,target:110});
test('snapshots stay immutable across source changes and reviews; retries do not duplicate',()=>{
 const db=new DatabaseSync(':memory:');initJournal(db);const s=stock(),p=plan();const {id}=saveDecision(db,p,s);saveDecision(db,p,s);s.bars[0].close=1;s.latest.close=1;
 const review={requestId:'test-review-0000001',id,status:'Stopped (reported)',note:'Reported stop fill on review date'};
 addReview(db,review);addReview(db,review);addReview(db,{...review,requestId:'test-review-0000002',status:'Watching',note:'Correction: no position was entered'});
 const entries=journalEntries(db);assert.equal(entries.length,1);assert.equal(entries[0].evidence.bars[0].close,100);assert.equal(entries[0].plan.entry,100);assert.equal(entries[0].reviews.length,2);assert.equal(entries[0].reviews[0].status,'Watching');assert.equal(entries[0].plan.rewardRisk,2);db.close();
});
test('invalid prices, stale source and missing thesis are rejected without saving',()=>{
 const db=new DatabaseSync(':memory:');initJournal(db);
 for(const p of [{...plan(),stop:101},{...plan(),entry:NaN},{...plan(),thesis:' '},{...plan(),capturedAt:'old'},{...plan(),horizon:'Unknown'},{...plan(),target:99}])assert.throws(()=>saveDecision(db,p,stock()));
 assert.equal(journalEntries(db).length,0);
 assert.throws(()=>addReview(db,{requestId:'test-review-0000001',id:999,status:'Watching',note:'No entry'}));db.close();
});
