# Independent fixed-exit code review

Reviewer actor: `/root/w7_independent_review`. Review recorded 2026-10-25T22:56:05Z (2026-10-26 Cairo). This is a separate AI actor, not human-independent validation; no model identity is asserted. No app, policy, schedule, or original ledger file was edited by this reviewer.

Reviewed `app/v5/fixed-exit-attribution.mjs` against section 3 of the frozen `verification/v5-phase3-20261023/TEST-PLAN.md`, original `app/v5/execution.mjs`, and relevant risk/money/valuation helpers. Post-fix file SHA-256 observed: `5025ddeaf83801b8ed949143a68271521476792579be695475daa69d196eff8d`.

## Findings and disposition

1. **P1 — Supplemental observations could create an unrelated counterfactual trade.** The initial implementation admitted any distinct MINUTE/DAILY_CLOSE supplement in the observation window but applied it only to the counterfactual. Executed `fixed-exit-repro.mjs` with no RISK_EXIT event: the control difference was zero; adding one minute produced no actual position versus one counterfactual position and an apparent actual-minus-fixed-exit difference of 10,656 cents. This attributes different evidence coverage to exit suppression. See preserved `fixed-exit-repro-result.json`. Parent implementation now restricts supplements to counterfactual-only held exposure with no original held or pending exposure in that instrument. Re-execution rejects the original reproduction with the expected explanatory error; output preserved in `fixed-exit-after-fix-rejection.txt`. **Resolved for reproduced case.**

2. **P2 — Wrapper options could replace audited ledger inputs.** Initial `fixedExitAttribution(path, options)` spread options after the audited config/events. A caller could therefore audit ledger A while calculating from other events/config. The replacement events still faced semantic validation, but the result no longer represented the specified audited ledger. Parent implementation now allowlists `openingMarks` and `supplementalEvents` and explicitly supplies audited config/events. **Resolved by source inspection; dedicated wrapper regression expected in W7 tests.**

## Additional inspection

- Original replay runs first through the existing transition validator; original certificates and accepted decisions are not fabricated for changed states.
- SUBMIT recomputes `prepareEntry`/`sizeEntry` from changed state using the original proposal. Both monetary ceilings remain active; quantity is capped by `Math.min(original.quantity, calc.quantity)`. Later revalidation can only decrease quantity. Reservations and planned loss are recomputed for that capped quantity.
- Entry/exit pricing, adverse friction, whole-quantity minute/daily capacity, settlement restrictions, exit fee reserve, delayed-event timeline, stop/trailing/trend/time lifecycle match the original mechanics, with decision bookkeeping removed.
- RISK_EXIT alone is suppressed. Mandatory thesis exits and corporate-action holds remain. Missing original opening marks for retained exposure cannot be replaced by later original proceeds: the failed event rolls back, retains exposure, and emits COUNTERFACTUAL_BLOCKED. Source-backed opening supplements cannot replace an original mark and must pass prior-close/availability checks.
- Missing/stale or action-held marks cause null equity via `valuation`; no mark forward-fill was added. An observed value after a missing-data event is still conditional: consumers must retain blocked events and gaps, as the report does.
- Scope flags and limitations explicitly deny a competing strategy, actual execution, or new entry authorization.

No additional actionable defect was established during this source review. This is not a full correctness proof or a market-data validation. Full affected regression results, funded later-intent divergence, both friction scenarios, and original file/ledger preservation remain release evidence responsibilities.
