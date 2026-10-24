# Field-level evidence review, version egx-field-evidence-2

New promotion requires the current versioned contract in app/evidence-policy.mjs. Legacy reports remain historical records; they cannot receive a new approval through the old whole-area fallback. This repair does not activate the v5 strategy or change historical policies, forecasts or ledger entries.

Continue substantive financial, ownership, news, corporate-action, technical and liquidity analysis. Each evidenceChecks area is verified with sources or partial with enumerated field gaps. A partial area is never represented as fully verified.

Set fieldEvidence to {version, analyst, sector, claims, cutoffAt, reliedUponFields, fields, gaps}. Supported claim families are technical, value, quality, solvency, catalyst and liquidity. At least one is required. Declare value/quality when the thesis makes those claims: their conditional financial inputs are derived from the dictionary, even when omitted from reliedUponFields or gaps. Independent review must also challenge whether the declared families match the actual thesis; schema validation cannot read intent.

Core fields: isin_alias_segment, currency, historical_ohlcv, adjustment_basis, solvency_bank_metrics, news_disclosure_coverage, corporate_actions, median_turnover20, ownership_control_events. Field IDs come from app/contracts/evidence-dictionary.json, copied unchanged from the frozen Phase 2 dictionary. Each verified field has {status:'verified', asOf, checkedAt, sourceIds, note}. Additional relied-upon fields remain mandatory.

cutoffAt is the actual coverage cutoff for the approval, no more than 30 minutes old. This is a new approval-time verification guard, not a trading threshold, market feed latency claim, collection cadence or instruction to reread every document. checkedAt must be an actual check at or after that cutoff and not in the future. Never refresh timestamps without doing the check. Event/clearance fields and conditional financial inputs also require coverageThrough at least equal to cutoffAt and no later than checkedAt. Event/clearance asOf must cover the current Cairo cutoff date. Old financial periods remain valid when the statement is still applicable and subsequent-filing coverage has actually been checked. An unresolved material event is not verified merely because a source was reachable.

A gap includes field, area, attempts, materialityRationale, consequence and nextReview. Important/claim-dependent gaps additionally require riskTreatment and independentReview:{reviewer,rationale}, distinct from the analyst. Optional fields may be omitted without penalties or weight redistribution; a bank current ratio is inapplicable, while bank solvency remains mandatory. Critical or relied-upon gaps block only the dependent approval; preserve the company in research and schedule repair.

Verified financial facts and reconciled financial statements are distinct. PASSED requires every implemented arithmetic reconciliation to pass. PARTIAL and NOT_EVALUABLE are not consistent=true. Saving a sourced subset of facts is allowed when no available check fails; it does not certify a complete set of accounts.

Screening, preparation, research promotion and paper proposals share historyRefreshState. A newer stock-level capture cannot certify an untouched older bar. Preserve raw bars and resolve partial-capture conflicts. Provider-session readiness is not exchange-certified execution clearance.

The applicable priced-plan, independent final decision, sizing and execution controls still apply. Do not invent a fill, source, certainty or completed review. Preparation never adds a watchlist entry. Schedules remain paused pending explicit resumption.
