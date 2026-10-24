import {test} from 'node:test';import assert from 'node:assert/strict';
import {openDb} from './core.mjs';import {initFacts} from './market-facts.mjs';import {researchCard,rating} from './research-card.mjs';import {renderResearchCard} from './public/research-card.js';
test('ratings preserve unavailable and boundary values',()=>{assert.equal(rating(null),'Unavailable');assert.equal(rating(-.5),'Sell');assert.equal(rating(-.1),'Neutral');assert.equal(rating(.1),'Neutral');assert.equal(rating(.5),'Buy');assert.equal(rating(2),'Unavailable');});
test('peer comparisons exclude stale, different industry/currency and nonpositive PE; missing differs from negative',()=>{
 const d=openDb(':memory:');initFacts(d);const now=new Date('2026-10-15T17:00:00Z');
 const values={industry:'Banks',currency:'EGP',price_earnings_ttm:null,return_on_equity:-3,'Recommend.All':-.3,'Recommend.All|1W':.4,AnalystRating:'Buy'};
 const put=(ticker,v,at=now.toISOString())=>d.prepare('INSERT INTO market_facts VALUES(?,?,?)').run(ticker,at,JSON.stringify(v));put('COMI',values);
 for(const [ticker,pe] of [['A',4],['B',6],['C',8],['LOSS',-2]])put(ticker,{...values,price_earnings_ttm:pe});put('OLD',{...values,price_earnings_ttm:100},'2026-10-01T00:00:00Z');put('USD',{...values,currency:'USD',price_earnings_ttm:200});put('OTHER',{...values,industry:'Education',price_earnings_ttm:300});
 const c=researchCard(d,'COMI',now),pe=c.metrics.find(m=>m.key==='price_earnings_ttm');assert.equal(pe.status,'missing');assert.equal(pe.peerMedian,6);assert.equal(pe.peerCount,3);assert.equal(c.metrics.find(m=>m.key==='return_on_equity').status,'negative value');assert(c.questions.some(q=>q.includes('Daily Sell versus weekly Buy')));assert(c.sectorGuide.startsWith('Banks:'));assert.equal(researchCard(d,'MISSING',now),null);
 const stale=researchCard(d,'COMI',new Date('2026-10-20'));assert.equal(stale.fresh,false);assert(stale.metrics.every(m=>m.peerMedian===null));c.name='<script>alert(1)</script>';assert(!renderResearchCard(c).includes('<script>'));d.close();
});
