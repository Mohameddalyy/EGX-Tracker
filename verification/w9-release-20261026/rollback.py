import json,hashlib,subprocess,zipfile,datetime,sqlite3
from pathlib import Path
root=Path.cwd().resolve(); out=root/'verification/w9-release-20261026/rollback-2';out.mkdir()
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def run(args):
 p=subprocess.run(args,cwd=root,capture_output=True,text=True,encoding='utf-8');return p
base=run(['git','--git-dir=.git','--work-tree=.','rev-parse','HEAD']).stdout.strip()
archive=out/'previous-code.zip'
r=run(['git','--git-dir=.git','--work-tree=.','archive','--format=zip','--output='+str(archive),base,'app','research','package.json','pnpm-lock.yaml']);assert r.returncode==0,r.stderr
code=out/'code';code.mkdir()
with zipfile.ZipFile(archive) as z:
 for info in z.infolist():
  target=(code/info.filename).resolve();assert target.is_relative_to(code)
  if info.is_dir():target.mkdir(parents=True,exist_ok=True)
  else:target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(z.read(info))
# Newer ledger/evidence are separate from rollback code/config. No historical event deletion.
evidence=out/'evidence';evidence.mkdir()
src=root/'verification/w9-release-20261026/session-attempt-3/session-3-crash-restart/ledger.sqlite'
ledger=evidence/'newer-ledger.sqlite'
a=sqlite3.connect(src);b=sqlite3.connect(ledger);a.backup(b);a.close();b.close()
receipt=evidence/'newer-record.json';receipt.write_text(json.dumps({'kind':'APPEND_ONLY_REVIEW_NOTE','at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'reason':'W9 code-only rollback preserves newer ledger events; no financial correction asserted'}))
def snapshot():
 c=sqlite3.connect(ledger);rows=c.execute('SELECT sequence,id,event,eventHash,stateHash FROM v5_events ORDER BY sequence').fetchall();state=c.execute('SELECT json FROM v5_state').fetchone()[0];c.close();return {'events':len(rows),'eventsHash':hashlib.sha256(json.dumps(rows).encode()).hexdigest(),'stateHash':hashlib.sha256(state.encode()).hexdigest(),'newerEvidenceHash':sha(receipt)}
before=snapshot()
r=run(['node',str(code/'app/v5-execution-agent.mjs'),'replay',str(ledger)]);(out/'old-code-replay.log').write_text(r.stdout+r.stderr);assert r.returncode==0,r.stderr
replay=json.loads(r.stdout.strip());assert replay['verified'];assert before==snapshot()
# Unavailable matching rules must reject replay, rather than reinterpret the newer events.
policy=code/'research/source-policy.json';original=policy.read_bytes();policy.write_bytes(original+b'\n')
r=run(['node',str(code/'app/v5-execution-agent.mjs'),'replay',str(ledger)]);(out/'mismatched-release-replay.log').write_text(r.stdout+r.stderr);assert r.returncode!=0;assert before==snapshot();policy.write_bytes(original)
result={'scope':'ISOLATED_CODE_CONFIG_ROLLBACK_ONLY','at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'PASS','previousCommit':base,'archiveSha256':sha(archive),'oldCodeReplaysNewerLedger':replay,'before':before,'after':snapshot(),'mismatchedReleaseRejected':True,'historicalEventsReverted':False,'newerEvidenceDeleted':False,'operationalScope':'READ_ONLY_REPLAY_ONLY. Older evaluation/client code has known gaps; do not activate it or use it to classify new policy comparisons.','repairRule':'No direct balance/history edits; supported compensating events or superseding evidence only. Unsupported accounting repairs block the affected capability.'}
(out/'result.json').write_text(json.dumps(result,indent=2));print(json.dumps({k:result[k] for k in ['status','previousCommit','before','after','mismatchedReleaseRejected']}))
