# TradingView capabilities and EGX rule verification

**Checked 23 October 2026, Africa/Cairo.** This is a bounded live capability sample, not an exhaustive warranty of every EGX instrument, account entitlement or future vendor response. All market probes were isolated from production imports.

## Reproducible evidence

| Artifact | What it establishes |
|---|---|
| [scanner-evidence.json](scanner-evidence.json) | Full 43-column response, 294 stock rows, coverage, EGX30/EGX70EWI snapshots; captured 12:59:14.486 UTC on 23 October |
| [probe-scanner.mjs](probe-scanner.mjs) | Read-only request recipe; 858 ms measured for this one run, not an SLA |
| [chart-samples.json](chart-samples.json) | Full sample daily captures and symbol metadata; captured from 12:59:20.650 UTC |
| [probe-notes.json](probe-notes.json) | Health/quote/minute tool results and browser observation notes |
| [Phase 1 evidence](../v5-phase1-20261023/local-evidence.json) | Earlier local catalog, code inventory, baseline operational measurements and frozen-policy hashes |

Initial TradingView health failed. No competing collector was found; a non-destructive launch with kill_existing=false was followed by a successful chart/API health check. Launch success alone was not accepted. At the end, chart_get_state verified the original AIFI daily chart and original Volume study. No alerts, orders, scripts or watchlist entries were created.

### Capability map

| Data / route | Tested result | Limitation / use |
|---|---|---|
| Desktop chart/API connection | Connected; chart API available | An initial failure required recovery. Host/CDP availability is an operational dependency. |
| Daily OHLCV | 500 bars each for COMI, SWDY, TMGH, SAIB | Per-call extraction is capped at 500 in this tool path. Length and latest date must be checked per symbol. |
| Weekly chart | AIFI weekly bars read successfully | Does not establish full weekly history for every symbol. Current week may be incomplete. |
| Minute chart | AIFI one-minute bars read successfully | Sparse intervals and a 12-minute gap occurred in the sample. Full session/replay coverage is not established. |
| Quote tool | Returned latest AIFI OHLCV bar | A bar is not current executable bid/ask; the field's observation time is mandatory. |
| Identity and market metadata | Currency, ISIN, exchange, delay, session strings, price scale, variable ticks and adjustment flags in collector output | Provider metadata is corroboration, not an official legal rulebook or current suspension check. |
| Daily/weekly technical ratings | 262/294 with values | Indicator composites, not broker recommendations or independent evidence. |
| Technical indicator fields | RSI, MACD, signal, ADX each 262/294 | Provider settings, incomplete bars and warmup can differ from local calculations. |
| Fundamental/valuation scanner | Actual numeric values with unequal coverage, detailed below | Snapshot capture does not establish statement publication time, fiscal consistency or point-in-time availability. |
| Analyst consensus / targets | 49 usable ratings and 49 targets | 245 NoRating values are missing. Horizon, analyst count and update dates are not verified in this request. |
| Benchmark snapshots | EGX30 and EGX70EWI returned | Current snapshot and monthly performance fields do not supply aligned test-period returns. |
| Public financial pages | COMI income/balance/cash-flow/ratios routes exist | Reliable numeric extraction was not established in this public browser session; dash/locked cells appeared. This does not establish the user's Desktop subscription rights. |
| Company filings | COMI dated filings list includes releases, slides and interim reports | Sample release opens a Quartr AI summary. Original full-document body was not verified; summary cannot become verified statement evidence. |
| News | Public symbol news route exists; official EGX feed separately worked | Complete historical news, timestamps and gap-free pagination through a machine interface not established. |
| Ownership | No verified current ownership dataset from the tested TradingView route | Use dated issuer/exchange/regulator documents. A free-float estimate is not an ownership map. |
| Order book / spread | depth_get reported that DOM panel was not found | No verified depth/spread captured. This is a failure of the tested configuration, not proof that every entitlement lacks depth. |
| Exchange-wide data | Public Egypt scanner endpoint returned 294 symbols | An operational public route, not a guaranteed supported service contract. Monitor schema, errors, rate limits and membership. |
| Full statement, ownership and news MCP tool | No dedicated such tool identified in the installed TradingView tool inventory | Browser/issuer routes supplement the chart connector. Do not equate an absent connector method with absent website information. |
| Strategy tester output | Tool family exists | Strategy-test trades/equity are simulated strategy outputs, not company financial statements or the user's brokerage executions; not used as such. |

