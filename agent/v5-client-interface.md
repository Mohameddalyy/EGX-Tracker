# W8 client interface and acceptance

W8 adds a local action desk at `/actions` on the main server, or `http://127.0.0.1:4318/actions` using `node app/v5-client-server.mjs`. The standalone server runs no collectors, research jobs, paper simulation or schedules. Its default port is 4318; `EGX_CLIENT_PORT` changes it.

## Inputs and authority

- `node app/v5-client-agent.mjs register-ledger FILE` registers an existing workspace-contained, isolated engineering ledger. FILE has `id`, `label`, `path` (workspace-relative) and explicit `allowControls` boolean. No historical experiment is automatically enrolled. Reading requires successful semantic replay with the matching frozen execution release.
- `publish-candidates FILE` accepts an array of sourced, dated non-execution records with `id`, `instrument`, optional `label`, `at`, `status`, `reason`, `sources`, and `nextReview.trigger`. Only REJECTED, AWAITING_RESEARCH, BLOCKED and WAITING_TRIGGER are allowed. Publication history is append-only. Such records cannot assert an accepted order, position, or executable quantity.
- Accepted cards derive from ledger events, state, bound research/decision records and deterministic risk dossiers. Expiry is evaluated at the display clock without changing the ledger. Current held stops and pending stop changes are distinct from the original entry stop. Unknown or stale portfolio valuations do not produce concentration percentages.
- FULL/discretionary and bounded comparison variants remain distinct. Cards display scenarios, alternatives, advisory exceptions, immutable checks, known missing evidence and whole-order liquidation limitations. Nothing in the interface authorizes a real order or activates a prospective pilot.

## Controls and audit

Only PAUSE and CANCEL are available on explicitly enabled engineering ledgers. Both require actor, reason and the state hash last displayed. The service replays the ledger, then compares the locked state within the same SQLite transaction as its event insertion. It invokes the existing execution transition, preserving the event/hash chain. Stale submissions fail.

Pause blocks new entries and cancels future pending entry eligibility. Cancellation is not a claim that no earlier eligible delayed fill occurred. Reservations remain until reconciliation; marks, exits, settlement and unresolved exposure remain obligations. The UI cannot resume schedules, widen stops, override binding controls, force fills or change quantities. Risk Agent advisory exceptions remain the separate frozen risk process.

Interventions carry original actor/time/reason/effect in the execution ledger and mark client cards USER_INTERVENED_KEEP_SEPARATE. Original decisions are retained. User notes and requests to defer research are separate append-only annotations, never silent order cancellations. Downstream W9 comparison integration must preserve the user-intervened partition; historical evaluator artifacts are not rewritten.

## Operations and checkpoint delivery

The action desk shows saved incremental run timing, unfinished jobs, waiting owners, recovery state and all recorded obligations. Unknown obligation deadlines stay unknown. Counts distinguish catalog/data work from recorded decisions and substantive company research. No market data is refreshed on page load.

The existing workflow CLI checkpoint callback now publishes a concise W8 summary and a linked full report. Partial/failed runs still produce summaries. Delivery time and the five-minute limit are explicit. Every checkpoint is retained; unchanged incident fingerprints stay quiet. A numerical screen match never creates a trade notification. A local delivery timestamp establishes report availability, not human reading or external message delivery. Process death before any callback and end-to-end actual-session delivery remain W9/W10 fault/rehearsal work.

## Client comprehension acceptance

The five fictional cards cover blocked, waiting trigger, expired intent, pending exit and approved executable paper-intent conditions. They are derived from execution fixtures and conspicuously labelled fictional. The original per-case card and hash are stored when the human starts it. Server time measures until answer submission; two minutes per card is the saved acceptance limit. Action, timing, size, invalidation and uncertainty require original free-text answers. Synthetic browser tests run only against a temporary workspace and cannot constitute Mohamed's acceptance.

The local event store preserves original starts, answers, durations, retries and separate reviews. `history` exports these records; `review-answer FILE` appends five explicit boolean ratings and a reasoned comparison to the original answer. FILE contains `answerId`, `reviewer`, `ratings` (action/timing/size/invalidation/uncertainty), and `evidence`. `acceptance-status` requires all five cases passed by the same participant, each within two minutes and with a separate review. Reviews cannot overwrite an existing review. A failed attempt remains visible when a later attempt passes.

W8 cannot be reported fully accepted solely on software tests. Genuine client results must be reviewed, and any misunderstanding that could cause an incorrect order is a release blocker.

## Validation commands

Run `node --test app/v5-client.test.mjs` for W8 mechanics, and all `app/*.test.mjs` files for the full current suite. Do not edit package.json solely to add this command: the frozen execution release binds that file. The browser check is `node verification/w8-client-20261026/browser-check.mjs`; its isolated synthetic form submissions are explicitly not client acceptance. Original frozen Phase3 rules, W7 evidence and historical experiment remain unchanged.

Client clarification: placeholder form tests are excluded through append-only COMPREHENSION_CLASSIFICATION records. A classified submission cannot be reviewed as a comprehension pass. The five original placeholder answers remain preserved. Interface version W8-CLIENT-2 records clearer action headings and complete questions; no original answer is changed.
