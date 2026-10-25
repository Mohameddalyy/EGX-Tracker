# v5 offline evaluation — batch 5

This module evaluates the isolated engineering engine. It does not activate a pilot, resume schedules, collect prices, change policies or approve trades. The original experiment and Phase 3 files remain untouched. W7 is **partially implemented**, not closed: actual analytical evaluation and the fixed-exit counterfactual still need work.

## Commands

Run with Node 24 from the repository root:

```powershell
node app/v5-evaluation-agent.mjs ledger PATH_TO_ISOLATED_ENGINEERING_SQLITE NEW_REPORT.json
node app/v5-evaluation-agent.mjs trial TRIAL_INPUT.json NEW_TRIAL.json
node app/v5-evaluation-agent.mjs matrix MATRIX_INPUT.json NEW_MATRIX.json
node app/v5-evaluation-agent.mjs cohort COHORT_INPUT.json NEW_COHORT.json
node app/v5-evaluation-agent.mjs daily DAILY_INPUT.json NEW_DAILY.json
node app/v5-evaluation-agent.mjs forecast FORECAST_INPUT.json NEW_FORECAST.json
node app/v5-evaluation-agent.mjs benchmarks BENCHMARK_INPUT.json NEW_BENCHMARKS.json
node app/v5-evaluation-agent.mjs operations CHECKPOINT_INPUT.json NEW_COVERAGE.json
node app/v5-evaluation-agent.mjs statistics COMPARISON_INPUT.json NEW_STATISTICS.json
node app/v5-evaluation-agent.mjs case ADJUDICATED_CASE.json NEW_CASE.json
node app/v5-evaluation-agent.mjs blind NEW_CASE.json NEW_BLIND_PACKET.json
node app/v5-evaluation-agent.mjs score REVIEW_INPUT.json NEW_SCORE.json
node app/v5-evaluation-agent.mjs suite SUITE_INPUT.json NEW_SUITE.json
```

Every output is exclusive-create, carries kind/time/payload/content hash and cannot replace a previous result. Hashes detect accidental edits; they are not signatures or proof that an external source was truthful. Inputs and full evidence remain local. No package/dependency or execution-module changes were made in this batch, preserving batch 4's execution release and replayability. The evaluation code has its own digest. Run the additional regression file explicitly until W9 updates the integrated release command:

```powershell
node --test app/v5-evaluation.test.mjs
```

## Contracts and interpretation

- **Ledger:** read-only SQLite transaction gives a consistent snapshot including WAL. Verify sequence, event hashes, state hash and every transition/result against the matching execution release. A different release produces `BLOCKED_RELEASE_MISMATCH`; a chain check alone cannot authorize metrics. A complete rewrite by a malicious party is outside this local integrity control.
- **P&L:** integer piastres; cash plus unsettled receivables plus verified held marks equals equity. Net P&L must equal realized plus unrealized P&L. Recalculate fees and each lot from actual modeled fills. Closed trade return and initial-risk R use original fills/risk. Held lots include entry fees but no imaginary exit. Gross-before-fees retains modeled slippage; it is not a frictionless rerun. Base and stress require separate ledgers.
- **Slippage:** difference between each modeled fill and its matched raw minute open, including tick rounding. This is not observed broker slippage, decision-price shortfall or a simulation of unfilled opportunity cost. Missing reference stays null.
- **Curve:** event snapshots and gaps are explicit. Observed drawdown is a lower-information measure, not continuous drawdown; no marks means unavailable. Exposure and name/sector/issuer concentration are descriptive. Turnover is two-sided notional divided by fixed starting capital, not annualized. Pending exits and settlement observations remain visible. Dividend/entitlement reconciliation is not implemented; affected holdings remain provisional.
- **Daily:** `daily` takes `{ledgerPath,sessions}`. The caller supplies ordered verified exchange sessions; a held stock needs a completed daily finalization for that date. Minute marks do not become daily closes. Missing daily records remain gaps. No statistical input should be built by forward filling these gaps.
- **Cohort:** `{signalInput,dispositions}`. Recompute the full admitted screen and retain every stock/variant row, mechanical gate, rank, first failing gate, missing disposition and decision history. ID is SHA256 of `{inputHash,signalDay,isin,variantId}`. Dispositions carry their own ID, opportunity ID, timestamp, status, reason and evidence hash; optional supersedes references existing same-opportunity history. Screen coverage never means every company received fundamental research.
- **Forecast:** `{anchor,sessions,points,cutoffAt}`. Original confirmed adjusted signal-close anchor includes its commitment time and adjustment vintage. 5/20/60 horizons use verified session indices, distinct from trade fills. Immature, missing and incompatible-vintage prices remain separate. A verified delisting payout or corporate-action return needs an explicit future extension; it is not replaced by zero or a carried price.
- **Benchmark:** `{baselineDay,sessions,portfolio,benchmarks,cutoffAt}`. Calendar begins with the previous session before the pilot. EGX30/EGX70EWI require confirmed sourced closes with timestamps and matching basis IDs. Portfolio closes use `daily` output. No absent point is carried forward. Comparison is against price indexes, not an executable fee-free basket or alpha. Cash is idle EGP at 0% interest. A total-return or attainable basket comparator needs its own approved specification.
- **Trial:** eighteen arm records (nine variants × base/stress), input/data/code hashes, attempted versions and actual actor/model/prompt/configuration/tool-permission bindings for available research arms. Missing arms have reasons. Current registration scopes are engineering, historical feasibility or prospective draft; none activates or validates a prospective trial. Do not reinterpret hindsight registration as preregistration.
- **Matrix:** `{trialPath,reportPaths}` uses hashed CLI artifacts. Each available result is tied to its variant/scenario and execution release; duplicate-arm selection is rejected. Missing arms remain null, not zero-return winners/losers. The six claim categories remain separate.
- **Statistics:** `{scope,sessions,arms}` expects aligned verified daily *net portfolio returns*, independent minute simulation for each scenario and appropriate closed-observation counts. All 16 FULL-versus-other hypotheses remain in the family, unavailable p=1. Fixed 20-session moving blocks, 10,000 replicates, seed 20261023, percentile 95% intervals and centered-null two-sided tests; 10/40 block lengths are sensitivity diagnostics. Minimum 126 sessions/100 appropriate observations is enforced before diagnostics. The estimator is mean paired daily return difference, not compounded wealth. Holm uses the full 16-hypothesis family. No superiority or automatic promotion is emitted: provenance, stopping rules, meaningful benefit, risk acceptance and power/precision still need independent review. Caller-provided counts/return provenance are contracts, not independent attestation.

