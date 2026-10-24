import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export const hash=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
export const required=(condition,message)=>{if(!condition)throw Error(message);};
export const finite=x=>typeof x==='number'&&Number.isFinite(x);
export const timestamp=x=>typeof x==='string'&&/T.*(?:Z|[+-]\d\d:\d\d)$/.test(x)&&Number.isFinite(Date.parse(x));
export const nonempty=x=>typeof x==='string'&&!!x.trim();
export const planHash='b214cb37674a993dae8023f95945b051f2133df46ab16ad61b536575aed3547e';
export const decisionSchemaHash='8678334e55aa7877a6f7c2ffc6a36170729386704681e194d001d8429cc61535';
const bytes=readFileSync(new URL('./plan.json',import.meta.url));
required(hash(bytes)===planHash,'v5 frozen plan hash mismatch: explicit version amendment required');
required(hash(readFileSync(new URL('./decision-schema.json',import.meta.url)))===decisionSchemaHash,'Frozen v5 decision schema hash mismatch');
function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
export const plan=freeze(JSON.parse(bytes));
export const engineVersion='v5-signal-research-1.0';
export const variants=Object.freeze(Object.fromEntries(plan.variants.map(({id})=>[id,Object.freeze({
 id,cashOnly:id==='B0',volume:id==='B1'||id==='B0'?'none':['B2','B3'].includes(id)?'fixed':'tier',
 research:!['B0','B1','B2'].includes(id),peer:!['B0','B1','B2','FULL-NO-PEER'].includes(id),
 macro:!['B0','B1','B2','FULL-NO-MACRO'].includes(id),sector:!['B0','B1','B2','FULL-NO-SECTOR'].includes(id),
 discretionary:plan.riskGovernance.appliesToVariants.includes(id)
})])));
export function variant(id){required(!!variants[id],'Unknown frozen variant');return variants[id];}
