# EGX v5 — prospective paper trading plan

**Phase 3 specification, prepared 23 October 2026. Paper only; not activated.**
Version: v5-paper-plan-1.0. The [machine-readable plan](plan.json), [Risk Agent mandate](RISK-AGENT.md), [test plan](TEST-PLAN.md) and final freeze manifest form one specification. **Starting paper capital: EGP 100,000**, explicitly selected by the user. The user authorized **any amount of justified paper risk**, so FULL has no fixed percentage risk, concentration or cash-reserve ceiling. Funded cash, no leverage, valid evidence and the frozen execution/strategy rules remain binding. This is authorization to specify the experiment, not to activate it.

This is a new isolated experiment. The completed October 11–15 experiment, live profile, watchlists and old decisions remain unchanged. Implementation belongs to Phase 4; testing and any future activation belong to Phase 5. All four existing schedules stay paused.

## 1. Hypothesis and scope

Test whether a verified liquid-stock daily breakout/trend process, supplemented by company economics, independent challenge and portfolio-aware risk allocation, improves decisions over a simple technical baseline after declared costs and delayed execution constraints.

The declared champion is **FULL**: trend/breakout + tier-aware volume + complete analytical review + Risk Agent + independent final approval. Its simpler comparators are frozen in the test plan. This is a hypothesis, not a selected historical winner.

Discovery covers the full reconciled EGX catalog. Trading eligibility is narrower: native EGP primary ordinary common shares with verified trading status, identity, settlement calendar, session rules, ticks and daily price bands. Exclude USD shares, rights, funds, preferred securities, OTC, derivatives and unresolved special market segments. Retain excluded/unavailable names in coverage records; do not delete them or ignore their historical decisions.

No leverage, shorting, pyramiding, averaging down, new entries after the entry week, or real orders. Existing real holdings do not become paper holdings. All comparators use separate hypothetical ledgers and identical starting conditions; they do not share or multiply actual capital.

## 2. Data and deterministic calculations

At signal session t, require 261 consecutive verified exchange-session observations on a coherent corporate-action basis. A confirmed official unchanged close on a no-trade session is distinct from missing data; never interpolate absent bars. At least 18 of the latest 20 sessions must have positive verified volume.

Use confirmed, completed daily bars captured after the verified session close plus actual feed delay plus 30 minutes. Preserve actual publication/capture times. Price-action calculations use coherent action-adjusted history; entry/exit prices and participation use raw current-price/share units. A valid conversion between bases is mandatory. Unknown adjustment basis blocks the setup.

Definitions:
- SMA(n): arithmetic mean of the latest n completed closes, including t.
- True range: max(high-low, abs(high-prior close), abs(low-prior close)).
- ATR14: Wilder smoothing, seeded by the first 14 of the last 260 true ranges, then recursively updated through t. This fixed window requires 261 bars and avoids dependence on an unspecified history length. It differs from the simple-TR mean used by some existing analytical prototypes; this version must be tested separately.
- H20: maximum high of t-20 through t-1, excluding the signal day.
- R63: C[t]/C[t-63]-1. Benchmark return uses the same sessions.
- RV20: V[t]/mean(V[t-20..t-1]); missing or zero denominator is invalid.
- Median turnover20: median of actual daily traded EGP value if available. Otherwise use the labeled typical-price-times-volume proxy for ranking, and require the conservative median(low × volume) to clear the eligibility floor. A proxy that changes eligibility relative to its bounds requires review, not optimistic rounding.

Eligibility floors: median daily turnover at least **EGP 2 million**, ATR14/close no greater than **8%**, and current tick/close no greater than **1%**. These are preregistered prototype parameters, not findings of optimality.

Every field follows the Phase 2 dictionary, with explicit Phase 3 refinements in the Risk Agent mandate. Missing critical data block a new entry; optional consensus/ratings are not mandatory. Current statement validity is assessed by period, expected filing deadline and material events, not a universal 36-hour expiry of financial accounts.

## 3. Signal and volume gate

