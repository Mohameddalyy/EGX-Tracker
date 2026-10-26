# v5 offline evaluation — W7

This module evaluates the isolated engineering engine. It does not activate a pilot, resume schedules, collect prices, change policies or approve trades. The original experiment and Phase 3 files remain untouched. W7 now includes the separate fixed-exit replay, source-bound statistical inputs, approved comparison amendment and a frozen26-case corrected actual-model development evaluation. See `verification/w7-completion-20261026/RESULTS.md` for the measured result and independent review; implementation completion does not establish trading value.

## Commands

Run with Node 24 from the repository root:

```powershell
node app/v5-evaluation-agent.mjs ledger PATH_TO_ISOLATED_ENGINEERING_SQLITE NEW_REPORT.json
node app/v5-evaluation-agent.mjs trial TRIAL_INPUT.json NEW_TRIAL.json
node app/v5-evaluation-agent.mjs matrix MATRIX_INPUT.json NEW_MATRIX.json
node app/v5-evaluation-agent.mjs cohort COHORT_INPUT.json NEW_COHORT.json
node app/v5-evaluation-agent.mjs daily DAILY_INPUT.json NEW_DAILY.json
node app/v5-evaluation-agent.mjs fixed-exit ATTRIBUTION_INPUT.json NEW_ATTRIBUTION.json
node app/v5-evaluation-agent.mjs forecast FORECAST_INPUT.json NEW_FORECAST.json
node app/v5-evaluation-agent.mjs benchmarks BENCHMARK_INPUT.json NEW_BENCHMARKS.json
node app/v5-evaluation-agent.mjs operations CHECKPOINT_INPUT.json NEW_COVERAGE.json
node app/v5-evaluation-agent.mjs statistics COMPARISON_INPUT.json NEW_STATISTICS.json
node app/v5-evaluation-agent.mjs case ADJUDICATED_CASE.json NEW_CASE.json
node app/v5-evaluation-agent.mjs blind NEW_CASE.json NEW_BLIND_PACKET.json
node app/v5-evaluation-agent.mjs blind-context NEW_CASE.json NEW_CONTEXT_PACKET.json
node app/v5-evaluation-agent.mjs score REVIEW_INPUT.json NEW_SCORE.json
node app/v5-evaluation-agent.mjs suite SUITE_INPUT.json NEW_SUITE.json
```

Every output is exclusive-create, carries kind/time/payload/content hash and cannot replace a previous result. Hashes detect accidental edits; they are not signatures or proof that an external source was truthful. Inputs and full evidence remain local. No package/dependency or execution-module changes were made in this batch, preserving batch 4's execution release and replayability. The evaluation code has its own digest. Run the additional regression file explicitly until W9 updates the integrated release command:

