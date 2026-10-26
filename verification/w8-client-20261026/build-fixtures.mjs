import {writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {initialState,transition} from '../../app/v5/execution.mjs';
import {executionFixture,acceptance,minuteFixture,fixtureSource,prepareAt,acceptAt} from '../../app/v5/execution-fixtures.mjs';
import {hash} from '../../app/v5/contract.mjs';
import {ledgerCards} from '../../app/v5/client-cards.mjs';
import {renderCard} from '../../app/public/client-render.js';
const root=new URL('./',import.meta.url);if(existsSync(new URL('acceptance-cases.json',root)))throw Error('Acceptance cases are frozen; create a new versioned evidence folder instead of overwriting cards already shown to the client.');let f=executionFixture(),state=initialState(f.config),events=[];
function event(type,data,at){const e={id:'w8-'+(events.length+1),type,data,at};state=transition(state,e).state;events.push(e);}
function cards(at){return ledgerCards({transitionReplay:'VERIFIED',state,events,stateHash:hash(state),chainHead:hash(events)},at);}
event('OPEN_DAY',{book:f.book},'2026-10-25T06:40:00Z');
event('ASSESS',{requestId:'blocked',bundle:{...f.bundle,preflight:{...f.bundle.preflight,criticalGaps:['Corporate-action identity unresolved']}},proposal:{}},prepareAt);
const blocked=cards(prepareAt).find(c=>c.status==='BLOCKED');
event('SET_PAUSE',{paused:false,reason:'Synthetic fixture only'},prepareAt);
event('SUBMIT',acceptance(f,state),acceptAt);
const approved=cards(acceptAt).find(c=>c.status==='APPROVED');
const waiting=cards('2026-10-25T07:05:00Z').find(c=>c.status==='WAITING_TRIGGER');
const expired=cards('2026-10-25T07:31:00Z').find(c=>c.status==='EXPIRED');
const bar=minuteFixture(f.isin);event('MINUTE',{bar,book:f.book},bar.receivedAt);
if(!Object.keys(state.positions).length)throw Error('Fixture failed to fill');
event('THESIS_BREAK',{...fixtureSource,isin:f.isin,reason:'Fictional issuer disclosure invalidates the thesis',actorId:'SYNTHETIC_ANALYST',reviewerId:'SYNTHETIC_REVIEWER',unresolvedCriticalDefect:false,availableAt:'2026-10-25T07:18:00Z'},'2026-10-25T07:18:00Z');
const pending=cards('2026-10-25T07:18:00Z').find(c=>c.status==='EXIT_PENDING');
const cases=[blocked,waiting,expired,pending,approved].map((card,i)=>{if(!card)throw Error('Missing representative state '+i);return {id:'W8-'+(i+1),card:{...card,training:true,label:'Example '+(i+1)+' · fictional EGX company'},expectedDimensions:{action:card.actionNow,timing:card.status==='EXIT_PENDING'?'Exit pending now; exposure remains until fill':card.expiresAt||'Resolve prerequisite before entry',size:card.quantity==null?'No executable quantity':card.quantity+' whole shares',invalidation:card.invalidation||'Unresolved prerequisite blocks entry',uncertainty:card.mainRisk||(card.missingEvidence||[]).map(x=>x.field).join('; ')}};});
writeFileSync(new URL('acceptance-cases.json',root),JSON.stringify(cases,null,2)+'\n');
writeFileSync(new URL('acceptance-preview.html',root),'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/client.css"><title>W8 fictional cards</title></head><body><main><h1>Five fictional comprehension scenarios</h1><p>Preview only; this is not a measured client acceptance.</p>'+cases.map(c=>renderCard(c.card)).join('')+'</main></body></html>');
writeFileSync(new URL('fixture-events.json',root),JSON.stringify({label:'SYNTHETIC_ENGINEERING_NOT_MARKET_PERFORMANCE',config:f.config,events},null,2)+'\n');
console.log(JSON.stringify(cases.map(c=>({id:c.id,status:c.card.status,quantity:c.card.quantity}))));
