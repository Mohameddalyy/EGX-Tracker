# Risk Agent mandate — v5 paper experiment

**Frozen Phase 3 mandate; not a running agent or an execution authorization.**
Starting paper equity: **EGP 100,000**. User instruction: **“any amount of risk if justified.”**
Scope: the new isolated paper experiment only. No real capital, brokerage connection, borrowing or leverage.

## Authority and separation of duties

The Risk Agent evaluates the whole portfolio and chooses the monetary risk allocation for each eligible opportunity. It may select zero or any feasible amount of funded unlevered cash, including a concentrated allocation whose failure could consume all invested paper capital. There are **no hard percentage risk, name/sector concentration, cash-reserve or drawdown ceilings for FULL**.

It cannot create cash, reuse unsettled proceeds, remove modeled charges, invent evidence, override market/chronology validity, change the frozen signal or exit rules, widen stops, average down, pyramid, short, trade real funds or restart schedules.

Roles for the future implementation:

1. Analyst: substantive company/thesis research and countercase.
2. Final Decision reviewer: independent eligibility and thesis challenge.
3. **Risk Agent:** independent allocation, portfolio exposure and survival analysis.
4. Final Decision reviewer returns as risk challenger: reviews the proposed allocation and exceptions without silently rewriting the analyst thesis.
5. Deterministic gate: calculates quantity/reservations and enforces immutable checks. Only the paper simulator may record a simulated fill.

This adds a specialist risk role; it is not the future performance-learning reviewer, model retraining, or an invented external committee. Save the actual agent/model identity and report, not fictional votes.

A factual or execution-validity objection must be resolved before approval. A disagreement about how much otherwise valid paper risk to accept remains visible. After addressing that disagreement, the Risk Agent may retain its chosen allocation; the challenger is not a hidden percentage-cap veto. Missing independent review means unfinished work, not approval.

## Advisory defaults and permitted departures

The following are comparison/reference guidelines, **not ceilings on FULL**:

| Guideline | Default reference | Permitted departure |
|---|---:|---|
| Planned loss per position | 1% current verified equity | Any funded feasible amount, with marginal-loss reasoning |
| Aggregate forward planned loss | 4% equity | Larger exposure with whole-portfolio and shared-shock analysis |
| Stock / issuer-control group | 25% equity | Concentration accepted with issuer-specific total-loss scenario |
| Sector / correlated cluster | 40% equity | Larger common-factor exposure with explicit joint stress |
| Uncommitted cash | 10% equity | Lower or zero discretionary reserve, while fully funding modeled charges/commitments |
| Positions | 6 | More or fewer if actual monitoring capacity and evidence remain complete |
| Important noncritical missing data | One aggregate 50% sizing haircut | Override only with a specific explanation of what is unknown, its plausible adverse consequences and why the amount remains acceptable |
| Daily observed drawdown | 2% from opening marked equity | Pause new entries for fresh risk review; continuation requires a recorded exception |
| Experiment observed drawdown | 4% from observed equity peak | Same review requirement; no automatic permanent stop or forced liquidation |
| Allocation priority | Deterministic signal rank | Choose another eligible candidate with comparative portfolio rationale |

For the bounded comparison ledger these same figures are hard constraints. That control never inherits FULL's exception authority.

A guideline can be bypassed only if it appears in this table. The Risk Agent cannot relabel a critical gap as noncritical. Resolving a gap through verified evidence is a changed evidence state, not an exception. The 50% default haircut applies once across unresolved important gaps; duplicate sources of the same uncertainty must not create stacked numerical penalties.

Drawdown-triggered reviews are once per newly crossed threshold episode, and again after each additional **2 percentage points of experiment drawdown** or a material new loss mechanism. An exception expires at the current session close; continuation on another day requires fresh review. This is a review cadence, not a loss cap. Once a drawdown review is due, pending entries are canceled until a new certificate permits them. Existing frozen exits continue throughout.

## Required decision procedure

**Bind the evidence.** Use immutable plan, portfolio, commitments, rule bundle, source and thesis hashes. Inspect holdings and pending exits first. A stale mark cannot prove low risk. If cash, position quantities or critical valuations are unreconciled, block new allocation.

**Name the loss mechanisms.** Distinguish thesis failure, technical failure, adverse gap, reduced liquidity, settlement lock, company suspension, shared economic exposures and missing evidence. Identify which risks can be estimated, which can only be stressed and which remain unobservable.

**For entries, compare at least four alternatives:** no trade; a reduced amount; the advisory-default amount; and the proposed amount. If two collapse to the same feasible size, explain it. Show incremental EGP at risk, concentration, cash and exit burden when moving from the smaller allocation to the chosen one. Compare another eligible company where available; otherwise say none is presently eligible. For an earlier full risk exit, compare at least continuing to hold under mandatory exits versus exiting now; no partial-trim alternative is executable in this version.

**Select explicit monetary budgets.** Record maxPlannedLossEGP and maxCashAllocationEGP separately; at least one must be a positive number for an entry, the other may be null. When both exist, both constrain quantity. Cash allocation includes entry costs and reserved fixed exit fees. Never interpret a cash budget as a loss budget. Ground the choice in downside robustness and portfolio fit; there are no mandatory discrete risk bands. Do not convert a language-model confidence score into a risk percentage, claim optimality without a utility/probability model, or use unsupported Kelly sizing. Recent wins or losses alone do not justify greater exposure.

**Calculate and challenge.** Code computes the largest feasible integer quantity satisfying the selected budget, settled cash, fee reservations, observed volume constraints and all retained certificate conditions. The risk report distinguishes desired size, feasible size and the binding constraint. The challenger checks the facts, alternatives, stress and arithmetic.

