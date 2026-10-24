// Synthetic test evidence only. Never import into a market/research database.
import {entryCoreFields,evidenceContractVersion} from './evidence-policy.mjs';
export function evidenceFixture(at,sourceId='issuer'){
 const stamp=new Date(at).toISOString();
 const fact={status:'verified',asOf:stamp.slice(0,10),checkedAt:stamp,coverageThrough:stamp,sourceIds:[sourceId],note:'Synthetic isolated fixture, not market evidence'};
 return {version:evidenceContractVersion,analyst:'fixture-analyst',sector:'Industrials',claims:['technical'],reliedUponFields:[],cutoffAt:stamp,fields:Object.fromEntries(entryCoreFields.map(k=>[k,{...fact}])),gaps:[]};
}