All technical conditions must hold on session t:
1. C[t] is at least the next valid tick strictly above H20.
2. C[t] > SMA50[t] > SMA200[t].
3. SMA50[t] > SMA50[t-10].
4. R63[t] > 0 and R63[t] >= EGX30 R63[t].
5. EGX30 close is above its SMA200.

This is an end-of-day signal; a 10:45 price touch or incomplete daily candle is not equivalent. If benchmark data are unavailable, do not silently remove the market gate.

For FULL, assign a liquidity tier using **prior-session** median turnover among eligible names, descending, ties by ISIN. With rank r starting at 1 and N names, tier=min(3,ceil(3r/N)). Compute the stock's prior 126 valid RV20 observations, excluding t. Use nearest-rank percentiles 80%, 85%, 90% for tiers 1, 2, 3 respectively. Required RV20 is max(1.5, that percentile). Missing the 126-observation sample blocks this variant; it does not silently switch to the fixed variant.

B2/B3 comparators use only RV20 >=1.5. No threshold grid, post-loss relaxation or automatic learned changes. Intraday matched-time relative volume is diagnostic in this first experiment, not an additional moving entry threshold.

## 4. Analytical approval

Before the next session opens, the analyst and final reviewer must complete source-backed financials, ownership, news, corporate-action, technical and liquidity review at the required field granularity. Historical Wait/Avoid notes do not authorize the new setup.

The thesis includes business drivers, recurring versus one-off earnings, cash conversion, debt/refinancing, sector-specific solvency, ownership/control risks, valuation support where feasible, dated catalyst, strongest countercase, alternative explanation, material uncertainties and explicit falsification conditions. Banks use capital, asset quality, funding and margin evidence; industrial ratios cannot substitute.

Peer comparison requires at least five comparable valid names, consistent periods and positive relevant denominators. Missing peers prevent a relative-cheapness claim and invoke the important-gap policy. They do not make a standalone model's verified facts false.

Macro analysis must connect rates/FX/inflation to the company's actual revenue, costs, financing and valuation. An unsupported macro view cannot increase size. Sector strength uses the median 20-session return of eligible peers excluding the target, minus aligned EGX30 return; require at least five peers and 80% eligible-sector coverage. Negative relative strength blocks FULL entry; unknown sector strength is an important gap. This negative-strength eligibility gate is not a Risk Agent sizing guideline and cannot be overridden during the frozen experiment.

A low-confidence, materially contradictory or incomplete critical thesis cannot pass on an attractive chart. Confidence is qualitative evidence strength, not a probability inferred from agent agreement. The Risk Agent may require more work or reject the opportunity even after analytical approval.

## 5. Entry, expiry and allocation order

From the confirmed signal:
- Lower entry boundary = H20 rounded up to a valid tick.
- Buy limit = C[t] + 0.25 × ATR14[t], rounded down to a valid tick.
- Initial stop = C[t] - 2 × ATR14[t], rounded down to a valid tick.
- Require positive stop and lower boundary <= limit. Final entry, risk and price bands are revalidated after rounding.

The analyst/final/risk approvals and morning preflight must be committed **before the verified continuous session opens** on t+1. An unfinished report does not become a later same-day approval of an already-observed opening move. If not ready, NO-TRADE/RESEARCH_PENDING. No backdating.

Entry window: market-bar starts in the first **30 minutes** of continuous trading on t+1. At that window's end, no later market event can fill; the order enters EXPIRED_PENDING_RECONCILIATION until the delayed in-window bars are resolved. Cash and fee reservations remain until reconciliation, whose deadline is window end + declared feed delay +6 minutes (five minutes capture tolerance plus one minute processing). A valid earlier authorized in-window event may therefore be recorded after window expiry. No carry-forward or market chasing. Only a new qualifying daily signal can create another setup; no entry in an already held name or one with a pending entry.

Research/allocation rank: descending R63 minus EGX30 R63, then descending median turnover20, then ascending ISIN. Existing exits and settlements are processed before new allocation. The Risk Agent can size down or reject a higher-ranked candidate and choose among otherwise eligible candidates with recorded portfolio reasoning; it cannot promote an ineligible name. Any such choice is an analytical deviation measured against the deterministic baseline.