```powershell
node --test app/v5-evaluation.test.mjs app/v5-w7.test.mjs
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
- **Matrix:** `{trialPath,reportPaths,attributionPaths?}` uses hashed CLI artifacts. Each available result is tied to its variant/scenario and execution release; duplicate-arm selection is rejected. Missing arms remain null, not zero-return winners/losers. The six claim categories remain separate.
- **Statistics:** `{scope,sessions,arms}` expects aligned verified daily *net portfolio returns*, independent minute simulation for each scenario and appropriate closed-observation counts. All 16 FULL-versus-other hypotheses remain in the family, unavailable p=1. Fixed 20-session moving blocks, 10,000 replicates, seed 20261023, percentile 95% intervals and centered-null two-sided tests; 10/40 block lengths are sensitivity diagnostics. Minimum 126 sessions/100 appropriate observations is enforced before diagnostics. The estimator is mean paired daily return difference, not compounded wealth. Holm uses the full 16-hypothesis family. No superiority or automatic promotion is emitted: provenance, stopping rules, meaningful benefit, risk acceptance and power/precision still need independent review. The `statistics` command accepts `{trialPath,ledgers:[{id,path}],sessions,baselineDay}` and derives daily returns and closed counts from semantically replayed ledgers. It requires the registered evaluator/engine releases, a baseline before all ledger activity, and the exact admitted session calendar including post-entry sessions. It cannot upgrade engineering scope to prospective evidence. `diagnostic-statistics` leaves caller-supplied vectors explicitly unverified and cannot emit superiority. Source authenticity and real prospective observations still require separate evidence.

## Actual model review

The case command freezes the task, evidence passages/source hashes/availability, category and supplied checked numerical answers. The blind packet excludes truth answers and other model outputs. New evidence rejects excluded source domains. Source passages and numerical truth still require independent verification; a `verified` flag is not that verification.

`score` takes `{casePath,run,review}`. Run binds exact case/packet, actual model and actor/configuration/prompt/tools, original output and hash, tool count, start/end, and extracted numbers keyed to registered truth IDs. Review binds exact run hash, distinct reviewer, five scored/reasoned rubric dimensions, factual errors, disagreements and missing evidence. No synthetic model label may count as an actual run. Missing expected extractions remain in the denominator; additional unadjudicated numbers require review before scoring. Unit/period/entity/source matches are required. Case failures are retained. Suite inputs are `{casePaths,attempts:[{caseId,run,review}]}`; the CLI re-scores original records instead of trusting aggregate score files. At least 20 cases with all registered categories and complete actual output/review are required. The >=95% numerical accuracy floor applies to the aggregate verified fact denominator, while all individual case failures remain visible and any critical error fails the suite. Distinct actor IDs do not prove human independence or eliminate correlated model errors.

The W7 completion pack retains the original22-case attempts and a corrected26-case development run, frozen packets, actual original outputs and separate actor reviews. The final corpus contains64 checked numerical targets. Local runtime provenance records the configured model; this is one-model task evaluation, not a comparison of independently available models. The original proposed backlog has disclosed subtopic substitutions. Shared promptHash means instruction-template hash; full case prompt and packet hashes are also retained. Shared batch tool calls and timing must not be mistaken for independent per-case latency.

A factual/numerical gate pass is not an analytical-quality pass. The frozen plan supplies five qualitative scores but no aggregate qualitative pass threshold. The software therefore reports the scores and `QUALITY_REVIEW_REQUIRED`; it does not invent a threshold or approve a model with accurate extraction and unsupported reasoning. Ledger reports are retrospective as of their explicit valuation timestamp, normally the last recorded event; they are not fresh market-health checks.

## Fixed-exit attribution

Input is {ledgerPath, options?: {openingMarks, supplementalEvents}}. The original matching-release event stream is validated first. A separate chronological diagnostic portfolio suppresses discretionary RISK_EXIT events, retains mandatory stops/thesis breaks/action holds, and recomputes funded cash, settlement, fees, reservations and fills. Accepted desired entry budgets are reused as diagnostic constraints, with quantity capped at the original accepted quantity; altered cash may reduce or block a later entry. No new certificate, approval or counterfactual analyst choice is invented. Original files remain unchanged.

Additional market observations are allowed only for exposure held in the counterfactual after the original portfolio has exited, within the original observation window. They cannot change only one side's entry evidence. Missing marks or unresolved action data keep valuation unavailable. Opening supplements cannot overwrite existing original marks. Matrix attribution artifacts must bind the exact same original ledger state hash and execution release. Output scope is FIXED-EXIT-ATTRIBUTION, conditional, not a competing strategy or pure sizing effect.

The mechanical replay deliberately shares frozen semantics but is a separate implementation to avoid granting fictional certificates. Differential regression tests and execution-release binding are required whenever production semantics change. Never copy the resulting diagnostic orders into a live or paper trading ledger.

## Approved evaluation amendment and remaining dependencies

The client approved verification/w7-completion-20261026/COMPARISON-AMENDMENT-PROPOSAL.md; the immutable approval artifact binds its exact bytes. New trial input can supply amendmentPath. Registration verifies document hash, approved parameters, and approval before registration. The fixed endpoint is 126 sessions, minimum 100 appropriate observations, minimum additional net wealth EGP 1000 plus the separately specified statistical evidence. Risk tradeoffs require separate human judgment, with no added FULL risk cap and no automatic promotion. Five-name buy-and-hold selection/cost/action/mark conventions are specified; absent runtime observations remain unavailable. The original frozen Phase3 files are unchanged.

W8 client cards and comprehension acceptance, W9 integrated/adversarial release, W10 separately authorized actual-session observations and sufficient economic evidence remain necessary. Official rules, source rights, action/entitlement reconciliation and genuine daily benchmark observations remain launch dependencies. A completed W7 evaluation may find a model unsuitable: neither a case pass nor a software test authorizes trading.

## Case-specific temporal context

The optional CASE_CONTEXT_1 packet format adds deterministic case ID, cutoff and source-availability comparisons. Use blind-context for new evaluations. The analyst must echo its verified caseContext in the original answer; the run binder must never generate or repair that field. Scoring rejects a mismatched identity, cutoff or availability table. Legacy packet hashes remain valid so failed original runs remain reproducible. A correct echo does not erase false claims in prose: independent review and critical-error gates still apply. Financial reporting period, publication/capture, future event date and a hypothetical decision cutoff are distinct.

This was introduced after two separate actors both reused one case cutoff in other cases. Their 55/55 requested numerical extractions did not offset two critical temporal errors per attempt. Both failed attempts remain in the W7 pack. New development retests must be reported separately, never selected as a replacement for these failures.

The corrected26-case development run passed 64/64 requested numerical items with zero critical errors. Separate qualitative review found no development-closure blocker, while retaining one noncritical completeness gap and all selection/blindness/source limitations. Read the final W7 RESULTS and qualitative disposition; no economic or operational inference follows.
