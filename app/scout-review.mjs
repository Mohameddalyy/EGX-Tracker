export {requiredChecks,validatePromotion} from './promotion-policy.mjs';
import {handoffDecision} from './decisions.mjs';
// Compatibility entrypoint: analyst reports now go to the independent final agent.
export function applyAnalystReview(db,root,queueId,reportId,now=new Date()){return handoffDecision(db,root,queueId,reportId,now);}
