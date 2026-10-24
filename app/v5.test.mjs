import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {hash,planHash,plan,variants} from './v5/contract.mjs';
import {metrics,rvAt,percentile,roundTick,turnover} from './v5/math.mjs';
import {evaluateUniverse,admitSeries,assignTiers,sectorStrength} from './v5/signals.mjs';
import {buildResearchPacket,validateResearchDisposition} from './v5/research.mjs';
import {signalFixture,researchEvidence,reviewFixture,signChallenge} from './v5/fixtures.mjs';
import {indicators as legacyIndicators} from './core.mjs';
import {v5Command} from './v5-agent.mjs';
const now=new Date('2026-10-22T14:23:00Z'),near=(a,b)=>assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const row=(result,id='FULL')=>result.rows.find(r=>r.variantId===id);
function context(id='FULL'){const input=signalFixture(),result=evaluateUniverse(input),packet=buildResearchPacket(result,input.universe[0].instrument.isin,id,researchEvidence(input));return {input,result,packet,review:reviewFixture(packet)};}

test('v5 runtime plan and schema match frozen bytes; legacy median RV stays separate',()=>{
 assert.equal(hash(readFileSync('app/v5/plan.json')),planHash);assert.equal(hash(readFileSync('verification/v5-phase3-20261023/plan.json')),planHash);assert.equal(hash(readFileSync('app/v5/decision-schema.json')),hash(readFileSync('verification/v5-phase3-20261023/decision-schema.json')));assert.equal(plan.activated,false);assert.equal(plan.capitalRisk.capitalEGP,100000);assert.equal(plan.capitalRisk.percentageCeilings,null);
 const b=signalFixture(1).universe[0].bars;b[241].volume=100000000;near(rvAt(b,261),3000000/5950000);near(legacyIndicators(b).rv20,3);
});
test('hand calculations: fixed Wilder seed, aligned SMAs, H20 and R63',()=>{
 const b=signalFixture(1).universe[0].bars,m=metrics(b);near(m.atr14,(.4*13+7.2)/14);near(m.h20,63.2);near(m.sma50,61.964);near(m.sma50Prior10,61.325);near(m.sma200,58.10975);near(m.r63,70/59.9-1);near(m.rv20,3);assert.equal(m.priorRV126.length,126);assert(m.priorRV126.every(x=>x===1));
 const older={...b[0],high:999999};near(metrics([older,...b]).atr14,m.atr14);assert.throws(()=>metrics(b.slice(-260)),/261/);
});
test('RV excludes current volume, keeps verified zero, rejects null and zero denominator',()=>{
 const b=signalFixture(1).universe[0].bars;near(rvAt(b,261),3);b[261].volume=9000000;near(rvAt(b,261),9);b[250].volume=0;near(rvAt(b,261),9000000/950000);b[250].volume=null;assert.equal(rvAt(b,261),null);for(let i=241;i<261;i++)b[i].volume=0;assert.equal(rvAt(b,261),null);
});
test('piecewise decimal ticks handle boundary, exact tick and strict next without floating overshoot',()=>{
 const bands=[{from:0,to:10,tick:.01},{from:10,to:null,tick:.05}];assert.equal(roundTick(10,bands,'ceil'),10);assert.equal(roundTick(10,bands,'next'),10.05);assert.equal(roundTick(9.999,bands,'floor'),9.99);assert.equal(roundTick(9.999,bands,'ceil'),10);assert.equal(roundTick(10.049,bands,'floor'),10);assert.equal(roundTick(.29,[{from:0,to:null,tick:.01}],'next'),.3);assert.throws(()=>roundTick(1,[{from:0,to:10,tick:0}]),/Tick/);
});
test('nearest rank and deterministic ISIN ties; tiers use entire prior eligible population',()=>{
 assert.equal(percentile([1,2,2,3,9],.8),3);assert.equal(percentile(Array.from({length:126},(_,i)=>i+1),.85),108);
 const tiers=assignTiers([{isin:'C',turnover:2},{isin:'B',turnover:3},{isin:'A',turnover:3}]);assert.equal(tiers.get('A').tier,1);assert.equal(tiers.get('B').tier,2);assert.equal(tiers.get('C').tier,3);assert.throws(()=>assignTiers([{isin:'A',turnover:1},{isin:'A',turnover:2}]),/Unique/);
});
test('full cohort records every arm/name and separates research pending from executable trades',()=>{
 const input=signalFixture(),result=evaluateUniverse(input);assert.equal(result.rows.length,63);assert.equal(result.priorTierPopulation,7);assert.equal(result.priorCohortComplete,true);assert.equal(row(result).status,'RESEARCH_PENDING');assert.equal(row(result,'B1').status,'CONTROL_VALIDATION_PENDING');assert.equal(row(result,'B0').status,'CASH_CONTROL');assert.equal(row(result).setup.takeProfit,null);assert.equal(row(result).setup.quantity,null);assert(result.rows.every(r=>r.entryAuthorization===false));assert.equal(row(result).setup.lower,63.2);assert.equal(row(result).setup.limit,70.22);assert.equal(row(result).setup.stop,68.22);assert.deepEqual(row(result).featureFamilies.momentum,['BREAKOUT','TREND','RELATIVE_MOMENTUM','MARKET_TREND']);
});
test('no current-high contamination and no future-price leakage',()=>{
 const input=signalFixture(1),first=evaluateUniverse(input);input.universe[0].bars.at(-1).high=71;input.universe[0].bars.at(-1).raw.high=71;const second=evaluateUniverse(input);assert.equal(row(first).metrics.h20,row(second).metrics.h20);
 input.universe[0].bars.push({...input.universe[0].bars.at(-1),day:'2026-10-25',close:1000000});const third=evaluateUniverse(input);assert.deepEqual(row(second).metrics,row(third).metrics);
});
test('null volume, missing sessions, provisional/future capture and action discontinuity block with exact reasons',()=>{
 for(const mutate of [x=>{x.universe[0].bars.at(-1).volume=null;},x=>{x.universe[0].bars.splice(100,1);},x=>{x.universe[0].bars.at(-1).capturedAt='2026-10-22T13:31:00Z';},x=>{x.universe[0].bars.at(-1).capturedAt='2026-10-22T15:00:00Z';},x=>{x.universe[0].bars[100].basisId='different';},x=>{x.universe[0].bars[100].priceFactor=2;}]){const input=signalFixture(1);mutate(input);const r=row(evaluateUniverse(input));assert.equal(r.status,'DATA_BLOCKED');assert(r.gates.some(g=>g.id==='DATA_ADMISSION'&&g.status==='BLOCKED'));assert.equal(r.setup,null);}
});
test('verified zero is not missing volume; unchanged no-trade close and 18/20 rule remain enforced',()=>{
 const input=signalFixture(1),b=input.universe[0].bars;for(const i of [250,252]){const price=b[i-1].close;b[i]={...b[i],open:price,high:price,low:price,close:price,volume:0,raw:{open:price,high:price,low:price,close:price,volume:0},officialNoTrade:true,noTradeSourceId:'issuer'};}
 assert.doesNotThrow(()=>admitSeries(input.universe[0],input));assert.equal(row(evaluateUniverse(input),'B1').metrics.positiveVolume20,18);delete b[250].officialNoTrade;assert.throws(()=>admitSeries(input.universe[0],input),/no-trade/);
});
test('benchmark missing endpoint is blocked rather than changing the relative-return gate',()=>{
 const input=signalFixture(1);input.benchmark.bars.splice(200,1);const r=row(evaluateUniverse(input),'B1');assert.equal(r.status,'DATA_BLOCKED');assert.equal(r.gates.find(g=>g.id==='BENCHMARK').status,'BLOCKED');
});
test('261-bar signal remains usable for fixed comparison; tier-aware prior eligibility needs one more session',()=>{
 const input=signalFixture(1);input.universe[0].bars.shift();const result=evaluateUniverse(input);assert.equal(row(result,'B2').mechanicallyEligible,true);assert.equal(row(result).status,'DATA_BLOCKED');assert.equal(row(result).gates.find(g=>g.id==='VOLUME').value.priorCohortComplete,false);
});
test('signal-day turnover surge cannot change liquidity tier; omitted universe blocks eligibility',()=>{
 const input=signalFixture(),before=evaluateUniverse(input);const last=input.universe[0].bars.at(-1);last.volume=last.raw.volume=900000000;const after=evaluateUniverse(input);assert.deepEqual(row(before).gates.find(g=>g.id==='VOLUME').value.tier,row(after).gates.find(g=>g.id==='VOLUME').value.tier);input.universeComplete=false;assert.equal(row(evaluateUniverse(input),'B1').status,'DATA_BLOCKED');
});
test('turnover uses actual values or conservative proxy bounds; ambiguity is not threshold rejection',()=>{
 const input=signalFixture(1),bars=input.universe[0].bars.slice(-20);const t=turnover(bars);assert.equal(t.method,'TYPICAL_PRICE_VOLUME_PROXY');for(const b of bars){b.turnoverEGP=2500000;b.turnoverSourceId='issuer';}assert.equal(turnover(bars).value,2500000);
 for(const b of input.universe[0].bars){delete b.turnoverEGP;delete b.turnoverSourceId;b.volume=b.raw.volume=32000;}const r=row(evaluateUniverse(input),'B1');assert.equal(r.gates.find(g=>g.id==='TURNOVER').status,'BLOCKED');
});
test('threshold rejection and excluded instrument stay in waterfall; empty cohort records no opportunity',()=>{
 const input=signalFixture(1),last=input.universe[0].bars.at(-1);last.close=last.raw.close=last.open=last.raw.open=63;last.low=last.raw.low=62.8;last.high=last.raw.high=63.2;assert.equal(row(evaluateUniverse(input),'B1').status,'THRESHOLD_REJECTED');input.universe[0].instrument.currency='USD';assert.equal(row(evaluateUniverse(input),'B1').gates[0].id,'INSTRUMENT_SCOPE');input.universe=[];const empty=evaluateUniverse(input);assert.equal(empty.rows.length,0);assert.equal(empty.noOpportunity,true);
});
test('sector strength needs five peers, aligned dates and 80% coverage; denominator retains missing peers',()=>{
 const peers=Array.from({length:5},(_,i)=>({isin:'P'+i,r20:.1,eligible:true,signalDay:'2026-10-22'})),args={target:'T',peers,eligiblePeerCount:6,benchmarkR20:.02,signalDay:'2026-10-22'};near(sectorStrength(args).relativeStrength,.08);assert.equal(sectorStrength({...args,eligiblePeerCount:7}).status,'IMPORTANT_GAP');assert.equal(sectorStrength({...args,peers:peers.slice(1)}).status,'IMPORTANT_GAP');
});
test('packets separate observations, derivations, judgment, uncertainty and remove ablation contexts',()=>{
 const {input,result}=context();for(const [id,absent] of [['FULL-NO-PEER','peer'],['FULL-NO-MACRO','macro'],['FULL-NO-SECTOR','sector']]){const p=buildResearchPacket(result,input.universe[0].instrument.isin,id,researchEvidence(input));assert(!p.items.some(e=>e.overlay===absent));if(absent==='sector')assert.equal(p.sectorStrength,null);}
 const mechanical=buildResearchPacket(result,input.universe[0].instrument.isin,'B1',researchEvidence(input));assert.equal(mechanical.modelOutputRequired,false);assert(!mechanical.items.some(e=>e.overlay!=='core'));assert(!('rv20' in mechanical.technical.metrics));
 const bad=researchEvidence(input);bad.items[0].kind='DERIVED';assert.throws(()=>buildResearchPacket(result,input.universe[0].instrument.isin,'FULL',bad),/method/);
});
test('ablation cannot remove critical safety or retain a dependency on omitted evidence',()=>{
 const {input,result}=context(),e=researchEvidence(input),isin=input.universe[0].instrument.isin;e.items.find(x=>x.id==='peer').critical=true;assert.throws(()=>buildResearchPacket(result,isin,'FULL-NO-PEER',e),/Critical/);delete e.items.find(x=>x.id==='peer').critical;e.items[0].dependsOn=['peer'];assert.throws(()=>buildResearchPacket(result,isin,'FULL-NO-PEER',e),/omitted/);
});
test('source policy rejects excluded domains and evidence unavailable at cutoff',()=>{
 const {input,result}=context(),e=researchEvidence(input),isin=input.universe[0].instrument.isin;e.sources=structuredClone(e.sources);e.sources[0].url='https://stockanalysis.com/quote/egx/TEST';assert.throws(()=>buildResearchPacket(result,isin,'FULL',e),/source/);e.sources[0].url='https://example.com/fixture';e.sources[0].availableAt='2026-10-22T15:00:00Z';assert.throws(()=>buildResearchPacket(result,isin,'FULL',e),/source/);
});
test('valid substantive Watch passes to risk controls without target, size, order or fill authorization',()=>{
 const {packet,review}=context(),out=validateResearchDisposition(packet,review,now);assert.equal(out.status,'AWAITING_RISK_AND_EXECUTION_CONTROLS');assert.equal(out.setup.takeProfit,null);assert.equal(out.setup.quantity,null);assert.equal(out.defaultGapMultiplier,.5);assert.equal(out.entryAuthorization,false);assert.match(out.independence,/same model/);
});
test('Wait and Avoid retain incomplete research as explicit nonexecuting dispositions',()=>{
 for(const decision of ['Wait','Avoid']){const {packet,review}=context();review.decision=decision;delete review.assessment;signChallenge(review);assert.equal(validateResearchDisposition(packet,review,now).status,'RETAINED_'+decision.toUpperCase());}
});
test('Watch rejects stale packet, wrong instrument/variant/hash, same actor, critical dissent and low confidence',()=>{
 for(const change of [r=>{r.isin='OTHER';},r=>{r.variantId='B1';},r=>{r.packetHash='x';},r=>{r.confidence='LOW';}]){const {packet,review}=context();change(review);signChallenge(review);assert.throws(()=>validateResearchDisposition(packet,review,now));}
 const {packet,review}=context();assert.throws(()=>validateResearchDisposition(packet,review,new Date('2026-10-22T15:00:00Z')),/expired/);review.challenge.actorId=review.actorId;assert.throws(()=>validateResearchDisposition(packet,review,now),/challenge/);signChallenge(review);review.challenge.unresolvedCriticalDefect=true;assert.throws(()=>validateResearchDisposition(packet,review,now),/contradictory/);
});
test('critical omission cannot be waived by technical confidence or field declaration',()=>{
 const {packet,review}=context();delete review.assessment.fieldEvidence.fields.corporate_actions;signChallenge(review);assert.throws(()=>validateResearchDisposition(packet,review,now),/critical field/);
});
test('bank model cannot substitute industrial ratios; peers need consistent positive denominators',()=>{
 const c=context();c.packet.sector='Banks';c.packet.companyModel='bank';const {packetHash,...payload}=c.packet;c.packet.packetHash=hash(payload);c.review.packetHash=c.packet.packetHash;c.review.assessment.fieldEvidence.sector='Banks';signChallenge(c.review);assert.throws(()=>validateResearchDisposition(c.packet,c.review,now),/financial model/);
 const {packet,review}=context();review.peerComparison.peers[0].denominator=-1;signChallenge(review);assert.throws(()=>validateResearchDisposition(packet,review,now),/Five comparable/);
});
test('negative sector gate cannot be waived; unknown is an important gap and ablation removes only that gate',()=>{
 const c=context();c.packet.sectorStrength.relativeStrength=-.01;const {packetHash,...payload}=c.packet;c.packet.packetHash=hash(payload);c.review.packetHash=c.packet.packetHash;signChallenge(c.review);assert.throws(()=>validateResearchDisposition(c.packet,c.review,now),/Negative sector/);
 const a=context('FULL-NO-SECTOR');assert.doesNotThrow(()=>validateResearchDisposition(a.packet,a.review,now));const b=context('FULL-NO-PEER');assert.equal(b.review.peerComparison,undefined);assert.doesNotThrow(()=>validateResearchDisposition(b.packet,b.review,now));
});
test('probability is not inferred from qualitative confidence or agent agreement',()=>{
 const {packet,review}=context();review.forecast.probability=.9;signChallenge(review);assert.throws(()=>validateResearchDisposition(packet,review,now),/Probability/);
});
test('manual CLI writes immutable isolated evaluation and never activates the engine',()=>{
 const dir=mkdtempSync(join(tmpdir(),'egx-v5-'));try{const input=join(dir,'input.json'),out=join(dir,'evaluation.json');writeFileSync(input,JSON.stringify(signalFixture(1)));const result=v5Command(['evaluate',input,out]);assert.equal(result.entryAuthorization,false);assert.throws(()=>v5Command(['evaluate',input,out]),/exist/i);assert.equal(v5Command(['status']).executionEngine,'NOT_IMPLEMENTED');}finally{rmSync(dir,{recursive:true,force:true});}
});

