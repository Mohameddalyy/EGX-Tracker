# Remediation batch 4 — risk and paper execution

25 October 2026. Base source commit: `c54a081` (batch 3). **Engineering components implemented and tested; prospective paper trading and scheduled reviews are not activated.**

Release digest (LF-normalized runtime/dependency sources): `c532d61c9e7b406b9f00e7aecc5b317734841cfa77f7451c5f72e12eef592a76`.

## Scope and evidence

| Work item | Implemented | Verification / remaining boundary |
|---|---|---|
| W6.1 schema and semantics | Full frozen Draft 2020-12 schema with date-time formats; complete check IDs; exact policy, release, instrument, variant, snapshot, calculation, quantity, monetary and chronology bindings | Rejects structurally valid but inconsistent decisions, stale approvals, missing checks and self-review. Hashes bind content, not authentic model identity or source truth. |
| W6.2 risk dossier | Zero/reduced/default/proposed allocations, deterministic whole-share budget sizing, nonnegative forward risk, issuer/sector/correlation exposure, base/stress stop costs, gap/settlement/liquidity/factor/principal/equity scenarios | Descriptive correlation uses admitted aligned histories. Unsupported sensitivities and future rules remain unquantifiable with required acceptance reasoning; no invented VaR/Kelly/probability. |
| W6.3 independent challenge | Separate risk actor, exact certificate/report/challenge bindings, objections, response and dissent; same-model roles explicitly disclosed | Synthetic contracts tested. No genuine Risk Agent/model experiment or independent financial judgment was performed; W7 must assess that. |
| W6.4 hard/soft rules | FULL accepts justified advisory exceptions without a hidden percentage cap; bounded arms cannot inherit exceptions; important gaps receive one aggregate haircut; cash, chronology, participation and frozen exits remain mandatory | Near-all-funded-cash FULL passes in a synthetic case. Unfunded, unknown override, late approval, invalid evidence and duplicate-position attempts fail. |
| W6.5 state and persistence | Visible proposed/blocked preparation; atomic accepted intent/reservation; reserved, filled, pending reconciliation, censored no-fill and persistent exit states; idempotent events; hash-checked SQLite replay | Dedicated isolated DB refuses production tables. Transaction rollback, restart, state tampering, duplicate minutes and cancellation/revalidation regression covered. |
| W6.6 timing | Pre-open acceptance; first-30-minute market window; declared-delay/capture/process limits; event-time authorization timeline; no retrospective approvals/fills | Delayed in-window fill works after window expiry. Cancellation preserves earlier authorized observations and prevents later ones. Reconciliation deadline releases reservation and censors missing entry evidence. |
| W6.7 accounting | EGP100,000 per independent variant/scenario; exact decimal products rounded to integer piastres; fees, funded reservations, fixed exit fee reserve, unsettled sale proceeds and T+2 business-day settlement | Full buy–stop–exit–settlement case reconciles cash, fees and realized P/L; lower entry price never increases quantity. Stress scenario resizes and retests fills independently. |
| W6.8 exits | Actual-time stop intent; source-bound daily calculation recomputation; next-session nonloosening trailing; trend/time/thesis exits; challenged full risk exit; pending liquidity/settlement/suspension | No same-minute entry/exit fill; stops before settlement remain exposed; risk review cannot postpone mandatory exits. Unresolved action-basis changes place affected positions on hold. Automatic corporate-action entitlement/cost-basis reconciliation remains unavailable. |
| W6.9 full-fill limitation | Frozen all-or-none entry and exit; no accumulated-volume or imaginary partial fill | Demonstrated persistent liquidation deadlock. Separate unapproved [partial-exit amendment proposal](PARTIAL-FILL-AMENDMENT-PROPOSAL.md); no policy amendment applied. |
| W6.10 stress | Concentrated allocation, shared-factor and 60-return correlation diagnostics, missing correlation, 25% reference volume, hypothetical repeated-band scenario, full-principal loss, feed/timing/settlement failures | Stress assumptions remain distinct from marks and fills. Market prevalence, model calibration and actual-session robustness remain untested. |

