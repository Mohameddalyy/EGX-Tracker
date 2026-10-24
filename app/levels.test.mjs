import {test} from 'node:test';
import assert from 'node:assert/strict';
import {priceLevels} from './levels.mjs';
const fixture=()=>Array.from({length:30},(_,i)=>({day:`2026-09-${String(i+1).padStart(2,'0')}`,open:100,close:100,high:102,low:98}));
test('confirmed swings cluster with dated evidence and exact risk formulas',()=>{
 const b=fixture();b[5].low=95;b[10].low=95.4;b[8].high=108;
 const a=priceLevels(b,2,'2026-10-01');
 assert.equal(a.support.length,1);assert.equal(a.support[0].touches,2);
 assert.equal(a.support[0].evidence[0].confirmedOn,'2026-09-08');
 assert.equal(a.resistance[0].price,108);
 assert.equal(a.stops[0].price,94);assert.equal(a.stops[0].distancePercent,6);
 assert.equal(a.stops[0].rewardRisk,8/6);assert.equal(a.stops[1].price,96);
});
test('unconfirmed pivots and current-day extremes do not affect levels',()=>{
 const b=fixture();b[29].low=1;
 const before=priceLevels(b,2,'2026-10-01');assert.equal(before.support.length,0);
 assert.deepEqual(priceLevels([...b,{day:'2026-10-01',low:.1,high:999,close:999}],2,'2026-10-01'),before);
});
test('a broken pivot stays invalidated after price recovers',()=>{
 const b=fixture();b[5].low=95;b[12]={...b[12],low:93,close:94};
 const a=priceLevels(b,2,'2026-10-01');
 assert.ok(!a.support.flatMap(z=>z.evidence).some(e=>e.day==='2026-09-06'));
});
test('no invented levels on flat series; insufficient history and nonpositive stops handled',()=>{
 assert.equal(priceLevels(fixture(),2,'2026-10-01').support.length,0);
 assert.ok(priceLevels(fixture().slice(0,10),2,'2026-10-01').reason);
 assert.equal(priceLevels(fixture(),100,'2026-10-01').stops.length,0);
 assert.ok(priceLevels(fixture(),0,'2026-10-01').reason);
});
