import {existsSync,readFileSync} from 'node:fs';import {join} from 'node:path';
export function tradingViewPlan(root){const path=join(root,'research','tradingview-plan.json');return existsSync(path)?JSON.parse(readFileSync(path,'utf8')):null;}