test('global missing calendar retains every instrument/variant as data-blocked, not a no-opportunity conclusion',()=>{
 const input=signalFixture(2);input.sessions=[];const r=evaluateUniverse(input);assert.equal(r.rows.length,18);assert.equal(r.noOpportunity,null);assert.equal(r.opportunityConclusion,'UNDETERMINED_DATA_GAPS');assert(r.rows.filter(x=>x.variantId!=='B0').every(x=>x.status==='DATA_BLOCKED'));assert.match(r.globalError,/calendar/);
});
test('126 valid prior RV observations may extend before the fixed ATR window',()=>{
 const b=signalFixture(1).universe[0].bars;const older=Array.from({length:100},()=>({...b[0]})),long=[...older,...b];for(let i=100;i<260;i++)long[i]={...long[i],volume:0};const sample=metrics(long);assert.equal(sample.priorRV126.length,126);assert(metrics(long.slice(-261)).priorRV126.length<126);near(sample.atr14,metrics(long.slice(-261)).atr14);
});
test('FULL and FULL-BOUNDED share identical mechanical eligibility and deterministic rank',()=>{
 const result=evaluateUniverse(signalFixture());const clean=x=>({gates:x.gates,metrics:x.metrics,setup:x.setup,rank:x.researchRank});for(const r of result.rows.filter(x=>x.variantId==='FULL'))assert.deepEqual(clean(r),clean(result.rows.find(x=>x.isin===r.isin&&x.variantId==='FULL-BOUNDED')));assert.equal(variants.FULL.discretionary,true);assert.equal(variants['FULL-BOUNDED'].discretionary,false);
});
test('statement reconciliation uses sourced numbers and preserves partial coverage; contradictions block Watch',()=>{
 const {input,result}=context(),e=researchEvidence(input),isin=input.universe[0].instrument.isin;
 const fact=value=>({value,page:'1',quote:'Synthetic numeric fixture'});e.statements=[{id:'statement-fixture',isin,sourceId:'issuer',currency:'EGP',scale:1,scope:'standalone',sectorModel:'industrial',periodStart:'2026-01-01',periodEnd:'2026-06-30',publishedAt:'2026-08-01T12:00:00Z',values:{assets:fact(1000),liabilities:fact(600),equity:fact(400)}}];
 let p=buildResearchPacket(result,isin,'FULL',e);assert.equal(p.statements[0].reconciliation.status,'PARTIAL');let r=reviewFixture(p);assert.equal(validateResearchDisposition(p,r,now).defaultGapMultiplier,.5);assert(validateResearchDisposition(p,r,now).importantGaps.includes('accounting-coverage'));
 e.statements[0].values.equity.value=100;p=buildResearchPacket(result,isin,'FULL',e);r=reviewFixture(p);assert.throws(()=>validateResearchDisposition(p,r,now),/Contradictory/);
 e.statements[0].values.equity.page='';assert.throws(()=>buildResearchPacket(result,isin,'FULL',e),/page/);
});
test('sourced valuation cannot omit its conditional value dependencies',()=>{
 const {packet,review}=context();review.valuation={status:'SOURCED_MODEL',conclusion:'Synthetic DCF',method:'industrial-dcf',evidenceIds:['financials']};signChallenge(review);assert.throws(()=>validateResearchDisposition(packet,review,now),/value dependencies/);
});

test('broad Finance sector does not choose a bank model by name; explicit model classification governs review',()=>{
 const input=signalFixture();input.universe[0].instrument.sector='Finance';input.universe[0].instrument.companyModel='bank';const result=evaluateUniverse(input),packet=buildResearchPacket(result,input.universe[0].instrument.isin,'FULL',researchEvidence(input)),review=reviewFixture(packet);assert.throws(()=>validateResearchDisposition(packet,review,now),/financial model/);review.financialModel={type:'BANK',...Object.fromEntries(['capital','assetQuality','funding','margin'].map(t=>[t,{conclusion:'Synthetic bank evidence',evidenceIds:['financials']}]))};signChallenge(review);assert.doesNotThrow(()=>validateResearchDisposition(packet,review,now));
});
