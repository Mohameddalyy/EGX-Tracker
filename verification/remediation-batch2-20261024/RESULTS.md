# Remediation batch 2 — incremental workflow

24 October 2026. **Implemented and verified offline; not activated for scheduled research or paper testing.**

This batch implements the W4 dispatcher against batch 1's repaired evidence contract. It replaces the blocking sequential refresh chain with durable stage receipts, targeted invalidation, owned work, bounded retries and checkpoint reports. It does not finish the entire remediation plan or establish Phase 4 readiness.

## Delivered behavior

| Plan item | Implementation | Verification and limit |
|---|---|---|
| W4.1 workload separation | Explicit baseline, screen and checkpoint profiles. Health, ledger visibility, all-decision obligations and existing claims precede source repair. Screen defers external refresh with visible gaps. | Planner/worker tests; read-only production plan accounts for 296 stocks, 33 recorded decisions, zero existing positions and two active handoffs. This is inventory, not 296 completed company reviews. |
| W4.2 cadence and changes | Weekly/Sunday catalog with local version import; Cairo-date facts receipts and omitted-symbol repair; confirmed-session history; independent news-window and document-content versions. New cited reports are inventoried without rereading unchanged reports. | Unchanged inputs reuse receipts; a changed filing affects its associated decisions; unchanged scores do not suppress news refresh. Official identity/action-triggered catalog invalidation still depends on W3's effective-dated event implementation. |
| W4.3 independent results | Each source/job has a result and receipt. Logs/raw evidence remain local. Collector exit zero is checked against relevant component coverage. Source failure cannot erase completed independent jobs. | Failure fixture preserves successful monitoring/receipts. Source permission is unresolved, so no new production collection was attempted. Feed completeness is not event clearance. |
| W4.4 queue continuity | Owner/token claims; waiting_event, retry_not_due and waiting_capacity; due waits resume before new candidates. Reassessment and intraday paths obey the same five-active cap. | Existing-owner protection, voluntary wait, event/time resumption, explicit legacy recovery and overflow tests. Substantive analyst/final review remains separate. |
| W4.5 receipt/restart behavior | Stable job IDs, transactional sidecar claims/receipts, child PIDs, run recovery and fixed local worker commands. Successful jobs survive close/reopen. | Disk restart, duplicate avoidance and actual child termination tests. This is not a cross-database exactly-once financial transaction system; the later v5 execution engine must supply its own atomic order/ledger invariants. A crash before saving a worker receipt can require re-observation, never an assumed fill. |
| W4.6 coverage/positions | Every recorded action and superseded decision appears in obligation inventory. Minute targets use actual candidates, valid setups, positions and exit obligations. Minute adapter is observation-only. | Actual isolated decision worker creates a bounded reassessment while original decision is unchanged. Actual minute CLI with a fixture connector preserves ledger digest and restores the original chart. No live TradingView coverage claim. |
| W4.7 retry/recovery | Source backoff persists across changing job revisions/news windows; persistent failures are labeled. Exact-owner recovery and evidence-backed retry invalidation are explicit. | Dead/live owner and source-lock tests; new news-window job cannot bypass a failed source's backoff. Required/overdue coverage remains visible. |
| W4.8 telemetry | Actual run/stage timing, planned versus actual start, source results, reused/deferred/failed counts and durable checkpoint progress. Model/provider/tokens explicitly unmeasured. | Stage reports and isolated scenario measurements below. There is no token budget and no model weakening. Dispatcher itself does not call a model. |
| W4.9 deadlines/reporting | Baseline 25/30-minute target/deadline, screen 2/5, checkpoint 5/8. Deadline requests cancellation, closes a truthful partial report and retains unsettled ownership. Sleep/clock jumps report lateness. | Hanging adapter, actual child cancellation and wall-clock jump tests. Node timers cannot guarantee delivery through PC sleep or blocking host work. No actual-session SLA proven. |
| W8 operations visibility, partial | Operations API/card shows dispatcher status, obligation inventory and unfinished work. Progress is persisted before run completion. | Rendering/escaping test and live localhost API/static-script smoke. Dashboard reports NOT_STARTED; no activation implied. Client comprehension and full decision/risk cards remain later work. |

Main runtime modules: `app/workflow-agent.mjs`, `workflow-planner.mjs`, `workflow-inputs.mjs`, `workflow-store.mjs`, `workflow-runner.mjs`, `workflow-adapters.mjs`, `workflow-worker.mjs`, `workflow-documents.mjs`, `workflow-recovery.mjs`, `research-queue-state.mjs`, `minute-observation.mjs`. The operating/recovery contract is [agent/incremental-workflow.md](../../agent/incremental-workflow.md).

