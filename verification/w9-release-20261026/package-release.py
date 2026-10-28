import json,hashlib,zipfile,datetime,sqlite3,tempfile
from pathlib import Path
r=Path.cwd(); e=r/'verification/w9-release-20261026'
def sha(b): return hashlib.sha256(b).hexdigest()
def save(p,x): p.write_text(json.dumps(x,indent=2)+'\n',encoding='utf8')
files=[]
for d in ['app','agent','research','integrations','cloud']:
 files += [p for p in (r/d).rglob('*') if p.is_file() and not any(x in p.parts for x in ['node_modules','__pycache__']) and p.suffix not in ['.sqlite','.db','.log'] and not p.name.startswith('.env')]
files += [r/'package.json',r/'pnpm-lock.yaml',r/'.gitattributes']
files += list((r/'verification/v5-phase3-20261023').glob('*'))
for p in ['verification/w8-client-20261026/acceptance-cases.json','verification/w7-completion-20261026/approved-comparison-amendment.json','verification/w7-completion-20261026/COMPARISON-AMENDMENT-PROPOSAL.md','verification/w7-completion-20261026/frozen-cases/W7-11.json','verification/w7-completion-20261026/runs/W7-11.json']:
 files.append(r/p)
files.append(r/'verification/w7-completion-20261026/independent-review/excerpt-reviews/W7-11.json')
files=sorted(set(p for p in files if p.is_file()))
rows=[{'path':p.relative_to(r).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in files]
with tempfile.TemporaryDirectory() as tmp:
 db=sqlite3.connect(str(Path(tmp)/'empty.sqlite'));db.execute('PRAGMA user_version=0');db.close();fixture=(Path(tmp)/'empty.sqlite').read_bytes()
rows.append({'path':'data/egx.sqlite','bytes':len(fixture),'sha256':sha(fixture),'purpose':'EMPTY SYNTHETIC path-containment test fixture; no production data'})
z=e/'source-release.zip'
with zipfile.ZipFile(z,'w',zipfile.ZIP_DEFLATED) as f:
 for p in files: f.write(p,p.relative_to(r).as_posix())
 f.writestr('data/',b'');f.writestr('data/research/',b'');f.writestr('data/research/evidence/',b'');f.writestr('data/egx.sqlite',fixture)
manifest={'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'OFFLINE_ENGINEERING_ONLY','activation':False,'hashConvention':'EXACT_BYTES_SHA256','sourceTreeDigest':sha(json.dumps(rows,sort_keys=True,separators=(',',':')).encode()),'archive':{'path':z.name,'sha256':sha(z.read_bytes()),'bytes':z.stat().st_size},'emptyDirectories':['data','data/research','data/research/evidence'],'node':'v24.22.1','files':rows,'dependencies':'Installed node_modules is not vendored; pinned pnpm-lock.yaml included. Reconstruction validation is same-host with existing dependencies.','portabilityLimit':'Approved comparison amendment retains original absolute documentPath; exact approved document is bundled but same-host original path remains required. No claim of hermetic cross-host reconstruction.','exclusions':['Production databases and source captures','Credentials/environment files','node_modules','Large isolated restore and dispatcher copies']}
save(e/'source-manifest.json',manifest)
out=e/'reconstructed-source-4';out.mkdir(exist_ok=False)
with zipfile.ZipFile(z) as f:
 for row in rows:
  name=row['path']; target=out/name
  assert target.resolve().is_relative_to(out.resolve())
  target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(f.read(name))
(out/'data/research/evidence').mkdir(parents=True,exist_ok=True)
checks=[sha((out/x['path']).read_bytes())==x['sha256'] for x in rows]
save(e/'reconstruction-files.json',{'status':'PASS' if all(checks) else 'FAIL','fileCount':len(checks),'allExactBytes':all(checks),'archiveSha256':manifest['archive']['sha256'],'sourceTreeDigest':manifest['sourceTreeDigest'],'scope':'SAME_HOST_WITH_INSTALLED_DEPENDENCIES'})
print(json.dumps({'files':len(rows),'archiveBytes':z.stat().st_size,'reconstructed':str(out)}))
