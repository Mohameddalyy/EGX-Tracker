import {randomBytes,randomUUID} from 'node:crypto';
import {initDecisions} from './decisions.mjs';
import {initJournal} from './journal.mjs';
import {initPositions,entryFills,position} from './positions.mjs';
import {cairoDate,snapshot} from './core.mjs';
import {hash,normalizeEvent,thresholdMatches} from './alert-protocol.mjs';

export function initIntraday(db){
 initDecisions(db);initJournal(db);initPositions(db);
 db.exec(`PRAGMA busy_timeout=1000;
 CREATE TABLE IF NOT EXISTS intraday_rules(id TEXT PRIMARY KEY,ticker TEXT NOT NULL,scope TEXT NOT NULL,source_id TEXT NOT NULL,kind TEXT NOT NULL,payload TEXT NOT NULL,token TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,current INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS intraday_events(id TEXT PRIMARY KEY,rule_id TEXT NOT NULL,ticker TEXT NOT NULL,received_at TEXT NOT NULL,triggered_at TEXT NOT NULL,status TEXT NOT NULL,reason TEXT NOT NULL,payload TEXT NOT NULL,candidate_id TEXT);
 CREATE TABLE IF NOT EXISTS intraday_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS intraday_jobs(candidate_id TEXT PRIMARY KEY,status TEXT NOT NULL,started_at TEXT NOT NULL,finished_at TEXT,pid INTEGER,log_path TEXT,message TEXT);
 CREATE INDEX IF NOT EXISTS intraday_event_rule_time ON intraday_events(rule_id,triggered_at);`);
}
export function setting(db,key,value){if(value!==undefined)db.prepare('INSERT INTO intraday_settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));const r=db.prepare('SELECT value FROM intraday_settings WHERE key=?').get(key);return r?JSON.parse(r.value):null;}
function saveRule(db,spec,now){
 const id='alert-'+hash(JSON.stringify(spec)).slice(0,24);
 const previous=spec.scope!=='manual'&&db.prepare('SELECT enabled FROM intraday_rules WHERE ticker=? AND scope=? AND kind=? AND json_extract(payload,\'$.label\')=? ORDER BY created_at DESC,rowid DESC LIMIT 1').get(spec.ticker,spec.scope,spec.kind,spec.label);
 db.prepare('INSERT INTO intraday_rules(id,ticker,scope,source_id,kind,payload,token,created_at,enabled) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET current=1').run(id,spec.ticker,spec.scope,spec.sourceId,spec.kind,JSON.stringify(spec),randomBytes(32).toString('hex'),now.toISOString(),previous?previous.enabled:1);return id;
}
function stockDelay(stock){const m=typeof stock.metadata==='string'?JSON.parse(stock.metadata):stock.metadata;const v=m?.symbolExt?.delay??m?.symbolInfo?.delay;return Number.isFinite(v)&&v>=0?v:null;}
export function syncIntradayRules(db,now=new Date()){
 initIntraday(db);const ids=[];
 const add=spec=>{if(Number.isFinite(spec.threshold)&&spec.threshold>0)ids.push(saveRule(db,spec,now));};
 db.exec('BEGIN IMMEDIATE');try{
  db.prepare("UPDATE intraday_rules SET current=0 WHERE scope<>'manual'").run();
  for(const row of db.prepare("SELECT d.* FROM agent_decisions d WHERE d.action='Watch' AND NOT EXISTS(SELECT 1 FROM agent_decisions n WHERE n.supersedes=d.id)").all()){
   const p=JSON.parse(row.payload).riskPlan,s=db.prepare('SELECT * FROM stocks WHERE ticker=?').get(row.ticker);
   if(!s?.active||!s.watched||s.currency!=='EGP'||p?.version!=='priced-plan-1.0'||Date.parse(p.expiresAt)<=now)continue;
   const outcome=db.prepare('SELECT payload FROM decision_outcomes WHERE decision_id=? ORDER BY observed_at DESC,rowid DESC LIMIT 1').get(row.id);
   const invalidDaily=outcome&&/Invalidated|Expired|Superseded|Target observed/.test(JSON.parse(outcome.payload).tradePlan?.status||'');
   const invalidIntraday=db.prepare("SELECT 1 FROM intraday_events e JOIN intraday_rules r ON r.id=e.rule_id WHERE r.source_id=? AND r.kind IN ('stop','target') AND e.status='review_queued' LIMIT 1").get(row.id);
   const base={ticker:row.ticker,scope:'decision',sourceId:row.id,decisionId:row.id,currency:'EGP',delaySeconds:stockDelay(s),expiresAt:p.expiresAt,capturedAt:p.capturedAt};
   if(!invalidDaily&&!invalidIntraday){add({...base,kind:'entry',direction:'above',threshold:p.entryZone.low,label:'Entry-zone lower boundary',entryZone:p.entryZone});add({...base,kind:'entry',direction:'below',threshold:p.entryZone.high,label:'Entry-zone upper boundary',entryZone:p.entryZone});}
   add({...base,kind:'stop',direction:'below',threshold:p.stop,label:'Setup invalidation'});
   for(const t of p.targets)add({...base,kind:'target',direction:'above',threshold:t.price,label:t.label});
  }
  for(const j of db.prepare('SELECT * FROM journal').all()){
   const p=JSON.parse(j.plan),held=position(entryFills(db,j.id),p);if(held.quantity<=0)continue;
   const s=db.prepare('SELECT * FROM stocks WHERE ticker=?').get(j.ticker);if(!s||s.currency!=='EGP')continue;
   // Position risk remains monitored after plan expiry, supersession or a watchlist pause.
   const base={ticker:j.ticker,scope:'holding',sourceId:String(j.id),journalId:j.id,decisionId:p.agentDecisionId||null,currency:'EGP',delaySeconds:stockDelay(s),expiresAt:null};
   add({...base,kind:'stop',direction:'below',threshold:p.stop,label:'Recorded holding stop'});
   for(const t of p.pricedPlan?.targets||[{label:'Target',price:p.target}])add({...base,kind:'target',direction:'above',threshold:t.price,label:t.label});
  }
  // Watchlist levels are research triggers, never approved entry/stop recommendations.
  for(const s of snapshot(db,null,now).stocks.filter(s=>s.active&&s.watched&&s.currency==='EGP')){
   if(!s.latest||!s.retrieved_at||s.captureAgeHours<0||s.captureAgeHours>36)continue;
   const base={ticker:s.ticker,scope:'watchlist',sourceId:s.latest.day,currency:'EGP',delaySeconds:stockDelay(s),expiresAt:new Date(Date.parse(s.retrieved_at)+36*3600000).toISOString(),capturedAt:s.retrieved_at};
   const support=s.levels?.support?.[0],resistance=s.levels?.resistance?.[0];
   if(support)add({...base,kind:'support',direction:'below',threshold:support.low,label:'Daily support breached',evidence:support});
   if(resistance)add({...base,kind:'resistance',direction:'above',threshold:resistance.high,label:'Daily resistance crossed',evidence:resistance});
  }
  db.exec('COMMIT');return ids;
 }catch(e){db.exec('ROLLBACK');throw e;}
}
export function createManualRule(db,input,now=new Date()){
 initIntraday(db);const s=db.prepare('SELECT * FROM stocks WHERE ticker=?').get(input.ticker);
 if(!s?.watched||!s.active||s.currency!=='EGP')throw Error('Choose an active EGP watchlist stock');
 if(!['support','resistance','volume'].includes(input.kind)||!Number.isFinite(input.threshold)||input.threshold<=0||input.threshold>1e15)throw Error('A positive research threshold is required');
 const expiry=Date.parse(input.expiresAt);if(!Number.isFinite(expiry)||expiry<=now||expiry-now>30*86400000)throw Error('Choose an expiry within the next 30 days');
 return {id:saveRule(db,{ticker:s.ticker,scope:'manual',sourceId:randomUUID(),kind:input.kind,direction:input.kind==='support'?'below':'above',threshold:input.threshold,label:'User research alert',currency:'EGP',delaySeconds:stockDelay(s),expiresAt:new Date(expiry).toISOString()},now)};
}
export function publicRule(row){const {token,payload,...rest}=row;return {...rest,...JSON.parse(payload),enabled:!!row.enabled,current:!!row.current};}
export function relayRules(db,now=new Date()){
 return db.prepare('SELECT * FROM intraday_rules WHERE current=1').all().map(r=>{const p=JSON.parse(r.payload),s=db.prepare('SELECT active,watched FROM stocks WHERE ticker=?').get(r.ticker);return {id:r.id,symbol:'EGX:'+r.ticker,tokenHash:hash(r.token),kind:p.kind,direction:p.direction,threshold:p.threshold,expiresAt:p.expiresAt,enabled:!!r.enabled&&(p.scope==='holding'||!!s?.active&&!!s?.watched)&&(!p.expiresAt||Date.parse(p.expiresAt)>now)};});
}
export function alertTemplate(db,id){
 const r=db.prepare('SELECT * FROM intraday_rules WHERE id=? AND current=1 AND enabled=1').get(id);if(!r)throw Error('Active rule required');const p=JSON.parse(r.payload);
 return {rule:publicRule(r),message:JSON.stringify({schema:1,ruleId:r.id,token:r.token,symbol:'{{exchange}}:{{ticker}}',price:'{{close}}',volume:'{{volume}}',triggeredAt:'{{timenow}}',barTime:'{{time}}'},null,2),condition:p.kind==='volume'?`Volume on the explicitly chosen chart interval ≥ ${p.threshold} (use once per bar close)`:`${p.direction==='below'?'Price ≤':'Price ≥'} ${p.threshold} EGP (use Crossing Down / Crossing Up as appropriate)`,note:'Use EGX:'+r.ticker+'. Enable TradingView app notifications and Webhook URL. This message contains a secret for this one rule; do not share it. Match the expiration and threshold exactly. Volume is chart-bar volume, not the number of exchange trades.'};
}
export function ingestIntradayEvent(db,input,{now=new Date(),receivedAt=now.toISOString()}={}){
 initIntraday(db);const e=normalizeEvent(input,now),prior=db.prepare('SELECT * FROM intraday_events WHERE id=?').get(e.eventId);if(prior)return {duplicate:true,status:prior.status,candidateId:prior.candidate_id};
 const row=db.prepare('SELECT * FROM intraday_rules WHERE id=?').get(e.ruleId);if(!row)throw Error('Unknown alert rule');const r=JSON.parse(row.payload);
 if(e.symbol!=='EGX:'+r.ticker||!thresholdMatches(r,e))throw Error('Event differs from saved rule');
 if(!Number.isFinite(Date.parse(receivedAt))||Date.parse(receivedAt)>now.getTime()+60000)throw Error('Invalid relay receipt time');
 let status='review_queued',reason=r.label+': '+e.price+' EGP'+(r.kind==='volume'?', bar volume '+e.volume:'')+'. This is an observation, not an order or a fill.';
 const stock=db.prepare('SELECT * FROM stocks WHERE ticker=?').get(r.ticker),older=db.prepare('SELECT 1 FROM intraday_events WHERE rule_id=? AND triggered_at>? LIMIT 1').get(row.id,e.triggeredAt);
 const superseded=r.scope==='decision'&&db.prepare('SELECT id FROM agent_decisions WHERE supersedes=?').get(r.sourceId);
 const journal=r.scope==='holding'&&db.prepare('SELECT plan FROM journal WHERE id=?').get(r.journalId);
 const closed=r.scope==='holding'&&(!journal||position(entryFills(db,r.journalId),JSON.parse(journal.plan)).quantity<=0);
 if(!row.enabled||!row.current||superseded||closed||r.expiresAt&&(Date.parse(e.triggeredAt)>=Date.parse(r.expiresAt)||r.kind==='entry'&&now>=Date.parse(r.expiresAt))||r.scope!=='holding'&&(!stock?.active||!stock?.watched)){status='inactive';reason='Retired, expired or paused rule; retained for audit only.';}
 else if(Date.parse(e.triggeredAt)<Date.parse(row.created_at)-60000){status='pre_rule';reason='Event predates rule registration; audit only.';}
 else if(older){status='out_of_order';reason='Older than a previously received observation for this rule; audit only.';}
 else if(now-Date.parse(e.triggeredAt)>86400000){status='historical';reason='Over 24 hours old on import; retained for scheduled review, not a current signal.';}
 else if(r.kind==='entry'&&(e.price<r.entryZone.low||e.price>r.entryZone.high)){status='outside_zone';reason='Boundary crossed outside the approved entry zone. Do not chase; no entry confirmation.';}
 if(r.delaySeconds===null)reason+=' Feed delay is unknown; verify a current quote.';
 else if(r.delaySeconds>0)reason+=` Feed metadata indicates ${r.delaySeconds/60} minutes of delay.`;
 if(now-Date.parse(e.triggeredAt)>120000)reason+=' Delivery/import was late; independently refresh before reviewing.';
 if(r.kind==='entry')reason+=' Daily candle, volume and other saved entry conditions still require independent confirmation.';
 let candidateId=null;
 db.exec('BEGIN IMMEDIATE');try{
  if(status==='review_queued'){
   const day=cairoDate(now),eventPolicy='intraday-1.0-'+row.id.slice(6),existing=db.prepare("SELECT id,status FROM research_queue WHERE ticker=? AND (status IN ('pending','researching','awaiting_decision') OR (as_of=? AND policy_version=?)) ORDER BY created_at DESC LIMIT 1").get(r.ticker,day,eventPolicy);
   if(existing){candidateId=existing.id;if(!['pending','researching','awaiting_decision'].includes(existing.status)){status='repeat_trigger';reason+=' Same rule already reviewed today; observation retained without launching another identical review.';}}
   else{
    candidateId='candidate-'+randomUUID();const at=now.toISOString(),evidence={ticker:r.ticker,signals:['Intraday research trigger'],flags:[reason],eventId:e.eventId,ruleId:row.id,previousDecisionId:r.decisionId||null,journalId:r.journalId||null,notAScreen:true,triggeredAt:e.triggeredAt};
    db.prepare('INSERT INTO research_queue(id,run_id,ticker,as_of,policy_version,created_at,updated_at,evidence,note) VALUES(?,?,?,?,?,?,?,?,?)').run(candidateId,'intraday-'+e.eventId,r.ticker,day,eventPolicy,at,at,JSON.stringify(evidence),reason);
   }
   const notification='intraday-'+hash(r.ticker+'|'+row.id+'|'+day).slice(0,32);
   if(status==='review_queued'){
   db.prepare('INSERT OR IGNORE INTO research_notifications(id,created_at,ticker,queue_id,message) VALUES(?,?,?,?,?)').run(notification,now.toISOString(),r.ticker,candidateId,r.ticker+': '+reason+' Analyst review '+candidateId+'.');
   if(r.decisionId&&db.prepare('SELECT id FROM agent_decisions WHERE id=?').get(r.decisionId))db.prepare('INSERT INTO decision_notes VALUES(?,?,?,?,?)').run('note-'+e.eventId,r.decisionId,now.toISOString(),'review-trigger',reason+' Event '+e.eventId+'; candidate '+candidateId);
   }
  }
  db.prepare('INSERT INTO intraday_events VALUES(?,?,?,?,?,?,?,?,?)').run(e.eventId,row.id,r.ticker,receivedAt,e.triggeredAt,status,reason,JSON.stringify({...e,delaySeconds:r.delaySeconds,importedAt:now.toISOString(),scope:r.scope,sourceId:r.sourceId}),candidateId);
  db.exec('COMMIT');return {eventId:e.eventId,status,candidateId};
 }catch(err){db.exec('ROLLBACK');throw err;}
}
export function intradayState(db,now=new Date()){
 initIntraday(db);return {rules:db.prepare('SELECT * FROM intraday_rules WHERE current=1 ORDER BY ticker,scope,kind').all().map(publicRule),events:db.prepare('SELECT * FROM intraday_events ORDER BY received_at DESC,rowid DESC LIMIT 100').all().map(r=>({...r,payload:JSON.parse(r.payload)})),jobs:db.prepare('SELECT * FROM intraday_jobs ORDER BY started_at DESC LIMIT 20').all(),transport:setting(db,'transport'),config:setting(db,'public-config'),now:now.toISOString(),watchlist:db.prepare("SELECT ticker FROM stocks WHERE active=1 AND watched=1 AND currency='EGP' ORDER BY ticker").all().map(s=>s.ticker),note:'TradingView alerts are not verified as active until a real delivery arrives. Cloud deployment and alert configuration are separate steps. Research runs locally; events wait while this PC is offline. No orders or fills are created.'};
}
export function intradayAudit(db){
 const exists=db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='intraday_events'").get();
 return exists?{rules:db.prepare('SELECT * FROM intraday_rules ORDER BY created_at').all().map(publicRule),events:db.prepare('SELECT * FROM intraday_events ORDER BY received_at').all().map(e=>({...e,payload:JSON.parse(e.payload)})),jobs:db.prepare('SELECT * FROM intraday_jobs ORDER BY started_at').all()}:{rules:[],events:[],jobs:[]};
}
