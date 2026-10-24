import {getState} from '../integrations/tradingview-mcp/src/core/chart.js';
import {disconnect} from '../integrations/tradingview-mcp/src/connection.js';
const startedAt=new Date().toISOString();const watchdog=setTimeout(()=>{console.log(JSON.stringify({startedAt,status:'blocked',reason:'Chart health did not complete within 75 seconds; no chart changes attempted'}));process.exit(1);},75000);
try{const chart=await getState();console.log(JSON.stringify({startedAt,checkedAt:new Date().toISOString(),status:'healthy',chart}));await disconnect();clearTimeout(watchdog);process.exit(0);}catch(e){console.log(JSON.stringify({startedAt,status:'blocked',reason:e.message}));clearTimeout(watchdog);process.exit(1);}
