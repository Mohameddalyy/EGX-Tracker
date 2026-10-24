export function documentFailure(error){
 const text=String(error?.message||error);
 if(/HTTP 404|HTTP 410/.test(text))return {code:'ROUTE_NOT_FOUND',retryMs:7*86400000,nextAction:'Discover an issuer/exchange link; do not retry the same missing route as evidence collection.'};
 if(/HTTP 403|HTTP 401/.test(text))return {code:'ACCESS_RESTRICTED',retryMs:7*86400000,nextAction:'Use an allowed public issuer/exchange route or manual browser retrieval; no access-control bypass.'};
 if(/size limit/.test(text))return {code:'OVERSIZED_DOCUMENT',retryMs:7*86400000,nextAction:'Use bounded larger-file retrieval for the identified document.'};
 if(/timeout|aborted/i.test(text))return {code:'TIMEOUT',retryMs:3600000,nextAction:'Retry this source with a bounded timeout; retain previous content.'};
 if(/HTTP 429|HTTP 5\d\d|fetch failed/i.test(text))return {code:'TRANSIENT_NETWORK_OR_SERVER',retryMs:3600000,nextAction:'Retry only the failed source; keep successful components.'};
 return {code:'SOURCE_REVIEW_REQUIRED',retryMs:86400000,nextAction:'Inspect the specific response; do not treat source failure as a company verdict.'};
}
