# EGX v5 strategy research and analytical design

**23 October 2026. Research/design decisions only.** “Go” below means go to a frozen test specification, not deploy, buy, or restart the paper experiment. No strategy profitability or model superiority has been demonstrated on this EGX dataset.

## Evidence and model selection

| Approach | Documented evidence | EGX fit and constraints | Decision |
|---|---|---|---|
| Trend / momentum | Moskowitz, Ooi and Pedersen document own-return persistence across 58 liquid futures/forwards. Their study concerns other instruments and horizons, not EGX individual stocks. | Low-turnover daily research is more plausible with delayed data than fast execution. EGX price gaps, limit queues, sparse prints and transaction costs can defeat an apparent trend. | **Go to test:** simple daily long-only momentum/trend baseline on demonstrably liquid, eligible stocks. Do not transplant futures leverage, shorting or reported returns. |
| Trading-range breakout with volume confirmation | Brock, Lakonishok and LeBaron test moving averages and range breaks on long-run Dow data. Lee and Swaminathan show that volume interacts with momentum and later reversal; this does not establish a universal RV20 threshold or “institutional accumulation.” | Breakouts can be stale-price jumps, corporate-action discontinuities or unfillable limit moves. Tick validation, confirmed prior bars, current liquidity and subsequent eligible fills are essential. | **Go to test as the first candidate enhancement** to the simple trend baseline. Evaluate the added value of volume confirmation separately; no assumption that more volume is always bullish. |
| Short-horizon mean reversion | Frazzini, Israel and Moskowitz's developed-market institutional cost study finds short-term reversal less robust to costs/capacity than value or momentum. It is not an EGX cost estimate. | Stale quotes, bid/ask bounce, adverse selection and low liquidity can create false “oversold” returns. Locked down-limit exits and settlement restrictions are especially damaging. | **No-go for the initial pilot.** Keep as an offline challenger only after spread, fill and action-adjustment data are reliable. A dip alone is not a valuation argument. |
| Quality / value | MSCI's documented quality construction uses profitability, earnings stability and leverage. Asness, Moskowitz and Pedersen study value and momentum across markets. These are research rationales, not confirmation of a cheap-stock edge here. | Fundamentals are sparse and may be stale/revised. Inflation, FX gains, one-offs, negative equity and banking accounting can distort simple ratios. Slow rebalancing fits collection cadence, but “cheap” needs a solvency and catalyst analysis. | **Go as a research and risk overlay; conditional go as a standalone slower strategy** only when point-in-time statement coverage supports it. Do not screen out most of EGX merely because P/E is unavailable. |
| Relative strength / sector rotation | Moskowitz and Grinblatt document an industry component of momentum in their studied market. This motivates measuring sector context, not assuming local transferability. | EGX sector samples may be small, concentrated and correlated with FX/rate exposures. A sector winner may simply be one dominant stock; current constituent lists introduce survivorship. | **Go as context and ranking; defer standalone rotation.** Require dated constituents, enough peers, liquidity and concentration checks. |

