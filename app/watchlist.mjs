export function initWatchlist(db){const fields=new Set(db.prepare('PRAGMA table_info(stocks)').all().map(c=>c.name));for(const [name,ddl]of [['active','INTEGER NOT NULL DEFAULT 1'],['watched','INTEGER NOT NULL DEFAULT 1'],['currency',"TEXT NOT NULL DEFAULT 'EGP'"]])if(!fields.has(name))db.exec('ALTER TABLE stocks ADD COLUMN '+name+' '+ddl);db.exec('PRAGMA busy_timeout=5000');}
export function changeWatchlist(db,p){
 const ticker=typeof p.ticker==='string'?p.ticker.trim().toUpperCase():'';
 if(!/^[A-Z][A-Z0-9-]{1,23}$/.test(ticker))throw Error('Enter an EGX ticker without an exchange prefix');
 if(!['add','pause','resume'].includes(p.action))throw Error('Invalid watchlist action');
 const existing=db.prepare('SELECT * FROM stocks WHERE ticker=?').get(ticker);
 if(p.action==='add'&&existing?.watched)throw Error('Ticker already exists; use Resume if paused');
 if(p.action!=='add'&&!existing)throw Error('Ticker not found');
 const name=typeof p.name==='string'?p.name.trim():ticker;
 if(p.action==='add'&&(!name||name.length>120))throw Error('Company label must contain 1–120 characters');
 db.exec('BEGIN');try{
  if(p.action==='add'&&!existing)db.prepare('INSERT INTO stocks(ticker,name) VALUES(?,?)').run(ticker,name);
  else db.prepare('UPDATE stocks SET active=?,watched=1 WHERE ticker=?').run(p.action==='pause'?0:1,ticker);
  db.prepare('INSERT INTO events(at,ticker,kind,detail) VALUES(?,?,?,?)').run(new Date().toISOString(),ticker,'Watchlist '+p.action,JSON.stringify({horizon:p.action==='pause'?'Paused; history retained':'Awaiting refresh'}));
  db.exec('COMMIT');return {ticker};
 }catch(e){db.exec('ROLLBACK');throw e;}
}
