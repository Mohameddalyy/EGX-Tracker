"""Read-only SQLite online backups plus a verified isolated source/data restore."""
from pathlib import Path
import hashlib, json, sqlite3, zipfile, datetime, time

root = Path(__file__).resolve().parents[2]
out = root / 'data/backups/remediation-batch1-20261024-verified'
out.mkdir(parents=True, exist_ok=False)
staging = out / 'database-snapshots'
staging.mkdir()
sources = []
for folder in ['app', 'agent', 'research', 'experimental', 'cloud', 'integrations/tradingview-mcp', 'verification/v5-phase2-20261023', 'verification/v5-phase3-20261023']:
    sources.extend(p for p in (root / folder).rglob('*') if p.is_file() and '.git' not in p.parts and not p.name.startswith('.env') and p.suffix not in ['.log', '.sqlite', '.db'])
sources.extend(root / n for n in ['package.json', '.gitignore', 'README.md', 'DATA-SOURCE-POLICY.md', 'start-tracker.ps1', 'install-tracker-startup.ps1'])
data = [p for p in (root/'data').rglob('*') if p.is_file() and 'backups' not in p.relative_to(root/'data').parts and not p.name.endswith(('-wal','-shm'))]
entries, databases = [], []
sha = lambda b: hashlib.sha256(b).hexdigest()
with zipfile.ZipFile(out/'baseline.zip', 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=1) as archive:
    for p in sources + data:
        rel = p.relative_to(root).as_posix()
        if p.suffix in ['.sqlite', '.db']:
            dest = staging / p.relative_to(root)
            dest.parent.mkdir(parents=True, exist_ok=True)
            with sqlite3.connect(p.as_uri()+'?mode=ro', uri=True) as original, sqlite3.connect(dest) as backup:
                started=time.monotonic()
                def progress(status,remaining,total):
                    if time.monotonic()-started>30: raise TimeoutError('SQLite backup deadline: '+rel)
                original.backup(backup, pages=512, progress=progress, sleep=.1)
                integrity = backup.execute('PRAGMA integrity_check').fetchone()[0]
                assert integrity == 'ok', (rel, integrity)
                tables = [x[0] for x in backup.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
                counts = {t: backup.execute('SELECT COUNT(*) FROM "'+t.replace('"','""')+'"').fetchone()[0] for t in tables}
            databases.append({'path':rel, 'integrity':integrity, 'counts':counts})
            print('Database snapshot: '+rel,flush=True)
            body = dest.read_bytes()
        else:
            body = p.read_bytes()
        archive.writestr(rel, body)
        entries.append({'path':rel, 'bytes':len(body), 'sha256':sha(body), 'kind':'data' if rel.startswith('data/') else 'source'})
restore = Path('\\\\?\\'+str((out / 'restore').resolve()))
with zipfile.ZipFile(out/'baseline.zip') as archive:
    archive.extractall(restore)
for e in entries:
    assert sha((restore/e['path']).read_bytes()) == e['sha256'], e['path']
for d in databases:
    with sqlite3.connect((restore/d['path']).as_uri()+'?mode=ro', uri=True) as db:
        assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
        for table, count in d['counts'].items():
            assert db.execute('SELECT COUNT(*) FROM "'+table.replace('"','""')+'"').fetchone()[0] == count
manifest = {'at':datetime.datetime.now(datetime.timezone.utc).isoformat(), 'archive':str(out/'baseline.zip'), 'restore':str(restore), 'entries':entries, 'databases':databases, 'restoredAllHashes':True, 'scope':'Each database is a SQLite online consistent snapshot; not an atomic cross-database snapshot. No original database opened for writing.'}
(out/'manifest.json').write_text(json.dumps(manifest, indent=2),encoding='utf-8')
(Path(__file__).parent/'baseline-result.json').write_text(json.dumps({k:v for k,v in manifest.items() if k!='entries'}|{'files':len(entries),'bytes':sum(e['bytes'] for e in entries)},indent=2),encoding='utf-8')
print(json.dumps({'files':len(entries),'databaseCount':len(databases),'restoredAllHashes':True,'manifest':str(out/'manifest.json')}))