Use one coherent portfolio snapshot and allocate sequentially with reserved pending-order cash/risk. Size using the entry limit, not an optimistic expected opening price. A cheaper fill never increases the preapproved share count.

## 6. Floating risk and portfolio mandate

Risk is selected per opportunity by a separate Risk Agent within funded, unlevered paper capital. It can choose zero, reduce exposure for uncertainty/liquidity/concentration, or allocate up to all available funded paper cash when justified and independently challenged. It cannot change critical data requirements, entry/exit rules or evaluation criteria. Full capital loss is possible; planned stop loss is not a worst-case bound.

The complete funded-cash mandate, override process and risk-record schema are in [RISK-AGENT.md](RISK-AGENT.md). Numerical share quantities are computed by code after the Risk Agent selects separately named planned-loss and/or cash-allocation budgets. The language model does not hand-edit the result.

Additional frozen controls:
- Whole shares; no borrowed cash.
- Maximum participation **1% of prior median daily shares** and **1% of the observed fill-minute shares**. Both apply.
- Default sizing guidelines are 1% planned loss per position, 4% aggregate planned loss, 25% stock/issuer-group exposure, 40% sector/cluster exposure, 10% cash reserve and six positions. **These are advisory for FULL**, not user-imposed ceilings. Departures require a scoped Risk Agent exception and independent challenge. They remain hard only in the bounded comparison portfolio.
- Correlation clusters use connected components of pairs with correlation >=0.8 over at least 60 aligned daily returns. Missing correlations are important uncertainty, never zero correlation; assess shared economic exposures even when correlations look low.
- **2% daily observed equity drawdown** from that day's opening marked equity and **4% experiment peak-to-trough drawdown** trigger a mandatory risk review and pause pending entries. The Risk Agent may authorize continued entries only through a new, independently challenged exception explaining the loss, changed evidence and alternatives. No silent reset or automatic liquidation.
- The default aggregate important-gap haircut is 50%, applied once. It can be overridden for a genuinely noncritical gap with the same exception process; critical gaps cannot be renamed or bypassed.
- Unreliable portfolio valuations block new entries. Existing risk remains visible.

The drawdown thresholds are frozen advisory review triggers, not maximum-loss promises. Unknown/stale marks cannot establish that a threshold has not been breached. Continued risk after drawdown is separately reported and compared against the bounded control.

Sizing searches for the largest integer quantity within the Risk Agent's selected monetary budget after the applicable gap multiplier, then applies funded settled cash, fee reserves, liquidity and any tighter conditions retained in the risk certificate. Advisory limits apply unless explicitly overridden. For risk, use worst entry limit less an adversely slipped/rounded stop exit, plus variable costs and both fixed fees. The selected budget is a ceiling, not a requirement to deploy it. Reserve fixed exit fees as well as entry costs; cash and reservations can never become negative. Report requested versus feasible risk separately.

Aggregate risk includes pending positions and each existing position's nonnegative loss from its current valid mark to its adversely modeled stop plus exit costs. Never offset a risky position with a hypothetical negative risk from a raised stop. Report original initial risk separately for R-multiple attribution.

## 7. Exit and holding policy

No fixed take-profit order. This avoids inventing a target merely to satisfy a reward/risk ratio. The strategy is a trend-following experiment with stop, trailing and time exits. Financial valuation scenarios remain evidence and risk inputs; they are not automatically executable short-term targets. This explicitly differs from the old experiment's minimum-target-reward/risk gate and requires a new version, never a bypass of that old policy.

Initial price risk Rprice = actual entry price minus initial stop. R-multiple reporting uses the original monetary risk including planned costs; never rewrite that denominator.

After a confirmed daily close reaches actual entry + Rprice, activate trailing for the next session and keep it active. At each later daily finalization:
new stop = max(previous stop, floor-valid-tick(highest completed daily close since entry - 2 × current ATR14)).
Never loosen a stop. If the computed stop is already above the current market, record an exit intent rather than pretending an earlier fill.

