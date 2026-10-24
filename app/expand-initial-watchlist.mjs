import {openDb} from './core.mjs';import {changeWatchlist} from './watchlist.mjs';
const db=openDb('data/egx.sqlite');
for(const [ticker,name] of [['TMGH','Talaat Moustafa Group'],['HRHO','EFG Holding'],['ETEL','Telecom Egypt']])if(!db.prepare('SELECT ticker FROM stocks WHERE ticker=?').get(ticker))changeWatchlist(db,{action:'add',ticker,name});
console.log(db.prepare('SELECT ticker,active FROM stocks').all());db.close();
