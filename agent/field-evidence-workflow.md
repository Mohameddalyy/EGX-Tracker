# Field-level evidence review, version egx-field-evidence-1

New research may use the `fieldEvidence` contract supported by `app/evidence-policy.mjs` and `app/promotion-policy.mjs`. This user-authorized data-handling change does not activate the v5 paper strategy or change historical reports, forecasts, policies or ledger entries. Legacy reports use the legacy validation path.

Continue substantive financial, ownership, news, corporate-action, technical and liquidity analysis. Each `evidenceChecks` area remains `verified` with sources or `partial` with explicitly enumerated field gaps. A partial area is never represented as fully verified.

Set `fieldEvidence` to `{version, analyst, sector, claims, reliedUponFields, fields, gaps}`. Use `version: egx-field-evidence-1`; `claims` includes `value`/`quality` when that is the thesis. `reliedUponFields` names every additional input used to support a substantive conclusion. Field IDs come from the 78-field frozen dictionary, plus `ownership_control_events` for material control-event clearance.

Required core fields: `isin_alias_segment`, `currency`, `historical_ohlcv`, `adjustment_basis`, `solvency_bank_metrics`, `news_disclosure_coverage`, `corporate_actions`, `median_turnover20`, `ownership_control_events`. Each core/relied-upon field must have `{status:'verified', asOf, sourceIds, note}` with actual dates, allowed sources and substantive conclusions. A successful source check is not sufficient if it reveals an unresolved material problem. Identity, prices, adjustment, material solvency/actions, event coverage and execution validity cannot be waived as a risk choice.

A gap record includes `field`, `area`, `attempts`, `materialityRationale`, `consequence`, `nextReview`; important/claim-dependent gaps additionally require `riskTreatment` and `independentReview:{reviewer,rationale}` from a reviewer distinct from the analyst. Conditional fields become critical when relied upon or when their absence creates material thesis uncertainty. Do not conceal reliance to pass validation.

Optional data may be omitted without weight redistribution. Sector-inapplicable ratios require the stated sector rule; bank solvency checks remain mandatory. Equivalent calculations must match period, unit, currency and adjustment basis. Proxies retain uncertainty. Noncritical gaps do not produce automatic position sizes: the applicable priced-plan and risk/execution controls still apply. The later v5 Risk Agent implementation remains separate from this research-promotion contract.

Retain a company with missing information in preparation/research. Block the affected claim or action and schedule repair. Do not invent a fill, certainty, source, or research completion. Analyst handoff and independent final decision still run through existing guarded commands; preparation never adds a watchlist entry.
