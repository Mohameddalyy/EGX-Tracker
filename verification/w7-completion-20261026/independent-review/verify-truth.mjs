import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../../../',import.meta.url);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=path=>readFileSync(new URL(path,root));
const manifest=JSON.parse(read('verification/w7-completion-20261026/cases-source/case-manifest.json'));
// Independently transcribed from source pages inspected by this actor, or derived
// from the explicit synthetic scenario. No expected value is taken from truth.
const expected={
 'W7-01':{net_funds:29117908-16863967,ecl_signed:-2176},
 'W7-02':{shareholder_profit:7536797,nci_difference:7550833-7536797},
 'W7-03':{operating_profit:179.5,operating_cash_flow:-54.5,receivables_cash_movement:-329.2},
 'W7-04':{k12_before:-321.5,k12_after:49.3,allocation_uplift:49.3-(-321.5)},
 'W7-05':{rounded_new_sales:182,recognized_revenue:25549856/1000000,rounded_collections:26},
 'W7-06':{net_current_assets:99982419-98786344,rounded_net_debt:4.2},
 'W7-07':{group_profit:127.8*1000000,parent_profit:5155743,scope_difference:127.8*1000000-5155743},
 'W7-08':{adib_profit_millions:7550833/1000,oras_profit_millions:127.8},
 'W7-09':{period_end_to_release_days:(Date.parse('2025-11-13')-Date.parse('2025-09-30'))/86400000},
 'W7-10':{financial_period_age:(Date.parse('2026-10-26')-Date.parse('2025-09-30'))/86400000,historical_revenue:25549856},
 'W7-11':{share_multiplier:1+1/10,post_bonus_shares:1000+1000/10},
 'W7-12':{cash_dividend_per_share:6,gross_cash_entitlement:1000*6},
 'W7-13':{exchange_ratio:.4634,arithmetic_new_shares:1000*.4634},
 'W7-14':{minute_capacity:Math.floor(30000*.02),daily_capacity:Math.floor(20000*.05),effective_capacity:Math.min(Math.floor(30000*.02),Math.floor(20000*.05))},
 'W7-15':{exit_capacity:Math.min(Math.floor(10000*.02),Math.floor(30000*.05)),executed_exit:0,retained_shares:800},
 'W7-16':{name_headroom:100000*.15-14000,scenario_a_addition:Math.min(6000,8000,100000*.15-14000),scenario_b_addition:Math.min(6000,8000-7500,100000*.15-14000)},
 'W7-17':{combined_exposure:30000+20000,shared_exposure_percent:(30000+20000)/100000*100},
 'W7-18':{free_settled_cash:3000-2000,desired_shares:10000/20,funded_share_ceiling:Math.floor((3000-2000)/20)},
 'W7-19':{profit_cash_gap:127.8-(-54.5),mechanical_opportunities:1},
 'W7-20':{computed_gross_margin:289.5/2978*100},
 'W7-21':{post_addition_name_percent:70000/100000*100,remaining_cash:85000-70000,common_factor_percent:(70000+15000)/100000*100,joint_adverse_equity:70000*.75+15000*.8+15000},
 'W7-22':{desired_shares:60000/20,stated_upside_percent:(22/20-1)*100,adverse_price_return_percent:(12/20-1)*100,adverse_portfolio_equity:100000-60000+(60000/20)*12,retained_mechanical_opportunities:1}
};
const pages={adib:[4],oras:[8,10,41,68],cira:[4],phdc:[1,2,4]};
const checks=manifest.manifest.map(x=>{
 const bytes=read(x.path),c=JSON.parse(bytes);
 assert.equal(c.truth.numbers.length,Object.keys(expected[c.id]).length);
 const sources=c.evidence.map(e=>{const actual=digest(read(e.localPath));assert.equal(actual,e.contentHash);return {id:e.id,path:e.localPath,contentHash:actual,status:'RETAINED_BYTES_MATCH'};});
 const numbers=c.truth.numbers.map(n=>{const value=expected[c.id][n.id];assert.equal(typeof value,'number');assert.ok(Math.abs(value-n.value)<=n.absoluteTolerance,c.id+':'+n.id);return {id:n.id,independentValue:value,recordedValue:n.value,unit:n.unit,period:n.period,entity:n.entity,evidenceId:n.evidenceId,status:'VERIFIED_AGAINST_SOURCE_OR_EXPLICIT_FIXTURE'};});
 return {caseId:c.id,inputPath:x.path,inputByteHash:digest(bytes),numbers,sources};
});
const result={reviewerActorId:'/root/w7_independent_review',reviewedAt:new Date().toISOString(),independence:'Separate AI actor; not human-independent verification or a named-model comparison.',cases:checks.length,numericalItems:checks.reduce((n,c)=>n+c.numbers.length,0),sourceReview:{method:'Full selected page PNGs visually inspected against passages; raw retained CIB web capture and all synthetic scenario passages read; every source byte hash recomputed.',physicalPdfPages:pages,cibLines:'71-76',scope:'Selected-source extraction fidelity, not authentic first-publication timing or complete issuer due diligence.'},caveats:['CIRA issuer-to-service provenance remains unresolved and stated in packet.','Palm Hills internal EBITDA/headline inconsistencies are present in source and retained in packet.','Five wholly synthetic operational cases are not market observations.','Calendar-age calculations use explicit scenario dates, not inferred publication availability.','Specific replaced backlog subtopics remain untested; see CURATION-REPORT.md.','W7-13 exchange-ratio source is the separate-parent note; use neutral company entity metadata rather than consolidated if not yet corrected.'],checks};
writeFileSync(new URL(process.argv[2]||'truth-verification-22.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({reviewedAt:result.reviewedAt,cases:result.cases,numericalItems:result.numericalItems,status:'NUMERICAL_ITEMS_VERIFIED'}));
