# EGX v5 — frozen test and evaluation plan

**Phase 3, 23 October 2026. Version v5-test-plan-1.0.**
This specifies tests; it does not report that v5 has passed them. No paper week or schedule starts in this phase. New starting capital is EGP 100,000 per independent portfolio. FULL permits justified discretionary risk within funded cash, while FULL-BOUNDED supplies a hard-limited comparison.

## 1. Claims and independent outcomes

Use separate result fields:
- **Specification integrity:** complete contract, consistent parameters, recorded user choices, frozen hashes.
- **Software correctness:** arithmetic, state transitions, chronology, persistence and guard behavior.
- **Operational readiness:** data, scheduler, reports, monitoring and research throughput.
- **Paper observations:** actual recorded hypothetical actions/fills and modeled returns.
- **Analytical value:** whether the research/risk overlays improve decisions against declared comparators.
- **Investable performance:** unavailable unless adequate, unbiased evidence supports a specific claim; never inferred from one successful week.

Possible outcomes are PASS, FAIL, BLOCKED or INCONCLUSIVE, with denominators and reasons. A safe refusal on bad data can pass a control test while failing the experiment's readiness goal. Zero trades can pass decision-integrity checks, but cannot pass trade-profitability or sizing-quality claims.

## 2. Trial registration and freeze

Before the first replay outcome is scored:
1. Hash the trading plan, Risk Agent mandate, parameters, decision schema, data dictionary and this test plan.
2. Record code revision/content digest, Node version, dependency versions, random seeds, data hashes and source/adjustment vintages.
3. Register all nine strategy variants and both friction scenarios. Retain failures and unavailable variants.
4. Record actual LLM identities/configurations, prompt hashes, tool permissions and reviewer separation. No fake model comparisons.
5. Bind a data-admission manifest before outcomes are read. No choice of favorable symbols/dates after inspecting returns.

A subsequent implementation bug fix creates a new code digest and linked defect record. If it changes results, keep both result sets, label the contaminated window and use a fresh prospective cohort after review. No rewriting the original forecasts.

