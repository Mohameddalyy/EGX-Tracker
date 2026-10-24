# Phase 3 checkpoint — trading and test specifications

Prepared 23 October 2026. **Paper only; not activated.**

The user selected **EGP 100,000** starting capital and **“any amount of risk if justified.”** The new FULL portfolio therefore has no hard percentage sizing, concentration, reserve or drawdown ceiling. A dedicated Risk Agent may choose zero exposure through all feasible funded cash, with documented alternatives, downside scenarios, independent challenge and deterministic arithmetic. Borrowing/leverage and real orders are outside this plan. The risk mandate is specified here; its production implementation belongs to Phase 4.

## Frozen package

- [Trading plan](TRADING-PLAN.md): full-universe eligibility, exact signal/volume/entry/exit rules, modeled fees, delayed-bar chronology, capacity and settlement assumptions.
- [Risk Agent mandate](RISK-AGENT.md): allocation and earlier full-exit authority, advisory exceptions, portfolio scenarios, independent challenge and certificate lifecycle.
- [Test plan](TEST-PLAN.md): nine registered comparisons, two friction scenarios, accounting/state/chronology tests, readiness gates, model evaluation and prospective evidence requirements.
- [Machine parameters](plan.json) and [decision schema](decision-schema.json).
- [Freeze manifest](freeze-manifest.json) and [integrity validation](validation.json).
- [Phase 2 data dictionary](../v5-phase2-20261023/data-dictionary.json).

FULL's conventional risk percentages are advisory and may be overridden with justification. They remain hard rules only in the separately funded bounded control. FULL's comparison measures both allocation and discretionary risk-exit decisions; a fixed-exit diagnostic separates their effects. Risk review can bring an exit forward, never postpone a mandatory exit or widen a stop.

The delayed-feed model uses actual decision timestamps. An in-window market event may reconcile after window expiry, while cash remains reserved until the declared reconciliation deadline. Unobserved opportunities are censored and reported as coverage failures; no guessed or retrospectively invented fills are allowed.

## What this checkpoint establishes

This is a specification freeze, not a claim that v5 software, replay or a paper week has passed. Integrity validation checks artifact consistency, local references, schema structure, recorded authorizations, preserved production-policy hashes, historical ledger digest and paused schedules. The schema needs a full Draft 2020-12 validator and semantic execution tests during Phase 4/5; structural validity alone cannot authorize a trade.

The old October experiment remains separate and unchanged. All four scheduled reviews remain paused. No start date, new production policy or execution authorization is introduced.

## Remaining prerequisites and next phase

Phase 4 implements the new engine, Risk Agent contracts, ledger/state transitions, diagnostics and reports in an isolated version. Phase 5 runs the registered validation and dress rehearsal. Resume/activation still requires the user's explicit instruction.

Before a prospective test can start, bind verified current session/auction/holiday rules, ticks, daily price references/bands, instrument tradability and settlement calendar; establish suitable data coverage and actual model/prompt identities. Costs here are synthetic scenarios, not verified broker fees or taxes. Historical minute and point-in-time research availability may prevent some comparisons; unavailable results must remain visible. A five-session test cannot demonstrate an established trading edge.

Any later change to these frozen strategy/risk/test specifications requires a new version and linked amendment; preserve this package and the original result history.
