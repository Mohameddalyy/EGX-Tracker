import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {paperAudit} from '../../app/paper.mjs';
const folder=dirname(fileURLToPath(import.meta.url)),root=resolve(folder,'../..');
const hash=x=>createHash('sha256').update(x).digest('hex');
const read=n=>readFileSync(join(folder,n),'utf8');
const json=n=>JSON.parse(read(n).replace(/^\uFEFF/,''));
const p=json('plan.json'),s=json('decision-schema.json'),issues=[];
const check=(condition,message)=>{if(!condition)issues.push(message);};
check(p.capitalRisk.capitalEGP===100000,'Starting capital differs from user authorization');
check(p.capitalRisk.percentageCeilings===null,'FULL has an unauthorized percentage ceiling');
check(!p.activated&&!p.allowRealOrders&&p.activation.entryStartDate===null,'Activation boundary violated');
check(p.activation.explicitResumeRequired&&p.activation.phase4ImplementationRequired&&p.activation.phase5TestsRequired,'A required phase gate is missing');
check(p.variants.length===9&&new Set(p.variants.map(x=>x.id)).size===9,'Nine unique variants required');
check(p.riskGovernance.appliesToVariants.length===4,'Discretionary variant scope differs');
check(p.riskGovernance.budgets&&p.entry.expiry.includes('EXPIRED_PENDING_RECONCILIATION')&&p.exit.riskLed,'Lifecycle/budget/exit contract missing');
check(!('selectedBudgetEGP' in s.$defs.risk.properties),'Ambiguous monetary budget remains');
check(s.required.includes('controlValidation')&&s.required.includes('variantId'),'Baseline contract discriminator missing');
// This is schema lint, not a replacement for a Draft2020-12 validator.
let schemaNodes=0,refs=0;
function walk(x){
 if(!x||typeof x!=='object')return;
 schemaNodes++;
 if(x.$ref){refs++;check(x.$ref.startsWith('#/'),'Unexpected external schema reference');let y=s;for(const k of x.$ref.slice(2).split('/'))y=y?.[k.replace(/~1/g,'/').replace(/~0/g,'~')];check(!!y,'Broken schema reference '+x.$ref);}
 if(x.required){check(new Set(x.required).size===x.required.length,'Duplicate required fields');if(x.properties)for(const k of x.required)check(k in x.properties,'Required field lacks property '+k);}
 if(x.enum)check(new Set(x.enum.map(v=>JSON.stringify(v))).size===x.enum.length,'Duplicate enum');
 for(const y of Object.values(x))if(typeof y==='object')walk(y);
}walk(s);
const audit=JSON.parse(readFileSync(join(root,'verification/v5-phase1-20261023/local-evidence.json'),'utf8'));
const policyChecks=Object.entries(audit.policies).map(([file,old])=>({file,unchanged:hash(readFileSync(join(root,'research',file)))===old.sha256}));
check(policyChecks.every(x=>x.unchanged),'Frozen production policy changed');
const db=new DatabaseSync(join(root,'data/experiments/egx-paper-2026-10-11/paper.sqlite'),{readOnly:true});
const digest=hash(JSON.stringify(paperAudit(db)));db.close();
check(digest===audit.paper.ledgerDigest,'Historical paper ledger changed');
const automations=['egx-decision-scout-and-research-analyst','egx-paper-week-close','egx-paper-week-intraday','egx-paper-week-morning'].map(id=>{
 const raw=readFileSync(join('C:/Users/LENOVO/.codex/automations',id,'automation.toml'),'utf8');
 const status=raw.match(/^status\s*=\s*"([^"]+)"/m)?.[1]??'UNKNOWN';
 check(status==='PAUSED','Automation not paused: '+id);return{id,status};
});
const artifactNames=['CHECKPOINT.md','TRADING-PLAN.md','RISK-AGENT.md','TEST-PLAN.md','plan.json','decision-schema.json','validate-freeze.mjs','../v5-phase2-20261023/data-dictionary.json'];
const artifacts=artifactNames.map(path=>({path,sha256:hash(readFileSync(join(folder,path)))}));
const links=[];
for(const name of artifactNames.filter(x=>x.endsWith('.md')))for(const m of read(name).matchAll(/\]\(([^)]+)\)/g)){
 const href=m[1];if(/^https?:/.test(href)){check(!/stockanalysis|mubasher|thndr|notion/i.test(href),'Excluded evidence link '+href);continue;}
 const ok=['validation.json','freeze-manifest.json'].includes(href)||existsSync(resolve(folder,href.split('#')[0]));links.push({document:name,target:href,exists:ok});check(ok,'Missing local link '+href);
}
const manifestPath=join(folder,'freeze-manifest.json');
let manifest=existsSync(manifestPath)?json('freeze-manifest.json'):null;
if(manifest)for(const a of artifacts)check(manifest.artifacts.some(old=>old.path===a.path&&old.sha256===a.sha256),'Frozen artifact differs: '+a.path);
const scope='Phase3 specification integrity and schema lint only. No runtime engine, full JSON Schema conformance, replay, paper performance or activation claim.';
if(!issues.length&&!manifest){
 manifest={version:p.version,frozenAt:new Date().toISOString(),activated:false,scope,authorizations:{capital:'EGP 100,000',risk:'any amount of risk if justified',context:'Paper-only plan; no real trade or schedule resumption'},artifacts,testExecutionStatus:'NOT_RUN',requiresNewVersionForAmendment:true};
 writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
}
const result={checkedAt:new Date().toISOString(),passed:issues.length===0,issues,scope,schemaLint:{nodes:schemaNodes,localReferences:refs,fullDraftValidatorRun:false},policyChecks,paperLedger:{expected:audit.paper.ledgerDigest,actual:digest,unchanged:digest===audit.paper.ledgerDigest},automations,links,manifestCreatedOrVerified:!!manifest,artifacts};
writeFileSync(join(folder,'validation.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({passed:result.passed,issues,policyFilesUnchanged:policyChecks.filter(x=>x.unchanged).length,paperLedgerUnchanged:result.paperLedger.unchanged,pausedAutomations:automations.filter(x=>x.status==='PAUSED').length,artifacts:artifacts.length,schemaNodes,scope}));
if(issues.length)process.exitCode=1;
