import {cairoDate} from './finality.mjs';
import {workflowHash} from './workflow-store.mjs';
export const workflowLimits={baseline:{targetMs:25*60000,hardMs:30*60000},screen:{targetMs:2*60000,hardMs:5*60000},checkpoint:{targetMs:5*60000,hardMs:8*60000}};
const active=['pending','researching','awaiting_decision'];
export function sourcePermission(access,source,now){const a=access[source];return !!(a?.status==='approved'&&a.evidencePath&&a.purpose==='personal-automated-analysis'&&Date.parse(a.effectiveAt)<=+now&&Date.parse(a.expiresAt)>+now);}
export function planWorkflow(input,{workload='checkpoint',now=new Date(),invocationAt=input.observedAt}={}){
 if(!workflowLimits[workload])throw Error('Unknown workload');
 const day=cairoDate(now),bucket=new Date(Math.floor(+now/1800000)*1800000).toISOString(),jobs=[],sourceGaps=[...(input.inputErrors||[])],stockMap=new Map(input.stocks.map(s=>[s.ticker,s]));
 const add=(kind,target,revision,priority,extra={})=>{const j={kind,target,revision,priority,resource:extra.source||'local',maxMs:60000,critical:false,...extra};jobs.push(j);return workflowHash([kind,target,revision]);};
 const source=(kind,target,revision,priority,extra)=>{if(workload==='screen'){sourceGaps.push({kind,target,code:'SOURCE_REFRESH_SEPARATE_WORKLOAD',critical:!!extra.critical});return null;}const j=add(kind,target,revision,priority,extra);if(!sourcePermission(input.sourceAccess,extra.source,now))sourceGaps.push({kind,target,code:'PERMISSION_UNRESOLVED',critical:!!extra.critical});return j;};
 // These cheap checks run at every invocation, independently of long source work.
 add('health','local',invocationAt,0,{critical:true,maxMs:5000});
 add('positions','all',workflowHash([invocationAt,input.ledgerFingerprint,input.livePositions]),1,{critical:true,maxMs:10000});
 const obligations=input.decisions.map(d=>{const s=stockMap.get(d.ticker),entryExpiry=d.payload.riskPlan?.expiresAt,rev=workflowHash([day,d.id,d.source_hash,s?.fingerprint,input.evidenceFingerprints[d.ticker],input.unmappedEvents.fingerprint]);return {decisionId:d.id,ticker:d.ticker,action:d.action,superseded:input.decisions.some(n=>n.supersedes===d.id),revision:rev,entryExpired:!!entryExpiry&&Date.parse(entryExpiry)<=+now,historyDue:!s||s.readiness.due,reviewConditions:d.payload.reviewConditions||null,evidenceFingerprint:input.evidenceFingerprints[d.ticker]||null};});
 for(const o of obligations)add('decision-monitor',o.decisionId,o.revision,2,{critical:true,maxMs:15000,ticker:o.ticker,evidenceFingerprint:o.evidenceFingerprint});
 // Includes candidates/valid setups/actual holdings; never the six-name setup list.
 const validIntents=input.intents.filter(o=>o.plan?.side==='SELL'||Date.parse(o.plan?.expiresAt)>+now),setups=input.decisions.filter(d=>d.action==='Watch'&&!input.decisions.some(n=>n.supersedes===d.id)&&Date.parse(d.payload.riskPlan?.expiresAt)>+now);
 const minuteTargets=[...new Set([...input.positions,...input.livePositions,...validIntents,...setups,...input.queue.filter(q=>active.includes(q.status))].map(x=>x.ticker))].sort();
 if(minuteTargets.length)add('minute-obligations','tracked',workflowHash([bucket,minuteTargets,input.ledgerFingerprint]),3,{critical:input.positions.length+input.livePositions.length>0,tickers:minuteTargets,maxMs:10000});
 for(let i=0;i<minuteTargets.length;i+=20){const tickers=minuteTargets.slice(i,i+20);source('minutes',tickers.join(','),bucket,6,{source:'tradingview',critical:tickers.some(t=>[...input.positions,...input.livePositions].some(p=>p.ticker===t)),tickers,maxMs:180000});}
 add('queue-resume','existing',workflowHash([input.queue.map(q=>[q.id,q.status,q.updated_at]),input.evidenceFingerprints,bucket]),4,{maxMs:15000});
 if(input.reportRefs?.length)add('document-discovery','cited-reports',workflowHash(input.reportRefs),8,{maxMs:10000,resource:'issuer-documents',reportRefs:input.reportRefs});
 add('learning-export','all',workflowHash([obligations.map(x=>x.revision),input.learningFingerprint]),5,{maxMs:30000});
 const exchangeFresh=input.exchangeWindows.some(w=>w.to>=day&&w.complete&&Object.values(w.endpoints||{}).length>0&&Object.values(w.endpoints).flatMap(e=>Object.values(e.pages||{})).length>0&&Object.values(w.endpoints).flatMap(e=>Object.values(e.pages||{})).every(page=>Date.parse(page.at)>=Date.parse(bucket)));
 if(!exchangeFresh)source('exchange',day,bucket,10,{source:'egx-exchange',critical:true,maxMs:90000,from:new Date(Date.parse(day+'T12:00Z')-86400000).toISOString().slice(0,10),to:day,coverageCutoff:bucket});
 const docs=input.documents.filter(d=>!Number.isFinite(Date.parse(d.nextAttempt))||Date.parse(d.nextAttempt)<=+now);
 if(docs.length)source('documents',day,workflowHash(docs.map(d=>[d.url,d.sha256,d.nextAttempt])),30,{source:'issuer-documents',maxMs:90000,routes:docs.map(d=>({url:d.url,tickers:d.tickers}))});
 if(workload==='baseline'){
 const sunday=new Date(day+'T12:00Z').getUTCDay()===0,catAge=+now-Date.parse(input.catalogCapturedAt);
 let catalogJob=null;if(!Number.isFinite(catAge)||catAge<0||catAge>7*86400000||sunday&&cairoDate(new Date(input.catalogCapturedAt))!==day)catalogJob=source('catalog','EGX',day,15,{source:'tradingview',maxMs:60000});
 if(input.catalogCapturedAt)add('catalog-import','EGX',input.catalogCapturedAt,15,{maxMs:15000,dependsOn:catalogJob?[catalogJob]:[]});
 if(['facts-stocks','facts-benchmarks'].some(c=>!input.receipts.some(r=>r.component===c&&r.target===day&&r.status==='completed')))source('facts','EGX',day,16,{source:'tradingview',maxMs:90000,dependsOn:catalogJob?[catalogJob]:[]});
 const missing=input.receipts.find(r=>r.component==='facts-stocks'&&r.target===day)?.payload?.missingFromResponse||[];
 if(missing.length)source('facts-repair','EGX',workflowHash([day,missing]),17,{source:'tradingview',maxMs:90000,tickers:missing,receiptTarget:day+':'+[...missing].sort().join(',')});
 }
 // Source retries do not hide overdue monitoring obligations.
 const needed=new Set(workload==='baseline'?input.stocks.map(s=>s.ticker):[...minuteTargets,...obligations.map(o=>o.ticker)]);
 for(const s of input.stocks.filter(s=>needed.has(s.ticker)&&s.readiness.due)){
 if(s.catalogStatus&&s.catalogStatus!=='success'&&new Date(day+'T12:00Z').getUTCDay()!==0&&!minuteTargets.includes(s.ticker)&&!obligations.some(o=>o.ticker===s.ticker)){sourceGaps.push({kind:'history',target:s.ticker,code:'SUNDAY_REPAIR',critical:false,overdueCoverage:true});continue;}
 const a=input.attempts.find(a=>a.ticker===s.ticker&&a.component==='history'),target=s.readiness.expectedSession||day;
 if(a?.target===target&&Date.parse(a.next_retry)>+now){sourceGaps.push({kind:'history',target:s.ticker,code:'RETRY_NOT_DUE',nextRetry:a.next_retry,critical:minuteTargets.includes(s.ticker),overdueCoverage:true});continue;}
 source('history',s.ticker,target,20,{source:'tradingview',maxMs:150000,critical:minuteTargets.includes(s.ticker)});
 }
 if(workload!=='checkpoint')add('screen','EGX',workflowHash([day,input.stocks.map(s=>s.fingerprint),input.receipts.filter(r=>r.component.startsWith('facts')).map(r=>[r.component,r.at])]),40,{maxMs:workflowLimits.screen.hardMs});
 add('preparation','retained',workflowHash([input.stocks.map(s=>s.fingerprint),input.evidenceFingerprints,input.receipts.filter(r=>r.component!=='baseline').map(r=>[r.component,r.at])]),45,{maxMs:60000});
 return {version:'incremental-workflow-1',plannedAt:now.toISOString(),workload,limits:workflowLimits[workload],jobs,obligations,minuteTargets,sourceGaps,counts:{universe:input.stocks.length,recordedDecisions:obligations.length,positions:input.positions.length+input.livePositions.length,activeHandoffs:input.queue.filter(q=>active.includes(q.status)).length},limitations:['Source watermark means response/window coverage only, not reviewed event clearance.','Minute adapter retains observations only; no automatic settlement or entries here.','Existing unstructured reviewConditions are presented for substantive review, not guessed into executable triggers.']};
}