**Issue a certificate.** It applies to one instrument, setup/order intent and pre-reservation portfolio snapshot. Atomic acceptance records an expected reservation transition and accepted-order hash; its own reservation does not invalidate it. New commitments, marks or other nonmaterial state changes require a deterministic revalidation receipt, not a fictitious new discretionary approval. The receipt may preserve/reduce quantity or cancel future eligibility; never increase it. Material thesis/price-zone changes, critical gaps or a required drawdown review cancel future eligibility at the actual committed time and require a fresh certificate. No new entry approval after session open. Certificate validity limits eligible market events; delayed confirmation of previously authorized events follows the trading plan's reservation/reconciliation deadline, without retroactive cancellation.

## Risk measures and required scenarios

Keep three measures distinct:

- **Initial committed risk:** original entry-to-modeled adverse stop loss, including planned costs. Preserve for trade R-multiples even after stop changes.
- **Current forward risk:** for held longs, q × max(0, current mark − modeled adverse exit) plus remaining exit costs; for pending entries, worst permitted entry-to-adverse-exit risk and costs. No negative-risk offset from unrealized gains.
- **Stress loss:** loss under an explicitly specified scenario, including delayed execution and liquidity restrictions. A finite scenario set is not maximum possible loss.

For every allocation, compute EGP and equity-percentage outcomes at proposed and default sizes for:
1. Modeled stop execution with base and stress friction.
2. A gap to the worse of stop minus two ATR and the current verified lower daily band, respecting nonnegative prices. This is a hypothetical price scenario, not an observed fill.
3. No liquidation for two further verified sessions, with successive applicable lower-band scenarios; where a future reference is unknowable, label the assumed reference rather than assert legality.
4. Minute volume reduced to 25% of observed/trailing reference volume; estimate required liquidation intervals at the fixed 1% participation limit, without pretending queue priority.
5. A shared adverse move across the actual portfolio's sector, FX, rate and refinancing exposures. Quantify only supported sensitivities; show unquantifiable exposure separately.
6. Each proposed issuer and then all held issuers becoming worthless. Funded cash remains cash; incurred costs remain costs.
7. Loss of 100% of current equity as a survivability illustration, not an estimated probability or a ledger write.

Never mark an unobservable/suspended stock at zero merely to populate a stress scenario. Ledger valuations and hypothetical stresses are separate. Report how much of the current equity remains liquid and how much is at risk or unavailable for settlement.

If a stress cannot be calculated because its exact economics are unknown, the agent must explicitly compare the full-invested-principal loss scenario and explain why accepting that uncertainty is justified. Missing critical cash, identity, action, price or legality cannot be handled this way.

## Exception contract

Every departure needs:
- A specific allowlisted guideline ID, default result and proposed alternative.
- Distinguishing source-backed evidence and the strongest contrary evidence.
- Portfolio before/after, committed cash, forward risk, stress and liquidation burden.
- Why cash or a smaller allocation is less attractive under the stated assumptions; acknowledge that this is a judgment, not mathematical proof.
- Compensating conditions, expiry and revocation events.
- Actual Risk Agent identity/model/configuration, independent challenge, response and remaining dissent.
- Deterministic validation and final chosen quantity reference.

“No risk limit because high conviction” is not a complete argument. An old exception is not precedent for a new order. No retrospective approvals or chained exceptions that collectively remove an immutable check.

When a held portfolio exceeds advisory concentration through price movement, record it and review it. Do not fabricate liquidation or widen a stop. The Risk Agent can cancel future entry eligibility, choose new allocations, and commit an earlier full risk-led exit after documented alternatives and independent challenge under the trading plan's explicit risk-exit rule. It cannot postpone an existing stop/trend/time exit. No partial trimming in this version. Ordinary precommitted exits do not wait for a new Risk Agent review; the review is required only for a new discretionary risk exit.

## Output contract

Use [decision-schema.json](decision-schema.json). The risk certificate includes monetary budget, funded cash, computed quantity, initial and forward risk, alternatives, scenarios, guideline departures, challenge and validity. A BLOCK result remains a real decision with reason and next review.

The numeric share count must come from the deterministic calculation artifact. The Risk Agent's text cannot overwrite it. All actor outputs and original reasoning are preserved, including dissent and later adverse outcomes.

## Risk-specific test obligations

The test plan must demonstrate:
- An independently justified near-all-funded-cash position can pass; no hidden percentage cap.
- A persuasive but unfunded position cannot pass.
- A concentration/default-risk departure is permitted only with the scoped exception record.
- Critical missing data cannot be waived.
- Pending/concurrent orders reserve cash and exit fees atomically.
- A profitable holding still consumes forward downside risk.
- A drawdown exception is recorded and expires; continuation is not silently prohibited or silently allowed.
- Settlement/limit-lock prevents a fill even if the stop is breached.
- Stale/mismatched/expired certificates cannot be reused.
- A Risk Agent cannot change RV20, widen a stop or average down.
- Full-principal loss scenarios do not mutate observed marks.
- Risk changes after winning/losing streaks require current evidence, not “house money” or loss-recovery reasoning.

Evaluation compares FULL versus FULL-BOUNDED on identical opportunities and simulator assumptions, alongside a matched-opportunity sizing analysis. Compare return, drawdown, loss recovery, concentration, liquidity burden, modeled tail loss and costs. Greater return with much greater exposure is not automatically better risk analysis.

This mandate was reviewed by a separate design subagent at the user's request. That design review is not evidence of successful live Risk Agent operation; implementation and adversarial testing remain Phase 4/5 work.

