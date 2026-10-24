// Read-only local inventory: counts are storage coverage, not verified-current data.
import {DatabaseSync} from 'node:sqlite';
import {writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=new URL('../../',import.meta.url);
const db=new DatabaseSync(fileURLToPath(new URL('data/egx.sqlite',root)),{readOnly:true});
try{
 const report={capturedAt:new Date().toISOString(),scope:'Stored-data inventory only; no refresh, market certification or trade approval.',catalog:db.prepare('SELECT status,COUNT(*) count FROM market_catalog GROUP BY status').all(),storedHistory:db.prepare('SELECT COUNT(DISTINCT ticker) instruments,COUNT(*) bars,MIN(day) firstSession,MAX(day) latestStoredSession FROM bars').get(),historyDistribution:db.prepare('SELECT lastDay,COUNT(*) instruments FROM (SELECT ticker,MAX(day) lastDay FROM bars GROUP BY ticker) GROUP BY lastDay ORDER BY lastDay DESC').all(),facts:db.prepare('SELECT COUNT(*) instruments,MIN(captured_at) oldestCapture,MAX(captured_at) newestCapture FROM market_facts').get(),decisionCounts:db.prepare('SELECT action,COUNT(*) decisions,COUNT(DISTINCT ticker) instruments FROM agent_decisions GROUP BY action').all(),queue:db.prepare('SELECT status,COUNT(*) count FROM research_queue GROUP BY status').all(),limits:['Stored bar count does not prove expected-session freshness, confirmed finality, adjustment integrity or suitable lookback.','Facts presence does not prove field completeness or financial-period relevance.','Every recorded decision, including superseded decisions, remains a monitoring obligation.','No external bootstrap was performed; phase4 must wire collectors and validate input adapters.']};
 const folder=new URL('verification/v5-data-readiness-20261023/',root);mkdirSync(folder,{recursive:true});writeFileSync(new URL('inventory.json',folder),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}finally{db.close();}
