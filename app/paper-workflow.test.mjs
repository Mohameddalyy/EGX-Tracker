import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {openDb,ingest} from './core.mjs';import {initMarket} from './market.mjs';import {initScout,runScout} from './scout.mjs';
import {applyAnalystReview,requiredChecks} from './scout-review.mjs';import {saveDecisionRecord} from './decisions.mjs';
import {buildTradePlan} from './trade-plans.mjs';import {planStock,planOptions} from './trade-plan-fixture.mjs';
import {openPaper,recordPreflight,proposePaperBuy,ingestPaperMinutes,settlePaper,paperState,paperAudit} from './paper.mjs';
const config=JSON.parse(readFileSync('research/paper-experiment.json'));
test('isolated screen → analyst → guarded decision → confirmed trigger → sized order → evidenced fills',()=>{
 const root=mkdtempSync(join(tmpdir(),'egx-paper-workflow-')),db=openDb(':memory:'),paper=openPaper(':memory:',config);
 try{
 initMarket(db);initScout(db);const reviewed=new Date('2026-10-08T11:00:00Z'),now=new Date('2026-10-12T07:00:01Z');
 const stock=planStock(),days=[];for(let t=Date.parse('2026-10-07');days.length<160;t-=86400000){if(![5,6].includes(new Date(t).getUTCDay()))days.unshift(new Date(t).toISOString().slice(0,10));}
 stock.bars=stock.bars.map((b,i)=>({...b,day:days[i],time:Date.parse(days[i]+'T07:00:00Z')/1000}));stock.latest=stock.bars.at(-1);
 db.prepare('INSERT INTO stocks(ticker,name,currency,active,watched) VALUES(?,?,?,?,?)').run('TEST','Synthetic only','EGP',1,0);
 ingest(db,{retrieved_at:reviewed.toISOString(),stocks:[{ticker:'TEST',history:{bars:stock.bars},adjustment:{...stock.metadata,symbolExt:{symbol:'TEST'},symbolInfo:{...stock.metadata.symbolInfo,currency_code:'EGP'},properties:{dividendsAdjustment:false}}}]});
 const screen=runScout(db,{...JSON.parse(readFileSync('research/screening-policy.json')),minScore:0,maxAtrPercent:100},reviewed),candidate=screen.queued.find(x=>x.ticker==='TEST');assert(candidate,'The actual screen must enqueue the synthetic research candidate');
 const plan=buildTradePlan(stock,planOptions),sources=[{id:'fixture',url:'https://example.com/synthetic-test',title:'Synthetic test evidence — not market research',accessedAt:reviewed.toISOString()}];
 const a={ticker:'TEST',candidateId:candidate.id,verdict:'Conditional setup',pipelineDecision:'approve',horizon:'Medium term',rationale:'Synthetic pipeline fixture',sourceIds:['fixture'],riskPlan:plan,evidenceChecks:Object.fromEntries(requiredChecks.map(k=>[k,{status:'verified',asOf:'2026-10-07',sourceIds:['fixture'],note:'Synthetic isolated test only'}]))};
 for(const k of ['fundamentals','technicals','catalysts','risks','invalidation','positionReview','entryConditions'])a[k]='Synthetic test only';
 const report={version:'1.0',id:'report-test',createdAt:reviewed.toISOString(),contextId:'context-test',type:'research',summary:'Isolated test',limitations:['Synthetic evidence'],sources,assessments:[a]};
 mkdirSync(join(root,'data','research'),{recursive:true});mkdirSync(join(root,'research'));writeFileSync(join(root,'data','research','report-test.json'),JSON.stringify(report));writeFileSync(join(root,'data','research','context-test.json'),JSON.stringify({id:'context-test',createdAt:reviewed.toISOString(),stocks:[stock]}));writeFileSync(join(root,'research','decision-policy.json'),readFileSync('research/decision-policy.json'));
 assert.equal(applyAnalystReview(db,root,candidate.id,'report-test',reviewed).status,'awaiting_decision');assert.equal(db.prepare("SELECT watched FROM stocks WHERE ticker='TEST'").get().watched,0);
 const decision={id:'decision-test',queueId:candidate.id,reportId:'report-test',ticker:'TEST',createdAt:reviewed.toISOString(),policyVersion:'decision-1.1',action:'Watch',horizon:'Medium term',riskPlan:plan,uncertainties:[],prediction:{horizonSessions:5,direction:'uncertain',hurdlePercent:0,rationale:'Synthetic'}};
 for(const k of ['rationale','thesis','counterargument','invalidation','reviewConditions','processAssessment'])decision[k]='Synthetic isolated test';
 assert.equal(saveDecisionRecord(db,root,decision,reviewed).action,'Watch');
 const trigger={day:'2026-10-11',time:Date.parse('2026-10-11T07:00:00Z')/1000,open:plan.entryZone.low,low:plan.entryZone.low,high:plan.entryZone.high,close:plan.entryZone.high,volume:2000000};
 const oct8={...stock.bars.at(-1),time:Date.parse('2026-10-08T07:00:00Z')/1000};
 ingest(db,{retrieved_at:'2026-10-12T06:30:00Z',stocks:[{ticker:'TEST',history:{bars:[...stock.bars,oct8,trigger]},adjustment:{...stock.metadata,symbolExt:{symbol:'TEST'},symbolInfo:{...stock.metadata.symbolInfo,currency_code:'EGP'},properties:{dividendsAdjustment:false}}}]});
 db.prepare('INSERT INTO market_catalog(ticker,source_at,sector,catalog_json) VALUES(?,?,?,?)').run('TEST',now.toISOString(),'Finance','{}');
 assert.throws(()=>proposePaperBuy(paper,db,decision.id,now),/preflight/);
 recordPreflight(paper,{checks:['calendar','corporateActions','liveMinuteData','ledger'].map(name=>({name,status:'PASS',checkedAt:now.toISOString(),evidence:'Synthetic fixture; not real clearance'}))},now);
 const order=proposePaperBuy(paper,db,decision.id,now);assert(order.quantity>0);assert.equal(paperState(paper).fills.length,0);assert.equal(paperState(paper).pending.length,1);
 const minute=(m,values={})=>({time:Date.parse('2026-10-12T07:'+m+':00Z')/1000,open:plan.entryZone.low,high:plan.entryZone.high,low:plan.entryZone.low,close:plan.entryZone.low,volume:1000000,...values});
 const capture=bars=>ingestPaperMinutes(paper,{source:'TradingView',resolution:'1',capturedAt:'2026-10-12T08:00:00Z',stocks:[{ticker:'TEST',currency:'EGP',exchange:'EGX',delaySeconds:900,bars}]},new Date('2026-10-12T08:00:00Z'));
 capture([minute('00')]);settlePaper(paper,new Date('2026-10-12T08:00:00Z'));assert.equal(paperState(paper).fills.length,0,'Pre-order bar cannot fill');
 capture([minute('01')]);settlePaper(paper,new Date('2026-10-12T08:00:00Z'));assert.equal(paperState(paper).fills.length,1);assert.equal(paperState(paper).fees,5);
 capture([minute('02',{high:plan.target+.1,close:plan.target}),minute('03',{open:plan.target,high:plan.target+.1,low:plan.target-.1,close:plan.target})]);settlePaper(paper,new Date('2026-10-12T08:00:00Z'));settlePaper(paper,new Date('2026-10-12T08:00:00Z'));
 const s=paperState(paper);assert.equal(s.fills.length,2);assert.equal(s.positions.length,0);assert.equal(s.fees,10);assert.equal(s.cash,config.capitalEGP+s.realized);assert(paperAudit(paper).events.some(e=>e.kind==='order'));
 }finally{db.close();paper.close();rmSync(root,{recursive:true,force:true});}
});

