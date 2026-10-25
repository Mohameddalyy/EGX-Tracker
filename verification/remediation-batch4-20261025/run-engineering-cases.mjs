import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {openExecutionStore} from '../../app/v5/execution-store.mjs';
import {executionFixture,acceptance,minuteFixture,fullProposal,fixtureSource,acceptAt} from '../../app/v5/execution-fixtures.mjs';
import {prepareEntry,riskDossier,executionReleaseHash} from '../../app/v5/risk.mjs';
import {hash} from '../../app/v5/contract.mjs';
const runName=process.argv[2]||'local-ledgers';if(!/^[a-z0-9-]+$/.test(runName))throw Error('Simple new run folder name required');
const root=fileURLToPath(new URL('./'+runName+'/',import.meta.url));mkdirSync(root,{recursive:false});
const write=(path,value)=>writeFileSync(path,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const cases=[];
for(const kind of ['complete-lifecycle','full-liquidity-deadlock','stress-zone-no-fill']) {
  const f=executionFixture(kind==='complete-lifecycle'?'B1':'FULL',kind==='stress-zone-no-fill'?'stress':'base'),folder=join(root,kind);mkdirSync(folder);
  let db=openExecutionStore(join(folder,'engineering.sqlite'),f.config);const events=[];
  const emit=(type,data,at)=>{const event={id:kind+'-'+(events.length+1),type,data,at};const result=db.append(event,{clock:new Date(at)});events.push(event);return result;};
  emit('OPEN_DAY',{book:f.book},'2026-10-25T06:40:00Z');emit('SET_PAUSE',{paused:false,reason:'Synthetic isolated engineering run; no global activation'},'2026-10-25T06:41:00Z');
  const proposal=kind==='complete-lifecycle'?{}:fullProposal,context=prepareEntry(f.bundle,db.read(),'2026-10-25T06:50:00.000Z');write(join(folder,'risk-dossier.json'),riskDossier(context,proposal));
  const a=acceptance(f,db.read(),proposal);write(join(folder,'decision.json'),a.decision);emit('SUBMIT',a,acceptAt);
  let bar=minuteFixture(f.isin,undefined,undefined,kind==='stress-zone-no-fill'?{}:{low:68});emit('MINUTE',{bar,book:f.book},'2026-10-25T07:17:10Z');
  if(kind==='stress-zone-no-fill')emit('TICK',{},'2026-10-25T07:51:01Z');
  else {
    bar=minuteFixture(f.isin,'2026-10-27','07:01:00',{open:69,low:68,high:70,close:69,volume:kind==='full-liquidity-deadlock'?1000:1000000});
    emit('MINUTE',{bar,book:f.book,dailyVolume:{...fixtureSource,isin:f.isin,forDay:'2026-10-27',basis:'PRIOR_MEDIAN20_RAW_SHARES',value:1000000}},'2026-10-27T07:17:10Z');
    if(kind==='complete-lifecycle')emit('OPEN_DAY',{book:f.book},'2026-10-29T06:40:00Z');
  }
  const before=hash(db.read());db.close();db=openExecutionStore(join(folder,'engineering.sqlite'));const replay=db.replay(),state=db.read();if(hash(state)!==before)throw Error('Restart changed state');db.close();
  write(join(folder,'input.json'),{label:'SYNTHETIC_ENGINEERING_NOT_MARKET_PERFORMANCE',config:f.config,events});write(join(folder,'final-state.json'),state);
  cases.push({name:kind,variant:state.variantId,scenario:state.scenario,events:state.sequence,orders:Object.values(state.orders).map(o=>({status:o.status,quantity:o.quantity,reservationCents:o.reservationCents,censored:o.censored||false})),positions:Object.values(state.positions).map(p=>({quantity:p.quantity,status:p.status,entry:p.entry,initialRiskCents:p.initialRiskCents,exit:p.exit})),cashCents:state.cashCents,feesCents:state.feesCents,realizedCents:state.realizedCents,settlements:state.settlements,replay,localEvidence:folder});
}
const summary={observedAt:new Date().toISOString(),label:'SYNTHETIC_ENGINEERING_NOT_MARKET_PERFORMANCE',releaseHash:executionReleaseHash(),realOrders:false,globalSchedulesResumed:false,cases};
write(fileURLToPath(new URL('./'+runName+'-results.json',import.meta.url)),summary);console.log(JSON.stringify({cases:cases.length,replayAllPassed:cases.every(c=>c.replay.verified),releaseHash:summary.releaseHash}));