Implementation: `app/v5/schema.mjs`, `money.mjs`, `execution-rules.mjs`, `risk.mjs`, `execution.mjs`, `execution-store.mjs`, `execution-fixtures.mjs`, `app/v5-execution-agent.mjs`, and `app/v5-execution.test.mjs`. Runtime status now reports `ENGINEERING_ONLY_NOT_ACTIVATED`.

Operating instructions and actual Risk Agent input/output procedure: [agent/v5-risk-execution.md](../../agent/v5-risk-execution.md). Ajv/format-validator versions are pinned in `package.json` and `pnpm-lock.yaml`; dependency installation scripts were disabled.

## Test results

**238 tests passed; zero failures, skipped or cancelled tests.** Includes all 203 prior tests plus 35 new execution tests. The release run took approximately 6.43 seconds on this host. This measures local engineering checks, not source collection, analytical latency or prospective trading performance. Complete local log: `release-tests.log`.

Additional checks: JavaScript syntax checks, Git whitespace checks, manual CLI replay and preserved historical state verification passed. The tests detected a cancellation/revalidation defect during implementation; the fix and a named regression remain in the suite. New receipts cannot falsely claim an existing entry receipt or already-completed risk exit.

The source calculator caches unchanged complete-input hashes within a process and clones cached results before use. Changed input invalidates the cache. Portfolio correlation work is limited to the proposed name and held/pending names. Preflight, evidence, rules, portfolio state and approvals are still checked per intent. No reduced analytical scope or score-based assumption of unchanged news is introduced.

## Reproducible engineering cases

These prices, dates, rules and model-role outputs are **synthetic engineering fixtures**, including events dated after this report. They are not backfilled market observations, actual approvals, forecasts or strategy performance.

| Case | Result |
|---|---|
| B1/base complete lifecycle | 356 shares: modeled entry 70.18, later exit 68.82 after shares became sellable. EGP84.23 modeled total fees, EGP568.39 realized loss, final settled cash EGP99,431.61. Cash/fee/realized totals reconcile exactly. |
| FULL/base liquidity deadlock | 1,421-share entry. A later eligible minute with 1,000 shares permits only 10 under the 1% cap; full exit remains pending. Quantity and open exposure remain visible. No fictitious realized loss or stop-price fill. |
| FULL/stress zone rejection | Independently sized 1,419-share intent; adverse modeled entry is outside the approved zone. Missing coverage at deadline produces censored NO_FILL_EVIDENCE, no position, zero fees, EGP100,000 cash. This is not proof a real order would remain unfilled. |

All three stores survived close/reopen and deterministic event replay. Compact evidence: [release-ledgers-results.json](release-ledgers-results.json). Full local event streams, decisions, dossiers, states and SQLite ledgers are under `release-ledgers/`; they are excluded from Git as generated raw evidence. Reproduce into a new folder with:

```text
node verification/remediation-batch4-20261025/run-engineering-cases.mjs new-run-ledgers
```

Earlier local engineering runs remain preserved. Acceptance uses only `release-ledgers-results.json` and the stated release digest.

## Preservation and unfinished work

`retained-verification.json` confirms seven original policies, nine Phase 3 artifacts, the evidence dictionary and the original paper ledger unchanged; four automations remain PAUSED. The original experiment still has zero orders/fills. Retained 296-stock comparison has zero mismatches; all 23 recovered notices remain routed. No source collector, brokerage action, production watchlist promotion or real paper-pilot entry occurred.

The implemented entry/exit path is reached through isolated manual engineering interfaces. Production scheduler/dashboard integration, real model runs and actual-session acceptance are not claimed complete. Official rule/source permissions and verified corporate-action/settlement inputs remain W1/W3 dependencies. Automatic corporate-action cash/share/cost-basis application is not implemented: affected trading/valuation remains provisional until a reviewed reconciliation release exists. A severe capital action must never be bypassed to achieve a trade count.

Next implementation work is **W7: analytical validation and evaluation**, followed by W8 client action cards, W9 integrated release/fault/migration checks, and W10 separately authorized actual-session rehearsals. The larger W9 seeded/restart/session matrix has not been substituted with these component tests. The blocked external gates and corporate-action handling must be resolved before a prospective cohort can pass readiness. **No restart of scheduled reviews or pilot activation is authorized by this batch.**
