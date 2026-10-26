import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {hash} from '../../app/v5/contract.mjs';
import {freezeCase,blindPacket} from '../../app/v5/evaluation-models.mjs';
import {immutableWrite} from '../../app/v5/evaluation-contract.mjs';
const root='verification/w7-completion-20261026',json=p=>JSON.parse(readFileSync(p,'utf8'));
const manifest=json(root+'/cases-source/case-manifest.json'),at=new Date().toISOString();
const review=json(root+'/independent-review/truth-verification-supplement.json');
if(review.status!=='VERIFIED')throw Error('Supplemental truth review required');
const instruction='Read only supplied blind packets. Give substantive sector reasoning, counterevidence, numerical interpretation, decision usefulness and uncertainty. Return original output and exact requested numerical metadata. Do not browse, read truth files, other agents outputs or edit prior answers. Record actual start/end and tool calls; synthetic scenarios are not observations. No execution authorization.';
const config={modelId:'gpt-6-astra',reasoningEffort:'high',actorId:'/root/w7_blind_analyst',configurationEvidence:'Local root turn_context; subagent inherited configuration with no override. Not provider attestation.',modelComparison:'One configured model only; no other-model performance claim'};
const tools={permitted:'Read supplied packet JSON and write own output JSON; local clock and arithmetic allowed',prohibited:'Browsing, other evidence paths, truth, reviewer output, external messages other than parent coordination'};
mkdirSync(root+'/frozen-cases',{recursive:true});mkdirSync(root+'/blind-packets',{recursive:true});
const cases=[];
for(const row of manifest.manifest){const input=json(row.path);input.frozenAt=at;const c=freezeCase(input);const p=blindPacket(c);immutableWrite(root+'/frozen-cases/'+c.id+'.json','case',c,at);writeFileSync(root+'/blind-packets/'+c.id+'.json',JSON.stringify(p,null,2)+'\n',{flag:'wx'});cases.push({id:c.id,caseHash:c.caseHash,packetHash:hash(p),fullPromptHash:hash({instruction,packet:p})});}
const run={frozenAt:at,caseCount:cases.length,cases,configuration:config,configurationHash:hash(config),instruction,promptHash:hash(instruction),promptHashMeaning:'Shared instruction template; full per-case instruction+packet separately hashed',toolPermissions:tools,toolPermissionsHash:hash(tools)};
immutableWrite(root+'/run-registration.json','model-evaluation-registration',run,at);
console.log(JSON.stringify({cases:cases.length,frozenAt:at}));