TradingView documents its technical ratings as combinations of moving-average and oscillator signals. Treat them as a correlated technical family. [TradingView technical ratings](https://www.tradingview.com/support/solutions/43000614331-technical-ratings/).

TradingView lists EGX delayed coverage and real-time data options. The actual tested symbols reported **900 seconds delay** and EGX_DLY identity. Do not infer real-time access from a plan name or a website “live” badge. [TradingView data coverage](https://www.tradingview.com/data-coverage/).

### Coverage is a vector, not one “data complete” flag

| Scanner field family | Non-null / usable of 294 |
|---|---|
| Name, type, exchange, currency, OHLC, volume | 294 each; validity/freshness still requires checks |
| Sector, industry | 278 each |
| P/E; P/B | 62; 163 |
| ROE; debt/equity | 65; 163 |
| Market cap; diluted EPS | 242; 68 |
| Revenue growth; free float | 70; 161 |
| 30-day average volume | 262 |
| 1M, 3M, 6M, yearly performance | 264 each |
| Daily and weekly technical ratings; RSI/MACD/ADX | 262 each |
| Provider relative volume 10-day | 260 |
| Dividend yield; net margin; ROA | 238; 69; 65 |
| Current ratio; revenue TTM; net income TTM | 166; 70; 70 |
| Average analyst target; usable analyst rating | 49; 49 |

Financial missingness is nonrandom. Filtering the whole universe by available P/E can shrink discovery to 62 symbols and bias the sample. Keep technical research and financial completeness separately visible. Never replace missing ratios with zero or market medians as company facts.

### Sample-specific warnings

- COMI, SWDY and TMGH latest daily bar: **22 October 2026**, native EGP.
- SAIB latest daily bar: **15 September 2026**, native USD, despite 500 successfully returned bars.
- RMTV: chart did not load.
- Stored catalog: 296; live scanner: 294; missing HALN and RMTV, no new additions in this comparison. Reason unknown. Preserve records and reconcile official listing/trading status.
- Metadata included variable_tick_size = `0.001 1 0.01`. A single `minmov/pricescale = 0.01` is not a universal tick rule. Verify price-dependent increments and official scope.
- DividendsAdjustment and backAdjustment were false, but historical prices/volumes included fractional adjusted values. These flags alone do not certify raw, unadjusted historical execution prices.
- Bar timestamps, retrieval times and effective publication times are distinct. The new capture must not overwrite the historical observation time.

## Official-source routes and unresolved market rules

The [official EGX beta website](https://beta.egx.com.eg/en) loaded market information and the [disclosure feed](https://beta.egx.com.eg/en/media-center?tab=disclosure). The tested disclosure detail was PRDC announcement 296431, dated 22 October 2026 at 15:32 Cairo, about treasury-share purchases. It linked an [original bilingual release](https://egx.com.eg/downloads/Bulletins/345933_1.pdf); that PDF was not retrieved through the web tool.

This proves a usable discovery route, not complete action verification for PRDC or all issuers. Implement pagination/watermark checks, original-attachment retrieval, text extraction and reconciliation before certifying disclosure coverage.

| Constraint | Evidence retrieved | Verification status and design consequence |
|---|---|---|
| Trading week, sessions and auctions | Provider sample says Africa/Cairo, ordinary 10:00–14:30, with dated Ramadan overrides. Legacy official Trading_Hours page failed; current official effective auction/session specification was not obtained. | **Provisional, not official certification.** 09:00 preparation and 14:35 provisional reporting are reasonable design choices; execution must use a verified effective session table. Do not hardcode a rumored extension or fixed UTC offset. |
| Holidays / exceptional sessions | Provider historical holiday metadata includes 2026 exceptions | **Provider corroboration only.** Check dated official notices daily; fail new-entry readiness if current session status is uncertain. |
| Tick size | Price-dependent tick metadata captured for sample securities | **Official instrument scope unverified.** Add rule version, instrument class and price threshold; reject invalid rounding and unknown schedules. |
| Daily bands, reference prices and circuit breakers | No current effective official per-security specification retrieved in this phase | **Unverified for execution.** Do not generalize historical main/SME percentages or infer a band from recent OHLC. Require current reference, band, exemptions and suspension state. |
| Listing versus trading / suspensions | Official temporary-listing notice explicitly conditions trading on subsequent requirements; disclosure feed exposes issuer events | **Distinction verified; current full status feed not established.** Catalog membership or provider is_tradable cannot prove today's eligibility. |
| Settlement | Official MCDR indexed page describes DVP, T+2 for centrally deposited listed securities, and conditional T+0/T+1 mechanisms for eligible securities and licensed brokers | **Official indexed text available; direct page fetch returned 502.** Treat base-cycle evidence as sourced but verify account-specific eligibility and applicable current terms before simulation approval. No automatic same-day sale permission. |
| Taxes | Official EGX August 2026 conference report describes stamp-tax reforms and different same-day treatment | **Official announcement verified, complete effective legal/tariff configuration not verified.** Resolve applicability and effective date from operative documents; do not use a press announcement as a complete fee schedule. |
| Commission, clearing and exchange charges | No actual authorized account tariff supplied | **Unavailable.** Keep costs parameterized and scenario-labeled; the prior EGP5 simulation charge is not a real broker tariff. |
| Executable liquidity and limit queues | No depth or bid/ask captured | **Unavailable in tested route.** Last price/volume cannot prove a fill. Conservative delayed-bar simulation must be separately defined and cannot claim live executability. |
| Benchmark total returns | EGX website exposes an EGX30TR navigation option; aligned historical total-return series not collected | **Not ready for dividend-inclusive comparison.** Obtain and align the series, or clearly compare price-only returns separately. |

Supporting official pages: [EGX temporary-listing notice](https://beta.egx.com.eg/en/news/286153), [MCDR clearing and settlement](https://www.mcsd.com.eg/en/activities-services/clearing-settlement), [EGX tax-reform announcement, 4 August 2026](https://beta.egx.com.eg/en/news/292436).

The tax announcement mentions 0.5 per thousand on each side and 0.25 per thousand for same-day transactions. These figures are recorded as announcement content, **not installed charges or a legal conclusion for this user**. The missing effective/applicability evidence remains open.

## Fallback discovery beyond the scanner

The [CIB issuer ownership page](https://www.cibeg.com/en/investor-relations/governance/ownership-structure?ty=19) exposed dated 2025 quarterly files in the sampled route. That establishes a primary-document route, not current 2026 ownership verification. Issuer pages must be navigated to the relevant period and checked for later changes.

The [COMI TradingView filings page](https://www.tradingview.com/symbols/EGX-COMI/documents/) and [sample release view](https://www.tradingview.com/document/EGX-COMI/urn:report:quartr.com:4330186/) add useful document discovery. The visible disclaimer calls the narrative an AI-generated summary. Retrieve the original issuer statement before relying on critical figures; do not cite one model's summary as an independently verified financial source.

The [CBE MPC calendar](https://www.cbe.org.eg/en/MonetaryPolicy/Pages/MPCMeetingSchedule.aspx) is an official event-calendar route. Its existence does not supply every issuer's FX exposure or an attainable cash yield. Link macro releases to company-specific sensitivities.

## Repair order before a paper pilot

1. Verify official current session/calendar, security-class tick/band/reference rules and halt status; store dated source documents and effective versions.
2. Establish reliable disclosure pagination and original attachments for held/approved candidates, including a manual official-document channel when a route fails.
3. Fix stale-series, currency, adjustment and catalog-difference validation; separate successful HTTP/chart requests from valid evidence.
4. Obtain actual authorized settlement and fee assumptions for the new plan.
5. Demonstrate minute coverage and delay-aware timestamps, or select an explicitly different next-session daily paper methodology.
6. Verify aligned benchmark histories and freeze an evidence vintage before performance claims.

These gaps do not prevent design or research. They prevent pretending that an execution-ready system has already been verified.

