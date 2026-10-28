import json,hashlib,zipfile,sys
from pathlib import Path
base=Path(__file__).resolve().parent;m=json.loads((base/'source-manifest.json').read_text());z=base/m['archive']['path'];sha=lambda b:hashlib.sha256(b).hexdigest()
assert sha(z.read_bytes())==m['archive']['sha256'],'Archive hash mismatch'
assert len(sys.argv)==2,'Supply a new reconstruction directory'
out=Path(sys.argv[1]).resolve();out.mkdir(parents=True,exist_ok=False)
with zipfile.ZipFile(z) as f:
 for row in m['files']:
  p=(out/row['path']).resolve();assert p.is_relative_to(out),'Unsafe archive path'
  b=f.read(row['path']);assert sha(b)==row['sha256'],'File hash mismatch'
  p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
for name in m.get('emptyDirectories',[]):
 p=(out/name).resolve();assert p.is_relative_to(out);p.mkdir(parents=True,exist_ok=True)
print(json.dumps({'status':'PASS','files':len(m['files']),'directory':str(out),'scope':'SAME_HOST; installed dependencies and original approved amendment path required'}))
