import {required,finite,variants} from './contract.mjs';

const mean=a=>a.reduce((n,x)=>n+x,0)/a.length;
function quantile(a,p){const sorted=a.slice().sort((a,b)=>a-b),i=(sorted.length-1)*p,l=Math.floor(i);return sorted[l]+(sorted[Math.ceil(i)]-sorted[l])*(i-l);}
function rng(seed){let x=seed>>>0;return()=>{x+=0x6D2B79F5;let t=x;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}

// Moving (not circular) overlapping blocks; resample both arms together via paired differences.
export function blockDiagnostic(differences,{blockLength=20,replicates=10000,seed=20261023}={}) {
  required(differences.length>=blockLength*3&&differences.every(finite),'At least three full blocks of finite paired daily differences required');
  required(Number.isInteger(blockLength)&&blockLength>0&&Number.isInteger(replicates)&&replicates>=100,'Invalid bootstrap configuration');
  const random=rng(seed),n=differences.length,estimate=mean(differences),samples=[];let extreme=0;
  for(let b=0;b<replicates;b++) {
    let sum=0,count=0;
    while(count<n){const start=Math.floor(random()*(n-blockLength+1));for(let k=0;k<blockLength&&count<n;k++,count++)sum+=differences[start+k];}
    const value=sum/n;samples.push(value);
    if(Math.abs(value-estimate)>=Math.abs(estimate)-1e-15)extreme++;
  }
  return {estimate,confidenceInterval95:[quantile(samples,.025),quantile(samples,.975)],pValue:(extreme+1)/(replicates+1),sampleSessions:n,blockLength,replicates,seed,effectiveNonoverlappingBlocks:Math.floor(n/blockLength),estimand:'Mean paired daily return difference; not compounded return, Sharpe or causal attribution',method:'Percentile moving-block bootstrap; centered-null two-sided test; finite-simulation +1 correction'};
}
export function holm(pValues,alpha=.05) {
  required(pValues.every(p=>finite(p)&&p>=0&&p<=1),'Invalid p-value');
  const sorted=pValues.map((p,i)=>({p,i})).sort((a,b)=>a.p-b.p||a.i-b.i),out=Array(pValues.length);let prior=0;
  sorted.forEach(({p,i},rank)=>{prior=Math.max(prior,Math.min(1,(pValues.length-rank)*p));out[i]={adjustedP:prior,reject:prior<=alpha};});return out;
}

export function comparisonFamily(input) {
  required(Array.isArray(input.sessions)&&input.sessions.every((d,i)=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&(!i||d>input.sessions[i-1])),'Registered ordered sessions required');
  required(Array.isArray(input.arms)&&new Set(input.arms.map(a=>a.id)).size===input.arms.length,'Unique arms required');
  const family=[];
  for(const scenario of ['base','stress'])for(const variant of Object.keys(variants).filter(v=>v!=='FULL')) {
    const full=input.arms.find(a=>a.id==='FULL:'+scenario),other=input.arms.find(a=>a.id===variant+':'+scenario),reasons=[];
    if(input.scope!=='REGISTERED_PROSPECTIVE')reasons.push('Not registered prospective evidence');
    if(input.sessions.length<126)reasons.push('Fewer than 126 prospective sessions');
    for(const a of [full,other]) {
      if(!a){reasons.push('Unavailable arm retained in family');continue;}
      if(!Number.isInteger(a.appropriateClosedObservations)||a.appropriateClosedObservations<100)reasons.push('Fewer than 100 appropriate closed observations');
      if(a.basis!=='DAILY_PORTFOLIO_NET_RETURN'||a.simulationResolution!=='MINUTE'||a.scenario!==scenario)reasons.push('Wrong basis, friction run or simulation resolution');
      if(!Array.isArray(a.returns)||a.returns.length!==input.sessions.length||!a.returns.every((r,i)=>r.day===input.sessions[i]&&r.status==='VERIFIED'&&finite(r.value)))reasons.push('Missing, unaligned or provisional daily returns');
    }
    let diagnostic=null,sensitivity=null;
    if(!reasons.length){const diffs=full.returns.map((r,i)=>r.value-other.returns[i].value);diagnostic=blockDiagnostic(diffs);sensitivity=[10,40].map(blockLength=>blockDiagnostic(diffs,{blockLength}));}
    family.push({id:'FULL-vs-'+variant+':'+scenario,variant,scenario,status:reasons.length?'INCONCLUSIVE':'STATISTICAL_DIAGNOSTIC',reasons:[...new Set(reasons)],diagnostic,sensitivity,pValue:diagnostic?.pValue??1});
  }
  const adjustments=holm(family.map(x=>x.pValue));family.forEach((x,i)=>Object.assign(x,{multiplicity:adjustments[i]}));
  return {familySize:16,familyAlpha:.05,family,superiorityClaim:'NOT_EMITTED',reason:'Statistical differences alone do not establish meaningful benefit, acceptable risk, independent provenance, stopping-rule compliance or investability. Those release gates remain separate.',fullVsBoundedInterpretation:'Combined allocation and discretionary risk-exit mandate; not a pure sizing comparison',fixedExitAttribution:'BLOCKED_SEPARATE_FUNDED_REPLAY_REQUIRED'};
}
