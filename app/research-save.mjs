import {readFileSync} from 'node:fs';import {dirname} from 'node:path';import {fileURLToPath} from 'node:url';import {saveReport} from './research.mjs';
if(!process.argv[2])throw Error('Usage: node app/research-save.mjs path-to-report.json');
const r=JSON.parse(readFileSync(process.argv[2],'utf8'));saveReport(dirname(dirname(fileURLToPath(import.meta.url))),r);console.log('Saved '+r.id);