## Acceptance evidence

- **171 tests passed, zero failed, zero skipped**, including **27 new workflow tests**. Full log: `full-tests.log` (local). Test command remains the package's full Node 24 test script. Final suite duration approximately 5.53 seconds on this host; that is test time, not production throughput.
- Syntax checks passed for 27 changed/new JavaScript files; `git diff --check` passed.
- Actual local worker integration fixtures exercise health, position accounting readout, immutable learning export, catalog version application and new-evidence decision monitoring against isolated SQLite stores. The minute CLI uses a fixture TradingView connector and checks exact target capture, chart restoration and unchanged paper ledger. External permission failures launch no collector.
- `dispatcher-scenarios.json` records six **in-memory scheduler fixtures**, not production latency. Cold receipts: 33 adapter calls; cached: zero calls/33 reused; one changed decision: one call/32 reused. Four source failures remain partial; their next-window retry performs zero calls. A 20 ms hanging-adapter limit produces a partial report and retained owner. The file includes measured durations and explicitly excludes real collectors/models.
- `retained-plan.json` is read-only current planning. It is not a completed research run or new source observation.
- `retained-verification.json`: seven original investment policies, nine Phase 3 files, the evidence dictionary and original paper ledger are unchanged; four automations PAUSED; old experiment remains zero orders/zero fills. All 23 previously recovered notices across 11 tickers remain routed, raw exchange index unchanged, and the historical-cutoff 296-stock check has zero screening/readiness disagreements.
- `runtime-smoke.json`: refreshed localhost Operations endpoint and JavaScript return successfully, show NOT_STARTED/activation false, and include the obligation-inventory UI. No production dispatcher sidecar/run was created by this batch.

Failures found during implementation were corrected, not hidden: a learning export referenced the wrong decision timestamp column; a new news window could reset retry delay; refreshed catalog files lacked a guaranteed local import when daily facts were already cached; replanning could repeat health checks; and the live API originally lacked in-progress checkpoint reports. These are covered by the final tests. Early failing logs remain local. A sandbox-only temporary-file rename failure passed on the identical authorized local test run; localhost/CIM inspection required local execution permission.

## Preserved boundaries

No new market collection, substantive analyst decisions, watchlist promotion, orders, fills, settlements, external outreach, purchases or schedule changes were performed on production data. No rule was relaxed to force trades. The original EGP20,000 experiment remains closed; the separate frozen EGP100,000 Phase 3 plan is not run by this component. User notes and holdings remain intact.

The dispatcher reads the existing ledger for continuity and reports unresolved exit obligations. It does not pretend that listing a pending exit has executed it. The old collector's legacy execution mode remains a separate manual interface; dispatcher calls only `--observation-only`.

## Remaining gates and next work

1. **W1 source rights/capability** remains unresolved. No `agent/source-access.json` approval was fabricated. Per-source denial is explicit and does not become global success. The source-access register from batch 1 remains applicable.
2. **W3 authoritative data semantics** remains incomplete: effective-dated identity/action rules, official session/trading constraints, full event-category coverage, prospective universe/vintage archives and corporate-action-aware returns. Current public-feed coverage and provider session metadata do not certify these.
3. **W5/W6 v5 analytical and execution runtime** is the next engineering work: frozen signal/reference calculations and hypothesis mapping, substantive model challenge, Risk Agent semantics, funded sizing, order lifecycle and ledger invariants. Preserve unrestricted justified paper discretion in its specified arm; do not substitute the legacy engine.
4. **W7–W9 integrated validation** still needs complete controlled comparisons, session-equivalent lifecycle/fault replays, independent challenge, migration/rollback and client comprehension evidence. No automatic strategy promotion follows from these 171 software tests.
5. **W10 activation** still requires authorized actual-session rehearsals, measured end-to-end timing/throughput, source/rule clearance, frozen pilot dates and a separate start decision. Schedules remain paused.

This batch is an implemented orchestration component with passing offline checks. The complete W4 operational acceptance gate remains open until permitted live source adapters and actual-session timing are demonstrated. Phase 4 is **not yet ready to start**.

## Recovery and release

Use the existing verified batch-1 source/data/dependency backup to recover the baseline in isolation. Do not restore that old ledger over newer observations as a normal code rollback. The new dispatcher sidecar uses independent additive tables and keeps original evidence in place. Follow the exact-owner recovery commands in the operating contract; never delete active locks or clear successful receipts to force a rerun. No remote push was performed.
