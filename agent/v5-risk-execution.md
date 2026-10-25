# v5 risk and execution component

25 October 2026 — remediation batch 4. Engineering implementation only. All global EGX schedules remain paused. This component cannot submit brokerage orders and has no live or prospective-pilot activation mode. Its SQLite ledgers are explicitly `ENGINEERING_PAPER_ONLY`, separate from the original experiment.

## Operating sequence

1. Supply the complete admitted signal input, dated rule bundle, frozen five entry dates, and current preflight evidence. The full catalog calculation is reused within the process only when its content hash is unchanged. Correlation admission covers the candidate and current portfolio. Fresh preflight/news/action verification remains mandatory; a cached score does not establish unchanged news.
2. Record `OPEN_DAY` before the verified continuous open, with prior confirmed marks for every position. It reconciles due settlement using supplied verified business days and fixes that day's opening equity. A missing or unresolved action basis blocks allocation; it does not turn the position into zero value.
3. Prepare a context and deterministic risk dossier. `ASSESS` can retain a proposed/blocked preparation with reasons, next review and no reservation. It never approves a trade. Output immutable files for review.
4. Research variants require separately committed analyst/final reviews bound to their original packet. B1/B2 remain mechanical controls. Research approval is checked at its recorded completion time; a fresh pre-open preflight checks for changes since that review. Inputs and commitments are not evidence of actor authentication or truthful source content by themselves.
5. For FULL variants, an actual separate Risk Agent reads the dossier and selects monetary budgets. It must compare no trade, reduced, advisory-default and proposed amounts; justify marginal risk, another candidate or its absence, FX/rate/refinancing exposures, liquidation limitations, missing data, monitoring capacity and current changed evidence. Use actual actor/model identities. Never fabricate a model run or convert qualitative confidence into a probability or allocation percentage.
6. The Risk Agent returns the frozen schema's certificate and substantive report. The challenger must be another actor and bind the exact certificate content and deterministic dossier. Record objections, response and remaining dissent. The same model under different roles is reported as such. Factual/critical defects block approval; differing risk appetite is retained without creating an undeclared hard percentage cap.
7. `SUBMIT` rechecks full Draft 2020-12 conformance and semantics against the current ledger and prepared snapshot. It accepts one intent and reserves its cash/fees atomically, or rolls back. Bounded variants cannot borrow FULL exceptions. No new approval is accepted at/after open, in a held/pending name, or after the five entry sessions.
8. Feed completed raw minutes in actual receipt order through `MINUTE`. Market start must be strictly after the relevant intent. Entry prices are adverse rounded opens inside the zone, observed range and dated bands. One percent daily and minute capacity must accommodate the entire quantity. Cheaper fills cannot increase size.
9. Process `DAILY_CLOSE` from full admitted input: the engine recomputes close/ATR/SMA20 instead of trusting an asserted calculation hash. Trailing latches and takes effect next session; stops never loosen. Trend/time exits persist. A stop observed at receipt commits an exit then; it cannot fill in that old minute. `THESIS_BREAK` requires independent source-backed review; `RISK_EXIT` requires the distinct full-exit dossier/challenge. Neither can postpone an existing mandatory exit.
10. `TICK` advances expiry/reconciliation. Cancellations and revalidation apply prospectively to market-bar starts. Retain original reservations while earlier authorized events may still arrive. At the deadline, unresolved entries become censored `NO_FILL_EVIDENCE`; later bars are diagnostic. Held exits never expire this way.
11. Reopen and `replay` an engineering ledger to check deterministic event/state hashes. Retry IDs must match their original payload; duplicate minutes cannot fill twice. Source changes requiring correction must be explicitly reconciled, not silently overwritten.

## Contracts

