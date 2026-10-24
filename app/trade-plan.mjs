import {readFileSync} from 'node:fs';import {buildTradePlan} from './trade-plans.mjs';
const [contextId,ticker,method,zoneIndex,expiresAt,cost,costAssumption]=process.argv.slice(2);
if(!/^context-[a-zA-Z0-9-]+$/.test(contextId||''))throw Error('Usage: trade-plan.mjs CONTEXT_ID TICKER pullback|breakout ZONE_INDEX EXPIRY_ISO COST_FRACTION "Cost assumption"');
const context=JSON.parse(readFileSync(new URL('../data/research/'+contextId+'.json',import.meta.url),'utf8')),stock=context.stocks.find(s=>s.ticker===ticker);if(!stock)throw Error('Ticker absent from frozen context');
console.log(JSON.stringify(buildTradePlan(stock,{method,zoneIndex:Number(zoneIndex),expiresAt,costScenarioFraction:Number(cost),costAssumption}),null,2));
