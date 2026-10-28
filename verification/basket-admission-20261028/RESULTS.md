# Basket execution, entitlements and fresh admission â€” 28 October 2026

Actual implementation changes, with 354/354 regression tests passing (full-suite-closed/result.json). Ten new tests cover the ledger/accounting/admission and completed-session selection; the earlier four basket planning tests remain. Failed fixture attempts are retained. Frozen strategy execution and evaluation hashes are unchanged; the new basket has its own runtime release hash and isolated schema. This batch is engineering scope, not an operational-release certification.

## Running code

- app/v5/basket-execution.mjs and basket-store.mjs implement funded, fixed-selection basket orders with first-session 30-minute entry, delayed confirmed-minute observations, legal price/tick/band checks, full-quantity 1% capacity controls, fixed fees/slippage and reservation retention through delayed reconciliation. No replacement or strategy stop/technical exit is allowed. Orders missed at the deadline remain cash with explicit NO_FILL_EVIDENCE.
- Dedicated SQLite transactions retain immutable configuration, events, hashes and state. Duplicate exact events are idempotent; conflicting IDs, consumed minutes, chronology reversal and changed runtime are rejected. Every append verifies prior replay. Production tracker/strategy databases are refused. This implementation currently supports ENGINEERING_BASKET_ONLY, not prospective activation.
- Dividend accounting uses explicit sourced NET per-share amounts and an explicit settled-on-record-date eligibility convention. Historical quantities prevent later splits from multiplying earlier cash coupons. Receivables and actual receipt cash reconcile; duplicates/early payment/mismatched amounts are rejected. A different eligibility convention, uncertain taxes, rights or fractional cash-in-lieu needs separately reconciled treatment, not a guessed amount.
- Whole-share splits preserve invested cost, change the action basis and invalidate old marks/coverage. Unsupported fractional treatment and splits inconsistent with booked entitlements are blocked, preserving the holding.
- Valuation requires exact-date confirmed raw marks, reviewed complete action/entitlement coverage and matching basis. Unknown coverage produces unavailable returns with positions retained. Session 126 is counted from verified sessions, not calendar days, and cannot be recorded before final close/delay. Costed liquidation sensitivity is descriptive; no executable terminal fill or unknown capacity is assumed.
- app/v5/fresh-admission.mjs binds market data, independently complete universe and effective official-rule interpretation to retained source-byte hashes and dated reviews. It rejects altered bytes, future evidence, incomplete source bindings, stale sessions and calendars that do not cover the observation date. Missing stocks stay in the independent denominator; partial admission cannot become full coverage by dropping names. The evidence review is an asserted review identity bound to bytes, not cryptographic proof of issuer authenticity.
- app/workflow-inputs.mjs now selects the expected completed session for preparation readiness while retaining latestObservedDay. A current intraday provisional bar no longer hides a valid previous-session recapture. No bar or historical capture is deleted or relabeled as newly verified.

## Commands

`node app/basket-ledger-agent.mjs init LEDGER.sqlite CONFIG.json NEW_OUTPUT.json`

`node app/basket-ledger-agent.mjs append LEDGER.sqlite EVENT.json NEW_OUTPUT.json`

`node app/basket-ledger-agent.mjs replay LEDGER.sqlite EMPTY.json NEW_OUTPUT.json`

`node app/basket-ledger-agent.mjs value LEDGER.sqlite DAY.json NEW_OUTPUT.json`

CONFIG is scope ENGINEERING_BASKET_ONLY, id, and request (the approved basket planner request). EVENT has unique id, type, at and data. Supported types: MINUTE, TICK, DIVIDEND, PAY_DIVIDEND, SPLIT, COVERAGE, MARK, ENDPOINT. DAY is {"day":"YYYY-MM-DD"}; EMPTY is {}. No real order API exists. Existing basket ledgers must be replayed with their matching release. Main strategy client/registry and prospective comparison deployment are not silently upgraded by these commands.

`node app/fresh-admission-agent.mjs PROJECT_ROOT REQUEST.json NEW_OUTPUT.json`

Admission request contains input, book (including calendarCoveredThroughDay), access, evidence and universeManifest. Evidence roles are OFFICIAL_RULE_BUNDLE, CURRENT_UNIVERSE and MARKET_SOURCE, each with retained path/sha256/availableAt and review status/reviewer/at/documentHash/payloadHash. Permission evidence is also hash-bound. The official-rule record needs officialUrl. An unavailable official bundle produces no admission; user collection authorization is separate from rules/data verification.

## Actual collection, not synthetic testing

Mohamed explicitly instructed that actual collection proceed under his full permission. agent/source-access.json now records that user authorization, until revoked, with evidence bytes bound to agent/source-permission-attestation.json. It does not claim independent inspection of the underlying agreement. The prior missing-document condition is not used as an artificial collection block. Schedules remain paused.

TradingView was launched without killing an existing process and then separately verified: CDP connected, chart API available, daily EGX chart. Manual `app/refresh-market.mjs` began workflow-1c8e1f3b-6067-44c3-a634-542594d4ade6 at 08:40:56Z. Actual catalog, facts, omitted-fact repair and exchange collection succeeded; initial catalog-import retry and partial observations remain recorded. History collection is still owned/running at this report snapshot, with its fixed 30-minute deadline and durable checkpoints. Do not start a competing collector. The parent process loaded the earlier readiness selector; the corrected selector is used by the latest diagnostic/new invocations, not represented as a hot update of that owner.

Latest saved diagnostic: 296 retained stocks, 83 reusable expected completed sessions, 212 awaiting that session, one with unsupported session metadata; catalog captured 28 October. These are preparation facts, not final ordinary-EGP admission. All 33 recorded decisions remain visible. There are 410 currently unmatched exchange records, requiring instrument/materiality classification rather than being described as 410 material company events. See readiness-latest.json and collection-progress-latest.jsonl. Capture counts change as the collector progresses; this is explicitly an in-progress snapshot.

## External evidence and remaining limits

Official EGX trading-hours/rules and MCDR pages failed via web access and direct HTTPS attempts. Attempts/failures are retained in official-attempts/results.json. No third-party summary was promoted to official trading/settlement rules. Permission for collection is recorded; official rule content remains unverified because the source attempts failed.

Actual collection must finish/reconcile its component receipts, then source-bound current universe/action/rule evidence must enter the new admission validator. Unknown corporate actions, dividends, raw traded value or official rule coverage are not invented. Engine accounting is implemented for the supported actions; rights/fractional actions, basket integration into prospective comparison/client monitoring and actual-session rollout remain separate work before economic comparison. W8 human acceptance and W10 actual-session rehearsal/pilot remain pending; schedules were not resumed.

Historical W9 retained-verification.json was restored to its committed exact bytes after identifying an earlier verification helper had overwritten its timestamp/timing fields. The resumed copy is preserved separately in this batch. No historical observations were backfilled.