## Actual model review

The case command freezes the task, evidence passages/source hashes/availability, category and supplied checked numerical answers. The blind packet excludes truth answers and other model outputs. New evidence rejects excluded source domains. Source passages and numerical truth still require independent verification; a `verified` flag is not that verification.

`score` takes `{casePath,run,review}`. Run binds exact case/packet, actual model and actor/configuration/prompt/tools, original output and hash, tool count, start/end, and extracted numbers keyed to registered truth IDs. Review binds exact run hash, distinct reviewer, five scored/reasoned rubric dimensions, factual errors, disagreements and missing evidence. No synthetic model label may count as an actual run. Missing expected extractions remain in the denominator; additional unadjudicated numbers require review before scoring. Unit/period/entity/source matches are required. Case failures are retained. Suite inputs are `{casePaths,attempts:[{caseId,run,review}]}`; the CLI re-scores original records instead of trusting aggregate score files. At least 20 cases with all registered categories and complete actual output/review are required. Distinct actor IDs do not prove human independence or eliminate correlated model errors.

No actual model has been evaluated in this batch. `verification/remediation-batch5-20261026/MODEL-CASE-BACKLOG.md` defines the 20 unadjudicated slots and the exact work remaining.

A factual/numerical gate pass is not an analytical-quality pass. The frozen plan supplies five qualitative scores but no aggregate qualitative pass threshold. The software therefore reports the scores and `QUALITY_REVIEW_REQUIRED`; it does not invent a threshold or approve a model with accurate extraction and unsupported reasoning. Ledger reports are retrospective as of their explicit valuation timestamp, normally the last recorded event; they are not fresh market-health checks.

## Still required before W7 closure

1. Source, independently check and freeze the 20 cases; record actual configured model runs and reviews. Keep a reviewer-disposition record for this implementation itself.
2. Implement fixed-exit attribution as a **separate funded chronological replay**, preserving recorded desired entry budgets and quantity ceilings; recompute cash, settlement, reservations, fills and divergences. Removing exit records from a realized P&L table or fabricating new certificates would be invalid. Current reports mark it unimplemented.
3. Bind validated prospective daily-return and cohort provenance to the statistical input when the authorized prospective runner exists; collect sufficient real observations only under separate authorization.
4. Approve meaningful benefit, acceptable risk outcomes and stopping rules before prospective outcomes. Register the attainable basket via an amendment. No values were silently invented here.
5. W8 client view and comprehension acceptance, W9 full release integration, W10 authorized actual-session rehearsal/pilot, plus source/rule/action dependencies remain open. These local tests cannot close them.
