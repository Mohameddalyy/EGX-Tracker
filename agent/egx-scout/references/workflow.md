# Scout → analyst → final decision → watchlist contract

Read `agent/analytical-workflow.md` for analytical-research-1.0. Analysts save structured primary facts, sector models, catalysts and complete challenged theses; final reviewers independently examine them alongside the full normal report. Selected immutable contexts include these dossiers. Analytical challengers and comparative results never bypass this existing final-approval contract.

Use Node 24 from the workspace. `node app/scout-handoff.mjs queue` lists persisted pending/researching candidates. `claim CANDIDATE_ID` marks a pending item researching. Claims remain visible if a run is interrupted; the next run resumes them. A new screen must not duplicate a pending ticker.

For each selected candidate run `node app/research-context.mjs TICKER`. Use the resulting immutable context ID and the screener's saved reasons as hypotheses to challenge. Context includes daily bars, price levels, actual holdings and the latest TradingView financial snapshot. The analyst uses the existing `egx-research` skill and report schema. Save the draft with `node app/research-save.mjs PATH`.

For pipeline reports, add to each assessment:

```json
{
  "candidateId": "candidate-UUID",
  "pipelineDecision": "defer",
  "horizon": "Medium term",
  "evidenceChecks": {
    "financials": {"status": "unavailable", "asOf": "2026-10-08", "sourceIds": ["source-id"], "note": "Describe checked statements, periods, valuation and missing data."},
    "ownership": {"status": "unavailable", "asOf": "2026-10-08", "sourceIds": ["source-id"], "note": "Identify major owners and percentages with disclosure dates; do not assume a majority exists."},
    "news": {"status": "unavailable", "asOf": "2026-10-08", "sourceIds": ["source-id"], "note": "State search coverage, event/publication dates and material catalysts."},
    "corporateActions": {"status": "unavailable", "asOf": "2026-10-08", "sourceIds": ["source-id"], "note": "Review dividends, splits, capital changes and suspensions."},
    "technicals": {"status": "unavailable", "asOf": "2026-10-08", "sourceIds": ["source-id"], "note": "Daily/weekly structure and dated entry/invalidation."},
    "liquidity": {"status": "unavailable", "asOf": "2026-10-08", "sourceIds": ["source-id"], "note": "Observed volume/turnover, gaps and likely execution limitations."}
  }
}
```

Values in this example are placeholders, not verified evidence. `pipelineDecision` is `approve`, `defer` or `reject`. Only set an evidence check to `verified` after actually inspecting sufficient sources; explain limitations in the note. Source IDs must exist in the report. Price evidence additionally cites the immutable context path inside the technical text; use the actual TradingView symbol page as its public source. A source link alone does not verify its contents.

`approve` also requires a `Watch` or `Conditional setup` verdict, `horizon` of `Short term` or `Medium term`, and `riskPlan` containing numerical `entry`, `stop`, `target`, `currency: "EGP"`, numerical `costScenarioFraction`, explicit `costAssumption`, and ISO `expiresAt`. Require 0 < stop < entry < target. Describe entry triggers and cancellation conditions in the normal report sections. Use the existing deterministic entryRisk helper; unknown broker costs may be represented only as explicit scenarios. Never supply share quantities without user-approved inputs. All six evidence checks must be verified; incomplete research is deferred, not optimistically promoted.

Apply with `node app/scout-handoff.mjs apply CANDIDATE_ID REPORT_ID`. This hands all completed reports to the final decision inbox, including deferred/rejected research. Invoke the separate $egx-decision agent next. Only its guarded Watch decision adds a stock and creates a watchlist notification. Repeating the same apply is idempotent. It never places orders or resumes a user-paused stock. The guard checks structure and provenance linkage, not whether an analyst's factual assertions are correct; the independent research obligation remains essential.

Read `/api/scout` or `data/egx.sqlite` for queue and notifications. UI is `http://127.0.0.1:4317/#scout`. Store full reports locally. Do not send holdings to public web endpoints. Available tools should be discovered at runtime; use any relevant TradingView read/analysis capability, with web/issuer fallbacks for financials, ownership and news.

Priced-plan requirement: before analyst approval, generate the full `priced-plan-1.0` riskPlan using `app/trade-plan.mjs` and the frozen context. Follow `agent/egx-research/references/priced-plans.md`. The final agent recalculates and validates all levels, formulas, tick rounding and the 2:1 cost-adjusted T1 gate. An abbreviated or hand-edited plan is rejected. Existing six evidence requirements remain mandatory.


## Evidence synthesis and research cards
New contexts include a researchCard per stock. Review its daily/weekly and broker-consensus disagreements, industry peer counts/medians, sectorGuide and evidence tasks. Missing values are source gaps, not negative company results. Negative values require reporting-period and sector interpretation. Peer statistics use other same-industry/same-currency stocks with recent captures and at least three usable observations; they do not reconcile fiscal dates or establish fair value.
Each analyst report must explain which observations support the thesis, which challenge it, which are missing, and the next evidence needed. Specifically reconcile consensus targets with current prices and dates; never adopt them as execution targets without the priced-plan checks. Use dated statements, ownership, news, earnings and corporate-action sources beyond scanner values. Page reachability alone is not a verified source. The final decision reviewer independently checks these conflicts and the full source trail. Cards are evidence aids, not new screening rules or automatic approvals.
