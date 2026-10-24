import {readinessOverview} from './preparation-status.mjs';
import {documentReviews} from './document-verification.mjs';
import {exchangeEvidence} from './exchange-evidence.mjs';
import {analysisDossier} from './analysis.mjs';
import {researchCard} from './research-card.mjs';
import {snapshot} from './core.mjs';
import {journalEntries,initJournal} from './journal.mjs';
import {position,entryFills,initPositions} from './positions.mjs';
import {initMarket,marketState} from './market.mjs';
import {initFacts,factsFor} from './market-facts.mjs';
export function researchContext(db,profile,tickers=null,{analysisDb=null,root=null}={}){
 initJournal(db);initPositions(db);initMarket(db);initFacts(db);
 const entries=journalEntries(db),watchlist=db.prepare('SELECT ticker FROM stocks WHERE watched=1 AND active=1 ORDER BY ticker').all().map(s=>s.ticker);
 const requested=tickers??watchlist;
 if(!Array.isArray(requested)||requested.some(t=>!db.prepare('SELECT ticker FROM stocks WHERE ticker=?').get(t)))throw Error('Unknown research ticker');
 // Include journal evidence even for paused stocks so holdings cannot silently disappear.
 const stocks=snapshot(db,[...new Set([...requested,...entries.map(e=>e.ticker)])]);for(const s of stocks.stocks){s.fundamentals=factsFor(db,s.ticker);s.researchCard=researchCard(db,s.ticker);}
 const hasEvents=db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='intraday_events'").get();
 const intradayEvents=hasEvents?stocks.stocks.flatMap(s=>db.prepare('SELECT * FROM intraday_events WHERE ticker=? ORDER BY received_at DESC,rowid DESC LIMIT 100').all(s.ticker).map(e=>({...e,payload:JSON.parse(e.payload)}))):[];
 const analytical=analysisDb&&root?stocks.stocks.map(s=>{try{return analysisDossier(db,analysisDb,root,s.ticker);}catch(e){return {ticker:s.ticker,status:'Analytical dossier unavailable',reason:e.message};}}):[];
 const exchange=root?exchangeEvidence(root,stocks.stocks.map(s=>s.ticker),db.prepare('SELECT ticker,metadata FROM stocks').all()):null;
 return {exchange,reviewedDocuments:root?documentReviews(root,stocks.stocks.map(s=>s.ticker)):[],preparation:readinessOverview(db,{root}),analytical,analyticalNote:'Source-linked statements, scenarios, catalyst theses, sector context and relevant cases. Challenger plans are research only; existing approval guards still apply.',profile,finalityPolicy:stocks.finalityPolicy,scope:tickers?'selected':'active-watchlist',watchlist,market:marketState(db),stocks:stocks.stocks,recentRuns:stocks.runs,intradayEvents,intradayNote:'Unconfirmed event observations, not daily bars or fills. Inspect delayed/late delivery and current rule status. At most 100 recent events per stock are frozen here; query the persisted candidate events for the full history and events arriving after this snapshot.',positions:entries.map(e=>{const fills=entryFills(db,e.id);return {id:e.id,ticker:e.ticker,plan:e.plan,reviews:e.reviews,fills,position:position(fills,e.plan,stocks.stocks.find(s=>s.ticker===e.ticker)?.latest)};})};
}



