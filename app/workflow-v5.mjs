// Read-only obligation bridge. Registry enrollment is explicit; no trading authorization.
import {basketObligations} from './v5/basket-registry.mjs';
import {registry,registeredLedger} from './v5/client-service.mjs';
import {readEvaluationLedger} from './v5/evaluation-ledger.mjs';
import {workflowHash} from './workflow-store.mjs';
export function v5Obligations(root,stocks=[]) {
 const positions=[],intents=[],errors=[],ledgers=[],identity=new Map(),conflicts=new Set();
 for(const s of stocks){let m;try{m=typeof s.metadata==='string'?JSON.parse(s.metadata):s.metadata;}catch{continue;}
  const rawIds=[m?.symbolInfo?.isin,m?.symbolExt?.isin].filter(x=>x!==undefined&&x!==null&&x!=='');const ids=new Set(rawIds.filter(x=>typeof x==='string'&&/^EG[A-Z0-9]{10}$/.test(x)));if(ids.size>1||rawIds.some(x=>typeof x!=='string'||!/^EG[A-Z0-9]{10}$/.test(x)))for(const id of ids)conflicts.add(id);
  for(const isin of ids){const names=identity.get(isin)||new Set();names.add(s.ticker);identity.set(isin,names);}}
 let entries;try{entries=registry(root).ledgers;if(!Array.isArray(entries)||new Set(entries.map(x=>x.id)).size!==entries.length)throw Error('Invalid or duplicate ledger registry');}catch(e){errors.push({code:'V5_REGISTRY_UNREADABLE',critical:true,message:e.message});entries=[];}
 for(const entry of entries)try{
  const a=readEvaluationLedger(registeredLedger(root,entry.id).path);
  if(a.transitionReplay!=='VERIFIED')throw Error('Matching execution release semantic replay required');
  ledgers.push({id:entry.id,stateHash:a.stateHash,paused:a.state.paused});
  const mapped=p=>{const isin=p.isin||p.context?.isin;const names=[...(identity.get(isin)||[])],resolved=names.length===1&&!conflicts.has(isin);if(!resolved)errors.push({code:'V5_IDENTITY_UNRESOLVED',critical:true,ledgerId:entry.id,isin,possibleTickers:names});return {id:p.id,isin,status:p.status,quantity:p.quantity,exit:p.exit?{reason:p.exit.reason,committedAt:p.exit.committedAt}:null,ledgerId:entry.id,account:'v5-paper',ticker:resolved?names[0]:null,identityBasis:'Retained ISIN association for monitoring only; not listing/action clearance'};};
  for(const p of Object.values(a.state.positions))if(p.status!=='CLOSED')positions.push(mapped(p));
  // Even cancelled/expired unresolved orders need delayed-fill reconciliation.
  for(const o of Object.values(a.state.orders))if(!o.resolved&&!o.fill)intents.push({...mapped(o),reconciliationRequired:true,plan:{side:'BUY',expiresAt:o.context?.reconciliationDeadline}});
 }catch(e){errors.push({code:'V5_LEDGER_UNREADABLE',critical:true,ledgerId:entry.id,message:e.message});}
 const basket=basketObligations(root,stocks);positions.push(...basket.positions);intents.push(...basket.intents);errors.push(...basket.errors);ledgers.push(...basket.ledgers);
 return {positions,intents,errors,ledgers,status:errors.length?'INCOMPLETE_NOT_ZERO_HOLDINGS':'VERIFIED',fingerprint:workflowHash([positions,intents,ledgers,errors]),entryAuthorization:false};
}
