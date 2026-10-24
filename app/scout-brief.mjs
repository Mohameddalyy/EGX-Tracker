export function screenBrief(current,previous=[]){
 const before=new Map(previous.map(r=>[r.ticker,r]));const exclusions={},changes=[];
 for(const r of current){for(const reason of r.exclusions)exclusions[reason]=(exclusions[reason]||0)+1;const p=before.get(r.ticker);
 if(!p||p.eligible!==r.eligible||!!p.candidate!==!!r.candidate||p.score!==r.score||JSON.stringify(p.exclusions)!==JSON.stringify(r.exclusions))changes.push({ticker:r.ticker,previousScore:p?.score??null,score:r.score,eligible:r.eligible,candidate:!!r.candidate,reasons:r.exclusions});}
 return {total:current.length,eligible:current.filter(r=>r.eligible).length,matches:current.filter(r=>r.candidate).length,changed:changes.length,exclusionCounts:exclusions,topCandidates:current.filter(r=>r.candidate).slice(0,5).map(r=>({ticker:r.ticker,score:r.score,asOf:r.asOf,signals:r.signals})),changes,limitations:'Score changes are triage only. Unchanged scores do not prove unchanged news, thesis, price triggers or risks. Monitor all recorded decisions separately.'};
}
