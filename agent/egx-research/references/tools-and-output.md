# Local tools and report contract

Workspace: `C:/Users/LENOVO/Documents/ChatGPT/EGX-Tracker`. Node fallback: `C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`.

The local database contains watchlists, provenance, journal evidence and reported fills. `app/research-context.mjs` generates a timestamped, immutable JSON context under `data/research`. `research/profile.json` holds user risk limits; null means unknown. Do not modify limits without user input. Context files contain private notes/positions and remain local.

TradingView MCP health and chart state were verified on 8 October 2026. The active chart was EURUSD, demonstrating why symbol checks matter. The installed connector exposes 84 tools; verify runtime inventory. `chart_get_state`, `symbol_info`, `quote_get`, `data_get_ohlcv`, `data_get_study_values`, indicator/Pine reading, strategy results and chart navigation are useful. `data_get_trades` reads strategy results, not exchange tape; inspect its source before using. `data_get_equity` is strategy equity, not company shareholders' equity. Depth may be unavailable for EGX/account entitlements; do not invent it. No dedicated full-fundamentals/news/screener connector endpoint was verified; use supported UI/web access. Stock-specific indicator/data access must be probed before claiming success. `app/collect.mjs` contains a readiness workaround and preserves raw missing-volume checks; prefer the validated tracker collector for ingestion.

The agent can use web search/open for issuer filings, EGX, CBE, published bank/manager research and credible news. Always separate first-party facts from commentary. Search snippets do not establish a financial statement number.

Before capital is supplied, call exported `entryRisk({entry,stop,target,roundTripCostFraction})` from `app/research.mjs` for EGP loss per share, percentage downside, gain per share and reward/risk. State the cost assumption; zero is a gross scenario. This is conditional scenario math, not a guaranteed maximum loss or trade recommendation. It is separate from share-quantity sizing.

## Save a report

Write a draft JSON, then run `node app/research-save.mjs <draft-path>`. It validates and creates a new report file without overwriting prior reports. Dashboard reports load from `/api/research`.

Required root fields: `version: "1.0"`, unique `id: "report-<date>-<unique-suffix>"`, ISO `createdAt`, `type: "research"` (or `"readiness"` for setup only), `contextId` from the captured context, plain-text `summary`, `limitations` array, `sources` array, `assessments` array.

Each source: `id`, `title`, `url` (HTTP/S), ISO `accessedAt`; also provide `publishedAt`/`period` when known. Do not create URLs for MCP outputs; cite their observation IDs and context path inside analysis text. The `sourceIds` array references external evidence actually opened.

Each assessment: `ticker`, `verdict` (Insufficient evidence / Watch / Conditional setup / Review holding / Avoid setup), `rationale`, `sourceIds`, and nonempty plain-text `fundamentals`, `technicals`, `catalysts`, `risks`, `invalidation`, `positionReview`, `entryConditions`. Missing information must be explicit. Use precise dates and prices with capture provenance in technical sections. Inline `[source-id]` references connect claims to sources; document validation checks IDs, not factual accuracy. Source checking remains the agent's responsibility.

Model-authored numerical share sizes are rejected in report `sizing.shares`. Call exported `sizeCandidate(profile, inputs)` for deterministic scenarios; save the complete inputs/output as a separate local artifact and link its path in `positionReview`. Values across simultaneous proposals must share portfolio budgets. This helper does not model a full optimizer or risk covariance matrix.

The dashboard loads reports on page load or “Reload reports.” It does not invoke a model. Start the research agent from Codex with `$egx-research`; the separate EGX Decision Scout schedule can also invoke this skill and apply its guarded watchlist promotion.


## Full market and user watchlist

`GET http://127.0.0.1:4317/api/market` returns the TradingView EGX catalog, native currencies, history coverage, import errors and current import job. Catalog membership does not imply current trading or a usable history. Do not navigate TradingView while an import is running. The catalog is not an independently reconciled official EGX register.

Users add stocks through **Explore EGX → Add to watchlist**. `node app/research-context.mjs` automatically includes the current active watchlist and journal evidence (including paused holdings). The context contains compact coverage for the whole market. To research specific catalog stocks, run `node app/research-context.mjs ABUK COMI`; to generate a full-market context use `node app/research-context.mjs --all`. Full-market contexts can be large: prefer selected batches and record which stocks remain unreviewed. Unknown tickers fail explicitly. Adding a stock does not launch a model by itself.

Daily imports keep the bars TradingView supplies (up to 500 per capture), with missing-volume, symbol, currency and adjustment checks. Failed imports stay visible and can be retried. Fresh capture time is not proof of a recent trading session: inspect the last bar date for inactive securities. USD stocks remain USD throughout research; the existing entryRisk/sizeCandidate helpers and position journal are EGP-only. Do not use them with USD prices or infer an FX conversion.
