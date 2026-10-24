from pathlib import Path
import hashlib,json,zipfile,datetime
root=Path(__file__).resolve().parents[2]
out=root/'data/backups/remediation-batch1-20261024-verified'
files=[]
for name in ['cloud','integrations/tradingview-mcp']:
    files.extend(p for p in (root/name).rglob('*') if p.is_file() and '.git' not in p.parts and not p.name.startswith('.env') and p.suffix not in ['.log','.sqlite','.db'])
entries=[]
if not (out/'dependencies.zip').exists():
    with zipfile.ZipFile(out/'dependencies.zip','x',compression=zipfile.ZIP_DEFLATED,compresslevel=1) as archive:
        for p in files:
            archive.writestr(p.relative_to(root).as_posix(),p.read_bytes())
# Windows extended-length paths retain the complete installed dependency tree.
restore=Path('\\\\?\\'+str((out/'restore').resolve()))
with zipfile.ZipFile(out/'dependencies.zip') as archive:
    archive.extractall(restore)
    for info in archive.infolist():
        b=archive.read(info);entries.append({'path':info.filename,'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b)})
for e in entries: assert hashlib.sha256((restore/e['path']).read_bytes()).hexdigest()==e['sha256']
result={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'entries':entries,'allRestoredHashesMatch':True,'scope':'Unchanged relay and connector dependency supplement; credentials and nested Git metadata excluded. Includes installed connector dependencies. No connector started.'}
(out/'dependencies-manifest.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps({'files':len(entries),'bytes':sum(x['bytes'] for x in entries),'allRestoredHashesMatch':True}))