Other exits:
- Confirmed close below SMA20: exit intent for the next continuous session.
- Maximum hold: after the 20th exchange session, counting the entry session as 1, exit at the next eligible continuous-session observation.
- Source-backed material thesis invalidation: independent review commits the exit intent at its actual decision time. Missing information alone produces urgent review and blocked new risk, not an invented forced sale.
- Risk-led earlier exit: the Risk Agent may choose a full exit from an existing holding after documenting its changed portfolio/liquidity/downside assessment, alternatives and independent challenge. This is a predeclared discretionary exit rule. It may bring an exit forward, never cancel/delay an already triggered exit or widen a stop. Missing critical execution data still prevent an observed fill, not the recording of the exit intent. No partial trimming in this version.
- A stop breach observed in a completed minute produces an exit intent at actual receipt/processing time.

Stop/mandatory exit intents take priority over new entries. A pending exit cannot be canceled because the price later recovers. If settlement, suspension, volume or a limit queue prevents a fill, keep the position and retry at the next valid observation; report unfilled exposure.

No forced liquidation at Thursday or at the end of five entry sessions. Close positions only under these exits; keep 5/20/60-session outcome observations after the entry window. Never open new entries after the fifth authorized session.

## 8. Chronological delayed paper fills

The Phase 2 sample showed a 900-second delayed feed. This plan models decisions made with information actually received, not ideal real-time trading. No real-time entitlement is assumed. [TradingView coverage](https://www.tradingview.com/data-coverage/).

Maintain separate timestamps: market bar start/end, vendor delay, capture/receipt, decision commit, order intent, and fill-observation commit. For a new action, the eligible bar must start strictly **after** order/exit-intent commit time. Do not use a historically earlier minute simply because it arrives after the decision.

Entry fill:
- Completed raw one-minute bar in the defined entry window, verified continuous session, no known halt/locked-limit ambiguity, positive volume and legal prices.
- Modeled fill = ceil-valid-tick(open × (1 + slippage)).
- Fill must be inside the approved entry zone, observed bar high/low and official daily band; otherwise no fill for that minute.
- Entire preapproved quantity must satisfy both participation caps; otherwise no fill. No partial entries.

Exit fill:
- Later completed eligible minute after the exit-intent commit, sellable shares and positive capacity.
- Modeled fill = floor-valid-tick(open × (1 - slippage)), inside the observed range/bands.
- Full quantity only; if capacity fails, retain pending exit across minutes/sessions. No imaginary stop-price fill.

Entry-minute stop touches are processed only when that bar is observed; any exit fill must be later than the resulting intent. Never fill entry and exit in the same minute. Session-end triggers can only fill in a subsequent verified session. Missing minutes are neither zero-volume bars nor execution opportunities.

A capture more than five minutes beyond declared feed delay, or processing more than 60 seconds after receipt, blocks new entry fills. Recovering old minutes may reconcile known historical observations, but cannot fabricate contemporaneous action opportunities. Material news received after an order is canceled/acted on from its actual receipt, not retroactively.

Entry cancellation/revalidation is effective at its actual committed timestamp: it prohibits market-bar starts at or after that time, but cannot erase a previously authorized earlier event merely because its bar arrived late. At late confirmation, reconstruct order validity from the committed state timeline applicable to that bar start. Record both simulated market-fill time and actual observation/ledger time. Never use later news or portfolio changes to cherry-pick an earlier hypothetical fill.

On reconciliation deadline, unresolved entry observations produce NO_FILL_EVIDENCE, release the remaining paper reservation and mark the affected result censored/data-incomplete; this is not evidence that a real order would have remained unfilled. A later capture is diagnostic only and cannot add a retrospective paper position. Any such missing opportunity fails the relevant coverage gate and prevents an unbiased performance claim. Pending exits do not expire this way: the held position and unresolved risk remain.

Reservation lifecycle: a certificate binds the pre-reservation snapshot; atomic acceptance records its expected reservation transition and accepted-order hash. Its own reservation does not revoke it. Subsequent nonmaterial cash/mark/order transitions require a deterministic revalidation receipt against the current state, preserving or reducing the permitted quantity without increasing it. A material thesis/price-zone/critical-data change or required risk review cancels future eligibility at the actual change time and requires a fresh pre-open approval for any new entry. Historical authorized events remain subject to the reconciliation rule above.

Participation and range checks use a completed bar and therefore are **ex-post simulation assumptions**, not proof that its open was available at the selected size. This limitation is reported for every portfolio result. Stress results must be shown alongside the base case.

## 9. Frozen cost and settlement assumptions

Because no broker/account tariff has been authorized, use transparent **synthetic friction scenarios**, not an assertion of actual fees or after-tax performance:

| Scenario | Fixed per filled order | Additional notional charge per side | Adverse price slippage per side |
|---|---:|---:|---:|
| Base | EGP 5 | 0.15% | 0.25% |
| Stress | EGP 10 | 0.30% | 0.50% |

Unfilled orders incur zero fee. The notional charge is a generic simulation cost buffer; it is not a verified tax, commission or promise to cover every charge. Report “net of modeled friction,” never “actual after-tax return.” Slippage changes the fill price; do not deduct it twice as a cash fee.

The stress scenario is a separate full replay/ledger: recheck sizing, zone/range feasibility, fills and cash. Do not subtract extra costs from the base fills while ignoring changed eligibility. Any future calibrated account tariff is a new predeclared cost version, not a quiet edit after seeing results.

Conservative settlement simulation: purchased shares become sellable, and sale proceeds become reusable, after the second subsequent **verified settlement business day**. No same-day selling or cash recycling is assumed. This is a simulation restriction, not a universal statement about actual account permissions. MCDR's published framework distinguishes T+2 from conditional T+0/T+1 mechanisms; its direct page remained inaccessible in this recheck. [MCDR clearing and settlement](https://www.mcsd.com.eg/en/activities-services/clearing-settlement).

A stop before shares become sellable remains a pending exit and contributes to stress exposure. Unknown settlement dates block new entries and cannot be invented. Corporate-action entitlements, cash dividends, rights and share changes must be reconciled from verified terms; unresolved effects suspend affected trading and mark performance provisional.

Official current session, tick, band, halt and settlement calendars remain activation prerequisites. A synthetic cost scenario permits a transparent broker-neutral paper experiment; it does not solve those market-rule gaps or establish real-world executability.

## 10. Mandatory NO-TRADE conditions

No capital/risk authorization; unresolved instrument/currency or market status; insufficient valid history; failed signal/volume/sector gate; stale or incomplete critical data; unresolved capital action; unavailable official session/tick/band; unapproved/incomplete thesis; Risk Agent rejection; expired or late approval; insufficient funded settled cash; breach of a binding certificate constraint; advisory-limit breach without a valid exception; drawdown review pending; unknown portfolio value; infeasible net cost/risk sizing; invalid tick-rounded prices; no eligible minute/capacity; scheduler/collector ownership conflict.

Return specific reason codes and next action. For a held name use HOLD with monitoring status or SELL intent as appropriate, never label an unowned candidate HOLD. “No candidates” gets a run-level NO-TRADE plus coverage/backlog, not silence.

## 11. Freeze and change control

No optimization during the five-session pilot. A material bug/data-integrity fault suspends affected actions. Preserve old outputs; append a defect and new candidate version, rerun regression/dry-run checks, and require checkpoint review before any new cohort. Do not mix pre/post-fix performance as one clean trial.

The freeze manifest hashes this plan, risk mandate, test plan, decision schema, machine-readable parameters and Phase 2 dictionary. Environment-specific official rule documents and start dates are bound in a separate activation manifest using the exact admission criteria; they cannot alter strategy parameters. New official constraints that conflict with the frozen plan block activation rather than being waived.

No start date is chosen now, no schedules are resumed, and no paper orders are created in Phase 3.

