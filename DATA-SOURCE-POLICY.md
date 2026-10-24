# EGX Tracker data-source policy

User decision: 6 October 2026 — rely mainly on TradingView data.

- TradingView is the primary source for market prices, OHLCV history and market-data inputs used to calculate indicators, support/resistance and proposed stop levels.
- Preserve source symbol, interval, currency, exchange timezone, bar timestamp, retrieval time, delay status and adjustment settings alongside observations.
- The verified COMI, AMOC and SWDY feeds are delayed by 900 seconds. Label them as 15-minute delayed, never real-time. Recheck metadata if entitlement changes.
- Daily calculations use daily bars. The connector's quote output on an intraday chart describes the latest bar; its volume is not full-session volume.
- Calculate indicators reproducibly from stored, validated TradingView bars. Record calculation versions and assumptions.
- Other providers are secondary cross-checks. Flag discrepancies; do not silently replace or combine TradingView values with another provider's values.
- When TradingView data is missing, stale or invalid, report that condition. Any fallback dataset must be explicitly labelled and kept distinguishable from primary data.
- Use EGX, FRA and issuer disclosures for authoritative corporate actions, announcements, suspensions and calendar verification where accessible. Other reporting remains secondary evidence.
- Do not apply corporate-action adjustments twice. Preserve the provider's adjustment basis; verified charts currently have dividend adjustment off. Event-level split validation remains outstanding.
- Trade counts, bid/ask and order-book depth must be verified separately. Do not infer their availability from successful OHLCV access or equate share volume with number of trades.
- This policy supersedes earlier archive proposals that designate Stock Analysis as the primary market-data source. It does not establish complete market coverage or production readiness.


## Expanded market coverage (8 October 2026)

The market catalog comes from TradingView's Egypt stock scanner. It is validated against its reported row count and stored locally with retrieval time. Coverage may contain inactive or non-trading listings; it is not independently reconciled to EGX's official register. Catalog prices/volumes are discovery metadata and are not imported as daily OHLCV or used to create price levels.

Daily history is collected separately from verified EGX daily candlestick charts, up to 500 available bars per capture. Missing histories, invalid identities, currencies, raw volumes or adjustment settings are rejected and recorded. A fresh capture with old last-trade dates remains old market evidence. Catalog and watchlist are separate, so broad ingestion does not imply a recommendation or add every listing to research focus.

EGP and USD listing currencies remain distinct. USD prices must never be passed to EGP portfolio calculations; USD research is available, but USD journal/position sizing awaits verified FX and currency-aware accounting.
