import {test} from 'node:test';import assert from 'node:assert/strict';import {sizeCandidate,validateReport,entryRisk} from './research.mjs';
test('entry risk works without portfolio capital and includes explicit cost scenarios',()=>{const r=entryRisk({entry:100,stop:95,target:110,roundTripCostFraction:.005});assert.equal(r.lossPerShareEGP,5.5);assert.equal(r.lossPercent,5.5);assert.equal(r.gainPerShareEGP,9.5);assert.equal(r.rewardRisk,9.5/5.5);assert.throws(()=>entryRisk({entry:100,stop:101,target:110}));});
test('unknown capital blocks sizing; portfolio, cash and liquidity caps constrain it',()=>{
 const c={entry:100,stop:95,medianDailyVolume:100000};assert.equal(sizeCandidate({},c).shares,null);
 const p={capitalEGP:100000,availableCashEGP:10000,riskPerTradeFraction:.01,maxPositionFraction:.2,maxPortfolioRiskFraction:.04,maxDailyVolumeParticipation:.01,estimatedRoundTripCostFraction:.005};
 assert.equal(sizeCandidate(p,c).shares,99);assert.equal(sizeCandidate({...p,availableCashEGP:0},c).shares,0);assert.equal(sizeCandidate(p,{...c,existingPortfolioRiskEGP:4000}).shares,0);assert.equal(sizeCandidate(p,{...c,medianDailyVolume:1000}).shares,10);
 assert.throws(()=>sizeCandidate(p,{...c,stop:101}));assert.throws(()=>sizeCandidate({...p,riskPerTradeFraction:2},c));
});
test('reports reject unsupported citations and model-written sizing',()=>{
 const r={version:'1.0',id:'report-test',type:'readiness',createdAt:'2026-10-08T12:00:00Z',summary:'Setup',sources:[],assessments:[],limitations:[]};assert.equal(validateReport(r),r);
 r.sources=[{id:'s1',title:'Source',url:'javascript:alert(1)',accessedAt:r.createdAt}];assert.throws(()=>validateReport(r));r.sources[0].url='https://example.com';
 r.assessments=[{ticker:'COMI',verdict:'Watch',rationale:'Missing company evidence',sourceIds:['missing']}];assert.throws(()=>validateReport(r));r.assessments[0].sourceIds=['s1'];for(const k of ['fundamentals','technicals','catalysts','risks','invalidation','positionReview','entryConditions'])r.assessments[0][k]='Pending';r.assessments[0].sizing={shares:100};assert.throws(()=>validateReport(r));delete r.assessments[0].sizing;validateReport(r);
});
