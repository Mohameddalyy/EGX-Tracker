# W8 — client action desk and acceptance

Engineering status: **IMPLEMENTED AND TESTED**. Client acceptance: **PENDING ACTUAL COMPREHENSION RESPONSES**. No schedules, pilot or real trades activated.

## Delivered

| Requirement | Running implementation | Evidence |
|---|---|---|
| W8.1 Action cards | Verified ledger projection with action now, observed/case times, feed delay, thesis, entry/size/cash, expiry, current/initial/pending stops, exact exit rules, uncertainty, gaps, review and source drill-down. | `app/v5/client-cards.mjs`; desktop/mobile captures; regression suite. |
| W8.2 Distinct states | Rejected, awaiting research, blocked, waiting trigger, approved paper intent, expired, submitted/unfilled, filled/open, exit pending and closed. Research records cannot manufacture accepted orders. | All ten state labels; actual engine lifecycle and state tests. |
| W8.3 Operations | Read-only current run timing, all unfinished jobs/owners, recovery, recorded obligations and unknown deadlines; catalog work separated from substantive reviews. | `app/v5/client-operations.mjs`; timeout/checkpoint tests. |
| W8.4 Risk | FULL versus bounded comparison labels; proposed/default/reduced/no-trade alternatives, monetary loss scenarios, advisory exceptions, binding checks, liquidation limits and known current concentration. | Deterministic existing risk dossier; stale-mark and current-stop regressions. |
| W8.5 User control | Registered engineering ledgers only: actor/reason/state-bound pause or cancel atomically appends original engine events. User-intervened results marked separately. Notes never silently cancel orders. | Delayed pre-cancel fill reconciliation; pause blocks new entries; stale commands fail; event replay and history-integrity tests. |
| W8.6 Reporting | Existing workflow CLI checkpoint callback writes concise local summary and linked full evidence, including partial/failed runs, explicit top-level incidents and unknown holdings. Quiet unchanged incidents; no numerical-match trade alerts. | Dispatcher timeout publishes partial checkpoint inside five minutes with owner and monitoring obligations intact. |

The main dashboard links to the running action desk at **http://127.0.0.1:4318/actions**. The standalone helper starts no collectors or scheduled jobs. The same routes are integrated into `app/server.mjs` for its next normal reload. Historical experiments are not automatically enrolled; current engineering ledgers and sourced non-execution candidates have explicit operator registration/publication commands documented in `agent/v5-client-interface.md`.

## Verification and observed defects

- **328 tests pass**, zero failures or skips: `release-tests.txt`. This includes19 W8 regressions.
- Headless desktop/mobile browser checks: no JavaScript errors or horizontal overflow; original form answers persist; synthetic tests cannot establish client comprehension. Test workspace is temporary and distinct from Mohamed's records.
- Expanded tests caught a genuine projection defect: processed no-fill observations were shown as waiting for a first trigger because the projector looked for an order field instead of the engine diagnostics. It now shows submitted/unfilled and the last recorded reason. The failed test output is retained.
- A subsequent exit test lacked the existing engine's required prior daily-volume evidence. The engine correctly retained the pending exit; the test fixture was corrected without weakening execution rules. Both intermediate failures remain in `component-tests-final.txt` and `component-tests-corrected.txt`.
- Code review corrected display of original versus raised current stops, future stop changes, expired quantities and stale concentration. Entry-zone wording explicitly requires price above the original stop.
- Retained data:296 stocks, zero stale-eligible mismatches at the historical cutoff; seven policies, nine Phase3 artifacts, original experiment and evidence dictionary unchanged. Four automations remain PAUSED. W7 source hashes and frozen execution-release hash are unchanged.

## Client acceptance record

The saved plan requires five representative cards, each understood across action, timing, size, invalidation and uncertainty within two minutes. The five cards were built from the actual execution engine's **fictional** inputs. No market approvals or actual orders were created. Automated UI submissions run in isolated temporary workspaces and are not client evidence.

Mohamed submitted five original entries within the time limits, then explicitly clarified: **“Placeholder answers to test the form.”** These demonstrate form operation only. The originals, timings and appended clarification remain in `data/v5-client/client.sqlite`; they are excluded from comprehension and may not be scored as acceptance. They are also not represented as evidence that Mohamed misunderstood the cards.

The interface was improved with explicit BUY/WAIT/EXIT headings and full-sentence questions instead of bare jargon labels. Mohamed elected to take the actual comprehension check. Until those answers are reviewed, this record makes no 5/5 claim and W8 is not fully accepted. Failed genuine attempts, if any, must remain visible alongside later retries.

## Scope and remaining boundaries

- Paper preparation / engineering only. No real broker order API or prospective activation path.
- A pause preserves existing positions, required exits and delayed-fill reconciliation; it does not mean the portfolio is flat.
- A local report receipt proves availability, not client reading or an external notification. Process death before the first callback and actual-session delivery require W9/W10 rehearsal.
- Current source authentication, licensing/rules and action-entitlement limitations remain earlier launch dependencies. This interface does not solve them by hiding gaps.
- User-intervened cards are separated explicitly; W9 downstream comparison/report integration must honor that partition. Existing immutable W7 reports are preserved.
- The frozen engine/evaluation package was not modified to implement the client UI. Default `npm test` predates some later evaluation tests; the full verification runs all `app/*.test.mjs` files without changing the release-bound package manifest.

Next: actual client acceptance, then W9 integrated release/fault testing. See `agent/v5-client-interface.md` for operation and acceptance-review commands.

## Acceptance clarification

Mohamed subsequently asked the purpose of the five-card check. The assistant explained that it evaluates interface clarity rather than investment knowledge or trading edge, and suggested a guided walkthrough as a more useful alternative to an exam-like questionnaire. No acceptance-protocol amendment or successful comprehension result is assumed. The software implementation is complete; client usability acceptance remains unresolved. No further timed response is required by this implementation turn.
