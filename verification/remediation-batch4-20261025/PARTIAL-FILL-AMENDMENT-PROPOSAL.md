# Unapproved amendment proposal: residual-aware liquidation

25 October 2026. **Proposal only. The frozen all-or-none behavior is retained.**

The engineering deadlock case demonstrates that a funded near-full-capital entry can become impossible to liquidate when each later valid minute supports fewer than its entire shares under the frozen 1% participation cap. A triggered stop remains an open exposure; its stop price is not a fill guarantee. Summing minute capacities would silently implement partial fills and is prohibited in this version.

A possible future amendment would permit partial **exits**, with an explicit residual quantity and continuing mandatory exit, while initially retaining full-only entries. Before approval it must specify:

- Whether each partial execution is a separate modeled order and fixed charge, and how residual fixed fees remain funded when prices collapse.
- Minute/daily capacity allocation, event-order tie-breaking, settlement lots and exact cost-basis/realized-return allocation.
- No increase in total approved shares, no stop loosening, no cancellation of the residual mandatory exit, and no implied queue priority.
- Cancellation/replacement chronology and late observations, including atomic residual updates and restart/idempotency proof.
- New strategy/simulator version and separate base/stress comparator cohorts; no retroactive application to this or the original experiment.

Acceptance evidence must cover at least three partial lots across two sessions, T+2 by lot, an unavailable final residual, duplicate/out-of-order observations, zero remaining funded fee capacity, and complete reconciliation to whole-share and piastre totals. Compare frozen full-only and proposed partial-exit behavior on identical prospective opportunities. This engineering example establishes a structural limitation, not how often it occurs in EGX trading.

No approval is requested in this implementation batch and no amendment is applied. Review this proposal before any cohort whose intended objective requires realistic residual liquidation.
