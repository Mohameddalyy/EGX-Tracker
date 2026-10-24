# Remediation batch 3 — v5 calculations and research contracts

24 October 2026. **Implemented as an isolated manual component; schedules and paper testing remain inactive.** Base source release: batch 2 commit `542f9d2`.

## Implemented scope

| Plan item | Delivered behavior | Evidence and residual boundary |
|---|---|---|
| W5.1 version boundary | Separate `app/v5/` modules; runtime plan/schema copies pinned to frozen hashes; old indicator and decision code preserved | Byte-equality tests and retained-policy verification. Existing median-RV historical outputs are not relabeled v5. |
| W5.2 calculations | Fixed-window Wilder14 ATR; mean-prior20 RV; prior-high breakout; aligned SMAs/R63/EGX30; decimal piecewise ticks; prior-session liquidity tiers and nearest-rank prior126 RV; conservative turnover | Hand-calculated golden fixtures and negative boundary tests. Supplied official source/calendar/action assertions still require W3 authentication/admission. |
| W5.3 waterfall | Every supplied name/variant receives explicit gate outcomes. Distinguishes data blockage, thresholds, pending research and pending execution controls. Missing global calendar retains the entire cohort | Seven synthetic names × nine variants produce 63 rows. No-opportunity is unknown when unresolved data prevent that conclusion. No stock is dropped solely because a required field is unavailable. |
| W5.4 research packet | Typed evidence, source references and cutoff; numerical statement reconciliation; sector-specific financial model; three pillars, business/macro transmission, ownership/news/actions/liquidity, countercase and falsification requirements | Parser and arithmetic tests. No genuine analyst/model output was generated in this batch, and a valid text contract does not establish analytical truth or predictive support. |
| W5.5 overlap/comparators | Related momentum conditions disclosed as one family; confidence is qualitative; ablation packets omit only their registered overlays and reject dangling dependencies or removable critical evidence | FULL/FULL-BOUNDED mechanical equivalence test; peer/macro/sector omission tests. Actual separately committed model comparisons and shared-review timing remain W7 work. |
| W5.6 research disposition, partial | Bound Watch/Wait/Avoid with independent challenge, evidence contract, uncertainty, next review and target-free setup | Watch stops at AWAITING_RISK_AND_EXECUTION_CONTROLS. An independently executable, sized, fully validated intent remains contingent on W6; this item is not claimed closed end-to-end. |
| W5.7 capability naming | Daily trend-confirmation; early-warning lead time untested | Runtime output and operating contract use this wording. No edge or profitable-trading claim. |

Files: `app/v5/contract.mjs`, `math.mjs`, `signals.mjs`, `research.mjs`, pinned plan/schema, fixture helpers, `app/v5-agent.mjs`, `app/v5.test.mjs`. Operating contract: [agent/v5-signal-research.md](../../agent/v5-signal-research.md).

## Verification

- **203 tests passed; zero failed, skipped or cancelled.** This includes all 171 prior tests plus 32 new v5 tests. Full local log: `full-tests-final.log`. Full-suite elapsed time was approximately 5.03 seconds on this host; it is not live-source or analytical throughput.
- Golden calculations test RV outliers versus the preserved median method, fixed ATR seed/window, aligned SMAs/returns, current-high exclusion, zero/null volume, percentile ties and legal tick boundaries. Negative tests cover action-basis conversion, missing benchmark sessions, provisional/future capture, incomplete prior tier population and proxy turnover ambiguity.
- Research tests cover source exclusions, cutoff availability, optional/important versus critical gaps, sector-specific accounting, partial versus contradictory statement checks, omitted conditional value dependencies, source-bound pillars, wrong packet/variant/instrument, stale approval, same-actor challenge, critical dissent, unsupported probabilities and ablation context leakage.
- Explicit company-model classification was added during the review: a broad Finance sector is not enough to identify a bank. The final regression proves a bank-model review under a Finance sector without substituting operating-company ratios.
- `fixtures-final/` contains reproducible, labeled synthetic input, all 63 gate rows, packet, analyst/challenge fixture and research disposition. `fixture-summary-final.json` records 7 cash controls, 14 pending mechanical controls and 42 pending substantive research rows. These counts were engineered to test paths, not observed EGX opportunities. The supplied synthetic Watch remains nonexecuting and retains accounting/valuation uncertainty.
- The earlier fixture output remains in the local `fixtures/` directory; final acceptance uses `fixtures-final/`. No trading results were selected, erased or tuned.
- `retained-verification.json` confirms unchanged seven original policies, nine Phase 3 files, evidence dictionary and original paper ledger; all four automations PAUSED. The original experiment still has zero orders and fills. Historical 296-stock readiness comparison remains consistent and all 23 recovered notices are retained/routed.
- `runtime-status.json` reports the manual v5 capability and execution engine NOT_IMPLEMENTED. No production source refresh, new research decision, watchlist promotion, order, reservation, fill or settlement was created.
- Final release checks passed JavaScript syntax validation and Git whitespace validation. `.gitattributes` disables line-ending conversion for the frozen Phase 3 artifacts and their runtime copies, preserving byte hashes across Windows checkouts without changing the artifacts.

## Input and missing-data behavior

The numerical engine deliberately consumes an explicit admitted input manifest instead of pretending that the existing TradingView cache supplies authoritative trading rules or historical point-in-time identity. Required missing data produce named blocked gates and preserve the cohort. Optional fields do not blanket-exclude companies. Important financial, valuation, peer or sector gaps remain in the research disposition with attempted fallback, consequence and independent treatment; the default haircut is applied once. Critical gaps and negative mandatory sector strength cannot be waived by confident prose.

Prior-tier membership requires 262 sessions including the current signal day to calculate prior-session eligibility. B1/B2 retain their own 261-session signal result when only the extra tier evidence is unavailable. Older valid RV observations may be used without changing the fixed ATR window. The benchmark always uses the same verified session dates.

The engine checks provenance shape, arithmetic and declared temporal/effective coverage. It cannot authenticate a downloaded source, detect a deliberately false analyst assertion or infer a missing corporate action. Those remain substantive admission/review tasks. Artifact hashes bind content; they are not signatures establishing reviewer identity.

## Next batch and launch boundary

Next is **W6: full frozen decision-schema validation, Risk Agent evidence and independent challenge, deterministic funded sizing, certificates, reservation/order state machine, delayed chronological fills, settlement and mandatory exits**. Retain EGP100,000 per new independent paper portfolio and unrestricted justified FULL risk within immutable funded-cash/evidence/execution rules; bounded comparison ceilings stay separate.

W1 permissions and W3 effective-dated rules/identity/actions remain unresolved. W7 analytical evaluation, W8 client acceptance, W9 integrated release/fault tests and W10 actual-session rehearsals remain required. A passing numerical/research contract is not a passing trading system. **The prospective paper test is not ready to start; scheduled reviews remain paused.**
