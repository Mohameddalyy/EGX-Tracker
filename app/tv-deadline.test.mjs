import test from 'node:test';import assert from 'node:assert/strict';import {withDeadline} from '../integrations/tradingview-mcp/src/deadline.js';
test('connector deadlines preserve values and original errors',async()=>{assert.equal(await withDeadline(Promise.resolve(42),'test',100),42);await assert.rejects(withDeadline(Promise.reject(new Error('original')),'test',100),/original/);});
test('an unresponsive chart rejects rather than hanging a collector',async()=>{await assert.rejects(withDeadline(new Promise(()=>{}),'chart evaluation',10),/chart evaluation timed out after 10ms/);});
