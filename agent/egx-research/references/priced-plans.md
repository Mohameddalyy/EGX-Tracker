# Calculated conditional entry plans

Every new approved Watch setup requires `priced-plan-1.0`. Wait/Avoid can omit a plan when evidence or price structure is insufficient. Do not generate a Buy just to supply numbers.

Use the immutable context, then run:

`node app/trade-plan.mjs CONTEXT_ID TICKER pullback 0 EXPIRY_ISO 0.005 "Illustrative 0.5% round-trip cost; actual broker costs unknown"`

Use an actual ISO expiry chosen for the catalyst/horizon, no more than a reasonable setup lifetime. Prefer expiry at the start of a later Cairo date: the daily monitor excludes the expiry date because intraday ordering is unknown. `breakout` is also supported. Index 0 is the nearest evidence zone; indices 1/2 select other saved zones. Costs are an explicit scenario, not a quoted fee. Inspect the entire output, then copy it unchanged into the assessment's `riskPlan`. Do not edit generated numbers. If geometry is unsuitable, choose another evidenced setup or defer. T2 exists only if another measured resistance exists.

The builder recomputes confirmed levels and ATR from frozen OHLCV, not model-written levels. Pullback starts at support's upper edge; breakout starts above resistance's upper edge. Entry-zone width is 0.25 ATR. Stop is anchor lower edge minus 0.5 ATR. Targets sit one valid tick below following resistance lower edges. Prices use the captured TradingView tick ladder. Calculations use the worst entry-zone price and include the stated cost scenario. The initial approval gate requires T1 cost-adjusted reward/risk of at least 2:1. These exact multipliers and thresholds are local experimental choices, not bank standards, fitted win probabilities or a validated EGX edge. Challenge whether volatility, liquidity, events and gaps make the geometry sensible even when it passes numerically.

Confirmation requires a subsequent accepted daily candle in the zone and RV20 >= 1. Pullback requires a bullish candle touching the zone; breakout requires a close crossing the anchor from below. A post-decision stop touch invalidates the setup. A target reached before recorded entry requires reassessment. Review the next session's available quote and do not chase beyond the range. No order or fill is inferred. Entry expiry does not close a recorded position.

Concept references: [Fidelity support/resistance](https://www.fidelity.com/learning-center/trading-investing/technical-analysis/support-and-resistance) explains how price structure can inform timing while remaining interpretive. [SEC stop-order bulletin](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-15) distinguishes a stop trigger from the eventual execution price and notes broker-specific availability. This US investor education source is not an assertion about EGX broker order support. Verify the user's broker before describing any automatic order facility.

The final agent independently approves the same plan and cannot override the six evidence checks. The dashboard shows its numerical plan and monitoring status. Actual trades are recorded by the user through the linked journal; share recommendations remain blocked until portfolio capital and risk limits are supplied.

## Conditional alternatives and follow-up (15 October 2026)
A poor reward/risk at the current close does not rule out a conditional pullback or breakout. When price structure supports one, calculate and discuss the alternative from the same immutable context, including confirmation, no-chase boundary, expiry and cancellation. A diagnostic can be retained in a deferred report but must be labelled unapproved; it cannot become an order or override missing evidence checks. Do not lengthen a target or tighten a stop solely to pass a numerical hurdle.

For the authorized paper portfolio, evaluate the frozen paper sizing function separately: EGP5 per filled order is a fixed cost and cannot be represented accurately by one universal percentage across all quantities. Show the assumptions and distinguish hypothetical sizing from permission to submit an order. Actual order submission must still use proposePaperBuy and every preflight/trigger/risk guard.

The unified stock card displays the newest analyst evidence, current final decision and paper audit separately. A newer report does not supersede a decision until the independent final agent saves its review. Different same-day evidence may now receive a new reassessment handoff; identical triggers remain deduplicated.
