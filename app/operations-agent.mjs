import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import {dirname,join,resolve} from 'node:path';
import {existsSync} from 'node:fs';
import {initOperations,beginOperation,updateOperation,operationsState} from './operations.mjs';
const root=dirname(dirname(fileURLToPath(import.meta.url))),db=new DatabaseSync(join(root,'data','egx.sqlite'));db.exec('PRAGMA busy_timeout=5000');initOperations(db);
try{const [command,id,status,...words]=process.argv.slice(2);let result;
 if(command==='begin')result=beginOperation(db);
 else if(command==='status')result=operationsState(db);
 else if(command==='finish'){const [report,...note]=words;if(status==='completed'&&(!report||!existsSync(resolve(root,report))))throw Error('Saved report must exist');result=updateOperation(db,id,status,note.join(' '),report==='-'?null:report);}
 else if(command==='pulse')result=updateOperation(db,id,'running', [status,...words].filter(Boolean).join(' '));
 else if(command==='check'){if(!['TradingView','startup'].includes(id)||!['healthy','failed','unknown'].includes(status)||!words.length)throw Error('check SERVICE STATUS NOTE');db.prepare('INSERT INTO operations_checks(at,service,status,note) VALUES(?,?,?,?)').run(new Date().toISOString(),id,status,words.join(' '));result={recorded:true};}
 else throw Error('Use status | begin | pulse ID NOTE | finish ID STATUS REPORT-or-- NOTE | check SERVICE STATUS NOTE');
 console.log(JSON.stringify(result,null,2));}finally{db.close();}