Primary sources:
- [Time Series Momentum — Moskowitz, Ooi, Pedersen](https://www.aqr.com/Insights/Research/Journal-Article/Time-Series-Momentum).
- [Simple Technical Trading Rules — Brock, Lakonishok, LeBaron](https://onlinelibrary.wiley.com/doi/10.1111/j.1540-6261.1992.tb04681.x).
- [Price Momentum and Trading Volume — Lee, Swaminathan](https://onlinelibrary.wiley.com/doi/abs/10.1111/0022-1082.00280).
- [Trading Costs of Asset Pricing Anomalies — Frazzini, Israel, Moskowitz](https://www.aqr.com/Insights/Research/Working-Paper/Trading-Costs-of-Asset-Pricing-Anomalies).
- [MSCI quality index construction](https://www.msci.com/indexes/group/quality-indexes).
- [Value and Momentum Everywhere — Asness, Moskowitz, Pedersen](https://www.aqr.com/Insights/Research/Journal-Article/Value-and-Momentum-Everywhere).
- [Do Industries Explain Momentum? — Moskowitz, Grinblatt](https://onlinelibrary.wiley.com/doi/full/10.1111/0022-1082.00146).

The recommendation to start with a daily liquid-stock baseline is **our inference** from the observed data capabilities and these research constraints. None of the sources validates the proposed EGX parameters. Official market-rule verification remains as documented in [the rule matrix](CAPABILITIES-AND-RULES.md).

## Candidate hypotheses for Phase 3

Keep a small preregistered set rather than searching hundreds of indicator combinations:

1. **B0 cash:** explicitly defined idle cash and, separately, any verified attainable net cash benchmark.
2. **B1 simple technical baseline:** a transparent daily trend/range rule, deterministic eligible universe and next-eligible-observation fills.
3. **B2 volume enhancement:** B1 plus one specified volume-surprise rule, with identical risk and execution assumptions.
4. **B3 analytical overlay:** B2 plus completed company thesis, event/corporate-action review and independent challenge.
5. **B4 enhancement ablations:** separately add peer context, macro sensitivity, sector strength and tier-aware volume. Keep the experiment ledger of every variant, including failures.

Exact lookbacks, thresholds, exits, holding periods and risk limits must be frozen in Phase 3. Candidate horizons include 5/20/60 exchange-session forecasts and slower financial review horizons, but forecast horizons do not themselves set trade exits. Do not choose the best parameter after looking at the final test window.

A fixed current RV20 threshold of 1.5 is a baseline to challenge, not a proven edge. For the tier-aware variant, propose three liquidity bands based on trailing median EGP turnover ranks within the eligible universe, fixed from the prior session. Require the same absolute minimum turnover, active-session and participation gates in every band. Compare RV20 with the stock's prior-history distribution within that tier; never lower absolute liquidity requirements for thin stocks.

The volume experiment should initially compare **one fixed rule versus one tier-aware rule**, not a grid of dozens of thresholds. The tier-aware percentile, minimum sample and tier boundaries will be preregistered. If the data lack enough prior volume observations, revert to the separately evaluated fixed-rule strategy only when the frozen plan explicitly allows it; otherwise no signal. An intraday ratio uses matched-time cumulative volume, not full-day RV20.

## What makes the agent analytical

A usable report must answer a falsifiable investment question: **what is mispriced, why might it change, what evidence would disprove it, and can the position be entered and exited within constraints?**

### Company economics and accounting

Build a dated fact table from original filings, identifying consolidated versus standalone accounts, units, currency and publication date. Reconcile discrepancies before calculating a valuation.

For nonfinancial companies, analyze revenue into price, volume, mix and FX where disclosures permit. Reconcile profit with operating cash flow; isolate working-capital release, asset sales, fair-value gains and other nonrecurring items. Inspect debt maturities, refinancing, interest coverage, capex and related-party transactions. Do not describe nominal inflation-driven growth as real business improvement without support.

For banks, use funding mix, net interest margin, loan growth, asset quality, provisions and regulatory capital. Industrial debt/equity or current-ratio filters are not interchangeable with bank solvency analysis. For property companies, distinguish contracted sales, recognized revenue, collections, land obligations and delivery costs. For exporters/importers, separate currency revenue, imported inputs and foreign debt; a weaker EGP can help one line and hurt another.

A missing optional peer ratio should not stop this analysis. Missing material financial integrity or action terms should prevent approval, with a specific repair path.

### Valuation and catalysts

Use sector-appropriate valuation with explicit assumptions and sensitivity ranges. Examples are earnings/book value for suitable financials, normalized cash flow or enterprise-value multiples for nonfinancials, and properly substantiated asset/cash-flow models where relevant. Do not mechanically apply one multiple across sectors or use DCF when cash-flow inputs cannot support it.

Compare market-implied expectations to the thesis. A low multiple can reflect poor assets, a cyclical peak, trapped cash or dilution. Explain why a discount could narrow, what catalyst matters, its plausible timing and what is already priced in. A technical breakout provides timing evidence; it does not independently prove intrinsic value.

Each valuation sheet exposes inputs, source pages, equations, units, sensitivity and scenario assumptions. Deterministic code recomputes arithmetic. The model writes interpretation and challenges assumptions; it does not invent source values.

### Macro and sector transmission

Keep a simple observable regime vector—benchmark trend, breadth, volatility and turnover—separate from the macro narrative. Rates, FX and inflation matter through company-specific exposures. Use official release calendars and publication times. For each material shock, document the transmission to sales, input costs, funding, balance sheet and valuation discount rate.

Produce a bear/base/bull scenario with ranges and sensitivities. Probabilities are optional until defensible and calibrated; an explicit uncertainty statement is preferable to invented precision. Explain correlated exposures across holdings: two different sector labels may still share rate, FX, government-spending or commodity risk.

### Countercase and value of further research

The analyst must supply the strongest contrary evidence and at least one alternative explanation for price/volume behavior. The final reviewer independently checks the evidence, arithmetic, action feasibility and expected payoff after costs. A material disagreement stays visible rather than being hidden in an average score.

For every unresolved question, state whether resolving it could change eligibility, valuation, timing or size. Prioritize documents that could change a decision. If the only remaining unknown is optional consensus, proceed without it; if it is rights-issue dilution or solvency, stop approval and obtain it. This is efficiency through better research selection, not shallower analysis.

A prior case may suggest what to investigate, but its outcome must not leak into a historical replay. Case retrieval filters on information availability as of the decision timestamp.

## Portfolio and execution analysis

Risk controls must operate on the entire proposed portfolio including existing holdings, pending entries, unsettled cash and correlated issuer/group exposures. A new idea is evaluated against keeping cash and against other eligible ideas, not in isolation.

For a long position, define planned unit loss as entry minus adverse exit price plus variable costs; account for fixed entry/exit fees separately. Find the largest whole-share quantity satisfying **all** cash, authorization, planned-loss, name, sector/group, maximum-position and liquidity constraints after rounding. The approved risk fraction and capital remain Phase 3 choices.

Report net reward/risk from a substantiated target and scenario, not by choosing a target solely to satisfy a ratio. Show gap/limit-lock stress losses in addition to stop-based risk. A stop is a decision rule, not a guaranteed fill or loss cap. A down-limit market with no accessible buyer must not be simulated as a stop fill.

A minimum pre-action checklist includes: correct instrument/currency; approved nonexpired thesis; current event/action coverage; valid session and prices; permitted tick/band/settlement; cost model; observable liquidity; cash and portfolio limits; entry/exit plan; and later eligible fill evidence. Record a failed item explicitly.

Without verified bid/ask or depth, market-impact estimates are scenarios. Participation limits reduce exposure but do not prove queue priority. No real-time execution claim is compatible with an observed 900-second delayed feed. Use a strictly chronological delayed-observation paper model or obtain verified real-time entitlement before evaluating intraday responsiveness.

## Compare analytical models honestly

The present evidence does not contain a controlled evaluation proving that a multi-agent LLM system outperforms a simple rule or a different model. More roles and longer prose are not evidence of better decisions.

Compare these systems on identical timestamped evidence and the same execution simulator:

| Comparator | Purpose |
|---|---|
| Deterministic baseline alone | Establish whether the added analysis improves anything beyond price rules and risk controls |
| One analyst with structured evidence and deterministic checks | Measure value of business reasoning without extra-agent overhead |
| Analyst plus independent adversarial final review | Measure error detection, decision changes and incremental quality |
| Alternative available language models on the same frozen packets | Measure extraction fidelity, arithmetic, unsupported claims, uncertainty and decision consistency |
| Full overlay with each enhancement removed in turn | Attribute any improvement and detect redundant features |

For language-model comparisons, record actual provider/model version, reasoning configuration, retrieval permissions, prompts, tools and timestamps. Do not present fictional independent reviewers or vary the evidence set without labeling that difference. Blind the reviewers to realized outcomes and other models' answers until their own report is committed.

No token cap is proposed. Record wall time, source/tool calls and repeated retrieval as efficiency measurements alongside correctness and coverage. Cache identical documents/calculations and pass evidence IDs, but let a model retrieve the complete source when necessary. An expensive answer may be justified by better verified analysis; a cheap incomplete answer fails.

Score both operational and analytical outcomes: correct units/periods, source entailment, unresolved contradictions, fabricated claims, missed material events, falsifiable thesis, downside scenario, action feasibility, and decision calibration when horizons mature. Use blinded human adjudication on disputed judgments. Keep “correctly abstained due to missing data” separate from “completed research rejected the opportunity.”

## Evaluation design and statistical limits

Use historical replay with event-time data first, then chronological walk-forward windows. Fit thresholds only in the training portion; purge/embargo overlapping label horizons where necessary. Freeze the final holdout before model selection. Record every tested configuration so failed trials cannot disappear.

The risk of selecting an apparently successful backtest from many alternatives is documented by Bailey and coauthors. Their work motivates explicit trial accounting; mentioning PBO does not mean it has been calculated or that this small dataset can support it. [The Probability of Backtest Overfitting](https://www.davidhbailey.com/dhbpapers/backtest-prob.pdf).

Current-catalog history omits former/delisted names and can overstate achievable results. Latest-restated fundamentals are not historical knowledge. If publication vintages or former constituents cannot be reconstructed, label the exercise a biased feasibility replay and exclude it from claims of investable alpha. Begin prospective evidence capture for a cleaner future test.

Use equal assumptions across strategies for fees, spread/impact scenarios, delayed observations, missing minutes, auctions, halts, price bands, corporate actions, settlement and unfilled orders. Retain rejected/untriggered opportunities to diagnose whether friction or analysis caused cash retention.

Required metrics, with formulas and limits:

| Metric | Definition / interpretation |
|---|---|
| Net return | Change in marked equity, including realized/unrealized P&L, cash flows and all modeled costs; flows adjusted using the frozen method |
| R-multiple | Net trade P&L divided by initial precommitted monetary risk; retain original R after stop changes |
| Expectancy | Mean net R per closed trade, with sample size and uncertainty |
| Hit rate / profit factor | Winners divided by closed trades; gross positive net P&L divided by absolute negative net P&L. Undefined denominators stay undefined |
| Sharpe / Sortino | Daily portfolio excess-return mean over appropriate volatility/downside deviation, using a documented cash reference and annualization. Short samples are unstable; do not annualize a one-week result into proof |
| Drawdown | Maximum peak-to-trough decline in observed marked equity; report observation frequency and stale marks, not an unobserved intraday maximum |
| Turnover | Traded notional relative to average portfolio equity under one consistent convention |
| Slippage / implementation shortfall | Fill relative to decision/arrival benchmark, side adjusted, plus fees; show delay and unfilled opportunity cost separately |
| Benchmark comparison | Aligned same-period EGX30, EGX70EWI and cash; total-return basis when available, otherwise explicit dividend mismatch |
| Forecast calibration | Brier/log score and reliability by horizon only for committed probabilities with mature outcomes; separate uncertainty-only forecasts |
| Coverage / process | Universe validity, companies substantively researched, queue age, missed runs, gaps resolved, decisions delivered, hard overruns and risk violations |

A five-day paper run validates operations and traceability, not persistent profitability. Net performance must be assessed over longer out-of-sample horizons and enough independent opportunities. Zero trades means trade metrics are unavailable; it is not a 100% successful risk model. Concurrent 5/20/60-session outcomes are not independent trades.

## Priority recommendation

First make source timing, disclosure integrity, action/risk gates and readable outputs reliable. Then test a simple liquid-stock daily trend baseline and the incremental breakout/volume rule. Add company economics and independent challenge with explicit counterfactual comparisons. Integrate peer/macro/sector context and evaluate tier-aware RV20 as a bounded variant. Keep high-turnover reversal, complex regime prediction and adaptive rule changes outside the initial pilot.

Phase 3 should turn these choices into one concrete frozen trading plan and a prespecified test plan. Phase 4 implements them; Phase 5 measures them. This phase supplies a supported design, not a retrospective claim that the new agent already works.

