import {readFileSync,writeFileSync,existsSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {resolve,join} from 'node:path';
import {paperAudit} from '../../app/paper.mjs';
const root=resolve('.'),folder=join(root,'verification/v5-phase2-20261023');
const hash=x=>createHash('sha256').update(x).digest('hex');
const read=name=>readFileSync(join(folder,name),'utf8');
const audit=JSON.parse(readFileSync(join(root,'verification/v5-phase1-20261023/local-evidence.json'),'utf8'));
const dictionary=JSON.parse(read('data-dictionary.json')),scanner=JSON.parse(read('scanner-evidence.json'));
const issues=[];
const policyChecks=Object.entries(audit.policies).map(([file,old])=>({file,unchanged:hash(readFileSync(join(root,'research',file)))===old.sha256}));
if(policyChecks.some(x=>!x.unchanged))issues.push('A frozen policy differs from Phase 1 evidence');
const db=new DatabaseSync(join(root,'data/experiments/egx-paper-2026-10-11/paper.sqlite'),{readOnly:true});
const digest=hash(JSON.stringify(paperAudit(db))); db.close();
if(digest!==audit.paper.ledgerDigest)issues.push('Historical paper audit digest changed');
const missing=scanner.columns.filter(c=>!dictionary.rows.some(r=>r.id===c));
if(missing.length)issues.push('Missing scanner fields: '+missing.join(','));
const ids=dictionary.rows.map(x=>x.id);
if(new Set(ids).size!==ids.length)issues.push('Duplicate dictionary IDs');
for(const row of dictionary.rows)for(const k of ['unit','criticality','scope','fallback','formula','consequence','cadence'])if(!row[k]||!row[k].length)issues.push('Incomplete '+row.id+':'+k);
const files=['DESIGN.md','CAPABILITIES-AND-RULES.md','DATA-DICTIONARY.md','MODEL-RESEARCH.md'];
const links=[],external=new Set();
for(const name of files){
 const body=read(name);
 for(const m of body.matchAll(/\]\(([^)]+)\)/g)){
  const href=m[1];
  if(/^https?:/.test(href)){external.add(href);if(/stockanalysis|mubasher|thndr|notion/i.test(href))issues.push('Excluded evidence link '+href);}
  else {const ok=href==='validation.json'||existsSync(resolve(folder,href));links.push({document:name,target:href,exists:ok});if(!ok)issues.push('Broken local link '+href);}
 }
}
const automations=['egx-decision-scout-and-research-analyst','egx-paper-week-close','egx-paper-week-intraday','egx-paper-week-morning'].map(id=>{
 const raw=readFileSync(join('C:/Users/LENOVO/.codex/automations',id,'automation.toml'),'utf8');
 const status=raw.match(/^status\s*=\s*"([^"]+)"/m)?.[1]??'UNKNOWN';
 if(status!=='PAUSED')issues.push('Automation not paused: '+id);
 return {id,status};
});
const result={checkedAt:new Date().toISOString(),scope:'Phase 2 document/evidence integrity only; no production behavior or profitability validation',passed:issues.length===0,issues,scannerFields:scanner.columns.length,dictionaryFields:ids.length,missingScannerFields:missing,policyChecks,paperLedger:{expected:audit.paper.ledgerDigest,actual:digest,unchanged:digest===audit.paper.ledgerDigest},automations,localLinks:links,externalLinks:[...external],artifacts:files.map(name=>({name,sha256:hash(read(name)),words:read(name).split(/\s+/).length})),phaseBoundary:'Design only. No new production policy, strategy, approval, order or experiment.',limitations:['External links are source references, not asserted universally reachable endpoints. Failed routes are documented.','Official current rule and account-specific execution gaps remain open.','This validation does not claim a v5 replay/backtest or live pilot has run.']};
writeFileSync(join(folder,'validation.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({passed:result.passed,issues,scannerFields:result.scannerFields,dictionaryFields:ids.length,policyFilesUnchanged:policyChecks.filter(x=>x.unchanged).length,paperLedgerUnchanged:result.paperLedger.unchanged,pausedAutomations:automations.filter(x=>x.status==='PAUSED').length,checkedLocalLinks:links.length,externalSources:external.size}));
if(issues.length)process.exitCode=1;

