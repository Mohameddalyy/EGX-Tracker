# Remaining launch blockers — implementation batch, 28 October 2026

Status: progress made; operational launch remains BLOCKED. W9's archived result remains historical and unchanged. All 344 enumerated regression tests passed with zero skips (full-suite/result.json); four new basket tests passed. Frozen execution/evaluation/plan/schema hashes match the W9 release.

## Implemented

- Read-only launch-readiness-agent.mjs reports retained universe freshness, every recorded decision/holding obligation, unknown input errors, active collectors, targeted baseline jobs and remaining gates. It does not collect data or certify execution admission. Invocation: `node app/launch-readiness-agent.mjs PROJECT_ROOT NEW_REPORT.json`.
- Approved-amendment-bound five-stock basket planner, with CLI `node app/basket-plan-agent.mjs REQUEST.json NEW_REPORT.json`. Request fields: input (v5 signal input at prior verified close), book (effective rule bundle), scenario (base/stress), amendmentPath (approved W7 amendment), at (pre-entry planning time). It requires full universe accounting and existing series/identity/action admission; verifies actual raw traded-value ranking rather than silently substituting a proxy, applies frozen universe liquidity/volatility/grid controls, fixes ISIN tie-breaks and whole-share allocations within EGP20,000 including fees/exit reserve. Selection and sources are hashed before the first window. Unknown data that could displace a selected name makes the basket unavailable; fewer than five names cannot silently change its mandate. Plans create no order, fill, or portfolio.
- Source register and a precise data/rule capability request were prepared. Nothing was sent or purchased. User's claim of separate permission covering automated collection, algorithmic analysis, EGX data, storage and retention is recorded in agent/source-permission-attestation.json. No document/issuer/effective dates were supplied. The attestation is not converted into fabricated reviewed permission.

## Current measured gaps

The saved read-only snapshot contains 296 stocks: 295 EXPECTED_SESSION_ABSENT and one SESSION_METADATA_UNAVAILABLE under the existing provider-preparation calendar. Last catalog capture: 18 October 2026. This is preparation diagnosis, not a certified independent eligible-universe denominator. Thirty-three decisions remain visible; no registered paper/live holdings or pending intents were found. There are 347 exchange records without a ticker match; their materiality and instrument type are not yet classified, so this count does not mean 347 material company events. No collector was running at the snapshot.

## Remaining closure work, in order

1. L1: establish applicable permission evidence/use basis under the saved release plan and effective official market rules. User-attested separate permission is preserved; review of that document remains unavailable. Public TradingView terms restrict automated/non-display uses, so a connection/subscription is not permission evidence. Primary source/capability investigation identified EGID as a candidate, not an acquired or confirmed retail service. See source-register.json and DATA-CONTRACT-REQUEST.md.
2. L2: after an admitted source is available, refresh catalog/history/facts/events through the existing targeted workflow, reconcile unknown event routing, and build source-bound current identity/action/session admission. Cache reused facts must retain original dates. Rehearsal coverage denominator remains independently defined ordinary-EGP universe; never drop missing names to reach 90%.
3. L5: basket planning is implemented; dedicated durable basket entry/reconciliation/holdings, entitlement/cost-basis ledger and 126-session endpoint/liquidation integration are still required. Existing strategy exits cannot be reused for buy-and-hold. Actual benchmark/entitlement observations remain unavailable. The planner is not a completed economic comparator.
4. L3: actual client comprehension remains pending. Placeholder form submissions are not acceptance. Action desk protocol remains unchanged; no answers supplied by the implementation agent count as Mohamed's comprehension.
5. L4: two consecutive actual verified no-order sessions, after the above prerequisites and explicit start authorization. Synthetic scenarios cannot satisfy this. Frozen coverage/timing/throughput gates remain in the remediation plan; no session date or observation is invented.
6. L6: separately authorized five-session pilot and subsequent cohorts; real-capital readiness is separate. Work on blockers does not silently restart paused scheduled reviews.

## Source evidence checked

TradingView terms: https://www.tradingview.com/policies/ ; provider automated-collection guidance: https://www.tradingview.com/support/solutions/43000674726-why-is-my-account-banned-due-to-suspicious-activity/ . These describe public policy; they do not establish the content of the user's unseen separate agreement.

EGID primary site: https://www.egidegypt.com/ and history: https://www.egidegypt.com/who-we-are.html . The company describes an EGX affiliation/data-provider role. Coverage, licensing terms, rate limits and retail pricing remain unconfirmed. No third-party trading-hours summary was promoted into effective official rules. Excluded research sources remain excluded.
