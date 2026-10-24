import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
import {initPositions,position,addFill,entryFills,voidLastFill} from './positions.mjs';
const plan={stop:90,target:130};
test('weighted cost, partial exit, fees and remaining stop risk reconcile',()=>{
 const f=[{day:'2026-01-01',side:'Buy',quantity:100,price:100,fees:10},{day:'2026-01-02',side:'Buy',quantity:100,price:120,fees:10},{day:'2026-01-03',side:'Sell',quantity:50,price:130,fees:5}];
 const p=position(f,plan,{day:'2026-01-03',close:115});assert.equal(p.quantity,150);assert.equal(p.costBasis,16515);assert.equal(p.realized,990);assert.equal(p.unrealized,735);assert.equal(p.riskToStop,3015);assert.equal(p.averageBuyPrice,110);assert.equal(p.totalFees,25);
 assert.equal(position(f,plan,{day:'2026-01-02',close:115}).unrealized,null);
 f.push({day:'2026-01-04',side:'Sell',quantity:150,price:110,fees:0});const closed=position(f,plan);assert.equal(closed.quantity,0);assert.equal(closed.costBasis,0);assert.equal(closed.realized,975);
});
test('fills reject overselling/backdating, retry safely and preserve void audit trail',()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE journal(id INTEGER PRIMARY KEY,plan TEXT)');db.prepare('INSERT INTO journal VALUES(1,?)').run(JSON.stringify(plan));initPositions(db);
 const p={id:1,requestId:'positions-test-0001',day:'2026-01-01',side:'Buy',quantity:100,price:100,fees:10,note:'Initial fill'};const buy=addFill(db,p);addFill(db,p);assert.equal(entryFills(db,1).length,1);
 assert.throws(()=>addFill(db,{...p,quantity:101}));assert.throws(()=>addFill(db,{...p,requestId:'positions-test-0002',side:'Sell',quantity:101}));
 const sell=addFill(db,{...p,requestId:'positions-test-0003',side:'Sell',day:'2026-01-02',quantity:20});assert.throws(()=>voidLastFill(db,{fillId:buy.id,reason:'Correction'}));assert.throws(()=>addFill(db,{...p,requestId:'positions-test-0004'}));
 voidLastFill(db,{fillId:sell.id,reason:'Wrong fill'});assert.equal(position(entryFills(db,1),plan).quantity,100);assert.ok(entryFills(db,1)[1].voided_at);
 for(const bad of [{quantity:0},{quantity:1.5},{price:Infinity},{fees:-1},{day:'2026-02-30'},{day:'2099-01-01'}])assert.throws(()=>addFill(db,{...p,...bad,requestId:'positions-test-0005'}));db.close();
});