Multiple-tested backtest selection can create false discoveries; explicit trial accounting is required. This plan does not claim to calculate PBO from an inadequate sample. [Bailey and coauthors, Probability of Backtest Overfitting](https://www.davidhbailey.com/dhbpapers/backtest-prob.pdf).

## 3. Frozen comparison matrix

| ID | Rules and purpose |
|---|---|
| B0 | Idle EGP cash, 0% interest; not an assumed risk-free investment yield |
| B1 | Shared technical signal and integrity/market checks; no RV gate or discretionary thesis/risk overlay |
| B2 | B1 plus fixed RV20 >=1.5 |
| B3 | B2 plus completed analyst/final company, peer, macro and sector review |
| FULL-BOUNDED | B3 with tier-aware RV; bounded sizing control |
| FULL | Same eligible opportunity stream as FULL-BOUNDED, plus the discretionary Risk Agent; declared champion before outcomes |
| FULL-NO-PEER | FULL with peer comparison and its noncritical-gap penalty removed from the analytical packet; critical company/solvency checks retained |
| FULL-NO-MACRO | FULL with macro overlay removed; material-event and corporate-action safety checks retained |
| FULL-NO-SECTOR | FULL without sector-relative-strength eligibility; sector/exposure risk analysis retained |

B1/B2/B3/FULL-BOUNDED use the fixed control envelope: 1% selected planned risk per position, 4% aggregate forward risk, 25% stock/issuer group, 40% sector/correlation cluster, 10% cash reserve, six positions, 2% daily and 4% experiment drawdown entry stops. Required fees, cash, validity and participation checks also apply. The 50% important-gap haircut applies once when relevant. These are **comparison rules only**, not concealed ceilings on FULL.

Concentration safeguards are never removed from a supposedly identical “risk-free” comparison; the unbounded champion still reports all exposures. Primary allocation attribution is FULL versus FULL-BOUNDED. Both receive the same completed thesis decisions and opportunity timestamps. The bounded control may differ in cash availability and fills, so report:
- Full separate-portfolio paths, including abstentions, reservations and missed opportunities.
- A matched-opportunity analysis of chosen allocations when both were eligible, explicitly conditional and not a substitute for portfolio returns.
- Risk/exposure differences, not only P&L.

For the analytical ablations, use separately committed packets/reviews with the relevant context removed. Do not fabricate counterfactual reports by editing the successful champion's answer after the outcome. If genuine ablation outputs are unavailable, mark that comparison untested.

FULL's mandate includes discretionary earlier full risk exits; the bounded control uses mandatory stop/trend/time/thesis exits only. The primary comparison therefore measures the combined allocation and risk-exit mandate, not sizing in isolation. Report risk-exit timing and its opportunity costs explicitly. A prespecified diagnostic replays both portfolios' recorded desired entry intents with mandatory exits only, tagged FIXED-EXIT-ATTRIBUTION. Recompute chronological cash, settlement, sizing, reservations and fill feasibility: suppressing an early sale may leave a later desired purchase unfunded, requiring a smaller or blocked counterfactual order. Preserve the original desired cash/planned-loss budgets as ceilings, never copy original fills or exceed desired quantities. Report every path divergence. No new model decisions are inferred for these altered states, so this is a conditional mechanical attribution calculation, never a tenth competing strategy or a portfolio that actually ran.

Decision contracts reflect the comparisons: B1/B2 need deterministic control validation without invented analyst or Risk Agent approvals; B3/FULL-BOUNDED additionally require substantive Watch review. The four discretionary FULL variants require independent Risk Agent certificates. B0 cannot issue BUY/SELL. Mandatory exits do not wait for discretionary risk review.

Both base and stress costs rerun the full simulator, including sizing, fill feasibility, settlement and cash. B0 does not incur trading costs. Report all registered results, not just the most favorable one.

## 4. Dataset admission and replay boundaries

Required catalog: dated identity, instrument class, currency and eligibility; preserve inactive/delisted names when historical evidence supports them. Every price series needs source, observation/capture times, adjustment basis, raw-volume validity and corporate-action reconciliation. Financial facts need publication availability, economic period and original/revised vintage.

Historical data downloaded today do not prove what was known then. A document with only a publication date is conservatively available after that date's verified session close, not at 09:00. Unknown publication date excludes it from point-in-time tests.

Minimum historical **technical feasibility** replay, if available:
- Last 120 common verified signal sessions ending no later than 22 October 2026.
- First 60: engineering/development fixtures; next 30: integration validation; last 30: locked feasibility comparison.
- Each signal has 261 verified lookback observations and enough future data for the relevant outcome, or is explicitly censored.
- No statistical parameter fitting in these fixed-rule windows. If a fitting model is later introduced, register a new trial with at least a 60-session label purge/embargo for 60-session outcomes and enough extra data; do not pretend the current split supplies it.

These historical windows are **not claimed untouched**: the project has already inspected past market data. Their purpose is replay correctness and feasibility, not clean out-of-sample alpha. Publication-vintage, survivorship and missing-minute defects remain visible.

The primary strategy uses minute fills. If suitable historical minute data are absent, do not silently substitute daily opens. Use a separately labeled **D1 daily feasibility simulator**: decide from confirmed prior-day data, consider next-session open with identical zone/cost checks and daily participation, record same-day path ambiguity conservatively, and evaluate stops at a later eligible daily open. D1 is not primary fill validation, cannot demonstrate intraday responsiveness, and must not be blended with prospective minute results.

B3/FULL historical evaluation is unavailable where point-in-time research cannot be reconstructed. Price-only B1/B2 replay does not establish that the analytical agent could have made those decisions. Register prospective source snapshots to create a valid future evaluation set.

## 5. Software and adversarial tests

Implement these in Phase 4 and execute in Phase 5 on isolated fixtures/copies, never by corrupting the old paper ledger.

| Test group | Required cases and expected result |
|---|---|
| Identity/catalog | USD price in EGP helper, ticker reuse/ISIN mismatch, absent scanner member, temporary listing -> block affected allocation; retain catalog/backlog history |
| Sessions/finality | Pre-open/prior-session reuse, weekend, holiday, Ramadan, Cairo DST, midnight rollover, provisional close -> correct completed-session selection; no fixed UTC assumptions |
| Missing data | Null versus zero volume, stale successful SAIB-like history, missing bars, action-adjusted mismatch -> no invented valid signal/fill |
| Signal math | Breakout excludes current high; RV20 excludes current volume from denominator; fixed ATR seed; SMA/benchmark session alignment; tier percentile excludes t; tie handling deterministic |
| Event timing | New news with unchanged technical score, syndicated duplicate, late received event, revised statement -> route review by actual availability; preserve original record |
| Critical/optional | Missing corporate-action terms block; missing consensus does not; important-gap exception retains honest missingness and cannot reclassify critical data |
| Price/cost | Piecewise tick threshold, band change, fee minimum, rounding, stress fill outside bar/zone -> revalidate or no fill; no double-counted slippage |
| Cash/settlement | Pending orders, two simultaneous approvals, unsettled proceeds, exit-fee reserve -> no negative/unfunded cash or duplicate reservations |
| Delayed fills | Order before/after bar start; old bar arrives late; stop observed after vendor delay; processing backlog -> never execute before actual decision; no same-minute entry/exit |
| Liquidity/exits | 1% daily/minute caps, no partial full exit capacity, halt, limit lock, settlement lock, missing minute -> pending exit, actual exposure, no imaginary stop fill |
| Risk discretion | Valid near-all-funded-cash FULL position passes; same position fails bounded control; persuasive unfunded request fails both |
| Overrides | Complete allowlisted sizing/drawdown exception passes FULL; missing challenge, retrospective approval, stale certificate or attempted signal/stop bypass fails |
| Portfolio risk | Winning position still has mark-to-stop downside; missing correlation is not zero; common FX/sector stress shown; scenarios do not overwrite marks |
| Lifecycle | Duplicate heartbeat/job, owner alive, crash after write, restart, lease fencing -> exactly-once logical outcome, no owner takeover or hidden stalled state |
| Deadline | Slow/hung collector, source timeout, full queue, missed wakeup -> partial report inside hard deadline, durable remainder, explicit incident |
| Coverage | All recorded decisions including Wait/Avoid/superseded checked; all held/approved names accounted for; six setup tickers never define universe |
| Isolation | No writes to prior experiment/live profile or real orders; policy hashes, old forecasts and fills unchanged |
| Accounting | Corporate actions, dividends, fees, stale marks, unsettled cash, rounding -> reconciled cash/equity; undefined metrics remain undefined |

In addition, run **1,000 seeded generated arithmetic/state cases** (seed 20261023) covering tick boundaries, quantities, cash reservations and delayed timestamps. Assert nonnegative funded cash, no fill outside valid chronology/price conditions, no immutable-control override and deterministic replay. These are invariant tests, not random return optimization.

Required release result: 100% mandatory cases and invariants pass; zero critical defects. A skipped mandatory test is BLOCKED, not pass. Rerun only affected tests plus relevant invariants after a fix; preserve original failures.

## 6. Operational dress rehearsal

Before any prospective paper entry:
- Three complete session-equivalent historical/fixture replays, including one source outage and one mid-run restart.
- Two consecutive actual verified exchange-session days in **no-order shadow mode** on the intended host, with all checkpoints and monitoring enabled only after separate user authorization.
- Confirm full baseline coverage accounting, working source routes, original-disclosure ingestion, collector ownership, ledger writes, model availability and report delivery.
- Freeze a verified official rule bundle for sessions, auctions, holidays, ticks, references/bands, tradability/halts and settlement calendar. An unresolved global critical prerequisite is a readiness failure; a blocked single instrument is excluded with explanation.

Runtime targets and hard limits:
| Stage | Target | Hard limit |
|---|---:|---:|
| Baseline assembly | 25 min | 30 min |
| Cached screen | 2 min | 5 min |
| Checkpoint | 5 min | 8 min |

Reserve the final minute inside each stage for saving partial state/report; no claim that a hung process was stopped unless termination/cancellation is verified. Every hard deadline produces an explicit result and remainder. Deep analysis has no token/time truncation; it checkpoints and continues independently, and unfinished research prevents that setup's entry.

At each actual session: 08:00 baseline, 09:00 preparation, 10:45 and 14:35 report checkpoints, plus close + actual feed delay +30-minute finalization. Five-minute monitoring during the verified session continues through close + delay +5 minutes. These are future schedules, not changes made now.

## 7. Pre-flight and prospective five-session pilot

The future activation record must include start date, five consecutive actual exchange-session entry dates, capital EGP 100,000, approved plan hashes, code digest, rule/data manifests, environment/model configuration and explicit schedule-resume authorization. No automatic date is inferred from “phase 3.”

Every day, before session open:
- Current coherent holdings/cash/reservations/settlement and valid marks.
- Source/collector health plus sample data validity; launch success alone fails.
- Current session/rule/event coverage and correct signal/approval expiries.
- Baseline and benchmark data admitted; individual missing instruments visibly excluded.
- Ledger write/read round-trip and report path.
- Deadline/recovery settings, model availability and Risk Agent/challenger availability.

Failure blocks new orders, produces a report and retains holding/exit monitoring. Do not count every catalog stock as a newly researched NO-TRADE decision.

Only signals with complete approvals before the next session opens may trade in the first30-minute window. Deep research throughput cannot be “fixed” by shortening required work. Use the previous evening and reusable current dossiers to prepare candidates.

After five entry sessions: no new entries. Manage existing positions under frozen exits, publish the operational review, and continue 5/20/60-session outcome observation when separately scheduled. Follow-up is not authorization for a second entry week.

## 8. Prespecified pass/fail gates

| Gate | Passing requirement | Failure / inconclusive treatment |
|---|---|---|
| Safety/accounting | Zero real orders, unfunded cash, corrupted history, chronology violations or immutable-rule bypasses | Any occurrence -> FAIL, suspend affected activity |
| Decision completeness | 100% held/approved names and considered candidates have a recorded disposition; empty set has explicit run result | Any silent omission -> FAIL |
| Reporting | 100% expected checkpoint reports; start no later than five minutes after scheduled time; hard runtime limits respected with partial output | Missed report/start or unreported overrun -> FAIL |
| Coverage | 100% catalog identity/backlog states reconcile; 100% recorded decisions receive obligation checks; >=90% eligible ordinary-EGP universe has valid baseline data | Denominator known; below threshold -> readiness FAIL, never “all researched” |
| Critical source readiness | No unresolved market-wide critical blocker lasting an entire session | Whole session blocked -> readiness FAIL even if safe refusal worked |
| Research throughput | >=80% of mechanically signaled, otherwise data-eligible opportunities receive a substantive completed analyst/final disposition before next-session open | Below threshold -> workflow capacity FAIL; do not force approvals or call incomplete work rejection |
| Risk governance | 100% FULL allocations have alternatives, scenarios, challenge and valid certificates; all advisory departures recorded; bounded control never exceeds its hard rules | Missing rationale/review -> FAIL |
| Fill evidence | Every fill traceable to later eligible data, modeled costs and capacity; all unfilled intents retained | Any fabricated/unsupported fill -> FAIL |
| Exposure observation | 100% scheduled held/approved-name monitoring attempts recorded; any source gap reported, no silent stale marks | Repeated unobserved held exposure -> readiness FAIL; P&L provisional |
| Pilot performance | Report all registered variants/cost scenarios and aligned benchmarks; no minimum trade/profit quota | No fills or immature outcomes -> INCONCLUSIVE for profitability/sizing |
| Continued research eligibility | Operational and safety gates pass; unresolved limitations stated | Passing week permits a review, not automatic expansion or live trading |

The 80% throughput target is measured over the actual signal set, not all 294 companies. When there are zero mechanical opportunities, report N/A, retain the full backlog and assess throughput using the preregistered dry-run opportunity set. The metric is a capacity test, not a reason to prefer easiest-to-research companies or change signals.

## 9. Performance and analytical evaluation

Store each portfolio's actual modeled daily equity and cash separately. Use aligned EGX30 and EGX70EWI price-index changes from the same previous-session close preceding the pilot through each evaluation close, plus 0% idle cash. Explain that an index benchmark is contextual and not a fee-free executable portfolio. Do not mix price-index returns with a portfolio including dividends without showing the dividend contribution and mismatch; add verified total-return comparisons only if available.

Metrics: net modeled return; realized/unrealized P&L; fees and slippage; initial-risk R-multiples; expectancy; hit rate; profit factor; observed drawdown and recovery requirement; turnover; exposure/concentration; settlement/exit delays; unfilled opportunity count; implementation shortfall with stated reference; aligned benchmark excess return. Cash flows and dividends reconcile. Ratios with zero denominator and horizons not matured are unavailable, not zero.

No Sharpe/Sortino or one-week return annualization is used to claim an edge. Report longer daily risk ratios only with their sample size, return basis and cash reference. Stop loss is not maximum loss; show stress scenarios separately from observed drawdown.

Forecast outcomes anchor to the original confirmed signal close and measure 5/20/60 later exchange-session closes on a consistent adjustment basis. Trade outcomes anchor to actual hypothetical fills. Do not merge these denominators. Retain censored, stale and missing outcomes, rather than dropping inconvenient cases.

**Minimum research gate before making a statistical superiority claim:** at least 126 prospective session observations and 100 closed trades/opportunities appropriate to the stated estimator, across independently registered cohorts, with mature/censored labels and uncertainty accounting. These thresholds are minimums, not guarantees of power. The five-session pilot alone cannot meet this gate and does not authorize those additional cohorts.

For paired daily portfolio differences, predeclare moving 20-session blocks sampled with replacement, 10,000 replicates, seed20261023, and show the percentile 95% interval plus sensitivity to serial dependence. Insufficient blocks mean inconclusive inference. For significance claims, use two-sided block-bootstrap tests centered under the null and Holm adjustment at family alpha 0.05 over eight FULL-versus-other-variant comparisons in each of two cost scenarios (16 hypotheses, retained even if some are unavailable; unavailable p-values count as 1). The matched-opportunity and fixed-exit diagnostics are descriptive, not additional superiority claims. No model is automatically promoted.

FULL's added risk is evaluated against FULL-BOUNDED in return-versus-drawdown, concentration, tail-scenario loss, liquidity, turnover and drawdown-recovery space. Without a user utility function, do not declare an allocation “optimal.” Greater returns with greater losses/exposure are a tradeoff, not an automatic victory.

## 10. Genuine language-model and Risk Agent evaluation

Use at least 20 frozen varied dossier cases where evidence permits: banks, nonfinancials, property, stale data, corporate actions, conflicting statements and thin liquidity. Each actual model receives identical task/evidence/tool access, is blinded to later outcomes and other answers, and can inspect original sources. No token cap.

Record actual model/configuration, complete outputs, durations and source/tool calls. A separate reviewer scores sector reasoning, counterevidence, numerical interpretation, decision usefulness and uncertainty handling on a fixed 0–4 rubric:
0 absent/wrong; 1 largely unsupported; 2 mixed with material gaps; 3 sound with minor limitations; 4 well-supported, reconciled and decision-relevant.

Data-quality gate: zero fabricated critical facts/citations, zero critical unit/period/identity errors, >=95% accuracy on independently verified extracted numerical facts. Report missingness and disagreements separately. Passing a small case set establishes fixture performance, not universal reliability.

For Risk Agent cases, evaluate both justified concentration and justified abstention. Penalize unfunded arithmetic, missed correlated exposure, unsupported probabilities and silent overrides—not merely high risk, which the user explicitly authorized for the paper experiment. The reviewer checks whether the chosen risk was reasoned before outcomes; a profitable reckless argument does not become sound in hindsight.

## 11. Visibility and anti-failure alerts

Each run summary shows actual time/duration, status, source freshness, scope counts, positions, considered candidates/actions, news deltas, risk decisions/exceptions, cash categories and unresolved work. The daily report adds marked P&L quality, every action/fill, stopped/unfilled exits, coverage/queue age, failures and comparisons.

Immediate meaningful incidents: missed checkpoint, unrecorded disposition, hard deadline failure, lost collector ownership, ledger error, stale held exposure, missing critical disclosure, invalid certificate, unfunded request and proposed immutable bypass. A healthy unchanged poll stays quiet. No hiding these failures behind a positive screen score.

The final review distinguishes: genuine analytical rejection; expired/untriggered approved setup; blocked data; pending research; insufficient capacity; and intentional risk abstention. Explain zero trades using these counts. Never present blanket NO-TRADE rows as full-company research.

## 12. Completion and later amendments

Phase 3 ends with a hashed specification and explicit unresolved environmental prerequisites. Phase 4 builds it. Phase 5 executes the mandatory tests and dress rehearsal before requesting activation of the prospective pilot. No scheduled reviews resume until the user explicitly authorizes that step.

Later changes are proposals with rationale, evidence, regression risks and a new version/cohort. They do not retrain models, modify production rules automatically or repair the historical experiment by rewriting it.

## 13. Additional contract regression cases required before activation

- A valid preapproved in-window bar arriving after market-window expiry reconciles before the declared deadline; no post-window market bar fills. Cash stays reserved through reconciliation. An unresolved observation at the deadline becomes NO_FILL_EVIDENCE with a censored outcome and coverage failure; later data cannot silently insert a historical fill.
- The order's own atomic reservation preserves its certificate through the accepted-order receipt. Another order's commitment triggers deterministic revalidation without increasing quantity; material evidence cancels at its actual time. Cancellation does not erase an earlier authorized market event that arrives late.
- Max planned loss and max cash allocation are separate fields. Approved BUY requires at least one positive budget; both constrain quantity when present. An absent budget is null, never silently interpreted as unlimited cash or a zero-loss guarantee.
- B1/B2 can produce a structurally valid technical BUY with UNREVIEWED research and no Risk Agent certificate, but cannot bypass complete deterministic controls. FULL with the same missing research/certificate fails. B0 BUY/SELL fails.
- A risk-led full exit requires a SELL certificate, alternatives and independent challenge. A mandatory stop exit proceeds without a fresh discretionary certificate. No certificate postpones mandatory exits or widens stops.
- Schema validity alone never grants authority. Semantic validation verifies all required check IDs, source admissibility, identity/quantity/hash agreement, distinct approving/challenging actors, monetary arithmetic, actual time ordering, valid reservations and market rules. A fabricated 'passed' field must fail semantic validation.

