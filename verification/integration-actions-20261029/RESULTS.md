# Basket integration, corporate actions and official access — 29 October 2026

Implemented in running code. All 368 enumerated regressions pass with zero failures/skips (full-suite-release-final/result.json); 14 new integration tests cover corporate actions, source handling, monitoring/client integration and prospective preparation. Synthetic test permissions/authorizations exist only in temporary fixtures. There is no production pilot authorization and no real order route.

## Official site access

The old EGX ASPX URLs disconnect. The current https://beta.egx.com.eg/en site is reachable through a certificate-verified HTTPS client and the browser; exact HTML is retained. Its current navigation/search was inspected: several publication links are placeholders and the focused trading-hours search returned no results. A reachable homepage is not a substitute rule document.

app/official-source-agent.mjs records known official routes, actual HTTP/transport status, final URL, exact retained response hashes and failures. Run with `node --use-system-ca app/official-source-agent.mjs PROJECT_ROOT`. System certificate trust is used; TLS checks were not disabled. Challenge detection was corrected after the real homepage's translation dictionary caused a false CAPTCHA classification; its regression is included. Current EGX result: CAPTURED_UNREVIEWED, ruleAdmission false.

MCDR canonical English, current action page and MCS(D) official route were tested by direct certificate-verified HTTPS, browser and web access. Direct requests/browser return ECONNREFUSED; web access returns gateway/time-out failures. These are concrete external connectivity failures; no application change can truthfully make a refused remote connection successful. Diagnostics and current failures are saved in access-diagnostics.json and official-source-result-fixed.json. Search-index excerpts from official MCDR pages support discovery only, not complete effective rule verification. No CAPTCHA/security bypass, DNS change, proxy workaround or invented rules were used.

Official documents already retained locally can enter the existing exact-byte evidence/review contract, even when their live host is unavailable. SourceURL, retained bytes/hash, public availability, effective applicability and interpreted payload review remain required. Unknown official tick/session/settlement details remain unknown; public-source collection is authorized under Mohamed's existing explicit full-permission instruction.

## Prospective basket integration

- app/v5/basket-registry.mjs provides explicit, serialized enrollment of isolated basket ledgers within the workspace; concurrent registration cannot overwrite an enrollment. Main strategy/tracker DBs and paths outside the workspace are rejected.
- app/v5/basket-audit.mjs verifies the immutable chain and matching-release semantic replay read-only. A mismatched release does not erase held positions: monitoring preserves chain-verified exposure with critical replay uncertainty.
- app/workflow-v5.mjs and workflow-worker.mjs now include basket holdings, pending reconciliations and unknown action notices. Existing positions stay visible under ambiguous identities; unresolved identities are critical rather than guessed chart symbols. Enrollment is explicit, so no fixture/historical basket is silently added to production.
- The running action-desk API and UI show separate basket cash/equity, holdings, entry reconciliation and endpoint state. They do not inherit inappropriate strategy stop/exit wording or expose force-fill controls. live-client-check.json verifies the actual HTTP API. No basket is enrolled in production, so that current API honestly shows zero registered baskets.
- app/v5/basket-activation.mjs prepares PROSPECTIVE_BASKET_PAPER configuration only with the same fresh admitted universe/input/rules, matching basket release, and a canonical explicitly approved paper-pilot authorization for the exact five verified sessions. Registration uses actual time; prospective appends reject backdated commits. This preparation path is implemented and tested positive with a synthetic authorized fixture and negative without authorization. It is not a pilot start.
- Reviewed RULE_BOOK events extend future effective rules/calendar while retaining completed-session and past instrument-rule records. Material changes cannot rewrite history. The endpoint remains 126 verified sessions. The additional buy-and-hold comparator remains descriptive context outside the 16 primary tests; observed economic validation is not claimed by integration tests.

CLI (all outputs require a new file):

`node app/basket-ledger-agent.mjs register ROOT REGISTRATION.json NEW_RESULT.json`

Registration: {"id":"basket-id","label":"Basket label","path":"relative/isolated-ledger.sqlite"}.

`node app/basket-ledger-agent.mjs overview ROOT DAY.json NEW_RESULT.json`

`node app/basket-ledger-agent.mjs prepare-prospective ROOT REQUEST.json NEW_CONFIG.json`

Preparation request has request (approved basket planning request) and admissionRequest (source-bound fresh admission request). It reads agent/paper-pilot-authorization.json; that file has not been created in production. Only a separately authorized pilot may provide it. init/append/replay/value commands remain available; output scope follows the actual ledger.

## Corporate-action accounting

Supported reconciled CORPORATE_ACTION types: FRACTIONAL_SPLIT with exact fractional cash-in-lieu and remaining cost basis; CAPITAL_RETURN; CASH_REDEMPTION; whole-share MERGER with successor identity/cost allocation; RIGHTS_GRANT with separately visible rights and allocated basis; funded precommitted RIGHTS_SUBSCRIBE; and RIGHTS_LAPSE after actual expiry. Existing cash-dividend declaration/payment and whole-share SPLIT remain supported.

Records require unique identity, effective date, coherent old/new bases, available source/hash, explicit quantities/net cash/cost allocations, preparer and a different reconciler binding the exact payload. Subscription cannot add external capital, consume prior commitments, or rely on a retrospective election. Rights do not create fictional exit-fee commitments for a trading model that does not sell them. Mandatory entitlements are holdings, not new ordinary-share entry signals. Cash and original-entry funding reconcile through separate corporate cash flows; unknown marks or coverage keep total return unavailable.

ACTION_NOTICE preserves unhandled/uncertain events as explicit monitored obligations. A matching source-bound resolution clears its notice; duplicate notices and prototype keys cannot conceal an obligation. Notices, source records and corrections are not deleted from the immutable event history. Arbitrary events are not silently converted into cash or shares.

Boundaries: fractional merger packages, rights-market sale fills, spin-offs, contested entitlements and corrections to previously booked cash dividends do not receive guessed generic treatment. They remain explicit unresolved notices until a dedicated reviewed treatment is implemented. Supporting common action types is not a claim to model every future corporate action or authenticate an issuer merely from a review assertion.

## Release and remaining gates

This changes the dedicated basket release. previous-basket-source.zip preserves the prior source/config resources; no old ledger events are rewritten or automatically reinterpreted. Frozen strategy policies, completed experiment and 18-arm mandate remain intact. The old 28 October manual baseline finished PARTIAL with unfinished jobs; it is not still described as a successful fresh run. Its durable report is data/operations/workflow-reports/workflow-1c8e1f3b-6067-44c3-a634-542594d4ade6.json.

Operational launch still needs complete effective official rule/data admission, actual W8 client acceptance, authorized real-session rehearsal and separately authorized pilot dates. MCDR live access is specifically unresolved externally. The four scheduled reviews remain paused. Tests establish software behavior; they establish neither a trading edge nor an observed-session pass.