`app/v5/decision-schema.json` remains byte-identical to the frozen Phase 3 schema. Runtime validation uses pinned Ajv 8.17.1 with `ajv-formats` 3.0.1, lockfile integrity and date-time validation. Only schema strict-type lint is disabled to support the frozen conditional subschemas; data coercion/default insertion/property removal are not enabled. References: [Ajv JSON Schema documentation](https://ajv.js.org/json-schema.html), [format validation](https://ajv.js.org/guide/formats.html).

Contexts bind policy, code/dependency release, baseline, instrument, variant, cost scenario, complete pre-reservation snapshot, sources, research, rules, session and expiry. Risk certificates bind that context and deterministic quantity. A separately hashed report binds the certificate body and final challenge; hashes establish content integrity, not legal signatures or actor identity.

The execution release digest normalizes CRLF to LF for source/dependency text so Windows checkout conversion does not change the code identity. Frozen plan/schema checks remain byte-for-byte. A changed source/dependency release blocks old-ledger mutation/replay until an explicit reviewed migration; it never silently rewrites old events.

Required deterministic check IDs: PAPER_ONLY, IDENTITY_RULES, CRITICAL_EVIDENCE, CHRONOLOGY, SIGNAL_RESEARCH, FUNDED_CASH, WHOLE_SHARES, PARTICIPATION, FROZEN_EXITS, NO_DUPLICATE_POSITION, SETTLEMENT, RELEASE_BINDING. All must be present once and refer to the computed context. An arbitrary list containing one passing check is rejected.

FULL may override only the schema's advisory guideline IDs. Cash, price/time validity, participation, critical data and fixed exits remain immutable. Risk budgets distinguish planned loss from cash allocation. Important noncritical gaps cause one aggregate 0.5 haircut unless explicitly overridden for FULL; optional omissions do not blanket-exclude a stock. Zero feasible quantity stays blocked and visible.

Money is held as integer piastres. Exact decimal products are rounded half-up once per notional/charge. Entry reservation includes entry notional, entry fee, and fixed exit fee. Actual entry consumes notional/fee; fixed exit cost remains reserved. Exit consumes that fixed reserve and records net sale proceeds as unsettled; cash is not reusable until the second subsequent supplied settlement business day. There are no partial fills or real tariff/after-tax claims.

Each variant/cost scenario has its own EGP100,000 ledger. Base and stress scenarios independently resize and retest fills. Historical correlation uses 60 aligned returns and connected components at 0.8, with missing/constant samples disclosed. Stress results distinguish calculable assumptions from unquantifiable economics. Future band references and shared-factor sensitivities are never inferred as facts. A 25%-volume interval count, if supplied a reference, is explicitly a counterfactual partial-fill calculation; the active all-or-none model may remain stuck indefinitely.

## Manual commands

Run with installed Node 24 from the repository root:

```text
node app/v5-execution-agent.mjs init NEW_DB CONFIG_JSON
node app/v5-execution-agent.mjs status DB [NEW_OUTPUT_JSON]
node app/v5-execution-agent.mjs prepare DB BUNDLE_JSON PROPOSAL_JSON NEW_OUTPUT_JSON
node app/v5-execution-agent.mjs event DB EVENT_JSON
node app/v5-execution-agent.mjs replay DB
node app/v5-execution-agent.mjs simulate NEW_DB LABELED_SYNTHETIC_INPUT NEW_OUTPUT_JSON
```

Manual event commits must be within 60 seconds of actual time and cannot be in the future. Historical clock injection exists only in the explicitly labeled engineering simulator/API. `SET_PAUSE` affects that isolated ledger only; it never changes global schedules. The CLI never generates a Risk Agent approval. `prepare` outputs calculations, not an executable decision.

Use `app/v5/execution-fixtures.mjs` solely as a schema/engineering example. Its role/model IDs and rules are synthetic. Never reuse fixture approvals as research evidence. The immutable examples and complete event streams generated by the batch verification script are similarly non-performance evidence.

## Remaining launch boundary

No verified official market-rule/entitlement bundle, independently adjudicated actual model evaluation, client acceptance, production service integration or actual-session rehearsal was added here. These remain W1/W3/W7–W10 gates. Corporate-action changes place affected holdings on provisional hold; automatic dividend, split, rights and cost-basis reconciliation is not implemented. A new verified action-handling release is needed before affected holdings can resume. No silent share/cash adjustment is permitted.

The new engine is callable from manual engineering interfaces. Integrating it into the paused scheduler/dashboard requires the later release/integration work; adding an activation path is not an incidental configuration change. The original experiment and historical policy remain untouched.
