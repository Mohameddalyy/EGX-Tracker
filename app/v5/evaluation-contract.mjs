import {readFileSync,writeFileSync} from 'node:fs';
import {hash,required,nonempty,timestamp,variants,planHash,decisionSchemaHash} from './contract.mjs';
import {executionReleaseHash} from './risk.mjs';

export const armIds=Object.keys(variants).flatMap(v=>['base','stress'].map(s=>v+':'+s));
export const rubricDimensions=['sectorReasoning','counterevidence','numericalInterpretation','decisionUsefulness','uncertainty'];
export const caseCategories=['banks','nonfinancials','property','incompleteFinancials','conflictingDocuments','delayedEvents','corporateActions','thinLiquidity','riskExceptions','noTrade'];
export const sha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export function readComparisonAmendment(path) {
  const a=readArtifact(path,'comparison-amendment'),p=a.payload;
  required(p.status==='APPROVED'&&p.authorizedBy==='USER'&&timestamp(p.approvedAt)&&sha(p.documentHash)&&nonempty(p.documentPath),'Explicit versioned comparison approval required');
  required(hash(readFileSync(p.documentPath))===p.documentHash,'Approved amendment document changed');
  required(p.endpointSessions===126&&p.minimumAppropriateClosedObservations===100&&p.minimumAdditionalNetWealthCents===100000&&p.familySize===16&&p.automaticPromotion===false&&p.entryAuthorization===false,'Approved comparison parameters mismatch');
  return a;
}
export function immutableWrite(path,kind,payload,createdAt=new Date().toISOString()) {
  required(timestamp(createdAt)&&nonempty(kind),'Artifact identity required');
  const content={version:1,kind,createdAt,payload},artifact={...content,contentHash:hash(content)};
  writeFileSync(path,JSON.stringify(artifact,null,2)+'\n',{flag:'wx'});return artifact;
}
export function readArtifact(path,kind) {
  const artifact=JSON.parse(readFileSync(path,'utf8')),{contentHash,...content}=artifact;
  required(contentHash===hash(content)&&artifact.kind===kind,'Artifact kind/hash mismatch');return artifact;
}
export function evaluationReleaseHash() {
  return hash({execution:executionReleaseHash(),files:['evaluation-contract.mjs','evaluation-ledger.mjs','evaluation-cohorts.mjs','evaluation-statistics.mjs','evaluation-models.mjs','evaluation-matrix.mjs','evaluation-provenance.mjs','fixed-exit-attribution.mjs','../v5-evaluation-agent.mjs'].map(file=>[file,hash(readFileSync(new URL(file,import.meta.url),'utf8').replace(/\r\n/g,'\n'))])});
}
export function registerTrial(input,at=new Date().toISOString()) {
  required(timestamp(at)&&timestamp(input.registeredAt)&&Date.parse(input.registeredAt)<=Date.parse(at),'Actual registration time required');
  required(['SYNTHETIC_ENGINEERING','HISTORICAL_FEASIBILITY','PROSPECTIVE_DRAFT'].includes(input.scope),'No activation/prospective-performance registration path exists');
  required(nonempty(input.id)&&sha(input.codeDigest)&&nonempty(input.codeRevision)&&sha(input.admissionManifestHash)&&sha(input.dataManifestHash),'Code, data and universe admission bindings required');
  required(input.executionReleaseHash===executionReleaseHash(),'Execution release mismatch');
  required(Array.isArray(input.arms)&&input.arms.length===18&&new Set(input.arms.map(a=>a.id)).size===18&&input.arms.every(a=>armIds.includes(a.id)),'All 18 unique arms must remain visible');
  for(const a of input.arms) {
    required(['AVAILABLE','UNAVAILABLE'].includes(a.status)&&nonempty(a.reason),'Arm availability and reason required');
    const v=variants[a.id.split(':')[0]];
    if(a.status==='AVAILABLE') {
      required(sha(a.inputManifestHash),'Available arm needs independent admitted input binding');
      if(v.research)required(a.actors?.length>=2&&a.actors.every(x=>nonempty(x.actorId)&&nonempty(x.modelId)&&sha(x.promptHash)&&sha(x.configurationHash)&&sha(x.toolPermissionsHash))&&new Set(a.actors.map(x=>x.actorId)).size===a.actors.length,'Actual separate research/reviewer identities and configurations required');
    }
  }
  required(Array.isArray(input.priorTrials)&&input.priorTrials.every(x=>sha(x.artifactHash)&&nonempty(x.disposition)),'Retain attempted/failed versions in priorTrials');
  const amendment=input.amendmentPath?readComparisonAmendment(input.amendmentPath):null;
  if(amendment)required(Date.parse(amendment.payload.approvedAt)<=Date.parse(input.registeredAt),'Amendment must precede trial registration');
  const bindings={planHash,decisionSchemaHash,executionReleaseHash:executionReleaseHash(),evaluationReleaseHash:evaluationReleaseHash(),comparisonAmendmentHash:amendment?.contentHash??null,testPlanHash:hash(readFileSync(new URL('../../verification/v5-phase3-20261023/TEST-PLAN.md',import.meta.url))),dictionaryHash:hash(readFileSync(new URL('../contracts/evidence-dictionary.json',import.meta.url))),dependencyLockHash:hash(readFileSync(new URL('../../pnpm-lock.yaml',import.meta.url))),node:process.version};
  return {...structuredClone(input),bindings,seed:20261023,capitalCentsPerArm:10000000,statisticalProtocol:{blockLength:20,replicates:10000,confidence:.95,familyAlpha:.05,comparisons:16,minimumProspectiveSessions:126,minimumAppropriateClosedObservations:100,...(amendment?{endpointSessions:126,minimumAdditionalNetWealthCents:100000,stoppingRule:'Fixed endpoint; insufficient or interrupted evidence INCONCLUSIVE, no selective extension',riskAcceptance:'Separate human judgment; no added FULL cap or automatic promotion',amendment:amendment.contentHash}:{})},activation:'NOT_AUTHORIZED',analyticalInference:'BLOCKED_UNTIL_REGISTERED_PROSPECTIVE_EVIDENCE',unresolvedProtocol:amendment?['Future entry cohorts need separate authorization','Attainable basket observations require subsequent integrated release; absent evidence stays unavailable','Adequate prospective evidence and independent risk/precision review remain required']:['Meaningful net benefit and acceptable risk outcomes require pre-outcome client approval','Stopping rule and future cohort authorization remain unset','Attainable buy-and-hold basket requires a versioned amendment'],priorKnowledge:input.scope==='HISTORICAL_FEASIBILITY'?'Previously inspected history cannot be untouched out-of-sample evidence':'No economic claim from this scope'};
}
