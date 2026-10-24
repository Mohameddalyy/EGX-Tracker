import {DatabaseSync} from 'node:sqlite';import {mkdirSync} from 'node:fs';import {dirname} from 'node:path';import {createHash,randomUUID} from 'node:crypto';
import {cairoDate,snapshot} from './core.mjs';import {isConfirmedBar} from './finality.mjs';import {planProgress,tickRound} from './trade-plans.mjs';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const clock=d=>new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Cairo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(d);
export function openPaper(path,config){
 if(config.mode!=='PAPER_ONLY'||config.capitalEGP!==20000||config.feePerFilledOrderEGP!==5)throw Error('Expected authorized paper experiment');
 if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});const db=new DatabaseSync(path);db.exec(`PRAGMA journal_mode=WAL;PRAGMA busy_timeout=1000;
 CREATE TABLE IF NOT EXISTS config(id TEXT PRIMARY KEY,payload TEXT NOT NULL,hash TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS ledger(seq INTEGER PRIMARY KEY,id TEXT UNIQUE NOT NULL,at TEXT NOT NULL,kind TEXT NOT NULL,payload TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS observations(id TEXT PRIMARY KEY,ticker TEXT NOT NULL,time INTEGER NOT NULL,captured_at TEXT NOT NULL,payload TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,decision_id TEXT UNIQUE,ticker TEXT NOT NULL,submitted_at TEXT NOT NULL,payload TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS fills(order_id TEXT PRIMARY KEY,ticker TEXT NOT NULL,side TEXT NOT NULL,quantity INTEGER NOT NULL,price REAL NOT NULL,fee REAL NOT NULL,market_at TEXT NOT NULL,recorded_at TEXT NOT NULL,payload TEXT NOT NULL);`);
 const prior=db.prepare('SELECT * FROM config').get();if(prior&&prior.hash!==hash(config)){db.close();throw Error('Paper configuration is frozen; propose an amendment instead of editing it');}
 if(!prior){db.prepare('INSERT INTO config VALUES(?,?,?)').run(config.id,JSON.stringify(config),hash(config));appendPaper(db,'configuration',{config,hash:hash(config)},'week-config');}return db;
}
export function paperConfig(db){return JSON.parse(db.prepare('SELECT payload FROM config').get().payload);}
export function checkPaperRisk(db,marks={},now=new Date()){
 const s=paperState(db,marks),c=s.config,reasons=[];const past=db.prepare("SELECT payload FROM ledger WHERE kind IN ('risk-check','run') ORDER BY seq").all().map(r=>JSON.parse(r.payload));
 const equities=past.map(p=>p.equity??p.portfolio?.equity).filter(Number.isFinite);const peak=Math.max(c.capitalEGP,...equities,Number.isFinite(s.equity)?s.equity:0),drawdown=s.equity===null?null:(peak-s.equity)/peak;
 if(c.weeklyDrawdownStopFraction&&drawdown!==null&&drawdown+1e-12>=c.weeklyDrawdownStopFraction)appendOnce(db,'weekly-drawdown-stop','kill-switch',{peak,equity:s.equity,drawdown,reason:'Weekly drawdown stop; new entries disabled for the rest of this experiment'},now);
 const latched=eventExists(db,'weekly-drawdown-stop');if(latched)reasons.push('Weekly drawdown stop latched');if(!preflightReady(db,now))reasons.push('Missing, failed or stale preflight');
 if(s.equity===null||s.equity<=0||s.positions.some(p=>!Number.isFinite(p.mark?.price)||p.mark.price<=0||!Number.isFinite(Date.parse(p.mark.capturedAt))||Date.parse(p.mark.capturedAt)>now||now-Date.parse(p.mark.capturedAt)>c.maxCaptureAgeHours*3600000))reasons.push('Missing or unreliable portfolio valuation');
 if(s.equity>0){const pending=s.pending.filter(o=>o.plan.side==='BUY'),risk=s.positions.reduce((n,p)=>n+p.plannedRisk,0)+pending.reduce((n,o)=>n+o.plan.sizing.risk,0);if(risk>s.equity*c.maxPortfolioRiskFraction+1e-8)reasons.push('Aggregate planned risk breached');if(s.cash-s.reservedCash<s.equity*c.minCashFraction-1e-8)reasons.push('Cash floor / total exposure breached');const sectors={};for(const p of s.positions){sectors[p.sector]=(sectors[p.sector]||0)+p.value;if(p.value>s.equity*c.maxPositionFraction+1e-8)reasons.push('Stock allocation breached: '+p.ticker);if(p.plannedRisk>s.equity*c.riskPerPositionFraction+1e-8)reasons.push('Position planned risk breached: '+p.ticker);}for(const o of pending)sectors[o.plan.sector]=(sectors[o.plan.sector]||0)+o.plan.quantity*o.plan.entryZone.high+c.feePerFilledOrderEGP;for(const [sector,value] of Object.entries(sectors))if(value>s.equity*c.maxSectorFraction+1e-8)reasons.push('Sector allocation breached: '+sector);}
 const result={at:now.toISOString(),equity:s.equity,peak,drawdown,latched,blocked:reasons.length>0,reasons};appendPaper(db,'risk-check',result,randomUUID(),now);
 if(result.blocked)for(const o of s.pending.filter(o=>o.plan.side==='BUY'))appendOnce(db,'cancel-'+o.id,'unfilled',{orderId:o.id,reason:'Entry kill switch: '+reasons.join('; ')},now);return result;
}
export function revisePaperBeforeStart(db,next,reason,now=new Date()){
 const old=paperConfig(db);if(cairoDate(now)>=old.startDate||db.prepare('SELECT COUNT(*) n FROM orders').get().n||db.prepare("SELECT COUNT(*) n FROM ledger WHERE kind='run'").get().n)throw Error('Revision requires a pre-start experiment with no orders or runs');
 if(next.id!==old.id||next.capitalEGP!==old.capitalEGP||next.mode!==old.mode||next.feePerFilledOrderEGP!==old.feePerFilledOrderEGP||!reason?.trim())throw Error('Invalid authorized revision');
 db.exec('BEGIN IMMEDIATE');try{appendPaper(db,'authorized-prestart-revision',{previous:old,next,reason,previousHash:hash(old),nextHash:hash(next)},randomUUID(),now);db.prepare('UPDATE config SET payload=?,hash=? WHERE id=?').run(JSON.stringify(next),hash(next),old.id);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
}
export function appendPaper(db,kind,payload,id=randomUUID(),now=new Date()){db.prepare('INSERT INTO ledger(id,at,kind,payload) VALUES(?,?,?,?)').run(id,now.toISOString(),kind,JSON.stringify(payload));return id;}
const eventExists=(db,id)=>!!db.prepare('SELECT 1 FROM ledger WHERE id=?').get(id);
export function pendingOrders(db){return db.prepare('SELECT * FROM orders WHERE id NOT IN(SELECT order_id FROM fills)').all().filter(o=>!eventExists(db,'cancel-'+o.id)).map(o=>({...o,plan:JSON.parse(o.payload)}));}
export function paperState(db,marks={}){
 const c=paperConfig(db),fills=db.prepare('SELECT * FROM fills ORDER BY market_at,rowid').all(),positions={};let cash=c.capitalEGP,fees=0,realized=0;
 for(const f of fills){fees+=f.fee;const p=positions[f.ticker]??={ticker:f.ticker,quantity:0,cost:0,sector:JSON.parse(f.payload).sector,stop:JSON.parse(f.payload).stop,target:JSON.parse(f.payload).target,entryOrderId:f.order_id,lastFillAt:f.market_at};p.lastFillAt=f.market_at;
  if(f.side==='BUY'){if(!p.quantity){const terms=JSON.parse(f.payload);p.stop=terms.stop;p.target=terms.target;p.sector=terms.sector;}cash-=f.quantity*f.price+f.fee;p.quantity+=f.quantity;p.cost+=f.quantity*f.price+f.fee;p.entryOrderId=f.order_id;}
  else{const basis=p.cost/p.quantity*f.quantity;cash+=f.quantity*f.price-f.fee;realized+=f.quantity*f.price-f.fee-basis;p.quantity-=f.quantity;p.cost-=basis;}
 }
 const open=Object.values(positions).filter(p=>p.quantity>0).map(p=>{const m=marks[p.ticker];return {...p,mark:m??null,value:m?p.quantity*m.price:null,unrealized:m?p.quantity*m.price-p.cost:null,plannedRisk:p.quantity*Math.max(0,p.cost/p.quantity-p.stop*(1-c.adverseSlippageFraction))+c.feePerFilledOrderEGP};});
 const complete=open.every(p=>p.value!==null),equity=complete?cash+open.reduce((a,p)=>a+p.value,0):null,pending=pendingOrders(db),reservedCash=pending.filter(o=>o.plan.side==='BUY').reduce((n,o)=>n+o.plan.quantity*o.plan.entryZone.high+c.feePerFilledOrderEGP,0);
 return {config:c,cash,fees,realized,positions:open,equity,returnPercent:equity===null?null:100*(equity/c.capitalEGP-1),pending,reservedCash,unpriced:open.filter(p=>p.value===null).map(p=>p.ticker),fills};
}
export function paperMarks(db,source,now=new Date()){
 const marks={};for(const s of snapshot(source,db.prepare('SELECT DISTINCT ticker FROM fills').all().map(s=>s.ticker),now).stocks){
  if(s.latest&&s.captureAgeHours>=0&&s.captureAgeHours<=36)marks[s.ticker]={price:s.latest.close,marketAt:new Date(s.latest.time*1000).toISOString(),capturedAt:s.retrieved_at,source:'TradingView confirmed daily close'};
 }
 for(const r of db.prepare('SELECT * FROM observations ORDER BY time,captured_at').all()){
  const b=JSON.parse(r.payload);if(Date.parse(r.captured_at)>now||now-Date.parse(r.captured_at)>36*3600000)continue;
  if(!marks[r.ticker]||Date.parse(marks[r.ticker].marketAt)<b.time*1000)marks[r.ticker]={price:b.close,marketAt:new Date((b.time+60)*1000).toISOString(),capturedAt:r.captured_at,source:'TradingView one-minute observation'};
 }
 for(const f of db.prepare('SELECT ticker,MAX(market_at) last FROM fills GROUP BY ticker').all())if(marks[f.ticker]&&Date.parse(marks[f.ticker].marketAt)<Date.parse(f.last))delete marks[f.ticker];return marks;
}
export function recordPreflight(db,p,now=new Date()){
 const required=['calendar','corporateActions','liveMinuteData','ledger'];if(!p||!Array.isArray(p.checks)||required.some(k=>!p.checks.some(c=>c.name===k))||p.checks.some(c=>!['PASS','FAIL'].includes(c.status)||typeof c.evidence!=='string'||!c.evidence.trim()||!Number.isFinite(Date.parse(c.checkedAt))||Date.parse(c.checkedAt)>now))throw Error('Dated PASS/FAIL evidence required for calendar, corporate actions, live minute data and ledger');
 return appendPaper(db,'preflight',p,randomUUID(),now);
}
export function preflightReady(db,now=new Date()){
 const row=db.prepare("SELECT payload FROM ledger WHERE kind='preflight' ORDER BY seq DESC LIMIT 1").get();if(!row)return false;const p=JSON.parse(row.payload);return p.checks.every(x=>x.status==='PASS'&&now-Date.parse(x.checkedAt)<=36*3600000);
}
export function sizePaper(config,{equity,cash,reservedCash=0,portfolioRisk=0,sectorExposure=0,entry,stop,target,medianDailyVolume,openPositions=0}){
 const c=config,fee=c.feePerFilledOrderEGP,perRisk=entry-stop*(1-c.adverseSlippageFraction),perGain=target*(1-c.adverseSlippageFraction)-entry;
 if(![equity,cash,entry,stop,target,medianDailyVolume].every(Number.isFinite)||!(equity>0&&stop>0&&stop<entry&&entry<target&&medianDailyVolume>0)||openPositions>=c.maxPositions)return {quantity:0,reason:'Missing prices, liquidity, equity or position capacity'};
 const quantity=Math.max(0,Math.floor(Math.min((equity*c.riskPerPositionFraction-2*fee)/perRisk,(equity*c.maxPortfolioRiskFraction-portfolioRisk-2*fee)/perRisk,(equity*c.maxPositionFraction-fee)/entry,(equity*c.maxSectorFraction-sectorExposure-fee)/entry,(cash-reservedCash-equity*c.minCashFraction-fee)/entry,medianDailyVolume*c.maxDailyVolumeParticipation)));
 const risk=quantity*perRisk+2*fee,gain=quantity*perGain-2*fee,rr=quantity?gain/risk:0;
 return {quantity:rr>=c.minimumNetRewardRisk?quantity:0,risk,gain,rewardRisk:rr,reason:quantity&&rr>=c.minimumNetRewardRisk?'Within all frozen paper limits':'Insufficient risk/reward or portfolio capacity after fixed fees'};
}
export function proposePaperBuy(db,source,decisionId,now=new Date()){
 const c=paperConfig(db),day=cairoDate(now);if(day<c.startDate||day>c.endDate||[5,6].includes(new Date(day).getUTCDay())||clock(now)>='14:30')throw Error('Outside paper entry window');
 const gate=checkPaperRisk(db,paperMarks(db,source,now),now);if(gate.blocked)throw Error(gate.reasons.join('; '));
 const d=source.prepare('SELECT * FROM agent_decisions WHERE id=?').get(decisionId);if(!d||d.action!=='Watch'||source.prepare('SELECT 1 FROM agent_decisions WHERE supersedes=?').get(decisionId))throw Error('Current guarded Watch decision required');
 if(db.prepare('SELECT 1 FROM orders WHERE decision_id=?').get(decisionId))throw Error('Decision already has a paper order');
 const payload=JSON.parse(d.payload),evidence=JSON.parse(d.evidence),p=payload.riskPlan,s=snapshot(source,[d.ticker],now).stocks[0];
 const blocked=url=>{try{const host=new URL(url).hostname;return c.sources.excludedDomains.some(x=>host===x||host.endsWith('.'+x));}catch{return true;}};
 if((evidence.report?.sources||[]).some(x=>blocked(x.url)))throw Error('Analyst report uses an excluded source; fresh allowed-source review required');
 if(!s?.active||s.historyReadiness?.due!==false||s.currency!=='EGP'||s.captureAgeHours<0||s.captureAgeHours>c.maxCaptureAgeHours||s.gaps.length||!p||p.version!=='priced-plan-1.0'||Date.parse(p.expiresAt)<=now)throw Error('Fresh complete EGP setup required');
 const progress=planProgress(payload,s.bars,[],now);if(!progress.status.startsWith('Entry condition observed'))throw Error('Saved daily entry trigger has not been confirmed');
 const catalog=source.prepare('SELECT sector FROM market_catalog WHERE ticker=?').get(d.ticker),sector=catalog?.sector;if(!sector)throw Error('Sector classification required for concentration checks');
 const bars=s.bars.filter(b=>isConfirmedBar(b,now)).slice(-20),vol=bars.map(b=>b.volume).sort((a,b)=>a-b);if(vol.length<20||vol.some(v=>!Number.isFinite(v)))throw Error('Twenty confirmed raw volume observations required');
 const state=paperState(db,paperMarks(db,source,now));if(state.positions.some(x=>x.ticker===d.ticker)||state.pending.some(o=>o.ticker===d.ticker))throw Error('No adding, averaging down or overlapping ticker orders');
 const pending=state.pending.filter(o=>o.plan.side==='BUY'),sizing=sizePaper(c,{equity:state.equity,cash:state.cash,reservedCash:state.reservedCash,portfolioRisk:state.positions.reduce((n,p)=>n+p.plannedRisk,0)+pending.reduce((n,o)=>n+o.plan.sizing.risk,0),sectorExposure:state.positions.filter(x=>x.sector===sector).reduce((n,p)=>n+p.value,0)+pending.filter(o=>o.plan.sector===sector).reduce((n,o)=>n+o.plan.quantity*o.plan.entryZone.high+c.feePerFilledOrderEGP,0),entry:p.entryZone.high,stop:p.stop,target:p.targets[0].price,medianDailyVolume:(vol[9]+vol[10])/2,openPositions:state.positions.length+pending.length});
 if(!sizing.quantity)throw Error(sizing.reason);
 tickRound(p.entryZone.high,s.metadata.symbolInfo,'up');const id='paper-order-'+randomUUID(),order={side:'BUY',quantity:sizing.quantity,entryZone:p.entryZone,stop:p.stop,target:p.targets[0].price,sector,sizing,expiresAt:p.expiresAt,decisionId,sourceHash:d.source_hash,decisionCompletedAt:now.toISOString(),decisionPrice:s.latest.close,decisionPriceMarketAt:new Date(s.latest.time*1000).toISOString(),decisionPriceCapturedAt:s.latest.captured_at,decisionPriceBasis:'Last confirmed daily close available at decision; not a live quote',symbolInfo:s.metadata.symbolInfo,plan:p};
 db.exec('BEGIN IMMEDIATE');try{db.prepare('INSERT INTO orders VALUES(?,?,?,?,?)').run(id,decisionId,d.ticker,now.toISOString(),JSON.stringify(order));appendPaper(db,'order',{id,ticker:d.ticker,...order},id,now);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return {id,ticker:d.ticker,...order};
}
export function ingestPaperMinutes(db,capture,now=new Date()){
 if(capture.source!=='TradingView'||capture.resolution!=='1'||!Number.isFinite(Date.parse(capture.capturedAt))||Date.parse(capture.capturedAt)>now||!Array.isArray(capture.stocks))throw Error('Dated TradingView one-minute capture required');let count=0;
 db.exec('BEGIN IMMEDIATE');try{for(const s of capture.stocks){if(!/^[A-Z][A-Z0-9-]{1,23}$/.test(s.ticker)||s.currency!=='EGP'||!/^EGX(?:_DLY)?$/.test(s.exchange)||!Number.isFinite(s.delaySeconds)||s.delaySeconds<0||!Array.isArray(s.bars))throw Error('Verified EGP identity and feed delay required');let prior=-Infinity;
  const capturedAt=s.capturedAt||capture.capturedAt;if(!Number.isFinite(Date.parse(capturedAt))||Date.parse(capturedAt)>Date.parse(capture.capturedAt))throw Error('Invalid per-symbol capture timestamp');
  for(const b of s.bars){if(![b.time,b.open,b.high,b.low,b.close,b.volume].every(Number.isFinite)||b.time<=prior||b.time%60||b.low<=0||b.high<Math.max(b.open,b.close)||b.low>Math.min(b.open,b.close)||b.volume<0)throw Error('Invalid ordered raw minute bars');prior=b.time;
   if((b.time+60+s.delaySeconds)*1000>Date.parse(capturedAt))continue;
   const evidence={...b,source:'TradingView',delaySeconds:s.delaySeconds},id=hash([s.ticker,b,capturedAt]);count+=Number(db.prepare('INSERT OR IGNORE INTO observations VALUES(?,?,?,?,?)').run(id,s.ticker,b.time,capturedAt,JSON.stringify(evidence)).changes);
  }
 }appendPaper(db,'capture',{at:capture.capturedAt,tickers:capture.stocks.map(s=>s.ticker),accepted:count},randomUUID(),now);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return count;
}
function acceptedMinutes(db,ticker){const map=new Map();for(const r of db.prepare('SELECT * FROM observations WHERE ticker=? ORDER BY captured_at').all(ticker)){const b=JSON.parse(r.payload);if(!map.has(b.time))map.set(b.time,{...b,capturedAt:r.captured_at});}return [...map.values()].sort((a,b)=>a.time-b.time);}
export function settlePaper(db,now=new Date()){
 const c=paperConfig(db),results=[];
 for(const o of pendingOrders(db)){
  if(o.plan.side==='BUY'&&eventExists(db,'weekly-drawdown-stop')){appendOnce(db,'cancel-'+o.id,'unfilled',{orderId:o.id,reason:'Weekly drawdown stop latched'},now);continue;}
  const p=o.plan,submitted=Date.parse(o.submitted_at),day=cairoDate(new Date(submitted));let bars=acceptedMinutes(db,o.ticker).filter(b=>b.time*1000>submitted&&Date.parse(b.capturedAt)<=now&&cairoDate(new Date(b.time*1000))===day&&clock(new Date(b.time*1000))>='10:00'&&clock(new Date(b.time*1000))<'14:30');
  const firstMinute=Math.ceil(submitted/60000)*60+(submitted%60000===0?60:0),offset=Number(clock(new Date(day+'T12:00:00Z')).slice(0,2))-12,openTime=Date.parse(day+'T10:00:00Z')/1000-offset*3600;const expectedStart=clock(new Date(submitted))<'10:00'?openTime:firstMinute;
  if(bars.length&&bars[0].time!==expectedStart){appendOnce(db,'gap-'+o.id,'execution-gap',{orderId:o.id,reason:'Missing first post-decision minute; no inferred fill'},now);if(p.side==='BUY')appendOnce(db,'cancel-'+o.id,'unfilled',{orderId:o.id,reason:'Missing execution-window data'},now);continue;}
  if(p.side==='SELL'&&cairoDate(now)>day&&!bars.length)appendOnce(db,'exit-review-'+o.id,'execution-gap',{orderId:o.id,reason:'Exit lacks eligible same-session data; position remains exposed and requires review. No inferred overnight fill.'},now);
  let filled=false;
  for(let i=0;i<bars.length;i++){
   const b=bars[i];if(i&&b.time!==bars[i-1].time+60){appendOnce(db,'gap-'+o.id,'execution-gap',{orderId:o.id,reason:'Missing execution-window minute'},now);break;}
   if(p.side==='BUY'&&(i>=c.entryWindowMinutes||b.time*1000>=Date.parse(p.expiresAt)))break;
   const price=tickRound(b.open*(1+(p.side==='BUY'?1:-1)*c.adverseSlippageFraction),p.symbolInfo,p.side==='BUY'?'up':'down');
   if(b.volume<=0||p.quantity>Math.floor(b.volume*c.maxMinuteVolumeParticipation)||p.side==='BUY'&&(price<p.entryZone.low||price>p.entryZone.high))continue;
   if(p.side==='SELL'&&(paperState(db).positions.find(x=>x.ticker===o.ticker)?.quantity||0)<p.quantity)throw Error('Paper sell exceeds shares held');
   db.prepare('INSERT INTO fills VALUES(?,?,?,?,?,?,?,?,?)').run(o.id,o.ticker,p.side,p.quantity,price,c.feePerFilledOrderEGP,new Date(b.time*1000).toISOString(),now.toISOString(),JSON.stringify({...p,bar:b,assumption:'All-or-none next-minute-open simulation; not an actual execution'}));
   appendOnce(db,'fill-'+o.id,'fill',{orderId:o.id,ticker:o.ticker,side:p.side,quantity:p.quantity,price,fee:c.feePerFilledOrderEGP,marketAt:new Date(b.time*1000).toISOString(),sourceCapturedAt:b.capturedAt},now);results.push({id:o.id,filled:true});filled=true;break;
  }
  if(!filled&&p.side==='BUY'&&(bars.length>=c.entryWindowMinutes||cairoDate(now)>day||now>=Date.parse(p.expiresAt)))appendOnce(db,'cancel-'+o.id,'unfilled',{orderId:o.id,reason:'No eligible full fill in the frozen execution window'},now);
 }
 // Exit triggers were precommitted with the entry, not backdated agent decisions.
 for(const pos of paperState(db).positions){
  if(pendingOrders(db).some(o=>o.ticker===pos.ticker&&o.plan.side==='SELL'))continue;
  const b=acceptedMinutes(db,pos.ticker).find(b=>b.time*1000>=Date.parse(pos.lastFillAt)&&Date.parse(b.capturedAt)<=now&&(b.low<=pos.stop||b.high>=pos.target));if(!b)continue;
  const entry=JSON.parse(db.prepare('SELECT payload FROM orders WHERE id=?').get(pos.entryOrderId).payload);
  const id='paper-exit-'+hash([pos.entryOrderId,b.time]).slice(0,24),plan={side:'SELL',quantity:pos.quantity,sector:pos.sector,stop:pos.stop,target:pos.target,symbolInfo:entry.symbolInfo,precommitted:true,trigger:b.low<=pos.stop?'STOP':'TARGET',ambiguous:b.low<=pos.stop&&b.high>=pos.target,triggerBar:b};
  if(db.prepare('SELECT 1 FROM orders WHERE id=?').get(id))continue;
  db.prepare('INSERT INTO orders VALUES(?,?,?,?,?)').run(id,null,pos.ticker,new Date((b.time+60)*1000-1).toISOString(),JSON.stringify(plan));appendOnce(db,id,'exit-trigger',{orderId:id,ticker:pos.ticker,...plan},now);results.push({id,exitQueued:true});
 }
 return results;
}
function appendOnce(db,id,kind,payload,now){if(!eventExists(db,id))appendPaper(db,kind,payload,id,now);}
export function paperAudit(db){return {config:paperConfig(db),events:db.prepare('SELECT * FROM ledger ORDER BY seq').all().map(r=>({...r,payload:JSON.parse(r.payload)})),orders:db.prepare('SELECT * FROM orders').all().map(r=>({...r,payload:JSON.parse(r.payload)})),fills:db.prepare('SELECT * FROM fills').all().map(r=>({...r,payload:JSON.parse(r.payload)}))};}
