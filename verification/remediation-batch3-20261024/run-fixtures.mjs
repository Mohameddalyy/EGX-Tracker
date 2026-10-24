// Engineering examples only. No production stock, trade, market capture or LLM run.
import {writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {hash,engineVersion,planHash} from '../../app/v5/contract.mjs';
import {evaluateUniverse} from '../../app/v5/signals.mjs';
import {buildResearchPacket,validateResearchDisposition} from '../../app/v5/research.mjs';
import {signalFixture,researchEvidence,reviewFixture} from '../../app/v5/fixtures.mjs';
const folder=fileURLToPath(new URL('./fixtures-final/',import.meta.url));mkdirSync(folder,{recursive:true});
const write=(name,value)=>writeFileSync(join(folder,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const input=signalFixture(),evaluation=evaluateUniverse(input),evidence=researchEvidence(input);
write('signal-input.json',input);write('evaluation.json',evaluation);write('research-evidence.json',evidence);
const packet=buildResearchPacket(evaluation,input.universe[0].instrument.isin,'FULL',evidence),review=reviewFixture(packet),disposition=validateResearchDisposition(packet,review,new Date('2026-10-22T14:23:00Z'));
write('packet.json',packet);write('review.json',review);write('disposition.json',disposition);
const noCalendar=structuredClone(input);noCalendar.sessions=[];write('missing-calendar.json',evaluateUniverse(noCalendar));
const summary={observedAt:new Date().toISOString(),version:engineVersion,policyHash:planHash,scope:'Synthetic engineering fixtures, not observed market signals, genuine analyst outputs, performance or an independent-model evaluation.',inputHash:hash(input),names:input.universe.length,variants:evaluation.variantCount,waterfallRows:evaluation.rows.length,byStatus:Object.fromEntries([...new Set(evaluation.rows.map(r=>r.status))].map(status=>[status,evaluation.rows.filter(r=>r.status===status).length])),researchDisposition:disposition.status,importantGaps:disposition.importantGaps,noOrderAuthorization:evaluation.entryAuthorization===false&&disposition.entryAuthorization===false};
writeFileSync(new URL('./fixture-summary-final.json',import.meta.url),JSON.stringify(summary,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(summary));
