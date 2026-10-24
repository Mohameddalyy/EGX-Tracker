# Source permission and capability register — batch 1

Assessment date: 24 October 2026. This is a requirements/disposition record, not proof of permission or a legal opinion. No provider was contacted, no subscription purchased and no new market collection run during this batch. Existing scheduled reviews remain paused. A reachable endpoint is not a use entitlement.

| Route / owner | Available local evidence | Required capability / unresolved use basis | Disposition |
|---|---|---|---|
| TradingView scanner and symbol discovery | Retained catalog, daily fact snapshots and collector receipts | Confirm authorized personal automated analysis, extraction, local retention, derived signals, request limits, delay/timestamp semantics and universe completeness | UNRESOLVED; retained fixtures usable for engineering, new actual-session collection requires applicable permission or replacement |
| TradingView Desktop chart through local connector | Retained OHLCV responses, session metadata, finality and connection failures | Confirm permitted programmatic chart extraction and decision/risk use; verify history depth, minute coverage, adjustments and effective session metadata separately | UNRESOLVED; connection success is neither permission nor validated data |
| EGX public announcement / statement feeds | Archived requests, responses, record versions and pagination windows | Verify permitted automated retrieval/retention, category coverage, corrections, publication timestamps, rate limits and continuity | NOT ESTABLISHED; pagination completeness does not certify all-event coverage |
| Issuer/official document sites | Allowed-source URLs, retained content hashes and document review mechanism | Per-domain permission/limits and publication/version semantics; confirm original document, issuer and fiscal scope | PER-ROUTE REVIEW REQUIRED; no blanket clearance for all issuer websites |
| EGID potential authorized route | Public provider description only | Written product/usage terms, retail availability/pricing, EGX coverage, historical point-in-time universe, actions, financials, delay and API access | INVESTIGATE; not integrated, not assumed affordable or entitled |
| Future broker/manual order interface | No new account evidence inspected | Supported order types/validity, tick/quantity constraints, buying power, settlement, suspension/price-band behavior, current fees/taxes and account entitlements | UNVERIFIED; paper assumptions do not establish broker compatibility |

TradingView's public terms restrict non-display uses including automated trading, algorithmic decision-making and risk-management uses, and discuss use outside direct human-readable display. An applicable exception or agreement was not established from this project's inspected artifacts. The exact intended use and agreement must be resolved before the dependent collection is activated. [TradingView terms, section 3](https://www.tradingview.com/policies/).

EGID describes itself as an EGX subsidiary and authorized market-data provider. This makes it an inquiry candidate; it does not prove a suitable retail product or permission for this project. [EGID](https://www.egidegypt.com/).

## Concrete capability/permission request to prepare, not send

Describe a single-user Egyptian retail research and paper-simulation application, local storage, automated incremental analysis and derived signals; distinguish any later real-order use. Request written confirmation of permitted purposes, retention/derived-data rights, endpoint access, rate limits and price. Ask separately for:

1. Current and historical membership, ticker/ISIN changes, delistings, suspensions and native currencies.
2. Daily/minute OHLCV and turnover, original and adjusted series, timestamps/delay, history depth and revisions.
3. Effective-dated splits, dividends, rights and other capital actions, with correction/version semantics.
4. Announcements/filings and ownership/control disclosures, publication time and complete category/window coverage.
5. Effective session/auction/holiday calendars, tick/lot rules, reference prices/bands and halt status.
6. Explicit unavailable capabilities and permitted fallback sources. Do not infer executable quotes from historical bars.

Record the answer, agreement version, effective dates, approved adapters and prohibited uses before an actual-session release. Unknowns block the dependent claim or adapter, not isolated code tests. Outreach, purchase and contract acceptance remain separate actions. This batch documents the unresolved gate; it does not implement a universal runtime permission switch.

Current broker fees, tax rules and exchange execution constraints still require their own effective-dated evidence package in W1.4/W1.5. Earlier excluded-source and obsolete Notion setups are not revived.
