# Remediation batch 5 — evaluation implementation

26 October 2026, Africa/Cairo. Source timestamps are actual UTC timestamps (some are 25 October UTC). **Engineering implementation delivered; W7 remains partially complete. Schedules paused; no pilot activation or real orders.**

## Delivered and checked

| Work item | Result | Evidence / remaining limitation |
|---|---|---|
| W7.1 comparisons | Immutable 18-arm manifest and matrix implemented | Available engineering examples remain labeled synthetic; unavailable arms stay null. Actual research model/prompt/tool identities are required for available research arms. No prospective trial registration/activation is claimed. |
| W7.2 actual cases | Freeze/blind/run-binding infrastructure implemented; actual evaluation **not done** | Twenty-case backlog provided; zero actual models scored. Source/adjudicator work cannot be replaced by synthetic records. |
| W7.3 rubric | Fixed rubric and factual/numerical gate implemented | Missing extractions count against accuracy; errors, disagreements and missing evidence retained. Numerical pass cannot certify qualitative analysis. No aggregate qualitative threshold invented. |
| W7.4 cohorts | Full screen/disposition accounting and distinct forecast anchors implemented | Synthetic 7-stock × 9-variant test produces 63 retained rows. No claim that 63 companies were researched or that synthetic dates are market observations. |
| W7.5 accounting | Read-only semantic ledger replay and reconciliation implemented | Fees, modeled slippage, cash/receivables, realized/unrealized P&L, original risk multiples, exposure/concentration, turnover, event drawdown, pending exits and settlement records. Missing marks suppress total return. True implementation shortfall, entitlement reconciliation and fixed-exit counterfactual remain unavailable. |
| W7.6 benchmarks | Same-period cash and price-index alignment implemented | Date/basis gaps stay visible. No fresh market indexes were collected. Attainable basket remains an unapproved proposal. |
| W7.7 bias controls | Availability, immutable artifacts, cutoff, separate anchors/resolution and attempted-version bindings implemented | Historical engineering data never becomes untouched OOS. Authentic source provenance and prospective admission still require the runner/review. |
| W7.8 statistics | Frozen dependence-aware diagnostic and 16-hypothesis Holm family implemented | 20-session blocks, 10,000 replicates, seed 20261023, 10/40 sensitivity; missing arms p=1; 126 sessions/100 observations enforced. Meaningful benefit/risk/stopping approval and actual observations absent. No superiority claim emitted. |
| W7.9 gate analysis | Full gate retention and exclusive first-failure counts implemented | Descriptive waterfall; no threshold tuning, trade quota, policy change or automated promotion. |

## Validation

- **286 tests passed**, zero failed/skipped/cancelled: 238 existing tests plus 48 evaluation regressions. Full local output: `release-tests.log`.
- Replayed all three retained batch 4 engineering ledgers, including original transition results; database byte hashes remained unchanged. Matching execution release preserved: `c532d61c9e7b406b9f00e7aecc5b317734841cfa77f7451c5f72e12eef592a76`.
- The closed synthetic example reconciles to **EGP −568.39** net, **EGP84.23** fees, **EGP128.16** modeled adverse minute-open slippage. Slippage is already inside net P&L and is not subtracted twice. The result is an accounting test, not a strategy performance claim.
- The illiquid synthetic example retains a pending exit, zero completed trades and **EGP −1,831.37** marked net P&L at its saved observation; later stale marks would invalidate a current valuation. The stress example retains one unfilled/censored intent, no invented fill and zero return with an inconclusive profitability result.
- Eighteen comparison arms remain visible; three have synthetic accounting examples and fifteen have no ledger. All sixteen statistical hypotheses are unavailable for actual inference. Actual model runs: **zero**.
- CLI smoke check created a hashed report through the public command. File overwrite, hash corruption, invalid transition results, stale marks, altered costs, fabricated cash flows, missing benchmark dates, immature forecasts, duplicate arms, missing/repeated model cases, self-review and wrong numerical units have regressions.
- Retained-data verification: 296 stocks, zero stale-admission mismatches; 23 recovered notices across 11 tickers; seven policy files, nine frozen Phase 3 artifacts, original experiment ledger and source index preserved; all four automations remain **PAUSED**.

Final generated evidence is under `release-evidence/`, including source/data hashes and measured run duration. The earlier `evidence/` and `cli-smoke.json` retain the pre-final-review version. The final review tightened claim labeling: factual extraction can pass while analytical quality still requires review. Earlier files were not overwritten. No source package/dependency/execution engine change was needed, so historical execution replay remained valid.

## Reproduce

```powershell
node --test app/v5-evaluation.test.mjs
# Existing suite plus evaluation, without changing the execution-bound package manifest:
$suiteArgs=((Get-Content -Raw package.json | ConvertFrom-Json).scripts.test -split ' ') | Select-Object -Skip 1
node @suiteArgs app/v5-evaluation.test.mjs
node verification/remediation-batch5-20261026/run-evaluation-cases.mjs NEW_UNIQUE_DIRECTORY
node verification/remediation-batch5-20261026/verify-retained.mjs
```

The case runner reads local retained batch 4 ledgers; if those ignored/raw files are unavailable in another checkout, regenerate labeled synthetic cases with the prior pinned engine. Do not substitute a different-release ledger silently. Raw data/collector logs are not added to source control. The retained verification script writes only its own batch 5 check output.

## Outstanding before W7 closure

1. Implement and independently challenge the separate funded fixed-exit attribution replay; no forged or altered risk certificates.
2. Source/adjudicate the twenty cases, run actual configured models, review original outputs and retain failures/disagreements. Current implementation verification is by the implementing agent, not independent consultancy sign-off.
3. Freeze the remaining comparison/stopping choices through explicit review before prospective outcomes; the proposal does not change rules.
4. Bind actual prospective daily-return/closed-opportunity provenance and collect enough authorized observations. Statistical code and the minimum sample floor do not demonstrate an edge.

See `agent/v5-evaluation.md`, `MODEL-CASE-BACKLOG.md` and `COMPARISON-AMENDMENT-PROPOSAL.md`. W8 usability, W9 integrated release acceptance, W10 authorized actual-session rehearsals and external source/rule/action gates remain open.
