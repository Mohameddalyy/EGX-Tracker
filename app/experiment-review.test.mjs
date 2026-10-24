import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {openPaper,paperAudit} from './paper.mjs';import {paperPerformance} from './paper-performance.mjs';import {experimentReview} from './experiment-review.mjs';
test('empty-trade final narrative reports untested execution, missing checkpoints and unavailable benchmarks without fabricating metrics',()=>{
 const c=JSON.parse(readFileSync('research/paper-experiment.json')),db=openPaper(':memory:',c);
 try{const now=new Date('2026-10-18T08:00:00Z'),audit=paperAudit(db),p=paperPerformance(db,{},now);
 const md=experimentReview({performance:p,audit,pipeline:{items:[]},decisions:[],outcomes:[],historyJobs:[],generatedAt:now.toISOString(),evidencePaths:['synthetic fixture only']});
 assert(md.includes('0 orders, 0 fills'));assert(md.includes('No trading strategy was exercised'));assert(md.includes('20 expected checkpoints missing'));assert(md.includes('Matching market-time baseline'));assert(md.includes('EGP 18000'));assert(md.includes('Historical portfolio scenario engine pending'));assert(md.includes('does not backfill'));assert(md.includes('No executed trades'));assert.equal(p.winRatePercent,null);assert.equal(db.prepare('SELECT COUNT(*) n FROM fills').get().n,0);
 }finally{db.close();}
});
