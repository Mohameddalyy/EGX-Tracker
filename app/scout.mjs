import {isConfirmedBar} from './finality.mjs';
import {randomUUID} from 'node:crypto';import {cairoDate,indicators} from './core.mjs';import {initFacts,factsFor} from './market-facts.mjs';
const median=a=>{const v=a.filter(Number.isFinite).sort((a,b)=>a-b);return v.length?(v[Math.floor((v.length-1)/2)]+v[Math.ceil((v.length-1)/2)])/2:null;};
export function initScout(db){initFacts(db);db.exec(`CREATE TABLE IF NOT EXISTS scout_runs(id TEXT PRIMARY KEY,at TEXT NOT NULL,policy TEXT NOT NULL,summary TEXT NOT NULL,payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS research_queue(id TEXT PRIMARY KEY,run_id TEXT NOT NULL,ticker TEXT NOT NULL,as_of TEXT NOT NULL,policy_version TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,evidence TEXT NOT NULL,report_id TEXT,note TEXT,UNIQUE(ticker,as_of,policy_version)); CREATE TABLE IF NOT EXISTS research_notifications(id TEXT PRIMARY KEY,created_at TEXT NOT NULL,ticker TEXT,queue_id TEXT,report_id TEXT,message TEXT NOT NULL,read_at TEXT);`);}
export function screenStocks(stocks,policy,benchmarks=[],now=new Date()){
 const today=cairoDate(now),time=now.getTime(),egx30=benchmarks.find(b=>b.symbol==='EGX:EGX30');
 const rows=stocks.map(s=>{
  const bars=s.bars.filter(b=>isConfirmedBar(b,now)),last=bars.at(-1),i=indicators(bars),reasons=[],flags=[];
  const medianTurnover=median(bars.slice(-20).map(b=>b.close*b.volume)),activeDays=bars.slice(-20).filter(b=>b.volume>0).length;
  const momentum=bars.length>=148?(bars.at(-22).close/bars.at(-148).close-1)*100:null;
  const atrPercent=last&&i.atr14?100*i.atr14/last.close:null;
  if(s.currency!=='EGP')reasons.push('USD: FX-aware liquidity and portfolio handling required');
  if(bars.length<policy.minConfirmedBars)reasons.push('Insufficient confirmed history');
  const age=(time-Date.parse(s.retrieved_at))/3600000;if(!Number.isFinite(age)||age<0||age>policy.maxCaptureAgeHours)reasons.push('Stale or missing price capture');
  if(!last||Date.parse(today)-Date.parse(last.day)>policy.maxLastBarAgeDays*86400000)reasons.push('No recent confirmed trading session');
  if(medianTurnover===null||medianTurnover<policy.minMedianTurnoverEGP||activeDays<policy.minNonzeroVolumeSessions20)reasons.push('Liquidity below research-screen minimum');
  if(atrPercent===null||atrPercent>policy.maxAtrPercent)reasons.push('Volatility unavailable or above screening limit');
  const factsAge=(time-Date.parse(s.facts?.capturedAt))/3600000,factsFresh=Number.isFinite(factsAge)&&factsAge>=0&&factsAge<=policy.maxCaptureAgeHours;
  const f=factsFresh?s.facts.values:{};if(!factsFresh)flags.push('Financial snapshot missing/stale');
  if(!(f.price_earnings_ttm>0))flags.push('Positive P/E unavailable; verify earnings');if(!Number.isFinite(f.return_on_equity))flags.push('ROE unavailable');
  flags.push('Financial periods, majority/major shareholders, filings, news and corporate actions require analyst verification');
  return {ticker:s.ticker,name:s.name,currency:s.currency,sector:s.sector||'',industry:f.industry||'',watched:!!s.watched,asOf:last?.day||null,priceCapture:s.retrieved_at,eligible:!reasons.length,exclusions:reasons,flags,score:0,signals:[],metrics:{close:last?.close,sma50:i.sma50,momentum6mExLastMonth:momentum,atrPercent,medianTurnoverEGP:s.currency==='EGP'?medianTurnover:null,activeDays20:activeDays,rv20:i.rv20,pe:f.price_earnings_ttm??null,roe:f.return_on_equity??null,debtEquity:f.debt_to_equity??null},facts:s.facts||null};
 });
 const eligible=rows.filter(r=>r.eligible),momentums=eligible.map(r=>r.metrics.momentum6mExLastMonth).filter(Number.isFinite);
 for(const r of eligible){const m=r.metrics,peers=eligible.filter(p=>r.industry&&p.industry===r.industry),pes=peers.map(p=>p.metrics.pe).filter(p=>Number.isFinite(p)&&p>0),roes=peers.map(p=>p.metrics.roe).filter(Number.isFinite);
  const pct=momentums.length>1?100*momentums.filter(v=>v<m.momentum6mExLastMonth).length/(momentums.length-1):null;m.momentumPercentile=pct;
  const add=(ok,text)=>{if(ok){r.score++;r.signals.push(text);}};
  add(m.close>m.sma50,'Confirmed close above SMA50');add(m.momentum6mExLastMonth>0,'Positive six-month price momentum excluding the latest 21 observations');add(pct>=70,'Top 30% momentum within eligible EGP coverage');
  m.sectorMedianPE=pes.length>=policy.minPeerCount?median(pes):null;m.sectorMedianROE=roes.length>=policy.minPeerCount?median(roes):null;
  add(m.pe>0&&m.sectorMedianPE!==null&&m.pe<m.sectorMedianPE,'Positive P/E below eligible industry median');add(m.roe>0&&m.sectorMedianROE!==null&&m.roe>m.sectorMedianROE,'ROE above eligible industry median');
  const indexAge=(time-Date.parse(egx30?.capturedAt))/3600000,stockPerf=r.facts?.values?.['Perf.3M'],indexPerf=egx30?.values?.['Perf.3M'];
  if(indexAge>=0&&indexAge<=policy.maxCaptureAgeHours&&Number.isFinite(stockPerf)&&Number.isFinite(indexPerf)&&!r.flags.includes('Financial snapshot missing/stale')){m.relative3mEGX30=stockPerf-indexPerf;add(m.relative3mEGX30>0,'TradingView three-month snapshot outperforms EGX30 (may include current session)');}else m.relative3mEGX30=null;
  add(m.rv20>=1.5,'Latest confirmed volume at least 1.5 times its prior 20-observation median');
  r.candidate=r.score>=policy.minScore;
 }
 return rows.sort((a,b)=>b.score-a.score||a.ticker.localeCompare(b.ticker));
}
export function runScout(db,policy,now=new Date(),{enqueue=true}={}){
 initScout(db);const stocks=db.prepare('SELECT s.*,m.sector FROM stocks s LEFT JOIN market_catalog m ON m.ticker=s.ticker').all().map(s=>({...s,facts:factsFor(db,s.ticker),bars:db.prepare('SELECT b.*,c.captured_at,c.finality FROM bars b LEFT JOIN bar_captures c ON c.ticker=b.ticker AND c.day=b.day WHERE b.ticker=? ORDER BY b.day').all(s.ticker)}));
 const benchmarks=db.prepare('SELECT * FROM market_benchmarks').all().map(b=>({symbol:b.symbol,capturedAt:b.captured_at,values:JSON.parse(b.payload)}));
 const rows=screenStocks(stocks,policy,benchmarks,now),sessionKey=rows.filter(r=>r.eligible).map(r=>r.asOf).sort().at(-1)||null,previous=db.prepare("SELECT summary,payload FROM scout_runs WHERE json_extract(summary,'$.total') IS NOT NULL ORDER BY at DESC LIMIT 1").get(),sameSession=previous&&(JSON.parse(previous.summary).sessionKey??JSON.parse(previous.payload).rows?.filter(r=>r.eligible).map(r=>r.asOf).sort().at(-1))===sessionKey,id='screen-'+randomUUID(),at=now.toISOString(),queued=[];
 db.exec('BEGIN IMMEDIATE');try{for(const r of rows.filter(r=>enqueue&&(!sameSession||policy.drainResearchBacklog)&&r.candidate&&(policy.includeWatchedInResearch||!r.watched))){
  if(queued.length>=policy.maxNewCandidatesPerRun)break;
  if(policy.drainResearchBacklog&&db.prepare("SELECT COUNT(*) n FROM research_queue WHERE status IN ('pending','researching','awaiting_decision')").get().n>=policy.maxNewCandidatesPerRun)break;
  const prior=db.prepare('SELECT * FROM research_queue WHERE ticker=? ORDER BY created_at DESC LIMIT 1').get(r.ticker);if(prior&&(prior.status==='pending'||prior.status==='researching'||prior.status==='awaiting_decision'||prior.as_of===r.asOf||Date.parse(at)-Date.parse(prior.updated_at)<policy.reviewCooldownDays*86400000))continue;
  const qid='candidate-'+randomUUID();db.prepare('INSERT INTO research_queue(id,run_id,ticker,as_of,policy_version,created_at,updated_at,evidence) VALUES(?,?,?,?,?,?,?,?)').run(qid,id,r.ticker,r.asOf,policy.version,at,at,JSON.stringify(r));queued.push({id:qid,ticker:r.ticker,score:r.score});
 }
 const summary={sessionKey,noNewSession:!!sameSession,total:rows.length,eligible:rows.filter(r=>r.eligible).length,matches:rows.filter(r=>r.candidate).length,queued,benchmarkCount:benchmarks.length};db.prepare('INSERT INTO scout_runs VALUES(?,?,?,?,?)').run(id,at,JSON.stringify(policy),JSON.stringify(summary),JSON.stringify({rows,benchmarks}));db.exec('COMMIT');return {id,at,...summary};
 }catch(e){db.exec('ROLLBACK');throw e;}
}
export function scoutState(db){initScout(db);const run=db.prepare('SELECT id,at,summary,policy FROM scout_runs ORDER BY at DESC LIMIT 1').get();return {run:run?{...run,summary:JSON.parse(run.summary),policy:JSON.parse(run.policy)}:null,queue:db.prepare('SELECT * FROM research_queue ORDER BY created_at DESC LIMIT 100').all().map(q=>({...q,evidence:JSON.parse(q.evidence)})),notifications:db.prepare('SELECT * FROM research_notifications ORDER BY created_at DESC LIMIT 100').all(),capabilities:{facts:db.prepare('SELECT COUNT(*) n FROM market_facts').get().n,pe:db.prepare("SELECT COUNT(*) n FROM market_facts WHERE json_extract(payload,'$.price_earnings_ttm') IS NOT NULL").get().n}};}

