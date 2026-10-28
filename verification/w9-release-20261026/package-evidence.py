from pathlib import Path
import zipfile,json,hashlib
r=Path.cwd();e=r/'verification/w9-release-20261026';files=[]
for name in ['full-suite-3','reconstructed-suite','reconstructed-suite-2','reconstructed-suite-3','reconstructed-suite-4','independent-review']:
 files += [p for p in (e/name).glob('*') if p.is_file()]
files += [p for p in (e/'final-sessions-1').rglob('*') if p.is_file() and not any(x.endswith('-dispatcher') for x in p.parts)]
fault=e/'final-sessions-1/sessions/session-2-outage-blocked-exit-dispatcher/w9-faults'
files += [p for p in fault.rglob('*') if p.is_file() and p.suffix in ['.json','.log','.txt']]
files += [p for p in (e/'rollback-2').glob('*') if p.is_file() and p.suffix in ['.json','.txt','.log']]
files=sorted(set(files)); rows=[{'path':p.relative_to(r).as_posix(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in files]
with zipfile.ZipFile(e/'verification-evidence.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in files:z.write(p,p.relative_to(r).as_posix())
(e/'evidence-manifest.json').write_text(json.dumps({'scope':'Selected canonical evidence; large restored production copies excluded','archiveSha256':hashlib.sha256((e/'verification-evidence.zip').read_bytes()).hexdigest(),'files':rows},indent=2)+'\n')
print(json.dumps({'files':len(rows),'zipBytes':(e/'verification-evidence.zip').stat().st_size}))
